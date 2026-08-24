const pool = require('../db/connection');

// Um professor so pode agir sobre turmas que ELE criou (turmas.criado_por).
// Usado em toda rota "professor only" para substituir o antigo
// `if (modo !== 'professor')` isolado, que nunca verificava dono do recurso.
function requireProfessor(req, res, next) {
  if (req.usuario.modo !== 'professor') {
    return res.status(403).json({ erro: 'Acesso negado.' });
  }
  next();
}

// Factory de middleware: busca `tabela.colunaTurma` do registro identificado
// por `req.params.id` (comparado contra `colunaId`), resolve a turma dona
// desse valor e bloqueia se `turmas.criado_por` nao bater com o professor
// logado. Guarda o valor em req.turmaIdRecurso para a rota reaproveitar
// (evita reconsultar dentro de uma transacao, por ex.).
//
// Desde o item 3 (24/08/2026: codigo de professor global, cada turma com um
// unico dono), um professor pode ser dono de VARIAS turmas - nao da mais pra
// comparar contra um turma_id fixo no token (req.usuario.turma_id, que so
// existe para aluno agora). A checagem de posse sempre passa por uma consulta
// a turmas.criado_por.
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
      const dono = await pool.query('SELECT criado_por FROM turmas WHERE id = $1', [turma_id]);
      if (dono.rows.length === 0 || Number(dono.rows[0].criado_por) !== Number(req.usuario.id)) {
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

// Resolve qual turma_id usar numa rota que le/escreve dados "da turma", sem
// um recurso com :id pra derivar isso (ex: listar alunos, ranking, pesos).
// Aluno sempre tem exatamente uma turma (vem pronta do token, como sempre
// foi). Professor pode ter varias desde o item 3 - precisa informar qual
// turma quer, via query (GET/DELETE) ou body (POST/PUT), e a posse e sempre
// verificada contra turmas.criado_por antes de deixar passar. Resultado fica
// em req.turmaId.
async function resolveTurmaId(req, res, next) {
  if (req.usuario.modo === 'aluno') {
    req.turmaId = req.usuario.turma_id;
    return next();
  }
  const turma_id = req.query.turma_id || req.body.turma_id;
  if (!turma_id) {
    return res.status(400).json({ erro: 'turma_id e obrigatorio.' });
  }
  try {
    const result = await pool.query('SELECT criado_por FROM turmas WHERE id = $1', [turma_id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Turma nao encontrada.' });
    }
    if (Number(result.rows[0].criado_por) !== Number(req.usuario.id)) {
      return res.status(403).json({ erro: 'Acesso negado: turma pertence a outro professor.' });
    }
    req.turmaId = Number(turma_id);
    next();
  } catch (err) {
    console.error('Erro ao resolver turma_id:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}

module.exports = { requireProfessor, mesmaTurmaDoRecurso, resolveTurmaId };
