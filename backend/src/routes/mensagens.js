const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');

const DEFAULT_MESSAGES = {
  1: 'Tudo bem! O Phisys está aqui com você. Mesmo nos dias difíceis, seu ratinho precisa de cuidado. Vamos devagar — cada pequena ação ajuda a manter a homeostase.',
  2: 'Pequenos passos também levam longe. Cuide do Phisys hoje e observe como suas escolhas influenciam o equilíbrio dos sistemas cardiovascular e renal.',
  3: 'Que bom ter você aqui! Explore os parâmetros fisiológicos do Phisys e descubra como hidratação, pressão arterial e frequência cardíaca se relacionam em equilíbrio dinâmico.',
  4: 'Que ótimo! Sua motivação faz diferença no aprendizado. Vamos manter o Phisys em homeostase? Cada decisão sua impacta diretamente a vida do seu ratinho científico.',
  5: 'Incrível! Com essa energia você vai longe. O Phisys está com sorte — cuide dele, teste hipóteses e comprove como o corpo regula seus sistemas em tempo real!',
};

// GET /api/mensagens
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT nivel, texto FROM mensagens ORDER BY nivel');
    if (result.rows.length === 0) {
      return res.json(DEFAULT_MESSAGES);
    }
    const msgs = {};
    result.rows.forEach(r => msgs[r.nivel] = r.texto);
    res.json(msgs);
  } catch (err) {
    res.json(DEFAULT_MESSAGES);
  }
});

// PUT /api/mensagens — professor salva mensagens
router.put('/', auth, async (req, res) => {
  if (req.usuario.modo !== 'professor') {
    return res.status(403).json({ erro: 'Acesso negado.' });
  }
  const { mensagens } = req.body;
  try {
    for (const [nivel, texto] of Object.entries(mensagens)) {
      await pool.query(
        `INSERT INTO mensagens (nivel, texto) VALUES ($1, $2)
         ON CONFLICT (nivel) DO UPDATE SET texto = $2, atualizado_em = NOW()`,
        [Number(nivel), texto]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao salvar mensagens.' });
  }
});

module.exports = router;