import { db, ref, onValue } from '../firebase-config.js';

/**
 * Risorse PNG della divisa: modelli di maglia, disegni e marchi tecnici.
 * - Modelli provvisori inclusi nell'app (icons/kit/<id>/...).
 * - Modelli, disegni e marchi caricati dal Patron (Firebase: kitAssets/...).
 *
 * MODELLO (tutti i PNG con la stessa dimensione w×h e perfettamente allineati):
 *   layers.body       maschera del busto              (obbligatoria, si colora)
 *   layers.sleeves    maschera delle maniche          (si colora)
 *   layers.collar     maschera del colletto           (si colora)
 *   layers.cuffs      maschera dei polsini            (si colora)
 *   layers.shadow     ombre e pieghe in scala di grigi, bianco = nessuna ombra (in "moltiplica")
 *   layers.highlight  luci, bianco su trasparente     (in "schermo")
 *   layers.overlay    dettagli fissi sopra a tutto    (facoltativo, es. etichetta o cuciture colorate)
 *   anchors           posizioni in pixel del PNG: crest, brand, chest, belly, hem {x,y,s},
 *                     sponsor {x,y,w,h}, sleeveL / sleeveR {x,y,s,r}
 * DISEGNO: PNG a un colore su trasparente, stessa dimensione dei modelli (viene colorato e ritagliato sulle zone).
 * MARCHIO: PNG del logo su trasparente (viene usato a colori originali o in tinta unica).
 */
export const KIT_LAYERS = [
  { key: 'body',      label: 'Busto (maschera)',      required: true },
  { key: 'sleeves',   label: 'Maniche (maschera)' },
  { key: 'collar',    label: 'Colletto (maschera)' },
  { key: 'cuffs',     label: 'Polsini (maschera)' },
  { key: 'shadow',    label: 'Ombre e pieghe (moltiplica)' },
  { key: 'highlight', label: 'Luci (schermo)' },
  { key: 'overlay',   label: 'Dettagli sopra (facoltativo)' }
];

export const KIT_ANCHORS = [
  { key: 'crest',   label: 'Stemma squadra', type: 'box' },
  { key: 'brand',   label: 'Marchio tecnico', type: 'box' },
  { key: 'sponsor', label: 'Sponsor', type: 'rect' },
  { key: 'chest',   label: 'Patch centro petto', type: 'box' },
  { key: 'belly',   label: 'Patch sotto lo sponsor', type: 'box' },
  { key: 'sleeveL', label: 'Patch manica sinistra', type: 'rot' },
  { key: 'sleeveR', label: 'Patch manica destra', type: 'rot' },
  { key: 'hem',     label: 'Patch fondo maglia', type: 'box' }
];

/** Posizioni predefinite per un PNG 800×840 (scalate se il modello ha un'altra dimensione). */
export function defaultAnchors(w = 800, h = 840, longSleeves = false) {
  const sx = w / 800, sy = h / 840, sc = Math.min(sx, sy);
  const box = (x, y, s, r = 0) => ({ x: Math.round(x * sx), y: Math.round(y * sy), s: Math.round(s * sc), r });
  return {
    crest: box(292, 216, 88),
    brand: box(508, 212, 70),
    sponsor: { x: Math.round(400 * sx), y: Math.round(396 * sy), w: Math.round(320 * sc), h: Math.round(148 * sc) },
    chest: box(400, 236, 64),
    belly: box(400, 588, 76),
    sleeveL: longSleeves ? box(144, 236, 64, 18) : box(140, 216, 64, 42),
    sleeveR: longSleeves ? box(656, 236, 64, -18) : box(660, 216, 64, -42),
    hem: box(264, 712, 52)
  };
}

const builtin = (id, name, longSleeves) => ({
  id, name, builtin: true, w: 800, h: 840, order: 0,
  layers: Object.fromEntries(['body', 'sleeves', 'collar', 'cuffs', 'shadow', 'highlight'].map(k => [k, `icons/kit/${id}/${k}.png`])),
  anchors: defaultAnchors(800, 840, longSleeves)
});

export const BUILTIN_TEMPLATES = [
  builtin('crew-short', 'Girocollo, maniche corte (provvisorio)', false),
  builtin('v-short', 'Scollo a V, maniche corte (provvisorio)', false),
  builtin('polo-long', 'Polo, maniche lunghe (provvisorio)', true)
];

/* ----------------------------------------------------------- dati dal DB */
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

/** Avvisa quando il Patron cambia modelli/disegni/marchi. Restituisce la funzione per smettere. */
export function onKitAssetsChange(fn) {
  subscribe();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const list = (obj) => Object.entries(obj || {}).map(([id, v]) => ({ ...v, id })).filter(v => v && v.id);

export function getTemplates() {
  subscribe();
  const custom = list(raw.templates)
    .filter(t => t.layers && t.layers.body)
    .map(t => ({ ...t, anchors: { ...defaultAnchors(t.w || 800, t.h || 840), ...(t.anchors || {}) } }))
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || String(a.name).localeCompare(String(b.name), 'it'));
  const showBuiltin = !(raw.settings && raw.settings.hideBuiltin) || custom.length === 0;
  return showBuiltin ? custom.concat(BUILTIN_TEMPLATES) : custom;
}

export function getTemplate(id) {
  const all = getTemplates();
  return all.find(t => t.id === id) || BUILTIN_TEMPLATES.find(t => t.id === id) || all[0] || BUILTIN_TEMPLATES[0];
}

export function getPngPatterns() { subscribe(); return list(raw.patterns).filter(p => p.url); }
export function getPngBrands() { subscribe(); return list(raw.brands).filter(b => b.url); }
export function getKitSettings() { subscribe(); return raw.settings || {}; }

/* ------------------------------------------------------------- immagini */
const imgCache = new Map();

/**
 * Carica un'immagine per il canvas. Prova in modalità CORS (canvas esportabile, scontorno possibile);
 * se il server non lo permette la ricarica normalmente (si vede comunque).
 */
export function loadImage(url) {
  if (!url) return Promise.resolve(null);
  if (imgCache.has(url)) return imgCache.get(url);
  const attempt = (cors) => new Promise((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
  const sameOrigin = /^(data:|blob:)/i.test(url) || !/^https?:/i.test(url) || url.startsWith(location.origin);
  const p = (sameOrigin ? attempt(false) : attempt(true).catch(() => attempt(false)))
    .catch(() => { imgCache.delete(url); return null; });
  imgCache.set(url, p);
  return p;
}
