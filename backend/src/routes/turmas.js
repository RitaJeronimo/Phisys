const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');

// GET /api/turmas – lista todas as turmas (apenas professor)
router.get('/', auth, async (req, res) => {
  if (req.usuario.modo !== 'professor') {
    return res.status(403).json({ erro: 'Acesso negado.' });
  }
  try {
    const result = await pool.query(
      'SELECT id, nome, codigo, ativa, criado_em FROM turmas ORDER BY criado_em DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao listar turmas:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// POST /api/turmas – cria uma nova turma (apenas professor)
router.post('/', auth, async (req, res) => {
  if (req.usuario.modo !== 'professor') {
    return res.status(403).json({ erro: 'Acesso negado.' });
  }
  const { nome, codigo } = req.body;
  if (!nome || !codigo) {
    return res.status(400).json({ erro: 'Nome e codigo sao obrigatorios.' });
  }
  try {
    const existe = await pool.query('SELECT id FROM turmas WHERE codigo = $1', [codigo]);
    if (existe.rows.length > 0) {
      return res.status(409).json({ erro: 'Ja existe uma turma com esse codigo.' });
    }
    const result = await pool.query(
      'INSERT INTO turmas (nome, codigo, ativa) VALUES ($1, $2, true) RETURNING id, nome, codigo, ativa, criado_em',
      [nome, codigo]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao criar turma:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// PUT /api/turmas/:id – edita nome, codigo ou status ativa de uma turma (apenas professor)
router.put('/:id', auth, async (req, res) => {
  if (req.usuario.modo !== 'professor') {
    return res.status(403).json({ erro: 'Acesso negado.' });
  }
  const { id } = req.params;
  const { nome, codigo, ativa } = req.body;

  try {
    if (codigo !== undefined) {
      const existe = await pool.query(
        'SELECT id FROM turmas WHERE codigo = $1 AND id != $2',
        [codigo, id]
      );
      if (existe.rows.length > 0) {
        return res.status(409).json({ erro: 'Ja existe uma turma com esse codigo.' });
      }
    }

    const result = await pool.query(
      `UPDATE turmas SET
         nome = COALESCE($1, nome),
         codigo = COALESCE($2, codigo),
         ativa = COALESCE($3, ativa)
       WHERE id = $4
       RETURNING id, nome, codigo, ativa, criado_em`,
      [nome, codigo, ativa, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Turma nao encontrada.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao editar turma:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// GET /api/turmas/validar/:codigo – valida um codigo de turma (sem auth, usado no login/cadastro)
router.get('/validar/:codigo', async (req, res) => {
  const { codigo } = req.params;
  try {
    const result = await pool.query(
      'SELECT id, nome FROM turmas WHERE codigo = $1 AND ativa = true',
      [codigo]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Codigo de turma invalido ou turma inativa.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao validar turma:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

module.exports = router;