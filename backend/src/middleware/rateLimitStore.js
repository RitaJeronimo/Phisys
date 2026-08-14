// Store compartilhado (Postgres) para o express-rate-limit, usado nas rotas de
// login/registro. O MemoryStore padrao guarda a contagem na memoria do processo
// Node - se mais de um processo atende o backend (caso observado em producao no
// Render em 14/08/2026: contagem nao-monotonica mesmo reaproveitando a mesma
// conexao TCP), cada processo tem seu proprio contador e o limite real acaba
// sendo maior que o configurado. Guardando a contagem no Postgres, qualquer
// processo le/escreve o mesmo valor.
class PostgresStore {
  constructor(pool) {
    this.pool = pool;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async increment(key) {
    const expiraEm = new Date(Date.now() + this.windowMs);
    const result = await this.pool.query(
      `INSERT INTO rate_limit_hits (chave, contagem, expira_em)
       VALUES ($1, 1, $2)
       ON CONFLICT (chave) DO UPDATE SET
         contagem = CASE WHEN rate_limit_hits.expira_em <= NOW() THEN 1
                         ELSE rate_limit_hits.contagem + 1 END,
         expira_em = CASE WHEN rate_limit_hits.expira_em <= NOW() THEN $2
                          ELSE rate_limit_hits.expira_em END
       RETURNING contagem, expira_em`,
      [key, expiraEm]
    );
    const row = result.rows[0];
    return { totalHits: row.contagem, resetTime: row.expira_em };
  }

  async decrement(key) {
    await this.pool.query(
      `UPDATE rate_limit_hits SET contagem = GREATEST(contagem - 1, 0) WHERE chave = $1`,
      [key]
    );
  }

  async resetKey(key) {
    await this.pool.query(`DELETE FROM rate_limit_hits WHERE chave = $1`, [key]);
  }
}

module.exports = PostgresStore;
