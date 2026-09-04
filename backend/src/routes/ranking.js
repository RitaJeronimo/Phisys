const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');
const { requireProfessor, mesmaTurmaDoRecurso, resolveTurmaId } = require('../middleware/turmaOwnership');

// GET /api/ranking – ranking da turma do usuario logado (aluno) ou de uma
// turma escolhida do professor logado (turma_id explicito desde o item 3)
router.get('/', auth, resolveTurmaId, async (req, res) => {
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
      [req.turmaId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar ranking:', err.message);
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

// POST /api/ranking/reset – professor zera uma turma dele (ranking + sessões + animais)
router.post('/reset', auth, requireProfessor, resolveTurmaId, async (req, res) => {
  const turma_id = req.turmaId;
  const client = await pool.connect();
  // Erros de conexao emitidos por um client "checked-out" (ex: Neon encerrando
  // a conexao por administrador, plano free) nao passam pelo pool.on('error')
  // em connection.js - esse so cobre clients ociosos DENTRO da pool. Sem este
  // handler, o evento 'error' nao tratado derruba o processo inteiro.
  client.on('error', (err) => {
    console.error('Erro na conexao do client durante a transacao (zerar turma):', err.message);
  });
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
        peso          = 125,
        saude         = 85,
        atualizado_em = NOW()
      WHERE usuario_id IN (SELECT id FROM usuarios WHERE modo = 'aluno' AND turma_id = $1)
    `, [turma_id]);
    // 4. Limpa contadores de cuidados - sem isso, um aluno que ja tinha
    //    batido o limite (Modo Sessao) ou estava em cooldown (Modo Livre)
    //    continuava bloqueado mesmo com o animal resetado pro padrao
    //    (bug real, varredura funcional de 25/08/2026).
    await client.query(`
      DELETE FROM cuidados_sessao_contagem
      WHERE usuario_id IN (SELECT id FROM usuarios WHERE modo = 'aluno' AND turma_id = $1)
    `, [turma_id]);
    await client.query(`
      DELETE FROM cuidados_uso
      WHERE usuario_id IN (SELECT id FROM usuarios WHERE modo = 'aluno' AND turma_id = $1)
    `, [turma_id]);
    await client.query('COMMIT');
    res.json({ ok: true, mensagem: 'Turma zerada com sucesso.' });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Erro ao tentar ROLLBACK (conexao provavelmente ja perdida):', rollbackErr.message);
    }
    console.error('Erro ao zerar turma:', err.message);
    res.status(500).json({ erro: 'Erro interno ao zerar turma.' });
  } finally {
    client.release();
  }
});

module.exports = router;
