const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
require('dotenv').config();

const { router: authRouter } = require('./routes/auth');
const especimenesRouter = require('./routes/especimenes');
const imagenesRouter = require('./routes/imagenes');

const app = express();

// ===== App de claves dicotómicas =====
// Todo lo que llegue a /claves se reenvía al servidor de claves (puerto 3001).
// Va antes de los demás middlewares para que el cuerpo de las peticiones llegue intacto.
const CLAVES_PUERTO = process.env.CLAVES_PORT || 3001;

app.use('/claves', (req, res) => {
  const proxy = http.request({
    hostname: '127.0.0.1',
    port: CLAVES_PUERTO,
    path: req.originalUrl,
    method: req.method,
    headers: req.headers
  }, respuesta => {
    res.writeHead(respuesta.statusCode, respuesta.headers);
    respuesta.pipe(res);
  });

  proxy.on('error', () => {
    if (!res.headersSent) {
      res.status(502).type('html').send(
        '<h1>La aplicación de claves no está disponible</h1>' +
        '<p>Revisa que el servidor de claves esté encendido (puerto ' + CLAVES_PUERTO + ').</p>');
    }
  });

  req.pipe(proxy);
});

app.use(express.static(path.join(__dirname, '../renderer')))
app.use(cors());
app.use(express.json());

// Sirve las imágenes subidas
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

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