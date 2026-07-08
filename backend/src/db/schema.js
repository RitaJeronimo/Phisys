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
        fc            NUMERIC DEFAULT 370,
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
    await pool.query(`ALTER TABLE animal ADD COLUMN IF NOT EXISTS age_days INTEGER DEFAULT 90`);
    await pool.query(`UPDATE animal SET fc = 370 WHERE fc = 75`);
    await pool.query(`ALTER TABLE desafios ADD COLUMN IF NOT EXISTS delta_acerto JSONB DEFAULT '{}'`);
    await pool.query(`ALTER TABLE desafios ADD COLUMN IF NOT EXISTS delta_erro JSONB DEFAULT '{}'`);
    await pool.query(`UPDATE animal SET fc = 370 WHERE fc < 100`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mensagens (
        id          SERIAL PRIMARY KEY,
        nivel       INTEGER NOT NULL UNIQUE,
        texto       TEXT NOT NULL,
        atualizado_em TIMESTAMP DEFAULT NOW()
      )
    `);

    // Registro de cada uso de cuidado diario (Trocar Agua, Alimentar, Limpar Maravalha)
    // usado para o cooldown de 2h (Modo Livre). A contagem por quantidade de vezes
    // (Modo Sessao) passou a usar um contador exato (ver cuidados_sessao_contagem
    // abaixo), em vez de comparar timestamps.
    // IMPORTANTE: TIMESTAMPTZ (com fuso horario) em vez de TIMESTAMP, para o
    // calculo de cooldown funcionar certo independente do fuso do servidor Postgres
    // vs o fuso de quem executa o backend (evita erro de +3h em Recife/UTC-3).
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cuidados_uso (
        id          SERIAL PRIMARY KEY,
        usuario_id  INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        cuidado_id  VARCHAR(50) NOT NULL,
        usado_em    TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cuidados_uso_usuario_cuidado ON cuidados_uso (usuario_id, cuidado_id)`);
    // Migra a coluna caso ja tenha sido criada como TIMESTAMP (execucao anterior)
    await pool.query(`ALTER TABLE cuidados_uso ALTER COLUMN usado_em TYPE TIMESTAMPTZ USING usado_em AT TIME ZONE 'UTC'`);

    // Marca quando cada simulacao foi ativada pela ultima vez. Mantido para
    // referencia/histórico, mas o Modo Sessao nao depende mais deste campo para
    // contar usos (ver cuidados_sessao_contagem abaixo).
    await pool.query(`ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS ativado_em TIMESTAMPTZ`);
    // O ADD COLUMN IF NOT EXISTS acima nao altera o tipo se a coluna ja existia
    // como TIMESTAMP (sem fuso) de uma execucao anterior - forca a conversao aqui.
    await pool.query(`ALTER TABLE simulacoes ALTER COLUMN ativado_em TYPE TIMESTAMPTZ USING ativado_em AT TIME ZONE 'UTC'`);
    
    // Configuracoes gerais editaveis pelo professor (chave/valor). Mantida por
    // compatibilidade, mas o controle de cuidados_por_sessao passou a ser feito
    // POR SIMULACAO (ver coluna abaixo), conforme pedido da Samela e da Marcia
    // em 07/07/2026: cada sessao criada tem sua propria quantidade, ajustada ao
    // foco da aula, dando ao professor controle total (nao aleatorio).
    await pool.query(`
      CREATE TABLE IF NOT EXISTS configuracoes (
        chave VARCHAR(50) PRIMARY KEY,
        valor VARCHAR(255) NOT NULL
      )
    `);
    await pool.query(`
      INSERT INTO configuracoes (chave, valor) VALUES ('cuidados_por_sessao', '3')
      ON CONFLICT (chave) DO NOTHING
    `);

    // Quantidade de cuidados diarios liberados POR SESSAO: cada simulacao tem
    // seu proprio valor, editavel pelo professor na hora de criar/editar aquela
    // simulacao especifica.
    await pool.query(`ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS cuidados_por_sessao INTEGER DEFAULT 3`);

    // Contador exato de usos por aluno + simulacao + cuidado, no Modo Sessao.
    // Substitui o calculo por comparacao de horario (usado_em >= inicio_sessao),
    // que se mostrou fragil (varios bugs de fuso horario ja encontrados nessa
    // area, e um bloqueio prematuro nao explicado em teste real). Aqui e uma
    // contagem direta: 1 linha por combinacao usuario+simulacao+cuidado,
    // incrementada a cada uso, sem depender de datas.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cuidados_sessao_contagem (
        usuario_id    INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        simulacao_id  INTEGER REFERENCES simulacoes(id) ON DELETE CASCADE,
        cuidado_id    VARCHAR(50) NOT NULL,
        quantidade    INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (usuario_id, simulacao_id, cuidado_id)
      )
    `);

    console.log('Colunas e tabelas adicionadas com sucesso!');
  } catch (err) {
    console.error('Erro ao adicionar colunas:', err.message);
  }
}
adicionarColunas();

module.exports = { criarTabelas };