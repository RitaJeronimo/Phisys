const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');
const { requireProfessor } = require('../middleware/turmaOwnership');

const PESOS_PADRAO = { score: 40, survival: 30, challenges: 20, response_time: 10 };
const CHAVES_PESOS = ['peso_score', 'peso_survival', 'peso_challenges', 'peso_response_time'];

// GET /api/configuracoes/pesos – retorna os pesos atuais (ou os padrões, se nunca configurados)
router.get('/pesos', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT chave, valor FROM configuracoes WHERE chave = ANY($1) AND turma_id = $2`,
      [CHAVES_PESOS, req.usuario.turma_id]
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
// (so afeta a propria turma - ver M3 na auditoria)
router.put('/pesos', auth, requireProfessor, async (req, res) => {
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
        `INSERT INTO configuracoes (chave, valor, turma_id) VALUES ($1, $2, $3)
         ON CONFLICT (chave, turma_id) DO UPDATE SET valor = $2`,
        [chave, String(valor), req.usuario.turma_id]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao salvar pesos:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// ── RECUPERAÇÃO DO ANIMAL (multiplicador + desafios extras) ──────────────
// Controles do professor para calibrar a dificuldade de recuperação do
// animal apos uma simulacao/crise. Editaveis a qualquer momento.

const RECUPERACAO_PADRAO = { multiplicador: 1, desafios_extras: 0 };

// GET /api/configuracoes/recuperacao – retorna multiplicador e desafios extras atuais
router.get('/recuperacao', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT chave, valor FROM configuracoes WHERE chave = ANY($1) AND turma_id = $2`,
      [['recuperacao_multiplicador', 'recuperacao_desafios_extras'], req.usuario.turma_id]
    );
    const encontrados = {};
    result.rows.forEach(r => { encontrados[r.chave] = Number(r.valor); });

    res.json({
      multiplicador:   encontrados.recuperacao_multiplicador   ?? RECUPERACAO_PADRAO.multiplicador,
      desafios_extras: encontrados.recuperacao_desafios_extras ?? RECUPERACAO_PADRAO.desafios_extras,
    });
  } catch (err) {
    console.error('Erro ao buscar config de recuperacao:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// PUT /api/configuracoes/recuperacao – professor salva multiplicador e desafios extras
// (so afeta a propria turma - ver M3 na auditoria)
router.put('/recuperacao', auth, requireProfessor, async (req, res) => {
  const { multiplicador, desafios_extras } = req.body;
  const pares = [
    ['recuperacao_multiplicador', multiplicador],
    ['recuperacao_desafios_extras', desafios_extras],
  ];

  try {
    for (const [chave, valor] of pares) {
      if (valor === undefined) continue;
      await pool.query(
        `INSERT INTO configuracoes (chave, valor, turma_id) VALUES ($1, $2, $3)
         ON CONFLICT (chave, turma_id) DO UPDATE SET valor = $2`,
        [chave, String(valor), req.usuario.turma_id]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao salvar config de recuperacao:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

module.exports = router;