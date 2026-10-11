/**
 * Forme del colletto per la maglia 3D. Il modello ha lo scollo a V: le altre forme si ottengono
 * deformando la geometria vicino al collo (davanti) e, per i colli alti, allungando la fascia del colletto.
 * Misure in metri, coordinate del modello (y in alto, z verso chi guarda, collo centrato in x = 0).
 */
export const COLLAR_SHAPES = [
  { id: 'v',        label: 'Scollo a V' },
  { id: 'deepv',    label: 'V profondo' },
  { id: 'crew',     label: 'Girocollo' },
  { id: 'scoop',    label: 'Girocollo ampio' },
  { id: 'henley',   label: 'Serafino' },
  { id: 'mandarin', label: 'Coreana' },
  { id: 'high',     label: 'Collo alto' }
];

const NECK_X = 0.09;        // mezza larghezza del collo
const NECK_SIDE_Y = 1.578;  // altezza del bordo del colletto ai lati del collo
// bordo inferiore del colletto (attaccatura) sul davanti del modello originale, per |x|
const V_EDGE = [[0, 1.518], [0.015, 1.522], [0.03, 1.529], [0.045, 1.536], [0.06, 1.547], [0.075, 1.559], [0.09, 1.578]];
// attaccatura del colletto dietro, per |x|
const BACK_EDGE = [[0, 1.602], [0.045, 1.604], [0.06, 1.606], [0.075, 1.59], [0.09, 1.58]];
const FALLOFF = 0.09;       // quanto in basso arriva la deformazione sul petto

function interp(tbl, ax) {
  if (ax <= tbl[0][0]) return tbl[0][1];
  for (let i = 1; i < tbl.length; i++) {
    if (ax <= tbl[i][0]) {
      const [x0, y0] = tbl[i - 1], [x1, y1] = tbl[i];
      return y0 + (y1 - y0) * (ax - x0) / (x1 - x0);
    }
  }
  return tbl[tbl.length - 1][1];
}

const round = (depth) => (x) => NECK_SIDE_Y - depth * Math.sqrt(Math.max(0, 1 - (x / NECK_X) ** 2));
const SHAPES = {
  deepv:    { neck: (x) => NECK_SIDE_Y - 0.10 * (1 - Math.min(1, Math.abs(x) / NECK_X)) },
  crew:     { neck: round(0.022) },
  scoop:    { neck: round(0.042) },
  henley:   { neck: round(0.022) },
  mandarin: { neck: round(0.02), band: 2.1 },
  high:     { neck: round(0.016), band: 3.2 }
};

/** true se la forma richiede di modificare la geometria. */
export const isDeformed = (shape) => !!SHAPES[shape];

const smooth = (t) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);

/**
 * Deforma un punto (coordinate del modello) del pezzo indicato: 'front' (davanti) o 'collar' (fascia del colletto).
 * p = [x, y, z], modificato e restituito.
 */
export function deformPoint(shape, part, p) {
  const s = SHAPES[shape];
  if (!s) return p;
  const [x, y, z] = p;
  const ax = Math.abs(x);
  if (ax >= NECK_X) return p;
  const edge = interp(V_EDGE, ax);
  const dy = s.neck(x) - edge;            // di quanto si sposta l'attaccatura del colletto davanti
  if (part === 'front') {
    if (z <= 0) return p;
    const w = smooth(1 - (edge - y) / FALLOFF);
    if (w <= 0) return p;
    p[1] = y + dy * w;
    p[2] = z - 0.45 * dy * w;             // salendo il petto rientra verso il collo
    return p;
  }
  if (part === 'collar') {
    let base;
    if (z > 0) {
      p[1] = y + dy; p[2] = z - 0.45 * dy;
      base = s.neck(x);
    } else {
      base = interp(BACK_EDGE, ax);
    }
    if (s.band) {
      // colletto più alto: allungo la fascia verso l'alto e la stringo un po' verso il collo
      const h = p[1] - base;
      if (h > 0) {
        const nh = h * s.band;
        p[1] = base + nh;
        const t = Math.min(1, nh / 0.05);
        p[0] *= 1 - 0.08 * t;
        p[2] = -0.004 + (p[2] + 0.004) * (1 - 0.1 * t);
      }
    }
    return p;
  }
  return p;
}
