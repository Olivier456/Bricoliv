const CACHE_NAME = 'brico-v26';
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
  const url = new URL(e.request.url);

  // Interception dédiée du partage Android avec image : Android envoie les
  // fichiers en POST (multipart/form-data), qu'un simple fichier statique ne
  // peut pas recevoir. Le service worker lit donc directement la requête,
  // stocke l'image dans IndexedDB (localStorage ne gère pas les données
  // binaires), puis redirige vers l'app.
  if (e.request.method === 'POST' && url.pathname.endsWith('/share.html')) {
    e.respondWith(handleShareTargetPost(e.request));
    return;
  }

  // Ne jamais intercepter les appels vers des domaines externes (mshots, microlink, etc.)
  // Sinon les images de prévisualisation externes peuvent échouer silencieusement.
  if (!e.request.url.startsWith(self.location.origin)) return;

  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});

async function handleShareTargetPost(request) {
  try {
    const formData = await request.formData();
    const title = formData.get('title') || '';
    const text = formData.get('text') || '';
    const sharedUrl = formData.get('url') || '';
    const file = formData.get('sharedImage');

    const payload = { title, text, url: sharedUrl, hasImage: false };

    if (file && file.size > 0) {
      await storeSharedImage(file);
      payload.hasImage = true;
    }

    await storeSharedPayload(payload);
  } catch (e) {
    console.error('Erreur traitement du partage', e);
  }
  return Response.redirect('./index.html?shared=1', 303);
}

// Stockage minimal en IndexedDB (une seule entrée, toujours écrasée), utilisé
// comme relais temporaire entre le service worker et la page principale, le
// temps qu'elle démarre et récupère les données partagées.
function openShareDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('brico-share-db', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('shared');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function storeSharedImage(file) {
  const db = await openShareDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('shared', 'readwrite');
    tx.objectStore('shared').put(file, 'image');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function storeSharedPayload(payload) {
  const db = await openShareDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('shared', 'readwrite');
    tx.objectStore('shared').put(payload, 'payload');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
