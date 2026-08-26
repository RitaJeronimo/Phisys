const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');

// POST /api/sessoes/iniciar — inicia nova sessão
router.post('/iniciar', auth, async (req, res) => {
  const { nivel_motivacao, modo } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO sessoes (usuario_id, nivel_motivacao, modo)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.usuario.id, nivel_motivacao, modo]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao iniciar sessao:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// PUT /api/sessoes/:id/finalizar — finaliza sessão
router.put('/:id/finalizar', auth, async (req, res) => {
  const { id } = req.params;
  const { duracao_segundos } = req.body;

  try {
    // xp_total e saude_final nunca vem do cliente (era possivel forjar
    // xp_total:99999 e inflar o ranking pra sempre via GREATEST). O
    // ranking.xp_total ja e mantido correto a cada resposta em
    // desafios.js's /checar (fechar:true), e animal.saude a cada cuidado -
    // aqui so relemos essas fontes de verdade, o mesmo padrao que o resto
    // do backend ja usa.
    const rankingAtual = await pool.query('SELECT xp_total FROM ranking WHERE usuario_id = $1', [req.usuario.id]);
    const xpTotal = rankingAtual.rows.length > 0 ? Number(rankingAtual.rows[0].xp_total) || 0 : 0;

    const animalAtual = await pool.query('SELECT saude FROM animal WHERE usuario_id = $1', [req.usuario.id]);
    const saudeFinal = animalAtual.rows.length > 0 ? Number(animalAtual.rows[0].saude) || 0 : 0;

    const result = await pool.query(
      `UPDATE sessoes SET
        finalizada_em    = NOW(),
        duracao_segundos = $1,
        xp_total         = $2,
        saude_final      = $3
       WHERE id = $4 AND usuario_id = $5
       RETURNING *`,
      [duracao_segundos, xpTotal, saudeFinal, id, req.usuario.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Sessao nao encontrada.' });
    }

    // Atualiza ranking
    await pool.query(
      `INSERT INTO ranking (usuario_id, xp_total, sessoes, media_saude)
       VALUES ($1, $2, 1, $3)
       ON CONFLICT (usuario_id) DO UPDATE SET
         xp_total      = $2,
         sessoes       = ranking.sessoes + 1,
         media_saude   = ($3 + ranking.media_saude) / 2,
         atualizado_em = NOW()`,
      [req.usuario.id, xpTotal, saudeFinal]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao finalizar sessao:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// GET /api/sessoes — historico de sessoes do aluno
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM sessoes
       WHERE usuario_id = $1
       ORDER BY iniciada_em DESC
       LIMIT 20`,
      [req.usuario.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar sessoes:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

module.exports = router;