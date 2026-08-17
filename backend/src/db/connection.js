const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
});
// Usa pool.query (nao pool.connect) de proposito: pool.connect() retorna um
// client "checked-out" que precisa ser liberado manualmente (client.release()
// ou done()) - o codigo original nunca fazia isso, vazando um client pra
// sempre, fora do controle do pool, sem nenhum listener de erro (o
// pool.on('error') abaixo so cobre clients OCIOSOS dentro do pool). Quando o
// Neon derrubava essa conexao vazada, o processo inteiro crashava com um
// evento 'error' nao tratado, sem nenhuma rota/request no stack trace -
// achado ao vivo em teste local, 17/08/2026. pool.query() ja libera o client
// e trata erro de conexao sozinho (mesmo caminho seguro usado em toda rota).
pool.query('SELECT 1')
  .then(() => console.log('Conectado ao PostgreSQL com sucesso!'))
  .catch((err) => console.error('Erro ao conectar ao banco de dados:', err.message));

// Trata erros de conexao perdida (ex: ECONNRESET) sem derrubar o processo
// inteiro. Sem isso, uma instabilidade de rede momentanea com o banco remoto
// (Railway) encerrava o servidor Node por completo, exigindo reinicio manual.
pool.on('error', (err) => {
  console.error('Erro inesperado no pool de conexoes com o banco:', err.message);
});

module.exports = pool;