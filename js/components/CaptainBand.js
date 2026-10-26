/**
 * Fascia da capitano: piccola icona disegnata in SVG accanto al capitano (Formazione, Live).
 * Ogni squadra la personalizza in Configurazione squadra → Fascia da capitano (js/menu/FasciaCapitano.js).
 *
 * Firebase: teams/{id}/captainBand = { shape, pattern, bg, bg2, fg, border, text, font }
 */
import { esc } from '../utils.js';

export const BAND_SHAPES = [
  { id: 'band', label: 'Fascia' },
  { id: 'circle', label: 'Tondo' },
  { id: 'shield', label: 'Scudo' }
];
export const BAND_PATTERNS = [
  { id: 'plain', label: 'Tinta unita' },
  { id: 'stripes', label: 'Righe' },
  { id: 'split', label: 'Metà' },
  { id: 'diagonal', label: 'Diagonale' }
];
export const BAND_FONTS = [
  { id: 'bebas', label: 'Sportivo', css: "'Bebas Neue', sans-serif", weight: 400 },
  { id: 'sans', label: 'Classico', css: "'DM Sans', sans-serif", weight: 800 }
];
export const BAND_MAX_TEXT = 2;

export const BAND_DEFAULT = {
  shape: 'band', pattern: 'plain', font: 'bebas', text: 'C',
  bg: '#f5c518', bg2: '#1e5bb8', fg: '#111111', border: '#111111'
};

const HEX = /^#[0-9a-f]{6}$/i;
const pick = (list, v, def) => (list.some(x => x.id === v) ? v : def);

/** Fascia sempre valida (valori mancanti o sbagliati → predefiniti). */
export function normalizeBand(b) {
  const src = b && typeof b === 'object' ? b : {};
  const color = (k) => (HEX.test(String(src[k] || '')) ? String(src[k]).toLowerCase() : BAND_DEFAULT[k]);
  const text = Array.from(String(src.text ?? BAND_DEFAULT.text).trim()).slice(0, BAND_MAX_TEXT).join('');
  return {
    shape: pick(BAND_SHAPES, src.shape, BAND_DEFAULT.shape),
    pattern: pick(BAND_PATTERNS, src.pattern, BAND_DEFAULT.pattern),
    font: pick(BAND_FONTS, src.font, BAND_DEFAULT.font),
    text,
    bg: color('bg'), bg2: color('bg2'), fg: color('fg'), border: color('border')
  };
}

// forma: area del disegno, contorno e grandezza della lettera (1 o 2 caratteri)
const SHAPES = {
  band:   { w: 44, h: 28, outline: '<rect x="1.5" y="1.5" width="41" height="25" rx="7"/>', size: [21, 16] },
  circle: { w: 32, h: 32, outline: '<circle cx="16" cy="16" r="14.5"/>', size: [20, 14] },
  shield: { w: 30, h: 34, outline: '<path d="M15 1.5 L28 5.5 V16 C28 24.5 22.5 29.5 15 32.5 C7.5 29.5 2 24.5 2 16 V5.5 Z"/>', size: [19, 13] }
};

let N = 0;

/**
 * SVG della fascia. opts: { height (px, default 18), title }.
 * Si adatta in larghezza alla forma; la lettera usa i font dell'app.
 */
export function captainBandSVG(band, { height = 18, title = 'Capitano' } = {}) {
  const b = normalizeBand(band);
  const s = SHAPES[b.shape];
  const id = `cb${++N}`;
  const { w, h } = s;
  let paint = `<rect width="${w}" height="${h}" fill="${b.bg}"/>`;
  if (b.pattern === 'stripes') {
    paint += `<rect y="${h * 0.16}" width="${w}" height="${h * 0.12}" fill="${b.bg2}"/><rect y="${h * 0.72}" width="${w}" height="${h * 0.12}" fill="${b.bg2}"/>`;
  } else if (b.pattern === 'split') {
    paint += `<rect x="${w / 2}" width="${w / 2}" height="${h}" fill="${b.bg2}"/>`;
  } else if (b.pattern === 'diagonal') {
    paint += `<polygon points="${w},0 ${w},${h} 0,${h}" fill="${b.bg2}"/>`;
  }
  const font = BAND_FONTS.find(f => f.id === b.font);
  const size = s.size[Array.from(b.text).length > 1 ? 1 : 0];
  const text = b.text
    ? `<text x="${w / 2}" y="${h / 2 + size * 0.35}" text-anchor="middle" font-family="${esc(font.css)}" font-weight="${font.weight}" font-size="${size}" fill="${b.fg}">${esc(b.text)}</text>`
    : '';
  const width = Math.round(height * w / h);
  return `<svg class="captain-band" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${width}" height="${height}" role="img" aria-label="${esc(title)}">
    <title>${esc(title)}</title>
    <defs><clipPath id="${id}">${s.outline}</clipPath></defs>
    <g clip-path="url(#${id})">${paint}</g>
    <g fill="none" stroke="${b.border}" stroke-width="2">${s.outline}</g>
    ${text}
  </svg>`;
}
