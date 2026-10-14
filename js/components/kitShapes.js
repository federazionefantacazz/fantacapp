/**
 * Forme del colletto della maglia 3D.
 * - 'v':    scollo a V del modello originale.
 * - 'polo': colletto alto in tinta unita (icons/kit3d/collar-polo.glb, preso dal modello "Adidas Retro Jersey Mold"
 *           di akifdesign): colletto e strisce lungo la V, già posizionati sulla maglia e non deformati.
 *           La costina dello scollo a V si nasconde e il bordo della stoffa viene portato sulla cucitura del colletto
 *           della maglia retrò (spostamenti dei vertici in icons/kit3d/neck-polo.bin, vedi Kit3D.js).
 */
export const COLLAR_SHAPES = [
  { id: 'v',    label: 'Scollo a V' },
  { id: 'polo', label: 'Colletto alto' }
];

/** true se la forma richiede una variante del modello (maglia modificata e colletto aggiunto). */
export const isDeformed = (shape) => shape === 'polo';
