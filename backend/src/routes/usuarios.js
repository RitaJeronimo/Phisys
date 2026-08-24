const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { requireProfessor, mesmaTurmaDoRecurso, resolveTurmaId } = require('../middleware/turmaOwnership');

// GET /api/usuarios – lista os alunos de uma turma do professor logado
// (precisa de turma_id explicito desde o item 3 - professor pode ter varias)
router.get('/', auth, requireProfessor, resolveTurmaId, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.nome, u.matricula, u.modo, u.criado_em, u.curso,
              r.xp_total, r.sessoes, r.media_saude
       FROM usuarios u
       LEFT JOIN ranking r ON r.usuario_id = u.id
       WHERE u.modo = 'aluno' AND u.turma_id = $1
       ORDER BY r.xp_total DESC NULLS LAST`,
      [req.turmaId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao listar usuarios:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// GET /api/usuarios/:id – perfil de um aluno (so da propria turma)
router.get('/:id', auth, requireProfessor, mesmaTurmaDoRecurso('usuarios'), async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT u.id, u.nome, u.matricula, u.modo, u.criado_em, u.curso,
              r.xp_total, r.sessoes, r.media_saude
       FROM usuarios u
       LEFT JOIN ranking r ON r.usuario_id = u.id
       WHERE u.id = $1`,
      [id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao buscar usuario:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// PUT /api/usuarios/:id/resetar-senha – professor invalida a senha atual do
// aluno (so da propria turma) e gera um codigo de 6 digitos, valido por
// 10 min e de uso unico. O aluno usa esse codigo em POST /api/auth/resetar-senha
// pra definir a senha nova (ver A2 da auditoria de seguranca, 15/08/2026).
router.put('/:id/resetar-senha', auth, requireProfessor, mesmaTurmaDoRecurso('usuarios'), async (req, res) => {
  const { id } = req.params;
  try {
    const senhaTemporaria = crypto.randomBytes(24).toString('hex');
    const senha_hash = await bcrypt.hash(senhaTemporaria, 10);
    const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const codigo_hash = await bcrypt.hash(codigo, 10);

    const result = await pool.query(
      `UPDATE usuarios SET senha_hash = $1, senha_definida_pelo_aluno = false
       WHERE id = $2 AND modo = 'aluno' RETURNING id, nome, matricula`,
      [senha_hash, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Aluno nao encontrado.' });
    }

    // So um codigo valido por vez por aluno - gerar um novo mata qualquer
    // codigo anterior ainda nao usado.
    await pool.query(`DELETE FROM reset_senha_tokens WHERE usuario_id = $1 AND usado_em IS NULL`, [id]);
    await pool.query(
      `INSERT INTO reset_senha_tokens (usuario_id, codigo_hash, expira_em)
       VALUES ($1, $2, NOW() + INTERVAL '10 minutes')`,
      [id, codigo_hash]
    );

    res.json({
      ok: true,
      codigo,
      expira_em_minutos: 10,
      mensagem: 'Codigo gerado. Mostre-o ao aluno - ele tem 10 minutos para usa-lo e definir uma senha nova.',
    });
  } catch (err) {
    console.error('Erro ao resetar senha do aluno:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// DELETE /api/usuarios/:id – professor deleta aluno (so da propria turma)
router.delete('/:id', auth, requireProfessor, mesmaTurmaDoRecurso('usuarios'), async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM usuarios WHERE id = $1 AND modo = $2', [id, 'aluno']);
    res.json({ ok: true, mensagem: 'Aluno removido com sucesso.' });
  } catch (err) {
    console.error('Erro ao deletar usuario:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// DELETE /api/usuarios – professor limpa todos os alunos de uma turma dele
router.delete('/', auth, requireProfessor, resolveTurmaId, async (req, res) => {
  try {
    await pool.query('DELETE FROM usuarios WHERE modo = $1 AND turma_id = $2', ['aluno', req.turmaId]);
    res.json({ ok: true, mensagem: 'Todos os alunos da turma foram removidos com sucesso.' });
  } catch (err) {
    console.error('Erro ao limpar alunos:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

module.exports = router;
