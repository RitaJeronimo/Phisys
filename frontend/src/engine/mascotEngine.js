// mascotEngine.js
// Motor fisiológico central do Phisys — versão 2.0
// Parâmetros primários, secundários e correlações fisiológicas reais

// ─── PARÂMETROS PRIMÁRIOS (visíveis na tela principal) ───────────────────────

export const PRIMARY_PARAMS = [
  {
    id: 'energia',
    name: 'Energia',
    unit: '%',
    min: 0,
    max: 100,
    normal: [40, 100],
    default: 80,
    step: 1,
    icon: '⚡',
    description: 'A energia indica a disposição do animal para realizar ações, participar de desafios e responder quizzes. É recuperada com alimentação adequada e pode ser influenciada pela saúde, hidratação e fase de desenvolvimento.',
  },
  {
    id: 'hidratacao',
    name: 'Hidratação',
    unit: '%',
    min: 0,
    max: 100,
    normal: [50, 90],
    default: 70,
    step: 1,
    icon: '💧',
    description: 'Representa o equilíbrio hídrico do rato virtual. Influencia o volume urinário, a volemia, a pressão arterial e o débito cardíaco. A desidratação reduz a pré-carga e pode gerar aumento compensatório da FC.',
  },
  {
    id: 'pas',
    name: 'Pressão Sistólica',
    unit: 'mmHg',
    min: 60,
    max: 200,
    normal: [90, 120],
    default: 110,
    step: 1,
    icon: '❤️',
    description: 'Pressão durante a ejeção do sangue. PA = DC × RVP. Desidratação reduz a PA; vasoconstrição e hipervolemia podem elevá-la. PA basal aproximada: 110/70 mmHg.',
  },
  {
    id: 'pad',
    name: 'Pressão Diastólica',
    unit: 'mmHg',
    min: 40,
    max: 130,
    normal: [60, 80],
    default: 70,
    step: 1,
    icon: '🫀',
    description: 'Pressão quando o coração relaxa. Elevada em casos de RVP aumentada. Reflete a resistência vascular em repouso.',
  },
  {
    id: 'fc',
name: 'Frequência Cardíaca',
unit: 'bpm',
min: 100,
max: 600,
normal: [360, 380],
default: 370,
    step: 1,
    icon: '💓',
    description: 'Indica quantas vezes o coração bate por minuto. DC = FC × VS. Na desidratação, o VS pode cair e a FC aumenta como compensação. FC basal aproximada: 360–380 bpm.',
  },
  {
    id: 'peso',
    name: 'Peso',
    unit: 'g',
    min: 50,
    max: 800,
    normal: [200, 400],
    default: 300,
    step: 1,
    icon: '⚖️',
    description: 'Representa a condição corporal geral. Excesso de peso aumenta a RVP e a pós-carga cardíaca, elevando a PA. Peso saudável aproximado: 200–400g.',
  },
  {
    id: 'saude',
    name: 'Saúde',
    unit: '%',
    min: 0,
    max: 100,
    normal: [70, 100],
    default: 85,
    step: 1,
    icon: '➕',
    description: 'Indicador-síntese do estado geral. Calculado a partir de hidratação, PAS, PAD e FC. Energia e peso atuam como moduladores. ≥75% saudável; 40–74% debilitado; <40% crítico.',
  },
];

// ─── PARÂMETROS SECUNDÁRIOS (tela de observação — não afetam o animal diretamente) ──

export const SECONDARY_PARAMS = [
  {
    id: 'vol_urinario',
name: 'Volume Urinário',
unit: '',
min: 0,
max: 2,
normal: [1, 1],
default: 1,
step: 1,
    icon: '🫗',
    description: 'Definido pela ingestão hídrica, volemia, perfusão renal e funcionamento dos rins.',
  },
  {
    id: 'rvp',
name: 'Resistência Vascular Periférica',
unit: '',
min: 0,
max: 2,
normal: [1, 1],
default: 1,
step: 1,
    icon: '🩸',
    description: 'Definida pelo grau de constrição dos vasos. Pode ser influenciada por hidratação, idade, estresse fisiológico e mecanismos compensatórios.',
  },
  {
    id: 'debito_cardiaco',
name: 'Débito Cardíaco',
unit: 'mL/min',
min: 20,
max: 300,
normal: [80, 120],
default: 100,
    step: 50,
    icon: '🔄',
    description: 'Definido pela frequência cardíaca e pelo volume sistólico. Também depende da pré-carga, contratilidade e pós-carga.',
  },
];

// ─── IDADE DO ANIMAL (afeta faixas normais da FC) ────────────────────────────

export const AGE_STAGES = {
  RECEM_NASCIDO: { label: 'Recém-nascido', days: [0, 30],    fcNormal: [380, 500] },
  JUVENIL:       { label: 'Juvenil',        days: [31, 180],  fcNormal: [360, 440] },
  ADULTO:        { label: 'Adulto',         days: [181, 9999],fcNormal: [340, 380] },
};

