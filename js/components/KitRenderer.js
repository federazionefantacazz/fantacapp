/**
 * Disegno della divisa (maglia) in SVG, vista frontale.
 * La divisa è un oggetto semplice (salvato in teams/{id}/kit):
 * {
 *   collar, sleeves, cuffs, sleeveDeco,
 *   colors: { base, sleeves, collar, cuffs, trim },
 *   layers: [{ type, color, opacity, scale, flipX, flipY, onSleeves }],
 *   brand: { id, color, url },
 *   crest: { show, size },
 *   sponsor: { mode: 'none'|'image'|'text', url, text, font, color, mono, scale, y },
 *   patches: [{ id, src, name, pos, bg }]
 * }
 * Tutte le coordinate sono nel viewBox 0 0 400 420 (centro maglia x = 200).
 */

const W = 400;
const H = 420;
let UID = 0;

const escAttr = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeColor = (c, def = '#ffffff') => (/^#[0-9a-f]{3,8}$/i.test(String(c || '')) ? c : def);
const clamp = (v, a, b) => Math.min(b, Math.max(a, Number.isFinite(+v) ? +v : a));

/** Schiarisce (amt > 0) o scurisce (amt < 0) un colore esadecimale. */
export function shade(hex, amt) {
  let c = safeColor(hex, '#888888').slice(1);
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const n = parseInt(c.slice(0, 6), 16);
  const f = (v) => Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt);
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return '#' + [r, g, b].map(v => clamp(v, 0, 255).toString(16).padStart(2, '0')).join('');
}

/* ------------------------------------------------------------------ forme */
const TORSO = 'M166,24 L112,44 C104,80 100,112 102,146 L100,388 Q200,404 300,388 L298,146 C300,112 296,80 288,44 L234,24 Q200,42 166,24 Z';

const SLEEVE = {
  short: 'M116,42 C86,52 58,78 30,124 L72,170 C84,160 94,152 104,146 Z',
  long:  'M116,42 C86,52 62,82 48,130 C38,200 30,280 26,340 L66,346 C72,290 84,220 100,170 L104,146 Z'
};
// polsini (sopra la manica sinistra, la destra è specchiata)
const CUFF = {
  short: { band: 'M30,124 L72,170 L79,160 L37,114 Z', thin: 'M37,114 L79,160 L82,156 L40,110 Z' },
  long:  { band: 'M26,340 L66,346 L68,326 L28,320 Z', thin: 'M28,320 L68,326 L68.5,321 L28.5,315 Z' }
};
// raglan: spicchio della spalla col colore delle maniche
const RAGLAN = 'M170,25 L112,44 C104,80 100,112 102,146 Q126,74 170,25 Z';
const MIRROR = `transform="translate(${W},0) scale(-1,1)"`;

export const COLLARS = [
  { id: 'crew',     label: 'Girocollo' },
  { id: 'v',        label: 'Scollo a V' },
  { id: 'deepv',    label: 'V profondo' },
  { id: 'wrap',     label: 'V incrociato' },
  { id: 'polo',     label: 'Polo' },
  { id: 'polobtn',  label: 'Polo con bottoni' },
  { id: 'mandarin', label: 'Coreana' },
  { id: 'henley',   label: 'Serafino' },
  { id: 'laces',    label: 'Retrò con lacci' },
  { id: 'doublecrew', label: 'Girocollo doppio' }
];

export const SLEEVES = [
  { id: 'short',       label: 'Corte' },
  { id: 'long',        label: 'Lunghe' },
  { id: 'raglan',      label: 'Raglan corte' },
  { id: 'raglan-long', label: 'Raglan lunghe' }
];

export const CUFFS = [
  { id: 'none',   label: 'Nessuno' },
  { id: 'band',   label: 'Fascia' },
  { id: 'double', label: 'Doppia riga' },
  { id: 'thin',   label: 'Profilo sottile' }
];

export const SLEEVE_DECO = [
  { id: 'none',     label: 'Nessuna' },
  { id: 'stripes3', label: 'Tre strisce' },
  { id: 'stripes2', label: 'Due strisce' },
  { id: 'shoulder', label: 'Spalla colorata' },
  { id: 'band',     label: 'Fascia sul braccio' },
  { id: 'chevrons', label: 'Chevron' },
  { id: 'side',     label: 'Banda laterale' }
];

/* --------------------------------------------------------------- disegni */
// Ogni disegno restituisce markup sull'intera area 0..400 × 0..420 (poi ritagliata sulla maglia).
// s = scala (1 = normale), c = colore, id = prefisso univoco per i <defs>.
const range = (from, to, step) => { const out = []; for (let v = from; v <= to; v += step) out.push(v); return out; };

