const CACHE_NAME = 'fantalega-pwa-v2.21.14'; // Ho messo v2 per forzare l'aggiornamento
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './admin.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Installazione: salva i file statici nella cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aperta');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
  self.skipWaiting();
});

// Attivazione: pulisce le cache vecchie se cambi la versione (CACHE_NAME)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Cache vecchia eliminata:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: prova a prendere la risorsa dalla rete, se fallisce (offline) usa la cache
self.addEventListener('fetch', event => {
  // Ignora le richieste verso Firebase (i dati real-time non vanno cachati qui)
  if (event.request.url.includes('firebasedatabase.app') || event.request.url.includes('googleapis.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
