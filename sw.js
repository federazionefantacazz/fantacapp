const CACHE_NAME = 'fantacapp-pwa-alpha-v1.1.0.12'; // Incrementa ad ogni modifica dei file statici
const IMAGE_CACHE = 'fantacapp-images-v1'; // riempita da js/services/assetPreloader.js: non va cancellata agli aggiornamenti
// Librerie e font esterni (Firebase SDK, icone, Google Fonts): URL con versione fissa, restano tra un aggiornamento e l'altro
const RUNTIME_CACHE = 'fantacapp-runtime-v1';

// Senza queste l'app non parte offline: index.html importa Firebase da gstatic e le icone da jsDelivr
const EXTERNAL_ASSETS = [
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js',
  'https://cdn.jsdelivr.net/npm/remixicon@4.2.0/fonts/remixicon.css',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=DM+Mono:wght@400;500&display=swap',
  // admin.html usa una combinazione diversa di Google Fonts
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap',
  // notifiche push (caricato solo quando servono, js/services/pushService.js)
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js'
];
// Senza questi l'app non si avvia proprio: se non si riescono a scaricare l'installazione fallisce
// (e resta la versione precedente, completa)
const REQUIRED_EXTERNAL = [
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js'
];
const IMAGE_CACHE_MAX = 800; // immagini salvate mentre si usa l'app: oltre si tolgono le più vecchie

// 1. Array pulito e aggiornato
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './admin.html',
  './manifest.json',
  './js/utils.js',
  './js/pwaBoot.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/logo-federazione.jpg',
  './icons/serie-a.svg',
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
  './icons/kit3d/neck-crew-setin.bin',
  './icons/kit3d/neck-v-raglan.bin',
  './icons/kit3d/neck-cutv-raglan.bin',
  './icons/kit3d/mask.png',
  './icons/kit3d/seams.jpg',
  './icons/kit3d/shirt-raglan.glb',
  './icons/kit3d/mask-raglan.png',
  './icons/kit3d/seams-raglan.jpg',
  './icons/kit3d/collar-polo-raglan.glb',
  './icons/kit3d/neck-cut-raglan.bin',
  './icons/kit3d/neck-polo-raglan.bin',
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
  './js/services/themeElements.js',
  './js/services/themePreview.js',
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
  './js/services/favoritesService.js',
  './js/services/staffService.js',

  // Componenti
  './js/components/AnteprimaClassifica.js',
  './js/components/AnteprimaClassificaStandard.js',
  './js/components/AnteprimaClassificaTabellone.js',
  './js/components/MatchCardResult.js',
  './js/components/MatchCardVS.js',
  './js/components/MenuPanel.js',
  './js/components/PlayerCard.js',
  './js/components/Kit3D.js',
  './js/components/Stadium3D.js',
  './js/components/kitShapes.js',
  './js/components/KitRenderer.js',
  './js/components/ColorPicker.js',
  './js/components/ImageCropper.js',
  './js/components/SelectSheet.js',
  './js/components/CaptainBand.js',
  './js/components/StaffEditor.js',

  // Pagine del menu laterale
  './js/menu/menuUtils.js',
  './js/menu/ImpostazioniApp.js',
  './js/menu/ConfigurazioneSquadra.js',
  './js/menu/DivisaSquadra.js',
  './js/menu/StadioSquadra.js',
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
  './js/admin/regole.js',
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
  './js/admin/appPreview.js',
  './js/admin/previewTeams.js',
  './js/admin/divise.js',
  './js/admin/notifiche.js',
  './js/admin/calendario/calendario.js',
  './js/admin/calendario/calendario-state.js',
  './js/admin/calendario/calendario-ui.js',
  './js/admin/calendario/calendario-gironi.js',
  './js/admin/calendario/calendario-gw-mapping.js',
  './js/admin/calendario/calendario-regular-season.js',
  './js/admin/calendario/calendario-tabellone.js',
  './js/admin/calendario/calendario-sync-reale.js'
];

