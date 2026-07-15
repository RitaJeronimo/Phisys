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
    normal: [75, 100],
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
  RECEM_NASCIDO: { label: 'Recém-nascido', days: [0, 30],    fcNormal: [380, 500], paNormal: { pas: [80, 110],  pad: [50, 70]  }, pesoNormal: [5,   50]  },
  JUVENIL:       { label: 'Juvenil',        days: [31, 180],  fcNormal: [360, 440], paNormal: { pas: [90, 120],  pad: [60, 80]  }, pesoNormal: [50,  200] },
  ADULTO:        { label: 'Adulto',         days: [181, 540], fcNormal: [340, 380], paNormal: { pas: [90, 120],  pad: [60, 80]  }, pesoNormal: [200, 400] },
  IDOSO:         { label: 'Idoso',          days: [541, 9999],fcNormal: [320, 360], paNormal: { pas: [100, 140], pad: [65, 90]  }, pesoNormal: [150, 350] },
};

export function getAgeStage(days) {
  for (const [key, stage] of Object.entries(AGE_STAGES)) {
    if (days >= stage.days[0] && days <= stage.days[1]) return { key, ...stage };
  }
  return { key: 'ADULTO', ...AGE_STAGES.ADULTO };
}

export function getAgePANormal(days) {
  const stage = getAgeStage(days);
  return stage.paNormal ?? { pas: [90, 120], pad: [60, 80] };
}

// Modulador de saúde por fase — animais mais velhos são mais vulneráveis
export function getAgeSaudeModifier(days) {
  if (days <= 30)  return 0;    // Recém-nascido: sem penalidade
  if (days <= 180) return 0;    // Juvenil: sem penalidade
  if (days <= 540) return -5;   // Adulto: leve vulnerabilidade
  return -15;                   // Idoso: maior vulnerabilidade
}

// Penalidade de recuperação por fase — animais mais velhos recuperam mais devagar.
// Aplicada automaticamente por cima do multiplicador configurado pelo professor
// (decisão da equipe: sem controle manual adicional para esta parte).
export function getAgeRecoveryPenalty(days) {
  if (days <= 30)  return 1.0;   // Recém-nascido: recuperação normal
  if (days <= 180) return 1.0;   // Juvenil: recuperação normal
  if (days <= 540) return 0.85;  // Adulto: recupera 15% mais devagar
  return 0.65;                   // Idoso: recupera 35% mais devagar
}

// Aplica um delta de recuperação com "freio": impede que a correção
// ultrapasse o centro da faixa normal do parâmetro, mesmo com multiplicador
// alto. Evita que o animal saia de "crítico por valor alto" direto para
// "crítico por valor baixo" (risco identificado pela Sâmela).
export function aplicarDeltaComFreio(valorAtual, delta, faixaNormal, min, max) {
  const centro = (faixaNormal[0] + faixaNormal[1]) / 2;
  const bruto = valorAtual + delta;

  // Se o delta empurra o valor para cima e ultrapassaria o centro
  // vindo de baixo do centro, trava no centro.
  if (delta > 0 && valorAtual < centro && bruto > centro) {
    return Math.max(min, Math.min(max, centro));
  }
  // Se o delta empurra o valor para baixo e ultrapassaria o centro
  // vindo de cima do centro, trava no centro.
  if (delta < 0 && valorAtual > centro && bruto < centro) {
    return Math.max(min, Math.min(max, centro));
  }
  // Caso contrário, aplica o delta normalmente dentro dos limites.
  return Math.max(min, Math.min(max, bruto));
}

