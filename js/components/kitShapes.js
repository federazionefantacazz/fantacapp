/**
 * Forme del colletto della maglia 3D.
 * - 'v':    scollo a V del modello originale.
 * - 'polo': colletto alto, tinta unita (icons/kit3d/collar-polo.glb, preso dal modello "t-shirt-polo" di Sketchfab),
 *           sullo scollo a V: davanti le alette del colletto scendono lungo i bordi della V fino alla punta
 *           (come le maglie retrò con colletto). La maglia non viene deformata.
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

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

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

// scollo davanti per ogni forma che deforma la maglia (y dell'attaccatura in funzione di x)
const NECK = {};

/** true se la forma richiede una variante del modello (maglia deformata o colletto aggiunto). */
export const isDeformed = (shape) => shape === 'polo' || !!NECK[shape];

// collo tondo su cui è stato posizionato il file del colletto (collar-polo.glb)
const COLLAR_FILE_NECK = (x) => NECK_SIDE_Y - 0.014 * Math.sqrt(Math.max(0, 1 - (x / NECK_X) ** 2));
const ZC = -0.004;          // centro del collo (z)
// raggio dell'apertura del collo della maglia e raggio interno del piede del colletto, per angolo (0 = davanti, 180 = dietro)
const FOLD_DROP = 0.85;
const SHIRT_R = [[0, .067], [30, .066], [50, .066], [60, .069], [70, .068], [80, .070], [90, .076], [100, .079], [110, .083],
  [120, .085], [130, .083], [140, .082], [150, .077], [160, .073], [170, .070], [180, .070]];
const COLLAR_R = [[0, .061], [30, .059], [50, .060], [60, .061], [70, .062], [80, .060], [90, .060], [100, .059], [110, .060],
  [120, .062], [130, .064], [140, .067], [150, .069], [160, .069], [170, .068], [180, .067]];

/**
 * Colletto alto sullo scollo a V: sposta in basso (e un po' in avanti, come il petto) la parte davanti del colletto,
 * di quanto la V scende sotto il collo tondo per cui il colletto è stato modellato. Lo spostamento dipende
 * dall'angolo attorno al collo, così piede e risvolto del colletto si muovono insieme. p = [x, y, z].
 */
export function fitCollarToV(p) {
  const [x, , z] = p;
  const th = Math.atan2(x, z - ZC);                  // 0 davanti, ±π dietro
  // ai lati e dietro allarga il colletto fino all'apertura del collo della maglia (niente spazio vuoto tra i due)
  const deg = Math.abs(th) * 180 / Math.PI;
  const w = smooth((deg - 40) / 30);
  if (w > 0) {
    const k = 1 + w * Math.max(0, (interp(SHIRT_R, deg) + 0.002) / interp(COLLAR_R, deg) - 1);
    p[0] = x * k;
    p[2] = ZC + (z - ZC) * k;
    // il risvolto scende sulle spalle (che qui sono più spioventi di quelle della polo): più è lontano dal collo, più si abbassa
    const out = Math.hypot(x, z - ZC) - interp(COLLAR_R, deg) - 0.004;
    if (out > 0) p[1] -= w * FOLD_DROP * out;
  }
  if (Math.abs(th) >= Math.PI / 2) return p;
  const xn = NECK_X * Math.sin(Math.abs(th));        // punto del bordo del collo a quell'angolo
  const d = COLLAR_FILE_NECK(xn) - interp(V_EDGE, xn);
  if (d <= 0) return p;
  p[1] -= d;
  p[2] += 0.45 * d;
  return p;
}

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