export const PATTERNS = [
  { id: 'stripes', label: 'Strisce verticali', draw: (c, s) => range(-20, W, 40 * s).map(x => `<rect x="${x}" y="0" width="${20 * s}" height="${H}" fill="${c}"/>`).join('') },
  { id: 'wideStripes', label: 'Strisce larghe', draw: (c, s) => range(-30, W, 80 * s).map(x => `<rect x="${x}" y="0" width="${40 * s}" height="${H}" fill="${c}"/>`).join('') },
  { id: 'pinstripes', label: 'Gessato', draw: (c, s) => range(0, W, 14 * s).map(x => `<rect x="${x}" y="0" width="${1.6 * s}" height="${H}" fill="${c}"/>`).join('') },
  { id: 'hoops', label: 'Bande orizzontali', draw: (c, s) => range(0, H, 50 * s).map(y => `<rect x="0" y="${y}" width="${W}" height="${25 * s}" fill="${c}"/>`).join('') },
  { id: 'thinHoops', label: 'Righe orizzontali', draw: (c, s) => range(10, H, 22 * s).map(y => `<rect x="0" y="${y}" width="${W}" height="${5 * s}" fill="${c}"/>`).join('') },
  { id: 'half', label: 'Metà e metà', draw: (c) => `<rect x="0" y="0" width="200" height="${H}" fill="${c}"/>` },
  { id: 'quarters', label: 'Quarti', draw: (c) => `<rect x="0" y="0" width="200" height="210" fill="${c}"/><rect x="200" y="210" width="200" height="210" fill="${c}"/>` },
  { id: 'sash', label: 'Fascia diagonale', draw: (c, s) => { const w = 34 * s; return `<polygon points="${100 - w},20 ${100 + w},20 ${320 + w},420 ${320 - w},420" fill="${c}"/>`; } },
  { id: 'chevron', label: 'Chevron (V)', draw: (c, s) => { const w = 26 * s; return `<polygon points="0,${60} 200,${200} 400,${60} 400,${60 + w * 2} 200,${200 + w * 2} 0,${60 + w * 2}" fill="${c}"/>`; } },
  { id: 'chestBand', label: 'Fascia sul petto', draw: (c, s) => `<rect x="0" y="${170 - 22 * s}" width="${W}" height="${44 * s}" fill="${c}"/>` },
  { id: 'doubleBand', label: 'Doppia fascia', draw: (c, s) => `<rect x="0" y="${150}" width="${W}" height="${12 * s}" fill="${c}"/><rect x="0" y="${174 + 6 * s}" width="${W}" height="${12 * s}" fill="${c}"/>` },
  { id: 'centerStripe', label: 'Striscia centrale', draw: (c, s) => `<rect x="${200 - 22 * s}" y="0" width="${44 * s}" height="${H}" fill="${c}"/>` },
  { id: 'twinStripes', label: 'Doppia striscia centrale', draw: (c, s) => `<rect x="${178 - 10 * s}" y="0" width="${12 * s}" height="${H}" fill="${c}"/><rect x="${222 - 2 * s}" y="0" width="${12 * s}" height="${H}" fill="${c}"/>` },
  { id: 'sidePanels', label: 'Pannelli laterali', draw: (c, s) => `<rect x="0" y="0" width="${100 + 32 * s}" height="${H}" fill="${c}"/><rect x="${300 - 32 * s}" y="0" width="${100 + 32 * s}" height="${H}" fill="${c}"/>` },
  { id: 'yoke', label: 'Spalle', draw: (c, s) => `<path d="M0,0 H400 V${70 * s} Q200,${120 * s} 0,${70 * s} Z" fill="${c}"/>` },
  { id: 'hem', label: 'Fondo maglia', draw: (c, s) => `<rect x="0" y="${400 - 70 * s}" width="${W}" height="${H}" fill="${c}"/>` },
  { id: 'checker', label: 'Scacchi', draw: (c, s) => { const q = 34 * s; let o = ''; range(0, H, q).forEach((y, i) => range(0, W, q).forEach((x, j) => { if ((i + j) % 2 === 0) o += `<rect x="${x}" y="${y}" width="${q}" height="${q}" fill="${c}"/>`; })); return o; } },
  { id: 'argyle', label: 'Rombi', draw: (c, s) => { const q = 40 * s; let o = ''; range(0, H + q, q).forEach((y, i) => range(i % 2 ? q / 2 : 0, W + q, q).forEach(x => { o += `<polygon points="${x},${y - q / 2} ${x + q / 4},${y} ${x},${y + q / 2} ${x - q / 4},${y}" fill="${c}"/>`; })); return o; } },
  { id: 'diagStripes', label: 'Strisce diagonali', draw: (c, s) => range(-H, W + H, 44 * s).map(x => `<polygon points="${x},0 ${x + 16 * s},0 ${x + 16 * s + H},${H} ${x + H},${H}" fill="${c}"/>`).join('') },
  { id: 'cross', label: 'Croce nordica', draw: (c, s) => `<rect x="${150 - 18 * s}" y="0" width="${36 * s}" height="${H}" fill="${c}"/><rect x="0" y="${190 - 18 * s}" width="${W}" height="${36 * s}" fill="${c}"/>` },
  { id: 'gradient', label: 'Sfumatura verticale', draw: (c, s, id) => `<defs><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity="0"/><stop offset="${clamp(0.9 / s, .2, 1)}" stop-color="${c}"/></linearGradient></defs><rect x="0" y="0" width="${W}" height="${H}" fill="url(#${id}g)"/>` },
  { id: 'gradientH', label: 'Sfumatura laterale', draw: (c, s, id) => `<defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c}"/><stop offset="${clamp(0.8 * s, .2, 1)}" stop-color="${c}" stop-opacity="0"/></linearGradient></defs><rect x="0" y="0" width="${W}" height="${H}" fill="url(#${id}g)"/>` },
  { id: 'waves', label: 'Onde', draw: (c, s) => `<path d="M60,420 C120,${330 - 40 * s} 150,${250} 210,${210} C270,${170} 330,${150} 380,${80} L400,80 L400,${150 + 30 * s} C340,${230} 280,${250} 240,${280} C190,${320} 170,${370} 160,420 Z" fill="${c}"/><path d="M0,${300} C60,${250} 90,${200} 130,${150} C160,${110} 170,${70} 180,20 L${190 + 14 * s},20 C${190 + 10 * s},80 170,130 150,180 C120,240 70,${300} 20,${360} L0,${370} Z" fill="${c}"/>` },
  { id: 'swoosh', label: 'Curva', draw: (c, s) => `<path d="M100,${330} C180,${300 - 30 * s} 260,${220} 320,${120} L320,${170 + 20 * s} C270,${260} 190,${330} 100,${370 + 10 * s} Z" fill="${c}"/>` },
  { id: 'lightning', label: 'Fulmine', draw: (c, s) => `<polygon points="${230 + 10 * s},20 ${140 - 10 * s},220 ${200},220 ${160 - 10 * s},420 ${270 + 10 * s},180 ${210},180 ${260 + 10 * s},20" fill="${c}"/>` },
  { id: 'zigzag', label: 'Zig-zag', draw: (c, s) => { const a = 20 * s, y = 170; let p = `M0,${y}`; range(0, W, a * 2).forEach(x => { p += ` L${x + a},${y - a} L${x + 2 * a},${y}`; }); let p2 = `L${W + a * 2},${y + 26 * s}`; for (let x = W + a * 2; x >= 0; x -= a * 2) p2 += ` L${x - a},${y + 26 * s - a} L${x - 2 * a},${y + 26 * s}`; return `<path d="${p} ${p2} Z" fill="${c}"/>`; } },
  { id: 'dots', label: 'Pois', draw: (c, s) => { const q = 26 * s; let o = ''; range(0, H, q).forEach((y, i) => range(i % 2 ? q / 2 : 0, W, q).forEach(x => { o += `<circle cx="${x}" cy="${y}" r="${5 * s}" fill="${c}"/>`; })); return o; } },
  { id: 'halftone', label: 'Retino', draw: (c, s) => { const q = 12 * s; let o = ''; range(0, H, q).forEach((y, i) => range(i % 2 ? q / 2 : 0, W, q).forEach(x => { const r = (y / H) * q * 0.55; if (r > .4) o += `<circle cx="${x}" cy="${y}" r="${r.toFixed(2)}" fill="${c}"/>`; })); return o; } },
  { id: 'rings', label: 'Cerchi concentrici', draw: (c, s) => range(20, 420, 36 * s).map(r => `<circle cx="200" cy="210" r="${r}" fill="none" stroke="${c}" stroke-width="${10 * s}"/>`).join('') },
  { id: 'bigCircle', label: 'Cerchio centrale', draw: (c, s) => `<circle cx="200" cy="200" r="${70 * s}" fill="${c}"/>` },
  { id: 'star', label: 'Stella', draw: (c, s) => { const pts = range(0, 9, 1).map(i => { const r = i % 2 ? 36 * s : 90 * s, a = -Math.PI / 2 + i * Math.PI / 5; return `${(200 + r * Math.cos(a)).toFixed(1)},${(205 + r * Math.sin(a)).toFixed(1)}`; }); return `<polygon points="${pts.join(' ')}" fill="${c}"/>`; } },
  { id: 'shards', label: 'Geometrico', draw: (c, s) => `<polygon points="100,60 ${200 + 30 * s},140 100,${220 + 30 * s}" fill="${c}"/><polygon points="300,120 ${190 - 20 * s},${250} 300,${380}" fill="${c}"/><polygon points="120,420 ${200},${300 - 20 * s} 280,420" fill="${c}" opacity=".7"/>` },
  { id: 'hexagons', label: 'Esagoni', draw: (c, s) => { const r = 18 * s, hw = r * Math.sqrt(3); let o = ''; range(0, H + r, r * 1.5).forEach((y, i) => range(i % 2 ? hw / 2 : 0, W + hw, hw).forEach(x => { const p = range(0, 5, 1).map(k => { const a = Math.PI / 6 + k * Math.PI / 3; return `${(x + (r - 2) * Math.cos(a)).toFixed(1)},${(y + (r - 2) * Math.sin(a)).toFixed(1)}`; }); o += `<polygon points="${p.join(' ')}" fill="none" stroke="${c}" stroke-width="${2 * s}"/>`; })); return o; } },
  { id: 'grid', label: 'Quadri (tartan)', draw: (c, s) => range(0, W, 40 * s).map(x => `<rect x="${x}" y="0" width="${8 * s}" height="${H}" fill="${c}" opacity=".7"/>`).join('') + range(0, H, 40 * s).map(y => `<rect x="0" y="${y}" width="${W}" height="${8 * s}" fill="${c}" opacity=".7"/>`).join('') },
  { id: 'camo', label: 'Mimetico', draw: (c, s) => { let seed = 7, o = ''; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280; for (let i = 0; i < 46; i++) { const x = rnd() * W, y = rnd() * H, rx = (14 + rnd() * 26) * s, ry = (8 + rnd() * 16) * s; o += `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${rx.toFixed(0)}" ry="${ry.toFixed(0)}" transform="rotate(${(rnd() * 180).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})" fill="${c}"/>`; } return o; } },
  { id: 'brush', label: 'Pennellate', draw: (c, s) => range(0, 5, 1).map(i => `<path d="M${40 + i * 10},${120 + i * 50} Q200,${80 + i * 55 - 30 * s} ${380 - i * 8},${140 + i * 48} L${380 - i * 8},${150 + i * 48 + 8 * s} Q200,${95 + i * 55 - 20 * s} ${40 + i * 10},${132 + i * 50 + 4 * s} Z" fill="${c}" opacity="${(1 - i * 0.12).toFixed(2)}"/>`).join('') },
  { id: 'flames', label: 'Fiamme', draw: (c, s) => { let p = `M0,420 L0,${330}`; range(0, W, 40).forEach((x, i) => { const h = (i % 2 ? 90 : 140) * s; p += ` Q${x + 10},${330 - h * .4} ${x + 20},${330 - h} Q${x + 26},${330 - h * .4} ${x + 40},${330}`; }); return `<path d="${p} L400,420 Z" fill="${c}"/>`; } }
];

