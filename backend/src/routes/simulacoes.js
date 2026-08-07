const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');

// GET /api/simulacoes/ativa – retorna simulação ativa (se houver) da turma do aluno,
// ou da turma informada via query se for professor
router.get('/ativa', auth, async (req, res) => {
  try {
    const isProfessor = req.usuario.modo === 'professor';
    const turma_id = isProfessor ? req.query.turma_id : req.usuario.turma_id;

    const query = turma_id
      ? 'SELECT * FROM simulacoes WHERE ativo = TRUE AND turma_id = $1 ORDER BY criado_em DESC LIMIT 1'
      : 'SELECT * FROM simulacoes WHERE ativo = TRUE ORDER BY criado_em DESC LIMIT 1';
    const params = turma_id ? [turma_id] : [];

    const result = await pool.query(query, params);
    if (result.rows.length === 0) return res.json(null);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// GET /api/simulacoes – lista todas (professor pode filtrar por turma_id via query)
router.get('/', auth, async (req, res) => {
  try {
    const { turma_id } = req.query;
    const query = turma_id
      ? 'SELECT * FROM simulacoes WHERE turma_id = $1 ORDER BY criado_em DESC'
      : 'SELECT * FROM simulacoes ORDER BY criado_em DESC';
    const params = turma_id ? [turma_id] : [];
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// POST /api/simulacoes – cria nova simulação (professor only)
router.post('/', auth, async (req, res) => {
  if (req.usuario.modo !== 'professor') return res.status(403).json({ erro: 'Acesso negado.' });
  const { titulo, descricao, foco, params, cuidados_por_sessao, intervencao, turma_id } = req.body;
  if (!turma_id) {
    return res.status(400).json({ erro: 'turma_id e obrigatorio.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO simulacoes (titulo, descricao, foco, params, cuidados_por_sessao, intervencao, turma_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [titulo, descricao, foco, JSON.stringify(params), cuidados_por_sessao ?? 3, intervencao || null, turma_id]
    );    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// PUT /api/simulacoes/:id/ativar – ativa simulação e aplica params em todos os alunos da mesma turma
router.put('/:id/ativar', auth, async (req, res) => {
  if (req.usuario.modo !== 'professor') return res.status(403).json({ erro: 'Acesso negado.' });
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 0. Descobre a turma da simulacao que sera ativada
    const turmaResult = await client.query('SELECT turma_id FROM simulacoes WHERE id = $1', [id]);
    if (turmaResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Simulacao nao encontrada.' });
    }
    const turma_id = turmaResult.rows[0].turma_id;

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
    await client.query('ROLLBACK');
    console.error('Erro ao ativar simulacao:', err.message);
    res.status(500).json({ erro: 'Erro interno.' });
  } finally {
    client.release();
  }
});

// PUT /api/simulacoes/:id – edita/ativa/desativa
router.put('/:id', auth, async (req, res) => {
  if (req.usuario.modo !== 'professor') return res.status(403).json({ erro: 'Acesso negado.' });
  const { id } = req.params;
  const { titulo, descricao, foco, params, ativo, cuidados_por_sessao, intervencao, turma_id } = req.body;
  try {
    const result = await pool.query(
      `UPDATE simulacoes SET
        titulo               = COALESCE($1, titulo),
        descricao            = COALESCE($2, descricao),
        foco                 = COALESCE($3, foco),
        params               = COALESCE($4, params),
        ativo                = COALESCE($5, ativo),
        cuidados_por_sessao  = COALESCE($6, cuidados_por_sessao),
        intervencao          = COALESCE($7, intervencao),
        turma_id             = COALESCE($8, turma_id)
       WHERE id = $9 RETURNING *`,
      [titulo, descricao, foco, params ? JSON.stringify(params) : null, ativo, cuidados_por_sessao, intervencao, turma_id, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// DELETE /api/simulacoes/:id
router.delete('/:id', auth, async (req, res) => {
  if (req.usuario.modo !== 'professor') return res.status(403).json({ erro: 'Acesso negado.' });
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM simulacoes WHERE id = $1', [id]);
    res.json({ mensagem: 'Simulacao excluida.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// GET /api/simulacoes/config/cuidados-por-sessao – (legado) valor padrao generico
router.get('/config/cuidados-por-sessao', auth, async (req, res) => {
  try {
    const result = await pool.query(`SELECT valor FROM configuracoes WHERE chave = 'cuidados_por_sessao'`);
    const valor = result.rows.length > 0 ? Number(result.rows[0].valor) : 3;
    res.json({ cuidados_por_sessao: valor });
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// PUT /api/simulacoes/config/cuidados-por-sessao – (legado) mantido por compatibilidade
router.put('/config/cuidados-por-sessao', auth, async (req, res) => {
  if (req.usuario.modo !== 'professor') return res.status(403).json({ erro: 'Acesso negado.' });
  const { valor } = req.body;
  if (valor === undefined || Number(valor) < 1) {
    return res.status(400).json({ erro: 'Valor invalido.' });
  }
  try {
    await pool.query(
      `INSERT INTO configuracoes (chave, valor) VALUES ('cuidados_por_sessao', $1)
       ON CONFLICT (chave) DO UPDATE SET valor = $1`,
      [String(Math.round(Number(valor)))]
    );
    res.json({ cuidados_por_sessao: Math.round(Number(valor)) });
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

module.exports = router;