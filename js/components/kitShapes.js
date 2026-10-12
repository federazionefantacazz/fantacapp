/**
 * Forme del colletto della maglia 3D.
 * - 'v':    scollo a V del modello originale.
 * - 'polo': colletto alto in tinta unita (icons/kit3d/collar-polo.glb, preso dal modello "Adidas Retro Jersey Mold"
 *           di akifdesign): colletto e strisce lungo la V, già posizionati sulla maglia e non deformati.
 *           Ai lati e dietro il collo della maglia prende la forma dell'attaccatura della maglia retrò,
 *           così il colletto è cucito al bordo senza spazi vuoti; davanti la V resta quella originale.
 * Misure in metri, coordinate del modello (y in alto, z verso chi guarda, collo centrato in x = 0).
 */
export const COLLAR_SHAPES = [
  { id: 'v',    label: 'Scollo a V' },
  { id: 'polo', label: 'Colletto alto' }
];

/** true se la forma richiede una variante del modello (maglia deformata e colletto aggiunto). */
export const isDeformed = (shape) => shape === 'polo';

const ZC = -0.004;          // centro del collo (z)
const FALLOFF = 0.07;       // fin dove scende sulla maglia il cambio di forma del collo
const FRONT = 22;           // davanti (sotto i 22° circa) la V resta quella originale: la coprono le strisce del colletto
const TUCK_Y = -0.003; // la stoffa sale 3 mm dentro il piede del colletto (il colletto è disegnato davanti: vedi Kit3D)
// bordo della stoffa della maglia al collo (cucitura della costina, che col colletto alto si nasconde), per angolo attorno
// al collo: [gradi (0 = davanti, 180 = dietro), y, raggio]
const SHIRT_NECK = [[0, 1.5198, .0759], [10, 1.5252, .0749], [20, 1.5317, .0753], [30, 1.539, .076], [40, 1.5466, .0771],
  [50, 1.5544, .0784], [60, 1.5612, .0792], [70, 1.5679, .0806], [80, 1.5778, .0837], [90, 1.5858, .0868], [100, 1.5969, .0918],
  [110, 1.6064, .0964], [120, 1.6093, .0977], [130, 1.609, .0969], [140, 1.6079, .0942], [150, 1.6054, .0879], [160, 1.6037, .0829],
  [170, 1.6025, .079], [180, 1.6021, .077]];
// attaccatura del colletto nella maglia retrò (già spostata come collar-polo.glb)
const RETRO_NECK = [[0, 1.5052, .0887], [10, 1.5082, .0905], [20, 1.547, .0753], [30, 1.5702, .0707], [40, 1.5713, .0694],
  [50, 1.5749, .0717], [60, 1.5812, .075], [70, 1.5902, .0786], [80, 1.5984, .0812], [90, 1.6093, .0843], [100, 1.6169, .0856],
  [110, 1.6206, .0843], [120, 1.6213, .0822], [130, 1.6211, .0794], [140, 1.6201, .0738], [150, 1.619, .068], [160, 1.6183, .0633],
  [170, 1.618, .0613], [180, 1.6176, .0599]];

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** Valore della colonna k di una tabella [gradi, ...] all'angolo deg (0..180, interpolato). */
function at(tbl, deg, k) {
  const d = Math.min(180, Math.abs(deg));
  let i = 1;
  while (i < tbl.length - 1 && tbl[i][0] < d) i++;
  const a = tbl[i - 1], b = tbl[i], t = (d - a[0]) / (b[0] - a[0]);
  return a[k] + (b[k] - a[k]) * t;
}

/**
 * Deforma un punto della maglia (coordinate del modello) per la forma di colletto indicata. p = [x, y, z], modificato.
 * 'polo': il bordo del collo va sull'attaccatura della maglia retrò; l'effetto si attenua scendendo sulla maglia,
 * allontanandosi dal collo e verso il davanti (la V non cambia).
 */
export function deformPoint(shape, p) {
  if (shape !== 'polo') return p;
  const [x, y, z] = p;
  const th = Math.atan2(x, z - ZC), deg = Math.abs(th) * 180 / Math.PI, r = Math.hypot(x, z - ZC);
  const yE = at(SHIRT_NECK, deg, 1), rE = at(SHIRT_NECK, deg, 2);
  const w = smooth(1 - (yE - y) / FALLOFF) * smooth(1 - (r - rE - 0.02) / 0.06) * smooth((deg - FRONT) / 22);
  if (w <= 0) return p;
  const r2 = r + (at(RETRO_NECK, deg, 2) - rE) * w;
  p[0] = Math.sin(th) * r2;
  p[1] = y + (at(RETRO_NECK, deg, 1) - TUCK_Y - yE) * w;
  p[2] = ZC + Math.cos(th) * r2;
  return p;
}