// Embaralha um array sem alterar o original (Fisher-Yates).
// Usado para distribuir desafios diferentes em cada volta extra de recuperacao.
export function embaralharArray(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
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
  const ageDays = primarios.ageDays ?? primarios.age_days ?? 90;

  const vol_urinario = hidratacao < 50 ? 0 : hidratacao > 80 ? 2 : 1;

  // RVP: influenciada por hidratação, peso e idade/fase
  const fatorHidratacao = hidratacao < 50 ? 2 : hidratacao > 80 ? 0 : 1;
  const fatorPeso      = peso > 400 ? 2 : peso < 200 ? 0 : 1;
  const fatorIdade     = ageDays > 540 ? 2 : ageDays <= 30 ? 0 : 1;
  const rvp = Math.round((fatorHidratacao + fatorPeso + fatorIdade) / 3);

  const volSistolico = 0.27 * (hidratacao / 70);
  const debito_cardiaco = Math.round(fc * volSistolico);

  return {
    vol_urinario:    Math.max(0, Math.min(2, vol_urinario)),
    rvp:             Math.max(0, Math.min(2, rvp)),
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
    effect: { hidratacao: +20, pas: +5, pad: +3, fc: -10 },
    description: 'Aumenta hidratação → ↑ volemia → ↑ pré-carga → ↑ PA leve e ↓ FC compensatória.',
  },
  racao: {
    id: 'racao',
    label: 'Alimentar Animal',
    icon: '🍚',
    effect: { energia: +30, peso: +5 },
    description: 'Recarrega energia em 30%. Aumenta levemente o peso corporal.',
  },
  maravalha: {
    id: 'maravalha',
    label: 'Limpar Maravalha',
    icon: '🧹',
    effect: { energia: +10 },
    description: 'Higienização evita estresse. Melhora energia e bem-estar geral.',
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
  const ageDays = primarios.ageDays ?? primarios.age_days ?? 90;
  const stage = getAgeStage(ageDays);
  const paNormal = getAgePANormal(ageDays);

  let fora = 0;
  const totalVerificados = 4;

  const hidParam = PRIMARY_PARAMS.find(x => x.id === 'hidratacao');
  if (primarios.hidratacao < hidParam.normal[0] || primarios.hidratacao > hidParam.normal[1]) fora++;
  if (primarios.pas  < paNormal.pas[0] || primarios.pas  > paNormal.pas[1]) fora++;
  if (primarios.pad  < paNormal.pad[0] || primarios.pad  > paNormal.pad[1]) fora++;
  if (primarios.fc   < stage.fcNormal[0] || primarios.fc > stage.fcNormal[1]) fora++;

  let saude = (1 - (fora / totalVerificados)) * 100;

  // Modulador: energia
  const energia = primarios.energia ?? 80;
  if (energia < 20) saude = Math.max(0, saude - 20);
  else if (energia < 40) saude = Math.max(0, saude - 10);

  // Modulador: peso por fase
  const peso = primarios.peso ?? 300;
  const pesoNormal = stage.pesoNormal ?? [200, 400];
  if (peso < pesoNormal[0] || peso > pesoNormal[1]) saude = Math.max(0, saude - 10);

  // Modulador: idade/fase
  saude = Math.max(0, saude + getAgeSaudeModifier(ageDays));

  return Math.round(saude);
}

export function calcularEnergiaModulada(primarios, saudeCalculada) {
  const ageDays = primarios.ageDays ?? primarios.age_days ?? 90;
  let mod = 0;

  // Hidratação baixa reduz energia
  if (primarios.hidratacao < 30) mod -= 20;
  else if (primarios.hidratacao < 50) mod -= 10;

  // Saúde baixa reduz energia
  const saude = saudeCalculada ?? calcularSaude(primarios);
  if (saude < 40) mod -= 20;
  else if (saude < 60) mod -= 10;

  // Fase idoso: energia máxima reduzida
  if (ageDays > 540) mod -= 10;

  return Math.max(0, Math.min(100, (primarios.energia ?? 80) + mod));
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

// DEPOIS:
export function calculateFinalGrade(sessionData, weights) {
  const { totalChallenges, solvedChallenges, avgResponseTime, finalScore = 0, finalHealth = 85 } = sessionData;

  const w = weights ? {
    score:         (weights.score         ?? 40) / 100,
    survival:      (weights.survival      ?? 30) / 100,
    challenges:    (weights.challenges    ?? 20) / 100,
    response_time: (weights.response_time ?? 10) / 100,
  } : DEFAULT_WEIGHTS;

  const totalW = (w.score + w.survival + w.challenges + w.response_time) || 1;

  const challengeScore = totalChallenges > 0 ? solvedChallenges / totalChallenges : 0;
  const scoreNorm      = Math.min(1, (finalScore || 0) / 500);
  const healthNorm     = Math.min(1, (finalHealth || 85) / 100);
  const timeScore      = Math.max(0, 1 - Math.max(0, ((avgResponseTime || 30) - 10) / 50));

  const raw = (
    challengeScore * w.challenges +
    scoreNorm      * w.score +
    healthNorm     * w.survival +
    timeScore      * w.response_time
  ) / totalW;

  return parseFloat(Math.max(0, Math.min(10, raw * 10)).toFixed(1));
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