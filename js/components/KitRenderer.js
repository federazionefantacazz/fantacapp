import { getPngPatterns, getPngBrands } from '../services/kitAssets.js';
import { getCutout } from '../services/imageCutout.js';
import { COLLAR_SHAPES } from './kitShapes.js';

export { COLLAR_SHAPES };

/**
 * Divisa della squadra: dati e pittura della texture UV della maglia 3D (vedi components/Kit3D.js).
 * La divisa è salvata in teams/{id}/kit:
 * {
 *   collarShape,                                            // forma del colletto: 'v' (scollo a V) o 'polo' (vedi kitShapes.js)
 *   collar, cuffs, sleeveDeco,                              // stile di colletto, polsini, decorazioni maniche
 *   colors: { base, sleeves, collar, cuffs, trim },
 *   layers: [{ type, color, opacity, scale, flipX, flipY, zone }],  // type: disegno integrato o 'png:<id>'; zone: body | all | sleeves
 *   brand: { id, color, url, mono },                        // id: marchio integrato, 'png:<id>' (dal Patron) o 'custom'
 *   crest: { show, size },
 *   sponsor: { mode: 'none'|'image'|'text', url, text, font, color, mono, scale, y },
 *   patches: [{ id, src, name, pos }],
 *   image                                                   // foto PNG della maglia (fronte) generata al salvataggio
 * }
 * I disegni integrati sono SVG pensati sulla vista frontale 0 0 400 420 e vengono adattati a ogni pezzo della maglia.
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

// Colletto: la striscia del colletto del modello 3D + eventuale bordo sul petto/schiena
export const COLLARS = [
  { id: 'plain',   label: 'Semplice' },
  { id: 'twotone', label: 'Bicolore' },
  { id: 'striped', label: 'Con righe' },
  { id: 'trim',    label: 'Con bordino' },
  { id: 'wide',    label: 'Bordo largo' }
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
  { id: 'side',     label: 'Bande laterali' }
];

export function defaultKit() {
  return {
    collarShape: 'v', collar: 'plain', cuffs: 'band', sleeveDeco: 'none',
    colors: { base: '#1e5bb8', sleeves: '#1e5bb8', collar: '#ffffff', cuffs: '#ffffff', trim: '#ffffff' },
    layers: [],
    brand: { id: 'nike', color: '#ffffff', url: '', mono: false },
    crest: { show: true, size: 100 },
    sponsor: { mode: 'none', url: '', text: '', font: 'bebas', color: '#ffffff', mono: false, scale: 100, y: 0 },
    patches: []
  };
}

/** Completa una divisa letta dal DB (anche dei formati precedenti) con i valori mancanti. */
export function normalizeKit(raw) {
  const d = defaultKit();
  const k = raw && typeof raw === 'object' ? raw : {};
  const toArr = (v) => Array.isArray(v) ? v.filter(Boolean) : (v && typeof v === 'object' ? Object.values(v).filter(Boolean) : []);
  return {
    collarShape: COLLAR_SHAPES.some(c => c.id === k.collarShape) ? k.collarShape : d.collarShape,
    collar: COLLARS.some(c => c.id === k.collar) ? k.collar : d.collar,
    cuffs: CUFFS.some(c => c.id === k.cuffs) ? k.cuffs : d.cuffs,
    sleeveDeco: SLEEVE_DECO.some(c => c.id === k.sleeveDeco) ? k.sleeveDeco : d.sleeveDeco,
    colors: { ...d.colors, ...(k.colors || {}) },
    brand: { ...d.brand, ...(k.brand || {}) },
    crest: { ...d.crest, ...(k.crest || {}) },
    sponsor: { ...d.sponsor, ...(k.sponsor || {}) },
    layers: toArr(k.layers).map(l => ({
      type: 'stripes', color: '#ffffff', opacity: 100, scale: 100, flipX: false, flipY: false,
      ...l, zone: l.zone || (l.onSleeves ? 'all' : 'body')
    })),
    patches: toArr(k.patches).map(p => ({ id: p.id, name: p.name || '', src: p.src || '', pos: p.pos || 'chest' })),
    ...(k.image ? { image: k.image } : {})
  };
}

/** Etichetta di un disegno (integrato o PNG del Patron). */
export function patternLabel(type) {
  if (String(type).startsWith('png:')) return (getPngPatterns().find(p => 'png:' + p.id === type) || {}).name || 'Disegno';
  return (PATTERNS.find(p => p.id === type) || {}).label || type;
}

