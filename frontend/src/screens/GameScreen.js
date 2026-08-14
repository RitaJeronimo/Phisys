import React, { useState, useEffect } from 'react';
import { PARAMS, getDefaultValues, getMascotStatus, applyBonus, calculateFinalGrade, STATUS, calcularSaude, calcularEnergiaModulada, getAgeRecoveryPenalty, aplicarDeltaComFreio, getAgeStage, getAgePANormal, embaralharArray } from '../engine/mascotEngine';
import { ranking as rankingApi, animal as animalApi, getToken, desafios as desafiosApi, configuracoes as configuracoesApi, simulacoes as simulacoesApi } from '../api';

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

function ChibiMascot({ status, size = 72 }) {
  const bodyColor = status === STATUS.SAUDAVEL ? '#D4D4D4' : status === STATUS.DEBILITADO ? '#FAC775' : '#F09595';
  const earIn     = status === STATUS.SAUDAVEL ? '#FFD0DC' : status === STATUS.DEBILITADO ? '#F5CC80' : '#FFB0B0';
  const eyeOuter  = status === STATUS.SAUDAVEL ? '#7B2FBE' : status === STATUS.DEBILITADO ? '#633806' : '#791F1F';
  const eyeInner  = status === STATUS.SAUDAVEL ? '#3A1A6A' : status === STATUS.DEBILITADO ? '#3A1A00' : '#3A0000';
  const cheek     = status === STATUS.SAUDAVEL ? '#FFB0C8' : status === STATUS.DEBILITADO ? '#F5CC80' : '#FFB0B0';

  const mouth = status === STATUS.SAUDAVEL
    ? <path d="M188 184 Q200 196 212 184" stroke="#666" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    : status === STATUS.DEBILITADO
    ? <path d="M188 188 Q200 188 212 188" stroke="#888" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    : <path d="M188 192 Q200 182 212 192" stroke="#AA4444" strokeWidth="2.5" fill="none" strokeLinecap="round"/>;

  const eyeL = status === STATUS.CRITICO
    ? <><ellipse cx="168" cy="152" rx="22" ry="22" fill="white"/><line x1="158" y1="142" x2="178" y2="162" stroke={eyeOuter} strokeWidth="4" strokeLinecap="round"/><line x1="178" y1="142" x2="158" y2="162" stroke={eyeOuter} strokeWidth="4" strokeLinecap="round"/></>
    : status === STATUS.DEBILITADO
    ? <><ellipse cx="168" cy="152" rx="22" ry="22" fill="white"/><ellipse cx="168" cy="156" rx="16" ry="10" fill={eyeOuter}/><ellipse cx="168" cy="156" rx="8" ry="5" fill={eyeInner}/><path d="M148 148 Q168 138 188 148" stroke="#999" strokeWidth="2" fill="none"/><ellipse cx="176" cy="150" rx="5" ry="3" fill="white" opacity=".8"/></>
    : <><ellipse cx="168" cy="152" rx="22" ry="26" fill="white"/><ellipse cx="168" cy="155" rx="16" ry="20" fill={eyeOuter}/><ellipse cx="168" cy="155" rx="8" ry="10" fill={eyeInner}/><ellipse cx="176" cy="144" rx="6" ry="7" fill="white" opacity=".9"/></>;

  const eyeR = status === STATUS.CRITICO
    ? <><ellipse cx="232" cy="152" rx="22" ry="22" fill="white"/><line x1="222" y1="142" x2="242" y2="162" stroke={eyeOuter} strokeWidth="4" strokeLinecap="round"/><line x1="242" y1="142" x2="222" y2="162" stroke={eyeOuter} strokeWidth="4" strokeLinecap="round"/></>
    : status === STATUS.DEBILITADO
    ? <><ellipse cx="232" cy="152" rx="22" ry="22" fill="white"/><ellipse cx="232" cy="156" rx="16" ry="10" fill={eyeOuter}/><ellipse cx="232" cy="156" rx="8" ry="5" fill={eyeInner}/><path d="M212 148 Q232 138 252 148" stroke="#999" strokeWidth="2" fill="none"/><ellipse cx="240" cy="150" rx="5" ry="3" fill="white" opacity=".8"/></>
    : <><ellipse cx="232" cy="152" rx="22" ry="26" fill="white"/><ellipse cx="232" cy="155" rx="16" ry="20" fill={eyeOuter}/><ellipse cx="232" cy="155" rx="8" ry="10" fill={eyeInner}/><ellipse cx="240" cy="144" rx="6" ry="7" fill="white" opacity=".9"/></>;

  return (
    <svg viewBox="0 0 400 380" width={size} height={size}>
      <path d="M188 350 Q162 358 148 340 Q136 322 144 308 Q152 295 164 305" stroke="#C8C8C8" strokeWidth="7" fill="none" strokeLinecap="round"/>
      <ellipse cx="166" cy="335" rx="22" ry="13" fill={bodyColor}/>
      <ellipse cx="234" cy="335" rx="22" ry="13" fill={bodyColor}/>
      <ellipse cx="200" cy="285" rx="82" ry="78" fill={bodyColor}/>
      <ellipse cx="200" cy="295" rx="48" ry="50" fill="white" opacity=".2"/>
      <ellipse cx="118" cy="268" rx="22" ry="15" fill={bodyColor} transform="rotate(-20,118,268)"/>
      <ellipse cx="282" cy="268" rx="22" ry="15" fill={bodyColor} transform="rotate(20,282,268)"/>
      <ellipse cx="110" cy="135" rx="38" ry="48" fill={bodyColor}/>
      <ellipse cx="110" cy="135" rx="24" ry="34" fill={earIn}/>
      <ellipse cx="290" cy="135" rx="38" ry="48" fill={bodyColor}/>
      <ellipse cx="290" cy="135" rx="24" ry="34" fill={earIn}/>
      <ellipse cx="200" cy="158" rx="82" ry="78" fill={bodyColor}/>
      <ellipse cx="136" cy="170" rx="20" ry="14" fill={cheek} opacity=".6"/>
      <ellipse cx="264" cy="170" rx="20" ry="14" fill={cheek} opacity=".6"/>
      {eyeL}
      {eyeR}
      <ellipse cx="200" cy="175" rx="8" ry="6" fill="#FF8FAA"/>
      {mouth}
      {status !== STATUS.SAUDAVEL && (<ellipse cx="290" cy="120" rx="7" ry="11" fill="#85B7EB" opacity=".8"/>)}
      {status === STATUS.SAUDAVEL && (<><text x="316" y="100" fontSize="18" fill="white" opacity=".9">✦</text><text x="72" y="112" fontSize="12" fill="white" opacity=".8">✦</text></>)}
    </svg>
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

function GameScreen({ user, mode, values: initialValues, score: initialScore, onBack, onFinish }) {
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
      const payload = JSON.parse(atob(token.split('.')[1]));
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

    let isCorrect = option.correct;
    let opcaoCorretaIdx = challenge.options.findIndex(o => o.correct);
    if (challenge.fromDB) {
      try {
        const resultado = await desafiosApi.checar(challenge.id, idx);
        isCorrect = resultado.correta;
        opcaoCorretaIdx = resultado.opcao_correta;
      } catch (e) {
        console.log('Erro ao checar resposta:', e.message);
        return;
      }
    }
    setCorrectIndex(opcaoCorretaIdx);

    if (isCorrect) {
      setResponseTimes(t => [...t, elapsed]);
      setSelected(option.letter);
      setAnswered(true);
      setAttempts(0);
      // CORRECAO CRITICA: a chamada usava a chave 'correct_answer', que nao
      // existe em SCORE_RULES.bonus (mascotEngine.js) - a chave real e
      // 'resposta_correta'. Como a chave nao batia, applyBonus somava 0
      // pontos sempre, ou seja, ACERTAR UM DESAFIO NAO AUMENTAVA O XP/SCORE
      // salvo no banco. So o timer (applyPenalty) alterava o score, e so pra
      // baixo. Corrigido para usar a chave certa.
      const newScore = applyBonus(score, 'resposta_correta');
      setScore(newScore);
      setSolvedCount(s => s + 1);
      const da = challenge.delta_acerto || {};
      const ageDaysAtual = values.age_days || 90;
      // Multiplicador configurado pelo professor + penalidade automatica por
      // fase de vida (decisao da equipe: fase de vida e automatica, sem
      // controle manual adicional).
      const fatorRecuperacao = (recuperacaoConfig.multiplicador || 1) * getAgeRecoveryPenalty(ageDaysAtual);
      const paNormalAtual = getAgePANormal(ageDaysAtual);
      const fcNormalAtual = getAgeStage(ageDaysAtual).fcNormal;
      const hidNormalAtual = PARAMS.find(p => p.id === 'hidratacao').normal;

      // Aplica o delta de acerto multiplicado pelo fator de recuperacao, com
      // freio para nao ultrapassar o centro da faixa normal (risco identificado
      // pela Samela: evita o animal ir de "critico alto" direto para "critico baixo").
      function deltaAcertoComFreio(deltaOriginal, valorBase, faixaNormal, min, max) {
        if (deltaOriginal === undefined) return valorBase;
        const deltaAjustado = deltaOriginal * fatorRecuperacao;
        return aplicarDeltaComFreio(valorBase, deltaAjustado, faixaNormal, min, max);
      }

      let novosValores;
      if (mode === 'sessao') {
        // CORRECAO (decisao: professor tem controle total): antes, quando o
        // desafio nao definia pas/pad/fc no delta_acerto, o codigo forcava a
        // recuperacao total do animal para os valores basais (110/70/370).
        // Isso conflitava com desafios que definem seus proprios deltas (que
        // ai sim eram aplicados) - um comportamento inconsistente dependendo
        // de quais campos o professor preenchia. Agora a regra e unica e
        // igual ao Modo Livre: um parametro so muda se o professor configurou
        // um delta para ele. Se nao configurou, o parametro simplesmente
        // permanece como estava.
        novosValores = {
          ...values,
          hidratacao: deltaAcertoComFreio(da.hidratacao, values.hidratacao || 70, hidNormalAtual, 0, 100),
          energia:    da.energia !== undefined ? Math.min(100, (values.energia || 80) + da.energia) : values.energia,
          pas: deltaAcertoComFreio(da.pas, values.pas || 110, paNormalAtual.pas, 60, 200),
          pad: deltaAcertoComFreio(da.pad, values.pad || 70,  paNormalAtual.pad, 40, 120),
          fc:  deltaAcertoComFreio(da.fc,  values.fc  || 370, fcNormalAtual,     100, 600),
          age_days: ageDaysAtual,
        };
        novosValores.saude = calcularSaude(novosValores);
      } else {
        // Modo Livre: aplica os deltas de acerto em TODOS os parametros primarios.
        // Antes, o spread de challenge.intervention sobrescrevia os valores com a
        // intervencao original (a crise), travando o animal em estado critico mesmo
        // apos o aluno acertar o desafio. Removido, e PAS/PAD/FC agora recebem os
        // deltas de acerto, com saude recalculada ao final.
        // CORRECAO: durante voltas extras de recuperacao (voltasExtrasUsadas > 0),
        // a energia deixa de ser descontada. Essas voltas existem para corrigir
        // uma crise causada pelo professor - descontar energia nelas fazia o
        // animal cair em estado critico por baixa energia mesmo quando o aluno
        // acertava tudo, o que nao tem relacao com o problema que ele esta
        // tentando resolver. O consumo normal de energia (jogo do dia a dia,
        // fora de voltas extras) continua igual.
        novosValores = {
          ...values,
          hidratacao: deltaAcertoComFreio(da.hidratacao, values.hidratacao || 70, hidNormalAtual, 0, 100),
          pas: deltaAcertoComFreio(da.pas, values.pas || 110, paNormalAtual.pas, 60, 200),
          pad: deltaAcertoComFreio(da.pad, values.pad || 70,  paNormalAtual.pad, 40, 120),
          fc:  deltaAcertoComFreio(da.fc,  values.fc  || 370, fcNormalAtual,     100, 600),
          energia: voltasExtrasUsadas > 0 ? values.energia : Math.max(0, (values.energia || 80) - 10),
          age_days: ageDaysAtual,
        };
        novosValores.saude = calcularSaude(novosValores);
      }
      setValues(novosValores);
      try { await animalApi.update(novosValores); } catch(e) { console.log('Erro ao salvar animal (acerto):', e.message); }
      try { await rankingApi.update({ xp_total: newScore, media_saude: calcularSaude(novosValores) }); } catch(e) {}
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
        const de = challenge.delta_erro || {};
        let novosValoresErro;
        if (mode === 'sessao') {
          // CORRECAO (mesmo principio do acerto acima): removidos os
          // valores-padrao escondidos (?? -20, ?? -15) que aplicavam uma
          // piora fixa em hidratacao/energia mesmo quando o professor nao
          // configurou nada para esses campos no delta_erro. Agora, assim
          // como pas/pad/fc, hidratacao e energia so mudam se o professor
          // configurou um delta_erro para elas.
          novosValoresErro = {
            ...values,
            hidratacao: de.hidratacao !== undefined ? Math.max(0, Math.min(100, (values.hidratacao || 70) + de.hidratacao)) : values.hidratacao,
            energia:    de.energia    !== undefined ? Math.max(0, Math.min(100, (values.energia    || 80) + de.energia))    : values.energia,
            pas: de.pas !== undefined ? Math.max(60,  Math.min(200, (values.pas || 110) + de.pas)) : values.pas,
            pad: de.pad !== undefined ? Math.max(40,  Math.min(120, (values.pad || 70)  + de.pad)) : values.pad,
            fc:  de.fc  !== undefined ? Math.max(100, Math.min(600, (values.fc  || 370) + de.fc))  : values.fc,
            age_days: values.age_days || 90,
          };
          novosValoresErro.saude = calcularSaude(novosValoresErro);
        } else {
          // Modo Livre: mesmo tratamento do acerto, so que aplicando os deltas de erro
          novosValoresErro = {
            ...values,
            hidratacao: de.hidratacao !== undefined ? Math.max(0, Math.min(100, (values.hidratacao || 70) + de.hidratacao)) : values.hidratacao,
            pas: de.pas !== undefined ? Math.max(60,  Math.min(200, (values.pas || 110) + de.pas)) : values.pas,
            pad: de.pad !== undefined ? Math.max(40,  Math.min(120, (values.pad || 70)  + de.pad)) : values.pad,
            fc:  de.fc  !== undefined ? Math.max(100, Math.min(600, (values.fc  || 370) + de.fc))  : values.fc,
            energia: Math.max(0, (values.energia || 80) - 10),
            age_days: values.age_days || 90,
          };
          novosValoresErro.saude = calcularSaude(novosValoresErro);
        }
        setValues(novosValoresErro);
        try { await animalApi.update(novosValoresErro); } catch(e) { console.log('Erro ao salvar animal (erro):', e.message); }
        const penaltyScore = Math.max(0, score - 5);
        setScore(penaltyScore);
        setErrorCount(e => e + 1);
        try { await rankingApi.update({ xp_total: penaltyScore, media_saude: calcularSaude(novosValoresErro) }); } catch(e) {}
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
        <div style={{ color:'white', fontSize:'16px', fontWeight:'600' }}>Carregando desafios...</div>
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
          <ChibiMascot status={STATUS.SAUDAVEL} size={90}/>
          <div style={{ fontSize:'22px', fontWeight:'700', color:'white', textAlign:'center' }}>Sessão concluída!</div>
          <div style={{ display:'flex', gap:'12px', width:'100%' }}>
            {[{ val: Math.round(score), lbl: 'Pontos' }, { val: grade, lbl: 'Nota' }, { val: `${solvedCount}/${totalRespondidos}`, lbl: 'Acertos' }].map(item => (
              <div key={item.lbl} style={{ flex:1, background:'rgba(255,255,255,0.15)', borderRadius:'12px', padding:'1rem', textAlign:'center' }}>
                <div style={{ fontSize:'24px', fontWeight:'700', color:'white' }}>{item.val}</div>
                <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.6)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{item.lbl}</div>
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

      <div style={styles.mascotSection}>
        <ChibiMascot status={status} size={72}/>
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
        <div style={{ margin:'0 1.5rem .5rem', background:'rgba(239,159,39,.2)', border:'1px solid rgba(239,159,39,.5)', borderRadius:'12px', padding:'.75rem', fontSize:'12px', color:'white', textAlign:'center' }}>
          ⚠️ Resposta incorreta! Você tem mais uma tentativa.
        </div>
      )}

      {answered && (
        <div style={{ padding:'0 1.5rem' }}>
          <div style={{ background:'rgba(255,255,255,.12)', border:'1px solid rgba(255,255,255,.25)', borderRadius:'12px', padding:'1rem', marginBottom:'10px' }}>
            <div style={{ fontSize:'10px', color:'#FFD700', fontWeight:'700', marginBottom:'4px', letterSpacing:'.06em', textTransform:'uppercase' }}>💡 Explicação Fisiológica</div>
            <div style={{ fontSize:'12px', color:'rgba(255,255,255,.9)', lineHeight:'1.6' }}>{challenge.explanation}</div>
          </div>
          <button style={styles.nextBtn} onClick={handleNext}>
            {currentIdx + 1 >= challenges.length ? 'Ver resultado' : 'Próximo desafio →'}
          </button>
        </div>
      )}
    </div>
  );
}

const GRADIENT = 'linear-gradient(160deg, #1B4FCC 0%, #7B2FBE 50%, #CC1B1B 100%)';

const styles = {
  screen:             { width:'100%', minHeight:'100vh', display:'flex', flexDirection:'column', background:GRADIENT, margin:'0 auto' },
  topbar:             { padding:'1.25rem 1.5rem 0.75rem', display:'flex', justifyContent:'space-between', alignItems:'center' },
  backBtn:            { fontSize:'20px', cursor:'pointer', background:'none', border:'none', color:'white' },
  scoreBadge:         { background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:'20px', padding:'4px 14px', fontSize:'12px', color:'white', fontWeight:'600' },
  timerBadge:         { background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:'20px', padding:'4px 14px', fontSize:'12px', color:'white', fontWeight:'600' },
  mascotSection:      { padding:'0.5rem 1.5rem 0', display:'flex', alignItems:'center', gap:'1rem' },
  paramsPanel:        { flex:1, display:'flex', flexDirection:'column', gap:'6px' },
  paramItem:          { display:'flex', alignItems:'center', gap:'8px' },
  paramLabel:         { fontSize:'13px', color:'rgba(255,255,255,0.75)', width:'65px' },
  paramTrack:         { flex:1, height:'6px', background:'rgba(255,255,255,0.15)', borderRadius:'3px', overflow:'hidden', position:'relative' },
  paramNormal:        { position:'absolute', height:'100%', background:'rgba(255,255,255,0.2)', borderRadius:'3px' },
  paramFill:          { position:'absolute', height:'100%', borderRadius:'3px', transition:'width 0.3s' },
  paramVal:           { fontSize:'13px', color:'white', fontWeight:'600', width:'40px', textAlign:'right' },
  statusBar:          { margin:'0.75rem 1.5rem', display:'flex', gap:'8px' },
  statusPill:         { flex:1, background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'10px', padding:'8px', textAlign:'center' },
  statusPillVal:      { fontSize:'14px', fontWeight:'700', color:'white' },
  statusPillLbl:      { fontSize:'9px', color:'rgba(255,255,255,0.55)', textTransform:'uppercase', letterSpacing:'0.05em' },
  challengeCard:      { margin:'0 1.5rem', background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:'16px', padding:'1.25rem' },
  challengeHeader:    { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' },
  challengeTag:       { fontSize:'10px', fontWeight:'700', letterSpacing:'0.08em', textTransform:'uppercase', background:'rgba(255,255,255,0.2)', color:'white', padding:'3px 10px', borderRadius:'20px' },
  challengeFocus:     { fontSize:'10px', color:'rgba(255,255,255,0.55)' },
  challengeText:      { fontSize:'14px', color:'white', lineHeight:'1.6', fontWeight:'500' },
  optionsTitle:       { padding:'0.75rem 1.5rem 0.5rem', fontSize:'11px', color:'rgba(255,255,255,0.6)', letterSpacing:'0.08em', textTransform:'uppercase' },
  options:            { padding:'0 1.5rem', display:'flex', flexDirection:'column', gap:'10px' },
  option:             { background:'rgba(255,255,255,0.12)', border:'1.5px solid rgba(255,255,255,0.2)', borderRadius:'12px', padding:'1rem 1.25rem', cursor:'pointer', display:'flex', alignItems:'center', gap:'12px' },
  optionCorrect:      { background:'rgba(50,200,120,0.25)', borderColor:'#32C878' },
  optionWrong:        { background:'rgba(220,60,60,0.25)', borderColor:'#DC3C3C' },
  optionLetter:       { width:'26px', height:'26px', borderRadius:'50%', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:'700', color:'white', flexShrink:0 },
  optionLetterCorrect:{ background:'#32C878' },
  optionLetterWrong:  { background:'#DC3C3C' },
  optionText:         { fontSize:'13px', color:'white', lineHeight:'1.4' },
  nextBtn:            { width:'100%', padding:'13px', borderRadius:'10px', border:'none', backgroundColor:'white', color:'#7B2FBE', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' },
  modeBadge:          { background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:'20px', padding:'4px 10px', fontSize:'11px', color:'white', fontWeight:'600' },
};

export default GameScreen;