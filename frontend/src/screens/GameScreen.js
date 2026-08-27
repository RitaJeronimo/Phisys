import React, { useState, useEffect } from 'react';
import { PARAMS, getDefaultValues, getMascotStatus, calculateFinalGrade, STATUS, calcularSaude, calcularEnergiaModulada, embaralharArray, getAgeStage } from '../engine/mascotEngine';
import { ranking as rankingApi, getToken, decodeToken, desafios as desafiosApi, configuracoes as configuracoesApi, simulacoes as simulacoesApi } from '../api';
import { COLORS, FONT_FAMILY, SHADOW_CARD, FONT_SCALE } from '../theme';
import { MASCOT_IMAGES } from '../assets/mascote';

const MOCK_CHALLENGES = [
  {
    id: 1, tag: 'Desafio #1', focus: 'Fisiologia Renal',
    text: 'O rato virtual foi submetido a desidratação intensa. O que acontece com o volume urinário e a pressão arterial nessa condição?',
    options: [
      { letter: 'A', text: 'Volume urinário diminui e pressão arterial cai', correct: true },
      { letter: 'B', text: 'Volume urinário aumenta e pressão arterial sobe', correct: false },
      { letter: 'C', text: 'Ambos os parâmetros permanecem estáveis', correct: false },
      { letter: 'D', text: 'Volume urinário aumenta e pressão arterial cai', correct: false },
    ],
    delta_acerto: { hidratacao:20, energia:10, pas:-10, pad:-5, fc:-30 },
    delta_erro:   { hidratacao:-20, energia:-15, pas:10, pad:5, fc:30 },
    explanation: 'Na desidratação: ↓ hidratação → ↓ volemia → ↓ pré-carga → ↓ VS → ↓ DC → ↓ PA. O rim retém água reduzindo o volume urinário. A FC aumenta compensatoriamente para manter a perfusão.',
  },
  {
    id: 2, tag: 'Desafio #2', focus: 'Fisiologia Cardiovascular',
    text: 'O rato virtual apresenta frequência cardíaca de 200 bpm, bem abaixo do normal (360–380 bpm). Qual o efeito esperado no débito cardíaco e na pressão arterial?',
    options: [
      { letter: 'A', text: 'Débito cardíaco aumenta e pressão arterial sobe', correct: false },
      { letter: 'B', text: 'Débito cardíaco cai e pressão arterial pode diminuir', correct: true },
      { letter: 'C', text: 'Ambos os parâmetros permanecem estáveis', correct: false },
      { letter: 'D', text: 'Débito cardíaco cai mas a pressão arterial sempre sobe', correct: false },
    ],
    delta_acerto: { hidratacao:10, energia:10, pas:-5, pad:-5, fc:40 },
    delta_erro:   { hidratacao:-10, energia:-15, pas:10, pad:5, fc:-40 },
    explanation: 'FC baixa reduz o débito cardíaco (DC = FC × VS). Com DC reduzido, a PA pode cair por menor perfusão. O organismo tenta compensar com aumento da RVP para manter a pressão.',
  },
  {
    id: 3, tag: 'Desafio #3', focus: 'Fisiologia Renal',
    text: 'Com insuficiência renal, qual seria o comportamento esperado do volume urinário e da volemia do rato virtual?',
    options: [
      { letter: 'A', text: 'Volume urinário aumenta e volemia diminui', correct: false },
      { letter: 'B', text: 'Volume urinário diminui e volemia aumenta', correct: true },
      { letter: 'C', text: 'Ambos permanecem dentro da normalidade', correct: false },
      { letter: 'D', text: 'Volume urinário aumenta e volemia aumenta', correct: false },
    ],
    delta_acerto: { hidratacao:20, energia:10, pas:-15, pad:-10, fc:-20 },
    delta_erro:   { hidratacao:-20, energia:-15, pas:15, pad:10, fc:20 },
    explanation: 'Na insuficiência renal, a filtração glomerular cai, reduzindo o volume urinário. A retenção de sódio e água aumenta a volemia, podendo elevar a PA sistólica e diastólica.',
  },
];
// Nota: o campo "intervention" que existia em cada desafio acima foi removido.
// Ele nunca era lido em nenhum lugar do handleAnswer (nem no Modo Livre, nem no
// Modo Sessao) - so ocupava espaco e podia confundir quem fosse editar o
// codigo depois, dando a falsa impressao de que a "crise" descrita ali era
// aplicada ao animal. O que realmente e aplicado sao sempre delta_acerto/delta_erro.

