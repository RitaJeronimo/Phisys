import React, { useState, useEffect, useCallback } from 'react';
import { animal as animalApi, ranking as rankingApi } from '../api';
import { PRIMARY_PARAMS, calcularSaude, calcularEnergiaModulada, getAgePANormal, getMascotStatus, STATUS, DAILY_CARES, aplicarCuidado } from '../engine/mascotEngine';


const GRADIENT = 'linear-gradient(160deg, #1B4FCC 0%, #7B2FBE 50%, #CC1B1B 100%)';

// ─── FASES DE CRESCIMENTO ────────────────────────────────────────────────
export const GROWTH_STAGES = {
  RECEM_NASCIDO: { id:'RECEM_NASCIDO', label:'Recém-nascido', icon:'🐣', minDays:0,   maxDays:30  },
  JUVENIL:       { id:'JUVENIL',       label:'Juvenil',       icon:'🐭', minDays:31,  maxDays:180 },
  ADULTO:        { id:'ADULTO',        label:'Adulto',        icon:'🐀', minDays:181, maxDays:540 },
  IDOSO:         { id:'IDOSO',         label:'Idoso',         icon:'🦳', minDays:541, maxDays:9999 },
};

export function getGrowthStage(days) {
  if (days <= 30)  return GROWTH_STAGES.RECEM_NASCIDO;
  if (days <= 180) return GROWTH_STAGES.JUVENIL;
  if (days <= 540) return GROWTH_STAGES.ADULTO;
  return GROWTH_STAGES.IDOSO;
}

const PARAM_INFO = {
  energia: {
    pergunta: 'O que é a energia do Phisys e o que a influencia?',
    resposta: 'A energia indica a disposição do animal para realizar ações, participar de desafios e responder quizzes. É recuperada principalmente com alimentação adequada e pode ser influenciada pela saúde, hidratação e fase de desenvolvimento. Baixa energia limita ações e sinaliza necessidade de cuidado.',
    dica: '💡 Alimente o Phisys diariamente para manter a energia alta!',
  },
  hidratacao: {
    pergunta: 'Como a hidratação influencia o organismo do Phisys?',
    resposta: 'A hidratação representa o equilíbrio hídrico do rato virtual. Influencia o volume urinário, a volemia, a pressão arterial e o débito cardíaco. Regra fisiológica: ↓ hidratação → ↓ volemia → ↓ pré-carga → ↓ volume sistólico → ↓ débito cardíaco → ↑ FC compensatória.',
    dica: '💡 Troque a água diariamente para manter a homeostase cardiovascular e renal!',
  },
  pa: {
    pergunta: 'O que determina a Pressão Arterial do Phisys?',
    resposta: 'A PA depende principalmente do débito cardíaco e da resistência vascular periférica: PA = DC × RVP. A PAS reflete a ejeção cardíaca e a PAD reflete a resistência vascular em repouso. A desidratação reduz a volemia e pode diminuir a PA. Vasoconstrição, estresse fisiológico ou hipervolemia podem elevá-la. PA basal aproximada: 110/70 mmHg.',
    dica: '💡 Faixa normal: 90–120/60–80 mmHg. Valores fora dessa faixa indicam desequilíbrio cardiovascular!',
  },
  fc: {
    pergunta: 'Como a Frequência Cardíaca se relaciona com o Débito Cardíaco?',
    resposta: 'O Débito Cardíaco é o produto da FC pelo Volume Sistólico (DC = FC × VS). Na desidratação, o volume sistólico pode cair e a FC aumenta como mecanismo compensatório para manter a perfusão dos tecidos. FC e DC são diretamente proporcionais apenas quando o VS não muda. FC basal aproximada do rato virtual: 360–380 bpm.',
    dica: '💡 Faixa normal: 360–380 bpm. FC elevada pode indicar compensação cardiovascular!',
  },
  peso: {
    pergunta: 'Como o peso corporal influencia os parâmetros cardiovasculares do Phisys?',
    resposta: 'O peso representa a condição corporal geral do rato virtual. Excesso de peso aumenta a demanda metabólica e o esforço cardiovascular. Também eleva a Resistência Vascular Periférica, aumentando a pós-carga cardíaca e consequentemente a Pressão Arterial. Regras fisiológicas: ↑ peso excessivo → ↑ demanda metabólica → ↑ esforço cardiovascular; ↑ peso/adiposidade → ↑ RVP → ↑ PA. Peso saudável aproximado: 200–400g.',
    dica: '💡 Peso normal: 200–400g. Obesidade é fator de risco cardiovascular!',
  },
  saude: {
    pergunta: 'O que determina o índice de Saúde do Phisys?',
    resposta: 'A saúde é calculada automaticamente com base em quantos parâmetros primários estão dentro da faixa normal: hidratação, PAS, PAD e FC. Energia e peso atuam como moduladores do estado geral. Quanto mais parâmetros equilibrados, maior o índice de saúde. Saúde ≥75% = Saudável; 40–74% = Debilitado; <40% = Crítico.',
    dica: '💡 Mantenha todos os parâmetros na faixa normal para máxima saúde!',
  },
  idade: {
    pergunta: 'Como a idade do Phisys influencia seus parâmetros fisiológicos?',
    resposta: 'A idade representa a fase de desenvolvimento do rato virtual. Animais mais velhos apresentam maior vulnerabilidade fisiológica e menor capacidade compensatória. Situações como desidratação, aumento da PA ou queda do débito cardíaco podem causar impacto mais rápido sobre a saúde. Cada fase tem necessidades e faixas fisiológicas próprias.',
    dica: '💡 Acompanhe a evolução do Phisys — cada fase tem suas próprias faixas normais!',
  },
};

