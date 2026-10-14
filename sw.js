const CACHE_NAME = 'fantacapp-pwa-alpha-v1.0.3.19'; // Incrementa ad ogni modifica dei file statici
const IMAGE_CACHE = 'fantacapp-images-v1'; // riempita da js/services/assetPreloader.js: non va cancellata agli aggiornamenti
// Librerie e font esterni (Firebase SDK, icone, Google Fonts): URL con versione fissa, restano tra un aggiornamento e l'altro
const RUNTIME_CACHE = 'fantacapp-runtime-v1';

// Senza queste l'app non parte offline: index.html importa Firebase da gstatic e le icone da jsDelivr
const EXTERNAL_ASSETS = [
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js',
  'https://cdn.jsdelivr.net/npm/remixicon@4.2.0/fonts/remixicon.css',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=DM+Mono:wght@400;500&display=swap'
];

// 1. Array pulito e aggiornato
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './admin.html',
  './manifest.json',
  './js/utils.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/logo-federazione.jpg',
  './fonts/fonts.css',
  './fonts/pirates-of-cydonia.ttf',
  './fonts/nemoy-bold.otf',
  './fonts/novarese-bold.ttf',
  './fonts/champions-bold.ttf',
  './fonts/seri-ea.ttf',
  // maglia 3D dell'editor della divisa (three.js + modello)
  './icons/kit3d/shirt.glb',
  './icons/kit3d/collar-polo.glb',
  './icons/kit3d/neck-polo.bin',
  './icons/kit3d/mask.png',
  './icons/kit3d/seams.jpg',
  './icons/kit3d/uv-template.png',
  './vendor/three/three.module.min.js',
  './vendor/three/GLTFLoader.js',
  './vendor/three/BufferGeometryUtils.js',
  './vendor/three/meshopt_decoder.module.js',
  './vendor/three/OrbitControls.js',
  './vendor/three/RoomEnvironment.js',
  
  // Servizi
  './js/services/integrationImgBB.js',
  './js/services/calcoloMatch.js',
  './js/services/classificaService.js',
  './js/services/settingsService.js',
  './js/services/roleService.js',
  './js/services/accountService.js',
  './js/services/assetPreloader.js',
  './js/services/gwService.js',
  './js/services/mercatoService.js',
  './js/services/themeService.js',
  './js/services/playerStatsService.js',
  './js/services/probabiliService.js',
  './js/services/imageCutout.js',
  './js/services/kitAssets.js',
  './js/services/offlineStore.js',
  './js/services/backNav.js',
  './js/services/connectivity.js',
  './js/services/palmaresService.js',
  './js/services/notificationService.js',
  './js/services/notificationCenter.js',
  './js/services/pushService.js',

  // Componenti
  './js/components/AnteprimaClassifica.js',
  './js/components/AnteprimaClassificaStandard.js',
  './js/components/AnteprimaClassificaTabellone.js',
  './js/components/MatchCardResult.js',
  './js/components/MatchCardVS.js',
  './js/components/MenuPanel.js',
  './js/components/PlayerCard.js',
  './js/components/Kit3D.js',
  './js/components/kitShapes.js',
  './js/components/KitRenderer.js',

  // Pagine del menu laterale
  './js/menu/menuUtils.js',
  './js/menu/ImpostazioniApp.js',
  './js/menu/ConfigurazioneSquadra.js',
  './js/menu/DivisaSquadra.js',
  './js/menu/ListoneView.js',
  './js/menu/NotificheView.js',
  
  // Pagine Utente
  './js/calendario.js',
  './js/classifica.js',
  './js/firebase-config.js',
  './js/formazione.js',
  './js/home.js',
  './js/liveMatch.js',
  './js/mercato.js',
  './js/teams.js',

  // Area Patron (admin.html + moduli): stessa cache versionata dell'app, così
  // admin e servizi condivisi (themeService, calcoloMatch...) sono sempre della stessa versione
  './js/admin/dashboard.js',
  './js/admin/teams.js',
  './js/admin/trofei.js',
  './js/admin/palmares.js',
  './js/admin/players.js',
  './js/admin/votes.js',
  './js/admin/mercato.js',
  './js/admin/classifica.js',
  './js/admin/competizioni.js',
  './js/admin/themes.js',
  './js/admin/accounts.js',
  './js/admin/divise.js',
  './js/admin/notifiche.js',
  './js/admin/calendario/calendario.js',
  './js/admin/calendario/calendario-state.js',
  './js/admin/calendario/calendario-ui.js',
  './js/admin/calendario/calendario-gironi.js',
  './js/admin/calendario/calendario-gw-mapping.js',
  './js/admin/calendario/calendario-regular-season.js',
  './js/admin/calendario/calendario-tabellone.js'
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
              console.error(`Impossibile inserire in cache (File mancante o errato): ${url}`, err);
            });
          })
        );
      })
      .then(() => caches.open(RUNTIME_CACHE))
      .then(cache => Promise.all(EXTERNAL_ASSETS.map(url =>
        cache.match(url).then(hit => hit || cache.add(new Request(url, { mode: 'cors' })).catch(err => {
          console.warn(`Libreria esterna non in cache: ${url}`, err);
        }))
      )))
  );
  self.skipWaiting();
});

