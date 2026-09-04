// Copia PARCIAL, mantida manualmente em sincronia, de
// frontend/src/engine/mascotEngine.js - so as pecas usadas para aplicar o
// resultado de um desafio no servidor (POST /api/desafios/:id/checar com
// fechar:true). Qualquer mudanca de regra fisiologica/pontuacao la
// PRECISA ser replicada aqui tambem, ou os dois lados divergem.

const PRIMARY_PARAMS = [
  { id: 'energia',    min: 0,  max: 100, normal: [40, 100]  },
  { id: 'hidratacao', min: 0,  max: 100, normal: [50, 90]   },
  { id: 'pas',        min: 60, max: 200, normal: [90, 120]  },
  { id: 'pad',        min: 40, max: 130, normal: [60, 80]   },
  { id: 'fc',         min: 100, max: 600, normal: [360, 380] },
  { id: 'peso',       min: 50, max: 800, normal: [200, 400] },
  { id: 'saude',      min: 0,  max: 100, normal: [75, 100]  },
];

const AGE_STAGES = {
  RECEM_NASCIDO: { days: [0, 30],     fcNormal: [380, 500], paNormal: { pas: [80, 110],  pad: [50, 70] }, pesoNormal: [5, 50]   },
  JUVENIL:       { days: [31, 180],   fcNormal: [360, 440], paNormal: { pas: [90, 120],  pad: [60, 80] }, pesoNormal: [50, 200] },
  ADULTO:        { days: [181, 540],  fcNormal: [340, 380], paNormal: { pas: [90, 120],  pad: [60, 80] }, pesoNormal: [200, 400] },
  IDOSO:         { days: [541, 9999], fcNormal: [320, 360], paNormal: { pas: [100, 140], pad: [65, 90] }, pesoNormal: [150, 350] },
};

function getAgeStage(days) {
  for (const [key, stage] of Object.entries(AGE_STAGES)) {
    if (days >= stage.days[0] && days <= stage.days[1]) return { key, ...stage };
  }
  return { key: 'ADULTO', ...AGE_STAGES.ADULTO };
}

function getAgePANormal(days) {
  return getAgeStage(days).paNormal ?? { pas: [90, 120], pad: [60, 80] };
}

function getAgeSaudeModifier(days) {
  if (days <= 30)  return 0;
  if (days <= 180) return 0;
  if (days <= 540) return -5;
  return -15;
}

function getAgeRecoveryPenalty(days) {
  if (days <= 30)  return 1.0;
  if (days <= 180) return 1.0;
  if (days <= 540) return 0.85;
  return 0.65;
}

function aplicarDeltaComFreio(valorAtual, delta, faixaNormal, min, max) {
  const dentroDaFaixaAtual = valorAtual >= faixaNormal[0] && valorAtual <= faixaNormal[1];
  const bruto = valorAtual + delta;
  if (dentroDaFaixaAtual) {
    return Math.max(faixaNormal[0], Math.min(faixaNormal[1], bruto));
  }
  const centro = (faixaNormal[0] + faixaNormal[1]) / 2;
  if (delta > 0 && valorAtual < centro && bruto > centro) return Math.max(min, Math.min(max, centro));
  if (delta < 0 && valorAtual > centro && bruto < centro) return Math.max(min, Math.min(max, centro));
  return Math.max(min, Math.min(max, bruto));
}

function calcularSaude(primarios) {
  const ageDays = primarios.age_days ?? 90;
  const stage = getAgeStage(ageDays);
  const paNormal = getAgePANormal(ageDays);

  let fora = 0;
  const totalVerificados = 4;
  const hidParam = PRIMARY_PARAMS.find(x => x.id === 'hidratacao');
  if (primarios.hidratacao < hidParam.normal[0] || primarios.hidratacao > hidParam.normal[1]) fora++;
  if (primarios.pas < paNormal.pas[0] || primarios.pas > paNormal.pas[1]) fora++;
  if (primarios.pad < paNormal.pad[0] || primarios.pad > paNormal.pad[1]) fora++;
  if (primarios.fc  < stage.fcNormal[0] || primarios.fc > stage.fcNormal[1]) fora++;

  let saude = (1 - (fora / totalVerificados)) * 100;

  const energia = primarios.energia ?? 80;
  if (energia < 20) saude = Math.max(0, saude - 20);
  else if (energia < 40) saude = Math.max(0, saude - 10);

  const peso = primarios.peso ?? 125;
  const pesoNormal = stage.pesoNormal ?? [200, 400];
  if (peso < pesoNormal[0] || peso > pesoNormal[1]) saude = Math.max(0, saude - 10);

  saude = Math.max(0, saude + getAgeSaudeModifier(ageDays));
  return Math.round(saude);
}

const SCORE_RULES = { bonus: { resposta_correta: 10 }, max: 9999 };
function applyBonus(score, tipo) {
  return Math.min(SCORE_RULES.max, score + (SCORE_RULES.bonus[tipo] || 0));
}

module.exports = {
  PRIMARY_PARAMS, getAgeStage, getAgePANormal, getAgeRecoveryPenalty,
  aplicarDeltaComFreio, calcularSaude, applyBonus,
};