export function getAgeStage(days) {
  for (const [key, stage] of Object.entries(AGE_STAGES)) {
    if (days >= stage.days[0] && days <= stage.days[1]) return { key, ...stage };
  }
  return { key: 'ADULTO', ...AGE_STAGES.ADULTO };
}

// ─── VALORES PADRÃO ───────────────────────────────────────────────────────────

export function getDefaultPrimaryValues() {
  const v = {};
  PRIMARY_PARAMS.forEach(p => v[p.id] = p.default);
  return v;
}

export function getDefaultSecondaryValues() {
  const v = {};
  SECONDARY_PARAMS.forEach(p => v[p.id] = p.default);
  return v;
}

// ─── CORRELAÇÕES FISIOLÓGICAS REAIS ──────────────────────────────────────────
// Calcula os parâmetros secundários a partir dos primários
// Baseado nas relações descritas no documento estrutural

export function calcularSecundarios(primarios) {
  const { hidratacao, fc, peso } = primarios;

  // Volume Urinário: 0=baixo, 1=normal, 2=alto
  const vol_urinario = hidratacao < 50 ? 0 : hidratacao > 80 ? 2 : 1;

  // RVP: 0=baixa, 1=normal, 2=alta
  const fatorHidratacao = hidratacao < 50 ? 2 : hidratacao > 80 ? 0 : 1;
  const fatorPeso = peso > 400 ? 2 : peso < 200 ? 0 : 1;
  const rvp = Math.round((fatorHidratacao + fatorPeso) / 2);

  // Débito Cardíaco em mL/min (80–120 normal para rato)
  const volSistolico = 0.27 * (hidratacao / 70);
  const debito_cardiaco = Math.round(fc * volSistolico);

  return {
    vol_urinario: Math.max(0, Math.min(2, vol_urinario)),
    rvp:          Math.max(0, Math.min(2, rvp)),
    debito_cardiaco: Math.max(20, Math.min(300, debito_cardiaco)),
  };
}

// ─── CORRELAÇÕES INVERSAS ─────────────────────────────────────────────────────
// Quando o professor aplica uma intervenção nos secundários (modo observação),
// calcula o impacto nos primários para exibição visual

export function calcularImpactoNoPrimario(secundarios) {
  const { vol_urinario, rvp, debito_cardiaco } = secundarios;

  // PAS: depende do DC e RVP (categorias 0=baixo,1=normal,2=alto)
  const pasEstimada = Math.round((debito_cardiaco / 100) * (rvp === 2 ? 1.3 : rvp === 0 ? 0.8 : 1.0) * 110);

  // PAD: mais sensível à RVP
  const padEstimada = rvp === 2 ? 85 : rvp === 0 ? 55 : 70;

  // FC compensatória: sobe quando DC cai
  const fcEstimada = debito_cardiaco < 80 ? Math.round(370 * (100 / debito_cardiaco)) : 370;

  // Hidratação estimada a partir do volume urinário
  const hidratacaoEstimada = vol_urinario === 0 ? 35 : vol_urinario === 2 ? 85 : 70;

  return {
    pas:       Math.max(60,  Math.min(200, pasEstimada)),
    pad:       Math.max(40,  Math.min(130, padEstimada)),
    fc:        Math.max(100, Math.min(600, fcEstimada)),
    hidratacao:Math.max(0,   Math.min(100, hidratacaoEstimada)),
  };
}

// ─── CUIDADOS DIÁRIOS ─────────────────────────────────────────────────────────

export const DAILY_CARES = {
  hidratacao: {
    id: 'hidratacao',
    label: 'Trocar Água',
    icon: '💧',
    effect: { hidratacao: +20 },
    description: 'Aumenta hidratação em 20%. Impacta volume urinário e RVP.',
  },
  racao: {
    id: 'racao',
    label: 'Alimentar Animal',
    icon: '🍚',
    effect: { energia: +30 },
    description: 'Recarrega energia em 30%.',
  },
  maravalha: {
    id: 'maravalha',
    label: 'Limpar Maravalha',
    icon: '🧹',
    effect: { energia: +10, saude: +5 },
    description: 'Higienização evita estresse. Melhora energia e saúde.',
  },
};

export function aplicarCuidado(valores, cuidadoId) {
  const cuidado = DAILY_CARES[cuidadoId];
  if (!cuidado) return valores;
  const novos = { ...valores };
  for (const [param, delta] of Object.entries(cuidado.effect)) {
    const paramDef = PRIMARY_PARAMS.find(p => p.id === param);
    if (paramDef) {
      novos[param] = Math.max(paramDef.min, Math.min(paramDef.max, novos[param] + delta));
    }
  }
  return novos;
}

// ─── STATUS DO ANIMAL ─────────────────────────────────────────────────────────

export const STATUS = {
  SAUDAVEL:  'saudavel',
  DEBILITADO:'debilitado',
  CRITICO:   'critico',
};

export function calcularSaude(primarios) {
  let fora = 0;
  let totalVerificados = 0;
  const params = ['hidratacao', 'pas', 'pad', 'fc'];
  for (const id of params) {
    const p = PRIMARY_PARAMS.find(x => x.id === id);
    if (!p) continue;
    totalVerificados++;
    const v = primarios[id];
    if (v < p.normal[0] || v > p.normal[1]) fora++;
  }
  const pctNormal = 1 - (fora / totalVerificados);
  return Math.round(pctNormal * 100);
}

