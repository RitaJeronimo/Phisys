const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Rotas
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/animal',   require('./routes/animal'));
app.use('/api/desafios', require('./routes/desafios'));
app.use('/api/ranking',  require('./routes/ranking'));
app.use('/api/sessoes',  require('./routes/sessoes'));

// Rota de teste
app.get('/', (req, res) => {
  res.json({ status: 'Phisys API rodando!', version: '1.0.0' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

module.exports = app;