/* ---------------------------------------------------------- marchi tecnici */
// Marchi stilizzati disegnati in un riquadro 60×40 centrato in (30,20)
export const BRANDS = [
  { id: 'none', label: 'Nessuno', draw: () => '' },
  { id: 'nike', label: 'Nike', draw: (c) => `<path d="M2,27 C1,33 6,35 14,32 L58,13 L17,25 C9,27 6,25 9,19 C3,22 2,25 2,27 Z" fill="${c}"/>` },
  { id: 'adidas', label: 'Adidas', draw: (c) => `<g fill="${c}"><polygon points="6,34 12,24 20,29 16,34"/><polygon points="18,34 27,17 35,22 29,34"/><polygon points="31,34 42,10 50,15 43,34"/></g>` },
  { id: 'adidas-trefoil', label: 'Adidas Originals', draw: (c, base) => `<g fill="${c}"><ellipse cx="30" cy="13" rx="6" ry="11"/><ellipse cx="18" cy="21" rx="6" ry="11" transform="rotate(-55 18 21)"/><ellipse cx="42" cy="21" rx="6" ry="11" transform="rotate(55 42 21)"/><rect x="10" y="26" width="40" height="2.5" fill="${base}"/><rect x="10" y="30" width="40" height="2.5" fill="${base}"/></g>` },
  { id: 'puma', label: 'Puma', draw: (c) => `<text x="30" y="30" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-style="italic" font-size="17" fill="${c}">PUMA</text>` },
  { id: 'umbro', label: 'Umbro', draw: (c) => `<g fill="none" stroke="${c}" stroke-width="3.5"><polygon points="30,4 54,20 30,36 6,20"/><polygon points="30,12 42,20 30,28 18,20"/></g>` },
  { id: 'kappa', label: 'Kappa', draw: (c) => `<text x="30" y="28" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="17" fill="${c}">Kappa</text>` },
  { id: 'macron', label: 'Macron', draw: (c) => `<text x="30" y="27" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="14" fill="${c}">macron</text>` },
  { id: 'joma', label: 'Joma', draw: (c) => `<text x="30" y="31" text-anchor="middle" font-family="Georgia, serif" font-weight="900" font-style="italic" font-size="30" fill="${c}">J</text>` },
  { id: 'errea', label: 'Erreà', draw: (c) => `<text x="30" y="28" text-anchor="middle" font-family="Arial, sans-serif" font-weight="800" font-size="17" fill="${c}">erreà</text>` },
  { id: 'lotto', label: 'Lotto', draw: (c) => `<g fill="none" stroke="${c}" stroke-width="3.5"><polygon points="22,6 36,20 22,34 8,20"/><polygon points="38,6 52,20 38,34 24,20"/></g>` },
  { id: 'diadora', label: 'Diadora', draw: (c) => `<text x="30" y="28" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-style="italic" font-size="15" fill="${c}">diadora</text>` },
  { id: 'hummel', label: 'Hummel', draw: (c) => `<g fill="${c}"><polygon points="6,14 30,26 54,14 54,20 30,32 6,20"/><polygon points="6,4 30,16 54,4 54,10 30,22 6,10" opacity=".85"/></g>` },
  { id: 'newbalance', label: 'New Balance', draw: (c) => `<text x="30" y="31" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-style="italic" font-size="24" fill="${c}">NB</text>` },
  { id: 'underarmour', label: 'Under Armour', draw: (c) => `<g fill="none" stroke="${c}" stroke-width="4.5" stroke-linecap="round"><path d="M14,8 C24,16 36,16 46,8"/><path d="M14,32 C24,24 36,24 46,32"/><path d="M17,10 C23,18 23,22 17,30"/><path d="M43,10 C37,18 37,22 43,30"/></g>` },
  { id: 'kelme', label: 'Kelme', draw: (c) => `<g fill="${c}"><path d="M10,30 C20,8 40,8 50,22 C40,16 28,16 22,30 Z"/><circle cx="46" cy="12" r="3.5"/></g>` },
  { id: 'legea', label: 'Legea', draw: (c) => `<text x="30" y="28" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="15" fill="${c}">LEGEA</text>` },
  { id: 'custom', label: 'Personalizzato', draw: () => '' }
];

