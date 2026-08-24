const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/connection');
const rateLimit = require('express-rate-limit');
const PostgresStore = require('../middleware/rateLimitStore');

// Limita tentativas de login/registro por IP, para dificultar forca bruta
// de senha (nenhuma rota de auth tinha throttling ate agora).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas. Tente novamente em alguns minutos.' },
  store: new PostgresStore(pool),
  // Render as vezes repassa X-Forwarded-For sem o IP real do cliente (so o do
  // proprio load balancer deles), o que fazia trust-proxy resolver um IP
  // diferente por conexao. CF-Connecting-IP e setado direto na borda da
  // Cloudflare (que fica na frente do Render mesmo no dominio padrao
  // *.onrender.com) e nao e alteravel pelo cliente - mais confiavel que
  // contar hops. req.ip fica so como fallback (ex: dev local sem Cloudflare).
  keyGenerator: (req) => req.headers['cf-connecting-ip'] || req.ip,
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  const { matricula, senha, modo } = req.body;

  if (!matricula || !senha || !modo) {
    return res.status(400).json({ erro: 'Matricula, senha e modo sao obrigatorios.' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM usuarios WHERE matricula = $1 AND modo = $2',
      [matricula, modo]
    );

    if (result.rows.length === 0) {
      // Mesma mensagem visivel de sempre (matricula nao e segredo nesse app -
      // ja aparece publica no ranking, GET /api/ranking - entao nao ha risco
      // real de enumeration em distinguir os dois casos), mas com um campo
      // extra pro frontend oferecer "criar conta" em vez de so um erro seco
      // (pedido da Rita, 21/08/2026, depois do teste da Samela).
      return res.status(401).json({ erro: 'Matricula ou senha invalidos.', motivo: 'conta_nao_encontrada' });
    }

    const usuario = result.rows[0];
    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);

    if (!senhaValida) {
      return res.status(401).json({ erro: 'Matricula ou senha invalidos.' });
    }

    // Aluno so consegue logar se a propria turma continuar ativa (item 2 do
    // pedido da Marcia/Rita, 24/08/2026) - desativar uma turma bloqueia
    // acesso de aluno (Modo Livre e Modo Sessao, ver auth.js middleware para
    // o corte de sessoes ja abertas). Professor nunca passa por essa
    // checagem, mantem acesso normal mesmo com a turma desativada.
    if (usuario.modo === 'aluno') {
      const turma = await pool.query('SELECT ativa FROM turmas WHERE id = $1', [usuario.turma_id]);
      if (turma.rows.length === 0 || !turma.rows[0].ativa) {
        return res.status(403).json({ erro: 'Sua turma foi desativada pelo professor.', motivo: 'turma_desativada' });
      }
    }

    const token = jwt.sign(
      { id: usuario.id, nome: usuario.nome, matricula: usuario.matricula, modo: usuario.modo, turma_id: usuario.turma_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        matricula: usuario.matricula,
        modo: usuario.modo,
        turma_id: usuario.turma_id,
      }
    });

  } catch (err) {
    console.error('Erro no login:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// POST /api/auth/registro
router.post('/registro', authLimiter, async (req, res) => {
  const { nome, matricula, senha, modo, codigo_turma, curso } = req.body;

  if (!nome || !matricula || !senha || !modo) {
    return res.status(400).json({ erro: 'Todos os campos sao obrigatorios.' });
  }

  // Codigo de turma obrigatorio para alunos e professores
  if (!codigo_turma) {
    return res.status(400).json({ erro: 'Codigo de turma e obrigatorio.' });
  }

  // Curso/instituicao e texto livre e opcional - so trunca pro limite da
  // coluna (VARCHAR(255)) pra nunca estourar o INSERT abaixo.
  const cursoLimpo = (curso || '').trim().slice(0, 255) || null;

  try {
    const existe = await pool.query(
      'SELECT id, modo FROM usuarios WHERE matricula = $1',
      [matricula]
    );

    if (existe.rows.length > 0) {
      // O "claim" antigo (definir senha nova so sabendo a matricula, sem
      // aprovacao de ninguem - codigo_turma nem era validado aqui) foi
      // removido na auditoria de seguranca (item A2, 15/08/2026). Ver
      // POST /api/auth/resetar-senha: agora exige um codigo curto gerado
      // por um professor da propria turma do aluno.
      return res.status(409).json({
        erro: modo === 'aluno' ? 'Matricula ja cadastrada. Verifique sua senha.' : 'Matricula ja cadastrada.'
      });
    }

    // Professor usa um codigo GLOBAL, unico para o app inteiro (env var,
    // item 3 do pedido da Marcia/Rita, 24/08/2026) - nao vinculado a turma
    // nenhuma. Ele cria a(s) propria(s) turma(s) depois, ja logado, pelo
    // Painel (aba Turmas); cada turma criada pertence so a ele
    // (turmas.criado_por), nunca compartilhada com outro professor. Aluno
    // continua usando o codigo publico da propria turma, como antes.
    let turma_id = null;
    if (modo === 'professor') {
      if (codigo_turma !== process.env.CODIGO_PROFESSOR_GLOBAL) {
        return res.status(400).json({ erro: 'Codigo de professor invalido.' });
      }
    } else {
      const turma = await pool.query(
        'SELECT id FROM turmas WHERE codigo = $1 AND ativa = true',
        [codigo_turma]
      );
      if (turma.rows.length === 0) {
        return res.status(400).json({ erro: 'Codigo de turma invalido ou turma inativa.' });
      }
      turma_id = turma.rows[0].id;
    }

    const senha_hash = await bcrypt.hash(senha, 10);

    const result = await pool.query(
      'INSERT INTO usuarios (nome, matricula, senha_hash, modo, turma_id, senha_definida_pelo_aluno, curso) VALUES ($1, $2, $3, $4, $5, true, $6) RETURNING id, nome, matricula, modo, turma_id, curso',
      [nome, matricula, senha_hash, modo, turma_id, cursoLimpo]
    );

    const usuario = result.rows[0];

    // Cria registro de animal para o aluno
    if (modo === 'aluno') {
      await pool.query(
        'INSERT INTO animal (usuario_id) VALUES ($1)',
        [usuario.id]
      );
      await pool.query(
        'INSERT INTO ranking (usuario_id) VALUES ($1)',
        [usuario.id]
      );
    }

    const token = jwt.sign(
      { id: usuario.id, nome: usuario.nome, matricula: usuario.matricula, modo: usuario.modo, turma_id: usuario.turma_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(201).json({
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        matricula: usuario.matricula,
        modo: usuario.modo,
        turma_id: usuario.turma_id,
        curso: usuario.curso,
      }
    });

  } catch (err) {
    console.error('Erro no registro:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// POST /api/auth/resetar-senha — aluno usa o codigo gerado pelo professor
// (PUT /api/usuarios/:id/resetar-senha) pra definir uma senha nova. Publica
// porque o aluno ainda nao tem credencial valida nesse momento; a seguranca
// vem do codigo (curto, mas uso unico, expira em 10min, e rate-limited
// abaixo), nao da matricula (que nao e segredo - ver GET /api/ranking).
router.post('/resetar-senha', authLimiter, async (req, res) => {
  const { matricula, codigo, nova_senha } = req.body;

  if (!matricula || !codigo || !nova_senha) {
    return res.status(400).json({ erro: 'Matricula, codigo e nova senha sao obrigatorios.' });
  }
  if (nova_senha.length < 4) {
    return res.status(400).json({ erro: 'A senha deve ter pelo menos 4 caracteres.' });
  }

  const erroGenerico = { erro: 'Codigo invalido ou expirado.' };

  try {
    const usuarioResult = await pool.query(
      `SELECT id FROM usuarios WHERE matricula = $1 AND modo = 'aluno'`,
      [matricula]
    );
    if (usuarioResult.rows.length === 0) {
      return res.status(401).json(erroGenerico);
    }
    const usuario_id = usuarioResult.rows[0].id;

    const tokenResult = await pool.query(
      `SELECT id, codigo_hash FROM reset_senha_tokens
       WHERE usuario_id = $1 AND usado_em IS NULL AND expira_em > NOW()
       ORDER BY criado_em DESC LIMIT 1`,
      [usuario_id]
    );
    if (tokenResult.rows.length === 0) {
      return res.status(401).json(erroGenerico);
    }
    const tokenRow = tokenResult.rows[0];

    const codigoValido = await bcrypt.compare(codigo, tokenRow.codigo_hash);
    if (!codigoValido) {
      return res.status(401).json(erroGenerico);
    }

    // Marca o token como usado de forma atomica (WHERE usado_em IS NULL) -
    // se duas requisicoes chegarem quase juntas com o mesmo codigo, so uma
    // consegue mudar a linha; a outra cai no erro generico abaixo.
    const consumido = await pool.query(
      `UPDATE reset_senha_tokens SET usado_em = NOW()
       WHERE id = $1 AND usado_em IS NULL RETURNING id`,
      [tokenRow.id]
    );
    if (consumido.rows.length === 0) {
      return res.status(401).json(erroGenerico);
    }

    const senha_hash = await bcrypt.hash(nova_senha, 10);
    const atualizado = await pool.query(
      `UPDATE usuarios SET senha_hash = $1, senha_definida_pelo_aluno = true
       WHERE id = $2 RETURNING id, nome, matricula, modo, turma_id`,
      [senha_hash, usuario_id]
    );
    const usuario = atualizado.rows[0];

    const token = jwt.sign(
      { id: usuario.id, nome: usuario.nome, matricula: usuario.matricula, modo: usuario.modo, turma_id: usuario.turma_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        matricula: usuario.matricula,
        modo: usuario.modo,
        turma_id: usuario.turma_id,
      }
    });
  } catch (err) {
    console.error('Erro ao redefinir senha:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

module.exports = router;