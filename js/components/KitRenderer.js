import { getPngPatterns, getPngBrands } from '../services/kitAssets.js';
import { getCutout } from '../services/imageCutout.js';
import { COLLAR_SHAPES } from './kitShapes.js';

export { COLLAR_SHAPES };

/**
 * Divisa della squadra: dati e pittura della texture UV della maglia 3D (vedi components/Kit3D.js).
 * La divisa è salvata in teams/{id}/kit:
 * {
 *   collarShape,                                            // forma del colletto: 'v' (scollo a V) o 'polo' (vedi kitShapes.js)
 *   sleeveCut,                                              // cucitura delle maniche: 'setin' (sulle spalle) o 'raglan' (dal colletto all'ascella)
 *   collar, cuffs, sleeveDeco,                              // stile di colletto, polsini, decorazioni maniche
 *   colors: { base, sleeves, sleevesR, shoulders, collar, cuffs, trim },  // sleevesR: manica destra se diversa ('' = come sleeves)
 *   shoulders: { shape: 'none'|'raglan'|'yoke', size, match },  // spalle colorate; match: colore delle maniche
 *   sleeveDecoN,                                            // numero di strisce delle maniche (decorazione 'stripes')
 *   sleeveDecoShoulder,                                     // strisce delle maniche che partono dal colletto (spalla + manica)
 *   layers: [{ type, color, opacity, scale, flipX, flipY, x, y, rot, zone }],  // type: disegno integrato, 'png:<id>' (dal Patron)
 *                                                           // motivi ('m-...'): anche count, size, gap, dir, amp, len, shape, fill, stagger (vedi motifParams)
 *                                                           // o 'img' (PNG caricato dal giocatore: url, mono = tinta unica); zone: body | all | sleeves
 *                                                           // x, y: spostamento in % del pezzo (+ = destra/su), rot: gradi
 *                                                           // wrap: whole (davanti e dietro come un unico pezzo) | repeat | mirror
 *   sleeveTf: { x, y, scale, rot },                         // posizione, dimensione e rotazione delle decorazioni delle maniche
 *   brand: { id, color, url, mono, size, x, y },            // id: 'nike', 'png:<id>' (dal Patron) o 'custom'; x, y: spostamento in % del davanti
 *   crest: { show, size, swap, x, y },                     // swap: stemma al posto del marchio tecnico e viceversa
 *   sponsor: { mode: 'none'|'image'|'text', url, text, font, color, mono, scale, y },
 *   backSponsor: { ...come sponsor },                       // sponsor sul retro (sotto il numero)
 *   backPrint: { show, name, number, font, color, outline, nameSize, numSize, y },  // nome e numero sul retro
 *   patches: [{ id, src, name, pos }],
 *   image                                                   // foto PNG della maglia (fronte) generata al salvataggio
 * }
 * I disegni integrati sono SVG pensati sulla vista frontale 0 0 400 420 e vengono adattati a ogni pezzo della maglia.
 */
let W = 400;  // dimensioni della vista frontale (allargate per un attimo quando si ruota/sposta un motivo ripetuto)
let H = 420;

const safeColor = (c, def = '#ffffff') => (/^#[0-9a-f]{3,8}$/i.test(String(c || '')) ? c : def);
const clamp = (v, a, b) => Math.min(b, Math.max(a, Number.isFinite(+v) ? +v : a));

/* --------------------------------------------------------------- disegni */
const range = (from, to, step) => { const out = []; for (let v = from; v <= to; v += step) out.push(v); return out; };

/** Numeri pseudo-casuali ripetibili (stesso disegno ogni volta). */
const rng = (seed) => () => (seed = (seed * 9301 + 49297) % 233280) / 233280;

/** Percorso chiuso e morbido (curve di Bézier) che passa per i punti dati. */
function smoothClosed(pts) {
  const n = pts.length, f = (v) => v.toFixed(1);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`;
  }
  return d + 'Z';
}

/** Mimetico woodland: macchie organiche in tre tonalità del colore del livello. */
function camo(c, s) {
  const rnd = rng(41);
  let o = '';
  [[.38, 1], [.68, .8], [1, .62]].forEach(([op, k]) => {
    const n = Math.round(W * H / (2600 * s * s) * k);
    let d = '';
    for (let i = 0; i < n; i++) {
      const cx = rnd() * W, cy = rnd() * H, R = (16 + rnd() * 22) * s, el = 1.2 + rnd() * .9, rot = rnd() * Math.PI;
      const pts = [];
      for (let j = 0; j < 9; j++) {
        const a = j / 9 * Math.PI * 2 + (rnd() - .5) * .4, r = R * (.55 + rnd() * .55);
        const x = Math.cos(a) * r * el, y = Math.sin(a) * r;
        pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
      }
      d += smoothClosed(pts);
    }
    o += `<path d="${d}" fill="${c}" fill-opacity="${op}"/>`;
  });
  return o;
}

/** Fiamme: una fila di lingue di fuoco che salgono dal fondo del busto, punte piegate alternate. */
function flames(c, s) {
  const f = (v) => v.toFixed(1), x0 = 90, x1 = 310, n = 6, step = (x1 - x0) / n, base = H + 10;
  const hs = [.55, .95, .7, 1, .6, .85];
  let d = `M${x0 - 20},${base} L${x0 - 20},${H - 40 * s}`;
  for (let i = 0; i < n; i++) {
    const a = x0 + i * step, h = 200 * s * hs[i], lean = (i % 2 ? 1 : -1) * step * .35;
    const tipX = a + step / 2 + lean, tipY = H - h, valley = H - 40 * s;
    // dal fondo della valle sale gonfiandosi, la punta si piega di lato, poi scende stretta nella valle successiva
    d += ` C${f(a)},${f(valley - h * .3)} ${f(tipX - lean * 1.2)},${f(tipY + h * .45)} ${f(tipX)},${f(tipY)}`
      + ` C${f(tipX - lean * .2)},${f(tipY + h * .4)} ${f(a + step * .9)},${f(valley - h * .35)} ${f(a + step)},${f(valley)}`;
  }
  return `<path d="${d} L${x1 + 20},${base} Z" fill="${c}"/>`;
}

/** Forma regolare (centro, raggio, lati, rotazione in gradi) come punti di un poligono. */
const regular = (cx, cy, r, n, rot = -90) => range(0, n - 1, 1).map(i => { const a = (rot + i * 360 / n) * Math.PI / 180; return `${(cx + r * Math.cos(a) * NARROW).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`; }).join(' ');
/** Sul busto la grafica viene allargata di circa 1/0,75: le forme singole si disegnano più strette per restare proporzionate. */
const NARROW = .75;

/** Low poly: triangoli sfaccettati con trasparenze diverse. */
function lowPoly(c, s) {
  const rnd = rng(29), g = 48 * s, cols = Math.ceil(W / g) + 2, rows = Math.ceil(H / g) + 2, P = [];
  for (let i = 0; i < cols; i++) { P.push([]); for (let j = 0; j < rows; j++) P[i].push([(i - .5) * g + (rnd() - .5) * g * .7, (j - .5) * g + (rnd() - .5) * g * .7]); }
  let o = '';
  const tri = (a, b, d) => { o += `<polygon points="${[a, b, d].map(p => p.map(v => v.toFixed(1)).join(',')).join(' ')}" fill="${c}" fill-opacity="${(rnd() * .55).toFixed(2)}"/>`; };
  for (let i = 0; i < cols - 1; i++) for (let j = 0; j < rows - 1; j++) {
    const a = P[i][j], b = P[i + 1][j], d = P[i][j + 1], e = P[i + 1][j + 1];
    if ((i + j) % 2) { tri(a, b, e); tri(a, e, d); } else { tri(a, b, d); tri(b, e, d); }
  }
  return o;
}

/** Linee di velocità: scie diagonali affusolate. */
function speedLines(c, s) {
  const rnd = rng(37), a = -0.45, cs = Math.cos(a), sn = Math.sin(a);
  let o = '';
  const n = Math.round(W * H / (5200 * s * s));
  for (let i = 0; i < n; i++) {
    const x = rnd() * (W + 200) - 100, y = rnd() * (H + 100) - 50, L = (60 + rnd() * 200) * s, t = (2 + rnd() * 8) * s;
    const pt = (u, v) => `${(x + u * cs - v * sn).toFixed(1)},${(y + u * sn + v * cs).toFixed(1)}`;
    o += `<polygon points="${pt(0, -t / 2)} ${pt(L, 0)} ${pt(0, t / 2)} ${pt(-t * .8, 0)}" fill="${c}" fill-opacity="${(.45 + rnd() * .55).toFixed(2)}"/>`;
  }
  return o;
}

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

/* ------------------------------------------------ motivi parametrici */
// Un motivo si costruisce con dei parametri: quanti elementi (1..100, forme fino a 1000, oppure "riempi tutta la maglia"),
// spessore/dimensione, distanza, direzione, forma (anche un simbolo PNG: shape 'png' con symUrl).
// Sono centrati sul davanti (x 200, y 210 della vista frontale) e disegnati molto più grandi della maglia,
// così spostati o ruotati coprono sempre tutto il pezzo.
export const MOTIF_SHAPES = [
  { id: 'circle',   label: 'Cerchio' },
  { id: 'square',   label: 'Quadrato' },
  { id: 'diamond',  label: 'Rombo' },
  { id: 'triangle', label: 'Triangolo' },
  { id: 'hexagon',  label: 'Esagono' },
  { id: 'star',     label: 'Stella' },
  { id: 'heart',    label: 'Cuore' },
  { id: 'plus',     label: 'Croce' },
  { id: 'arrow',    label: 'Freccia' },
  { id: 'bolt',     label: 'Fulmine' },
  { id: 'vDown',    label: 'V in giù' },
  { id: 'vUp',      label: 'V in su' },
  { id: 'gem',      label: 'Diamante' },
  { id: 'longDiamond', label: 'Rombo lungo' }
];
/** Parametri dei motivi: limiti e valori di partenza (vedi motifParams). */
export const MOTIF_LIMITS = { count: [1, 100], size: [1, 100], gap: [0, 100], amp: [0, 100], len: [5, 100] };
const MOTIF_BASE = { count: 1, size: 20, gap: 20, dir: 'v', amp: 30, len: 30, shape: 'circle', fill: 'solid', stagger: false, all: false, symUrl: '', symMono: true };
/** Numero massimo di elementi di un motivo (le forme arrivano a 1000). */
export const motifMax = (type) => ((PATTERNS.find(x => x.id === type) || {}).countMax || MOTIF_LIMITS.count[1]);
/** Valori dei parametri di un motivo per un livello (quelli mancanti o fuori misura tornano ai valori di partenza). */
export function motifParams(l) {
  const p = PATTERNS.find(x => x.id === (l && l.type));
  const d = { ...MOTIF_BASE, ...((p && p.defaults) || {}) };
  const o = { ...d };
  Object.entries(MOTIF_LIMITS).forEach(([k, [a, b]]) => { o[k] = Math.round(clamp(l && l[k] != null ? l[k] : d[k], a, k === 'count' ? ((p && p.countMax) || b) : b)); });
  o.dir = l && ['v', 'h', 'grid'].includes(l.dir) ? l.dir : d.dir;
  o.symUrl = l && typeof l.symUrl === 'string' ? l.symUrl : '';
  o.shape = l && (MOTIF_SHAPES.some(x => x.id === l.shape) || (l.shape === 'png' && o.symUrl)) ? l.shape : d.shape;
  o.symMono = l && l.symMono != null ? !!l.symMono : d.symMono;
  o.all = !!(l && l.all && p && p.params.includes('all'));
  o.fill = l && (l.fill === 'line' || l.fill === 'solid') ? l.fill : d.fill;
  o.stagger = l && l.stagger != null ? !!l.stagger : d.stagger;
  return o;
}
const MC = { x: 200, y: 210 }, FAR = 1300; // centro dei motivi e metà lunghezza delle righe
const FILL_SPAN = 1700; // "riempi tutta la maglia": larghezza coperta (anche spostato o ruotato)
/** Quanti elementi: quelli scelti o, con "riempi tutta la maglia", quanti ne servono per coprirla (al massimo `cap`). */
const motifCount = (m, pitch, cap) => m.all ? Math.min(cap, Math.ceil(FILL_SPAN / Math.max(1, pitch)) | 1) : m.count;
const offsets = (n, pitch) => range(0, n - 1, 1).map(i => (i - (n - 1) / 2) * pitch);
const f1 = (v) => (+v).toFixed(1);

/** Forma di raggio 1 centrata in 0,0 (path). */
export function shapePath(id) {
  const poly = (pts) => 'M' + pts.map(([x, y]) => `${f1(x)},${f1(y)}`).join(' L') + ' Z';
  const reg = (n, rot) => poly(range(0, n - 1, 1).map(i => { const a = (rot + i * 360 / n) * Math.PI / 180; return [Math.cos(a), Math.sin(a)]; }));
  switch (id) {
    case 'square':   return 'M-.86,-.86 L.86,-.86 L.86,.86 L-.86,.86 Z';
    case 'diamond':  return reg(4, -90);
    case 'triangle': return 'M0,-1 L.95,.72 L-.95,.72 Z';
    case 'hexagon':  return reg(6, 30);
    case 'star':     return poly(range(0, 9, 1).map(i => { const r = i % 2 ? .42 : 1, a = -Math.PI / 2 + i * Math.PI / 5; return [r * Math.cos(a), r * Math.sin(a)]; }));
    case 'heart':    return 'M0,.95 C-1.3,0 -1.1,-1 -.5,-1 C-.2,-1 0,-.75 0,-.55 C0,-.75 .2,-1 .5,-1 C1.1,-1 1.3,0 0,.95 Z';
    case 'plus':     return 'M-.32,-1 L.32,-1 L.32,-.32 L1,-.32 L1,.32 L.32,.32 L.32,1 L-.32,1 L-.32,.32 L-1,.32 L-1,-.32 L-.32,-.32 Z';
    case 'arrow':    return 'M0,-1 L1,0 L.42,0 L.42,1 L-.42,1 L-.42,0 L-1,0 Z';
    case 'bolt':     return 'M.25,-1 L-.6,.12 L-.05,.12 L-.3,1 L.6,-.2 L.06,-.2 L.4,-1 Z';
    case 'vDown':    return 'M-1,-.75 L-.5,-.75 L0,.25 L.5,-.75 L1,-.75 L0,.95 Z';
    case 'vUp':      return 'M-1,.75 L-.5,.75 L0,-.25 L.5,.75 L1,.75 L0,-.95 Z';
    case 'gem':      return 'M-1,-.3 L-.55,-.85 L.55,-.85 L1,-.3 L0,.95 Z';
    case 'longDiamond': return 'M0,-1 L.42,0 L0,1 L-.42,0 Z';
    default:         return 'M-1,0 A1,1 0 1,0 1,0 A1,1 0 1,0 -1,0 Z';
  }
}

/** Righe parallele (dritte, a onda o a zig-zag) centrate sul davanti. kind: 'line' | 'wave' | 'zigzag'. */
function motifLines(c, m, kind) {
  const t = m.size * 2, pitch = t + m.gap * 2, amp = m.amp * 1.2, len = m.len * 6;
  const hor = m.dir === 'h';
  const n = motifCount(m, pitch, kind === 'line' ? 1700 : 300), far = m.all && kind !== 'line' ? 800 : FAR;
  return offsets(n, pitch).map(o => {
    if (kind === 'line') return hor
      ? `<rect x="${-FAR}" y="${f1(MC.y + o - t / 2)}" width="${FAR * 2 + 400}" height="${t}" fill="${c}"/>`
      : `<rect x="${f1(MC.x + o - t / 2)}" y="${-FAR}" width="${t}" height="${FAR * 2 + 420}" fill="${c}"/>`;
    let d = '';
    const stepN = kind === 'zigzag' ? len / 2 : 8;
    for (let a = -far, i = 0; a <= far + 420; a += stepN, i++) {
      const w = kind === 'zigzag' ? (i % 2 ? amp : -amp) : amp * Math.sin(a / len * Math.PI * 2);
      d += (i ? ' L' : 'M') + (hor ? `${f1(a)},${f1(MC.y + o + w)}` : `${f1(MC.x + o + w)},${f1(a)}`);
    }
    return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${t}" stroke-linejoin="${kind === 'zigzag' ? 'miter' : 'round'}" stroke-miterlimit="20"/>`;
  }).join('');
}