export const SPONSOR_FONTS = [
  { id: 'bebas',  label: 'Moderno',  css: "'Bebas Neue', Impact, sans-serif", weight: 400, style: 'normal' },
  { id: 'black',  label: 'Pesante',  css: "'Arial Black', Arial, sans-serif", weight: 900, style: 'normal' },
  { id: 'italic', label: 'Sportivo', css: "'Arial Black', Arial, sans-serif", weight: 900, style: 'italic' },
  { id: 'serif',  label: 'Classico', css: "Georgia, 'Times New Roman', serif", weight: 700, style: 'normal' },
  { id: 'script', label: 'Corsivo',  css: "'Brush Script MT', 'Segoe Script', cursive", weight: 700, style: 'italic' }
];

export const PATCH_POSITIONS = [
  { id: 'chest',  label: 'Centro petto' },
  { id: 'belly',  label: 'Sotto lo sponsor' },
  { id: 'sleeveL', label: 'Manica sinistra' },
  { id: 'sleeveR', label: 'Manica destra' },
  { id: 'hem',    label: 'Fondo maglia' }
];

/* --------------------------------------------------------------- default */
export function defaultKit() {
  return {
    collar: 'crew', sleeves: 'short', cuffs: 'band', sleeveDeco: 'none',
    colors: { base: '#1e5bb8', sleeves: '#1e5bb8', collar: '#ffffff', cuffs: '#ffffff', trim: '#ffffff' },
    layers: [],
    brand: { id: 'nike', color: '#ffffff', url: '' },
    crest: { show: true, size: 100 },
    sponsor: { mode: 'none', url: '', text: '', font: 'bebas', color: '#ffffff', mono: false, scale: 100, y: 0 },
    patches: []
  };
}

