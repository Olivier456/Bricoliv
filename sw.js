const CACHE_NAME = 'brico-v4';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './share.html',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Ne pas intercepter les appels aux APIs externes (microlink, thum.io)
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // Met à jour le cache pour les fichiers de l'app en arrière-plan
        if (e.request.url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));    fetch(e.request)
      .then((response) => {
        // Met à jour le cache pour les fichiers de l'app en arrière-plan
        if (e.request.url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
