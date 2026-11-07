const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { requireProfessor, mesmaTurmaDoRecurso, resolveTurmaId } = require('../middleware/turmaOwnership');
const enviarCodigoEmail = require('../utils/enviarCodigoEmail');

// Envio dos e-mails da importacao (item 3, 07/11/2026): um por vez, com
// pausa entre eles - o Promise.all disparava todos juntos e a Resend
// recusava os excedentes com 429 (limite de envios por segundo).
const PAUSA_ENTRE_EMAILS_MS = 600;
const ESPERA_ANTES_DE_REPETIR_MS = 1000;
const ERROS_QUE_INTERROMPEM_ENVIO = ['daily_quota_exceeded', 'monthly_quota_exceeded', 'sem_chave'];
const esperar = ms => new Promise(resolve => setTimeout(resolve, ms));

// Gera e grava um codigo de 6 digitos de uso unico pra um aluno
// definir/redefinir a propria senha em POST /api/auth/resetar-senha.
// Compartilhado entre o cadastro manual (POST /, item 4) e o reset de senha
// (PUT /:id/resetar-senha, ja existia desde o A2 da auditoria de seguranca) -
// sao o mesmo mecanismo: "conta sem senha utilizavel, so codigo destrava".
//
// expiraComTurma=true (usado so no cadastro manual, 24/08/2026): o codigo de
// primeiro acesso fica valido enquanto a turma continuar ativa, em vez de
// expirar em 10 minutos - o professor costuma cadastrar varios alunos de uma
// vez e entregar os codigos em sala depois. expira_em ainda grava um valor
// bem no futuro, so como rede de seguranca (nunca fica "eterno" de verdade);
// quem decide de verdade e o POST /api/auth/resetar-senha conferindo
// turmas.ativa quando expira_com_turma=true. O reset tradicional (aluno ja
// ativo, com progresso real) continua sem essa flag, sempre 10 minutos -
// esticar a validade la reabriria a mesma janela de ataque que o A2 fechou.
async function gerarCodigoAcesso(usuario_id, { expiraComTurma = false, queryable = pool } = {}) {
  const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const codigo_hash = await bcrypt.hash(codigo, 10);
  // So um codigo valido por vez por aluno - gerar um novo mata qualquer
  // codigo anterior ainda nao usado.
  await queryable.query(`DELETE FROM reset_senha_tokens WHERE usuario_id = $1 AND usado_em IS NULL`, [usuario_id]);
  const intervalo = expiraComTurma ? '10 years' : '10 minutes';
  await queryable.query(
    `INSERT INTO reset_senha_tokens (usuario_id, codigo_hash, expira_em, expira_com_turma)
     VALUES ($1, $2, NOW() + INTERVAL '${intervalo}', $3)`,
    [usuario_id, codigo_hash, expiraComTurma]
  );
  return codigo;
}

// Parseia um CSV colado (matricula,nome,email por linha) - sem lib nova.
// Usa a PRIMEIRA virgula pra separar matricula e a ULTIMA pra separar
// email, deixando nome livre pra ter virgula no meio se precisar (ex:
// "Silva, Maria"). Pula uma linha de cabecalho se a primeira coluna for
// literalmente "matricula". Numero de linha reportado bate com o texto
// original colado (util pro professor achar o erro). Uma linha ainda no
// formato antigo de 2 colunas (sem email) cai com nome E email vazios -
// validarLinhasAlunos pega isso como "Nome ausente"/"Email ausente",
// sinalizando que a planilha precisa da coluna nova.
function parseCsvAlunos(csvTexto) {
  // Colar do Excel sempre usa TAB entre colunas (independe de locale - so
  // "salvar como CSV" e locale-dependente); uma linha colada assim nao tem
  // virgula nenhuma, e o parser hardcoded em ',' jogava tudo pra matricula
  // e deixava nome/email vazios (bug real, achado pela Samela, 07/09/2026).
  const separador = String(csvTexto || '').includes('\t') ? '\t' : ',';
  const linhasBrutas = String(csvTexto || '').split('\n');
  const linhas = [];
  let primeiraNaoVazia = true;
  linhasBrutas.forEach((linha, i) => {
    const trimmed = linha.trim();
    if (!trimmed) return;
    if (primeiraNaoVazia) {
      primeiraNaoVazia = false;
      if (trimmed.split(separador)[0].trim().toLowerCase() === 'matricula') return;
    }
    const primeiraVirgula = trimmed.indexOf(separador);
    const ultimaVirgula = trimmed.lastIndexOf(separador);
    const temTresColunas = primeiraVirgula !== -1 && ultimaVirgula !== primeiraVirgula;
    const matricula = (primeiraVirgula === -1 ? trimmed : trimmed.slice(0, primeiraVirgula)).trim();
    const nome = temTresColunas ? trimmed.slice(primeiraVirgula + 1, ultimaVirgula).trim() : '';
    const email = temTresColunas ? trimmed.slice(ultimaVirgula + 1).trim() : '';
    linhas.push({ linha: i + 1, matricula, nome, email });
  });
  return linhas;
}