const MOTIFS = [
  { id: 'm-stripe', cat: 'lines', label: 'Strisce', params: ['count', 'all', 'size', 'gap', 'dir'], defaults: { count: 1, size: 20, gap: 15 },
    draw: (c, s, id, m) => motifLines(c, m, 'line') },
  { id: 'm-wave', cat: 'lines', label: 'Righe a onda', params: ['count', 'all', 'size', 'gap', 'amp', 'len', 'dir'], defaults: { count: 1, size: 10, gap: 15, amp: 15, len: 20 },
    draw: (c, s, id, m) => motifLines(c, m, 'wave') },
  { id: 'm-zigzag', cat: 'lines', label: 'Righe a zig-zag', params: ['count', 'all', 'size', 'gap', 'amp', 'len', 'dir'], defaults: { count: 1, size: 10, gap: 15, amp: 12, len: 8 },
    draw: (c, s, id, m) => motifLines(c, m, 'zigzag') },
  { id: 'm-chevron', cat: 'lines', label: 'Chevron (V)', params: ['count', 'all', 'size', 'gap', 'amp'], defaults: { count: 1, size: 15, gap: 15, amp: 50 },
    draw: (c, s, id, m) => {
      const t = m.size * 2, pitch = t + m.gap * 2, k = m.amp / 100 * 1.2;
      return offsets(motifCount(m, pitch, 400), pitch).map(o => { const y = MC.y + o; return `<path d="M${-FAR},${f1(y - (MC.x + FAR) * k)} L${MC.x},${f1(y)} L${MC.x + FAR + 200},${f1(y - (FAR + 200) * k)}" fill="none" stroke="${c}" stroke-width="${t}" stroke-linejoin="miter" stroke-miterlimit="20"/>`; }).join('');
    } },
  { id: 'm-shape', cat: 'shapes', label: 'Forme', countMax: 1000, params: ['shape', 'count', 'all', 'size', 'gap', 'dir', 'fill', 'stagger'], defaults: { count: 1, size: 40, gap: 10, dir: 'grid' },
    draw: (c, s, id, m) => {
      const r = m.size * 1.5, pitch = r * 2 + m.gap * 2, n = m.count;
      const png = m.shape === 'png' && m.symData;
      const line = m.fill === 'line' && !png;
      // forma di raggio 1: path oppure il simbolo PNG (incorporato una volta e richiamato)
      const defs = png ? `<image id="${id}s" href="${m.symData}" x="-1" y="-1" width="2" height="2" preserveAspectRatio="xMidYMid meet"/>` : '';
      const d = png ? '' : shapePath(m.shape === 'png' ? 'circle' : m.shape), sw = f1(Math.max(1.5, r * .16) / r);
      const one = (x, y) => png ? `<use href="#${id}s" transform="translate(${f1(x)},${f1(y)}) scale(${f1(r * NARROW)},${f1(r)})"/>`
        : `<path transform="translate(${f1(x)},${f1(y)}) scale(${f1(r * NARROW)},${f1(r)})" d="${d}"/>`;
      const paint = (o) => line ? `<g fill="none" stroke="${c}" stroke-width="${sw}" stroke-linejoin="round">${o}</g>` : `<g fill="${c}">${o}</g>`;
      if (m.all) {
        // tutta la maglia: una mattonella che si ripete (con le file sfalsate è alta due file)
        const tw = pitch * NARROW, th = m.stagger ? pitch * 2 : pitch;
        const tile = m.stagger ? one(tw / 2, pitch / 2) + one(0, pitch * 1.5) + one(tw, pitch * 1.5) : one(tw / 2, pitch / 2);
        return `<defs>${defs}<pattern id="${id}t" patternUnits="userSpaceOnUse" x="${f1(MC.x - tw / 2)}" y="${f1(MC.y - pitch / 2)}" width="${f1(tw)}" height="${f1(th)}">${paint(tile)}</pattern></defs>`
          + `<rect x="${-FAR}" y="${-FAR}" width="${FAR * 2 + 400}" height="${FAR * 2 + 420}" fill="url(#${id}t)"/>`;
      }
      const cols = m.dir === 'h' ? n : m.dir === 'v' ? 1 : Math.max(1, Math.round(Math.sqrt(n * .6))), rows = Math.ceil(n / cols);
      let o = '';
      for (let j = 0, k = 0; j < rows; j++) {
        const inRow = Math.min(cols, n - k), shift = m.stagger && j % 2 ? pitch / 2 : 0;
        for (let i = 0; i < inRow; i++, k++) {
          o += one(MC.x + ((i - (inRow - 1) / 2) * pitch + shift) * NARROW, MC.y + (j - (rows - 1) / 2) * pitch);
        }
      }
      return (defs ? `<defs>${defs}</defs>` : '') + paint(o);
    } },
  { id: 'm-rings', cat: 'shapes', label: 'Cerchi concentrici', params: ['count', 'all', 'size', 'gap', 'amp'], defaults: { count: 1, size: 8, gap: 10, amp: 35 },
    draw: (c, s, id, m) => { const t = m.size * 2, pitch = t + m.gap * 2; return range(0, (m.all ? Math.min(600, Math.ceil(FAR / pitch)) : m.count) - 1, 1).map(i => { const r = m.amp * 2 + t / 2 + i * pitch; return `<ellipse cx="${MC.x}" cy="${MC.y}" rx="${f1(r * NARROW)}" ry="${f1(r)}" fill="none" stroke="${c}" stroke-width="${t}"/>`; }).join(''); } },
  { id: 'm-rays', cat: 'shapes', label: 'Raggi', params: ['count', 'size'], defaults: { count: 12, size: 50 },
    draw: (c, s, id, m) => { const n = Math.max(2, m.count), w = 360 / n * m.size / 100; return range(0, n - 1, 1).map(i => { const a0 = (i * 360 / n - w / 2) * Math.PI / 180, a1 = (i * 360 / n + w / 2) * Math.PI / 180, R = FAR; return `<polygon points="${MC.x},${MC.y} ${f1(MC.x + R * Math.cos(a0))},${f1(MC.y + R * Math.sin(a0))} ${f1(MC.x + R * Math.cos(a1))},${f1(MC.y + R * Math.sin(a1))}" fill="${c}"/>`; }).join(''); } },
  { id: 'm-checker', cat: 'shapes', label: 'Scacchi', params: ['count'], defaults: { count: 6 },
    draw: (c, s, id, m) => { const q = 200 / m.count; return `<defs><pattern id="${id}k" patternUnits="userSpaceOnUse" x="${MC.x}" y="${MC.y}" width="${f1(q * 2)}" height="${f1(q * 2)}"><rect width="${f1(q)}" height="${f1(q)}" fill="${c}"/><rect x="${f1(q)}" y="${f1(q)}" width="${f1(q)}" height="${f1(q)}" fill="${c}"/></pattern></defs><rect x="${-FAR}" y="${-FAR}" width="${FAR * 2 + 400}" height="${FAR * 2 + 420}" fill="url(#${id}k)"/>`; } }
];
/** Gruppi della finestra di scelta del disegno. */
export const PATTERN_CATS = [
  { id: 'lines',   label: 'Strisce e righe' },
  { id: 'shapes',  label: 'Forme e motivi' },
  { id: 'blocks',  label: 'Blocchi' },
  { id: 'effects', label: 'Effetti' }
];
// disegni di prima: si vedono ancora sulle maglie salvate, ma per i nuovi livelli ci sono i motivi qui sopra
const LEGACY = new Set(['stripes', 'wideStripes', 'pinstripes', 'hoops', 'thinHoops', 'sash', 'chevron', 'chestBand', 'doubleBand', 'centerStripe',
  'twinStripes', 'checker', 'argyle', 'diagStripes', 'zigzag', 'dots', 'rings', 'bigCircle', 'star', 'hexagons', 'sunburst', 'diamond', 'diamondLine',
  'triangle', 'hexagon', 'ring', 'arrow', 'sawtooth', 'triangles', 'lightning']);