// Attivazione: rimuove le vecchie versioni della cache
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (![CACHE_NAME, IMAGE_CACHE, RUNTIME_CACHE].includes(cacheName)) {
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
      // una copia "opaca" in cache non va bene per le richieste CORS (es. loghi dipinti sulla maglia 3D)
      caches.match(url, { cacheName: IMAGE_CACHE }).then(cached =>
        (cached && !(event.request.mode === 'cors' && cached.type === 'opaque')) ? cached : fetch(event.request))
    );
    return;
  }

  // LIBRERIE E FONT ESTERNI (URL con versione): prima la cache, poi la rete (e si salvano)
  if (
    url.startsWith('https://www.gstatic.com/firebasejs/') ||
    url.startsWith('https://cdn.jsdelivr.net/npm/') ||
    url.startsWith('https://fonts.gstatic.com/')
  ) {
    event.respondWith(cacheFirst(event.request, RUNTIME_CACHE));
    return;
  }
  // CSS di Google Fonts: dalla cache subito, aggiornato in background
  if (url.startsWith('https://fonts.googleapis.com/')) {
    event.respondWith(staleWhileRevalidate(event.request, RUNTIME_CACHE));
    return;
  }

  // SICUREZZA: Ignora chiamate a Firebase, Auth e API esterne (sempre dalla rete).
  // admin.html e /js/admin/ NON sono più qui: l'area Patron usa la cache come il resto dell'app.
  if (
    url.includes('firebasedatabase.app') || 
    url.includes('googleapis.com') || 
    url.includes('imgbb.com') || 
    url.includes('i.ibb.co')
  ) {
    return; // Passa direttamente alla rete
  }

  // STRATEGIA: Cache-First per i file statici della PWA
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(err => {
        // apertura di una pagina senza rete (es. URL con parametri non in cache): si apre l'app
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html').then(r => r || Promise.reject(err));
        }
        throw err;
      });
    })
  );
});

function cacheFirst(request, cacheName) {
  return caches.open(cacheName).then(cache =>
    cache.match(request).then(hit => hit || fetch(request).then(res => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    }))
  );
}

function staleWhileRevalidate(request, cacheName) {
  return caches.open(cacheName).then(cache =>
    cache.match(request).then(hit => {
      const fresh = fetch(request).then(res => {
        if (res.ok) cache.put(request, res.clone());
        return res;
      }).catch(() => hit);
      return hit || fresh;
    })
  );
}

// Push ad app chiusa (Cloud Function inviaNotifica → Firebase Cloud Messaging, messaggio "solo dati").
// Stesso tag della notifica mostrata dall'app aperta: se arrivano entrambe, la seconda sostituisce la prima.
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (e) { payload = { data: { body: event.data && event.data.text() } }; }
  const d = payload.data || payload.notification || {};
  const opts = {
    body: d.body || '',
    icon: d.icon || 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: d.id || undefined,
    data: { page: d.page || '', id: d.id || '' },
    requireInteraction: d.requireInteraction === 'true',
    silent: d.silent === 'true'
  };
  if (d.image) opts.image = d.image;
  event.waitUntil(self.registration.showNotification(d.title || 'FantaCApp', opts));
});

// Tocco su una notifica: si porta in primo piano l'app (o la si apre) sulla pagina indicata.
// Le notifiche del Patron senza pagina aprono l'elenco delle notifiche.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};
  const page = data.page || '';
  const isPatron = event.notification.tag === 'account-request';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const target = isPatron ? 'admin.html' : 'index.html';
      const open = list.find(c => new URL(c.url).pathname.endsWith(target)) ||
        (!isPatron && list.find(c => !new URL(c.url).pathname.endsWith('admin.html')));
      if (open) {
        if (!isPatron) open.postMessage({ type: 'notification-click', page });
        return open.focus();
      }
      return self.clients.openWindow(isPatron ? './admin.html' : `./index.html?page=${encodeURIComponent(page || 'notifiche')}`);
    })
  );
});
