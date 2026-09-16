const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const pool = require('../db/connection');
const auth = require('../middleware/auth');
const { requireProfessor, resolveTurmaId } = require('../middleware/turmaOwnership');

// Data a partir da qual `respostas` passou a ser gravada de verdade (ver
// commit 9b7984a, 11/09/2026) - antes disso a tabela existia mas nunca era
// escrita, entao nao ha dado nenhum de tentativas anterior a essa data.
const RESPOSTAS_DESDE = '11/09/2026';

function slugify(texto) {
  return (texto || 'turma')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'turma';
}

function estilarCabecalho(worksheet) {
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
}

// GET /api/export/pesquisa — XLS multi-aba com os dados de uso/desempenho de
// uma turma, pedido da Samela pra disserta o (qualificacao 09/10/2026):
// Resumo (ranking), Acessos (acessos_diarios), Progressao (progressao_diaria,
// parametros fisiologicos ao longo do tempo), Sessoes (historico completo,
// sem o LIMIT 20 que GET /api/sessoes tem) e Tentativas (respostas). So
// professor, so da propria turma (mesmo padrao de posse de sempre).
router.get('/pesquisa', auth, requireProfessor, resolveTurmaId, async (req, res) => {
  const turmaId = req.turmaId;
  try {
    const turmaResult = await pool.query('SELECT nome FROM turmas WHERE id = $1', [turmaId]);
    const turmaNome = turmaResult.rows[0]?.nome || `turma_${turmaId}`;

    const [resumo, acessos, progressao, sessoes, tentativas] = await Promise.all([
      pool.query(
        `SELECT u.nome, u.matricula, r.xp_total, r.sessoes, r.media_saude, r.nota_final,
         RANK() OVER (ORDER BY r.xp_total DESC) AS posicao
         FROM usuarios u JOIN ranking r ON r.usuario_id = u.id
         WHERE u.modo = 'aluno' AND u.turma_id = $1
         ORDER BY r.xp_total DESC`,
        [turmaId]
      ),
      pool.query(
        `SELECT u.nome, u.matricula, a.data, a.criado_em
         FROM acessos_diarios a JOIN usuarios u ON u.id = a.usuario_id
         WHERE u.turma_id = $1
         ORDER BY u.nome, a.data`,
        [turmaId]
      ),
      pool.query(
        `SELECT u.nome, u.matricula, p.data, p.energia, p.hidratacao, p.pas, p.pad, p.fc,
         p.peso, p.saude, p.age_days, p.atualizado_em
         FROM progressao_diaria p JOIN usuarios u ON u.id = p.usuario_id
         WHERE u.turma_id = $1
         ORDER BY u.nome, p.data`,
        [turmaId]
      ),
      pool.query(
        `SELECT u.nome, u.matricula, s.iniciada_em, s.finalizada_em, s.duracao_segundos,
         s.xp_total, s.saude_final, s.nivel_motivacao, s.modo
         FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
         WHERE u.turma_id = $1
         ORDER BY u.nome, s.iniciada_em`,
        [turmaId]
      ),
      pool.query(
        `SELECT u.nome, u.matricula, d.titulo AS desafio_titulo, r.resposta, r.correta,
         r.tempo_segundos, r.respondido_em
         FROM respostas r
         JOIN sessoes s ON s.id = r.sessao_id
         JOIN usuarios u ON u.id = s.usuario_id
         LEFT JOIN desafios d ON d.id = r.desafio_id
         WHERE u.turma_id = $1
         ORDER BY u.nome, r.respondido_em`,
        [turmaId]
      ),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Phisys';
    workbook.created = new Date();

    const wsResumo = workbook.addWorksheet('Resumo');
    wsResumo.columns = [
      { header: 'Posição', key: 'posicao', width: 10 },
      { header: 'Nome', key: 'nome', width: 28 },
      { header: 'Matrícula', key: 'matricula', width: 16 },
      { header: 'XP Total', key: 'xp_total', width: 12 },
      { header: 'Sessões', key: 'sessoes', width: 10 },
      { header: 'Média Saúde', key: 'media_saude', width: 14 },
      { header: 'Nota Final', key: 'nota_final', width: 12 },
    ];
    resumo.rows.forEach(r => wsResumo.addRow({
      posicao: Number(r.posicao), nome: r.nome, matricula: r.matricula,
      xp_total: Number(r.xp_total), sessoes: Number(r.sessoes),
      media_saude: Number(r.media_saude), nota_final: r.nota_final !== null ? Number(r.nota_final) : null,
    }));
    estilarCabecalho(wsResumo);

    const wsAcessos = workbook.addWorksheet('Acessos');
    wsAcessos.columns = [
      { header: 'Nome', key: 'nome', width: 28 },
      { header: 'Matrícula', key: 'matricula', width: 16 },
      { header: 'Data', key: 'data', width: 14, style: { numFmt: 'dd/mm/yyyy' } },
      { header: 'Registrado em', key: 'criado_em', width: 20, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
    ];
    acessos.rows.forEach(r => wsAcessos.addRow(r));
    estilarCabecalho(wsAcessos);

    const wsProgressao = workbook.addWorksheet('Progressão');
    wsProgressao.columns = [
      { header: 'Nome', key: 'nome', width: 28 },
      { header: 'Matrícula', key: 'matricula', width: 16 },
      { header: 'Data', key: 'data', width: 14, style: { numFmt: 'dd/mm/yyyy' } },
      { header: 'Energia', key: 'energia', width: 10 },
      { header: 'Hidratação', key: 'hidratacao', width: 12 },
      { header: 'PAS', key: 'pas', width: 8 },
      { header: 'PAD', key: 'pad', width: 8 },
      { header: 'FC', key: 'fc', width: 8 },
      { header: 'Peso', key: 'peso', width: 8 },
      { header: 'Saúde', key: 'saude', width: 10 },
      { header: 'Idade (dias)', key: 'age_days', width: 12 },
      { header: 'Atualizado em', key: 'atualizado_em', width: 20, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
    ];
    progressao.rows.forEach(r => wsProgressao.addRow({
      ...r,
      energia: Number(r.energia), hidratacao: Number(r.hidratacao),
      pas: Number(r.pas), pad: Number(r.pad), fc: Number(r.fc),
      peso: Number(r.peso), saude: Number(r.saude),
    }));
    estilarCabecalho(wsProgressao);

    const wsSessoes = workbook.addWorksheet('Sessões');
    wsSessoes.columns = [
      { header: 'Nome', key: 'nome', width: 28 },
      { header: 'Matrícula', key: 'matricula', width: 16 },
      { header: 'Iniciada em', key: 'iniciada_em', width: 20, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
      { header: 'Finalizada em', key: 'finalizada_em', width: 20, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
      { header: 'Duração (s)', key: 'duracao_segundos', width: 12 },
      { header: 'XP Total (acumulado)', key: 'xp_total', width: 18 },
      { header: 'Saúde Final', key: 'saude_final', width: 12 },
      { header: 'Nível Motivação', key: 'nivel_motivacao', width: 14 },
      { header: 'Modo', key: 'modo', width: 10 },
    ];
    sessoes.rows.forEach(r => wsSessoes.addRow({
      ...r,
      saude_final: r.saude_final !== null ? Number(r.saude_final) : null,
    }));
    estilarCabecalho(wsSessoes);

    const wsTentativas = workbook.addWorksheet('Tentativas');
    wsTentativas.addRow([`Nota: tentativas de resposta só são registradas a partir de ${RESPOSTAS_DESDE}. Dados de uso anteriores a essa data não existem nesta aba.`]);
    wsTentativas.mergeCells('A1:G1');
    wsTentativas.getRow(1).font = { italic: true, color: { argb: 'FF666666' } };
    wsTentativas.addRow([]);
    wsTentativas.columns = [
      { key: 'nome', width: 28 },
      { key: 'matricula', width: 16 },
      { key: 'desafio_titulo', width: 32 },
      { key: 'resposta', width: 10 },
      { key: 'correta', width: 10 },
      { key: 'tempo_segundos', width: 12 },
      { key: 'respondido_em', width: 20 },
    ];
    const headerTentativas = wsTentativas.addRow({
      nome: 'Nome', matricula: 'Matrícula', desafio_titulo: 'Desafio',
      resposta: 'Resposta (opção)', correta: 'Correta', tempo_segundos: 'Tempo (s)', respondido_em: 'Respondido em',
    });
    headerTentativas.font = { bold: true };
    tentativas.rows.forEach(r => {
      const row = wsTentativas.addRow({
        ...r,
        tempo_segundos: r.tempo_segundos !== null ? Number(r.tempo_segundos) : null,
      });
      row.getCell('respondido_em').numFmt = 'dd/mm/yyyy hh:mm';
    });

    const nomeAscii = `phisys_pesquisa_${slugify(turmaNome)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeAscii}"; filename*=UTF-8''${encodeURIComponent(nomeAscii)}`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Erro ao gerar export de pesquisa:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

module.exports = router;
