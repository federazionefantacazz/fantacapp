/**
 * Fascia da capitano: fascia elastica 3D (components/Kit3D.js) con il disegno stampato sopra, da sola o indossata
 * sulla manica sinistra della maglia, nell'editor della divisa (js/menu/DivisaSquadra.js → FASE 8: Fascia da capitano).
 * Accanto al capitano (Formazione, Live) si vede la sua foto (image, generata al salvataggio) o, senza foto, l'icona in SVG.
 * Il capitano si sceglie in Formazione.
 *
 * Firebase: teams/{id}/captainBand = {
 *   shape, bg, border,                                   // forma dell'icona (fascia, tondo, scudo), fondo, bordo
 *   layers: [{ type, color, opacity, scale, x, y, rot, flipX, flipY, url, mono, ...parametri dei motivi }],
 *                                                         // come i livelli della maglia: disegni integrati e motivi,
 *                                                         // PNG del Patron ('png:<id>') o immagine del giocatore ('img')
 *   text, font, fg, textSize, textX, textY, textOutline, // la "C" del capitano
 *   image                                                // foto PNG della fascia 3D (ImgBB)
 * }
 * Le fasce di prima ({ pattern, bg2 }) diventano un livello.
 */
import { esc } from '../utils.js';
import { PATTERNS, NUMBER_FONTS, patternArtSVG, motifParams, imageDataUrl, keepsColors } from './KitRenderer.js';
import { getPngPatterns } from '../services/kitAssets.js';

export const BAND_SHAPES = [
  { id: 'band', label: 'Fascia' },
  { id: 'circle', label: 'Tondo' },
  { id: 'shield', label: 'Scudo' }
];
export const BAND_FONTS = [
  { id: 'bebas', label: 'Sportivo', css: "'Bebas Neue', sans-serif", weight: 400 },
  { id: 'sans', label: 'Classico', css: "'DM Sans', sans-serif", weight: 800 },
  ...NUMBER_FONTS.filter(f => f.id !== 'bebas').map(f => ({ id: f.id, label: f.label, css: f.css, weight: f.weight, style: f.style }))
];
export const BAND_MAX_TEXT = 2;
export const BAND_MAX_LAYERS = 4;

export const BAND_DEFAULT = {
  shape: 'band', bg: '#f5c518', border: '#111111', layers: [],
  text: 'C', font: 'bebas', fg: '#111111', textSize: 100, textX: 0, textY: 0, textOutline: ''
};

const HEX = /^#[0-9a-f]{6}$/i;
const pick = (list, v, def) => (list.some(x => x.id === v) ? v : def);
const num = (v, a, b, def) => (Number.isFinite(+v) && v !== '' && v !== null ? Math.min(b, Math.max(a, Math.round(+v))) : def);
const toArr = (v) => Array.isArray(v) ? v.filter(Boolean) : (v && typeof v === 'object' ? Object.values(v).filter(Boolean) : []);
const MOTIF_KEYS = ['count', 'size', 'gap', 'dir', 'amp', 'len', 'shape', 'fill', 'stagger', 'all', 'symUrl', 'symMono'];

/** Livello della fascia sempre valido. */
export function normalizeBandLayer(l) {
  const out = {
    type: String(l.type || 'm-stripe'),
    color: HEX.test(String(l.color || '')) ? String(l.color).toLowerCase() : '#ffffff',
    opacity: num(l.opacity, 5, 100, 100), scale: num(l.scale, 30, 250, 100),
    x: num(l.x, -50, 50, 0), y: num(l.y, -50, 50, 0), rot: num(l.rot, -180, 180, 0),
    flipX: !!l.flipX, flipY: !!l.flipY
  };
  if (out.type === 'img') { out.url = String(l.url || ''); out.mono = !!l.mono; }
  MOTIF_KEYS.forEach(k => { if (l[k] !== undefined) out[k] = l[k]; });
  return out;
}

