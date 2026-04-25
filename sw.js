/* ═══════════════════════════════════════════════════════
   VACUUM — Service Worker
   Cache statique minimal pour fonctionnement offline
   Version : 1.0.0
═══════════════════════════════════════════════════════ */

const CACHE_NAME = 'vacuum-v1';

const STATIC_ASSETS = [
  '/vacuum/',
  '/vacuum/index.html',
  '/vacuum/manifest.json',
  '/vacuum/icons/icon-192.png',
  '/vacuum/icons/icon-512.png'
];

/* ── Installation : mise en cache des assets statiques ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

/* ── Activation : suppression des anciens caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

/* ── Fetch : cache-first pour statique, network-first pour Firebase ── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  /* Les requêtes Firebase/API passent toujours par le réseau */
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('openstreetmap.org') ||
    url.hostname.includes('tile.openstreetmap') ||
    url.hostname.includes('unpkg.com')
  ) {
    return; /* laisser passer sans interception */
  }

  /* Cache-first pour tous les assets statiques du projet */
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        /* Ne mettre en cache que les réponses valides */
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        /* Offline fallback : retourner la page principale */
        if (event.request.destination === 'document') {
          return caches.match('/vacuum/');
        }
      });
    })
  );
});
