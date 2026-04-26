/* ═══════════════════════════════════════════════════════
   VACUUM — Service Worker
   Cache statique minimal pour fonctionnement offline
   Version : 3.0.0
═══════════════════════════════════════════════════════ */

const CACHE_NAME = 'vacuum-v3';

const STATIC_ASSETS = [
  '/vacuum/',
  '/vacuum/index.html',
  '/vacuum/manifest.json',
  '/vacuum/icons/icon-192.png',
  '/vacuum/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('openstreetmap.org') ||
    url.hostname.includes('tile.openstreetmap') ||
    url.hostname.includes('basemaps.cartocdn.com') ||
    url.hostname.includes('unpkg.com')
  ) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        if (event.request.destination === 'document') return caches.match('/vacuum/');
      });
    })
  );
});