/** Fascia sempre valida (valori mancanti o sbagliati → predefiniti). */
export function normalizeBand(b) {
  const src = b && typeof b === 'object' ? b : {};
  const color = (k, def = BAND_DEFAULT[k]) => (HEX.test(String(src[k] || '')) ? String(src[k]).toLowerCase() : def);
  const text = Array.from(String(src.text ?? BAND_DEFAULT.text).trim()).slice(0, BAND_MAX_TEXT).join('');
  let layers = toArr(src.layers);
  // fascia di prima: il disegno (righe, metà, diagonale) con la seconda tinta diventa un livello
  if (!src.layers && src.pattern && src.pattern !== 'plain') {
    const c2 = color('bg2', '#1e5bb8');
    layers = [{
      stripes:  { type: 'm-stripe', dir: 'h', count: 2, size: 8, gap: 28 },
      split:    { type: 'half', flipX: true },
      diagonal: { type: 'half', flipX: true, rot: 57 }
    }[src.pattern]].filter(Boolean).map(l => ({ ...l, color: c2 }));
  }
  return {
    shape: pick(BAND_SHAPES, src.shape, BAND_DEFAULT.shape),
    bg: color('bg'), border: color('border'),
    layers: layers.slice(0, BAND_MAX_LAYERS).map(normalizeBandLayer),
    text,
    font: pick(BAND_FONTS, src.font, BAND_DEFAULT.font),
    fg: color('fg'),
    textSize: num(src.textSize, 40, 180, 100), textX: num(src.textX, -45, 45, 0), textY: num(src.textY, -45, 45, 0),
    textOutline: HEX.test(String(src.textOutline || '')) ? String(src.textOutline).toLowerCase() : '',
    ...(src.image ? { image: String(src.image) } : {})
  };
}

// forma: area del disegno, contorno e grandezza della lettera (1 o 2 caratteri)
const SHAPES = {
  band:   { w: 44, h: 28, outline: '<rect x="1.5" y="1.5" width="41" height="25" rx="7"/>', size: [21, 16] },
  circle: { w: 32, h: 32, outline: '<circle cx="16" cy="16" r="14.5"/>', size: [20, 14] },
  shield: { w: 30, h: 34, outline: '<path d="M15 1.5 L28 5.5 V16 C28 24.5 22.5 29.5 15 32.5 C7.5 29.5 2 24.5 2 16 V5.5 Z"/>', size: [19, 13] }
};
// porzione della vista frontale dei disegni (400×420, vedi KitRenderer.js) che finisce sulla fascia
const VB = [100, 146, 200, 128];
/** Porzione per una fascia larga `aspect` volte l'altezza: sempre tutta l'altezza di VB, più o meno larga attorno al centro. */
const vbFor = (aspect) => [200 - VB[3] * aspect / 2, VB[1], VB[3] * aspect, VB[3]].map(v => +v.toFixed(2)).join(' ');

/** URL dell'immagine di un livello (il tuo PNG, un PNG del Patron o il simbolo di una forma). */
function layerUrl(l) {
  if (l.type === 'img') return l.url || '';
  if (String(l.type).startsWith('png:')) return (getPngPatterns().find(p => 'png:' + p.id === l.type) || {}).url || '';
  if (l.type === 'm-shape' && l.shape === 'png') return l.symUrl || '';
  return '';
}

/** Livelli in SVG (nella porzione VB). resolve(url) → href da usare (URL o data URL). */
function layersSVG(band, uid, resolve) {
  return band.layers.map((l, i) => {
    const id = `${uid}l${i}`, url = layerUrl(l), href = url ? resolve(url) : '';
    const tint = (on) => (on ? `<filter id="${id}f" color-interpolation-filters="sRGB"><feFlood flood-color="${l.color}"/><feComposite in2="SourceAlpha" operator="in"/></filter>` : '');
    let art = '', filt = false;
    if (l.type === 'img' || String(l.type).startsWith('png:')) {
      if (!href) return '';
      const s = l.scale / 100, cx = 200 + l.x / 100 * VB[2], cy = 210 - l.y / 100 * VB[3];
      const own = l.type === 'img';
      // la tua immagine: intera (dimensione e posizione con i cursori); un disegno PNG del Patron: copre la fascia
      const w = VB[2] * s * (own ? 1 : 1.6), h = VB[3] * s * (own ? 1 : 1.6);
      const fl = `${l.flipX ? -1 : 1},${l.flipY ? -1 : 1}`;
      art = `<image href="${esc(href)}" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid ${own ? 'meet' : 'slice'}" transform="translate(${cx},${cy}) rotate(${l.rot}) scale(${fl})"/>`;
      const pp = own ? null : getPngPatterns().find(p => 'png:' + p.id === l.type);
      filt = own ? l.mono : !(pp && pp.colors === 'original');
    } else {
      const p = PATTERNS.find(x => x.id === l.type);
      if (!p) return '';
      art = patternArtSVG(l, VB, { color: l.color, id, symData: href, wide: true });
      filt = p.motif && motifParams(l).shape === 'png' && !keepsColors(l);
    }
    return `${tint(filt)}<g opacity="${l.opacity / 100}" ${filt ? `filter="url(#${id}f)"` : ''}>${art}</g>`;
  }).join('');
}