// Installazione: scarica TUTTI i file dell'app prima che la nuova versione possa essere usata.
// È "tutto o niente": se manca anche un solo file dell'app l'installazione fallisce, la cache
// incompleta viene buttata e si continua con la versione precedente (il browser riprova più avanti).
// Prima, un file non scaricato per un attimo di rete ballerina restava fuori dalla cache fino
// alla versione successiva e l'app, offline, non partiva.
self.addEventListener('install', event => {
  event.waitUntil(precacheAll().catch(async err => {
    console.error('Installazione della nuova versione non riuscita:', err);
    await caches.delete(CACHE_NAME);
    notifyClients({ type: 'precache-failed' });
    throw err;
  }));
  // Niente skipWaiting qui: con una versione già attiva la nuova resta in attesa finché l'app
  // non la chiede (all'avvio o col pulsante "Aggiorna", vedi js/pwaBoot.js). Così una pagina
  // aperta non si trova a metà tra file vecchi e nuovi.
});

// L'app chiede di passare subito alla nuova versione (già scaricata per intero)
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Attivazione: rimuove le vecchie versioni della cache
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => Promise.all(
      cacheNames.map(cacheName => {
        if (![CACHE_NAME, IMAGE_CACHE, RUNTIME_CACHE].includes(cacheName)) {
          console.log('Vecchia cache rimossa:', cacheName);
          return caches.delete(cacheName);
        }
      })
    )).then(() => self.clients.claim())
  );
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Scarica con qualche tentativo (rete lenta o instabile). makeRequest crea una Request nuova a ogni giro. */
async function fetchRetry(makeRequest, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(makeRequest());
      if (res.ok) return res;
      lastErr = new Error(`HTTP ${res.status}`);
      if (res.status === 404) break; // inutile riprovare
    } catch (e) { lastErr = e; }
    if (i < tries - 1) await sleep(600 * 2 ** i);
  }
  throw lastErr;
}

async function notifyClients(msg) {
  try {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    list.forEach(c => c.postMessage(msg));
  } catch (e) {}
}

/** Esegue i compiti con al massimo `limit` download contemporanei. */
async function runPool(tasks, limit, onDone) {
  const queue = tasks.slice();
  const errors = [];
  const worker = async () => {
    while (queue.length) {
      const t = queue.shift();
      try { await t(); } catch (e) { errors.push(e); }
      onDone();
    }
  };
  await Promise.all(Array.from({ length: limit }, worker));
  return errors;
}

/** URL dei font citati da un CSS (Remix Icon, Google Fonts): servono anche loro per l'uso offline. */
function fontUrlsFromCss(cssText, baseUrl) {
  const urls = new Set();
  const re = /url\(\s*['"]?([^'")]+)['"]?\s*\)/g;
  let m;
  while ((m = re.exec(cssText))) {
    if (m[1].startsWith('data:')) continue;
    try { urls.add(new URL(m[1], baseUrl).href); } catch (e) {}
  }
  const all = [...urls];
  // Remix Icon elenca lo stesso font in 5 formati: basta il woff2 (quello che usano tutti i browser moderni)
  const woff2 = all.filter(u => /\.woff2(\?|$)/.test(u));
  return woff2.length ? woff2 : all;
}

