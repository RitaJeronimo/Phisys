const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { requireProfessor, mesmaTurmaDoRecurso, resolveTurmaId } = require('../middleware/turmaOwnership');

// Gera e grava um codigo de 6 digitos de uso unico (10 min) pra um aluno
// definir/redefinir a propria senha em POST /api/auth/resetar-senha.
// Compartilhado entre o cadastro manual (POST /, item 4) e o reset de senha
// (PUT /:id/resetar-senha, ja existia desde o A2 da auditoria de seguranca) -
// sao o mesmo mecanismo: "conta sem senha utilizavel, so codigo destrava".
async function gerarCodigoAcesso(usuario_id) {
  const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const codigo_hash = await bcrypt.hash(codigo, 10);
  // So um codigo valido por vez por aluno - gerar um novo mata qualquer
  // codigo anterior ainda nao usado.
  await pool.query(`DELETE FROM reset_senha_tokens WHERE usuario_id = $1 AND usado_em IS NULL`, [usuario_id]);
  await pool.query(
    `INSERT INTO reset_senha_tokens (usuario_id, codigo_hash, expira_em)
     VALUES ($1, $2, NOW() + INTERVAL '10 minutes')`,
    [usuario_id, codigo_hash]
  );
  return codigo;
}

// POST /api/usuarios – professor cadastra um aluno manualmente numa turma
// dele (item 4 do pedido da Marcia/Rita, 24/08/2026: autocadastro de aluno
// foi removido, ver POST /api/auth/registro). O codigo da turma e pedido
// aqui de proposito como segunda confirmacao, mesmo com a turma ja
// selecionada no Painel (pedido explicito da Rita) - evita cadastrar na
// turma errada por engano. Sem senha nesse momento: nasce com um hash
// placeholder inutilizavel (mesmo padrao do reset de senha abaixo) e um
// codigo de acesso de uso unico, que o professor entrega ao aluno pra ele
// definir a propria senha no primeiro acesso via POST /api/auth/resetar-senha
// (reaproveita o fluxo do A2 em vez de criar um "primeiro login" novo baseado
// so em matricula, que nao e segredo neste app - ver GET /api/ranking).
router.post('/', auth, requireProfessor, resolveTurmaId, async (req, res) => {
  const { nome, matricula, codigo_turma } = req.body;
  if (!nome || !matricula || !codigo_turma) {
    return res.status(400).json({ erro: 'Nome, matricula e codigo da turma sao obrigatorios.' });
  }
  try {
    const turma = await pool.query('SELECT codigo FROM turmas WHERE id = $1', [req.turmaId]);
    if (turma.rows.length === 0 || turma.rows[0].codigo !== codigo_turma) {
      return res.status(400).json({ erro: 'Codigo da turma nao confere com a turma selecionada.' });
    }

    const existe = await pool.query('SELECT id FROM usuarios WHERE matricula = $1', [matricula]);
    if (existe.rows.length > 0) {
      return res.status(409).json({ erro: 'Matricula ja cadastrada.' });
    }

    const senhaTemporaria = crypto.randomBytes(24).toString('hex');
    const senha_hash = await bcrypt.hash(senhaTemporaria, 10);
    const result = await pool.query(
      `INSERT INTO usuarios (nome, matricula, senha_hash, modo, turma_id, senha_definida_pelo_aluno)
       VALUES ($1, $2, $3, 'aluno', $4, false) RETURNING id, nome, matricula`,
      [nome, matricula, senha_hash, req.turmaId]
    );
    const usuario = result.rows[0];

    await pool.query('INSERT INTO animal (usuario_id) VALUES ($1)', [usuario.id]);
    await pool.query('INSERT INTO ranking (usuario_id) VALUES ($1)', [usuario.id]);

    const codigo = await gerarCodigoAcesso(usuario.id);

    res.status(201).json({
      id: usuario.id,
      nome: usuario.nome,
      matricula: usuario.matricula,
      codigo,
      expira_em_minutos: 10,
      mensagem: 'Aluno cadastrado. Mostre o codigo a ele - tem 10 minutos para definir a propria senha.',
    });
  } catch (err) {
    console.error('Erro ao cadastrar aluno:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

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

    const result = await pool.query(
      `UPDATE usuarios SET senha_hash = $1, senha_definida_pelo_aluno = false
       WHERE id = $2 AND modo = 'aluno' RETURNING id, nome, matricula`,
      [senha_hash, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Aluno nao encontrado.' });
    }

    const codigo = await gerarCodigoAcesso(id);

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