/** Completa una divisa letta dal DB con i valori mancanti. */
export function normalizeKit(raw) {
  const d = defaultKit();
  const k = raw && typeof raw === 'object' ? raw : {};
  const toArr = (v) => Array.isArray(v) ? v.filter(Boolean) : (v && typeof v === 'object' ? Object.values(v).filter(Boolean) : []);
  return {
    ...d, ...k,
    colors: { ...d.colors, ...(k.colors || {}) },
    brand: { ...d.brand, ...(k.brand || {}) },
    crest: { ...d.crest, ...(k.crest || {}) },
    sponsor: { ...d.sponsor, ...(k.sponsor || {}) },
    layers: toArr(k.layers).map(l => ({ type: 'stripes', color: '#ffffff', opacity: 100, scale: 100, flipX: false, flipY: false, onSleeves: false, ...l })),
    patches: toArr(k.patches)
  };
}

/* ---------------------------------------------------------------- colletti */
function collarSvg(type, col, inside, base) {
  const back = (d) => `<path d="${d}" fill="${inside}"/>`;
  const band = (d) => `<path d="${d}" fill="${col}" stroke="rgba(0,0,0,.18)" stroke-width="1"/>`;
  const btn = (x, y) => `<circle cx="${x}" cy="${y}" r="2.6" fill="${shade(col, -0.25)}"/>`;
  switch (type) {
    case 'v':
      return back('M168,24 L200,66 L232,24 Q200,14 168,24 Z') + band('M156,24 L200,80 L244,24 L232,22 L200,64 L168,22 Z');
    case 'deepv':
      return back('M170,24 L200,92 L230,24 Q200,14 170,24 Z') + band('M157,24 L200,106 L243,24 L231,22 L200,90 L169,22 Z');
    case 'wrap':
      return back('M168,24 L200,70 L232,24 Q200,14 168,24 Z')
        + band('M244,24 L232,22 L198,72 L188,86 Z')
        + band('M156,24 L168,22 L212,82 L200,92 Z');
    case 'polo':
    case 'polobtn': {
      const placket = type === 'polobtn'
        ? `<rect x="191" y="34" width="18" height="${62}" rx="2" fill="${shade(base, -0.06)}" stroke="rgba(0,0,0,.15)"/>${btn(200, 50)}${btn(200, 68)}${btn(200, 86)}`
        : `<path d="M196,36 L200,74 L204,36 Z" fill="${inside}"/>`;
      return back('M166,24 Q200,14 234,24 Q200,40 166,24 Z') + placket
        + band('M162,20 Q200,10 238,20 L236,26 Q200,18 164,26 Z')
        + band('M164,22 L134,44 L176,64 L199,38 Z')
        + band('M236,22 L266,44 L224,64 L201,38 Z');
    }
    case 'mandarin':
      return back('M170,18 Q200,10 230,18 Q200,34 170,18 Z')
        + `<path d="M162,14 Q200,4 238,14 L240,28 Q200,46 160,28 Z M170,18 Q200,34 230,18 Q200,10 170,18 Z" fill="${col}" fill-rule="evenodd" stroke="rgba(0,0,0,.18)" stroke-width="1"/>`
        + `<path d="M196,30 L200,48 L204,30 Z" fill="${inside}"/>`;
    case 'henley':
      return back('M168,22 Q200,48 232,22 Q200,14 168,22 Z')
        + band('M158,24 Q200,62 242,24 L232,22 Q200,48 168,22 Z')
        + `<rect x="193" y="40" width="14" height="48" rx="2" fill="${col}" stroke="rgba(0,0,0,.15)"/>${btn(200, 56)}${btn(200, 74)}`;
    case 'laces':
      return back('M168,24 L200,70 L232,24 Q200,14 168,24 Z')
        + band('M156,24 L200,82 L244,24 L232,22 L200,66 L168,22 Z')
        + `<g stroke="${col}" stroke-width="2.4" stroke-linecap="round"><path d="M184,40 L216,52"/><path d="M216,40 L184,52"/><path d="M190,54 L210,62"/><path d="M210,54 L190,62"/></g>`;
    case 'doublecrew':
      return back('M168,22 Q200,48 232,22 Q200,14 168,22 Z')
        + band('M156,24 Q200,66 244,24 L232,22 Q200,48 168,22 Z')
        + `<path d="M161,26 Q200,58 239,26" fill="none" stroke="${base}" stroke-width="3"/>`;
    case 'crew':
    default:
      return back('M168,22 Q200,48 232,22 Q200,14 168,22 Z') + band('M158,24 Q200,62 242,24 L232,22 Q200,48 168,22 Z');
  }
}

