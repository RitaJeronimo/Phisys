const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');
const { requireProfessor, resolveTurmaId } = require('../middleware/turmaOwnership');

const PESOS_PADRAO = { score: 40, survival: 30, challenges: 20, response_time: 10 };
const CHAVES_PESOS = ['peso_score', 'peso_survival', 'peso_challenges', 'peso_response_time'];

// GET /api/configuracoes/pesos – retorna os pesos atuais (ou os padrões, se nunca configurados)
router.get('/pesos', auth, resolveTurmaId, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT chave, valor FROM configuracoes WHERE chave = ANY($1) AND turma_id = $2`,
      [CHAVES_PESOS, req.turmaId]
    );
    const encontrados = {};
    result.rows.forEach(r => { encontrados[r.chave] = Number(r.valor); });

    res.json({
      score:         encontrados.peso_score         ?? PESOS_PADRAO.score,
      survival:      encontrados.peso_survival      ?? PESOS_PADRAO.survival,
      challenges:    encontrados.peso_challenges    ?? PESOS_PADRAO.challenges,
      response_time: encontrados.peso_response_time ?? PESOS_PADRAO.response_time,
    });
  } catch (err) {
    console.error('Erro ao buscar pesos:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// PUT /api/configuracoes/pesos – professor salva os pesos da nota automática
// (so afeta a propria turma - ver M3 na auditoria)
router.put('/pesos', auth, requireProfessor, resolveTurmaId, async (req, res) => {
  const { score, survival, challenges, response_time } = req.body;
  const pares = [
    ['peso_score', score],
    ['peso_survival', survival],
    ['peso_challenges', challenges],
    ['peso_response_time', response_time],
  ];
  if (pares.every(([, valor]) => valor === undefined)) {
    return res.status(400).json({ erro: 'Nenhum dos campos esperados (score, survival, challenges, response_time) foi enviado.' });
  }

  try {
    for (const [chave, valor] of pares) {
      if (valor === undefined) continue;
      await pool.query(
        `INSERT INTO configuracoes (chave, valor, turma_id) VALUES ($1, $2, $3)
         ON CONFLICT (chave, turma_id) DO UPDATE SET valor = $2`,
        [chave, String(valor), req.turmaId]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao salvar pesos:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// ── RECUPERAÇÃO DO ANIMAL (multiplicador + desafios extras) ──────────────
// Controles do professor para calibrar a dificuldade de recuperação do
// animal apos uma simulacao/crise. Editaveis a qualquer momento.

const RECUPERACAO_PADRAO = { multiplicador: 1, desafios_extras: 0, questoes_por_rodada: 3 };

// GET /api/configuracoes/recuperacao – retorna multiplicador, desafios extras e questoes por rodada atuais
router.get('/recuperacao', auth, resolveTurmaId, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT chave, valor FROM configuracoes WHERE chave = ANY($1) AND turma_id = $2`,
      [['recuperacao_multiplicador', 'recuperacao_desafios_extras', 'recuperacao_questoes_por_rodada'], req.turmaId]
    );
    const encontrados = {};
    result.rows.forEach(r => { encontrados[r.chave] = Number(r.valor); });

    res.json({
      multiplicador:       encontrados.recuperacao_multiplicador       ?? RECUPERACAO_PADRAO.multiplicador,
      desafios_extras:     encontrados.recuperacao_desafios_extras     ?? RECUPERACAO_PADRAO.desafios_extras,
      questoes_por_rodada: encontrados.recuperacao_questoes_por_rodada ?? RECUPERACAO_PADRAO.questoes_por_rodada,
    });
  } catch (err) {
    console.error('Erro ao buscar config de recuperacao:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// PUT /api/configuracoes/recuperacao – professor salva multiplicador, desafios extras e questoes por rodada
// (so afeta a propria turma - ver M3 na auditoria)
router.put('/recuperacao', auth, requireProfessor, resolveTurmaId, async (req, res) => {
  const { multiplicador, desafios_extras, questoes_por_rodada } = req.body;
  const pares = [
    ['recuperacao_multiplicador', multiplicador],
    ['recuperacao_desafios_extras', desafios_extras],
    ['recuperacao_questoes_por_rodada', questoes_por_rodada],
  ];
  if (pares.every(([, valor]) => valor === undefined)) {
    return res.status(400).json({ erro: 'Nenhum dos campos esperados (multiplicador, desafios_extras, questoes_por_rodada) foi enviado.' });
  }
  if (questoes_por_rodada !== undefined && Number(questoes_por_rodada) < 1) {
    return res.status(400).json({ erro: 'questoes_por_rodada deve ser pelo menos 1.' });
  }

  try {
    for (const [chave, valor] of pares) {
      if (valor === undefined) continue;
      await pool.query(
        `INSERT INTO configuracoes (chave, valor, turma_id) VALUES ($1, $2, $3)
         ON CONFLICT (chave, turma_id) DO UPDATE SET valor = $2`,
        [chave, String(valor), req.turmaId]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao salvar config de recuperacao:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// ── FOCO DO MODO SESSÃO ───────────────────────────────────────────────────
// Substitui o antigo `phisys_sessao_config` do localStorage (gravado no
// navegador do PROFESSOR, lido no navegador do ALUNO - nunca chegava, ja
// que sao dispositivos diferentes). Mesma tabela/padrao de recuperacao
// acima, so troca a chave - sem migration nova.

const SESSAO_FOCO_PADRAO = 'todos';
const FOCOS_VALIDOS = ['todos', 'renal', 'cardiovascular'];

// GET /api/configuracoes/sessao – retorna o foco atual do Modo Sessao da turma
router.get('/sessao', auth, resolveTurmaId, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT valor FROM configuracoes WHERE chave = 'sessao_foco' AND turma_id = $1`,
      [req.turmaId]
    );
    res.json({ foco: result.rows.length > 0 ? result.rows[0].valor : SESSAO_FOCO_PADRAO });
  } catch (err) {
    console.error('Erro ao buscar foco da sessao:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// PUT /api/configuracoes/sessao – professor define o foco do Modo Sessao
// (so afeta a propria turma - mesmo escopo de M3 na auditoria de seguranca)
router.put('/sessao', auth, requireProfessor, resolveTurmaId, async (req, res) => {
  const { foco } = req.body;
  if (!FOCOS_VALIDOS.includes(foco)) {
    return res.status(400).json({ erro: `foco deve ser um de: ${FOCOS_VALIDOS.join(', ')}.` });
  }
  try {
    await pool.query(
      `INSERT INTO configuracoes (chave, valor, turma_id) VALUES ('sessao_foco', $1, $2)
       ON CONFLICT (chave, turma_id) DO UPDATE SET valor = $1`,
      [foco, req.turmaId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao salvar foco da sessao:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

module.exports = router;