const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');
const { requireProfessor, mesmaTurmaDoRecurso } = require('../middleware/turmaOwnership');

// GET /api/simulacoes/ativa – retorna a simulação ativa da turma do usuario logado
router.get('/ativa', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM simulacoes WHERE ativo = TRUE AND turma_id = $1 ORDER BY criado_em DESC LIMIT 1',
      [req.usuario.turma_id]
    );
    if (result.rows.length === 0) return res.json(null);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// GET /api/simulacoes – lista as simulações da turma do usuario logado
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM simulacoes WHERE turma_id = $1 ORDER BY criado_em DESC',
      [req.usuario.turma_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// POST /api/simulacoes – cria nova simulação na turma do professor logado
router.post('/', auth, requireProfessor, async (req, res) => {
  const { titulo, descricao, foco, params, cuidados_por_sessao, intervencao } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO simulacoes (titulo, descricao, foco, params, cuidados_por_sessao, intervencao, turma_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [titulo, descricao, foco, JSON.stringify(params), cuidados_por_sessao ?? 3, intervencao || null, req.usuario.turma_id]
    );    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno.' });
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