/* ------------------------------------------------- mappa UV del modello */
// Riquadri dei pezzi nella texture della maglia (coordinate 0..1, origine in alto a sinistra).
// Davanti e dietro non sono specchiati; la manica "L" è quella a sinistra guardando la maglia di fronte.
export const UV = {
  front:   { x: .1523, y: .2598, w: .3252, h: .4629 },
  back:    { x: .5391, y: .2451, w: .3252, h: .4805 },
  sleeveL: { x: .2031, y: .7656, w: .2578, h: .1250 },
  sleeveR: { x: .5391, y: .7656, w: .2578, h: .1250 },
  collar:  { x: .3301, y: .1611, w: .3076, h: .0225 }
};

// Posizioni sul pezzo (0..1 nel riquadro del pezzo): s = lato rispetto alla larghezza del pezzo.
// Guardando la maglia: marchio tecnico in alto a sinistra, stemma della squadra in alto a destra (sul cuore).
export const ANCHORS = {
  crest:   { part: 'front', x: .70, y: .30, s: .17 },
  brand:   { part: 'front', x: .30, y: .30, s: .15 },
  sponsor: { part: 'front', x: .50, y: .51, w: .66, h: .20 },
  chest:   { part: 'front', x: .50, y: .30, s: .10 },
  belly:   { part: 'front', x: .50, y: .73, s: .14 },
  hem:     { part: 'front', x: .27, y: .90, s: .10 },
  sleeveL: { part: 'sleeveL', x: .50, y: .42, s: .24 },
  sleeveR: { part: 'sleeveR', x: .50, y: .42, s: .24 }
};

const ASSET_BASE = 'icons/kit3d/';
export const KIT3D_FILES = { model: ASSET_BASE + 'shirt.glb', collarPolo: ASSET_BASE + 'collar-polo.glb', mask: ASSET_BASE + 'mask.png', seams: ASSET_BASE + 'seams.jpg' };

/* ------------------------------------------------------------ utilità */
const svgUrl = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

function canvasOf(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/**
 * Immagine pulita per la texture 3D (WebGL non accetta immagini "contaminate" da altri siti):
 * provo in CORS, poi tramite un proxy che aggiunge l'intestazione CORS; se nessuno va, la salto.
 */
const cleanCache = new Map();
export function loadCleanImage(url) {
  if (!url) return Promise.resolve(null);
  if (cleanCache.has(url)) return cleanCache.get(url);
  const attempt = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
  const local = /^(data:|blob:)/i.test(url) || !/^https?:/i.test(url) || url.startsWith(location.origin);
  const job = (local ? attempt(url) : attempt(url).catch(() => attempt('https://wsrv.nl/?url=' + encodeURIComponent(url))))
    .catch(() => { console.warn('Divisa: immagine non utilizzabile', url); return null; });
  cleanCache.set(url, job);
  return job;
}

/** Disegno integrato rasterizzato in bianco su un pezzo (viewBox = porzione della vista frontale). */
const rasterCache = new Map();
function builtinPattern(layer, part, w, h) {
  const p = PATTERNS.find(x => x.id === layer.type);
  if (!p) return Promise.resolve(null);
  const s = clamp(layer.scale, 30, 250) / 100;
  const key = [layer.type, s, !!layer.flipX, !!layer.flipY, part, w, h].join('|');
  if (rasterCache.has(key)) return rasterCache.get(key);
  // il busto (davanti/dietro) corrisponde a x 100..300, y 20..400 della vista frontale;
  // le maniche a una porzione con la stessa densità
  const vb = part === 'front' || part === 'back' ? [100, 20, 200, 380] : [100, 20, 159, 103];
  const sx = layer.flipX ? -1 : 1, sy = layer.flipY ? -1 : 1;
  const tf = (sx < 0 || sy < 0) ? `transform="translate(${sx < 0 ? W : 0},${sy < 0 ? H : 0}) scale(${sx},${sy})"` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb.join(' ')}" preserveAspectRatio="none"><g ${tf}>${p.draw('#ffffff', s, 'p' + rasterCache.size)}</g></svg>`;
  const job = loadCleanImage(svgUrl(svg));
  if (rasterCache.size > 200) rasterCache.delete(rasterCache.keys().next().value);
  rasterCache.set(key, job);
  return job;
}

function brandSvgImage(brand, color, base) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 60 40">${brand.draw(safeColor(color), safeColor(base))}</svg>`;
  return loadCleanImage(svgUrl(svg));
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

