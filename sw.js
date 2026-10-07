const CACHE_NAME = 'fantacapp-pwa-alpha-v1.0.1.14'; // Incrementa ad ogni modifica dei file statici
const IMAGE_CACHE = 'fantacapp-images-v1'; // riempita da js/services/assetPreloader.js: non va cancellata agli aggiornamenti

// 1. Array pulito e aggiornato
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/logo-federazione.jpg',
  
  // Servizi
  './js/services/integrationImgBB.js',
  './js/services/calcoloMatch.js',
  './js/services/classificaService.js',
  './js/services/settingsService.js',
  './js/services/roleService.js',
  './js/services/assetPreloader.js',
  './js/services/gwService.js',
  './js/services/themeService.js',
  './js/services/playerStatsService.js',

  // Componenti
  './js/components/AnteprimaClassifica.js',
  './js/components/AnteprimaClassificaStandard.js',
  './js/components/AnteprimaClassificaTabellone.js',
  './js/components/MatchCardResult.js',
  './js/components/MatchCardVS.js',
  './js/components/MenuPanel.js',

  // Pagine del menu laterale
  './js/menu/menuUtils.js',
  './js/menu/ImpostazioniApp.js',
  './js/menu/ConfigurazioneSquadra.js',
  './js/menu/ListoneView.js',
  
  // Pagine Utente
  './js/calendario.js',
  './js/classifica.js',
  './js/firebase-config.js',
  './js/formazione.js',
  './js/home.js',
  './js/liveMatch.js',
  './js/mercato.js',
  './js/teams.js'
];

// Installazione: salva i file statici nella cache locale
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Inizializzazione cache PWA avanzata...');
        
        // Scarica i file uno ad uno: un eventuale 404 non blocca l'installazione
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

// Attivazione: rimuove le vecchie versioni della cache
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== IMAGE_CACHE) {
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
  // Ignora richieste non GET (es. POST, PUT)
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // IMMAGINI (ImgBB): prima la cache immagini, altrimenti rete
  if (url.includes('i.ibb.co') || url.includes('imgbb.com')) {
    event.respondWith(
      caches.match(url, { cacheName: IMAGE_CACHE }).then(cached => cached || fetch(event.request))
    );
    return;
  }

  // SICUREZZA: Ignora chiamate a Firebase, Auth, CDN o rotte Admin
  if (
    url.includes('firebasedatabase.app') || 
    url.includes('googleapis.com') || 
    url.includes('imgbb.com') || 
    url.includes('i.ibb.co') || 
    url.includes('admin.html') || 
    url.includes('/js/admin/')
  ) {
    return; // Passa direttamente alla rete
  }

  // STRATEGIA: Cache-First per i file statici della PWA
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});
