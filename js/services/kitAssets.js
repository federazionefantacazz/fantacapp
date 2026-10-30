import { db, ref, onValue } from '../firebase-config.js';

/**
 * Risorse PNG della divisa caricate dal Patron (Firebase: kitAssets/..., immagini su ImgBB).
 *
 * DISEGNI (kitAssets/patterns/{id}: { name, url, mode, colors }):
 *   mode 'panel' (default): PNG a un colore su trasparente, adattato a ogni pezzo della maglia
 *                           (davanti, dietro, maniche) come i disegni integrati, e colorato.
 *   mode 'uv':              grafica disegnata sulla mappa UV completa della maglia
 *                           (modello in icons/kit3d/uv-template.png), applicata così com'è.
 *   colors 'tint' (default) = colorata col colore del livello, 'original' = colori del PNG (solo 'uv').
 * MARCHI (kitAssets/brands/{id}: { name, url }): PNG del logo su trasparente.
 * PATCH  (kitAssets/patches/{id}: { name, url, kind, compId }): PNG della patch su trasparente.
 *   kind 'champ' (campione): la squadra la sceglie nell'editor e decide dove metterla (non sulla manica sinistra).
 *   kind 'comp' (competizione): legata alla competizione compId (anche più patch per competizione), vanno tutte da sole sulla manica sinistra delle maglie
 *   quando si guarda una partita di quella competizione (Live). Senza kind: 'comp' se nel nome c'è "manica".
 * SIMBOLI (kitAssets/symbols/{id}: { name, url }): PNG di un simbolo su trasparente, da ripetere come forma nei disegni.
 */
let raw = {};
let subscribed = false;
const listeners = new Set();

function subscribe() {
  if (subscribed) return;
  subscribed = true;
  onValue(ref(db, 'kitAssets'), snap => {
    raw = snap.val() || {};
    listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
  });
}

/** Avvisa quando il Patron cambia disegni o marchi. Restituisce la funzione per smettere. */
export function onKitAssetsChange(fn) {
  subscribe();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const list = (obj) => Object.entries(obj || {}).map(([id, v]) => ({ ...v, id })).filter(v => v && v.id);

export function getPngPatterns() { subscribe(); return list(raw.patterns).filter(p => p.url); }
export function getPngBrands() { subscribe(); return list(raw.brands).filter(b => b.url); }
export function getPngPatches() {
  subscribe();
  return list(raw.patches).filter(b => b.url).map(b => ({ ...b, kind: b.kind === 'comp' || b.kind === 'champ' ? b.kind : /manica/i.test(b.name || '') ? 'comp' : 'champ' }));
}
/** Patch campione (le sceglie la squadra). */
export function getChampPatches() { return getPngPatches().filter(b => b.kind === 'champ'); }
/** Patch delle competizioni (manica sinistra, automatiche). */
export function getCompPatches() { return getPngPatches().filter(b => b.kind === 'comp'); }
/** Patch della competizione compId (anche più di una: vanno tutte sulla manica sinistra). */
export function getCompPatchesOf(compId) {
  if (compId === undefined || compId === null || compId === '') return [];
  return getCompPatches().filter(b => String(b.compId) === String(compId));
}
export function getPngSymbols() { subscribe(); return list(raw.symbols).filter(b => b.url); }