// Mesma regra de formato de matricula ja usada no login do aluno
// (LoginScreen.js: so numeros, minimo 6 digitos). Nao era conferida aqui -
// uma planilha colada com as colunas trocadas (nome,matricula em vez do
// matricula,nome esperado) passava disfarcada de "linha valida", porque os
// dois campos so precisavam estar nao-vazios (bug real, achado pela Samela,
// 07/09/2026). As duas checagens abaixo pegam o swap dos dois lados.
const MATRICULA_FORMATO = /^\d{6,}$/;
const NOME_SO_DIGITOS = /^\d+$/;

// Valida cada linha ja parseada: matricula/nome presentes, com formato
// plausivel (pega coluna trocada), sem duplicata dentro do proprio arquivo,
// e sem colidir com matricula ja existente no banco (recebida pronta em
// matriculasExistentes pra nao repetir SELECT por linha). Usada tanto no
// preview quanto na revalidacao da confirmacao.
function validarLinhasAlunos(linhasParsed, matriculasExistentes) {
  const vistos = new Set();
  return linhasParsed.map(l => {
    if (!l.matricula) return { ...l, status: 'erro', motivo: 'Matricula ausente.' };
    if (!l.nome) return { ...l, status: 'erro', motivo: 'Nome ausente.' };
    if (!l.email) return { ...l, status: 'erro', motivo: 'Email ausente.' };
    if (NOME_SO_DIGITOS.test(l.nome)) return { ...l, status: 'erro', motivo: 'Nome parece ser uma matricula (so numeros) - confira a ordem das colunas.' };
    if (!MATRICULA_FORMATO.test(l.matricula)) return { ...l, status: 'erro', motivo: 'Matricula deve conter so numeros (minimo 6 digitos).' };
    if (vistos.has(l.matricula)) return { ...l, status: 'erro', motivo: 'Matricula duplicada no arquivo.' };
    vistos.add(l.matricula);
    if (matriculasExistentes.has(l.matricula)) return { ...l, status: 'erro', motivo: 'Matricula ja cadastrada.' };
    return { ...l, status: 'ok' };
  });
}

