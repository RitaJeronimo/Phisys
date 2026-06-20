const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');

// GET /api/usuarios – lista todos os alunos (professor only)
router.get('/', auth, async (req, res) => {
  if (req.usuario.modo !== 'professor') {
    return res.status(403).json({ erro: 'Acesso negado.' });
  }
  try {
    const result = await pool.query(
      `SELECT u.id, u.nome, u.matricula, u.modo, u.criado_em,
              r.xp_total, r.sessoes, r.media_saude
       FROM usuarios u
       LEFT JOIN ranking r ON r.usuario_id = u.id
       WHERE u.modo = 'aluno'
       ORDER BY r.xp_total DESC NULLS LAST`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao listar usuarios:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// GET /api/usuarios/:id – perfil de um aluno
router.get('/:id', auth, async (req, res) => {
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
    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Usuario nao encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao buscar usuario:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// DELETE /api/usuarios/:id – professor deleta aluno
router.delete('/:id', auth, async (req, res) => {
  if (req.usuario.modo !== 'professor') {
    return res.status(403).json({ erro: 'Acesso negado.' });
  }
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM usuarios WHERE id = $1 AND modo = $2', [id, 'aluno']);
    res.json({ ok: true, mensagem: 'Aluno removido com sucesso.' });
  } catch (err) {
    console.error('Erro ao deletar usuario:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// DELETE /api/usuarios – professor limpa TODOS os alunos
router.delete('/', auth, async (req, res) => {
  if (req.usuario.modo !== 'professor') {
    return res.status(403).json({ erro: 'Acesso negado.' });
  }
  try {
    await pool.query('DELETE FROM usuarios WHERE modo = $1', ['aluno']);
    res.json({ ok: true, mensagem: 'Todos os alunos removidos com sucesso.' });
  } catch (err) {
    console.error('Erro ao limpar alunos:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

module.exports = router;