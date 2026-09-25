const CACHE_NAME = 'herbario-dicifo-v3';
const OFFLINE_FALLBACK = './consulta.html';
const OFFLINE_API_MESSAGE = 'Ejemplar no disponible sin conexión. Conéctate a internet para sincronizarlo.';

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

const isRequestCacheable = (request) => request.method === 'GET' && request.url.startsWith(self.location.origin);

const cacheResponse = async (request, response) => {
  if (!response || !(response.ok || response.status === 204)) return;

  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch (error) {
    console.warn('No se pudo guardar en caché:', request.url, error);
  }
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);

        for (const asset of PRECACHE_ASSETS) {
          try {
            await cache.add(asset);
          } catch (error) {
            console.warn('No se pudo precachear:', asset, error);
          }
        }
      } finally {
        await self.skipWaiting();
      }
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (!isRequestCacheable(request)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response && response.ok) {
            await cacheResponse(request, response);
          }
          return response;
        })
        .catch(async () => {
          return (
            (await caches.match(request)) ||
            (await caches.match(OFFLINE_FALLBACK)) ||
            (await caches.match('./login.html')) ||
            new Response('<html><body><h1>Sin conexión</h1></body></html>', {
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
              status: 503
            })
          );
        })
    );
    return;
  }

  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response && response.ok) {
            await cacheResponse(request, response);
          }
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }

          return new Response(
            JSON.stringify({ error: OFFLINE_API_MESSAGE }),
            {
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              status: 503
            }
          );
        })
    );
    return;
  }

  if (url.pathname.includes('/uploads/')) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok) {
            await cacheResponse(request, networkResponse);
          }
          return networkResponse;
        } catch (error) {
          return caches.match(OFFLINE_FALLBACK) || caches.match('./login.html');
        }
      })()
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached;

      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.ok) {
          await cacheResponse(request, networkResponse);
        }
        return networkResponse;
      } catch (error) {
        return (
          (await caches.match(OFFLINE_FALLBACK)) ||
          (await caches.match('./login.html')) ||
          new Response('<html><body><h1>Sin conexión</h1></body></html>', {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
            status: 503
          })
        );
      }
    })
  );
});