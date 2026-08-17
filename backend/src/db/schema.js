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

      -- TURMAS
      CREATE TABLE IF NOT EXISTS turmas (
        id          SERIAL PRIMARY KEY,
        nome        VARCHAR(255) NOT NULL,
        codigo      VARCHAR(50)  UNIQUE NOT NULL,
        ativa       BOOLEAN DEFAULT TRUE,
        criado_em   TIMESTAMP DEFAULT NOW()
      );

      -- ANIMAL (estado fisiolÃ³gico por aluno)
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

async function adicionarColunas() {
  try {
    // Sistema de turmas (pedido da Márcia, 04/08/2026): 5+ turmas com ranking,
    // simulações e desafios isolados entre si. O professor cadastra/gerencia
    // as turmas pelo próprio Painel do Professor (aba Turmas), sem depender
    // de alteração manual no banco a cada turma nova.
    await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS turma_id INTEGER REFERENCES turmas(id) ON DELETE SET NULL`);
    await pool.query(`ALTER TABLE desafios ADD COLUMN IF NOT EXISTS turma_id INTEGER REFERENCES turmas(id) ON DELETE CASCADE`);
    await pool.query(`ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS turma_id INTEGER REFERENCES turmas(id) ON DELETE CASCADE`);
    // Codigo separado para registro de professor (item 1 da auditoria de seguranca,
    // 09/08/2026): antes, professor se registrava com o MESMO codigo publico dado
    // aos alunos, permitindo que qualquer aluno virasse professor. Turmas existentes
    // ficam com codigo_professor NULL ate o professor definir um pelo Painel.
    await pool.query(`ALTER TABLE turmas ADD COLUMN IF NOT EXISTS codigo_professor VARCHAR(50) UNIQUE`);
    await pool.query(`ALTER TABLE ranking ADD COLUMN IF NOT EXISTS nota_final NUMERIC DEFAULT NULL`);
    // Senha real do aluno (item 2 da auditoria de seguranca, 09/08/2026): antes a
    // "senha" era so matricula + "_phisys", calculavel por qualquer um que soubesse
    // a matricula. Contas ja existentes ficam com esta flag em FALSE (o valor padrao
    // do ALTER TABLE se aplica a todas as linhas ja existentes), o que libera, so na
    // proxima tentativa de login de cada uma, a definicao de uma senha real via
    // POST /api/auth/registro (ver comentario la). Contas novas ja nascem com TRUE.
    await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS senha_definida_pelo_aluno BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE animal ADD COLUMN IF NOT EXISTS age_days INTEGER DEFAULT 90`);
    await pool.query(`UPDATE animal SET fc = 370 WHERE fc = 75`);
    await pool.query(`ALTER TABLE desafios ADD COLUMN IF NOT EXISTS delta_acerto JSONB DEFAULT '{}'`);
    await pool.query(`ALTER TABLE desafios ADD COLUMN IF NOT EXISTS delta_erro JSONB DEFAULT '{}'`);
    await pool.query(`UPDATE animal SET fc = 370 WHERE fc < 100`);
    // Auto-heal analogo ao de fc acima: pas/pad so eram corrigidos client-side
    // (App.js) e o valor corrigido era escrito de volta via PUT /api/animal -
    // rota removida na auditoria de seguranca (A1) por permitir escrita
    // arbitraria. Sem isso aqui, uma linha corrompida ficaria assim para sempre.
    await pool.query(`UPDATE animal SET pas = 110 WHERE pas < 60`);
    await pool.query(`UPDATE animal SET pad = 70 WHERE pad < 40`);
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

    // Quantidade de cuidados diarios liberados POR SESSAO: cada simulacao tem
    // seu proprio valor, editavel pelo professor na hora de criar/editar aquela
    // simulacao especifica.
    await pool.query(`ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS cuidados_por_sessao INTEGER DEFAULT 3`);

    // Escopa configuracoes por turma (item M3 da auditoria de seguranca,
    // 15/08/2026): pesos da nota e config de recuperacao eram uma unica
    // linha global por chave - qualquer professor de qualquer turma
    // sobrescrevia o que TODAS as turmas liam (GameScreen/FinalScreen do
    // aluno tambem leem isso). O antigo seed/rotas de 'cuidados_por_sessao'
    // (legado, ja superado por simulacoes.cuidados_por_sessao) foram
    // removidos - sem chamador no frontend, e dependiam da PK antiga (so
    // "chave") que precisa virar composta (chave, turma_id) pra permitir
    // uma linha por turma.
    await pool.query(`ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS turma_id INTEGER REFERENCES turmas(id) ON DELETE CASCADE`);
    await pool.query(`DELETE FROM configuracoes WHERE turma_id IS NULL`);
    await pool.query(`ALTER TABLE configuracoes DROP CONSTRAINT IF EXISTS configuracoes_pkey`);
    await pool.query(`ALTER TABLE configuracoes ALTER COLUMN turma_id SET NOT NULL`);
    // ADD CONSTRAINT nao tem IF NOT EXISTS no Postgres - sem esse guard, a
    // segunda execucao deste arquivo (proximo boot) quebraria aqui com
    // "constraint already exists" e abortaria o resto de adicionarColunas().
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'configuracoes_chave_turma_key'
        ) THEN
          ALTER TABLE configuracoes ADD CONSTRAINT configuracoes_chave_turma_key UNIQUE (chave, turma_id);
        END IF;
      END $$;
    `);

    // Identifica qual crise/intervencao especifica a simulacao representa
    // (mesmo vocabulario usado em desafios.intervencao: desidratacao,
    // hipertensao, bradicardia, etc.). Usado para filtrar os desafios
    // mostrados ao aluno, garantindo coerencia com a crise ativa - decisao
    // da Marcia e da Samela (16/07/2026): priorizar coerencia em vez de
    // variedade, para nao desestimular o aluno com desafios incoerentes
    // com o estado atual do animal.
    await pool.query(`ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS intervencao VARCHAR(50)`);

    // Rastreia quem criou cada turma (item M2 da auditoria de seguranca,
    // 15/08/2026): necessario pra limitar quantas turmas cada professor pode
    // criar por dia, sem isso nao da pra saber de quem contar. Turmas
    // existentes ficam com criado_por NULL - nao contam contra ninguem, o que
    // e o comportamento certo (nao sabemos quem criou).
    await pool.query(`ALTER TABLE turmas ADD COLUMN IF NOT EXISTS criado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL`);

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

    // Store compartilhado do rate limiter de login/registro (item M1 da auditoria
    // de seguranca): o MemoryStore padrao do express-rate-limit fica isolado por
    // processo, e testes em producao (14/08/2026) mostraram contagem inconsistente
    // entre requisicoes do mesmo IP - evidencia de mais de um processo atendendo o
    // backend no Render. Uma tabela compartilhada resolve isso independente de
    // quantos processos existirem.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rate_limit_hits (
        chave     VARCHAR(255) PRIMARY KEY,
        contagem  INTEGER NOT NULL DEFAULT 0,
        expira_em TIMESTAMPTZ NOT NULL
      )
    `);

    // Codigos curtos de reset de senha (item A2 da auditoria de seguranca,
    // 15/08/2026): substitui o "claim" antigo (bastava saber a matricula e
    // mandar qualquer coisa em codigo_turma, sem aprovacao de ninguem) por um
    // fluxo em duas etapas - so o professor da turma pode gerar um codigo
    // (PUT /api/usuarios/:id/resetar-senha), e so quem tiver esse codigo
    // (mostrado em sala, valido por 10 min, uso unico) consegue definir a
    // nova senha (POST /api/auth/resetar-senha).
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reset_senha_tokens (
        id          SERIAL PRIMARY KEY,
        usuario_id  INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        codigo_hash VARCHAR(255) NOT NULL,
        criado_em   TIMESTAMPTZ DEFAULT NOW(),
        expira_em   TIMESTAMPTZ NOT NULL,
        usado_em    TIMESTAMPTZ
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_reset_senha_tokens_usuario ON reset_senha_tokens (usuario_id)`);

    // Parametros fisiologicos customizados (pedido da Marcia, 17/08/2026): cada
    // professor pode cadastrar tipos de parametro extras, especificos da propria
    // turma (nunca compartilhados entre turmas/professores). O valor de cada um
    // muda a cada simulacao lancada, entao fica em tabela separada ligada a
    // simulacao especifica, em vez de fixo na definicao do parametro. Sao so
    // exibicao para o aluno: nunca entram em calcularSaude nem em nenhum outro
    // calculo do motor fisiologico.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS parametros_customizados (
        id          SERIAL PRIMARY KEY,
        turma_id    INTEGER REFERENCES turmas(id) ON DELETE CASCADE,
        nome        VARCHAR(100) NOT NULL,
        unidade     VARCHAR(20),
        valor_min   NUMERIC,
        valor_max   NUMERIC,
        ativo       BOOLEAN DEFAULT TRUE,
        criado_em   TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    // ativo=false em vez de excluir de verdade: preserva o historico de valores
    // ja registrados em parametros_valores mesmo depois que o professor "remove"
    // um tipo de parametro. UNIQUE(parametro_id, simulacao_id) faz relancar a
    // mesma simulacao SOBRESCREVER o valor anterior (upsert), em vez de manter
    // historico por tentativa - decisao deliberada da Rita (17/08/2026), pode
    // evoluir para um conceito de "ativacao" separado se um dia for preciso
    // comparar tentativas.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS parametros_valores (
        id            SERIAL PRIMARY KEY,
        parametro_id  INTEGER REFERENCES parametros_customizados(id) ON DELETE CASCADE,
        simulacao_id  INTEGER REFERENCES simulacoes(id) ON DELETE CASCADE,
        valor         NUMERIC NOT NULL,
        registrado_em TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(parametro_id, simulacao_id)
      )
    `);

    console.log('Colunas e tabelas adicionadas com sucesso!');
  } catch (err) {
    console.error('Erro ao adicionar colunas:', err.message);
  }
}

// CORRECAO: antes, criarTabelas() e adicionarColunas() eram chamadas em
// sequencia mas SEM await, rodando na pratica em paralelo. Em um banco novo
// (sem as tabelas ainda existindo), adicionarColunas() podia executar antes
// de criarTabelas() terminar de criar a tabela "ranking", causando erro
// "relation does not exist". Agora garantimos a ordem certa.
(async () => {
  await criarTabelas();
  await adicionarColunas();
})();

module.exports = { criarTabelas };