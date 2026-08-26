const { calcularSaude } = require('../engine/mascotEngine');

// Recalcula e regrava animal.saude de todos os alunos de uma turma, a partir
// do estado atual (hidratacao/pas/pad/fc/energia/peso/age_days) ja salvo no
// banco. Chamar depois de qualquer mudanca em lote que altere esses campos
// (ativar simulacao, mudar idade da turma) - sem isso, saude fica parada com
// o valor de antes da mudanca (bug real, varredura funcional de 25/08/2026).
// `queryable` aceita tanto o pool quanto um client de transacao (mesma
// interface .query), pra poder rodar dentro do BEGIN/COMMIT do chamador.
async function recalcularSaudeTurma(queryable, turmaId) {
  const animais = await queryable.query(
    `SELECT a.id, a.energia, a.hidratacao, a.pas, a.pad, a.fc, a.peso, a.age_days
     FROM animal a JOIN usuarios u ON u.id = a.usuario_id
     WHERE u.modo = 'aluno' AND u.turma_id = $1`,
    [turmaId]
  );
  if (animais.rows.length === 0) return;

  const valuesSql = [];
  const params = [];
  animais.rows.forEach((row, i) => {
    const saude = calcularSaude({
      hidratacao: Number(row.hidratacao), pas: Number(row.pas), pad: Number(row.pad),
      fc: Number(row.fc), energia: Number(row.energia), peso: Number(row.peso),
      age_days: row.age_days,
    });
    valuesSql.push(`($${i * 2 + 1}::int, $${i * 2 + 2}::int)`);
    params.push(row.id, saude);
  });

  await queryable.query(
    `UPDATE animal AS a SET saude = v.saude
     FROM (VALUES ${valuesSql.join(', ')}) AS v(id, saude)
     WHERE a.id = v.id`,
    params
  );
}

module.exports = { recalcularSaudeTurma };
