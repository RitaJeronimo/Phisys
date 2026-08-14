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
      return res.status(401).json({ erro: 'Matricula ou senha invalidos.' });
    }

    const usuario = result.rows[0];
    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);

    if (!senhaValida) {
      return res.status(401).json({ erro: 'Matricula ou senha invalidos.' });
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
  const { nome, matricula, senha, modo, codigo_turma } = req.body;

  if (!nome || !matricula || !senha || !modo) {
    return res.status(400).json({ erro: 'Todos os campos sao obrigatorios.' });
  }

  // Codigo de turma obrigatorio para alunos e professores
  if (!codigo_turma) {
    return res.status(400).json({ erro: 'Codigo de turma e obrigatorio.' });
  }

  try {
    const existe = await pool.query(
      'SELECT id, modo, senha_definida_pelo_aluno FROM usuarios WHERE matricula = $1',
      [matricula]
    );

    if (existe.rows.length > 0) {
      const existente = existe.rows[0];
      // Conta de aluno criada antes de existir senha real: a "senha" era so um
      // valor calculado a partir da matricula, entao o aluno nunca escolheu nada.
      // Deixa reivindicar a conta pela matricula (unico dado que ja existia) e
      // definir uma senha de verdade agora. So funciona enquanto a flag estiver
      // false - depois disso (ou apos um reset do professor) exige a senha certa.
      if (modo === 'aluno' && existente.modo === 'aluno' && existente.senha_definida_pelo_aluno === false) {
        const senha_hash = await bcrypt.hash(senha, 10);
        const atualizado = await pool.query(
          `UPDATE usuarios SET senha_hash = $1, senha_definida_pelo_aluno = true
           WHERE id = $2 RETURNING id, nome, matricula, modo, turma_id`,
          [senha_hash, existente.id]
        );
        const usuario = atualizado.rows[0];
        const token = jwt.sign(
          { id: usuario.id, nome: usuario.nome, matricula: usuario.matricula, modo: usuario.modo, turma_id: usuario.turma_id },
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRES_IN }
        );
        return res.status(200).json({
          token,
          usuario: {
            id: usuario.id,
            nome: usuario.nome,
            matricula: usuario.matricula,
            modo: usuario.modo,
            turma_id: usuario.turma_id,
          }
        });
      }
      return res.status(409).json({
        erro: modo === 'aluno' ? 'Matricula ja cadastrada. Verifique sua senha.' : 'Matricula ja cadastrada.'
      });
    }

    // Alunos usam o codigo publico da turma; professores usam um codigo
    // separado (codigo_professor), conhecido apenas pelos professores da
    // turma - evita que qualquer aluno vire professor com o mesmo codigo
    // que a turma inteira recebe.
    const campoCodigo = modo === 'professor' ? 'codigo_professor' : 'codigo';
    const turma = await pool.query(
      `SELECT id FROM turmas WHERE ${campoCodigo} = $1 AND ativa = true`,
      [codigo_turma]
    );
    if (turma.rows.length === 0) {
      return res.status(400).json({
        erro: modo === 'professor'
          ? 'Codigo de professor invalido ou turma inativa.'
          : 'Codigo de turma invalido ou turma inativa.'
      });
    }
    const turma_id = turma.rows[0].id;

    const senha_hash = await bcrypt.hash(senha, 10);

    const result = await pool.query(
      'INSERT INTO usuarios (nome, matricula, senha_hash, modo, turma_id, senha_definida_pelo_aluno) VALUES ($1, $2, $3, $4, $5, true) RETURNING id, nome, matricula, modo, turma_id',
      [nome, matricula, senha_hash, modo, turma_id]
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
      }
    });

  } catch (err) {
    console.error('Erro no registro:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

module.exports = router;