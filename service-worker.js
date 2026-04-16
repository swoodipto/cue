/* ============================================================
   CUE — service-worker.js
   Offline-first caching strategy for PWA
   ============================================================ */

const CACHE_NAME = 'cue-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json'
];

/* ── Install: cache all essential assets ─────────────────── */

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

/* ── Activate: clean up old caches ──────────────────────── */

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

/* ── Fetch: serve from cache, fall back to network ────── */

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip external analytics and non-GET requests
  if (!request.url.startsWith(self.location.origin) || request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(request).then((response) => {
      return response || fetch(request);
    }).catch(() => {
      // Offline fallback
      if (request.destination === 'document') {
        return caches.match('/index.html');
      }
    })
  );
});