function ChibiMascot({ status, ageDays, size = 72 }) {
  const stageKey = getAgeStage(ageDays ?? 90).key;
  return (
    <img
      src={MASCOT_IMAGES[stageKey][status]}
      alt={`Phisys — ${status}`}
      style={{ width:size, height:size, objectFit:'contain', borderRadius:'12px', flexShrink:0 }}
    />
  );
}

function ParamBar({ param, value }) {
  const pct = ((value - param.min) / (param.max - param.min)) * 100;
  const normalMin = ((param.normal[0] - param.min) / (param.max - param.min)) * 100;
  const normalWidth = ((param.normal[1] - param.normal[0]) / (param.max - param.min)) * 100;
  const inRange = value >= param.normal[0] && value <= param.normal[1];
  const deviation = Math.abs(value - (param.normal[0] + param.normal[1]) / 2) / ((param.normal[1] - param.normal[0]) / 2);
  const fillColor = inRange ? '#32C878' : deviation > 2 ? '#DC3C3C' : '#EF9F27';
  const displayVal = param.step < 1 ? value.toFixed(1) : Math.round(value);
  return (
    <div style={styles.paramItem}>
      <div style={styles.paramLabel}>{param.id === 'pas' ? 'PAS' : param.id === 'pad' ? 'PAD' : param.name.split(' ')[0]}</div>
      <div style={styles.paramTrack}>
        <div style={{ ...styles.paramNormal, left: normalMin + '%', width: normalWidth + '%' }}/>
        <div style={{ ...styles.paramFill, width: Math.min(pct, 100) + '%', background: fillColor }}/>
      </div>
      <div style={styles.paramVal}>{displayVal}</div>
    </div>
  );
}

