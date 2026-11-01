/**
 * Forme del colletto della maglia 3D.
 * - 'crew': girocollo. Raglan: quello del modello. Classica: la costina a V prende la forma della costina del girocollo
 *           della raglan (stessa larghezza del collo e stessa altezza, tutto intorno) e la stoffa di davanti e di dietro
 *           arriva fino al nuovo bordo (spostamenti in icons/kit3d/neck-crew-setin.bin).
 * - 'v':    scollo a V (solo classica, quello del modello).
 * - 'polo': colletto alto in tinta unita (icons/kit3d/collar-polo.glb, preso dal modello "Adidas Retro Jersey Mold"
 *           di akifdesign): colletto e strisce lungo la V, già posizionati sulla maglia e non deformati.
 *           La costina dello scollo a V si nasconde e il bordo della stoffa viene portato sulla cucitura del colletto
 *           della maglia retrò (spostamenti dei vertici in icons/kit3d/neck-polo.bin, vedi Kit3D.js).
 */
export const COLLAR_SHAPES = [
  { id: 'crew', label: 'Girocollo' },
  { id: 'v',    label: 'Scollo a V', setinOnly: true },
  { id: 'polo', label: 'Colletto alto' }
];

/** true se la forma richiede una variante del modello (maglia modificata e/o colletto aggiunto). */
export const isDeformed = (shape, raglan = false) => shape === 'polo' || (shape === 'crew' && !raglan);
