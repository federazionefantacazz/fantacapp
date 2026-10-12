/**
 * Forme del colletto della maglia 3D.
 * - 'v':    scollo a V del modello originale.
 * - 'polo': colletto alto (polo) (icons/kit3d/collar-polo.glb, preso dal modello "t-shirt-polo" di Sketchfab),
 *           con lo scollo a V chiuso in un collo tondo su cui il colletto si appoggia.
 * Misure in metri, coordinate del modello (y in alto, z verso chi guarda, collo centrato in x = 0).
 */
export const COLLAR_SHAPES = [
  { id: 'v',    label: 'Scollo a V' },
  { id: 'polo', label: 'Colletto alto' }
];

const NECK_X = 0.09;        // mezza larghezza del collo
const NECK_SIDE_Y = 1.578;  // altezza del bordo del colletto ai lati del collo
// bordo inferiore del colletto (attaccatura) sul davanti del modello originale, per |x|
const V_EDGE = [[0, 1.518], [0.015, 1.522], [0.03, 1.529], [0.045, 1.536], [0.06, 1.547], [0.075, 1.559], [0.09, 1.578]];
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

// scollo davanti per ogni forma (y dell'attaccatura in funzione di x)
const NECK = {
  polo: (x) => NECK_SIDE_Y - 0.014 * Math.sqrt(Math.max(0, 1 - (x / NECK_X) ** 2))
};

/** true se la forma richiede di modificare la geometria della maglia. */
export const isDeformed = (shape) => !!NECK[shape];

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/**
 * Deforma un punto (coordinate del modello) del pezzo indicato: 'front' (davanti) o 'collar' (fascia del colletto).
 * p = [x, y, z], modificato e restituito.
 */
export function deformPoint(shape, part, p) {
  const neck = NECK[shape];
  if (!neck) return p;
  const [x, y, z] = p;
  const ax = Math.abs(x);
  if (ax >= NECK_X || z <= 0) return p;
  const edge = interp(V_EDGE, ax);
  const dy = neck(x) - edge;              // di quanto sale l'attaccatura del colletto davanti
  const w = part === 'collar' ? 1 : smooth(1 - (edge - y) / FALLOFF);
  if (w <= 0) return p;
  p[1] = y + dy * w;
  p[2] = z - 0.45 * dy * w;               // salendo il petto rientra verso il collo
  return p;
}
