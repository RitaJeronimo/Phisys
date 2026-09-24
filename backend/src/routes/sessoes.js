const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');

// POST /api/sessoes/iniciar — inicia nova sessão
router.post('/iniciar', auth, async (req, res) => {
  const { nivel_motivacao, modo } = req.body;

  try {
    // nivel_motivacao so vem preenchido quando o aluno acabou de responder a
    // escala nesta mesma carga de pagina (App.js's motivacaoRespondidaAgora) -
    // null/ausente significa "nao sei, foi um reload", entao busca a resposta
    // ja registrada hoje em vez de deixar a sessao sem motivacao ou gravar o
    // default do React por engano (bug real corrigido aqui). "Hoje" e no fuso
    // America/Sao_Paulo, dado de pesquisa sobre o dia do aluno, nao do
    // servidor - iniciada_em e TIMESTAMP puro (sem fuso), gravado como
    // relogio UTC (mesmo raciocinio do ajuste de cuidados_uso/simulacoes em
    // schema.js, "evita erro de +3h em Recife/UTC-3"), entao reinterpreta como
    // UTC antes de converter pro fuso do aluno.
    let nivelFinal = nivel_motivacao;
    if (nivelFinal === null || nivelFinal === undefined) {
      const motivacaoHoje = await pool.query(
        `SELECT nivel_motivacao FROM sessoes
         WHERE usuario_id = $1 AND nivel_motivacao IS NOT NULL
           AND (iniciada_em AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date
             = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
         ORDER BY iniciada_em ASC LIMIT 1`,
        [req.usuario.id]
      );
      nivelFinal = motivacaoHoje.rows.length > 0 ? motivacaoHoje.rows[0].nivel_motivacao : null;
    }

    const result = await pool.query(
      `INSERT INTO sessoes (usuario_id, nivel_motivacao, modo)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.usuario.id, nivelFinal, modo]
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

// PUT /api/sessoes/:id/progresso — heartbeat periodico (a cada 30s, ver
// App.js) + chamada explicita no botao "voltar" e no logout/turma-desativada:
// atualiza duracao_segundos ao vivo pra sessao nao ficar NULL pra sempre se o
// aluno abandonar no meio (fecha a aba, cai de internet, etc.) sem nunca
// chegar no PUT /finalizar. Calculado no servidor (NOW() - iniciada_em), nao
// confia em nenhum valor vindo do cliente. So grava enquanto a sessao ainda
// esta aberta (finalizada_em IS NULL) - um heartbeat atrasado que chegue
// depois do /finalizar de verdade vira no-op (WHERE nao bate em nenhuma
// linha). Tambem grava um snapshot best-effort de xp_total/saude_final (item
// 4 do walkthrough, 23/09/2026: sessao abandonada perdia esses dados de
// pesquisa), relidos das mesmas fontes de verdade do /finalizar
// (ranking.xp_total, animal.saude) - nunca do cliente. Feito com subqueries
// num unico UPDATE em vez de 2 SELECTs + UPDATE como no /finalizar: e 1 ida
// ao banco por heartbeat (roda a cada 30s por aluno com jogo aberto) e o
// snapshot sai atomico. Continua sem mexer em finalizada_em nem no contador
// ranking.sessoes - isso so acontece no /finalizar de verdade (decisao
// deliberada da Rita, 16/09/2026, reconfirmada 23/09: sessao abandonada nao
// conta como "completada"; na planilha ela segue identificavel pelo
// "Finalizada em" vazio).
router.put('/:id/progresso', auth, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE sessoes SET
        duracao_segundos = EXTRACT(EPOCH FROM (NOW() - iniciada_em))::int,
        xp_total         = COALESCE((SELECT xp_total FROM ranking WHERE usuario_id = $2), 0),
        saude_final      = COALESCE((SELECT saude FROM animal WHERE usuario_id = $2), 0)
       WHERE id = $1 AND usuario_id = $2 AND finalizada_em IS NULL
       RETURNING id, duracao_segundos, xp_total, saude_final`,
      [id, req.usuario.id]
    );
    res.json(result.rows[0] || { id: Number(id), duracao_segundos: null });
  } catch (err) {
    console.error('Erro ao atualizar progresso da sessao:', err.message);
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