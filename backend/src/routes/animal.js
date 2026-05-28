const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');

// GET /api/animal — estado atual do animal do aluno logado
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM animal WHERE usuario_id = $1',
      [req.usuario.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Animal nao encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao buscar animal:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// PUT /api/animal — atualiza estado do animal
router.put('/', auth, async (req, res) => {
  const { energia, hidratacao, pas, pad, fc, peso, saude, age_days } = req.body;

  try {
    const result = await pool.query(
      `UPDATE animal SET
        energia     = COALESCE($1, energia),
        hidratacao  = COALESCE($2, hidratacao),
        pas         = COALESCE($3, pas),
        pad         = COALESCE($4, pad),
        fc          = COALESCE($5, fc),
        peso        = COALESCE($6, peso),
        saude       = COALESCE($7, saude),
        age_days    = COALESCE($8, age_days),
        atualizado_em = NOW()
       WHERE usuario_id = $9
       RETURNING *`,
      [energia, hidratacao, pas, pad, fc, peso, saude, age_days, req.usuario.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Animal nao encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao atualizar animal:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// POST /api/animal/cuidado — aplica cuidado diario
router.post('/cuidado', auth, async (req, res) => {
  const { cuidado_id } = req.body;

  const cuidados = {
    hidratacao: { hidratacao: 20 },
    racao:      { energia: 30 },
    maravalha:  { energia: 10, saude: 5 },
  };

  const efeito = cuidados[cuidado_id];
  if (!efeito) {
    return res.status(400).json({ erro: 'Cuidado invalido.' });
  }

  try {
    const animal = await pool.query(
      'SELECT * FROM animal WHERE usuario_id = $1',
      [req.usuario.id]
    );

    if (animal.rows.length === 0) {
      return res.status(404).json({ erro: 'Animal nao encontrado.' });
    }

    const a = animal.rows[0];
    const novaHidratacao = efeito.hidratacao ? Math.min(100, a.hidratacao + efeito.hidratacao) : a.hidratacao;
    const novaEnergia    = efeito.energia    ? Math.min(100, a.energia    + efeito.energia)    : a.energia;
    const novaSaude      = efeito.saude      ? Math.min(100, a.saude      + efeito.saude)      : a.saude;

    const result = await pool.query(
      `UPDATE animal SET
        hidratacao    = $1,
        energia       = $2,
        saude         = $3,
        atualizado_em = NOW()
       WHERE usuario_id = $4
       RETURNING *`,
      [novaHidratacao, novaEnergia, novaSaude, req.usuario.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao aplicar cuidado:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// PUT /api/animal/age — professor atualiza idade de todos os alunos
router.put('/age', auth, async (req, res) => {
  if (req.usuario.modo !== 'professor') {
    return res.status(403).json({ erro: 'Acesso negado.' });
  }
  const { age_days } = req.body;
  try {
    await pool.query(
      `UPDATE animal SET age_days = $1, atualizado_em = NOW()`,
      [age_days]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

module.exports = router;