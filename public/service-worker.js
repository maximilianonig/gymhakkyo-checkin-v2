const CACHE_NAME = 'hakkyo-cache-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/admin.html',
  '/styles.css',
  '/manifest.json',
  '/assets/hakkyogymsinfondo.png',
  '/assets/icon-192.png',
  '/assets/icon-512.png'
];

self.addEventListener('install', function (event) {
  self.skipWaiting(); // ⏩ Fuerza instalación inmediata
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});



self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName); // 🧹 Borra cachés viejos
          }
        })
      )
    )
  );
  self.clients.claim(); // 🔄 Reclama el control de las páginas
});

// Intercepta peticiones y sirve desde caché si puede
self.addEventListener('fetch', function (event) {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});

// 🔁 Recarga automática si hay nueva versión
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// --- Notificaciones push (FCM via Web Push) ---
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (e) {}
  const title = payload?.notification?.title || payload?.data?.title || "Hakkyo";
  const body  = payload?.notification?.body  || payload?.data?.body  || "Nuevo evento";
  const options = {
    body,
    icon: "/assets/icon-192.png",   // ajustá si tu icono está en otra ruta
    badge: "/assets/icon-192.png",
    data: payload?.data || {}
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/admin.html";
  event.waitUntil(clients.openWindow(url));
});
