import React, { useState, useEffect, useCallback, useRef } from 'react';
import { animal as animalApi, simulacoes as simulacoesApi } from '../api';
import { PRIMARY_PARAMS, calcularSaude, calcularEnergiaModulada, getAgePANormal, getAgeStage, getMascotStatus, STATUS, DAILY_CARES } from '../engine/mascotEngine';
import { COLORS, FONT_FAMILY, SHADOW_CARD, FONT_SCALE } from '../theme';
import { MASCOT_IMAGES } from '../assets/mascote';

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

// ─── ÍCONES (substituem os emojis usados antes nos cards/badges) ──────────
const ICON_COLOR = {
  energia: COLORS.indigo,
  hidratacao: COLORS.blue,
  fc: COLORS.coral,
  pa: COLORS.indigo,
  peso: COLORS.indigo,
  idade: COLORS.indigo,
};

function Icon({ name, size = 20, color }) {
  const c = color || '#000';
  switch (name) {
    case 'energia':
      return <svg width={size} height={size} viewBox="0 0 20 20" fill={c}><path d="M11 1.5 3.5 12h5.7l-1 6.5L16.5 8h-5.7z"/></svg>;
    case 'hidratacao':
      return <svg width={size} height={size} viewBox="0 0 20 20" fill={c}><path d="M10 2s6 7.5 6 11.5a6 6 0 1 1-12 0C4 9.5 10 2 10 2Z"/></svg>;
    case 'fc':
      return (
        <svg width={size} height={size} viewBox="0 0 20 20">
          <path fill={c} d="M10 17S2 12 2 6.9A3.9 3.9 0 0 1 10 5a3.9 3.9 0 0 1 8 1.9C18 12 10 17 10 17Z"/>
          <path d="M3.3 10.5h2.4l1.3-2.3 1.6 4 1.3-5.4 1.1 3.7h4" stroke="white" strokeWidth="1.1" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case 'pa':
      return <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="14.5" cy="13.5" r="2.5"/><path d="M4 3v6a4 4 0 0 0 8 0V3"/><path d="M6 3H2M10 3H6"/></svg>;
    case 'peso':
      return <svg width={size} height={size} viewBox="0 0 20 20" fill={c}><rect x="2" y="9" width="16" height="8" rx="2.5"/><rect x="7.5" y="4" width="5" height="5" rx="1.2"/></svg>;
    case 'idade':
      return <svg width={size} height={size} viewBox="0 0 20 20" fill={c}><rect x="2" y="4" width="16" height="14" rx="2"/><path d="M2 8h16v-1H2z"/><rect x="5.5" y="2" width="2" height="4" rx="1"/><rect x="12.5" y="2" width="2" height="4" rx="1"/></svg>;
    case 'saude':
      return <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2 3 4.5v5c0 5 3 7.7 7 8.5 4-.8 7-3.5 7-8.5v-5Z"/><path d="M7 10l2 2 4-4"/></svg>;
    case 'custom':
      return <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 15V9M8 15V5M13 15v-7M18 15v-3"/></svg>;
    case 'careAgua':
      return <svg width={size} height={size} viewBox="0 0 20 20"><path fill={c} d="M10 2s6 7.5 6 11.5a6 6 0 1 1-12 0C4 9.5 10 2 10 2Z"/><ellipse cx="8" cy="10.5" rx="1.4" ry="2" fill="white" opacity=".55"/></svg>;
    case 'careComida':
      return (
        <svg width={size} height={size} viewBox="0 0 20 20">
          <path fill="#3A9E96" d="M4 8.3a6 6 0 0 1 12 0Z"/>
          <ellipse cx="10" cy="8.3" rx="6" ry="1.6" fill="#4CB4AB"/>
          <path fill={c} d="M4.6 9c.7 1.2 3 1.5 5.4 1.5s4.7-.3 5.4-1.5H4.6Z"/>
        </svg>
      );
    case 'careLimpeza':
      return <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2v4M6 4.5l2 3M14 4.5l-2 3"/><path d="M10 10v8M6 14l4-4 4 4"/></svg>;
    case 'section-vitals':
      return <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 10.5h3l2-6 3 12 2-9 1.5 3H18"/></svg>;
    case 'section-cares':
      return <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="12" height="15" rx="2"/><rect x="7" y="1.5" width="6" height="3" rx="1"/><path d="M7 9h6M7 12.5h6M7 16h3.5"/></svg>;
    case 'navHome':
      return <svg width={size} height={size} viewBox="0 0 20 20" fill={c}><path d="M10 2.5 2.5 9v8.5h5V13h5v4.5h5V9Z"/></svg>;
    case 'navParams':
      return <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"><path d="M3 5h14M3 10h14M3 15h14"/><circle cx="7" cy="5" r="1.6" fill={c} stroke="none"/><circle cx="13" cy="10" r="1.6" fill={c} stroke="none"/><circle cx="8" cy="15" r="1.6" fill={c} stroke="none"/></svg>;
    case 'navPlay':
      return <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6.5" width="16" height="8" rx="4"/><path d="M7 8.5v4M5 10.5h4"/><circle cx="14" cy="9" r=".9" fill={c} stroke="none"/><circle cx="15.5" cy="11.5" r=".9" fill={c} stroke="none"/></svg>;
    case 'navRanking':
      return <svg width={size} height={size} viewBox="0 0 20 20" fill={c}><path d="M5 3h10v3a5 5 0 0 1-10 0Z"/><path d="M5 4.5H2.3v1A3 3 0 0 0 5 8.4M15 4.5h2.7v1A3 3 0 0 1 15 8.4" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round"/><rect x="9" y="12" width="2" height="3.5"/><rect x="6.5" y="15.5" width="7" height="1.8" rx=".9"/></svg>;
    case 'cap':
      return <svg width={size} height={size} viewBox="0 0 20 20" fill={c}><path d="M10 2 1 6.5 10 11l7.5-3.8V12h1.5V6.5Z"/><path d="M4.5 8.7v3.6c0 1.6 2.5 3 5.5 3s5.5-1.4 5.5-3V8.7L10 12.3Z" fill={c}/></svg>;
    case 'chevronRight':
      return <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4l6 6-6 6"/></svg>;
    case 'star':
      return <svg width={size} height={size} viewBox="0 0 20 20" fill={c}><path d="M10 1.5 12.3 7l6 .6-4.5 3.9 1.4 5.9L10 14.2 4.8 17.4l1.4-5.9L1.7 7.6l6-.6Z"/></svg>;
    default:
      return null;
  }
}

const CARE_ICON = { hidratacao: 'careAgua', racao: 'careComida', maravalha: 'careLimpeza' };
const CARE_THEME = { hidratacao: COLORS.care.agua, racao: COLORS.care.comida, maravalha: COLORS.care.limpeza };

function statusColors(status) {
  if (status === STATUS.SAUDAVEL)   return COLORS.status.saudavel;
  if (status === STATUS.DEBILITADO) return COLORS.status.debilitado;
  return COLORS.status.critico;
}

function PACard({ pas, pad, paNormal, onClick }) {
  const pasOk = pas >= paNormal.pas[0] && pas <= paNormal.pas[1];
  const padOk = pad >= paNormal.pad[0] && pad <= paNormal.pad[1];
  const inRange = pasOk && padOk;
  const color = inRange ? COLORS.status.saudavel.color : COLORS.status.critico.color;
  return (
    <div style={styles.indicatorCard} onClick={() => onClick('pa')}>
      <div style={styles.indicatorTop}>
        <div style={styles.indicatorIcon}><Icon name="pa" size={20} color={ICON_COLOR.pa}/></div>
        <div style={styles.indicatorText}>
          <div style={styles.indicatorLabel}>Pressão arterial</div>
          <div style={styles.indicatorValue}>{Math.round(pas)}/{Math.round(pad)} mmHg</div>
        </div>
      </div>
      <div style={styles.indicatorBarTrack}>
        <div style={{ ...styles.indicatorBarFill, width: Math.min(((pas-60)/(200-60))*100, 100) + '%', background: color }}/>
      </div>
    </div>
  );
}

function ParamCard({ param, value, onClick, normalOverride }) {
  // normalOverride permite que a faixa "normal" usada para decidir a cor do
  // card seja a faixa correta da FASE ATUAL do animal (ex: Peso Juvenil =
  // 50-200g), em vez de sempre usar param.normal, que e um valor FIXO vindo
  // de PRIMARY_PARAMS (a faixa do Adulto). Antes disso, um animal Juvenil com
  // peso de 300g (fora da faixa Juvenil) aparecia com o card em VERDE, porque
  // 300g esta dentro da faixa fixa do Adulto (200-400g) - mesmo a saude ja
  // estando penalizada corretamente por tras (calcularSaude ja usava a faixa
  // certa). Isso corrige a divergencia entre "o que o card mostra" e "o que
  // a saude realmente considera".
  const normal = normalOverride || param.normal;
  const pct = ((value - param.min) / (param.max - param.min)) * 100;
  const inRange = value >= normal[0] && value <= normal[1];
  const deviation = Math.abs(value - (normal[0] + normal[1]) / 2) / ((normal[1] - normal[0]) / 2);
  const color = inRange ? COLORS.status.saudavel.color : deviation > 2 ? COLORS.status.critico.color : COLORS.status.debilitado.color;
  const display = param.step < 1 ? value.toFixed(1) : Math.round(value);
  const unit = param.unit === '%' ? '%' : param.unit === 'bpm' ? ' bpm' : param.unit === 'g' ? ' g' : param.id === 'idade' ? ' dias' : '';
  return (
    <div style={styles.indicatorCard} onClick={() => onClick(param.id)}>
      <div style={styles.indicatorTop}>
        <div style={styles.indicatorIcon}><Icon name={param.id} size={20} color={ICON_COLOR[param.id] || COLORS.indigo}/></div>
        <div style={styles.indicatorText}>
          <div style={styles.indicatorLabel}>{param.name}</div>
          <div style={styles.indicatorValue}>{display}{unit}</div>
        </div>
      </div>
      <div style={styles.indicatorBarTrack}>
        <div style={{ ...styles.indicatorBarFill, width: Math.min(pct, 100) + '%', background: color }}/>
      </div>
    </div>
  );
}

// Parametro fisiologico customizado (pedido da Marcia, 17/08/2026): so exibicao,
// nao clicavel (sem modal educativo como os PRIMARY_PARAMS) e nunca alimenta
// calcularSaude - o valor vem direto de GET /api/simulacoes/ativa.
function CustomParamCard({ nome, unidade, valor, valorMin, valorMax }) {
  const inRange = valor >= valorMin && valor <= valorMax;
  const color = inRange ? COLORS.status.saudavel.color : COLORS.status.critico.color;
  const pct = valorMax > valorMin ? ((valor - valorMin) / (valorMax - valorMin)) * 100 : 0;
  return (
    <div style={styles.indicatorCard}>
      <div style={styles.indicatorTop}>
        <div style={styles.indicatorIcon}><Icon name="custom" size={18} color={COLORS.indigo}/></div>
        <div style={styles.indicatorText}>
          <div style={styles.indicatorLabel}>{nome}</div>
          <div style={styles.indicatorValue}>{valor}{unidade ? ` ${unidade}` : ''}</div>
        </div>
      </div>
      <div style={styles.indicatorBarTrack}>
        <div style={{ ...styles.indicatorBarFill, width: Math.min(Math.max(pct, 0), 100) + '%', background: color }}/>
      </div>
    </div>
  );
}

function ParamModal({ paramId, onClose }) {
  const [showAnswer, setShowAnswer] = useState(false);
  const info = PARAM_INFO[paramId];
  const param = PRIMARY_PARAMS.find(p => p.id === paramId) || { id:'idade', name:'Idade', unit:'' };
  if (!info) return null;
  const iconName = paramId === 'pa' ? 'pa' : paramId;
  const name = paramId === 'pa' ? 'Pressão Arterial' : param.name;
  const iconColor = paramId === 'saude' ? COLORS.accent : (ICON_COLOR[paramId] || COLORS.indigo);
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.infoCard} onClick={e => e.stopPropagation()}>
        <div style={styles.infoHeader}>
          <span style={styles.infoIconChip}><Icon name={iconName} size={18} color={iconColor}/></span>
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

function HomeostaseRing({ pct }) {
  const r = 53, c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = c * (1 - clamped / 100);
  const sc = statusColors(clamped >= 75 ? STATUS.SAUDAVEL : clamped >= 40 ? STATUS.DEBILITADO : STATUS.CRITICO);
  return (
    <div style={styles.ringWrap}>
      <svg width="128" height="128" viewBox="0 0 128 128" style={{ transform:'rotate(-90deg)', display:'block' }}>
        <circle cx="64" cy="64" r={r} fill="none" stroke={COLORS.border} strokeWidth="12"/>
        <circle cx="64" cy="64" r={r} fill="none" stroke={sc.color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset} style={{ transition:'stroke-dashoffset .3s ease' }}/>
      </svg>
      <div style={styles.ringCenter}>
        <div style={styles.ringLabel}>Homeostase</div>
        <div style={styles.ringPct}>{Math.round(clamped)}%</div>
      </div>
    </div>
  );
}

// Card com a mascote (placeholder ate as imagens finais chegarem — ver
// frontend/src/assets/mascote), o anel de Homeostase e os badges de
// status/estagio. O clique no anel reaproveita o mesmo modal educativo dos
// demais indicadores (PARAM_INFO.saude), em vez de deixar esse conteudo
// orfao agora que o card antigo de "Saude" saiu do grid (fica redundante
// com o anel).
function StatusCard({ saude, status, stage, onOpenSaude }) {
  const sc = statusColors(status);
  const statusLabel = status === STATUS.SAUDAVEL ? 'Saudável' : status === STATUS.DEBILITADO ? 'Debilitado' : 'Crítico';
  return (
    <div style={styles.statusCard}>
      <img
        src={MASCOT_IMAGES[stage.id][status]}
        alt={`Phisys — ${stage.label}, ${statusLabel}`}
        style={styles.mascotImage}
      />

      <div style={{ cursor:'pointer' }} onClick={onOpenSaude} title="Sobre a Homeostase">
        <HomeostaseRing pct={saude}/>
      </div>

      <div style={styles.statusCol}>
        <div style={{ ...styles.shield, background: sc.soft }}><Icon name="saude" size={20} color={sc.color}/></div>
        <div style={{ ...styles.statusName, color: sc.color }}>{statusLabel}</div>
        <div style={styles.stagePill}><span>{stage.icon}</span>{stage.label}</div>
      </div>
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
  const [careEffect, setCareEffect] = useState(null);
  const [careError, setCareError] = useState(null);
  const [pendingCares, setPendingCares] = useState({});
  // Ref paralela ao pendingCares: o useState so reflete na tela apos o proximo
  // render, deixando uma pequena janela onde 2 cliques quase simultaneos veem
  // o mesmo valor "destravado" e disparam 2 requisicoes ao servidor (foi o que
  // causou o salto de contagem visto em teste, ex: indo de 1 para 4 usos com
  // apenas 2 cliques). A ref e sincrona: trava no mesmo instante do clique.
  const pendingCaresRef = useRef({});
  const [, forceTick] = useState(0);

  const [customParamValues, setCustomParamValues] = useState([]);

  const fetchCuidadoStatus = useCallback(() => {
    animalApi.cuidadoStatus().then(setCuidadoStatus).catch(() => {});
  }, []);

  useEffect(() => {
    fetchCuidadoStatus();
  }, [fetchCuidadoStatus]);

  useEffect(() => {
    // Verifica simulacao ativa a cada 30 segundos, e tambem reavalia o status
    // dos cuidados (ex: cooldown que acabou de expirar, ou nova sessao ativada)
    const checkSim = () => {
      animalApi.get().then(a => {
        const fc  = Number(a.fc)  < 100 ? 370 : Number(a.fc);
        const pas = Number(a.pas) < 60  ? 110 : Number(a.pas);
        const pad = Number(a.pad) < 40  ? 70  : Number(a.pad);
        setValues(prev => ({
          ...prev,
          energia:    Number(a.energia),
          hidratacao: Number(a.hidratacao),
          pas,
          pad,
          fc,
          peso:       Number(a.peso),
        }));
      }).catch(() => {});
      // Parametros customizados (pedido da Marcia, 17/08/2026): busca separada
      // da acima de proposito - sao so exibicao, nunca entram em `values`
      // (que alimenta calcularSaude), entao ficam num estado proprio.
      simulacoesApi.getAtiva().then(sim => {
        setCustomParamValues(sim && Array.isArray(sim.parametrosCustom) ? sim.parametrosCustom : []);
      }).catch(() => setCustomParamValues([]));
      fetchCuidadoStatus();
    };
    const interval = setInterval(checkSim, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchCuidadoStatus]);

  useEffect(() => {
    // Busca inicial dos parametros customizados (a interval acima so roda
    // pela primeira vez apos 30s, e sem isto a tela ficaria vazia ate la).
    simulacoesApi.getAtiva().then(sim => {
      setCustomParamValues(sim && Array.isArray(sim.parametrosCustom) ? sim.parametrosCustom : []);
    }).catch(() => {});
  }, []);

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
  const currentAge = ageDays || 90;
  const stage = getGrowthStage(currentAge);
  // stageInfo vem do mascotEngine (getAgeStage), que carrega as faixas
  // fisiologicas reais por fase (fcNormal, pesoNormal) - usadas abaixo para
  // corrigir a cor dos cards de FC e Peso conforme a fase atual do animal.
  const stageInfo = getAgeStage(currentAge);
  const pesoParam = PRIMARY_PARAMS.find(p => p.id === 'peso');
  const idadeParam = { id:'idade', name:'Idade', unit:'', min:0, max:730, normal:[0,730], default:currentAge, step:1 };

  async function handleCare(id) {
    const statusDoCuidado = cuidadoStatus[id];
    if (statusDoCuidado && statusDoCuidado.disponivel === false) return;
    // Bloqueio SINCRONO via ref - impede cliques duplos/rapidos que passariam
    // despercebidos pelo useState (que so atualiza a tela no proximo render).
    if (pendingCaresRef.current[id]) return;
    pendingCaresRef.current[id] = true;
    setPendingCares(prev => ({ ...prev, [id]: true }));

    let resultado;
    try {
      resultado = await animalApi.cuidado(id);
    } catch (e) {
      // 429 = bloqueado (cooldown ou limite de sessao atingido). Recarrega o
      // status real do servidor para refletir o bloqueio na tela corretamente.
      setCareError(id);
      setTimeout(() => setCareError(null), 2000);
      fetchCuidadoStatus();
      pendingCaresRef.current[id] = false;
      setPendingCares(prev => ({ ...prev, [id]: false }));
      return;
    }

    // Estado do animal e XP vem calculados pelo servidor - antes o frontend
    // recalculava tudo aqui e sobrescrevia via PUT /api/animal e
    // PUT /api/ranking com valores proprios, o que permitia mandar qualquer
    // valor direto nessas rotas.
    setValues(resultado.animal);
    setCareEffect(id);
    setTimeout(() => setCareEffect(null), 1500);
    fetchCuidadoStatus();
    pendingCaresRef.current[id] = false;
    setPendingCares(prev => ({ ...prev, [id]: false }));

    if (onCare) onCare(id, resultado.animal, resultado.ranking.xp_total);
  }

  return (
    <div className="app-screen" style={styles.screen}>
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

      <div style={styles.header}>
        <svg style={styles.headerDeco} viewBox="0 0 140 100" fill="none" stroke="white" strokeWidth="1">
          <circle cx="30" cy="20" r="2" fill="white" stroke="none"/><circle cx="60" cy="12" r="2" fill="white" stroke="none"/>
          <circle cx="90" cy="28" r="2" fill="white" stroke="none"/><circle cx="115" cy="15" r="2" fill="white" stroke="none"/>
          <circle cx="50" cy="45" r="2" fill="white" stroke="none"/><circle cx="80" cy="55" r="2" fill="white" stroke="none"/>
          <line x1="30" y1="20" x2="60" y2="12"/><line x1="60" y1="12" x2="90" y2="28"/>
          <line x1="90" y1="28" x2="115" y2="15"/><line x1="50" y1="45" x2="80" y2="55"/>
          <line x1="60" y1="12" x2="50" y2="45"/><line x1="90" y1="28" x2="80" y2="55"/>
        </svg>
        <div>
          <div style={styles.userName}>{user.name.split(' ')[0]} <span>👋</span></div>
          <div style={styles.userSub}>Modelo Experimental</div>
        </div>
        <div style={styles.xpBadge}>
          <Icon name="star" size={14} color={COLORS.xpPill.star}/>
          <span>{Math.round(score)} XP</span>
        </div>
      </div>

      <div style={styles.scroll}>

        <StatusCard saude={saude} status={status} stage={stage} onOpenSaude={() => setActiveParam('saude')}/>

        <div style={styles.sectionTitle}>
          <div style={styles.sectionIcon}><Icon name="section-vitals" size={13} color="white"/></div>
          <span style={styles.sectionTitleText}>Indicadores fisiológicos</span>
        </div>
        <div style={styles.indicatorsGrid}>
          {line1.map(p => (
            <ParamCard
              key={p.id}
              param={p}
              value={valsWithSaude[p.id] ?? p.default}
              onClick={setActiveParam}
              normalOverride={p.id === 'fc' ? stageInfo.fcNormal : undefined}
            />
          ))}
          <PACard pas={valsWithSaude.pas ?? 110} pad={valsWithSaude.pad ?? 70} paNormal={getAgePANormal(currentAge)} onClick={setActiveParam}/>
          <ParamCard param={pesoParam} value={valsWithSaude.peso ?? pesoParam.default} onClick={setActiveParam} normalOverride={stageInfo.pesoNormal}/>
          <ParamCard param={idadeParam} value={currentAge} onClick={setActiveParam}/>
          {customParamValues.map(p => (
            <CustomParamCard key={p.id} nome={p.nome} unidade={p.unidade} valor={Number(p.valor)} valorMin={Number(p.valor_min)} valorMax={Number(p.valor_max)}/>
          ))}
        </div>

        <div style={styles.sectionTitle}>
          <div style={styles.sectionIcon}><Icon name="section-cares" size={13} color="white"/></div>
          <span style={styles.sectionTitleText}>Cuidados diários</span>
        </div>
        <div style={styles.caresRow}>
          {Object.values(DAILY_CARES).map(c => {
            const st = cuidadoStatus[c.id];
            const bloqueado = (st && st.disponivel === false) || pendingCares[c.id];
            let desc = null;
            if (bloqueado) {
              if (st.modo === 'sessao') {
                desc = `Limite atingido (${st.usados}/${st.limite})`;
              } else {
                const restante = formatarTempoRestante(st.liberaEm);
                desc = restante ? `Libera em ${restante}` : null;
              }
            }
            const theme = CARE_THEME[c.id];
            return (
              <div
                key={c.id}
                style={{
                  ...styles.careCard,
                  background: bloqueado ? COLORS.surfaceMuted : theme.bg,
                  position:'relative',
                  cursor: bloqueado ? 'not-allowed' : 'pointer',
                  opacity: bloqueado ? 0.6 : 1,
                }}
                onClick={() => handleCare(c.id)}
              >
                <span style={styles.careIconBox}><Icon name={CARE_ICON[c.id]} size={24} color={theme.icon}/></span>
                <div style={styles.careLabel}>{c.label.split(' ')[0]}</div>
                {desc && <div style={styles.careDesc}>{desc}</div>}
                {careEffect === c.id && (
                  <div style={{ position:'absolute', top:'-10px', right:'4px', fontSize:'11px', fontWeight:'800', color:COLORS.status.debilitado.color, animation:'fadeUp 1.5s ease-out', pointerEvents:'none' }}>+5 XP ⚡</div>
                )}
                {careError === c.id && (
                  <div style={{ position:'absolute', top:'-10px', right:'4px', fontSize:'10px', fontWeight:'800', color:COLORS.status.critico.color, pointerEvents:'none' }}>Indisponível</div>
                )}
              </div>
            );
          })}
        </div>

        <div style={styles.logoutRow} onClick={onLogout}>sair da conta</div>
      </div>

      <div style={styles.bottomNav}>
        <div style={{ ...styles.navItem, ...styles.navItemActive }}>
          <span style={styles.navIconBox}><Icon name="navHome" size={22} color={COLORS.indigo}/></span>
          <span>Início</span>
        </div>
        <div style={styles.navItem} onClick={onViewSecondary}>
          <span style={styles.navIconBox}><Icon name="navParams" size={22} color={COLORS.textMuted}/></span>
          <span>Parâmetros</span>
        </div>
        <div style={styles.navItem} onClick={() => setShowModes(true)}>
          <span style={styles.navIconBox}><Icon name="navPlay" size={22} color={COLORS.textMuted}/></span>
          <span>Jogar</span>
        </div>
        <div style={styles.navItem} onClick={onViewRanking}>
          <span style={styles.navIconBox}><Icon name="navRanking" size={22} color={COLORS.textMuted}/></span>
          <span>Ranking</span>
        </div>
      </div>

      {user.mode === 'professor' && (
        <div style={styles.professorBar} onClick={onViewPanel}>
          <Icon name="cap" size={16} color="rgba(255,255,255,.85)"/>
          <span>Área do professor</span>
          <Icon name="chevronRight" size={13} color="rgba(255,255,255,.85)"/>
        </div>
      )}
    </div>
  );
}

const styles = {
  screen:           { width:'100%', minHeight:'100vh', display:'flex', flexDirection:'column', background:COLORS.surface, margin:'0 auto', overflowX:'hidden', fontFamily:FONT_FAMILY, color:COLORS.textPrimary },

  header:           { position:'relative', background:COLORS.bg, padding:'22px 18px 28px', overflow:'hidden', display:'flex', alignItems:'flex-start', justifyContent:'space-between' },
  headerDeco:       { position:'absolute', top:'-10px', right:'-10px', width:'140px', height:'100px', opacity:.35, pointerEvents:'none' },
  userName:         { fontSize:'22px', fontWeight:'800', color:'white', display:'flex', alignItems:'center', gap:'7px', position:'relative' },
  userSub:          { fontSize:'12.5px', fontWeight:'600', color:'rgba(255,255,255,.55)', marginTop:'3px', position:'relative' },
  xpBadge:          { display:'flex', alignItems:'center', gap:'7px', background:COLORS.xpPill.bg, border:'1px solid rgba(255,255,255,.25)', borderRadius:'999px', padding:'8px 15px 8px 11px', fontSize:'14px', color:'white', fontWeight:'800', position:'relative' },

  scroll:           { flex:1, padding:'0 16px 8px', marginTop:'-14px', display:'flex', flexDirection:'column', gap:'10px', position:'relative' },

  statusCard:       { background:'#FFFFFF', borderRadius:'28px', padding:'18px 15px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px', boxShadow:'0 2px 6px rgba(43,43,118,.06), 0 10px 24px rgba(43,43,118,.09)' },

  mascotImage:      { width:'104px', height:'104px', objectFit:'contain', borderRadius:'20px', flexShrink:0 },

  ringWrap:         { position:'relative', width:'128px', height:'128px', flexShrink:0 },
  ringCenter:       { position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'3px' },
  ringLabel:        { fontSize:'11px', fontWeight:'700', color:COLORS.textMuted, textAlign:'center', lineHeight:1.2 },
  ringPct:          { fontSize:'28px', fontWeight:'800', color:COLORS.textPrimary, lineHeight:1 },

  statusCol:        { display:'flex', flexDirection:'column', alignItems:'center', gap:'9px', flexShrink:0 },
  shield:           { width:'38px', height:'38px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' },
  statusName:       { fontSize:'13px', fontWeight:'800', textAlign:'center' },
  stagePill:        { display:'flex', alignItems:'center', gap:'5px', background:COLORS.stagePill.bg, borderRadius:'999px', padding:'6px 12px', fontSize:'11.5px', fontWeight:'700', color:COLORS.stagePill.text, whiteSpace:'nowrap' },

  sectionTitle:     { display:'flex', alignItems:'center', gap:'9px' },
  sectionTitleText: { ...FONT_SCALE.title, color:COLORS.textPrimary },
  sectionIcon:      { width:'24px', height:'24px', borderRadius:'50%', background:COLORS.indigo, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },

  indicatorsGrid:   { display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'10px' },
  indicatorCard:    { background:'#FFFFFF', borderRadius:'18px', padding:'14px', display:'flex', flexDirection:'column', justifyContent:'space-between', gap:'11px', boxShadow:SHADOW_CARD, cursor:'pointer' },
  indicatorTop:     { display:'flex', alignItems:'center', gap:'10px' },
  indicatorIcon:    { width:'38px', height:'38px', borderRadius:'50%', background:COLORS.iconChipBg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  indicatorText:    { display:'flex', flexDirection:'column', gap:'2px', minWidth:0 },
  indicatorLabel:   { fontSize:'11.5px', fontWeight:'700', color:COLORS.textMuted },
  indicatorValue:   { fontSize:'17px', fontWeight:'800', color:COLORS.indigo },
  indicatorBarTrack:{ height:'6px', borderRadius:'999px', background:COLORS.border, overflow:'hidden' },
  indicatorBarFill: { height:'100%', borderRadius:'999px' },

  caresRow:         { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px' },
  careCard:         { borderRadius:'18px', padding:'16px 6px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'8px' },
  careIconBox:      { display:'flex', alignItems:'center', justifyContent:'center' },
  careLabel:        { fontSize:'12px', fontWeight:'800', textAlign:'center', color:COLORS.textPrimary, lineHeight:1.25 },
  careDesc:         { fontSize:'9px', color:COLORS.textMuted, textAlign:'center', fontWeight:'600' },

  logoutRow:        { textAlign:'center', fontSize:'11px', color:COLORS.textMuted, cursor:'pointer', padding:'2px 0 4px', fontWeight:'600' },

  bottomNav:        { background:COLORS.surface, boxShadow:'0 -4px 14px rgba(43,43,118,.06)', display:'grid', gridTemplateColumns:'repeat(4,1fr)', padding:'14px 8px 12px' },
  navItem:          { display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', color:COLORS.textMuted, fontSize:'10.5px', fontWeight:'700', cursor:'pointer' },
  navItemActive:    { color:COLORS.indigo },
  navIconBox:        { display:'flex', alignItems:'center', justifyContent:'center' },

  professorBar:     { background:COLORS.bg, display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', padding:'13px 0 17px', fontSize:'13.5px', fontWeight:'700', color:'rgba(255,255,255,.85)', cursor:'pointer' },

  modalOverlay:     { position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 },
  modalCard:        { background:COLORS.surface, borderRadius:'24px', padding:'1.5rem', width:'90%', maxWidth:'340px', display:'flex', flexDirection:'column', gap:'12px', boxShadow:'0 20px 50px rgba(43,43,118,.35)' },
  modalTitle:       { fontSize:'16px', fontWeight:'800', color:COLORS.textPrimary, textAlign:'center', marginBottom:'4px' },
  modeBtn:          { background:COLORS.surfaceMuted, border:`1px solid ${COLORS.border}`, borderRadius:'16px', padding:'1rem', cursor:'pointer' },
  modeBtnIcon:      { fontSize:'24px', marginBottom:'4px' },
  modeBtnTitle:     { fontSize:'14px', fontWeight:'800', color:COLORS.textPrimary, marginBottom:'4px' },
  modeBtnDesc:      { fontSize:'11px', color:COLORS.textMuted, lineHeight:'1.4' },
  modalCancel:      { background:'none', border:'none', borderRadius:'20px', padding:'8px', color:COLORS.textMuted, fontSize:'12px', cursor:'pointer', fontFamily:'inherit', fontWeight:'600' },

  infoCard:         { background:COLORS.surface, borderRadius:'24px', padding:'1.5rem', width:'90%', maxWidth:'340px', display:'flex', flexDirection:'column', gap:'12px', boxShadow:'0 20px 50px rgba(43,43,118,.35)' },
  infoHeader:       { display:'flex', alignItems:'center', gap:'10px' },
  infoIconChip:     { width:'34px', height:'34px', borderRadius:'50%', background:COLORS.iconChipBg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  infoTitle:        { flex:1, fontSize:'16px', fontWeight:'800', color:COLORS.textPrimary },
  infoClose:        { background:'none', border:'none', color:COLORS.textMuted, fontSize:'18px', cursor:'pointer', fontFamily:'inherit' },
  infoQuestion:     { background:COLORS.iconChipBg, borderRadius:'14px', padding:'1rem', fontSize:'13px', color:COLORS.indigo, fontWeight:'700', lineHeight:'1.5' },
  showAnswerBtn:    { background:COLORS.indigo, border:'none', borderRadius:'999px', padding:'10px', color:'white', fontSize:'13px', fontWeight:'800', cursor:'pointer', fontFamily:'inherit' },
  infoAnswer:       { background:COLORS.surfaceMuted, borderRadius:'14px', padding:'1rem', fontSize:'12px', color:COLORS.textPrimary, lineHeight:'1.6' },
  infoDica:         { background:COLORS.status.saudavel.soft, border:`1px solid ${COLORS.status.saudavel.color}`, borderRadius:'12px', padding:'.75rem', fontSize:'11px', color:COLORS.textPrimary, lineHeight:'1.4', fontWeight:'600' },
  infoCloseBtn:     { background:'none', border:`1px solid ${COLORS.border}`, borderRadius:'999px', padding:'8px', color:COLORS.textMuted, fontSize:'12px', cursor:'pointer', fontFamily:'inherit', fontWeight:'600' },
};

const styleTag = document.createElement('style');
styleTag.innerHTML = `@keyframes fadeUp { 0% { opacity:1; transform:translateY(0); } 100% { opacity:0; transform:translateY(-20px); } }`;
document.head.appendChild(styleTag);

export default HomeScreen;