function PACard({ pas, pad, paNormal, onClick }) {
  const pasOk = pas >= paNormal.pas[0] && pas <= paNormal.pas[1];
  const padOk = pad >= paNormal.pad[0] && pad <= paNormal.pad[1];
  const inRange = pasOk && padOk;
  const color = inRange ? '#32C878' : '#E24B4A';
  return (
    <div style={{ ...styles.paramCard, cursor:'pointer' }} onClick={() => onClick('pa')}>
      <div style={styles.paramIcon}>❤️</div>
      <div style={{ ...styles.paramVal, fontSize:'11px' }}>{Math.round(pas)}/{Math.round(pad)}</div>
      <div style={styles.paramName}>PA (mmHg)</div>
      <div style={styles.paramBar}>
        <div style={{ ...styles.paramFill, width: Math.min(((pas-60)/(200-60))*100, 100) + '%', background: color }} />
      </div>
    </div>
  );
}

function ParamCard({ param, value, onClick }) {
  const pct = ((value - param.min) / (param.max - param.min)) * 100;
  const inRange = value >= param.normal[0] && value <= param.normal[1];
  const deviation = Math.abs(value - (param.normal[0] + param.normal[1]) / 2) / ((param.normal[1] - param.normal[0]) / 2);
  const color = inRange ? '#32C878' : deviation > 2 ? '#E24B4A' : '#EF9F27';
  const display = param.step < 1 ? value.toFixed(1) : Math.round(value);
  const isHealth = param.id === 'saude';
  return (
    <div style={{ ...styles.paramCard, ...(isHealth ? { background: inRange ? 'rgba(50,200,120,.2)' : 'rgba(220,60,60,.2)', borderColor: color } : {}), cursor:'pointer' }} onClick={() => onClick(param.id)}>
      <div style={styles.paramIcon}>{param.icon}</div>
      <div style={{ ...styles.paramVal, ...(isHealth ? { color } : {}) }}>{display}{param.unit === '%' ? '%' : ''}</div>
      <div style={styles.paramName}>{param.name}</div>
      <div style={styles.paramBar}>
        <div style={{ ...styles.paramFill, width: Math.min(pct, 100) + '%', background: color }} />
      </div>
    </div>
  );
}

function ParamModal({ paramId, onClose }) {
  const [showAnswer, setShowAnswer] = useState(false);
  const info = PARAM_INFO[paramId];
  const param = PRIMARY_PARAMS.find(p => p.id === paramId) || { id:'idade', name:'Idade', unit:'', icon:'🗓️' };
  if (!info) return null;
  const icon = paramId === 'pa' ? '❤️' : param.icon;
  const name = paramId === 'pa' ? 'Pressão Arterial' : param.name;
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.infoCard} onClick={e => e.stopPropagation()}>
        <div style={styles.infoHeader}>
          <span style={styles.infoIcon}>{icon}</span>
          <span style={styles.infoTitle}>{name}</span>
          <button style={styles.infoClose} onClick={onClose}>✕</button>
        </div>
        <div style={styles.infoQuestion}>{info.pergunta}</div>
        {!showAnswer ? (
          <button style={styles.showAnswerBtn} onClick={() => setShowAnswer(true)}>💡 Ver Resposta</button>
        ) : (
          <>
            <div style={styles.infoAnswer}>{info.resposta}</div>
            <div style={styles.infoDica}>{info.dica}</div>
          </>
        )}
        <button style={styles.infoCloseBtn} onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
}