export function getMascotStatus(primarios) {
  const saude = calcularSaude(primarios);
  if (saude >= 75) return STATUS.SAUDAVEL;
  if (saude >= 40) return STATUS.DEBILITADO;
  return STATUS.CRITICO;
}

// ─── SISTEMA DE PONTUAÇÃO ─────────────────────────────────────────────────────

export const SCORE_RULES = {
  bonus: {
    resposta_correta:  10,
    cuidado_diario:     5,
    homeostase_mantida:15,
  },
  penalty: {
    [STATUS.SAUDAVEL]:  0,
    [STATUS.DEBILITADO]:2,
    [STATUS.CRITICO]:   5,
  },
  initial: 100,
  min: 0,
  max: 9999,
};

export function applyBonus(score, tipo) {
  return Math.min(SCORE_RULES.max, score + (SCORE_RULES.bonus[tipo] || 0));
}

export function applyPenalty(score, status) {
  return Math.max(SCORE_RULES.min, score - (SCORE_RULES.penalty[status] || 0));
}

// ─── CÁLCULO DE NOTA FINAL ────────────────────────────────────────────────────

export function calculateFinalGrade(sessionData) {
  const { totalChallenges, solvedChallenges, avgResponseTime, errors = 0 } = sessionData;
  const challengeNorm = totalChallenges > 0 ? solvedChallenges / totalChallenges : 0;
  const timeBonus = Math.max(0, 1 - (avgResponseTime - 10) / 50);
  const errorPenalty = errors * 0.5;
  const grade = Math.max(0, Math.min(10,
    (challengeNorm * 9.0) + (timeBonus * 1.0) - errorPenalty
  ));
  return parseFloat(grade.toFixed(1));
}

// ─── CENÁRIOS DE INTERVENÇÃO (cartas de desafio) ──────────────────────────────

export const INTERVENTIONS = {
  desidratacao: {
    label: 'Desidratação',
    focus: 'renal',
    description: 'O animal apresenta baixa ingestão hídrica.',
    effect: { hidratacao: -30, pas: -15, fc: +80 },
  },
  hipertensao: {
    label: 'Hipertensão',
    focus: 'cardiovascular',
    description: 'Pressão arterial elevada detectada.',
    effect: { pas: +40, pad: +20, fc: +60 },
  },
  bradicardia: {
    label: 'Bradicardia',
    focus: 'cardiovascular',
    description: 'Frequência cardíaca abaixo do normal para o rato virtual.',
    effect: { fc: -180, pas: -10 },
  },
  insuf_cardiaca: {
    label: 'Insuficiência Cardíaca',
    focus: 'cardiovascular',
    description: 'Débito cardíaco reduzido. FC compensatória elevada.',
    effect: { fc: +100, pas: -20, pad: -10, saude: -20 },
  },
  insuf_renal: {
    label: 'Insuficiência Renal',
    focus: 'renal',
    description: 'Redução do volume urinário e alteração da PA.',
    effect: { pas: +25, pad: +15, hidratacao: -20 },
  },
  acidose: {
    label: 'Acidose',
    focus: 'renal',
    description: 'Desequilíbrio ácido-básico. Impacta FC e PA.',
    effect: { fc: +60, pas: -10, saude: -15 },
  },
  obesidade: {
    label: 'Obesidade',
    focus: 'cardiovascular',
    description: 'Excesso de peso eleva RVP e PA.',
    effect: { peso: +150, pas: +20, pad: +15, fc: +40 },
  },
};

export function aplicarIntervencao(valores, intervencaoId) {
  const iv = INTERVENTIONS[intervencaoId];
  if (!iv) return valores;
  const novos = { ...valores };
  for (const [param, delta] of Object.entries(iv.effect)) {
    const paramDef = PRIMARY_PARAMS.find(p => p.id === param);
    if (paramDef) {
      novos[param] = Math.max(paramDef.min, Math.min(paramDef.max, novos[param] + delta));
    }
  }
  // Recalcula saúde automaticamente
  novos.saude = calcularSaude(novos);
  return novos;
}

// ─── PARÂMETROS LEGADOS (compatibilidade com código anterior) ─────────────────
// Mantém exportações que o GameScreen e ProfessorPanel ainda usam

export const PARAMS = PRIMARY_PARAMS;
export const DEFAULT_WEIGHTS = { score:0.4, survival:0.3, challenges:0.2, response_time:0.1 };
export function getDefaultValues() { return getDefaultPrimaryValues(); }
export function getMascotStatus_legacy(values) { return getMascotStatus(values); }
export function isInRange(paramId, value) {
  const p = PRIMARY_PARAMS.find(x => x.id === paramId);
  if (!p) return false;
  return value >= p.normal[0] && value <= p.normal[1];
}
export function countOutOfRange(values) {
  return PRIMARY_PARAMS.filter(p => !isInRange(p.id, values[p.id])).length;
}