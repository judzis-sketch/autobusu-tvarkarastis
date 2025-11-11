const CACHE_NAME = 'pwa-autobusai-v1';
const urlsToCache = ['/', '/index.html']; // Note: index.html is not used in Next.js, but keeping for compatibility with user request.

self.addEventListener('install', (event) => {
  // @ts-ignore
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  // @ts-ignore
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});