const BLOCKS = new Set(['half', 'quarters', 'sidePanels', 'yoke', 'hem', 'cross', 'swoosh', 'waves', 'shards']);

export const PATTERNS = [
  ...MOTIFS.map(p => ({ ...p, motif: true })),
  { id: 'stripes', tile: true, label: 'Strisce verticali', draw: (c, s) => range(-20, W, 40 * s).map(x => `<rect x="${x}" y="0" width="${20 * s}" height="${H}" fill="${c}"/>`).join('') },
  { id: 'wideStripes', tile: true, label: 'Strisce larghe', draw: (c, s) => range(-30, W, 80 * s).map(x => `<rect x="${x}" y="0" width="${40 * s}" height="${H}" fill="${c}"/>`).join('') },
  { id: 'pinstripes', tile: true, label: 'Gessato', draw: (c, s) => range(0, W, 14 * s).map(x => `<rect x="${x}" y="0" width="${1.6 * s}" height="${H}" fill="${c}"/>`).join('') },
  { id: 'hoops', tile: true, label: 'Bande orizzontali', draw: (c, s) => range(0, H, 50 * s).map(y => `<rect x="0" y="${y}" width="${W}" height="${25 * s}" fill="${c}"/>`).join('') },
  { id: 'thinHoops', tile: true, label: 'Righe orizzontali', draw: (c, s) => range(10, H, 22 * s).map(y => `<rect x="0" y="${y}" width="${W}" height="${5 * s}" fill="${c}"/>`).join('') },
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
  { id: 'checker', tile: true, label: 'Scacchi', draw: (c, s) => { const q = 34 * s; let o = ''; range(0, H, q).forEach((y, i) => range(0, W, q).forEach((x, j) => { if ((i + j) % 2 === 0) o += `<rect x="${x}" y="${y}" width="${q}" height="${q}" fill="${c}"/>`; })); return o; } },
  { id: 'argyle', tile: true, label: 'Rombi', draw: (c, s) => { const q = 40 * s; let o = ''; range(0, H + q, q).forEach((y, i) => range(i % 2 ? q / 2 : 0, W + q, q).forEach(x => { o += `<polygon points="${x},${y - q / 2} ${x + q / 4},${y} ${x},${y + q / 2} ${x - q / 4},${y}" fill="${c}"/>`; })); return o; } },
  { id: 'diagStripes', tile: true, label: 'Strisce diagonali', draw: (c, s) => range(-H, W + H, 44 * s).map(x => `<polygon points="${x},0 ${x + 16 * s},0 ${x + 16 * s + H},${H} ${x + H},${H}" fill="${c}"/>`).join('') },
  { id: 'cross', label: 'Croce nordica', draw: (c, s) => `<rect x="${150 - 18 * s}" y="0" width="${36 * s}" height="${H}" fill="${c}"/><rect x="0" y="${190 - 18 * s}" width="${W}" height="${36 * s}" fill="${c}"/>` },
  { id: 'gradient', label: 'Sfumatura verticale', draw: (c, s, id) => `<defs><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity="0"/><stop offset="${clamp(0.9 / s, .2, 1)}" stop-color="${c}"/></linearGradient></defs><rect x="0" y="0" width="${W}" height="${H}" fill="url(#${id}g)"/>` },
  { id: 'gradientH', label: 'Sfumatura laterale', draw: (c, s, id) => `<defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c}"/><stop offset="${clamp(0.8 * s, .2, 1)}" stop-color="${c}" stop-opacity="0"/></linearGradient></defs><rect x="0" y="0" width="${W}" height="${H}" fill="url(#${id}g)"/>` },
  { id: 'waves', label: 'Onde grandi', draw: (c, s) => `<path d="M60,420 C120,${330 - 40 * s} 150,${250} 210,${210} C270,${170} 330,${150} 380,${80} L400,80 L400,${150 + 30 * s} C340,${230} 280,${250} 240,${280} C190,${320} 170,${370} 160,420 Z" fill="${c}"/><path d="M0,${300} C60,${250} 90,${200} 130,${150} C160,${110} 170,${70} 180,20 L${190 + 14 * s},20 C${190 + 10 * s},80 170,130 150,180 C120,240 70,${300} 20,${360} L0,${370} Z" fill="${c}"/>` },
  { id: 'swoosh', label: 'Curva', draw: (c, s) => `<path d="M100,${330} C180,${300 - 30 * s} 260,${220} 320,${120} L320,${170 + 20 * s} C270,${260} 190,${330} 100,${370 + 10 * s} Z" fill="${c}"/>` },
  { id: 'lightning', label: 'Fulmine', draw: (c, s) => `<polygon points="${230 + 10 * s},20 ${140 - 10 * s},220 ${200},220 ${160 - 10 * s},420 ${270 + 10 * s},180 ${210},180 ${260 + 10 * s},20" fill="${c}"/>` },
  { id: 'zigzag', label: 'Zig-zag', draw: (c, s) => { const a = 20 * s, y = 170; let p = `M0,${y}`; range(0, W, a * 2).forEach(x => { p += ` L${x + a},${y - a} L${x + 2 * a},${y}`; }); let p2 = `L${W + a * 2},${y + 26 * s}`; for (let x = W + a * 2; x >= 0; x -= a * 2) p2 += ` L${x - a},${y + 26 * s - a} L${x - 2 * a},${y + 26 * s}`; return `<path d="${p} ${p2} Z" fill="${c}"/>`; } },
  { id: 'dots', tile: true, label: 'Pois', draw: (c, s) => { const q = 26 * s; let o = ''; range(0, H, q).forEach((y, i) => range(i % 2 ? q / 2 : 0, W, q).forEach(x => { o += `<circle cx="${x}" cy="${y}" r="${5 * s}" fill="${c}"/>`; })); return o; } },
  { id: 'halftone', label: 'Retino', draw: (c, s) => { const q = 12 * s; let o = ''; range(0, H, q).forEach((y, i) => range(i % 2 ? q / 2 : 0, W, q).forEach(x => { const r = (y / H) * q * 0.55; if (r > .4) o += `<circle cx="${x}" cy="${y}" r="${r.toFixed(2)}" fill="${c}"/>`; })); return o; } },
  { id: 'rings', label: 'Cerchi concentrici', draw: (c, s) => range(20, 420, 36 * s).map(r => `<circle cx="200" cy="210" r="${r}" fill="none" stroke="${c}" stroke-width="${10 * s}"/>`).join('') },
  { id: 'bigCircle', label: 'Cerchio centrale', draw: (c, s) => `<circle cx="200" cy="200" r="${70 * s}" fill="${c}"/>` },
  { id: 'star', label: 'Stella', draw: (c, s) => { const pts = range(0, 9, 1).map(i => { const r = i % 2 ? 36 * s : 90 * s, a = -Math.PI / 2 + i * Math.PI / 5; return `${(200 + r * Math.cos(a)).toFixed(1)},${(205 + r * Math.sin(a)).toFixed(1)}`; }); return `<polygon points="${pts.join(' ')}" fill="${c}"/>`; } },
  { id: 'shards', label: 'Geometrico', draw: (c, s) => `<polygon points="100,60 ${200 + 30 * s},140 100,${220 + 30 * s}" fill="${c}"/><polygon points="300,120 ${190 - 20 * s},${250} 300,${380}" fill="${c}"/><polygon points="120,420 ${200},${300 - 20 * s} 280,420" fill="${c}" opacity=".7"/>` },
  { id: 'hexagons', tile: true, label: 'Esagoni', draw: (c, s) => { const r = 18 * s, hw = r * Math.sqrt(3); let o = ''; range(0, H + r, r * 1.5).forEach((y, i) => range(i % 2 ? hw / 2 : 0, W + hw, hw).forEach(x => { const p = range(0, 5, 1).map(k => { const a = Math.PI / 6 + k * Math.PI / 3; return `${(x + (r - 2) * Math.cos(a)).toFixed(1)},${(y + (r - 2) * Math.sin(a)).toFixed(1)}`; }); o += `<polygon points="${p.join(' ')}" fill="none" stroke="${c}" stroke-width="${2 * s}"/>`; })); return o; } },
  { id: 'grid', tile: true, label: 'Quadri (tartan)', draw: (c, s) => range(0, W, 40 * s).map(x => `<rect x="${x}" y="0" width="${8 * s}" height="${H}" fill="${c}" opacity=".7"/>`).join('') + range(0, H, 40 * s).map(y => `<rect x="0" y="${y}" width="${W}" height="${8 * s}" fill="${c}" opacity=".7"/>`).join('') },
  { id: 'camo', tile: true, label: 'Mimetico', draw: (c, s) => camo(c, s) },
  { id: 'brush', label: 'Pennellate', draw: (c, s) => range(0, 5, 1).map(i => `<path d="M${40 + i * 10},${120 + i * 50} Q200,${80 + i * 55 - 30 * s} ${380 - i * 8},${140 + i * 48} L${380 - i * 8},${150 + i * 48 + 8 * s} Q200,${95 + i * 55 - 20 * s} ${40 + i * 10},${132 + i * 50 + 4 * s} Z" fill="${c}" opacity="${(1 - i * 0.12).toFixed(2)}"/>`).join('') },
  { id: 'flames', label: 'Fiamme', draw: (c, s) => flames(c, s) },
  { id: 'crackle', label: 'Crepe', draw: (c, s) => crackle(c, s) },
  { id: 'lowPoly', tile: true, label: 'Low poly', draw: (c, s) => lowPoly(c, s) },
  { id: 'speedLines', tile: true, label: 'Linee di velocità', draw: (c, s) => speedLines(c, s) },
  { id: 'sunburst', label: 'Raggi', draw: (c, s) => range(0, 23, 1).filter(i => i % 2 === 0).map(i => { const a0 = i * 15 * Math.PI / 180, a1 = (i + 1) * 15 * Math.PI / 180, R = 700; return `<polygon points="200,190 ${(200 + R * Math.cos(a0)).toFixed(0)},${(190 + R * Math.sin(a0)).toFixed(0)} ${(200 + R * Math.cos(a1)).toFixed(0)},${(190 + R * Math.sin(a1)).toFixed(0)}" fill="${c}"/>`; }).join('') + `<circle cx="200" cy="190" r="${36 * s}" fill="${c}"/>` },
  { id: 'diamond', label: 'Rombo', draw: (c, s) => `<polygon points="${regular(200, 210, 110 * s, 4)}" fill="${c}"/>` },
  { id: 'diamondLine', label: 'Rombo vuoto', draw: (c, s) => `<polygon points="${regular(200, 210, 110 * s, 4)}" fill="none" stroke="${c}" stroke-width="${14 * s}"/>` },
  { id: 'triangle', label: 'Triangolo', draw: (c, s) => `<polygon points="${regular(200, 180, 120 * s, 3, 90)}" fill="${c}"/>` },
  { id: 'hexagon', label: 'Esagono', draw: (c, s) => `<polygon points="${regular(200, 210, 100 * s, 6, 0)}" fill="none" stroke="${c}" stroke-width="${14 * s}"/>` },
  { id: 'ring', label: 'Anello', draw: (c, s) => `<ellipse cx="200" cy="210" rx="${95 * s * NARROW}" ry="${95 * s}" fill="none" stroke="${c}" stroke-width="${16 * s}"/>` },
  { id: 'arrow', label: 'Freccia', draw: (c, s) => `<polygon transform="translate(200,0) scale(${NARROW},1) translate(-200,0)" points="200,${(120 - 40 * s).toFixed(0)} ${(200 + 110 * s).toFixed(0)},${(230 - 20 * s).toFixed(0)} ${(200 + 110 * s).toFixed(0)},${(280 - 10 * s).toFixed(0)} 200,${(170 - 20 * s).toFixed(0)} ${(200 - 110 * s).toFixed(0)},${(280 - 10 * s).toFixed(0)} ${(200 - 110 * s).toFixed(0)},${(230 - 20 * s).toFixed(0)}" fill="${c}"/>` },
  { id: 'sawtooth', label: 'Denti di sega', draw: (c, s) => { const q = 30 * s, y = 200; let p = `M${-q - 400},${y + q}`; range(-q - 400, W + q + 400, q).forEach(x => { p += ` L${(x + q / 2).toFixed(1)},${y} L${(x + q).toFixed(1)},${y + q}`; }); return `<path d="${p} Z" fill="${c}"/>`; } },
  { id: 'triangles', tile: true, label: 'Triangoli', draw: (c, s) => { const q = 34 * s, hq = q * .87; let o = ''; range(0, H + hq, hq).forEach((y, i) => range((i % 2) * q / 2 - q, W + q, q).forEach(x => { o += `M${x.toFixed(1)},${(y + hq).toFixed(1)} L${(x + q / 2).toFixed(1)},${y.toFixed(1)} L${(x + q).toFixed(1)},${(y + hq).toFixed(1)}Z`; })); return `<path d="${o}" fill="${c}" fill-opacity=".85"/>`; } },
  { id: 'contour', tile: true, label: 'Curve di livello', draw: (c, s) => range(0, H + 40, 16 * s).map((y, i) => { let d = `M-10,${y}`; for (let x = -10; x <= W + 20; x += 20) d += ` L${x},${(y + Math.sin(x / 45 + i * .7) * 10 * s + Math.sin(x / 17 + i) * 3).toFixed(1)}`; return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${(1.6 * s).toFixed(1)}"/>`; }).join('') },
];
PATTERNS.forEach(p => { if (p.motif) return; if (LEGACY.has(p.id)) p.legacy = true; p.cat = BLOCKS.has(p.id) ? 'blocks' : 'effects'; });

/* ---------------------------------------------------------- marchi tecnici */
// Marchi disegnati in un riquadro 60×40 (solo Nike: gli altri li aggiunge il Patron in PNG o li carica il giocatore)
export const BRANDS = [
  { id: 'none', label: 'Nessuno', draw: () => '' },
  { id: 'nike', label: 'Nike', draw: (c) => `<path d="M2,27 C1,33 6,35 14,32 L58,13 L17,25 C9,27 6,25 9,19 C3,22 2,25 2,27 Z" fill="${c}"/>` },
  { id: 'custom', label: 'Personalizzato', draw: () => '' }
];

export const SPONSOR_FONTS = [
  { id: 'bebas',  label: 'Moderno',  css: "'Bebas Neue', Impact, sans-serif", weight: 400, style: 'normal' },
  { id: 'black',  label: 'Pesante',  css: "'Arial Black', Arial, sans-serif", weight: 900, style: 'normal' },
  { id: 'italic', label: 'Sportivo', css: "'Arial Black', Arial, sans-serif", weight: 900, style: 'italic' },
  { id: 'serif',  label: 'Classico', css: "Georgia, 'Times New Roman', serif", weight: 700, style: 'normal' },
  { id: 'script', label: 'Corsivo',  css: "'Brush Script MT', 'Segoe Script', cursive", weight: 700, style: 'italic' }
];

// Caratteri per nome e numero sul retro (i font locali sono in fonts/fonts.css)
export const NUMBER_FONTS = [
  { id: 'seriea',    label: 'Serie A',   css: "'Seri EA', 'Bebas Neue', Impact, sans-serif", weight: 400, style: 'normal' },
  { id: 'champions', label: 'Champions', css: "'Champions', 'Bebas Neue', Impact, sans-serif", weight: 700, style: 'normal' },
  { id: 'bebas',     label: 'Moderno',   css: "'Bebas Neue', Impact, sans-serif", weight: 400, style: 'normal' },
  { id: 'novarese',  label: 'Elegante',  css: "'Novarese', Georgia, serif", weight: 700, style: 'normal' },
  { id: 'nemoy',     label: 'Squadrato', css: "'Nemoy', 'Arial Black', sans-serif", weight: 700, style: 'normal' },
  { id: 'black',     label: 'Pesante',   css: "'Arial Black', Arial, sans-serif", weight: 900, style: 'normal' },
  { id: 'serif',     label: 'Classico',  css: "Georgia, 'Times New Roman', serif", weight: 700, style: 'normal' }
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
  { id: 'sleeves', label: 'Solo maniche' },
  { id: 'front',   label: 'Solo busto davanti' },
  { id: 'back',    label: 'Solo busto dietro' }
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

// Spalle colorate sul busto (davanti e dietro)
export const SHOULDER_SHAPES = [
  { id: 'none',   label: 'Nessuna' },
  { id: 'raglan', label: 'Raglan (diagonale)' },
  { id: 'yoke',   label: 'Sella (fascia alta)' }
];

// Cuciture delle maniche: due modelli 3D diversi (vedi MODELS)
export const SLEEVE_CUTS = [
  { id: 'setin',  label: 'Cucitura spalle' },
  { id: 'raglan', label: 'Cucitura raglan' }
];

export const SLEEVE_STRIPES_MAX = 7;
export const SLEEVE_DECO = [
  { id: 'none',     label: 'Nessuna' },
  { id: 'stripes',  label: 'Strisce' },
  { id: 'shoulder', label: 'Spalla colorata' },
  { id: 'band',     label: 'Fascia sul braccio' },
  { id: 'chevrons', label: 'Chevron' },
  { id: 'side',     label: 'Bande laterali' }
];

export function defaultKit() {
  return {
    collarShape: 'v', sleeveCut: 'setin', collar: 'plain', cuffs: 'band', sleeveDeco: 'none', sleeveDecoN: 3, sleeveDecoShoulder: false,
    sleeveTf: { x: 0, y: 0, scale: 100, rot: 0 },
    colors: { base: '#1e5bb8', sleeves: '#1e5bb8', sleevesR: '', shoulders: '#ffffff', collar: '#ffffff', cuffs: '#ffffff', trim: '#ffffff' },
    shoulders: { shape: 'none', size: 100, match: true },
    layers: [],
    brand: { id: 'nike', color: '#ffffff', url: '', mono: false, size: 100, x: 0, y: 0 },
    crest: { show: true, size: 100, swap: false, x: 0, y: 0 },
    sponsor: { mode: 'none', url: '', text: '', font: 'bebas', color: '#ffffff', mono: false, scale: 100, y: 0 },
    backSponsor: { mode: 'none', url: '', text: '', font: 'bebas', color: '#ffffff', mono: false, scale: 100, y: 0 },
    backPrint: { show: false, name: '', number: '10', font: 'seriea', color: '#ffffff', outline: '', nameSize: 100, numSize: 100, y: 0 },
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
    sleeveCut: SLEEVE_CUTS.some(c => c.id === k.sleeveCut) ? k.sleeveCut : d.sleeveCut,
    collar: COLLARS.some(c => c.id === k.collar) ? k.collar : d.collar,
    cuffs: CUFFS.some(c => c.id === k.cuffs) ? k.cuffs : d.cuffs,
    // tre / due strisce di prima: ora una sola decorazione "Strisce" con il numero di strisce
    sleeveDeco: /^stripes[23]$/.test(k.sleeveDeco) ? 'stripes' : SLEEVE_DECO.some(c => c.id === k.sleeveDeco) ? k.sleeveDeco : d.sleeveDeco,
    sleeveDecoN: Math.round(clamp(k.sleeveDecoN || (k.sleeveDeco === 'stripes2' ? 2 : 3), 1, SLEEVE_STRIPES_MAX)),
    sleeveDecoShoulder: !!k.sleeveDecoShoulder,
    sleeveTf: { ...d.sleeveTf, ...(k.sleeveTf || {}) },
    colors: { ...d.colors, ...(k.colors || {}) },
    shoulders: { ...d.shoulders, ...(k.shoulders || {}), shape: SHOULDER_SHAPES.some(x => x.id === (k.shoulders || {}).shape) ? k.shoulders.shape : 'none' },
    // marchi integrati tolti (adidas, puma, ...): diventano Nike
    brand: (b => ({ ...b, id: BRANDS.some(x => x.id === b.id) || String(b.id).startsWith('png:') ? b.id : 'nike' }))({ ...d.brand, ...(k.brand || {}) }),
    crest: { ...d.crest, ...(k.crest || {}) },
    sponsor: { ...d.sponsor, ...(k.sponsor || {}) },
    backSponsor: { ...d.backSponsor, ...(k.backSponsor || {}) },
    backPrint: { ...d.backPrint, ...(k.backPrint || {}) },
    layers: toArr(k.layers).map(l => ({
      type: 'stripes', color: '#ffffff', opacity: 100, scale: 100, flipX: false, flipY: false, x: 0, y: 0, rot: 0, wrap: 'repeat',
      ...l, zone: l.zone || (l.onSleeves ? 'all' : 'body')
    })),
    patches: toArr(k.patches).map(p => ({ id: p.id, name: p.name || '', src: p.src || '', pos: p.pos || 'chest' })),
    ...(k.image ? { image: k.image } : {})
  };
}

/** Etichetta di un disegno (integrato o PNG del Patron). */
export function patternLabel(type) {
  if (String(type).startsWith('png:')) return (getPngPatterns().find(p => 'png:' + p.id === type) || {}).name || 'Disegno';
  if (type === 'img') return 'La tua immagine';
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
  backName:    { part: 'back', x: .50, y: .24, w: .62, h: .075 },
  backNumber:  { part: 'back', x: .50, y: .45, w: .56, h: .27 },
  backSponsor: { part: 'back', x: .50, y: .74, w: .58, h: .14 },
  chest:   { part: 'front', x: .50, y: .30, s: .10 },
  belly:   { part: 'front', x: .50, y: .73, s: .14 },
  hem:     { part: 'front', x: .27, y: .90, s: .10 },
  sleeveL: { part: 'sleeveL', x: .50, y: .42, s: .24 },
  sleeveR: { part: 'sleeveR', x: .50, y: .42, s: .24 }
};

// Giro manica (cucitura manica-busto, parte alta) misurato sul modello 3D: [pezzo (0 davanti, 1 dietro), u, v sul busto, u sulla manica].
// Serve ad allineare le strisce della spalla a quelle della manica (sulla manica la cucitura della spalla non cade al centro).
const ARMHOLE = {
  sleeveL: [[0,.1763,.4044,.2308],[0,.1778,.4017,.2334],[0,.1790,.3988,.2361],[0,.1800,.3958,.2386],[0,.1807,.3927,.2413],[0,.1814,.3895,.2439],[0,.1819,.3863,.2464],[0,.1822,.3800,.2513],[0,.1822,.3736,.2562],[0,.1814,.3673,.2608],[0,.1807,.3612,.2654],[0,.1792,.3551,.2703],[0,.1780,.3490,.2752],[0,.1739,.3338,.2879],[0,.1722,.3280,.2935],[0,.1712,.3250,.2962],[0,.1692,.3189,.3018],[0,.1682,.3160,.3048],[0,.1673,.3131,.3077],[0,.1651,.3072,.3136],[0,.1617,.2986,.3228],[1,.8625,.2784,.3258],[1,.8615,.2816,.3289],[1,.8581,.2906,.3382],[1,.8562,.2967,.3443],[1,.8537,.3057,.3536],[1,.8520,.3121,.3595],[1,.8498,.3214,.3685],[1,.8491,.3245,.3712],[1,.8476,.3306,.3768],[1,.8469,.3338,.3797],[1,.8459,.3402,.3851],[1,.8454,.3433,.3878],[1,.8449,.3465,.3902],[1,.8440,.3529,.3954],[1,.8432,.3624,.4027],[1,.8430,.3653,.4049],[1,.8427,.3685,.4073],[1,.8425,.3748,.4122],[1,.8425,.3778,.4146],[1,.8427,.3810,.4171],[1,.8430,.3841,.4198],[1,.8432,.3873,.4222],[1,.8437,.3905,.4247],[1,.8442,.3934,.4271],[1,.8447,.3966,.4298],[1,.8454,.3998,.4322],[1,.8464,.4027,.4349],[1,.8474,.4056,.4376],[1,.8488,.4085,.4403],[1,.8501,.4112,.4427]],
  sleeveR: [[0,.4545,.4044,.5670],[0,.4530,.4017,.5697],[0,.4518,.3988,.5724],[0,.4508,.3958,.5749],[0,.4498,.3927,.5775],[0,.4493,.3895,.5800],[0,.4486,.3832,.5851],[0,.4484,.3800,.5875],[0,.4486,.3736,.5924],[0,.4491,.3673,.5971],[0,.4501,.3612,.6017],[0,.4535,.3458,.6139],[0,.4559,.3368,.6217],[0,.4586,.3280,.6296],[0,.4596,.3250,.6325],[0,.4606,.3221,.6352],[0,.4625,.3160,.6410],[0,.4635,.3131,.6440],[0,.4645,.3101,.6469],[0,.4667,.3043,.6530],[0,.4703,.2957,.6620],[1,.5429,.2816,.6652],[1,.5460,.2906,.6745],[1,.5480,.2967,.6806],[1,.5497,.3028,.6867],[1,.5521,.3121,.6957],[1,.5538,.3182,.7016],[1,.5553,.3245,.7075],[1,.5568,.3306,.7131],[1,.5577,.3370,.7187],[1,.5590,.3433,.7238],[1,.5597,.3497,.7292],[1,.5602,.3529,.7316],[1,.5612,.3624,.7387],[1,.5614,.3653,.7411],[1,.5614,.3685,.7436],[1,.5617,.3717,.7460],[1,.5617,.3748,.7485],[1,.5617,.3778,.7509],[1,.5617,.3810,.7534],[1,.5614,.3841,.7561],[1,.5612,.3873,.7585],[1,.5607,.3905,.7609],[1,.5602,.3934,.7634],[1,.5595,.3966,.7661],[1,.5587,.3998,.7685],[1,.5577,.4027,.7712],[1,.5568,.4056,.7739],[1,.5556,.4085,.7763],[1,.5541,.4112,.7790]]
};

// Col colletto alto le strisce della spalla arrivano fino a questa frazione della cucitura (oltre, la stoffa è deformata)
const POLO_STRIPE_REACH = .82;

const ASSET_BASE = 'icons/kit3d/';
export const KIT3D_FILES = {
  model: ASSET_BASE + 'shirt.glb', collarPolo: ASSET_BASE + 'collar-polo.glb', neckPolo: ASSET_BASE + 'neck-polo.bin', mask: ASSET_BASE + 'mask.png', seams: ASSET_BASE + 'seams.jpg',
  raglan: ASSET_BASE + 'shirt-raglan.glb', raglanMask: ASSET_BASE + 'mask-raglan.png', raglanSeams: ASSET_BASE + 'seams-raglan.jpg',
  collarPoloRaglan: ASSET_BASE + 'collar-polo-raglan.glb', neckCutRaglan: ASSET_BASE + 'neck-cut-raglan.bin',
  neckPoloRaglan: ASSET_BASE + 'neck-polo-raglan.bin'
};

// Maglia raglan (icons/kit3d/shirt-raglan.glb, dal progetto CLO "adidas orjinal" di akifdesign): le maniche arrivano
// fino al colletto, davanti e dietro non hanno le spalle. Pezzi nella texture alla stessa scala (0,84 px ogni mm a 1000 px),
// cartamodelli visti dal dritto: il davanti come lo si guarda, il dietro visto da dietro, le maniche con il polsino in basso.
export const UV_RAGLAN = {
  front:   { x: .0600, y: .0600, w: .3878, h: .5541 },
  back:    { x: .5300, y: .0600, w: .3881, h: .5850 },
  sleeveL: { x: .0800, y: .6700, w: .3435, h: .3054 },
  sleeveR: { x: .5300, y: .6700, w: .3435, h: .3054 },
  collar:  { x: .3320, y: .0200, w: .3361, h: .0155 }
};

// Modelli della maglia: mappa UV, maschera dei pezzi, cuciture e altezza del polsino (frazione della manica dove inizia)
export const MODELS = {
  setin:  { uv: UV, mask: KIT3D_FILES.mask, seams: KIT3D_FILES.seams, cuffTop: .84 },
  raglan: {
    uv: UV_RAGLAN, mask: KIT3D_FILES.raglanMask, seams: KIT3D_FILES.raglanSeams, cuffTop: .91,
    // il riquadro del davanti parte più in alto (angoli del colletto) e la manica comprende la spalla
    anchors: {
      crest: { ...ANCHORS.crest, y: .27 }, brand: { ...ANCHORS.brand, y: .27 }, chest: { ...ANCHORS.chest, y: .27 },
      sleeveL: { ...ANCHORS.sleeveL, y: .62 }, sleeveR: { ...ANCHORS.sleeveR, y: .62 }
    }
  }
};
export const kitModel = (k) => MODELS[k && k.sleeveCut] || MODELS.setin;

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
/** Simbolo PNG di una forma come data URL (dentro un SVG si possono usare solo immagini incorporate). */
const symbolCache = new Map();
function symbolData(url) {
  if (!symbolCache.has(url)) symbolCache.set(url, loadCleanImage(url).then(img => {
    if (!img) return '';
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, k = Math.min(1, 320 / Math.max(iw, ih, 1));
    const c = canvasOf(Math.max(1, Math.round(iw * k)), Math.max(1, Math.round(ih * k)));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    try { return c.toDataURL('image/png'); } catch (e) { return ''; }
  }));
  return symbolCache.get(url);
}
/** Il livello usa un simbolo PNG con i suoi colori (non va colorato col colore del livello). */
const keepsColors = (l) => l.type === 'm-shape' && l.shape === 'png' && !!l.symUrl && l.symMono === false;

function builtinPattern(layer, part, w, h) {
  const p = PATTERNS.find(x => x.id === layer.type);
  if (!p) return Promise.resolve(null);
  const s = clamp(layer.scale, 30, 250) / 100;
  const tx = clamp(layer.x || 0, -50, 50), ty = clamp(layer.y || 0, -50, 50), rot = clamp(layer.rot || 0, -180, 180);
  const m = p.motif ? motifParams(layer) : null;
  const key = [layer.type, s, !!layer.flipX, !!layer.flipY, tx, ty, rot, part, w, h, m ? JSON.stringify(m) : ''].join('|');
  if (rasterCache.has(key)) return rasterCache.get(key);
  // il busto (davanti/dietro) corrisponde a x 100..300, y 20..400 della vista frontale;
  // le maniche a una porzione con la stessa densità
  // 'whole': davanti e dietro affiancati come un unico pezzo (x 100..500), il disegno continua dal davanti al dietro
  const vb = part === 'whole' ? [100, 20, 400, 380] : part === 'front' || part === 'back' ? [100, 20, 200, 380] : [100, 20, 159, 103];
  const sx = layer.flipX ? -1 : 1, sy = layer.flipY ? -1 : 1;
  const tf = (sx < 0 || sy < 0) ? `transform="translate(${sx < 0 ? W : 0},${sy < 0 ? H : 0}) scale(${sx},${sy})"` : '';
  // spostamento (in % del pezzo, positivo = a destra / in alto) e rotazione attorno al centro del pezzo
  const cx = part === 'whole' ? 200 : vb[0] + vb[2] / 2, cy = vb[1] + vb[3] / 2; // 'whole': si sposta/ruota attorno al centro del davanti
  const pw = part === 'whole' ? vb[2] / 2 : vb[2];
  const move = (tx || ty || rot) ? `transform="translate(${cx + tx / 100 * pw},${cy - ty / 100 * vb[3]}) rotate(${rot}) translate(${-cx},${-cy})"` : '';
  const needSym = m && m.shape === 'png' && m.symUrl;
  const job = (needSym ? symbolData(m.symUrl) : Promise.resolve('')).then(symData => {
  if (m) m.symData = symData;
  let art;
  if (p.tile && (move || part === 'whole')) {
    // motivo ripetuto: lo disegno su un'area tre volte più grande, così spostato o ruotato copre sempre tutto il pezzo
    const w0 = W, h0 = H;
    W = w0 * 3; H = h0 * 3;
    try { art = `<g transform="translate(${-w0},${-h0})">${p.draw('#ffffff', s, 'p' + rasterCache.size)}</g>`; } finally { W = w0; H = h0; }
  } else {
    art = p.draw('#ffffff', s, 'p' + rasterCache.size, m);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="${vb.join(' ')}" preserveAspectRatio="none"><g ${move}><g ${tf}>${art}</g></g></svg>`;
  return loadCleanImage(svgUrl(svg));
  });
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

/** Aspetta il font (se è un font web) prima di scriverci sul canvas. */
async function ensureFont(ft, px) {
  if (!document.fonts || !document.fonts.load) return;
  try { await document.fonts.load(`${ft.style} ${ft.weight} ${Math.round(px)}px ${ft.css}`); } catch (e) { /* uso il ripiego */ }
}

/** Scritta centrata in (cx, cy) che sta in bw × bh (si rimpicciolisce se è troppo larga). */
async function drawFitText(ctx, txt, ft, color, cx, cy, bw, bh, { outline = '', spacing = 0 } = {}) {
  let px = bh;
  await ensureFont(ft, px);
  const setFont = () => { ctx.font = `${ft.style} ${ft.weight} ${px}px ${ft.css}`; if ('letterSpacing' in ctx) ctx.letterSpacing = `${(px * spacing).toFixed(1)}px`; };
  setFont();
  const mw = ctx.measureText(txt).width;
  if (mw > bw) { px *= bw / mw; setFont(); }
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  if (outline) { ctx.strokeStyle = safeColor(outline); ctx.lineWidth = px * .09; ctx.strokeText(txt, cx, cy); }
  ctx.fillStyle = safeColor(color);
  ctx.fillText(txt, cx, cy);
  ctx.restore();
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

/** Sponsor (immagine PNG o scritta) nel riquadro A del pezzo r. */
async function drawSponsor(ctx, sp, A, r) {
  if (!sp || sp.mode === 'none') return;
  const f = clamp(sp.scale, 40, 160) / 100;
  const bw = A.w * r.w * f, bh = A.h * r.h * f;
  const cx = r.x + A.x * r.w, cy = r.y + (A.y + clamp(sp.y, -60, 80) / 400) * r.h;
  if (sp.mode === 'image' && sp.url) {
    const img0 = await loadCleanImage(sp.url);
    if (img0) drawContain(ctx, sp.mono ? tint(img0, safeColor(sp.color), img0.naturalWidth, img0.naturalHeight) : img0, cx, cy, bw, bh);
  } else if (sp.mode === 'text' && String(sp.text || '').trim()) {
    const ft = SPONSOR_FONTS.find(x => x.id === sp.font) || SPONSOR_FONTS[0];
    await drawFitText(ctx, String(sp.text).trim().slice(0, 24), ft, sp.color, cx, cy, bw, bh * .62);
  }
}

/** Nome (in alto) e numero (sotto) sul retro della maglia. */
async function drawBackPrint(ctx, bp, r) {
  if (!bp || !bp.show) return;
  const ft = NUMBER_FONTS.find(x => x.id === bp.font) || NUMBER_FONTS[0];
  const dy = -clamp(bp.y, -50, 50) / 400 * r.h; // + = più in alto
  const name = String(bp.name || '').trim().toUpperCase().slice(0, 16);
  const num = String(bp.number || '').replace(/\D/g, '').slice(0, 2);
  if (name) {
    const A = ANCHORS.backName, f = clamp(bp.nameSize, 60, 150) / 100;
    await drawFitText(ctx, name, ft, bp.color, r.x + A.x * r.w, r.y + A.y * r.h + dy, A.w * r.w * f, A.h * r.h * f, { outline: bp.outline, spacing: .06 });
  }
  if (num) {
    const A = ANCHORS.backNumber, f = clamp(bp.numSize, 60, 150) / 100;
    await drawFitText(ctx, num, ft, bp.color, r.x + A.x * r.w, r.y + A.y * r.h + dy, A.w * r.w * f, A.h * r.h * f, { outline: bp.outline });
  }
}

/* --------------------------------------------- maschera e scollo del modello */
const maskJobs = new Map();
/** Maschera dei pezzi + profilo superiore di davanti/dietro (per il bordino del colletto), per ogni modello. */
function loadMask(model) {
  if (maskJobs.has(model)) return maskJobs.get(model);
  const UV = model.uv;
  const maskJob = loadCleanImage(model.mask).then(img => {
    if (!img) return null;
    const c = canvasOf(img.naturalWidth, img.naturalHeight);
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    // per davanti e dietro: bordo superiore della sagoma tra le due "spalle" più alte = scollo
    const neck = {}, shoulder = {};
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
      // spalle: bordo superiore dall'attaccatura della manica (esterno) all'angolo del colletto
      const first = top.findIndex(t => t >= 0), last = n - 1 - [...top].reverse().findIndex(t => t >= 0);
      // cucitura della spalla: retta che approssima il bordo superiore (minimi quadrati sulla parte centrale,
      // escluse la curva del colletto e quella della manica), dall'esterno fino all'angolo del colletto
      const pts = (a, b) => {
        const lo = a + Math.round((b - a) * .12), hi = b - Math.round((b - a) * .12);
        let n0 = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
        for (let i = lo; i <= hi; i++) if (top[i] >= 0) { n0++; sx += i; sy += top[i]; sxx += i * i; sxy += i * top[i]; }
        if (n0 < 2) return [];
        const m = (n0 * sxy - sx * sy) / (n0 * sxx - sx * sx || 1), q = (sy - m * sx) / n0;
        return [a, b].map(i => [(x0 + i + .5) / c.width, (m * i + q) / c.height]);
      };
      // profilo vero del bordo superiore, ammorbidito (media mobile), per seguire la spalla da vicino
      const prof = [];
      for (let i = first; i <= last; i++) {
        let sum = 0, cnt = 0;
        for (let j = Math.max(first, i - 5); j <= Math.min(last, i + 5); j++) if (top[j] >= 0) { sum += top[j]; cnt++; }
        if (cnt) prof.push([(x0 + i + .5) / c.width, sum / cnt / c.height]);
      }
      shoulder[part] = { left: pts(first, l), right: pts(rr, last), neckL: l / n, neckR: rr / n, prof };
    });
    return { img, neck, shoulder };
  });
  maskJobs.set(model, maskJob);
  return maskJob;
}

/* --------------------------------------------------------- composizione */
/**
 * Dipinge la texture UV della maglia. Restituisce un canvas size×size (default 2048).
 * opts: { crestUrl, size, plain (senza loghi) }
 */
export async function paintKitTexture(rawKit, opts = {}) {
  const k = normalizeKit(rawKit);
  if (k.collarShape === 'polo') k.collar = 'plain'; // il colletto alto è in tinta unita: niente rifiniture sotto
  const S = Math.round(opts.size || 2048);
  const model = kitModel(k), raglan = model === MODELS.raglan;
  const R = (part) => { const r = model.uv[part]; return { x: r.x * S, y: r.y * S, w: r.w * S, h: r.h * S }; };
  const mask = await loadMask(model);
  const seams = await loadCleanImage(model.seams);

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
  const sleeveColor = (p) => safeColor(p === 'sleeveR' && c.sleevesR ? c.sleevesR : c.sleeves);
  ['sleeveL', 'sleeveR'].forEach(p => inPart(p, fill(sleeveColor(p))));

  // 2. disegni (livelli)
  const pngPatterns = getPngPatterns();
  for (const l of k.layers) {
    const parts = l.zone === 'sleeves' ? ['sleeveL', 'sleeveR'] : l.zone === 'all' ? ['front', 'back', 'sleeveL', 'sleeveR']
      : l.zone === 'front' ? ['front'] : l.zone === 'back' ? ['back'] : ['front', 'back'];
    const alpha = clamp(l.opacity, 0, 100) / 100;
    // come si stende sui pezzi: 'whole' davanti e dietro come un unico pezzo, 'repeat' uguale su ogni pezzo,
    // 'mirror' dietro e manica destra specchiati
    // su un solo pezzo (solo davanti / solo dietro) il disegno si stende semplicemente su quel pezzo
    const wrap = l.zone === 'front' || l.zone === 'back' ? 'repeat' : l.wrap === 'whole' || l.wrap === 'mirror' ? l.wrap : 'repeat';
    const isBody = (p) => p === 'front' || p === 'back';
    const mirrored = (p) => wrap === 'mirror' && (p === 'back' || p === 'sleeveR');
    const F = R('front'), wW = Math.round(F.w * 2), wH = Math.round(F.h);
    // disegna l'immagine del pezzo: src = porzione [sx, 0, sw, sh] dell'immagine (per 'whole' metà di quella unica)
    const put = (x, r, img, sx, sw, sh, flip) => {
      x.save(); x.globalAlpha = alpha;
      if (flip) { x.translate(r.x + r.w, r.y); x.scale(-1, 1); x.drawImage(img, sx, 0, sw, sh, 0, 0, r.w, r.h); }
      else x.drawImage(img, sx, 0, sw, sh, r.x, r.y, r.w, r.h);
      x.restore();
    };
    const own = l.type === 'img'; // PNG caricato dal giocatore
    if (String(l.type).startsWith('png:') || own) {
      const pp = own ? { url: l.url, mode: 'panel' } : pngPatterns.find(x => 'png:' + x.id === l.type);
      const img = await loadCleanImage(pp && pp.url);
      if (!img) continue;
      if (pp.mode === 'uv') {
        // grafica disegnata sulla mappa UV completa: la applico così com'è (o colorata) sui pezzi scelti
        const src = pp.colors === 'original' ? img : tint(img, safeColor(l.color), S, S);
        // disegnata sulla mappa della maglia classica: sulla raglan ogni pezzo si porta nel suo riquadro
        const sw = (src.naturalWidth || src.width) / S, shh = (src.naturalHeight || src.height) / S;
        parts.forEach(p => inPart(p, (x, r) => {
          x.globalAlpha = alpha;
          if (!raglan) { x.drawImage(src, 0, 0, S, S); return; }
          const o = UV[p];
          x.drawImage(src, o.x * S * sw, o.y * S * shh, o.w * S * sw, o.h * S * shh, r.x, r.y, r.w, r.h);
        }));
      } else {
        const s = clamp(l.scale, 30, 250) / 100;
        // PNG disegnato (spostato, ruotato, ingrandito) su una tela w×h
        const panel = (w, h) => {
          const c2 = document.createElement('canvas'); c2.width = Math.max(1, Math.round(w)); c2.height = Math.max(1, Math.round(h));
          const x = c2.getContext('2d');
          x.translate(w / 2 + clamp(l.x || 0, -50, 50) / 100 * w, h / 2 - clamp(l.y || 0, -50, 50) / 100 * h);
          x.rotate(clamp(l.rot || 0, -180, 180) * Math.PI / 180);
          x.scale((l.flipX ? -1 : 1) * s, (l.flipY ? -1 : 1) * s);
          if (own) {
            // la tua immagine: riempie il pezzo senza deformarsi (colori originali o tinta unica)
            const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, f = Math.max(w / iw, h / ih);
            x.drawImage(l.mono ? tint(img, safeColor(l.color), iw, ih) : img, -iw * f / 2, -ih * f / 2, iw * f, ih * f);
          } else x.drawImage(tint(img, safeColor(l.color), w, h), -w / 2, -h / 2, w, h);
          return c2;
        };
        const whole = wrap === 'whole' && parts.some(isBody) ? panel(wW, wH) : null;
        parts.forEach(p => inPart(p, (x, r) => {
          if (whole && isBody(p)) put(x, r, whole, p === 'front' ? 0 : wW / 2, wW / 2, wH, false);
          else { const c2 = panel(r.w, r.h); put(x, r, c2, 0, c2.width, c2.height, mirrored(p)); }
        }));
      }
      continue;
    }
    let whole = null;
    if (wrap === 'whole' && parts.some(isBody)) {
      const img = await builtinPattern(l, 'whole', wW, wH);
      if (img) whole = keepsColors(l) ? img : tint(img, safeColor(l.color), wW, wH);
    }
    for (const p of parts) {
      const r = R(p);
      if (whole && isBody(p)) { inPart(p, (x) => put(x, r, whole, p === 'front' ? 0 : wW / 2, wW / 2, wH, false)); continue; }
      const img = await builtinPattern(l, p.startsWith('sleeve') ? 'sleeve' : p, Math.round(r.w), Math.round(r.h));
      if (!img) continue;
      const t = keepsColors(l) ? img : tint(img, safeColor(l.color), r.w, r.h);
      inPart(p, (x) => put(x, r, t, 0, t.width, t.height, mirrored(p)));
    }
  }

  // 2b. spalle colorate (sopra il disegno del busto)
  // lato del pezzo → manica vicina: davanti sinistra = manica L, dietro sinistra = manica R (visto da dietro)
  const sideSleeve = (part, side) => (part === 'front') === (side === 'left') ? 'sleeveL' : 'sleeveR';
  const sh = k.shoulders;
  // sulla raglan le spalle sono già parte delle maniche (colore delle maniche)
  if (sh.shape !== 'none' && !raglan && mask && mask.shoulder) {
    const f = clamp(sh.size, 50, 160) / 100;
    ['front', 'back'].forEach(p => ['left', 'right'].forEach(side => inPart(p, (x, r) => {
      const m = mask.shoulder[p];
      if (!m) return;
      x.fillStyle = sh.match ? sleeveColor(sideSleeve(p, side)) : safeColor(c.shoulders);
      const dir = side === 'left' ? 1 : -1;                   // verso il centro del pezzo
      const ox = side === 'left' ? r.x - 4 : r.x + r.w + 4;   // bordo esterno
      const neckX = r.x + (side === 'left' ? m.neckL : m.neckR) * r.w;
      x.beginPath();
      if (sh.shape === 'raglan') {
        // dall'angolo del colletto scende in diagonale fino all'ascella
        const armY = r.y + r.h * .37 * f;
        x.moveTo(ox, r.y - 4);
        x.lineTo(neckX + dir * 2, r.y - 4);
        x.quadraticCurveTo(neckX - dir * (neckX - ox) * .15, r.y + (armY - r.y) * .55, ox, armY);
      } else {
        // sella: fascia alta che segue la spalla, dal colletto all'attaccatura della manica
        const pts = m[side];
        const hgt = r.h * .07 * f;
        x.moveTo(ox, r.y - 4);
        x.lineTo(neckX + dir * 2, r.y - 4);
        x.lineTo(neckX + dir * 2, r.y + hgt);
        [...pts].sort((a, b) => dir * (b[0] - a[0])).forEach(([u, v]) => x.lineTo(u * S, v * S + hgt));
        x.lineTo(ox, (pts.length ? Math.max(...pts.map(q => q[1])) * S : r.y) + hgt);
      }
      x.closePath();
      x.fill();
    })));
  }

  // 3. decorazioni delle maniche e polsini
  const trim = safeColor(c.trim);
  // strisce che partono dal colletto: proseguono sulla spalla (cucitura tra davanti e dietro) fino alla manica.
  // Per ogni striscia sulla spalla calcolo dove tocca il giro manica e sulla manica la faccio partire esattamente lì.
  const sleeveStripes = { sleeveL: [], sleeveR: [] }; // posizioni u (0..1 della texture) delle strisce sulle maniche
  // sulla raglan le strisce della manica partono già dal colletto: niente strisce sulla spalla del busto
  const stripesOnShoulder = k.sleeveDeco === 'stripes' && k.sleeveDecoShoulder && !raglan && mask && mask.shoulder;
  const fStr = clamp(k.sleeveTf.scale, 40, 200) / 100, lwStr = R('sleeveL').w * .022 * fStr, gapStr = R('sleeveL').w * .05 * fStr;
  if (stripesOnShoulder) {
    const n = k.sleeveDecoN;
    const offs = []; // distanze dalla cucitura (in px): 0 = a cavallo della cucitura
    for (let i = 0; i < n; i++) { const o = (i - (n - 1) / 2) * gapStr; if (o >= 0) offs.push(o); }
    // punto della cucitura della spalla sulla manica: dove il giro manica passa dal davanti al dietro
    const seamU = (sp) => { const t = ARMHOLE[sp], i = t.findIndex(q => q[0] === 1); return (t[i - 1][3] + t[i][3]) / 2; };
    if (offs[0] === 0) ['sleeveL', 'sleeveR'].forEach(sp => sleeveStripes[sp].push(seamU(sp)));
    ['front', 'back'].forEach(p => inPart(p, (x) => {
      const m = mask.shoulder[p];
      if (!m) return;
      x.strokeStyle = trim; x.fillStyle = trim; x.lineWidth = lwStr; x.lineCap = 'butt'; x.lineJoin = 'round';
      ['left', 'right'].forEach(side => {
        const pts = m[side];
        if (pts.length < 2) return;
        const sp = sideSleeve(p, side);
        // estremo esterno (verso la manica) e interno (colletto) della cucitura, in px
        // estremo esterno: il punto esatto in cui la cucitura della spalla incontra la manica (misurato sul modello);
        // estremo interno: l'angolo del colletto
        const B = side === 'left' ? pts[pts.length - 1] : pts[0];
        const t0 = ARMHOLE[sp], sw = t0.findIndex(q => q[0] === 1), A = p === 'front' ? t0[sw - 1] : t0[sw];
        const ax = A[1] * S, ay = A[2] * S, bx = B[0] * S, by = B[1] * S;
        const len = Math.hypot(bx - ax, by - ay) || 1;
        let dx = (bx - ax) / len, dy = (by - ay) / len;
        let nx = -dy, ny = dx; if (ny < 0) { nx = -nx; ny = -ny; } // normale verso l'interno del pezzo (in basso)
        const ext = len * .25; // oltre l'estremo esterno: la maschera ritaglia sul giro manica
        // cucitura: retta dal punto misurato sulla manica (A) all'angolo del colletto (B); le strisce le sono parallele.
        // Col colletto alto la stoffa vicino al collo è deformata (e non in modo simmetrico): lì le strisce si fermano
        const reach = k.collarShape === 'polo' ? POLO_STRIPE_REACH : 1;
        const ex = ax + (bx - ax) * reach, ey = ay + (by - ay) * reach;
        const path = (o) => [[ax - dx * ext + nx * o, ay - dy * ext + ny * o], [ex + nx * o, ey + ny * o]];
        offs.forEach(o => {
          if (o === 0) {
            // striscia centrale a cavallo della cucitura: dal bordo vero della spalla fino a metà spessore
            const lower = path(lwStr / 2), upper = path(-lwStr / 2).reverse();
            x.beginPath();
            [...lower, ...upper].forEach(([u, v], i) => (i ? x.lineTo(u, v) : x.moveTo(u, v)));
            x.closePath(); x.fill();
            return;
          }
          const sx = ax + nx * o, sy = ay + ny * o;
          x.beginPath(); path(o).forEach(([u, v], i) => (i ? x.lineTo(u, v) : x.moveTo(u, v))); x.stroke();
          // dove questa striscia incontra il giro manica (sul pezzo p) → posizione sulla manica
          const rows = ARMHOLE[sp].filter(q => q[0] === (p === 'front' ? 0 : 1));
          let best = null;
          for (let i = 0; i + 1 < rows.length; i++) {
            const [, u1, v1, s1] = rows[i], [, u2, v2, s2] = rows[i + 1];
            const p1x = u1 * S, p1y = v1 * S, p2x = u2 * S, p2y = v2 * S;
            const ex = p2x - p1x, ey = p2y - p1y, den = dx * ey - dy * ex;
            if (Math.abs(den) < 1e-9) continue;
            const t = ((p1x - sx) * ey - (p1y - sy) * ex) / den, w = ((p1x - sx) * dy - (p1y - sy) * dx) / den;
            if (w >= 0 && w <= 1 && (!best || Math.abs(t) < Math.abs(best.t))) best = { t, su: s1 + (s2 - s1) * w };
          }
          if (best) sleeveStripes[sp].push(best.su);
        });
      });
    }));
  }
  ['sleeveL', 'sleeveR'].forEach(p => inPart(p, (x, r) => {
    x.fillStyle = trim;
    const cuffTop = r.y + r.h * model.cuffTop, cb = r.y + r.h - cuffTop; // inizio e altezza del polsino
    // dimensione, posizione e rotazione della decorazione (attorno al centro della manica)
    const st = k.sleeveTf;
    // spalla colorata, fascia e bande laterali: la dimensione le allarga dal loro bordo (non le sposta fuori dalla manica);
    // le altre decorazioni si ingrandiscono attorno al centro della manica
    const grows = ['shoulder', 'band', 'side'].includes(k.sleeveDeco), f = clamp(st.scale, 40, 200) / 100;
    x.save();
    x.translate(r.x + r.w / 2 + st.x / 100 * r.w, r.y + r.h / 2 - st.y / 100 * r.h);
    x.rotate(st.rot * Math.PI / 180);
    if (!grows) x.scale(f, f);
    x.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
    switch (k.sleeveDeco) {
      case 'stripes': {
        const n = k.sleeveDecoN;
        if (stripesOnShoulder) {
          // dal colletto al polsino: ogni striscia parte dal punto del giro manica in cui arriva quella della spalla
          // (il cursore cambia solo spessore e distanza; spostamento e rotazione non si applicano)
          x.restore(); x.save();
          sleeveStripes[p].forEach(u => x.fillRect(u * S - lwStr / 2, r.y - 2, lwStr, cuffTop - r.y + 2));
          break;
        }
        const lw = r.w * .022, gap = r.w * .05;
        for (let i = 0; i < n; i++) x.fillRect(r.x + r.w / 2 + (i - (n - 1) / 2) * gap - lw / 2, r.y, lw, cuffTop - r.y);
        break;
      }
      // più larghe del pezzo: ruotate o spostate coprono sempre tutta la manica (la sagoma ritaglia il resto)
      case 'shoulder': x.fillRect(r.x - r.w, r.y - r.h, r.w * 3, r.h + r.h * .32 * f); break;
      case 'band': x.fillRect(r.x - r.w, r.y + r.h * (.63 - .05 * f), r.w * 3, r.h * .1 * f); break;
      case 'chevrons':
        x.strokeStyle = trim; x.lineWidth = r.h * .035;
        for (let i = 0; i < 3; i++) {
          const y = r.y + r.h * (.42 + i * .1);
          x.beginPath(); x.moveTo(r.x + r.w * .3, y - r.h * .08); x.lineTo(r.x + r.w / 2, y); x.lineTo(r.x + r.w * .7, y - r.h * .08); x.stroke();
        }
        break;
      case 'side': x.fillRect(r.x - r.w, r.y - r.h, r.w * (1 + .07 * f), r.h * 3); x.fillRect(r.x + r.w * (1 - .07 * f), r.y - r.h, r.w * (1 + .07 * f), r.h * 3); break;
    }
    x.restore();
    // polsino: in fondo al pezzo della manica
    const cuff = safeColor(c.cuffs);
    if (k.cuffs === 'band') { x.fillStyle = cuff; x.fillRect(r.x - 2, cuffTop, r.w + 4, r.y + r.h - cuffTop + 2); }
    if (k.cuffs === 'double') {
      x.fillStyle = cuff; x.fillRect(r.x - 2, cuffTop, r.w + 4, r.y + r.h - cuffTop + 2);
      x.fillStyle = sleeveColor(p); x.fillRect(r.x - 2, cuffTop + cb * .375, r.w + 4, cb * .19);
    }
    if (k.cuffs === 'thin') { x.fillStyle = cuff; x.fillRect(r.x - 2, cuffTop, r.w + 4, cb * .22); }
  }));
  if (k.sleeveDeco === 'side') ['front', 'back'].forEach(p => inPart(p, (x, r) => {
    const f = clamp(k.sleeveTf.scale, 40, 200) / 100;
    x.fillStyle = trim; x.fillRect(r.x, r.y, r.w * .045 * f, r.h); x.fillRect(r.x + r.w * (1 - .045 * f), r.y, r.w * .045 * f, r.h);
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
    const A0 = { ...ANCHORS, ...model.anchors };
    const at = (a) => { const r = R(a.part); return { x: r.x + a.x * r.w, y: r.y + a.y * r.h, s: (a.s || .1) * r.w, r }; };
    const moved = (a, o) => ({ ...a, x: a.x + clamp(o.x || 0, -40, 40) / 100, y: a.y - clamp(o.y || 0, -30, 30) / 100 });
    if (k.crest.show && opts.crestUrl) {
      const img = await loadCut(opts.crestUrl);
      const a = at(moved({ ...A0.crest, x: k.crest.swap ? A0.brand.x : A0.crest.x }, k.crest)), s = a.s * clamp(k.crest.size, 60, 150) / 100;
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
      const a = at(moved({ ...A0.brand, x: k.crest.swap ? A0.crest.x : A0.brand.x }, b)); // crest.swap: stemma e marchio invertiti
      const img = (b.id === 'custom' || String(b.id).startsWith('png:')) && b.mono
        ? tint(brandImg, safeColor(b.color), brandImg.naturalWidth || brandImg.width, brandImg.naturalHeight || brandImg.height) : brandImg;
      const bs = a.s * clamp(b.size || 100, 60, 150) / 100;
      drawContain(ctx, img, a.x, a.y, bs, bs * .75);
    }
    await drawSponsor(ctx, k.sponsor, A0.sponsor, R('front'));
    await drawSponsor(ctx, k.backSponsor, A0.backSponsor, R('back'));
    await drawBackPrint(ctx, k.backPrint, R('back'));
    for (const p of k.patches) {
      const A = A0[p.pos];
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
  { name: 'Tre strisce',      kit: { sleeveDeco: 'stripes', sleeveDecoN: 3, layers: [] } },
  { name: 'Bande laterali',   kit: { sleeveDeco: 'side', layers: [] } },
  { name: 'Crepe',            kit: { collar: 'crew', sleeves: 'short', cuffs: 'band', layers: [{ type: 'crackle', color: '#0d1b4c', opacity: 85, onSleeves: true }] } },
  { name: 'Tinta unita',      kit: { collar: 'crew', sleeves: 'short', cuffs: 'band', layers: [] } },
  { name: 'Strisce',          kit: { collar: 'v', sleeves: 'short', cuffs: 'band', layers: [{ type: 'm-stripe', count: 11, size: 10, gap: 10, color: '#000000' }] } },
  { name: 'Strisce larghe',   kit: { collar: 'polo', sleeves: 'short', cuffs: 'thin', layers: [{ type: 'm-stripe', count: 5, size: 20, gap: 20, color: '#ffffff' }] } },
  { name: 'Gessato',          kit: { collar: 'polobtn', sleeves: 'short', cuffs: 'none', layers: [{ type: 'm-stripe', count: 41, size: 1, gap: 6, color: '#ffffff', opacity: 70 }] } },
  { name: 'Bande',            kit: { collar: 'crew', sleeves: 'short', cuffs: 'band', layers: [{ type: 'm-stripe', dir: 'h', count: 9, size: 13, gap: 12, color: '#ffffff' }] } },
  { name: 'Metà e metà',      kit: { collar: 'v', sleeves: 'raglan', cuffs: 'band', layers: [{ type: 'half', color: '#ffffff' }] } },
  { name: 'Quarti',           kit: { collar: 'crew', sleeves: 'short', cuffs: 'thin', layers: [{ type: 'quarters', color: '#ffffff' }] } },
  { name: 'Fascia diagonale', kit: { collar: 'crew', sleeves: 'short', cuffs: 'band', layers: [{ type: 'm-stripe', count: 1, size: 34, rot: -29, color: '#ffffff' }] } },
  { name: 'Chevron',          kit: { collar: 'v', sleeves: 'short', cuffs: 'band', layers: [{ type: 'm-chevron', count: 1, size: 26, amp: 58, y: 18, color: '#ffffff' }] } },
  { name: 'Fascia petto',     kit: { collar: 'mandarin', sleeves: 'short', cuffs: 'band', layers: [{ type: 'm-stripe', dir: 'h', count: 1, size: 22, y: 11, color: '#ffffff' }] } },
  { name: 'Croce',            kit: { collar: 'crew', sleeves: 'long', cuffs: 'band', layers: [{ type: 'cross', color: '#ffffff' }] } },
  { name: 'Scacchi',          kit: { collar: 'crew', sleeves: 'short', cuffs: 'band', layers: [{ type: 'm-checker', count: 6, color: '#ffffff' }] } },
  { name: 'Onde',             kit: { collar: 'v', sleeves: 'short', cuffs: 'band', layers: [{ type: 'waves', color: '#7a1f1f' }, { type: 'swoosh', color: '#ffffff', opacity: 90 }] } },
  { name: 'Fulmine',          kit: { collar: 'deepv', sleeves: 'short', cuffs: 'thin', layers: [{ type: 'm-shape', shape: 'bolt', count: 1, size: 100, color: '#ffd400' }] } },
  { name: 'Sfumato',          kit: { collar: 'crew', sleeves: 'short', cuffs: 'band', layers: [{ type: 'gradient', color: '#000000', opacity: 80, onSleeves: true }] } },
  { name: 'Retino',           kit: { collar: 'v', sleeves: 'short', cuffs: 'band', layers: [{ type: 'halftone', color: '#ffffff', opacity: 60 }] } },
  { name: 'Geometrico',       kit: { collar: 'wrap', sleeves: 'short', cuffs: 'band', layers: [{ type: 'shards', color: '#ffffff', opacity: 35 }, { type: 'm-stripe', count: 1, size: 9, color: '#000000', opacity: 40 }] } },
  { name: 'Mimetico',         kit: { collar: 'crew', sleeves: 'short', cuffs: 'band', layers: [{ type: 'camo', color: '#000000', opacity: 25, onSleeves: true }] } },
  { name: 'Esagoni',          kit: { collar: 'v', sleeves: 'short', cuffs: 'band', layers: [{ type: 'm-shape', shape: 'hexagon', fill: 'line', count: 100, size: 12, gap: 0, stagger: true, color: '#ffffff', opacity: 35, onSleeves: true }] } },
  { name: 'Pannelli',         kit: { collar: 'crew', sleeves: 'short', cuffs: 'band', layers: [{ type: 'sidePanels', color: '#000000', opacity: 70 }] } },
  { name: 'Fiamme',           kit: { collar: 'crew', sleeves: 'short', cuffs: 'band', layers: [{ type: 'flames', color: '#ff7a00' }] } },
  { name: 'Spalle',           kit: { collar: 'henley', sleeves: 'raglan', cuffs: 'band', layers: [{ type: 'yoke', color: '#ffffff' }] } }
];
