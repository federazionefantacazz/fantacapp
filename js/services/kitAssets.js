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
 * PATCH  (kitAssets/patches/{id}: { name, url }): PNG della patch su trasparente (petto, maniche, fondo maglia).
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
export function getPngPatches() { subscribe(); return list(raw.patches).filter(b => b.url); }
export function getPngSymbols() { subscribe(); return list(raw.symbols).filter(b => b.url); }
