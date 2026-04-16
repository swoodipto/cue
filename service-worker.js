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
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Cache each asset individually so one failure doesn't block all
        return Promise.allSettled(
          ASSETS_TO_CACHE.map(url => cache.add(url))
        );
      })
      .catch(() => {
        // Installation continues even if caching fails
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

  // Only handle GET requests for same origin
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(request).then((response) => {
        // Return cached response if available
        if (response) {
          return response;
        }
        // Otherwise try network
        return fetch(request).then((networkResponse) => {
          // Cache successful responses for future offline use
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        });
      });
    }).catch(() => {
      // Network failed and no cache — serve index.html for navigation
      if (request.mode === 'navigate' || request.destination === 'document') {
        return caches.match('/index.html');
      }
    })
  );
});

