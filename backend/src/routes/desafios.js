const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');

// GET /api/desafios — lista desafios ativos
router.get('/', auth, async (req, res) => {
  try {
    const isProfessor = req.usuario.modo === 'professor';
const query = isProfessor
  ? 'SELECT * FROM desafios ORDER BY criado_em ASC'
  : 'SELECT * FROM desafios WHERE ativo = TRUE ORDER BY criado_em ASC';
const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao listar desafios:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// POST /api/desafios — cria novo desafio (professor only)
router.post('/', auth, async (req, res) => {
  if (req.usuario.modo !== 'professor') {
    return res.status(403).json({ erro: 'Acesso negado.' });
  }

  const { titulo, pergunta, opcoes, correta, foco, dificuldade, intervencao } = req.body;

  if (!titulo || !pergunta || !opcoes || correta === undefined) {
    return res.status(400).json({ erro: 'Campos obrigatorios ausentes.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO desafios (titulo, pergunta, opcoes, correta, foco, dificuldade, intervencao)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [titulo, pergunta, JSON.stringify(opcoes), correta, foco, dificuldade, intervencao]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao criar desafio:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// PUT /api/desafios/:id — edita desafio (professor only)
router.put('/:id', auth, async (req, res) => {
  if (req.usuario.modo !== 'professor') {
    return res.status(403).json({ erro: 'Acesso negado.' });
  }

  const { id } = req.params;
  const { titulo, pergunta, opcoes, correta, foco, dificuldade, intervencao, ativo } = req.body;

  try {
    const result = await pool.query(
      `UPDATE desafios SET
        titulo      = COALESCE($1, titulo),
        pergunta    = COALESCE($2, pergunta),
        opcoes      = COALESCE($3, opcoes),
        correta     = COALESCE($4, correta),
        foco        = COALESCE($5, foco),
        dificuldade = COALESCE($6, dificuldade),
        intervencao = COALESCE($7, intervencao),
        ativo       = COALESCE($8, ativo)
       WHERE id = $9 RETURNING *`,
      [titulo, pergunta, opcoes ? JSON.stringify(opcoes) : null, correta, foco, dificuldade, intervencao, ativo, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Desafio nao encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao editar desafio:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// DELETE /api/desafios/:id — exclui desafio (professor only)
router.delete('/:id', auth, async (req, res) => {
  if (req.usuario.modo !== 'professor') {
    return res.status(403).json({ erro: 'Acesso negado.' });
  }

  const { id } = req.params;

  try {
    await pool.query('DELETE FROM desafios WHERE id = $1', [id]);
    res.json({ mensagem: 'Desafio excluido com sucesso.' });
  } catch (err) {
    console.error('Erro ao excluir desafio:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

module.exports = router;