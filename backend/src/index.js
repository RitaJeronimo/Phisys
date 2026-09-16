const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

require('./db/schema');

const app = express();

// Necessario para o express-rate-limit identificar o IP real do cliente por
// tras do proxy reverso do Render (sem isso, todo mundo cai no mesmo balde).
app.set('trust proxy', 1);

// Restringe CORS ao frontend real (item B1 da auditoria de seguranca,
// 15/08/2026): app.use(cors()) sem opcoes libera Access-Control-Allow-Origin: *
// pra qualquer site. Em dev, libera localhost:3000 (servidor padrao do CRA).
// CORS_PREVIEW_ORIGIN e opcional e serve so pra liberar temporariamente um
// deploy de preview (ex: Vercel) pra teste - sem a env var setada no Render,
// o comportamento e identico ao validado no B1. Setar so enquanto durar o
// teste e apagar a env var depois, nunca deixar fixo no codigo.
const ALLOWED_ORIGINS = process.env.NODE_ENV === 'production'
  ? [
      'https://phisys.vercel.app',
      ...(process.env.CORS_PREVIEW_ORIGIN ? [process.env.CORS_PREVIEW_ORIGIN] : []),
    ]
  : ['http://localhost:3000'];
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/animal', require('./routes/animal'));
app.use('/api/desafios', require('./routes/desafios'));
app.use('/api/ranking', require('./routes/ranking'));
app.use('/api/sessoes', require('./routes/sessoes'));
app.use('/api/simulacoes', require('./routes/simulacoes'));
app.use('/api/mensagens', require('./routes/mensagens'));
app.use('/api/configuracoes', require('./routes/configuracoes'));
app.use('/api/turmas', require('./routes/turmas'));
app.use('/api/parametros', require('./routes/parametros'));
app.use('/api/acessos', require('./routes/acessos'));

app.get('/', (req, res) => {
  res.json({ status: 'Phisys API rodando!', version: '1.0.0' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

module.exports = app;