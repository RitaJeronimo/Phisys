const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');

// GET /api/ranking – ranking geral da turma
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.nome, u.matricula,
       r.xp_total, r.sessoes, r.media_saude, r.nota_final,
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

// PUT /api/ranking – atualiza XP do aluno
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

// PUT /api/ranking/:id/nota – professor salva nota do aluno
router.put('/:id/nota', auth, async (req, res) => {
  if (req.usuario.modo !== 'professor') {
    return res.status(403).json({ erro: 'Acesso negado.' });
  }
  const { id } = req.params;
  const { nota_final } = req.body;
  try {
    const result = await pool.query(
      `UPDATE ranking SET nota_final = $1, atualizado_em = NOW()
       WHERE usuario_id = $2 RETURNING *`,
      [nota_final, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao salvar nota:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// POST /api/ranking/reset – professor zera turma (ranking + sessões + animais)
router.post('/reset', auth, async (req, res) => {
  if (req.usuario.modo !== 'professor') {
    return res.status(403).json({ erro: 'Acesso negado.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Zera ranking de todos os alunos
    await client.query(`
      UPDATE ranking SET
        xp_total      = 0,
        sessoes       = 0,
        media_saude   = 0,
        nota_final    = NULL,
        atualizado_em = NOW()
      WHERE usuario_id IN (SELECT id FROM usuarios WHERE modo = 'aluno')
    `);

    // 2. Deleta sessões de todos os alunos
    await client.query(`
      DELETE FROM sessoes
      WHERE usuario_id IN (SELECT id FROM usuarios WHERE modo = 'aluno')
    `);

    // 3. Reseta animais para os valores padrão
    await client.query(`
      UPDATE animal SET
        energia       = 80,
        hidratacao    = 70,
        pas           = 110,
        pad           = 70,
        fc            = 370,
        peso          = 300,
        saude         = 85,
        atualizado_em = NOW()
      WHERE usuario_id IN (SELECT id FROM usuarios WHERE modo = 'aluno')
    `);

    await client.query('COMMIT');
    res.json({ ok: true, mensagem: 'Turma zerada com sucesso.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao zerar turma:', err.message);
    res.status(500).json({ erro: 'Erro interno ao zerar turma.' });
  } finally {
    client.release();
  }
});

module.exports = router;