/* -------------------------------------------------- decorazioni maniche */
function sleeveDecoSvg(type, long, c) {
  switch (type) {
    case 'stripes3':
    case 'stripes2': {
      const n = type === 'stripes3' ? 3 : 2;
      return range(0, n - 1, 1).map(i => {
        const o = 10 + i * 9;
        const d = long
          ? `M${118 - o * .2},${44 + o * .9} C${92 - o * .1},${56 + o} ${66 + o * .5},${84 + o * .5} ${56 + o * .4},${132 + o * .2} C${46 + o * .4},${200} ${38 + o * .4},${280} ${32 + o * .4},${334}`
          : `M${118 - o * .2},${44 + o * .9} C${92 - o * .1},${56 + o} ${64 + o * .6},${82 + o * .6} ${36 + o * .9},${126 + o * .2}`;
        return `<path d="${d}" fill="none" stroke="${c}" stroke-width="4.2"/>`;
      }).join('');
    }
    case 'shoulder':
      return `<path d="M120,30 C90,40 50,70 10,130 L46,140 C70,100 96,80 124,66 Z" fill="${c}"/>`;
    case 'band':
      return long
        ? `<polygon points="20,240 100,246 100,268 20,262" fill="${c}"/>`
        : `<polygon points="44,104 94,150 102,140 54,94" fill="${c}"/>`;
    case 'chevrons':
      return range(0, 2, 1).map(i => {
        const y = (long ? 150 : 82) + i * (long ? 22 : 12);
        const x = long ? 66 - i * 2 : 80 - i * 9;
        return `<path d="M${x - 40},${y - 10} L${x},${y + 8} L${x + 40},${y - 10}" fill="none" stroke="${c}" stroke-width="5" transform="rotate(${long ? 6 : 42} ${x} ${y})"/>`;
      }).join('');
    case 'side':
      return `<path d="M104,146 L100,388 L114,390 L118,146 Z" fill="${c}"/><path d="M104,146 C84,160 76,166 72,170 L66,160 C80,150 92,146 104,140 Z" fill="${c}"/>`;
    default:
      return '';
  }
}

/* ------------------------------------------------------------- immagini */
function imageTag(href, cx, cy, w, h, extra = '') {
  return `<image href="${escAttr(href)}" x="${(cx - w / 2).toFixed(1)}" y="${(cy - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" preserveAspectRatio="xMidYMid meet" ${extra}/>`;
}

function patchAt(pos, sleevesLong) {
  switch (pos) {
    case 'chest': return { x: 200, y: 116, s: 30, r: 0 };
    case 'belly': return { x: 200, y: 292, s: 34, r: 0 };
    case 'sleeveL': return sleevesLong ? { x: 72, y: 118, s: 30, r: 18 } : { x: 76, y: 104, s: 30, r: 40 };
    case 'sleeveR': return sleevesLong ? { x: 328, y: 118, s: 30, r: -18 } : { x: 324, y: 104, s: 30, r: -40 };
    case 'hem': return { x: 132, y: 356, s: 26, r: 0 };
    default: return { x: 200, y: 116, s: 30, r: 0 };
  }
}

/**
 * Restituisce l'SVG completo della maglia.
 * opts: { crestUrl, width, height, className, simple } (simple = senza ombre, per le miniature)
 */
