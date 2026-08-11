const pool = require('../db/connection');

// Um professor so pode agir sobre a PROPRIA turma (req.usuario.turma_id, vindo
// do token). Usado em toda rota "professor only" para substituir o antigo
// `if (modo !== 'professor')` isolado, que nunca verificava dono do recurso.
function requireProfessor(req, res, next) {
  if (req.usuario.modo !== 'professor') {
    return res.status(403).json({ erro: 'Acesso negado.' });
  }
  next();
}

// Factory de middleware: busca `tabela.colunaTurma` do registro identificado
// por `req.params.id` (comparado contra `colunaId`) e bloqueia se nao bater
// com a turma do professor logado. Guarda o valor em req.turmaIdRecurso para
// a rota reaproveitar (evita reconsultar dentro de uma transacao, por ex.).
function mesmaTurmaDoRecurso(tabela, colunaTurma = 'turma_id', colunaId = 'id') {
  return async (req, res, next) => {
    const { id } = req.params;
    try {
      const result = await pool.query(
        `SELECT ${colunaTurma} AS turma_id FROM ${tabela} WHERE ${colunaId} = $1`,
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ erro: 'Recurso nao encontrado.' });
      }
      const turma_id = result.rows[0].turma_id;
      if (Number(turma_id) !== Number(req.usuario.turma_id)) {
        return res.status(403).json({ erro: 'Acesso negado: recurso pertence a outra turma.' });
      }
      req.turmaIdRecurso = turma_id;
      next();
    } catch (err) {
      console.error(`Erro ao verificar turma do recurso (${tabela}):`, err.message);
      res.status(500).json({ erro: 'Erro interno do servidor.' });
    }
  };
}

module.exports = { requireProfessor, mesmaTurmaDoRecurso };
