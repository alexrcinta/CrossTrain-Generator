// Service Worker para CrossTrain-Generator
// VERSIÓN CORREGIDA: network-first para HTML (evita servir versiones viejas cacheadas)

const CACHE_NAME = 'crosstrain-v1';
const BASE_URL = '/CrossTrain-Generator/';

const ASSETS = [
  BASE_URL + 'manifest.json',
  BASE_URL + 'icon.png',
  BASE_URL + 'icon-512.png',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js'
];

// Instalación: cachea solo assets estáticos (NO el index.html)
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activación: borra caches viejos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Solo gestionar peticiones de nuestro dominio o los CDN
  if (!url.pathname.startsWith(BASE_URL) && !url.hostname.includes('unpkg.com')) {
    return;
  }

  // ESTRATEGIA NETWORK-FIRST para navegación y HTML
  // Siempre intenta descargar la versión más reciente ANTES de usar caché.
  // Esto evita que se quede "pegada" una versión vieja del index.html.
  if (e.request.mode === 'navigate' ||
      e.request.destination === 'document' ||
      url.pathname === BASE_URL ||
      url.pathname === BASE_URL + 'index.html') {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          // Guarda una copia fresca para uso offline
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          return response;
        })
        .catch(() => {
          // Solo si NO hay red, usa la copia offline
          return caches.match(e.request).then(cached => {
            return cached || caches.match(BASE_URL);
          });
        })
    );
    return;
  }

  // ESTRATEGIA CACHE-FIRST para el resto (assets estáticos, CDN)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return response;
      });
    })
  );
});
