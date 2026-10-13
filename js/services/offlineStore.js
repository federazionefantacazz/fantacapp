/**
 * Copia locale (IndexedDB) degli ultimi dati letti da Firebase.
 *
 * Il Realtime Database sul web non conserva nulla tra un avvio e l'altro: senza rete
 * l'app resterebbe vuota. Qui si salva l'ultimo valore di ogni nodo seguito
 * (squadre, giocatori, voti, calendario...) e all'avvio lo si mostra subito,
 * finché non arrivano i dati freschi.
 *
 *  - DB IndexedDB "fantacapp-offline", store "nodes": chiave = percorso Firebase, valore = { v, t }
 *  - watch(path, cb) sostituisce onValue: prima la copia locale, poi i dati live (che vengono salvati)
 */
import { db, ref, onValue } from '../firebase-config.js';

const DB_NAME = 'fantacapp-offline';
const STORE = 'nodes';
const LAST_SYNC_KEY = 'fantacapp-last-sync';
const WRITE_DELAY = 1200; // i nodi che cambiano spesso (voti live) si scrivono al massimo ogni 1,2 s

let dbPromise = null;
function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB non disponibile'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch(err => { console.warn('Archivio offline non disponibile:', err?.message); return null; });
  return dbPromise;
}

function tx(mode, fn) {
  return openDb().then(idb => new Promise(resolve => {
    if (!idb) return resolve(undefined);
    try {
      const t = idb.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(req ? req.result : undefined);
      t.onerror = t.onabort = () => resolve(undefined);
    } catch (e) { resolve(undefined); }
  }));
}

const pending = new Map();
const timers = new Map();

/** Snapshot finto con la stessa interfaccia minima di quello di Firebase. */
function cachedSnapshot(v) {
  return { val: () => v, exists: () => v !== null && v !== undefined, fromCache: true };
}

export const OfflineStore = {
  /** Ultimo valore salvato per il percorso (undefined se assente). */
  async read(path) {
    const rec = await tx('readonly', s => s.get(path));
    return rec ? rec.v : undefined;
  },

  /** Salva il valore (con un breve ritardo, così gli aggiornamenti a raffica diventano una sola scrittura). */
  save(path, value) {
    pending.set(path, value);
    if (timers.has(path)) return;
    timers.set(path, setTimeout(() => {
      timers.delete(path);
      const v = pending.get(path);
      pending.delete(path);
      tx('readwrite', s => s.put({ v, t: Date.now() }, path));
    }, WRITE_DELAY));
  },

  /** Cancella tutti i dati salvati (al logout). */
  clear() {
    timers.forEach(clearTimeout);
    timers.clear();
    pending.clear();
    try { localStorage.removeItem(LAST_SYNC_KEY); } catch (e) {}
    return tx('readwrite', s => s.clear());
  },

  /** Momento dell'ultimo dato ricevuto dal server (ms), o 0. */
  lastSync() {
    try { return Number(localStorage.getItem(LAST_SYNC_KEY)) || 0; } catch (e) { return 0; }
  },

  /**
   * Come onValue(ref(db, path), cb, onErr), ma all'avvio chiama subito cb con la copia locale
   * (se esiste e i dati live non sono ancora arrivati). Ritorna la funzione di unsubscribe.
   */
  watch(path, cb, onErr) {
    let live = false;
    let closed = false;
    this.read(path).then(v => {
      if (!live && !closed && v !== undefined) cb(cachedSnapshot(v));
    });
    const unsub = onValue(ref(db, path), snap => {
      live = true;
      const v = snap.val();
      this.save(path, v);
      try { localStorage.setItem(LAST_SYNC_KEY, String(Date.now())); } catch (e) {}
      cb(snap);
    }, onErr);
    return () => { closed = true; unsub(); };
  },

  /** Promessa con un tempo massimo: le letture get() senza rete possono restare appese. */
  withTimeout(promise, ms = 6000) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
    ]);
  }
};