function Mascot({ status, ageDays }) {
  const stage = getGrowthStage(ageDays || 90);
  const bodyColor  = status === STATUS.SAUDAVEL ? '#D4D4D4' : status === STATUS.DEBILITADO ? '#FAC775' : '#F09595';
  const earIn      = status === STATUS.SAUDAVEL ? '#FFD0DC' : status === STATUS.DEBILITADO ? '#F5CC80' : '#FFB0B0';
  const eyeOuter   = status === STATUS.SAUDAVEL ? '#7B2FBE' : status === STATUS.DEBILITADO ? '#633806' : '#791F1F';
  const eyeInner   = status === STATUS.SAUDAVEL ? '#3A1A6A' : status === STATUS.DEBILITADO ? '#3A1A00' : '#3A0000';
  const cheek      = status === STATUS.SAUDAVEL ? '#FFB0C8' : status === STATUS.DEBILITADO ? '#F5CC80' : '#FFB0B0';
  const statusColor= status === STATUS.SAUDAVEL ? '#32C878' : status === STATUS.DEBILITADO ? '#EF9F27' : '#E24B4A';
  const emoji      = status === STATUS.SAUDAVEL ? '😊 Saudável' : status === STATUS.DEBILITADO ? '😰 Debilitado' : '😵 Crítico';
  const mouth = status === STATUS.SAUDAVEL
    ? <path d="M188 184 Q200 196 212 184" stroke="#666" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    : status === STATUS.DEBILITADO
    ? <path d="M188 188 Q200 188 212 188" stroke="#888" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    : <path d="M188 192 Q200 182 212 192" stroke="#AA4444" strokeWidth="2.5" fill="none" strokeLinecap="round"/>;
  const eyeL = status === STATUS.CRITICO
    ? <><ellipse cx="168" cy="152" rx="22" ry="22" fill="white"/><line x1="158" y1="142" x2="178" y2="162" stroke={eyeOuter} strokeWidth="4" strokeLinecap="round"/><line x1="178" y1="142" x2="158" y2="162" stroke={eyeOuter} strokeWidth="4" strokeLinecap="round"/></>
    : status === STATUS.DEBILITADO
    ? <><ellipse cx="168" cy="152" rx="22" ry="22" fill="white"/><ellipse cx="168" cy="156" rx="16" ry="10" fill={eyeOuter}/><ellipse cx="168" cy="156" rx="8" ry="5" fill={eyeInner}/><path d="M148 148 Q168 138 188 148" stroke="#999" strokeWidth="2" fill="none"/><ellipse cx="176" cy="150" rx="5" ry="3" fill="white" opacity=".8"/></>
    : <><ellipse cx="168" cy="152" rx="22" ry="26" fill="white"/><ellipse cx="168" cy="155" rx="16" ry="20" fill={eyeOuter}/><ellipse cx="168" cy="155" rx="8" ry="10" fill={eyeInner}/><ellipse cx="176" cy="144" rx="6" ry="7" fill="white" opacity=".9"/><ellipse cx="162" cy="160" rx="3" ry="3.5" fill="white" opacity=".5"/></>;
  const eyeR = status === STATUS.CRITICO
    ? <><ellipse cx="232" cy="152" rx="22" ry="22" fill="white"/><line x1="222" y1="142" x2="242" y2="162" stroke={eyeOuter} strokeWidth="4" strokeLinecap="round"/><line x1="242" y1="142" x2="222" y2="162" stroke={eyeOuter} strokeWidth="4" strokeLinecap="round"/></>
    : status === STATUS.DEBILITADO
    ? <><ellipse cx="232" cy="152" rx="22" ry="22" fill="white"/><ellipse cx="232" cy="156" rx="16" ry="10" fill={eyeOuter}/><ellipse cx="232" cy="156" rx="8" ry="5" fill={eyeInner}/><path d="M212 148 Q232 138 252 148" stroke="#999" strokeWidth="2" fill="none"/><ellipse cx="240" cy="150" rx="5" ry="3" fill="white" opacity=".8"/></>
    : <><ellipse cx="232" cy="152" rx="22" ry="26" fill="white"/><ellipse cx="232" cy="155" rx="16" ry="20" fill={eyeOuter}/><ellipse cx="232" cy="155" rx="8" ry="10" fill={eyeInner}/><ellipse cx="240" cy="144" rx="6" ry="7" fill="white" opacity=".9"/><ellipse cx="226" cy="160" rx="3" ry="3.5" fill="white" opacity=".5"/></>;
  const isFilhote = stage.id === 'RECEM_NASCIDO';
  const isJuvenil = stage.id === 'JUVENIL';
  const svgSize   = isFilhote ? 110 : isJuvenil ? 150 : 180;
  return (
    <div style={styles.animalBg}>
      <div style={styles.animalLabel}>Mantenha o Phisys em homeostase! 🐭</div>
      <div style={{ ...styles.animalStatus, color: statusColor }}>{emoji}</div>
      <div style={{ ...styles.stageBadge }}>{stage.icon} {stage.label}</div>
      <svg viewBox="0 0 400 380" style={{ width:`${svgSize}px`, height:`${svgSize}px`, marginTop:20 }}>
        {!isFilhote && (<path d="M188 350 Q162 358 148 340 Q136 322 144 308 Q152 295 164 305" stroke="#C8C8C8" strokeWidth="7" fill="none" strokeLinecap="round"/>)}
        <ellipse cx="166" cy="335" rx="22" ry="13" fill={bodyColor}/>
        <ellipse cx="234" cy="335" rx="22" ry="13" fill={bodyColor}/>
        <ellipse cx="200" cy="285" rx="82" ry="78" fill={bodyColor}/>
        <ellipse cx="200" cy="295" rx="48" ry="50" fill="white" opacity=".2"/>
        {!isFilhote && (<><ellipse cx="118" cy="268" rx="22" ry="15" fill={bodyColor} transform="rotate(-20,118,268)"/><ellipse cx="282" cy="268" rx="22" ry="15" fill={bodyColor} transform="rotate(20,282,268)"/></>)}
        {isFilhote ? (<><ellipse cx="130" cy="145" rx="28" ry="34" fill={bodyColor}/><ellipse cx="130" cy="145" rx="17" ry="23" fill={earIn}/><ellipse cx="270" cy="145" rx="28" ry="34" fill={bodyColor}/><ellipse cx="270" cy="145" rx="17" ry="23" fill={earIn}/></>) : (<><ellipse cx="110" cy="135" rx="38" ry="48" fill={bodyColor}/><ellipse cx="110" cy="135" rx="24" ry="34" fill={earIn}/><ellipse cx="290" cy="135" rx="38" ry="48" fill={bodyColor}/><ellipse cx="290" cy="135" rx="24" ry="34" fill={earIn}/></>)}
        <ellipse cx="200" cy="158" rx={isFilhote ? 90 : 82} ry={isFilhote ? 86 : 78} fill={bodyColor}/>
        <ellipse cx="136" cy="170" rx="20" ry="14" fill={cheek} opacity=".6"/>
        <ellipse cx="264" cy="170" rx="20" ry="14" fill={cheek} opacity=".6"/>
        {isFilhote ? (<><ellipse cx="168" cy="150" rx="26" ry="30" fill="white"/><ellipse cx="168" cy="153" rx="19" ry="23" fill={eyeOuter}/><ellipse cx="168" cy="153" rx="9" ry="11" fill={eyeInner}/><ellipse cx="178" cy="141" rx="7" ry="8" fill="white" opacity=".9"/><ellipse cx="232" cy="150" rx="26" ry="30" fill="white"/><ellipse cx="232" cy="153" rx="19" ry="23" fill={eyeOuter}/><ellipse cx="232" cy="153" rx="9" ry="11" fill={eyeInner}/><ellipse cx="242" cy="141" rx="7" ry="8" fill="white" opacity=".9"/></>) : (<>{eyeL}{eyeR}</>)}
        <ellipse cx="200" cy="175" rx="8" ry="6" fill="#FF8FAA"/>
        {mouth}
        {!isFilhote && !isJuvenil && (<><line x1="170" y1="178" x2="120" y2="168" stroke="rgba(255,255,255,.4)" strokeWidth="1.5" strokeLinecap="round"/><line x1="170" y1="183" x2="118" y2="183" stroke="rgba(255,255,255,.4)" strokeWidth="1.5" strokeLinecap="round"/><line x1="230" y1="178" x2="280" y2="168" stroke="rgba(255,255,255,.4)" strokeWidth="1.5" strokeLinecap="round"/><line x1="230" y1="183" x2="282" y2="183" stroke="rgba(255,255,255,.4)" strokeWidth="1.5" strokeLinecap="round"/></>)}
        {status !== STATUS.SAUDAVEL && (<ellipse cx="290" cy="120" rx="7" ry="11" fill="#85B7EB" opacity=".8"/>)}
        {status === STATUS.SAUDAVEL && (<><text x="316" y="100" fontSize="18" fill="white" opacity=".9">✦</text><text x="72" y="112" fontSize="12" fill="white" opacity=".8">✦</text></>)}
      </svg>
    </div>
  );
}

