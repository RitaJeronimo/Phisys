const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');
const { requireProfessor, mesmaTurmaDoRecurso } = require('../middleware/turmaOwnership');

// GET /api/ranking – ranking da turma do usuario logado (aluno ou professor)
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.nome, u.matricula,
       r.xp_total, r.sessoes, r.media_saude, r.nota_final,
       RANK() OVER (ORDER BY r.xp_total DESC) AS posicao
       FROM usuarios u
       JOIN ranking r ON r.usuario_id = u.id
       WHERE u.modo = 'aluno' AND u.turma_id = $1
       ORDER BY r.xp_total DESC
       LIMIT 50`,
      [req.usuario.turma_id]
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
       VALUES ($1, $2, 0, $3)
       ON CONFLICT (usuario_id) DO UPDATE SET
         xp_total      = $2,
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

// PUT /api/ranking/:id/nota – professor salva nota do aluno (so aluno da propria turma)
router.put('/:id/nota', auth, requireProfessor, mesmaTurmaDoRecurso('usuarios'), async (req, res) => {
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

// POST /api/ranking/reset – professor zera a propria turma (ranking + sessões + animais)
router.post('/reset', auth, requireProfessor, async (req, res) => {
  const turma_id = req.usuario.turma_id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // 1. Zera ranking dos alunos da turma
    await client.query(`
      UPDATE ranking SET
        xp_total      = 0,
        sessoes       = 0,
        media_saude   = 0,
        nota_final    = NULL,
        atualizado_em = NOW()
      WHERE usuario_id IN (SELECT id FROM usuarios WHERE modo = 'aluno' AND turma_id = $1)
    `, [turma_id]);
    // 2. Deleta sessões dos alunos da turma
    await client.query(`
      DELETE FROM sessoes
      WHERE usuario_id IN (SELECT id FROM usuarios WHERE modo = 'aluno' AND turma_id = $1)
    `, [turma_id]);
    // 3. Reseta animais dos alunos da turma para os valores padrão
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
      WHERE usuario_id IN (SELECT id FROM usuarios WHERE modo = 'aluno' AND turma_id = $1)
    `, [turma_id]);
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
