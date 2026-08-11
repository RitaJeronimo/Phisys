const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');
const { requireProfessor, mesmaTurmaDoRecurso } = require('../middleware/turmaOwnership');

// GET /api/turmas – retorna a propria turma do professor logado
router.get('/', auth, requireProfessor, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nome, codigo, codigo_professor, ativa, criado_em FROM turmas WHERE id = $1',
      [req.usuario.turma_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao listar turmas:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// POST /api/turmas – cria uma nova turma (apenas professor; escopo separado do
// item C1 - ver M2 na auditoria: quem PODE criar turmas e uma decisao de
// politica distinta de "acessar so a propria turma", nao resolvida aqui)
router.post('/', auth, requireProfessor, async (req, res) => {
  const { nome, codigo, codigo_professor } = req.body;
  if (!nome || !codigo) {
    return res.status(400).json({ erro: 'Nome e codigo sao obrigatorios.' });
  }
  try {
    const existe = await pool.query('SELECT id FROM turmas WHERE codigo = $1', [codigo]);
    if (existe.rows.length > 0) {
      return res.status(409).json({ erro: 'Ja existe uma turma com esse codigo.' });
    }
    if (codigo_professor) {
      const existeProf = await pool.query('SELECT id FROM turmas WHERE codigo_professor = $1', [codigo_professor]);
      if (existeProf.rows.length > 0) {
        return res.status(409).json({ erro: 'Ja existe uma turma com esse codigo de professor.' });
      }
    }
    const result = await pool.query(
      'INSERT INTO turmas (nome, codigo, codigo_professor, ativa) VALUES ($1, $2, $3, true) RETURNING id, nome, codigo, codigo_professor, ativa, criado_em',
      [nome, codigo, codigo_professor || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao criar turma:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// PUT /api/turmas/:id – edita nome, codigo ou status ativa da propria turma
router.put('/:id', auth, requireProfessor, mesmaTurmaDoRecurso('turmas', 'id'), async (req, res) => {
  const { id } = req.params;
  const { nome, codigo, codigo_professor, ativa } = req.body;

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
    if (codigo_professor) {
      const existeProf = await pool.query(
        'SELECT id FROM turmas WHERE codigo_professor = $1 AND id != $2',
        [codigo_professor, id]
      );
      if (existeProf.rows.length > 0) {
        return res.status(409).json({ erro: 'Ja existe uma turma com esse codigo de professor.' });
      }
    }

    const result = await pool.query(
      `UPDATE turmas SET
         nome = COALESCE($1, nome),
         codigo = COALESCE($2, codigo),
         codigo_professor = COALESCE($3, codigo_professor),
         ativa = COALESCE($4, ativa)
       WHERE id = $5
       RETURNING id, nome, codigo, codigo_professor, ativa, criado_em`,
      [nome, codigo, codigo_professor, ativa, id]
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

// GET /api/turmas/validar/:codigo – valida um codigo de turma (sem auth, usado no login/cadastro)
router.get('/validar/:codigo', async (req, res) => {
  const { codigo } = req.params;
  const campoCodigo = req.query.modo === 'professor' ? 'codigo_professor' : 'codigo';
  try {
    const result = await pool.query(
      `SELECT id, nome FROM turmas WHERE ${campoCodigo} = $1 AND ativa = true`,
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