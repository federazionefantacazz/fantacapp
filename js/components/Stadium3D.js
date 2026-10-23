/**
 * Stadio 3D (three.js, in vendor/three), costruito tutto via codice: nessun modello da scaricare.
 * C'è solo l'interno: campo, pista d'atletica, spalti da 1 a 3 anelli e seggiolini (l'esterno non si disegna).
 *
 * - createStadiumViewer(container, { zoom }): stadio ruotabile col dito (editor).
 * - renderStadiumImage(stadium, opts): foto PNG (data URL) dello stadio, per il salvataggio.
 * - stadiumCapacity(stadium): numero di seggiolini (capienza).
 * - normalizeStadium / defaultStadium: dati dello stadio (team.stadium).
 * Misure in metri; il campo è al centro, lato lungo sull'asse x.
 */
import { getCutout } from '../services/imageCutout.js';

let lib = null;
function loadLib() {
  if (!lib) {
    lib = Promise.all([
      import('../../vendor/three/three.module.min.js'),
      import('../../vendor/three/OrbitControls.js'),
      import('../../vendor/three/RoomEnvironment.js')
    ]).then(([THREE, o, r]) => ({ THREE, OrbitControls: o.OrbitControls, RoomEnvironment: r.RoomEnvironment }));
  }
  return lib;
}

/* ------------------------------------------------------------------ dati */
export const MAX_NAME = 40;
export const MAX_CAPACITY = 200000;
export const MAX_STAND_TEXT = 16;
export const MAX_OUTER_TEXT = 24;

export const RINGS = [
  { id: 1, label: '1 anello' },
  { id: 2, label: '2 anelli' },
  { id: 3, label: '3 anelli' }
];
export const SHAPES = [
  { id: 'rect',    label: 'Squadrate' },
  { id: 'soft',    label: 'Squadrate smussate' },
  { id: 'rounded', label: 'Angoli arrotondati' },
  { id: 'oval',    label: 'Curve a semicerchio' }
];
export const CORNERS = [
  { id: 'closed', label: 'Attaccate' },
  { id: 'open',   label: 'Staccate' }
];
export const MOWING = [
  { id: 'stripes', label: 'Strisce' },
  { id: 'checks',  label: 'Scacchi' },
  { id: 'plain',   label: 'Uniforme' }
];
export const SEAT_MODES = [
  { id: 'single',  label: 'Tinta unita' },
  { id: 'sectors', label: 'Tribune e curve' },
  { id: 'rings',   label: 'Un colore per anello' },
  { id: 'sides',   label: 'Un colore per lato' },
  { id: 'grid',    label: 'Ogni settore e anello' }
];
/** Effetto mosaico, scelto prima e valido con ogni colorazione. */
export const MOSAICS = [
  { id: 'none',   label: 'Nessuno' },
  { id: 'shades', label: 'Sfumature dello stesso colore' },
  { id: 'mix',    label: 'Altri due colori sparsi' }
];
export const OUTER_STYLES = [
  { id: 'outline', label: 'Lettere con contorno' },
  { id: 'panel',   label: 'Insegna con fondo' },
  { id: 'lit',     label: 'Luminosa' },
  { id: 'plain',   label: 'Solo lettere' }
];
export const TEXT_SIZES = [
  { id: 'S',  label: 'Piccola',    k: 0.7 },
  { id: 'M',  label: 'Media',      k: 1 },
  { id: 'L',  label: 'Grande',     k: 1.35 },
  { id: 'XL', label: 'Grandissima', k: 1.75 }
];
/** Lati degli spalti (come nelle info dei seggiolini): 0 tribuna vicina, 1 curva destra, 2 tribuna di fronte, 3 curva sinistra. */
export const SEAT_SIDES = [
  { id: 0, label: 'Tribuna vicina' },
  { id: 2, label: 'Tribuna di fronte' },
  { id: 3, label: 'Curva sinistra' },
  { id: 1, label: 'Curva destra' }
];
export const TEXT_SIDES = [
  { id: 'far',   side: 2, label: 'Tribuna di fronte' },
  { id: 'near',  side: 0, label: 'Tribuna vicina' },
  { id: 'left',  side: 3, label: 'Curva sinistra' },
  { id: 'right', side: 1, label: 'Curva destra' }
];
/** Coperture che di notte si accendono con un colore a scelta (colors.roofLight, vuoto = questo colore). */
export const ROOF_GLOWS = { wave: '#7d858e', crown: '#b4bcc2', blades: '#ffe2b8', dome: '#aeb6be' };

/** Pavimento intorno al campo (tra il campo e gli spalti, anche dentro la pista). */
export const APRON_STYLES = [
  { id: 'grass',    label: 'Prato' },
  { id: 'tartan',   label: 'Gomma come la pista' },
  { id: 'color',    label: 'Resina colorata' },
  { id: 'concrete', label: 'Cemento' }
];
/** Pavimento fuori dallo stadio (piazzale). */
export const GROUND_STYLES = [
  { id: 'concrete', label: 'Lastre di cemento' },
  { id: 'tiles',    label: 'Piastrelle' },
  { id: 'cobbles',  label: 'Sampietrini' },
  { id: 'asphalt',  label: 'Asfalto' },
  { id: 'grass',    label: 'Prato' }
];
/** Cartelloni LED: a bordo campo e, volendo, anche sul fronte degli anelli più alti. */
export const AD_BOARDS = [
  { id: 'none',  label: 'Nessuno' },
  { id: 'pitch', label: 'A bordo campo' },
  { id: 'both',  label: 'Bordo campo e anelli' }
];

/** Texture del muro esterno (muro liscio, pilastri, spianata): tinte col colore del muro. */
export const WALL_TEXTURES = [
  { id: 'plain',    label: 'Intonaco' },
  { id: 'concrete', label: 'Cemento a pannelli' },
  { id: 'brick',    label: 'Mattoni' },
  { id: 'stone',    label: 'Pietra a blocchi' },
  { id: 'metal',    label: 'Lamiera grecata' },
  { id: 'louvres',  label: 'Lamelle' },
  { id: 'windows',  label: 'Finestre a nastro' },
  { id: 'arches',   label: 'Archi' }
];
/** Muri esterni su cui si vede la texture. */
export const WALL_TEX_FACADES = ['wall', 'columns', 'esplanade'];
export const SHELL_PATTERNS = [
  { id: 'rhombus', label: 'Rombi' },
  { id: 'hex',     label: 'Esagoni' },
  { id: 'scales',  label: 'Squame' },
  { id: 'stripes', label: 'Fasce' },
  { id: 'plain',   label: 'Liscio' }
];
/** Caratteri delle scritte: i font locali sono in fonts/fonts.css (gli stessi della divisa), gli altri sono di sistema. */
export const TEXT_FONTS = [
  { id: 'black',     label: 'Pesante',     css: "'Arial Black', Arial, sans-serif", weight: 900, style: 'normal' },
  { id: 'seriea',    label: 'Serie A',     css: "'Seri EA', 'Bebas Neue', Impact, sans-serif", weight: 400, style: 'normal' },
  { id: 'champions', label: 'Champions',   css: "'Champions', 'Bebas Neue', Impact, sans-serif", weight: 700, style: 'normal' },
  { id: 'bebas',     label: 'Moderno',     css: "'Bebas Neue', Impact, sans-serif", weight: 400, style: 'normal' },
  { id: 'nemoy',     label: 'Squadrato',   css: "'Nemoy', 'Arial Black', sans-serif", weight: 700, style: 'normal' },
  { id: 'pirates',   label: 'Futuristico', css: "'Pirates of Cydonia', 'Arial Black', sans-serif", weight: 400, style: 'normal' },
  { id: 'sport',     label: 'Sportivo',    css: "'Arial Black', Arial, sans-serif", weight: 900, style: 'italic' },
  { id: 'novarese',  label: 'Elegante',    css: "'Novarese', Georgia, serif", weight: 700, style: 'normal' },
  { id: 'serif',     label: 'Classico',    css: "Georgia, 'Times New Roman', serif", weight: 700, style: 'normal' },
  { id: 'script',    label: 'Corsivo',     css: "'Brush Script MT', 'Segoe Script', cursive", weight: 700, style: 'italic' }
];
const fontOf = (id) => TEXT_FONTS.find(f => f.id === id) || TEXT_FONTS[0];
const fontCss = (ft, px) => `${ft.style} ${ft.weight} ${Math.round(px)}px ${ft.css}`;

/** Aspetta i font delle scritte (se sono font web) prima di disegnarle sulle tele. */
async function loadTextFonts(st) {
  if (typeof document === 'undefined' || !document.fonts || !document.fonts.load) return;
  const ids = [st.standText && st.standTextFont, st.outerText && st.outerTextFont].filter(Boolean);
  try { await Promise.all(ids.map(id => document.fonts.load(fontCss(fontOf(id), 100), 'AZ'))); } catch (e) { /* uso il ripiego */ }
}

export const SCREENS = [
  { id: 'none', label: 'Nessuno' },
  { id: 'ring', label: 'Anello a 360°' },
  { id: 'ends', label: 'Sopra le curve' }
];
export const ROOFS = [
  { id: 'none',     label: 'Nessuna' },
  { id: 'truss',    label: 'Reticolare in acciaio' },
  { id: 'membrane', label: 'Moderna' },
  { id: 'girders',  label: 'Travi rosse su torri' },
  { id: 'shell',    label: 'Involucro a cuscini' },
  { id: 'wave',     label: 'Ondulata a sella' },
  { id: 'stands',   label: 'Tetti separati per tribuna' },
  { id: 'dome',     label: 'Cupola a raggiera' },
  { id: 'tent',     label: 'Tenda con pennoni' },
  { id: 'petals',   label: 'Petali' },
  { id: 'dragon',   label: 'Drago a pannelli solari' },
  { id: 'crown',    label: 'Corona di vele piegate' },
  { id: 'blades',   label: 'Lame d\'acciaio (Bernabéu)' }
];
/** Coperture che avvolgono tutto lo stadio con un'unica superficie (si estendono sempre tutto intorno). */
export const WRAP_ROOFS = ['shell', 'wave', 'dome', 'tent', 'petals', 'crown', 'blades'];
const SHELLISH = ['shell', 'tent', 'petals'];
export const ROOF_COVERS = [
  { id: 'all',     label: 'Tutto unito' },
  { id: 'sectors', label: 'Staccata per settore' },
  { id: 'main',    label: 'Solo la tribuna principale' },
  { id: 'stands',  label: 'Entrambe le tribune' },
  { id: 'ends',    label: 'Solo le curve' },
  { id: 'pick',    label: 'Scegli i settori' }
];
export const ROOF_REACHES = [
  { id: 'open',   label: 'Molto aperta', m: -8 },
  { id: 'less',   label: 'Aperta',       m: -4 },
  { id: 'normal', label: 'Normale',      m: 0 },
  { id: 'more',   label: 'Coperta',      m: 6 },
  { id: 'max',    label: 'Quasi chiusa', m: 13 }
];
/** Metri in più verso il campo (positivi) o verso fuori (negativi) del bordo interno della copertura. */
const reachOf_ = (st) => (ROOF_REACHES.find(r => r.id === st.roofReach) || ROOF_REACHES[2]).m;
export const LIGHTS = [
  { id: 'roof',   label: 'Sul bordo del tetto' },
  { id: 'towers', label: 'Quattro torri faro' },
  { id: 'none',   label: 'Nessuno' }
];
export const FACADES = [
  { id: 'wall',    label: 'Muro liscio' },
  { id: 'columns', label: 'Pilastri' },
  { id: 'struts',  label: 'Struttura a vista e basamento' },
  { id: 'bands',   label: 'Fasce orizzontali' },
  { id: 'esplanade', label: 'Spianata rialzata' },
  { id: 'glass',   label: 'Vetrate scure' },
  { id: 'panels',  label: 'Rivestimento a pannelli' },
  { id: 'cladding', label: 'Inglese con ingresso' }
];
/** Ingressi monumentali fuori dallo stadio (al centro dei lati scelti). */
export const ENTRANCES = [
  { id: 'none',   label: 'Nessuno' },
  { id: 'portal', label: 'Portale vetrato' },
  { id: 'arch',   label: 'Arco monumentale' },
  { id: 'canopy', label: 'Pensilina a sbalzo' },
  { id: 'towers', label: 'Torri gemelle' }
];
export const ENTRANCE_W = [14, 44], ENTRANCE_H = [8, 24]; // larghezza e altezza (m) dei cursori
export const ENTRANCE_LOGO = [60, 150];                      // grandezza del logo sopra l'ingresso (% della misura normale)
export const ENTRANCE_FITS = [
  { id: 'fill', label: 'Riempie il pannello' },
  { id: 'fit',  label: 'Intera' }
];

/** Dove mettere il logo della squadra (anche più posti insieme). */
export const LOGO_PLACES = [
  { id: 'entrance', label: 'Sull\'ingresso' },
  { id: 'roof',     label: 'Sul tetto delle tribune' },
  { id: 'facade',   label: 'Fuori, sulle curve' },
  { id: 'pitch',    label: 'Al centro del campo' }
];
export const TEXT_PLACES = [
  { id: 'facade', label: 'Sulla facciata' },
  { id: 'roof',   label: 'Sul fronte del tetto' }
];

const DEFAULT = {
  name: '', rings: 2, ringsEnds: 0, ringsSides: [0, 0, 0, 0], horseshoe: false, vomitories: false, standGap: 0, endGap: 0, rake: 100, rakeEach: false, rakeSides: [100, 100, 100, 100], cornerGap: 18, apronStyle: 'grass', groundStyle: 'concrete', adBoards: 'none', track: false, shape: 'rounded', corners: 'closed', mowing: 'stripes', seatMode: 'single',
  roof: 'none', roofCover: 'all', roofSectors: [true, false, false, false], roofReach: 'normal', lights: 'towers', facade: 'wall', ramps: false, boxes: false, shellPattern: 'rhombus', domeTeeth: true, screen: 'none',
  seatMosaic: 'none', standText: '', standTextSide: 'far', standTextRing: 1, standTextFont: 'black',
  outerText: '', outerTextFont: 'black', outerTextStyle: 'outline', outerTextSize: 'M', outerTextPlace: 'facade', logoPlaces: [], wallTexture: 'concrete',
  entrance: 'none', entranceSides: [true, false, false, false], entranceWidth: 26, entranceHeight: 14, entranceLogo: 100, entranceImage: '', entranceImageFit: 'fill',
  colors: {
    grass: '#3d8b37', track: '#b4452f', seatA: '#1e5bb8', seatB: '#ffffff', seatC: '#c62828', seatD: '#ffd400', parapet: '#e6e6e6', structure: '#a5a5a5',
    roof: '#cfd4da', steel: '#767d86', accent: '#1e5bb8', girder: '#c0392b', glow: '#e30613',
    standText: '#ffffff', outerText: '#1d3f8f', outerPanel: '#ffffff', screen: '#152c78', trackLines: '#ffffff',
    mosaicB: '#ffffff', mosaicC: '#9e9e9e', aisle: '#c4c7cb', apron: '#b24f3c', wall: '', ground: '', ads: '#c8102e', mosaicD: '', roofLight: '', entrance: '#1e5bb8', entranceStone: '#e9e4da', cladding: '#e9ecef', podium: '#d8c7a0'
  }
};

/** Chiave del colore di un settore in seatGrid: lato (0-3) e anello (0-2). */
export const gridKey = (side, ring) => `${side}-${ring}`;

/**
 * Colori per settore e anello che riproducono la colorazione attuale (per partire da lì quando si sceglie
 * "Ogni settore e anello").
 */
export function seatGridFrom(st) {
  const c = st.colors, pal = [c.seatA, c.seatB, c.seatC, c.seatD], out = {};
  for (let side = 0; side < 4; side++) {
    for (let ring = 0; ring < 3; ring++) {
      const k = { sectors: side % 2, rings: ring, sides: side, grid: -1 }[st.seatMode] ?? 0; // tinta unita: colore A
      out[gridKey(side, ring)] = k < 0 ? (st.seatGrid || {})[gridKey(side, ring)] || pal[side] : pal[k];
    }
  }
  return out;
}

/** Stili rapidi: cambiano struttura, copertura e colori (il nome resta). */
export const PRESETS = [
  {
    id: 'maradona', label: 'Stile Maradona',
    desc: 'Ovale con la pista blu (anche dietro le porte), due anelli a mosaico azzurro, blu, bianco e giallo, cartelloni LED a bordo campo e tra gli anelli, tetto in lamiera con i tralicci e le batterie di fari, schermi sulle curve, cemento a vista e basamento bianco.',
    st: {
      rings: 2, track: true, apronStyle: 'tartan', groundStyle: 'concrete', adBoards: 'both', screen: 'ends', shape: 'oval', corners: 'closed', mowing: 'stripes',
      seatMode: 'single', seatMosaic: 'mix', roof: 'truss', lights: 'roof', facade: 'struts',
      colors: {
        grass: '#3f8a35', track: '#2a63c8', trackLines: '#eef3fb', seatA: '#2b9ae8', mosaicB: '#1b4fc0', mosaicC: '#f4f6f8', mosaicD: '#f2cc2c',
        parapet: '#e7eaee', structure: '#b3b1ab', roof: '#9da3a9', steel: '#6c7178', accent: '#1f6fd1', ads: '#d0122d', screen: '#0d2a7a'
      }
    }
  },
  {
    id: 'sansiro', label: 'Stile San Siro',
    desc: 'Tre anelli con angoli arrotondati e un colore per lato (blu, arancio, verde, rosso), tetto chiaro a botti sotto il reticolo di travi rosse che poggia sulle quattro torri d\'angolo, rampe a spirale, fasce orizzontali, cartelloni LED e schermi sulle curve.',
    st: {
      rings: 3, track: false, shape: 'rounded', corners: 'closed', mowing: 'stripes', seatMode: 'sides', seatMosaic: 'shades', roof: 'girders', lights: 'roof', facade: 'bands', ramps: true,
      adBoards: 'both', screen: 'ends', apronStyle: 'grass', groundStyle: 'concrete',
      colors: {
        grass: '#2f8a3a', seatA: '#1f4fa8', seatB: '#e4702a', seatC: '#1f7f4f', seatD: '#c81e32', parapet: '#ebe8e2', structure: '#bdb9b0', ads: '#1f4fa8',
        roof: '#dfe2e5', steel: '#2b2f34', girder: '#c0392b'
      }
    }
  },
  {
    id: 'allianz', label: 'Stile Allianz Arena',
    desc: 'Tre anelli ripidi di seggiolini rossi dentro un involucro bianco a cuscini che di notte si illumina, sopra una spianata rialzata.',
    st: {
      rings: 3, track: false, shape: 'rounded', corners: 'closed', mowing: 'stripes', seatMode: 'single', roof: 'shell', lights: 'roof', facade: 'esplanade', ramps: false,
      colors: {
        grass: '#2e8b3a', seatA: '#c8102e', parapet: '#9ea3a9', structure: '#8e939a', roof: '#f4f6f8', steel: '#8a9099', glow: '#e30613'
      }
    }
  },
  {
    id: 'velodrome', label: 'Stile Vélodrome',
    desc: 'Due anelli di seggiolini bianchi con i vomitori scuri e le scalette grigie, cartelloni azzurri a bordo campo; copertura bianca quasi tonda a cuscini radiali, alta sopra le curve, con le travi d\'acciaio sotto; fuori la fascia bianca che sui lati scende quasi a terra, sulle curve i piani in cemento a vista e su una curva l\'ingresso principale con la vetrata a lamelle e gli schermi.',
    st: {
      rings: 2, track: false, shape: 'rounded', corners: 'closed', mowing: 'checks', seatMode: 'single', seatMosaic: 'shades', roof: 'wave', lights: 'roof', facade: 'glass', ramps: false, screen: 'ends',
      vomitories: true, adBoards: 'pitch',
      colors: {
        grass: '#3a9a3e', seatA: '#eef1f4', parapet: '#dfe3e8', structure: '#cdc8bd', roof: '#f5f7f9', steel: '#6f777f', screen: '#13285e',
        aisle: '#80878f', ads: '#2a8fd6'
      }
    }
  },
  {
    id: 'kaohsiung', label: 'Stile Kaohsiung (drago)',
    desc: 'Spalti a ferro di cavallo, pista azzurra con il fondo rosso; nastro largo di pannelli solari a scaglie retto da grandi tubi bianchi a spirale che salgono da terra, che alle estremità scende a terra e continua fuori con la coda del drago.',
    st: {
      rings: 2, ringsEnds: 0, horseshoe: true, track: true, apronStyle: 'color', shape: 'oval', corners: 'closed', mowing: 'stripes', seatMode: 'sectors', seatMosaic: 'shades',
      roof: 'dragon', roofCover: 'all', roofReach: 'normal', lights: 'roof', facade: 'wall', ramps: false, boxes: false, screen: 'ends',
      colors: {
        grass: '#3f8f3a', track: '#6fb3e6', trackLines: '#ffffff', apron: '#b24f3c', seatA: '#2f6fd1', seatB: '#2e9b5e', parapet: '#e8eaec',
        structure: '#d6ccb9', roof: '#3f5f96', steel: '#f2f4f6', screen: '#101b33'
      }
    }
  },
  {
    id: 'foshan', label: 'Stile Foshan (corona di vele)',
    desc: 'Ovale con pista rossa e fondo verde, anello basso rosso e alto grigio-blu; corona quasi tonda di vele bianche piegate a zig-zag tra due anelli di tubi bianchi, su colonne a lama inclinate, con la passerella sotto il tetto.',
    st: {
      rings: 2, ringsEnds: 0, track: true, apronStyle: 'color', shape: 'oval', corners: 'closed', mowing: 'stripes', seatMode: 'rings', seatMosaic: 'none',
      roof: 'crown', roofReach: 'more', lights: 'roof', facade: 'columns', ramps: false, boxes: false, screen: 'ends',
      colors: {
        grass: '#4a8f3c', track: '#9e4634', trackLines: '#ffffff', apron: '#2d6b4f', seatA: '#c63a2e', seatB: '#3c4757', parapet: '#eceef0',
        structure: '#dcd9d2', roof: '#f6f7f8', steel: '#f3f4f5', screen: '#14181f'
      }
    }
  },
  {
    id: 'english', label: 'Stile inglese (Stamford Bridge)',
    desc: 'Quattro tribune squadrate vicine al campo con gli angoli chiusi e smussati e palchi vetrati tra gli anelli; ogni tribuna ha il suo tetto scuro con le travi bianche sopra e la fascia chiara davanti, piloni blu agli angoli con i tiranti, facciata bianca a fasce sopra un basamento color sabbia con manifesti, tornelli, torri d\'angolo e l\'ingresso principale vetrato, luci blu di notte.',
    st: {
      rings: 3, ringsEnds: 2, track: false, shape: 'soft', corners: 'closed', mowing: 'stripes', seatMode: 'single', seatMosaic: 'none', roof: 'stands', roofCover: 'all', roofReach: 'normal', lights: 'roof', facade: 'cladding', ramps: false, boxes: true, screen: 'none',
      colors: {
        grass: '#3d9a43', seatA: '#1d4fb8', parapet: '#1c3f94', structure: '#a4abb5', roof: '#4f565f', girder: '#eef1f4', steel: '#1f5fc4',
        accent: '#1d4fb8', cladding: '#e9ecef', podium: '#d8c7a0', glow: '#2b6bff', aisle: '#f2c200'
      }
    }
  },
  {
    id: 'bernabeu', label: 'Stile Bernabéu',
    desc: 'Tre anelli di seggiolini blu in una pianta quasi quadrata; facciata di grandi lame d\'acciaio orizzontali con il bordo ondulato sopra il basamento vetrato, tetto a lame concentriche, travi bianche sotto e maxischermo a 360°. Di notte la facciata si illumina.',
    st: {
      rings: 3, ringsEnds: 0, track: false, shape: 'soft', corners: 'closed', mowing: 'stripes', seatMode: 'single', seatMosaic: 'shades',
      roof: 'blades', roofReach: 'normal', lights: 'roof', facade: 'wall', ramps: false, boxes: true, screen: 'ring',
      colors: {
        grass: '#3f8f3c', seatA: '#24418f', parapet: '#1d2846', structure: '#5c6168', roof: '#cfd3d8', steel: '#eef0f2', screen: '#0d2a7a', aisle: '#2b3654'
      }
    }
  },
  {
    id: 'comunale', label: 'Comunale',
    desc: 'Un anello con curve staccate, pista d\'atletica e quattro torri faro.',
    st: {
      rings: 1, track: true, shape: 'oval', corners: 'open', mowing: 'plain', seatMode: 'sectors', roof: 'none', lights: 'towers', facade: 'wall',
      colors: { grass: '#4a8f3c', track: '#b4452f', seatA: '#1e5bb8', seatB: '#ffd400', parapet: '#e6e6e6', structure: '#a5a5a5', steel: '#8a9099' }
    }
  }
];

/** Stadio con lo stile rapido applicato: nome, capienza, scritte (e foto) restano quelli di `st`. */
export function applyPreset(st, id) {
  const p = PRESETS.find(x => x.id === id);
  if (!p) return normalizeStadium(st);
  const base = defaultStadium(), c = st.colors || {};
  return normalizeStadium({
    ...base, ...p.st, colors: { ...base.colors, ...p.st.colors, standText: c.standText, outerText: c.outerText, outerPanel: c.outerPanel },
    name: st.name, capacityCustom: st.capacityCustom, image: st.image, capacity: st.capacity,
    standText: st.standText, standTextSide: st.standTextSide, standTextRing: st.standTextRing, standTextFont: st.standTextFont,
    outerText: st.outerText, outerTextFont: st.outerTextFont, outerTextStyle: st.outerTextStyle, outerTextSize: st.outerTextSize, outerTextPlace: st.outerTextPlace, seatGrid: st.seatGrid,
    logoPlaces: st.logoPlaces
  });
}

export function defaultStadium() { return JSON.parse(JSON.stringify(DEFAULT)); }

const validColor = (c, def) => (/^#[0-9a-f]{6}$/i.test(String(c || '')) ? String(c).toLowerCase() : def);
const oneOf = (list, v, def) => (list.some(o => o.id === v) ? v : def);

/** Stadio con tutti i campi validi (quelli mancanti o sbagliati tornano ai valori predefiniti). */
export function normalizeStadium(s) {
  const src = s && typeof s === 'object' ? s : {};
  const c = { ...(src.colors || {}) };
  // stadi salvati prima: "Mosaico a 3 colori" era una colorazione, ora è tinta unita + effetto mosaico con due colori sparsi
  let seatMode = src.seatMode, seatMosaic = src.seatMosaic === true ? 'shades' : src.seatMosaic;
  if (seatMode === 'mosaic') {
    seatMode = 'single'; seatMosaic = 'mix';
    if (!c.mosaicB) c.mosaicB = c.seatB;
    if (!c.mosaicC) c.mosaicC = c.seatC;
  }
  const out = {
    name: String(src.name || '').slice(0, MAX_NAME),
    rings: oneOf(RINGS, Number(src.rings), DEFAULT.rings),
    ringsEnds: [1, 2, 3].includes(Number(src.ringsEnds)) ? Number(src.ringsEnds) : 0, // 0 = come le tribune
    // anelli di un solo settore (per lato, come SEAT_SIDES): 0 = come tribune o curve
    ringsSides: [0, 1, 2, 3].map(i => ([1, 2, 3].includes(Number((src.ringsSides || [])[i])) ? Number(src.ringsSides[i]) : 0)),
    horseshoe: !!src.horseshoe,
    vomitories: !!src.vomitories,
    // spalti: metri in più tra il campo e le tribune / le curve, pendenza (100 = normale) e apertura agli angoli
    standGap: Math.round(Math.min(STAND_GAP_MAX, Math.max(0, Number(src.standGap) || 0))),
    endGap: Math.round(Math.min(STAND_GAP_MAX, Math.max(0, Number(src.endGap) || 0))),
    rake: Math.round(Math.min(RAKE_MAX, Math.max(RAKE_MIN, Number(src.rake) || 100))),
    rakeEach: !!src.rakeEach,
    rakeSides: [0, 1, 2, 3].map(i => Math.round(Math.min(RAKE_MAX, Math.max(RAKE_MIN, Number((src.rakeSides || [])[i]) || Number(src.rake) || 100)))),
    cornerGap: Math.round(Math.min(CORNER_GAP_MAX, Math.max(CORNER_GAP_MIN, Number(src.cornerGap) || 18))),
    // stadi salvati prima: "fondo colorato intorno alla pista" (trackApron) = resina colorata
    apronStyle: oneOf(APRON_STYLES, src.apronStyle, src.trackApron ? 'color' : DEFAULT.apronStyle),
    groundStyle: oneOf(GROUND_STYLES, src.groundStyle, DEFAULT.groundStyle),
    adBoards: oneOf(AD_BOARDS, src.adBoards, DEFAULT.adBoards),
    track: !!src.track,
    shape: oneOf(SHAPES, src.shape, DEFAULT.shape),
    corners: oneOf(CORNERS, src.corners, DEFAULT.corners),
    mowing: oneOf(MOWING, src.mowing, DEFAULT.mowing),
    seatMode: oneOf(SEAT_MODES, seatMode, DEFAULT.seatMode),
    roof: oneOf(ROOFS, src.roof, DEFAULT.roof),
    roofCover: oneOf(ROOF_COVERS, src.roofCover, DEFAULT.roofCover),
    // "Scegli i settori": quali lati hanno la copertura (per lato, come SEAT_SIDES)
    roofSectors: Array.isArray(src.roofSectors) || (src.roofSectors && typeof src.roofSectors === 'object')
      ? [0, 1, 2, 3].map(i => !!src.roofSectors[i]) : [...DEFAULT.roofSectors],
    roofReach: oneOf(ROOF_REACHES, src.roofReach, DEFAULT.roofReach),
    lights: oneOf(LIGHTS, src.lights, DEFAULT.lights),
    facade: oneOf(FACADES, src.facade, DEFAULT.facade),
    wallTexture: oneOf(WALL_TEXTURES, src.wallTexture, DEFAULT.wallTexture),
    entrance: oneOf(ENTRANCES, src.entrance, DEFAULT.entrance),
    entranceSides: Array.isArray(src.entranceSides) || (src.entranceSides && typeof src.entranceSides === 'object')
      ? [0, 1, 2, 3].map(i => !!src.entranceSides[i]) : [...DEFAULT.entranceSides],
    entranceWidth: Math.round(Math.min(ENTRANCE_W[1], Math.max(ENTRANCE_W[0], Number(src.entranceWidth) || DEFAULT.entranceWidth))),
    entranceHeight: Math.round(Math.min(ENTRANCE_H[1], Math.max(ENTRANCE_H[0], Number(src.entranceHeight) || DEFAULT.entranceHeight))),
    entranceLogo: Math.round(Math.min(ENTRANCE_LOGO[1], Math.max(ENTRANCE_LOGO[0], Number(src.entranceLogo) || DEFAULT.entranceLogo))),
    // immagine personale sui pannelli dell'ingresso (indirizzo dell'immagine caricata, o anteprima locale)
    entranceImage: /^(https?:|data:image\/)/.test(String(src.entranceImage || '')) ? String(src.entranceImage) : '',
    entranceImageFit: oneOf(ENTRANCE_FITS, src.entranceImageFit, DEFAULT.entranceImageFit),
    ramps: !!src.ramps,
    boxes: !!src.boxes,
    shellPattern: oneOf(SHELL_PATTERNS, src.shellPattern, DEFAULT.shellPattern),
    domeTeeth: src.domeTeeth === undefined ? DEFAULT.domeTeeth : !!src.domeTeeth,
    screen: oneOf(SCREENS, src.screen, DEFAULT.screen),
    seatMosaic: oneOf(MOSAICS, seatMosaic, DEFAULT.seatMosaic),
    standText: String(src.standText || '').slice(0, MAX_STAND_TEXT),
    standTextSide: oneOf(TEXT_SIDES, src.standTextSide, DEFAULT.standTextSide),
    standTextRing: [0, 1, 2, 3].includes(Number(src.standTextRing)) ? Number(src.standTextRing) : DEFAULT.standTextRing, // 0 = tutti gli anelli
    standTextFont: oneOf(TEXT_FONTS, src.standTextFont, DEFAULT.standTextFont),
    outerText: String(src.outerText || '').slice(0, MAX_OUTER_TEXT),
    outerTextFont: oneOf(TEXT_FONTS, src.outerTextFont, DEFAULT.outerTextFont),
    outerTextStyle: oneOf(OUTER_STYLES, src.outerTextStyle, DEFAULT.outerTextStyle),
    outerTextSize: oneOf(TEXT_SIZES, src.outerTextSize, DEFAULT.outerTextSize),
    outerTextPlace: oneOf(TEXT_PLACES, src.outerTextPlace, DEFAULT.outerTextPlace),
    logoPlaces: Array.isArray(src.logoPlaces) ? LOGO_PLACES.map(o => o.id).filter(id => src.logoPlaces.includes(id)) : [],
    // capienza scelta dalla squadra (0 = calcolata dai seggiolini)
    capacityCustom: Math.min(MAX_CAPACITY, Math.max(0, Math.round(Number(src.capacityCustom) || 0))),
    colors: Object.fromEntries(Object.entries(DEFAULT.colors).map(([k, d]) => [k, validColor(c[k], d)]))
  };
  // un colore per ogni lato e anello (modalità "Ogni settore e anello")
  const grid = src.seatGrid && typeof src.seatGrid === 'object' ? src.seatGrid : {}, pal = [out.colors.seatA, out.colors.seatB, out.colors.seatC, out.colors.seatD];
  out.seatGrid = {};
  for (let side = 0; side < 4; side++) for (let ring = 0; ring < 3; ring++) out.seatGrid[gridKey(side, ring)] = validColor(grid[gridKey(side, ring)], pal[side]);
  if (src.image) out.image = String(src.image);
  if (src.capacity) out.capacity = Number(src.capacity) || 0;
  return out;
}

/** Anelli di ogni lato (indice come SEAT_SIDES: 0 tribuna vicina, 1 curva destra, 2 tribuna di fronte, 3 curva sinistra). */
export function ringsBySide(st) {
  const ends = st.ringsEnds || st.rings, sides = st.ringsSides || [];
  return [0, 1, 2, 3].map(i => sides[i] || (i % 2 ? ends : st.rings));
}

/** Pendenza di ogni lato (come ringsBySide): uguale per tutti o settore per settore. */
export function rakesBySide(st) {
  const base = st.rake || 100;
  return [0, 1, 2, 3].map(i => (st.rakeEach && st.rakeSides ? st.rakeSides[i] || base : base));
}

/** Anelli del settore più alto. */
export const maxRingsOf = (st) => Math.max(...ringsBySide(st));

/** Lato di un punto del bordo degli spalti (come SEAT_SIDES): sui lati lunghi le tribune, il resto alle curve. */
const sideOfPoint = (p) => (onLongSide(p) ? (p.z > 0 ? 0 : 2) : (p.x > 0 ? 1 : 3));

/* ------------------------------------------------------------- geometria */
const PITCH = { l: 105, w: 68 };
const TRACK = { straight: 84.39, r: 36.5, lanes: 8, lane: 1.22 }; // pista regolamentare da 400 m
const ROWS = { 1: [30], 2: [24, 20], 3: [22, 17, 14] };            // file di seggiolini per anello
const RISERS = [0.4, 0.5, 0.56];                                    // alzata dei gradoni: più ripidi in alto
const TREAD = 0.85;       // profondità di un gradone
const WALL = 0.4;         // spessore dei muri
const SEAT_W = 0.5;       // larghezza di un posto
const AISLE_EVERY = 14;   // una scaletta ogni ~14 m di fronte del primo anello
const AISLE_HALF = 0.55;
const SOFT_R = 3, SOFT_N = 4; // angoli smussati: raggio vicino al campo ed esponente della superellisse verso fuori
// curve staccate: apertura intorno agli angoli (centesimi di radiante, in coordinate normalizzate; 18 di partenza)
export const CORNER_GAP_MIN = 6, CORNER_GAP_MAX = 40;
export const STAND_GAP_MAX = 20;            // metri in più al massimo tra il campo e gli spalti
export const RAKE_MIN = 50, RAKE_MAX = 130; // pendenza degli spalti in percentuale (100 = normale)
const M_PARAPET = 0, M_STEPS = 1, M_STRUCT = 2, M_BOX = 3;

const seatKey = (st) => [ringsBySide(st).join(','), st.track ? 1 : 0, st.shape, st.corners, st.horseshoe ? 1 : 0, st.vomitories ? 1 : 0,
  st.standGap || 0, st.endGap || 0, rakesBySide(st).join(','), st.corners === 'open' ? st.cornerGap || 18 : '',
  st.roof === 'wave' ? ['wave', st.facade, st.roofReach].join(',') : ''].join('|');
const geomKey = (st) => [seatKey(st), st.roof, st.roofCover, st.roofCover === 'pick' ? st.roofSectors.map(Number).join('') : '', st.roofReach, st.lights, st.facade, WALL_TEX_FACADES.includes(st.facade) ? st.wallTexture : '', st.adBoards,
  st.entrance, st.entrance !== 'none' || st.roof === 'wave' ? [st.entranceSides.map(Number).join(''), st.entranceWidth, st.entranceHeight, st.entranceLogo].join(',') : '', st.ramps ? 1 : 0, st.shellPattern, st.roof === 'dome' && !st.domeTeeth ? 'noteeth' : '', st.screen, st.boxes ? 1 : 0, (st.logoPlaces || []).join(',')].join('|');

/** Punto del bordo su un lato lungo (tribune), non sulle curve: gli angoli smussati vanno con le tribune (come quelli squadrati). */
const onLongSide = (p) => !!p.corner || Math.abs(p.mz) > 0.995;

/**
 * Bordo interno degli spalti: rettangolo con angoli arrotondati (r = 0 squadrato, r = b curve a semicerchio),
 * percorso in senso antiorario. Ogni punto ha il vettore (mx, mz) per allontanarsi dal campo:
 * p + m * d è il punto a distanza d (sugli angoli vivi m è lungo la diagonale, così i lati restano dritti).
 * soft > 0 (angoli smussati): sugli archi m segue una superellisse di esponente soft, così l'angolo resta quasi vivo
 * vicino al campo e si arrotonda poco a poco verso fuori (muro e tetto); i punti dell'arco hanno corner = true.
 */
function buildPath(a, b, r, soft = 0) {
  const pts = [];
  const push = (x, z, mx, mz, corner = false) => {
    const p = pts[pts.length - 1];
    if (p && Math.abs(p.x - x) < 1e-6 && Math.abs(p.z - z) < 1e-6) return;
    pts.push(corner ? { x, z, mx, mz, corner } : { x, z, mx, mz });
  };
  const CORNER = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  const ARC = 32, STEP = 2.5;
  for (let q = 0; q < 4; q++) {
    const [sx, sz] = CORNER[q];
    const cx = sx * (a - r), cz = sz * (b - r);
    if (r > 0) {
      for (let k = 0; k <= ARC; k++) {
        const th = (q + k / ARC) * Math.PI / 2, c = Math.cos(th), s = Math.sin(th);
        const f = soft ? (Math.abs(c) ** soft + Math.abs(s) ** soft) ** (-1 / soft) : 1;
        push(cx + c * r, cz + s * r, c * f, s * f, soft > 0 && k > 0 && k < ARC);
      }
    } else push(cx, cz, sx, sz);
    // lato dritto fino all'angolo successivo
    const [tx, tz] = CORNER[(q + 1) % 4];
    const th = (q + 1) * Math.PI / 2;
    const nx = Math.round(Math.cos(th)), nz = Math.round(Math.sin(th));
    const x0 = cx + nx * r, z0 = cz + nz * r;
    const x1 = tx * (a - r) + nx * r, z1 = tz * (b - r) + nz * r;
    const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / STEP);
    for (let k = 1; k < n; k++) push(x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n, nx, nz);
  }
  const f = pts[0], l = pts[pts.length - 1];
  if (Math.abs(f.x - l.x) < 1e-6 && Math.abs(f.z - l.z) < 1e-6) pts.pop();
  return pts;
}

/** Tratti di spalti: uno solo chiuso (curve attaccate) o quattro aperti, tagliati vicino agli angoli (staccate). */
function buildRuns(path, a, b, corners, gap = 0.18) {
  if (corners !== 'open') return [{ pts: path, closed: true }];
  const keep = path.map(p => Math.abs(Math.atan2(Math.abs(p.z) / b, Math.abs(p.x) / a) - Math.PI / 4) > gap);
  const start = keep.findIndex(k => !k);
  const runs = [];
  let cur = null;
  for (let k = 1; k <= path.length; k++) {
    const i = (start + k) % path.length;
    if (keep[i]) (cur ||= []).push(path[i]);
    else if (cur) { runs.push({ pts: cur, closed: false }); cur = null; }
  }
  if (cur) runs.push({ pts: cur, closed: false });
  return runs.filter(r => r.pts.length > 1);
}

/** Forma dello stadio: bordo degli spalti, tratti e anelli (posizione, altezza, file). */
function shapeOf(st) {
  let a, b;
  if (st.track) {
    const outer = TRACK.r + TRACK.lanes * TRACK.lane;
    a = TRACK.straight / 2 + outer + 3; b = outer + 3;
  } else {
    a = PITCH.l / 2 + 9; b = PITCH.w / 2 + 7;
  }
  // spalti più lontani dal campo (tribune sui lati lunghi, curve in fondo)
  a += st.endGap || 0; b += st.standGap || 0;
  if (b > a) a = b; // la pianta resta più lunga che larga
  const r = st.shape === 'oval' ? b : st.shape === 'rounded' ? b * 0.42 : st.shape === 'soft' ? SOFT_R : 0;
  // anelli delle tribune (lati lunghi) e delle curve: gli anelli in comune sono larghi uguali, quelli in più salgono
  // sopra; la pendenza (gradoni più bassi = spalti schiacciati, più larghi che alti) può cambiare da un settore all'altro
  const counts = ringsBySide(st), maxRings = Math.max(...counts), rakes = rakesBySide(st);
  const makeTiers = (rake) => {
    const out = [];
    let D = 0, H = 1.2;
    ROWS[maxRings].forEach((rows, i) => {
      const R = RISERS[i] * rake / 100, depth = rows * TREAD;
      const t = { i, rows, R, Rx: R * 1.35, D, H, back: D + depth, top: H + (rows - 1) * R }; // Rx: file in più (sotto la copertura ondulata)
      t.soffit = (d) => t.H - 1.6 + (d - t.D) / TREAD * t.R; // sotto dell'anello (parallelo ai gradoni)
      // struttura a vista: anche il primo anello è sollevato da terra verso fuori (si vede il sotto)
      t.under = i === 0 ? (d) => Math.max(0, (d - t.D - 6) * t.R / TREAD) : t.soffit;
      out.push(t);
      D += depth * 0.55;           // l'anello sopra sporge sopra quello sotto
      H = t.top + R + 4.5;
    });
    return out;
  };
  const tierSets = new Map(), tiersFor = (rake) => { if (!tierSets.has(rake)) tierSets.set(rake, makeTiers(rake)); return tierSets.get(rake); };
  const tiers = tiersFor(Math.max(...rakes)); // quelli del settore più ripido (tetti e facciate stanno sopra a tutti)
  const last = tiers[tiers.length - 1];
  const path = buildPath(a, b, r, st.shape === 'soft' ? SOFT_N : 0);
  let runs = buildRuns(path, a, b, st.corners, (st.cornerGap || 18) / 100);
  // chiave di un settore: anelli e pendenza (più alto = più anelli, poi più ripido)
  const keyOf = (side) => counts[side] * 1000 + rakes[side];
  if (new Set([0, 1, 2, 3].map(keyOf)).size > 1) {
    // tratti separati dove cambiano anelli o pendenza (tribune, curve o un solo settore): quello più alto arriva fino al
    // primo punto del settore vicino (niente buchi)
    const split = [];
    for (const run of runs) {
      const P = run.pts, n = P.length, key = P.map(p => keyOf(sideOfPoint(p)));
      const at = (i) => (run.closed ? key[(i + n) % n] : i >= 0 && i < n ? key[i] : 0);
      for (const k of new Set(key)) {
        const mine = new Set(P.filter((p, i) => key[i] === k || key[i] < k && (at(i - 1) === k || at(i + 1) === k)));
        for (const sub of subRuns(run, p => mine.has(p))) split.push({ ...sub, tiers: tiersFor(k % 1000).slice(0, Math.floor(k / 1000)) });
      }
    }
    runs = split;
  } else runs.forEach(run => { run.tiers = tiersFor(rakes[0]).slice(0, counts[0]); });
  if (st.horseshoe) {
    // ferro di cavallo: niente spalti sulla curva verso -x
    // fino all'inizio della curva (lì parte la coda del drago); con gli angoli vivi resta l'angolo, via il lato in fondo
    const keep = (p) => p.x > -(a - r) - 1e-6 && !(p.mx < 0 && Math.abs(p.mz) < 1e-6);
    runs = runs.flatMap(run => subRuns(run, keep).map(sub => ({ ...sub, tiers: run.tiers })));
  }
  const shape = { a, b, r, tiers, path, runs, outer: Math.max(...tiers.map(t => t.back)) + WALL, height: last.top + 2.2 };
  if (st.roof === 'wave') roofRows(shape, st);
  return shape;
}

/**
 * Sotto la copertura ondulata (Vélodrome) l'ultimo anello sale fino alla copertura: file in più (più ripide, Rx) dove
 * il tetto è alto, cioè sulle curve, e quasi niente dove è basso (sui lati); restano dentro la fascia e sotto la
 * copertura; sotto il tetto il soffitto scende e si appoggia sul muretto dietro l'ultima fila (standLine). Le
 * file in più cambiano poco a poco lungo il giro (anche a metà di una fila), così la cima degli spalti è una linea
 * morbida. run.ext[i] = file in più nel punto i del tratto (con la virgola), run.E = il massimo arrotondato in su.
 */
const EXT_MAX = 30, EXT_CLEAR = 2.4;
const extTop = (T, e) => T.top + e * T.Rx;            // quota dell'ultima fila (anche a metà)
const extWall = (T, e) => extTop(T, e) + 1.1;          // cima del muretto dietro l'ultima fila (ci poggia la copertura)
function roofRows(shape, st) {
  const V = waveOf(shape, st);
  for (const run of shape.runs) {
    const T = run.tiers[run.tiers.length - 1], P = run.pts, n = P.length;
    const under = (p, e) => { const d = T.back + e * TREAD + WALL; return V.roofAt(p.x + p.mx * d, p.z + p.mz * d, d) - 0.45; };
    const raw = P.map(p => {
      const l = Math.hypot(p.mx, p.mz) || 1, lim = V.beyond(p.x, p.z, p.mx / l, p.mz / l) - 2.4;
      const fits = (e) => extWall(T, e) + EXT_CLEAR <= under(p, e);
      let hi = Math.min(EXT_MAX, Math.max(0, (lim / l - WALL - T.back) / TREAD));
      if (fits(hi)) return hi;
      if (!fits(0)) return 0;
      let lo = 0;
      for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; if (fits(m)) lo = m; else hi = m; }
      return lo;
    });
    // morbida lungo il giro: prima il minimo dei vicini (non esce mai dai limiti), poi la media
    const at = (i) => raw[run.closed ? (i + n) % n : Math.min(n - 1, Math.max(0, i))], W = 3;
    const low = P.map((_, i) => { let m = Infinity; for (let k = -W; k <= W; k++) m = Math.min(m, at(i + k)); return m; });
    const lat = (i) => low[run.closed ? (i + n) % n : Math.min(n - 1, Math.max(0, i))];
    run.ext = P.map((_, i) => { let s = 0; for (let k = -W; k <= W; k++) s += lat(i + k); const e = s / (2 * W + 1); return e < 0.25 ? 0 : e; });
    run.E = Math.ceil(Math.max(0, ...run.ext));
  }
}

/** Quota delle file in più dell'ultimo anello (roofRows) sotto il punto (x, z); 0 se lì non ci sono. */
function extTopAt(shape, x, z) {
  let best = null, bp = Infinity;
  for (const run of shape.runs) {
    if (!run.E) continue;
    run.pts.forEach((p, i) => {
      const l = Math.hypot(p.mx, p.mz) || 1, ux = p.mx / l, uz = p.mz / l, t = (x - p.x) * ux + (z - p.z) * uz, perp = Math.abs((x - p.x) * uz - (z - p.z) * ux);
      if (t > 0 && perp < bp) { bp = perp; best = [run, i, t / l]; }
    });
  }
  if (!best) return 0;
  const [run, i, d] = best, e = run.ext[i], T = run.tiers[run.tiers.length - 1];
  if (!e || d < T.back - 0.5 || d > T.back + e * TREAD + WALL + 0.5) return 0;
  return extWall(T, Math.min(e, Math.max(0, (d - T.back) / TREAD + 1)));
}

/**
 * Profilo di un anello (d = distanza dal bordo, h = altezza): parapetto, gradoni, muro dietro, sotto. e = file in più
 * (sotto la copertura ondulata, più ripide; anche a metà: l'ultima fila è più corta), E = file in più del punto che ne
 * ha di più: le mancanti restano schiacciate sull'ultima fila, così tutti i profili del tratto hanno gli stessi punti.
 */
function tierProfile(t, next, exposed, boxes, e = 0, E = Math.ceil(e)) {
  const pts = [], whole = Math.floor(e + 1e-6), part = e - whole > 0.02 ? e - whole : 0;
  const rows = t.rows + whole + (part ? 1 : 0), back = t.D + (t.rows + whole + part) * TREAD, wave = E > 0;
  const rowH = (k) => (k < t.rows ? t.H + k * t.R : t.top + (k - t.rows + 1) * t.Rx), top = rowH(rows - 1);
  const tread = (k) => t.D + (k + 1) * TREAD - (part && k === rows - 1 ? (1 - part) * TREAD : 0);
  const add = (d, h, m) => pts.push({ d, h, m }); // m = materiale del lato che parte da questo punto
  const pad = (n) => { const q = pts[pts.length - 1]; for (let k = 0; k < n; k++) pts.push({ ...q }); };
  add(t.D, t.i === 0 ? 0 : t.H - 1.6, M_PARAPET);
  add(t.D, t.H + 1, M_PARAPET);
  add(t.D + 0.25, t.H + 1, M_PARAPET);
  add(t.D + 0.25, t.H, M_STEPS);
  for (let k = 0; k < rows; k++) {
    const last = k === rows - 1;
    // sopra l'ultima fila, fino all'anello di sopra: muro o fascia dei palchi vetrati
    add(tread(k), rowH(k), last ? (boxes && next && !exposed ? M_BOX : M_STRUCT) : M_STEPS);
    if (!last) add(t.D + (k + 1) * TREAD, rowH(k + 1), M_STEPS);
  }
  pad(2 * (t.rows + E) - 1 - (2 * rows - 1));
  // muro dietro: sale fino sotto l'anello di sopra (niente buchi tra un anello e l'altro) o fa da bordo in cima
  // (sotto la copertura ondulata un muretto che segue le file, sopra sale la fascia fino al tetto); con la struttura a
  // vista tra un anello e l'altro resta aperto (si vede il sotto a gradoni dell'anello sopra)
  const wallTop = next && !exposed ? next.soffit(back + WALL) : wave ? extWall(t, e) : top + (next ? 1.2 : 2.2);
  add(back, wallTop, M_STRUCT);
  add(back + WALL, wallTop, M_STRUCT);
  if (!exposed) {
    add(back + WALL, t.i > 0 ? t.soffit(back + WALL) : 0, M_STRUCT);
    return pts;
  }
  // struttura a vista: il sotto degli spalti segue i gradoni, così da fuori si vedono le "scale" inclinate
  const under = (R, b) => {
    const u = [], y = (k) => t.under(Math.min(b, t.D + (k + 1) * TREAD));
    u.push([b + WALL, y(R - 1)]);
    for (let k = R - 1; k >= 0; k--) {
      const dk = t.D + k * TREAD, yn = k > 0 ? y(k - 1) : null;
      u.push([dk, y(k)]);
      if (t.i === 0 && (yn === null || yn <= 0.3)) { u.push([dk, 0]); break; } // il primo anello poggia a terra
      if (yn !== null) u.push([dk, yn]);
    }
    return u;
  };
  const mine = under(rows, back), full = under(t.rows + E, t.D + (t.rows + E) * TREAD);
  add(...mine[0], M_STRUCT);
  pad(full.length - mine.length);
  for (const q of mine.slice(1)) add(...q, M_STRUCT);
  return pts;
}

/** Muro che regge da terra un anello superiore (dietro all'anello di sotto). */
function supportProfile(t) {
  return [
    { d: t.back, h: 0, m: M_STRUCT }, { d: t.back + WALL, h: 0, m: M_STRUCT },
    { d: t.back + WALL, h: t.soffit(t.back + WALL), m: M_STRUCT }, { d: t.back, h: t.soffit(t.back), m: M_STRUCT }
  ];
}

/** Fa scorrere il profilo lungo il tratto: un nastro di quadrilateri per ogni lato del profilo, tappi alle estremità. */
function extrude(THREE, run, profile, pos, idx) {
  const P = run.pts, n = P.length, segs = run.closed ? n : n - 1;
  const E = profile.length;
  for (let e = 0; e < E; e++) {
    const p0 = profile[e], p1 = profile[(e + 1) % E];
    if (p0.d === p1.d && p0.h === p1.h) continue;
    const base = pos.length / 3;
    for (const p of P) pos.push(p.x + p.mx * p0.d, p0.h, p.z + p.mz * p0.d, p.x + p.mx * p1.d, p1.h, p.z + p.mz * p1.d);
    const list = idx[p0.m];
    for (let i = 0; i < segs; i++) {
      const a0 = base + i * 2, b0 = base + ((i + 1) % n) * 2;
      list.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1);
    }
  }
  if (run.closed) return;
  const tris = THREE.ShapeUtils.triangulateShape(profile.map(q => new THREE.Vector2(q.d, q.h)), []);
  for (const p of [P[0], P[n - 1]]) {
    const base = pos.length / 3;
    for (const q of profile) pos.push(p.x + p.mx * q.d, q.h, p.z + p.mz * q.d);
    for (const [i, j, k] of tris) idx[M_STRUCT].push(base + i, base + j, base + k);
  }
}

/**
 * Come extrude, ma con un profilo per punto del tratto (stessi punti, posizioni diverse: le file in più dell'ultimo
 * anello); i materiali vengono dal profilo ref (quello con tutte le file).
 */
function extrudeVar(THREE, run, profiles, ref, pos, idx) {
  const P = run.pts, n = P.length, segs = run.closed ? n : n - 1, E = ref.length;
  for (let e = 0; e < E; e++) {
    const base = pos.length / 3;
    P.forEach((p, i) => { const a = profiles[i][e], b = profiles[i][(e + 1) % E]; pos.push(p.x + p.mx * a.d, a.h, p.z + p.mz * a.d, p.x + p.mx * b.d, b.h, p.z + p.mz * b.d); });
    const list = idx[ref[e].m];
    for (let i = 0; i < segs; i++) { const a0 = base + i * 2, b0 = base + ((i + 1) % n) * 2; list.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1); }
  }
  if (run.closed) return;
  for (const i of [0, n - 1]) {
    const p = P[i], prof = profiles[i].filter((q, k, arr) => !k || q.d !== arr[k - 1].d || q.h !== arr[k - 1].h);
    const tris = THREE.ShapeUtils.triangulateShape(prof.map(q => new THREE.Vector2(q.d, q.h)), []);
    const base = pos.length / 3;
    for (const q of prof) pos.push(p.x + p.mx * q.d, q.h, p.z + p.mz * q.d);
    for (const [a, b, c] of tris) idx[M_STRUCT].push(base + a, base + b, base + c);
  }
}

/** exposed = struttura a vista: niente muri pieni sotto gli anelli (li reggono travi e pilastri). */
function standsGeometry(THREE, shape, exposed, boxes) {
  const pos = [], idx = [[], [], [], []];
  for (const run of shape.runs) {
    run.tiers.forEach((t, i) => {
      if (run.E && i === run.tiers.length - 1) {
        // ultimo anello con le file in più sotto la copertura ondulata
        const profiles = run.ext.map(e => tierProfile(t, undefined, exposed, boxes, e, run.E));
        extrudeVar(THREE, run, profiles, tierProfile(t, undefined, exposed, boxes, run.E, run.E), pos, idx);
      } else extrude(THREE, run, tierProfile(t, run.tiers[i + 1], exposed, boxes), pos, idx);
      if (i > 0 && !exposed) extrude(THREE, run, supportProfile(t), pos, idx);
    });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const all = [];
  idx.forEach((list, m) => { g.addGroup(all.length, list.length, m); for (const v of list) all.push(v); });
  g.setIndex(all);
  g.computeVertexNormals();
  return g;
}

/**
 * Seggiolini: una matrice per posto (lungo ogni fila, rivolto verso il campo), la fila nell'anello e info = settore | anello << 1 | lato << 3
 * (settore 0 = tribune sui lati lunghi, 1 = curve; lato 0 = tribuna verso z+, 1 = curva destra, 2 = distinti, 3 = curva sinistra).
 * Le scalette sono allineate da una fila all'altra.
 */
/**
 * Vomitori (ingressi sugli spalti): a metà degli anelli con almeno 12 file, al centro di una campata ogni due tra le
 * scalette; occupano VOM_ROWS file e 2·VOM_HALF metri. Restituisce [u lungo il tratto] e le file [r0, r1).
 */
const VOM_HALF = 1.9, VOM_ROWS = 5;
function vomitoryUs(run, total, count) {
  const out = [];
  for (let k = 0; k < count; k++) if (k % 2 === (count > 2 ? 1 : 0)) out.push((k + 0.5) * total / count);
  return out;
}
const vomRows = (t) => (t.rows >= 12 ? [Math.round(t.rows * 0.42), Math.round(t.rows * 0.42) + VOM_ROWS] : null);

const seatCache = new Map();
function seatsOf(st) {
  const key = seatKey(st);
  if (seatCache.has(key)) return seatCache.get(key);
  const shape = shapeOf(st);
  const mats = [], info = [], rows = [];
  for (const run of shape.runs) {
    const P = run.pts, n = P.length, segs = run.closed ? n : n - 1;
    const Li = [], U = [0];
    for (let i = 0; i < segs; i++) {
      const j = (i + 1) % n;
      Li.push(Math.hypot(P[j].x - P[i].x, P[j].z - P[i].z));
      U.push(U[i] + Li[i]);
    }
    const total = U[segs];
    const count = Math.max(1, Math.round(total / AISLE_EVERY));
    // tratti aperti: scalette anche alle due estremità
    const aisles = Array.from({ length: run.closed ? count : count + 1 }, (_, k) => k * total / count);
    const voms = st.vomitories ? vomitoryUs(run, total, count) : [];
    for (const t of run.tiers) {
      const vr = voms.length ? vomRows(t) : null, extra = run.E && t === run.tiers[run.tiers.length - 1] ? run.E : 0;
      for (let row = 0; row < t.rows + extra; row++) {
        const inVom = vr && row >= vr[0] && row < vr[1], up = row - t.rows + 1; // up > 0: fila in più
        const d = t.D + row * TREAD + 0.55, h = up > 0 ? t.top + up * t.Rx : t.H + row * t.R;
        let carry = 0.25;
        for (let i = 0; i < segs; i++) {
          const j = (i + 1) % n;
          // fila in più: solo dove c'è tutta (le file finiscono a metà del tratto, seguendo la cima)
          let sLo = 0, sHi = Infinity;
          if (up > 0) {
            const ei = run.ext[i], ej = run.ext[j];
            if (ei < up && ej < up) { carry = 0.25; continue; }
            if (ei < up) sLo = (up - ei) / (ej - ei); else if (ej < up) sHi = (ei - up) / (ei - ej);
          }
          const x0 = P[i].x + P[i].mx * d, z0 = P[i].z + P[i].mz * d;
          const x1 = P[j].x + P[j].mx * d, z1 = P[j].z + P[j].mz * d;
          const l = Math.hypot(x1 - x0, z1 - z0);
          if (l < 1e-6) continue;
          const tx = (x1 - x0) / l, tz = (z1 - z0) / l, scale = l / Li[i];
          let s = carry;
          for (; s < l; s += SEAT_W) {
            if (s < sLo * l || s > sHi * l) continue;
            const u = U[i] + (s / l) * Li[i];
            if (aisles.some(au => Math.abs(u - au) * scale < AISLE_HALF)) continue;
            if (inVom && voms.some(vu => Math.abs(u - vu) * scale < VOM_HALF)) continue;
            const x = x0 + tx * s, z = z0 + tz * s;
            // assi: x lungo la fila, y in alto, z verso il campo
            mats.push(tx, 0, tz, 0, 0, 1, 0, 0, -tz, 0, tx, 0, x, h, z, 1);
            const sector = Math.abs(z) / (shape.b + d) > Math.abs(x) / (shape.a + d) ? 0 : 1;
            const side = sector === 0 ? (z > 0 ? 0 : 2) : (x > 0 ? 1 : 3);
            info.push(sector | (t.i << 1) | (side << 3));
            rows.push(row);
          }
          carry = s - l;
        }
      }
    }
  }
  const val = { count: info.length, matrices: new Float32Array(mats), info: Uint8Array.from(info), rows: Uint8Array.from(rows), tierRows: shape.tiers.map(t => t.rows) };
  if (seatCache.size >= 4) seatCache.delete(seatCache.keys().next().value);
  seatCache.set(key, val);
  return val;
}

/**
 * Scritta fatta con i seggiolini: per ogni posto 1 se fa parte delle lettere. Le lettere stanno nel lato e nell'anello
 * scelti (0 = tutti), centrate, alte quasi quanto le file e larghe al massimo il 78% del settore; si leggono dal campo.
 */
function standTextMask(seats, st) {
  const text = st.standText.trim();
  if (!text) return null;
  const side = TEXT_SIDES.find(t => t.id === st.standTextSide).side;
  const ring = Math.min(st.standTextRing, seats.tierRows.length); // 0 = tutti gli anelli
  const before = [0];
  seats.tierRows.forEach((r, i) => before.push(before[i] + r));
  const total = ring ? seats.tierRows[ring - 1] : before[before.length - 1];
  const M = seats.matrices, info = seats.info, sel = [];
  // coordinata lungo il lato, da sinistra a destra per chi guarda dal campo
  const along = (i) => { const x = M[i * 16 + 12], z = M[i * 16 + 14]; return side === 0 ? -x : side === 2 ? x : side === 1 ? z : -z; };
  let amin = Infinity, amax = -Infinity;
  for (let i = 0; i < seats.count; i++) {
    const tier = (info[i] >> 1) & 3;
    if (info[i] >> 3 !== side || (ring && tier !== ring - 1)) continue;
    const a = along(i);
    sel.push(i);
    if (a < amin) amin = a;
    if (a > amax) amax = a;
  }
  if (!sel.length || amax - amin < 4) return null;
  // disegno in pixel quadrati di 25 cm: un posto è largo 2 pixel, una fila (gradone in diagonale) circa 4
  const PX = 0.25, rowM = Math.hypot(TREAD, 0.5);
  const cw = Math.ceil((amax - amin) / PX), ch = Math.ceil(total * rowM / PX);
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const ctx = c.getContext('2d');
  const ft = fontOf(st.standTextFont), font = (px) => fontCss(ft, px);
  ctx.font = font(100);
  const m = ctx.measureText(text), asc = m.actualBoundingBoxAscent || 72, desc = m.actualBoundingBoxDescent || 0;
  // larghezza vera delle lettere (i corsivi escono un po' dal riquadro del testo)
  const wide = Math.max(m.width, (m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || 0)) || 1;
  let px = 100 * ch * 0.8 / (asc + desc);
  px = Math.min(px, 100 * cw * 0.78 / wide);
  ctx.font = font(px);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, cw / 2, ch / 2 + (asc - desc) * px / 200);
  const data = ctx.getImageData(0, 0, cw, ch).data, mask = new Uint8Array(seats.count);
  for (const i of sel) {
    const g = ring ? seats.rows[i] : before[(info[i] >> 1) & 3] + seats.rows[i];
    const x = Math.min(cw - 1, Math.floor((along(i) - amin) / PX)), y = Math.min(ch - 1, Math.floor((total - 1 - g + 0.5) / total * ch));
    if (data[(y * cw + x) * 4 + 3] > 110) mask[i] = 1;
  }
  return mask;
}

/** Capienza: numero di seggiolini dello stadio. */
export function stadiumCapacity(st) { return seatsOf(normalizeStadium(st)).count; }

/** Capienza mostrata nell'app: quella scelta dalla squadra, altrimenti quella calcolata dai seggiolini. */
export function shownCapacity(st) { return normalizeStadium(st).capacityCustom || stadiumCapacity(st); }

/** Seggiolino: seduta e schienale, 4 triangoli (con decine di migliaia di posti conta ogni triangolo). */
function seatGeometry(THREE) {
  const w = 0.21;
  const p = [
    -w, 0.42, -0.02, w, 0.42, -0.02, -w, 0.42, 0.36, w, 0.42, 0.36,  // seduta
    -w, 0.42, -0.02, w, 0.42, -0.02, -w, 0.86, -0.13, w, 0.86, -0.13 // schienale
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setIndex([0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6]);
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------- texture */
/** Colore schiarito (f > 1) o scurito (f < 1). */
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const m = v => Math.max(0, Math.min(255, Math.round(f >= 1 ? v + (255 - v) * (f - 1) : v * f)));
  return `rgb(${m(n >> 16)}, ${m((n >> 8) & 255)}, ${m(n & 255)})`;
}

const PITCH_PAD = 4;

/** Campo: erba tagliata (strisce, scacchi o uniforme) e linee regolamentari. */
function paintPitch(canvas, st) {
  const W = PITCH.l + PITCH_PAD * 2, H = PITCH.w + PITCH_PAD * 2;
  const s = canvas.width / W;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.setTransform(s, 0, 0, s, W / 2 * s, H / 2 * s);
  // con la pista il margine d'erba intorno al campo si ferma alla prima corsia, con un altro pavimento intorno al campo
  // a 2,5 m dalle linee (fuori resta trasparente)
  if (st.apronStyle !== 'grass') { ctx.beginPath(); ctx.rect(-PITCH.l / 2 - 2.5, -PITCH.w / 2 - 2.5, PITCH.l + 5, PITCH.w + 5); ctx.clip(); }
  else if (st.track) { ctx.beginPath(); ovalPath(ctx, TRACK.r - 0.3); ctx.clip(); }
  const g = st.colors.grass, light = shade(g, 1.1), dark = shade(g, 0.88);
  ctx.fillStyle = g;
  ctx.fillRect(-W / 2, -H / 2, W, H);
  if (st.mowing !== 'plain') {
    const bw = PITCH.l / 18, bh = PITCH.w / 10;
    for (let i = -2; i < 20; i++) {
      for (let j = st.mowing === 'checks' ? -2 : 0; j < (st.mowing === 'checks' ? 12 : 1); j++) {
        ctx.fillStyle = (i + (st.mowing === 'checks' ? j : 0)) % 2 ? light : dark;
        if (st.mowing === 'checks') ctx.fillRect(-PITCH.l / 2 + i * bw, -PITCH.w / 2 + j * bh, bw, bh);
        else ctx.fillRect(-PITCH.l / 2 + i * bw, -H / 2, bw, H);
      }
    }
  }
  const L2 = PITCH.l / 2, W2 = PITCH.w / 2;
  ctx.strokeStyle = 'rgba(255,255,255,.92)';
  ctx.fillStyle = 'rgba(255,255,255,.92)';
  ctx.lineWidth = 0.14;
  const stroke = (fn) => { ctx.beginPath(); fn(); ctx.stroke(); };
  const spot = (x) => { ctx.beginPath(); ctx.arc(x, 0, 0.22, 0, Math.PI * 2); ctx.fill(); };
  ctx.strokeRect(-L2, -W2, PITCH.l, PITCH.w);
  stroke(() => { ctx.moveTo(0, -W2); ctx.lineTo(0, W2); });
  stroke(() => ctx.arc(0, 0, 9.15, 0, Math.PI * 2));
  spot(0);
  const arcA = Math.acos(5.5 / 9.15);
  for (const sx of [-1, 1]) {
    const gx = sx * L2;
    for (const [depth, half] of [[16.5, 20.16], [5.5, 9.16]]) {
      stroke(() => { ctx.moveTo(gx, -half); ctx.lineTo(gx - sx * depth, -half); ctx.lineTo(gx - sx * depth, half); ctx.lineTo(gx, half); });
    }
    spot(gx - sx * 11);
    const mid = sx > 0 ? Math.PI : 0;
    stroke(() => ctx.arc(gx - sx * 11, 0, 9.15, mid - arcA, mid + arcA));
    for (const sz of [-1, 1]) {
      const a0 = Math.atan2(-sz, -sx);
      stroke(() => ctx.arc(gx, sz * W2, 1, a0 - Math.PI / 4, a0 + Math.PI / 4));
    }
  }
  ctx.restore();
}

/** Pista da 400 m: due rettilinei e due curve; r = raggio della linea interna della corsia. */
function ovalPath(ctx, r) {
  const hs = TRACK.straight / 2;
  ctx.moveTo(hs, -r);
  ctx.arc(hs, 0, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(-hs, r);
  ctx.arc(-hs, 0, r, Math.PI / 2, Math.PI * 1.5);
  ctx.closePath();
}

/** Punto della linea della pista a distanza r dal centro di una curva, alla posizione t (0..1 lungo il giro). */
function ovalPoint(t, r) {
  const hs = TRACK.straight / 2, L = TRACK.straight * 2 + Math.PI * 2 * r;
  let u = ((t % 1) + 1) % 1 * L;
  // dal punto (hs, -r) verso +x: curva destra, rettilineo in alto, curva sinistra, rettilineo in basso
  const arc = Math.PI * r;
  if (u < arc) { const a = -Math.PI / 2 + u / r; return [hs + Math.cos(a) * r, Math.sin(a) * r]; }
  u -= arc;
  if (u < TRACK.straight) return [hs - u, r];
  u -= TRACK.straight;
  if (u < arc) { const a = Math.PI / 2 + u / r; return [-hs + Math.cos(a) * r, Math.sin(a) * r]; }
  u -= arc;
  return [-hs + u, -r];
}

/** Anello della pista tra i raggi r0 e r1 (n punti lungo il giro), u = metri lungo la corda centrale / tile, v = metri / tile. */
function trackRing(THREE, r0, r1, n, y, tile = 1) {
  const pos = [], uv = [], idx = [], rm = (r0 + r1) / 2, L = TRACK.straight * 2 + Math.PI * 2 * rm;
  for (let i = 0; i <= n; i++) {
    const t = i / n, [x0, z0] = ovalPoint(t, r0), [x1, z1] = ovalPoint(t, r1);
    pos.push(x0, y, z0, x1, y, z1); uv.push(t * L / tile, 0, t * L / tile, (r1 - r0) / tile);
  }
  for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (g.getAttribute('normal').getY(0) < 0) { const ix = g.getIndex().array; for (let k = 0; k < ix.length; k += 3) { const q = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = q; } g.computeVertexNormals(); }
  return g;
}

/** Pavimento piano dentro il contorno pts ([x, z]) a quota y, con le coordinate per la texture in metri / tile. */
function floorGeometry(THREE, pts, y, tile) {
  const v2 = pts.map(([x, z]) => new THREE.Vector2(x, z));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap(([x, z]) => [x, y, z]), 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pts.flatMap(() => [0, 1, 0]), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(pts.flatMap(([x, z]) => [x / tile, -z / tile]), 2));
  // triangoli rivolti verso l'alto: se il primo guarda in basso si girano tutti
  const tris = THREE.ShapeUtils.triangulateShape(v2, []), P = (i) => pts[i];
  const up = tris.length && (() => { const [i, j, k] = tris[0], a = P(i), b = P(j), c = P(k); return (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]) > 0; })();
  g.setIndex(tris.flatMap(([i, j, k]) => (up ? [i, j, k] : [i, k, j])));
  return g;
}

/**
 * Grana dell'erba (grigio, ripetibile senza cuciture): fili corti in tante sfumature.
 * Si moltiplica sopra il colore del campo ripetuta ogni pochi metri: da vicino si vede l'erba, da lontano
 * (mipmap) torna un grigio medio che non cambia il colore scelto. Generata via codice: nessun file da scaricare.
 */
function grassDetailCanvas(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgb(128,128,128)';
  ctx.fillRect(0, 0, size, size);
  let seed = 7;
  const rnd = () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296;
  // chiazze morbide (si notano nella lettura a scala grande)
  for (let i = 0; i < 46; i++) {
    const x = rnd() * size, y = rnd() * size, r = size * (0.06 + rnd() * 0.16), v = rnd() < 0.5 ? 0 : 255;
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
      const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      g.addColorStop(0, `rgba(${v},${v},${v},.16)`); g.addColorStop(1, `rgba(${v},${v},${v},0)`);
      ctx.fillStyle = g; ctx.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
    }
  }
  ctx.lineCap = 'round';
  for (let i = 0; i < size * 22; i++) {
    const x = rnd() * size, y = rnd() * size, len = 2 + rnd() * 5, a = -Math.PI / 2 + (rnd() - 0.5) * 1.1;
    const v = Math.round(70 + rnd() * 120);
    ctx.strokeStyle = `rgba(${v},${v},${v},.55)`;
    ctx.lineWidth = 0.6 + rnd() * 0.9;
    // disegno anche le copie oltre i bordi: la texture si ripete senza cuciture
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
      ctx.beginPath(); ctx.moveTo(x + dx, y + dy); ctx.lineTo(x + dx + Math.cos(a) * len, y + dy + Math.sin(a) * len); ctx.stroke();
    }
  }
  return c;
}

/**
 * Aggiunge al materiale la grana ripetuta `repeat` volte, letta a due scale: fine (fili, da vicino)
 * e grande (ciuffi e chiazze, da metà distanza). strength = quanto si vede.
 */
function addDetail(THREE, mat, tex, repeat, strength) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.detailMap = { value: tex };
    sh.uniforms.detailRepeat = { value: repeat };
    sh.fragmentShader = 'uniform sampler2D detailMap;\nuniform vec2 detailRepeat;\n' + sh.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
  float detailFine = texture2D(detailMap, vMapUv * detailRepeat).r - 0.5;
  float detailWide = texture2D(detailMap, vMapUv * detailRepeat * 0.21 + 0.37).r - 0.5;
  diffuseColor.rgb *= 1.0 + ${strength.toFixed(2)} * (detailFine + detailWide * 1.4) * 2.0;`
    );
  };
  mat.customProgramCacheKey = () => 'detail' + strength;
}

/* ------------------------------------------------------------- esterno */
const TRUSS_EVERY = 7, SUPPORT_EVERY = 14, LAMP_EVERY = 16, PILASTER_EVERY = 8, PYLON_EVERY = 24, RIB_EVERY = 15;
const ROOF_PANEL = 5;     // m: passo dei pannelli del tetto
const CORNER_R = 5.5;     // torri d'angolo delle travi rosse (raggio)
const RAMP_R = 5.2, RAMP_EVERY = 40;   // torri delle rampe a spirale: raggio, passo lungo il bordo
const RAMP_PITCH = 4.2, RAMP_BAND = 2.9; // rampe: salita a ogni giro e spessore della fascia bianca (la riga scura è la differenza)
const GIRDER_H = 7.5, GIRDER_W = 2.6, GIRDER_L = 14, GIRDER_PANEL = 5; // travi rosse: altezza, mezza larghezza, sbalzo, campata
const TOWER_OVER = 5;   // le torri d'angolo salgono sopra le travi rosse (in cima il piccolo traliccio rosso)
const ESPLANADE_H = 5, ESPLANADE_W = 24;     // spianata rialzata: altezza e larghezza dal muro
const SHELL_CELL_U = 7, SHELL_CELL_V = 4.4;  // involucro: un cuscino a rombo ogni 7 m in orizzontale e 4,4 m lungo il profilo
const PLATFORM_H = 5.9, PLATFORM_OUT = 10; // piattaforma intorno allo stadio (struttura a vista): altezza e sporgenza dal muro

/** Fari effettivi: senza tetto quelli "sul tetto" diventano torri. */
const lightsOf = (st) => (st.lights === 'roof' && st.roof === 'none' ? 'towers' : st.lights);

/**
 * Copertura: dal davanti dell'anello più alto (con le travi rosse quasi dal bordo del campo, come a San Siro)
 * fino oltre il muro esterno, appena inclinata verso fuori.
 */
function roofOf(shape, roof, shift = 0) {
  const top = shape.tiers[shape.tiers.length - 1];
  // shift: metri verso il campo (positivi) o verso fuori (negativi) del bordo davanti
  const clampIn = (d, dOut) => Math.min(dOut - 5, Math.max(-14, d - shift));
  if (roof === 'dragon') {
    // per schermo e scritta sul fronte: il bordo davanti della copertura drago
    const D = dragonOf(shape, { roofReach: 'normal', ...(shift ? { roofReach: ROOF_REACHES.find(r => r.m === shift)?.id || 'normal' } : {}) });
    return { dIn: D.dF, dOut: D.out - 1, h: () => D.hF, depth: () => 1.2 };
  }
  if (roof === 'stands') {
    // tetti piatti per tribuna: dal davanti dell'anello più alto fino appena oltre il muro, salgono un poco verso il campo
    const dOut = shape.outer + 1.2, dIn = clampIn(Math.max(top.D - 3, 2), dOut), hIn = top.top + 6.5;
    return { dIn, dOut, h: (d) => hIn - (d - dIn) * 0.06, depth: () => 1.2 };
  }
  // travi rosse (San Siro): il tetto sporge molto verso fuori e copre del tutto le torri delle rampe sui lati
  const dOut = shape.outer + (roof === 'girders' ? 12.5 : 4), dIn = clampIn(roof === 'girders' ? 4 : Math.max(top.D - 2, 3), dOut), hIn = top.top + 9;
  return { dIn, dOut, h: (d) => hIn - (d - dIn) * 0.04, depth: (d) => 1.4 + 3.6 * (d - dIn) / (dOut - dIn) };
}

const STANDS_FASCIA = 2.6;                       // tetto per tribuna: altezza della fascia davanti
const STANDS_MAST_R = 0.75, STANDS_MAST_OUT = 3;  // piloni agli angoli: raggio e distanza dal bordo esterno del tetto

/** Lo stesso tratto spostato a distanza d dal bordo (per misurare le lunghezze lungo la facciata). */
const offsetRun = (run, d) => ({ ...run, pts: run.pts.map(p => ({ x: p.x + p.mx * d, z: p.z + p.mz * d, mx: p.mx, mz: p.mz })) });

/** Punto del bordo sull'angolo (sx, sz): quello che guarda più in diagonale. */
function diagonalPoint(shape, sx, sz) {
  return shape.path.filter(q => Math.sign(q.x) === sx && Math.sign(q.z) === sz)
    .reduce((m, q) => (Math.abs(q.mx * q.mz) > Math.abs(m.mx * m.mz) ? q : m));
}

/** Piloni del tetto per tribuna: uno per angolo, fuori dagli spalti sulla diagonale, più alti del tetto più alto. */
function mastsOf(shape, st) {
  const R = roofOf(shape, 'stands', reachOf_(st)), top = R.h(R.dIn) + 13, d = R.dOut + STANDS_MAST_OUT;
  return [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => {
    const p = diagonalPoint(shape, sx, sz);
    return { sx, sz, x: p.x + p.mx * d, z: p.z + p.mz * d, top, long: sz > 0 ? 0 : 2, end: sx > 0 ? 1 : 3 };
  });
}

/** Lamiera e moderna stanno all'altezza dei settori coperti più alti: se sono più bassi degli altri il tetto non resta in aria. */
function roofShapeOf(shape, st, roofRuns) {
  if ((st.roof === 'truss' || st.roof === 'membrane') && roofRuns.length) {
    const tall = roofRuns.reduce((m, r) => (r.tiers.length > m.tiers.length ? r : m));
    return { ...shape, tiers: tall.tiers, outer: Math.max(...roofRuns.map(runOuter)) };
  }
  return shape;
}

/** Ingresso principale della facciata inglese: al centro del lato lungo verso z+ (fronte del basamento z0, vetrata fino a top). */
function entranceOf(shape) {
  const run = shape.runs.find(r => r.pts.some(p => onLongSide(p) && p.z > 0 && Math.abs(p.x) < 3));
  if (!run) return null;
  const o = runOuter(run), PH = cladPodium(wallTopOf(run));
  return { run, o, PH, z0: shape.b + o + CLAD_PODIUM_W, top: PH + 1 };
}

/**
 * Misure di un tipo di ingresso largo W e alto H (logo grande k volte il normale), in coordinate locali (u verso destra
 * guardando da fuori, v in alto, w verso fuori dal muro): profondità, dove va il logo (centro v, w, lato s e base
 * dell'insegna che lo regge, se c'è), i pannelli con l'immagine personale e la sagoma (sil: tratti [w0, w1, quota in
 * cima]) per non sbattere contro la copertura che sporge sopra. wallLogo: l'insegna appoggiata al muro dietro (quando
 * davanti la copertura è troppo bassa).
 */
function entranceGeom(type, W, H, k = 1, wallLogo = false) {
  // insegna: lastra larga 1,2 volte il logo, su due montanti alti 0,5 m appoggiati su base
  const plate = (s, w, base) => ({ v: base + 0.5 + s * 0.6, w, s, base });
  const sign = (L) => [L.w - 0.5, L.w - 0.1, L.v + L.s * 0.6];
  if (type === 'arch') {
    const Wa = Math.min(W * 0.56, 2 * (H * 0.86 - H * 0.52)), hs = H * 0.52, s = Math.min(7, W * 0.3) * k, At = s + 1.6;
    const bw = (W - Wa) / 2 * 0.6, bu = Wa / 2 + (W - Wa) / 4;
    return { depth: 5, Wa, hs, At, logo: { v: H + 0.5 + At / 2, w: 4.25, s },
      panels: [-1, 1].map(k => ({ u0: k * bu - bw / 2, u1: k * bu + bw / 2, v0: H * 0.14, v1: H * 0.84, w: 4.06 })),
      sil: [[-0.4, 4.4, H + 0.9 + At], [6.8, 7.2, 5.5]] };
  }
  if (type === 'canopy') {
    const s = Math.min(8, W * 0.3) * k, sw = W * 0.6, top = H * 0.92, bot = top - Math.min(H * 0.4, sw / 2), rise = 3.5, lw = 14.2;
    const logo = wallLogo ? plate(s, 0.55, H + 0.65) : plate(s, lw, H + 0.6 + rise * lw / 16);
    return { depth: 16, rise, logo,
      panels: [{ u0: -sw / 2, u1: sw / 2, v0: bot, v1: top, w: 8.15 }],
      sil: [[0, 2, H], ...Array.from({ length: 16 }, (_, i) => [i, i + 1, H + 0.9 + rise * (i + 1) / 16]), sign(logo)] };
  }
  if (type === 'towers') {
    const s = Math.min(8, W * 0.34) * k, bw = W * 0.3, TW = 6, TH = H + 9;
    const logo = plate(s, wallLogo ? 0.55 : 5.6, H + 3.2);
    return { depth: 7, TW, TH, logo,
      panels: [-1, 1].map(k => ({ u0: k * W / 4 - bw / 2, u1: k * W / 4 + bw / 2, v0: H * 0.3, v1: H - 0.3, w: 5.7 })),
      sil: [[-0.4, 6.4, TH + 3.45 + TW * 0.38], [2.7, 3.3, TH + 10], [0, 6, H + 3.2], sign(logo)] };
  }
  // portale vetrato
  const s = Math.min(10, W * 0.4) * k, logo = plate(s, wallLogo ? 0.55 : 4.9, H);
  return { depth: 12, logo,
    panels: [{ u0: -W * 0.32, u1: W * 0.32, v0: H * 0.42 + 0.7, v1: H - 2.9, w: 0.8 }],
    sil: [[0, 5.6, H], [1.5, 10.6, H * 0.42 + 0.6], [12.2, 12.8, H + 7], sign(logo)] };
}

/**
 * Quota libera sotto la copertura che sporge fuori dal muro (involucro a cuscini, petali, corona di vele): funzione
 * della distanza dal bordo degli spalti lungo la normale (Infinity dove sopra non c'è niente), o null.
 */
function overheadOf(shape, st) {
  if (st.roof === 'shell' || st.roof === 'petals') {
    // la parte che sale e si gonfia verso fuori, fino al punto più largo
    const P = shellOf(shape, st).pts, top = P.reduce((m, p, i) => (p.d > P[m].d ? i : m), 0), up = P.slice(0, top + 1);
    return (dd) => {
      if (dd <= up[0].d) return up[0].h - 0.4;
      for (let i = 1; i < up.length; i++) {
        const a = up[i - 1], b = up[i];
        if (dd <= b.d && b.d > a.d) return a.h + (b.h - a.h) * (dd - a.d) / (b.d - a.d) - 0.4;
      }
      return Infinity;
    };
  }
  if (st.roof === 'crown') {
    // verso il muro la valle delle vele (che sale verso gli spalti), poi il bordo fuori delle vele fino all'anello in cima
    const C = crownOf(shape, st);
    return (dd) => dd <= C.dV ? C.hAt(C.valley, dd) - 0.9
      : dd < C.dR + 1.2 ? C.hV + (C.hR - C.hV) * (dd - C.dV) / (C.dR - C.dV) - 0.7 : Infinity;
  }
  return null;
}

/**
 * Ingressi monumentali: uno al centro di ogni lato scelto, attaccato al muro (sulla spianata, se c'è) o fuori
 * dall'involucro, dalla fascia, dalle lame... Sotto le coperture che sporgono sopra l'ingresso (cuscini, petali,
 * vele) resta attaccato: se serve l'insegna del logo va sul muro e l'ingresso si abbassa, se no si allontana quanto
 * basta. Ognuno con il punto del bordo degli spalti (px, pz), il centro del retro (x, z) e la quota del piano (base),
 * la normale verso fuori (nx, nz), la destra vista da fuori (rx, rz), le misure (W, H, g), quanto può essere profonda
 * la piazzetta (pdMax) e at(u, v, w) → punto nel mondo.
 */
const entranceCache = new WeakMap();
function entrancesOf(shape, st) {
  if (!st.entrance || st.entrance === 'none') return [];
  const key = [st.entrance, st.entranceSides.map(Number).join(''), st.entranceWidth, st.entranceHeight, st.entranceLogo, st.facade, st.roof, st.roofReach, st.horseshoe ? 1 : 0].join('|');
  const memo = entranceCache.get(shape) || new Map();
  entranceCache.set(shape, memo);
  if (!memo.has(key)) memo.set(key, entrancesBuild(shape, st));
  return memo.get(key);
}
/** Lati dove non può andare un ingresso monumentale (e perché): ci sono già quelli della facciata inglese e del Vélodrome. */
export function entranceSkips(st) {
  const out = {};
  if (st.facade === 'cladding') out[0] = 'c\'è già l\'ingresso della facciata inglese';
  if (st.roof === 'wave') {
    out[1] = 'c\'è già l\'ingresso del Vélodrome (lo personalizzi qui sotto)';
    out[0] = out[2] = 'la fascia del Vélodrome scende quasi a terra';
  }
  if (st.horseshoe) out[3] = 'la curva è aperta';
  return out;
}
function entrancesBuild(shape, st) {
  const out = [], skip = entranceSkips(st), clear = overheadOf(shape, st);
  const env = clear ? null : envelopeRow(shape, st), esp = st.facade === 'esplanade', deck = shape.outer + esplanadeW(st);
  [[0, 0, 1], [1, 1, 0], [2, 0, -1], [3, -1, 0]].forEach(([side, nx, nz]) => {
    if (!st.entranceSides[side] || skip[side]) return;
    const tx = nx * shape.a, tz = nz * shape.b;
    let best = null, bd = Infinity, run = null;
    for (const r of shape.runs) for (const q of r.pts) { const dd = (q.x - tx) ** 2 + (q.z - tz) ** 2; if (dd < bd) { bd = dd; best = q; run = r; } }
    if (!best || bd > 4) return; // lì non ci sono spalti (ferro di cavallo, curve staccate...)
    // attaccato al muro: sulla spianata appena fuori dal muro, se no davanti al basamento, alle colonne...
    let d = esp ? runOuter(run) + 0.3 : footOf({ ...shape, outer: runOuter(run) }, st) + 0.3;
    if (env) d = Math.max(d, beyondRow(env, best.x, best.z, nx, nz) + 0.5);
    if (st.roof === 'wave') d = Math.max(d, waveOf(shape, st).beyond(best.x, best.z, nx, nz) + 0.5);
    if (st.roof === 'blades') d = Math.max(d, bladesOf(shape, st).out + 0.5);
    if (st.roof === 'dragon') d = Math.max(d, dragonOf(shape, st).out + 0.5);
    if (st.roof === 'stands' && st.facade === 'wall') d = Math.max(d, shape.outer + 1.4);
    const W = st.entranceWidth, k = st.entranceLogo / 100, base = esp ? ESPLANADE_H : 0;
    let H = st.entranceHeight, g = entranceGeom(st.entrance, W, H, k);
    if (clear) {
      // la sagoma sta sotto la copertura? (con mezzo metro di margine); prima l'altezza scelta con il logo davanti o
      // sul muro, poi il logo un po' più piccolo, poi l'ingresso più basso finché resta attaccato al muro; se no il più
      // vicino con l'altezza scelta
      const fits = (G, d) => G.sil.every(([w0, w1, v]) => {
        for (let w = w0; w <= w1 + 1e-6; w += Math.max(0.3, (w1 - w0) / 6)) if (base + v + 0.5 > clear(d + w)) return false;
        return true;
      });
      const push = (G) => { let dd = d; while (!fits(G, dd) && dd < d + 90) dd += 0.5; return dd; };
      const tries = [[H, false, 1], [H, true, 1]];
      for (let h = H; h >= ENTRANCE_H[0]; h--) for (const f of [0.85, 0.7]) tries.push([h, true, f]);
      let pick = null;
      for (const [h, wl, f] of tries) {
        const G = entranceGeom(st.entrance, W, h, k * f, wl), dd = push(G);
        if (dd - d <= 1) { pick = [G, h, dd]; break; }
        if (h === H && f === 1 && (!pick || dd < pick[2])) pick = [G, h, dd, true];
      }
      [g, H, d] = pick;
    }
    const x = best.x + nx * d, z = best.z + nz * d, rx = nz, rz = -nx, onDeck = esp && d < deck - 2;
    const b0 = onDeck ? base : 0, pdMax = onDeck ? deck - 0.8 - d : Infinity;
    out.push({ side, px: best.x, pz: best.z, d, x, z, nx, nz, rx, rz, W, H, g, base: b0, pdMax,
      at: (u, v, w) => [x + rx * u + nx * w, v + b0, z + rz * u + nz * w] });
  });
  return out;
}

/** Il punto (x, z) sta nella fascia davanti a un ingresso (larga quanto l'ingresso più margin)? (colonne, piloni...) */
const inEntranceBand = (shape, st, x, z, margin) => entrancesOf(shape, st).some(e =>
  Math.abs((x - e.px) * e.rx + (z - e.pz) * e.rz) < e.W / 2 + (e.g.TW || 0) + margin && (x - e.px) * e.nx + (z - e.pz) * e.nz > 0);

/** C'è un ingresso vicino al punto del bordo (x, z)? (per non mettere torri, piloni e pilastri davanti all'ingresso) */
const nearEntrance = (shape, st, x, z, margin) => entrancesOf(shape, st).some(e => Math.hypot(x - e.px, z - e.pz) < e.W / 2 + margin);

const entranceImageCache = new Map();
/** Tela con l'immagine personale dell'ingresso (al massimo 1024 px); null se manca o non si può usare in WebGL. */
function entranceImageCanvas(url) {
  if (!url) return Promise.resolve(null);
  if (!entranceImageCache.has(url)) {
    entranceImageCache.set(url, new Promise(resolve => {
      const img = new Image();
      if (!/^data:/i.test(url)) img.crossOrigin = 'anonymous';
      img.onload = () => {
        const k = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, c.width, c.height);
        try { ctx.getImageData(0, 0, 1, 1); resolve(c); } catch (e) { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    }));
  }
  return entranceImageCache.get(url);
}

/** Pannello di partenza dell'ingresso (senza immagine personale): colore dell'ingresso, nome dello stadio e la scritta. */
function paintEntranceDefault(canvas, name, color, aspect) {
  const W = canvas.width = 512, H = canvas.height = Math.max(64, Math.round(512 / aspect)), ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, shade(color, 1.25)); g.addColorStop(1, shade(color, 0.7));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = Math.max(3, Math.min(W, H) * 0.025);
  ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, W - ctx.lineWidth * 2, H - ctx.lineWidth * 2);
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const font = (px) => `900 ${px}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  const lines = aspect >= 1 ? [name] : name.split(/\s+/).filter(Boolean).slice(0, 4);
  const px = Math.min(H / (lines.length + 1.5), W * 0.2);
  lines.forEach((t, i) => {
    ctx.font = font(px);
    const w = ctx.measureText(t).width;
    if (w > W * 0.86) ctx.font = font(px * W * 0.86 / w);
    ctx.fillText(t, W / 2, H / 2 + (i - (lines.length - 1) / 2) * px * 1.15);
  });
}

/** Pannello con l'immagine personale intera (senza tagli) al centro, sul fondo sfumato del colore dell'ingresso. */
function paintEntranceFit(canvas, img, color, aspect) {
  const W = canvas.width = aspect >= 1 ? 1024 : Math.max(64, Math.round(1024 * aspect)), H = canvas.height = aspect >= 1 ? Math.max(64, Math.round(1024 / aspect)) : 1024;
  const ctx = canvas.getContext('2d'), g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, shade(color, 1.2)); g.addColorStop(1, shade(color, 0.65));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const k = Math.min(W * 0.92 / img.width, H * 0.92 / img.height), w = img.width * k, h = img.height * k;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

/** Posti del logo possibili con questa struttura (l'ingresso c'è solo con la facciata inglese, il tetto deve essere piatto). */
export function logoPlacesFor(st) {
  const wrapped = WRAP_ROOFS.includes(st.roof) || st.roof === 'dragon';
  const ok = { entrance: st.facade === 'cladding' || st.entrance !== 'none' || st.roof === 'wave', roof: st.roof !== 'none' && !wrapped, facade: !wrapped, pitch: true };
  return LOGO_PLACES.map(o => o.id).filter(id => ok[id]);
}

const LOGO_ENTRANCE = 12, LOGO_MAX = 15, LOGO_PITCH = 12; // lato del logo in metri: sull'ingresso, al massimo, sul campo

/**
 * Logo della squadra: un quadrato per posto scelto, con i vertici [in basso a sinistra, in basso a destra, in alto a destra,
 * in alto a sinistra] come lo si guarda (da fuori; dall'alto con l'alto verso -z), più place, lato (side) e misura (s).
 */
function logoSpots(shape, st) {
  const places = logoPlacesFor(st).filter(id => (st.logoPlaces || []).includes(id)), out = [];
  const sq = (c, r, u, s) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => c.map((v, k) => v + (r[k] * i + u[k] * j) * s / 2));
  if (places.includes('entrance')) {
    // sopra il portale, appoggiato a metà dell'architrave
    const E = st.facade === 'cladding' ? entranceOf(shape) : null;
    if (E) out.push({ place: 'entrance', s: LOGO_ENTRANCE, pts: sq([0, E.top + 0.6 + LOGO_ENTRANCE / 2, E.z0 + 4.45], [1, 0, 0], [0, 1, 0], LOGO_ENTRANCE) });
    // sulla fascia del Vélodrome, sopra il suo ingresso
    const VE = veloEntryOf(shape, st);
    if (VE && VE.ent.length > 1) {
      const [fx, fz] = VE.face, room = VE.hi - VE.lo, s = Math.min(room * 0.9, Math.min(16, room * 0.72) * (st.entranceLogo || 100) / 100);
      if (s > 3) out.push({ place: 'entrance', s, pts: sq([fx + 0.35, (VE.lo + VE.hi) / 2, fz], [0, 0, -1], [0, 1, 0], s) });
    }
    // sopra ogni ingresso monumentale
    for (const e of entrancesOf(shape, st)) {
      const L = e.g.logo, c = e.at(0, L.v, L.w);
      out.push({ place: 'entrance', s: L.s, pts: sq(c, [e.rx, 0, e.rz], [0, 1, 0], L.s) });
    }
  }
  if (places.includes('roof')) {
    // dipinto sul tetto dei due lati lunghi, a metà profondità
    const runs = coveredRuns(shape, st), reach = reachOf_(st);
    for (const sgn of [1, -1]) {
      const run = runs.find(r => r.pts.some(p => onLongSide(p) && Math.sign(p.z) === sgn && Math.abs(p.x) < 3));
      if (!run) continue;
      const R = st.roof === 'stands' ? roofOf({ ...shape, tiers: run.tiers }, 'stands', reach) : roofOf(roofShapeOf(shape, st, runs), st.roof, reach);
      const s = Math.min(LOGO_MAX, R.dOut - R.dIn - 3), dm = (R.dIn + R.dOut) / 2, lift = st.roof === 'stands' ? 0.45 : 0.08;
      if (s < 4) continue;
      const at = (x, d) => [x, R.h(d) + lift, sgn * (shape.b + d)], dB = dm + sgn * s / 2, dT = dm - sgn * s / 2;
      out.push({ place: 'roof', side: sgn, s, pts: [at(-s / 2, dB), at(s / 2, dB), at(s / 2, dT), at(-s / 2, dT)] });
    }
  }
  if (places.includes('facade')) {
    // sul muro esterno al centro delle due curve, nella fascia libera
    for (const sgn of [1, -1]) {
      const run = shape.runs.find(r => r.pts.some(p => !onLongSide(p) && Math.sign(p.x) === sgn && Math.abs(p.z) < 3));
      if (!run) continue;
      const o = runOuter(run), H = wallTopOf(run), clad = st.facade === 'cladding';
      const lo = clad ? cladPodium(H) + 1.6 : { esplanade: ESPLANADE_H + 1, struts: PLATFORM_H + 1.15 }[st.facade] ?? 1.5;
      const hi = clad ? H - cladCornice(H) - 0.8 : H - 0.5, s = Math.min(LOGO_MAX, hi - lo);
      const d = o + (clad ? 0.95 : { struts: PLATFORM_OUT + 0.35, bands: 2, columns: 1.2 }[st.facade] ?? 0.5);
      if (s < 4) continue;
      // da fuori la destra è verso -z sulla curva x+ e verso +z sulla curva x-
      out.push({ place: 'facade', side: sgn, s, pts: sq([sgn * (shape.a + d), (lo + hi) / 2, 0], [0, 0, -sgn], [0, 1, 0], s) });
    }
  }
  if (places.includes('pitch')) out.push({ place: 'pitch', s: LOGO_PITCH, pts: sq([0, 0.09, 0], [1, 0, 0], [0, 0, -1], LOGO_PITCH) });
  return out;
}

const logoCache = new Map();
/** Tela quadrata con il logo scontornato al centro; null se manca o non si può usare in WebGL (immagine senza CORS). */
function stadiumLogo(url) {
  if (!url) return Promise.resolve(null);
  if (!logoCache.has(url)) {
    logoCache.set(url, getCutout(url).then(src => new Promise(resolve => {
      const img = new Image();
      if (!/^data:/i.test(src)) img.crossOrigin = 'anonymous';
      img.onload = () => {
        const S = 512, c = document.createElement('canvas'), ctx = c.getContext('2d');
        c.width = c.height = S;
        const k = Math.min(S / img.naturalWidth, S / img.naturalHeight), w = img.naturalWidth * k, h = img.naturalHeight * k;
        ctx.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
        try { ctx.getImageData(0, 0, 1, 1); resolve(c); } catch (e) { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    })));
  }
  return logoCache.get(url);
}

/**
 * Copertura "drago" (stile Kaohsiung): nastro che parte da terra fuori dagli spalti (traliccio di tubi a spirale), sale,
 * gira sopra gli spalti e arriva al bordo davanti (pannelli solari). Profilo (d, h); split = fine del traliccio.
 */
function dragonOf(shape, st) {
  const T = shape.tiers[shape.tiers.length - 1], o = shape.outer;
  const hC = T.top + 12, hF = T.top + 7.5; // cresta e bordo verso il campo
  const dF = Math.min(o - 8, Math.max(-14, 2 - reachOf_(st))); // il nastro è largo: copre quasi tutti gli spalti
  // da terra (fuori) il traliccio sale quasi dritto e si gonfia, gira arrotondato in cima e il tetto scende piano verso il campo
  const prof = [{ d: o + 8, h: 0 }, { d: o + 9.6, h: hC * 0.22 }, { d: o + 9.9, h: hC * 0.42 }, { d: o + 9.3, h: hC * 0.6 },
    { d: o + 7.8, h: hC * 0.78 }, { d: o + 5.4, h: hC * 0.92 }, { d: o + 2.2, h: hC * 0.99 }, { d: o - 1, h: hC }];
  const d0 = o - 1, n = Math.max(3, Math.round((d0 - dF) / 3));
  for (let i = 1; i <= n; i++) { const f = i / n; prof.push({ d: d0 + (dF - d0) * f, h: hC - (hC - hF) * f ** 1.4 }); }
  prof.push({ d: dF - 0.6, h: hF - 1 });
  // lo stesso profilo spostato verso l'interno (sotto i pannelli): lì corrono i tubi
  const inner = prof.map((p, j) => {
    const a = prof[Math.max(0, j - 1)], b = prof[Math.min(prof.length - 1, j + 1)], l = Math.hypot(b.d - a.d, b.h - a.h) || 1;
    return { d: p.d - (b.h - a.h) / l * 0.7, h: Math.max(0, p.h + (b.d - a.d) / l * 0.7) };
  });
  return { prof, inner, split: 3, dF, hF, hC, out: o + 10.5 };
}

/**
 * Coda del drago: continua dall'estremità del braccio verso +z del ferro di cavallo, gira verso fuori e scende fino a
 * terra. Tratto aperto con i punti del bordo interno, la normale verso fuori e la scala del profilo (1 → 0).
 */
function dragonTail(shape) {
  const K = 38, STEP = 4, pts = [];
  let x = -(shape.a - shape.r), z = shape.b, phi = Math.PI;
  for (let k = 0; k <= K; k++) {
    const dx = Math.cos(phi), dz = Math.sin(phi);
    pts.push({ x, z, mx: dz, mz: -dx, scale: (1 - k / K) ** 0.85 });
    phi = Math.PI - 0.8 * ((k + 1) / K) ** 1.3;
    x += Math.cos(phi) * STEP; z += Math.sin(phi) * STEP;
  }
  return { pts, closed: false };
}

/** La coda c'è con il ferro di cavallo, se la copertura arriva fino all'estremità del braccio da cui parte. */
const hasDragonTail = (shape, st, runs = coveredRuns(shape, st)) => st.horseshoe && runs.some(run => !run.closed &&
  [run.pts[0], run.pts[run.pts.length - 1]].some(p => Math.hypot(p.x + shape.a - shape.r, p.z - shape.b) < 0.5));

/**
 * Estremità del nastro (dove la copertura finisce: ferro di cavallo, settori scelti...): continua per qualche metro
 * girando un poco verso fuori e scende fino a terra. Stesso verso del tratto, la scala va a 0 lontano dal tratto.
 */
function dragonCaps(shape, runs, withTail) {
  const caps = [], K = 16, STEP = 3;
  const isTail = (p) => withTail && Math.hypot(p.x + shape.a - shape.r, p.z - shape.b) < 0.5;
  for (const run of runs) {
    if (run.closed || run.pts.length < 2) continue;
    const P = run.pts, n = P.length;
    for (const atEnd of [true, false]) {
      const p = atEnd ? P[n - 1] : P[0], q = atEnd ? P[n - 2] : P[1];
      if (isTail(p)) continue;
      let dx = p.x - q.x, dz = p.z - q.z, l = Math.hypot(dx, dz) || 1, x = p.x, z = p.z;
      dx /= l; dz /= l;
      const pts = [];
      for (let k = 0; k <= K; k++) {
        // normale verso fuori dalla stessa parte di quella degli spalti
        let mx = dz, mz = -dx;
        if (mx * p.mx + mz * p.mz < 0) { mx = -mx; mz = -mz; }
        pts.push({ x, z, mx, mz, scale: Math.cos(Math.PI / 2 * k / K) ** 0.8 });
        dx += mx * 0.05; dz += mz * 0.05; l = Math.hypot(dx, dz); dx /= l; dz /= l;
        x += dx * STEP; z += dz * STEP;
      }
      caps.push({ pts: atEnd ? pts : pts.reverse(), closed: false });
    }
  }
  return caps;
}

/** Tubo (cilindro di raggio r) da (x1, y1, z1) a (x2, y2, z2), per i pezzi ripetuti con un cilindro alto 1 e di raggio 1. */
function tubeAt(out, x1, y1, z1, x2, y2, z2, r) {
  let dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
  const len = Math.hypot(dx, dy, dz) || 1;
  dx /= len; dy /= len; dz /= len;
  let ax = -dz, ay = 0, az = dx, al = Math.hypot(ax, az);   // perpendicolare orizzontale
  if (al < 1e-4) { ax = 1; az = 0; al = 1; }
  ax /= al; az /= al;
  const cx = ay * dz - az * dy, cy = az * dx - ax * dz, cz = ax * dy - ay * dx; // a × d: terna destra (a, d, c)
  boxAt(out, (x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2, [ax * r, ay * r, az * r], [dx * len, dy * len, dz * len], [cx * r, cy * r, cz * r]);
}

/** Punto del nastro lungo un tratto: posizione u (metri lungo il tratto) e punto (d, h) del profilo, con la scala del tratto. */
function ribbonSampler(run, dc) {
  const P = run.closed ? [...run.pts, run.pts[0]] : run.pts, cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i].x - P[i - 1].x, P[i].z - P[i - 1].z));
  const total = cum[cum.length - 1];
  let i = 0;
  const at = (u, pd, ph) => {
    if (run.closed) u = ((u % total) + total) % total;
    else if (u < -1e-6 || u > total + 1e-6) return null;
    if (cum[i] > u) i = 0;
    while (i < P.length - 2 && cum[i + 1] < u) i++;
    const a = P[i], b = P[i + 1], f = Math.min(1, Math.max(0, (u - cum[i]) / ((cum[i + 1] - cum[i]) || 1)));
    const lerp = (k, def) => (a[k] ?? def) + ((b[k] ?? def) - (a[k] ?? def)) * f;
    const sc = lerp('scale', 1), d = dc + (pd - dc) * (0.35 + 0.65 * sc);
    return [lerp('x') + lerp('mx') * d, ph * sc, lerp('z') + lerp('mz') * d];
  };
  return { total, at };
}

/**
 * Pannelli solari come texture vera (colore + rilievo): file di pannelli lungo il nastro, ognuno inclinato come una scaglia,
 * vetro chiaro da tingere col colore della copertura, cornici e fughe chiare (si vedono i tubi sotto).
 * Una ripetizione = 4 pannelli (5 m) x 4 file (3,2 m).
 */
let solarCache = null;
function solarTexture() {
  if (solarCache) return solarCache;
  const W = 256, H = 128, make = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const map = make(), nrm = make(), mctx = map.getContext('2d'), nctx = nrm.getContext('2d');
  const mi = mctx.createImageData(W, H), ni = nctx.createImageData(W, H), hgt = new Float32Array(W * H), inside = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // pannelli in file dritte lungo il nastro (4 x 4 per ripetizione), ognuno inclinato come una scaglia
      const yy = y % 32, xx = x % 64, k = y * W + x;
      const inn = xx >= 2 && xx <= 61 && yy >= 2 && yy <= 29;
      inside[k] = inn ? 1 : 0;
      hgt[k] = inn ? 0.2 + 0.8 * (yy - 2) / 27 : 0;
      let r, g, b;
      if (!inn) { r = 205; g = 211; b = 218; } // fughe e cornici chiare
      else {
        const t = (yy - 2) / 27, cell = (xx % 15 < 1 || yy === 16) ? 0.9 : 1;
        r = (232 - 62 * t) * cell; g = (236 - 58 * t) * cell; b = (243 - 48 * t) * cell;
      }
      mi.data[k * 4] = r; mi.data[k * 4 + 1] = g; mi.data[k * 4 + 2] = b; mi.data[k * 4 + 3] = 255;
    }
  }
  const su = 0.12 / (5 / W), sv = 0.12 / (3.2 / H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = y * W + x;
      const gx = (hgt[y * W + (x + 1) % W] - hgt[y * W + (x - 1 + W) % W]) * su * 0.5;
      const gy = (hgt[((y + 1) % H) * W + x] - hgt[((y - 1 + H) % H) * W + x]) * sv * 0.5;
      const nx = -gx, ny = gy, l = Math.hypot(nx, ny, 1);
      ni.data[k * 4] = (nx / l * 0.5 + 0.5) * 255; ni.data[k * 4 + 1] = (ny / l * 0.5 + 0.5) * 255; ni.data[k * 4 + 2] = (1 / l * 0.5 + 0.5) * 255; ni.data[k * 4 + 3] = 255;
    }
  }
  mctx.putImageData(mi, 0, 0); nctx.putImageData(ni, 0, 0);
  return (solarCache = { canvas: map, normal: nrm, tileU: 5, tileV: 3.2 });
}

/** Superficie lungo un tratto con il profilo prof[j0..j1] (scala per punto se c'è), con le coordinate per la texture. */
function sweepRun(THREE, run, prof, j0, j1, uScale, vScale) {
  const P = run.closed ? [...run.pts, run.pts[0]] : run.pts, pos = [], uv = [], idx = [];
  const dc = prof[0].d - 5;
  let u = 0;
  P.forEach((p, i) => {
    if (i) u += Math.hypot(p.x - P[i - 1].x, p.z - P[i - 1].z) / uScale;
    const sc = p.scale ?? 1;
    let v = 0;
    for (let j = j0; j <= j1; j++) {
      if (j > j0) v += Math.hypot(prof[j].d - prof[j - 1].d, prof[j].h - prof[j - 1].h) * sc / vScale;
      const d = dc + (prof[j].d - dc) * (0.35 + 0.65 * sc);
      pos.push(p.x + p.mx * d, prof[j].h * sc, p.z + p.mz * d);
      uv.push(u, v);
    }
  });
  const R = j1 - j0 + 1;
  for (let i = 0; i < P.length - 1; i++) for (let j = 0; j < R - 1; j++) { const a = i * R + j, b = a + R; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const towerHeight = (shape, st) => {
  const top = { wave: () => waveOf(shape, st).top, blades: () => bladesOf(shape, st).top, dome: () => domeOf(shape, st).top, crown: () => crownOf(shape, st).hR,
    dragon: () => dragonOf(shape, st).hC, shell: () => shellOf(shape, st).top, petals: () => shellOf(shape, st).top, tent: () => shellOf(shape, st).top - 50 }[st.roof];
  return (top ? top() : st.roof !== 'none' ? roofOf(shape, st.roof, reachOf_(st)).h(0) : shape.height) + 18;
};
const towerDist = (shape, st) => Math.max(shape.outer, st.roof === 'crown' ? crownOf(shape, st).out : st.roof === 'wave' ? waveOf(shape, st).out : st.roof === 'blades' ? bladesOf(shape, st).out : st.roof !== 'none' ? roofOf(shape, st.roof, reachOf_(st)).dOut : 0) + 6;

/**
 * Dove stanno le torri delle rampe lungo un tratto (u, metri lungo il bordo): a passo regolare tutto intorno; con le
 * travi rosse (San Siro) solo tre al centro di ogni lato lungo (agli angoli ci sono le torri d'angolo).
 */
function rampUs(shape, st, run, cum) {
  const free = (u) => { const [x, z] = pointAt(run, cum, u, 0); return !nearEntrance(shape, st, x, z, RAMP_R + 2); };
  if (st.roof !== 'girders') return stations(run, cum, RAMP_EVERY, footOf({ ...shape, outer: runOuter(run) }, st) + RAMP_R).filter(free);
  const P = run.pts, n = P.length, segs = run.closed ? n : n - 1, out = new Set(), k = shape.a * 0.5;
  for (let i = 0; i < segs; i++) {
    const p = P[i], q = P[(i + 1) % n];
    if (!onLongSide(p) || !onLongSide(q) || p.x === q.x) continue;
    for (const tx of [-k, 0, k]) if ((p.x - tx) * (q.x - tx) <= 0) out.add(+(cum[i] + (cum[i + 1] - cum[i]) * (tx - p.x) / (q.x - p.x)).toFixed(4));
  }
  return [...out].sort((a, b) => a - b).filter(free);
}

/** Centro di una torre delle rampe: appena fuori dal muro (con la copertura ondulata fuori dalla sua fascia). */
function rampTowerAt(shape, st, run, cum, u, foot) {
  const [x0, z0] = pointAt(run, cum, u, 0), [x1, z1] = pointAt(run, cum, u, 10), l = Math.hypot(x1 - x0, z1 - z0) || 1;
  const ux = (x1 - x0) / l, uz = (z1 - z0) / l, s = l / 10; // s: metri per unità di d (sugli angoli vivi più di 1)
  let d = (foot + RAMP_R - 0.4) * s;
  if (st.roof === 'wave') d = Math.max(d, waveOf(shape, st).beyond(x0, z0, ux, uz) + RAMP_R + 0.8);
  if (st.roof === 'blades') d = Math.max(d, (bladesOf(shape, st).out + RAMP_R + 0.5) * s); // fuori dalla facciata a lame
  // coperture che avvolgono lo stadio: la torre sta fuori dalla pianta più larga dell'involucro
  const env = envelopeRow(shape, st);
  if (env) d = Math.max(d, beyondRow(env, x0, z0, ux, uz) + RAMP_R + 0.8);
  return [x0 + ux * d, z0 + uz * d];
}

/** Pianta più larga ([x, z]) delle coperture che avvolgono lo stadio (cuscini, tenda, petali, cupola, corona), o null. */
function envelopeRow(shape, st) {
  if (SHELLISH.includes(st.roof)) { const S = shellOf(shape, st); return S.rowAt(S.pts.reduce((m, p) => (p.d > m.d ? p : m), S.pts[0]).d); }
  if (st.roof === 'dome') { const D = domeOf(shape, st); return D.rowAt(D.dOut + 2.6); }
  if (st.roof === 'crown') { const C = crownOf(shape, st); return C.rowAt(C.dR + 1); }
  return null;
}

/** Distanza lungo la direzione (ux, uz), da (px, pz), fino alla pianta row. */
function beyondRow(row, px, pz, ux, uz) {
  let best = 0, bp = Infinity;
  for (const [x, z] of row) {
    const t = (x - px) * ux + (z - pz) * uz, perp = Math.abs((x - px) * uz - (z - pz) * ux);
    if (t > 0 && perp < bp) { bp = perp; best = t; }
  }
  return best;
}

/** Piloni a traliccio del tetto reticolare: appena fuori dal bordo del tetto, più alti di lui. */
const pylonDist = (R) => R.dOut + 1.5;
const pylonHeight = (R) => R.h(R.dOut) + 7;

/** Distanza dal bordo occupata dal muro esterno (con basamento o fasce). */
const CLAD_PODIUM_W = 6, CLAD_MODULE = 12, CLAD_ENTRANCE = 30, CLAD_DRUM_R = 6.5; // facciata inglese: basamento, moduli, ingresso, torri
const footOf = (shape, st) => shape.outer + ({ struts: PLATFORM_OUT + 0.2, bands: 1.8, columns: 0.8, cladding: CLAD_PODIUM_W + 0.2, esplanade: esplanadeW(st) + 0.2 }[st.facade] || 0);
/** Facciata inglese: altezza del basamento e del cornicione colorato per una parete alta H. */
const cladPodium = (H) => Math.min(10.5, H * 0.42), cladCornice = (H) => Math.min(3, H * 0.12);
/** Facciata inglese: nastri di vetrate [da, a] all'altezza del corridoio sotto ogni anello superiore. */
const cladBands = (tiers) => tiers.slice(1).map(t => [t.H - 4.2, t.H - 1.6]);

/** Larghezza della spianata: sotto l'involucro a cuscini (molto gonfio verso fuori) è più larga. */
const esplanadeW = (st) => (st.roof === 'shell' ? ESPLANADE_W + 12 : ESPLANADE_W);

/** Muro esterno e altezza di un tratto: i settori possono avere anelli diversi, la facciata segue ognuno. */
const runOuter = (run) => Math.max(...run.tiers.map(t => t.back)) + WALL;
const runTop = (run) => run.tiers[run.tiers.length - 1];
/** Altezza del muro esterno di un tratto: sotto le file in più dell'ultimo anello (copertura ondulata), se ci sono. */
const wallTopOf = (run) => { const T = runTop(run); return run.E ? Math.min(T.top + 2.2, T.soffit(runOuter(run)) - 0.3) : T.top + 2.2; };

/**
 * Lame d'acciaio (stile Bernabéu): pianta quasi quadrata, basamento vetrato scuro, facciata di grandi lame orizzontali
 * che si gonfia verso fuori con il bordo alto ondulato (alto al centro dei lati, basso agli angoli), camminamento scuro
 * e sopra il tetto a lame concentriche che sale piano fino all'apertura. edge(x, z) = quota del bordo della facciata;
 * rowAt(d) = pianta a distanza d (a passi uguali).
 */
const BLADES_ROW = 240, BLADES_BASE = 7;
const bladesCache = new WeakMap();
function bladesOf(shape, st) {
  const key = st.roofReach, memo = bladesCache.get(shape) || new Map();
  bladesCache.set(shape, memo);
  if (memo.has(key)) return memo.get(key);
  const T = shape.tiers[shape.tiers.length - 1], o = shape.outer;
  const H0 = T.top + 3, A = 4.5, hIn = T.top + 14, dIn = Math.min(o - 12, Math.max(-12, 1 - reachOf_(st)));
  const edge = (x, z) => H0 + A * Math.cos(4 * Math.atan2(Math.abs(z) / shape.b, Math.abs(x) / shape.a));
  const rows = new Map(), rowAt = (d) => {
    const k = d.toFixed(3);
    if (!rows.has(k)) rows.set(k, evenOutline(shellOutline(shape, d, BLADES_ROW * 4), BLADES_ROW));
    return rows.get(k);
  };
  const B = BLADES_BASE, out = { o, T, H0, A, hIn, dIn, edge, rowAt, base: B, top: hIn + 1.5 };
  // facciata (dal basamento al bordo ondulato), poi il tetto: [d, quota come funzione di (x, z)]
  out.facade = [[o + 7.4, () => B], [o + 8.8, (x, z) => B + (edge(x, z) - B) * 0.35], [o + 9.3, (x, z) => B + (edge(x, z) - B) * 0.68],
    [o + 8.9, (x, z) => edge(x, z) - 0.7], [o + 8.3, edge]];
  out.roof = [[o + 8.6, (x, z) => edge(x, z) + 2.2], [o + 9, (x, z) => edge(x, z) + 2.9], [o + 8.4, (x, z) => edge(x, z) + 3.6], [o + 6.6, (x, z) => edge(x, z) + 4.1]];
  const n = 12;
  for (let i = 1; i <= n; i++) {
    const f = i / n, d = o + 6.6 + (dIn - o - 6.6) * f, w = f * f * (3 - 2 * f);
    out.roof.push([d, (x, z) => edge(x, z) + 4.1 + (hIn - edge(x, z) - 4.1) * w]);
  }
  out.roof.push([dIn - 0.6, () => hIn - 1.3]);
  out.out = o + 10.5;
  memo.set(key, out);
  return out;
}

/**
 * Profilo dell'involucro a cuscini (stile Allianz Arena), come punti (d, h): parte poco sopra la base, si gonfia
 * verso fuori, gira sopra gli spalti e continua come tetto trasparente fino all'apertura sopra il campo.
 * `split` = indice del primo punto della parte trasparente.
 */
function shellOf(shape, st) {
  const T = shape.tiers[shape.tiers.length - 1], o = shape.outer;
  const base = st.facade === 'esplanade' ? ESPLANADE_H : 0, h0 = base + 3, crest = T.top + (st.roof === 'petals' ? 12 : 9);
  // involucro a cuscini (Allianz Arena): molto gonfio verso fuori e tetto largo e quasi piano che arriva fin sopra il
  // bordo del campo (dall'alto l'apertura è poco più grande del campo); tenda e petali più raccolti
  const shell = st.roof === 'shell', tent = st.roof === 'tent', petals = st.roof === 'petals';
  const drop = Math.min(shell ? 7 : 12, (crest - h0) * (shell ? 0.2 : 0.32));
  // petali (Al Janoub): conchiglia bassa sopra il piano terra vetrato, che si gonfia appena e poi gira sopra gli spalti
  const hP = base + 6, kp = (f) => hP + (crest - hP) * f;
  const dIn = Math.min(o - 16, Math.max(petals ? -18 : -14, (shell ? -5 : petals ? -6 : 2) - reachOf_(st))); // il tetto scende verso l'apertura
  const k = (f) => h0 + (crest - h0) * f;
  // muro gonfio verso fuori e cresta larga e arrotondata
  const kt = (f) => base + (crest - base) * f;
  const key = shell
    ? [[o + 0.6, h0], [o + 11, k(0.18)], [o + 18, k(0.42)], [o + 18.5, k(0.64)], [o + 14, k(0.85)], [o + 6, crest - 0.4], [o - 3, crest]]
    : tent
      // tenda: la membrana scende larga fino a terra come la falda di una tenda (concava), poi copre gli spalti
      ? [[o + 38, base], [o + 27, kt(0.13)], [o + 17, kt(0.36)], [o + 9, kt(0.66)], [o + 3, kt(0.92)], [o - 3, crest], [o - 10, crest - 0.8]]
      : petals
        ? [[o + 2.2, hP], [o + 4.2, kp(0.16)], [o + 4.8, kp(0.34)], [o + 3.8, kp(0.52)], [o + 1, kp(0.68)], [o - 5, kp(0.82)], [o - 13, kp(0.91)]]
        : [[o + 0.6, h0], [o + 5.2, k(0.22)], [o + 7, k(0.48)], [o + 5.6, k(0.74)], [o + 2.2, k(0.92)], [o - 3, crest], [o - 10, crest - 0.8]];
  // poi il tetto scende curvo (convesso) fino all'apertura e si arrotonda verso il basso sul bordo
  const d0 = key[key.length - 1][0], n = Math.max(3, Math.round((d0 - dIn) / 4));
  // (i petali invece salgono ancora piano fino all'apertura, il punto più alto)
  const hd = key[key.length - 1][1];
  for (let i = 1; i <= n; i++) { const f = i / n; key.push([d0 + (dIn - d0) * f, petals ? hd + (crest - hd) * (1 - (1 - f) ** 2) : crest - 0.8 - (drop - 0.8) * Math.pow(f, 1.5)]); }
  key.push(petals ? [dIn - 1, crest - 1.4] : [dIn - 1.2, crest - drop - 1.6]);
  const P = [key[0], ...key, key[key.length - 1]], pts = [];
  // curva liscia (Catmull-Rom) attraverso i punti chiave
  for (let i = 1; i < P.length - 2; i++) {
    for (let j = 0; j < 6; j++) {
      const t = j / 6, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, e) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - e) * t2 + (-a + 3 * b - 3 * c + e) * t3);
      pts.push({ d: f(P[i - 1][0], P[i][0], P[i + 1][0], P[i + 2][0]), h: f(P[i - 1][1], P[i][1], P[i + 1][1], P[i + 2][1]) });
    }
  }
  pts.push({ d: key[key.length - 1][0], h: key[key.length - 1][1] });
  // la parte verso l'apertura è di cuscini trasparenti, più grigi (gli ultimi due terzi del tetto; sull'Allianz una fascia)
  const dSplit = d0 - (d0 - dIn) * (shell ? 0.7 : 0.35), split = Math.max(1, pts.findIndex(p => p.d < dSplit));
  // sull'involucro a cuscini la pianta è ripresa a passi uguali: i rombi restano dritti tutto intorno
  // petali: tonda fuori e a rettangolo arrotondato verso l'apertura (stessi punti per tutte le file: le pieghe restano
  // allineate)
  const nAt = (d) => 2.05 + 0.5 * Math.min(1, Math.max(0, (o - d) / (o - dIn))) ** 2;
  // fuori l'ovale finisce a punta sulle curve (a limone), verso l'apertura torna tondo
  const tipAt = (d) => 0.24 * Math.min(1, Math.max(0, (d - (o - 8)) / 10)) ** 0.8;
  const outline = (d) => (petals ? shellOutline(shape, d, PETAL_COLS, nAt(d), true, tipAt(d))
    : shell || tent ? evenOutline(shellOutline(shape, d, 960), 240) : shellOutline(shape, d));
  const rows = new Map(), rowAt = (d) => { const key = d.toFixed(3); if (!rows.has(key)) rows.set(key, outline(d)); return rows.get(key); };
  // tenda: la membrana è tirata su dai pennoni; petali: quattro lobi separati da valli sulle diagonali
  let yFn = null, masts = [], extra = 0, arches = 0, archQ = 0;
  if (tent) {
    // tenda: tre pennoni altissimi (uno su una curva, due verso gli angoli dell'altra) tirano su la membrana a punta;
    // in basso la membrana tocca terra solo nei piedi tra un arco e l'altro
    const ring = rowAt(o + 1), N = ring.length - 1;
    masts = [0.5, 0.17, 0.83].map(f => ring[Math.round(f * N) % N]);
    // la membrana sale un poco intorno ai pennoni; poi la avvolge la "tromba" (tentTrumpet) fin quasi in cima
    const P = 14, w = 11, jCrest = Math.max(1, pts.findIndex(p => p.h >= crest - 1));
    yFn = (x, z, j) => {
      const wj = Math.min(1, j / jCrest) * (j > jCrest ? Math.max(0.25, 1 - (j - jCrest) / (pts.length - jCrest)) : 1);
      let up = 0;
      for (const [mx, mz] of masts) up += P * Math.exp(-Math.hypot(x - mx, z - mz) / w);
      return up * wj;
    };
    extra = 58; // pennoni (fin dove arriva l'inquadratura)
    arches = 32;
    archQ = Math.max(1, pts.findIndex(p => p.h >= base + 10)); // archi alti circa 10 m
  }
  return { pts, nAt, split: tent ? pts.length - 1 : split, base, dIn, hIn: petals ? crest : crest - drop, top: crest + extra + (petals ? 14 : 0), out: Math.max(o + 12, ...pts.map(p => p.d + 1)), rowAt, yFn, masts, arches, archQ };
}

const WAVE_ROW = 240; // punti della pianta della copertura ondulata
const PETAL_COLS = 480; // punti della pianta dei petali

/**
 * Copertura ondulata (stile Vélodrome): pianta molto più tonda degli spalti fuori (quasi un cerchio) e che segue il
 * campo verso l'apertura; alta sopra le curve e bassa sui lati lunghi. Fuori una fascia bianca verticale: sui lati
 * lunghi scende quasi a terra, sulle curve resta alta e lascia vedere i piani in cemento sotto (e al centro della curva
 * verso +x sale sopra l'ingresso principale). Sopra la fascia il bordo arrotondato e il tetto che sale verso l'apertura.
 * hAt(x, z, f) = quota del tetto (f = 0 sul bordo fuori, 1 sull'apertura); rowAt(d) = pianta a distanza d.
 */
const waveCache = new WeakMap(); // una volta per forma e scelte (la pianta costa un po')
function waveOf(shape, st) {
  const key = [st.facade, st.roofReach].join('|'), memo = waveCache.get(shape) || new Map();
  waveCache.set(shape, memo);
  if (!memo.has(key)) memo.set(key, waveBuild(shape, st));
  return memo.get(key);
}
/**
 * Linea della cima degli spalti sotto la copertura ondulata, per la direzione del punto (x, z) vista dal centro: quota
 * del muretto dietro l'ultima fila (h, le file in più comprese), distanza dal centro (r) e quanto ci sono spalti (w: 1
 * dove ci sono, 0 dove no, sfumato tra un tratto e l'altro). Il soffitto della copertura ci si appoggia sopra.
 */
function standLine(shape) {
  const K = 720, H = new Array(K).fill(null), Rr = new Array(K).fill(null), bin = (x, z) => ((Math.atan2(z, x) / (2 * Math.PI)) % 1 + 1) % 1 * K;
  for (const run of shape.runs) {
    const T = run.tiers[run.tiers.length - 1];
    run.pts.forEach((p, i) => {
      const e = run.ext ? run.ext[i] : 0, d = T.back + e * TREAD + WALL, x = p.x + p.mx * d, z = p.z + p.mz * d, k = Math.round(bin(x, z)) % K;
      const h = extWall(T, e) + 0.1;
      if (H[k] === null || h > H[k]) { H[k] = h; Rr[k] = Math.hypot(x, z); }
    });
  }
  const W = H.map(h => (h === null ? 0 : 1));
  // riempie i buchi (tra un punto e l'altro, o dove non ci sono spalti) passando dolcemente dai vicini
  const fill = (tab) => {
    const known = tab.map((v, k) => (v === null ? -1 : k)).filter(k => k >= 0), out = tab.slice();
    if (!known.length) return out.fill(0);
    for (let k = 0; k < K; k++) {
      if (tab[k] !== null) continue;
      let a = known[known.length - 1] - K, b = known[0] + K;
      for (const j of known) { if (j < k) a = j; else { b = j; break; } }
      const va = tab[(a + K) % K], vb = tab[b % K];
      out[k] = va + (vb - va) * (k - a) / ((b - a) || 1);
    }
    return out;
  };
  const h = fill(H), r = fill(Rr);
  // spalti: 1 vicino ai punti, 0 nei buchi larghi (curve staccate, ferro di cavallo)
  const w = W.map((_, k) => { let near = Infinity; for (let j = -24; j <= 24; j++) if (W[(k + j + K) % K]) near = Math.min(near, Math.abs(j)); return near <= 6 ? 1 : near >= 24 ? 0 : 1 - (near - 6) / 18; });
  const at = (tab) => (x, z) => { const f = bin(x, z), k = Math.floor(f) % K, t = f - Math.floor(f); return tab[k] * (1 - t) + tab[(k + 1) % K] * t; };
  return { h: at(h), r: at(r), w: at(w) };
}
function waveBuild(shape, st) {
  const T = shape.tiers[shape.tiers.length - 1], o = shape.outer;
  const base = st.facade === 'esplanade' ? ESPLANADE_H : 0;
  const hS = T.top + 4, hE = T.top + 15, dE = o + 3, dIn = Math.min(o - 8, Math.max(-14, 1 - reachOf_(st)));
  const endF = (x, z) => Math.cos(Math.atan2(Math.abs(z) / shape.b, Math.abs(x) / shape.a)) ** 2; // 1 sulle curve, 0 sui lati
  // bordo fuori della copertura: alto sulle curve, basso sui lati
  const hSide = hS, hEnd = hE, edge = (x, z) => hSide + (hEnd - hSide) * endF(x, z);
  const rise = (x, z) => 3.5 + 5.5 * endF(x, z);
  const hAt = (x, z, f) => edge(x, z) + rise(x, z) * (1 - (1 - f) ** 2);
  // ingresso principale al centro della curva verso +x: lì la fascia sale ancora e lascia il portale più alto
  const ENTRY_W = 26, entryF = (x, z) => (x > 0 ? Math.cos(Math.min(1, Math.abs(z) / (ENTRY_W * 1.2)) * Math.PI / 2) ** 2 : 0);
  const inEntry = (x, z) => x > 0 && Math.abs(z) < ENTRY_W / 2 && Math.abs(z) < Math.abs(x) * 0.6;
  // fascia: sui lati lunghi scende quasi a terra, sulle curve resta alta e sotto si vedono i piani in cemento
  const bandBottom = (x, z) => {
    const e = endF(x, z) ** 1.5;
    return (base + 2.2) * (1 - e) + (base + (hEnd - base) * 0.42) * e + 4 * entryF(x, z);
  };
  // pianta: rettangolare verso l'apertura, molto più tonda verso fuori; ripresa a passi uguali (spicchi regolari)
  // sulle curve la parte fuori della copertura (sopra il retro degli spalti e la fascia) si allarga verso fuori:
  // lì gli spalti salgono fino alla copertura (roofRows)
  const ROOM = 8, d0 = o - 6, push = (d, x, z) => ROOM * Math.min(1, Math.max(0, (d - d0) / (dE - d0))) ** 1.5 * endF(x, z) ** 2;
  const rows = new Map(), rowAt = (d) => {
    const key = d.toFixed(3);
    if (!rows.has(key)) {
      const w = Math.min(1, Math.max(0, (d - dIn) / (dE - dIn))) ** 1.3;
      const a = shellOutline(shape, d, WAVE_ROW * 4), b = roundOutline(shape, d, WAVE_ROW * 4);
      rows.set(key, evenOutline(a.map((p, i) => {
        const x = p[0] + (b[i][0] - p[0]) * w, z = p[1] + (b[i][1] - p[1]) * w, l = Math.hypot(x, z) || 1, k = push(d, x, z);
        return [x + x / l * k, z + z / l * k];
      }), WAVE_ROW));
    }
    return rows.get(key);
  };
  // quota del tetto nel punto (x, z) a distanza dWorld dal bordo degli spalti (tiene conto dell'allargamento)
  const roofAt = (x, z, dWorld) => {
    let d = dWorld;
    for (let k = 0; k < 5; k++) d = dWorld - push(d, x, z);
    return hAt(x, z, (d - dE + 1.2) / (dIn - dE + 1.2));
  };
  // quanto la pianta esterna esce oltre il bordo degli spalti spostato (per il pavimento e l'inquadratura)
  let out = dE;
  for (const [x, z] of rowAt(dE)) {
    let best = null, bd = Infinity;
    for (const q of shape.path) { const dd = (x - q.x) ** 2 + (z - q.z) ** 2; if (dd < bd) { bd = dd; best = q; } }
    out = Math.max(out, (x - best.x) * best.mx + (z - best.z) * best.mz);
  }
  const rimSide = hAt(0, shape.b, 1), rimEnd = hAt(shape.a, 0, 1);
  // distanza lungo la direzione (ux, uz), da (px, pz), fino alla fascia esterna
  const beyond = (px, pz, ux, uz) => {
    let best = 0, bp = Infinity;
    for (const [x, z] of rowAt(dE)) {
      const t = (x - px) * ux + (z - pz) * uz, perp = Math.abs((x - px) * uz - (z - pz) * ux);
      if (t > 0 && perp < bp) { bp = perp; best = t; }
    }
    return best;
  };
  return { dIn, dE, hSide, hEnd, base, edge, hAt, roofAt, rowAt, bandBottom, entryF, inEntry, ENTRY_W, rimSide, rimEnd, beyond, out: out + 1, top: rimEnd + 1 };
}

/**
 * Ingresso principale del Vélodrome, al centro della curva verso +x sotto la fascia che sale: indici in fila dei punti
 * del portale (ent), retro (back, la vetrata), fuori (outer, sotto la fascia) e quota sotto la fascia (bb) per ogni
 * punto, normale verso fuori di ogni punto (nrm); sulla fascia sopra il portale il posto del logo (face, lo, hi).
 */
const veloCache = new WeakMap();
function veloEntryOf(shape, st) {
  if (st.roof !== 'wave') return null;
  const key = [st.facade, st.roofReach].join('|'), memo = veloCache.get(shape) || new Map();
  veloCache.set(shape, memo);
  if (!memo.has(key)) {
    const V = waveOf(shape, st), N = WAVE_ROW;
    const outer = V.rowAt(V.dE - 0.7), bb = outer.map(([x, z]) => V.bandBottom(x, z)), entry = outer.map(([x, z]) => V.inEntry(x, z));
    const back = evenOutline(shellOutline(shape, shape.outer + 1.2, N * 4), N);
    // punti del portale in fila (il portale può stare a cavallo dell'inizio della pianta)
    const ent = [], s0 = entry.findIndex((on, i) => on && !entry[(i - 1 + N) % N]);
    if (s0 >= 0) for (let k = 0; k < N && entry[(s0 + k) % N]; k++) ent.push((s0 + k) % N);
    const nrm = back.map(([x, z], i) => { const l = Math.hypot(outer[i][0] - x, outer[i][1] - z) || 1; return [(outer[i][0] - x) / l, (outer[i][1] - z) / l]; });
    // fascia sopra il portale: il punto più vicino all'asse x+
    const F = V.rowAt(V.dE);
    let fi = 0;
    F.forEach(([x, z], i) => { if (x > 0 && Math.abs(z) < Math.abs(F[fi][1])) fi = i; });
    const face = F[fi];
    memo.set(key, ent.length > 1 ? { V, outer, bb, entry, back, ent, nrm, face, lo: V.bandBottom(...face), hi: V.edge(...face) - 1.2 } : { V, outer, bb, entry, back, ent: [] });
  }
  const E = memo.get(key);
  return E;
}

/**
 * Pianta tonda (superellisse vicina al cerchio) che contiene gli spalti a distanza d. pull: quanto il lato corto si
 * avvicina a quello lungo (1 = cerchio); n: esponente (2 = ellisse). Punti chiusi [x, z].
 */
function roundOutline(shape, d, N = 240, pull = 0.3, n = 2.3) {
  const pts = shape.path.map(p => [p.x + p.mx * d, p.z + p.mz * d]);
  const A = Math.max(...pts.map(p => Math.abs(p[0]))), B0 = Math.max(...pts.map(p => Math.abs(p[1])));
  const B = B0 + (A - B0) * pull;
  const k = Math.max(1, ...pts.map(([x, z]) => Math.abs(x / A) ** n + Math.abs(z / B) ** n)) ** (1 / n);
  const out = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t);
    out.push([k * A * Math.sign(c) * Math.abs(c) ** (2 / n), k * B * Math.sign(sn) * Math.abs(sn) ** (2 / n)]);
  }
  return out;
}

/**
 * Superficie tra file di punti [x, y, z] (tutte con lo stesso numero di punti): u = posizione lungo la fila (cells
 * ripetizioni sul giro), v = metri lungo ogni colonna / vScale. La faccia di sopra guarda in alto.
 */
function sweepRows(THREE, rows, cells, vScale) {
  const pos = [], uv = [], idx = [], C = rows[0].length, vs = new Array(C).fill(0);
  rows.forEach((row, j) => {
    const us = [0];
    for (let i = 1; i < C; i++) us.push(us[i - 1] + Math.hypot(row[i][0] - row[i - 1][0], row[i][2] - row[i - 1][2]));
    const len = us[C - 1] || 1;
    row.forEach((p, i) => {
      if (j) vs[i] += Math.hypot(p[0] - rows[j - 1][i][0], p[1] - rows[j - 1][i][1], p[2] - rows[j - 1][i][2]) / vScale;
      pos.push(...p); uv.push(us[i] / len * cells, vs[i]);
    });
  });
  for (let j = 0; j < rows.length - 1; j++) for (let i = 0; i < C - 1; i++) { const a = j * C + i, b = a + C; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // a metà della superficie la normale deve puntare in alto: se no gira i triangoli
  if (rows.length > 2 && g.getAttribute('normal').getY(Math.floor(rows.length / 2) * C + Math.floor(C / 4)) < 0) {
    const ix = g.getIndex().array;
    for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; }
    g.computeVertexNormals();
  }
  return g;
}

/** Fascia esterna della copertura ondulata: bianca liscia, con le giunture verticali appena visibili. */
function waveBandCanvas() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 8;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f5f7f9'; ctx.fillRect(0, 0, 64, 8);
  ctx.fillStyle = '#d5dade'; ctx.fillRect(0, 0, 1.5, 8);
  return c;
}

/** Quota degli spalti (con il muro in cima) alla distanza d dal bordo: le travi sotto le coperture restano sopra. */
function standTopAt(shape, d) {
  let h = 0;
  for (const t of shape.tiers) if (d >= t.D - 0.5 && d <= t.back + WALL + 0.5) h = Math.max(h, Math.min(t.top + 2.2, t.H + Math.max(0, d - t.D) / TREAD * t.R + 1.2));
  return h;
}

/**
 * Cupola a raggiera (stile Samara): pianta ellittica più rotonda e molto più larga degli spalti, superficie liscia e
 * bassa che sale fino a una piccola apertura con l'anello in rilievo; alla base una corona di grandi denti triangolari.
 * Profilo (d, h) assoluto; rowAt(d) dà l'ellisse a quella distanza dal bordo degli spalti.
 */
function domeOf(shape, st) {
  const T = shape.tiers[shape.tiers.length - 1], o = shape.outer;
  const hb = 15, top = T.top + 15, dOut = o + 24, dIn = Math.min(o - 10, Math.max(-20, -10 - reachOf_(st)));
  // cupola: ripida al bordo e piatta in cima (passa sopra il muro in cima agli spalti)
  const pts = [], n = 22;
  for (let i = 0; i <= n; i++) { const f = i / n; pts.push({ d: dOut + (dIn - dOut) * f, h: hb + (top - hb) * Math.sqrt(1 - (1 - f) ** 2) }); }
  const rows = new Map(), rowAt = (d) => { const key = d.toFixed(3); if (!rows.has(key)) rows.set(key, domeOutline(shape, d)); return rows.get(key); };
  return { pts, dIn, dOut, hb, top, rowAt, out: dOut + 3, hIn: top };
}

/**
 * Corona di vele piegate: membrana bianca a zig-zag tutto intorno. Le creste vanno dall'anello in cima (fuori, il punto
 * più alto) al bordo verso il campo; le valli partono basse fuori, in cima alle colonne inclinate, salgono sopra il muro
 * e finiscono sul bordo verso il campo più indietro e più in basso (i denti). Da fuori le vele sono triangoli con la
 * punta in giù sulle colonne. Linee (d, h) dall'esterno verso il campo; rowAt(d) dà la pianta (superellisse).
 */
/** Pianta chiusa (punti [x, z], l'ultimo uguale al primo) ripresa in N tratti uguali lungo il giro. */
function evenOutline(dense, N) {
  const cum = [0];
  for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const out = [], total = cum[cum.length - 1];
  let j = 1;
  for (let i = 0; i <= N; i++) {
    const L = i / N * total;
    while (j < dense.length - 1 && cum[j] < L) j++;
    const f = (L - cum[j - 1]) / ((cum[j] - cum[j - 1]) || 1), a = dense[j - 1], b = dense[j];
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return out;
}

const CROWN_FOLDS = 44, CROWN_ROW = 264; // pieghe e punti della pianta: sei punti per piega
function crownOf(shape, st) {
  const T = shape.tiers[shape.tiers.length - 1], o = shape.outer;
  // colonne: a terra fuori dal muro (sulla spianata, se c'è, appena fuori dal muro)
  const esp = st.facade === 'esplanade', base = esp ? ESPLANADE_H : 0, dFoot = esp ? o + 1.2 : footOf(shape, st) + 0.5;
  const hR = T.top + 11, dV = dFoot + 4, dR = dV + 6, hV = base + (hR - base) * 0.46;
  const dIn = Math.min(o - 12, Math.max(-14, T.D - 2 - reachOf_(st))), hIn = hR - 3.5;
  const ridge = [{ d: dR, h: hR }, { d: o - 1, h: hR - 0.6 }, { d: dIn, h: hIn }];
  const valley = [{ d: dV, h: hV }, { d: o + 0.6, h: T.top + 4.2 }, { d: o - 3, h: T.top + 6 }, { d: Math.min(dIn + 6, o - 4), h: hIn - 4 }];
  for (const line of [ridge, valley]) {
    line.len = [0];
    for (let j = 1; j < line.length; j++) line.len.push(line.len[j - 1] + Math.hypot(line[j].d - line[j - 1].d, line[j].h - line[j - 1].h));
  }
  // punto a frazione t (0 fuori, 1 verso il campo) lungo una linea
  const at = (line, t) => {
    const L = t * line.len[line.length - 1];
    let j = 1;
    while (j < line.length - 1 && line.len[j] < L) j++;
    const f = (L - line.len[j - 1]) / ((line.len[j] - line.len[j - 1]) || 1);
    return { d: line[j - 1].d + (line[j].d - line[j - 1].d) * f, h: line[j - 1].h + (line[j].h - line[j - 1].h) * f };
  };
  // quota di una linea alla distanza d (le linee vanno verso il campo: d scende)
  const hAt = (line, d) => {
    if (d >= line[0].d) return line[0].h;
    for (let j = 1; j < line.length; j++) if (line[j].d <= d) { const a = line[j - 1], b = line[j]; return a.h + (b.h - a.h) * (a.d - d) / (a.d - b.d); }
    return line[line.length - 1].h;
  };
  // pianta: verso il campo segue gli spalti, da sopra il muro in fuori è quasi un cerchio; ripresa a passi uguali
  // lungo il giro (tutte le vele larghe uguali)
  const rows = new Map(), rowAt = (d) => {
    const key = d.toFixed(3);
    if (!rows.has(key)) {
      const w = Math.min(1, Math.max(0, (d - dIn) / (o - dIn))) ** 1.2;
      const a = shellOutline(shape, d, CROWN_ROW * 4), b = roundOutline(shape, d, CROWN_ROW * 4, 0.5, 2.1);
      rows.set(key, evenOutline(a.map((p, i) => [p[0] + (b[i][0] - p[0]) * w, p[1] + (b[i][1] - p[1]) * w]), CROWN_ROW));
    }
    return rows.get(key);
  };
  // quanto la pianta esterna esce oltre il bordo degli spalti spostato (per il pavimento e l'inquadratura)
  let out = dR + 2;
  for (const [x, z] of rowAt(dR)) {
    let best = null, bd = Infinity;
    for (const q of shape.path) { const dd = (x - q.x) ** 2 + (z - q.z) ** 2; if (dd < bd) { bd = dd; best = q; } }
    out = Math.max(out, (x - best.x) * best.mx + (z - best.z) * best.mz + 2);
  }
  return { ridge, valley, at, hAt, rowAt, o, base, dFoot, dV, hV, dR, hR, dIn, hIn, out };
}

/** Telo della corona: chiaro al centro di ogni falda, più scuro verso le pieghe, con due cuciture. */
function crownMembraneCanvas() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 16;
  const ctx = c.getContext('2d'), g = ctx.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, '#c2c9d0'); g.addColorStop(0.15, '#eceff2'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(0.85, '#eceff2'); g.addColorStop(1, '#c2c9d0');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 16);
  for (const x of [85, 170]) {
    const sg = ctx.createLinearGradient(x - 3, 0, x + 3, 0);
    sg.addColorStop(0, 'rgba(120,130,140,0)'); sg.addColorStop(0.5, 'rgba(120,130,140,0.3)'); sg.addColorStop(1, 'rgba(120,130,140,0)');
    ctx.fillStyle = sg; ctx.fillRect(x - 3, 0, 6, 16);
  }
  return c;
}

/** Ellisse (pianta della cupola) a distanza d dal bordo degli spalti: più rotonda degli spalti, li contiene tutti. */
function domeOutline(shape, d, N = 240) {
  const pts = shape.path.map(p => [p.x + p.mx * d, p.z + p.mz * d]);
  const A = Math.max(...pts.map(p => Math.abs(p[0]))), B0 = Math.max(...pts.map(p => Math.abs(p[1])));
  const B = B0 + (A - B0) * 0.4;
  const k = Math.sqrt(Math.max(1, ...pts.map(([x, z]) => (x / A) ** 2 + (z / B) ** 2)));
  const out = [];
  for (let i = 0; i <= N; i++) { const t = i / N * Math.PI * 2; out.push([k * A * Math.cos(t), k * B * Math.sin(t)]); }
  return out;
}

/**
 * Superficie che gira intorno con il profilo `prof`, con le coordinate per la texture allineate per colonna
 * (u = colonna / colonne * K): le linee a raggiera restano dritte da una riga all'altra.
 */
function sweepGrid(THREE, rowAt, prof, K, vScale) {
  const pos = [], uv = [], idx = [];
  let v = 0, cols = 0;
  prof.forEach((p, j) => {
    if (j) v += Math.hypot(p.d - prof[j - 1].d, p.h - prof[j - 1].h) / vScale;
    const row = rowAt(p.d);
    cols = row.length;
    row.forEach(([x, z], i) => { pos.push(x, p.h, z); uv.push(i / (cols - 1) * K, v); });
  });
  for (let j = 0; j < prof.length - 1; j++) for (let i = 0; i < cols - 1; i++) { const a = j * cols + i, b = a + cols; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Lamiera della cupola (un settore della raggiera per ripetizione, 9 m lungo il profilo): lastre aggraffate con le
 * nervature in rilievo che convergono verso l'apertura, il costolone più largo tra un settore e l'altro, i giunti di
 * testa delle lastre, toni appena diversi da una lastra all'altra e qualche colatura chiara.
 */
let domeMetalCache = null;
function domeMetalTexture() {
  if (domeMetalCache) return domeMetalCache;
  const sm = (a, b, t) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
  const W = 512, H = 128, SEAMS = 16;
  domeMetalCache = bakeTexture(W, H, 24, 9, 0.05, (x, y) => {
    const f = x / W, s = f * SEAMS, k = Math.floor(s), q = s - k, row = Math.floor(y / H * 3);
    // costolone tra i settori (bordo della ripetizione) e nervature delle lastre
    const rib = 1 - sm(0.006, 0.018, Math.min(f, 1 - f)), seam = 1 - sm(0.012, 0.05, Math.min(q, 1 - q));
    const lap = 1 - sm(0.004, 0.012, Math.min((y / H * 3) % 1, 1 - (y / H * 3) % 1));
    const tone = 0.95 + 0.04 * cellRnd(k, row, 91) + 0.025 * (grain(x, y, 32, W, H, 92) - 0.5);
    // la nervatura prende la luce da un lato e fa ombra dall'altro
    const side = seam > 0 ? (q < 0.5 ? 1.05 : 0.9) : 1;
    const v = 244 * tone * side * (1 - 0.1 * lap) * (rib > 0 ? 0.88 + 0.12 * (1 - rib) : 1);
    return [Math.min(255, v), Math.max(seam * 0.6, rib)];
  });
  return domeMetalCache;
}

/**
 * Soffitto sotto la cupola: pannelli chiari 3 x 1,5 m con le fughe scure e i fori delle bocchette (una ripetizione =
 * 12 x 6 m); il traliccio d'acciaio sotto è fatto di travi vere.
 */
let domeSoffitCache = null;
function domeSoffitTexture() {
  if (domeSoffitCache) return domeSoffitCache;
  const sm = (a, b, t) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
  domeSoffitCache = bakeTexture(256, 128, 12, 6, 0.01, (x, y) => {
    const mx = x / 256 * 12, my = y / 128 * 6, px = mx % 3, py = my % 1.5, edge = Math.min(px, 3 - px, py, 1.5 - py);
    const joint = 1 - sm(0.02, 0.05, edge), v = cellRnd(Math.floor(mx / 3), Math.floor(my / 1.5), 93);
    const vent = Math.hypot(px - 1.5, py - 0.75) < 0.12 ? 0.55 : 1;
    return [Math.min(255, (196 + 22 * v) * vent * (1 - 0.45 * joint)), 1 - joint];
  });
  return domeSoffitCache;
}

/**
 * Petali (stile Al Janoub). Coordinate sul guscio: tau = giro (0 al centro della curva verso +x, 0.25 al centro del lato
 * verso +z...), t = da 0 in basso a 1 sull'apertura. In basso (t < PB) le fasce di pieghe orizzontali tutto intorno;
 * sopra, in ogni quarto, un grande petalo con le pieghe a ventaglio che partono dal centro della curva (a metà
 * altezza, PF) e si aprono verso il lato lungo; al centro dei lati lunghi, sotto l'apertura, la "lingua" a V (punta a
 * PV, larga PVW quarti sull'apertura) con le pieghe che partono dalla punta. Giunture scure tra un petalo e l'altro.
 */
const PB = 0.1, PF = 0.24, PV = 0.2, PVW = 0.36, PLQ = 1.6;
/**
 * Quanto il guscio vicino all'apertura rientra verso il centro (m): molto al centro dei lati lunghi (le lingue chiudono
 * l'apertura), poco sulle curve.
 */
const PULL = 19;
const petalPull = (tau, t) => PULL * Math.min(1, Math.max(0, (t - 0.5) / 0.5)) ** 1.6 * (0.18 + 0.82 * Math.sin(2 * Math.PI * tau) ** 2);
/** Punto (x, z) del guscio spostato verso il centro di petalPull. */
const pulled = (x, z, tau, t) => { const l = Math.hypot(x, z) || 1, k = Math.max(0.2, 1 - petalPull(tau, t) / l); return [x * k, z * k]; };
/** Quanto si gonfia il guscio verso fuori (m): zero sulle giunture, di più al centro di ogni petalo. */
function petalBulge(tau, t) {
  if (t < PB) return 0.25 * Math.sin(Math.PI * t / PB) ** 2;
  const a = tau * 4, f = a - Math.floor(a), phi = Math.floor(a) % 2 ? 1 - f : f;
  const up = Math.sin(Math.PI * Math.min(1, (t - PB) / (1 - PB))) ** 0.6, vw = t > PV ? (t - PV) / (1 - PV) * PVW : 0;
  if (1 - phi < vw) return 0.35 * Math.sin(Math.PI * (1 - phi) / vw) ** 0.7 * up;
  return 0.6 * Math.sin(Math.PI * Math.min(1, phi / (1 - vw))) ** 0.6 * up;
}
/** Disegno delle pieghe dei petali nel materiale (attributo aPetal = [tau, t]): fuori il guscio, sotto le nervature. */
function petalShader(mat, under) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute vec2 aPetal;\nvarying vec2 vPetal;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vPetal = aPetal;');
    const body = under ? `
  // sotto: nervature curve chiare sul fondo scuro, una ogni 3 gradi, e gli anelli
  float rf = abs(fract(vPetal.x * 120.0) - 0.5) * 2.0, rw = fwidth(vPetal.x * 120.0);
  float rib = smoothstep(1.0 - max(0.12, rw * 2.0), 1.0, rf), ring = smoothstep(0.9, 1.0, abs(fract(vPetal.y * 9.0) - 0.5) * 2.0);
  float pShade = 0.8 + 0.6 * max(rib, ring * 0.5);
  diffuseColor.rgb *= pShade;` : `
  float tau = vPetal.x, t = vPetal.y, seam = 0.0, r;
  if (t < ${PB.toFixed(3)}) r = t / ${PB.toFixed(3)} * 6.0;
  else {
    float a = tau * 4.0, f = fract(a), phi = mod(floor(a), 2.0) > 0.5 ? 1.0 - f : f, dl = 1.0 - phi;
    float vw = t > ${PV.toFixed(3)} ? (t - ${PV.toFixed(3)}) / ${(1 - PV).toFixed(3)} * ${PVW.toFixed(3)} : 0.0;
    if (dl < vw) {
      seam = 1.0 - smoothstep(0.0, 0.01, vw - dl);
      r = atan(dl * ${PLQ.toFixed(2)}, t - ${PV.toFixed(3)}) * 9.5;
    } else {
      seam = max(1.0 - smoothstep(0.0, 0.006, phi), t < ${PV.toFixed(3)} ? 1.0 - smoothstep(0.0, 0.006, dl) : 1.0 - smoothstep(0.0, 0.01, dl - vw));
      r = atan(t - ${PF.toFixed(3)}, phi * ${PLQ.toFixed(2)}) * 9.0;
    }
  }
  // piega: una faccia che prende la luce, l'altra in ombra, il solco tra le due
  float sp = fract(r), w = fwidth(r);
  // lamiera a pieghe opaca: faccia bianca larga, faccia in ombra stretta e un filo scuro sullo spigolo
  float lit = 1.0 - smoothstep(0.5, 0.68, sp), shadow = smoothstep(0.5, 0.68, sp) * (1.0 - smoothstep(0.9, 1.0, sp));
  float pleat = lit * mix(0.95, 1.04, sp / 0.6) + shadow * mix(0.74, 0.86, (sp - 0.6) / 0.4);
  float groove = 1.0 - smoothstep(0.0, 0.04, min(sp, 1.0 - sp));
  float pShade = mix(pleat * (1.0 - 0.05 * groove), 0.97, clamp((w - 0.35) * 1.6, 0.0, 1.0)) * (1.0 - 0.12 * seam);
  pShade = mix(1.0, pShade, 0.3); // il chiaroscuro vero lo fa il rilievo (sotto): niente righe scure disegnate
  diffuseColor.rgb *= pShade;`;
    // rilievo: ogni piega è un dente (sale piano, scende ripida) alto PA metri; la normale segue la pendenza
    const relief = under ? '' : `
  {
    vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition), nN = normal;
    vec3 R1 = cross(sy, nN), R2 = cross(nN, sx);
    float fDet = dot(sx, R1), fade = 1.0 - clamp((w - 0.5) * 1.6, 0.0, 1.0);
    // piega a spigolo vivo (come la carta piegata): faccia dritta che sale fino al colmo a punta (a 0,55), faccia dritta
    // che scende nel solco a punta; alta 1 m, così una faccia prende la luce e l'altra resta in ombra
    float slope = (sp < 0.55 ? 1.0 / 0.55 : -1.0 / 0.45) * 1.0 * fade * (1.0 - seam);
    vec2 dH = slope * vec2(dFdx(r), dFdy(r));
    normal = normalize(abs(fDet) * nN - sign(fDet) * (dH.x * R1 + dH.y * R2));
  }`;
    sh.fragmentShader = 'varying vec2 vPetal;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', '#include <map_fragment>' + body)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>' + relief)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= pShade;');
  };
  mat.customProgramCacheKey = () => (under ? 'petals-under' : 'petals');
}

/**
 * Guscio dei petali sulle file del profilo (S.pts, S.rowAt): gonfio al centro dei petali, con le coordinate aPetal per
 * il disegno delle pieghe; le giunture scure (travi sottili) vanno in seamsOut.
 */
function petalsGeometry(THREE, S, seamsOut) {
  const rows = S.pts.length, pos = [], ap = [], idx = [], L = [0];
  // t misurata lungo il profilo (da terra all'apertura): la V e i ventagli cadono sul fianco come nella realtà
  for (let j = 1; j < rows; j++) L.push(L[j - 1] + Math.hypot(S.pts[j].d - S.pts[j - 1].d, S.pts[j].h - S.pts[j - 1].h));
  const T = L.map(l => l / L[rows - 1]);
  let N = 0;
  const lift = (x, z, y, b) => { const l = Math.hypot(x, z) || 1; return [x + x / l * b, y + b * 0.3, z + z / l * b]; };
  S.pts.forEach((p, j) => {
    const row = S.rowAt(p.d), t = T[j];
    N = row.length - 1;
    row.forEach(([x0, z0], i) => { const tau = i / N, [x, z] = pulled(x0, z0, tau, t); pos.push(...lift(x, z, p.h, petalBulge(tau, t))); ap.push(tau, t); });
  });
  for (let j = 0; j < rows - 1; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + N + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  // giunture: centro delle curve (sopra le fasce), centro dei lati lunghi (fino alla punta della V), bordi della lingua
  const at = (j, tau) => {
    const row = S.rowAt(S.pts[j].d), f = (((tau % 1) + 1) % 1) * N, i = Math.floor(f), k = f - i, A = row[i], B = row[Math.min(N, i + 1)];
    const [x, z] = pulled(A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, tau, T[j]);
    return lift(x, z, S.pts[j].h + 0.08, 0);
  };
  const line = (tauOf, j0, j1) => { for (let j = j0; j < j1; j++) { const a = tauOf(j), b = tauOf(j + 1); if (a !== null && b !== null) beam(seamsOut, ...at(j, a), ...at(j + 1, b), 0.32); } };
  const jB = T.findIndex(t => t >= PB), jV = T.findIndex(t => t >= PV), vwAt = (j) => Math.max(0, (T[j] - PV) / (1 - PV)) * PVW;
  for (const c of [0, 0.5]) line(() => c, jB, rows - 1);
  for (const c of [0.25, 0.75]) {
    line(() => c, jB, jV);
    for (const sg of [-1, 1]) line((j) => c + sg * vwAt(j) / 4, jV, rows - 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aPetal', new THREE.Float32BufferAttribute(ap, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Pianta dell'involucro a distanza d dal bordo degli spalti: un ovale "smussato" (superellisse, tra l'ellisse e il
 * rettangolo arrotondato) il più tondo possibile che contiene ancora gli spalti a quella distanza. Punti chiusi [x, z].
 */
function shellOutline(shape, d, N = 240, nMin = 2.4, force = false, tip = 0) {
  const pts = shape.path.map(p => [p.x + p.mx * d, p.z + p.mz * d]);
  const A = Math.max(...pts.map(p => Math.abs(p[0]))), B = Math.max(...pts.map(p => Math.abs(p[1])));
  if (tip > 0) {
    // ovale a punta sulle x (a limone, solo verso le estremità): larghezza (1 - |u|^n)^(1/n)·(1 - u⁴)^tip; la misura più
    // piccola che contiene gli spalti si cerca per tentativi
    const w = (u) => (u >= 1 ? 0 : Math.max(0, 1 - u ** nMin) ** (1 / nMin) * (1 - u ** 4) ** tip);
    const fits = (k) => pts.every(([x, z]) => Math.abs(z) <= k * B * w(Math.abs(x) / (k * A)) + 1e-6);
    let lo = 1, hi = 1.6;
    while (!fits(hi)) hi *= 1.2;
    for (let it = 0; it < 22; it++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
    const out = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t), x = hi * A * Math.sign(c) * Math.abs(c) ** (2 / nMin);
      const u = Math.abs(x) / (hi * A);
      out.push([x, hi * B * Math.sign(sn) * Math.abs(sn) ** (2 / nMin) * (1 - u ** 4) ** tip]);
    }
    return out;
  }
  const worst = (n) => Math.max(...pts.map(([x, z]) => Math.abs(x / A) ** n + Math.abs(z / B) ** n));
  let n = nMin, scale = 1;
  if (force) scale = Math.max(1, worst(n)) ** (1 / n);             // esponente scelto (petali): ovale che contiene gli spalti
  else if (worst(4) > 1) { n = 4; scale = worst(4) ** (1 / 4); }      // forme squadrate: rettangolo arrotondato un po' più grande
  else if (worst(n) > 1) {
    let lo = n, hi = 4;
    for (let it = 0; it < 18; it++) { const mid = (lo + hi) / 2; if (worst(mid) > 1) lo = mid; else hi = mid; }
    n = hi;
  }
  const out = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t);
    out.push([scale * A * Math.sign(c) * Math.abs(c) ** (2 / n), scale * B * Math.sign(sn) * Math.abs(sn) ** (2 / n)]);
  }
  return out;
}

/**
 * Travi rosse (stile San Siro): quattro torri sulle diagonali, appena fuori dall'esterno, e quattro travi reticolari
 * che passano sopra le torri (x = ±X e z = ±Z), sopra il tetto, e continuano a sbalzo per GIRDER_L metri.
 */
function girdersOf(shape, st) {
  const R = roofOf(shape, st.roof, reachOf_(st)), foot = footOf(shape, st);
  // distanza dal centro dell'angolo, lungo la diagonale, del punto più esterno dell'esterno (angolo vivo: √2 volte)
  const diag = (shape.r > 0 ? shape.r + foot : foot * Math.SQRT2) + CORNER_R + 1;
  // le due travi si incrociano sulla torre, che sale più in alto di loro
  const X = shape.a - shape.r + diag / Math.SQRT2, Z = shape.b - shape.r + diag / Math.SQRT2;
  const y0 = R.h(R.dIn) + 2, top = y0 + GIRDER_H;
  return { X, Z, y0, top, towerTop: top + TOWER_OVER, towers: [[X, Z], [-X, Z], [-X, -Z], [X, -Z]] };
}

/** Fin dove arrivano le parti esterne (distanza dal bordo, altezza, estensione): per inquadratura, ombre e pavimento. */
function reachOf(shape, st) {
  const foot = footOf(shape, st);
  let d = foot + 0.5, h = shape.height, x = 0, z = 0;
  if (SHELLISH.includes(st.roof)) { const S = shellOf(shape, st); d = Math.max(d, S.out + 1); h = Math.max(h, S.top + 1); }
  else if (st.roof === 'wave') {
    const V = waveOf(shape, st), VE = veloEntryOf(shape, st);
    d = Math.max(d, V.out + 1);
    h = Math.max(h, V.top + 1);
    // piazzetta davanti all'ingresso del Vélodrome
    if (VE && VE.ent.length > 1) { const c = VE.ent[Math.floor(VE.ent.length / 2)]; d = Math.max(d, shape.outer + 1.2 + Math.hypot(VE.outer[c][0] - VE.back[c][0], VE.outer[c][1] - VE.back[c][1]) + 19); }
  }
  else if (st.roof === 'dome') { const D = domeOf(shape, st); d = Math.max(d, D.out + 1); h = Math.max(h, D.top + 3); }
  else if (st.roof === 'crown') { const C = crownOf(shape, st); d = Math.max(d, C.out + 1); h = Math.max(h, C.hR + 2); }
  else if (st.roof === 'blades') { const L = bladesOf(shape, st); d = Math.max(d, L.out + 1); h = Math.max(h, L.top + 1); }
  else if (st.roof !== 'none') { const R = roofOf(shape, st.roof, reachOf_(st)); d = Math.max(d, st.roof === 'truss' ? pylonDist(R) + 2.5 : R.dOut); h = Math.max(R.h(R.dIn), st.roof === 'truss' ? pylonHeight(R) : 0) + 1; }
  if (st.ramps) d = Math.max(d, foot + RAMP_R * 2);
  if (st.ramps && WRAP_ROOFS.includes(st.roof)) d += RAMP_R * 2 + 1; // le torri stanno fuori dall'involucro
  if (st.facade === 'cladding') d = Math.max(d, foot + 12); // torri d'angolo, pensilina e gradini dell'ingresso
  if (st.roof === 'stands') { const R = roofOf(shape, 'stands', reachOf_(st)); d = Math.max(d, R.dOut + STANDS_MAST_OUT + 10); h = Math.max(h, R.h(R.dIn) + 18); }
  if (st.roof === 'girders') {
    const G = girdersOf(shape, st);
    d = Math.max(d, foot + CORNER_R * 2 + 2);
    h = Math.max(h, G.towerTop + 8);
    x = G.X + CORNER_R + 3 + GIRDER_L + 2; z = G.Z + CORNER_R + 3 + GIRDER_L + 2;
  } else if (lightsOf(st) === 'towers') { d = Math.max(d, towerDist(shape, st) + 6); h = towerHeight(shape, st) + 6; }
  if (st.screen !== 'none' && st.roof === 'none') h = Math.max(h, screenOf(shape, st).y + (st.screen === 'ends' ? ENDS_H : SCREEN_H) + 1);
  if (st.roof === 'dragon') {
    const D = dragonOf(shape, st);
    d = Math.max(d, D.out + 1); h = Math.max(h, D.hC + 3);
    if (hasDragonTail(shape, st)) for (const p of dragonTail(shape).pts) { x = Math.max(x, Math.abs(p.x) + D.out + 4); z = Math.max(z, Math.abs(p.z) + D.out + 4); }
  }
  for (const e of entrancesOf(shape, st)) { d = Math.max(d, e.d + e.g.depth + 14); h = Math.max(h, e.g.TH ? e.g.TH + 10 : e.H + 6, e.g.logo.v + e.g.logo.s / 2 + 1); }
  return { d: d + 1.5, h, x, z };
}

/* ------------------------------------------------------- maxischermo e scritte */
const SCREEN_H = 4.2, SCREEN_PANEL = SCREEN_H * 8; // anello: alto 4,2 m, la tela (1024 x 128) copre 33,6 m
const ENDS_W = 26, ENDS_H = 7;                       // schermi sopra le curve

/**
 * Dove sta il maxischermo: distanza dal bordo degli spalti (ds) e quota. Con la copertura è appeso sotto il bordo
 * del tetto (y = lato alto, roofY = sotto del tetto per i tiranti), senza copertura poggia sul muro in cima agli spalti (y = lato basso).
 */
function screenOf(shape, st) {
  const T = shape.tiers[shape.tiers.length - 1];
  if (st.roof === 'blades') {
    // sotto il bordo dell'apertura del tetto a lame
    const L = bladesOf(shape, st), ds = L.dIn + 2.2;
    return { ds, hang: true, y: L.hIn - 2.4, roofY: L.hIn - 1 };
  }
  if (st.roof === 'wave') {
    // sotto il bordo dell'apertura: l'anello alla quota più bassa (sui lati lunghi), gli schermi delle curve più in alto
    const V = waveOf(shape, st), ds = V.dIn + 1.5;
    if (st.screen === 'ends') return { ds, hang: true, y: V.rimEnd - 5, roofY: V.rimEnd - 1.2 };
    return { ds, hang: true, y: V.rimSide - 4.4, roofY: V.rimSide - 1.2 };
  }
  if (st.roof === 'dome') {
    const D = domeOf(shape, st), ds = Math.max(D.dIn + 3, T.D + 2);
    return { ds, hang: true, y: D.top - 6, roofY: D.top - 1 };
  }
  if (st.roof === 'crown') {
    // appeso sotto le valli (la parte più bassa della corona)
    const C = crownOf(shape, st), ds = Math.max(C.dIn + 3, T.D + 2), roofY = C.hAt(C.valley, ds);
    return { ds, hang: true, y: roofY - 1.2, roofY };
  }
  if (SHELLISH.includes(st.roof)) {
    const S = shellOf(shape, st), ds = S.dIn + 3;
    let hr = S.hIn;
    for (let j = 1; j < S.pts.length; j++) {
      const a = S.pts[j - 1], b = S.pts[j];
      if ((a.d - ds) * (b.d - ds) <= 0 && a.d !== b.d) hr = Math.max(hr, a.h + (b.h - a.h) * (ds - a.d) / (b.d - a.d));
    }
    return { ds, hang: true, y: hr - 2.4, roofY: hr };
  }
  if (st.roof !== 'none') {
    const R = roofOf(shape, st.roof, reachOf_(st)), ds = R.dIn + 0.9, ribbed = st.roof === 'truss' || st.roof === 'girders';
    // tetto per tribuna: sotto la fascia con la riga colorata
    return { ds, hang: true, y: R.h(R.dIn) - (st.roof === 'stands' ? STANDS_FASCIA + 0.8 : 3.2), roofY: R.h(ds) - (ribbed ? R.depth(ds) : 0.4) };
  }
  return { ds: T.back + WALL / 2, hang: false, y: T.top + 2.2 };
}

/** Tela dei cartelloni LED: quattro pannelli da 6 m alternati (colore con il nome, bianco con FANTACAPP), righe dei LED. */
function paintAds(canvas, name, color) {
  const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height, P = W / 4;
  const font = (px) => `900 ${px}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let k = 0; k < 4; k++) {
    const on = k % 2 === 0, x = k * P;
    ctx.fillStyle = on ? color : '#f4f6f8'; ctx.fillRect(x, 0, P, H);
    ctx.fillStyle = on ? '#ffffff' : color;
    const text = on ? name : 'FANTACAPP';
    ctx.font = font(58);
    const w = ctx.measureText(text).width;
    if (w > P * 0.88) ctx.font = font(58 * P * 0.88 / w);
    ctx.fillText(text, x + P / 2, H / 2 + 3);
  }
  ctx.fillStyle = 'rgba(0,0,0,.16)';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
}

/** Immagine del maxischermo: nome dello stadio, punteggio, campo e minuto (anello) o tabellone (sopra le curve). */
function paintScreen(canvas, kind, name, color) {
  const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, shade(color, 1.35)); bg.addColorStop(1, shade(color, 0.7));
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const font = (px) => `900 ${px}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  const fit = (text, x, y, maxW, px) => {
    ctx.font = font(px);
    const w = ctx.measureText(text).width;
    if (w > maxW) ctx.font = font(px * maxW / w);
    ctx.fillText(text, x, y);
  };
  const pitch = (x, y, w, h) => {
    ctx.fillStyle = '#2f9a3e'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#38ad48';
    for (let i = 0; i < 8; i += 2) ctx.fillRect(x + w * i / 8, y, w / 8, h);
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = Math.max(1.5, h / 40);
    ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
    ctx.beginPath(); ctx.moveTo(x + w / 2, y + 4); ctx.lineTo(x + w / 2, y + h - 4); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, h / 6, 0, Math.PI * 2); ctx.stroke();
  };
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (kind === 'ring') {
    fit(name, 170, H / 2 + 4, 300, 54);
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(338, 14, 4, H - 28);
    pitch(360, 12, 230, H - 24);
    ctx.fillStyle = '#fff'; fit('2 - 1', 705, H / 2 + 4, 200, 80);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(820, 18, 186, H - 36);
    ctx.fillStyle = '#fff'; fit("88:10", 913, H / 2 + 3, 160, 52);
  } else {
    fit(name, W / 2, H * 0.17, W * 0.9, 50);
    pitch(30, H * 0.34, W * 0.27, H * 0.5);
    pitch(W - 30 - W * 0.27, H * 0.34, W * 0.27, H * 0.5);
    fit('2 - 1', W / 2, H * 0.6, W * 0.36, 120);
    fit("88:10", W / 2, H * 0.88, W * 0.3, 34);
  }
}

/**
 * Dove va la scritta sull'esterno, sui due lati lunghi: quota del centro (hc), altezza massima (maxH), distanza dal
 * bordo a ogni quota (dAt) e pianta chiusa a quella distanza (outline). Segue l'esterno scelto: involucro, ringhiera
 * della piattaforma, cornicione, pilastri o muro.
 */
function signOf(shape, st) {
  const T = shape.tiers[shape.tiers.length - 1], o = shape.outer, Ht = T.top + 2.2;
  if (st.roof === 'dragon') {
    // sui pannelli del lato fuori del nastro (sopra i tubi)
    const D = dragonOf(shape, st), wall = D.prof.slice(0, D.prof.findIndex(p => p.h >= D.hC * 0.99) + 1);
    const dAt = (h) => {
      for (let j = 1; j < wall.length; j++) if (wall[j].h >= h) { const a = wall[j - 1], b = wall[j]; return a.d + (b.d - a.d) * (h - a.h) / (b.h - a.h) + 0.25; }
      return wall[wall.length - 1].d + 0.25;
    };
    const outline = (dd) => { const pts = shape.path.map(p => [p.x + p.mx * dd, p.z + p.mz * dd]); pts.push(pts[0]); return pts; };
    return { hc: D.hC * 0.77, maxH: D.hC * 0.2, standOn: 0, dAt, outline, rows: 6 };
  }
  if (st.roof === 'blades') {
    // sulle lame della facciata, al centro dei lati lunghi (lì il bordo è più alto)
    const L = bladesOf(shape, st), E = L.H0 + L.A, f = L.facade.map(([d, h]) => ({ d, h: h(0, shape.b) }));
    const dAt = (h) => {
      for (let j = 1; j < f.length; j++) if (f[j].h >= h) { const a = f[j - 1], b = f[j]; return a.d + (b.d - a.d) * (h - a.h) / ((b.h - a.h) || 1) + 0.3; }
      return f[f.length - 1].d + 0.3;
    };
    return { hc: L.base + (E - L.base) * 0.5, maxH: Math.min(7, (E - L.base) * 0.35), standOn: 0, dAt, outline: L.rowAt, rows: 6 };
  }
  if (st.roof === 'wave') {
    // sulla fascia bianca della copertura, al centro dei lati lunghi (sopra l'ingresso, dove la fascia è più bassa)
    const V = waveOf(shape, st), d = V.dE + 0.25, lo = V.bandBottom(0, shape.b), hi = V.hSide - 1.2;
    return { hc: (lo + hi) / 2, maxH: Math.min(6, hi - lo - 1.2), standOn: 0, dAt: () => d, outline: V.rowAt, rows: 1 };
  }
  if (SHELLISH.includes(st.roof) || st.roof === 'dome') {
    const S = st.roof === 'dome' ? domeOf(shape, st) : shellOf(shape, st), wall = [];
    // muro gonfio dell'involucro: punti dal basso fino alla cresta (la quota sale)
    for (const p of S.pts) { if (wall.length && p.h <= wall[wall.length - 1].h) break; wall.push(p); }
    // tenda: la falda scende larga fino a terra, la scritta va a metà altezza (sopra gli archi)
    const best = st.roof === 'tent' ? wall.reduce((m, p) => (Math.abs(p.h - S.top * 0.28) < Math.abs(m.h - S.top * 0.28) ? p : m), wall[0])
      : wall.reduce((m, p) => (p.d > m.d ? p : m), wall[0]);
    const dAt = (h) => {
      for (let j = 1; j < wall.length; j++) if (wall[j].h >= h) { const a = wall[j - 1], b = wall[j]; return a.d + (b.d - a.d) * (h - a.h) / (b.h - a.h) + 0.2; }
      return wall[wall.length - 1].d + 0.2;
    };
    return { hc: best.h, maxH: 8.5, standOn: 0, dAt, outline: S.rowAt, rows: 8 };
  }
  const outline = (d) => { const pts = shape.path.map(p => [p.x + p.mx * d, p.z + p.mz * d]); pts.push(pts[0]); return pts; };
  if (st.facade === 'cladding') {
    // sui pannelli chiari, nella fascia libera più alta tra zoccolo, vetrate e cornicione
    const above = st.logoPlaces && st.logoPlaces.includes('entrance') ? 1.6 + LOGO_ENTRANCE + 0.6 : 4.5; // sopra il portale (e il logo)
    const cuts = [[0, cladPodium(Ht) + above], ...cladBands(shape.tiers), [Ht - cladCornice(Ht) - 1.2, Ht]];
    let best = [0, 0], end = 0;
    for (const [a, b] of cuts.sort((p, q) => p[0] - q[0])) { if (a - end > best[1] - best[0]) best = [end, a]; end = Math.max(end, b); }
    return { hc: (best[0] + best[1]) / 2, maxH: Math.max(2, Math.min(7, best[1] - best[0] - 1.2)), standOn: 0, dAt: () => o + 0.9, outline, rows: 1 }; // davanti alle lesene
  }
  const free = Math.min(6, Math.max(3, Ht * 0.2));
  const [d, hc, maxH, standOn] = {
    struts: [o + PLATFORM_OUT + 0.12, 0, 4.2, PLATFORM_H + 1.15],              // in piedi sulla ringhiera della piattaforma, davanti ai piloni
    bands: [o + 1.95, Ht - 5, 6.5],                                            // in alto sulla facciata, tra una torre e l'altra
    columns: [o + 0.8, Ht * 0.62, free]                                         // davanti ai pilastri
  }[st.facade] || [o + 0.08, Math.max(Ht * 0.62, (st.facade === 'esplanade' ? ESPLANADE_H : 0) + 4.5), free];
  return { hc, maxH, standOn, dAt: () => d, outline, rows: 1 };
}

/**
 * Ingombri grandi davanti alla facciata (torri delle rampe, piloni del tetto reticolare) sui lati lunghi, a distanza
 * maggiore di d: per lato (+1 z > 0, -1 z < 0) gli intervalli di x occupati. La scritta va negli spazi liberi.
 */
function signObstacles(shape, st, d) {
  const out = { 1: [], [-1]: [] }, foot = footOf(shape, st);
  const G = st.roof === 'girders' ? girdersOf(shape, st) : null;
  const towers = [];
  if (st.ramps) {
    for (const run of shape.runs) {
      const cum = runLengths(run);
      for (const u of rampUs(shape, st, run, cum)) {
        const [x, z] = rampTowerAt(shape, st, run, cum, u, foot);
        towers.push([x, z, RAMP_R + 0.6]);
      }
    }
  }
  if (st.roof === 'truss') {
    const R = roofOf(shape, st.roof, reachOf_(st)), PD = pylonDist(R);
    if (PD + 1.6 > d) {
      for (const run of shape.runs) {
        const cum = runLengths(run);
        for (const u of stations(run, cum, PYLON_EVERY, PD)) { const [x, z] = pointAt(run, cum, u, PD); towers.push([x, z, 3.2]); }
      }
    }
  }
  for (const [x, z, r] of towers) if (Math.abs(z) > shape.b * 0.6) out[Math.sign(z)].push([x - r, x + r]);
  // gli ingressi sui lati lunghi: la scritta va di lato
  for (const e of entrancesOf(shape, st)) if (e.side === 0 || e.side === 2) out[e.side === 0 ? 1 : -1].push([-e.W / 2 - 3, e.W / 2 + 3]);
  return out;
}

/** Tratto libero più largo tra -half e half, tolti gli intervalli occupati: [centro, larghezza]. */
function widestGap(half, busy) {
  const cuts = busy.filter(([a, b]) => b > -half && a < half).sort((p, q) => p[0] - q[0]);
  let best = [0, 0], x = -half;
  for (const [a, b] of [...cuts, [half, half]]) {
    if (a - x > best[1]) best = [(a + x) / 2, a - x];
    x = Math.max(x, b);
  }
  return best;
}

/** Contorno ben visibile per una scritta di colore `hex`: scuro sulle lettere chiare, bianco su quelle scure. */
function contrastOf(hex) {
  const n = parseInt(hex.slice(1), 16), l = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return l > 150 ? '#1b1e23' : '#ffffff';
}

/** z del contorno chiuso `poly` alla x data, sul lato sgn (+1 z > 0, -1 z < 0); il punto più esterno. */
function zOn(poly, x, sgn) {
  let best = -Infinity;
  for (let j = 1; j < poly.length; j++) {
    const a = poly[j - 1], b = poly[j];
    if (a[1] * sgn <= 0 && b[1] * sgn <= 0) continue;
    if ((a[0] - x) * (b[0] - x) > 0 || a[0] === b[0]) continue;
    best = Math.max(best, (a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0])) * sgn);
  }
  return best === -Infinity ? null : best * sgn;
}

/**
 * Scritta sull'esterno: un nastro con la scritta che segue la facciata, su ciascun lato lungo, nel tratto libero più
 * largo (tra torri e piloni) e leggibile da fuori. Stile: lettere con contorno, insegna con fondo, luminosa o solo lettere;
 * dimensione: fattore sull'altezza adatta a quella facciata. Si accende di notte.
 */
function buildSign(THREE, shape, st, text, color, panel) {
  const style = st.outerTextStyle, c = document.createElement('canvas'), ctx = c.getContext('2d');
  const font = fontCss(fontOf(st.outerTextFont), 120);
  ctx.font = font;
  const m = ctx.measureText(text), asc = m.actualBoundingBoxAscent || 88, desc = m.actualBoundingBoxDescent || 4;
  const wide = Math.max(m.width, (m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || 0));
  const line = style === 'outline' || style === 'lit' ? 16 : 0, pad = style === 'panel' ? 46 : 26 + line;
  c.width = Math.ceil(wide + pad * 2); c.height = Math.ceil(asc + desc + (style === 'panel' ? 70 : 30 + line * 2));
  if (style === 'panel') {
    // insegna: fondo pieno con il bordo del colore delle lettere
    ctx.fillStyle = panel; ctx.strokeStyle = color; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(5, 5, c.width - 10, c.height - 10, 18) : ctx.rect(5, 5, c.width - 10, c.height - 10);
    ctx.fill(); ctx.stroke();
  }
  ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
  const y = (c.height - asc - desc) / 2 + asc;
  if (line) { ctx.strokeStyle = contrastOf(color); ctx.lineWidth = line; ctx.strokeText(text, c.width / 2, y); }
  ctx.fillStyle = color;
  ctx.fillText(text, c.width / 2, y);
  const aspect = c.width / c.height;

  const k0 = (TEXT_SIZES.find(z => z.id === st.outerTextSize) || TEXT_SIZES[1]).k;
  if (st.outerTextPlace === 'roof' && st.roof !== 'none' && !WRAP_ROOFS.includes(st.roof)) {
    // appesa sotto il bordo davanti del tetto dei lati lunghi, rivolta verso il campo (si legge dagli spalti di fronte)
    const R = roofOf(shape, st.roof, reachOf_(st)), half = Math.max(6, shape.a - shape.r) * 0.85;
    let H = Math.min(5.5, 3.2 * k0), W = H * aspect;
    if (W > 2 * half) { H *= 2 * half / W; W = 2 * half; }
    const yTop = R.h(R.dIn) - 0.3, yBot = yTop - H, pos = [], uv = [], idx = [];
    for (const sgn of [1, -1]) {
      const b = pos.length / 3, z = sgn * (shape.b + R.dIn - 0.15);
      // dal campo: guardando verso +z la destra è -x, verso -z la destra è +x
      const xl = sgn > 0 ? W / 2 : -W / 2, xr = -xl;
      pos.push(xl, yBot, z, xr, yBot, z, xr, yTop, z, xl, yTop, z);
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    return finishSign(THREE, c, style, pos, uv, idx);
  }
  const sg = signOf(shape, st), mid = sg.outline(sg.dAt(sg.hc || sg.standOn));
  // larghezza: il tratto quasi dritto del lato lungo, tolti torri e piloni davanti alla facciata
  const zmax = Math.max(...mid.map(p => p[1])), half = Math.max(...mid.filter(p => p[1] >= zmax - 1.2).map(p => Math.abs(p[0]))) * 0.92;
  const busy = signObstacles(shape, st, sg.dAt(sg.hc || sg.standOn));
  const gaps = { 1: widestGap(half, busy[1]), [-1]: widestGap(half, busy[-1]) };
  let H = sg.maxH * k0, W = H * aspect;
  const maxW = Math.max(6, Math.min(gaps[1][1], gaps[-1][1]) - 1);
  if (W > maxW) { H *= maxW / W; W = maxW; }
  const hb = sg.standOn ? sg.standOn : sg.hc - H / 2, NR = sg.rows, NC = Math.max(8, Math.ceil(W / 0.7));
  const pos = [], uv = [], idx = [];
  for (const sgn of [1, -1]) {
    const base = pos.length / 3, xc = gaps[sgn][0];
    for (let r = 0; r <= NR; r++) {
      const h = hb + H * r / NR, poly = sg.outline(sg.dAt(h));
      for (let i = 0; i <= NC; i++) {
        const t = i / NC, x = sgn > 0 ? xc - W / 2 + W * t : xc + W / 2 - W * t; // da fuori si legge da sinistra a destra
        const z = zOn(poly, x, sgn) ?? sgn * zmax, z0 = zOn(poly, x - 0.5, sgn) ?? z, z1 = zOn(poly, x + 0.5, sgn) ?? z;
        const nx = -(z1 - z0) * sgn, nz = sgn, nl = Math.hypot(nx, nz);
        pos.push(x + nx / nl * 0.06, h, z + nz / nl * 0.06);
        uv.push(t, r / NR);
      }
    }
    for (let r = 0; r < NR; r++) for (let i = 0; i < NC; i++) {
      const a = base + r * (NC + 1) + i, b = a + NC + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  return finishSign(THREE, c, style, pos, uv, idx);
}

/** Mesh della scritta dalla tela e dai vertici. */
function finishSign(THREE, c, style, pos, uv, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  // un po' di luce propria anche di giorno: la scritta resta leggibile sul lato in ombra
  const day = style === 'lit' ? 0.75 : 0.2, night = style === 'lit' ? 1.25 : 0.9;
  const mat = new THREE.MeshStandardMaterial({
    map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: day, transparent: true, alphaTest: 0.35, roughness: 0.5,
    side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
  });
  const mesh = new THREE.Mesh(g, mat);
  return { mesh, mat, glow: (on) => { mat.emissiveIntensity = on ? night : day; }, dispose() { g.dispose(); mat.dispose(); tex.dispose(); } };
}

/** Lunghezze progressive del bordo interno lungo un tratto (per mettere oggetti a passo regolare). */
function runLengths(run) {
  const P = run.pts, n = P.length, segs = run.closed ? n : n - 1;
  const cum = [0];
  for (let i = 0; i < segs; i++) { const j = (i + 1) % n; cum.push(cum[i] + Math.hypot(P[j].x - P[i].x, P[j].z - P[i].z)); }
  return cum;
}

/**
 * Posizioni a passo regolare lungo il tratto (sui tratti aperti anche alle due estremità), come u (metri lungo il bordo
 * interno, per pointAt). Il passo è misurato alla distanza d dal bordo, dove le cose vengono disegnate: altrimenti sulle
 * curve (più lunghe fuori che dentro) si diradano e sui lati si ammassano. Sui giri chiusi il numero è un multiplo di 4 e
 * si parte dall'asse x: le quattro parti dello stadio sono una lo specchio dell'altra.
 */
function stations(run, cum, step, d = 0) {
  const P = run.pts, n = P.length, segs = run.closed ? n : n - 1, cd = [0];
  const at = (p) => [p.x + p.mx * d, p.z + p.mz * d];
  for (let i = 0; i < segs; i++) { const [ax, az] = at(P[i]), [bx, bz] = at(P[(i + 1) % n]); cd.push(cd[i] + Math.hypot(bx - ax, bz - az)); }
  const total = cd[segs];
  const toU = (L) => {
    let lo = 0, hi = segs - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (cd[mid] <= L) lo = mid; else hi = mid - 1; }
    const f = cd[lo + 1] > cd[lo] ? Math.min(1, Math.max(0, (L - cd[lo]) / (cd[lo + 1] - cd[lo]))) : 0;
    return cum[lo] + (cum[lo + 1] - cum[lo]) * f;
  };
  if (!run.closed) {
    const count = Math.max(1, Math.round(total / step));
    return Array.from({ length: count + 1 }, (_, k) => toU(k * total / count));
  }
  let count = Math.max(1, Math.round(total / step));
  if (count >= 4) count = Math.max(4, Math.round(total / step / 4) * 4);
  let L0 = 0;
  for (let i = 0; i < segs; i++) {
    const [ax, az] = at(P[i]), [bx, bz] = at(P[(i + 1) % n]);
    if (ax > 0 && (az < 0) !== (bz < 0)) { L0 = cd[i] + (cd[i + 1] - cd[i]) * (-az / ((bz - az) || 1)); break; }
  }
  return Array.from({ length: count }, (_, k) => toU((L0 + k * total / count) % total)).sort((a, b) => a - b);
}

/** Punto [x, z] a distanza d dal bordo, alla posizione u (metri lungo il bordo interno) del tratto. */
function pointAt(run, cum, u, d) {
  const P = run.pts, n = P.length;
  let lo = 0, hi = cum.length - 2;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (cum[mid] <= u) lo = mid; else hi = mid - 1; }
  const j = (lo + 1) % n, seg = cum[lo + 1] - cum[lo];
  const f = seg > 0 ? Math.min(1, Math.max(0, (u - cum[lo]) / seg)) : 0;
  const ax = P[lo].x + P[lo].mx * d, az = P[lo].z + P[lo].mz * d;
  return [ax + (P[j].x + P[j].mx * d - ax) * f, az + (P[j].z + P[j].mz * d - az) * f];
}

/**
 * Matrice di un parallelepipedo (cubo unitario) con assi già scalati e centro (cx, cy, cz).
 * Gli assi devono formare una terna destra (ax × ay verso az): con i pezzi ripetuti (InstancedMesh)
 * una terna rovesciata nasconde le facce esterne.
 */
function boxAt(out, cx, cy, cz, ax, ay, az) {
  out.push(ax[0], ax[1], ax[2], 0, ay[0], ay[1], ay[2], 0, az[0], az[1], az[2], 0, cx, cy, cz, 1);
}

/** Trave a sezione quadrata t da (x1, y1, z1) a (x2, y2, z2): tralicci e pilastri. */
function beam(out, x1, y1, z1, x2, y2, z2, t) {
  let dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
  const len = Math.hypot(dx, dy, dz) || 1;
  dx /= len; dy /= len; dz /= len;
  let ax = -dz, az = dx, al = Math.hypot(ax, az);   // orizzontale, perpendicolare alla trave
  if (al < 1e-4) { ax = 1; az = 0; al = 1; }
  ax /= al; az /= al;
  const bx = -az * dy, by = az * dx - ax * dz, bz = ax * dy;
  boxAt(out, (x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2, [dx * len, dy * len, dz * len], [bx * t, by * t, bz * t], [ax * t, 0, az * t]);
}

/** Trave reticolare piana da (x1, z1) a (x2, z2): correnti a quota yb(f) e yt(f) (f da 0 a 1), montanti e diagonali alternate. */
function truss(out, x1, z1, x2, z2, yb, yt, panels, tc, tm) {
  let prev = null;
  for (let k = 0; k <= panels; k++) {
    const f = k / panels, x = x1 + (x2 - x1) * f, z = z1 + (z2 - z1) * f, b = yb(f), tp = yt(f);
    beam(out, x, b, z, x, tp, z, tm);
    if (prev) {
      beam(out, prev.x, prev.b, prev.z, x, b, z, tc);
      beam(out, prev.x, prev.tp, prev.z, x, tp, z, tc);
      if (k % 2) beam(out, prev.x, prev.b, prev.z, x, tp, z, tm); else beam(out, prev.x, prev.tp, prev.z, x, b, z, tm);
    }
    prev = { x, z, b, tp };
  }
}

/** Proiettore largo w e alto h in (x, y, z), rivolto verso il centro del campo (la faccia accesa è +z). */
function lampAt(out, x, y, z, w, h) {
  let fx = -x, fy = -y, fz = -z;
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  let rx = fz, rz = -fx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;   // su × avanti
  const ux = fy * rz, uy = fz * rx - fx * rz, uz = -fy * rx;                  // avanti × destra
  boxAt(out, x, y, z, [rx * w, 0, rz * w], [ux * h, uy * h, uz * h], [fx * 0.5, fy * 0.5, fz * 0.5]);
}

/** Batteria di fari (cols x rows) su un telaio scuro, in (x, y, z), rivolta verso il centro del campo come lampAt. */
function lampBank(lampsOut, frameOut, x, y, z, cols, rows) {
  let fx = -x, fy = -y, fz = -z;
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  let rx = fz, rz = -fx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
  const ux = fy * rz, uy = fz * rx - fx * rz, uz = -fy * rx;
  const W = cols * 1.2 + 0.4, H = rows * 0.95 + 0.35;
  boxAt(frameOut, x, y, z, [rx * W, 0, rz * W], [ux * H, uy * H, uz * H], [fx * 0.35, fy * 0.35, fz * 0.35]);
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const a = (i - (cols - 1) / 2) * 1.2, b = (j - (rows - 1) / 2) * 0.95;
      lampAt(lampsOut, x + rx * a + ux * b + fx * 0.3, y + uy * b + fy * 0.3, z + rz * a + uz * b + fz * 0.3, 1.0, 0.78);
    }
  }
}

/**
 * Pannelli del tetto come texture vera (grigio da moltiplicare per il colore, con il rilievo), una ripetizione ogni
 * ROOF_PANEL metri: lamiera grecata (reticolare), lamiera aggraffata (moderna) o "botti" di
 * policarbonato (travi rosse). Le righe corrono verso il campo.
 */
const roofTexCache = new Map();
function roofTexture(kind) {
  if (roofTexCache.has(kind)) return roofTexCache.get(kind);
  const P = ROOF_PANEL, W = 256, H = 256, sm = (a, b, t) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
  let out;
  if (kind === 'corrugated') {
    // greche ogni 50 cm e un sormonto ogni 5 m verso il campo
    out = bakeTexture(W, H, P, P, 0.06, (x, y) => {
      const t = (x / W * P / 0.5) % 1, rib = sm(0.15, 0.3, t) * (1 - sm(0.55, 0.7, t)), lap = y < 3 ? 0.8 : 1;
      return [(214 + 30 * rib) * lap * (0.97 + 0.03 * grain(x, y, 8, W, H, 21)), rib];
    });
  } else if (kind === 'barrel') {
    // due botti di policarbonato per pannello, chiare al centro, con la costola tra una e l'altra
    out = bakeTexture(W, H, P, P, 0.5, (x) => {
      const t = (x / W * 2) % 1, h = Math.sin(Math.PI * t), seam = t < 0.04 || t > 0.96;
      return [seam ? 150 : 175 + 75 * Math.sqrt(h), h];
    });
  } else {
    // lamiera aggraffata: aggraffature ogni 62,5 cm, pannelli con toni appena diversi
    out = bakeTexture(W, H, P, P, 0.05, (x, y) => {
      const mx = x / W * P, k = Math.floor(mx / 0.625), t = (mx / 0.625) % 1;
      const seam = 1 - sm(0.0, 0.08, Math.min(t, 1 - t));
      const tone = 0.95 + 0.05 * cellRnd(k, 0, 23) + 0.03 * (grain(x, y, 6, W, H, 24) - 0.5);
      return [238 * tone * (1 - 0.12 * seam), 0.2 + 0.8 * seam];
    });
  }
  roofTexCache.set(kind, out);
  return out;
}

/**
 * Pezzi di un tratto dove pred(punto del bordo) è vero, come tratti aperti: per mettere qualcosa
 * solo sui lati lunghi o solo sulle curve.
 */
function subRuns(run, pred) {
  const P = run.pts, n = P.length, ok = P.map(pred);
  if (ok.every(Boolean)) return [run];
  const start = run.closed ? ok.findIndex(v => !v) : 0, out = [];
  let cur = [];
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n;
    if (ok[i]) cur.push(P[i]);
    else { if (cur.length > 1) out.push({ pts: cur, closed: false }); cur = []; }
  }
  if (cur.length > 1) out.push({ pts: cur, closed: false });
  return out;
}


/**
 * Membrana della tenda: le file del profilo, ma in ogni colonna il bordo in basso parte più in alto dove c'è un arco
 * (la membrana tocca terra solo nei piedi tra un arco e l'altro). Coordinate per la texture lungo il giro e il profilo.
 */
const TENT_FLARE = 18; // raggio della tromba dove parte dalla membrana
function tentGeometry(THREE, S, cells) {
  const Q = S.pts.length - 1, rows = S.pts.map(p => S.rowAt(p.d)), N = rows[0].length - 1, K = Q;
  const L = [0];
  for (let j = 1; j <= Q; j++) L.push(L[j - 1] + Math.hypot(S.pts[j].d - S.pts[j - 1].d, S.pts[j].h - S.pts[j - 1].h));
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, A = S.archQ * Math.abs(Math.sin(Math.PI * S.arches * t)) ** 0.7;
    for (let k = 0; k <= K; k++) {
      const q = A + (Q - A) * k / K, j0 = Math.min(Q - 1, Math.floor(q)), f = q - j0;
      const a = rows[j0][i], b = rows[j0 + 1][i], x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f;
      pos.push(x, S.pts[j0].h + (S.pts[j0 + 1].h - S.pts[j0].h) * f + (S.yFn ? S.yFn(x, z, q) : 0), z);
      uv.push(t * cells, (L[j0] + (L[j0 + 1] - L[j0]) * f) / SHELL_CELL_V);
    }
  }
  // intorno ai pennoni la membrana diventa la tromba: lì si toglie (niente doppio strato)
  const R2 = (TENT_FLARE - 1.2) ** 2;
  const hole = (a, b, c) => S.masts.some(([mx, mz]) => {
    const x = (pos[a * 3] + pos[b * 3] + pos[c * 3]) / 3 - mx, z = (pos[a * 3 + 2] + pos[b * 3 + 2] + pos[c * 3 + 2]) / 3 - mz;
    return x * x + z * z < R2;
  });
  for (let i = 0; i < N; i++) for (let k = 0; k < K; k++) {
    const a = i * (K + 1) + k, b = a + K + 1;
    if (!hole(a, b, a + 1)) idx.push(a, b, a + 1);
    if (!hole(a + 1, b, b + 1)) idx.push(a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * "Tromba" di membrana che avvolge un pennone: parte larga sulla membrana (a raggio rb, alle quote trovate sulla
 * membrana con baseY) e si stringe fino al pennone a quota yt. Coordinate per la texture come la membrana (maglie che
 * convergono sul pennone).
 */
function tentTrumpet(THREE, mx, mz, baseY, yt, rb, rm) {
  const NA = 48, K = 28, pos = [], uv = [], idx = [], cells = Math.max(4, Math.round(Math.PI * 2 * rb / SHELL_CELL_U));
  const yb = Array.from({ length: NA + 1 }, (_, i) => baseY(mx + Math.cos(i / NA * Math.PI * 2) * rb, mz + Math.sin(i / NA * Math.PI * 2) * rb));
  for (let i = 0; i <= NA; i++) {
    const a = i / NA * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
    let v = 0, prev = null;
    for (let k = 0; k <= K; k++) {
      const t = k / K, r = rm + (rb - rm) * (1 - t) ** 3, y = yb[i] + (yt - yb[i]) * t ** 0.9;
      const p = [mx + c * r, y, mz + sn * r];
      if (prev) v += Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]) / SHELL_CELL_V;
      pos.push(...p); uv.push(i / NA * cells, v);
      prev = p;
    }
  }
  for (let i = 0; i < NA; i++) for (let k = 0; k < K; k++) { const a = i * (K + 1) + k, b = a + K + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Rete della tenda: maglie quadrate (5 x 3 per cella dell'involucro, circa 1,4 m) con i cavi chiari; il canale alfa
 * (alphaMap) lascia i cavi pieni e le maglie mezze trasparenti.
 */
function netCanvases() {
  const W = 320, H = 192, mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return [c, c.getContext('2d')]; };
  const [map, m] = mk(), [alpha, a] = mk();
  m.fillStyle = '#eef0f2'; m.fillRect(0, 0, W, H);
  a.fillStyle = '#b4b4b4'; a.fillRect(0, 0, W, H);
  for (const [ctx, col, w] of [[m, '#ffffff', 3], [a, '#ffffff', 4]]) {
    ctx.fillStyle = col;
    for (let x = 0; x < W; x += 64) ctx.fillRect(x, 0, w, H);
    for (let y = 0; y < H; y += 64) ctx.fillRect(0, y, W, w);
  }
  return { map, alpha };
}

/**
 * Disegni dell'involucro senza cuscini (quasi bianchi: il colore scelto li tinge, di notte si accendono): costole dei
 * petali o tinta unita. Restituisce la tela e quante volte ripeterla per ogni cella da SHELL_CELL_U x SHELL_CELL_V metri.
 */
function shellPatternCanvas(kind) {
  const make = (W, H) => { const c = document.createElement('canvas'); c.width = W; c.height = H; return [c, c.getContext('2d')]; };
  if (kind === 'ribs') {
    // costole bianche che corrono lungo il profilo (petali)
    const [c, ctx] = make(64, 8), g = ctx.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, '#8c949d'); g.addColorStop(0.1, '#e8ebee'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(0.88, '#d6dbe0'); g.addColorStop(1, '#8c949d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 8);
    return { canvas: c, rx: 1, ry: 1 };
  }
  // tinta unita (tenda)
  const [c, ctx] = make(8, 8);
  ctx.fillStyle = '#f2f4f6'; ctx.fillRect(0, 0, 8, 8);
  return { canvas: c, rx: 1, ry: 1 };
}

/** Disegni dei cuscini fatti come texture vera (colore + rilievo): dimensione di una ripetizione in metri. */
const CUSHIONS = {
  rhombus: { W: 1024, H: 472, tileU: 10, tileV: 4.6, bulge: 0.9 },  // rombi larghi il doppio che alti (Allianz Arena)
  hex:     { W: 296, H: 512, tileU: 3.8, tileV: 6.6, bulge: 0.5 },
  scales:  { W: 512, H: 256, tileU: 6, tileV: 3, bulge: 0.45 },   // squame tonde a file sfalsate
  stripes: { W: 8, H: 256, tileU: 2, tileV: 2.8, bulge: 0.35 },
  quilt:   { W: 192, H: 128, tileU: 6, tileV: 4.5, bulge: 1.4, joint: [176, 183, 191], seam: 0.975 } // spicchi radiali (Vélodrome)
};

/**
 * Cuscini dell'involucro come texture vera: per ogni pixel quanto è gonfio il cuscino (1 al centro, 0 sulle giunture),
 * da cui il colore (bianco, un po' più scuro verso le giunture, giunture argento) e la mappa del rilievo, così la
 * luce li fa sembrare gonfi da qualsiasi parte li guardi. Senza cuciture: si ripete in tutte e due le direzioni.
 */
/**
 * Tela di colore + rilievo (normal map) per pixel: fn(x, y) dà [grigio 0..255, altezza 0..1] (o [r, g, b, altezza]).
 * tileU / tileV = metri coperti da una ripetizione, bulge = quanto sporge il rilievo (m). Si ripete senza cuciture.
 */
function bakeTexture(W, H, tileU, tileV, bulge, fn) {
  const make = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const map = make(), nrm = make(), mctx = map.getContext('2d'), nctx = nrm.getContext('2d');
  const mi = mctx.createImageData(W, H), ni = nctx.createImageData(W, H), hgt = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = y * W + x, v = fn(x + 0.5, y + 0.5);
      const [r, g, b, h] = v.length === 2 ? [v[0], v[0], v[0], v[1]] : v;
      mi.data[k * 4] = r; mi.data[k * 4 + 1] = g; mi.data[k * 4 + 2] = b; mi.data[k * 4 + 3] = 255;
      hgt[k] = h;
    }
  }
  const su = bulge / (2 * tileU / W), sv = bulge / (2 * tileV / H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = y * W + x;
      const gx = (hgt[y * W + (x + 1) % W] - hgt[y * W + (x - 1 + W) % W]) * su;
      const gy = (hgt[((y + 1) % H) * W + x] - hgt[((y - 1 + H) % H) * W + x]) * sv;
      const nx = -gx, ny = gy, l = Math.hypot(nx, ny, 1);
      ni.data[k * 4] = (nx / l * 0.5 + 0.5) * 255; ni.data[k * 4 + 1] = (ny / l * 0.5 + 0.5) * 255; ni.data[k * 4 + 2] = (1 / l * 0.5 + 0.5) * 255; ni.data[k * 4 + 3] = 255;
    }
  }
  mctx.putImageData(mi, 0, 0); nctx.putImageData(ni, 0, 0);
  return { canvas: map, normal: nrm, tileU, tileV };
}

/**
 * Rivestimento verticale tutto intorno a distanza off dal muro esterno di ogni tratto, da h0 fino in cima al tratto,
 * con le coordinate per una texture di tileU x tileV metri (sui giri chiusi un numero intero di ripetizioni).
 */
function outerSkin(THREE, shape, off, tileU, tileV, h0 = 0) {
  const pos = [], uv = [], idx = [];
  for (const run of shape.runs) {
    const o = runOuter(run) + off, H = wallTopOf(run), P = run.closed ? [...run.pts, run.pts[0]] : run.pts;
    const pts = P.map(p => [p.x + p.mx * o, p.z + p.mz * o]), L = [0];
    for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const len = L[L.length - 1] || 1, k = run.closed ? Math.max(1, Math.round(len / tileU)) / len : 1 / tileU;
    const b = pos.length / 3;
    pts.forEach(([x, z], i) => { pos.push(x, h0, z, x, H, z); uv.push(L[i] * k, h0 / tileV, L[i] * k, H / tileV); });
    for (let i = 0; i < pts.length - 1; i++) { const a = b + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Numero pseudo-casuale 0..1 fisso per una cella (i, j) e un seme. */
const cellRnd = (i, j, seed = 0) => {
  let h = Math.imul(i * 374761393 + j * 668265263 + seed * 2147483647, 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Grana fine ripetibile (rumore a valori su una griglia, interpolato): 0..1. */
function grain(x, y, cells, W, H, seed) {
  const gx = x / W * cells, gy = y / H * cells, i = Math.floor(gx), j = Math.floor(gy), fx = gx - i, fy = gy - j;
  const r = (a, b) => cellRnd(((a % cells) + cells) % cells, ((b % cells) + cells) % cells, seed);
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return (r(i, j) * (1 - sx) + r(i + 1, j) * sx) * (1 - sy) + (r(i, j + 1) * (1 - sx) + r(i + 1, j + 1) * sx) * sy;
}

/**
 * Texture del muro esterno (grigio da tingere col colore del muro, con il rilievo): intonaco, cemento a pannelli,
 * mattoni, pietra, lamiera grecata, lamelle, finestre a nastro, archi. Dimensioni vere in metri.
 */
const wallTexCache = new Map();
function wallTexture(kind) {
  if (wallTexCache.has(kind)) return wallTexCache.get(kind);
  const sm = (a, b, t) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
  let out;
  if (kind === 'concrete') {
    // pannelli prefabbricati 6 x 3 m allineati, giunti incassati, fori dei distanziatori, macchie
    const W = 512, H = 512, PU = 6, PV = 3; // la tela copre 12 x 12 m
    out = bakeTexture(W, H, 12, 12, 0.05, (x, y) => {
      const mx = x / W * 12, my = y / H * 12, row = Math.floor(my / PV), off = 0;
      const px = ((mx + off) % PU + PU) % PU, py = my % PV, col = Math.floor((mx + off) / PU);
      const edge = Math.min(px, PU - px, py, PV - py), joint = 1 - sm(0.035, 0.08, edge);
      const tone = 0.9 + 0.1 * cellRnd(col, row, 3) + 0.08 * (grain(x, y, 16, W, H, 1) - 0.5) + 0.04 * (grain(x, y, 64, W, H, 2) - 0.5);
      const hole = [0.5, PU - 0.5].some(hx => [0.5, PV - 0.5].some(hy => Math.hypot(px - hx, py - hy) < 0.05)) ? 0.55 : 1;
      return [230 * tone * (1 - 0.45 * joint) * hole, 1 - joint];
    });
  } else if (kind === 'brick') {
    // mattoni (un po' più grandi del vero perché si vedano da lontano) sfalsati, malta chiara incassata
    const W = 512, H = 512, BU = 0.5, BV = 0.17, TU = 4, TV = BV * 24;
    out = bakeTexture(W, H, TU, TV, 0.025, (x, y) => {
      const mx = x / W * TU, my = y / H * TV, row = Math.floor(my / BV), off = (row % 2) * BU / 2;
      const px = ((mx + off) % BU + BU) % BU, py = my % BV, col = Math.floor((mx + off) / BU) % (TU / BU);
      const edge = Math.min(px, BU - px, py, BV - py), mortar = 1 - sm(0.008, 0.02, edge);
      const v = cellRnd(col, row, 5), tone = 0.78 + 0.3 * v + 0.08 * (grain(x, y, 48, W, H, 4) - 0.5);
      const g = 225 * tone;
      return [g * (1 - mortar) + 245 * mortar, 1 - mortar * 0.9];
    });
  } else if (kind === 'stone') {
    // blocchi di pietra di lunghezza variabile, smussati, toni diversi
    const W = 512, H = 512, TU = 6.4, TV = 6.4, BV = 0.8;
    out = bakeTexture(W, H, TU, TV, 0.08, (x, y) => {
      const mx = x / W * TU, my = y / H * TV, row = Math.floor(my / BV), py = my % BV;
      // tagli della fila: posizioni fisse per fila (la tela si ripete), larghezze 1,2..2 m
      let a = 0, b = TU, k = 0, start = cellRnd(row, 0, 9) * 1.2;
      const cuts = [];
      for (let u = start; u < TU + start; u += 1.2 + cellRnd(row, ++k, 7) * 0.8) cuts.push(u % TU);
      cuts.sort((p, q) => p - q);
      let idx = cuts.length - 1;
      for (let i = 0; i < cuts.length; i++) if (cuts[i] <= mx) idx = i;
      a = cuts[idx]; b = cuts[(idx + 1) % cuts.length]; if (b <= a) b += TU;
      const pxa = ((mx - a) % TU + TU) % TU, w = b - a;
      const edge = Math.min(pxa, w - pxa, py, BV - py), bevel = sm(0.02, 0.09, edge);
      const tone = 0.82 + 0.22 * cellRnd(row, idx, 11) + 0.1 * (grain(x, y, 40, W, H, 6) - 0.5);
      return [235 * tone * (0.62 + 0.38 * bevel), bevel];
    });
  } else if (kind === 'metal') {
    // lamiera grecata verticale: greche trapezoidali ogni 60 cm
    const W = 256, H = 64, TU = 2.4, TV = 0.6;
    out = bakeTexture(W, H, TU, TV, 0.08, (x) => {
      const t = (x / W * TU / 0.6) % 1, ridge = sm(0.12, 0.28, t) * (1 - sm(0.62, 0.78, t));
      return [205 + 35 * ridge - 18 * (t > 0.28 && t < 0.4 ? 1 : 0), ridge];
    });
  } else if (kind === 'louvres') {
    // lamelle orizzontali inclinate ogni 90 cm, con l'ombra sotto
    const W = 64, H = 256, TU = 0.8, TV = 3.6;
    out = bakeTexture(W, H, TU, TV, 0.12, (x, y) => {
      const t = (y / H * TV / 0.9) % 1;
      const slat = t < 0.72 ? 0.35 + 0.65 * (t / 0.72) : 0;
      const g = t < 0.72 ? 200 + 45 * (t / 0.72) : 110;
      return [g, slat];
    });
  } else if (kind === 'windows') {
    // un piano ogni 4 m: fascia piena e nastro di finestre scure con i montanti ogni 1,5 m
    const W = 384, H = 256, TU = 6, TV = 4;
    out = bakeTexture(W, H, TU, TV, 0.06, (x, y) => {
      const mx = x / W * TU, my = (1 - y / H) * TV, inWin = my > 1.3 && my < 3.1;
      const mull = Math.min(mx % 1.5, 1.5 - (mx % 1.5)) < 0.06;
      if (inWin && !mull) {
        const refl = 0.75 + 0.35 * (my - 1.3) / 1.8;
        return [52 * refl, 64 * refl, 78 * refl, 0];
      }
      const sill = Math.abs(my - 1.3) < 0.08 ? 0.92 : 1;
      return [228 * sill * (0.95 + 0.05 * grain(x, y, 12, W, H, 8)), inWin ? 0.6 : 1];
    });
  } else if (kind === 'arches') {
    // portico di archi a tutto sesto (5 m) alto 9 m e sopra muro con finestre quadrate; la tela copre un piano alto 12 m
    const W = 256, H = 512, TU = 5, TV = 12;
    out = bakeTexture(W, H, TU, TV, 0.25, (x, y) => {
      const mx = x / W * TU, my = (1 - y / H) * TV, cx = TU / 2, r = 1.9, pier = 0.6;
      const inArch = Math.abs(mx - cx) < r && (my < 6.5 || Math.hypot(mx - cx, my - 6.5) < r);
      const win = Math.abs(mx - cx) < 0.7 && my > 9.6 && my < 11.2;
      if (inArch) return [60, 66, 74, 0];
      if (win) return [70, 80, 92, 0.2];
      const cornice = Math.abs(my - 8.9) < 0.18 ? 1 : 0.85, g = 232 * (0.95 + 0.05 * grain(x, y, 8, W, H, 12));
      return [g * (cornice > 0.9 ? 1.02 : 1), g, g, cornice];
    });
  } else {
    // intonaco: quasi liscio, grana leggera e qualche macchia
    const W = 256, H = 256;
    out = bakeTexture(W, H, 6, 6, 0.01, (x, y) => {
      const n = 0.7 * grain(x, y, 8, W, H, 13) + 0.3 * grain(x, y, 48, W, H, 14);
      return [222 + 26 * n, n];
    });
  }
  wallTexCache.set(kind, out);
  return out;
}

/**
 * Texture dei pavimenti (chiare, da tingere col colore scelto, con il rilievo): gomma della pista, resina, cemento,
 * piastrelle, sampietrini, asfalto, prato. Dimensioni vere in metri.
 */
const floorTexCache = new Map();
function floorTexture(kind) {
  if (floorTexCache.has(kind)) return floorTexCache.get(kind);
  const sm = (a, b, t) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
  let out;
  if (kind === 'tartan') {
    // gomma a granuli: puntini chiari e scuri fitti, appena ruvida
    out = bakeTexture(256, 256, 2, 2, 0.006, (x, y) => {
      const n = cellRnd(x | 0, y | 0, 41), g = grain(x, y, 32, 256, 256, 42);
      return [214 + 30 * (n - 0.5) + 18 * (g - 0.5), n];
    });
  } else if (kind === 'resin') {
    out = bakeTexture(128, 128, 4, 4, 0.002, (x, y) => [232 + 14 * (grain(x, y, 8, 128, 128, 43) - 0.5), 0.5]);
  } else if (kind === 'concrete') {
    // lastre 2 x 2 m, giunti sottili, macchie
    out = bakeTexture(256, 256, 4, 4, 0.01, (x, y) => {
      const mx = x / 256 * 4, my = y / 256 * 4, px = mx % 2, py = my % 2, edge = Math.min(px, 2 - px, py, 2 - py);
      const joint = 1 - sm(0.012, 0.03, edge), tone = 0.93 + 0.05 * cellRnd(Math.floor(mx / 2), Math.floor(my / 2), 44) + 0.06 * (grain(x, y, 24, 256, 256, 45) - 0.5);
      return [228 * tone * (1 - 0.35 * joint), 1 - joint];
    });
  } else if (kind === 'tiles') {
    // piastrelle 60 cm con le fughe chiare
    out = bakeTexture(256, 256, 2.4, 2.4, 0.006, (x, y) => {
      const mx = x / 256 * 2.4, my = y / 256 * 2.4, px = mx % 0.6, py = my % 0.6, edge = Math.min(px, 0.6 - px, py, 0.6 - py);
      const grout = 1 - sm(0.006, 0.014, edge), v = cellRnd(Math.floor(mx / 0.6), Math.floor(my / 0.6), 46);
      return [(218 + 26 * v) * (1 - grout) + 246 * grout, 1 - grout];
    });
  } else if (kind === 'cobbles') {
    // sampietrini (più grandi del vero per vederli): file sfalsate, bombati, fughe scure
    out = bakeTexture(256, 256, 2.4, 2.4, 0.04, (x, y) => {
      const S = 0.3, mx = x / 256 * 2.4, my = y / 256 * 2.4, row = Math.floor(my / S), off = (row % 2) * S / 2;
      const px = ((mx + off) % S + S) % S, py = my % S, edge = Math.min(px, S - px, py, S - py), col = Math.floor((mx + off) / S);
      const h = sm(0.0, 0.05, edge), v = cellRnd(col, row, 47);
      return [(150 + 80 * v) * (0.55 + 0.45 * h), h];
    });
  } else if (kind === 'plaza') {
    // lastre di granito 1,2 x 0,6 m a correre (file sfalsate), toni appena diversi, fughe sottili e una fascia più scura
    // ogni 4,8 m
    out = bakeTexture(256, 256, 4.8, 4.8, 0.008, (x, y) => {
      const mx = x / 256 * 4.8, my = y / 256 * 4.8, row = Math.floor(my / 0.6), off = (row % 2) * 0.6;
      const px = ((mx + off) % 1.2 + 1.2) % 1.2, py = my % 0.6, edge = Math.min(px, 1.2 - px, py, 0.6 - py);
      const joint = 1 - sm(0.008, 0.02, edge), v = cellRnd(Math.floor((mx + off) / 1.2), row, 52);
      const band = row % 8 === 0 ? 0.82 : 1, speck = cellRnd(x | 0, y | 0, 53) > 0.9 ? 0.94 : 1;
      return [(214 + 30 * v) * band * speck * (1 - 0.3 * joint), 1 - joint];
    });
  } else if (kind === 'asphalt') {
    out = bakeTexture(256, 256, 3, 3, 0.004, (x, y) => {
      const n = cellRnd(x | 0, y | 0, 48), g = grain(x, y, 12, 256, 256, 49);
      return [200 + 40 * (n > 0.93 ? 1 : 0) + 20 * (g - 0.5) + 10 * (n - 0.5), n];
    });
  } else {
    // prato: fili corti in tante sfumature e qualche chiazza
    out = bakeTexture(256, 256, 3, 3, 0.01, (x, y) => {
      const n = cellRnd(x | 0, (y / 3) | 0, 50), g = grain(x, y, 6, 256, 256, 51);
      return [205 + 40 * (n - 0.5) + 30 * (g - 0.5), n];
    });
  }
  floorTexCache.set(kind, out);
  return out;
}

/**
 * Texture degli ingressi in coordinate del mondo (triplanar, chiare attorno a 1 da moltiplicare sul colore): pietra a
 * blocchi (arco e torri), pannelli di cemento prefabbricato (portale e pensilina), pannelli di metallo verniciato (parti
 * del colore dell'ingresso). Lato della ripetizione in metri: tile.
 */
const entTexCache = new Map();
function entranceTexture(kind) {
  if (entTexCache.has(kind)) return entTexCache.get(kind);
  const sm = (a, b, t) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
  let out;
  if (kind === 'ashlar') {
    // blocchi 1,2 x 0,6 m a corsi sfalsati: toni diversi per blocco, bordi appena smussati, fughe di malta incassate,
    // grana fine, qualche venatura e lo sporco che cola sotto ogni corso
    out = bakeTexture(256, 256, 4.8, 4.8, 0, (x, y) => {
      const mx = x / 256 * 4.8, my = y / 256 * 4.8, row = Math.floor(my / 0.6), off = (row % 2) * 0.6;
      const px = ((mx + off) % 1.2 + 1.2) % 1.2, py = my % 0.6, edge = Math.min(px, 1.2 - px, py, 0.6 - py);
      const joint = 1 - sm(0.012, 0.03, edge), bevel = 1 - sm(0.03, 0.07, edge), v = cellRnd(Math.floor((mx + off) / 1.2), row, 71);
      const g = grain(x, y, 24, 256, 256, 72), fine = cellRnd(x | 0, y | 0, 73), vein = grain(x * 0.6 + y * 0.3, y, 10, 256, 256, 74);
      const dirt = sm(0.35, 0.6, py / 0.6) * 0.05;
      const tone = 0.86 + 0.14 * v + 0.07 * (g - 0.5) + 0.05 * (fine - 0.5) - 0.06 * Math.max(0, vein - 0.62) - dirt - 0.05 * bevel;
      return [Math.min(255, 240 * tone * (1 - 0.3 * joint)), 1 - joint];
    });
  } else if (kind === 'precast') {
    // lastre di cemento prefabbricato 3 x 1,5 m con le fughe scure, toni appena diversi, i fori dei distanziatori e
    // le macchie dell'acqua
    out = bakeTexture(256, 256, 6, 6, 0, (x, y) => {
      const mx = x / 256 * 6, my = y / 256 * 6, px = mx % 3, py = my % 1.5, edge = Math.min(px, 3 - px, py, 1.5 - py);
      const joint = 1 - sm(0.01, 0.028, edge), v = cellRnd(Math.floor(mx / 3), Math.floor(my / 1.5), 75);
      const hx = (px % 0.75) - 0.375, hy = (py % 0.75) - 0.375, hole = Math.hypot(hx, hy) < 0.03 ? 0.75 : 1;
      const blot = grain(x, y, 6, 256, 256, 76), fine = cellRnd(x | 0, y | 0, 77), streak = grain(x, y * 0.1, 32, 256, 256, 78);
      const tone = 0.92 + 0.06 * v + 0.08 * (blot - 0.5) + 0.05 * (fine - 0.5) - 0.07 * Math.max(0, streak - 0.6);
      return [Math.min(255, 242 * tone * hole * (1 - 0.4 * joint)), 1 - joint];
    });
  } else {
    // pannelli di metallo 2,4 x 1,2 m: giunti scuri sottili, riflesso un po' diverso da un pannello all'altro e la
    // spazzolatura orizzontale
    out = bakeTexture(256, 256, 4.8, 4.8, 0, (x, y) => {
      const mx = x / 256 * 4.8, my = y / 256 * 4.8, px = mx % 2.4, py = my % 1.2, edge = Math.min(px, 2.4 - px, py, 1.2 - py);
      const joint = 1 - sm(0.008, 0.022, edge), v = cellRnd(Math.floor(mx / 2.4), Math.floor(my / 1.2), 79);
      const brush = grain(x * 0.05, y, 64, 256, 256, 80);
      const tone = 0.93 + 0.08 * v + 0.04 * (brush - 0.5) + 0.03 * (py / 1.2 - 0.5);
      return [Math.min(255, 245 * tone * (1 - 0.5 * joint)), 1 - joint];
    });
  }
  entTexCache.set(kind, out);
  return out;
}

/**
 * Vetrata dell'atrio (3 x 6 m): lastre larghe 1,5 m con i montanti in alluminio, il traverso a 3 m e sotto le porte con
 * le maniglie; il vetro riflette il cielo (più chiaro in alto) e lascia vedere l'atrio. glow: quanto si accende di notte
 * (l'atrio illuminato sotto, più tenue sopra).
 */
let lobbyCache = null;
function lobbyGlassCanvas() {
  if (lobbyCache) return lobbyCache;
  const W = 128, H = 256, px = W / 3, mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const map = mk(), glow = mk(), m = map.getContext('2d'), g = glow.getContext('2d');
  for (let i = 0; i < 2; i++) {
    const x0 = i * 1.5 * px, w = 1.5 * px;
    // sopra: vetro che riflette il cielo, con un riflesso obliquo
    const sky = m.createLinearGradient(0, 0, 0, H / 2);
    sky.addColorStop(0, '#a9bccb'); sky.addColorStop(1, '#4e6070');
    m.fillStyle = sky; m.fillRect(x0, 0, w, H / 2);
    m.fillStyle = 'rgba(255,255,255,0.10)';
    m.beginPath(); m.moveTo(x0 + w * 0.15, 0); m.lineTo(x0 + w * 0.45, 0); m.lineTo(x0 + w * 0.05, H / 2); m.lineTo(x0 - w * 0.25, H / 2); m.fill();
    // sotto: l'atrio (più scuro e caldo) con le sagome dei pilastri dentro
    const lob = m.createLinearGradient(0, H / 2, 0, H);
    lob.addColorStop(0, '#3e4650'); lob.addColorStop(0.75, '#2a2f36'); lob.addColorStop(1, '#22262b');
    m.fillStyle = lob; m.fillRect(x0, H / 2, w, H / 2);
    m.fillStyle = 'rgba(15,18,22,0.55)'; m.fillRect(x0 + w * (0.2 + 0.4 * i), H / 2 + 4, 5, H / 2 - 4);
    m.fillStyle = 'rgba(255,240,215,0.18)'; m.fillRect(x0, H / 2 + 6, w, 4); // luci del soffitto dell'atrio
    // porte: divisione a metà e maniglie
    m.fillStyle = '#9aa2aa'; m.fillRect(x0 + w / 2 - 1, H / 2, 2, H / 2);
    m.fillStyle = '#d7dbdf'; m.fillRect(x0 + w / 2 - 6, H * 0.76, 2, 18); m.fillRect(x0 + w / 2 + 4, H * 0.76, 2, 18);
    g.fillStyle = '#6a6a6a'; g.fillRect(x0, 0, w, H / 2);
    const gl = g.createLinearGradient(0, H / 2, 0, H);
    gl.addColorStop(0, '#ffffff'); gl.addColorStop(1, '#b8b8b8');
    g.fillStyle = gl; g.fillRect(x0, H / 2, w, H / 2);
  }
  // montanti, traverso e zoccolo in alluminio (spenti di notte)
  for (const [c, col] of [[m, '#c3c9cf'], [g, '#000000']]) {
    c.fillStyle = col;
    for (const x of [0, 1.5 * px, W]) c.fillRect(x - 2, 0, 4, H);
    c.fillRect(0, H / 2 - 3, W, 6); c.fillRect(0, 0, W, 2); c.fillRect(0, H - 4, W, 4);
  }
  lobbyCache = { map, glow, tileU: 3, tileV: 6 };
  return lobbyCache;
}

/** Lamelle d'alluminio orizzontali (passo 0,4 m) davanti al vetro scuro, con i montanti ogni 1,5 m: 3 x 2,4 m. */
let louvreTexCache = null;
function louvreTexture() {
  if (louvreTexCache) return louvreTexCache;
  const sm = (a, b, t) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
  louvreTexCache = bakeTexture(96, 192, 3, 2.4, 0.06, (x, y) => {
    const mx = x / 96 * 3, my = y / 192 * 2.4, f = (my % 0.4) / 0.4, mull = Math.min(mx % 1.5, 1.5 - (mx % 1.5)) < 0.04;
    if (mull) return [150, 158, 166, 0.9];
    // lamella: in alto la faccia chiara che prende la luce, sotto l'ombra, poi il vetro scuro
    const fin = f < 0.55, h = fin ? Math.sin(f / 0.55 * Math.PI) : 0;
    const v = cellRnd(Math.floor(my / 0.4), Math.floor(mx / 1.5), 81) * 10;
    if (fin) { const t = 1 - f / 0.55; return [128 + 70 * t + v, 136 + 70 * t + v, 145 + 70 * t + v, h]; }
    return [26 + 10 * sm(0.55, 1, f), 31 + 10 * sm(0.55, 1, f), 38 + 12 * sm(0.55, 1, f), 0];
  });
  return louvreTexCache;
}

/**
 * Cemento/pietra liscia (grigio chiaro attorno a 1 da moltiplicare): macchie larghe, colature verticali, grana fine e
 * giunti appena visibili. Si applica in coordinate del mondo (triplanar): va bene su cilindri e rampe senza coordinate.
 */
let stoneCache = null;
function stoneTexture() {
  if (stoneCache) return stoneCache;
  stoneCache = bakeTexture(256, 256, 4, 4, 0.01, (x, y) => {
    const blot = grain(x, y, 4, 256, 256, 61), mid = grain(x, y, 12, 256, 256, 62), fine = cellRnd(x | 0, y | 0, 63);
    const streak = grain(x, y * 0.08, 24, 256, 256, 64), joint = (y % 128) < 1.2 || (x % 256) < 1.2 ? 0.9 : 1;
    const v = 236 + 36 * (blot - 0.5) + 18 * (mid - 0.5) + 12 * (fine - 0.5) - 26 * Math.max(0, streak - 0.55);
    return [Math.min(255, v * joint), 0.5];
  });
  return stoneCache;
}

/** Texture in coordinate del mondo (triplanar), moltiplicata sul colore: una ripetizione ogni 1/scale metri. */
function triplanar(mat, tex, scale) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.triMap = { value: tex };
    sh.vertexShader = 'varying vec3 vTriPos;\nvarying vec3 vTriNrm;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
  vec4 triP = vec4(transformed, 1.0);
  vec3 triN = objectNormal;
  #ifdef USE_INSTANCING
    triP = instanceMatrix * triP;
    triN = mat3(instanceMatrix) * triN;
  #endif
  vTriPos = (modelMatrix * triP).xyz;
  vTriNrm = mat3(modelMatrix) * triN;`);
    sh.fragmentShader = 'uniform sampler2D triMap;\nvarying vec3 vTriPos;\nvarying vec3 vTriNrm;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  vec3 triW = pow(abs(normalize(vTriNrm)), vec3(4.0));
  triW /= (triW.x + triW.y + triW.z + 1e-5);
  vec3 triQ = vTriPos * ${scale.toFixed(4)};
  vec3 triC = texture2D(triMap, triQ.zy).rgb * triW.x + texture2D(triMap, triQ.xz).rgb * triW.y + texture2D(triMap, triQ.xy).rgb * triW.z;
  diffuseColor.rgb *= triC * 1.07;`);
  };
  mat.customProgramCacheKey = () => 'tri' + scale;
}

/** Texture delle facciate a vetri e a pannelli (dimensioni vere in metri). */
const facadeTexCache = new Map();
function facadeTexture(kind) {
  if (facadeTexCache.has(kind)) return facadeTexCache.get(kind);
  const sm = (a, b, t) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
  let out;
  if (kind === 'glass') {
    // un piano ogni 4 m: parapetto pieno scuro in basso, poi vetro che riflette il cielo (più chiaro in alto),
    // lastre larghe 1,6 m appena diverse tra loro e un montante sottile
    const W = 192, H = 256, TU = 4.8, TV = 4;
    out = bakeTexture(W, H, TU, TV, 0.02, (x, y) => {
      const mx = x / W * TU, my = (1 - y / H) * TV, pane = Math.floor(mx / 1.6);
      if (my < 0.95) return [38, 42, 48, 1];
      const t = (my - 0.95) / (TV - 0.95), v = cellRnd(pane, 0, 31) * 0.12;
      const mull = Math.min(mx % 1.6, 1.6 - (mx % 1.6)) < 0.035;
      if (mull) return [120, 128, 136, 1];
      return [52 + 70 * t + 40 * v, 66 + 82 * t + 40 * v, 82 + 92 * t + 40 * v, 0];
    });
  } else {
    // pannelli compositi 2,5 x 5 m (bianchi, si tingono col colore), giunti scuri incassati e un riflesso diagonale
    const W = 256, H = 512, TU = 5, TV = 10;
    out = bakeTexture(W, H, TU, TV, 0.04, (x, y) => {
      const mx = x / W * TU, my = (1 - y / H) * TV, px = mx % 2.5, py = my % 5;
      const edge = Math.min(px, 2.5 - px, py, 5 - py), joint = 1 - sm(0.02, 0.06, edge);
      const sheen = 0.9 + 0.1 * Math.sin((px * 0.36 + py * 0.15) * Math.PI) + 0.05 * cellRnd(Math.floor(mx / 2.5), Math.floor(my / 5), 33);
      return [238 * sheen * (1 - 0.6 * joint), 1 - joint];
    });
  }
  facadeTexCache.set(kind, out);
  return out;
}

/** Lame del Bernabéu: tetto (lame concentriche) e facciata (lame orizzontali larghe con lo scuro tra una e l'altra). */
const bladesTexCache = new Map();
function bladesTexture(kind) {
  if (bladesTexCache.has(kind)) return bladesTexCache.get(kind);
  let out;
  if (kind === 'roof') {
    // lame da 1 m che girano tutto intorno, fuga sottile scura
    out = bakeTexture(16, 256, 2, 3, 0.1, (x, y) => {
      const t = (y / 256 * 3) % 1, gap = t > 0.9;
      const h = gap ? 0 : Math.sin(Math.PI * t / 0.9);
      return [gap ? 90 : 180 + 72 * h, h];
    });
  } else {
    // lame da 1 m con 35 cm di scuro tra una e l'altra (si vede la struttura dietro); giunto leggero ogni 3 m
    out = bakeTexture(96, 256, 3, 1.35, 0.25, (x, y) => {
      const t = (1 - y / 256) * 1.35, gap = t > 1.0, joint = (x % 96) < 1.2;
      if (gap) return [78, 84, 92, 0];
      const k = t / 1.0, h = Math.sin(Math.PI * k);
      return [(178 + 77 * (0.45 + 0.55 * k) * (0.7 + 0.3 * h)) * (joint ? 0.88 : 1), h];
    });
  }
  bladesTexCache.set(kind, out);
  return out;
}

const cushionCache = new Map(); // le tele si calcolano una volta sola (le texture si rifanno a ogni ricostruzione)
function cushionTexture(kind) {
  if (cushionCache.has(kind)) return cushionCache.get(kind);
  const C = CUSHIONS[kind], { W, H } = C;
  // per il cuscino in cui cade il pixel: r = 0 al centro e 1 sulla giuntura, h = quanto è gonfio (liscio, senza
  // pieghe al centro: prodotto delle distanze dai lati opposti)
  const cushionAt = {
    rhombus: (x, y) => {
      // centro della tela o angolo più vicino; il rombo ruotato di 45° è un quadrato |p|, |q| <= 1
      const one = (dx, dy) => { const s = dx / (W / 2), t = dy / (H / 2), p = s + t, q = s - t; return [Math.abs(s) + Math.abs(t), Math.max(0, (1 - p * p) * (1 - q * q))]; };
      const a = one(x - W / 2, y - H / 2), b = one(Math.min(x, W - x), Math.min(y, H - y));
      return a[0] < b[0] ? a : b;
    },
    hex: (x, y) => {
      const A = W / 2; // esagoni a punta in su: centri al centro e negli angoli della tela
      const one = (dx, dy) => {
        const e = [dx / A, (0.5 * dx + 0.866 * dy) / A, (0.5 * dx - 0.866 * dy) / A];
        return [Math.max(...e.map(Math.abs)), Math.max(0, e.reduce((m, v) => m * (1 - v * v), 1))];
      };
      const a = one(x - W / 2, y - H / 2), b = one(Math.min(x, W - x), Math.min(y, H - y));
      return a[0] < b[0] ? a : b;
    },
    stripes: (x, y) => { const t = 2 * y / H - 1; return [Math.abs(t), 1 - t * t]; },
    quilt: (x, y) => {
      // cuscino rettangolare: più gonfio verso l'apertura, schiacciato contro la giuntura verso fuori
      const s = 2 * x / W - 1, t = 2 * y / H - 1;
      return [Math.max(Math.abs(s), Math.abs(t)), Math.max(0, (1 - s * s) ** 0.5 * (1 - t * t) ** 0.8 * (1 + 0.45 * t))];
    },
    scales: (x, y) => {
      // file sfalsate di cerchi: ogni fila copre quella prima (sopra c'è il cerchio più in basso che contiene il pixel)
      const R = W / 4;
      for (const [cy, xs] of [[1.5 * H, [W / 4, 3 * W / 4]], [H, [0, W / 2, W]], [H / 2, [W / 4, 3 * W / 4]], [0, [0, W / 2, W]], [-H / 2, [W / 4, 3 * W / 4]]]) {
        for (const cx of xs) {
          const r = Math.hypot(x - cx, y - cy) / R;
          if (r < 1) return [r, 1 - r * r];
        }
      }
      return [1, 0];
    }
  }[kind];
  const hgt = new Float32Array(W * H), rr = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const [r, f] = cushionAt(x + 0.5, y + 0.5);
      rr[y * W + x] = Math.min(1, r);
      hgt[y * W + x] = Math.pow(f, 0.45);
    }
  }
  const make = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const map = make(), nrm = make();
  const mctx = map.getContext('2d'), nctx = nrm.getContext('2d');
  const mi = mctx.createImageData(W, H), ni = nctx.createImageData(W, H);
  const su = C.bulge / (2 * C.tileU / W), sv = C.bulge / (2 * C.tileV / H); // pendenza in metri per metro
  const smooth = (a, b, t) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x, r = rr[i], h = hgt[i];
      // colore: bianco, più scuro verso le giunture (ombra tra un cuscino e l'altro), giunture argento
      const ao = 0.8 + 0.2 * Math.sqrt(Math.min(1, h)), seam = C.seam || 0.95, j = smooth(seam, seam + 0.035 * (1 - seam) / 0.05, r), [jr, jg, jb] = C.joint || [138, 146, 156];
      const base = 246 * ao;
      mi.data[i * 4] = base * (1 - j) + jr * j;
      mi.data[i * 4 + 1] = (base + 1) * (1 - j) + jg * j;
      mi.data[i * 4 + 2] = (base + 3) * (1 - j) + jb * j;
      mi.data[i * 4 + 3] = 255;
      // rilievo: la tela va verso il basso, la texture verso l'alto (v)
      const gx = (hgt[y * W + (x + 1) % W] - hgt[y * W + (x - 1 + W) % W]) * su;
      const gy = (hgt[((y + 1) % H) * W + x] - hgt[((y - 1 + H) % H) * W + x]) * sv;
      const nx = -gx, ny = gy, l = Math.hypot(nx, ny, 1);
      ni.data[i * 4] = (nx / l * 0.5 + 0.5) * 255;
      ni.data[i * 4 + 1] = (ny / l * 0.5 + 0.5) * 255;
      ni.data[i * 4 + 2] = (1 / l * 0.5 + 0.5) * 255;
      ni.data[i * 4 + 3] = 255;
    }
  }
  mctx.putImageData(mi, 0, 0);
  nctx.putImageData(ni, 0, 0);
  const out = { canvas: map, normal: nrm, tileU: C.tileU, tileV: C.tileV };
  cushionCache.set(kind, out);
  return out;
}

/** Lunghezza di una pianta (punti [x, z]). */
const outlineLength = (row) => row.reduce((l, p, i) => (i ? l + Math.hypot(p[0] - row[i - 1][0], p[1] - row[i - 1][1]) : 0), 0);

/**
 * Superficie che gira tutto intorno allo stadio con il profilo `prof` (punti d, h), dalla riga j0 alla j1;
 * rowAt(d) dà la pianta chiusa a quella distanza. Coordinate per la texture lungo la pianta (numero intero di
 * cuscini per giro, niente cuciture) e lungo il profilo. yFn(x, z, j) aggiunge una quota per punto (copertura ondulata).
 */
function sweepAround(THREE, rowAt, prof, j0, j1, yFn = null, cells = 0) {
  const pos = [], uv = [], idx = [];
  let v = 0, cols = 0;
  // v misurata dall'inizio del profilo: due pezzi dello stesso profilo continuano il disegno senza scalini
  for (let j = 1; j <= j0; j++) v += Math.hypot(prof[j].d - prof[j - 1].d, prof[j].h - prof[j - 1].h) / SHELL_CELL_V;
  // stesso numero di cuscini su ogni riga (altrimenti da una riga all'altra il disegno si storce)
  if (!cells) cells = Math.max(1, Math.round(outlineLength(rowAt(prof[j0].d)) / SHELL_CELL_U));
  for (let j = j0; j <= j1; j++) {
    if (j > j0) v += Math.hypot(prof[j].d - prof[j - 1].d, prof[j].h - prof[j - 1].h) / SHELL_CELL_V;
    const { d, h } = prof[j], row = rowAt(d), us = [0];
    cols = row.length;
    for (let i = 1; i < cols; i++) us.push(us[i - 1] + Math.hypot(row[i][0] - row[i - 1][0], row[i][1] - row[i - 1][1]));
    const len = us[cols - 1] || 1;
    for (let i = 0; i < cols; i++) { pos.push(row[i][0], h + (yFn ? yFn(row[i][0], row[i][1], j) : 0), row[i][1]); uv.push(us[i] / len * cells, v); }
  }
  for (let j = 0; j < j1 - j0; j++) {
    for (let i = 0; i < cols - 1; i++) { const a = j * cols + i, b = a + cols; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Tratti coperti dal tetto secondo la scelta (le coperture che avvolgono lo stadio restano tutto intorno). */
function coveredRuns(shape, st) {
  if (st.roofCover === 'all') return shape.runs;
  const pred = {
    sectors: (p) => Math.abs(Math.atan2(Math.abs(p.z) / shape.b, Math.abs(p.x) / shape.a) - Math.PI / 4) > 0.16,
    stands: (p) => onLongSide(p),
    main: (p) => onLongSide(p) && p.z > 0,
    ends: (p) => !onLongSide(p),
    pick: (p) => !!st.roofSectors[sideOfPoint(p)]
  }[st.roofCover];
  return shape.runs.flatMap(run => subRuns(run, pred).map(r => ({ ...r, tiers: run.tiers })));
}

/** Posizione lungo un tratto chiuso che riparte da capo; sui tratti aperti si ferma alle estremità. */
const wrapU = (run, total, u) => (run.closed ? ((u % total) + total) % total : Math.min(Math.max(u, 0), total));

/** Direzione del bordo (tangente) a distanza d, alla posizione u: [tx, tz]. */
function tangentAt(run, cum, u, d) {
  const total = cum[cum.length - 1];
  const [xa, za] = pointAt(run, cum, wrapU(run, total, u - 0.5), d), [xb, zb] = pointAt(run, cum, wrapU(run, total, u + 0.5), d);
  const l = Math.hypot(xb - xa, zb - za) || 1;
  return [(xb - xa) / l, (zb - za) / l];
}

/**
 * Lastra da (x1, y1, z1) a (x2, y2, z2), larga w nella direzione orizzontale (nx, nz) e spessa t:
 * rampe inclinate delle torri e della facciata.
 */
function slab(out, x1, y1, z1, x2, y2, z2, nx, nz, w, t) {
  let dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
  const len = Math.hypot(dx, dy, dz) || 1;
  dx /= len; dy /= len; dz /= len;
  const ux = -nz * dy, uy = nz * dx - nx * dz, uz = nx * dy; // n × d: terna destra (d, n × d, n)
  const ul = Math.hypot(ux, uy, uz) || 1;
  boxAt(out, (x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2, [dx * len, dy * len, dz * len], [ux / ul * t, uy / ul * t, uz / ul * t], [nx * w, 0, nz * w]);
}

/**
 * Superfici lisce costruite a strisce, con le normali date (rampe a spirale, fasce della facciata, sbalzi delle travi):
 * a differenza dei pezzi ripetuti non hanno giunture. Il verso dei triangoli segue la normale.
 */
function surface() {
  const pos = [], nrm = [], idx = [];
  const add = (p, n) => { pos.push(p[0], p[1], p[2]); nrm.push(n[0], n[1], n[2]); return pos.length / 3 - 1; };
  const tri = (i, j, k) => {
    const ax = pos[j * 3] - pos[i * 3], ay = pos[j * 3 + 1] - pos[i * 3 + 1], az = pos[j * 3 + 2] - pos[i * 3 + 2];
    const bx = pos[k * 3] - pos[i * 3], by = pos[k * 3 + 1] - pos[i * 3 + 1], bz = pos[k * 3 + 2] - pos[i * 3 + 2];
    const d = (ay * bz - az * by) * nrm[i * 3] + (az * bx - ax * bz) * nrm[i * 3 + 1] + (ax * by - ay * bx) * nrm[i * 3 + 2];
    if (d < 0) idx.push(i, k, j); else idx.push(i, j, k);
  };
  return {
    /** Striscia tra le file di punti a e b (stessa lunghezza), con una normale per punto. */
    strip(a, b, na, nb = na) {
      const ia = a.map((p, k) => add(p, na[k])), ib = b.map((p, k) => add(p, nb[k]));
      for (let k = 0; k < a.length - 1; k++) { tri(ia[k], ib[k], ia[k + 1]); tri(ia[k + 1], ib[k], ib[k + 1]); }
    },
    /** Quadrilatero piatto p0 p1 p2 p3 con la normale verso fuori da `center`. */
    quad(p0, p1, p2, p3, center) {
      const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2], vx = p3[0] - p0[0], vy = p3[1] - p0[1], vz = p3[2] - p0[2];
      let n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
      const l = Math.hypot(...n) || 1, mid = [0, 1, 2].map(i => (p0[i] + p2[i]) / 2 - center[i]);
      n = n.map(v => v / l * (n[0] * mid[0] + n[1] * mid[1] + n[2] * mid[2] < 0 ? -1 : 1));
      this.strip([p0, p1], [p3, p2], [n, n]);
    },
    geometry(THREE) {
      if (!idx.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
      g.setIndex(idx);
      return g;
    }
  };
}

/**
 * Fascia (rampa) larga dalle file di punti `inner` a `outer`, spessa t, che segue le quote dei punti:
 * faccia esterna, sopra, sotto e i due tappi. `out` = normale orizzontale verso fuori per ogni punto.
 */
function rampBand(surf, inner, outer, out, t) {
  const up = (p, dy) => [p[0], p[1] + dy, p[2]], n = inner.length;
  const lo = (a) => a.map(p => up(p, -t / 2)), hi = (a) => a.map(p => up(p, t / 2));
  surf.strip(lo(outer), hi(outer), out);
  surf.strip(hi(inner), hi(outer), inner.map(() => [0, 1, 0]));
  surf.strip(lo(inner), lo(outer), inner.map(() => [0, -1, 0]));
  for (const [k, sgn] of [[0, -1], [n - 1, 1]]) {
    const j = k === 0 ? 1 : n - 2, tx = (outer[k][0] - outer[j][0]) * -sgn, tz = (outer[k][2] - outer[j][2]) * -sgn, tl = Math.hypot(tx, tz) || 1;
    const c = [(inner[k][0] + outer[k][0]) / 2 - tx / tl, inner[k][1], (inner[k][2] + outer[k][2]) / 2 - tz / tl];
    surf.quad(up(inner[k], -t / 2), up(outer[k], -t / 2), up(outer[k], t / 2), up(inner[k], t / 2), c);
  }
}

/** Cilindro orizzontale (raggio r, lungo L) con l'asse nella direzione orizzontale (nx, nz): tamburi in cima ai piloni. */
function drumAt(out, x, y, z, nx, nz, r, L) {
  boxAt(out, x, y, z, [0, r, 0], [nx * L, 0, nz * L], [nz * r, 0, -nx * r]);
}

/** Pilone a traliccio: quattro montanti con croci su ogni faccia, alto H, alla posizione u del tratto (più largo lungo il bordo). */
function pylon(out, run, cum, u, d, H) {
  const [x, z] = pointAt(run, cum, u, d), [tx, tz] = tangentAt(run, cum, u, d);
  const sa = 2.6, sb = 1.6; // metà del lato lungo il bordo e verso fuori
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [x + tx * a * sa + tz * b * sb, z + tz * a * sa - tx * b * sb]);
  for (const [cx, cz] of corners) beam(out, cx, 0, cz, cx, H, cz, 0.38);
  const levels = Math.max(2, Math.round(H / 5));
  for (let k = 0; k < levels; k++) {
    const y0 = H * k / levels, y1 = H * (k + 1) / levels;
    for (let f = 0; f < 4; f++) {
      const [ax, az] = corners[f], [bx, bz] = corners[(f + 1) % 4];
      beam(out, ax, y0, az, bx, y1, bz, 0.16);
      beam(out, bx, y0, bz, ax, y1, az, 0.16);
      beam(out, ax, y1, az, bx, y1, bz, 0.2);
    }
  }
}

/** Piano del tetto lungo i tratti, con coordinate per i pannelli (u lungo il bordo, v verso fuori). */
function deckGeometry(THREE, shape, R) {
  const pos = [], uv = [], idx = [];
  for (const run of shape.runs) {
    const P = run.pts, n = P.length, base = pos.length / 3;
    const count = run.closed ? n + 1 : n; // chiuso: il primo punto ripetuto in fondo, così la texture non ha cuciture
    let u = 0;
    for (let k = 0; k < count; k++) {
      const p = P[k % n];
      if (k) { const q = P[k - 1]; u += Math.hypot(p.x - q.x, p.z - q.z); }
      for (const d of [R.dIn, R.dOut]) { pos.push(p.x + p.mx * d, R.h(d), p.z + p.mz * d); uv.push(u / ROOF_PANEL, (d - R.dIn) / ROOF_PANEL); }
    }
    for (let k = 0; k < count - 1; k++) { const a = base + k * 2, b = a + 2; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Copertura, fari ed esterno. Restituisce i materiali da colorare, i proiettori (per la notte)
 * e dove mettere le luci notturne.
 */
/* ------------------------------------------------- superfici con le texture */
/** Numeri a caso ripetibili (le texture escono uguali a ogni disegno). */
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Colore a metà strada tra due colori #rrggbb (t = 0 il primo, 1 il secondo). */
function mixHex(a, b, t) {
  const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16);
  const m = (s) => Math.round(((p >> s) & 255) * (1 - t) + ((q >> s) & 255) * t);
  return `rgb(${m(16)}, ${m(8)}, ${m(0)})`;
}

/** Grana fine: n puntini chiari e scuri con opacità a. */
function speckle(ctx, w, h, n, a, r) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = r() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`;
    ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
  }
}

/**
 * Superficie con le coordinate per le texture lungo un tratto: per ogni punto del bordo una fila dal profilo prof
 * ([{ d, h }]); u = metri lungo la linea del primo punto del profilo / tu, v = metri lungo il profilo / tv.
 * Si aggiunge all'accumulatore acc = { pos, uv, idx }.
 */
function stripUV(run, prof, acc, tu, tv) {
  const P = run.pts, n = P.length, J = prof.length, base = acc.pos.length / 3, d0 = prof[0].d;
  const vs = [0];
  for (let j = 1; j < J; j++) vs.push(vs[j - 1] + Math.hypot(prof[j].d - prof[j - 1].d, prof[j].h - prof[j - 1].h));
  const rows = run.closed ? n + 1 : n;
  let u = 0;
  for (let k = 0; k < rows; k++) {
    const p = P[k % n];
    if (k) { const q = P[k - 1]; u += Math.hypot(p.x + p.mx * d0 - q.x - q.mx * d0, p.z + p.mz * d0 - q.z - q.mz * d0); }
    for (let j = 0; j < J; j++) {
      acc.pos.push(p.x + p.mx * prof[j].d, prof[j].h, p.z + p.mz * prof[j].d);
      acc.uv.push(u / tu, vs[j] / tv);
    }
    if (k) for (let j = 0; j < J - 1; j++) {
      const a = base + (k - 1) * J + j, b = a + J;
      acc.idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
}

/** Geometria da un accumulatore { pos, uv, idx } (null se vuoto). */
function uvGeometry(THREE, acc) {
  if (!acc.idx.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(acc.pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(acc.uv, 2));
  g.setIndex(acc.idx);
  g.computeVertexNormals();
  return g;
}

/** Texture ripetuta da una tela (colore: sRGB; rilievo: lineare). */
function canvasTex(THREE, c, color = true, repeat = [1, 1]) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(...repeat);
  return t;
}

const CLAD_TILE = [18, 9], STONE_TILE = 6.4, GLASS_TILE = 9, ROOF_TILE = 12; // metri coperti da una tela

/**
 * Pannelli della facciata inglese (quasi bianchi, il colore li tinge): 3 x 1,5 m con tono leggermente diverso,
 * giunture scure con il filo di luce sotto e qualche colatura. Restituisce [colore, rilievo].
 */
function claddingCanvases() {
  const W = 1152, H = 576, pw = W / 6, ph = H / 6, r = rng(11);
  const c = document.createElement('canvas'), b = document.createElement('canvas');
  c.width = b.width = W; c.height = b.height = H;
  const ctx = c.getContext('2d'), bx = b.getContext('2d');
  for (let y = 0; y < H; y += ph) for (let x = 0; x < W; x += pw) {
    const v = 240 + Math.floor(r() * 14), g = ctx.createLinearGradient(0, y, 0, y + ph);
    g.addColorStop(0, `rgb(${v},${v},${v + 1})`); g.addColorStop(1, `rgb(${v - 7},${v - 7},${v - 5})`);
    ctx.fillStyle = g; ctx.fillRect(x, y, pw, ph);
  }
  for (let i = 0; i < 90; i++) {
    const x = r() * W, y = Math.floor(r() * 6) * ph + 3, l = 15 + r() * 70, g = ctx.createLinearGradient(0, y, 0, y + l);
    g.addColorStop(0, 'rgba(70,72,76,.16)'); g.addColorStop(1, 'rgba(70,72,76,0)');
    ctx.fillStyle = g; ctx.fillRect(x, y, 1.5 + r() * 3, l);
  }
  speckle(ctx, W, H, 9000, 0.035, r);
  bx.fillStyle = '#ffffff'; bx.fillRect(0, 0, W, H);
  // giunture orizzontali marcate, verticali appena accennate (i pannelli si leggono come fasce)
  for (const [cx, col, a] of [[ctx, '60,64,70', 0.32], [bx, '0,0,0', 0.7]]) {
    cx.fillStyle = `rgba(${col},${a * 0.5})`;
    for (let x = 0; x < W; x += pw) cx.fillRect(x, 0, 2, H);
    cx.fillStyle = `rgba(${col},${a})`;
    for (let y = 0; y < H; y += ph) cx.fillRect(0, y, W, 3);
  }
  ctx.fillStyle = 'rgba(255,255,255,.45)';
  for (let y = 0; y < H; y += ph) ctx.fillRect(0, y + 3, W, 1);
  return [c, b];
}

/** Pietra del basamento (quasi bianca, il colore la tinge): corsi da 0,9 m di lastre sfalsate, grana e giunti. */
function stoneCanvases() {
  const S = 512, ch = S / 7.11, bw = S / 2.67, r = rng(23);
  const c = document.createElement('canvas'), b = document.createElement('canvas');
  c.width = c.height = b.width = b.height = S;
  const ctx = c.getContext('2d'), bx = b.getContext('2d');
  bx.fillStyle = '#ffffff'; bx.fillRect(0, 0, S, S);
  for (let row = 0, y = 0; y < S; row++, y += ch) {
    for (let x = row % 2 ? -bw / 2 : 0; x < S; x += bw) {
      const v = 236 + Math.floor(r() * 16);
      ctx.fillStyle = `rgb(${v},${v - 1},${v - 4})`; ctx.fillRect(x, y, bw, ch);
      ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(x, y, 2, ch);
      bx.fillStyle = '#000000'; bx.fillRect(x, y, 3, ch);
    }
    ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(0, y, S, 2);
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(0, y + 2, S, 1);
    bx.fillStyle = '#000000'; bx.fillRect(0, y, S, 3);
  }
  speckle(ctx, S, S, 7000, 0.04, r);
  return [c, b];
}

/**
 * Vetrate (in colore pieno): riquadri da 1,5 m con il riflesso del cielo in alto, montanti e traverso chiari.
 * Seconda tela: le luci di notte (riquadri accesi più o meno, montanti spenti).
 */
function glassCanvases() {
  const W = 768, H = 128, pw = W / 6, r = rng(5);
  const c = document.createElement('canvas'), e = document.createElement('canvas');
  c.width = e.width = W; c.height = e.height = H;
  const ctx = c.getContext('2d'), ex = e.getContext('2d');
  ex.fillStyle = '#000000'; ex.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += pw) {
    const g = ctx.createLinearGradient(0, 0, 0, H), k = r() * 0.15;
    g.addColorStop(0, `rgb(${120 + k * 100},${140 + k * 90},${160 + k * 70})`); g.addColorStop(0.45, '#3a4a5c'); g.addColorStop(1, '#18212b');
    ctx.fillStyle = g; ctx.fillRect(x, 0, pw, H);
    ctx.fillStyle = 'rgba(255,255,255,.07)';
    ctx.beginPath(); ctx.moveTo(x + pw * 0.2, H); ctx.lineTo(x + pw * 0.55, 0); ctx.lineTo(x + pw * 0.75, 0); ctx.lineTo(x + pw * 0.4, H); ctx.fill();
    const lit = r(), l = lit < 0.2 ? 0.08 : 0.45 + r() * 0.55;
    ex.fillStyle = `rgba(255,${Math.round(205 + r() * 30)},${Math.round(140 + r() * 50)},${l})`; ex.fillRect(x + 4, 6, pw - 8, H - 12);
  }
  ctx.fillStyle = '#c8cdd3';
  for (let x = 0; x < W; x += pw) ctx.fillRect(x, 0, 5, H);
  ctx.fillRect(0, 0, W, 6); ctx.fillRect(0, H - 6, W, 6); ctx.fillRect(0, H * 0.62, W, 3);
  return [c, e];
}

/** Rilievo della lamiera aggraffata: una costola ogni 0,6 m (lungo la profondità del tetto), lucernari lisci. */
function roofBumpCanvas() {
  const S = 512, step = S / 20, b = document.createElement('canvas');
  b.width = b.height = S;
  const bx = b.getContext('2d');
  bx.fillStyle = '#808080'; bx.fillRect(0, 0, S, S);
  for (let x = 0; x < S; x += step) {
    if (ROOF_LIGHTS.some(([a, w]) => x >= a * S - 1 && x < (a + w) * S)) continue;
    const g = bx.createLinearGradient(x, 0, x + 6, 0);
    g.addColorStop(0, '#808080'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, '#808080');
    bx.fillStyle = g; bx.fillRect(x, 0, 6, S);
  }
  return b;
}
const ROOF_LIGHTS = [[0.46, 0.08]]; // lucernari: inizio e larghezza (frazioni della tela lungo la tribuna)

/** Lamiera del tetto nel colore scelto: fogli tra le costole con toni diversi, sormonti, lucernari chiari e sporco. */
function paintRoofMetal(c, color) {
  const S = c.width, step = S / 20, ctx = c.getContext('2d'), r = rng(31);
  for (let x = 0; x < S; x += step) {
    ctx.fillStyle = shade(color, 0.94 + r() * 0.12); ctx.fillRect(x, 0, step, S);
    ctx.fillStyle = shade(color, 1.35); ctx.fillRect(x, 0, 2, S);
    ctx.fillStyle = shade(color, 0.7); ctx.fillRect(x + 3, 0, 2, S);
  }
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  for (let y = 0; y < S; y += S / 2) ctx.fillRect(0, y, S, 2);
  for (let i = 0; i < 26; i++) {
    const x = r() * S, y = r() * S, rad = 20 + r() * 70, g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(0,0,0,${0.05 + r() * 0.07})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 60; i++) { ctx.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.05})`; ctx.fillRect(r() * S, r() * S, 1.5, 30 + r() * 120); }
  for (const [a, w] of ROOF_LIGHTS) {
    const x0 = a * S, ww = w * S;
    ctx.fillStyle = mixHex(color, '#e4ecf2', 0.65); ctx.fillRect(x0, 0, ww, S);
    ctx.fillStyle = 'rgba(80,90,100,.35)';
    for (let y = 0; y < S; y += S / 12) ctx.fillRect(x0, y, ww, 2);
    ctx.fillRect(x0, 0, 2, S); ctx.fillRect(x0 + ww - 2, 0, 2, S);
  }
  speckle(ctx, S, S, 5000, 0.05, r);
}

/** Manifesti del basamento inglese: tre disegni affiancati (giocatore e numero su fondo del colore delle fasce). */
function paintPosters(c, accent, frame) {
  const ctx = c.getContext('2d'), w = c.width / 3, h = c.height;
  ctx.clearRect(0, 0, c.width, h);
  [[0.32, '7'], [0.66, '10'], [0.4, '9']].forEach(([fx, num], v) => {
    const x0 = v * w;
    ctx.fillStyle = shade(frame, 0.8); ctx.fillRect(x0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, shade(accent, 1.25)); g.addColorStop(1, shade(accent, 0.55));
    ctx.fillStyle = g; ctx.fillRect(x0 + 14, 14, w - 28, h - 28);
    ctx.fillStyle = 'rgba(255,255,255,.1)';
    ctx.beginPath(); ctx.moveTo(x0 + w * 0.15, h - 14); ctx.lineTo(x0 + w * 0.55, 14); ctx.lineTo(x0 + w * 0.75, 14); ctx.lineTo(x0 + w * 0.35, h - 14); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.font = `900 ${Math.round(h * 0.55)}px 'Arial Black', Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(num, x0 + w * (fx < 0.5 ? 0.74 : 0.28), h * 0.5);
    // busto del giocatore: spalle e testa
    const cx = x0 + w * fx;
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.beginPath(); ctx.ellipse(cx, h * 1.02, h * 0.36, h * 0.42, 0, Math.PI, 0); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, h * 0.36, h * 0.15, 0, Math.PI * 2); ctx.fill();
  });
}

/** Stemma rotondo sul portale dell'ingresso: anello bianco, fondo del colore delle fasce e iniziali del nome dello stadio. */
function paintBadge(c, accent, name) {
  const ctx = c.getContext('2d'), s = c.width, r = s / 2;
  const initials = String(name || '').trim().split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase()).join('').slice(0, 3) || 'FC';
  ctx.clearRect(0, 0, s, s);
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(r, r, r - 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(r, r, r - 14, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#d9b45a'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(r, r, r - 30, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 ${Math.round(s * (initials.length > 2 ? 0.27 : 0.36))}px 'Arial Black', Arial, sans-serif`;
  ctx.fillText(initials, r, r + s * 0.02);
}

function buildExterior(THREE, shape, st, structMat, parapetMat, own) {
  const group = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.35 });
  const lamp = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4dc, emissiveIntensity: 0.6, roughness: 0.3 });
  const box = new THREE.BoxGeometry(1, 1, 1);
  own.push(steel, lamp, box);
  // visibili da entrambi i lati come i materiali degli spalti: le facce dei profili estrusi possono guardare verso l'interno
  const accent = new THREE.MeshStandardMaterial({ roughness: 0.6, side: THREE.DoubleSide });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1f2730, roughness: 0.95 }); // opaco: lucido rifletterebbe il cielo e sembrerebbe bianco
  own.push(accent, glass);
  const dark = new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide });
  // cemento/pietra liscia delle torri e delle fasce (chiaro col colore dei parapetti, scuro col cemento)
  const stoneTex = new THREE.CanvasTexture(stoneTexture().canvas);
  stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping; stoneTex.anisotropy = 4;
  const stoneLight = new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide });
  const stoneDark = new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide });
  for (const m of [stoneLight, stoneDark]) triplanar(m, stoneTex, 0.25);
  own.push(stoneTex, stoneLight, stoneDark);
  const girderMat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.2 });
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 28);
  own.push(dark, girderMat, cylinder);
  const beams = [], pilasters = [], lamps = [], spots = [], windows = [];
  const towerCores = [], towerCaps = [], girderBeams = [], drums = [], frames = [], seams = [], sculpt = [];
  const sculptMat = new THREE.MeshStandardMaterial({ color: 0xf2f3f4, roughness: 0.5 });
  own.push(sculptMat);
  const screenFrame = new THREE.MeshStandardMaterial({ color: 0x1b1e23, roughness: 0.6, side: THREE.DoubleSide });
  const glassWall = new THREE.MeshStandardMaterial({ color: 0x2a323c, roughness: 0.25, metalness: 0.3, side: THREE.DoubleSide });
  own.push(screenFrame, glassWall);
  const bandPos = [], bandIdx = [[], [], []];
  // righe luminose: del colore scelto di giorno, accese di notte (bordi del tetto per tribuna, cima della facciata inglese)
  const glowMat = new THREE.MeshStandardMaterial({ roughness: 0.4, side: THREE.DoubleSide });
  const cladMat = new THREE.MeshStandardMaterial({ roughness: 0.55, side: THREE.DoubleSide });
  own.push(glowMat, cladMat);
  const glowPos = [], glowIdx = [[], [], []];
  // basamento e vetrate della facciata inglese (le vetrate di notte si accendono)
  const podiumMat = new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide });
  const winMat = new THREE.MeshStandardMaterial({ color: 0x26303a, roughness: 0.25, metalness: 0.3, emissive: 0xffd7a0, side: THREE.DoubleSide });
  own.push(podiumMat, winMat);
  // materiali che si accendono di notte [materiale, luce di giorno, luce di notte] e tele da ridipingere coi colori
  const nightGlow = [[glowMat, 0.15, 1.6], [winMat, 0.03, 0.85]], repaint = [];
  // materiali tinti con un colore dello stadio [materiale, chiave del colore]
  const tints = [[cladMat, 'cladding'], [podiumMat, 'podium']];
  let badge = null; // stemma con le iniziali sul portale (nascosto quando c'è il logo della squadra)
  // rivestimento del muro esterno con la texture scelta (dimensioni vere: un numero intero di ripetizioni sul giro)
  let wallMat = null, panelSkinMat = null; // materiali con la texture del muro e dei pannelli (si ricolorano)
  if (WALL_TEX_FACADES.includes(st.facade)) {
    const T = wallTexture(st.wallTexture), map = new THREE.CanvasTexture(T.canvas), nmap = new THREE.CanvasTexture(T.normal);
    for (const t of [map, nmap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
    map.colorSpace = THREE.SRGBColorSpace;
    const metal = st.wallTexture === 'metal';
    wallMat = new THREE.MeshStandardMaterial({ map, normalMap: nmap, roughness: metal ? 0.45 : 0.85, metalness: metal ? 0.3 : 0, side: THREE.DoubleSide });
    own.push(map, nmap, wallMat);
    const g = outerSkin(THREE, shape, 0.03, T.tileU, T.tileV);
    const skin = new THREE.Mesh(g, wallMat);
    skin.castShadow = skin.receiveShadow = true;
    group.add(skin);
    own.push(g);
  }

  const inst = (mat, list, geo = box) => {
    if (!list.length) return;
    const m = new THREE.InstancedMesh(geo, mat, list.length / 16);
    m.instanceMatrix.array.set(list);
    m.instanceMatrix.needsUpdate = true;
    m.frustumCulled = false;
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    own.push(m);
  };

  const ramps = surface(), wedges = surface();
  const lights = lightsOf(st);
  let deckMat = null;
  const G = st.roof === 'girders' ? girdersOf(shape, st) : null;
  // dove stanno le torri delle rampe lungo un tratto (agli angoli, con le travi rosse, ci sono già le torri d'angolo)
  const rampStations = (run, cum) => rampUs(shape, st, run, cum);

  // dove c'è la copertura (tutto unito, per settore, solo tribune, solo curve...)
  const roofRuns = coveredRuns(shape, st);
  const roofShape = roofShapeOf(shape, st, roofRuns);
  const R = st.roof !== 'none' && st.roof !== 'stands' && st.roof !== 'dragon' && !WRAP_ROOFS.includes(st.roof) ? roofOf(roofShape, st.roof, reachOf_(st)) : null;
  let shellMat = null, roofDecor = null, tentGlass = null;
  if (st.roof === 'wave') {
    // copertura ondulata: sopra i cuscini a spicchi radiali, sotto la membrana chiara con le travi reticolari d'acciaio;
    // fuori la fascia bianca e, sotto la fascia, i piani in cemento a vista e l'ingresso principale
    const V = waveOf(shape, st), N = WAVE_ROW;
    const cush = cushionTexture('quilt'), tex = new THREE.CanvasTexture(cush.canvas), bump = new THREE.CanvasTexture(cush.normal);
    const bandTex = new THREE.CanvasTexture(waveBandCanvas());
    for (const t of [tex, bump, bandTex]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
    tex.colorSpace = bandTex.colorSpace = THREE.SRGBColorSpace;
    // di notte la copertura si schiarisce un poco (illuminata)
    shellMat = new THREE.MeshStandardMaterial({ map: tex, normalMap: bump, roughness: 0.4, side: THREE.FrontSide, emissive: 0x7d858e, emissiveMap: tex, emissiveIntensity: 0 });
    const underMat = new THREE.MeshStandardMaterial({ map: tex, color: 0xc3c9cf, roughness: 0.85, side: THREE.BackSide });
    const bandMat = new THREE.MeshStandardMaterial({ map: bandTex, roughness: 0.35, side: THREE.DoubleSide });
    own.push(tex, bump, bandTex, shellMat, underMat, bandMat);
    // file della copertura: fascia (sotto, sopra), bordo arrotondato, tetto fino all'apertura e labbro
    const NR = 12, rowsAt = (d, y) => V.rowAt(d).map(([x, z]) => [x, y(x, z), z]);
    const bandRows = [rowsAt(V.dE, V.bandBottom), rowsAt(V.dE, (x, z) => V.edge(x, z) - 1.2),
      rowsAt(V.dE - 0.35, (x, z) => V.edge(x, z) - 0.35), rowsAt(V.dE - 1.2, V.edge)];
    const roofRows = [];
    for (let j = 0; j <= NR; j++) { const f = j / NR, d = V.dE - 1.2 + (V.dIn - V.dE + 1.2) * f; roofRows.push({ d, f, row: rowsAt(d, (x, z) => V.hAt(x, z, f)) }); }
    const lip = rowsAt(V.dIn - 0.4, (x, z) => V.hAt(x, z, 1) - 1.2);
    const strips = Math.max(24, Math.round(outlineLength(V.rowAt(V.dE)) / cush.tileU));
    const gTop = sweepRows(THREE, [...roofRows.map(r => r.row), lip], strips, cush.tileV);
    const gBand = sweepRows(THREE, bandRows, Math.round(outlineLength(V.rowAt(V.dE)) / 2.4), 40);
    const roofTop = new THREE.Mesh(gTop, shellMat), roofUnder = new THREE.Mesh(gTop, underMat), band = new THREE.Mesh(gBand, bandMat);
    roofTop.castShadow = roofTop.receiveShadow = band.castShadow = band.receiveShadow = true;
    roofUnder.receiveShadow = true;
    group.add(roofTop, roofUnder, band);
    own.push(gTop, gBand);
    roofDecor = { band: bandMat };

    // soffitto sotto il tetto (fuori non cambia niente): dall'apertura scende fino ad appoggiarsi sul muretto dietro
    // l'ultima fila, seguendo la cima degli spalti; dietro gli spalti resta piano a quella quota fino alla fascia
    const standTop = (d, x, z) => Math.max(standTopAt(shape, d), extTopAt(shape, x, z));
    const SL = standLine(shape);
    roofRows.forEach(r => {
      r.ceil = r.row.map(([x, Y, z], i) => {
        const S = SL.h(x, z), rB = SL.r(x, z), rP = Math.hypot(x, z), rL = Math.hypot(lip[i][0], lip[i][2]), YL = lip[i][1];
        let C = S;
        if (rP < rB) { const t = Math.min(1, Math.max(0, (rB - rP) / ((rB - rL) || 1))); C = S + (YL - S) * (1 - (1 - t) ** 1.6); }
        C = Math.max(C, standTop(r.d, x, z) + 0.4);
        const w = SL.w(x, z);
        return [x, Math.min(Y - 0.6, C * w + (Y - 0.6) * (1 - w)), z];
      });
    });
    // membrana chiara che lascia passare un po' di luce (di notte illuminata dai fari)
    const ceilMat = new THREE.MeshStandardMaterial({ map: tex, color: 0xe2e6ea, roughness: 0.8, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.16 });
    nightGlow.push([ceilMat, 0.16, 0.24]);
    const gCeil = sweepRows(THREE, [...roofRows.map(r => r.ceil), lip], strips, cush.tileV);
    const ceil = new THREE.Mesh(gCeil, ceilMat);
    ceil.receiveShadow = true;
    group.add(ceil);
    own.push(ceilMat, gCeil);

    // travi reticolari radiali sotto il soffitto (più alte a metà, sempre sopra gli spalti), anelli e trave lungo
    // l'apertura
    const under = (r, i, dy) => { const [x, y, z] = r.ceil[i]; return [x, y + dy, z]; };
    for (let i = 0; i < N; i += 6) {
      let prev = null;
      for (const r of roofRows) {
        const [x, y, z] = under(r, i, -0.5), depth = Math.min(0.8 + 3.4 * Math.sin(Math.PI * r.f) ** 0.8, Math.max(0.6, y - standTop(r.d, x, z) - 2.5));
        const cur = { x, z, t: y, b: y - depth };
        beam(beams, x, cur.t, z, x, cur.b, z, 0.18);
        if (prev) {
          beam(beams, prev.x, prev.t, prev.z, x, cur.t, z, 0.34);
          beam(beams, prev.x, prev.b, prev.z, x, cur.b, z, 0.3);
          beam(beams, prev.x, prev.t, prev.z, x, cur.b, z, 0.16);
        }
        prev = cur;
      }
    }
    const rim = roofRows[NR], mid = [roofRows[Math.round(NR / 3)], roofRows[Math.round(2 * NR / 3)]];
    for (let i = 0; i < N; i += 2) {
      const a = under(rim, i, -0.6), b = under(rim, (i + 2) % N, -0.6);
      beam(beams, ...a, ...b, 0.4);
      beam(beams, a[0], a[1] - 2.8, a[2], b[0], b[1] - 2.8, b[2], 0.34);
      beam(beams, ...a, b[0], b[1] - 2.8, b[2], 0.16);
      beam(beams, a[0], a[1], a[2], a[0], a[1] - 2.8, a[2], 0.16);
      for (const r of mid) beam(beams, ...under(r, i, -0.6), ...under(r, (i + 2) % N, -0.6), 0.26);
    }
    if (lights === 'roof') {
      for (let i = 0; i < N; i += 8) { const [x, y, z] = under(rim, i, -3.6); lampAt(lamps, x, y, z, 2.4, 1.3); }
      for (let k = 0; k < 6; k++) { const [x, y, z] = under(rim, Math.floor((k + 0.5) / 6 * N), -3.8); spots.push([x, y, z]); }
    }

    // sotto la fascia: piani in cemento a vista (solette con il bordo chiaro) e pilastri, tra gli spalti e la fascia;
    // al centro della curva il portale dell'ingresso, alto fino alla fascia, con la vetrata a lamelle e gli schermi
    const inner = evenOutline(shellOutline(shape, shape.outer - 0.3, N * 4), N), VE = veloEntryOf(shape, st), { outer, bb, entry } = VE;
    const dpos = [], quad = (a, b, c, d) => dpos.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (let L = V.base + 5.2; L < Math.max(...bb) - 2; L += 5.2) {
      for (let i = 0; i < N; i++) {
        const k = i + 1;
        if (bb[i] < L + 2 || bb[k] < L + 2 || entry[i] || entry[k]) continue;
        const [ix0, iz0] = inner[i], [ix1, iz1] = inner[k], [ox0, oz0] = outer[i], [ox1, oz1] = outer[k];
        quad([ix0, L, iz0], [ox0, L, oz0], [ox1, L, oz1], [ix1, L, iz1]);
        quad([ix0, L - 0.45, iz0], [ox0, L - 0.45, oz0], [ox1, L - 0.45, oz1], [ix1, L - 0.45, iz1]);
        quad([ox0, L - 0.45, oz0], [ox1, L - 0.45, oz1], [ox1, L + 1.05, oz1], [ox0, L + 1.05, oz0]);
      }
    }
    if (dpos.length) {
      const dg = new THREE.BufferGeometry();
      dg.setAttribute('position', new THREE.Float32BufferAttribute(dpos, 3));
      dg.computeVertexNormals();
      const decks = new THREE.Mesh(dg, structMat);
      decks.castShadow = decks.receiveShadow = true;
      group.add(decks);
      own.push(dg);
    }
    for (let i = 0; i < N; i += 4) {
      if (entry[i] || bb[i] < V.base + 4) continue;
      const [x, z] = outer[i];
      beam(pilasters, x, V.base, z, x, bb[i] - 0.1, z, 1);
    }
    // portale: i due grandi pilastri ai lati (vetrate, pensilina, schermi e logo con gli altri ingressi, più sotto)
    if (VE.ent.length > 1) for (const i of [VE.ent[0], VE.ent[VE.ent.length - 1]]) {
      const [x, z] = outer[i], [xb, zb] = VE.back[i];
      beam(pilasters, (x + xb) / 2, V.base, (z + zb) / 2, (x + xb) / 2, bb[i], (z + zb) / 2, 2.6);
    }
  }
  if (st.roof === 'blades') {
    // stile Bernabéu: basamento vetrato, facciata a lame orizzontali che si gonfia, camminamento scuro, tetto a lame
    // concentriche fino all'apertura; sotto il tetto le travi bianche; di notte facciata e vetri si accendono
    const L = bladesOf(shape, st), N = BLADES_ROW;
    const rowsOf = (list) => list.map(([d, h]) => L.rowAt(d).map(([x, z]) => [x, h(x, z), z]));
    const texOf = (T) => { const a = new THREE.CanvasTexture(T.canvas), b = new THREE.CanvasTexture(T.normal); for (const t of [a, b]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; } a.colorSpace = THREE.SRGBColorSpace; own.push(a, b); return [a, b]; };
    const [rMap, rNrm] = texOf(bladesTexture('roof')), [fMap, fNrm] = texOf(bladesTexture('facade'));
    shellMat = new THREE.MeshStandardMaterial({ map: rMap, normalMap: rNrm, roughness: 0.3, metalness: 0.55, side: THREE.FrontSide });
    const underMat = new THREE.MeshStandardMaterial({ color: 0xd6dadf, roughness: 0.8, side: THREE.BackSide });
    const facMat = new THREE.MeshStandardMaterial({ map: fMap, normalMap: fNrm, roughness: 0.3, metalness: 0.55, side: THREE.DoubleSide, emissive: 0xffe2b8, emissiveMap: fMap, emissiveIntensity: 0 });
    const darkGlass = new THREE.MeshStandardMaterial({ color: 0x1c2229, roughness: 0.2, metalness: 0.4, side: THREE.DoubleSide, emissive: 0xffd9a0, emissiveIntensity: 0.02 });
    own.push(shellMat, underMat, facMat, darkGlass);
    nightGlow.push([facMat, 0, 0.32], [darkGlass, 0.02, 0.6]);
    roofDecor = { band: facMat };
    const len = outlineLength(L.rowAt(L.o + 8.6));
    const gRoof = sweepRows(THREE, rowsOf(L.roof), Math.round(len / 2), 3);
    const gFac = sweepRows(THREE, rowsOf(L.facade), Math.round(len / 3), 1.35);
    const sky = sweepRows(THREE, rowsOf([[L.o + 7, L.edge], [L.o + 7, (x, z) => L.edge(x, z) + 2.2]]), 1, 50);
    const skyCeil = sweepRows(THREE, rowsOf([[L.o + 7, (x, z) => L.edge(x, z) + 2.2], [L.o + 8.6, (x, z) => L.edge(x, z) + 2.2]]), 1, 50);
    const skyFloor = sweepRows(THREE, rowsOf([[L.o + 7, L.edge], [L.o + 8.3, L.edge]]), 1, 50);
    const soffit = sweepRows(THREE, rowsOf([[L.o + 6, () => L.base], [L.o + 7.4, () => L.base]]), 1, 50);
    const G = facadeTexture('glass'), gMap = new THREE.CanvasTexture(G.canvas);
    gMap.wrapS = gMap.wrapT = THREE.RepeatWrapping; gMap.colorSpace = THREE.SRGBColorSpace;
    const baseMat = new THREE.MeshStandardMaterial({ map: gMap, roughness: 0.15, metalness: 0.45, side: THREE.DoubleSide, emissive: 0xffd9a0, emissiveMap: gMap, emissiveIntensity: 0 });
    nightGlow.push([baseMat, 0, 0.45]);
    own.push(gMap, baseMat);
    const gBase = sweepRows(THREE, rowsOf([[L.o + 6, () => 0], [L.o + 6, () => L.base]]), Math.round(outlineLength(L.rowAt(L.o + 6)) / G.tileU), G.tileV);
    for (const [g, m, sh] of [[gRoof, shellMat, true], [gRoof, underMat, false], [gFac, facMat, true], [sky, darkGlass, false], [skyCeil, dark, false],
      [skyFloor, dark, false], [soffit, dark, false], [gBase, baseMat, false]]) {
      const mesh = new THREE.Mesh(g, m);
      mesh.castShadow = sh; mesh.receiveShadow = true;
      group.add(mesh);
    }
    own.push(gRoof, gFac, sky, skyCeil, skyFloor, soffit, gBase);
    // travi bianche sotto il tetto: radiali dal bordo dell'apertura fino al camminamento, e due anelli
    const R = L.roof.map(([d, h]) => ({ d, h, row: L.rowAt(d) })), i0 = 3;
    for (let i = 0; i < N; i += 6) {
      let prev = null;
      for (let j = i0; j < R.length - 1; j++) {
        const [x, z] = R[j].row[i], y = R[j].h(x, z) - 0.6, f = (j - i0) / (R.length - 2 - i0), dep = 0.8 + 2.4 * Math.sin(Math.PI * f);
        const cur = [x, y, z, y - dep];
        beam(beams, x, y, z, x, y - dep, z, 0.16);
        if (prev) { beam(beams, prev[0], prev[1], prev[2], x, y, z, 0.3); beam(beams, prev[0], prev[3], prev[2], x, y - dep, z, 0.26); beam(beams, prev[0], prev[1], prev[2], x, y - dep, z, 0.14); }
        prev = cur;
      }
    }
    const rim = R[R.length - 2];
    for (let i = 0; i < N; i += 2) {
      const [x0, z0] = rim.row[i], [x1, z1] = rim.row[(i + 2) % N], y0 = rim.h(x0, z0) - 0.6, y1 = rim.h(x1, z1) - 0.6;
      beam(beams, x0, y0, z0, x1, y1, z1, 0.4); beam(beams, x0, y0 - 2.6, z0, x1, y1 - 2.6, z1, 0.34); beam(beams, x0, y0, z0, x1, y1 - 2.6, z1, 0.15);
    }
    if (lights === 'roof') {
      const edge = L.rowAt(L.dIn + 1);
      for (let i = 0; i < N; i += 8) lampAt(lamps, edge[i][0], L.hIn - 3.6, edge[i][1], 2.4, 1.3);
      for (let k = 0; k < 6; k++) { const [x, z] = edge[Math.floor((k + 0.5) / 6 * N)]; spots.push([x, L.hIn - 3.8, z]); }
    }
  }
  if (st.roof === 'dragon') {
    // nastro del drago: pannelli solari a scaglie sopra (e sulla parte alta del lato fuori), sotto e fuori i grandi tubi
    // bianchi a spirale nei due versi che salgono da terra; dove la copertura finisce il nastro scende a terra e, con il
    // ferro di cavallo, continua fuori con la coda
    const D = dragonOf(shape, st), sol = solarTexture();
    const solar = new THREE.CanvasTexture(sol.canvas), solarN = new THREE.CanvasTexture(sol.normal);
    for (const t of [solar, solarN]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
    solar.colorSpace = THREE.SRGBColorSpace;
    shellMat = new THREE.MeshStandardMaterial({ map: solar, normalMap: solarN, roughness: 0.28, metalness: 0.45 });
    const underMat = new THREE.MeshStandardMaterial({ color: 0x39414b, roughness: 0.8 });
    const tubeMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.15 });
    own.push(solar, solarN, shellMat, underMat, tubeMat);
    const tail = hasDragonTail(shape, st, roofRuns) ? dragonTail(shape) : null;
    const runs = [...roofRuns, ...(tail ? [tail] : []), ...dragonCaps(shape, roofRuns, !!tail)];
    let sideSet = false;
    for (const run of runs) {
      const top = sweepRun(THREE, run, D.prof, D.split, D.prof.length - 1, sol.tileU, sol.tileV);
      if (!sideSet) {
        // la faccia di sopra guarda in alto?
        const nrm = top.getAttribute('normal'), R = D.prof.length - D.split, i = Math.floor(run.pts.length / 2) * R + Math.floor(R * 0.6);
        const up = nrm.getY(i) > 0;
        shellMat.side = up ? THREE.FrontSide : THREE.BackSide; underMat.side = up ? THREE.BackSide : THREE.FrontSide;
        sideSet = true;
      }
      const mt = new THREE.Mesh(top, shellMat), mu = new THREE.Mesh(top, underMat);
      mt.castShadow = mt.receiveShadow = true;
      group.add(mt, mu);
      own.push(top);
    }
    // tubi: due famiglie a spirale (salgono da terra e girano sopra fino al bordo verso il campo, avanzando lungo il
    // nastro), più i tubi lungo il nastro a terra, a metà e sul bordo
    const tubes = [], PITCH = 38, EVERY = 5.6, K = 20, dc = D.prof[0].d - 5;
    const pl = [0];
    for (let j = 1; j < D.inner.length; j++) pl.push(pl[j - 1] + Math.hypot(D.inner[j].d - D.inner[j - 1].d, D.inner[j].h - D.inner[j - 1].h));
    const profAt = (f) => {
      const L = f * pl[pl.length - 1];
      let j = 1;
      while (j < pl.length - 1 && pl[j] < L) j++;
      const a = D.inner[j - 1], b = D.inner[j], t = (L - pl[j - 1]) / ((pl[j] - pl[j - 1]) || 1);
      return [a.d + (b.d - a.d) * t, a.h + (b.h - a.h) * t];
    };
    const prof = Array.from({ length: K + 1 }, (_, k) => profAt(k / K));
    for (const run of runs) {
      const R = ribbonSampler(run, dc);
      for (const [sgn, r] of [[1, 0.6], [-1, 0.36]]) {
        const from = run.closed ? 0 : -PITCH, to = run.closed ? R.total - 0.01 : R.total + PITCH;
        for (let u0 = from; u0 <= to; u0 += EVERY) {
          let prev = null;
          for (let k = 0; k <= K; k++) {
            const p = R.at(u0 + sgn * PITCH * k / K, prof[k][0], prof[k][1]);
            if (p && prev) tubeAt(tubes, ...prev, ...p, r);
            prev = p;
          }
        }
      }
      for (const f of [0, D.split / (D.prof.length - 1) * 0.9, 1]) {
        const [pd, ph] = profAt(f);
        let prev = null;
        for (let u = 0; u <= R.total + 0.01; u += 3) {
          const p = R.at(Math.min(u, R.total), pd, ph + (f === 0 ? 0.4 : 0));
          if (p && prev) tubeAt(tubes, ...prev, ...p, f === 0 ? 0.55 : 0.4);
          prev = p;
        }
      }
    }
    if (tubes.length) {
      const m = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 10), tubeMat, tubes.length / 16);
      m.instanceMatrix.array.set(tubes);
      m.instanceMatrix.needsUpdate = true;
      m.frustumCulled = false;
      m.castShadow = m.receiveShadow = true;
      group.add(m);
      own.push(m.geometry, m);
    }
    roofDecor = { solar: shellMat, tubes: tubeMat };
    if (lights === 'roof') {
      for (const run of roofRuns) {
        const cum = runLengths(run), total = cum[cum.length - 1];
        for (const u of stations(run, cum, 8, D.dF + 1.2)) { const [x, z] = pointAt(run, cum, u, D.dF + 1.2); lampAt(lamps, x, D.hF - 1.6, z, 2.2, 1.2); }
        for (const f of [0.2, 0.5, 0.8]) { const [x, z] = pointAt(run, cum, total * f, D.dF + 1); spots.push([x, D.hF - 2, z]); }
      }
    }
    if (tail) {
      // pavimento sotto la coda
      const fg = sweepRun(THREE, tail, [{ d: D.out + 4, h: 0.04 }, { d: -6, h: 0.04 }], 0, 1, 20, 20);
      const floor = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ color: shade(st.colors.structure, 0.85), roughness: 1, side: THREE.DoubleSide }));
      roofDecor.floor = floor.material;
      floor.receiveShadow = true;
      group.add(floor);
      own.push(fg, floor.material);
    }
  }
  if (st.roof === 'crown') {
    // corona di vele: falde di membrana tra creste e valli, anello in cima, colonne inclinate sotto le punte delle vele,
    // travi sotto le creste e passerella ad anello appesa sotto il tetto
    const C = crownOf(shape, st), N = CROWN_FOLDS, step = CROWN_ROW / N, M = 12;
    const tex = new THREE.CanvasTexture(crownMembraneCanvas());
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    shellMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide, emissive: 0xb4bcc2, emissiveIntensity: 0 }); // di notte le vele illuminate da sotto
    const ringMat = new THREE.MeshStandardMaterial({ roughness: 0.45, side: THREE.DoubleSide });
    own.push(tex, shellMat, ringMat);
    const P = (line, i, t) => { const { d, h } = C.at(line, t), [x, z] = C.rowAt(d)[i]; return [x, h, z]; };
    const pos = [], uv = [], idx = [];
    // una falda: striscia dalla linea a (punto i) alla linea b (punto j), da fuori verso il campo; divisa anche di
    // traverso (Q) perché le cuciture restino dritte
    const Q = 4;
    const strip = (la, i, ua, lb, j, ub) => {
      const b0 = pos.length / 3;
      for (let m = 0; m <= M; m++) {
        const t = m / M, A = P(la, i, t), B = P(lb, j, t);
        for (let q = 0; q <= Q; q++) { const f = q / Q; pos.push(A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, A[2] + (B[2] - A[2]) * f); uv.push(ua + (ub - ua) * f, t * 3); }
      }
      for (let m = 0; m < M; m++) for (let q = 0; q < Q; q++) { const a = b0 + m * (Q + 1) + q, b = a + Q + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    };
    for (let k = 0; k < N; k++) {
      strip(C.ridge, k * step, 0, C.valley, k * step + step / 2, 1);
      strip(C.valley, k * step + step / 2, 1, C.ridge, (k + 1) * step, 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const sails = new THREE.Mesh(g, shellMat);
    sails.castShadow = sails.receiveShadow = true;
    group.add(sails);
    own.push(g);
    // tubi bianchi: anello in cima (dove arrivano le creste), anello più in basso sulle colonne (dove arrivano le valli),
    // il zig-zag tra i due lungo i bordi delle vele e i denti verso il campo; colonne a lama, più larghe in alto
    const tubes = [], top = C.rowAt(C.dR), low = C.rowAt(C.dV);
    for (let i = 0; i < CROWN_ROW; i += 2) {
      tubeAt(tubes, top[i][0], C.hR + 0.2, top[i][1], top[i + 2][0], C.hR + 0.2, top[i + 2][1], 0.95);
      tubeAt(tubes, low[i][0], C.hV, low[i][1], low[i + 2][0], C.hV, low[i + 2][1], 0.7);
    }
    const posts = [];
    const dC = C.dIn + (C.o - C.dIn) * 0.32, hC = C.hAt(C.valley, dC) - 1.4, rowC = C.rowAt(dC);
    for (let k = 0; k < N; k++) {
      const r = k * step, v = r + step / 2, r2 = (k + 1) * step;
      // bordi delle vele verso fuori (la V tra i due anelli) e colonna inclinata fino a terra
      const R0 = P(C.ridge, r, 0), V0 = P(C.valley, v, 0), R1 = P(C.ridge, r2, 0), [fx, fz] = C.rowAt(C.dFoot)[v];
      tubeAt(tubes, ...R0, ...V0, 0.5); tubeAt(tubes, ...V0, ...R1, 0.5);
      const [ta, tb] = [C.rowAt(C.dV)[(v + CROWN_ROW - 1) % CROWN_ROW], C.rowAt(C.dV)[(v + 1) % CROWN_ROW]];
      // niente colonne davanti agli ingressi (l'anello e le vele restano)
      if (!inEntranceBand(shape, st, fx, fz, 2.5)) posts.push([[fx, C.base, fz], [V0[0], V0[1] - 0.4, V0[2]], [tb[0] - ta[0], tb[1] - ta[1]]]);
      // bordo verso il campo a denti
      const Ri = P(C.ridge, r, 1), Vi = P(C.valley, v, 1), Ri2 = P(C.ridge, r2, 1);
      tubeAt(tubes, ...Ri, ...Vi, 0.3); tubeAt(tubes, ...Vi, ...Ri2, 0.3);
      // trave sotto la cresta
      for (let m = 0; m < M; m++) {
        const a = P(C.ridge, r, m / M), b = P(C.ridge, r, (m + 1) / M);
        beam(beams, a[0], a[1] - 0.8, a[2], b[0], b[1] - 0.8, b[2], 0.4);
      }
      // tirante dalla passerella alla cresta
      const [cx, cz] = rowC[r];
      beam(beams, cx, hC, cz, cx, C.hAt(C.ridge, dC) - 1, cz, 0.12);
    }
    // passerella ad anello: due correnti e le diagonali
    for (let i = 0; i < CROWN_ROW; i += 2) {
      const [x0, z0] = rowC[i], [x1, z1] = rowC[i + 2];
      beam(beams, x0, hC, z0, x1, hC, z1, 0.25);
      beam(beams, x0, hC - 1.3, z0, x1, hC - 1.3, z1, 0.25);
      beam(beams, x0, hC, z0, x1, hC - 1.3, z1, 0.12);
    }
    const tm = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 14), ringMat, tubes.length / 16);
    tm.instanceMatrix.array.set(tubes);
    tm.instanceMatrix.needsUpdate = true;
    tm.frustumCulled = false;
    tm.castShadow = tm.receiveShadow = true;
    group.add(tm);
    own.push(tm.geometry, tm);
    // colonne: tronchi di piramide schiacciati (stretti a terra, larghi sotto l'anello), inclinati verso fuori
    const cpos = [];
    for (const [a, b, [tx0, tz0]] of posts) {
      const tl = Math.hypot(tx0, tz0) || 1, tx = tx0 / tl, tz = tz0 / tl;
      const rx = b[0] - a[0], rz = b[2] - a[2], rl = Math.hypot(rx, rz) || 1, nx = rx / rl, nz = rz / rl;
      const corner = (p, w, t, sw, st) => [p[0] + tx * w * sw + nx * t * st, p[1], p[2] + tz * w * sw + nz * t * st];
      const ring4 = (p, w, t) => [corner(p, w, t, -1, -1), corner(p, w, t, 1, -1), corner(p, w, t, 1, 1), corner(p, w, t, -1, 1)];
      const lo = ring4(a, 0.6, 0.55), hi = ring4(b, 2.1, 0.8);
      for (let q = 0; q < 4; q++) { const q1 = (q + 1) % 4; cpos.push(...lo[q], ...lo[q1], ...hi[q1], ...lo[q], ...hi[q1], ...hi[q]); }
      cpos.push(...hi[0], ...hi[1], ...hi[2], ...hi[0], ...hi[2], ...hi[3]);
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(cpos, 3));
    cg.computeVertexNormals();
    const cols = new THREE.Mesh(cg, ringMat);
    cols.castShadow = cols.receiveShadow = true;
    group.add(cols);
    own.push(cg);
    roofDecor = { tubes: ringMat };
    if (lights === 'roof') {
      for (let k = 0; k < N; k++) { const [x, y, z] = P(C.ridge, k * step, 0.97); lampAt(lamps, x, y - 1.6, z, 2.4, 1.3); }
      for (let k = 0; k < 6; k++) { const [x, y, z] = P(C.ridge, Math.round((k + 0.5) / 6 * N) * step, 0.95); spots.push([x, y - 2, z]); }
    }
  }
  if (st.roof === 'dome') {
    // cupola a raggiera (Samara Arena): sopra lamiera bianca aggraffata con le nervature che convergono verso
    // l'apertura e i costoloni dei settori; sotto il soffitto a pannelli con la fascia chiara verso l'apertura (luce che
    // passa) e il traliccio d'acciaio vero (travi reticolari radiali, anelli, grande trave triangolata attorno
    // all'apertura); anello in rilievo attorno all'apertura; corona di denti triangolari alla base con le vetrate dietro
    const D = domeOf(shape, st), SECT = 32;
    const texOf = (T, rx, ry) => {
      const a = new THREE.CanvasTexture(T.canvas), b = new THREE.CanvasTexture(T.normal);
      for (const t of [a, b]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.repeat.set(rx, ry); }
      a.colorSpace = THREE.SRGBColorSpace; own.push(a, b);
      return [a, b];
    };
    const [topTex, topNrm] = texOf(domeMetalTexture(), 1, 1), [subTex, subNrm] = texOf(domeSoffitTexture(), 1, 1);
    const g = sweepGrid(THREE, D.rowAt, D.pts, SECT, 9);
    // sotto: la parte fuori a pannelli, quella verso l'apertura chiara (pannelli traslucidi, di giorno lascia passare
    // la luce); un pannello ogni 12 m sul giro più largo
    const jClear = Math.max(1, D.pts.length - 7), subK = Math.round(outlineLength(D.rowAt(D.dOut)) / 12);
    const gu = sweepGrid(THREE, D.rowAt, D.pts.slice(0, jClear + 1), subK, 6);
    const gc = sweepGrid(THREE, D.rowAt, D.pts.slice(jClear), subK, 6);
    shellMat = new THREE.MeshStandardMaterial({ map: topTex, normalMap: topNrm, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.32, metalness: 0.25, side: THREE.FrontSide, emissiveMap: topTex, emissiveIntensity: 0 }); // di notte si accende
    // sotto: un po' di luce riflessa (il sole non ci arriva), di notte illuminato dai fari
    const underMat = new THREE.MeshStandardMaterial({ map: subTex, normalMap: subNrm, color: 0xe6e9ec, roughness: 0.85, side: THREE.BackSide, emissive: 0xc9ced4, emissiveMap: subTex, emissiveIntensity: 0.32 });
    // traliccio del colore della copertura (bianco come alla Samara Arena), anche lui un po' rischiarato
    const domeSteel = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.25, emissive: 0xffffff, emissiveIntensity: 0.14 });
    tints.push([domeSteel, 'roof']);
    nightGlow.push([underMat, 0.32, 0.4]);
    const truss = [];
    const clearMat = new THREE.MeshStandardMaterial({ color: 0xeef2f5, roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0.28, side: THREE.BackSide, transparent: true, opacity: 0.92 });
    nightGlow.push([clearMat, 0.28, 0.06]);
    // la faccia di sopra guarda in alto? (dipende dal verso della griglia)
    const nrm = g.getAttribute('normal'), cols = D.rowAt(D.pts[0].d).length;
    if (nrm.getY(Math.floor(D.pts.length / 2) * cols + 5) < 0) { shellMat.side = THREE.BackSide; underMat.side = clearMat.side = THREE.FrontSide; }
    const roofTop = new THREE.Mesh(g, shellMat), roofUnder = new THREE.Mesh(gu, underMat), roofClear = new THREE.Mesh(gc, clearMat);
    roofTop.castShadow = roofTop.receiveShadow = true;
    roofUnder.receiveShadow = true;
    group.add(roofTop, roofUnder, roofClear);
    own.push(shellMat, underMat, clearMat, domeSteel, g, gu, gc);
    // traliccio sotto la cupola: una trave reticolare radiale per costolone e una in mezzo a ogni settore (più alta a
    // metà, sempre sopra gli spalti), tre anelli e la grande trave ad anello a tre correnti attorno all'apertura
    const NP = cols - 1, rows = D.pts.map(p => ({ p, row: D.rowAt(p.d) })), last = rows.length - 1;
    for (let k = 0; k < SECT * 2; k++) {
      const i = Math.round(k / (SECT * 2) * NP) % NP, main = k % 2 === 0;
      let prev = null;
      for (let j = 1; j < last - 1; j++) {
        const { p, row } = rows[j], [x, z] = row[i], y = p.h - 0.45, f = j / last;
        const depth = Math.min((main ? 1 : 0.6) + (main ? 3.4 : 2.2) * Math.sin(Math.PI * f) ** 0.8, Math.max(0.6, y - standTopAt(shape, p.d) - 2.5));
        const cur = [x, y, z, y - depth];
        beam(truss, x, y, z, x, y - depth, z, main ? 0.16 : 0.12);
        if (prev) {
          beam(truss, prev[0], prev[1], prev[2], x, y, z, main ? 0.34 : 0.24);
          beam(truss, prev[0], prev[3], prev[2], x, y - depth, z, main ? 0.3 : 0.2);
          beam(truss, prev[0], prev[1], prev[2], x, y - depth, z, main ? 0.15 : 0.1);
        }
        prev = cur;
      }
    }
    // arcarecci ad anello sotto il soffitto (uno per fila: la maglia fitta) e tre anelli più grossi
    const big = [Math.round(last * 0.22), Math.round(last * 0.5), Math.round(last * 0.75)];
    for (let j = 1; j < last - 1; j++) {
      const { p, row } = rows[j], t = big.includes(j) ? 0.26 : 0.1, y = p.h - (big.includes(j) ? 0.6 : 0.3);
      for (let i = 0; i < NP; i += 2) { const [x0, z0] = row[i], [x1, z1] = row[(i + 2) % NP]; beam(truss, x0, y, z0, x1, y, z1, t); }
    }
    // trave ad anello attorno all'apertura: due correnti sopra (dentro e fuori) e uno sotto, montanti e diagonali
    const rIn = D.rowAt(D.dIn + 0.8), rOut = D.rowAt(D.dIn + 4.2), rLow = D.rowAt(D.dIn + 2.5);
    const yT = D.top - 0.9, yL = D.top - 4.6;
    for (let i = 0; i < NP; i += 2) {
      const n2 = (i + 2) % NP;
      beam(truss, rIn[i][0], yT, rIn[i][1], rIn[n2][0], yT, rIn[n2][1], 0.45);
      beam(truss, rOut[i][0], yT, rOut[i][1], rOut[n2][0], yT, rOut[n2][1], 0.45);
      beam(truss, rLow[i][0], yL, rLow[i][1], rLow[n2][0], yL, rLow[n2][1], 0.5);
      beam(truss, rIn[i][0], yT, rIn[i][1], rOut[i][0], yT, rOut[i][1], 0.2);
      for (const r of [rIn, rOut]) {
        beam(truss, r[i][0], yT, r[i][1], rLow[i][0], yL, rLow[i][1], 0.22);
        beam(truss, r[n2][0], yT, r[n2][1], rLow[i][0], yL, rLow[i][1], 0.16);
      }
    }
    inst(domeSteel, truss);
    // anello attorno all'apertura
    const lip = [[D.dIn + 2.5, D.top - 0.2], [D.dIn + 1.6, D.top + 1.4], [D.dIn, D.top + 1.9], [D.dIn - 1.5, D.top + 1.2], [D.dIn - 1.8, D.top - 0.6], [D.dIn - 0.6, D.top - 1.8], [D.dIn + 2.5, D.top - 1.2]]
      .map(([d, h]) => ({ d, h }));
    const lg = sweepGrid(THREE, D.rowAt, lip, 1, 50);
    const rim = new THREE.Mesh(lg, new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.4, side: THREE.DoubleSide }));
    rim.castShadow = true;
    group.add(rim);
    own.push(lg, rim.material);
    // stessa lamiera della cupola, del colore della copertura, per i denti (o la fascia del bordo)
    const teethMat = new THREE.MeshStandardMaterial({ map: topTex, normalMap: topNrm, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.32, metalness: 0.25, side: THREE.DoubleSide });
    tints.push([teethMat, 'roof']);
    // di notte si accendono come la cupola (stessa luce)
    teethMat.emissive = shellMat.emissive; teethMat.emissiveMap = topTex;
    nightGlow.push([teethMat, 0, 0.85]);
    own.push(teethMat);
    if (st.domeTeeth) {
      // denti: triangoli piegati (due facce) dal bordo della cupola giù quasi a terra, con il piede d'acciaio
      const ring = D.rowAt(D.dOut), tipRing = D.rowAt(D.dOut + 2.6), foldRing = D.rowAt(D.dOut + 1.8), N = ring.length - 1, TEETH = 34, tp = [], tuv = [];
      for (let k = 0; k < TEETH; k++) {
        const a = ring[Math.round(k / TEETH * N)], b = ring[Math.round((k + 1) / TEETH * N) % N];
        const m = tipRing[Math.round((k + 0.5) / TEETH * N) % N], f = foldRing[Math.round((k + 0.5) / TEETH * N) % N];
        const A = [a[0], D.hb + 0.4, a[1]], B = [b[0], D.hb + 0.4, b[1]], M = [m[0], 2.2, m[1]], F = [f[0], D.hb - 1.2, f[1]];
        tp.push(...A, ...F, ...M, ...F, ...B, ...M);
        // le nervature della lamiera convergono verso la punta del dente
        const len = Math.hypot(M[0] - (A[0] + B[0]) / 2, M[1] - A[1], M[2] - (A[2] + B[2]) / 2) / 9;
        tuv.push(0, 0, 0.5, 0, 0.5, len, 0.5, 0, 1, 0, 0.5, len);
        beam(beams, m[0], 0, m[1], m[0], 2.3, m[1], 0.45);
      }
      const tg = new THREE.BufferGeometry();
      tg.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
      tg.setAttribute('uv', new THREE.Float32BufferAttribute(tuv, 2));
      tg.computeVertexNormals();
      const teeth = new THREE.Mesh(tg, teethMat);
      teeth.castShadow = teeth.receiveShadow = true;
      group.add(teeth);
      own.push(tg);
    } else {
      // senza denti: il bordo della cupola chiuso da una fascia di lamiera
      const fg = sweepGrid(THREE, D.rowAt, [{ d: D.dOut, h: D.hb + 0.4 }, { d: D.dOut, h: D.hb - 1.6 }, { d: D.dOut - 1.2, h: D.hb - 1.6 }], SECT, 9);
      const fascia = new THREE.Mesh(fg, teethMat);
      fascia.castShadow = fascia.receiveShadow = true;
      group.add(fascia);
      own.push(fg);
    }
    // dietro ai denti le vetrate dell'atrio a piani (di notte accese), con i pilastri d'acciaio
    const GT = facadeTexture('glass'), gMap = new THREE.CanvasTexture(GT.canvas);
    gMap.wrapS = gMap.wrapT = THREE.RepeatWrapping; gMap.colorSpace = THREE.SRGBColorSpace; gMap.anisotropy = 4;
    const glassMat = new THREE.MeshStandardMaterial({ map: gMap, roughness: 0.15, metalness: 0.45, side: THREE.DoubleSide, emissive: 0xffd9a0, emissiveMap: gMap, emissiveIntensity: 0 });
    nightGlow.push([glassMat, 0, 0.55]);
    const bRow = D.rowAt(D.dOut - 5), bg = sweepGrid(THREE, D.rowAt, [{ d: D.dOut - 5, h: 0 }, { d: D.dOut - 5, h: D.hb + 1 }], Math.round(outlineLength(bRow) / GT.tileU), GT.tileV);
    const back = new THREE.Mesh(bg, glassMat);
    back.receiveShadow = true;
    group.add(back);
    own.push(gMap, glassMat, bg);
    for (let i = 0; i < bRow.length - 1; i += 4) beam(beams, bRow[i][0], 0, bRow[i][1], bRow[i][0], D.hb + 0.5, bRow[i][1], 0.5);
    if (lights === 'roof') {
      const edge = D.rowAt(D.dIn + 3);
      for (let i = 0; i < edge.length - 1; i += 8) lampAt(lamps, edge[i][0], D.top - 2.4, edge[i][1], 2.4, 1.3);
      for (let k = 0; k < 6; k++) { const [x, z] = edge[Math.floor((k + 0.5) / 6 * (edge.length - 1))]; spots.push([x, D.top - 2.6, z]); }
    }
  }
  if (SHELLISH.includes(st.roof)) {
    // involucro a cuscini: parte bianca (fuori e sopra) e tetto trasparente fino all'apertura; gira tutto intorno
    // anche con le curve staccate. Di notte i cuscini si accendono del colore scelto.
    const S = shellOf(shape, st);
    const kind = st.roof === 'shell' ? st.shellPattern : st.roof === 'petals' ? 'ribs' : 'plain';
    // cuscini (rombi, esagoni, fasce): texture vera con il rilievo, un numero intero di ripetizioni sul giro alla cresta
    const cush = CUSHIONS[kind] ? cushionTexture(kind) : null, pat = cush || shellPatternCanvas(kind);
    const tex = new THREE.CanvasTexture(pat.canvas), bump = cush ? new THREE.CanvasTexture(cush.normal) : null;
    const crestLen = outlineLength(S.rowAt(S.pts.reduce((m, p) => (p.h > m.h ? p : m), S.pts[0]).d));
    const cells = cush ? Math.max(1, Math.round(crestLen / cush.tileU)) : Math.max(1, Math.round(crestLen / SHELL_CELL_U));
    for (const t of bump ? [tex, bump] : [tex]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(cush ? 1 : pat.rx, cush ? SHELL_CELL_V / cush.tileV : pat.ry);
      t.anisotropy = 8;
    }
    tex.colorSpace = THREE.SRGBColorSpace;
    const tent = st.roof === 'tent';
    shellMat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissiveIntensity: 0, roughness: cush ? 0.3 : 0.38, side: THREE.DoubleSide });
    if (bump) shellMat.normalMap = bump;
    if (tent) {
      // membrana a rete mezza trasparente: si vede la struttura sotto; di notte la rete si accende del colore scelto
      const net = netCanvases(), nm = new THREE.CanvasTexture(net.map), na = new THREE.CanvasTexture(net.alpha);
      for (const t of [nm, na]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
      nm.colorSpace = THREE.SRGBColorSpace;
      shellMat.map = nm; shellMat.emissiveMap = nm; shellMat.alphaMap = na;
      shellMat.transparent = true; shellMat.depthWrite = false; shellMat.roughness = 0.45;
      own.push(nm, na);
    }
    // la parte verso l'apertura è di cuscini trasparenti: più grigia (si vede il buio sotto) e non fa ombra
    const clearMat = new THREE.MeshStandardMaterial({ map: tex, color: 0xc9ced4, roughness: 0.2, side: THREE.DoubleSide });
    if (bump) clearMat.normalMap = bump;
    const petals = st.roof === 'petals';
    if (petals) {
      // petali: le pieghe le disegna il materiale (petalShader), fuori bianco lucido; sotto il fondo scuro con le
      // nervature
      shellMat.map = shellMat.emissiveMap = shellMat.normalMap = null;
      shellMat.roughness = 0.62; shellMat.metalness = 0.05; shellMat.side = THREE.FrontSide;
      petalShader(shellMat, false);
    }
    const petalSeams = [];
    const outer = new THREE.Mesh(petals ? petalsGeometry(THREE, S, petalSeams) : tent ? tentGeometry(THREE, S, cells) : sweepAround(THREE, S.rowAt, S.pts, 0, S.split, S.yFn, cells), shellMat);
    if (petals) {
      const underMat = new THREE.MeshStandardMaterial({ color: 0x737a83, roughness: 0.85, side: THREE.BackSide, emissive: 0x9aa1a9, emissiveIntensity: 0.1 });
      nightGlow.push([underMat, 0.1, 0.2]);
      petalShader(underMat, true);
      // la faccia di fuori guarda fuori? (dipende dal verso della griglia)
      const nr = outer.geometry.getAttribute('normal'), cols = S.rowAt(S.pts[0].d).length;
      if (nr.getY(Math.floor(S.pts.length * 0.75) * cols + 3) < 0) { shellMat.side = THREE.BackSide; underMat.side = THREE.FrontSide; }
      const und = new THREE.Mesh(outer.geometry, underMat);
      und.receiveShadow = true;
      group.add(und);
      own.push(underMat);
      // giunture tra un petalo e l'altro: profilo chiaro appena più scuro del guscio (niente righe nere)
      const seamMat = new THREE.MeshStandardMaterial({ roughness: 0.55 });
      tints.push([seamMat, 'roof']);
      seamMat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= 0.78;'); };
      own.push(seamMat);
      inst(seamMat, petalSeams);
    }
    const clear = new THREE.Mesh(petals || tent ? new THREE.BufferGeometry() : sweepAround(THREE, S.rowAt, S.pts, S.split, S.pts.length - 1, S.yFn ? (x, z, j) => S.yFn(x, z, j + S.split) : null, cells), clearMat);
    // pennoni della tenda: altissimi, avvolti dalla membrana (la tromba) fin quasi in cima; sopra resta la punta sottile
    // e sul primo l'anello panoramico a due dischi
    if (tent && S.masts.length) {
      outer.updateMatrixWorld();
      const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
      let last = S.base + 10;
      const baseY = (x, z) => {
        ray.set(new THREE.Vector3(x, 400, z), down);
        const hit = ray.intersectObject(outer, false)[0];
        if (hit) last = hit.point.y - 0.3; // appena sotto la membrana: niente fessure
        return last;
      };
      S.masts.forEach(([mx, mz], k) => {
        const H = S.top + 10, yt = H * (k === 0 ? 0.74 : 0.8);
        for (const [y0, y1, r] of [[0, H * 0.55, 1.1], [H * 0.55 - 0.2, H * 0.85, 0.75], [H * 0.85 - 0.2, H, 0.35]]) boxAt(drums, mx, (y0 + y1) / 2, mz, [r, 0, 0], [0, y1 - y0, 0], [0, 0, r]);
        const tg = tentTrumpet(THREE, mx, mz, baseY, yt, TENT_FLARE, 0.95), tm = new THREE.Mesh(tg, shellMat);
        tm.receiveShadow = true;
        group.add(tm);
        own.push(tg);
        if (k === 0) for (const [y, r] of [[H * 0.79, 7], [H * 0.765, 6]]) boxAt(sculpt, mx, y, mz, [r, 0, 0], [0, 0.9, 0], [0, 0, r]);
      });
    }
    outer.castShadow = !tent; outer.receiveShadow = true;
    clear.receiveShadow = true;
    group.add(outer, clear);
    own.push(tex, shellMat, clearMat, outer.geometry, clear.geometry);
    if (bump) own.push(bump);
    // fascia scura (vetrate e pilastri) tra la base e l'inizio dei cuscini, con la stessa pianta ovale
    const o = shape.outer;
    if (petals) {
      // petali: piano terra vetrato scuro sotto il guscio (di notte acceso), con i montanti
      const G = facadeTexture('glass'), gm = new THREE.CanvasTexture(G.canvas);
      gm.wrapS = gm.wrapT = THREE.RepeatWrapping; gm.colorSpace = THREE.SRGBColorSpace; gm.anisotropy = 4;
      const glass = new THREE.MeshStandardMaterial({ map: gm, color: 0x9aa4ae, roughness: 0.15, metalness: 0.5, side: THREE.DoubleSide, emissive: 0xffd9a0, emissiveMap: gm, emissiveIntensity: 0 });
      nightGlow.push([glass, 0, 0.6]);
      const ring = S.rowAt(o + 2), len = outlineLength(ring), bandG = sweepAround(THREE, S.rowAt, [{ d: o + 2, h: S.base }, { d: o + 2, h: S.pts[0].h + 0.6 }], 0, 1, null, Math.round(len / G.tileU));
      const base = new THREE.Mesh(bandG, glass);
      base.receiveShadow = true;
      group.add(base);
      own.push(gm, glass, bandG);
      for (let i = 0; i < ring.length - 1; i += 6) beam(beams, ring[i][0], S.base, ring[i][1], ring[i][0], S.pts[0].h + 0.4, ring[i][1], 0.35);
      // sopra l'apertura: due grandi travi reticolari ad arco lungo i lati lunghi, una che la attraversa e i cavi
      const raw = S.rowAt(S.dIn), edge = raw.map(([x, z], i) => pulled(x, z, i / (raw.length - 1), 1));
      const Ain = Math.max(...edge.map(p => Math.abs(p[0])));
      // bordo dell'apertura (a mandorla) sul lato sg alla x data
      const zAt = (x, sg) => {
        let best = 0, bd = Infinity;
        for (const [ex, ez] of edge) if (Math.sign(ez) === sg && Math.abs(ex - x) < bd) { bd = Math.abs(ex - x); best = ez; }
        return best - sg * 0.6;
      };
      const y0 = S.hIn + 0.6, trussMat = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.3 }), tb = [];
      tints.push([trussMat, 'roof']);
      own.push(trussMat);
      // trave reticolare a tre correnti tra i punti P(k) (k da 0 a n): sopra il corrente alto, sotto i due bassi
      const truss = (P, n, side, h) => {
        let prev = null;
        for (let k = 0; k <= n; k++) {
          const [x, y, z] = P(k / n), top = [x, y, z], lo = [x + side[0] * 1.4, y - h, z + side[1] * 1.4], lo2 = [x - side[0] * 1.4, y - h, z - side[1] * 1.4];
          beam(tb, ...top, ...lo, 0.14); beam(tb, ...top, ...lo2, 0.14); beam(tb, ...lo, ...lo2, 0.12);
          if (prev) {
            beam(tb, ...prev[0], ...top, 0.42); beam(tb, ...prev[1], ...lo, 0.34); beam(tb, ...prev[2], ...lo2, 0.34);
            beam(tb, ...prev[0], ...lo, 0.12); beam(tb, ...prev[0], ...lo2, 0.12);
          }
          prev = [top, lo, lo2];
        }
      };
      for (const sg of [-1, 1]) truss((f) => { const x = (f * 2 - 1) * Ain * 0.86; return [x, y0 + 7 * (1 - (x / Ain) ** 2), zAt(x, sg)]; }, 24, [0, 1], 3.2);
      const xc = -Ain * 0.3, z0 = zAt(xc, -1), z1 = zAt(xc, 1), Bc = (z1 - z0) / 2, zm = (z0 + z1) / 2;
      truss((f) => { const z = z0 + (z1 - z0) * f; return [xc, y0 + 7 * (1 - (xc / Ain) ** 2) + 3.5 * (1 - ((z - zm) / Bc) ** 2), z]; }, 12, [1, 0], 2.6);
      // cavi dalla trave che attraversa verso le due curve
      for (let k = 1; k < 12; k++) {
        const z = z0 + (z1 - z0) * k / 12, yc = y0 + 7 * (1 - (xc / Ain) ** 2) + 3.5 * (1 - ((z - zm) / Bc) ** 2);
        for (const xe of [-Ain + 1, Ain - 1]) beam(tb, xc, yc, z, xe, y0, z * 0.6, 0.05);
      }
      inst(trussMat, tb);
    } else if (!tent) {
      const bandG = sweepAround(THREE, S.rowAt, [{ d: o + 1.2, h: S.base }, { d: o + 1.2, h: S.base + 3.4 }], 0, 1);
      const base = new THREE.Mesh(bandG, dark);
      base.receiveShadow = true;
      group.add(base);
      own.push(bandG);
    } else if (st.facade === 'wall') {
      // sotto la tenda una struttura moderna: vetrate a piani tutto intorno, che di notte si accendono del colore scelto
      const G = facadeTexture('glass'), gm = new THREE.CanvasTexture(G.canvas);
      gm.wrapS = gm.wrapT = THREE.RepeatWrapping; gm.colorSpace = THREE.SRGBColorSpace; gm.anisotropy = 4;
      tentGlass = new THREE.MeshStandardMaterial({ map: gm, roughness: 0.2, metalness: 0.4, side: THREE.DoubleSide, emissiveMap: gm, emissiveIntensity: 0 });
      nightGlow.push([tentGlass, 0, 0.9]);
      const gg = outerSkin(THREE, shape, 0.3, G.tileU, G.tileV), skin = new THREE.Mesh(gg, tentGlass);
      skin.receiveShadow = true;
      group.add(skin);
      own.push(gm, tentGlass, gg);
    }
    if (lights === 'roof') {
      // proiettori sotto il bordo dell'apertura
      const raw = S.rowAt(S.dIn + 0.8), edge = st.roof === 'petals' ? raw.map(([x, z], i) => pulled(x, z, i / (raw.length - 1), 1)) : raw;
      for (let i = 0; i < edge.length - 1; i += 8) lampAt(lamps, edge[i][0], S.hIn - 1.4, edge[i][1], 2.4, 1.3);
      for (let k = 0; k < 6; k++) { const [x, z] = edge[Math.floor((k + 0.5) / 6 * (edge.length - 1))]; spots.push([x, S.hIn - 1.5, z]); }
    }
  }
  if (R) {
    const truss = st.roof === 'truss';
    const girders = st.roof === 'girders', ribbed = truss || girders; // girders: struttura nera sotto, come il reticolare
    const RT = roofTexture(truss ? 'corrugated' : girders ? 'barrel' : 'plain');
    const tex = new THREE.CanvasTexture(RT.canvas), rtn = new THREE.CanvasTexture(RT.normal);
    for (const t of [tex, rtn]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
    tex.colorSpace = THREE.SRGBColorSpace;
    own.push(rtn);
    deckMat = new THREE.MeshStandardMaterial({ map: tex, normalMap: rtn, roughness: truss ? 0.45 : girders ? 0.35 : 0.55, metalness: truss ? 0.3 : 0.1, side: THREE.DoubleSide });
    const deck = new THREE.Mesh(deckGeometry(THREE, { ...shape, runs: roofRuns }, R), deckMat);
    deck.castShadow = deck.receiveShadow = true;
    group.add(deck);
    own.push(tex, deckMat, deck.geometry);

    // travi lungo tutto il tetto: bordo davanti e, nel reticolare, i correnti inferiori
    const N = Math.max(2, Math.round((R.dOut - R.dIn) / 3.5));
    const pos = [], idx = [[], [], []];
    const bar = (d, h, w, t) => [{ d: d - w / 2, h: h - t / 2, m: 0 }, { d: d + w / 2, h: h - t / 2, m: 0 }, { d: d + w / 2, h: h + t / 2, m: 0 }, { d: d - w / 2, h: h + t / 2, m: 0 }];
    const PD = pylonDist(R), PH = pylonHeight(R), chordLow = R.h(R.dOut) - 1, chordHigh = PH - 1.2;
    for (const run of roofRuns) {
      extrude(THREE, run, bar(R.dIn, R.h(R.dIn) - 0.7, 0.5, 1.4), pos, idx);
      if (!ribbed) continue;
      for (let k = 1; k <= N; k++) { const d = R.dIn + k * (R.dOut - R.dIn) / N; extrude(THREE, run, bar(d, R.h(d) - R.depth(d), 0.3, 0.3), pos, idx); }
      if (!truss) continue;
      // trave reticolare che corre tutto intorno sui piloni: quattro correnti (dentro/fuori, sopra/sotto)
      for (const dd of [PD - 1.2, PD + 1.2]) for (const hh of [chordLow, chordHigh]) extrude(THREE, run, bar(dd, hh, 0.45, 0.45), pos, idx);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx.flat());
    g.computeVertexNormals();
    const rails = new THREE.Mesh(g, steel);
    rails.castShadow = true;
    group.add(rails);
    own.push(g);

    for (const run of roofRuns) {
      const cum = runLengths(run);
      for (const u of stations(run, cum, ribbed ? TRUSS_EVERY : TRUSS_EVERY * 1.5, R.dOut)) {
        if (!ribbed) {
          // moderna: una costola sotto il tetto
          const [x0, z0] = pointAt(run, cum, u, R.dIn), [x1, z1] = pointAt(run, cum, u, R.dOut);
          beam(beams, x0, R.h(R.dIn) - 0.45, z0, x1, R.h(R.dOut) - 0.45, z1, 0.4);
          continue;
        }
        // reticolare: traliccio dal bordo davanti fino ai pilastri esterni (più alto verso fuori)
        let prev = null;
        for (let k = 0; k <= N; k++) {
          const d = R.dIn + k * (R.dOut - R.dIn) / N;
          const [x, z] = pointAt(run, cum, u, d);
          const yt = R.h(d) - 0.25, yb = R.h(d) - R.depth(d);
          beam(beams, x, yt, z, x, yb, z, 0.16);
          if (prev) {
            beam(beams, prev.x, prev.yt, prev.z, x, yt, z, 0.22);
            beam(beams, prev.x, prev.yb, prev.z, x, yb, z, 0.22);
            beam(beams, prev.x, prev.yt, prev.z, x, yb, z, 0.14);
          }
          prev = { x, z, yt, yb };
        }
      }
      if (truss) {
        const total = cum[cum.length - 1];
        // piloni a traliccio che reggono il tetto da fuori, e croci della trave perimetrale tra un pilone e l'altro
        // niente piloni addosso alle torri delle rampe (se ci sono)
        const towersAt = st.ramps ? rampStations(run, cum) : [];
        const nearTower = (u) => towersAt.some(t => Math.min(Math.abs(u - t), run.closed ? total - Math.abs(u - t) : Infinity) < 8)
          || nearEntrance(shape, st, ...pointAt(run, cum, u, 0), 4);
        for (const u of stations(run, cum, PYLON_EVERY, PD)) {
          if (nearTower(u)) continue;
          pylon(beams, run, cum, u, PD, PH);
          const [x, z] = pointAt(run, cum, u, PD), [tx, tz] = tangentAt(run, cum, u, PD);
          drumAt(drums, x, PH + 0.9, z, tz, -tx, 1.25, 5.2);
        }
        // diagonali della trave reticolare a zig-zag tra posizioni a passo regolare (misurato sulla trave)
        const S = stations(run, cum, 4, PD), last = run.closed ? S.length : S.length - 1;
        for (let i = 0; i < last; i++) {
          const ua = S[i], ub = i + 1 < S.length ? S[i + 1] : S[0] + total, um = wrapU(run, total, (ua + ub) / 2);
          for (const dd of [PD - 1.2, PD + 1.2]) {
            const [x0, z0] = pointAt(run, cum, ua, dd), [x1, z1] = pointAt(run, cum, um, dd), [x2, z2] = pointAt(run, cum, wrapU(run, total, ub), dd);
            beam(beams, x0, chordLow, z0, x1, chordHigh, z1, 0.18);
            beam(beams, x1, chordHigh, z1, x2, chordLow, z2, 0.18);
          }
        }
        // costole in rilievo sopra la lamiera
        for (const u of stations(run, cum, RIB_EVERY, PD)) {
          const [x0, z0] = pointAt(run, cum, u, R.dIn), [x1, z1] = pointAt(run, cum, u, PD);
          beam(beams, x0, R.h(R.dIn) + 0.45, z0, x1, R.h(PD) + 0.45, z1, 0.9);
        }
      } else if (!girders) {
        // moderna: pilastri che reggono il tetto da fuori (con le travi rosse il tetto è appeso a loro)
        for (const u of stations(run, cum, SUPPORT_EVERY, R.dOut - 1.5)) {
          if (nearEntrance(shape, st, ...pointAt(run, cum, u, 0), 2)) continue;
          const d = R.dOut - 1.5, [x, z] = pointAt(run, cum, u, d);
          beam(beams, x, 0, z, x, R.h(d) - 0.1, z, 0.7);
        }
      }
      if (lights === 'roof') {
        if (ribbed) {
          // reticolare e travi rosse: grandi batterie di fari appese al bordo davanti, a distanza regolare
          for (const u of stations(run, cum, 22, R.dIn + 1.4)) {
            const [x, z] = pointAt(run, cum, u, R.dIn + 1.4);
            lampBank(lamps, frames, x, R.h(R.dIn) - 3.4, z, 4, 3);
          }
        } else {
          for (const u of stations(run, cum, LAMP_EVERY, R.dIn + 0.6)) {
            const [x, z] = pointAt(run, cum, u, R.dIn + 0.6);
            lampAt(lamps, x, R.h(R.dIn) - 2.1, z, 2.4, 1.3);
          }
        }
      }
    }
    if (lights === 'roof') {
      // di notte: sei luci lungo il bordo del tetto
      const run = { pts: shape.path, closed: true }, cum = runLengths(run), total = cum[cum.length - 1];
      for (let k = 0; k < 6; k++) { const [x, z] = pointAt(run, cum, (k + 0.5) * total / 6, R.dIn); spots.push([x, R.h(R.dIn) - 2, z]); }
    }
  }

  // torre faro: fusto che si assottiglia, testata rivolta verso il centro con file di fari, telaio scuro e passerella
  const floodTower = (x, z, H) => {
    for (const [y0, y1, r] of [[0, H * 0.45, 1.25], [H * 0.45 - 0.2, H * 0.8, 0.95], [H * 0.8 - 0.2, H, 0.7]]) {
      boxAt(drums, x, (y0 + y1) / 2, z, [r, 0, 0], [0, y1 - y0, 0], [0, 0, r]);
    }
    const l = Math.hypot(x, z) || 1, fx = -x / l, fz = -z / l, rx = -fz, rz = fx, hy = H + 3, W = 11, Hh = 7;
    boxAt(frames, x, hy, z, [rx * W, 0, rz * W], [0, Hh, 0], [-fx * 0.6, 0, -fz * 0.6]);
    boxAt(frames, x + fx * 0.6, hy - Hh / 2 - 0.25, z + fz * 0.6, [rx * W, 0, rz * W], [0, 0.25, 0], [-fx * 1.8, 0, -fz * 1.8]);
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 4; j++) {
        const a = (i - 2.5) * 1.75, b = (j - 1.5) * 1.65;
        lampAt(lamps, x + rx * a + fx * 0.45, hy + b, z + rz * a + fz * 0.45, 1.5, 1.25);
      }
    }
    spots.push([x, hy, z]);
  };
  if (lights === 'towers' && G) {
    for (const [x, z] of G.towers) { lampBank(lamps, frames, x, G.towerTop + 7, z, 6, 4); spots.push([x, G.towerTop + 7, z]); }
  } else if (lights === 'towers') {
    const d = towerDist(shape, st), H = towerHeight(shape, st);
    for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
      // punto del bordo più vicino alla diagonale di questo quarto
      let best = null, err = Infinity;
      for (const p of shape.path) {
        if (p.x * sx <= 0 || p.z * sz <= 0) continue;
        const e = Math.abs(Math.atan2(Math.abs(p.z) / shape.b, Math.abs(p.x) / shape.a) - Math.PI / 4);
        if (e < err) { err = e; best = p; }
      }
      // con le coperture che avvolgono lo stadio la torre sta fuori dall'involucro
      const env = envelopeRow(shape, st), l = Math.hypot(best.mx, best.mz) || 1;
      const dd = env ? Math.max(d, beyondRow(env, best.x, best.z, best.mx / l, best.mz / l) / l + 4) : d;
      floodTower(best.x + best.mx * dd, best.z + best.mz * dd, H);
    }
  }

  if (st.facade === 'struts') {
    // struttura in cemento a vista: grande anello sul bordo in alto, sotto inclinato degli spalti con travi e pilastri,
    // ballatoio chiaro a metà, piattaforma tutto intorno (pavimento e bordo colorati, ringhiera chiara);
    // sotto la piattaforma il basamento bianco con le finestre solo sui lati lunghi, sulle curve i pilastri
    const tiers = shape.tiers;
    const rect = (d0, d1, h0, h1, m) => [[d0, h0], [d1, h0], [d1, h1], [d0, h1]].map(([d, h]) => ({ d, h, m }));
    const Hw = Math.max(8.5, tiers[0].top * 0.6);                       // ballatoio
    const pos = [], idx = [[], [], [], []];
    for (const run of shape.runs) {
      const T = runTop(run), o = runOuter(run);
      const walk = [[tiers[0].back - 1, Hw - 0.5], [o + 0.4, Hw - 0.5], [o + 0.4, Hw + 1.1], [o + 0.15, Hw + 1.1], [o + 0.15, Hw], [tiers[0].back - 1, Hw]].map(([d, h]) => ({ d, h, m: 1 }));
      extrude(THREE, run, rect(o, o + 0.9, T.top + 2.2 - 4.5, T.top + 2.2, 0), pos, idx); // anello in alto
      extrude(THREE, run, walk, pos, idx);
      const Hp = PLATFORM_H, po = o + PLATFORM_OUT;
      extrude(THREE, run, [[o + 0.2, Hp - 0.6, 0], [po, Hp - 0.6, 3], [po, Hp, 3], [o + 0.2, Hp, 3]].map(([d, h, m]) => ({ d, h, m })), pos, idx); // piattaforma
      extrude(THREE, run, rect(po - 0.14, po, Hp, Hp + 1.1, 1), pos, idx);              // ringhiera
      for (const side of subRuns(run, onLongSide)) {
        // basamento fino al bordo della piattaforma (le finestre si vedono sotto il bordo blu)
        extrude(THREE, side, rect(o + 0.5, po - 0.3, 0, Hp - 0.6, 1), pos, idx);
        extrude(THREE, side, rect(po - 0.4, po - 0.15, 0, 0.55, 3), pos, idx);          // fascia a terra
        // finestre del basamento
        const scum = runLengths(side), stotal = scum[scum.length - 1];
        for (const u of stations(side, scum, 4.5, po - 0.25)) {
          if (u < 1.8 || u > stotal - 1.8) continue;
          const [x, z] = pointAt(side, scum, u, po - 0.25), [tx, tz] = tangentAt(side, scum, u, po - 0.25);
          boxAt(windows, x, 2.2, z, [tx * 2.6, 0, tz * 2.6], [0, 2.4, 0], [-tz * 0.16, 0, tx * 0.16]);
          boxAt(windows, x, 4.15, z, [tx * 2.6, 0, tz * 2.6], [0, 0.8, 0], [-tz * 0.16, 0, tx * 0.16]);
        }
      }
      // sulle curve la piattaforma poggia su pilastri (sotto è aperto)
      for (const curve of subRuns(run, (p) => !onLongSide(p))) {
        const ccum = runLengths(curve);
        for (const u of stations(curve, ccum, PILASTER_EVERY, po - 0.6)) {
          for (const dd of [o + 2.4, po - 0.6]) { const [x, z] = pointAt(curve, ccum, u, dd); beam(pilasters, x, 0, z, x, Hp - 0.6, z, 0.75); }
        }
      }
      const cum = runLengths(run);
      for (const t of run.tiers) {
        const d0 = t.i === 0 ? t.D + 6 : t.D, d1 = t.back + WALL;
        const prevBack = t.i === 0 ? t.D + 6 : tiers[t.i - 1].back + WALL;
        for (const u of stations(run, cum, PILASTER_EVERY, o)) {
          // trave inclinata sotto l'anello e pilastri che la reggono (dove sotto non c'è l'anello di sotto)
          const [x0, z0] = pointAt(run, cum, u, d0), [x1, z1] = pointAt(run, cum, u, d1);
          beam(pilasters, x0, t.under(d0) - 0.6, z0, x1, t.under(d1) - 0.6, z1, 0.9);
          for (const dc of [t.back - 0.5, (prevBack + t.back) / 2]) {
            if (dc <= prevBack + 0.5 || t.under(dc) < 3) continue;
            const [xc, zc] = pointAt(run, cum, u, dc);
            beam(pilasters, xc, 0, zc, xc, t.under(dc) - 1, zc, 1.1);
          }
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    let start = 0;
    idx.forEach((list, m) => { g.addGroup(start, list.length, m); start += list.length; });
    g.setIndex(idx.flat());
    g.computeVertexNormals();
    const facade = new THREE.Mesh(g, [structMat, parapetMat, structMat, accent]); // 2 = tappi dei tratti aperti
    facade.castShadow = facade.receiveShadow = true;
    group.add(facade);
    own.push(g);
  }

  if (st.roof === 'stands') {
    // stile inglese (Stamford Bridge): ogni tribuna ha il suo tetto alla sua altezza, anche sugli angoli. Sopra lamiera
    // scura con la struttura a vista (travi reticolari a sbalzo, più alte dietro, e correnti lungo la tribuna), davanti
    // la fascia chiara con la riga colorata e le luci, sotto pannelli chiari; agli angoli i piloni con i tiranti
    const pos = [], idx = [[], [], []], under = [], underUv = [], underIdx = [], covered = [], top = { pos: [], uv: [], idx: [] };
    const rect = (d0, d1, h0, h1, m) => [[d0, h0], [d1, h0], [d1, h1], [d0, h1]].map(([d, h]) => ({ d, h, m }));
    // tratti dritti dei lati (fuori dagli angoli): lì stanno le travi sopra il tetto
    const gapA = shape.a - Math.max(shape.r, 4), gapB = shape.b - Math.max(shape.r, 4);
    const straight = (p) => (Math.abs(p.mz) > 0.995 && Math.abs(p.x) < gapA) || (Math.abs(p.mx) > 0.995 && Math.abs(p.z) < gapB);
    // logo dipinto sul tetto: lì niente travi sopra (si vede intero dall'alto)
    const logos = logoSpots(shape, st).filter(l => l.place === 'roof');
    const onLogo = (x, z) => logos.some(l => Math.sign(z) === l.side && Math.abs(z) > shape.b - 1 && Math.abs(x) < l.s / 2 + 1.5);
    for (const run of roofRuns) {
      const Rs = roofOf({ ...shape, tiers: run.tiers }, 'stands', reachOf_(st)), hI = Rs.h(Rs.dIn);
      const d0 = Rs.dIn + 0.6, span = Rs.dOut - 0.5 - d0, yb = (d) => Rs.h(d) + 0.1;
      const yt = (d) => yb(d) + 1 + 4.5 * (d - d0) / span; // sopra le travi: 1 m sulla punta, 5,5 m sull'appoggio dietro
      // lastra (bordi chiari), sopra la lamiera con la texture, e fascia davanti
      extrude(THREE, run, [[Rs.dIn, hI - 0.25, 1], [Rs.dOut, Rs.h(Rs.dOut) - 0.25, 1], [Rs.dOut, Rs.h(Rs.dOut), 1], [Rs.dIn, hI, 1]]
        .map(([d, h, m]) => ({ d, h, m })), pos, idx);
      stripUV(run, [{ d: Rs.dIn, h: hI + 0.02 }, { d: Rs.dOut, h: Rs.h(Rs.dOut) + 0.02 }], top, ROOF_TILE, ROOF_TILE);
      extrude(THREE, run, rect(Rs.dIn - 0.05, Rs.dIn + 0.35, hI - STANDS_FASCIA, hI + 0.15, 1), pos, idx);
      extrude(THREE, run, rect(Rs.dIn - 0.1, Rs.dIn + 0.35, hI - STANDS_FASCIA - 0.5, hI - STANDS_FASCIA, 0), glowPos, glowIdx);
      extrude(THREE, run, rect(Rs.dOut, Rs.dOut + 0.08, Rs.h(Rs.dOut) - 1.05, Rs.h(Rs.dOut) - 0.3, 0), glowPos, glowIdx);
      // correnti lungo il tetto: in cima alle travi sulla punta, a metà e sull'appoggio, più quelli in basso
      for (const f of [0, 0.5, 1]) {
        const d = d0 + span * f;
        for (const part of f === 0.5 ? subRuns(run, p => !onLogo(p.x, p.z) || !onLongSide(p)) : [run]) extrude(THREE, part, rect(d - 0.18, d + 0.18, yt(d) - 0.36, yt(d), 1), pos, idx);
        if (f > 0) extrude(THREE, run, rect(d - 0.15, d + 0.15, yb(d), yb(d) + 0.3, 1), pos, idx);
      }
      const cum = runLengths(run), total = cum[cum.length - 1];
      // pannelli chiari sotto il tetto (con coordinate per la griglia)
      const P = run.pts, n = P.length, b0 = under.length / 3, dU = Rs.dIn + 0.35;
      for (let k = 0; k < n; k++) {
        for (const d of [dU, Rs.dOut]) { under.push(P[k].x + P[k].mx * d, Rs.h(d) - 0.3, P[k].z + P[k].mz * d); underUv.push(cum[k] / 6, (d - dU) / 6); }
        if (k) { const a = b0 + (k - 1) * 2, c = a + 2; underIdx.push(a, c, a + 1, a + 1, c, c + 1); }
      }
      if (run.closed) { const a = b0 + (n - 1) * 2; underIdx.push(a, b0, a + 1, a + 1, b0, b0 + 1); }
      // travi a sbalzo sopra il tetto, dal muro alla punta: sui lati ogni 9 m, sugli angoli una sola lungo la diagonale
      const across = (side, sc, u) => {
        const [xa, za] = pointAt(side, sc, u, d0), [xb, zb] = pointAt(side, sc, u, d0 + span);
        truss(girderBeams, xa, za, xb, zb, (f) => yb(d0 + span * f), (f) => yt(d0 + span * f), Math.max(2, Math.round(span / 3.4)), 0.36, 0.22);
      };
      for (const side of subRuns(run, straight)) {
        const sc = runLengths(side), len = sc[sc.length - 1];
        for (const u of stations(side, sc, 9)) { const [x, z] = pointAt(side, sc, u, 0); if (!onLogo(x, z)) across(side, sc, u); }
        covered.push({ side: sideOfPoint(side.pts[Math.floor(side.pts.length / 2)]), Rs, d0, span, yt });
        if (lights === 'roof') for (const f of [0.25, 0.75]) { const [x, z] = pointAt(side, sc, len * f, Rs.dIn); spots.push([x, hI - 3, z]); }
      }
      for (const corner of subRuns(run, (p) => !straight(p))) {
        const p = corner.pts.reduce((m, q) => (Math.abs(q.mx * q.mz) > Math.abs(m.mx * m.mz) ? q : m));
        if (Math.abs(p.mx * p.mz) > 0.1) across({ pts: [p, p], closed: false }, [0, 0], 0);
      }
      if (lights === 'roof') {
        for (const u of stations(run, cum, 4)) { const [x, z] = pointAt(run, cum, Math.min(u, total - 0.01), Rs.dIn + 0.9); lampAt(lamps, x, hI - STANDS_FASCIA - 0.9, z, 1.4, 0.8); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    let start = 0;
    idx.forEach((list, m) => { g.addGroup(start, list.length, m); start += list.length; });
    g.setIndex(idx.flat());
    g.computeVertexNormals();
    const roof = new THREE.Mesh(g, [girderMat, girderMat, girderMat]);
    roof.castShadow = true;
    roof.receiveShadow = true;
    // lamiera aggraffata con i lucernari (la tela si ridipinge col colore del tetto) e il rilievo delle costole
    const metalC = document.createElement('canvas'); metalC.width = metalC.height = 512;
    const metal = canvasTex(THREE, metalC), ribs = canvasTex(THREE, roofBumpCanvas(), false);
    const topMat = new THREE.MeshStandardMaterial({ map: metal, bumpMap: ribs, bumpScale: 2, roughness: 0.45, metalness: 0.35, side: THREE.DoubleSide });
    const tg = uvGeometry(THREE, top), roofTop = new THREE.Mesh(tg, topMat);
    roofTop.receiveShadow = true;
    group.add(roof, roofTop);
    own.push(metal, ribs, topMat, tg);
    let metalKey = '';
    repaint.push((s) => {
      if (s.colors.roof === metalKey) return;
      metalKey = s.colors.roof;
      paintRoofMetal(metalC, metalKey);
      metal.needsUpdate = true;
    });
    // pannelli chiari sotto, con la griglia delle travi
    const gridC = document.createElement('canvas'); gridC.width = gridC.height = 128;
    const gx = gridC.getContext('2d');
    gx.fillStyle = '#e3e6ea'; gx.fillRect(0, 0, 128, 128);
    gx.fillStyle = 'rgba(0,0,0,.06)'; for (let i = 0; i < 128; i += 16) gx.fillRect(i, 0, 2, 128);
    gx.fillStyle = '#8a95a3'; gx.fillRect(0, 0, 128, 6); gx.fillRect(0, 0, 6, 128);
    const gridTex = new THREE.CanvasTexture(gridC);
    gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping; gridTex.colorSpace = THREE.SRGBColorSpace; gridTex.anisotropy = 4;
    const underMat = new THREE.MeshStandardMaterial({ map: gridTex, emissive: 0xffffff, emissiveMap: gridTex, emissiveIntensity: 0.12, roughness: 0.6, side: THREE.DoubleSide });
    const ug = new THREE.BufferGeometry();
    ug.setAttribute('position', new THREE.Float32BufferAttribute(under, 3));
    ug.setAttribute('uv', new THREE.Float32BufferAttribute(underUv, 2));
    ug.setIndex(underIdx);
    ug.computeVertexNormals();
    group.add(new THREE.Mesh(ug, underMat));
    own.push(g, ug, underMat, gridTex);
    // piloni tubolari agli angoli, fuori dagli spalti, con i tiranti verso le travi dei due tetti vicini e il puntone dietro
    const M = mastsOf(shape, st);
    for (const m of M) {
      const near = covered.filter(c => c.side === m.long || c.side === m.end);
      if (!near.length) continue;
      boxAt(drums, m.x, m.top / 2, m.z, [STANDS_MAST_R, 0, 0], [0, m.top, 0], [0, 0, STANDS_MAST_R]);
      beam(beams, m.x, m.top - 1, m.z, m.x + m.sx * 7, 0, m.z + m.sz * 7, 0.3);
      for (const c of near) {
        const d = c.d0 + c.span * 0.15;
        for (const f of [0.35, 0.7]) {
          const [x, z] = c.side === m.long ? [m.sx * (shape.a - shape.r) * (1 - f), m.sz * (shape.b + d)] : [m.sx * (shape.a + d), m.sz * (shape.b - shape.r) * (1 - f)];
          beam(beams, m.x, m.top - 0.5, m.z, x, c.yt(d), z, 0.14);
        }
      }
    }
  }

  if (st.facade === 'cladding') {
    // stile inglese (Stamford Bridge): sopra la parete chiara a pannelli con i nastri di vetrate tra un anello e l'altro e il
    // cornicione colorato con la riga luminosa; sotto il basamento sporgente con la terrazza, le vetrine al piano terra, i
    // manifesti tra le pinne colorate e i tornelli; torri cilindriche agli angoli e l'ingresso principale al centro della
    // tribuna vicina
    const rect = (d0, d1, h0, h1, m) => [[d0, h0], [d1, h0], [d1, h1], [d0, h1]].map(([d, h]) => ({ d, h, m }));
    const pos = [], idx = [[], [], []], winPos = [], winIdx = [[], [], []], poster = { pos: [], uv: [], idx: [] };
    const panelFace = { pos: [], uv: [], idx: [] }, stoneFace = { pos: [], uv: [], idx: [] }, glassFace = { pos: [], uv: [], idx: [] };
    const accentBoxes = [], whiteBoxes = [], winBoxes = [], paveBoxes = [], flatLamps = [], drumBody = [], drumWin = [], drumTop = [], cladEnds = [];
    // ingresso principale: centro del lato lungo verso z+ (davanti al basamento)
    const E = entranceOf(shape), mid = E && E.run, z0 = E ? E.z0 : 0;
    const inEntrance = (x, z) => mid && z > 0 && Math.abs(x) < CLAD_ENTRANCE / 2 + 2.5 && Math.abs(z - z0) < 3;
    for (const run of shape.runs) {
      const o = runOuter(run), H = wallTopOf(run), PH = cladPodium(H), CH = cladCornice(H), W = o + CLAD_PODIUM_W;
      extrude(THREE, run, rect(o - 0.1, o + 0.3, 0, H, 0), pos, idx);                          // parete chiara
      extrude(THREE, run, rect(o + 0.3, o + 0.6, H - CH, H, 1), pos, idx);                     // cornicione
      extrude(THREE, run, rect(o + 0.6, o + 0.68, H - CH - 1, H - CH - 0.1, 0), glowPos, glowIdx);
      for (const [h0, h1] of cladBands(run.tiers)) {
        if (h0 <= PH + 1) continue;
        extrude(THREE, run, rect(o + 0.3, o + 0.4, h0, h1, 0), winPos, winIdx);
        stripUV(run, [{ d: o + 0.41, h: h0 }, { d: o + 0.41, h: h1 }], glassFace, GLASS_TILE, h1 - h0);
      }
      extrude(THREE, run, rect(o + 0.3, W, 0, PH, 2), pos, idx);                               // basamento
      extrude(THREE, run, rect(W - 0.3, W + 0.05, PH, PH + 1.1, 0), pos, idx);                 // parapetto della terrazza
      extrude(THREE, run, rect(W, W + 0.15, 3.6, 4.2, 1), pos, idx);                           // fascia tra i due piani
      extrude(THREE, run, rect(W, W + 0.06, 0.5, 3.6, 0), winPos, winIdx);                     // vetrine al piano terra
      // facce con le texture: pannelli della parete, pietra del basamento (fronte, zoccolo e terrazza), vetrine
      stripUV(run, [{ d: o + 0.32, h: PH }, { d: o + 0.32, h: H - CH }], panelFace, CLAD_TILE[0], CLAD_TILE[1]);
      stripUV(run, [{ d: W + 0.01, h: 4.2 }, { d: W + 0.01, h: PH }], stoneFace, STONE_TILE, STONE_TILE);
      stripUV(run, [{ d: W + 0.01, h: 0 }, { d: W + 0.01, h: 0.5 }], stoneFace, STONE_TILE, STONE_TILE);
      stripUV(run, [{ d: o + 0.3, h: PH + 0.01 }, { d: W - 0.3, h: PH + 0.01 }], stoneFace, STONE_TILE, STONE_TILE);
      stripUV(run, [{ d: W + 0.07, h: 0.5 }, { d: W + 0.07, h: 3.6 }], glassFace, GLASS_TILE, 3.1);
      // moduli del basamento: pinna colorata ogni CLAD_MODULE metri, manifesto al centro e tornelli un modulo sì e uno no
      // (solo dove il basamento è dritto: non sugli spigoli degli angoli)
      const front = offsetRun(run, W), cum = runLengths(front), total = cum[cum.length - 1];
      const flat = (u, half) => {
        if (!run.closed && (u < half || u > total - half)) return false;
        const [ax, az] = tangentAt(front, cum, u - half, 0), [bx, bz] = tangentAt(front, cum, u + half, 0);
        return ax * bx + az * bz > 0.985;
      };
      const n = Math.max(1, Math.round(total / CLAD_MODULE)), step = total / n;
      for (let k = 0; k <= (run.closed ? n - 1 : n); k++) {
        const u = k * step, [x, z] = pointAt(front, cum, u, 0), [tx, tz] = tangentAt(front, cum, u, 0), nx = tz, nz = -tx;
        if (!flat(u, 1) || inEntrance(x, z)) continue;
        boxAt(accentBoxes, x + nx * 0.45, (PH + 0.6) / 2, z + nz * 0.45, [tx * 0.7, 0, tz * 0.7], [0, PH + 0.6, 0], [-tz * 0.9, 0, tx * 0.9]);
        // ogni due pinne una lesena colorata sale sulla parete chiara fino al cornicione
        const back = CLAD_PODIUM_W - 0.55, h0 = PH + 1.1, h1 = H - CH;
        if (k % 2 === 0 && h1 - h0 > 3) boxAt(accentBoxes, x - nx * back, (h0 + h1) / 2, z - nz * back, [tx * 0.9, 0, tz * 0.9], [0, h1 - h0, 0], [-tz * 0.5, 0, tx * 0.5]);
      }
      for (let k = 0; k < n; k++) {
        const u = (k + 0.5) * step, [x, z] = pointAt(front, cum, u, 0), [tx, tz] = tangentAt(front, cum, u, 0);
        if (!flat(u, 3.5) || inEntrance(x, z)) continue;
        const nx = tz, nz = -tx; // verso fuori (da fuori la destra è verso -t)
        if (PH > 6.5) {
          const w = Math.min(step - 2.6, 7.5) / 2, h0 = 4.6, h1 = PH - 0.5, v = k % 3, b = poster.pos.length / 3, d = 0.05;
          for (const [s, h] of [[-w, h0], [w, h0], [w, h1], [-w, h1]]) poster.pos.push(x + tx * s + nx * d, h, z + tz * s + nz * d);
          poster.uv.push((v + 1) / 3, 0, v / 3, 0, v / 3, 1, (v + 1) / 3, 1);
          poster.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
        }
        if (k % 2) {
          boxAt(accentBoxes, x + nx * 0.2, 1.55, z + nz * 0.2, [tx * 4.4, 0, tz * 4.4], [0, 3.1, 0], [-nx * 0.4, 0, -nz * 0.4]);
          boxAt(flatLamps, x + nx * 0.25, 3.35, z + nz * 0.25, [tx * 3.2, 0, tz * 3.2], [0, 0.4, 0], [-nx * 0.3, 0, -nz * 0.3]);
        }
      }
    }
    // dove una tribuna più alta finisce su un settore più basso il gradino non resta a spigolo vivo: un mezzo cilindro
    // chiude la parete (con il cornicione) e uno il basamento
    for (const run of shape.runs) {
      if (run.closed) continue;
      const o = runOuter(run), H = wallTopOf(run), PH = cladPodium(H), CH = cladCornice(H);
      for (const p of [run.pts[0], run.pts[run.pts.length - 1]]) {
        const low = shape.runs.filter(r => r !== run && r.pts.includes(p) && runOuter(r) < o - 0.5);
        if (!low.length) continue;
        const o2 = Math.max(...low.map(runOuter)), cyl = (list, d0, d1, h0, h1) => {
          const d = (d0 + d1) / 2, R = (d1 - d0) / 2;
          boxAt(list, p.x + p.mx * d, (h0 + h1) / 2, p.z + p.mz * d, [R, 0, 0], [0, h1 - h0, 0], [0, 0, R]);
        };
        cyl(cladEnds, o2 - 0.1, o + 0.3, PH, H - CH);
        cyl(drumTop, o2 + 0.2, o + 0.6, H - CH, H);
        cyl(drumBody, o2 + CLAD_PODIUM_W - 0.1, o + CLAD_PODIUM_W + 0.05, 0, PH);
      }
    }
    // torri cilindriche agli angoli (scale e ingressi): sabbia, due nastri di vetrate e l'anello colorato in cima
    for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
      const p = diagonalPoint(shape, sx, sz), runs = shape.runs.filter(r => r.pts.includes(p));
      if (!runs.length) continue;
      const run = runs.reduce((m, r) => (runOuter(r) > runOuter(m) ? r : m)), o = runOuter(run), PH = cladPodium(wallTopOf(run));
      const x = p.x + p.mx * (o + 2.4), z = p.z + p.mz * (o + 2.4), R = CLAD_DRUM_R, Hd = PH + 6;
      boxAt(drumBody, x, Hd / 2, z, [R, 0, 0], [0, Hd, 0], [0, 0, R]);
      for (const [y, h] of [[PH - 2, 2.6], [PH + 3, 2]]) boxAt(drumWin, x, y, z, [R + 0.06, 0, 0], [0, h, 0], [0, 0, R + 0.06]);
      boxAt(drumTop, x, Hd + 0.4, z, [R + 0.25, 0, 0], [0, 0.8, 0], [0, 0, R + 0.25]);
    }
    if (mid) {
      // ingresso principale: atrio vetrato dentro un portale colorato con lo stemma, pensilina, gradini e due pennoni
      const hw = CLAD_ENTRANCE / 2, top = E.top, box = (list, x0, x1, y0, y1, za, zb) => boxAt(list, (x0 + x1) / 2, (y0 + y1) / 2, (za + zb) / 2, [Math.abs(x1 - x0), 0, 0], [0, y1 - y0, 0], [0, 0, zb - za]);
      box(winBoxes, -hw + 1, hw - 1, 0, top, z0 - 0.5, z0 + 2.5);
      for (let x = -hw + 1; x <= hw - 1 + 1e-6; x += (CLAD_ENTRANCE - 2) / 8) box(whiteBoxes, x - 0.15, x + 0.15, 0, top, z0 + 2.45, z0 + 2.75);
      for (const y of [4.2, E.PH]) box(whiteBoxes, -hw + 1, hw - 1, y - 0.15, y + 0.15, z0 + 2.45, z0 + 2.75);
      for (const s of [-1, 1]) box(accentBoxes, s * hw - 1.2, s * hw + 1.2, 0, top + 2.5, z0 - 0.5, z0 + 4);
      box(accentBoxes, -hw - 1.2, hw + 1.2, top, top + 2.5, z0 - 0.5, z0 + 4);
      box(whiteBoxes, -hw - 2, hw + 2, 5.2, 5.6, z0 + 2.5, z0 + 8.5);                           // pensilina
      for (let x = -hw + 2; x <= hw - 2; x += 4) for (const zz of [z0 + 4.5, z0 + 7]) box(flatLamps, x - 0.4, x + 0.4, 5.12, 5.2, zz - 0.4, zz + 0.4);
      box(paveBoxes, -hw - 4, hw + 4, 0, 0.2, z0, z0 + 12);                                     // gradini
      box(paveBoxes, -hw - 2, hw + 2, 0.2, 0.4, z0, z0 + 10);
      for (const s of [-1, 1]) {
        const fx = s * (hw + 5), fz = z0 + 10;
        beam(whiteBoxes, fx, 0, fz, fx, 13, fz, 0.25);
        box(accentBoxes, fx - s * 0.1, fx - s * 2.8, 10.6, 12.6, fz - 0.03, fz + 0.03);
      }
      // stemma sul portale: tela rotonda (iniziali del nome dello stadio) davanti a un disco colorato
      const bc = document.createElement('canvas'); bc.width = bc.height = 256;
      const btex = new THREE.CanvasTexture(bc); btex.colorSpace = THREE.SRGBColorSpace; btex.anisotropy = 4;
      const bmat = new THREE.MeshStandardMaterial({ map: btex, emissive: 0xffffff, emissiveMap: btex, alphaTest: 0.5, roughness: 0.5, side: THREE.DoubleSide });
      const r = 2.3, bg = new THREE.BufferGeometry(), y = top + 1.25, zb = z0 + 4.38;
      bg.setAttribute('position', new THREE.Float32BufferAttribute([-r, y - r, zb, r, y - r, zb, r, y + r, zb, -r, y + r, zb], 3));
      bg.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
      bg.setIndex([0, 1, 2, 0, 2, 3]);
      bg.computeVertexNormals();
      badge = new THREE.Mesh(bg, bmat);
      group.add(badge);
      boxAt(drumTop, 0, y, z0 + 4.15, [r + 0.3, 0, 0], [0, 0, 0.4], [0, -(r + 0.3), 0]);
      own.push(btex, bmat, bg);
      nightGlow.push([bmat, 0.15, 0.9]);
      let key = '';
      repaint.push((s) => {
        const k = s.name + '|' + s.colors.accent;
        if (k === key) return;
        key = k;
        paintBadge(bc, s.colors.accent, s.name);
        btex.needsUpdate = true;
      });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    let start = 0;
    idx.forEach((list, m) => { g.addGroup(start, list.length, m); start += list.length; });
    g.setIndex(idx.flat());
    g.computeVertexNormals();
    const wall = new THREE.Mesh(g, [cladMat, accent, podiumMat]);
    wall.castShadow = wall.receiveShadow = true;
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(winPos, 3));
    wg.setIndex(winIdx.flat());
    wg.computeVertexNormals();
    group.add(wall, new THREE.Mesh(wg, winMat));
    own.push(g, wg);
    if (poster.pos.length) {
      // manifesti: tre disegni sulla stessa tela, ridipinta quando cambiano i colori
      const pc = document.createElement('canvas'); pc.width = 1536; pc.height = 384;
      const ptex = new THREE.CanvasTexture(pc); ptex.colorSpace = THREE.SRGBColorSpace; ptex.anisotropy = 4;
      const pmat = new THREE.MeshStandardMaterial({ map: ptex, emissive: 0xffffff, emissiveMap: ptex, roughness: 0.6, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
      const pg = new THREE.BufferGeometry();
      pg.setAttribute('position', new THREE.Float32BufferAttribute(poster.pos, 3));
      pg.setAttribute('uv', new THREE.Float32BufferAttribute(poster.uv, 2));
      pg.setIndex(poster.idx);
      pg.computeVertexNormals();
      group.add(new THREE.Mesh(pg, pmat));
      own.push(ptex, pmat, pg);
      nightGlow.push([pmat, 0.08, 0.6]);
      let key = '';
      repaint.push((s) => {
        const k = s.colors.accent + '|' + s.colors.podium;
        if (k === key) return;
        key = k;
        paintPosters(pc, s.colors.accent, s.colors.podium);
        ptex.needsUpdate = true;
      });
    }
    const paveMat = new THREE.MeshStandardMaterial({ color: 0xd3d5d8, roughness: 0.95 });
    own.push(paveMat);
    inst(accent, accentBoxes);
    inst(cladMat, whiteBoxes);
    inst(winMat, winBoxes);
    inst(paveMat, paveBoxes);
    inst(lamp, flatLamps);
    // texture: pannelli, pietra e vetrate (le facce strisce hanno le coordinate in metri, i cilindri le ripetono)
    const [pc, pb] = claddingCanvases(), [sc, sb] = stoneCanvases(), [gc, ge] = glassCanvases();
    // una texture per tela (caricata una volta), copie con la loro ripetizione per i cilindri
    const base = new Map(), tex = (c, color, rep) => {
      if (!base.has(c)) { const t = canvasTex(THREE, c, color); base.set(c, t); own.push(t); }
      const t = base.get(c).clone();
      t.repeat.set(...rep);
      own.push(t);
      return t;
    };
    const panelMat = (rep) => new THREE.MeshStandardMaterial({ map: tex(pc, true, rep), bumpMap: tex(pb, false, rep), bumpScale: 0.7, roughness: 0.45, metalness: 0.1, side: THREE.DoubleSide });
    const stoneMat = (rep) => new THREE.MeshStandardMaterial({ map: tex(sc, true, rep), bumpMap: tex(sb, false, rep), bumpScale: 0.8, roughness: 0.85, side: THREE.DoubleSide });
    const glassMat = (rep) => new THREE.MeshStandardMaterial({ map: tex(gc, true, rep), emissive: 0xffffff, emissiveMap: tex(ge, true, rep), roughness: 0.12, metalness: 0.5, side: THREE.DoubleSide });
    const faces = [[panelFace, panelMat([1, 1]), 'cladding'], [stoneFace, stoneMat([1, 1]), 'podium'], [glassFace, glassMat([1, 1]), null]];
    for (const [acc, mat, key] of faces) {
      const fg = uvGeometry(THREE, acc);
      own.push(mat);
      if (key) tints.push([mat, key]); else nightGlow.push([mat, 0.02, 1]);
      if (!fg) continue;
      const m = new THREE.Mesh(fg, mat);
      m.receiveShadow = true;
      group.add(m);
      own.push(fg);
    }
    const drumStone = stoneMat([2 * Math.PI * CLAD_DRUM_R / STONE_TILE, 2.6]), drumGlass = glassMat([5, 1]), endPanels = panelMat([1, 3]);
    own.push(drumStone, drumGlass, endPanels);
    tints.push([drumStone, 'podium'], [endPanels, 'cladding']);
    nightGlow.push([drumGlass, 0.02, 1]);
    inst(drumStone, drumBody, cylinder);
    inst(drumGlass, drumWin, cylinder);
    inst(accent, drumTop, cylinder);
    inst(endPanels, cladEnds, cylinder);
  }

  if (st.facade === 'panels') {
    // rivestimento a pannelli del colore delle fasce, con le giunture verticali e la fascia luminosa in cima
    const pos = [], idx = [[], [], []];
    for (const ring of shape.runs) {
    const o = runOuter(ring), H = wallTopOf(ring);
    extrude(THREE, ring, [[o - 0.1, 0], [o + 0.3, 0], [o + 0.3, H], [o - 0.1, H]].map(([d, h]) => ({ d, h, m: 0 })), pos, idx);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx[0]);
    g.computeVertexNormals();
    const wall = new THREE.Mesh(g, accent);
    wall.receiveShadow = true;
    group.add(wall);
    own.push(g);
    // pannelli compositi con i giunti e il riflesso, tinti col colore del rivestimento
    const T = facadeTexture('panels'), map = new THREE.CanvasTexture(T.canvas), nmap = new THREE.CanvasTexture(T.normal);
    for (const t of [map, nmap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
    map.colorSpace = THREE.SRGBColorSpace;
    panelSkinMat = new THREE.MeshStandardMaterial({ map, normalMap: nmap, roughness: 0.35, metalness: 0.35, side: THREE.DoubleSide });
    const pg = outerSkin(THREE, shape, 0.32, T.tileU, T.tileV), skin = new THREE.Mesh(pg, panelSkinMat);
    skin.receiveShadow = true;
    group.add(skin);
    own.push(map, nmap, panelSkinMat, pg);
    for (const ring of shape.runs) {
    const cum = runLengths(ring), o = runOuter(ring), H = wallTopOf(ring);
    for (const u of stations(ring, cum, 4.5, o + 0.33)) {
      const [x, z] = pointAt(ring, cum, u, o + 0.33), [tx, tz] = tangentAt(ring, cum, u, o + 0.33);
      boxAt(windows, x, H / 2, z, [tx * 0.18, 0, tz * 0.18], [0, H, 0], [-tz * 0.08, 0, tx * 0.08]);
    }
    extrude(THREE, ring, [[o + 0.3, H - 1.6], [o + 0.5, H - 1.6], [o + 0.5, H - 0.9], [o + 0.3, H - 0.9]].map(([d, h]) => ({ d, h, m: 0 })), bandPos, bandIdx);
    }
  }


  if (st.facade === 'glass') {
    // vetrate scure tutto intorno, divise da montanti chiari
    const pos = [], idx = [[], [], []];
    for (const ring of shape.runs) {
    const o = runOuter(ring), H = wallTopOf(ring);
    extrude(THREE, ring, [[o - 0.1, 0], [o + 0.25, 0], [o + 0.25, H], [o - 0.1, H]].map(([d, h]) => ({ d, h, m: 0 })), pos, idx);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx[0]);
    g.computeVertexNormals();
    const wall = new THREE.Mesh(g, glassWall);
    wall.receiveShadow = true;
    group.add(wall);
    own.push(g);
    // vetro con il riflesso del cielo (più chiaro in alto in ogni piano) e il parapetto pieno in basso
    const T = facadeTexture('glass'), map = new THREE.CanvasTexture(T.canvas);
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 8; map.colorSpace = THREE.SRGBColorSpace;
    const gm = new THREE.MeshStandardMaterial({ map, roughness: 0.15, metalness: 0.45, side: THREE.DoubleSide, emissive: 0xffd9a0, emissiveMap: map, emissiveIntensity: 0 });
    nightGlow.push([gm, 0, 0.35]); // di notte le vetrate si accendono un po'
    const gg = outerSkin(THREE, shape, 0.27, T.tileU, T.tileV), skin = new THREE.Mesh(gg, gm);
    group.add(skin);
    own.push(map, gm, gg);
    for (const ring of shape.runs) {
    const cum = runLengths(ring), o = runOuter(ring), H = wallTopOf(ring);
    for (const u of stations(ring, cum, 3.2, o + 0.3)) {
      const [x, z] = pointAt(ring, cum, u, o + 0.3), [tx, tz] = tangentAt(ring, cum, u, o + 0.3);
      boxAt(pilasters, x, H / 2, z, [tx * 0.25, 0, tz * 0.25], [0, H, 0], [-tz * 0.2, 0, tx * 0.2]);
    }
    for (let h = 4; h < H - 1; h += 4) extrude(THREE, ring, [[o + 0.25, h - 0.15], [o + 0.45, h - 0.15], [o + 0.45, h + 0.15], [o + 0.25, h + 0.15]].map(([d, hh]) => ({ d, h: hh, m: 0 })), bandPos, bandIdx);
    }
  }


  if (st.facade === 'esplanade') {
    // spianata rialzata tutto intorno (anche con le curve staccate): piano grigio, bordo chiaro,
    // pilastri sotto il bordo e il fondo scuro dei parcheggi sotto
    // dal muro del settore più basso (sotto i settori più alti resta nascosta dentro gli spalti)
    const o0 = Math.min(...shape.runs.map(runOuter)), o = shape.outer, H = ESPLANADE_H, W = esplanadeW(st), ring = { pts: shape.path, closed: true };
    const rect = (d0, d1, h0, h1, m) => [[d0, h0], [d1, h0], [d1, h1], [d0, h1]].map(([d, h]) => ({ d, h, m }));
    const pos = [], idx = [[], [], []];
    extrude(THREE, ring, rect(o0 - 0.1, o + W, H - 0.8, H, 0), pos, idx);          // piano
    extrude(THREE, ring, rect(o + W - 0.35, o + W, H, H + 1.05, 1), pos, idx);     // parapetto sul bordo
    extrude(THREE, ring, rect(o + W - 6, o + W - 5.7, 0, H - 0.8, 2), pos, idx);   // fondo scuro sotto
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    let start = 0;
    idx.forEach((list, m) => { g.addGroup(start, list.length, m); start += list.length; });
    g.setIndex(idx.flat());
    g.computeVertexNormals();
    const plaza = new THREE.Mesh(g, [structMat, parapetMat, dark]);
    plaza.castShadow = plaza.receiveShadow = true;
    group.add(plaza);
    own.push(g);
    const cum = runLengths(ring);
    for (const u of stations(ring, cum, 9, o + W - 1.2)) {
      for (const d of [o + W - 1.2, o + W - 4.5]) { const [x, z] = pointAt(ring, cum, u, d); beam(pilasters, x, 0, z, x, H - 0.8, z, 0.8); }
    }
  }

  if (st.facade === 'bands') {
    // fasce orizzontali chiare e sporgenti (come le rampe di San Siro) sul muro esterno più scuro
    const rect = (d0, d1, h0, h1, m) => [[d0, h0], [d1, h0], [d1, h1], [d0, h1]].map(([d, h]) => ({ d, h, m }));
    const pos = [], idx = [[], [], []];
    for (const run of shape.runs) {
      const o = runOuter(run), Ht = wallTopOf(run);
      extrude(THREE, run, rect(o - 0.05, o + 0.3, 0, Ht, 1), pos, idx);
      // cornicione in cima e zoccolo a terra: alti quanto una fascia, così le rampe tagliate finiscono dentro
      extrude(THREE, run, rect(o + 0.3, o + 1.9, Ht - RAMP_BAND - 0.15, Ht, 0), pos, idx);
      extrude(THREE, run, rect(o + 0.3, o + 1.9, 0, RAMP_BAND + 0.15, 0), pos, idx);
      // rampe che salgono inclinate tra una torre e l'altra e cambiano verso a ogni torre (zig-zag)
      const cum = runLengths(run), total = cum[cum.length - 1];
      const B = rampStations(run, cum);
      if (!run.closed) { if (B[0] > 1e-6) B.unshift(0); if (B[B.length - 1] < total - 1e-6) B.push(total); }
      if (B.length < 2) B.push(B[0] + total);
      else if (run.closed) B.push(B[0] + total);           // l'ultimo tratto riparte dalla prima torre
      const t = RAMP_BAND, d0 = o + 0.25, d1 = o + 1.7, ylo = 0.1 + t / 2, yhi = Ht - 0.1 - t / 2;
      const w = (u) => (u > total ? u - total : u);
      for (let j = 0; j < B.length - 1; j++) {
        const u0 = B[j], L = B[j + 1] - u0;
        for (let k = -1; k * RAMP_PITCH < Ht; k++) {
          const ya = 2.6 + (k + (j % 2)) * RAMP_PITCH, yb = 2.6 + (k + 1 - (j % 2)) * RAMP_PITCH; // quote alle due torri
          const sl = (ylo - ya) / (yb - ya), sh = (yhi - ya) / (yb - ya);
          const s0 = Math.max(0, Math.min(sl, sh)), s1 = Math.min(1, Math.max(sl, sh));
          if ((s1 - s0) * L < 0.8) continue;
          const n = Math.max(2, Math.ceil((s1 - s0) * L / 1.5) + 1), inner = [], outer = [], out = [];
          for (let i = 0; i < n; i++) {
            const sf = s0 + (s1 - s0) * i / (n - 1), u = w(Math.min(u0 + L * sf, u0 + L)), y = ya + (yb - ya) * sf;
            const [xi, zi] = pointAt(run, cum, Math.min(u, total), d0), [xo, zo] = pointAt(run, cum, Math.min(u, total), d1);
            const l = Math.hypot(xo - xi, zo - zi) || 1;
            inner.push([xi, y, zi]); outer.push([xo, y, zo]); out.push([(xo - xi) / l, 0, (zo - zi) / l]);
          }
          rampBand(ramps, inner, outer, out, t);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    let start = 0;
    idx.forEach((list, m) => { g.addGroup(start, list.length, m); start += list.length; });
    g.setIndex(idx.flat());
    g.computeVertexNormals();
    const bands = new THREE.Mesh(g, [stoneLight, stoneDark, structMat]); // 2 = tappi dei tratti aperti
    bands.castShadow = bands.receiveShadow = true;
    group.add(bands);
    own.push(g);
  }

  // torri cilindriche con la rampa a spirale (anima scura, fascia bianca che sale girando) fino a Hs;
  // le torri d'angolo continuano sopra con un cilindro bianco liscio fino a H
  let towerCount = 0;
  const spiralTower = (x, z, r, Hs, H = Hs) => {
    const core = r * 0.74, t = RAMP_BAND, SEG = 40, dir = towerCount++ % 2 ? 1 : -1; // le torri vicine girano in versi opposti
    // anima scura fino a 1 m dalla cima, poi la parte alta piena (parapetto in cima o fusto liscio fino a H)
    const top = Math.max(H, Hs), y1 = Hs - 1.1;
    boxAt(towerCores, x, y1 / 2, z, [core, 0, 0], [0, y1, 0], [0, 0, core]);
    boxAt(towerCaps, x, (y1 + top) / 2, z, [r, 0, 0], [0, top - y1, 0], [0, 0, r]);
    const y0 = 1.2 + t / 2, steps = Math.floor((y1 - 0.1 - t / 2 - y0) / RAMP_PITCH * SEG);
    if (steps < 2) return;
    const inner = [], outer = [], out = [];
    for (let k = 0; k <= steps; k++) {
      const a = dir * Math.PI * 2 * k / SEG, c = Math.cos(a), sn = Math.sin(a), y = y0 + RAMP_PITCH * k / SEG;
      inner.push([x + c * (core - 0.05), y, z + sn * (core - 0.05)]); outer.push([x + c * r, y, z + sn * r]); out.push([c, 0, sn]);
    }
    rampBand(ramps, inner, outer, out, t);
  };
  if (st.ramps) {
    for (const run of shape.runs) {
      // con la copertura le torri finiscono sotto il bordo del tetto
      const cum = runLengths(run), foot = footOf({ ...shape, outer: runOuter(run) }, st), H = wallTopOf(run) - (st.roof !== 'none' ? 2.6 : 0);
      for (const u of rampStations(run, cum)) {
        const [x, z] = rampTowerAt(shape, st, run, cum, u, foot);
        spiralTower(x, z, RAMP_R, H);
      }
    }
  }

  if (G) {
    // torri d'angolo: la rampa a spirale fino in cima alla facciata, poi il fusto liscio che sale oltre le travi rosse
    // (le travi si incrociano sulla torre); in cima il bordo bianco, il fondo scuro e il piccolo traliccio rosso
    const Hs = shape.tiers[shape.tiers.length - 1].top + 2.2, Ht = G.towerTop;
    for (const [x, z] of G.towers) {
      spiralTower(x, z, CORNER_R, Hs, Ht);
      boxAt(towerCaps, x, Ht + 0.15, z, [CORNER_R + 0.3, 0, 0], [0, 1.1, 0], [0, 0, CORNER_R + 0.3]);  // bordo
      boxAt(towerCores, x, Ht + 0.72, z, [CORNER_R - 0.35, 0, 0], [0, 0.06, 0], [0, 0, CORNER_R - 0.35]); // fondo scuro
      // traliccio: quattro gambe che salgono a una punta, un braccio inclinato verso il campo e i raggi sul fondo
      const y = Ht + 0.75, ap = [x, y + 4.2, z], l = Math.hypot(x, z) || 1, ix = -x / l, iz = -z / l;
      for (let k = 0; k < 4; k++) {
        const a = Math.PI / 4 + k * Math.PI / 2, f = [x + Math.cos(a) * CORNER_R * 0.55, y, z + Math.sin(a) * CORNER_R * 0.55];
        beam(girderBeams, ...f, ...ap, 0.32);
        const g = [x + Math.cos(a + Math.PI / 2) * CORNER_R * 0.55, y, z + Math.sin(a + Math.PI / 2) * CORNER_R * 0.55];
        beam(girderBeams, ...f, ...g, 0.22);
      }
      beam(girderBeams, ...ap, x + ix * CORNER_R * 0.8, y + 2.2, z + iz * CORNER_R * 0.8, 0.28);
      beam(girderBeams, x - ix * CORNER_R * 0.3, y, z - iz * CORNER_R * 0.3, x + ix * CORNER_R * 0.8, y + 2.2, z + iz * CORNER_R * 0.8, 0.22);
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4;
        beam(beams, x, y + 0.05, z, x + Math.cos(a) * (CORNER_R - 0.5), y + 0.05, z + Math.sin(a) * (CORNER_R - 0.5), 0.08);
      }
    }
    const planeTruss = (...a) => truss(girderBeams, ...a);
    // travi principali: trave a cassone (due pareti reticolari, piano sopra a traversi fitti, traversi sotto), da una
    // torre all'altra
    const girder = (x1, z1, x2, z2) => {
      const len = Math.hypot(x2 - x1, z2 - z1), nx = -(z2 - z1) / len, nz = (x2 - x1) / len;
      const n = Math.max(2, Math.round(len / GIRDER_PANEL)), y0 = G.y0, y1 = G.top;
      for (const side of [-1, 1]) {
        planeTruss(x1 + nx * GIRDER_W * side, z1 + nz * GIRDER_W * side, x2 + nx * GIRDER_W * side, z2 + nz * GIRDER_W * side, () => y0, () => y1, n, 0.85, 0.42);
      }
      for (let k = 0; k <= n * 2; k++) {
        const x = x1 + (x2 - x1) * k / (n * 2), z = z1 + (z2 - z1) * k / (n * 2);
        beam(girderBeams, x - nx * GIRDER_W, y1, z - nz * GIRDER_W, x + nx * GIRDER_W, y1, z + nz * GIRDER_W, 0.32);
        if (k % 2 === 0) beam(girderBeams, x - nx * GIRDER_W, y0, z - nz * GIRDER_W, x + nx * GIRDER_W, y0, z + nz * GIRDER_W, 0.36);
        if (k % 4 === 0 && k < n * 2) {
          // controventi sul piano di sopra
          const x2b = x1 + (x2 - x1) * (k + 2) / (n * 2), z2b = z1 + (z2 - z1) * (k + 2) / (n * 2);
          beam(girderBeams, x - nx * GIRDER_W, y1, z - nz * GIRDER_W, x2b + nx * GIRDER_W, y1, z2b + nz * GIRDER_W, 0.22);
        }
      }
    };
    girder(-G.X, G.Z, G.X, G.Z); girder(-G.X, -G.Z, G.X, -G.Z);
    girder(G.X, -G.Z, G.X, G.Z); girder(-G.X, -G.Z, -G.X, G.Z);

    // anello interno (due pareti lungo il bordo interno del tetto) e, tra l'anello e le travi principali, travi reticolari
    // a zig-zag che disegnano i grandi triangoli rossi sopra la copertura
    const R2 = roofOf(shape, st.roof, reachOf_(st)), ri = [R2.dIn + 1.2, R2.dIn + 4.2], hRing = 4.5;
    const Xi = G.X - GIRDER_W, Zi = G.Z - GIRDER_W;
    // dove la retta dal punto (px, pz) nella direzione (dx, dz) incontra il lato interno delle travi principali
    const toGirder = (px, pz, dx, dz) => {
      let t = Infinity;
      if (Math.abs(dx) > 1e-6) { const tx = ((dx > 0 ? Xi : -Xi) - px) / dx; if (tx > 0) t = Math.min(t, tx); }
      if (Math.abs(dz) > 1e-6) { const tz = ((dz > 0 ? Zi : -Zi) - pz) / dz; if (tz > 0) t = Math.min(t, tz); }
      return [px + dx * t, pz + dz * t];
    };
    const yb0 = R2.h(ri[1]) + 0.5, yt0 = yb0 + hRing;
    const ybZ = (f) => yb0 + (G.y0 - yb0) * f, ytZ = (f) => yt0 + (G.top - yt0) * f;
    // pianta a lati dritti con gli angoli tagliati (bordo esterno del tetto)
    const oct = (d) => {
      const ax = shape.a - shape.r, bz = shape.b - shape.r, R = shape.r + d, pts = [];
      for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
        const p1 = sx * sz > 0 ? [sx * (ax + R), sz * bz] : [sx * ax, sz * (bz + R)];
        const p2 = sx * sz > 0 ? [sx * ax, sz * (bz + R)] : [sx * (ax + R), sz * bz];
        for (const q of [p1, p2]) if (!pts.length || Math.hypot(q[0] - pts[pts.length - 1][0], q[1] - pts[pts.length - 1][1]) > 0.5) pts.push(q);
      }
      if (Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 0.5) pts.pop();
      return pts;
    };
    const closedRoof = roofRuns.length === 1 && roofRuns[0].closed;
    // anello interno rettangolare con gli angoli dritti (come la griglia vera, sempre squadrata)
    const rectAt = (d) => { const X0 = shape.a + d, Z0 = shape.b + d; return [[X0, Z0], [-X0, Z0], [-X0, -Z0], [X0, -Z0]]; };
    if (closedRoof) {
      const A = rectAt(ri[0]), B = rectAt(ri[1]), n = A.length;
      // dagli angoli dell'anello una trave diagonale fino all'incrocio delle travi principali (sulla torre)
      for (const [cx, cz] of B) {
        const ex = Math.sign(cx) * Xi, ez = Math.sign(cz) * Zi;
        planeTruss(cx, cz, ex, ez, ybZ, ytZ, Math.max(2, Math.round(Math.hypot(ex - cx, ez - cz) / 4)), 0.55, 0.32);
      }
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n, len = Math.hypot(B[j][0] - B[i][0], B[j][1] - B[i][1]), m = Math.max(1, Math.round(len / 5));
        for (const [P, d] of [[A, ri[0]], [B, ri[1]]]) planeTruss(P[i][0], P[i][1], P[j][0], P[j][1], () => R2.h(d) + 0.5, () => R2.h(d) + 0.5 + hRing, m, 0.55, 0.35);
        for (let k = 0; k <= m; k++) {
          const f = k / m, xa = A[i][0] + (A[j][0] - A[i][0]) * f, za = A[i][1] + (A[j][1] - A[i][1]) * f, xb = B[i][0] + (B[j][0] - B[i][0]) * f, zb = B[i][1] + (B[j][1] - B[i][1]) * f;
          beam(girderBeams, xa, R2.h(ri[0]) + 0.5 + hRing, za, xb, R2.h(ri[1]) + 0.5 + hRing, zb, 0.3);
        }
        // travi a zig-zag fino alle travi principali (triangoli rossi), simmetriche su ogni lato
        const nz = Math.max(1, Math.round(len / 18)), dx = (B[j][0] - B[i][0]) / len, dz = (B[j][1] - B[i][1]) / len;
        let ox = dz, oz = -dx;
        if (ox * (B[i][0] + B[j][0]) + oz * (B[i][1] + B[j][1]) < 0) { ox = -ox; oz = -oz; }
        for (let k = 0; k < nz; k++) {
          const pa = [B[i][0] + dx * len * k / nz, B[i][1] + dz * len * k / nz], pb = [B[i][0] + dx * len * (k + 1) / nz, B[i][1] + dz * len * (k + 1) / nz];
          const [gx, gz] = toGirder((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, ox, oz);
          for (const [px, pz] of [pa, pb]) planeTruss(px, pz, gx, gz, ybZ, ytZ, Math.max(2, Math.round(Math.hypot(gx - px, gz - pz) / 4)), 0.55, 0.32);
        }
      }
    }
    if (closedRoof) {
      // verso fuori: trave reticolare lungo il bordo esterno del tetto e travi dritte dalle travi principali fino al bordo
      const ro = R2.dOut - 1.5, E = oct(ro), n = E.length, yo = R2.h(ro) + 0.5, HE = 3;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n, len = Math.hypot(E[j][0] - E[i][0], E[j][1] - E[i][1]);
        const alongX = Math.abs(E[j][1] - E[i][1]) < 1e-3, alongZ = Math.abs(E[j][0] - E[i][0]) < 1e-3;
        if (!alongX && !alongZ) continue; // solo i lati dritti (niente travi in diagonale agli angoli)
        planeTruss(E[i][0], E[i][1], E[j][0], E[j][1], () => yo, () => yo + HE, Math.max(1, Math.round(len / 5)), 0.5, 0.3);
        const m = Math.max(2, Math.round(len / 16));
        for (let k = 0; k <= m; k++) {
          const px = E[i][0] + (E[j][0] - E[i][0]) * k / m, pz = E[i][1] + (E[j][1] - E[i][1]) * k / m;
          const [gx, gz] = alongX ? [px, Math.sign(pz) * (G.Z + GIRDER_W)] : [Math.sign(px) * (G.X + GIRDER_W), pz];
          const span = Math.hypot(px - gx, pz - gz);
          if (span < 3) continue;
          planeTruss(gx, gz, px, pz, (f) => G.y0 + (yo - G.y0) * f, (f) => G.top + (yo + HE - G.top) * f, Math.max(2, Math.round(span / 4)), 0.5, 0.3);
        }
      }
    }
    for (const run of closedRoof ? [] : roofRuns) {
      const cum = runLengths(run), total = cum[cum.length - 1], st5 = stations(run, cum, 5, ri[1]), last = run.closed ? st5.length : st5.length - 1;
      for (let i = 0; i < last; i++) {
        const ua = st5[i], ub = i + 1 < st5.length ? st5[i + 1] : st5[0] + total;
        for (const d of ri) {
          const [xa, za] = pointAt(run, cum, ua, d), [xb, zb] = pointAt(run, cum, wrapU(run, total, ub), d);
          planeTruss(xa, za, xb, zb, () => R2.h(d) + 0.5, () => R2.h(d) + 0.5 + hRing, 1, 0.55, 0.35);
        }
        const [xa, za] = pointAt(run, cum, ua, ri[0]), [xb, zb] = pointAt(run, cum, ua, ri[1]);
        beam(girderBeams, xa, R2.h(ri[0]) + 0.5 + hRing, za, xb, R2.h(ri[1]) + 0.5 + hRing, zb, 0.35);
      }
      const S = stations(run, cum, 18, ri[1]), lastZ = run.closed ? S.length : S.length - 1, yb = ybZ, yt = ytZ;
      for (let i = 0; i < lastZ; i++) {
        const ua = S[i], ub = i + 1 < S.length ? S[i + 1] : S[0] + total, um = wrapU(run, total, (ua + ub) / 2);
        const [mx0, mz0] = pointAt(run, cum, um, ri[1]), [mx1, mz1] = pointAt(run, cum, um, ri[1] + 10);
        const l = Math.hypot(mx1 - mx0, mz1 - mz0) || 1, [gx, gz] = toGirder(mx0, mz0, (mx1 - mx0) / l, (mz1 - mz0) / l);
        for (const u of [ua, wrapU(run, total, ub)]) {
          const [px, pz] = pointAt(run, cum, u, ri[1]), span = Math.hypot(gx - px, gz - pz);
          planeTruss(px, pz, gx, gz, yb, yt, Math.max(2, Math.round(span / 4)), 0.55, 0.32);
        }
      }
    }

    // sbalzi: le travi escono dall'altra parte della torre e finiscono con un blocco rosso pieno (sopra piano, sotto inclinato)
    for (const [tx0, tz0] of G.towers) {
      for (const [dx, dz] of [[Math.sign(tx0), 0], [0, Math.sign(tz0)]]) {
        const nx = -dz, nz = dx, w = GIRDER_W + 0.3, s0 = CORNER_R + 3, s1 = s0 + GIRDER_L;
        // tratto reticolare tra l'incrocio e il blocco
        for (const side of [-1, 1]) planeTruss(tx0 + nx * GIRDER_W * side, tz0 + nz * GIRDER_W * side, tx0 + dx * s0 + nx * GIRDER_W * side, tz0 + dz * s0 + nz * GIRDER_W * side, () => G.y0, () => G.top, 1, 0.85, 0.42);
        const P = (sv, y, side) => [tx0 + dx * sv + nx * w * side, y, tz0 + dz * sv + nz * w * side];
        const nb = [s0, G.y0 - 0.3], nt = [s0, G.top + 0.3], tb = [s1, G.top - 2.6], tt = [s1, G.top + 0.3];
        const c = [tx0 + dx * (s0 + s1) / 2, (G.y0 + G.top) / 2, tz0 + dz * (s0 + s1) / 2];
        const v = (q, side) => P(q[0], q[1], side);
        for (const [a, b] of [[nb, tb], [tb, tt], [tt, nt], [nt, nb]]) wedges.quad(v(a, -1), v(b, -1), v(b, 1), v(a, 1), c);
        for (const side of [-1, 1]) wedges.quad(v(nb, side), v(tb, side), v(tt, side), v(nt, side), c);
      }
    }
  }

  if (st.horseshoe) {
    // curva aperta: fila di sculture bianche a V dietro la pista
    const x0 = -(shape.a + 7), half = shape.b * 0.85;
    for (let zz = -half; zz <= half + 0.01; zz += 7) {
      beam(sculpt, x0, 0, zz, x0 - 2, 8, zz - 2.4, 0.9);
      beam(sculpt, x0, 0, zz, x0 - 2, 8, zz + 2.4, 0.9);
      beam(sculpt, x0 - 2, 8, zz - 2.6, x0 - 2, 8, zz + 2.6, 0.8);
    }
  }

  // maxischermo: anello a 360° (lungo i tratti) o due schermi sopra le curve, con la cornice scura e i tiranti
  let screen = null;
  if (st.screen !== 'none') {
    const Sc = screenOf(shape, st), ring = st.screen === 'ring', Hs = ring ? SCREEN_H : ENDS_H;
    const ht = Sc.hang ? Sc.y : Sc.y + Hs, hb = ht - Hs, htAll = ht, hbAll = hb;
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = ring ? 128 : Math.round(1024 * ENDS_H / ENDS_W);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    const faceMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1, side: THREE.DoubleSide });
    own.push(tex, faceMat);
    const facePos = [], faceUv = [], faceIdx = [], framePos = [], frameIdx = [[], [], []];
    const quad = (pts, uvs) => {
      const b = facePos.length / 3;
      pts.forEach(p => facePos.push(...p)); uvs.forEach(u => faceUv.push(...u));
      faceIdx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
    if (ring) {
      for (const run of shape.runs) {
        const P = run.pts, n = P.length, cnt = run.closed ? n + 1 : n, us = [0];
        const at = (k) => { const p = P[k % n]; return [p.x + p.mx * (Sc.ds - 0.04), p.z + p.mz * (Sc.ds - 0.04)]; };
        for (let k = 1; k < cnt; k++) { const a = at(k - 1), b = at(k); us.push(us[k - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
        const len = us[cnt - 1] || 1, cells = Math.max(1, Math.round(len / SCREEN_PANEL));
        for (let k = 1; k < cnt; k++) {
          const a = at(k - 1), b = at(k), ua = us[k - 1] / len * cells, ub = us[k] / len * cells;
          quad([[a[0], hb, a[1]], [b[0], hb, b[1]], [b[0], ht, b[1]], [a[0], ht, a[1]]], [[ua, 0], [ub, 0], [ub, 1], [ua, 1]]);
        }
        extrude(THREE, run, [[Sc.ds, hb - 0.25], [Sc.ds + 0.5, hb - 0.25], [Sc.ds + 0.5, ht + 0.25], [Sc.ds, ht + 0.25]].map(([d, h]) => ({ d, h, m: 0 })), framePos, frameIdx);
        if (Sc.hang) {
          const cum = runLengths(run);
          for (const u of stations(run, cum, 12)) { const [x, z] = pointAt(run, cum, u, Sc.ds + 0.25); beam(beams, x, ht + 0.2, z, x, Sc.roofY, z, 0.12); }
        }
      }
    } else {
      for (const sgn of [1, -1]) {
        // centro della curva: punto del bordo con la x più grande (o più piccola)
        const c0 = shape.path.reduce((m, p) => (p.x * sgn > m.x * sgn ? p : m), shape.path[0]);
        let x = sgn * (Math.abs(c0.x) + Sc.ds), hb = hbAll, ht = htAll;
        if (st.horseshoe && sgn < 0) {
          // curva aperta: schermo su due pali dietro le sculture
          x = -(shape.a + 12); hb = 10; ht = hb + Hs;
          for (const zz of [-ENDS_W / 2 + 2, ENDS_W / 2 - 2]) beam(pilasters, x - 0.25, 0, zz, x - 0.25, hb, zz, 0.7);
        }
        const xf = x - sgn * 0.04, w = ENDS_W / 2;
        if (st.horseshoe && sgn < 0) {
          quad([[xf, hb, -sgn * w], [xf, hb, sgn * w], [xf, ht, sgn * w], [xf, ht, -sgn * w]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
          boxAt(frames, x + sgn * 0.25, (hb + ht) / 2, 0, [0.5, 0, 0], [0, Hs + 0.5, 0], [0, 0, ENDS_W + 0.5]);
          continue;
        }
        // dal campo si legge da sinistra a destra: guardando verso +x la destra è +z
        quad([[xf, hb, -sgn * w], [xf, hb, sgn * w], [xf, ht, sgn * w], [xf, ht, -sgn * w]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
        boxAt(frames, x + sgn * 0.25, (hb + ht) / 2, 0, [0.5, 0, 0], [0, Hs + 0.5, 0], [0, 0, ENDS_W + 0.5]);
        if (Sc.hang) for (const zz of [-w + 2, 0, w - 2]) beam(beams, x + sgn * 0.25, ht + 0.2, zz, x + sgn * 0.25, Sc.roofY, zz, 0.12);
        else for (const zz of [-w + 2, w - 2]) beam(pilasters, x + sgn * 0.25, Sc.y - 6, zz, x + sgn * 0.25, Sc.y, zz, 0.5);
      }
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(facePos, 3));
    fg.setAttribute('uv', new THREE.Float32BufferAttribute(faceUv, 2));
    fg.setIndex(faceIdx);
    fg.computeVertexNormals();
    const face = new THREE.Mesh(fg, faceMat);
    group.add(face);
    own.push(fg);
    if (framePos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(framePos, 3));
      g.setIndex(frameIdx[0]);
      g.computeVertexNormals();
      const frame = new THREE.Mesh(g, screenFrame);
      frame.castShadow = true;
      group.add(frame);
      own.push(g);
    }
    screen = { canvas, tex, kind: st.screen };
  }

  if (st.facade === 'columns') {
    for (const run of shape.runs) {
      const cum = runLengths(run), total = cum[cum.length - 1], H = wallTopOf(run), d = runOuter(run) + 0.35;
      for (const u of stations(run, cum, PILASTER_EVERY, d)) {
        const [x, z] = pointAt(run, cum, u, d);
        const [xa, za] = pointAt(run, cum, Math.max(0, u - 0.5), d), [xb, zb] = pointAt(run, cum, Math.min(total, u + 0.5), d);
        const tl = Math.hypot(xb - xa, zb - za) || 1, tx = (xb - xa) / tl, tz = (zb - za) / tl;
        boxAt(pilasters, x + tz * 0.35, H / 2, z - tx * 0.35, [tx * 1.1, 0, tz * 1.1], [0, H, 0], [-tz * 0.7, 0, tx * 0.7]);
      }
    }
  }

  inst(steel, beams);
  inst(structMat, pilasters);
  inst(glass, windows);
  inst(screenFrame, frames);
  inst(dark, seams);
  inst(sculptMat, sculpt);

  // ingressi monumentali (portale vetrato, arco, pensilina, torri gemelle) al centro dei lati scelti, con il logo sopra
  // (logoSpots, sull'insegna che lo regge) e l'immagine personale sui pannelli; davanti la piazzetta lastricata con le
  // aiuole. Sul Vélodrome anche il suo ingresso sulla curva (atrio vetrato, lamelle, pensilina, schermi). Di notte vetri,
  // faretti, lanterne, strisce LED (del colore dell'ingresso) e pannelli si accendono
  let entrance = null;
  const ents = entrancesOf(shape, st), VE = veloEntryOf(shape, st), velo = VE && VE.ent.length > 1 ? VE : null;
  if (ents.length || velo) {
    // texture vere in coordinate del mondo: pannelli di metallo sulle parti colorate, pietra a blocchi (arco, torri) o
    // cemento prefabbricato (portale, pensilina, Vélodrome) sulle parti chiare
    const triTex = (T) => { const t = new THREE.CanvasTexture(T.canvas); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; own.push(t); return t; };
    const stoneKind = st.entrance === 'arch' || st.entrance === 'towers' ? 'ashlar' : 'precast';
    const frameMat = new THREE.MeshStandardMaterial({ roughness: 0.36, metalness: 0.35, side: THREE.DoubleSide });
    triplanar(frameMat, triTex(entranceTexture('metal')), 1 / 4.8);
    const stoneMat = new THREE.MeshStandardMaterial({ roughness: 0.82, side: THREE.DoubleSide });
    triplanar(stoneMat, triTex(entranceTexture(stoneKind)), stoneKind === 'ashlar' ? 1 / 4.8 : 1 / 6);
    // vetrate dell'atrio: porte in basso, vetro che riflette il cielo sopra; di notte l'atrio acceso
    const LG = lobbyGlassCanvas(), gm = new THREE.CanvasTexture(LG.map), gg = new THREE.CanvasTexture(LG.glow);
    for (const t of [gm, gg]) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace; }
    const entGlass = new THREE.MeshStandardMaterial({ map: gm, roughness: 0.12, metalness: 0.5, side: THREE.DoubleSide, emissive: 0xffd9a0, emissiveMap: gg, emissiveIntensity: 0.04 });
    // pannelli con l'immagine personale: uno per forma (ingressi e schermi del Vélodrome)
    const panelMat = (aspect) => {
      const canvas = document.createElement('canvas'), tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.15, roughness: 0.5, side: THREE.DoubleSide });
      own.push(mat); nightGlow.push([mat, 0.15, 0.9]);
      return { mat, tex, canvas, aspect, shown: null, key: '' };
    };
    const ledMat = new THREE.MeshStandardMaterial({ roughness: 0.3, emissiveIntensity: 0.35 });
    // lastricato in metri, tinto col colore della pietra
    const PV = floorTexture('plaza'), pvMap = new THREE.CanvasTexture(PV.canvas), pvNrm = new THREE.CanvasTexture(PV.normal);
    for (const t of [pvMap, pvNrm]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.repeat.set(1 / PV.tileU, 1 / PV.tileV); }
    pvMap.colorSpace = THREE.SRGBColorSpace;
    const paveMat = new THREE.MeshStandardMaterial({ map: pvMap, normalMap: pvNrm, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x4d7d38, roughness: 0.9, flatShading: true });
    const ico = new THREE.IcosahedronGeometry(0.5, 1);
    own.push(frameMat, stoneMat, gm, gg, entGlass, ledMat, pvMap, pvNrm, paveMat, leafMat, ico);
    // di notte pietra e parti colorate sono illuminate dal basso (un velo del loro colore)
    nightGlow.push([entGlass, 0.04, 0.8], [ledMat, 0.35, 2.4], [stoneMat, 0, 0.16], [frameMat, 0, 0.1]);
    const fr = [], stn = [], drk = [], stl = [], lmp = [], led = [], leaf = [], plateFr = [], plateLed = [];
    const gpos = [], guv = [], ppos = [], puv = [], panels = [], extra = [];
    const quad = (pos, uv, a, b, c, d, uvs) => { pos.push(...a, ...b, ...c, ...a, ...c, ...d); uv.push(...uvs[0], ...uvs[1], ...uvs[2], ...uvs[0], ...uvs[2], ...uvs[3]); };
    // strisce di vetrata (v in metri dal piano): fino a 3 m le porte (metà bassa della texture), sopra il vetro a
    // lastre alte 3 m (metà alta, ripetuta)
    const glassStrips = (v0, v1) => {
      const out = [];
      for (let v = v0; v < v1 - 1e-6;) {
        const low = v < 3 - 1e-6, k = low ? 0 : Math.floor((v - 3) / 3 + 1e-6), top = Math.min(v1, low ? 3 : 6 + k * 3);
        out.push([v, top, low ? v / 6 : 0.5 + (v - 3 - k * 3) / 6, low ? top / 6 : 0.5 + (top - 3 - k * 3) / 6]);
        v = top;
      }
      return out;
    };
    // sistema di riferimento di un ingresso: at(u, v, w) → mondo, R destra vista da fuori, N verso fuori
    const frameOf = (at, R, N) => {
      const bx = (list, u, v, w, su, sv, sw) => boxAt(list, ...at(u, v, w), R.map(k => k * su), [0, sv, 0], N.map(k => k * sw));
      const bm = (list, a, b, t) => beam(list, ...at(...a), ...at(...b), t);
      const glassWall = (u0, u1, v0, v1, w) => {
        for (const [a, b, ta, tb] of glassStrips(v0, v1)) quad(gpos, guv, at(u0, a, w), at(u1, a, w), at(u1, b, w), at(u0, b, w),
          [[u0 / LG.tileU, ta], [u1 / LG.tileU, ta], [u1 / LG.tileU, tb], [u0 / LG.tileU, tb]]);
      };
      // vetrata con i montanti in rilievo ogni 3 m (come le lastre della texture) e il traverso sopra le porte
      const curtain = (u0, u1, v1, w) => {
        glassWall(u0, u1, 0, v1, w);
        for (let u = Math.ceil(u0 / 3 + 0.01) * 3; u < u1 - 0.1; u += 3) bx(stl, u, v1 / 2, w + 0.1, 0.16, v1, 0.22);
        bx(stl, (u0 + u1) / 2, 3, w + 0.1, u1 - u0, 0.16, 0.22);
      };
      // piazzetta lastricata (da w0 a pd, larga pw) con il bordo, i paletti e due aiuole con gli alberi ai lati
      const plaza = (pw, w0, pd) => {
        bx(stn, 0, 0.04, (w0 + pd) / 2, pw, 0.08, pd - w0);
        quad(ppos, puv, at(-pw / 2, 0.085, w0), at(-pw / 2, 0.085, pd), at(pw / 2, 0.085, pd), at(pw / 2, 0.085, w0), [[-pw / 2, w0], [-pw / 2, pd], [pw / 2, pd], [pw / 2, w0]]);
        bx(fr, 0, 0.06, pd, pw, 0.1, 0.4);
        for (let u = -(pw - 2) / 2; u <= (pw - 2) / 2 + 0.01; u += 2.5) if (Math.abs(u) > 3) bx(drk, u, 0.5, pd - 0.6, 0.25, 1, 0.25);
        for (const k of [-1, 1]) {
          const u = k * (pw / 2 - 2.6), w = pd - 3.4;
          bx(stn, u, 0.4, w, 3.2, 0.8, 3.2);
          bx(drk, u, 0.82, w, 2.8, 0.06, 2.8);
          bm(drk, [u, 0.8, w], [u, 3.6, w], 0.32);
          boxAt(leaf, ...at(u, 4.6, w), R.map(c => c * 3.6), [0, 3.2, 0], N.map(c => c * 3.6));
          boxAt(leaf, ...at(u + 0.5, 5.9, w - 0.4), R.map(c => c * 2.6), [0, 2.4, 0], N.map(c => c * 2.6));
        }
      };
      // pannello con l'immagine (e la cornice scura dietro)
      const panel = (P, pm) => {
        quad(pm.pos, pm.uv, at(P.u0, P.v0, P.w), at(P.u1, P.v0, P.w), at(P.u1, P.v1, P.w), at(P.u0, P.v1, P.w), [[0, 0], [1, 0], [1, 1], [0, 1]]);
        bx(drk, (P.u0 + P.u1) / 2, (P.v0 + P.v1) / 2, P.w - 0.06, P.u1 - P.u0 + 0.4, P.v1 - P.v0 + 0.4, 0.08);
      };
      return { bx, bm, glassWall, curtain, plaza, panel };
    };
    if (ents.length) {
      const P0 = ents[0].g.panels[0], pm = panelMat((P0.u1 - P0.u0) / (P0.v1 - P0.v0));
      pm.pos = []; pm.uv = []; panels.push(pm);
      for (const e of ents) {
        const { W, H, g, at } = e, R = [e.rx, 0, e.rz], N = [e.nx, 0, e.nz], L = g.logo;
        const { bx, bm, glassWall, curtain, plaza, panel } = frameOf(at, R, N);
        // da (u, v, w) locali al mondo: x = u lungo R, y = v, z = w lungo N (per le forme estruse)
        const toWorld = (geo, w = 0) => geo.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(...R), new THREE.Vector3(0, 1, 0), new THREE.Vector3(...N)).setPosition(...at(0, 0, w)));
        for (const P of g.panels) panel(P, pm);
        // insegna che regge il logo: lastra del colore dell'ingresso col bordo LED, su due montanti
        if (L.base !== undefined) {
          const ps = L.s * 1.2;
          bx(plateFr, 0, L.v, L.w - 0.3, ps, ps, 0.4);
          for (const k of [-1, 1]) bx(plateFr, k * ps * 0.3, L.base + 0.25, L.w - 0.3, 0.4, 0.5, 0.3);
          for (const k of [-1, 1]) {
            bx(plateLed, 0, L.v + k * (ps / 2 - 0.2), L.w - 0.08, ps - 0.3, 0.12, 0.05);
            bx(plateLed, k * (ps / 2 - 0.2), L.v, L.w - 0.08, 0.12, ps - 0.3, 0.05);
          }
        }
        plaza(W + 16, 0, Math.min(g.depth + 10, e.pdMax));
        if (st.entrance === 'portal') {
          // portale: due grandi pilastri e l'architrave del colore dell'ingresso con le strisce LED, vetrata a tutta
          // altezza, pensilina chiara con il bordo colorato, i faretti e le colonnine, gradini, tornelli, due pennoni
          const cy = H * 0.42;
          curtain(-W / 2 + 1.2, W / 2 - 1.2, H - 2.4, 0.6);
          for (const k of [-1, 1]) {
            bx(fr, k * W / 2, H / 2, 2.5, 2.4, H, 5);
            bx(led, k * W / 2, (H - 2.4) / 2 + 0.3, 5.03, 0.35, H - 3.6, 0.06);
          }
          bx(fr, 0, H - 1.2, 2.8, W + 2.4, 2.4, 5.6);
          bx(led, 0, H - 2.2, 5.63, W + 2.4, 0.12, 0.06);
          bx(stn, 0, cy, 6, W + 1, 0.5, 9);
          bx(fr, 0, cy, 10.53, W + 1.1, 0.7, 0.12);
          for (let u = -W / 2 + 2; u <= W / 2 - 1.9; u += 3) for (const w of [4, 8]) bx(lmp, u, cy - 0.27, w, 0.6, 0.04, 0.6);
          for (const k of [-1, 1]) bm(stl, [k * W * 0.4, 0, 10], [k * W * 0.4, cy - 0.25, 10], 0.35);
          for (let i = 0; i < 3; i++) bx(stn, 0, (3 - i) * 0.09, 11 + i * 0.9, W + 1, (3 - i) * 0.18, 0.9);
          const n = Math.max(3, Math.floor((W - 4) / 2.6));
          for (let i = 0; i < n; i++) {
            const u = -W / 2 + 2 + (i + 0.5) * (W - 4) / n;
            bx(drk, u, 0.55, 8, 0.6, 1.1, 0.9);
            bx(stl, u + 0.5, 0.9, 8, 0.5, 0.06, 0.06);
          }
          for (const k of [-1, 1]) {
            const u = k * (W / 2 + 1.8);
            bm(stl, [u, 0, 12.5], [u, H + 7, 12.5], 0.25);
            bx(fr, u + k * 1.6, H + 5.6, 12.5, 3, 2, 0.06);
          }
        } else if (st.entrance === 'arch') {
          // arco monumentale in pietra su zoccolo, con l'archivolto in rilievo, la chiave di volta, le lesene agli angoli,
          // la cornice e l'attico del colore dell'ingresso (il logo sull'attico), il cancello in ferro e due lanterne
          const r = g.Wa / 2, pier = W / 2 - r, t = Math.min(0.8, pier * 0.12), pwl = Math.min(1.1, pier * 0.16);
          const shp = new THREE.Shape();
          shp.moveTo(-W / 2, 0); shp.lineTo(W / 2, 0); shp.lineTo(W / 2, H); shp.lineTo(-W / 2, H); shp.lineTo(-W / 2, 0);
          const hole = new THREE.Path();
          hole.moveTo(-r, 0); hole.lineTo(-r, g.hs); hole.absarc(0, g.hs, r, Math.PI, 0, true); hole.lineTo(r, 0); hole.lineTo(-r, 0);
          shp.holes.push(hole);
          extra.push(toWorld(new THREE.ExtrudeGeometry(shp, { depth: 4, bevelEnabled: false, curveSegments: 24 })));
          const av = new THREE.Shape();
          av.moveTo(-r - t, 0); av.lineTo(-r - t, g.hs); av.absarc(0, g.hs, r + t, Math.PI, 0, true); av.lineTo(r + t, 0);
          av.lineTo(r, 0); av.lineTo(r, g.hs); av.absarc(0, g.hs, r, 0, Math.PI, false); av.lineTo(-r, 0); av.lineTo(-r - t, 0);
          extra.push(toWorld(new THREE.ExtrudeGeometry(av, { depth: 0.25, bevelEnabled: false, curveSegments: 24 }), 4));
          bx(fr, 0, g.hs + r + t / 2, 4.2, 1.3, t + 1, 0.45);
          for (const k of [-1, 1]) {
            bx(stn, k * (r + (pier + 0.2) / 2), 0.7, 2.1, pier + 0.2, 1.4, 4.4);
            const u = k * (W / 2 - pwl / 2 - 0.05);
            bx(stn, u, (1.4 + H - 0.4) / 2, 4.15, pwl, H - 1.8, 0.3);
            bx(stn, u, H - 0.2, 4.2, pwl + 0.3, 0.4, 0.45);
          }
          bx(fr, 0, H + 0.25, 2, W + 0.8, 0.5, 4.8);
          bx(stn, 0, H + 0.5 + g.At / 2, 2.05, W * 0.86, g.At, 4.2);
          bx(fr, 0, H + 0.5 + g.At + 0.2, 2, W * 0.9, 0.4, 4.6);
          bx(drk, 0, (g.hs + r) / 2, 1.8, g.Wa, g.hs + r, 0.12);
          for (let u = -r + 0.3; u < r; u += 0.45) bm(stl, [u, 0, 1.95], [u, g.hs + Math.sqrt(Math.max(0, r * r - u * u)) - 0.1, 1.95], 0.07);
          for (const v of [1.2, g.hs * 0.6]) bx(stl, 0, v, 1.95, g.Wa - 0.2, 0.12, 0.1);
          for (const k of [-1, 1]) {
            const u = k * (W / 2 + 1.5);
            bm(stl, [u, 0, 7], [u, 4.6, 7], 0.22);
            lampAt(lmp, ...at(u, 5, 7), 0.8, 0.8);
          }
        } else if (st.entrance === 'canopy') {
          // pensilina a sbalzo: grande lastra inclinata (sopra del colore dell'ingresso, sotto chiara con i faretti) con il
          // frontale e la striscia LED, retta da due colonne a V; vetrata d'ingresso con le pinne, maxischermo appeso con
          // l'immagine; il logo sull'insegna in piedi verso il bordo davanti
          curtain(-W / 2, W / 2, H, 0.6);
          for (const k of [-1, 1]) bx(fr, k * W / 2, H / 2, 1, 0.8, H, 2);
          slab(fr, ...at(0, H + 0.3, 0), ...at(0, H + g.rise + 0.3, g.depth), e.rx, e.rz, W + 6, 0.6);
          slab(stn, ...at(0, H - 0.25, 0), ...at(0, H + g.rise - 0.25, g.depth), e.rx, e.rz, W + 6, 0.5);
          bx(fr, 0, H + g.rise + 0.05, g.depth + 0.1, W + 6, 1.3, 0.2);
          bx(led, 0, H + g.rise - 0.5, g.depth + 0.22, W + 6, 0.1, 0.04);
          const vy = (w) => H + g.rise * w / g.depth - 0.5;
          for (let u = -W / 2 - 1.5; u <= W / 2 + 1.6; u += 3.2) for (const w of [3, 6.5, 10, 13.5]) bx(lmp, u, vy(w) - 0.03, w, 0.7, 0.05, 0.7);
          for (const k of [-1, 1]) {
            const u = k * (W / 2 - 1);
            bm(stl, [u, 0, 10], [u - 2.4, vy(12), 12], 0.55);
            bm(stl, [u, 0, 10], [u + 2.4, vy(12), 12], 0.55);
          }
          const P = g.panels[0];
          bx(drk, 0, (P.v0 + P.v1) / 2, 7.95, P.u1 - P.u0 + 0.6, P.v1 - P.v0 + 0.6, 0.35);
          for (const k of [-1, 1]) bm(stl, [k * (P.u1 - 1), P.v1, 8], [k * (P.u1 - 1), vy(8), 8], 0.1);
        } else {
          // torri gemelle in pietra su zoccolo, con le feritoie, il tamburo, la cupola e il pennone in cima (come il vecchio
          // Wembley); ponte del colore dell'ingresso con la striscia LED, cancellata sotto, stendardi appesi
          for (const k of [-1, 1]) {
            const u = k * (W / 2 + g.TW / 2);
            bx(stn, u, 0.75, 3, g.TW + 0.8, 1.5, g.TW + 0.8);
            bx(stn, u, g.TH / 2, 3, g.TW, g.TH, g.TW);
            bx(fr, u, g.TH + 0.4, 3, g.TW + 0.6, 0.8, g.TW + 0.6);
            bx(stn, u, g.TH + 2, 3, g.TW * 0.78, 2.4, g.TW * 0.78);
            bx(fr, u, g.TH + 3.3, 3, g.TW * 0.86, 0.3, g.TW * 0.86);
            const dome = new THREE.SphereGeometry(g.TW * 0.38, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
            dome.translate(...at(u, g.TH + 3.45, 3));
            extra.push(dome);
            bm(stl, [u, g.TH + 3.45 + g.TW * 0.38, 3], [u, g.TH + 10, 3], 0.18);
            bx(fr, u + k * 1.3, g.TH + 9, 3, 2.6, 1.6, 0.06);
            for (let v = 3; v < g.TH - 2; v += 3) for (const w of [6.03, -0.03]) glassWall(u - 0.5, u + 0.5, v, v + 1.8, w);
          }
          bx(fr, 0, H + 1.6, 3, W, 3.2, 6);
          bx(stn, 0, H + 0.15, 3, W, 0.3, 6.1);
          bx(led, 0, H + 2.9, 6.03, W, 0.12, 0.06);
          bx(drk, 0, H / 2, 1.5, W, H, 0.12);
          for (let u = -W / 2 + 0.4; u < W / 2; u += 0.5) bm(stl, [u, 0, 1.6], [u, H, 1.6], 0.07);
          for (const P of g.panels) for (const u of [P.u0 + 0.3, P.u1 - 0.3]) bm(stl, [u, P.v1, 5.6], [u, H, 5.6], 0.06);
        }
      }
    }
    if (velo) {
      // ingresso del Vélodrome sotto la fascia che sale al centro della curva: in basso l'atrio vetrato con le porte,
      // sopra le lamelle d'alluminio fino alla fascia (col soffitto), la pensilina a sbalzo del colore dell'ingresso con
      // i faretti, i tiranti e la striscia LED, i due schermi con l'immagine personale, il podio con i gradini e i
      // tornelli, la striscia LED sul bordo della fascia e davanti la piazzetta con i pennoni
      const { V, ent, back, outer, bb, nrm } = velo, b0 = V.base, GL = 6;
      const LT = louvreTexture(), lMap = new THREE.CanvasTexture(LT.canvas), lNrm = new THREE.CanvasTexture(LT.normal);
      for (const t of [lMap, lNrm]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
      lMap.colorSpace = THREE.SRGBColorSpace;
      const louMat = new THREE.MeshStandardMaterial({ map: lMap, normalMap: lNrm, roughness: 0.35, metalness: 0.45, side: THREE.DoubleSide });
      own.push(lMap, lNrm, louMat);
      const lpos = [], luv = [], cpos = [];
      // pezzo dritto tra due punti del portale, spostato verso fuori di off: lungo il tratto, alto sv, profondo sw
      const segBox = (list, i, j, off, v, sv, sw) => {
        const [x0, z0] = back[i], [x1, z1] = back[j], len = Math.hypot(x1 - x0, z1 - z0) || 1, ax = (x1 - x0) / len, az = (z1 - z0) / len;
        const nx = (nrm[i][0] + nrm[j][0]) / 2, nz = (nrm[i][1] + nrm[j][1]) / 2;
        boxAt(list, (x0 + x1) / 2 + nx * off, v, (z0 + z1) / 2 + nz * off, [ax * (len + 0.08), 0, az * (len + 0.08)], [0, sv, 0], [-az * sw, 0, ax * sw]);
      };
      let u = 0;
      for (let k = 0; k < ent.length - 1; k++) {
        const i = ent[k], j = ent[k + 1], [x0, z0] = back[i], [x1, z1] = back[j], len = Math.hypot(x1 - x0, z1 - z0);
        const t0 = bb[i] - 0.2, t1 = bb[j] - 0.2, U = (a) => a / LG.tileU;
        for (const [a, b, ta, tb] of glassStrips(0, GL)) quad(gpos, guv, [x0, b0 + a, z0], [x1, b0 + a, z1], [x1, b0 + b, z1], [x0, b0 + b, z0], [[U(u), ta], [U(u + len), ta], [U(u + len), tb], [U(u), tb]]);
        quad(lpos, luv, [x0, b0 + GL, z0], [x1, b0 + GL, z1], [x1, t1, z1], [x0, t0, z0],
          [[u / LT.tileU, 0], [(u + len) / LT.tileU, 0], [(u + len) / LT.tileU, (t1 - b0 - GL) / LT.tileV], [u / LT.tileU, (t0 - b0 - GL) / LT.tileV]]);
        const [ox0, oz0] = outer[i], [ox1, oz1] = outer[j];
        cpos.push(x0, t0, z0, ox0, t0, oz0, ox1, t1, oz1, x0, t0, z0, ox1, t1, oz1, x1, t1, z1);
        // montanti della vetrata e delle lamelle, traverso sopra le porte
        beam(stl, x0, b0, z0, x0, t0, z0, 0.18);
        beam(stl, x0, b0 + 3, z0, x1, b0 + 3, z1, 0.14);
        // pensilina: lastra colorata, faretti sotto, striscia LED sul bordo davanti, tiranti verso le lamelle
        segBox(fr, i, j, 2.6, b0 + GL + 0.35, 0.7, 5.2);
        segBox(led, i, j, 5.22, b0 + GL + 0.08, 0.12, 0.06);
        for (const off of [1.6, 3.9]) segBox(lmp, i, j, off, b0 + GL - 0.02, 0.04, 0.6);
        if (k % 2 === 0) {
          const nx = nrm[i][0], nz = nrm[i][1];
          beam(stl, x0 + nx * 4.9, b0 + GL + 0.7, z0 + nz * 4.9, x0 + nx * 0.2, b0 + GL + 5.5, z0 + nz * 0.2, 0.09);
        }
        // striscia LED sul bordo basso della fascia
        beam(led, ox0, bb[i] - 0.12, oz0, ox1, bb[j] - 0.12, oz1, 0.16);
        u += len;
      }
      const last = ent[ent.length - 1];
      beam(stl, ...[back[last][0], b0, back[last][1]], back[last][0], bb[last] - 0.2, back[last][1], 0.18);
      for (const [pos, uv, mat] of [[lpos, luv, louMat], [cpos, null, dark]]) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.computeVertexNormals();
        const m = new THREE.Mesh(g, mat);
        m.receiveShadow = true;
        group.add(m); own.push(g);
      }
      // schermi con l'immagine personale, sopra la pensilina davanti alle lamelle
      const top = Math.min(...ent.map(i => bb[i])) - 1.5, y0 = b0 + GL + 1.8, Hs = Math.min(9, top - y0);
      if (Hs > 3) {
        const pmV = panelMat(6.4 / Hs);
        pmV.pos = []; pmV.uv = []; panels.push(pmV);
        for (const f of [0.28, 0.72]) {
          const c = ent[Math.round(f * (ent.length - 1))], [x, z] = back[c], [nx, nz] = nrm[c], tx = -nz, tz = nx, w = 3.2;
          const px = x + nx * 0.8, pz = z + nz * 0.8, y1 = y0 + Hs;
          quad(pmV.pos, pmV.uv, [px - tx * w, y0, pz - tz * w], [px + tx * w, y0, pz + tz * w], [px + tx * w, y1, pz + tz * w], [px - tx * w, y1, pz - tz * w], [[1, 0], [0, 0], [0, 1], [1, 1]]);
          boxAt(drk, px - nx * 0.08, (y0 + y1) / 2, pz - nz * 0.08, [tx * 6.9, 0, tz * 6.9], [0, Hs + 0.5, 0], [nx * 0.12, 0, nz * 0.12]);
          beam(stl, px - nx * 0.1, y1 + 0.2, pz - nz * 0.1, x + nx * 0.05, top + 1.2, z + nz * 0.05, 0.08);
        }
      }
      // davanti, in un riferimento dritto al centro del portale: podio con i gradini e i tornelli, piazzetta, pennoni
      const c = ent[Math.floor(ent.length / 2)], [ox, oz] = back[c], N = [nrm[c][0], 0, nrm[c][1]], R = [N[2], 0, -N[0]];
      const at = (u, v, w) => [ox + R[0] * u + N[0] * w, v + b0, oz + R[2] * u + N[2] * w];
      const { bx, bm, plaza } = frameOf(at, R, N);
      const wE = Math.hypot(outer[c][0] - ox, outer[c][1] - oz) + 0.7, PW = V.ENTRY_W + 16;
      bx(stn, 0, 0.18, 2.1, V.ENTRY_W - 2, 0.36, 6.2);
      bx(stn, 0, 0.12, 5.65, V.ENTRY_W - 2, 0.24, 0.9);
      bx(stn, 0, 0.06, 6.55, V.ENTRY_W - 2, 0.12, 0.9);
      for (let uu = -9; uu <= 9.01; uu += 2) { bx(drk, uu, 0.9, 3.4, 0.6, 1.1, 0.9); bx(stl, uu + 0.5, 1.25, 3.4, 0.5, 0.06, 0.06); }
      const pd = Math.min(wE + 16, st.facade === 'esplanade' ? esplanadeW(st) - 2 : Infinity);
      plaza(PW, 0, pd);
      for (const k of [-1, 1]) {
        const uu = k * (PW / 2 - 6.5);
        bm(stl, [uu, 0, pd - 2], [uu, 14, pd - 2], 0.25);
        bx(fr, uu + k * 1.6, 12.6, pd - 2, 3, 2, 0.06);
      }
    }
    const instL = (mat, list, geo = box, into = group) => {
      if (!list.length) return;
      const m = new THREE.InstancedMesh(geo, mat, list.length / 16);
      m.instanceMatrix.array.set(list); m.instanceMatrix.needsUpdate = true;
      m.frustumCulled = false; m.castShadow = m.receiveShadow = true;
      into.add(m); own.push(m);
    };
    instL(frameMat, fr); instL(stoneMat, stn); instL(dark, drk); instL(steel, stl); instL(lamp, lmp); instL(ledMat, led); instL(leafMat, leaf, ico);
    // l'insegna si vede solo se c'è il logo da metterci sopra (setLogo)
    const plates = new THREE.Group();
    plates.visible = false;
    instL(frameMat, plateFr, box, plates); instL(ledMat, plateLed, box, plates);
    group.add(plates);
    for (const eg of extra) { const m = new THREE.Mesh(eg, stoneMat); m.castShadow = m.receiveShadow = true; group.add(m); own.push(eg); }
    for (const [pos, uv, mat] of [[gpos, guv, entGlass], [ppos, puv, paveMat], ...panels.map(pm => [pm.pos, pm.uv, pm.mat])]) {
      if (!pos.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat);
      m.receiveShadow = true;
      group.add(m); own.push(g);
    }
    entrance = { frameMat, stoneMat, ledMat, paveMat, plates, panels };
  }
  if (bandPos.length) {
    // fasce orizzontali dei piani sulle vetrate
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(bandPos, 3));
    g.setIndex(bandIdx[0]);
    g.computeVertexNormals();
    group.add(new THREE.Mesh(g, structMat));
    own.push(g);
  }
  if (glowPos.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(glowPos, 3));
    g.setIndex(glowIdx.flat());
    g.computeVertexNormals();
    group.add(new THREE.Mesh(g, glowMat));
    own.push(g);
  }
  inst(stoneDark, towerCores, cylinder);
  inst(stoneLight, towerCaps, cylinder);
  inst(steel, drums, cylinder);
  for (const [surf, mat] of [[ramps, stoneLight], [wedges, girderMat]]) {
    const g = surf.geometry(THREE);
    if (!g) continue;
    const m = new THREE.Mesh(g, mat);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    own.push(g);
  }
  inst(girderMat, girderBeams);
  inst([steel, steel, steel, steel, lamp, steel], lamps); // la faccia +z del proiettore è quella accesa

  return { group, steel, deckMat, shellMat, lamp, accent, dark, girder: girderMat, spots, screen, roofDecor, glow: glowMat, nightGlow, repaint, tints, badge, wallMat, panelSkinMat, stoneLight, stoneDark, tentGlass, entrance };
}

/* --------------------------------------------------------------- scena */
/** Costruisce lo stadio (geometria): i colori si applicano poi con recolor(). */
function buildStadium(L, st) {
  const { THREE } = L;
  const shape = shapeOf(st);
  const group = new THREE.Group();
  const reach = reachOf(shape, st);
  const ext = { x: Math.max(shape.a + reach.d + 2, reach.x), z: Math.max(shape.b + reach.d + 2, reach.z) };
  const own = []; // geometrie, materiali e texture da liberare
  const detail = new THREE.CanvasTexture(grassDetailCanvas());
  detail.wrapS = detail.wrapT = THREE.RepeatWrapping;
  own.push(detail);

  // spalti
  const mats = [0, 1, 2].map(() => new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide }));
  // palchi: vetri scuri con le luci accese dentro
  mats.push(new THREE.MeshStandardMaterial({ color: 0x27313d, roughness: 0.2, metalness: 0.3, emissive: 0xffe2b0, emissiveIntensity: 0.12, side: THREE.DoubleSide }));
  // cemento vero (macchie, colature, grana) su parapetti, gradoni e muri, in coordinate del mondo
  const standTex = new THREE.CanvasTexture(stoneTexture().canvas);
  standTex.wrapS = standTex.wrapT = THREE.RepeatWrapping; standTex.anisotropy = 4;
  for (const m of [mats[M_PARAPET], mats[M_STEPS], mats[M_STRUCT]]) triplanar(m, standTex, 0.22);
  own.push(standTex);
  const stands = new THREE.Mesh(standsGeometry(THREE, shape, st.facade === 'struts', st.boxes), mats);
  stands.castShadow = stands.receiveShadow = true;
  group.add(stands);
  own.push(stands.geometry, ...mats);

  // seggiolini
  const seats = seatsOf(st);
  const seatMat = new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide });
  const seatMesh = new THREE.InstancedMesh(seatGeometry(THREE), seatMat, Math.max(1, seats.count));
  seatMesh.count = seats.count;
  seatMesh.instanceMatrix.array.set(seats.matrices);
  seatMesh.instanceMatrix.needsUpdate = true;
  seatMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, seats.count) * 3), 3);
  seatMesh.frustumCulled = false;
  seatMesh.receiveShadow = true;
  group.add(seatMesh);
  own.push(seatMesh.geometry, seatMat);

  // scalette: una lastra del colore scelto su ogni corridoio, dal basso alla cima di ogni anello
  const aisleMat = new THREE.MeshStandardMaterial({ roughness: 0.85 }), aisleBox = new THREE.BoxGeometry(1, 1, 1), aisles = [];
  for (const run of shape.runs) {
    const cum = runLengths(run), total = cum[cum.length - 1], count = Math.max(1, Math.round(total / AISLE_EVERY));
    const at = Array.from({ length: run.closed ? count : count + 1 }, (_, k) => k * total / count);
    for (const t of run.tiers) {
      for (const u of at) {
        const uu = Math.min(u, total - 0.01), [x0, z0] = pointAt(run, cum, uu, t.D + 0.4), [x1, z1] = pointAt(run, cum, uu, t.back - 0.1);
        const [tx, tz] = tangentAt(run, cum, uu, t.D);
        slab(aisles, x0, t.H + 0.04, z0, x1, t.top + t.R * 0.5 + 0.04, z1, tx, tz, AISLE_HALF * 1.6, 0.12);
        // file in più dell'ultimo anello: la scaletta continua, più ripida
        if (run.E && t === run.tiers[run.tiers.length - 1]) {
          const k = Math.max(0, cum.findIndex(c => c > uu) - 1), e = Math.floor(Math.min(run.ext[k], run.ext[(k + 1) % run.pts.length]));
          if (e > 0) {
            const [x2, z2] = pointAt(run, cum, uu, t.back + e * TREAD - 0.1);
            slab(aisles, x1, t.top + t.R * 0.5 + 0.04, z1, x2, t.top + e * t.Rx + t.Rx * 0.5 + 0.04, z2, tx, tz, AISLE_HALF * 1.6, 0.12);
          }
        }
      }
    }
  }
  if (aisles.length) {
    const m = new THREE.InstancedMesh(aisleBox, aisleMat, aisles.length / 16);
    m.instanceMatrix.array.set(aisles);
    m.instanceMatrix.needsUpdate = true;
    m.frustumCulled = false;
    m.receiveShadow = true;
    group.add(m);
    own.push(m);
  }
  own.push(aisleMat, aisleBox);

  // vomitori: apertura scura che scende negli spalti, muretti ai lati e parapetto davanti, del colore dei parapetti
  if (st.vomitories) {
    const holes = [], walls = [];
    for (const run of shape.runs) {
      const cum = runLengths(run), total = cum[cum.length - 1], count = Math.max(1, Math.round(total / AISLE_EVERY));
      for (const t of run.tiers) {
        const vr = vomRows(t);
        if (!vr) continue;
        for (const u of vomitoryUs(run, total, count)) {
          const d0 = t.D + vr[0] * TREAD + 0.1, d1 = t.D + vr[1] * TREAD - 0.1, y0 = t.H + vr[0] * t.R, y1 = t.H + (vr[1] - 1) * t.R;
          const [x0, z0] = pointAt(run, cum, u, d0), [x1, z1] = pointAt(run, cum, u, d1), [tx, tz] = tangentAt(run, cum, u, d0);
          slab(holes, x0, y0 - 0.2, z0, x1, y1 + 0.1, z1, tx, tz, VOM_HALF * 2 - 0.2, 0.25);
          for (const sg of [-1, 1]) {
            const ox = tx * sg * (VOM_HALF - 0.1), oz = tz * sg * (VOM_HALF - 0.1);
            slab(walls, x0 + ox, y0 + 0.3, z0 + oz, x1 + ox, y1 + 0.6, z1 + oz, tx, tz, 0.25, 1.3);
          }
          const nx = (x1 - x0) / (Math.hypot(x1 - x0, z1 - z0) || 1), nz = (z1 - z0) / (Math.hypot(x1 - x0, z1 - z0) || 1);
          slab(walls, x0 - tx * VOM_HALF, y0 + 0.75, z0 - tz * VOM_HALF, x0 + tx * VOM_HALF, y0 + 0.75, z0 + tz * VOM_HALF, nx, nz, 0.25, 1.1);
        }
      }
    }
    const holeMat = new THREE.MeshStandardMaterial({ color: 0x15181d, roughness: 0.95 });
    own.push(holeMat);
    for (const [list, mat] of [[holes, holeMat], [walls, mats[M_PARAPET]]]) {
      if (!list.length) continue;
      const m = new THREE.InstancedMesh(aisleBox, mat, list.length / 16);
      m.instanceMatrix.array.set(list);
      m.instanceMatrix.needsUpdate = true;
      m.frustumCulled = false;
      m.castShadow = m.receiveShadow = true;
      group.add(m);
      own.push(m);
    }
  }

  // pavimenti: piazzale fuori (anche sotto gli spalti), pavimento dentro intorno al campo, pista con le corsie; texture
  // vere in metri, tinte col colore scelto (si cambiano senza ricostruire lo stadio)
  const floorMaps = new Map(), floorMap = (kind) => {
    if (!floorMaps.has(kind)) {
      const T = floorTexture(kind), a = new THREE.CanvasTexture(T.canvas), b = new THREE.CanvasTexture(T.normal);
      for (const t of [a, b]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
      a.colorSpace = THREE.SRGBColorSpace;
      for (const t of [a, b]) t.repeat.set(1 / T.tileU, 1 / T.tileV);
      floorMaps.set(kind, { map: a, normalMap: b, tile: T.tileU });
      own.push(a, b);
    }
    return floorMaps.get(kind);
  };
  const ringAt = (d) => shape.path.map(p => [p.x + p.mx * d, p.z + p.mz * d]);
  // UV in metri (tile 1): la ripetizione della texture si regola con repeat
  const groundMat = new THREE.MeshStandardMaterial({ roughness: 0.95 });
  const ground = new THREE.Mesh(floorGeometry(THREE, ringAt(reach.d), 0, 1), groundMat);
  ground.receiveShadow = true;
  const innerMat = new THREE.MeshStandardMaterial({ roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -0.5, polygonOffsetUnits: -0.5 });
  const inner = new THREE.Mesh(floorGeometry(THREE, ringAt(0.05), 0.012, 1), innerMat);
  inner.receiveShadow = true;
  group.add(ground, inner);
  own.push(ground.geometry, groundMat, inner.geometry, innerMat);
  let trackMat = null, lineMat = null;
  if (st.track) {
    const outerR = TRACK.r + TRACK.lanes * TRACK.lane;
    trackMat = new THREE.MeshStandardMaterial({ roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    lineMat = new THREE.MeshStandardMaterial({ roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1.5, polygonOffsetUnits: -1.5 });
    const tg = trackRing(THREE, TRACK.r - 0.3, outerR + 0.6, 360, 0.025, 1), trk = new THREE.Mesh(tg, trackMat);
    trk.receiveShadow = true;
    const lpos = [], lidx = [];
    for (let k = 0; k <= TRACK.lanes; k++) {
      const g = trackRing(THREE, TRACK.r + k * TRACK.lane - 0.025, TRACK.r + k * TRACK.lane + 0.025, 360, 0.03, 1);
      const b = lpos.length / 3;
      lpos.push(...g.getAttribute('position').array);
      lidx.push(...Array.from(g.getIndex().array, i => i + b));
      g.dispose();
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lpos, 3));
    lg.setIndex(lidx);
    lg.computeVertexNormals();
    const lines = new THREE.Mesh(lg, lineMat);
    lines.receiveShadow = true;
    group.add(trk, lines);
    own.push(tg, trackMat, lg, lineMat);
  }
  /** Mette la texture del tipo scelto, con le ripetizioni giuste (UV in metri), e il colore. */
  const setFloor = (mat, kind, color, scale = 1) => {
    const f = floorMap(kind);
    if (mat.map !== f.map) { mat.map = f.map; mat.normalMap = f.normalMap; mat.needsUpdate = true; }
    mat.color.set(color);
    mat.normalScale.set(scale, scale);
  };

  // campo
  const pitchCanvas = document.createElement('canvas');
  pitchCanvas.width = 2048; pitchCanvas.height = Math.round(2048 * (PITCH.w + PITCH_PAD * 2) / (PITCH.l + PITCH_PAD * 2));
  const pitchTex = new THREE.CanvasTexture(pitchCanvas);
  pitchTex.colorSpace = THREE.SRGBColorSpace;
  const pitchGeo = new THREE.PlaneGeometry(PITCH.l + PITCH_PAD * 2, PITCH.w + PITCH_PAD * 2).rotateX(-Math.PI / 2);
  const pitchMat = new THREE.MeshStandardMaterial({ map: pitchTex, alphaTest: 0.5, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  addDetail(THREE, pitchMat, detail, new THREE.Vector2((PITCH.l + PITCH_PAD * 2) / 2.5, (PITCH.w + PITCH_PAD * 2) / 2.5), 0.32);
  const pitch = new THREE.Mesh(pitchGeo, pitchMat);
  pitch.position.y = 0.05;
  pitch.receiveShadow = true;
  group.add(pitch);
  own.push(pitchGeo, pitchMat, pitchTex);

  // porte
  const goalMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const post = new THREE.BoxGeometry(0.12, 2.44, 0.12), bar = new THREE.BoxGeometry(0.12, 0.12, 7.44);
  own.push(goalMat, post, bar);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) { const m = new THREE.Mesh(post, goalMat); m.position.set(sx * PITCH.l / 2, 1.22, sz * 3.72); m.castShadow = true; group.add(m); }
    const m = new THREE.Mesh(bar, goalMat); m.position.set(sx * PITCH.l / 2, 2.44, 0); m.castShadow = true; group.add(m);
  }

  // cartelloni LED a bordo campo e, volendo, sul fronte degli anelli più alti: una tela con il nome che si ripete
  let adsCanvas = null, adsTex = null, adsMat = null;
  if (st.adBoards !== 'none') {
    const AD_TILE = 24; // metri coperti da una ripetizione della tela
    adsCanvas = document.createElement('canvas'); adsCanvas.width = 2048; adsCanvas.height = 96;
    adsTex = new THREE.CanvasTexture(adsCanvas);
    adsTex.wrapS = THREE.RepeatWrapping; adsTex.colorSpace = THREE.SRGBColorSpace; adsTex.anisotropy = 8;
    adsMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffffff, emissiveMap: adsTex, emissiveIntensity: 0.85, roughness: 0.4, side: THREE.DoubleSide });
    const backMat = new THREE.MeshStandardMaterial({ color: 0x1b1e23, roughness: 0.7 });
    own.push(adsTex, adsMat, backMat);
    const pos = [], uv = [], idx = [];
    const quad = (a, b, c, d, u0, u1) => {
      const k = pos.length / 3;
      pos.push(...a, ...b, ...c, ...d); uv.push(u0, 0, u1, 0, u1, 1, u0, 1);
      idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
    };
    // bordo campo: lati lunghi e dietro le porte, alti 0,95 m e appena inclinati all'indietro
    const L2 = PITCH.l / 2, W2 = PITCH.w / 2, sideZ = W2 + (st.track ? 1.8 : 4.2), endX = L2 + 5, Hb = 0.95, lean = 0.15;
    const segs = [[[-L2 - 2, sideZ], [L2 + 2, sideZ], [0, 1]], [[L2 + 2, -sideZ], [-L2 - 2, -sideZ], [0, -1]],
      [[endX, sideZ - 3], [endX, -sideZ + 3], [1, 0]], [[-endX, -sideZ + 3], [-endX, sideZ - 3], [-1, 0]]];
    for (const [[x0, z0], [x1, z1], [nx, nz]] of segs) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      quad([x0, 0.05, z0], [x1, 0.05, z1], [x1 + nx * lean, Hb, z1 + nz * lean], [x0 + nx * lean, Hb, z0 + nz * lean], 0, len / AD_TILE);
      const back = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), backMat);
      back.scale.set(Math.abs(x1 - x0) || 0.3, Hb, Math.abs(z1 - z0) || 0.3);
      back.position.set((x0 + x1) / 2 + nx * 0.25, Hb / 2, (z0 + z1) / 2 + nz * 0.25);
      back.castShadow = true;
      group.add(back);
      own.push(back.geometry);
    }
    if (st.adBoards === 'both') {
      // fascia LED sul parapetto davanti agli anelli più alti
      for (const run of shape.runs) {
        const P = run.closed ? [...run.pts, run.pts[0]] : run.pts;
        for (const t of run.tiers) {
          if (t.i === 0) continue;
          const d = t.D - 0.03, y0 = t.H - 1.35, y1 = t.H - 0.35;
          let u = 0;
          for (let i = 0; i < P.length - 1; i++) {
            const a = [P[i].x + P[i].mx * d, P[i].z + P[i].mz * d], b = [P[i + 1].x + P[i + 1].mx * d, P[i + 1].z + P[i + 1].mz * d];
            const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
            if (l < 1e-6) continue;
            quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], u / AD_TILE, (u + l) / AD_TILE);
            u += l;
          }
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    group.add(new THREE.Mesh(g, adsMat));
    own.push(g);
  }

  // copertura, fari ed esterno; di notte si accendono i proiettori e le luci sul campo
  const outside = buildExterior(THREE, shape, st, mats[M_STRUCT], mats[M_PARAPET], own);
  group.add(outside.group);
  const nightLights = outside.spots.map(([x, y, z]) => {
    const l = new THREE.SpotLight(0xfff6e6, 1.1, 0, Math.PI / 3.2, 0.7, 0);
    l.position.set(x, y, z);
    l.visible = false;
    group.add(l, l.target);
    return l;
  });

  // logo della squadra nei posti scelti: compare quando la tela è pronta (setLogo)
  const spots = logoSpots(shape, st), lpos = [], luv = [], lidx = [];
  spots.forEach((sp, i) => {
    sp.pts.forEach(q => lpos.push(...q));
    luv.push(0, 0, 1, 0, 1, 1, 0, 1);
    lidx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
  });
  const logoGeo = new THREE.BufferGeometry();
  logoGeo.setAttribute('position', new THREE.Float32BufferAttribute(lpos, 3));
  logoGeo.setAttribute('uv', new THREE.Float32BufferAttribute(luv, 2));
  logoGeo.setIndex(lidx);
  logoGeo.computeVertexNormals();
  const logoMat = new THREE.MeshStandardMaterial({
    transparent: true, alphaTest: 0.05, roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0.12, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3
  });
  const logoMesh = new THREE.Mesh(logoGeo, logoMat);
  logoMesh.visible = false;
  group.add(logoMesh);
  own.push(logoGeo, logoMat);
  let logoSrc = null, logoTex = null;

  // immagine dei pannelli degli ingressi: quella personale (tela) o il pannello col nome dello stadio
  let entImg = null, entName = 'FANTACAZZ', entColor = '#1e5bb8', entFit = 'fill';
  const applyEntranceImage = () => {
    if (!outside.entrance) return;
    const fit = !!entImg && entFit === 'fit';
    const key = entImg ? (fit ? `fit|${entColor}` : 'fill') : `${entName}|${entColor}`;
    // un pannello per forma (ingressi, schermi del Vélodrome): ognuno col suo taglio
    for (const E of outside.entrance.panels) {
      if (key === E.key && E.shown === entImg) continue;
      E.key = key; E.shown = entImg;
      if (!entImg) paintEntranceDefault(E.canvas, entName, entColor, E.aspect);
      else if (fit) paintEntranceFit(E.canvas, entImg, entColor, E.aspect);
      const src = entImg && !fit ? entImg : E.canvas, tex = new THREE.CanvasTexture(src);
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      // "riempie": l'immagine copre il pannello senza deformarsi (si taglia quello che avanza)
      const ia = src.width / src.height;
      if (src === entImg && ia > E.aspect) { tex.repeat.set(E.aspect / ia, 1); tex.offset.set((1 - E.aspect / ia) / 2, 0); }
      else if (src === entImg) { tex.repeat.set(1, ia / E.aspect); tex.offset.set(0, (1 - ia / E.aspect) / 2); }
      E.tex.dispose();
      E.tex = tex;
      E.mat.map = E.mat.emissiveMap = tex;
      E.mat.needsUpdate = true;
    }
  };
  let adsKey = '', paintKey = '', seatColorKey = '', signKey = '', screenKey = '', sign = null, night = false;
  return {
    key: geomKey(st), group, shape, ext, height: reach.h, capacity: seats.count,
    setNight(on) {
      night = on;
      if (sign) sign.glow(on); // la scritta si accende
      outside.lamp.emissiveIntensity = on ? 5 : 0.6;
      if (outside.shellMat) outside.shellMat.emissiveIntensity = on ? 0.85 : 0; // l'involucro si accende
      outside.nightGlow.forEach(([m, day, nightOn]) => { m.emissiveIntensity = on ? nightOn : day; });
      logoMat.emissiveIntensity = on ? 0.7 : 0.12;
      if (adsMat) adsMat.emissiveIntensity = on ? 1.3 : 0.85;
      nightLights.forEach(l => { l.visible = on; });
    },
    recolor(s) {
      const c = s.colors;
      outside.steel.color.set(c.steel);
      if (outside.wallMat) outside.wallMat.color.set(c.wall || c.structure);
      if (outside.panelSkinMat) outside.panelSkinMat.color.set(c.accent);
      outside.accent.color.set(c.accent);
      outside.dark.color.set(shade(c.structure, 0.62));
      outside.stoneLight.color.set(c.parapet);
      outside.stoneDark.color.set(shade(c.structure, 0.62));
      outside.girder.color.set(c.girder);
      if (outside.deckMat) outside.deckMat.color.set(c.roof);
      outside.glow.color.set(c.glow); outside.glow.emissive.set(c.glow);
      outside.tints.forEach(([m, k]) => m.color.set(c[k]));
      outside.repaint.forEach(f => f(s));
      if (outside.roofDecor) {
        if (outside.roofDecor.tubes) outside.roofDecor.tubes.color.set(c.steel);
        if (outside.roofDecor.band) outside.roofDecor.band.color.set(c.roof);
        if (outside.roofDecor.floor) outside.roofDecor.floor.color.set(shade(c.structure, 0.85));
      }
      if (outside.shellMat) { outside.shellMat.color.set(c.roof); if (SHELLISH.includes(s.roof)) outside.shellMat.emissive.set(c.glow); }
      // luce di notte delle altre coperture (colore scelto o quello della copertura)
      const roofLight = ROOF_GLOWS[s.roof] ? (c.roofLight || ROOF_GLOWS[s.roof]) : null;
      if (roofLight && outside.shellMat && s.roof !== 'blades') outside.shellMat.emissive.set(roofLight);
      if (roofLight && s.roof === 'blades' && outside.roofDecor && outside.roofDecor.band) outside.roofDecor.band.emissive.set(roofLight);
      if (outside.tentGlass) outside.tentGlass.emissive.set(c.glow);
      if (outside.entrance) {
        outside.entrance.frameMat.color.set(c.entrance);
        outside.entrance.stoneMat.color.set(c.entranceStone); outside.entrance.stoneMat.emissive.set(c.entranceStone);
        outside.entrance.frameMat.emissive.set(c.entrance);
        outside.entrance.paveMat.color.set(shade(c.entranceStone, 0.86));
        const ledCol = new THREE.Color(c.entrance).lerp(new THREE.Color(0xffffff), 0.3);
        outside.entrance.ledMat.color.copy(ledCol); outside.entrance.ledMat.emissive.copy(ledCol);
        entName = (s.name.trim() || 'FANTACAZZ').toUpperCase(); entColor = c.entrance; entFit = s.entranceImageFit;
        applyEntranceImage();
      }
      // scritta sull'esterno: si ricostruisce solo se cambiano testo o colore
      const sgk = [s.outerText.trim(), c.outerText, c.outerPanel, s.outerTextFont, s.outerTextStyle, s.outerTextSize, s.outerTextPlace].join('|');
      if (sgk !== signKey) {
        signKey = sgk;
        if (sign) { group.remove(sign.mesh); sign.dispose(); sign = null; }
        if (s.outerText.trim()) {
          sign = buildSign(THREE, shape, s, s.outerText.trim(), c.outerText, c.outerPanel);
          sign.glow(night);
          group.add(sign.mesh);
        }
      }
      // maxischermo: nome dello stadio e colore
      const scr = outside.screen, sck = s.name.trim() + '|' + c.screen;
      if (scr && sck !== screenKey) {
        screenKey = sck;
        paintScreen(scr.canvas, scr.kind, (s.name.trim() || 'FANTACAZZ').toUpperCase(), c.screen);
        scr.tex.needsUpdate = true;
      }
      aisleMat.color.set(c.aisle);
      mats[M_PARAPET].color.set(c.parapet);
      mats[M_STEPS].color.set(shade(c.structure, 1.12));
      mats[M_STRUCT].color.set(shade(c.structure, 0.82));
      const pk = [c.grass, s.mowing, s.apronStyle, s.track ? 1 : 0].join('|');
      if (pk !== paintKey) {
        paintKey = pk;
        paintPitch(pitchCanvas, s); pitchTex.needsUpdate = true;
      }
      // cartelloni LED
      const ak = s.name.trim() + '|' + c.ads;
      if (adsCanvas && ak !== adsKey) { adsKey = ak; paintAds(adsCanvas, (s.name.trim() || 'FANTACAZZ').toUpperCase(), c.ads); adsTex.needsUpdate = true; }
      // pavimenti
      const groundAuto = { grass: shade(c.grass, 0.92), asphalt: '#6a6e73', cobbles: '#8f8a84' }[s.groundStyle] || shade(c.structure, 0.95);
      setFloor(groundMat, s.groundStyle, c.ground || groundAuto);
      const apron = s.apronStyle;
      setFloor(innerMat, { tartan: 'tartan', color: 'resin', concrete: 'concrete', grass: 'grass' }[apron],
        { tartan: c.track, color: c.apron, concrete: shade(c.structure, 1.05), grass: shade(c.grass, 0.95) }[apron]);
      if (trackMat) { setFloor(trackMat, 'tartan', c.track); lineMat.color.set(c.trackLines); }
      const sk = JSON.stringify([s.seatMode, c.seatA, c.seatB, c.seatC, c.seatD, c.mosaicB, c.mosaicC, c.mosaicD, s.seatGrid, s.seatMosaic, s.standText, s.standTextSide, s.standTextRing, s.standTextFont, c.standText]);
      if (sk !== seatColorKey) {
        seatColorKey = sk;
        // tavolozza: 0-3 colori A-D, 4-15 settore e anello (lato * 3 + anello); ognuno con le varianti per il mosaico
        const white = new THREE.Color(1, 1, 1);
        const pal = [c.seatA, c.seatB, c.seatC, c.seatD];
        for (let side = 0; side < 4; side++) for (let r = 0; r < 3; r++) pal.push(s.seatGrid[gridKey(side, r)]);
        const mixB = new THREE.Color(c.mosaicB), mixC = new THREE.Color(c.mosaicC), mixD = c.mosaicD ? new THREE.Color(c.mosaicD) : null;
        const base = pal.map(h => new THREE.Color(h));
        const dark = base.map(col => col.clone().multiplyScalar(0.68)), light = base.map(col => col.clone().lerp(white, 0.42));
        const txt = new THREE.Color(c.standText), mask = standTextMask(seats, s);
        const arr = seatMesh.instanceColor.array, info = seats.info;
        for (let i = 0; i < seats.count; i++) {
          let k = 0;
          const h = (Math.imul(i + 1, 2654435761) >>> 0) / 4294967296;
          if (s.seatMode === 'sectors') k = info[i] & 1;
          else if (s.seatMode === 'rings') k = (info[i] >> 1) & 3;
          else if (s.seatMode === 'sides') k = info[i] >> 3;
          else if (s.seatMode === 'grid') k = 4 + (info[i] >> 3) * 3 + ((info[i] >> 1) & 3);
          // effetto mosaico sopra la colorazione: sfumature del colore del settore o altri due colori sparsi
          let col = base[k];
          if (s.seatMosaic === 'shades') col = h < 0.58 ? base[k] : h < 0.84 ? dark[k] : light[k];
          else if (s.seatMosaic === 'mix') col = mixD ? (h < 0.5 ? base[k] : h < 0.72 ? mixB : h < 0.87 ? mixC : mixD) : h < 0.6 ? base[k] : h < 0.88 ? mixB : mixC;
          if (mask && mask[i]) col = txt;
          arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b;
        }
        seatMesh.instanceColor.needsUpdate = true;
      }
    },
    /** Logo della squadra (tela di stadiumLogo, null = nessuno): al posto dello stemma con le iniziali sull'ingresso. */
    setLogo(c) {
      if (c === logoSrc) return;
      logoSrc = c;
      if (logoTex) { logoTex.dispose(); logoTex = null; }
      if (c) { logoTex = new THREE.CanvasTexture(c); logoTex.colorSpace = THREE.SRGBColorSpace; logoTex.anisotropy = 8; }
      logoMat.map = logoMat.emissiveMap = logoTex;
      logoMat.needsUpdate = true;
      logoMesh.visible = !!logoTex && spots.length > 0;
      if (outside.badge) outside.badge.visible = !(logoTex && spots.some(sp => sp.place === 'entrance'));
      if (outside.entrance) outside.entrance.plates.visible = !!logoTex && spots.some(sp => sp.place === 'entrance');
    },
    /** Immagine personale degli ingressi (tela di entranceImageCanvas, null = pannello col nome dello stadio). */
    setEntranceImage(c) {
      entImg = c || null;
      applyEntranceImage();
    },
    dispose() { own.forEach(o => o.dispose()); seatMesh.dispose(); if (sign) sign.dispose(); if (logoTex) logoTex.dispose(); if (outside.entrance) outside.entrance.panels.forEach(E => E.tex.dispose()); }
  };
}

// inquadrature: [rotazione orizzontale, inclinazione dalla verticale, distanza relativa]
const VIEWS = { aerial: [35, 56, 1], top: [0, 1, 0.92], stand: [0, 66, 1], outside: [28, 83, 0.62] };
const FOV = 35, STAND_FOV = 58;

class Stage {
  constructor(L, canvas, { interactive = false, zoom = false, width = 800, height = 480 } = {}) {
    const { THREE } = L;
    this.L = L;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(interactive ? Math.min(window.devicePixelRatio || 1, 2) : 1);
    this.renderer.setSize(width, height, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new L.RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environmentIntensity = 0.3;
    this.hemi = new THREE.HemisphereLight(0xe8eeff, 0x5a564c, 0.45);
    this.scene.add(this.hemi);
    this.night = false;
    // sole: le ombre degli spalti sul campo danno profondità
    this.sun = new THREE.DirectionalLight(0xfff4e0, 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.08;
    this.scene.add(this.sun, this.sun.target);
    // luce di riempimento dal lato opposto al sole (senza ombre): i lati in ombra mostrano comunque i rilievi
    this.fill = new THREE.DirectionalLight(0xdce6ff, 0.75);
    this.scene.add(this.fill);

    this.camera = new THREE.PerspectiveCamera(FOV, width / height, 1, 5000);
    this.view = 'aerial';
    this.dist = 300;
    this.target = new THREE.Vector3();

    if (interactive) {
      const c = new L.OrbitControls(this.camera, canvas);
      if (zoom) {
        // vista ingrandita: zoom (due dita / rotella), spostamento e rotazione in ogni direzione
        c.enablePan = true; c.screenSpacePanning = true; c.enableZoom = true;
        c.minPolarAngle = 0.02; c.maxPolarAngle = THREE.MathUtils.degToRad(82);
        c.enableDamping = true; c.dampingFactor = .12;
        const loop = () => { if (this.controls) { if (c.update()) this.render(); this._raf = requestAnimationFrame(loop); } };
        this._raf = requestAnimationFrame(loop);
      } else {
        c.enablePan = false; c.enableZoom = false; // solo rotazione orizzontale: il dito in verticale scorre la pagina
      }
      c.addEventListener('change', () => this.render());
      this.controls = c;
      this.zoom = zoom;
    }
  }

  /** Mostra lo stadio: ricostruisce la geometria solo se cambia la struttura, altrimenti cambia i colori (logo: tela o null). */
  setStadium(st, logo = null, entranceImg = null) {
    if (!this.built || this.built.key !== geomKey(st)) {
      if (this.built) { this.scene.remove(this.built.group); this.built.dispose(); }
      this.built = buildStadium(this.L, st);
      this.built.setNight(this.night);
      this.scene.add(this.built.group);
      this.fit();
    }
    this.built.recolor(st);
    this.built.setLogo(logo);
    this.built.setEntranceImage(entranceImg);
    return this.built.capacity;
  }

  /** Notte: sole spento, luce del cielo al minimo, proiettori accesi che illuminano campo e spalti. */
  setNight(on) {
    this.night = !!on;
    this.scene.environmentIntensity = on ? 0.04 : 0.3;
    this.hemi.intensity = on ? 0.07 : 0.45;
    this.sun.intensity = on ? 0 : 2;
    this.fill.intensity = on ? 0 : 0.75;
    this.sun.castShadow = !on;
    if (this.built) this.built.setNight(this.night);
  }

  /** Distanza della camera e ombre adatte alla dimensione dello stadio. */
  fit() {
    const { THREE } = this.L;
    const e = this.built.ext, h = this.built.height;
    const R = Math.hypot(e.x, e.z);
    const vf = THREE.MathUtils.degToRad(FOV / 2);
    const hf = Math.atan(Math.tan(vf) * this.camera.aspect);
    this.dist = R / Math.sin(Math.min(vf, hf)) * 0.86;
    this.target.set(0, h * 0.12, 0);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -R; sc.right = sc.top = R; sc.near = 1; sc.far = R * 4;
    sc.updateProjectionMatrix();
    this.sun.position.set(-0.6, 0.55, 0.45).normalize().multiplyScalar(R * 2);
    this.fill.position.set(0.65, 0.4, -0.55).normalize().multiplyScalar(R * 2);
    if (this.controls) {
      this.controls.minDistance = this.dist * 0.12;
      this.controls.maxDistance = this.dist * 1.5;
    }
    this.setView(this.view);
  }

  setView(name) {
    const { THREE } = this.L;
    this.view = VIEWS[name] ? name : 'aerial';
    const [yaw, polar, f] = VIEWS[this.view];
    const sph = new THREE.Spherical(this.dist * f, THREE.MathUtils.degToRad(polar), THREE.MathUtils.degToRad(yaw));
    let target = this.target;
    if (this.view === 'stand') {
      // tribuna: la camera sta sopra il primo anello del lato lungo (davanti a quelli superiori), non fuori dallo stadio,
      // e guarda gli spalti di fronte con un obiettivo più largo (si vedono anche tetto e fari)
      const { b, tiers } = this.built.shape;
      target = new THREE.Vector3(0, this.built.height * 0.28, 0);
      const horiz = b + tiers[0].back * 0.45, up = tiers[0].top + 6 - target.y;
      sph.set(Math.hypot(horiz, up), Math.atan2(horiz, up), 0);
    }
    if (this.view === 'outside') {
      // esterno: dalla strada, guardando la facciata e il tetto
      target = new THREE.Vector3(0, this.built.height * 0.45, 0);
      sph.radius = Math.hypot(this.built.ext.x, this.built.ext.z) * 1.25;
    }
    const fov = this.view === 'stand' || this.view === 'outside' ? STAND_FOV : FOV;
    if (this.camera.fov !== fov) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    this.camera.position.setFromSpherical(sph).add(target);
    this.camera.lookAt(target);
    if (this.controls) {
      if (!this.zoom) this.controls.minPolarAngle = this.controls.maxPolarAngle = sph.phi;
      // i limiti di distanza non devono spostare la camera (la tribuna è più vicina del minimo pensato per le viste dall'alto)
      this.controls.minDistance = Math.min(this.dist * 0.12, sph.radius * 0.95);
      this.controls.maxDistance = Math.max(this.dist * 1.5, sph.radius * 1.05);
      this.controls.target.copy(target);
      this.controls.update();
    }
  }

  /** Avvicina (f < 1) o allontana (f > 1) la camera dal punto guardato, nei limiti dei controlli. */
  zoomBy(f) {
    if (!this.controls) return;
    const c = this.controls, v = this.camera.position.clone().sub(c.target);
    const len = Math.min(c.maxDistance, Math.max(c.minDistance, v.length() * f));
    this.camera.position.copy(c.target).add(v.setLength(len));
    c.update(); this.render();
  }

  resize(width, height) {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (this.built) this.fit();
  }

  render() { this.renderer.render(this.scene, this.camera); }

  dispose() {
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this.controls) this.controls.dispose();
    this.controls = null;
    if (this.built) this.built.dispose();
    if (this.scene.environment) this.scene.environment.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss(); // il contesto WebGL si libera subito (i telefoni ne tengono pochi)
  }
}

/**
 * Stadio 3D ruotabile dentro `container` (zoom: true = vista ingrandita con zoom e spostamento).
 * Restituisce { ready, update(stadium, { logo }) → capienza, setView('aerial'|'top'|'stand'|'outside'), setNight(on), zoomBy(f), dispose() }
 * (logo: indirizzo del logo della squadra, da mettere nei posti scelti in stadium.logoPlaces).
 */
export function createStadiumViewer(container, { zoom = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = `width:100%; height:100%; display:block; touch-action:${zoom ? 'none' : 'pan-y'}; cursor:grab;`;
  container.innerHTML = '';
  container.appendChild(canvas);
  let stage = null, disposed = false, night = false, token = 0;
  const ready = loadLib().then(L => {
    if (disposed) return null;
    const r = container.getBoundingClientRect();
    stage = new Stage(L, canvas, { interactive: true, zoom, width: Math.max(1, r.width), height: Math.max(1, r.height) });
    stage.setNight(night);
    return stage;
  });
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
    if (!stage || !stage.built) return;
    const r = container.getBoundingClientRect();
    if (r.width && r.height) { stage.resize(r.width, r.height); stage.render(); }
  }) : null;
  if (ro) ro.observe(container);

  return {
    ready,
    async update(st, { logo = '' } = {}) {
      const my = ++token, n = normalizeStadium(st);
      const [s, , lc, ec] = await Promise.all([ready, loadTextFonts(n), n.logoPlaces.length ? stadiumLogo(logo) : null,
        n.entrance !== 'none' || n.roof === 'wave' ? entranceImageCanvas(n.entranceImage) : null]);
      if (!s || disposed || my !== token) return 0;
      const capacity = s.setStadium(n, lc, ec);
      s.render();
      return capacity;
    },
    setView(view) {
      if (!stage || !stage.built) return;
      stage.setView(view);
      stage.render();
    },
    /** Giorno / notte (solo anteprima, non si salva). */
    setNight(on) {
      night = !!on;
      if (!stage) return;
      stage.setNight(night);
      if (stage.built) stage.render();
    },
    zoomBy(f) { if (stage) stage.zoomBy(f); },
    dispose() {
      disposed = true;
      if (ro) ro.disconnect();
      if (stage) stage.dispose();
    }
  };
}

/** PNG ritagliato attorno allo stadio (lo sfondo trasparente intorno non serve nelle miniature). */
function cropToContent(src) {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(src, 0, 0);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3] < 8) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return c.toDataURL('image/png');
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.03);
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(c.width - 1, x1 + pad); y1 = Math.min(c.height - 1, y1 + pad);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}

let shot = null; // palcoscenico unico per le foto (un solo contesto WebGL)
let queue = Promise.resolve();

/** Foto PNG dello stadio (data URL, sfondo trasparente, ritagliata). opts: { width (default 800), view, logo (indirizzo del logo) } */
export function renderStadiumImage(st, opts = {}) {
  const width = Math.round(opts.width || 800), height = Math.round(width * 0.6);
  const job = queue.then(async () => {
    const L = await loadLib();
    if (!shot) shot = new Stage(L, document.createElement('canvas'), { width, height });
    shot.resize(width, height);
    shot.setNight(false);
    const n = normalizeStadium(st);
    await loadTextFonts(n);
    shot.setStadium(n, n.logoPlaces.length ? await stadiumLogo(opts.logo) : null, n.entrance !== 'none' || n.roof === 'wave' ? await entranceImageCanvas(n.entranceImage) : null);
    shot.setView(opts.view || 'aerial');
    shot.render();
    return cropToContent(shot.renderer.domElement);
  }).catch(e => { console.error('Stadio 3D:', e); return ''; });
  queue = job;
  return job;
}
