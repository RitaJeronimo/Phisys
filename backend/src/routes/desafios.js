const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');
const { requireProfessor, mesmaTurmaDoRecurso } = require('../middleware/turmaOwnership');

// GET /api/desafios – lista desafios da turma do usuario logado (aluno ou professor)
router.get('/', auth, async (req, res) => {
  try {
    const isProfessor = req.usuario.modo === 'professor';
    const query = isProfessor
      ? 'SELECT * FROM desafios WHERE turma_id = $1 ORDER BY criado_em ASC'
      : 'SELECT * FROM desafios WHERE ativo = TRUE AND turma_id = $1 ORDER BY criado_em ASC';
    const result = await pool.query(query, [req.usuario.turma_id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao listar desafios:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// POST /api/desafios – cria novo desafio na turma do professor logado
router.post('/', auth, requireProfessor, async (req, res) => {
  const { titulo, pergunta, opcoes, correta, foco, dificuldade, intervencao, delta_acerto, delta_erro } = req.body;
  if (!titulo || !pergunta || !opcoes || correta === undefined) {
    return res.status(400).json({ erro: 'Campos obrigatorios ausentes.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO desafios (titulo, pergunta, opcoes, correta, foco, dificuldade, intervencao, delta_acerto, delta_erro, turma_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        titulo, pergunta, JSON.stringify(opcoes), correta, foco, dificuldade, intervencao,
        JSON.stringify(delta_acerto || {}),
        JSON.stringify(delta_erro || {}),
        req.usuario.turma_id,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao criar desafio:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// PUT /api/desafios/:id – edita desafio (so o dono da turma do desafio)
router.put('/:id', auth, requireProfessor, mesmaTurmaDoRecurso('desafios'), async (req, res) => {
  const { id } = req.params;
  const { titulo, pergunta, opcoes, correta, foco, dificuldade, intervencao, ativo, delta_acerto, delta_erro } = req.body;
  try {
    const result = await pool.query(
      `UPDATE desafios SET
        titulo       = COALESCE($1, titulo),
        pergunta     = COALESCE($2, pergunta),
        opcoes       = COALESCE($3, opcoes),
        correta      = COALESCE($4, correta),
        foco         = COALESCE($5, foco),
        dificuldade  = COALESCE($6, dificuldade),
        intervencao  = COALESCE($7, intervencao),
        ativo        = COALESCE($8, ativo),
        delta_acerto = COALESCE($9, delta_acerto),
        delta_erro   = COALESCE($10, delta_erro)
       WHERE id = $11 RETURNING *`,
      [
        titulo, pergunta,
        opcoes ? JSON.stringify(opcoes) : null,
        correta, foco, dificuldade, intervencao, ativo,
        delta_acerto ? JSON.stringify(delta_acerto) : null,
        delta_erro   ? JSON.stringify(delta_erro)   : null,
        id,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao editar desafio:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// DELETE /api/desafios/:id – exclui desafio (so o dono da turma do desafio)
router.delete('/:id', auth, requireProfessor, mesmaTurmaDoRecurso('desafios'), async (req, res) => {
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
