const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');

// GET /api/simulacoes/ativa – retorna simulação ativa (se houver)
router.get('/ativa', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM simulacoes WHERE ativo = TRUE ORDER BY criado_em DESC LIMIT 1'
    );
    if (result.rows.length === 0) return res.json(null);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// GET /api/simulacoes – lista todas
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM simulacoes ORDER BY criado_em DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// POST /api/simulacoes – cria nova simulação (professor only)
router.post('/', auth, async (req, res) => {
  if (req.usuario.modo !== 'professor') return res.status(403).json({ erro: 'Acesso negado.' });
  const { titulo, descricao, foco, params } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO simulacoes (titulo, descricao, foco, params) VALUES ($1, $2, $3, $4) RETURNING *`,
      [titulo, descricao, foco, JSON.stringify(params)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// PUT /api/simulacoes/:id/ativar – ativa simulação e aplica params em TODOS os alunos
router.put('/:id/ativar', auth, async (req, res) => {
  if (req.usuario.modo !== 'professor') return res.status(403).json({ erro: 'Acesso negado.' });
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Desativa todas as simulações
    await client.query('UPDATE simulacoes SET ativo = FALSE');

    // 2. Ativa a simulação escolhida e busca os params
    const simResult = await client.query(
      'UPDATE simulacoes SET ativo = TRUE WHERE id = $1 RETURNING *',
      [id]
    );
    if (simResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Simulacao nao encontrada.' });
    }

    const sim = simResult.rows[0];
    const params = typeof sim.params === 'string' ? JSON.parse(sim.params) : sim.params;

    // 3. Aplica os params no animal de TODOS os alunos
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
      await client.query(
        `UPDATE animal SET ${updates.join(', ')}, atualizado_em = NOW()
         WHERE usuario_id IN (SELECT id FROM usuarios WHERE modo = $${idx})`,
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
  const { titulo, descricao, foco, params, ativo } = req.body;
  try {
    const result = await pool.query(
      `UPDATE simulacoes SET
        titulo    = COALESCE($1, titulo),
        descricao = COALESCE($2, descricao),
        foco      = COALESCE($3, foco),
        params    = COALESCE($4, params),
        ativo     = COALESCE($5, ativo)
       WHERE id = $6 RETURNING *`,
      [titulo, descricao, foco, params ? JSON.stringify(params) : null, ativo, id]
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

module.exports = router;