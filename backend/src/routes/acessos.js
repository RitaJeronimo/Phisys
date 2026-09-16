const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');

// POST /api/acessos/registrar — grava o acesso do dia quando o frontend
// restaura a sessao a partir do token salvo no localStorage (App.js), o
// unico caminho de uso que nunca batia no backend ate agora (ver comentario
// em schema.js). Idempotente via ON CONFLICT: chamar mais de uma vez no
// mesmo dia e barato, sem duplicar linha.
router.post('/registrar', auth, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO acessos_diarios (usuario_id, data)
       VALUES ($1, (NOW() AT TIME ZONE 'America/Sao_Paulo')::date)
       ON CONFLICT (usuario_id, data) DO NOTHING`,
      [req.usuario.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao registrar acesso:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

module.exports = router;
