const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/connection');

// POST /api/auth/login
router.post('/login', async (req, res) => {
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
      { id: usuario.id, nome: usuario.nome, matricula: usuario.matricula, modo: usuario.modo },
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
      }
    });

  } catch (err) {
    console.error('Erro no login:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// POST /api/auth/registro
router.post('/registro', async (req, res) => {
  const { nome, matricula, senha, modo } = req.body;

  if (!nome || !matricula || !senha || !modo) {
    return res.status(400).json({ erro: 'Todos os campos sao obrigatorios.' });
  }

  try {
    const existe = await pool.query(
      'SELECT id FROM usuarios WHERE matricula = $1',
      [matricula]
    );

    if (existe.rows.length > 0) {
      return res.status(409).json({ erro: 'Matricula ja cadastrada.' });
    }

    const senha_hash = await bcrypt.hash(senha, 10);

    const result = await pool.query(
      'INSERT INTO usuarios (nome, matricula, senha_hash, modo) VALUES ($1, $2, $3, $4) RETURNING id, nome, matricula, modo',
      [nome, matricula, senha_hash, modo]
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
      { id: usuario.id, nome: usuario.nome, matricula: usuario.matricula, modo: usuario.modo },
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
      }
    });

  } catch (err) {
    console.error('Erro no registro:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

module.exports = router;