async function precacheAll() {
  const cache = await caches.open(CACHE_NAME);
  const runtime = await caches.open(RUNTIME_CACHE);
  let done = 0;
  let total = ASSETS_TO_CACHE.length + EXTERNAL_ASSETS.length;
  const progress = () => {
    done++;
    notifyClients({ type: 'precache-progress', done, total: Math.max(total, done) });
  };

  // 1. File dell'app (obbligatori). 'no-cache': si chiede sempre al server se il file è cambiato
  //    (GitHub Pages lo farebbe tenere al browser per 10 minuti), ma se non è cambiato non si riscarica.
  const coreTasks = ASSETS_TO_CACHE.map(url => () =>
    fetchRetry(() => new Request(url, { cache: 'no-cache' }))
      .then(res => cache.put(url, res))
      .catch(err => { throw new Error(`${url}: ${err && err.message}`); })
  );

  // 2. Librerie e font esterni (URL con versione: se già in cache non si riscaricano),
  //    più i file dei font citati dentro i loro CSS
  const fontTasks = [];
  const extTasks = EXTERNAL_ASSETS.map(url => async () => {
    const required = REQUIRED_EXTERNAL.includes(url);
    try {
      let res = await runtime.match(url);
      if (!res) {
        res = await fetchRetry(() => new Request(url, { mode: 'cors' }));
        await runtime.put(url, res.clone());
      }
      if (url.endsWith('.css') || url.startsWith('https://fonts.googleapis.com/')) {
        const fonts = fontUrlsFromCss(await res.text(), url);
        for (const f of fonts) {
          total++;
          fontTasks.push(() => runtime.match(f).then(hit => hit || fetchRetry(() => new Request(f, { mode: 'cors' }))
            .then(r => runtime.put(f, r)))
            .catch(err => console.warn(`Font non in cache: ${f}`, err)));
        }
      }
    } catch (err) {
      if (required) throw new Error(`${url}: ${err && err.message}`);
      console.warn(`Libreria esterna non in cache: ${url}`, err);
    }
  });

  const errors = await runPool([...coreTasks, ...extTasks], 6, progress);
  if (errors.length) throw new Error(`File non scaricati (${errors.length}): ${errors.map(e => e.message).join(', ')}`);
  await runPool(fontTasks, 6, progress);
  notifyClients({ type: 'precache-done' });
}

function isImageHost(url) {
  let host = '';
  try { host = new URL(url).hostname; } catch (e) { return false; }
  return host === 'i.ibb.co' || host.endsWith('.ibb.co') || (host.endsWith('imgbb.com') && host !== 'api.imgbb.com');
}

// Fetch: Gestione intelligente della rete e della cache
self.addEventListener('fetch', event => {
  // Ignora richieste non GET (es. POST, PUT)
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // IMMAGINI (ImgBB): prima la cache immagini, altrimenti rete (e si salvano per l'uso offline)
  if (isImageHost(url)) {
    event.respondWith(imageResponse(event.request));
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
    url.includes('imgbb.com')
  ) {
    return; // Passa direttamente alla rete
  }

  // STRATEGIA: Cache-First per i file statici della PWA
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then(res => {
        // file dell'app non in elenco (ASSETS_TO_CACHE): lo si salva comunque, così la prossima volta c'è anche offline
        const sameOrigin = url.startsWith(self.location.origin);
        if (res.ok && sameOrigin && event.request.mode !== 'navigate' && !url.endsWith('/sw.js')) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, copy)).catch(() => {});
        }
        return res;
      }).catch(err => {
        // apertura di una pagina senza rete (es. URL con parametri non in cache): si apre l'app
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html').then(r => r || Promise.reject(err));
        }
        throw err;
      });
    })
  );
});

async function imageResponse(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request.url);
  // una copia "opaca" in cache non va bene per le richieste CORS (es. loghi dipinti sulla maglia 3D)
  if (cached && !(request.mode === 'cors' && cached.type === 'opaque')) return cached;
  try {
    // sempre in CORS: la risposta si può salvare senza il "peso" delle risposte opache e va bene anche per <img>
    const res = await fetch(request.url, { mode: 'cors', credentials: 'omit' });
    if (res.ok) {
      cache.put(request.url, res.clone()).then(() => trimImages(cache)).catch(() => {});
      return res;
    }
  } catch (e) { /* senza rete, o host senza CORS: si prova la richiesta originale */ }
  return fetch(request);
}

let trimming = false;
async function trimImages(cache) {
  if (trimming) return;
  trimming = true;
  try {
    const keys = await cache.keys();
    const extra = keys.length - IMAGE_CACHE_MAX;
    for (let i = 0; i < extra; i++) await cache.delete(keys[i]);
  } catch (e) {} finally { trimming = false; }
}

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
