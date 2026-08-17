const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
});
pool.connect((err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err.message);
  } else {
    console.log('Conectado ao PostgreSQL com sucesso!');
  }
});

// Trata erros de conexao perdida (ex: ECONNRESET) sem derrubar o processo
// inteiro. Sem isso, uma instabilidade de rede momentanea com o banco remoto
// (Railway) encerrava o servidor Node por completo, exigindo reinicio manual.
pool.on('error', (err) => {
  console.error('Erro inesperado no pool de conexoes com o banco:', err.message);
});

module.exports = pool;