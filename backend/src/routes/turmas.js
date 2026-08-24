const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');
const { requireProfessor, mesmaTurmaDoRecurso } = require('../middleware/turmaOwnership');

// Limite de governanca (item M2 da auditoria de seguranca, 15/08/2026):
// criacao de turma continua aberta a qualquer professor cadastrado (decisao
// deliberada - o app vai ser usado por professores de varias universidades,
// uma allowlist viraria gargalo de aprovacao manual), mas um professor
// comprometido ou mal-intencionado nao pode gerar turmas sem limite.
// Trocado de "5 a cada 24h" para teto vitalicio de turmas ATIVAS (item 1 do
// pedido da Marcia/Rita, 24/08/2026): so libera uma vaga nova desativando
// uma turma existente (item 2, ja em prod) - nao e mais sobre velocidade de
// criacao, e sobre quantas turmas o professor mantem abertas ao mesmo tempo.
const MAX_TURMAS_ATIVAS_POR_PROFESSOR = 5;

// GET /api/turmas – lista todas as turmas do professor logado (pode ser dono
// de varias desde o item 3, 24/08/2026 - antes era sempre uma so)
router.get('/', auth, requireProfessor, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nome, codigo, ativa, criado_em FROM turmas WHERE criado_por = $1 ORDER BY criado_em DESC',
      [req.usuario.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao listar turmas:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// POST /api/turmas – cria uma nova turma (apenas professor; ver
// MAX_TURMAS_ATIVAS_POR_PROFESSOR acima pro limite de governanca do M2/item 1)
router.post('/', auth, requireProfessor, async (req, res) => {
  const { nome, codigo } = req.body;
  if (!nome || !codigo) {
    return res.status(400).json({ erro: 'Nome e codigo sao obrigatorios.' });
  }
  try {
    const ativasAgora = await pool.query(
      `SELECT count(*) FROM turmas WHERE criado_por = $1 AND ativa = true`,
      [req.usuario.id]
    );
    if (Number(ativasAgora.rows[0].count) >= MAX_TURMAS_ATIVAS_POR_PROFESSOR) {
      return res.status(429).json({
        erro: `Limite de ${MAX_TURMAS_ATIVAS_POR_PROFESSOR} turmas ativas atingido. Desative uma turma existente para criar outra.`,
      });
    }

    const existe = await pool.query('SELECT id FROM turmas WHERE codigo = $1', [codigo]);
    if (existe.rows.length > 0) {
      return res.status(409).json({ erro: 'Ja existe uma turma com esse codigo.' });
    }
    const result = await pool.query(
      'INSERT INTO turmas (nome, codigo, ativa, criado_por) VALUES ($1, $2, true, $3) RETURNING id, nome, codigo, ativa, criado_em',
      [nome, codigo, req.usuario.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao criar turma:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// PUT /api/turmas/:id – edita nome, codigo ou status ativa de uma turma do
// professor logado (so a que ele criou, via mesmaTurmaDoRecurso)
router.put('/:id', auth, requireProfessor, mesmaTurmaDoRecurso('turmas', 'id'), async (req, res) => {
  const { id } = req.params;
  const { nome, codigo, ativa } = req.body;

  try {
    if (codigo !== undefined) {
      const existe = await pool.query(
        'SELECT id FROM turmas WHERE codigo = $1 AND id != $2',
        [codigo, id]
      );
      if (existe.rows.length > 0) {
        return res.status(409).json({ erro: 'Ja existe uma turma com esse codigo.' });
      }
    }

    const result = await pool.query(
      `UPDATE turmas SET
         nome = COALESCE($1, nome),
         codigo = COALESCE($2, codigo),
         ativa = COALESCE($3, ativa)
       WHERE id = $4
       RETURNING id, nome, codigo, ativa, criado_em`,
      [nome, codigo, ativa, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Turma nao encontrada.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao editar turma:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// GET /api/turmas/validar/:codigo – valida o codigo publico (de aluno) de uma
// turma (sem auth, usado no cadastro de aluno). Cadastro de professor nao usa
// mais codigo de turma nenhum - ver CODIGO_PROFESSOR_GLOBAL em auth.js (item 3).
router.get('/validar/:codigo', async (req, res) => {
  const { codigo } = req.params;
  try {
    const result = await pool.query(
      'SELECT id, nome FROM turmas WHERE codigo = $1 AND ativa = true',
      [codigo]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Codigo de turma invalido ou turma inativa.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao validar turma:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

module.exports = router;