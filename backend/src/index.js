const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

require('./db/schema');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/animal',   require('./routes/animal'));
app.use('/api/desafios', require('./routes/desafios'));
app.use('/api/ranking',  require('./routes/ranking'));
app.use('/api/sessoes',  require('./routes/sessoes'));
app.use('/api/simulacoes', require('./routes/simulacoes'));
app.use('/api/mensagens', require('./routes/mensagens'));

app.get('/', (req, res) => {
  res.json({ status: 'Phisys API rodando!', version: '1.0.0' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

module.exports = app;