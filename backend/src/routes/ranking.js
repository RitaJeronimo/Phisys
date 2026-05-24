const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');

// GET /api/ranking — ranking geral da turma
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.nome, u.matricula,
              r.xp_total, r.sessoes, r.media_saude,
              RANK() OVER (ORDER BY r.xp_total DESC) AS posicao
       FROM usuarios u
       JOIN ranking r ON r.usuario_id = u.id
       WHERE u.modo = 'aluno'
       ORDER BY r.xp_total DESC
       LIMIT 50`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar ranking:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// PUT /api/ranking — atualiza XP do aluno
router.put('/', auth, async (req, res) => {
  const { xp_total, media_saude } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO ranking (usuario_id, xp_total, sessoes, media_saude)
       VALUES ($1, $2, 1, $3)
       ON CONFLICT (usuario_id) DO UPDATE SET
         xp_total      = GREATEST(ranking.xp_total, $2),
         sessoes       = ranking.sessoes + 1,
         media_saude   = ($3 + ranking.media_saude) / 2,
         atualizado_em = NOW()
       RETURNING *`,
      [req.usuario.id, xp_total, media_saude]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao atualizar ranking:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

module.exports = router;