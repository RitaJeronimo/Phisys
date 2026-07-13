const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');

const PESOS_PADRAO = { score: 40, survival: 30, challenges: 20, response_time: 10 };
const CHAVES_PESOS = ['peso_score', 'peso_survival', 'peso_challenges', 'peso_response_time'];

// GET /api/configuracoes/pesos – retorna os pesos atuais (ou os padrões, se nunca configurados)
router.get('/pesos', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT chave, valor FROM configuracoes WHERE chave = ANY($1)`,
      [CHAVES_PESOS]
    );
    const encontrados = {};
    result.rows.forEach(r => { encontrados[r.chave] = Number(r.valor); });

    res.json({
      score:         encontrados.peso_score         ?? PESOS_PADRAO.score,
      survival:      encontrados.peso_survival      ?? PESOS_PADRAO.survival,
      challenges:    encontrados.peso_challenges    ?? PESOS_PADRAO.challenges,
      response_time: encontrados.peso_response_time ?? PESOS_PADRAO.response_time,
    });
  } catch (err) {
    console.error('Erro ao buscar pesos:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// PUT /api/configuracoes/pesos – professor salva os pesos da nota automática
router.put('/pesos', auth, async (req, res) => {
  if (req.usuario.modo !== 'professor') {
    return res.status(403).json({ erro: 'Acesso negado.' });
  }
  const { score, survival, challenges, response_time } = req.body;
  const pares = [
    ['peso_score', score],
    ['peso_survival', survival],
    ['peso_challenges', challenges],
    ['peso_response_time', response_time],
  ];

  try {
    for (const [chave, valor] of pares) {
      if (valor === undefined) continue;
      await pool.query(
        `INSERT INTO configuracoes (chave, valor) VALUES ($1, $2)
         ON CONFLICT (chave) DO UPDATE SET valor = $2`,
        [chave, String(valor)]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao salvar pesos:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

module.exports = router;