const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');

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

// GET /api/animal/cuidado/status — retorna, para cada cuidado, se pode ser usado
// agora e informacoes de contexto (modo sessao/livre, quantos restam, quando libera).
// O frontend usa essa rota para desenhar os botoes de cuidado corretamente
// (habilitado, desabilitado com contagem, ou com tempo restante).
router.get('/cuidado/status', auth, async (req, res) => {
  try {
    const simAtiva = await pool.query(
      'SELECT * FROM simulacoes WHERE ativo = TRUE ORDER BY criado_em DESC LIMIT 1'
    );
    const emSessao = simAtiva.rows.length > 0;
    const cuidadoIds = ['hidratacao', 'racao', 'maravalha'];
    const statusPorCuidado = {};

    if (emSessao) {
      const sessao = simAtiva.rows[0];
      const inicioSessao = sessao.ativado_em || sessao.criado_em;

      const configResult = await pool.query(`SELECT valor FROM configuracoes WHERE chave = 'cuidados_por_sessao'`);
      const limite = configResult.rows.length > 0 ? Number(configResult.rows[0].valor) : 3;

      for (const cuidadoId of cuidadoIds) {
        const usoResult = await pool.query(
          `SELECT COUNT(*)::int AS total FROM cuidados_uso
           WHERE usuario_id = $1 AND cuidado_id = $2 AND usado_em >= $3`,
          [req.usuario.id, cuidadoId, inicioSessao]
        );
        const usados = usoResult.rows[0].total;
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
    // Verifica se existe sessao/simulacao ativa do professor
    const simAtiva = await pool.query(
      'SELECT * FROM simulacoes WHERE ativo = TRUE ORDER BY criado_em DESC LIMIT 1'
    );
    const emSessao = simAtiva.rows.length > 0;

    if (emSessao) {
      const sessao = simAtiva.rows[0];
      const inicioSessao = sessao.ativado_em || sessao.criado_em;

      const configResult = await pool.query(`SELECT valor FROM configuracoes WHERE chave = 'cuidados_por_sessao'`);
      const limite = configResult.rows.length > 0 ? Number(configResult.rows[0].valor) : 3;

      const usoResult = await pool.query(
        `SELECT COUNT(*)::int AS total FROM cuidados_uso
         WHERE usuario_id = $1 AND cuidado_id = $2 AND usado_em >= $3`,
        [req.usuario.id, cuidado_id, inicioSessao]
      );
      const usados = usoResult.rows[0].total;

      if (usados >= limite) {
        return res.status(429).json({
          erro: `Limite de ${limite} usos deste cuidado atingido nesta sessao.`,
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

    // Registra o uso deste cuidado, para os controles de cooldown/quantidade acima
    await pool.query(
      `INSERT INTO cuidados_uso (usuario_id, cuidado_id) VALUES ($1, $2)`,
      [req.usuario.id, cuidado_id]
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