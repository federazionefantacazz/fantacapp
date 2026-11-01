/**
 * Service worker dell'app (sw.js): registrazione, primo download completo e aggiornamenti.
 * Script classico caricato nell'<head> di index.html, prima di tutto il resto.
 *
 *  - Primo avvio (nessuna versione già installata): schermata "Preparazione dell'app" con
 *    l'avanzamento, finché sw.js non ha messo in cache TUTTI i file. Solo allora l'app si usa:
 *    da quel momento si apre anche senza rete.
 *  - Nuova versione: sw.js la scarica per intero in background e la tiene in attesa.
 *    Se è pronta all'apertura dell'app (prima che l'utente tocchi qualcosa) si passa subito
 *    alla nuova versione con un ricaricamento; se arriva mentre si usa l'app compare il
 *    banner "Aggiorna" (#update-banner), e con "Dopo" si aggiorna alla prossima apertura.
 */
(function () {
  if (!('serviceWorker' in navigator)) return;
  var sw = navigator.serviceWorker;
  var root = document.documentElement;
  var reg = null;
  var hadController = !!sw.controller;
  var applying = false;  // il passaggio alla nuova versione l'abbiamo chiesto noi
  var touched = false;   // l'utente ha già toccato l'app: niente ricaricamenti a sorpresa
  var APPLIED_KEY = 'fantacapp-sw-applied';
  var SKIP_AFTER_MS = 20000;

  ['pointerdown', 'keydown'].forEach(function (t) {
    window.addEventListener(t, function () { touched = true; }, { once: true, capture: true });
  });

  function byId(id) { return document.getElementById(id); }
  function whenDom(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  /* ─── Schermata del primo download ─────────────────────────────────── */
  var gateOn = false;
  var gateTimer = null;
  function showGate() {
    gateOn = true;
    root.classList.add('pwa-installing');
    gateTimer = setTimeout(function () {
      var b = byId('pwa-gate-skip');
      if (b) b.style.visibility = 'visible';
    }, SKIP_AFTER_MS);
  }
  function hideGate() {
    if (!gateOn) return;
    gateOn = false;
    clearTimeout(gateTimer);
    root.classList.remove('pwa-installing');
  }
  function gateProgress(done, total) {
    if (!gateOn || !total) return;
    var pct = Math.min(100, Math.round(done / total * 100));
    var fill = byId('pwa-gate-fill');
    var txt = byId('pwa-gate-pct');
    if (fill) fill.style.width = pct + '%';
    if (txt) txt.textContent = pct + '%';
  }
  // rete lentissima: dopo un po' si può aprire l'app senza aspettare (funziona, ma non ancora offline)
  window.skipPwaGate = hideGate;

  /* ─── Aggiornamenti ────────────────────────────────────────────────── */
  function showBanner() {
    whenDom(function () {
      var b = byId('update-banner');
      if (b) b.classList.add('show');
    });
  }

  function recentlyApplied() {
    try { return Date.now() - Number(sessionStorage.getItem(APPLIED_KEY) || 0) < 60000; } catch (e) { return false; }
  }

  function applyUpdate(worker) {
    if (!worker) { location.reload(); return; }
    applying = true;
    try { sessionStorage.setItem(APPLIED_KEY, String(Date.now())); } catch (e) {}
    worker.postMessage({ type: 'SKIP_WAITING' });
    // se per qualche motivo il cambio non arriva, si ricarica comunque
    setTimeout(function () { location.reload(); }, 5000);
  }

  // pulsante "Aggiorna" del banner
  window.applyAppUpdate = function () { applyUpdate(reg && reg.waiting); };

  // nuova versione scaricata per intero e in attesa
  function onWaiting(worker) {
    if (!sw.controller) return; // primo avvio: si attiva da sola
    var early = !touched && !root.classList.contains('booted');
    if (early && !recentlyApplied()) applyUpdate(worker);
    else showBanner();
  }

  function track(worker) {
    if (!worker) return;
    if (worker.state === 'installed') { onWaiting(worker); return; }
    worker.addEventListener('statechange', function () {
      if (worker.state === 'installed') onWaiting(worker);
      else if (worker.state === 'redundant') hideGate(); // download non riuscito: l'app va comunque (online)
    });
  }

  sw.addEventListener('controllerchange', function () {
    if (applying) { location.reload(); return; }
    // un'altra finestra (es. admin.html o un'altra scheda) ha attivato la nuova versione
    if (hadController) showBanner();
    hadController = true;
  });

  sw.addEventListener('message', function (e) {
    var d = e.data || {};
    if (d.type === 'precache-progress') gateProgress(d.done, d.total);
    else if (d.type === 'precache-failed') hideGate();
  });
  if (sw.startMessages) sw.startMessages(); // i messaggi arrivano anche prima di DOMContentLoaded

  sw.getRegistration().then(function (existing) {
    // nessuna versione installata (primo avvio, o dati del sito cancellati): si aspetta il download completo
    if ((!existing || !existing.active) && navigator.onLine) showGate();
    return sw.register('./sw.js');
  }).then(function (r) {
    reg = r;
    if (r.waiting) onWaiting(r.waiting);
    if (r.installing) track(r.installing);
    r.addEventListener('updatefound', function () { track(r.installing); });
    if (gateOn) sw.ready.then(hideGate);
    // controlla gli aggiornamenti quando l'app torna in primo piano
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && navigator.onLine) r.update().catch(function () {});
    });
  }).catch(function (err) {
    console.error('Errore SW', err);
    hideGate();
  });
})();
