// Boca Sub-16 PWA - Service Worker
const CACHE_NAME = 'boca-sub16-v1';

// Recursos a cachear para uso offline
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Fuentes de Google (se cachean al primer uso)
const FONT_CACHE = 'boca-fonts-v1';

// ── Install: pre-cachear archivos locales ──────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-cacheando recursos estáticos');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: limpiar caches viejos ───────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== FONT_CACHE)
          .map(k => {
            console.log('[SW] Eliminando cache viejo:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: estrategia Cache First con fallback a red ─────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Fuentes de Google → cachear indefinidamente
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            cache.put(event.request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  // Resto de recursos: Cache First → Network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Solo cachear respuestas válidas
        if (response && response.status === 200 && response.type === 'basic') {
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, response.clone());
          });
        }
        return response;
      }).catch(() => {
        // Sin conexión y sin cache → página de fallback
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