function GameScreen({ user, mode, values: initialValues, score: initialScore, onBack, onFinish, ageDays }) {
  const [values, setValues] = useState(initialValues || getDefaultValues());
  const [score, setScore] = useState(initialScore ?? 100);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [solvedCount, setSolvedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [responseTimes, setResponseTimes] = useState([]);
  const [questionStart, setQuestionStart] = useState(Date.now());
  const [finished, setFinished] = useState(false);
  const [recuperacaoConfig, setRecuperacaoConfig] = useState({ multiplicador: 1, desafios_extras: 0 });
  const [voltasExtrasUsadas, setVoltasExtrasUsadas] = useState(0);
  const [correctIndex, setCorrectIndex] = useState(null);

  useEffect(() => {
    configuracoesApi.getRecuperacao()
      .then(data => setRecuperacaoConfig(data))
      .catch(() => {});
  }, []);
  
  const [myRank, setMyRank] = useState('-');
  const [challengePool, setChallengePool] = useState([]); // pool completo, embaralhado
  const [challenges, setChallenges] = useState([]);        // fatia atual (rodada em exibicao)
  const [loadingChallenges, setLoadingChallenges] = useState(true);

  const TAMANHO_RODADA = 3; // mesmo padrao ja usado como default em totalChallenges
  const [attempts, setAttempts] = useState(0);
  const [paramHistory, setParamHistory] = useState([{
    label: 'Início',
    hidratacao: (initialValues || getDefaultValues()).hidratacao,
    pas: (initialValues || getDefaultValues()).pas,
    fc: (initialValues || getDefaultValues()).fc,
    saude: 85,
  }]);

  // CORRECAO B: define o pool completo (embaralhado) e exibe so a primeira
  // fatia (tamanho TAMANHO_RODADA). O restante do pool fica reservado para
  // as voltas extras de recuperacao, evitando repetir os mesmos desafios.
  function definirPool(lista) {
    const embaralhado = embaralharArray(lista);
    setChallengePool(embaralhado);
    setChallenges(embaralhado.slice(0, TAMANHO_RODADA));
  }

useEffect(() => {
    Promise.all([
      desafiosApi.get(),
      simulacoesApi.getAtiva().catch(() => null),
    ]).then(([data, simAtiva]) => {
      const fromDB = Array.isArray(data) && data.length > 0
        ? data.map(d => ({
            id: d.id,
            tag: `Desafio #${d.id}`,
            focus: d.foco || 'renal',
            intervencao: d.intervencao || null,
            text: d.pergunta,
            fromDB: true,
            // "correct" nao vem mais do backend para alunos (item A1-bis da
            // auditoria de seguranca) - a checagem agora e feita chamando
            // desafiosApi.checar() em handleAnswer, na hora da resposta.
            options: (Array.isArray(d.opcoes) ? d.opcoes : JSON.parse(d.opcoes)).map((opt, i) => ({
              letter: String.fromCharCode(65 + i),
              text: opt,
            })),
            delta_acerto: typeof d.delta_acerto === 'string' ? JSON.parse(d.delta_acerto) : (d.delta_acerto || {}),
            delta_erro:   typeof d.delta_erro   === 'string' ? JSON.parse(d.delta_erro)   : (d.delta_erro   || {}),
            explanation: d.explicacao || 'Revise os conceitos fisiológicos relacionados a este cenário clínico.',
            active: d.ativo,
          }))
        : [];

      // CORRECAO (decisao de Marcia e Samela, 16/07/2026 - Opcao B): se houver
      // uma simulacao ativa com intervencao definida, os desafios mostrados ao
      // aluno devem SEMPRE ser coerentes com essa crise especifica, sem
      // excecao. Isso evita que o aluno acerte um desafio de outro tema e
      // acabe piorando o parametro que a crise real do animal exige corrigir.
      const intervencaoAtiva = simAtiva?.intervencao || null;
      let fromDBCoerente = fromDB;
      if (intervencaoAtiva) {
        fromDBCoerente = fromDB.filter(c => c.intervencao === intervencaoAtiva);
      }

      if (mode === 'sessao') {
        try {
          const cfg = JSON.parse(localStorage.getItem('phisys_sessao_config') || '{}');
          const foco = cfg.foco || 'todos';
          let sessaoChallenges = fromDBCoerente.filter(c => c.active !== false);
          if (foco !== 'todos') {
            sessaoChallenges = sessaoChallenges.filter(c =>
              c.focus?.toLowerCase().includes(foco.toLowerCase())
            );
          }
          // CORRECAO: antes, quando nao havia nenhum desafio ativo do foco
          // selecionado, o fallback usava MOCK_CHALLENGES por inteiro, sem
          // filtro - isso quebrava a promessa de isolamento por foco (ex: um
          // aluno em Modo Sessao com foco "Renal" acabava vendo o desafio
          // mock de Fisiologia Cardiovascular tambem). Agora o fallback dos
          // mocks tambem respeita o foco selecionado.
          let fallback = MOCK_CHALLENGES;
          if (foco !== 'todos') {
            fallback = MOCK_CHALLENGES.filter(c =>
              c.focus?.toLowerCase().includes(foco.toLowerCase())
            );
            if (fallback.length === 0) fallback = MOCK_CHALLENGES; // seguranca: nunca deixar o quiz vazio
          }
          definirPool(sessaoChallenges.length > 0 ? sessaoChallenges : fallback);
        } catch {
          definirPool(fromDBCoerente.length > 0 ? fromDBCoerente : MOCK_CHALLENGES);
        }
      } else {
        // CORRECAO: antes, o Modo Livre sempre misturava MOCK_CHALLENGES junto
        // com os desafios reais do banco. Isso quebrava a garantia de coerencia
        // (decisao de Marcia e Samela, Opcao B) porque os mocks nao tem o campo
        // intervencao, entao "vazavam" no pool mesmo quando uma simulacao
        // especifica estava ativa. Agora os mocks so sao usados como ultimo
        // recurso, quando NAO ha nenhum desafio real cadastrado no banco.
        definirPool(fromDBCoerente.length > 0 ? fromDBCoerente : MOCK_CHALLENGES);
      }
    }).catch(() => {
      definirPool(MOCK_CHALLENGES);
    }).finally(() => setLoadingChallenges(false));
  }, [mode]);

  useEffect(() => {
    rankingApi.get().then(data => {
      if (!Array.isArray(data)) return;
      const token = getToken();
      if (!token) return;
      const payload = decodeToken(token);
      const idx = data.findIndex(r => r.id === payload.id || r.nome === payload.nome);
      if (idx >= 0) setMyRank('#' + (idx + 1));
    }).catch(() => {});
  }, []);

  const status = getMascotStatus(values);
  const challenge = challenges[currentIdx];

  useEffect(() => {
    if (answered || finished) return;
    const interval = setInterval(() => {
      setSeconds(s => s + 1);
      // CORRECAO: removida a penalidade de pontos por segundo (applyPenalty
      // rodando a cada tick do timer). Isso descontava pontos so pelo tempo
      // passar com o animal em status Debilitado/Critico, mesmo sem o aluno
      // ter errado nada - nao era uma regra pedagogica intencional, so um
      // resto de uma versao anterior do sistema de pontuacao.
    }, 1000);
    return () => clearInterval(interval);
  }, [status, answered, finished]);

  async function handleAnswer(option, idx) {
    if (answered) return;
    const elapsed = (Date.now() - questionStart) / 1000;

    // MOCK_CHALLENGES (fallback so quando a turma nao tem nenhum desafio real
    // cadastrado) nao vem do banco - nao ha como checar/persistir no servidor
    // sem risco de colidir com um desafio real por coincidencia de id. Vira
    // pratica/demonstracao, sem persistir XP/estado (ate o professor cadastrar
    // desafios de verdade).
    if (!challenge.fromDB) {
      setCorrectIndex(challenge.options.findIndex(o => o.correct));
      if (option.correct) {
        setResponseTimes(t => [...t, elapsed]);
        setSelected(option.letter);
        setAnswered(true);
        setAttempts(0);
        setSolvedCount(s => s + 1);
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setSelected(option.letter);
        if (newAttempts < 2) {
          setTimeout(() => setSelected(null), 1000);
        } else {
          setResponseTimes(t => [...t, elapsed]);
          setAnswered(true);
          setAttempts(0);
          setErrorCount(e => e + 1);
        }
      }
      return;
    }

    // Desafios reais: primeiro so confere (fechar:false), pra dar feedback
    // visual instantaneo sem mexer em nada ainda - o servidor e quem decide
    // se e certo/errado e quem calcula o novo estado do animal/XP (nao
    // confia mais em nada calculado aqui no cliente).
    let resultado;
    try {
      resultado = await desafiosApi.checar(challenge.id, idx, false);
    } catch (e) {
      console.log('Erro ao checar resposta:', e.message);
      return;
    }
    setCorrectIndex(resultado.opcao_correta);

    async function fecharResposta() {
      try {
        const fechamento = await desafiosApi.checar(challenge.id, idx, true, voltasExtrasUsadas > 0);
        setScore(fechamento.newScore);
        setValues(fechamento.novosValores);
      } catch (e) { console.log('Erro ao fechar resposta:', e.message); }
    }

    if (resultado.correta) {
      setResponseTimes(t => [...t, elapsed]);
      setSelected(option.letter);
      setAnswered(true);
      setAttempts(0);
      setSolvedCount(s => s + 1);
      await fecharResposta();
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setSelected(option.letter);
      if (newAttempts < 2) {
        setTimeout(() => setSelected(null), 1000);
      } else {
        setResponseTimes(t => [...t, elapsed]);
        setAnswered(true);
        setAttempts(0);
        setErrorCount(e => e + 1);
        await fecharResposta();
      }
    }
  }

  function handleNext() {
    const energiaAtual = values.energia || 0;
    const snapshot = {
      label: `D${currentIdx + 1}`,
      hidratacao: values.hidratacao,
      pas: values.pas,
      fc: values.fc,
      saude: calcularSaude({ ...values, age_days: values.age_days || 90 }),
    };
    const updatedHistory = [...paramHistory, snapshot];
    setParamHistory(updatedHistory);

    if (mode === 'livre' && energiaAtual <= 0) {
      alert('⚡ Energia esgotada! Volte à tela principal e alimente o Phisys para continuar.');
      if (onFinish) {
        onFinish({ seconds, solvedChallenges: solvedCount, totalChallenges: challenges.length, errors: errorCount, paramHistory: updatedHistory, finalScore: score, finalValues: values });
      }
      return;
    }

    if (currentIdx + 1 >= challenges.length) {
      // Se o professor configurou desafios extras e ainda ha voltas
      // disponiveis, avanca para a proxima fatia do pool (desafios
      // diferentes), em vez de repetir os mesmos.
      const desafiosExtras = recuperacaoConfig.desafios_extras || 0;
      if (voltasExtrasUsadas < desafiosExtras) {
        const proximaVolta = voltasExtrasUsadas + 1;
        const inicioFatia = proximaVolta * TAMANHO_RODADA;
        // Se o pool nao tem desafios suficientes para uma fatia nova sem
        // repetir, reembaralha o pool inteiro e recomeca do zero (repeticao
        // so acontece nesse caso extremo, apos esgotar todo o conteudo
        // cadastrado pelo professor).
        if (inicioFatia + TAMANHO_RODADA > challengePool.length) {
          const poolReembaralhado = embaralharArray(challengePool);
          setChallengePool(poolReembaralhado);
          setChallenges(poolReembaralhado.slice(0, TAMANHO_RODADA));
        } else {
          setChallenges(challengePool.slice(inicioFatia, inicioFatia + TAMANHO_RODADA));
        }
        setVoltasExtrasUsadas(v => v + 1);
        setCurrentIdx(0);
        setSelected(null);
        setAnswered(false);
        setAttempts(0);
        setCorrectIndex(null);
        setQuestionStart(Date.now());
      } else if (onFinish) {
        const totalComExtras = challenges.length * (1 + voltasExtrasUsadas);
        onFinish({ seconds, solvedChallenges: solvedCount, totalChallenges: totalComExtras, errors: errorCount, paramHistory: updatedHistory, finalScore: score, finalValues: values });
      } else {
        setFinished(true);
      }
    } else {
      setCurrentIdx(i => i + 1);
      setSelected(null);
      setAnswered(false);
      setAttempts(0);
      setCorrectIndex(null);
      setQuestionStart(Date.now());
    }
  }

  const formatTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '00');
    const sec = (s % 60).toString().padStart(2, '00');
    return `${m}:${sec}`;
  };

  const statusEmoji = { [STATUS.SAUDAVEL]: '😊', [STATUS.DEBILITADO]: '😰', [STATUS.CRITICO]: '😵' };
  const statusLabel = { [STATUS.SAUDAVEL]: 'Saudável', [STATUS.DEBILITADO]: 'Debilitado', [STATUS.CRITICO]: 'Crítico' };

  if (loadingChallenges) {
    return (
      <div style={{ ...styles.screen, justifyContent:'center', alignItems:'center' }}>
        <div style={{ color:COLORS.textMuted, ...FONT_SCALE.title }}>Carregando desafios...</div>
      </div>
    );
  }

  if (finished) {
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 30;
    const savedWeights = (() => {
      try { return JSON.parse(localStorage.getItem('phisys_pesos') || '{}'); } catch { return {}; }
    })();
    // CORRECAO: antes usava MOCK_CHALLENGES.length fixo, que ficava errado
    // sempre que os desafios reais do banco eram usados (numero diferente de 3)
    // e ainda mais errado com voltas extras de recuperacao (que multiplicam
    // o total real de desafios respondidos).
    const totalRespondidos = challenges.length * (1 + voltasExtrasUsadas);
    const grade = calculateFinalGrade({
      finalScore: score,
      totalChallenges: totalRespondidos,
      solvedChallenges: solvedCount,
      avgResponseTime,
      errors: errorCount,
      finalHealth: calcularSaude(values),
    }, savedWeights);
    return (
      <div className="app-screen" style={styles.screen}>
        <div style={{ padding:'3rem 1.5rem', display:'flex', flexDirection:'column', alignItems:'center', gap:'1.5rem' }}>
          <ChibiMascot status={STATUS.SAUDAVEL} ageDays={ageDays} size={90}/>
          <div style={{ ...FONT_SCALE.heading, color:COLORS.textPrimary, textAlign:'center' }}>Sessão concluída!</div>
          <div style={{ display:'flex', gap:'12px', width:'100%' }}>
            {[{ val: Math.round(score), lbl: 'Pontos' }, { val: grade, lbl: 'Nota' }, { val: `${solvedCount}/${totalRespondidos}`, lbl: 'Acertos' }].map(item => (
              <div key={item.lbl} style={{ flex:1, background:COLORS.surface, boxShadow:SHADOW_CARD, borderRadius:'14px', padding:'1rem', textAlign:'center' }}>
                <div style={{ ...FONT_SCALE.value, color:COLORS.indigo }}>{item.val}</div>
                <div style={{ ...FONT_SCALE.caption, color:COLORS.textMuted, textTransform:'uppercase', letterSpacing:'0.05em' }}>{item.lbl}</div>
              </div>
            ))}
          </div>
          <button style={styles.nextBtn} onClick={onBack}>Voltar ao menu</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-screen" style={styles.screen}>
      <div style={styles.topbar}>
        <button style={styles.backBtn} onClick={onBack}>←</button>
        <div style={styles.modeBadge}>{mode === 'sessao' ? '📋 Sessão' : '🎯 Livre'}</div>
        <div style={styles.scoreBadge}>⭐ {Math.round(score)} pts</div>
        <div style={styles.timerBadge}>⏱ {formatTime(seconds)}</div>
      </div>

      <div className="session-columns">
        <div className="session-left">
          <div style={styles.mascotSection}>
            <ChibiMascot status={status} ageDays={ageDays} size={72}/>
            <div style={styles.paramsPanel}>
              {/* CORRECAO: a energia exibida aqui era o valor bruto (values.energia),
                  enquanto a HomeScreen ja aplicava calcularEnergiaModulada (reduz a
                  energia exibida quando saude/hidratacao estao baixas). Isso fazia
                  a mesma energia real aparecer diferente em cada tela (ex: 80% aqui,
                  60% na Home). Agora as duas telas usam a mesma formula. */}
              {PARAMS.map(p => (
                <ParamBar
                  key={p.id}
                  param={p}
                  value={p.id === 'energia' ? calcularEnergiaModulada(values, calcularSaude(values)) : values[p.id]}
                />
              ))}
            </div>
          </div>

          <div style={styles.statusBar}>
            {[
              { val: statusEmoji[status], lbl: statusLabel[status] },
              // Quando o aluno esta numa volta extra de recuperacao, mostra
              // "Volta X" em vez de "Desafios", para deixar claro que a lista
              // esta se repetindo (nao e um erro/travamento).
              { val: `${currentIdx + 1}/${challenges.length}`, lbl: voltasExtrasUsadas > 0 ? `Volta ${voltasExtrasUsadas + 1}` : 'Desafios' },
              { val: errorCount, lbl: 'Erros' },
              { val: myRank, lbl: 'Ranking' },
            ].map(item => (
              <div key={item.lbl} style={styles.statusPill}>
                <div style={styles.statusPillVal}>{item.val}</div>
                <div style={styles.statusPillLbl}>{item.lbl}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="session-right">
          <div style={styles.challengeCard}>
            <div style={styles.challengeHeader}>
              <div style={styles.challengeTag}>🏃 {challenge.tag}</div>
              <div style={styles.challengeFocus}>{challenge.focus}</div>
            </div>
            <div style={styles.challengeText}>{challenge.text}</div>
          </div>

          <div style={styles.optionsTitle}>escolha a resposta</div>

          <div style={styles.options}>
            {challenge.options.map((option, idx) => {
              let extra = {};
              const isCorrectOption = idx === correctIndex;
              if (answered && option.letter === selected && isCorrectOption) extra = styles.optionCorrect;
              else if (answered && option.letter === selected && !isCorrectOption) extra = styles.optionWrong;
              else if (answered && isCorrectOption) extra = styles.optionCorrect;
              return (
                <div key={option.letter} style={{ ...styles.option, ...extra }} onClick={() => handleAnswer(option, idx)}>
                  <div style={{ ...styles.optionLetter, ...(answered && isCorrectOption ? styles.optionLetterCorrect : answered && option.letter === selected ? styles.optionLetterWrong : {}) }}>
                    {option.letter}
                  </div>
                  <div style={styles.optionText}>{option.text}</div>
                </div>
              );
            })}
          </div>

          {!answered && attempts === 1 && (
            <div style={{ margin:'0 1.5rem .5rem', background:COLORS.status.debilitado.soft, border:`1px solid ${COLORS.status.debilitado.color}`, borderRadius:'12px', padding:'.75rem', ...FONT_SCALE.body, color:COLORS.textPrimary, textAlign:'center' }}>
              ⚠️ Resposta incorreta! Você tem mais uma tentativa.
            </div>
          )}

          {answered && (
            <div style={{ padding:'0 1.5rem' }}>
              <div style={{ background:COLORS.surface, boxShadow:SHADOW_CARD, borderRadius:'14px', padding:'1rem', marginBottom:'10px' }}>
                <div style={{ ...FONT_SCALE.caption, color:COLORS.accent, marginBottom:'4px', letterSpacing:'.06em', textTransform:'uppercase' }}>💡 Explicação Fisiológica</div>
                <div style={{ ...FONT_SCALE.body, color:COLORS.textPrimary, lineHeight:'1.6' }}>{challenge.explanation}</div>
              </div>
              <button style={styles.nextBtn} onClick={handleNext}>
                {currentIdx + 1 >= challenges.length ? 'Ver resultado' : 'Próximo desafio →'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  screen:             { width:'100%', minHeight:'var(--app-min-h)', display:'flex', flexDirection:'column', background:COLORS.surface, margin:'0 auto', fontFamily:FONT_FAMILY, color:COLORS.textPrimary },
  topbar:             { background:COLORS.bg, padding:'1.25rem 1.5rem 0.75rem', display:'flex', justifyContent:'space-between', alignItems:'center', gap:'8px', flexWrap:'wrap' },
  backBtn:            { fontSize:'clamp(22px, calc(18.7px + 0.9vw), 28.6px)', cursor:'pointer', background:'none', border:'none', color:'white' },
  scoreBadge:         { background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:'20px', padding:'4px 14px', ...FONT_SCALE.label, color:'white' },
  timerBadge:         { background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:'20px', padding:'4px 14px', ...FONT_SCALE.label, color:'white' },
  mascotSection:      { padding:'1rem 1.5rem 0', display:'flex', alignItems:'center', gap:'1rem' },
  paramsPanel:        { flex:1, display:'flex', flexDirection:'column', gap:'8px' },
  paramItem:          { display:'flex', alignItems:'center', gap:'8px' },
  paramLabel:         { ...FONT_SCALE.label, color:COLORS.textMuted, width:'65px' },
  paramTrack:         { flex:1, height:'6px', background:COLORS.border, borderRadius:'3px', overflow:'hidden', position:'relative' },
  paramNormal:        { position:'absolute', height:'100%', background:'rgba(58,49,168,0.12)', borderRadius:'3px' },
  paramFill:          { position:'absolute', height:'100%', borderRadius:'3px', transition:'width 0.3s' },
  paramVal:           { ...FONT_SCALE.bodyBold, color:COLORS.textPrimary, width:'40px', textAlign:'right' },
  statusBar:          { margin:'0.75rem 1.5rem', display:'flex', gap:'8px' },
  statusPill:         { flex:1, background:COLORS.surface, boxShadow:SHADOW_CARD, borderRadius:'12px', padding:'8px', textAlign:'center' },
  statusPillVal:      { ...FONT_SCALE.bodyBold, color:COLORS.indigo },
  statusPillLbl:      { ...FONT_SCALE.caption, color:COLORS.textMuted, textTransform:'uppercase', letterSpacing:'0.05em' },
  challengeCard:      { margin:'0 1.5rem', background:COLORS.surface, boxShadow:SHADOW_CARD, borderRadius:'18px', padding:'1.25rem' },
  challengeHeader:    { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' },
  challengeTag:       { ...FONT_SCALE.label, letterSpacing:'0.08em', textTransform:'uppercase', background:COLORS.iconChipBg, color:COLORS.indigo, padding:'3px 10px', borderRadius:'20px' },
  challengeFocus:     { ...FONT_SCALE.caption, color:COLORS.textMuted },
  challengeText:      { ...FONT_SCALE.body, color:COLORS.textPrimary, lineHeight:'1.6' },
  optionsTitle:       { padding:'0.75rem 1.5rem 0.5rem', ...FONT_SCALE.label, color:COLORS.textMuted, letterSpacing:'0.08em', textTransform:'uppercase' },
  options:            { padding:'0 1.5rem', display:'flex', flexDirection:'column', gap:'10px' },
  option:             { background:COLORS.surface, boxShadow:SHADOW_CARD, border:`1.5px solid ${COLORS.border}`, borderRadius:'14px', padding:'1rem 1.25rem', cursor:'pointer', display:'flex', alignItems:'center', gap:'12px' },
  optionCorrect:      { background:COLORS.status.saudavel.soft, borderColor:COLORS.status.saudavel.color },
  optionWrong:        { background:COLORS.status.critico.soft, borderColor:COLORS.status.critico.color },
  optionLetter:       { width:'26px', height:'26px', borderRadius:'50%', background:COLORS.iconChipBg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:'800', color:COLORS.indigo, flexShrink:0 },
  optionLetterCorrect:{ background:COLORS.status.saudavel.color, color:'white' },
  optionLetterWrong:  { background:COLORS.status.critico.color, color:'white' },
  optionText:         { ...FONT_SCALE.body, color:COLORS.textPrimary, lineHeight:'1.4' },
  nextBtn:            { width:'100%', padding:'13px', borderRadius:'12px', border:'none', backgroundColor:COLORS.indigo, color:'white', fontSize:'clamp(16px, calc(13.6px + 0.9vw), 20.8px)', fontWeight:'800', cursor:'pointer', fontFamily:'inherit' },
  modeBadge:          { background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:'20px', padding:'4px 10px', ...FONT_SCALE.label, color:'white' },
};

export default GameScreen;