const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { requireProfessor, mesmaTurmaDoRecurso } = require('../middleware/turmaOwnership');

// GET /api/usuarios – lista os alunos da turma do professor logado
router.get('/', auth, requireProfessor, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.nome, u.matricula, u.modo, u.criado_em,
              r.xp_total, r.sessoes, r.media_saude
       FROM usuarios u
       LEFT JOIN ranking r ON r.usuario_id = u.id
       WHERE u.modo = 'aluno' AND u.turma_id = $1
       ORDER BY r.xp_total DESC NULLS LAST`,
      [req.usuario.turma_id]
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
      `SELECT u.id, u.nome, u.matricula, u.modo, u.criado_em,
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
// aluno (so da propria turma); ele passa a poder definir uma nova na proxima
// tentativa de entrar com a propria matricula (mesmo mecanismo de POST /api/auth/registro).
router.put('/:id/resetar-senha', auth, requireProfessor, mesmaTurmaDoRecurso('usuarios'), async (req, res) => {
  const { id } = req.params;
  try {
    const senhaTemporaria = crypto.randomBytes(24).toString('hex');
    const senha_hash = await bcrypt.hash(senhaTemporaria, 10);
    const result = await pool.query(
      `UPDATE usuarios SET senha_hash = $1, senha_definida_pelo_aluno = false
       WHERE id = $2 AND modo = 'aluno' RETURNING id, nome, matricula`,
      [senha_hash, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Aluno nao encontrado.' });
    }
    res.json({ ok: true, mensagem: 'Senha invalidada. O aluno podera definir uma nova senha na proxima vez que tentar entrar.' });
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

// DELETE /api/usuarios – professor limpa todos os alunos da propria turma
router.delete('/', auth, requireProfessor, async (req, res) => {
  try {
    await pool.query('DELETE FROM usuarios WHERE modo = $1 AND turma_id = $2', ['aluno', req.usuario.turma_id]);
    res.json({ ok: true, mensagem: 'Todos os alunos da turma foram removidos com sucesso.' });
  } catch (err) {
    console.error('Erro ao limpar alunos:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

module.exports = router;
