// mascotEngine.js
// Motor central de lógica fisiológica do Phisys
// Define parâmetros, faixas normais, status do mascote e sistema de pontuação

export const PARAMS = [
  {
    id: 'pa',
    name: 'Pressão Arterial',
    unit: 'mmHg',
    min: 40,
    max: 200,
    normal: [90, 130],
    default: 110,
    step: 1,
    focus: 'cardiovascular',
  },
  {
    id: 'fc',
    name: 'Frequência Cardíaca',
    unit: 'bpm',
    min: 20,
    max: 200,
    normal: [60, 100],
    default: 75,
    step: 1,
    focus: 'cardiovascular',
  },
  {
    id: 'sede',
    name: 'Sede',
    unit: '%',
    min: 0,
    max: 100,
    normal: [20, 60],
    default: 30,
    step: 1,
    focus: 'renal',
  },
  {
    id: 'fome',
    name: 'Fome',
    unit: '%',
    min: 0,
    max: 100,
    normal: [20, 60],
    default: 30,
    step: 1,
    focus: 'renal',
  },
  {
    id: 'vu',
    name: 'Volume Urinário',
    unit: 'ml/h',
    min: 0,
    max: 5,
    normal: [1, 3],
    default: 1.5,
    step: 0.1,
    focus: 'renal',
  },
];

export function getDefaultValues() {
  const values = {};
  PARAMS.forEach((p) => {
    values[p.id] = p.default;
  });
  return values;
}

export function isInRange(paramId, value) {
  const p = PARAMS.find((x) => x.id === paramId);
  if (!p) return false;
  return value >= p.normal[0] && value <= p.normal[1];
}

export function countOutOfRange(values) {
  return PARAMS.filter((p) => !isInRange(p.id, values[p.id])).length;
}

export function getAlerts(values) {
  const alerts = [];
  PARAMS.forEach((p) => {
    const v = values[p.id];
    if (v < p.normal[0]) {
      alerts.push({ id: p.id, name: p.name, direction: 'baixo', value: v });
    } else if (v > p.normal[1]) {
      alerts.push({ id: p.id, name: p.name, direction: 'alto', value: v });
    }
  });
  return alerts;
}

export const STATUS = {
  SAUDAVEL: 'saudavel',
  DEBILITADO: 'debilitado',
  CRITICO: 'critico',
};

export function getMascotStatus(values) {
  const out = countOutOfRange(values);
  if (out === 0) return STATUS.SAUDAVEL;
  if (out <= 2) return STATUS.DEBILITADO;
  return STATUS.CRITICO;
}

export const SCORE_RULES = {
  penalty: {
    [STATUS.SAUDAVEL]: 0,
    [STATUS.DEBILITADO]: 2,
    [STATUS.CRITICO]: 5,
  },
  bonus: {
    correct_answer: 10,
    challenge_solved: 20,
    fast_response: 5,
  },
  initial: 100,
  min: 0,
  max: 999,
};

export function applyPenalty(currentScore, status) {
  const penalty = SCORE_RULES.penalty[status] || 0;
  return Math.max(SCORE_RULES.min, currentScore - penalty);
}

export function applyBonus(currentScore, bonusType) {
  const bonus = SCORE_RULES.bonus[bonusType] || 0;
  return Math.min(SCORE_RULES.max, currentScore + bonus);
}

export const DEFAULT_WEIGHTS = {
  score: 0.4,
  survival: 0.3,
  challenges: 0.2,
  response_time: 0.1,
};

export function calculateFinalGrade(sessionData, weights = DEFAULT_WEIGHTS) {
  const {
    totalChallenges,
    solvedChallenges,
    avgResponseTime,
    errors = 0,
  } = sessionData;

  // Base: acertos sobre total (peso dominante)
  const challengeNorm = totalChallenges > 0
    ? solvedChallenges / totalChallenges
    : 0;

  // Bônus de tempo: resposta em até 10s = +1.0, até 30s = +0.5, acima de 60s = 0
  const timeBonus = Math.max(0, 1 - (avgResponseTime - 10) / 50);

  // Penalidade por erros: cada erro desconta 0.5 ponto na nota final
  const errorPenalty = errors * 0.5;

  // Nota base = acertos * 9 + bônus de tempo - penalidade de erros
  const grade = Math.max(0, Math.min(10,
    (challengeNorm * 9.0) + (timeBonus * 1.0) - errorPenalty
  ));

  return parseFloat(grade.toFixed(1));
}

export const INTERVENTIONS = {
  hipertensao: {
    label: 'Hipertensão',
    focus: 'cardiovascular',
    values: { pa: 165, fc: 90, sede: 55, fome: 30, vu: 0.7 },
  },
  desidratacao: {
    label: 'Desidratação',
    focus: 'renal',
    values: { pa: 85, fc: 115, sede: 90, fome: 40, vu: 0.3 },
  },
  bradicardia: {
    label: 'Bradicardia',
    focus: 'cardiovascular',
    values: { pa: 95, fc: 38, sede: 25, fome: 30, vu: 1.8 },
  },
  insuf_renal: {
    label: 'Insuficiência Renal',
    focus: 'renal',
    values: { pa: 140, fc: 88, sede: 70, fome: 35, vu: 0.2 },
  },
  choque: {
    label: 'Choque',
    focus: 'cardiovascular',
    values: { pa: 55, fc: 140, sede: 85, fome: 20, vu: 0.1 },
  },
};