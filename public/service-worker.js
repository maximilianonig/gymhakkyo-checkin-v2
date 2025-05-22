const CACHE_NAME = 'hakkyo-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/scripts.js',
  '/manifest.json',
  '/assets/hakkyogymsinfondo.png',
  '/assets/icon-192.png',
  '/assets/icon-512.png'
];

// Instala el service worker y guarda archivos en caché
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Intercepta peticiones y responde desde caché si está disponible
self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
