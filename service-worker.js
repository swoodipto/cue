/* ============================================================
   CUE — service-worker.js
   Offline-first caching strategy for PWA
   ============================================================ */

const CACHE_NAME = "cue-v7";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./vendor/web-kits-audio.js",
  "./patches/minimal-patch.js",
  "./manifest.json",
  "./assets/demo-ios-icon.png",
  "./assets/demo-zettel.png",
  "./assets/tweet.png",
];

function getCacheURL(path) {
  return new URL(path, self.registration.scope).toString();
}

const ASSETS_TO_CACHE = APP_SHELL.map(getCacheURL);
const OFFLINE_DOCUMENT_URL = getCacheURL("./index.html");

/* ── Install: cache all essential assets ─────────────────── */

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Cache each asset individually so one failure doesn't block all.
        return Promise.allSettled(
          ASSETS_TO_CACHE.map((url) => cache.add(url))
        );
      })
      .catch(() => {
        // Installation continues even if caching fails.
      })
  );
  self.skipWaiting();
});

/* ── Activate: clean up old caches ──────────────────────── */

self.addEventListener("activate", (event) => {
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

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const requestURL = new URL(request.url);

  // Only handle GET requests for same-origin assets in this app scope.
  if (
    request.method !== "GET"
    || requestURL.origin !== self.location.origin
    || !requestURL.href.startsWith(self.registration.scope)
  ) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(request).then((response) => {
        // Return cached response if available
        if (response) {
          return response;
        }
        // Otherwise try network.
        return fetch(request).then((networkResponse) => {
          // Cache successful responses for future offline use.
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        });
      });
    }).catch(() => {
      // Network failed and no cache — serve the app shell for navigation.
      if (request.mode === "navigate" || request.destination === "document") {
        return caches.match(OFFLINE_DOCUMENT_URL);
      }
    })
  );
});
