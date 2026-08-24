const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');
const { requireProfessor, mesmaTurmaDoRecurso, resolveTurmaId } = require('../middleware/turmaOwnership');

// GET /api/parametros - lista os parametros customizados de uma turma
// (professor gerencia, aluno so consulta - aluno usa a propria turma do
// token; professor precisa informar turma_id, e so ve o que e dele - ver
// resolveTurmaId, item 3)
router.get('/', auth, resolveTurmaId, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM parametros_customizados WHERE turma_id = $1 ORDER BY criado_em DESC',
      [req.turmaId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao listar parametros:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// POST /api/parametros - cria um novo tipo de parametro numa turma do professor logado
router.post('/', auth, requireProfessor, resolveTurmaId, async (req, res) => {
  const { nome, unidade, valor_min, valor_max } = req.body;
  if (!nome || valor_min === undefined || valor_min === null || valor_max === undefined || valor_max === null) {
    return res.status(400).json({ erro: 'Nome, valor minimo e valor maximo sao obrigatorios.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO parametros_customizados (turma_id, nome, unidade, valor_min, valor_max)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.turmaId, nome, unidade || null, valor_min, valor_max]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao criar parametro:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// PUT /api/parametros/:id - edita ou desativa (soft-delete via ativo=false) um
// parametro da propria turma (so o dono, via mesmaTurmaDoRecurso)
router.put('/:id', auth, requireProfessor, mesmaTurmaDoRecurso('parametros_customizados'), async (req, res) => {
  const { id } = req.params;
  const { nome, unidade, valor_min, valor_max, ativo } = req.body;
  try {
    const result = await pool.query(
      `UPDATE parametros_customizados SET
         nome      = COALESCE($1, nome),
         unidade   = COALESCE($2, unidade),
         valor_min = COALESCE($3, valor_min),
         valor_max = COALESCE($4, valor_max),
         ativo     = COALESCE($5, ativo)
       WHERE id = $6 RETURNING *`,
      [nome, unidade, valor_min, valor_max, ativo, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao editar parametro:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

module.exports = router;