// Formata o tempo restante ate liberar (ex: "1h 23min") a partir de um ISO string
function formatarTempoRestante(liberaEmISO) {
  const liberaEm = new Date(liberaEmISO);
  const agora = new Date();
  const diffMs = liberaEm - agora;
  if (diffMs <= 0) return null;
  const horas = Math.floor(diffMs / (1000 * 60 * 60));
  const minutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (horas > 0) return `${horas}h ${minutos}min`;
  return `${minutos}min`;
}

function HomeScreen({ user, values, setValues, score, onSelectMode, onLogout, onViewRanking, onViewPanel, onViewSecondary, ageDays, onCare }) {
  // cuidadoStatus vem do backend (fonte de verdade real) em vez de um useState
  // local vazio - isso corrige o bug em que um F5 "esquecia" que o cuidado ja
  // tinha sido usado, permitindo repeticao ilimitada.
  const [cuidadoStatus, setCuidadoStatus] = useState({});
  const [showModes, setShowModes] = useState(false);
  const [activeParam, setActiveParam] = useState(null);
  const [miniRanking, setMiniRanking] = useState([]);
  const [careEffect, setCareEffect] = useState(null);
  const [careError, setCareError] = useState(null);
  const [pendingCares, setPendingCares] = useState({});
  const [, forceTick] = useState(0);

  const fetchCuidadoStatus = useCallback(() => {
    animalApi.cuidadoStatus().then(setCuidadoStatus).catch(() => {});
  }, []);

  useEffect(() => {
    rankingApi.get().then(data => setMiniRanking(Array.isArray(data) ? data.slice(0, 3) : [])).catch(() => {});
  }, []);

  useEffect(() => {
    fetchCuidadoStatus();
  }, [fetchCuidadoStatus]);

  useEffect(() => {
    // Verifica simulacao ativa a cada 30 segundos, e tambem reavalia o status
    // dos cuidados (ex: cooldown que acabou de expirar, ou nova sessao ativada)
    const checkSim = () => {
      animalApi.get().then(a => {
        const fc = Number(a.fc) < 100 ? 370 : Number(a.fc);
        setValues(prev => ({
          ...prev,
          energia:    Number(a.energia),
          hidratacao: Number(a.hidratacao),
          pas:        Number(a.pas),
          pad:        Number(a.pad),
          fc,
          peso:       Number(a.peso),
        }));
      }).catch(() => {});
      fetchCuidadoStatus();
    };
    const interval = setInterval(checkSim, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchCuidadoStatus]);

  useEffect(() => {
    // Re-renderiza a cada minuto para atualizar o texto de "tempo restante"
    // dos cuidados bloqueados por cooldown, sem precisar de nova chamada ao servidor
    const interval = setInterval(() => forceTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const saude = calcularSaude(values);
  const status = getMascotStatus(values);
  const energiaModulada = calcularEnergiaModulada(values, saude);
  const valsWithSaude = { ...values, saude, energia: energiaModulada };
  const line1 = PRIMARY_PARAMS.filter(p => ['energia','hidratacao','fc'].includes(p.id));
  const line2 = PRIMARY_PARAMS.filter(p => ['peso','saude'].includes(p.id));
  const currentAge = ageDays || 90;
  const stage = getGrowthStage(currentAge);
  const idadeParam = { id:'idade', name:`Idade · ${stage.label}`, unit:'', min:0, max:730, normal:[0,730], default:currentAge, step:1, icon:stage.icon };

  async function handleCare(id) {
    const statusDoCuidado = cuidadoStatus[id];
    if (statusDoCuidado && statusDoCuidado.disponivel === false) return;
    if (pendingCares[id]) return; // trava cliques repetidos enquanto a chamada anterior ainda nao respondeu

    // Trava o card visualmente na hora do clique, antes mesmo da resposta do
    // servidor chegar - evita a impressao de "cliquei e nao aconteceu nada"
    // quando o usuario clica varias vezes rapido.
    setPendingCares(prev => ({ ...prev, [id]: true }));

    const newValues = aplicarCuidado(values, id);

    try {
      await animalApi.cuidado(id);
    } catch (e) {
      // 429 = bloqueado (cooldown ou limite de sessao atingido). Recarrega o
      // status real do servidor para refletir o bloqueio na tela corretamente.
      setCareError(id);
      setTimeout(() => setCareError(null), 2000);
      fetchCuidadoStatus();
      setPendingCares(prev => ({ ...prev, [id]: false }));
      return;
    }

    setValues(newValues);
    setCareEffect(id);
    setTimeout(() => setCareEffect(null), 1500);
    fetchCuidadoStatus();
    setPendingCares(prev => ({ ...prev, [id]: false }));

    try {
      await animalApi.update({
        energia: newValues.energia, hidratacao: newValues.hidratacao,
        pas: newValues.pas, pad: newValues.pad, fc: newValues.fc, peso: newValues.peso,
      });
    } catch(e) { console.log('Erro:', e.message); }
    try {
      const newScore = (score || 100) + 5;
      await rankingApi.update({ xp_total: newScore, media_saude: calcularSaude({ ...newValues, age_days: ageDays || 90 }) });
      if (onCare) onCare(id, newValues);
    } catch(e) {}
  }

  return (
    <div style={styles.screen}>
      {activeParam && (<ParamModal paramId={activeParam} onClose={() => setActiveParam(null)}/>)}
      {showModes && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalTitle}>Escolha o Modo de Jogo</div>
            <div style={styles.modeBtn} onClick={() => { setShowModes(false); onSelectMode('livre'); }}>
              <div style={styles.modeBtnIcon}>🎯</div>
              <div style={styles.modeBtnTitle}>Modo Livre</div>
              <div style={styles.modeBtnDesc}>Quiz individual. Quantidade de perguntas limitada pela energia do animal.</div>
            </div>
            <div style={styles.modeBtn} onClick={() => { setShowModes(false); onSelectMode('sessao'); }}>
              <div style={styles.modeBtnIcon}>📋</div>
              <div style={styles.modeBtnTitle}>Modo Sessão</div>
              <div style={styles.modeBtnDesc}>Desafios criados pelo professor sobre um tema específico.</div>
            </div>
            <button style={styles.modalCancel} onClick={() => setShowModes(false)}>Cancelar</button>
          </div>
        </div>
      )}
      <div style={styles.topbar}>
        <div>
          <div style={styles.userName}>{user.name.split(' ')[0]} 👋</div>
          <div style={styles.userSub}>Modelo Experimental</div>
        </div>
        <div style={styles.xpBadge}>⚡ {Math.round(score)} XP</div>
      </div>
      <div style={styles.paramsGrid}>
        {line1.map(p => <ParamCard key={p.id} param={p} value={valsWithSaude[p.id] ?? p.default} onClick={setActiveParam}/>)}
       <PACard pas={valsWithSaude.pas ?? 110} pad={valsWithSaude.pad ?? 70} paNormal={getAgePANormal(currentAge)} onClick={setActiveParam}/>
      </div>
      <div style={styles.paramsGridBottom}>
        {line2.map(p => <ParamCard key={p.id} param={p} value={valsWithSaude[p.id] ?? p.default} onClick={setActiveParam}/>)}
        <ParamCard param={idadeParam} value={currentAge} onClick={setActiveParam}/>
      </div>
      <div style={styles.animalArea}><Mascot status={status} ageDays={currentAge}/></div>
      <div style={styles.actionBtns}>
        <div style={styles.actionBtn} onClick={onViewSecondary}><span style={styles.actionBtnIcon}>📊</span><span style={styles.actionBtnLabel}>Parâm. Secundários</span></div>
        <div style={styles.actionBtn} onClick={() => setShowModes(true)}><span style={styles.actionBtnIcon}>🎮</span><span style={styles.actionBtnLabel}>Opções de Jogo</span></div>
        <div style={styles.actionBtn} onClick={onViewRanking}><span style={styles.actionBtnIcon}>🏆</span><span style={styles.actionBtnLabel}>Ranking</span></div>
      </div>
      <div style={styles.caresLabel}>cuidados diários</div>
      <div style={styles.cares}>
        {Object.values(DAILY_CARES).map(c => {
          const st = cuidadoStatus[c.id];
          const bloqueado = (st && st.disponivel === false) || pendingCares[c.id];
          let desc = c.label;
          if (bloqueado) {
            if (st.modo === 'sessao') {
              desc = `Limite atingido (${st.usados}/${st.limite})`;
            } else {
              const restante = formatarTempoRestante(st.liberaEm);
              desc = restante ? `Libera em ${restante}` : c.label;
            }
          }
          return (
            <div
              key={c.id}
              style={{
                ...styles.careCard,
                ...(bloqueado ? styles.careBlocked : {}),
                position:'relative',
                cursor: bloqueado ? 'not-allowed' : 'pointer',
                opacity: bloqueado ? 0.55 : 1,
              }}
              onClick={() => handleCare(c.id)}
            >
              <div style={styles.careIcon}>{c.icon}</div>
              <div style={styles.careName}>{c.label.split(' ')[0]}</div>
              <div style={styles.careDesc}>{desc}</div>
              {careEffect === c.id && (
                <div style={{ position:'absolute', top:'-10px', right:'4px', fontSize:'11px', fontWeight:'700', color:'#FFD700', animation:'fadeUp 1.5s ease-out', pointerEvents:'none' }}>+5 XP ⚡</div>
              )}
              {careError === c.id && (
                <div style={{ position:'absolute', top:'-10px', right:'4px', fontSize:'10px', fontWeight:'700', color:'#E24B4A', pointerEvents:'none' }}>Indisponível</div>
              )}
            </div>
          );
        })}
      </div>
      {miniRanking.length > 0 && (
        <div style={{ margin:'0 1rem .5rem', background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.18)', borderRadius:'14px', padding:'.75rem' }}>
          <div style={{ fontSize:'10px', color:'rgba(255,255,255,.6)', letterSpacing:'.08em', textTransform:'uppercase', marginBottom:'8px' }}>🏆 ranking</div>
          {miniRanking.map((r, i) => {
            const isMe = r.nome === user.name;
            return (
              <div key={r.id} style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px', background: isMe ? 'rgba(255,255,255,.15)' : 'transparent', borderRadius:'8px', padding: isMe ? '4px 6px' : '0' }}>
                <div style={{ fontSize:'12px', fontWeight:'700', color: i===0?'#FFD700':i===1?'#C0C0C0':'#CD7F32', width:'16px' }}>{i+1}</div>
                <div style={{ flex:1, fontSize:'12px', color:'white', fontWeight: isMe ? '700' : '400' }}>{r.nome?.split(' ')[0]} {isMe ? '👤' : ''}</div>
                <div style={{ fontSize:'11px', color:'rgba(255,255,255,.7)', fontWeight:'600' }}>⚡{r.xp_total}</div>
              </div>
            );
          })}
        </div>
      )}
      <div style={styles.footer}>
        {user.mode === 'professor' && (<button style={styles.panelBtn} onClick={onViewPanel}>Painel do Professor</button>)}
        <button style={styles.logoutBtn} onClick={onLogout}>sair da conta</button>
      </div>
    </div>
  );
}

const styles = {
  screen:           { width:'100%', maxWidth:'400px', minHeight:'100vh', display:'flex', flexDirection:'column', background:GRADIENT, margin:'0 auto', paddingBottom:'1rem', overflowX:'hidden' },
  topbar:           { padding:'1rem 1rem .5rem', display:'flex', justifyContent:'space-between', alignItems:'center' },
  userName:         { fontSize:'16px', fontWeight:'700', color:'white' },
  userSub:          { fontSize:'11px', color:'rgba(255,255,255,.6)' },
  xpBadge:          { background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.3)', borderRadius:'20px', padding:'4px 12px', fontSize:'12px', color:'white', fontWeight:'600' },
  paramsGrid:       { padding:'.25rem 1rem', display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'5px' },
  paramsGridBottom: { padding:'0 1rem .25rem', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'5px' },
  paramCard:        { background:'rgba(255,255,255,.12)', border:'1px solid rgba(255,255,255,.2)', borderRadius:'10px', padding:'6px 4px', display:'flex', flexDirection:'column', alignItems:'center', gap:'3px' },
  paramIcon:        { fontSize:'14px' },
  paramVal:         { fontSize:'12px', fontWeight:'700', color:'white' },
  paramName:        { fontSize:'8px', color:'rgba(255,255,255,.6)', textAlign:'center', letterSpacing:'.03em' },
  paramBar:         { width:'100%', height:'3px', background:'rgba(255,255,255,.15)', borderRadius:'2px', overflow:'hidden' },
  paramFill:        { height:'100%', borderRadius:'2px' },
  animalArea:       { margin:'0 1rem .25rem' },
  animalBg:         { background:'rgba(255,255,255,.08)', borderRadius:'20px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', border:'1px solid rgba(255,255,255,.15)', position:'relative', padding:'8px', minHeight:'220px', overflow:'hidden' },
  animalLabel: { position:'absolute', top:'8px', left:'10px', fontSize:'10px', color:'rgba(255,255,255,.5)', letterSpacing:'.04em', maxWidth:'55%' },
  animalStatus:     { position:'absolute', top:'8px', right:'10px', fontSize:'12px', fontWeight:'600' },
  stageBadge:       { position:'absolute', bottom:'8px', left:'50%', transform:'translateX(-50%)', background:'rgba(255,255,255,.15)', borderRadius:'20px', padding:'3px 10px', fontSize:'10px', color:'rgba(255,255,255,.8)', whiteSpace:'nowrap' },
  actionBtns:       { margin:'0 1rem .5rem', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'7px' },
  actionBtn:        { background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.25)', borderRadius:'12px', padding:'10px 6px', display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', cursor:'pointer' },
  actionBtnIcon:    { fontSize:'18px' },
  actionBtnLabel:   { fontSize:'9px', color:'white', fontWeight:'600', textAlign:'center' },
  caresLabel:       { padding:'.25rem 1rem', fontSize:'10px', color:'rgba(255,255,255,.6)', letterSpacing:'.08em', textTransform:'uppercase' },
  cares:            { margin:'0 1rem .5rem', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'7px' },
  careCard:         { background:'rgba(255,255,255,.14)', border:'1px solid rgba(255,255,255,.25)', borderRadius:'12px', padding:'.625rem .5rem', display:'flex', flexDirection:'column', alignItems:'center', gap:'3px', cursor:'pointer' },
  careBlocked:      { background:'rgba(255,255,255,.06)', borderColor:'rgba(255,255,255,.12)' },
  careIcon:         { fontSize:'20px' },
  careName:         { fontSize:'11px', fontWeight:'600', color:'white', textAlign:'center' },
  careDesc:         { fontSize:'9px', color:'rgba(255,255,255,.55)', textAlign:'center' },
  footer:           { padding:'.5rem 1rem 0', display:'flex', flexDirection:'column', alignItems:'center', gap:'6px' },
  panelBtn:         { width:'100%', padding:'10px', borderRadius:'10px', border:'none', background:'white', color:'#7B2FBE', fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' },
  logoutBtn:        { fontSize:'11px', color:'rgba(255,255,255,.4)', cursor:'pointer', background:'none', border:'none', fontFamily:'inherit' },
  modalOverlay:     { position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 },
  modalCard:        { background:'linear-gradient(160deg,#1B4FCC,#7B2FBE,#CC1B1B)', borderRadius:'20px', padding:'1.5rem', width:'90%', maxWidth:'340px', display:'flex', flexDirection:'column', gap:'12px' },
  modalTitle:       { fontSize:'16px', fontWeight:'700', color:'white', textAlign:'center', marginBottom:'4px' },
  modeBtn:          { background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.3)', borderRadius:'14px', padding:'1rem', cursor:'pointer' },
  modeBtnIcon:      { fontSize:'24px', marginBottom:'4px' },
  modeBtnTitle:     { fontSize:'14px', fontWeight:'700', color:'white', marginBottom:'4px' },
  modeBtnDesc:      { fontSize:'11px', color:'rgba(255,255,255,.75)', lineHeight:'1.4' },
  modalCancel:      { background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.2)', borderRadius:'20px', padding:'8px', color:'rgba(255,255,255,.7)', fontSize:'12px', cursor:'pointer', fontFamily:'inherit' },
  infoCard:         { background:'linear-gradient(160deg,#1B4FCC,#7B2FBE,#CC1B1B)', borderRadius:'20px', padding:'1.5rem', width:'90%', maxWidth:'340px', display:'flex', flexDirection:'column', gap:'12px' },
  infoHeader:       { display:'flex', alignItems:'center', gap:'10px' },
  infoIcon:         { fontSize:'24px' },
  infoTitle:        { flex:1, fontSize:'16px', fontWeight:'700', color:'white' },
  infoClose:        { background:'none', border:'none', color:'rgba(255,255,255,.6)', fontSize:'18px', cursor:'pointer', fontFamily:'inherit' },
  infoQuestion:     { background:'rgba(255,255,255,.15)', borderRadius:'12px', padding:'1rem', fontSize:'13px', color:'white', fontWeight:'600', lineHeight:'1.5' },
  showAnswerBtn:    { background:'white', border:'none', borderRadius:'20px', padding:'10px', color:'#7B2FBE', fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' },
  infoAnswer:       { background:'rgba(255,255,255,.1)', borderRadius:'12px', padding:'1rem', fontSize:'12px', color:'rgba(255,255,255,.9)', lineHeight:'1.6' },
  infoDica:         { background:'rgba(50,200,120,.2)', border:'1px solid rgba(50,200,120,.4)', borderRadius:'10px', padding:'.75rem', fontSize:'11px', color:'white', lineHeight:'1.4' },
  infoCloseBtn:     { background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.2)', borderRadius:'20px', padding:'8px', color:'rgba(255,255,255,.7)', fontSize:'12px', cursor:'pointer', fontFamily:'inherit' },
};

const styleTag = document.createElement('style');
styleTag.innerHTML = `@keyframes fadeUp { 0% { opacity:1; transform:translateY(0); } 100% { opacity:0; transform:translateY(-20px); } }`;
document.head.appendChild(styleTag);

export default HomeScreen;