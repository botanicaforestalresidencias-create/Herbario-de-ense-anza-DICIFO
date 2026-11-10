const CACHE_NAME = 'herbario-dicifo-v6'; // v5: descarta el caché v4 que pudo guardar la página de advertencia de ngrok
const OFFLINE_FALLBACK = './login.html';
const OFFLINE_API_MESSAGE = 'Ejemplar no disponible sin conexión. Conéctate a internet para sincronizarlo.';
const CABECERA_NGROK = { 'ngrok-skip-browser-warning': 'true' };

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
  './manifest.json',
  './assets/icon-192.png'
];

const isRequestCacheable = (request) => request.method === 'GET' && request.url.startsWith(self.location.origin);

// Una respuesta solo se guarda si es válida y no es la página de advertencia de ngrok
const esRespuestaValida = async (response) => {
  if (!response || !(response.ok || response.status === 204)) return false;

  const tipo = response.headers.get('content-type') || '';
  if (tipo.includes('text/html')) {
    try {
      const texto = await response.clone().text();
      if (/ngrok|ERR_NGROK/i.test(texto)) return false;
    } catch (error) {
      return false;
    }
  }
  return true;
};

const cacheResponse = async (request, response) => {
  if (!(await esRespuestaValida(response))) {
    console.warn('Respuesta no válida, no se guarda en caché:', request.url);
    return;
  }

  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch (error) {
    console.warn('No se pudo guardar en caché:', request.url, error);
  }
};

// Añade la cabecera de ngrok a las peticiones que el service worker hace a la red
const conCabeceraNgrok = (request) => {
  if (request.mode === 'navigate') return request;
  return new Request(request, {
    headers: new Headers([...request.headers, ...Object.entries(CABECERA_NGROK)])
  });
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);

        for (const asset of PRECACHE_ASSETS) {
          try {
            const respuesta = await fetch(new Request(asset, { headers: CABECERA_NGROK, cache: 'no-store' }));
            if (await esRespuestaValida(respuesta)) {
              await cache.put(asset, respuesta);
            } else {
              console.warn('Recurso no válido, no se precachea:', asset);
            }
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

  // Navegación: red primero; si falla, caché o login sin conexión
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          await cacheResponse(request, response);
          return response;
        })
        .catch(async () => {
          return (
            (await caches.match(request)) ||
            (await caches.match(OFFLINE_FALLBACK)) ||
            new Response('<html><body><h1>Sin conexión</h1></body></html>', {
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
              status: 503
            })
          );
        })
    );
    return;
  }

  // API: red primero; si falla, última respuesta guardada
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(conCabeceraNgrok(request))
        .then(async (response) => {
          await cacheResponse(request, response);
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

  // Imágenes subidas: caché primero, luego red
  if (url.pathname.includes('/uploads/')) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        try {
          const networkResponse = await fetch(conCabeceraNgrok(request));
          await cacheResponse(request, networkResponse);
          return networkResponse;
        } catch (error) {
          return caches.match(OFFLINE_FALLBACK) || caches.match('./login.html');
        }
      })()
    );
    return;
  }

  // Estáticos: caché primero, luego red
  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached;

      try {
        const networkResponse = await fetch(conCabeceraNgrok(request));
        await cacheResponse(request, networkResponse);
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