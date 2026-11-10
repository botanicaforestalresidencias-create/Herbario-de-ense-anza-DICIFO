// Prueba de carga del Catálogo de Herbario con k6
// Instalar k6 en Windows: winget install k6  (o descargar desde k6.io)
// Ejecutar (con el servidor encendido):
//   k6 run prueba_carga.js
// Para cambiar la URL o la ruta sin editar el archivo:
//   k6 run -e BASE_URL=http://localhost:3000 -e RUTA=/api/especimenes prueba_carga.js

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
// Ajustar a la ruta real de consulta (listado público de especímenes)
const RUTA = __ENV.RUTA || '/api/especimenes';
// Token de sesión (se pasa con -e TOKEN=...)
const TOKEN = __ENV.TOKEN || '';

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // subida suave a 10 usuarios
    { duration: '1m',  target: 10 },  // mantener 10
    { duration: '30s', target: 50 },  // subida a 50 usuarios
    { duration: '1m',  target: 50 },  // mantener 50
    { duration: '20s', target: 0 },   // bajada
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'], // 95% de respuestas en menos de 800 ms
    http_req_failed: ['rate<0.01'],   // menos de 1% de errores
  },
};

export default function () {
  const params = TOKEN ? { headers: { Authorization: `Bearer ${TOKEN}` } } : {};
  const res = http.get(`${BASE_URL}${RUTA}`, params);

  check(res, {
    'status 200': (r) => r.status === 200,
    'responde en menos de 800 ms': (r) => r.timings.duration < 800,
  });

  sleep(1);
}