function drawContain(ctx, img, cx, cy, bw, bh, rot = 0) {
  if (!img) return;
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const r = Math.min(bw / iw, bh / ih);
  const w = iw * r, h = ih * r;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(cx, cy);
  if (rot) ctx.rotate(rot * Math.PI / 180);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

async function loadCut(url) {
  if (!url) return null;
  return loadCleanImage(await getCutout(url));
}

/* --------------------------------------------- maschera e scollo del modello */
let maskJob = null;
/** Maschera dei pezzi + profilo superiore di davanti/dietro (per il bordino del colletto). */
function loadMask() {
  if (maskJob) return maskJob;
  maskJob = loadCleanImage(KIT3D_FILES.mask).then(img => {
    if (!img) return null;
    const c = canvasOf(img.naturalWidth, img.naturalHeight);
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    // per davanti e dietro: bordo superiore della sagoma tra le due "spalle" più alte = scollo
    const neck = {};
    ['front', 'back'].forEach(part => {
      const r = UV[part];
      const x0 = Math.round(r.x * c.width), x1 = Math.round((r.x + r.w) * c.width);
      const y0 = Math.round(r.y * c.height), y1 = Math.round((r.y + r.h) * c.height);
      const top = [];
      for (let px = x0; px < x1; px++) {
        let ty = -1;
        for (let py = y0; py < y1; py++) if (d[(py * c.width + px) * 4 + 3] > 128) { ty = py; break; }
        top.push(ty);
      }
      const n = top.length;
      const minIn = (a, b) => { let best = a; for (let i = a; i < b; i++) if (top[i] >= 0 && top[i] < top[best]) best = i; return best; };
      const l = minIn(Math.round(n * .15), Math.round(n * .5)), rr = minIn(Math.round(n * .5), Math.round(n * .85));
      neck[part] = top.slice(l, rr + 1).map((ty, i) => [(x0 + l + i) / c.width, ty / c.height]);
    });
    return { img, neck };
  });
  return maskJob;
}

/* --------------------------------------------------------- composizione */
/**
 * Dipinge la texture UV della maglia. Restituisce un canvas size×size (default 2048).
 * opts: { crestUrl, size, plain (senza loghi) }
 */
export async function paintKitTexture(rawKit, opts = {}) {
  const k = normalizeKit(rawKit);
  const S = Math.round(opts.size || 2048);
  const R = (part) => { const r = UV[part]; return { x: r.x * S, y: r.y * S, w: r.w * S, h: r.h * S }; };
  const mask = await loadMask();
  const seams = await loadCleanImage(KIT3D_FILES.seams);

  const out = canvasOf(S, S);
  const ctx = out.getContext('2d');

  /** Disegna dentro un pezzo, ritagliato sulla sagoma del modello. */
  const inPart = (part, paint) => {
    const r = R(part);
    const c = canvasOf(S, S), x = c.getContext('2d');
    paint(x, r);
    if (mask) {
      x.globalCompositeOperation = 'destination-in';
      x.save(); x.beginPath(); x.rect(r.x - 2, r.y - 2, r.w + 4, r.h + 4); x.clip();
      x.drawImage(mask.img, 0, 0, S, S);
      x.restore();
      // fuori dal riquadro del pezzo non deve restare niente
      x.globalCompositeOperation = 'destination-in';
      x.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
    }
    ctx.drawImage(c, 0, 0);
  };
  const fill = (color) => (x, r) => { x.fillStyle = safeColor(color); x.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4); };
  const c = k.colors;

  // 1. colori di base
  ctx.fillStyle = safeColor(c.base); ctx.fillRect(0, 0, S, S); // anche l'etichetta interna e i margini
  ['front', 'back'].forEach(p => inPart(p, fill(c.base)));
  ['sleeveL', 'sleeveR'].forEach(p => inPart(p, fill(c.sleeves)));

  // 2. disegni (livelli)
  const pngPatterns = getPngPatterns();
  for (const l of k.layers) {
    const parts = l.zone === 'sleeves' ? ['sleeveL', 'sleeveR'] : l.zone === 'all' ? ['front', 'back', 'sleeveL', 'sleeveR'] : ['front', 'back'];
    const alpha = clamp(l.opacity, 0, 100) / 100;
    if (String(l.type).startsWith('png:')) {
      const pp = pngPatterns.find(x => 'png:' + x.id === l.type);
      const img = await loadCleanImage(pp && pp.url);
      if (!img) continue;
      if (pp.mode === 'uv') {
        // grafica disegnata sulla mappa UV completa: la applico così com'è (o colorata) sui pezzi scelti
        const src = pp.colors === 'original' ? img : tint(img, safeColor(l.color), S, S);
        parts.forEach(p => inPart(p, (x) => { x.globalAlpha = alpha; x.drawImage(src, 0, 0, S, S); }));
      } else {
        const s = clamp(l.scale, 30, 250) / 100;
        parts.forEach(p => inPart(p, (x, r) => {
          const t = tint(img, safeColor(l.color), r.w, r.h);
          x.save(); x.globalAlpha = alpha;
          x.translate(r.x + r.w / 2, r.y + r.h / 2);
          x.scale((l.flipX ? -1 : 1) * s, (l.flipY ? -1 : 1) * s);
          x.drawImage(t, -r.w / 2, -r.h / 2, r.w, r.h);
          x.restore();
        }));
      }
      continue;
    }
    for (const p of parts) {
      const r = R(p);
      const img = await builtinPattern(l, p.startsWith('sleeve') ? 'sleeve' : p, Math.round(r.w), Math.round(r.h));
      if (!img) continue;
      inPart(p, (x) => { x.globalAlpha = alpha; x.drawImage(tint(img, safeColor(l.color), r.w, r.h), r.x, r.y, r.w, r.h); });
    }
  }

  // 3. decorazioni delle maniche e polsini
  const trim = safeColor(c.trim);
  ['sleeveL', 'sleeveR'].forEach(p => inPart(p, (x, r) => {
    x.fillStyle = trim;
    const cuffTop = r.y + r.h * .84;
    switch (k.sleeveDeco) {
      case 'stripes3': case 'stripes2': {
        const n = k.sleeveDeco === 'stripes3' ? 3 : 2, lw = r.w * .022, gap = r.w * .05;
        for (let i = 0; i < n; i++) x.fillRect(r.x + r.w / 2 + (i - (n - 1) / 2) * gap - lw / 2, r.y, lw, cuffTop - r.y);
        break;
      }
      case 'shoulder': x.fillRect(r.x, r.y, r.w, r.h * .32); break;
      case 'band': x.fillRect(r.x, r.y + r.h * .58, r.w, r.h * .1); break;
      case 'chevrons':
        x.strokeStyle = trim; x.lineWidth = r.h * .035;
        for (let i = 0; i < 3; i++) {
          const y = r.y + r.h * (.42 + i * .1);
          x.beginPath(); x.moveTo(r.x + r.w * .3, y - r.h * .08); x.lineTo(r.x + r.w / 2, y); x.lineTo(r.x + r.w * .7, y - r.h * .08); x.stroke();
        }
        break;
      case 'side': x.fillRect(r.x, r.y, r.w * .07, r.h); x.fillRect(r.x + r.w * .93, r.y, r.w * .07, r.h); break;
    }
    // polsino: in fondo al pezzo della manica
    const cuff = safeColor(c.cuffs);
    if (k.cuffs === 'band') { x.fillStyle = cuff; x.fillRect(r.x - 2, cuffTop, r.w + 4, r.y + r.h - cuffTop + 2); }
    if (k.cuffs === 'double') {
      x.fillStyle = cuff; x.fillRect(r.x - 2, cuffTop, r.w + 4, r.y + r.h - cuffTop + 2);
      x.fillStyle = safeColor(c.sleeves); x.fillRect(r.x - 2, cuffTop + r.h * .06, r.w + 4, r.h * .03);
    }
    if (k.cuffs === 'thin') { x.fillStyle = cuff; x.fillRect(r.x - 2, cuffTop, r.w + 4, r.h * .035); }
  }));
  if (k.sleeveDeco === 'side') ['front', 'back'].forEach(p => inPart(p, (x, r) => {
    x.fillStyle = trim; x.fillRect(r.x, r.y, r.w * .045, r.h); x.fillRect(r.x + r.w * .955, r.y, r.w * .045, r.h);
  }));

  // 4. colletto (striscia intorno al collo) ed eventuale bordo sul petto e sulla schiena
  inPart('collar', (x, r) => {
    x.fillStyle = safeColor(c.collar); x.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
    x.fillStyle = trim;
    if (k.collar === 'twotone') x.fillRect(r.x - 2, r.y + r.h * .5, r.w + 4, r.h * .5 + 2);
    if (k.collar === 'striped') { x.fillRect(r.x - 2, r.y + r.h * .3, r.w + 4, r.h * .12); x.fillRect(r.x - 2, r.y + r.h * .58, r.w + 4, r.h * .12); }
  });
  if ((k.collar === 'trim' || k.collar === 'wide') && mask) {
    ['front', 'back'].forEach(p => inPart(p, (x) => {
      const pts = mask.neck[p];
      if (!pts || pts.length < 2) return;
      const lw = S * (k.collar === 'wide' ? .012 : .005);
      x.strokeStyle = safeColor(c.collar); x.lineWidth = lw; x.lineJoin = 'round';
      x.beginPath();
      pts.forEach(([u, v], i) => (i ? x.lineTo(u * S, v * S + lw / 2) : x.moveTo(u * S, v * S + lw / 2)));
      x.stroke();
    }));
  }

  // 5. loghi, sponsor e patch sul davanti / maniche
  if (!opts.plain) {
    const at = (a) => { const r = R(a.part); return { x: r.x + a.x * r.w, y: r.y + a.y * r.h, s: (a.s || .1) * r.w, r }; };
    if (k.crest.show && opts.crestUrl) {
      const img = await loadCut(opts.crestUrl);
      const a = at(ANCHORS.crest), s = a.s * clamp(k.crest.size, 60, 150) / 100;
      drawContain(ctx, img, a.x, a.y, s, s);
    }
    const b = k.brand;
    let brandImg = null;
    if (b.id === 'custom') brandImg = await loadCleanImage(b.url);
    else if (String(b.id).startsWith('png:')) {
      const pb = getPngBrands().find(x => 'png:' + x.id === b.id);
      brandImg = await loadCleanImage(pb && pb.url);
    } else {
      const bb = BRANDS.find(x => x.id === b.id);
      if (bb && bb.id !== 'none' && bb.id !== 'custom') brandImg = await brandSvgImage(bb, b.color, c.base);
    }
    if (brandImg) {
      const a = at(ANCHORS.brand);
      const img = (b.id === 'custom' || String(b.id).startsWith('png:')) && b.mono
        ? tint(brandImg, safeColor(b.color), brandImg.naturalWidth || brandImg.width, brandImg.naturalHeight || brandImg.height) : brandImg;
      drawContain(ctx, img, a.x, a.y, a.s, a.s * .75);
    }
    const sp = k.sponsor;
    if (sp.mode !== 'none') {
      const A = ANCHORS.sponsor, r = R('front'), f = clamp(sp.scale, 40, 160) / 100;
      const bw = A.w * r.w * f, bh = A.h * r.h * f;
      const cx = r.x + A.x * r.w, cy = r.y + (A.y + clamp(sp.y, -60, 80) / 400) * r.h;
      if (sp.mode === 'image' && sp.url) {
        const img0 = await loadCleanImage(sp.url);
        if (img0) drawContain(ctx, sp.mono ? tint(img0, safeColor(sp.color), img0.naturalWidth, img0.naturalHeight) : img0, cx, cy, bw, bh);
      } else if (sp.mode === 'text' && String(sp.text || '').trim()) {
        const ft = SPONSOR_FONTS.find(x => x.id === sp.font) || SPONSOR_FONTS[0];
        const txt = String(sp.text).trim().slice(0, 24);
        let px = bh * .62;
        ctx.font = `${ft.style} ${ft.weight} ${px}px ${ft.css}`;
        const mw = ctx.measureText(txt).width;
        if (mw > bw) { px *= bw / mw; ctx.font = `${ft.style} ${ft.weight} ${px}px ${ft.css}`; }
        ctx.fillStyle = safeColor(sp.color); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(txt, cx, cy);
      }
    }
    for (const p of k.patches) {
      const A = ANCHORS[p.pos];
      if (!A || !p.src) continue;
      const img = await loadCut(p.src);
      const a = at(A);
      drawContain(ctx, img, a.x, a.y, a.s, a.s);
    }
  }

  // 6. cuciture e dettagli di stampa della base (moltiplica)
  if (seams) { ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(seams, 0, 0, S, S); ctx.globalCompositeOperation = 'source-over'; }
  return out;
}

/* ------------------------------------------------------------- stili rapidi */
// Solo il disegno (livelli e decorazioni delle maniche): colori, sponsor, stemma e patch restano invariati
export const PRESETS = [
  { name: 'Tre strisce',      kit: { sleeveDeco: 'stripes3', layers: [] } },
  { name: 'Bande laterali',   kit: { sleeveDeco: 'side', layers: [] } },
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