let N = 0;

/**
 * SVG della fascia. opts: { height (px, default 18), title }.
 * Si adatta in larghezza alla forma; la lettera usa i font dell'app.
 */
export function captainBandSVG(band, { height = 18, title = 'Capitano' } = {}) {
  const b = normalizeBand(band);
  // foto della fascia 3D (salvata dall'editor della divisa)
  if (b.image) return `<img class="captain-band" src="${esc(b.image)}" alt="${esc(title)}" title="${esc(title)}" style="height:${height * 1.25}px; width:auto; display:inline-block; vertical-align:middle; filter:drop-shadow(0 1px 1px rgba(0,0,0,.45));">`;
  const s = SHAPES[b.shape];
  const id = `cb${++N}`;
  const { w, h } = s;
  const font = BAND_FONTS.find(f => f.id === b.font);
  const size = s.size[Array.from(b.text).length > 1 ? 1 : 0] * b.textSize / 100;
  const tx = w / 2 + b.textX / 100 * w, ty = h / 2 - b.textY / 100 * h + size * 0.35;
  const text = b.text
    ? `<text x="${tx}" y="${ty}" text-anchor="middle" font-family="${esc(font.css)}" font-weight="${font.weight}" ${font.style === 'italic' ? 'font-style="italic"' : ''} font-size="${size}" fill="${b.fg}"
        ${b.textOutline ? `stroke="${b.textOutline}" stroke-width="${(size * .14).toFixed(2)}" stroke-linejoin="round" paint-order="stroke"` : ''}>${esc(b.text)}</text>`
    : '';
  const width = Math.round(height * w / h);
  const art = b.layers.length ? `<svg x="0" y="0" width="${w}" height="${h}" viewBox="${vbFor(w / h)}" preserveAspectRatio="none">${layersSVG(b, id, u => u)}</svg>` : '';
  return `<svg class="captain-band" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${width}" height="${height}" role="img" aria-label="${esc(title)}">
    <title>${esc(title)}</title>
    <defs><clipPath id="${id}">${s.outline}</clipPath></defs>
    <g clip-path="url(#${id})"><rect width="${w}" height="${h}" fill="${b.bg}"/>${art}</g>
    <g fill="none" stroke="${b.border}" stroke-width="2">${s.outline}</g>
    ${text}
  </svg>`;
}

/**
 * Disegno della fascia stesa (striscia larga `aspect` volte l'altezza) su un canvas, per la manica della maglia 3D.
 * La lettera sta al centro (lato esterno del braccio). Restituisce { canvas, bg, border }.
 */
export async function bandRaster(band, aspect = 12, height = 200) {
  const b = normalizeBand(band);
  const w = Math.round(height * aspect), h = height;
  const urls = [...new Set(b.layers.map(layerUrl).filter(Boolean))];
  const data = new Map(await Promise.all(urls.map(async u => [u, await imageDataUrl(u, 512)])));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = b.bg; ctx.fillRect(0, 0, w, h);
  if (b.layers.length) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <svg x="0" y="0" width="${w}" height="${h}" viewBox="${vbFor(w / h)}" preserveAspectRatio="none">${layersSVG(b, 'r' + (++N), u => data.get(u) || '')}</svg></svg>`;
    const img = await new Promise(res => {
      const im = new Image();
      im.onload = () => res(im); im.onerror = () => res(null);
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
    if (img) ctx.drawImage(img, 0, 0, w, h);
  }
  if (b.text) {
    const font = BAND_FONTS.find(f => f.id === b.font);
    const size = h * (Array.from(b.text).length > 1 ? .57 : .75) * b.textSize / 100;
    const css = `${font.style === 'italic' ? 'italic ' : ''}${font.weight} ${size}px ${font.css}`;
    try { if (document.fonts) await document.fonts.load(css, b.text); } catch (e) { /* font di riserva */ }
    ctx.font = css; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    // la lettera ha le proporzioni della fascia piccola (44 × 28): lo spostamento è in % di quella
    const x = w / 2 + b.textX / 100 * h * 44 / 28, y = h / 2 - b.textY / 100 * h + size * 0.35;
    if (b.textOutline) { ctx.lineJoin = 'round'; ctx.lineWidth = size * .14; ctx.strokeStyle = b.textOutline; ctx.strokeText(b.text, x, y); }
    ctx.fillStyle = b.fg; ctx.fillText(b.text, x, y);
  }
  return { canvas, bg: b.bg, border: b.border };
}
