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
const FOLD_DROP = 0.85;      // quanto scende il risvolto sulle spalle per ogni metro di distanza dal piede del colletto
const COLLAR_GAP = 0.006;   // il piede del colletto resta appena fuori dalla fascia del collo (non la attraversa)
const CREST = 0.012;        // fascia sotto il bordo alto del colletto che resta rigida (bordo liscio e simmetrico)
// raggio dell'apertura del collo della maglia per angolo (0 = davanti, 180 = dietro)
const SHIRT_R = [[0, .067], [30, .066], [50, .066], [60, .069], [70, .068], [80, .070], [90, .076], [100, .079], [110, .083],
  [120, .085], [130, .083], [140, .082], [150, .077], [160, .073], [170, .070], [180, .070]];
// raggio interno del piede del colletto (collar-polo.glb) per angolo
const COLLAR_R = [[0, .061], [30, .059], [50, .060], [60, .061], [70, .062], [80, .060], [90, .060], [100, .059], [110, .060],
  [120, .062], [130, .064], [140, .067], [150, .069], [160, .069], [170, .068], [180, .067]];

const BIN = 5, NB = 360 / BIN;
const binOf = (deg) => ((Math.round(deg / BIN) % NB) + NB) % NB;
/** Valore a un angolo qualsiasi da una tabella a passi di BIN gradi (interpolata, giro chiuso). */
function atAngle(arr, deg) {
  const f = (((deg / BIN) % NB) + NB) % NB, i = Math.floor(f), t = f - i;
  return arr[i % NB] * (1 - t) + arr[(i + 1) % NB] * t;
}
/** Media simmetrica (destra/sinistra) e ammorbidita sugli angoli vicini. */
function symmetric(arr) {
  return arr.map((_, b) => {
    let s = 0;
    for (let j = -2; j <= 2; j++) s += (arr[(b + j + NB) % NB] + arr[(NB - b - j + NB) % NB]) / 2;
    return s / 5;
  });
}

/**
 * Colletto alto sullo scollo a V. points = vertici del colletto ([x, y, z], coordinate del modello), modificati.
 * - Il bordo alto diventa liscio e uguale a destra e a sinistra (il file originale è un po' storto).
 * - Ai lati e dietro il colletto si allarga fino all'apertura del collo della maglia (niente spazio vuoto tra i due)
 *   e il risvolto scende sulle spalle, più spioventi di quelle della polo.
 * - Davanti scende (e viene un po' avanti, come il petto) di quanto la V scende sotto il collo tondo per cui il colletto
 *   è stato modellato, così le alette arrivano alla punta della V.
 */
export function fitCollarToV(points) {
  // bordo alto del colletto per angolo (con i vuoti riempiti dal vicino) e la sua versione liscia e simmetrica
  const top = new Array(NB).fill(-Infinity);
  const polar = points.map(([x, y, z]) => {
    const deg = Math.atan2(x, z - ZC) * 180 / Math.PI, b = binOf(deg);
    if (y > top[b]) top[b] = y;
    return { deg, r: Math.hypot(x, z - ZC) };
  });
  for (let pass = 0; pass < NB && top.some(v => !isFinite(v)); pass++) {
    top.forEach((v, b) => { if (!isFinite(v)) top[b] = isFinite(top[(b + NB - 1) % NB]) ? top[(b + NB - 1) % NB] : top[(b + 1) % NB]; });
  }
  const topGoal = symmetric(top);

  points.forEach((p, i) => {
    const { deg, r } = polar[i];
    const ad = Math.abs(deg);
    // bordo alto liscio e simmetrico: sposto la fascia alta del colletto sulla curva media
    // (solo dietro e ai lati: davanti le alette hanno già la loro forma)
    const crestY = atAngle(top, deg);
    const wc = smooth(1 - (crestY - p[1]) / CREST) * smooth((ad - 75) / 30);
    p[1] += wc * (atAngle(topGoal, deg) - crestY);
    // allargamento ai lati e dietro
    const w = smooth((ad - 40) / 30);
    const k = 1 + w * Math.max(0, (interp(SHIRT_R, ad) + COLLAR_GAP) / interp(COLLAR_R, ad) - 1);
    p[0] *= k;
    p[2] = ZC + (p[2] - ZC) * k;
    // risvolto sulle spalle: più è lontano dal piede del colletto, più scende (il bordo alto resta dov'è)
    const out = r - interp(COLLAR_R, ad) - 0.004;
    if (w > 0 && out > 0) p[1] -= w * (1 - wc) * FOLD_DROP * out;
    // davanti: segue la V
    if (ad >= 90) return;
    const xn = NECK_X * Math.sin(ad * Math.PI / 180);
    const d = COLLAR_FILE_NECK(xn) - interp(V_EDGE, xn);
    if (d <= 0) return;
    p[1] -= d;
    p[2] += 0.45 * d;
  });
  return points;
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
