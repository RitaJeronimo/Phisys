const jwt = require('jsonwebtoken');
const pool = require('../db/connection');

async function auth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ erro: 'Token nao fornecido.', motivo: 'token_invalido' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(403).json({ erro: 'Token invalido ou expirado.', motivo: 'token_invalido' });
  }

  // Aluno so continua com acesso enquanto a propria turma estiver ativa
  // (item 2 do pedido da Marcia/Rita, 24/08/2026) - cobre tanto Modo Livre
  // quanto Modo Sessao de uma vez, ja que os dois sao so estados de uma
  // mesma sessao autenticada (mesmo achado do item 4), nao caminhos de auth
  // separados. Corta na hora uma sessao ja aberta quando o professor
  // desativa a turma, nao so bloqueia login novo (ver POST /auth/login).
  // Professor nunca passa por aqui - mantem acesso total mesmo com a turma
  // desativada.
  if (decoded.modo === 'aluno') {
    try {
      const result = await pool.query('SELECT ativa FROM turmas WHERE id = $1', [decoded.turma_id]);
      if (result.rows.length === 0 || !result.rows[0].ativa) {
        return res.status(403).json({ erro: 'Sua turma foi desativada pelo professor.', motivo: 'turma_desativada' });
      }
    } catch (err) {
      console.error('Erro ao verificar turma ativa:', err.message);
      return res.status(500).json({ erro: 'Erro interno do servidor.' });
    }
  }

  req.usuario = decoded;
  next();
}

module.exports = auth;