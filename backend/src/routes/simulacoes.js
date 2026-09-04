const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');
const { requireProfessor, mesmaTurmaDoRecurso, resolveTurmaId } = require('../middleware/turmaOwnership');
const { recalcularSaudeTurma } = require('../utils/recalcularSaudeTurma');

// GET /api/simulacoes/ativa – retorna a simulação ativa da turma do usuario logado
router.get('/ativa', auth, resolveTurmaId, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM simulacoes WHERE ativo = TRUE AND turma_id = $1 ORDER BY criado_em DESC LIMIT 1',
      [req.turmaId]
    );
    if (result.rows.length === 0) return res.json(null);
    const sim = result.rows[0];
    // Parametros customizados (pedido da Marcia, 17/08/2026): valores digitados
    // pelo professor especificamente para esta simulacao/ativacao. So exibicao -
    // nunca entram em nenhum calculo do animal (ver parametros_valores em
    // schema.js). Parametros desativados (ativo=false) ficam de fora mesmo que
    // tenham um valor historico registrado.
    const paramsResult = await pool.query(
      `SELECT pc.id, pc.nome, pc.unidade, pc.valor_min, pc.valor_max, pv.valor
       FROM parametros_valores pv
       JOIN parametros_customizados pc ON pc.id = pv.parametro_id
       WHERE pv.simulacao_id = $1 AND pc.ativo = TRUE`,
      [sim.id]
    );
    sim.parametrosCustom = paramsResult.rows;
    res.json(sim);
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// GET /api/simulacoes – lista as simulações da turma do usuario logado
router.get('/', auth, resolveTurmaId, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM simulacoes WHERE turma_id = $1 ORDER BY criado_em DESC',
      [req.turmaId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// POST /api/simulacoes – cria nova simulação numa turma do professor logado
router.post('/', auth, requireProfessor, resolveTurmaId, async (req, res) => {
  const { titulo, descricao, foco, params, cuidados_por_sessao, intervencao } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO simulacoes (titulo, descricao, foco, params, cuidados_por_sessao, intervencao, turma_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [titulo, descricao, foco, JSON.stringify(params), cuidados_por_sessao ?? 3, intervencao || null, req.turmaId]
    );    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// POST /api/simulacoes/:id/duplicar – copia a simulacao para outras turmas
// do MESMO professor (item 4 do pedido da Samela, 04/09/2026): evita ter que
// recriar manualmente em cada turma. Cada turma_id da lista e validado
// individualmente (mesmo padrao de posse do resolveTurmaId) - nao confia no
// resto do array so porque um item passou. Best-effort: turmas invalidas sao
// reportadas em "falha" sem derrubar as copias validas da lista, ja que cada
// INSERT e independente (nao ha estado compartilhado entre turmas que exija
// atomicidade, diferente da transacao de /ativar). Cada copia nasce com
// ativo=false explicito (nao so omitido) - a coluna tem DEFAULT TRUE no
// schema, entao so excluir do INSERT faria a copia nascer ativa e quebrar a
// invariante de "uma simulacao ativa por turma" mantida pela rota /ativar.
router.post('/:id/duplicar', auth, requireProfessor, mesmaTurmaDoRecurso('simulacoes'), async (req, res) => {
  const { id } = req.params;
  const turmaIds = Array.isArray(req.body.turma_ids) ? req.body.turma_ids : [];
  if (turmaIds.length === 0) {
    return res.status(400).json({ erro: 'turma_ids e obrigatorio (lista nao vazia).' });
  }
  try {
    const origResult = await pool.query('SELECT * FROM simulacoes WHERE id = $1', [id]);
    if (origResult.rows.length === 0) {
      return res.status(404).json({ erro: 'Simulacao nao encontrada.' });
    }
    const orig = origResult.rows[0];

    const sucesso = [];
    const falha = [];

    for (const turmaIdRaw of turmaIds) {
      const turmaId = Number(turmaIdRaw);
      if (!Number.isInteger(turmaId)) {
        falha.push({ turma_id: turmaIdRaw, motivo: 'turma_id invalido.' });
        continue;
      }
      // Mesma checagem de posse do resolveTurmaId, rodando POR ITEM da lista.
      const dono = await pool.query('SELECT criado_por FROM turmas WHERE id = $1', [turmaId]);
      if (dono.rows.length === 0) {
        falha.push({ turma_id: turmaId, motivo: 'Turma nao encontrada.' });
        continue;
      }
      if (Number(dono.rows[0].criado_por) !== Number(req.usuario.id)) {
        falha.push({ turma_id: turmaId, motivo: 'Turma pertence a outro professor.' });
        continue;
      }
      try {
        const copia = await pool.query(
          `INSERT INTO simulacoes (titulo, descricao, foco, params, cuidados_por_sessao, intervencao, turma_id, ativo)
           VALUES ($1, $2, $3, $4, $5, $6, $7, false) RETURNING id, turma_id`,
          [orig.titulo, orig.descricao, orig.foco, JSON.stringify(orig.params), orig.cuidados_por_sessao, orig.intervencao, turmaId]
        );
        sucesso.push({ turma_id: turmaId, id: copia.rows[0].id });
      } catch (err) {
        falha.push({ turma_id: turmaId, motivo: 'Erro ao duplicar.' });
      }
    }

    // Sempre 200/201, mesmo se todas as turmas falharem - o status HTTP nao
    // carrega esse significado aqui, o corpo (sucesso/falha por item) ja
    // descreve o resultado completo. Evita que o frontend perca o array
    // "falha" no caminho de erro do req() compartilhado (que so preserva
    // data.erro, uma string, quando res.ok e false).
    res.status(201).json({ sucesso, falha });
  } catch (err) {
    console.error('Erro ao duplicar simulacao:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// PUT /api/simulacoes/:id/ativar – ativa simulação e aplica params em todos os alunos da mesma turma
router.put('/:id/ativar', auth, requireProfessor, mesmaTurmaDoRecurso('simulacoes'), async (req, res) => {
  const { id } = req.params;
  const turma_id = req.turmaIdRecurso;
  const client = await pool.connect();
  // Erros de conexao emitidos por um client "checked-out" (ex: Neon encerrando
  // a conexao por administrador, plano free) nao passam pelo pool.on('error')
  // em connection.js - esse so cobre clients ociosos DENTRO da pool. Sem este
  // handler, o evento 'error' nao tratado derruba o processo inteiro.
  client.on('error', (err) => {
    console.error('Erro na conexao do client durante a transacao (ativar simulacao):', err.message);
  });
  try {
    await client.query('BEGIN');

    // 1. Desativa apenas as simulacoes da mesma turma
    await client.query('UPDATE simulacoes SET ativo = FALSE WHERE turma_id = $1', [turma_id]);

    // 2. Ativa a simulação escolhida, marca o momento da ativação e busca os params.
    //    O campo ativado_em marca o inicio da sessao para fins de contagem de
    //    cuidados usados (quantidade por sessao).
    const simResult = await client.query(
      'UPDATE simulacoes SET ativo = TRUE, ativado_em = NOW() WHERE id = $1 RETURNING *',
      [id]
    );

    const sim = simResult.rows[0];
    const params = typeof sim.params === 'string' ? JSON.parse(sim.params) : sim.params;

    // 3. Aplica os params no animal apenas dos alunos DA MESMA TURMA
    const campos = ['energia', 'hidratacao', 'pas', 'pad', 'fc', 'peso'];
    const updates = [];
    const valores = [];
    let idx = 1;

    campos.forEach(campo => {
      if (params[campo] !== undefined) {
        updates.push(`${campo} = $${idx}`);
        valores.push(params[campo]);
        idx++;
      }
    });

    if (updates.length > 0) {
      valores.push('aluno');
      valores.push(turma_id);
      await client.query(
        `UPDATE animal SET ${updates.join(', ')}, atualizado_em = NOW()
         WHERE usuario_id IN (SELECT id FROM usuarios WHERE modo = $${idx} AND turma_id = $${idx + 1})`,
        valores
      );
      await recalcularSaudeTurma(client, turma_id);
    }

    // 4. Registra os valores desta sessao para os parametros customizados da
    //    turma (pedido da Marcia, 17/08/2026). So aceita parametro_id que
    //    realmente pertence a esta turma e esta ativo - nunca confia no que o
    //    client manda sem checar (mesmo padrao do C1). IDs que nao baterem sao
    //    silenciosamente ignorados, em vez de derrubar a ativacao inteira por
    //    causa de um id invalido/desatualizado no client.
    const valoresCustom = req.body.valoresCustom;
    if (valoresCustom && typeof valoresCustom === 'object') {
      const parametroIds = Object.keys(valoresCustom).map(Number).filter(Number.isInteger);
      if (parametroIds.length > 0) {
        const validos = await client.query(
          'SELECT id FROM parametros_customizados WHERE id = ANY($1) AND turma_id = $2 AND ativo = TRUE',
          [parametroIds, turma_id]
        );
        const idsValidos = new Set(validos.rows.map(r => r.id));
        for (const pid of parametroIds) {
          if (!idsValidos.has(pid)) continue;
          const valor = Number(valoresCustom[pid]);
          if (Number.isNaN(valor)) continue;
          await client.query(
            `INSERT INTO parametros_valores (parametro_id, simulacao_id, valor)
             VALUES ($1, $2, $3)
             ON CONFLICT (parametro_id, simulacao_id) DO UPDATE SET valor = $3, registrado_em = NOW()`,
            [pid, id, valor]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.json({ ok: true, simulacao: sim, alunosAtualizados: true });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Erro ao tentar ROLLBACK (conexao provavelmente ja perdida):', rollbackErr.message);
    }
    console.error('Erro ao ativar simulacao:', err.message);
    res.status(500).json({ erro: 'Erro interno.' });
  } finally {
    client.release();
  }
});

// PUT /api/simulacoes/:id – edita/ativa/desativa (so o dono da turma da simulacao)
router.put('/:id', auth, requireProfessor, mesmaTurmaDoRecurso('simulacoes'), async (req, res) => {
  const { id } = req.params;
  const { titulo, descricao, foco, params, ativo, cuidados_por_sessao, intervencao } = req.body;
  try {
    const result = await pool.query(
      `UPDATE simulacoes SET
        titulo               = COALESCE($1, titulo),
        descricao            = COALESCE($2, descricao),
        foco                 = COALESCE($3, foco),
        params               = COALESCE($4, params),
        ativo                = COALESCE($5, ativo),
        cuidados_por_sessao  = COALESCE($6, cuidados_por_sessao),
        intervencao          = COALESCE($7, intervencao)
       WHERE id = $8 RETURNING *`,
      [titulo, descricao, foco, params ? JSON.stringify(params) : null, ativo, cuidados_por_sessao, intervencao, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// DELETE /api/simulacoes/:id (so o dono da turma da simulacao)
router.delete('/:id', auth, requireProfessor, mesmaTurmaDoRecurso('simulacoes'), async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM simulacoes WHERE id = $1', [id]);
    res.json({ mensagem: 'Simulacao excluida.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

module.exports = router;
