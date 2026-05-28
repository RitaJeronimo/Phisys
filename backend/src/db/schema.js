const pool = require('./connection');

async function criarTabelas() {
  try {
    await pool.query(`
      -- USUÁRIOS (alunos e professores)
      CREATE TABLE IF NOT EXISTS usuarios (
        id          SERIAL PRIMARY KEY,
        nome        VARCHAR(255) NOT NULL,
        matricula   VARCHAR(50)  UNIQUE NOT NULL,
        senha_hash  VARCHAR(255) NOT NULL,
        modo        VARCHAR(20)  NOT NULL CHECK (modo IN ('aluno', 'professor')),
        criado_em   TIMESTAMP DEFAULT NOW()
      );

      -- ANIMAL (estado fisiológico por aluno)
      CREATE TABLE IF NOT EXISTS animal (
        id            SERIAL PRIMARY KEY,
        usuario_id    INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        energia       NUMERIC DEFAULT 80,
        hidratacao    NUMERIC DEFAULT 70,
        pas           NUMERIC DEFAULT 110,
        pad           NUMERIC DEFAULT 70,
        fc            NUMERIC DEFAULT 75,
        peso          NUMERIC DEFAULT 300,
        saude         NUMERIC DEFAULT 85,
        age_days      INTEGER DEFAULT 90,
        atualizado_em TIMESTAMP DEFAULT NOW(),
        UNIQUE(usuario_id)
      );

      -- SESSÕES
      CREATE TABLE IF NOT EXISTS sessoes (
        id                SERIAL PRIMARY KEY,
        usuario_id        INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        iniciada_em       TIMESTAMP DEFAULT NOW(),
        finalizada_em     TIMESTAMP,
        duracao_segundos  INTEGER,
        xp_total          INTEGER DEFAULT 0,
        saude_final       NUMERIC,
        nivel_motivacao   INTEGER,
        modo              VARCHAR(20)
      );

      -- DESAFIOS
      CREATE TABLE IF NOT EXISTS desafios (
        id            SERIAL PRIMARY KEY,
        titulo        VARCHAR(255) NOT NULL,
        pergunta      TEXT NOT NULL,
        opcoes        JSONB NOT NULL,
        correta       INTEGER NOT NULL,
        foco          VARCHAR(50),
        dificuldade   VARCHAR(20),
        intervencao   VARCHAR(50),
        ativo         BOOLEAN DEFAULT TRUE,
        criado_em     TIMESTAMP DEFAULT NOW()
      );

      -- RESPOSTAS DOS ALUNOS
      CREATE TABLE IF NOT EXISTS respostas (
        id            SERIAL PRIMARY KEY,
        sessao_id     INTEGER REFERENCES sessoes(id) ON DELETE CASCADE,
        desafio_id    INTEGER REFERENCES desafios(id),
        resposta      INTEGER NOT NULL,
        correta       BOOLEAN NOT NULL,
        tempo_segundos NUMERIC,
        respondido_em TIMESTAMP DEFAULT NOW()
      );

      -- SIMULAÇÕES
      CREATE TABLE IF NOT EXISTS simulacoes (
        id          SERIAL PRIMARY KEY,
        titulo      VARCHAR(255) NOT NULL,
        descricao   TEXT,
        foco        VARCHAR(50),
        params      JSONB NOT NULL,
        ativo       BOOLEAN DEFAULT TRUE,
        criado_em   TIMESTAMP DEFAULT NOW()
      );

      -- RANKING
      CREATE TABLE IF NOT EXISTS ranking (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
  xp_total    INTEGER DEFAULT 0,
  sessoes     INTEGER DEFAULT 0,
  media_saude NUMERIC DEFAULT 0,
  nota_final  NUMERIC DEFAULT NULL,
  atualizado_em TIMESTAMP DEFAULT NOW(),
  UNIQUE(usuario_id)
);
    `);

    console.log('Tabelas criadas com sucesso!');
  } catch (err) {
    console.error('Erro ao criar tabelas:', err.message);
  }
}

criarTabelas();

async function adicionarColunas() {
  try {
    await pool.query(`ALTER TABLE ranking ADD COLUMN IF NOT EXISTS nota_final NUMERIC DEFAULT NULL`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mensagens (
        id          SERIAL PRIMARY KEY,
        nivel       INTEGER NOT NULL UNIQUE,
        texto       TEXT NOT NULL,
        atualizado_em TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Colunas e tabelas adicionadas com sucesso!');
  } catch (err) {
    console.error('Erro ao adicionar colunas:', err.message);
  }
}
adicionarColunas();

module.exports = { criarTabelas };