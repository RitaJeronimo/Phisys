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
const ALLOWED_ORIGINS = process.env.NODE_ENV === 'production'
  ? ['https://phisys.vercel.app']
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

app.get('/', (req, res) => {
  res.json({ status: 'Phisys API rodando!', version: '1.0.0' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

module.exports = app;