const CACHE_NAME = 'fantacapp-pwa-v1.0.28'; // Incrementa questo numero ogni volta che fai modifiche ai file .js o .html

// 1. Array pulito: includiamo solo l'app utente per tenerla fulminea ed evitare blocchi sull'admin
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/logo-federazione.jpg',
  
  // Servizi e Pagine Utente
  './js/services/integrationImgBB.js',
  './js/services/calcoloMatch.js',
  './js/calendario.js',
  './js/formazione.js',
  './js/home.js',
  './js/mercato.js',
  './js/firebase-config.js',
  './js/classifica.js',
  './js/teams.js'
  
];

// Installazione: salva i file statici nella cache locale (Bypassando i file mancanti)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Inizializzazione cache PWA avanzata...');
        
        // Modifica robusta: scarica i file uno ad uno. 
        // Se un file fallisce, viene segnalato in console ma non blocca l'app!
        return Promise.all(
          ASSETS_TO_CACHE.map(url => {
            return cache.add(url).catch(err => {
              console.error(`⚠️ Impossibile inserire in cache (File mancante o errato): ${url}`, err);
            });
          })
        );
      })
  );
  self.skipWaiting();
});

// Attivazione: fa tabula rasa delle vecchie cache quando aggiorni la versione
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Vecchia cache rimossa:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Gestione intelligente della rete e della cache
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // SICUREZZA: Non toccare MAI le chiamate a Firebase, l'autenticazione o le API esterne di ImgBB
  if (
    url.includes('firebasedatabase.app') || 
    url.includes('googleapis.com') || 
    url.includes('imgbb.com') || 
    url.includes('i.ibb.co') || // Server dove risiedono fisicamente le immagini di ImgBB
    url.includes('admin.html') || // Lascia che i file admin si carichino sempre da internet in tempo reale
    url.includes('/js/admin/')
  ) {
    return; // Passa direttamente alla rete senza salvare in cache
  }

  // STRATEGIA INTERGARA: Cache-First per i file locali inseriti nell'array (Massima velocità)
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse; // Se il file JS/HTML è in cache, dallo istantaneamente
      }
      
      // Se non è in cache (es. una nuova icona o risorsa non tracciata), scaricala da internet
      return fetch(event.request);
    })
  );
});
