import { getTemplate, getPngPatterns, getPngBrands, loadImage } from '../services/kitAssets.js';
import { getCutout } from '../services/imageCutout.js';

/**
 * Divisa della squadra composta su <canvas> sovrapponendo PNG (vedi services/kitAssets.js per i modelli).
 * La divisa è salvata in teams/{id}/kit:
 * {
 *   template,                                   // id del modello (colletto + maniche + ombre)
 *   colors: { base, sleeves, collar, cuffs },   // base = busto
 *   layers: [{ type, color, opacity, scale, flipX, flipY, zone }],  // type: disegno integrato o 'png:<id>'; zone: body | all | sleeves
 *   brand: { id, color, url, mono },            // id: marchio integrato, 'png:<id>' (caricato dal Patron) o 'custom'
 *   crest: { show, size },
 *   sponsor: { mode: 'none'|'image'|'text', url, text, font, color, mono, scale, y },
 *   patches: [{ id, src, name, pos }]
 * }
 * I disegni integrati sono SVG nel riquadro 0 0 400 420 rasterizzati alla dimensione del modello.
 */
const W = 400;
const H = 420;

const safeColor = (c, def = '#ffffff') => (/^#[0-9a-f]{3,8}$/i.test(String(c || '')) ? c : def);
const clamp = (v, a, b) => Math.min(b, Math.max(a, Number.isFinite(+v) ? +v : a));

/* --------------------------------------------------------------- disegni */
const range = (from, to, step) => { const out = []; for (let v = from; v <= to; v += step) out.push(v); return out; };

/** Rete di crepe (tipo marmo screpolato): celle irregolari con bordi frastagliati, deterministica. */
function crackle(c, s) {
  let seed = 23;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const g = 46 * s;
  const cols = Math.ceil(W / g) + 2, rows = Math.ceil(H / g) + 2;
  const pt = [];
  for (let i = 0; i < cols; i++) {
    pt.push([]);
    for (let j = 0; j < rows; j++) pt[i].push([(i - .5) * g + (rnd() - .5) * g * .8, (j - .5) * g + (rnd() - .5) * g * .8]);
  }
  const edge = (a, b) => {
    let d = `M${a[0].toFixed(1)},${a[1].toFixed(1)}`;
    const nx = -(b[1] - a[1]), ny = b[0] - a[0], len = Math.hypot(nx, ny) || 1;
    for (let k = 1; k < 4; k++) {
      const t = k / 4, off = (rnd() - .5) * 9 * s;
      d += ` L${(a[0] + (b[0] - a[0]) * t + nx / len * off).toFixed(1)},${(a[1] + (b[1] - a[1]) * t + ny / len * off).toFixed(1)}`;
    }
    return `<path d="${d} L${b[0].toFixed(1)},${b[1].toFixed(1)}" stroke-width="${((.9 + rnd() * 2.4) * s).toFixed(2)}"/>`;
  };
  let o = '';
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    if (i + 1 < cols && rnd() < .9) o += edge(pt[i][j], pt[i + 1][j]);
    if (j + 1 < rows && rnd() < .9) o += edge(pt[i][j], pt[i][j + 1]);
    if (i + 1 < cols && j + 1 < rows && rnd() < .25) o += edge(pt[i][j], pt[i + 1][j + 1]);
  }
  return `<g fill="none" stroke="${c}" stroke-linejoin="round" stroke-linecap="round">${o}</g>`;
}

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
  { id: 'flames', label: 'Fiamme', draw: (c, s) => { let p = `M0,420 L0,${330}`; range(0, W, 40).forEach((x, i) => { const h = (i % 2 ? 90 : 140) * s; p += ` Q${x + 10},${330 - h * .4} ${x + 20},${330 - h} Q${x + 26},${330 - h * .4} ${x + 40},${330}`; }); return `<path d="${p} L400,420 Z" fill="${c}"/>`; } },
  { id: 'crackle', label: 'Crepe', draw: (c, s) => crackle(c, s) },
  { id: 'marble', label: 'Marmo', draw: (c, s, id) => { let seed = 11; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280; let o = ''; for (let i = 0; i < 9; i++) { const y = -40 + i * 55 * s + rnd() * 20; o += `<path d="M-20,${y.toFixed(0)} C${(80 + rnd() * 60).toFixed(0)},${(y - 60 + rnd() * 120).toFixed(0)} ${(220 + rnd() * 60).toFixed(0)},${(y + 80 - rnd() * 120).toFixed(0)} 420,${(y + 40 + rnd() * 60).toFixed(0)}" fill="none" stroke="${c}" stroke-width="${((1 + rnd() * 5) * s).toFixed(1)}" stroke-opacity="${(.45 + rnd() * .5).toFixed(2)}"/>`; } return `<defs><filter id="${id}b" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.2"/></filter></defs><g filter="url(#${id}b)">${o}</g>`; } },
  { id: 'contour', label: 'Curve di livello', draw: (c, s) => range(0, H + 40, 16 * s).map((y, i) => { let d = `M-10,${y}`; for (let x = -10; x <= W + 20; x += 20) d += ` L${x},${(y + Math.sin(x / 45 + i * .7) * 10 * s + Math.sin(x / 17 + i) * 3).toFixed(1)}`; return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${(1.6 * s).toFixed(1)}"/>`; }).join('') },
];

/* ---------------------------------------------------------- marchi tecnici */
// Marchi stilizzati disegnati in un riquadro 60×40
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


/* ---------------------------------------------------------------- dati */
export const ZONES = [
  { id: 'body',    label: 'Solo busto' },
  { id: 'all',     label: 'Busto e maniche' },
  { id: 'sleeves', label: 'Solo maniche' }
];

export function defaultKit() {
  return {
    template: '',
    colors: { base: '#1e5bb8', sleeves: '#1e5bb8', collar: '#ffffff', cuffs: '#ffffff' },
    layers: [],
    brand: { id: 'nike', color: '#ffffff', url: '', mono: false },
    crest: { show: true, size: 100 },
    sponsor: { mode: 'none', url: '', text: '', font: 'bebas', color: '#ffffff', mono: false, scale: 100, y: 0 },
    patches: []
  };
}

/** Completa una divisa letta dal DB (anche nel vecchio formato SVG) con i valori mancanti. */
export function normalizeKit(raw) {
  const d = defaultKit();
  const k = raw && typeof raw === 'object' ? raw : {};
  const toArr = (v) => Array.isArray(v) ? v.filter(Boolean) : (v && typeof v === 'object' ? Object.values(v).filter(Boolean) : []);
  return {
    template: k.template || '',
    colors: { ...d.colors, ...(k.colors || {}) },
    brand: { ...d.brand, ...(k.brand || {}) },
    crest: { ...d.crest, ...(k.crest || {}) },
    sponsor: { ...d.sponsor, ...(k.sponsor || {}) },
    layers: toArr(k.layers).map(l => ({
      type: 'stripes', color: '#ffffff', opacity: 100, scale: 100, flipX: false, flipY: false,
      ...l, zone: l.zone || (l.onSleeves ? 'all' : 'body')
    })),
    patches: toArr(k.patches).map(p => ({ id: p.id, name: p.name || '', src: p.src || '', pos: p.pos || 'chest' }))
  };
}

/** Etichetta di un disegno (integrato o PNG del Patron). */
export function patternLabel(type) {
  if (String(type).startsWith('png:')) return (getPngPatterns().find(p => 'png:' + p.id === type) || {}).name || 'Disegno';
  return (PATTERNS.find(p => p.id === type) || {}).label || type;
}

/* ------------------------------------------------------------ utilità */
const svgUrl = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

function canvasOf(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Disegno integrato rasterizzato (in bianco: viene colorato dopo). Cache per parametri. */
const rasterCache = new Map();
function builtinPattern(layer, w, h) {
  const p = PATTERNS.find(x => x.id === layer.type);
  if (!p) return Promise.resolve(null);
  const s = clamp(layer.scale, 30, 250) / 100;
  const key = [layer.type, s, !!layer.flipX, !!layer.flipY, w, h].join('|');
  if (rasterCache.has(key)) return rasterCache.get(key);
  const sx = layer.flipX ? -1 : 1, sy = layer.flipY ? -1 : 1;
  const tf = (sx < 0 || sy < 0) ? `transform="translate(${sx < 0 ? W : 0},${sy < 0 ? H : 0}) scale(${sx},${sy})"` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><g ${tf}>${p.draw('#ffffff', s, 'p' + rasterCache.size)}</g></svg>`;
  const job = loadImage(svgUrl(svg));
  if (rasterCache.size > 120) rasterCache.delete(rasterCache.keys().next().value);
  rasterCache.set(key, job);
  return job;
}

function brandSvgImage(brand, color, base) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 60 40">${brand.draw(safeColor(color), safeColor(base))}</svg>`;
  return loadImage(svgUrl(svg));
}

/** Colora un'immagine (pieno colore dove l'immagine non è trasparente). */
function tint(img, color, w, h) {
  const c = canvasOf(w, h);
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0, c.width, c.height);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Ritaglia un canvas sulla maschera (o su più maschere unite). */
function clipTo(c, masks) {
  const valid = masks.filter(Boolean);
  if (!valid.length) return c;
  const x = c.getContext('2d');
  let mask = valid[0];
  if (valid.length > 1) {
    mask = canvasOf(c.width, c.height);
    const m = mask.getContext('2d');
    valid.forEach(v => m.drawImage(v, 0, 0, mask.width, mask.height));
  }
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(mask, 0, 0, c.width, c.height);
  x.globalCompositeOperation = 'source-over';
  return c;
}

function drawContain(ctx, img, cx, cy, bw, bh, rot = 0) {
  if (!img) return;
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const r = Math.min(bw / iw, bh / ih);
  const w = iw * r, h = ih * r;
  ctx.save();
  ctx.translate(cx, cy);
  if (rot) ctx.rotate(rot * Math.PI / 180);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

async function loadCut(url) {
  if (!url) return null;
  return loadImage(await getCutout(url));
}

/* --------------------------------------------------------- composizione */
/**
 * Disegna la divisa sul canvas indicato.
 * opts: { crestUrl, width (px del canvas, default = larghezza del modello), plain (senza loghi),
 *         template (oggetto modello da usare al posto di kit.template, es. bozza nell'area Patron) }
 */
export async function drawKit(target, rawKit, opts = {}) {
  const k = normalizeKit(rawKit);
  const t = opts.template || getTemplate(k.template);
  const token = (target._kitToken = (target._kitToken || 0) + 1);
  const tw = t.w || 800, th = t.h || 840;
  const outW = Math.round(opts.width || tw);
  const sc = outW / tw;
  const w = outW, h = Math.round(th * sc);

  const L = t.layers || {};
  const [body, sleeves, collar, cuffs, shadow, highlight, overlay] = await Promise.all(
    ['body', 'sleeves', 'collar', 'cuffs', 'shadow', 'highlight', 'overlay'].map(key => loadImage(L[key]))
  );
  const pngPatterns = getPngPatterns();
  const patternImgs = await Promise.all(k.layers.map(l => {
    if (String(l.type).startsWith('png:')) {
      const p = pngPatterns.find(x => 'png:' + x.id === l.type);
      return loadImage(p && p.url);
    }
    return builtinPattern(l, w, h);
  }));

  let brandImg = null;
  if (!opts.plain) {
    const b = k.brand;
    if (b.id === 'custom') brandImg = await loadImage(b.url);
    else if (String(b.id).startsWith('png:')) {
      const pb = getPngBrands().find(x => 'png:' + x.id === b.id);
      brandImg = await loadImage(pb && pb.url);
    } else {
      const bb = BRANDS.find(x => x.id === b.id);
      if (bb && bb.id !== 'none' && bb.id !== 'custom') brandImg = await brandSvgImage(bb, b.color, k.colors.base);
    }
  }
  const crestImg = !opts.plain && k.crest.show ? await loadCut(opts.crestUrl) : null;
  const sponsorImg = !opts.plain && k.sponsor.mode === 'image' ? await loadImage(k.sponsor.url) : null;
  const patchImgs = opts.plain ? [] : await Promise.all(k.patches.map(p => loadCut(p.src)));

  if (target._kitToken !== token) return; // nel frattempo è stato richiesto un altro disegno

  const out = canvasOf(w, h);
  const ctx = out.getContext('2d');
  const zone = (mask, color) => { if (mask) ctx.drawImage(tint(mask, safeColor(color), w, h), 0, 0); };

  // 1. zone colorate e disegni
  zone(body, k.colors.base);
  zone(sleeves, k.colors.sleeves);
  k.layers.forEach((l, i) => {
    const img = patternImgs[i];
    if (!img) return;
    const masks = l.zone === 'sleeves' ? [sleeves] : l.zone === 'all' ? [body, sleeves] : [body];
    if (!masks.some(Boolean)) return;
    let painted;
    if (String(l.type).startsWith('png:')) {
      // PNG del Patron: dimensione e specchiatura applicate qui
      const c = canvasOf(w, h), x = c.getContext('2d');
      const s = clamp(l.scale, 30, 250) / 100;
      x.translate(w / 2, h / 2);
      x.scale((l.flipX ? -1 : 1) * s, (l.flipY ? -1 : 1) * s);
      x.drawImage(img, -w / 2, -h / 2, w, h);
      painted = tint(c, safeColor(l.color), w, h);
    } else {
      painted = tint(img, safeColor(l.color), w, h);
    }
    clipTo(painted, masks);
    ctx.globalAlpha = clamp(l.opacity, 0, 100) / 100;
    ctx.drawImage(painted, 0, 0);
    ctx.globalAlpha = 1;
  });
  zone(collar, k.colors.collar);
  zone(cuffs, k.colors.cuffs);

  // 2. loghi (sotto le ombre, così sembrano stampati sul tessuto)
  const A = t.anchors || {};
  const at = (a) => a && { x: a.x * sc, y: a.y * sc, s: (a.s || 60) * sc, r: a.r || 0 };
  if (crestImg && A.crest) {
    const a = at(A.crest), s = a.s * clamp(k.crest.size, 60, 150) / 100;
    drawContain(ctx, crestImg, a.x, a.y, s, s);
  }
  if (brandImg && A.brand) {
    const a = at(A.brand);
    const img = (k.brand.id === 'custom' || String(k.brand.id).startsWith('png:')) && k.brand.mono
      ? tint(brandImg, safeColor(k.brand.color), brandImg.naturalWidth || brandImg.width, brandImg.naturalHeight || brandImg.height)
      : brandImg;
    drawContain(ctx, img, a.x, a.y, a.s, a.s * 0.75);
  }
  if (!opts.plain && A.sponsor) {
    const sp = k.sponsor;
    const f = clamp(sp.scale, 40, 160) / 100;
    const bw = A.sponsor.w * sc * f, bh = A.sponsor.h * sc * f;
    const cx = A.sponsor.x * sc, cy = (A.sponsor.y + clamp(sp.y, -60, 80) * 2) * sc;
    if (sp.mode === 'image' && sponsorImg) {
      const img = sp.mono ? tint(sponsorImg, safeColor(sp.color), sponsorImg.naturalWidth, sponsorImg.naturalHeight) : sponsorImg;
      drawContain(ctx, img, cx, cy, bw, bh);
    } else if (sp.mode === 'text' && String(sp.text || '').trim()) {
      const ft = SPONSOR_FONTS.find(x => x.id === sp.font) || SPONSOR_FONTS[0];
      const txt = String(sp.text).trim().slice(0, 24);
      let px = bh * 0.62;
      ctx.font = `${ft.style} ${ft.weight} ${px}px ${ft.css}`;
      const mw = ctx.measureText(txt).width;
      if (mw > bw) { px *= bw / mw; ctx.font = `${ft.style} ${ft.weight} ${px}px ${ft.css}`; }
      ctx.fillStyle = safeColor(sp.color);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, cx, cy);
    }
  }
  k.patches.forEach((p, i) => {
    const a = at(A[p.pos]);
    if (a && patchImgs[i]) drawContain(ctx, patchImgs[i], a.x, a.y, a.s, a.s, a.r);
  });

  // 3. realismo: ombre (moltiplica), luci (schermo), dettagli fissi
  if (shadow) { ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(shadow, 0, 0, w, h); }
  if (highlight) { ctx.globalCompositeOperation = 'screen'; ctx.drawImage(highlight, 0, 0, w, h); }
  ctx.globalCompositeOperation = 'source-over';
  if (overlay) ctx.drawImage(overlay, 0, 0, w, h);

  // 4. sul canvas visibile
  if (target._kitToken !== token) return;
  if (target.width !== w || target.height !== h) { target.width = w; target.height = h; }
  const tctx = target.getContext('2d');
  tctx.clearRect(0, 0, w, h);
  tctx.drawImage(out, 0, 0);
}

/* ------------------------------------------------------------ inserimento */
let SLOT = 0;
const pendingSlots = new Map();

/**
 * HTML di un <canvas> con la divisa: viene disegnata appena il canvas è nella pagina.
 * opts come drawKit (width = risoluzione in px, di solito 2× la dimensione a schermo).
 */
export function kitCanvasHTML(kit, opts = {}, attrs = '') {
  const id = `kc${++SLOT}`;
  const t = opts.template || getTemplate(normalizeKit(kit).template);
  const w = Math.round(opts.width || 400);
  const h = Math.round(w * (t.h || 840) / (t.w || 800));
  pendingSlots.set(id, { kit, opts });
  if (pendingSlots.size === 1) requestAnimationFrame(flushSlots);
  return `<div ${attrs}><canvas data-kit-canvas="${id}" width="${w}" height="${h}" style="width:100%; height:auto; display:block;"></canvas></div>`;
}

function flushSlots() {
  pendingSlots.forEach((v, id) => {
    const el = document.querySelector(`canvas[data-kit-canvas="${id}"]`);
    if (el) drawKit(el, v.kit, v.opts).catch(e => console.error('Divisa:', e));
  });
  pendingSlots.clear();
}

/* ------------------------------------------------------------- stili rapidi */
// Solo il disegno: colori, modello, sponsor, stemma e patch restano invariati
export const PRESETS = [
  { name: 'Crepe',            kit: { collar: 'crew', sleeves: 'short', cuffs: 'band', layers: [{ type: 'crackle', color: '#0d1b4c', opacity: 85, onSleeves: true }] } },
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
  { name: 'Pannelli',         kit: { collar: 'crew', sleeves: 'short', cuffs: 'band', layers: [{ type: 'sidePanels', color: '#000000', opacity: 70 }] } },
  { name: 'Fiamme',           kit: { collar: 'crew', sleeves: 'short', cuffs: 'band', layers: [{ type: 'flames', color: '#ff7a00' }] } },
  { name: 'Spalle',           kit: { collar: 'henley', sleeves: 'raglan', cuffs: 'band', layers: [{ type: 'yoke', color: '#ffffff' }] } }
];
