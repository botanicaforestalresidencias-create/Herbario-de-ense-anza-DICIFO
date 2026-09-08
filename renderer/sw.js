const CACHE_NAME = 'herbario-dicifo-v3';

// Rutas locales estrictas
const PRECACHE_ASSETS = [
  './',
  './login.html',
  './consulta.html',
  './admin.html',
  './css/style.css',
  './js/login.js',
  './js/consulta.js',
  './js/admin.js',
  './chapingo.png',
  './forestales.png',
  './manifest.json'
];

// Instalación sin fallos críticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Intentamos cachear cada recurso sin detenernos si uno falla
      for (const asset of PRECACHE_ASSETS) {
        try {
          await cache.add(asset);
        } catch (e) {
          console.warn('No se pudo precachear:', asset);
        }
      }
    }).then(() => self.skipWaiting())
  );
});

// Activación y limpieza inmediata
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptor de peticiones
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo peticiones GET
  if (request.method !== 'GET') return;

  // 1. Peticiones a la API (Network First -> Caché)
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copia = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copia));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 2. Imágenes de uploads (Cache First -> Red)
  if (url.pathname.includes('/uploads/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((networkResp) => {
          if (networkResp && networkResp.status === 200) {
            const copia = networkResp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copia));
          }
          return networkResp;
        });
      })
    );
    return;
  }

  // 3. Todo lo demás: HTML, CSS, JS, imágenes locales
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((networkResp) => {
        if (networkResp && networkResp.status === 200) {
          const copia = networkResp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copia));
        }
        return networkResp;
      }).catch(() => caches.match('./consulta.html'));
    })
  );
});
// 1. Peticiones a la API (Network First -> Cache Fallback)
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Si el backend responde bien, guardamos una copia exacta
          if (response && response.ok) {
            const copia = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copia));
          }
          return response;
        })
        .catch(async () => {
          // Si no hay red, buscamos en el caché
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Si de plano no estaba cacheado ese ejemplar, devolver un JSON controlado en vez de romper la app
          return new Response(
            JSON.stringify({ error: 'Ejemplar no disponible sin conexión. Conéctate a internet para sincronizarlo.' }),
            { headers: { 'Content-Type': 'application/json' }, status: 503 }
          );
        })
    );
    return;
  }