export function renderKitSvg(rawKit, opts = {}) {
  const k = normalizeKit(rawKit);
  const id = `kit${++UID}`;
  const col = {
    base: safeColor(k.colors.base, '#1e5bb8'),
    sleeves: safeColor(k.colors.sleeves, '#1e5bb8'),
    collar: safeColor(k.colors.collar, '#ffffff'),
    cuffs: safeColor(k.colors.cuffs, '#ffffff'),
    trim: safeColor(k.colors.trim, '#ffffff')
  };
  const long = k.sleeves === 'long' || k.sleeves === 'raglan-long';
  const raglan = k.sleeves === 'raglan' || k.sleeves === 'raglan-long';
  const sl = long ? SLEEVE.long : SLEEVE.short;
  const both = (d, attrs) => `<path d="${d}" ${attrs}/><path d="${d}" ${attrs} ${MIRROR}/>`;

  // livelli del disegno
  const layerSvg = (onSleevesOnly) => k.layers.map((l, i) => {
    if (onSleevesOnly && !l.onSleeves) return '';
    const p = PATTERNS.find(x => x.id === l.type);
    if (!p) return '';
    const s = clamp(l.scale, 30, 250) / 100;
    const sx = l.flipX ? -1 : 1, sy = l.flipY ? -1 : 1;
    const tf = (sx < 0 || sy < 0) ? `transform="translate(${sx < 0 ? W : 0},${sy < 0 ? H : 0}) scale(${sx},${sy})"` : '';
    return `<g opacity="${clamp(l.opacity, 0, 100) / 100}" ${tf}>${p.draw(safeColor(l.color), s, `${id}l${i}${onSleevesOnly ? 's' : ''}`)}</g>`;
  }).join('');

  const outline = 'stroke="rgba(0,0,0,.35)" stroke-width="1.5" stroke-linejoin="round"';

  // marchio tecnico (alto a destra, guardando la maglia)
  let brandSvg = '';
  const brand = BRANDS.find(b => b.id === k.brand.id);
  if (k.brand.id === 'custom' && k.brand.url) {
    brandSvg = imageTag(k.brand.url, 254, 104, 40, 30);
  } else if (brand && brand.id !== 'none') {
    brandSvg = `<g transform="translate(236,92) scale(.62)">${brand.draw(safeColor(k.brand.color), col.base)}</g>`;
  }

  // stemma della squadra (alto a sinistra, guardando la maglia)
  let crestSvg = '';
  if (k.crest.show && opts.crestUrl) {
    const cs = 40 * clamp(k.crest.size, 60, 150) / 100;
    crestSvg = imageTag(opts.crestUrl, 146, 106, cs, cs);
  }

  // sponsor
  let sponsorSvg = '';
  const sp = k.sponsor;
  const spScale = clamp(sp.scale, 40, 160) / 100;
  const spY = 196 + clamp(sp.y, -60, 80);
  const monoFilter = `<filter id="${id}mono" color-interpolation-filters="sRGB"><feFlood flood-color="${safeColor(sp.color)}"/><feComposite in2="SourceAlpha" operator="in"/></filter>`;
  if (sp.mode === 'image' && sp.url) {
    sponsorSvg = imageTag(sp.url, 200, spY, 150 * spScale, 70 * spScale, sp.mono ? `filter="url(#${id}mono)"` : '');
  } else if (sp.mode === 'text' && String(sp.text || '').trim()) {
    const f = SPONSOR_FONTS.find(x => x.id === sp.font) || SPONSOR_FONTS[0];
    const txt = String(sp.text).trim().slice(0, 24);
    const fs = Math.min(46, 260 / Math.max(4, txt.length)) * spScale * (f.id === 'bebas' ? 1.35 : 1);
    sponsorSvg = `<text x="200" y="${spY}" text-anchor="middle" dominant-baseline="central" font-family="${escAttr(f.css)}" font-weight="${f.weight}" font-style="${f.style}" font-size="${fs.toFixed(1)}" fill="${safeColor(sp.color)}">${escAttr(txt)}</text>`;
  }

  // patch delle competizioni
  const patchSvg = k.patches.map(p => {
    if (!p || !p.src) return '';
    const a = patchAt(p.pos, long);
    const bg = p.bg !== false
      ? `<rect x="${a.x - a.s / 2 - 3}" y="${a.y - a.s / 2 - 3}" width="${a.s + 6}" height="${a.s + 6}" rx="5" fill="#ffffff" stroke="rgba(0,0,0,.2)"/>`
      : '';
    return `<g transform="rotate(${a.r} ${a.x} ${a.y})">${bg}${imageTag(p.src, a.x, a.y, a.s, a.s)}</g>`;
  }).join('');

  // ombre e luci per dare volume
  const shading = opts.simple ? '' : `
    <defs>
      <linearGradient id="${id}shT" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset=".22" stop-color="#000" stop-opacity="0"/>
        <stop offset=".45" stop-color="#fff" stop-opacity=".10"/><stop offset=".78" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity=".30"/>
      </linearGradient>
      <linearGradient id="${id}shV" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".08"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/>
      </linearGradient>
    </defs>
    <g clip-path="url(#${id}body)">
      <rect width="${W}" height="${H}" fill="url(#${id}shT)"/><rect width="${W}" height="${H}" fill="url(#${id}shV)"/>
    </g>
    <g clip-path="url(#${id}slv)" opacity=".9">
      <path d="${sl}" fill="#000" fill-opacity=".14"/><path d="${sl}" fill="#000" fill-opacity=".14" ${MIRROR}/>
    </g>`;

  const cuffSvg = (() => {
    if (k.cuffs === 'none') return '';
    const set = long ? CUFF.long : CUFF.short;
    if (k.cuffs === 'thin') return both(set.thin, `fill="${col.cuffs}"`);
    if (k.cuffs === 'double') {
      return both(set.band, `fill="${col.cuffs}"`) + both(set.thin, `fill="${col.sleeves}"`);
    }
    return both(set.band, `fill="${col.cuffs}"`);
  })();

  const deco = sleeveDecoSvg(k.sleeveDeco, long, col.trim);
  const decoBoth = deco ? `<g>${deco}</g><g ${MIRROR}>${deco}</g>` : '';
  const inside = shade(col.base, -0.45);

  const attrs = [
    `viewBox="0 0 ${W} ${H}"`,
    opts.width ? `width="${opts.width}"` : '',
    opts.height ? `height="${opts.height}"` : '',
    opts.className ? `class="${escAttr(opts.className)}"` : '',
    'xmlns="http://www.w3.org/2000/svg"',
    'role="img" aria-label="Divisa"'
  ].join(' ');

  return `<svg ${attrs}>
  <defs>
    <clipPath id="${id}body"><path d="${TORSO}"/></clipPath>
    <clipPath id="${id}slv"><path d="${sl}"/><path d="${sl}" ${MIRROR}/></clipPath>
    ${monoFilter}
  </defs>
  <!-- maniche -->
  ${both(sl, `fill="${col.sleeves}" ${outline}`)}
  <g clip-path="url(#${id}slv)">${layerSvg(true)}${decoBoth}${cuffSvg}</g>
  <!-- busto -->
  <path d="${TORSO}" fill="${col.base}"/>
  <g clip-path="url(#${id}body)">
    ${layerSvg(false)}
    ${raglan ? `<path d="${RAGLAN}" fill="${col.sleeves}"/><path d="${RAGLAN}" fill="${col.sleeves}" ${MIRROR}/>` : ''}
    ${k.sleeveDeco === 'side' ? decoBoth : ''}
  </g>
  ${shading}
  <path d="${TORSO}" fill="none" ${outline}/>
  ${collarSvg(k.collar, col.collar, inside, col.base)}
  ${brandSvg}${crestSvg}${sponsorSvg}${patchSvg}
</svg>`;
}

