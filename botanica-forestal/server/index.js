const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { router: authRouter } = require('./routes/auth');
const especimenesRouter = require('./routes/especimenes');
const imagenesRouter = require('./routes/imagenes');

const app = express();

app.use(express.static(path.join(__dirname, '../renderer')))
app.use(cors());
app.use(express.json());

// Sirve las imágenes subidas
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api/auth', authRouter);
app.use('/api/especimenes', especimenesRouter);
app.use('/api/imagenes', imagenesRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.SERVER_PORT || 3000;

function startServer() {
  return app.listen(PORT, () => {
    console.log(`Servidor de Botánica Forestal escuchando en http://localhost:${PORT}`);
  });
}

// Si se ejecuta directamente (node server/index.js), arranca solo.
// Si se importa desde main.js (Electron), solo exporta la función.
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
