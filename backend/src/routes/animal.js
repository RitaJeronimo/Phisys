const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');
const { requireProfessor, resolveTurmaId } = require('../middleware/turmaOwnership');
const { recalcularSaudeTurma } = require('../utils/recalcularSaudeTurma');
const { registrarProgressaoDiaria } = require('../utils/registrarProgressaoDiaria');
const { PRIMARY_PARAMS } = require('../engine/mascotEngine');

const COOLDOWN_HORAS_MODO_LIVRE = 2;

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

// GET /api/animal/cuidado/status — retorna, para cada cuidado, se pode ser usado
// agora e informacoes de contexto (modo sessao/livre, quantos restam, quando libera).
router.get('/cuidado/status', auth, async (req, res) => {
  try {
    const simAtiva = await pool.query(
      'SELECT * FROM simulacoes WHERE ativo = TRUE AND turma_id = $1 ORDER BY criado_em DESC LIMIT 1',
      [req.usuario.turma_id]
    );
    const emSessao = simAtiva.rows.length > 0;
    const cuidadoIds = ['hidratacao', 'racao', 'maravalha'];
    const statusPorCuidado = {};

    if (emSessao) {
      const sessao = simAtiva.rows[0];
      const limite = sessao.cuidados_por_sessao ?? 3;

      for (const cuidadoId of cuidadoIds) {
        const contagemResult = await pool.query(
          `SELECT quantidade FROM cuidados_sessao_contagem
           WHERE usuario_id = $1 AND simulacao_id = $2 AND cuidado_id = $3
             AND data = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date`,
          [req.usuario.id, sessao.id, cuidadoId]
        );
        const usados = contagemResult.rows.length > 0 ? contagemResult.rows[0].quantidade : 0;
        statusPorCuidado[cuidadoId] = {
          disponivel: usados < limite,
          modo: 'sessao',
          usados,
          limite,
        };
      }
    } else {
      for (const cuidadoId of cuidadoIds) {
        const ultimoUsoResult = await pool.query(
          `SELECT usado_em FROM cuidados_uso
           WHERE usuario_id = $1 AND cuidado_id = $2
           ORDER BY usado_em DESC LIMIT 1`,
          [req.usuario.id, cuidadoId]
        );
        if (ultimoUsoResult.rows.length === 0) {
          statusPorCuidado[cuidadoId] = { disponivel: true, modo: 'livre' };
        } else {
          const ultimoUso = new Date(ultimoUsoResult.rows[0].usado_em);
          const liberaEm = new Date(ultimoUso.getTime() + COOLDOWN_HORAS_MODO_LIVRE * 60 * 60 * 1000);
          const agora = new Date();
          statusPorCuidado[cuidadoId] = {
            disponivel: agora >= liberaEm,
            modo: 'livre',
            liberaEm: liberaEm.toISOString(),
          };
        }
      }
    }

    res.json(statusPorCuidado);
  } catch (err) {
    console.error('Erro ao verificar status dos cuidados:', err.message);
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
    // Verifica se existe sessao/simulacao ativa na turma do aluno
    const simAtiva = await pool.query(
      'SELECT * FROM simulacoes WHERE ativo = TRUE AND turma_id = $1 ORDER BY criado_em DESC LIMIT 1',
      [req.usuario.turma_id]
    );
    const emSessao = simAtiva.rows.length > 0;

    if (emSessao) {
      const sessao = simAtiva.rows[0];
      const limite = sessao.cuidados_por_sessao ?? 3;

      // Limite e por dia (America/Sao_Paulo), nao pela sessao inteira - ver
      // schema.js.
      const contagemResult = await pool.query(
        `SELECT quantidade FROM cuidados_sessao_contagem
         WHERE usuario_id = $1 AND simulacao_id = $2 AND cuidado_id = $3
           AND data = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date`,
        [req.usuario.id, sessao.id, cuidado_id]
      );
      const usados = contagemResult.rows.length > 0 ? contagemResult.rows[0].quantidade : 0;

      if (usados >= limite) {
        return res.status(429).json({
          erro: `Limite de ${limite} usos deste cuidado atingido hoje.`,
          modo: 'sessao',
          usados,
          limite,
        });
      }
    } else {
      const ultimoUsoResult = await pool.query(
        `SELECT usado_em FROM cuidados_uso
         WHERE usuario_id = $1 AND cuidado_id = $2
         ORDER BY usado_em DESC LIMIT 1`,
        [req.usuario.id, cuidado_id]
      );

      if (ultimoUsoResult.rows.length > 0) {
        const ultimoUso = new Date(ultimoUsoResult.rows[0].usado_em);
        const liberaEm = new Date(ultimoUso.getTime() + COOLDOWN_HORAS_MODO_LIVRE * 60 * 60 * 1000);
        const agora = new Date();

        if (agora < liberaEm) {
          return res.status(429).json({
            erro: 'Este cuidado ainda esta em cooldown.',
            modo: 'livre',
            liberaEm: liberaEm.toISOString(),
          });
        }
      }
    }

    // Atualiza so as colunas que este cuidado afeta, com o incremento calculado
    // pelo proprio Postgres (nao le-depois-escreve em JS). Isso fecha a race
    // condition onde dois cuidados concorrentes (ids diferentes) liam o mesmo
    // snapshot e cada UPDATE sobrescrevia as colunas que o outro nao pretendia
    // tocar com um valor ja desatualizado.
    //
    // Teto da hidratacao = topo da faixa normal (90), nao 100: acima de 90 ela
    // conta como fora da faixa no calcularSaude, entao "trocar agua" com 100%
    // derrubava a saude (Samela, 29/09/2026). GREATEST: se um desafio ja
    // deixou acima do teto, o cuidado nao abaixa. So hidratacao por enquanto
    // (decisao da Rita, 29/09/2026) - energia/saude seguem com LEAST(100).
    const TETO_CUIDADO = { hidratacao: PRIMARY_PARAMS.find((p) => p.id === 'hidratacao').normal[1] };
    const colunas = Object.keys(efeito);
    const setColunas = colunas.map((coluna, i) => (TETO_CUIDADO[coluna] !== undefined
      ? `${coluna} = GREATEST(${coluna}, LEAST(${TETO_CUIDADO[coluna]}, ${coluna} + $${i + 1}))`
      : `${coluna} = LEAST(100, ${coluna} + $${i + 1})`));
    const abaixoDoTeto = colunas
      .filter((coluna) => TETO_CUIDADO[coluna] !== undefined)
      .map((coluna) => ` AND ${coluna} < ${TETO_CUIDADO[coluna]}`)
      .join('');

    const result = await pool.query(
      `UPDATE animal SET
        ${setColunas.join(',\n        ')},
        atualizado_em = NOW()
       WHERE usuario_id = $${colunas.length + 1}${abaixoDoTeto}
       RETURNING *`,
      [...colunas.map((coluna) => efeito[coluna]), req.usuario.id]
    );

    if (result.rows.length === 0) {
      // Condicional no proprio UPDATE (atomico, mesma razao do comentario
      // acima); o SELECT extra so roda no caminho de recusa.
      const existe = await pool.query('SELECT 1 FROM animal WHERE usuario_id = $1', [req.usuario.id]);
      if (existe.rows.length === 0) {
        return res.status(404).json({ erro: 'Animal nao encontrado.' });
      }
      // Recusa antes de contar o uso e creditar XP - o aluno nao perde o uso.
      return res.status(409).json({ erro: 'Este parametro ja esta no ideal.', motivo: 'ja_no_ideal' });
    }

    // Snapshot diario de progressao (ver schema.js) - best effort, mesmo
    // padrao do desafios.js: nao pode travar a resposta do cuidado por causa
    // de analytics.
    try {
      await registrarProgressaoDiaria(pool, req.usuario.id, result.rows[0]);
    } catch (err) {
      console.error('Erro ao registrar progressao diaria:', err.message);
    }

    const novaSaude = Number(result.rows[0].saude);

    // Registra o uso: em Modo Livre, na tabela de historico (cooldown); em Modo
    // Sessao, incrementa o contador exato daquela simulacao especifica.
    if (emSessao) {
      const sessao = simAtiva.rows[0];
      await pool.query(
        `INSERT INTO cuidados_sessao_contagem (usuario_id, simulacao_id, cuidado_id, data, quantidade)
         VALUES ($1, $2, $3, (NOW() AT TIME ZONE 'America/Sao_Paulo')::date, 1)
         ON CONFLICT (usuario_id, simulacao_id, cuidado_id, data)
         DO UPDATE SET quantidade = cuidados_sessao_contagem.quantidade + 1`,
        [req.usuario.id, sessao.id, cuidado_id]
      );
    } else {
      await pool.query(
        `INSERT INTO cuidados_uso (usuario_id, cuidado_id) VALUES ($1, $2)`,
        [req.usuario.id, cuidado_id]
      );
    }

    // Credita XP pelo cuidado aqui mesmo, em vez de deixar o frontend calcular
    // e mandar via PUT /api/ranking (o que permitia mandar qualquer xp_total).
    const XP_CUIDADO = 5;
    const rankingResult = await pool.query(
      `INSERT INTO ranking (usuario_id, xp_total, sessoes, media_saude)
       VALUES ($1, $2, 0, $3)
       ON CONFLICT (usuario_id) DO UPDATE SET
         xp_total      = ranking.xp_total + $2,
         media_saude   = ($3 + ranking.media_saude) / 2,
         atualizado_em = NOW()
       RETURNING *`,
      [req.usuario.id, XP_CUIDADO, novaSaude]
    );

    res.json({ animal: result.rows[0], ranking: rankingResult.rows[0] });
  } catch (err) {
    console.error('Erro ao aplicar cuidado:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// PUT /api/animal/age — professor atualiza idade de todos os alunos de uma turma dele
router.put('/age', auth, requireProfessor, resolveTurmaId, async (req, res) => {
  const { age_days } = req.body;
  const client = await pool.connect();
  // Mesmo padrao de simulacoes.js's /ativar - sem esse handler, um erro de
  // conexao no client "checked-out" (ex: Neon encerrando a conexao) derruba
  // o processo inteiro em vez de so essa requisicao.
  client.on('error', (err) => {
    console.error('Erro na conexao do client durante a transacao (mudar idade da turma):', err.message);
  });
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE animal SET age_days = $1, atualizado_em = NOW()
       WHERE usuario_id IN (SELECT id FROM usuarios WHERE modo = 'aluno' AND turma_id = $2)`,
      [age_days, req.turmaId]
    );
    // Idade muda as faixas normais de PA/FC/peso usadas por calcularSaude -
    // sem recalcular aqui, saude ficava parada com o valor de antes da
    // mudanca de idade (mesmo bug do /simulacoes/:id/ativar).
    await recalcularSaudeTurma(client, req.turmaId);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Erro ao tentar ROLLBACK (conexao provavelmente ja perdida):', rollbackErr.message);
    }
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  } finally {
    client.release();
  }
});

module.exports = router;