/* ------------------------------------------------------------- modelli */
// Punti di partenza rapidi (FASE 1): sovrascrivono taglio e disegno, non sponsor/patch/stemma
export const PRESETS = [
  { name: 'Tinta unita',      kit: { collar: 'crew', sleeves: 'short', cuffs: 'band', layers: [] } },
  { name: 'Strisce',          kit: { collar: 'v', sleeves: 'short', cuffs: 'band', layers: [{ type: 'stripes', color: '#000000' }] } },
  { name: 'Strisce larghe',   kit: { collar: 'polo', sleeves: 'short', cuffs: 'thin', layers: [{ type: 'wideStripes', color: '#ffffff' }] } },
  { name: 'Gessato',          kit: { collar: 'polobtn', sleeves: 'short', cuffs: 'none', layers: [{ type: 'pinstripes', color: '#ffffff', opacity: 70 }] } },
  { name: 'Bande',            kit: { collar: 'crew', sleeves: 'short', cuffs: 'band', layers: [{ type: 'hoops', color: '#ffffff' }] } },
  { name: 'Metà e metà',      kit: { collar: 'v', sleeves: 'raglan', cuffs: 'band', layers: [{ type: 'half', color: '#ffffff' }] } },
  { name: 'Quarti',           kit: { collar: 'crew', sleeves: 'short', cuffs: 'thin', layers: [{ type: 'quarters', color: '#ffffff' }] } },
  { name: 'Fascia diagonale', kit: { collar: 'crew', sleeves: 'short', cuffs: 'band', layers: [{ type: 'sash', color: '#ffffff' }] } },
  { name: 'Chevron',          kit: { collar: 'v', sleeves: 'short', cuffs: 'band', layers: [{ type: 'chevron', color: '#ffffff' }] } },
  { name: 'Fascia petto',     kit: { collar: 'mandarin', sleeves: 'short', cuffs: 'band', layers: [{ type: 'chestBand', color: '#ffffff' }] } },
  { name: 'Croce',            kit: { collar: 'crew', sleeves: 'long', cuffs: 'band', layers: [{ type: 'cross', color: '#ffffff' }] } },
  { name: 'Scacchi',          kit: { collar: 'crew', sleeves: 'short', cuffs: 'band', layers: [{ type: 'checker', color: '#ffffff' }] } },
  { name: 'Onde',             kit: { collar: 'v', sleeves: 'short', cuffs: 'band', layers: [{ type: 'waves', color: '#7a1f1f' }, { type: 'swoosh', color: '#ffffff', opacity: 90 }] } },
  { name: 'Fulmine',          kit: { collar: 'deepv', sleeves: 'short', cuffs: 'thin', layers: [{ type: 'lightning', color: '#ffd400' }] } },
  { name: 'Sfumato',          kit: { collar: 'crew', sleeves: 'short', cuffs: 'band', layers: [{ type: 'gradient', color: '#000000', opacity: 80, onSleeves: true }] } },
  { name: 'Retino',           kit: { collar: 'v', sleeves: 'short', cuffs: 'band', layers: [{ type: 'halftone', color: '#ffffff', opacity: 60 }] } },
  { name: 'Geometrico',       kit: { collar: 'wrap', sleeves: 'short', cuffs: 'band', layers: [{ type: 'shards', color: '#ffffff', opacity: 35 }, { type: 'centerStripe', color: '#000000', opacity: 40, scale: 40 }] } },
  { name: 'Mimetico',         kit: { collar: 'crew', sleeves: 'short', cuffs: 'band', layers: [{ type: 'camo', color: '#000000', opacity: 25, onSleeves: true }] } },
  { name: 'Esagoni',          kit: { collar: 'v', sleeves: 'short', cuffs: 'band', layers: [{ type: 'hexagons', color: '#ffffff', opacity: 35, onSleeves: true }] } },
  { name: 'Retrò',            kit: { collar: 'laces', sleeves: 'long', cuffs: 'double', layers: [] } },
  { name: 'Pannelli',         kit: { collar: 'crew', sleeves: 'short', cuffs: 'band', layers: [{ type: 'sidePanels', color: '#000000', opacity: 70 }] } },
  { name: 'Tre strisce',      kit: { collar: 'v', sleeves: 'short', cuffs: 'none', sleeveDeco: 'stripes3', layers: [] } },
  { name: 'Fiamme',           kit: { collar: 'crew', sleeves: 'short', cuffs: 'band', layers: [{ type: 'flames', color: '#ff7a00' }] } },
  { name: 'Spalle',           kit: { collar: 'henley', sleeves: 'raglan', cuffs: 'band', layers: [{ type: 'yoke', color: '#ffffff' }] } }
];