// POST /api/usuarios – professor cadastra um aluno manualmente numa turma
// dele (item 4 do pedido da Marcia/Rita, 24/08/2026: autocadastro de aluno
// foi removido, ver POST /api/auth/registro). O codigo da turma e pedido
// aqui de proposito como segunda confirmacao, mesmo com a turma ja
// selecionada no Painel (pedido explicito da Rita) - evita cadastrar na
// turma errada por engano. Sem senha nesse momento: nasce com um hash
// placeholder inutilizavel (mesmo padrao do reset de senha abaixo) e um
// codigo de acesso de uso unico, que o professor entrega ao aluno pra ele
// definir a propria senha no primeiro acesso via POST /api/auth/resetar-senha
// (reaproveita o fluxo do A2 em vez de criar um "primeiro login" novo baseado
// so em matricula, que nao e segredo neste app - ver GET /api/ranking).
router.post('/', auth, requireProfessor, resolveTurmaId, async (req, res) => {
  const { nome, matricula, email, codigo_turma } = req.body;
  if (!nome || !matricula || !email || !codigo_turma) {
    return res.status(400).json({ erro: 'Nome, matricula, email e codigo da turma sao obrigatorios.' });
  }
  // Mesma checagem de formato do import (pega nome/matricula trocados no
  // formulario manual) - ver comentario de validarLinhasAlunos acima.
  if (NOME_SO_DIGITOS.test(nome)) {
    return res.status(400).json({ erro: 'Nome parece ser uma matricula (so numeros) - confira se os campos nao foram trocados.' });
  }
  if (!MATRICULA_FORMATO.test(matricula)) {
    return res.status(400).json({ erro: 'Matricula deve conter so numeros (minimo 6 digitos).' });
  }
  try {
    const turma = await pool.query('SELECT codigo FROM turmas WHERE id = $1', [req.turmaId]);
    if (turma.rows.length === 0 || turma.rows[0].codigo !== codigo_turma) {
      return res.status(400).json({ erro: 'Codigo da turma nao confere com a turma selecionada.' });
    }

    const existe = await pool.query('SELECT id FROM usuarios WHERE matricula = $1', [matricula]);
    if (existe.rows.length > 0) {
      return res.status(409).json({ erro: 'Matricula ja cadastrada.' });
    }

    const senhaTemporaria = crypto.randomBytes(24).toString('hex');
    const senha_hash = await bcrypt.hash(senhaTemporaria, 10);
    const result = await pool.query(
      `INSERT INTO usuarios (nome, matricula, email, senha_hash, modo, turma_id, senha_definida_pelo_aluno)
       VALUES ($1, $2, $3, $4, 'aluno', $5, false) RETURNING id, nome, matricula`,
      [nome, matricula, email, senha_hash, req.turmaId]
    );
    const usuario = result.rows[0];

    // Aluno novo nasce com a idade atual da turma, nao com o DEFAULT 90.
    // COALESCE: nunca grava NULL explicito (que furaria o DEFAULT da coluna).
    await pool.query(
      'INSERT INTO animal (usuario_id, age_days) VALUES ($1, COALESCE((SELECT age_days FROM turmas WHERE id = $2), 90))',
      [usuario.id, req.turmaId]
    );
    await pool.query('INSERT INTO ranking (usuario_id) VALUES ($1)', [usuario.id]);

    const codigo = await gerarCodigoAcesso(usuario.id, { expiraComTurma: true });
    const emailEnviado = await enviarCodigoEmail(email, usuario.nome, codigo);

    res.status(201).json({
      id: usuario.id,
      nome: usuario.nome,
      matricula: usuario.matricula,
      codigo,
      expira_com_turma: true,
      mensagem: 'Aluno cadastrado. Codigo enviado por e-mail - tambem mostrado abaixo, caso o envio falhe.',
      // Campo novo e opcional: so existe quando o envio falhou, pra resposta
      // de sucesso continuar identica a de antes.
      ...(emailEnviado ? {} : { aviso_email: 'O e-mail com o codigo nao foi enviado. Entregue o codigo ao aluno.' }),
    });
  } catch (err) {
    console.error('Erro ao cadastrar aluno:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// POST /api/usuarios/importar-preview – valida um CSV colado (matricula,nome)
// linha a linha, sem gravar nada. Mesma confirmacao por codigo_turma do
// cadastro manual (POST /), mas uma vez so pro lote inteiro - nao faz
// sentido repetir por linha numa planilha (pedido da Samela, 26/08/2026,
// pra nao ter que cadastrar aluno por aluno).
router.post('/importar-preview', auth, requireProfessor, resolveTurmaId, async (req, res) => {
  const { csv, codigo_turma } = req.body;
  if (!csv || !codigo_turma) {
    return res.status(400).json({ erro: 'CSV e codigo da turma sao obrigatorios.' });
  }
  try {
    const turma = await pool.query('SELECT codigo FROM turmas WHERE id = $1', [req.turmaId]);
    if (turma.rows.length === 0 || turma.rows[0].codigo !== codigo_turma) {
      return res.status(400).json({ erro: 'Codigo da turma nao confere com a turma selecionada.' });
    }

    const linhasParsed = parseCsvAlunos(csv);
    if (linhasParsed.length === 0) {
      return res.status(400).json({ erro: 'Nenhuma linha valida encontrada no CSV.' });
    }

    const matriculas = linhasParsed.map(l => l.matricula).filter(Boolean);
    const existentes = matriculas.length > 0
      ? await pool.query('SELECT matricula FROM usuarios WHERE matricula = ANY($1)', [matriculas])
      : { rows: [] };
    const existentesSet = new Set(existentes.rows.map(r => r.matricula));

    const resultado = validarLinhasAlunos(linhasParsed, existentesSet);
    res.json({ linhas: resultado, total: resultado.length, validas: resultado.filter(l => l.status === 'ok').length });
  } catch (err) {
    console.error('Erro ao pre-visualizar importacao:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// POST /api/usuarios/importar-confirmar – revalida (preview e confirmacao
// sao requests separados, o banco pode ter mudado no meio) e grava em lote
// os alunos ja validados. Aborta o lote inteiro se qualquer linha falhar na
// revalidacao, em vez de gravar so as validas - evita deixar a turma num
// estado parcial confuso pro professor (decisao da Rita, 26/08/2026).
router.post('/importar-confirmar', auth, requireProfessor, resolveTurmaId, async (req, res) => {
  const { alunos, codigo_turma } = req.body;
  if (!Array.isArray(alunos) || alunos.length === 0 || !codigo_turma) {
    return res.status(400).json({ erro: 'Lista de alunos e codigo da turma sao obrigatorios.' });
  }

  const client = await pool.connect();
  client.on('error', (err) => {
    console.error('Erro na conexao do client durante a transacao (importar alunos):', err.message);
  });

  try {
    const turma = await client.query('SELECT codigo FROM turmas WHERE id = $1', [req.turmaId]);
    if (turma.rows.length === 0 || turma.rows[0].codigo !== codigo_turma) {
      return res.status(400).json({ erro: 'Codigo da turma nao confere com a turma selecionada.' });
    }

    const linhasParsed = alunos.map((a, i) => ({
      linha: i + 1,
      matricula: String(a.matricula || '').trim(),
      nome: String(a.nome || '').trim(),
      email: String(a.email || '').trim(),
    }));
    const matriculas = linhasParsed.map(l => l.matricula).filter(Boolean);
    const existentes = matriculas.length > 0
      ? await client.query('SELECT matricula FROM usuarios WHERE matricula = ANY($1)', [matriculas])
      : { rows: [] };
    const existentesSet = new Set(existentes.rows.map(r => r.matricula));
    const revalidado = validarLinhasAlunos(linhasParsed, existentesSet);
    const invalidas = revalidado.filter(l => l.status !== 'ok');
    if (invalidas.length > 0) {
      return res.status(409).json({
        erro: 'Algumas linhas nao passaram na revalidacao - nada foi importado.',
        linhas: revalidado,
      });
    }

    await client.query('BEGIN');
    const criados = [];
    for (const { matricula, nome, email } of revalidado) {
      const senhaTemporaria = crypto.randomBytes(24).toString('hex');
      const senha_hash = await bcrypt.hash(senhaTemporaria, 10);
      const result = await client.query(
        `INSERT INTO usuarios (nome, matricula, email, senha_hash, modo, turma_id, senha_definida_pelo_aluno)
         VALUES ($1, $2, $3, $4, 'aluno', $5, false) RETURNING id, nome, matricula`,
        [nome, matricula, email, senha_hash, req.turmaId]
      );
      const usuario = result.rows[0];
      await client.query(
        'INSERT INTO animal (usuario_id, age_days) VALUES ($1, COALESCE((SELECT age_days FROM turmas WHERE id = $2), 90))',
        [usuario.id, req.turmaId]
      );
      await client.query('INSERT INTO ranking (usuario_id) VALUES ($1)', [usuario.id]);
      const codigo = await gerarCodigoAcesso(usuario.id, { expiraComTurma: true, queryable: client });
      criados.push({ id: usuario.id, nome: usuario.nome, matricula: usuario.matricula, email, codigo });
    }
    await client.query('COMMIT');

    // Fora da transacao de proposito - best effort, o envio nunca lanca.
    // Sequencial com pausa; repete uma vez so em rate_limit_exceeded; em cota
    // diaria/mensal esgotada ou sem chave para e marca os restantes como nao
    // enviados (tentar de novo so geraria mais recusas).
    const enviados = [];
    let interrompido = false;
    for (let i = 0; i < criados.length; i++) {
      const u = criados[i];
      if (interrompido) { enviados.push(false); continue; }
      if (i > 0) await esperar(PAUSA_ENTRE_EMAILS_MS);
      let envio = await enviarCodigoEmail.comMotivo(u.email, u.nome, u.codigo);
      if (!envio.ok && envio.erro === 'rate_limit_exceeded') {
        await esperar(ESPERA_ANTES_DE_REPETIR_MS);
        envio = await enviarCodigoEmail.comMotivo(u.email, u.nome, u.codigo);
      }
      if (!envio.ok && ERROS_QUE_INTERROMPEM_ENVIO.includes(envio.erro)) {
        interrompido = true;
        console.error(`Envio dos e-mails da importacao interrompido (${envio.erro}) - ${criados.length - i - 1} e-mail(s) restante(s) nao enviados.`);
      }
      enviados.push(envio.ok);
    }
    // aviso_email so nos alunos cujo envio falhou (mesmo campo opcional do POST /).
    const alunosResposta = criados.map((u, i) => (enviados[i] ? u : { ...u, aviso_email: 'E-mail nao enviado.' }));

    res.status(201).json({
      ok: true,
      total: criados.length,
      alunos: alunosResposta,
      mensagem: `${criados.length} aluno(s) importado(s) com sucesso. Codigos enviados por e-mail.`,
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Erro ao tentar ROLLBACK (conexao provavelmente ja perdida):', rollbackErr.message);
    }
    console.error('Erro ao importar alunos:', err.message);
    res.status(500).json({ erro: 'Erro interno ao importar alunos.' });
  } finally {
    client.release();
  }
});

// GET /api/usuarios – lista os alunos de uma turma do professor logado
// (precisa de turma_id explicito desde o item 3 - professor pode ter varias)
router.get('/', auth, requireProfessor, resolveTurmaId, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.nome, u.matricula, u.modo, u.criado_em, u.curso,
              r.xp_total, r.sessoes, r.media_saude
       FROM usuarios u
       LEFT JOIN ranking r ON r.usuario_id = u.id
       WHERE u.modo = 'aluno' AND u.turma_id = $1
       ORDER BY r.xp_total DESC NULLS LAST`,
      [req.turmaId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao listar usuarios:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// GET /api/usuarios/:id – perfil de um aluno (so da propria turma)
router.get('/:id', auth, requireProfessor, mesmaTurmaDoRecurso('usuarios'), async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT u.id, u.nome, u.matricula, u.modo, u.criado_em, u.curso,
              r.xp_total, r.sessoes, r.media_saude
       FROM usuarios u
       LEFT JOIN ranking r ON r.usuario_id = u.id
       WHERE u.id = $1`,
      [id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao buscar usuario:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// POST /api/usuarios/:id/reenviar-codigo – professor reenvia o codigo de
// primeiro acesso pro aluno (so da propria turma). So faz sentido enquanto o
// aluno ainda nao definiu a propria senha - nesse caso nao ha "senha atual"
// pra proteger, entao o codigo novo mantem a mesma politica de validade do
// cadastro/importacao original (expira so quando a turma for desativada), em
// vez dos 10 minutos do reset abaixo. O codigo em si nunca fica gravado em
// texto puro (so o hash), entao "reenviar" na pratica gera um codigo novo -
// a diferenca real pro reset e nao forcar o aluno a trocar de senha por causa
// disso (item 2 do feedback da Samela, 07/09/2026: a chavinha sempre
// resetava, mesmo quando o aluno so precisava do codigo de novo, matando o
// codigo original no processo).
router.post('/:id/reenviar-codigo', auth, requireProfessor, mesmaTurmaDoRecurso('usuarios'), async (req, res) => {
  const { id } = req.params;
  try {
    const usuario = await pool.query(
      `SELECT id, nome, email, senha_definida_pelo_aluno FROM usuarios WHERE id = $1 AND modo = 'aluno'`,
      [id]
    );
    if (usuario.rows.length === 0) {
      return res.status(404).json({ erro: 'Aluno nao encontrado.' });
    }
    const aluno = usuario.rows[0];
    if (aluno.senha_definida_pelo_aluno) {
      return res.status(400).json({ erro: 'Este aluno ja definiu a propria senha - use Resetar senha em vez de reenviar.' });
    }

    const codigo = await gerarCodigoAcesso(id, { expiraComTurma: true });
    const emailEnviado = await enviarCodigoEmail(aluno.email, aluno.nome, codigo);

    res.json({
      ok: true,
      codigo,
      expira_com_turma: true,
      mensagem: 'Codigo reenviado por e-mail - tambem mostrado abaixo, caso o envio falhe.',
      ...(emailEnviado ? {} : { aviso_email: 'O e-mail com o codigo nao foi enviado. Entregue o codigo ao aluno.' }),
    });
  } catch (err) {
    console.error('Erro ao reenviar codigo de acesso:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// PUT /api/usuarios/:id/resetar-senha – professor invalida a senha atual do
// aluno (so da propria turma) e gera um codigo de 6 digitos, valido por
// 10 min e de uso unico. O aluno usa esse codigo em POST /api/auth/resetar-senha
// pra definir a senha nova (ver A2 da auditoria de seguranca, 15/08/2026).
router.put('/:id/resetar-senha', auth, requireProfessor, mesmaTurmaDoRecurso('usuarios'), async (req, res) => {
  const { id } = req.params;
  try {
    const senhaTemporaria = crypto.randomBytes(24).toString('hex');
    const senha_hash = await bcrypt.hash(senhaTemporaria, 10);

    const result = await pool.query(
      `UPDATE usuarios SET senha_hash = $1, senha_definida_pelo_aluno = false
       WHERE id = $2 AND modo = 'aluno' RETURNING id, nome, matricula`,
      [senha_hash, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Aluno nao encontrado.' });
    }

    const codigo = await gerarCodigoAcesso(id);

    res.json({
      ok: true,
      codigo,
      expira_em_minutos: 10,
      mensagem: 'Codigo gerado. Mostre-o ao aluno - ele tem 10 minutos para usa-lo e definir uma senha nova.',
    });
  } catch (err) {
    console.error('Erro ao resetar senha do aluno:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// DELETE /api/usuarios/:id – professor deleta aluno (so da propria turma)
router.delete('/:id', auth, requireProfessor, mesmaTurmaDoRecurso('usuarios'), async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM usuarios WHERE id = $1 AND modo = $2', [id, 'aluno']);
    res.json({ ok: true, mensagem: 'Aluno removido com sucesso.' });
  } catch (err) {
    console.error('Erro ao deletar usuario:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// DELETE /api/usuarios – professor limpa todos os alunos de uma turma dele
router.delete('/', auth, requireProfessor, resolveTurmaId, async (req, res) => {
  try {
    await pool.query('DELETE FROM usuarios WHERE modo = $1 AND turma_id = $2', ['aluno', req.turmaId]);
    res.json({ ok: true, mensagem: 'Todos os alunos da turma foram removidos com sucesso.' });
  } catch (err) {
    console.error('Erro ao limpar alunos:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

module.exports = router;
