const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');
const { requireProfessor, mesmaTurmaDoRecurso, resolveTurmaId } = require('../middleware/turmaOwnership');
const {
  PRIMARY_PARAMS, getAgeStage, getAgePANormal, getAgeRecoveryPenalty,
  aplicarDeltaComFreio, calcularSaude, applyBonus,
} = require('../engine/mascotEngine');

// GET /api/desafios – lista desafios da turma do usuario logado (aluno ou professor)
router.get('/', auth, resolveTurmaId, async (req, res) => {
  try {
    const isProfessor = req.usuario.modo === 'professor';
    const query = isProfessor
      ? 'SELECT * FROM desafios WHERE turma_id = $1 ORDER BY criado_em ASC'
      : 'SELECT * FROM desafios WHERE ativo = TRUE AND turma_id = $1 ORDER BY criado_em ASC';
    const result = await pool.query(query, [req.turmaId]);
    // Alunos nao recebem a resposta certa de antemao (item A1-bis da auditoria
    // de seguranca) - so o professor, que precisa dela para editar o desafio.
    const linhas = isProfessor
      ? result.rows
      : result.rows.map(({ correta, ...resto }) => resto);
    res.json(linhas);
  } catch (err) {
    console.error('Erro ao listar desafios:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// POST /api/desafios/:id/checar – verifica se a opcao escolhida esta correta,
// sem expor a resposta certa de antemao (ver GET / acima). Revela qual era a
// opcao certa a cada tentativa (nao so na tentativa final) - fecha o
// vazamento principal (lista completa de respostas antes de jogar); resta um
// residuo pequeno e aceito (DevTools mostra a resposta 1 tentativa mais cedo
// do que a UI exibe visualmente).
router.post('/:id/checar', auth, async (req, res) => {
  const { id } = req.params;
  const { opcao_index, fechar, volta_extra, tempo_segundos, sessao_id } = req.body;
  try {
    const result = await pool.query(
      'SELECT correta, delta_acerto, delta_erro FROM desafios WHERE id = $1 AND turma_id = $2',
      [id, req.usuario.turma_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Desafio nao encontrado.' });
    }
    const desafio = result.rows[0];
    const opcaoCorreta = desafio.correta;
    const correta = opcaoCorreta === opcao_index;

    if (!fechar) {
      // Registra a tentativa (uma por clique real - fechar:true e so o
      // commit da mesma tentativa que ja passou por aqui, nao logamos de
      // novo). Best effort de proposito, mesmo padrao do enviarCodigoEmail.js
      // ("NUNCA lanca"): uma falha aqui nao pode travar o feedback
      // instantaneo de certo/errado, que hoje e praticamente infalivel.
      // sessao_id vem direto do cliente, mesmo nivel de confianca que
      // sessoes.duracao_segundos ja tem hoje (dado auxiliar, sem impacto em
      // pontuacao/estado do jogo) - sem checagem de posse contra
      // req.usuario.id de proposito (custaria uma query extra num evento
      // muito frequente so pra proteger um campo que so afeta analytics).
      try {
        await pool.query(
          `INSERT INTO respostas (desafio_id, resposta, correta, tempo_segundos, sessao_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, opcao_index, correta, tempo_segundos ?? null, sessao_id ?? null]
        );
      } catch (err) {
        console.error('Erro ao registrar tentativa de resposta:', err.message);
      }
      return res.json({ correta, opcao_correta: opcaoCorreta });
    }

    // fechar:true - aplica o resultado no animal/ranking do proprio aluno,
    // usando o estado atual do BANCO (nunca o que o cliente mandar). O modo
    // (sessao/livre) tambem e decidido aqui, do mesmo jeito que
    // POST /api/animal/cuidado ja faz - nao confia num campo "mode" do
    // cliente (deixaria escapar do desconto de energia do Modo Livre so
    // se autodeclarando "sessao").
    const animalResult = await pool.query('SELECT * FROM animal WHERE usuario_id = $1', [req.usuario.id]);
    if (animalResult.rows.length === 0) {
      return res.status(404).json({ erro: 'Animal nao encontrado.' });
    }
    const values = animalResult.rows[0];
    const ageDaysAtual = values.age_days || 90;

    const simAtiva = await pool.query(
      'SELECT id FROM simulacoes WHERE ativo = TRUE AND turma_id = $1 ORDER BY criado_em DESC LIMIT 1',
      [req.usuario.turma_id]
    );
    const modoSessao = simAtiva.rows.length > 0;

    const rankingResult = await pool.query('SELECT xp_total FROM ranking WHERE usuario_id = $1', [req.usuario.id]);
    const scoreAtual = rankingResult.rows.length > 0 ? Number(rankingResult.rows[0].xp_total) : 0;

    let novosValores, newScore;

    if (correta) {
      const configResult = await pool.query(
        `SELECT valor FROM configuracoes WHERE chave = 'recuperacao_multiplicador' AND turma_id = $1`,
        [req.usuario.turma_id]
      );
      const multiplicador = configResult.rows.length > 0 ? Number(configResult.rows[0].valor) : 1;
      const fatorRecuperacao = (multiplicador || 1) * getAgeRecoveryPenalty(ageDaysAtual);
      const paNormalAtual = getAgePANormal(ageDaysAtual);
      const fcNormalAtual = getAgeStage(ageDaysAtual).fcNormal;
      const hidNormalAtual = PRIMARY_PARAMS.find(p => p.id === 'hidratacao').normal;
      const da = desafio.delta_acerto || {};

      const deltaAcertoComFreio = (deltaOriginal, valorBase, faixaNormal, min, max) => {
        if (deltaOriginal === undefined) return valorBase;
        return aplicarDeltaComFreio(valorBase, deltaOriginal * fatorRecuperacao, faixaNormal, min, max);
      };

      novosValores = {
        hidratacao: deltaAcertoComFreio(da.hidratacao, Number(values.hidratacao) || 70, hidNormalAtual, 0, 100),
        pas: deltaAcertoComFreio(da.pas, Number(values.pas) || 110, paNormalAtual.pas, 60, 200),
        pad: deltaAcertoComFreio(da.pad, Number(values.pad) || 70,  paNormalAtual.pad, 40, 120),
        fc:  deltaAcertoComFreio(da.fc,  Number(values.fc)  || 370, fcNormalAtual,     100, 600),
        energia: modoSessao
          ? (da.energia !== undefined ? Math.min(100, (Number(values.energia) || 80) + da.energia) : Number(values.energia))
          : (volta_extra ? Number(values.energia) : Math.max(0, (Number(values.energia) || 80) - 10)),
        peso: Number(values.peso),
        age_days: ageDaysAtual,
      };
      novosValores.saude = calcularSaude(novosValores);
      newScore = applyBonus(scoreAtual, 'resposta_correta');
    } else {
      const de = desafio.delta_erro || {};
      novosValores = {
        hidratacao: de.hidratacao !== undefined ? Math.max(0, Math.min(100, (Number(values.hidratacao) || 70) + de.hidratacao)) : Number(values.hidratacao),
        pas: de.pas !== undefined ? Math.max(60,  Math.min(200, (Number(values.pas) || 110) + de.pas)) : Number(values.pas),
        pad: de.pad !== undefined ? Math.max(40,  Math.min(120, (Number(values.pad) || 70)  + de.pad)) : Number(values.pad),
        fc:  de.fc  !== undefined ? Math.max(100, Math.min(600, (Number(values.fc)  || 370) + de.fc))  : Number(values.fc),
        energia: modoSessao
          ? (de.energia !== undefined ? Math.max(0, Math.min(100, (Number(values.energia) || 80) + de.energia)) : Number(values.energia))
          : Math.max(0, (Number(values.energia) || 80) - 10),
        peso: Number(values.peso),
        age_days: ageDaysAtual,
      };
      novosValores.saude = calcularSaude(novosValores);
      newScore = Math.max(0, scoreAtual - 5);
    }

    const animalAtualizado = await pool.query(
      `UPDATE animal SET hidratacao=$1, pas=$2, pad=$3, fc=$4, energia=$5, saude=$6, atualizado_em=NOW()
       WHERE usuario_id = $7 RETURNING *`,
      [novosValores.hidratacao, novosValores.pas, novosValores.pad, novosValores.fc, novosValores.energia, novosValores.saude, req.usuario.id]
    );
    const rankingAtualizado = await pool.query(
      `INSERT INTO ranking (usuario_id, xp_total, sessoes, media_saude)
       VALUES ($1, $2, 0, $3)
       ON CONFLICT (usuario_id) DO UPDATE SET xp_total = $2, media_saude = ($3 + ranking.media_saude) / 2, atualizado_em = NOW()
       RETURNING *`,
      [req.usuario.id, newScore, novosValores.saude]
    );

    res.json({
      correta, opcao_correta: opcaoCorreta,
      novosValores: animalAtualizado.rows[0],
      newScore: rankingAtualizado.rows[0].xp_total,
    });
  } catch (err) {
    console.error('Erro ao checar resposta:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// POST /api/desafios – cria novo desafio numa turma do professor logado
router.post('/', auth, requireProfessor, resolveTurmaId, async (req, res) => {
  const { titulo, pergunta, opcoes, correta, foco, dificuldade, intervencao, delta_acerto, delta_erro } = req.body;
  if (!titulo || !pergunta || !opcoes || correta === undefined) {
    return res.status(400).json({ erro: 'Campos obrigatorios ausentes.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO desafios (titulo, pergunta, opcoes, correta, foco, dificuldade, intervencao, delta_acerto, delta_erro, turma_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        titulo, pergunta, JSON.stringify(opcoes), correta, foco, dificuldade, intervencao,
        JSON.stringify(delta_acerto || {}),
        JSON.stringify(delta_erro || {}),
        req.turmaId,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao criar desafio:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// POST /api/desafios/:id/duplicar – mesmo mecanismo de simulacoes/:id/duplicar,
// ver comentario la para o raciocinio completo (posse verificada por item da
// lista, best-effort, ativo=false explicito na copia mesmo com DEFAULT TRUE
// no schema).
router.post('/:id/duplicar', auth, requireProfessor, mesmaTurmaDoRecurso('desafios'), async (req, res) => {
  const { id } = req.params;
  const turmaIds = Array.isArray(req.body.turma_ids) ? req.body.turma_ids : [];
  if (turmaIds.length === 0) {
    return res.status(400).json({ erro: 'turma_ids e obrigatorio (lista nao vazia).' });
  }
  try {
    const origResult = await pool.query('SELECT * FROM desafios WHERE id = $1', [id]);
    if (origResult.rows.length === 0) {
      return res.status(404).json({ erro: 'Desafio nao encontrado.' });
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
          `INSERT INTO desafios (titulo, pergunta, opcoes, correta, foco, dificuldade, intervencao, delta_acerto, delta_erro, turma_id, ativo)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false) RETURNING id, turma_id`,
          [
            orig.titulo, orig.pergunta, JSON.stringify(orig.opcoes), orig.correta, orig.foco,
            orig.dificuldade, orig.intervencao, JSON.stringify(orig.delta_acerto), JSON.stringify(orig.delta_erro),
            turmaId,
          ]
        );
        sucesso.push({ turma_id: turmaId, id: copia.rows[0].id });
      } catch (err) {
        falha.push({ turma_id: turmaId, motivo: 'Erro ao duplicar.' });
      }
    }

    // Ver comentario equivalente em simulacoes.js.
    res.status(201).json({ sucesso, falha });
  } catch (err) {
    console.error('Erro ao duplicar desafio:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// PUT /api/desafios/:id – edita desafio (so o dono da turma do desafio)
router.put('/:id', auth, requireProfessor, mesmaTurmaDoRecurso('desafios'), async (req, res) => {
  const { id } = req.params;
  const { titulo, pergunta, opcoes, correta, foco, dificuldade, intervencao, ativo, delta_acerto, delta_erro } = req.body;
  try {
    const result = await pool.query(
      `UPDATE desafios SET
        titulo       = COALESCE($1, titulo),
        pergunta     = COALESCE($2, pergunta),
        opcoes       = COALESCE($3, opcoes),
        correta      = COALESCE($4, correta),
        foco         = COALESCE($5, foco),
        dificuldade  = COALESCE($6, dificuldade),
        intervencao  = COALESCE($7, intervencao),
        ativo        = COALESCE($8, ativo),
        delta_acerto = COALESCE($9, delta_acerto),
        delta_erro   = COALESCE($10, delta_erro)
       WHERE id = $11 RETURNING *`,
      [
        titulo, pergunta,
        opcoes ? JSON.stringify(opcoes) : null,
        correta, foco, dificuldade, intervencao, ativo,
        delta_acerto ? JSON.stringify(delta_acerto) : null,
        delta_erro   ? JSON.stringify(delta_erro)   : null,
        id,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao editar desafio:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// DELETE /api/desafios/:id – exclui desafio (so o dono da turma do desafio)
router.delete('/:id', auth, requireProfessor, mesmaTurmaDoRecurso('desafios'), async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM desafios WHERE id = $1', [id]);
    res.json({ mensagem: 'Desafio excluido com sucesso.' });
  } catch (err) {
    console.error('Erro ao excluir desafio:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

module.exports = router;
