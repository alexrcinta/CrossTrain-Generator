const CACHE_NAME = 'wod-gen-v3';
const BASE_URL = '/wod-gen/';

const ASSETS = [
  BASE_URL,
  BASE_URL + 'index.html',
  BASE_URL + 'manifest.json',
  BASE_URL + 'icon.png',
  BASE_URL + 'icon-512.png',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js'
];

self.addEventListener('install', e => {
  console.log('Service Worker: instalando...');
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: cacheando assets...');
        return cache.addAll(ASSETS);
      })
      .then(() => {
        console.log('Service Worker: instalación completada');
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', e => {
  console.log('Service Worker: activando...');
  e.waitUntil(
    caches.keys()
      .then(keys => {
        return Promise.all(
          keys
            .filter(k => k !== CACHE_NAME)
            .map(k => {
              console.log('Service Worker: borrando cache viejo:', k);
              return caches.delete(k);
            })
        );
      })
      .then(() => {
        console.log('Service Worker: activación completada');
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  
  // Solo interceptar requests dentro de /wod-gen/ o desde unpkg.com
  if (!url.pathname.startsWith(BASE_URL) && !url.hostname.includes('unpkg.com')) {
    return;
  }
  
  // Para navegación a rutas dentro de /wod-gen/, servir index.html
  if (e.request.mode === 'navigate' && url.pathname.startsWith(BASE_URL)) {
    e.respondWith(
      caches.match(BASE_URL + 'index.html')
        .then(response => {
          if (response) {
            console.log('Service Worker: sirviendo index.html desde cache');
            return response;
          }
          console.log('Service Worker: index.html no en cache, descargando...');
          return fetch(e.request)
            .then(response => {
              if (response && response.status === 200) {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(BASE_URL + 'index.html', clone);
                });
              }
              return response;
            });
        })
        .catch(() => {
          console.log('Service Worker: usando fallback index.html');
          return caches.match(BASE_URL + 'index.html');
        })
    );
    return;
  }
  
  // Para otros requests, usar cache-first
  e.respondWith(
    caches.match(e.request)
      .then(cached => {
        if (cached) {
          console.log('Service Worker: sirviendo desde cache:', e.request.url);
          return cached;
        }
        console.log('Service Worker: descargando:', e.request.url);
        return fetch(e.request)
          .then(response => {
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(e.request, clone);
            });
            return response;
          })
          .catch(error => {
            console.log('Service Worker: error en fetch, usando fallback:', error);
            if (e.request.destination === 'image') {
              return caches.match(BASE_URL + 'icon.png');
            }
            return caches.match(BASE_URL + 'index.html');
          });
      })
  );
});
