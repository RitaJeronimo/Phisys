const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { requireProfessor, mesmaTurmaDoRecurso, resolveTurmaId } = require('../middleware/turmaOwnership');

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

// Parseia um CSV colado (matricula,nome por linha) - sem lib nova, so split
// no primeiro "," pra deixar nome livre pra ter virgula se precisar. Pula
// uma linha de cabecalho se a primeira coluna for literalmente "matricula".
// Numero de linha reportado bate com o texto original colado (util pro
// professor achar o erro).
function parseCsvAlunos(csvTexto) {
  const linhasBrutas = String(csvTexto || '').split('\n');
  const linhas = [];
  let primeiraNaoVazia = true;
  linhasBrutas.forEach((linha, i) => {
    const trimmed = linha.trim();
    if (!trimmed) return;
    if (primeiraNaoVazia) {
      primeiraNaoVazia = false;
      if (trimmed.split(',')[0].trim().toLowerCase() === 'matricula') return;
    }
    const idx = trimmed.indexOf(',');
    const matricula = (idx === -1 ? trimmed : trimmed.slice(0, idx)).trim();
    const nome = (idx === -1 ? '' : trimmed.slice(idx + 1)).trim();
    linhas.push({ linha: i + 1, matricula, nome });
  });
  return linhas;
}

// Valida cada linha ja parseada: matricula/nome presentes, sem duplicata
// dentro do proprio arquivo, e sem colidir com matricula ja existente no
// banco (recebida pronta em matriculasExistentes pra nao repetir SELECT por
// linha). Usada tanto no preview quanto na revalidacao da confirmacao.
function validarLinhasAlunos(linhasParsed, matriculasExistentes) {
  const vistos = new Set();
  return linhasParsed.map(l => {
    if (!l.matricula) return { ...l, status: 'erro', motivo: 'Matricula ausente.' };
    if (!l.nome) return { ...l, status: 'erro', motivo: 'Nome ausente.' };
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
  const { nome, matricula, codigo_turma } = req.body;
  if (!nome || !matricula || !codigo_turma) {
    return res.status(400).json({ erro: 'Nome, matricula e codigo da turma sao obrigatorios.' });
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
      `INSERT INTO usuarios (nome, matricula, senha_hash, modo, turma_id, senha_definida_pelo_aluno)
       VALUES ($1, $2, $3, 'aluno', $4, false) RETURNING id, nome, matricula`,
      [nome, matricula, senha_hash, req.turmaId]
    );
    const usuario = result.rows[0];

    await pool.query('INSERT INTO animal (usuario_id) VALUES ($1)', [usuario.id]);
    await pool.query('INSERT INTO ranking (usuario_id) VALUES ($1)', [usuario.id]);

    const codigo = await gerarCodigoAcesso(usuario.id, { expiraComTurma: true });

    res.status(201).json({
      id: usuario.id,
      nome: usuario.nome,
      matricula: usuario.matricula,
      codigo,
      expira_com_turma: true,
      mensagem: 'Aluno cadastrado. Mostre o codigo a ele - fica valido ate a turma ser desativada.',
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
    for (const { matricula, nome } of revalidado) {
      const senhaTemporaria = crypto.randomBytes(24).toString('hex');
      const senha_hash = await bcrypt.hash(senhaTemporaria, 10);
      const result = await client.query(
        `INSERT INTO usuarios (nome, matricula, senha_hash, modo, turma_id, senha_definida_pelo_aluno)
         VALUES ($1, $2, $3, 'aluno', $4, false) RETURNING id, nome, matricula`,
        [nome, matricula, senha_hash, req.turmaId]
      );
      const usuario = result.rows[0];
      await client.query('INSERT INTO animal (usuario_id) VALUES ($1)', [usuario.id]);
      await client.query('INSERT INTO ranking (usuario_id) VALUES ($1)', [usuario.id]);
      const codigo = await gerarCodigoAcesso(usuario.id, { expiraComTurma: true, queryable: client });
      criados.push({ id: usuario.id, nome: usuario.nome, matricula: usuario.matricula, codigo });
    }
    await client.query('COMMIT');

    res.status(201).json({
      ok: true,
      total: criados.length,
      alunos: criados,
      mensagem: `${criados.length} aluno(s) importado(s) com sucesso.`,
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
