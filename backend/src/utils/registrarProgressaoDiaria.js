// Grava/atualiza o snapshot diario de progressao (pedido da Samela,
// 16/09/2026, ver schema.js) - 1 linha por aluno por dia, sempre com o
// estado mais recente conhecido naquele dia (ON CONFLICT DO UPDATE, nao DO
// NOTHING - queremos o ultimo valor do dia, nao o primeiro). Chamar so nos
// pontos onde o PROPRIO ALUNO altera animal (checar desafio, usar cuidado) -
// ver comentario em schema.js sobre mudancas em lote do professor.
// `animal` e a linha inteira de RETURNING * de um UPDATE animal (ja
// disponivel em todo chamador, sem SELECT extra). `queryable` aceita tanto o
// pool quanto um client de transacao, mesmo padrao de recalcularSaudeTurma.
async function registrarProgressaoDiaria(queryable, usuarioId, animal) {
  await queryable.query(
    `INSERT INTO progressao_diaria
      (usuario_id, data, energia, hidratacao, pas, pad, fc, peso, saude, age_days)
     VALUES ($1, (NOW() AT TIME ZONE 'America/Sao_Paulo')::date, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (usuario_id, data) DO UPDATE SET
       energia = $2, hidratacao = $3, pas = $4, pad = $5, fc = $6, peso = $7, saude = $8, age_days = $9,
       atualizado_em = NOW()`,
    [
      usuarioId,
      animal.energia, animal.hidratacao, animal.pas, animal.pad, animal.fc,
      animal.peso, animal.saude, animal.age_days,
    ]
  );
}

module.exports = { registrarProgressaoDiaria };
