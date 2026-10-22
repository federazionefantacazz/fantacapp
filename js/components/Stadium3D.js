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
  { id: 'crown',    label: 'Corona di vele piegate' }
];
/** Coperture che avvolgono tutto lo stadio con un'unica superficie (si estendono sempre tutto intorno). */
export const WRAP_ROOFS = ['shell', 'wave', 'dome', 'tent', 'petals', 'crown'];
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
  { id: 'panels',  label: 'Rivestimento a pannelli' }
];
export const TEXT_PLACES = [
  { id: 'facade', label: 'Sulla facciata' },
  { id: 'roof',   label: 'Sul fronte del tetto' }
];

const DEFAULT = {
  name: '', rings: 2, ringsEnds: 0, ringsSides: [0, 0, 0, 0], horseshoe: false, trackApron: false, track: false, shape: 'rounded', corners: 'closed', mowing: 'stripes', seatMode: 'single',
  roof: 'none', roofCover: 'all', roofSectors: [true, false, false, false], roofReach: 'normal', lights: 'towers', facade: 'wall', ramps: false, boxes: false, shellPattern: 'rhombus', screen: 'none',
  seatMosaic: 'none', standText: '', standTextSide: 'far', standTextRing: 1, standTextFont: 'black',
  outerText: '', outerTextFont: 'black', outerTextStyle: 'outline', outerTextSize: 'M', outerTextPlace: 'facade',
  colors: {
    grass: '#3d8b37', track: '#b4452f', seatA: '#1e5bb8', seatB: '#ffffff', seatC: '#c62828', seatD: '#ffd400', parapet: '#e6e6e6', structure: '#a5a5a5',
    roof: '#5b6169', steel: '#767d86', accent: '#1e5bb8', girder: '#c0392b', glow: '#e30613',
    standText: '#ffffff', outerText: '#1d3f8f', outerPanel: '#ffffff', screen: '#152c78', trackLines: '#ffffff',
    mosaicB: '#ffffff', mosaicC: '#9e9e9e', aisle: '#c4c7cb', apron: '#b24f3c'
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
    desc: 'Ovale con pista blu, due anelli a mosaico azzurro, tetto in lamiera retto da piloni a traliccio, cemento a vista e basamento bianco.',
    st: {
      rings: 2, track: true, shape: 'oval', corners: 'closed', mowing: 'stripes', seatMode: 'single', seatMosaic: 'mix', roof: 'truss', lights: 'roof', facade: 'struts',
      colors: { grass: '#3f8a35', track: '#1f5fbf', seatA: '#29a3e0', mosaicB: '#1565c0', mosaicC: '#ffffff', parapet: '#ececec', structure: '#b3b1ab', roof: '#a9aeb3', steel: '#858c93', accent: '#1f6fd1' }
    }
  },
  {
    id: 'sansiro', label: 'Stile San Siro',
    desc: 'Tre anelli con angoli arrotondati e un colore per lato, tetto chiaro a botti sotto le travi rosse sulle quattro torri, rampe a spirale e fasce orizzontali.',
    st: {
      rings: 3, track: false, shape: 'rounded', corners: 'closed', mowing: 'stripes', seatMode: 'sides', roof: 'girders', lights: 'roof', facade: 'bands', ramps: true,
      colors: {
        grass: '#2f8a3a', seatA: '#2b5fb4', seatB: '#e8792b', seatC: '#3a9a6a', seatD: '#c8423a', parapet: '#ebe8e2', structure: '#bdb9b0',
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
    desc: 'Due anelli di seggiolini chiari con parapetti blu, copertura bianca ondulata alta sopra le curve con il traliccio sotto, vetrate scure e schermi sopra le curve.',
    st: {
      rings: 2, track: false, shape: 'rounded', corners: 'closed', mowing: 'stripes', seatMode: 'single', seatMosaic: 'none', roof: 'wave', lights: 'roof', facade: 'glass', ramps: false, screen: 'ends',
      colors: {
        grass: '#2f8b3b', seatA: '#e6ebf0', parapet: '#25418f', structure: '#c3c7cc', roof: '#f5f7f9', steel: '#7d848c', screen: '#13285e'
      }
    }
  },
  {
    id: 'kaohsiung', label: 'Stile Kaohsiung (drago)',
    desc: 'Spalti a ferro di cavallo, pista azzurra con il fondo rosso, copertura a pannelli solari su tubi bianchi a spirale che scende fino a terra e continua fuori con la coda del drago.',
    st: {
      rings: 2, ringsEnds: 0, horseshoe: true, track: true, trackApron: true, shape: 'oval', corners: 'closed', mowing: 'stripes', seatMode: 'sectors', seatMosaic: 'shades',
      roof: 'dragon', roofCover: 'all', roofReach: 'normal', lights: 'roof', facade: 'wall', ramps: false, boxes: false, screen: 'ends',
      colors: {
        grass: '#3f8f3a', track: '#6fb3e6', trackLines: '#ffffff', apron: '#b24f3c', seatA: '#2f6fd1', seatB: '#2e9b5e', parapet: '#e8eaec',
        structure: '#bfc3c8', roof: '#33568f', steel: '#f2f4f6', screen: '#101b33'
      }
    }
  },
  {
    id: 'foshan', label: 'Stile Foshan (corona di vele)',
    desc: 'Ovale con pista rossa e fondo verde, anello basso rosso e alto grigio-blu, corona di vele bianche piegate a zig-zag su colonne inclinate, con l\'anello bianco in cima e la passerella sotto il tetto.',
    st: {
      rings: 2, ringsEnds: 0, track: true, trackApron: true, shape: 'oval', corners: 'closed', mowing: 'stripes', seatMode: 'rings', seatMosaic: 'none',
      roof: 'crown', roofReach: 'more', lights: 'roof', facade: 'glass', ramps: false, boxes: false, screen: 'ends',
      colors: {
        grass: '#4a8f3c', track: '#9e4634', trackLines: '#ffffff', apron: '#2d6b4f', seatA: '#c63a2e', seatB: '#3c4757', parapet: '#eceef0',
        structure: '#cfd3d7', roof: '#f6f7f8', steel: '#f3f4f5', screen: '#14181f'
      }
    }
  },
  {
    id: 'english', label: 'Stile inglese (Stamford Bridge)',
    desc: 'Quattro tribune squadrate vicine al campo, palchi vetrati tra gli anelli, ogni tribuna col suo tetto (pannelli traslucidi in una griglia di travi blu, trave reticolare davanti con le luci), piloni blu, scalette gialle.',
    st: {
      rings: 3, ringsEnds: 2, track: false, shape: 'rect', corners: 'closed', mowing: 'stripes', seatMode: 'single', seatMosaic: 'none', roof: 'stands', lights: 'roof', facade: 'panels', ramps: false, boxes: true,
      colors: {
        grass: '#3d9a43', seatA: '#1d4fb8', parapet: '#1c3f94', structure: '#a4abb5', roof: '#8cc4ee', steel: '#1f5fc4', accent: '#1b2f6b', aisle: '#f2c200'
      }
    }
  },
  {
    id: 'arena', label: 'Arena moderna',
    desc: 'Tre anelli con angoli arrotondati, seggiolini a mosaico, copertura chiara e maxischermo a 360°.',
    st: {
      rings: 3, track: false, shape: 'rounded', corners: 'closed', mowing: 'stripes', seatMode: 'single', seatMosaic: 'mix', roof: 'membrane', lights: 'roof', facade: 'columns', screen: 'ring',
      colors: { grass: '#3d8b37', seatA: '#212121', mosaicB: '#616161', mosaicC: '#ffd400', parapet: '#e0e0e0', structure: '#8d8d8d', roof: '#f1f3f5', steel: '#c8cdd3' }
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
    outerText: st.outerText, outerTextFont: st.outerTextFont, outerTextStyle: st.outerTextStyle, outerTextSize: st.outerTextSize, outerTextPlace: st.outerTextPlace, seatGrid: st.seatGrid
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
    trackApron: !!src.trackApron,
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
    ramps: !!src.ramps,
    boxes: !!src.boxes,
    shellPattern: oneOf(SHELL_PATTERNS, src.shellPattern, DEFAULT.shellPattern),
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
const GAP = 0.18;         // curve staccate: apertura intorno agli angoli (radianti, in coordinate normalizzate)
const M_PARAPET = 0, M_STEPS = 1, M_STRUCT = 2, M_BOX = 3;

const seatKey = (st) => [ringsBySide(st).join(','), st.track ? 1 : 0, st.shape, st.corners, st.horseshoe ? 1 : 0].join('|');
const geomKey = (st) => [seatKey(st), st.roof, st.roofCover, st.roofCover === 'pick' ? st.roofSectors.map(Number).join('') : '', st.roofReach, st.lights, st.facade, st.ramps ? 1 : 0, st.shellPattern, st.screen, st.boxes ? 1 : 0].join('|');

/** Punto del bordo su un lato lungo (tribune), non sulle curve. */
const onLongSide = (p) => Math.abs(p.mz) > 0.995;

/**
 * Bordo interno degli spalti: rettangolo con angoli arrotondati (r = 0 squadrato, r = b curve a semicerchio),
 * percorso in senso antiorario. Ogni punto ha il vettore (mx, mz) per allontanarsi dal campo:
 * p + m * d è il punto a distanza d (sugli angoli vivi m è lungo la diagonale, così i lati restano dritti).
 */
function buildPath(a, b, r) {
  const pts = [];
  const push = (x, z, mx, mz) => {
    const p = pts[pts.length - 1];
    if (p && Math.abs(p.x - x) < 1e-6 && Math.abs(p.z - z) < 1e-6) return;
    pts.push({ x, z, mx, mz });
  };
  const CORNER = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  const ARC = 32, STEP = 2.5;
  for (let q = 0; q < 4; q++) {
    const [sx, sz] = CORNER[q];
    const cx = sx * (a - r), cz = sz * (b - r);
    if (r > 0) {
      for (let k = 0; k <= ARC; k++) {
        const th = (q + k / ARC) * Math.PI / 2;
        push(cx + Math.cos(th) * r, cz + Math.sin(th) * r, Math.cos(th), Math.sin(th));
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
function buildRuns(path, a, b, corners) {
  if (corners !== 'open') return [{ pts: path, closed: true }];
  const keep = path.map(p => Math.abs(Math.atan2(Math.abs(p.z) / b, Math.abs(p.x) / a) - Math.PI / 4) > GAP);
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
  const r = st.shape === 'oval' ? b : st.shape === 'rounded' ? b * 0.42 : 0;
  const tiers = [];
  let D = 0, H = 1.2;
  // anelli delle tribune (lati lunghi) e delle curve: gli anelli in comune sono identici, quelli in più salgono sopra
  const counts = ringsBySide(st), maxRings = Math.max(...counts);
  ROWS[maxRings].forEach((rows, i) => {
    const R = RISERS[i], depth = rows * TREAD;
    const t = { i, rows, R, D, H, back: D + depth, top: H + (rows - 1) * R };
    t.soffit = (d) => t.H - 1.6 + (d - t.D) / TREAD * t.R; // sotto dell'anello (parallelo ai gradoni)
    // struttura a vista: anche il primo anello è sollevato da terra verso fuori (si vede il sotto)
    t.under = i === 0 ? (d) => Math.max(0, (d - t.D - 6) * t.R / TREAD) : t.soffit;
    tiers.push(t);
    D += depth * 0.55;           // l'anello sopra sporge sopra quello sotto
    H = t.top + R + 4.5;
  });
  const last = tiers[tiers.length - 1];
  const path = buildPath(a, b, r);
  let runs = buildRuns(path, a, b, st.corners);
  if (new Set(counts).size > 1) {
    // tratti separati dove cambia il numero di anelli (tribune, curve o un solo settore): quello con più anelli
    // arriva fino al primo punto del settore vicino (niente buchi)
    const split = [];
    for (const run of runs) {
      const P = run.pts, n = P.length, cnt = P.map(p => counts[sideOfPoint(p)]);
      const at = (i) => (run.closed ? cnt[(i + n) % n] : i >= 0 && i < n ? cnt[i] : 0);
      for (const c of new Set(cnt)) {
        const mine = new Set(P.filter((p, i) => cnt[i] === c || cnt[i] < c && (at(i - 1) === c || at(i + 1) === c)));
        for (const sub of subRuns(run, p => mine.has(p))) split.push({ ...sub, tiers: tiers.slice(0, c) });
      }
    }
    runs = split;
  } else runs.forEach(run => { run.tiers = tiers; });
  if (st.horseshoe) {
    // ferro di cavallo: niente spalti sulla curva verso -x
    // fino all'inizio della curva (lì parte la coda del drago); con gli angoli vivi resta l'angolo, via il lato in fondo
    const keep = (p) => p.x > -(a - r) - 1e-6 && !(p.mx < 0 && Math.abs(p.mz) < 1e-6);
    runs = runs.flatMap(run => subRuns(run, keep).map(sub => ({ ...sub, tiers: run.tiers })));
  }
  return { a, b, r, tiers, path, runs, outer: Math.max(...tiers.map(t => t.back)) + WALL, height: last.top + 2.2 };
}

/** Profilo di un anello (d = distanza dal bordo, h = altezza): parapetto, gradoni, muro dietro, sotto. */
function tierProfile(t, next, exposed, boxes) {
  const pts = [];
  const add = (d, h, m) => pts.push({ d, h, m }); // m = materiale del lato che parte da questo punto
  add(t.D, t.i === 0 ? 0 : t.H - 1.6, M_PARAPET);
  add(t.D, t.H + 1, M_PARAPET);
  add(t.D + 0.25, t.H + 1, M_PARAPET);
  add(t.D + 0.25, t.H, M_STEPS);
  for (let k = 0; k < t.rows; k++) {
    const last = k === t.rows - 1;
    // sopra l'ultima fila, fino all'anello di sopra: muro o fascia dei palchi vetrati
    add(t.D + (k + 1) * TREAD, t.H + k * t.R, last ? (boxes && next && !exposed ? M_BOX : M_STRUCT) : M_STEPS);
    if (!last) add(t.D + (k + 1) * TREAD, t.H + (k + 1) * t.R, M_STEPS);
  }
  // muro dietro: sale fino sotto l'anello di sopra (niente buchi tra un anello e l'altro) o fa da bordo in cima;
  // con la struttura a vista tra un anello e l'altro resta aperto (si vede il sotto a gradoni dell'anello sopra)
  const wallTop = next && !exposed ? next.soffit(t.back + WALL) : t.top + (next ? 1.2 : 2.2);
  add(t.back, wallTop, M_STRUCT);
  add(t.back + WALL, wallTop, M_STRUCT);
  if (!exposed) {
    add(t.back + WALL, t.i > 0 ? t.soffit(t.back + WALL) : 0, M_STRUCT);
    return pts;
  }
  // struttura a vista: il sotto degli spalti segue i gradoni, così da fuori si vedono le "scale" inclinate
  const y = (k) => t.under(t.D + (k + 1) * TREAD);
  add(t.back + WALL, y(t.rows - 1), M_STRUCT);
  for (let k = t.rows - 1; k >= 0; k--) {
    const dk = t.D + k * TREAD, yn = k > 0 ? y(k - 1) : null;
    add(dk, y(k), M_STRUCT);
    if (t.i === 0 && (yn === null || yn <= 0.3)) { add(dk, 0, M_STRUCT); break; } // il primo anello poggia a terra
    if (yn !== null) add(dk, yn, M_STRUCT);
  }
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

/** exposed = struttura a vista: niente muri pieni sotto gli anelli (li reggono travi e pilastri). */
function standsGeometry(THREE, shape, exposed, boxes) {
  const pos = [], idx = [[], [], [], []];
  for (const run of shape.runs) {
    run.tiers.forEach((t, i) => {
      extrude(THREE, run, tierProfile(t, run.tiers[i + 1], exposed, boxes), pos, idx);
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
    for (const t of run.tiers) {
      for (let row = 0; row < t.rows; row++) {
        const d = t.D + row * TREAD + 0.55, h = t.H + row * t.R;
        let carry = 0.25;
        for (let i = 0; i < segs; i++) {
          const j = (i + 1) % n;
          const x0 = P[i].x + P[i].mx * d, z0 = P[i].z + P[i].mz * d;
          const x1 = P[j].x + P[j].mx * d, z1 = P[j].z + P[j].mz * d;
          const l = Math.hypot(x1 - x0, z1 - z0);
          if (l < 1e-6) continue;
          const tx = (x1 - x0) / l, tz = (z1 - z0) / l, scale = l / Li[i];
          let s = carry;
          for (; s < l; s += SEAT_W) {
            const u = U[i] + (s / l) * Li[i];
            if (aisles.some(au => Math.abs(u - au) * scale < AISLE_HALF)) continue;
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
  // con la pista il margine d'erba intorno al campo si ferma alla prima corsia (fuori resta trasparente)
  if (st.track && st.trackApron) { ctx.beginPath(); ctx.rect(-PITCH.l / 2 - 2.5, -PITCH.w / 2 - 2.5, PITCH.l + 5, PITCH.w + 5); ctx.clip(); }
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

/** Fondo: erba tra campo e spalti, pista (se c'è) e pavimento sotto gli spalti. */
function paintBase(canvas, st, shape, ext) {
  const s = canvas.width / (ext.x * 2);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(s, 0, 0, s, ext.x * s, ext.z * s);
  ctx.fillStyle = shade(st.colors.structure, 0.85);
  ctx.fillRect(-ext.x, -ext.z, ext.x * 2, ext.z * 2);
  // con il fondo colorato intorno alla pista (anche dentro, ai lati del campo) il prato resta solo sul campo
  ctx.fillStyle = st.track && st.trackApron ? st.colors.apron : shade(st.colors.grass, 0.95);
  ctx.beginPath();
  shape.path.forEach((p, i) => (i ? ctx.lineTo(p.x, p.z) : ctx.moveTo(p.x, p.z)));
  ctx.closePath();
  ctx.fill();
  if (!st.track) return;
  const outer = TRACK.r + TRACK.lanes * TRACK.lane;
  ctx.fillStyle = st.colors.track;
  ctx.beginPath(); ovalPath(ctx, outer + 0.6); ovalPath(ctx, TRACK.r - 0.3); ctx.fill('evenodd');
  ctx.strokeStyle = st.colors.trackLines;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = Math.max(0.06, 1.1 / s);
  for (let k = 0; k <= TRACK.lanes; k++) { ctx.beginPath(); ovalPath(ctx, TRACK.r + k * TRACK.lane); ctx.stroke(); }
  ctx.globalAlpha = 1;
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
const GIRDER_H = 10, GIRDER_W = 3, GIRDER_L = 15, GIRDER_PANEL = 6; // travi rosse: altezza, mezza larghezza, sbalzo, campata
const TOWER_OVER = 5;   // le torri d'angolo salgono sopra le travi rosse
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
  const dOut = shape.outer + 4, dIn = clampIn(roof === 'girders' ? 4 : Math.max(top.D - 2, 3), dOut), hIn = top.top + 9;
  return { dIn, dOut, h: (d) => hIn - (d - dIn) * 0.04, depth: (d) => 1.4 + 3.6 * (d - dIn) / (dOut - dIn) };
}

/**
 * Copertura "drago" (stile Kaohsiung): nastro che parte da terra fuori dagli spalti (traliccio di tubi a spirale), sale,
 * gira sopra gli spalti e arriva al bordo davanti (pannelli solari). Profilo (d, h); split = fine del traliccio.
 */
function dragonOf(shape, st) {
  const T = shape.tiers[shape.tiers.length - 1], o = shape.outer, hF = T.top + 9;
  const dF = Math.min(o - 6, Math.max(-14, T.D - 2 - reachOf_(st)));
  // traliccio alto quasi fino al tetto, poi il bordo arrotondato dei pannelli e il tetto che scende piano verso il campo
  const hL = hF - 3.5;
  const prof = [{ d: o + 8, h: 0 }, { d: o + 9, h: hL * 0.4 }, { d: o + 8.9, h: hL * 0.75 }, { d: o + 8.2, h: hL },
    { d: o + 7.1, h: hF - 1.3 }, { d: o + 5.2, h: hF + 0.6 }, { d: o + 2.6, h: hF + 1.5 }, { d: o, h: hF + 1.8 }];
  const n = Math.max(3, Math.round((o - dF) / 3));
  for (let i = 1; i <= n; i++) { const f = i / n; prof.push({ d: o + (dF - o) * f, h: hF + 1.8 - 1.8 * f * f }); }
  prof.push({ d: dF - 0.7, h: hF - 0.9 });
  return { prof, split: 3, dF, hF, out: o + 9 };
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

/**
 * Pannelli solari a scaglie (grigio da tingere col colore della copertura): file allineate, ogni pannello chiaro in alto
 * e scuro in basso dove copre quello dopo, con le celle e la cornice d'alluminio.
 */
function solarCanvas() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3a4048'; ctx.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 4; r++) {
    for (let k = 0; k < 2; k++) {
      const x = k * 128 + 3, y = r * 64 + 3, w = 122, h = 58, g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#d3d9e0'); g.addColorStop(1, '#8e98a5');
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(70,82,98,0.45)'; ctx.lineWidth = 1.5;
      for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x + i * w / 6, y + 2); ctx.lineTo(x + i * w / 6, y + h - 2); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(x + 2, y + h / 2); ctx.lineTo(x + w - 2, y + h / 2); ctx.stroke();
      ctx.strokeStyle = '#f4f6f9'; ctx.lineWidth = 2.5; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x, y + h - 4, w, 4);
    }
  }
  return c;
}

/** Tubi a spirale: diagonali bianche che si incrociano; `bg` = sfondo (trasparente se nullo). */
function tubesCanvas(bg) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, 128, 128); }
  // tubi che girano a spirale (curvi) nei due versi; quelli in un verso un po' più grossi
  ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round';
  for (const [w, sgn] of [[10, 1], [7, -1]]) {
    ctx.lineWidth = w;
    for (const o of [-128, 0, 128]) {
      ctx.beginPath(); ctx.moveTo(o + (sgn > 0 ? 0 : 128), 0);
      ctx.bezierCurveTo(o + 64 + sgn * -18, 30, o + 64 + sgn * 18, 98, o + (sgn > 0 ? 128 : 0), 128); ctx.stroke();
    }
  }
  return c;
}

const towerHeight = (shape, st) => (st.roof !== 'none' ? roofOf(shape, st.roof, reachOf_(st)).h(0) : shape.height) + 18;
const towerDist = (shape, st) => Math.max(shape.outer, st.roof === 'crown' ? crownOf(shape, st).out : st.roof !== 'none' ? roofOf(shape, st.roof, reachOf_(st)).dOut : 0) + 6;

/** Piloni a traliccio del tetto reticolare: appena fuori dal bordo del tetto, più alti di lui. */
const pylonDist = (R) => R.dOut + 1.5;
const pylonHeight = (R) => R.h(R.dOut) + 7;

/** Distanza dal bordo occupata dal muro esterno (con basamento o fasce). */
const footOf = (shape, st) => shape.outer + ({ struts: PLATFORM_OUT + 0.2, bands: 1.8, columns: 0.8, esplanade: ESPLANADE_W + 0.2 }[st.facade] || 0);

/** Muro esterno e altezza di un tratto: i settori possono avere anelli diversi, la facciata segue ognuno. */
const runOuter = (run) => Math.max(...run.tiers.map(t => t.back)) + WALL;
const runTop = (run) => run.tiers[run.tiers.length - 1];

/**
 * Profilo dell'involucro a cuscini (stile Allianz Arena), come punti (d, h): parte poco sopra la base, si gonfia
 * verso fuori, gira sopra gli spalti e continua come tetto trasparente fino all'apertura sopra il campo.
 * `split` = indice del primo punto della parte trasparente.
 */
function shellOf(shape, st) {
  const T = shape.tiers[shape.tiers.length - 1], o = shape.outer;
  const base = st.facade === 'esplanade' ? ESPLANADE_H : 0, h0 = base + 3, crest = T.top + 9;
  const drop = Math.min(12, (crest - h0) * 0.32), dIn = Math.min(o - 16, Math.max(-14, 2 - reachOf_(st))); // il tetto scende verso l'apertura
  const k = (f) => h0 + (crest - h0) * f;
  // muro gonfio verso fuori e cresta larga e arrotondata
  const key = [[o + 0.6, h0], [o + 5.2, k(0.22)], [o + 7, k(0.48)], [o + 5.6, k(0.74)], [o + 2.2, k(0.92)], [o - 3, crest], [o - 10, crest - 0.8]];
  // poi il tetto scende curvo (convesso) fino all'apertura e si arrotonda verso il basso sul bordo
  const d0 = o - 10, n = Math.max(3, Math.round((d0 - dIn) / 4));
  for (let i = 1; i <= n; i++) { const f = i / n; key.push([d0 + (dIn - d0) * f, crest - 0.8 - (drop - 0.8) * Math.pow(f, 1.5)]); }
  key.push([dIn - 1.2, crest - drop - 1.6]);
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
  // la parte verso l'apertura (gli ultimi due terzi del tetto) è di cuscini trasparenti, un po' più grigi
  const dSplit = d0 - (d0 - dIn) * 0.35, split = Math.max(1, pts.findIndex(p => p.d < dSplit));
  const rows = new Map(), rowAt = (d) => { const key = d.toFixed(3); if (!rows.has(key)) rows.set(key, shellOutline(shape, d)); return rows.get(key); };
  // tenda: la membrana è tirata su dai pennoni; petali: quattro lobi separati da valli sulle diagonali
  let yFn = null, masts = [], extra = 0;
  if (st.roof === 'tent') {
    // tenda: quattro punte affilate (coni) tirate dai pennoni sulle diagonali; il bordo in basso fa una fila di archi
    const ring = rowAt(o - 2), N = ring.length - 1;
    masts = [0.125, 0.375, 0.625, 0.875].map(f => ring[Math.round(f * N) % N]);
    const P = 46, w = 7.5, jCrest = Math.max(1, pts.findIndex(p => p.h >= crest - 1)), ARCHES = 44;
    yFn = (x, z, j) => {
      if (!j) {
        const t = (Math.atan2(z / shape.b, x / shape.a) / (Math.PI * 2) + 1) % 1;
        return 4.5 * Math.abs(Math.sin(Math.PI * ARCHES * t)) ** 0.6;
      }
      const wj = Math.min(1, j / jCrest) * (j > jCrest ? Math.max(0.25, 1 - (j - jCrest) / (pts.length - jCrest)) : 1);
      let up = 0;
      for (const [mx, mz] of masts) up += P * Math.exp(-Math.hypot(x - mx, z - mz) / w);
      return up * wj;
    };
    extra = P + 16;
  }
  return { pts, split, base, dIn, hIn: crest - drop, top: crest + extra, out: o + 12, rowAt, yFn, masts };
}

/**
 * Copertura ondulata a sella (stile Vélodrome): alta sopra le curve e più bassa sui lati lunghi. Il profilo (d, h) è
 * relativo all'onda: wave(x, z) dà la quota della cresta in quel punto. Dal basso: fascia bianca esterna (la prima
 * riga ha quota assoluta, uguale tutto intorno), bordo arrotondato, tetto che scende piano verso il campo fino a dIn.
 */
function waveOf(shape, st) {
  const T = shape.tiers[shape.tiers.length - 1], o = shape.outer;
  const hSide = T.top + 5, hEnd = T.top + 30, skirtBottom = hSide - 12, dIn = Math.min(o - 6, Math.max(-14, 3 - reachOf_(st)));
  // sella: piatta sui lati lunghi, sale ripida verso le curve e fa un grande arco sopra di loro
  const wave = (x, z) => {
    const c = Math.cos(Math.atan2(Math.abs(z) / shape.b, Math.abs(x) / shape.a));
    return hSide + (hEnd - hSide) * c ** 3;
  };
  const pts = [{ d: o + 3.2, h: skirtBottom }, { d: o + 3.2, h: -2.6 }, { d: o + 2.9, h: -1.2 }, { d: o + 2.1, h: -0.3 }, { d: o + 0.8, h: 0 }];
  const n = Math.max(4, Math.round((o + 0.8 - dIn) / 3.5));
  for (let i = 1; i <= n; i++) { const f = i / n; pts.push({ d: o + 0.8 + (dIn - o - 0.8) * f, h: -4.5 * f * f }); }
  pts.push({ d: dIn - 0.6, h: -5.4 });
  const rows = new Map(), rowAt = (d) => { const key = d.toFixed(3); if (!rows.has(key)) rows.set(key, shellOutline(shape, d)); return rows.get(key); };
  // la prima riga (fondo della fascia) ha quota assoluta, le altre seguono l'onda
  const yFn = (x, z, j) => (j === 0 ? 0 : wave(x, z));
  return { pts, dIn, hSide, hEnd, skirtBottom, wave, rowAt, yFn, out: o + 3.4, top: hEnd };
}

/** Tela della copertura ondulata vista da sopra: pannelli bianchi gonfi con le costole verso il campo. */
function wavePanelCanvas() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 8;
  const ctx = c.getContext('2d'), g = ctx.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, '#9aa1a9'); g.addColorStop(0.08, '#e9edf1'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(0.92, '#e3e7eb'); g.addColorStop(1, '#9aa1a9');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 8);
  return c;
}

/** Tela del traliccio sotto la copertura: membrana chiara e tubi grigi a triangoli. */
function latticeCanvas() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d9dde1'; ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#5b6168'; ctx.lineWidth = 5; ctx.lineCap = 'square';
  ctx.beginPath();
  for (const [a, b, c2, d] of [[0, 0, 128, 0], [0, 64, 128, 64], [0, 128, 128, 128], [0, 0, 0, 128], [64, 0, 64, 128], [128, 0, 128, 128],
    [0, 0, 64, 64], [64, 64, 128, 128], [128, 0, 64, 64], [64, 64, 0, 128]]) { ctx.moveTo(a, b); ctx.lineTo(c2, d); }
  ctx.stroke();
  ctx.fillStyle = '#4b5057';
  for (const [x, y] of [[0, 0], [64, 0], [128, 0], [0, 64], [64, 64], [128, 64], [0, 128], [64, 128], [128, 128]]) { ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); }
  return c;
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
const CROWN_FOLDS = 40, CROWN_ROW = 240; // pieghe e punti della pianta: sei punti per piega
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
  // pianta ripresa a passi uguali lungo il giro: tutte le vele larghe uguali (anche sui lati lunghi)
  const even = (d) => {
    const dense = shellOutline(shape, d, CROWN_ROW * 8), cum = [0];
    for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
    const out = [], total = cum[cum.length - 1];
    let j = 1;
    for (let i = 0; i <= CROWN_ROW; i++) {
      const L = i / CROWN_ROW * total;
      while (j < dense.length - 1 && cum[j] < L) j++;
      const f = (L - cum[j - 1]) / ((cum[j] - cum[j - 1]) || 1), a = dense[j - 1], b = dense[j];
      out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
    }
    return out;
  };
  const rows = new Map(), rowAt = (d) => { const key = d.toFixed(3); if (!rows.has(key)) rows.set(key, even(d)); return rows.get(key); };
  return { ridge, valley, at, hAt, rowAt, o, base, dFoot, dV, hV, dR, hR, dIn, hIn, out: dR + 2 };
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

/** Pannelli della cupola: bianco liscio, una linea sottile per pannello e una più marcata ogni otto. */
function domePanelCanvas() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 8;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 512, 8);
  ctx.fillStyle = 'rgba(80,90,100,.22)';
  for (let x = 0; x < 512; x += 64) ctx.fillRect(x, 0, 3, 8);
  ctx.fillStyle = 'rgba(70,80,90,.5)'; ctx.fillRect(0, 0, 5, 8);
  return c;
}

/**
 * Petali (stile Al Janoub): quattro petali sul profilo dell'involucro. Le giunture partono dalle diagonali in basso e
 * salgono piegando verso il centro delle curve: il petalo delle curve diventa una V che punta all'apertura, quelli dei
 * lati la avvolgono. Le costole (texture) seguono le colonne di ogni petalo, quindi convergono con le giunture; ogni
 * petalo è gonfio al centro. Le giunture scure vanno in `seamsOut` (travi sottili).
 */
function petalsGeometry(THREE, S, beamsOut, seamsOut) {
  const rows = S.pts.length, M = 40, RIBS = 18;
  const at = (row, q) => {                                  // punto della pianta alla frazione q del giro
    const N = row.length - 1, f = ((q % 1) + 1) % 1 * N, i = Math.floor(f), t = f - i, a = row[i], b = row[Math.min(N, i + 1)];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };
  const bound = (k, t) => { const qb = 0.125 + 0.25 * k, qt = [0.03, 0.47, 0.53, 0.97][k]; return qb + (qt - qb) * t ** 1.5; };
  // petali: [inizio, fine] per riga (t da 0 in basso a 1 sull'apertura)
  const petals = [(t) => [bound(3, t) - 1, bound(0, t)], (t) => [bound(0, t), bound(1, t)], (t) => [bound(1, t), bound(2, t)], (t) => [bound(2, t), bound(3, t)]];
  const pos = [], uv = [], idx = [];
  for (const span of petals) {
    const base = pos.length / 3;
    for (let j = 0; j < rows; j++) {
      const t = j / (rows - 1), [q0, q1] = span(t), row = S.rowAt(S.pts[j].d);
      for (let m = 0; m <= M; m++) {
        const f = m / M, [x, z] = at(row, q0 + (q1 - q0) * f), l = Math.hypot(x, z) || 1;
        const puff = 2.6 * Math.sin(Math.PI * f) * Math.min(1, j / 3);     // gonfio al centro del petalo
        pos.push(x + x / l * puff, S.pts[j].h + puff * 0.4, z + z / l * puff);
        uv.push(f * RIBS, t * 4);
      }
    }
    for (let j = 0; j < rows - 1; j++) for (let m = 0; m < M; m++) { const a = base + j * (M + 1) + m, b = a + M + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  }
  // giunture scure tra un petalo e l'altro
  for (let k = 0; k < 4; k++) {
    for (let j = 0; j < rows - 1; j++) {
      const t0 = j / (rows - 1), t1 = (j + 1) / (rows - 1);
      const [x0, z0] = at(S.rowAt(S.pts[j].d), bound(k, t0)), [x1, z1] = at(S.rowAt(S.pts[j + 1].d), bound(k, t1));
      beam(seamsOut, x0, S.pts[j].h + 0.1, z0, x1, S.pts[j + 1].h + 0.1, z1, 0.35);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Pianta dell'involucro a distanza d dal bordo degli spalti: un ovale "smussato" (superellisse, tra l'ellisse e il
 * rettangolo arrotondato) il più tondo possibile che contiene ancora gli spalti a quella distanza. Punti chiusi [x, z].
 */
function shellOutline(shape, d, N = 240) {
  const pts = shape.path.map(p => [p.x + p.mx * d, p.z + p.mz * d]);
  const A = Math.max(...pts.map(p => Math.abs(p[0]))), B = Math.max(...pts.map(p => Math.abs(p[1])));
  const worst = (n) => Math.max(...pts.map(([x, z]) => Math.abs(x / A) ** n + Math.abs(z / B) ** n));
  let n = 2.4, scale = 1;
  if (worst(4) > 1) { n = 4; scale = worst(4) ** (1 / 4); }      // forme squadrate: rettangolo arrotondato un po' più grande
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
  const diag = (shape.r > 0 ? shape.r + foot : foot * Math.SQRT2) + CORNER_R + 1.5;
  const X = shape.a - shape.r + diag / Math.SQRT2, Z = shape.b - shape.r + diag / Math.SQRT2;
  const y0 = R.h(R.dIn) + 2;
  return { X, Z, y0, top: y0 + GIRDER_H, towers: [[X, Z], [-X, Z], [-X, -Z], [X, -Z]] };
}

/** Fin dove arrivano le parti esterne (distanza dal bordo, altezza, estensione): per inquadratura, ombre e pavimento. */
function reachOf(shape, st) {
  const foot = footOf(shape, st);
  let d = foot + 0.5, h = shape.height, x = 0, z = 0;
  if (SHELLISH.includes(st.roof)) { const S = shellOf(shape, st); d = Math.max(d, S.out + 1); h = Math.max(h, S.top + 1); }
  else if (st.roof === 'wave') { const V = waveOf(shape, st); d = Math.max(d, V.out + 1); h = Math.max(h, V.top + 1); }
  else if (st.roof === 'dome') { const D = domeOf(shape, st); d = Math.max(d, D.out + 1); h = Math.max(h, D.top + 3); }
  else if (st.roof === 'crown') { const C = crownOf(shape, st); d = Math.max(d, C.out + 1); h = Math.max(h, C.hR + 2); }
  else if (st.roof !== 'none') { const R = roofOf(shape, st.roof, reachOf_(st)); d = Math.max(d, st.roof === 'truss' ? pylonDist(R) + 2.5 : R.dOut); h = Math.max(R.h(R.dIn), st.roof === 'truss' ? pylonHeight(R) : 0) + 1; }
  if (st.ramps) d = Math.max(d, foot + RAMP_R * 2);
  if (st.roof === 'stands') { const R = roofOf(shape, 'stands', reachOf_(st)); d = Math.max(d, R.dOut + 11); h = Math.max(h, R.h(R.dIn) + 17); }
  if (st.roof === 'girders') {
    const G = girdersOf(shape, st);
    d = Math.max(d, foot + CORNER_R * 2 + 2);
    h = Math.max(h, G.top + TOWER_OVER + 8);
    x = G.X + GIRDER_L + 2; z = G.Z + GIRDER_L + 2;
  } else if (lightsOf(st) === 'towers') { d = Math.max(d, towerDist(shape, st) + 6); h = towerHeight(shape, st) + 6; }
  if (st.screen !== 'none' && st.roof === 'none') h = Math.max(h, screenOf(shape, st).y + (st.screen === 'ends' ? ENDS_H : SCREEN_H) + 1);
  if (st.roof === 'dragon') {
    const D = dragonOf(shape, st);
    d = Math.max(d, D.out + 1); h = Math.max(h, D.hF + 3);
    if (hasDragonTail(shape, st)) for (const p of dragonTail(shape).pts) { x = Math.max(x, Math.abs(p.x) + D.out + 4); z = Math.max(z, Math.abs(p.z) + D.out + 4); }
  }
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
  if (st.roof === 'wave') {
    // sotto il bordo interno, alla quota più bassa dell'onda (sui lati lunghi)
    const V = waveOf(shape, st), ds = V.dIn + 1.5;
    return { ds, hang: true, y: V.hSide - 5.6 - 2.2, roofY: V.hSide - 5 };
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
    return { ds, hang: true, y: R.h(R.dIn) - 3.2, roofY: R.h(ds) - (ribbed ? R.depth(ds) : 0.4) };
  }
  return { ds: T.back + WALL / 2, hang: false, y: T.top + 2.2 };
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
    // sul traliccio esterno della copertura, a metà altezza
    const d = o + 8.8, outline = (dd) => { const pts = shape.path.map(p => [p.x + p.mx * dd, p.z + p.mz * dd]); pts.push(pts[0]); return pts; };
    return { hc: 8, maxH: 5, standOn: 0, dAt: () => d, outline, rows: 1 };
  }
  if (st.roof === 'wave') {
    // sulla fascia bianca della copertura, al centro dei lati lunghi (dove l'onda è più bassa)
    const V = waveOf(shape, st), d = o + 3.4;
    return { hc: (V.skirtBottom + V.hSide - 2.6) / 2, maxH: 6, standOn: 0, dAt: () => d, outline: V.rowAt, rows: 1 };
  }
  if (SHELLISH.includes(st.roof) || st.roof === 'dome') {
    const S = st.roof === 'dome' ? domeOf(shape, st) : shellOf(shape, st), wall = [];
    // muro gonfio dell'involucro: punti dal basso fino alla cresta (la quota sale)
    for (const p of S.pts) { if (wall.length && p.h <= wall[wall.length - 1].h) break; wall.push(p); }
    const best = wall.reduce((m, p) => (p.d > m.d ? p : m), wall[0]);
    const dAt = (h) => {
      for (let j = 1; j < wall.length; j++) if (wall[j].h >= h) { const a = wall[j - 1], b = wall[j]; return a.d + (b.d - a.d) * (h - a.h) / (b.h - a.h) + 0.2; }
      return wall[wall.length - 1].d + 0.2;
    };
    return { hc: best.h, maxH: 8.5, standOn: 0, dAt, outline: S.rowAt, rows: 8 };
  }
  const outline = (d) => { const pts = shape.path.map(p => [p.x + p.mx * d, p.z + p.mz * d]); pts.push(pts[0]); return pts; };
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
      for (const u of stations(run, cum, RAMP_EVERY)) {
        const [px, pz] = pointAt(run, cum, u, 0);
        if (G && Math.abs(Math.atan2(Math.abs(pz) / shape.b, Math.abs(px) / shape.a) - Math.PI / 4) < 0.3) continue;
        const [x, z] = pointAt(run, cum, u, foot + RAMP_R - 0.4);
        towers.push([x, z, RAMP_R + 0.6]);
      }
    }
  }
  if (st.roof === 'truss') {
    const R = roofOf(shape, st.roof, reachOf_(st)), PD = pylonDist(R);
    if (PD + 1.6 > d) {
      for (const run of shape.runs) {
        const cum = runLengths(run);
        for (const u of stations(run, cum, PYLON_EVERY)) { const [x, z] = pointAt(run, cum, u, PD); towers.push([x, z, 3.2]); }
      }
    }
  }
  for (const [x, z, r] of towers) if (Math.abs(z) > shape.b * 0.6) out[Math.sign(z)].push([x - r, x + r]);
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

/** Posizioni a passo regolare lungo il tratto (sui tratti aperti anche alle due estremità). */
function stations(run, cum, step) {
  const total = cum[cum.length - 1], count = Math.max(1, Math.round(total / step));
  return Array.from({ length: run.closed ? count : count + 1 }, (_, k) => k * total / count);
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

/** Proiettore largo w e alto h in (x, y, z), rivolto verso il centro del campo (la faccia accesa è +z). */
function lampAt(out, x, y, z, w, h) {
  let fx = -x, fy = -y, fz = -z;
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  let rx = fz, rz = -fx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;   // su × avanti
  const ux = fy * rz, uy = fz * rx - fx * rz, uz = -fy * rx;                  // avanti × destra
  boxAt(out, x, y, z, [rx * w, 0, rz * w], [ux * h, uy * h, uz * h], [fx * 0.5, fy * 0.5, fz * 0.5]);
}

/**
 * Pannelli del tetto (grigio da moltiplicare per il colore): giunti verso il campo e, a scelta,
 * la lamiera ondulata (righe fitte) o le "botti" di policarbonato (due volte per pannello, chiare al centro).
 */
function roofPanelCanvas(kind) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 128, 64);
  if (kind === 'corrugated') {
    ctx.fillStyle = 'rgba(0,0,0,.13)';
    for (let x = 4; x < 128; x += 8) ctx.fillRect(x, 0, 4, 64);
  } else if (kind === 'barrel') {
    for (const x0 of [0, 64]) {
      const g = ctx.createLinearGradient(x0, 0, x0 + 64, 0);
      g.addColorStop(0, 'rgba(0,0,0,.42)'); g.addColorStop(0.3, 'rgba(0,0,0,.08)'); g.addColorStop(0.5, 'rgba(0,0,0,0)');
      g.addColorStop(0.75, 'rgba(0,0,0,.14)'); g.addColorStop(1, 'rgba(0,0,0,.42)');
      ctx.fillStyle = g; ctx.fillRect(x0, 0, 64, 64);
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.fillRect(0, 0, 4, 64);
  ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(0, 0, 128, 2);
  return c;
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
 * Disegno dell'involucro (quasi bianco: il colore scelto lo tinge, di notte si accende). Restituisce la tela e quante
 * volte ripeterla per ogni cella da SHELL_CELL_U x SHELL_CELL_V metri (rx intero: niente cuciture sul giro).
 */
function shellPatternCanvas(kind) {
  const make = (W, H) => { const c = document.createElement('canvas'); c.width = W; c.height = H; return [c, c.getContext('2d')]; };
  // cuscino gonfio: chiaro in alto al centro, più scuro verso le giunture
  const cushion = (ctx, cx, cy, r, path) => {
    const g = ctx.createRadialGradient(cx - r * 0.12, cy - r * 0.25, 2, cx, cy, r * 1.05);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#eef0f3'); g.addColorStop(1, '#bcc3cb');
    ctx.fillStyle = g; ctx.beginPath(); path(); ctx.closePath(); ctx.fill();
  };
  const JOINT = '#868e97';
  if (kind === 'hex') {
    // esagoni a punta in su: vicini a (±W, 0) e (±W/2, ±H/2), con H = W·√3
    const W = 148, H = 256, r = H / 3, [c, ctx] = make(W, H);
    ctx.fillStyle = JOINT; ctx.fillRect(0, 0, W, H);
    for (const [cx, cy] of [[0, 0], [W, 0], [W / 2, H / 2], [0, H], [W, H]]) {
      cushion(ctx, cx, cy, r, () => { for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; ctx.lineTo(cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4)); } });
    }
    return { canvas: c, rx: 2, ry: SHELL_CELL_V / (SHELL_CELL_U / 2 * Math.sqrt(3)) };
  }
  if (kind === 'scales') {
    // squame: file di semicerchi sfalsati, quelle più in basso sopra le altre
    const W = 256, H = 128, R = W / 4, [c, ctx] = make(W, H);
    ctx.fillStyle = JOINT; ctx.fillRect(0, 0, W, H);
    for (const [y, xs] of [[0, [0, W / 2, W]], [H / 2, [W / 4, 3 * W / 4]], [H, [0, W / 2, W]], [H * 1.5, [W / 4, 3 * W / 4]]]) {
      for (const x of xs) cushion(ctx, x, y, R, () => ctx.arc(x, y, R - 3, 0, Math.PI * 2));
    }
    return { canvas: c, rx: 2, ry: SHELL_CELL_V / (SHELL_CELL_U / 4) };
  }
  if (kind === 'stripes') {
    // fasce orizzontali gonfie
    const [c, ctx] = make(64, 64), g = ctx.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, '#bcc3cb'); g.addColorStop(0.3, '#ffffff'); g.addColorStop(0.7, '#eef0f3'); g.addColorStop(0.94, '#bcc3cb'); g.addColorStop(1, JOINT);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    return { canvas: c, rx: 1, ry: 1.6 };
  }
  if (kind === 'ribs') {
    // costole bianche che corrono lungo il profilo (petali)
    const [c, ctx] = make(64, 8), g = ctx.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, '#8c949d'); g.addColorStop(0.1, '#e8ebee'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(0.88, '#d6dbe0'); g.addColorStop(1, '#8c949d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 8);
    return { canvas: c, rx: 1, ry: 1 };
  }
  if (kind === 'plain') {
    const [c, ctx] = make(8, 8);
    ctx.fillStyle = '#f2f4f6'; ctx.fillRect(0, 0, 8, 8);
    return { canvas: c, rx: 1, ry: 1 };
  }
  // rombi (come l'Allianz Arena)
  const W = 256, H = 164, [c, ctx] = make(W, H);
  ctx.fillStyle = JOINT; ctx.fillRect(0, 0, W, H);
  for (const [cx, cy] of [[W / 2, H / 2], [0, 0], [W, 0], [0, H], [W, H]]) {
    cushion(ctx, cx, cy, W * 0.4, () => { ctx.moveTo(cx, cy - H / 2 + 3); ctx.lineTo(cx + W / 2 - 4, cy); ctx.lineTo(cx, cy + H / 2 - 3); ctx.lineTo(cx - W / 2 + 4, cy); });
  }
  return { canvas: c, rx: 1, ry: 1 };
}

/**
 * Superficie che gira tutto intorno allo stadio con il profilo `prof` (punti d, h), dalla riga j0 alla j1;
 * rowAt(d) dà la pianta chiusa a quella distanza. Coordinate per la texture lungo la pianta (numero intero di
 * cuscini per giro, niente cuciture) e lungo il profilo. yFn(x, z, j) aggiunge una quota per punto (copertura ondulata).
 */
function sweepAround(THREE, rowAt, prof, j0, j1, yFn = null) {
  const pos = [], uv = [], idx = [];
  let v = 0, cols = 0;
  for (let j = j0; j <= j1; j++) {
    if (j > j0) v += Math.hypot(prof[j].d - prof[j - 1].d, prof[j].h - prof[j - 1].h) / SHELL_CELL_V;
    const { d, h } = prof[j], row = rowAt(d), us = [0];
    cols = row.length;
    for (let i = 1; i < cols; i++) us.push(us[i - 1] + Math.hypot(row[i][0] - row[i - 1][0], row[i][1] - row[i - 1][1]));
    const len = us[cols - 1] || 1, cells = Math.max(1, Math.round(len / SHELL_CELL_U));
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
  const ramps = surface(), wedges = surface();
  const lights = lightsOf(st);
  let deckMat = null;
  const G = st.roof === 'girders' ? girdersOf(shape, st) : null;
  // dove stanno le torri delle rampe lungo un tratto (agli angoli, con le travi rosse, ci sono già le torri d'angolo)
  const rampStations = (run, cum) => stations(run, cum, RAMP_EVERY).filter(u => {
    if (!G) return true;
    const [px, pz] = pointAt(run, cum, u, 0);
    return Math.abs(Math.atan2(Math.abs(pz) / shape.b, Math.abs(px) / shape.a) - Math.PI / 4) >= 0.3;
  });

  // dove c'è la copertura (tutto unito, per settore, solo tribune, solo curve...)
  const roofRuns = coveredRuns(shape, st);
  // lamiera e moderna stanno all'altezza dei settori coperti: se sono più bassi degli altri il tetto non resta in aria
  let roofShape = shape;
  if ((st.roof === 'truss' || st.roof === 'membrane') && roofRuns.length) {
    const tall = roofRuns.reduce((m, r) => (r.tiers.length > m.tiers.length ? r : m));
    roofShape = { ...shape, tiers: tall.tiers, outer: Math.max(...roofRuns.map(runOuter)) };
  }
  const R = st.roof !== 'none' && st.roof !== 'stands' && st.roof !== 'dragon' && !WRAP_ROOFS.includes(st.roof) ? roofOf(roofShape, st.roof, reachOf_(st)) : null;
  let shellMat = null, roofDecor = null;
  if (st.roof === 'wave') {
    // copertura ondulata: sopra pannelli bianchi a costole, sotto il traliccio a triangoli (stessa superficie, due facce)
    const V = waveOf(shape, st);
    const top = new THREE.CanvasTexture(wavePanelCanvas()), under = new THREE.CanvasTexture(latticeCanvas());
    for (const t of [top, under]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; }
    top.repeat.set(3, 1); under.repeat.set(2, 1.2);
    const g = sweepAround(THREE, V.rowAt, V.pts, 0, V.pts.length - 1, V.yFn);
    // da che parte guarda la faccia di sopra: la normale a metà tetto deve puntare in alto
    const nrm = g.getAttribute('normal'), cols = V.rowAt(V.pts[0].d).length, mid = Math.floor(V.pts.length * 0.6) * cols + 3;
    const up = nrm.getY(mid) > 0;
    shellMat = new THREE.MeshStandardMaterial({ map: top, roughness: 0.45, side: up ? THREE.FrontSide : THREE.BackSide, emissiveIntensity: 0 });
    const underMat = new THREE.MeshStandardMaterial({ map: under, roughness: 0.8, side: up ? THREE.BackSide : THREE.FrontSide });
    const roofTop = new THREE.Mesh(g, shellMat), roofUnder = new THREE.Mesh(g, underMat);
    roofTop.castShadow = roofTop.receiveShadow = true;
    roofUnder.receiveShadow = true;
    group.add(roofTop, roofUnder);
    own.push(top, under, shellMat, underMat, g);
    if (lights === 'roof') {
      const edge = V.rowAt(V.dIn + 0.6);
      const lip = 6.6;
      for (let i = 0; i < edge.length - 1; i += 8) lampAt(lamps, edge[i][0], V.wave(edge[i][0], edge[i][1]) - lip, edge[i][1], 2.4, 1.3);
      for (let k = 0; k < 6; k++) { const [x, z] = edge[Math.floor((k + 0.5) / 6 * (edge.length - 1))]; spots.push([x, V.wave(x, z) - lip - 0.2, z]); }
    }
  }
  if (st.roof === 'dragon') {
    // pannelli solari sopra, tubi bianchi sotto e nel traliccio esterno (trasparente tra un tubo e l'altro); con il
    // ferro di cavallo la copertura continua fuori con la coda del drago
    const D = dragonOf(shape, st);
    const solar = new THREE.CanvasTexture(solarCanvas()), tubesA = new THREE.CanvasTexture(tubesCanvas(null)), tubesU = new THREE.CanvasTexture(tubesCanvas('#46505e'));
    for (const t of [solar, tubesA, tubesU]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; }
    tubesU.repeat.set(0.7, 0.4);
    shellMat = new THREE.MeshStandardMaterial({ map: solar, roughness: 0.3, metalness: 0.35 });
    const underMat = new THREE.MeshStandardMaterial({ map: tubesU, roughness: 0.7 });
    const latticeMat = new THREE.MeshStandardMaterial({ map: tubesA, alphaTest: 0.5, roughness: 0.5, side: THREE.DoubleSide });
    own.push(solar, tubesA, tubesU, shellMat, underMat, latticeMat);
    const tail = hasDragonTail(shape, st, roofRuns) ? dragonTail(shape) : null, runs = [...roofRuns, ...(tail ? [tail] : [])];
    let sideSet = false;
    for (const run of runs) {
      const top = sweepRun(THREE, run, D.prof, D.split, D.prof.length - 1, 5, 4);
      const lat = sweepRun(THREE, run, D.prof, 0, D.split, 7, 10);
      if (!sideSet) {
        // la faccia di sopra guarda in alto?
        const nrm = top.getAttribute('normal'), R = D.prof.length - D.split, i = Math.floor(run.pts.length / 2) * R + Math.floor(R / 2);
        const up = nrm.getY(i) > 0;
        shellMat.side = up ? THREE.FrontSide : THREE.BackSide; underMat.side = up ? THREE.BackSide : THREE.FrontSide;
        sideSet = true;
      }
      const mt = new THREE.Mesh(top, shellMat), mu = new THREE.Mesh(top, underMat), ml = new THREE.Mesh(lat, latticeMat);
      mt.castShadow = mt.receiveShadow = true;
      ml.castShadow = true;
      group.add(mt, mu, ml);
      own.push(top, lat);
    }
    roofDecor = { solar: shellMat, tubes: latticeMat };
    if (lights === 'roof') {
      for (const run of roofRuns) {
        const cum = runLengths(run), total = cum[cum.length - 1];
        for (const u of stations(run, cum, 8)) { const [x, z] = pointAt(run, cum, u, D.dF + 1.2); lampAt(lamps, x, D.hF - 1.6, z, 2.2, 1.2); }
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
    // anello bianco in cima, dove arrivano le creste
    const rg = sweepGrid(THREE, C.rowAt, [[-0.5, -0.5], [0.8, -0.5], [0.8, 0.9], [-0.5, 0.9], [-0.5, -0.5]].map(([d, h]) => ({ d: C.dR + d, h: C.hR + h })), N, 1);
    const ring = new THREE.Mesh(rg, ringMat);
    ring.castShadow = true;
    group.add(ring);
    own.push(rg);
    const dC = C.dIn + (C.o - C.dIn) * 0.32, hC = C.hAt(C.valley, dC) - 1.4, rowC = C.rowAt(dC);
    for (let k = 0; k < N; k++) {
      const r = k * step, v = r + step / 2, r2 = (k + 1) * step;
      // bordi delle vele verso fuori (la Y con la colonna) e colonna inclinata fino a terra
      const R0 = P(C.ridge, r, 0), V0 = P(C.valley, v, 0), R1 = P(C.ridge, r2, 0), [fx, fz] = C.rowAt(C.dFoot)[v];
      beam(beams, ...R0, ...V0, 0.55); beam(beams, ...V0, ...R1, 0.55);
      beam(beams, fx, C.base, fz, V0[0], V0[1] + 0.3, V0[2], 1.3);
      // bordo verso il campo a denti
      const Ri = P(C.ridge, r, 1), Vi = P(C.valley, v, 1), Ri2 = P(C.ridge, r2, 1);
      beam(beams, ...Ri, ...Vi, 0.3); beam(beams, ...Vi, ...Ri2, 0.3);
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
    roofDecor = { tubes: ringMat };
    if (lights === 'roof') {
      for (let k = 0; k < N; k++) { const [x, y, z] = P(C.ridge, k * step, 0.97); lampAt(lamps, x, y - 1.6, z, 2.4, 1.3); }
      for (let k = 0; k < 6; k++) { const [x, y, z] = P(C.ridge, Math.round((k + 0.5) / 6 * N) * step, 0.95); spots.push([x, y - 2, z]); }
    }
  }
  if (st.roof === 'dome') {
    // cupola a raggiera: sopra bianca a pannelli, sotto il traliccio; anello in rilievo attorno all'apertura;
    // corona di denti triangolari alla base con la struttura scura dietro
    const D = domeOf(shape, st);
    const topTex = new THREE.CanvasTexture(domePanelCanvas()), under = new THREE.CanvasTexture(latticeCanvas());
    for (const t of [topTex, under]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; }
    under.repeat.set(1, 0.6);
    const g = sweepGrid(THREE, D.rowAt, D.pts, 22, 9);
    const gu = sweepGrid(THREE, D.rowAt, D.pts, 70, 7);
    shellMat = new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.35, side: THREE.FrontSide });
    const underMat = new THREE.MeshStandardMaterial({ map: under, roughness: 0.8, side: THREE.BackSide });
    // la faccia di sopra guarda in alto? (dipende dal verso della griglia)
    const nrm = g.getAttribute('normal'), cols = D.rowAt(D.pts[0].d).length;
    if (nrm.getY(Math.floor(D.pts.length / 2) * cols + 5) < 0) { shellMat.side = THREE.BackSide; underMat.side = THREE.FrontSide; }
    const roofTop = new THREE.Mesh(g, shellMat), roofUnder = new THREE.Mesh(gu, underMat);
    roofTop.castShadow = roofTop.receiveShadow = true;
    group.add(roofTop, roofUnder);
    own.push(topTex, under, shellMat, underMat, g, gu);
    // anello attorno all'apertura
    const lip = [[D.dIn + 2.5, D.top - 0.2], [D.dIn + 1.6, D.top + 1.4], [D.dIn, D.top + 1.9], [D.dIn - 1.5, D.top + 1.2], [D.dIn - 1.8, D.top - 0.6], [D.dIn - 0.6, D.top - 1.8], [D.dIn + 2.5, D.top - 1.2]]
      .map(([d, h]) => ({ d, h }));
    const lg = sweepGrid(THREE, D.rowAt, lip, 1, 50);
    const rim = new THREE.Mesh(lg, new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.4, side: THREE.DoubleSide }));
    rim.castShadow = true;
    group.add(rim);
    own.push(lg, rim.material);
    // denti: triangoli piegati (due facce) dal bordo della cupola giù quasi a terra
    const ring = D.rowAt(D.dOut), tipRing = D.rowAt(D.dOut + 2.6), foldRing = D.rowAt(D.dOut + 1.8), N = ring.length - 1, TEETH = 34, tp = [];
    for (let k = 0; k < TEETH; k++) {
      const a = ring[Math.round(k / TEETH * N)], b = ring[Math.round((k + 1) / TEETH * N) % N];
      const m = tipRing[Math.round((k + 0.5) / TEETH * N) % N], f = foldRing[Math.round((k + 0.5) / TEETH * N) % N];
      const A = [a[0], D.hb + 0.4, a[1]], B = [b[0], D.hb + 0.4, b[1]], M = [m[0], 2.2, m[1]], F = [f[0], D.hb - 1.2, f[1]];
      tp.push(...A, ...F, ...M, ...F, ...B, ...M);
      beam(beams, m[0], 0, m[1], m[0], 2.3, m[1], 0.45);
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
    tg.computeVertexNormals();
    const teeth = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.45, side: THREE.DoubleSide }));
    teeth.castShadow = teeth.receiveShadow = true;
    group.add(teeth);
    own.push(tg, teeth.material);
    // struttura scura dietro ai denti
    const bg = sweepGrid(THREE, D.rowAt, [{ d: D.dOut - 5, h: 0 }, { d: D.dOut - 5, h: D.hb + 1 }], 1, 10);
    const back = new THREE.Mesh(bg, dark);
    group.add(back);
    own.push(bg);
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
    const pat = shellPatternCanvas(st.roof === 'shell' ? st.shellPattern : st.roof === 'petals' ? 'ribs' : 'plain');
    const tex = new THREE.CanvasTexture(pat.canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(pat.rx, pat.ry);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    shellMat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissiveIntensity: 0, roughness: 0.38, side: THREE.DoubleSide });
    // la parte verso l'apertura è di cuscini trasparenti: un po' più grigia e non fa ombra
    const clearMat = new THREE.MeshStandardMaterial({ map: tex, color: 0xe3e6ea, roughness: 0.25, side: THREE.DoubleSide });
    const petals = st.roof === 'petals';
    const outer = new THREE.Mesh(petals ? petalsGeometry(THREE, S, beams, seams) : sweepAround(THREE, S.rowAt, S.pts, 0, S.split, S.yFn), shellMat);
    const clear = new THREE.Mesh(petals ? new THREE.BufferGeometry() : sweepAround(THREE, S.rowAt, S.pts, S.split, S.pts.length - 1, S.yFn ? (x, z, j) => S.yFn(x, z, j + S.split) : null), clearMat);
    // pennoni della tenda: dalla base fino sopra la punta della membrana
    for (const [mx, mz] of S.masts) beam(beams, mx, 0, mz, mx, S.top + 4, mz, 0.6);
    outer.castShadow = outer.receiveShadow = true;
    clear.receiveShadow = true;
    group.add(outer, clear);
    own.push(tex, shellMat, clearMat, outer.geometry, clear.geometry);
    // fascia scura (vetrate e pilastri) tra la base e l'inizio dei cuscini, con la stessa pianta ovale
    const o = shape.outer, bandG = sweepAround(THREE, S.rowAt, [{ d: o + 1.2, h: S.base }, { d: o + 1.2, h: S.base + 3.4 }], 0, 1);
    const base = new THREE.Mesh(bandG, dark);
    base.receiveShadow = true;
    group.add(base);
    own.push(bandG);
    if (lights === 'roof') {
      // proiettori sotto il bordo dell'apertura
      const edge = S.rowAt(S.dIn + 0.8);
      for (let i = 0; i < edge.length - 1; i += 8) lampAt(lamps, edge[i][0], S.hIn - 1.4, edge[i][1], 2.4, 1.3);
      for (let k = 0; k < 6; k++) { const [x, z] = edge[Math.floor((k + 0.5) / 6 * (edge.length - 1))]; spots.push([x, S.hIn - 1.5, z]); }
    }
  }
  if (R) {
    const truss = st.roof === 'truss';
    const girders = st.roof === 'girders', ribbed = truss || girders; // girders: struttura nera sotto, come il reticolare
    const tex = new THREE.CanvasTexture(roofPanelCanvas(truss ? 'corrugated' : girders ? 'barrel' : 'plain'));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    deckMat = new THREE.MeshStandardMaterial({ map: tex, roughness: truss ? 0.5 : girders ? 0.35 : 0.7, metalness: truss ? 0.25 : 0, side: THREE.DoubleSide });
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
      for (const u of stations(run, cum, ribbed ? TRUSS_EVERY : TRUSS_EVERY * 1.5)) {
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
        const nearTower = (u) => towersAt.some(t => Math.min(Math.abs(u - t), run.closed ? total - Math.abs(u - t) : Infinity) < 8);
        for (const u of stations(run, cum, PYLON_EVERY)) {
          if (nearTower(u)) continue;
          pylon(beams, run, cum, u, PD, PH);
          const [x, z] = pointAt(run, cum, u, PD), [tx, tz] = tangentAt(run, cum, u, PD);
          drumAt(drums, x, PH + 0.9, z, tz, -tx, 1.25, 5.2);
        }
        const step = 4;
        for (const u of stations(run, cum, step)) {
          if (!run.closed && u + step > total + 1e-6) continue;
          for (const dd of [PD - 1.2, PD + 1.2]) {
            const [x0, z0] = pointAt(run, cum, u, dd), [x1, z1] = pointAt(run, cum, wrapU(run, total, u + step / 2), dd), [x2, z2] = pointAt(run, cum, wrapU(run, total, u + step), dd);
            beam(beams, x0, chordLow, z0, x1, chordHigh, z1, 0.18);
            beam(beams, x1, chordHigh, z1, x2, chordLow, z2, 0.18);
          }
        }
        // costole in rilievo sopra la lamiera
        for (const u of stations(run, cum, RIB_EVERY)) {
          const [x0, z0] = pointAt(run, cum, u, R.dIn), [x1, z1] = pointAt(run, cum, u, PD);
          beam(beams, x0, R.h(R.dIn) + 0.45, z0, x1, R.h(PD) + 0.45, z1, 0.9);
        }
      } else if (!girders) {
        // moderna: pilastri che reggono il tetto da fuori (con le travi rosse il tetto è appeso a loro)
        for (const u of stations(run, cum, SUPPORT_EVERY)) {
          const d = R.dOut - 1.5, [x, z] = pointAt(run, cum, u, d);
          beam(beams, x, 0, z, x, R.h(d) - 0.1, z, 0.7);
        }
      }
      if (lights === 'roof') {
        for (const u of stations(run, cum, LAMP_EVERY)) {
          const [x, z] = pointAt(run, cum, u, R.dIn + 0.6);
          lampAt(lamps, x, R.h(R.dIn) - 2.1, z, 2.4, 1.3);
        }
      }
    }
    if (lights === 'roof') {
      // di notte: sei luci lungo il bordo del tetto
      const run = { pts: shape.path, closed: true }, cum = runLengths(run), total = cum[cum.length - 1];
      for (let k = 0; k < 6; k++) { const [x, z] = pointAt(run, cum, (k + 0.5) * total / 6, R.dIn); spots.push([x, R.h(R.dIn) - 2, z]); }
    }
  }

  if (lights === 'towers' && G) {
    for (const [x, z] of G.towers) { lampAt(lamps, x, G.top + TOWER_OVER + 4, z, 10, 6); spots.push([x, G.top + TOWER_OVER + 4, z]); }
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
      const x = best.x + best.mx * d, z = best.z + best.mz * d;
      beam(beams, x, 0, z, x, H, z, 1.4);
      lampAt(lamps, x, H + 2.5, z, 10, 6);
      spots.push([x, H + 2.5, z]);
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
        for (const u of stations(side, scum, 4.5)) {
          if (u < 1.8 || u > stotal - 1.8) continue;
          const [x, z] = pointAt(side, scum, u, po - 0.25), [tx, tz] = tangentAt(side, scum, u, po - 0.25);
          boxAt(windows, x, 2.2, z, [tx * 2.6, 0, tz * 2.6], [0, 2.4, 0], [-tz * 0.16, 0, tx * 0.16]);
          boxAt(windows, x, 4.15, z, [tx * 2.6, 0, tz * 2.6], [0, 0.8, 0], [-tz * 0.16, 0, tx * 0.16]);
        }
      }
      // sulle curve la piattaforma poggia su pilastri (sotto è aperto)
      for (const curve of subRuns(run, (p) => !onLongSide(p))) {
        const ccum = runLengths(curve);
        for (const u of stations(curve, ccum, PILASTER_EVERY)) {
          for (const dd of [o + 2.4, po - 0.6]) { const [x, z] = pointAt(curve, ccum, u, dd); beam(pilasters, x, 0, z, x, Hp - 0.6, z, 0.75); }
        }
      }
      const cum = runLengths(run);
      for (const t of run.tiers) {
        const d0 = t.i === 0 ? t.D + 6 : t.D, d1 = t.back + WALL;
        const prevBack = t.i === 0 ? t.D + 6 : tiers[t.i - 1].back + WALL;
        for (const u of stations(run, cum, PILASTER_EVERY)) {
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
    // ogni tribuna ha il suo tetto (gli angoli restano aperti): sopra scuro, sotto pannelli traslucidi in una griglia di
    // travi del colore dell'acciaio, davanti una trave reticolare sottile con le luci; dietro la tribuna di fronte i piloni
    const Rs = roofOf(shape, 'stands', reachOf_(st)), T = shape.tiers[shape.tiers.length - 1], pos = [], idx = [[], [], []];
    const slabProf = [[Rs.dIn, Rs.h(Rs.dIn) - 0.25, 2], [Rs.dOut, Rs.h(Rs.dOut) - 0.25, 2], [Rs.dOut, Rs.h(Rs.dOut), 0], [Rs.dIn, Rs.h(Rs.dIn), 2]]
      .map(([d, h, m]) => ({ d, h, m }));
    const bar = (d, h, w, t) => [[d - w / 2, h - t / 2], [d + w / 2, h - t / 2], [d + w / 2, h + t / 2], [d - w / 2, h + t / 2]].map(([dd, hh]) => ({ d: dd, h: hh, m: 1 }));
    const under = [], underUv = [], underIdx = [];
    // un tetto per lato, staccato dagli altri agli angoli
    const gapA = shape.a - Math.max(shape.r, 4), gapB = shape.b - Math.max(shape.r, 4);
    const straight = (p) => (Math.abs(p.mz) > 0.995 && Math.abs(p.x) < gapA) || (Math.abs(p.mx) > 0.995 && Math.abs(p.z) < gapB);
    const TH = 2.4; // altezza della trave reticolare davanti
    for (const run of roofRuns) {
      // ogni tratto ha il suo tetto alla sua altezza (tribune e curve possono avere anelli diversi)
      const Rs = roofOf({ ...shape, tiers: run.tiers }, 'stands', reachOf_(st));
      const slabProf = [[Rs.dIn, Rs.h(Rs.dIn) - 0.25, 2], [Rs.dOut, Rs.h(Rs.dOut) - 0.25, 2], [Rs.dOut, Rs.h(Rs.dOut), 0], [Rs.dIn, Rs.h(Rs.dIn), 2]]
        .map(([d, h, m]) => ({ d, h, m }));
      for (const side of subRuns(run, straight)) {
        extrude(THREE, side, slabProf, pos, idx);
        // travi lungo la tribuna sotto il tetto (correnti della trave davanti e due arcarecci)
        for (const [d, h, w] of [[Rs.dIn + 0.3, Rs.h(Rs.dIn) - 0.4, 0.35], [Rs.dIn + 0.3, Rs.h(Rs.dIn) - TH, 0.35],
          [Rs.dIn + (Rs.dOut - Rs.dIn) * 0.4, Rs.h(Rs.dIn + (Rs.dOut - Rs.dIn) * 0.4) - 0.6, 0.3], [Rs.dIn + (Rs.dOut - Rs.dIn) * 0.75, Rs.h(Rs.dIn + (Rs.dOut - Rs.dIn) * 0.75) - 0.6, 0.3]]) {
          extrude(THREE, side, bar(d, h, w, w), pos, idx);
        }
        const cum = runLengths(side), total = cum[cum.length - 1];
        // pannelli traslucidi sotto il tetto (con coordinate per la griglia)
        const P = side.pts, b0 = under.length / 3;
        for (let k = 0; k < P.length; k++) {
          for (const d of [Rs.dIn, Rs.dOut]) { under.push(P[k].x + P[k].mx * d, Rs.h(d) - 0.3, P[k].z + P[k].mz * d); underUv.push(cum[k] / 6, (d - Rs.dIn) / 6); }
          if (k) { const a = b0 + (k - 1) * 2, c = a + 2; underIdx.push(a, c, a + 1, a + 1, c, c + 1); }
        }
        for (const u of stations(side, cum, 6)) {
          // trave a sbalzo dal muro al bordo davanti, con la saetta; montanti e diagonali della trave davanti
          const [x0, z0] = pointAt(side, cum, u, Rs.dOut - 0.4), [x1, z1] = pointAt(side, cum, u, Rs.dIn + 0.3), [xm, zm] = pointAt(side, cum, u, (Rs.dIn + Rs.dOut) / 2);
          beam(beams, x0, Rs.h(Rs.dOut) - 0.7, z0, x1, Rs.h(Rs.dIn) - 0.7, z1, 0.45);
          beam(beams, x0, Rs.h(Rs.dOut) - 4, z0, xm, Rs.h((Rs.dIn + Rs.dOut) / 2) - 0.8, zm, 0.3);
          beam(beams, x1, Rs.h(Rs.dIn) - 0.4, z1, x1, Rs.h(Rs.dIn) - TH, z1, 0.22);
          const [x2, z2] = pointAt(side, cum, Math.min(total, u + 3), Rs.dIn + 0.3);
          beam(beams, x1, Rs.h(Rs.dIn) - TH, z1, x2, Rs.h(Rs.dIn) - 0.4, z2, 0.18);
        }
        if (lights === 'roof') {
          for (const u of stations(side, cum, 4)) { const [x, z] = pointAt(side, cum, u, Rs.dIn + 0.9); lampAt(lamps, x, Rs.h(Rs.dIn) - TH - 0.3, z, 1.4, 0.8); }
          for (const f of [0.25, 0.75]) { const [x, z] = pointAt(side, cum, total * f, Rs.dIn); spots.push([x, Rs.h(Rs.dIn) - 2, z]); }
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    let start = 0;
    idx.forEach((list, m) => { g.addGroup(start, list.length, m); start += list.length; });
    g.setIndex(idx.flat());
    g.computeVertexNormals();
    const topMat = new THREE.MeshStandardMaterial({ color: 0x8d949c, roughness: 0.7, side: THREE.DoubleSide });
    const roof = new THREE.Mesh(g, [topMat, steel, steel]);
    roof.castShadow = true;
    roof.receiveShadow = true;
    group.add(roof);
    // pannelli traslucidi: lasciano passare la luce (un po' di luce propria) e mostrano la griglia
    const gridC = document.createElement('canvas'); gridC.width = gridC.height = 128;
    const gx = gridC.getContext('2d');
    gx.fillStyle = '#ffffff'; gx.fillRect(0, 0, 128, 128);
    gx.fillStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i < 128; i += 16) gx.fillRect(i, 0, 2, 128);
    gx.fillStyle = '#5c6b80'; gx.fillRect(0, 0, 128, 7); gx.fillRect(0, 0, 7, 128);
    const gridTex = new THREE.CanvasTexture(gridC);
    gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping; gridTex.colorSpace = THREE.SRGBColorSpace; gridTex.anisotropy = 4;
    deckMat = new THREE.MeshStandardMaterial({ map: gridTex, emissive: 0xffffff, emissiveMap: gridTex, emissiveIntensity: 0.35, roughness: 0.5, side: THREE.DoubleSide });
    const ug = new THREE.BufferGeometry();
    ug.setAttribute('position', new THREE.Float32BufferAttribute(under, 3));
    ug.setAttribute('uv', new THREE.Float32BufferAttribute(underUv, 2));
    ug.setIndex(underIdx);
    ug.computeVertexNormals();
    group.add(new THREE.Mesh(ug, deckMat));
    own.push(g, ug, topMat, deckMat, gridTex);
    // due piloni a traliccio dietro la tribuna di fronte, con i tiranti verso il tetto
    const far = shape.path.filter(p => p.mz < -0.995), xs = far.map(p => p.x);
    if (xs.length) {
      const hx = Math.max(...xs) * 0.9, zb = -(shape.b + Rs.dOut + 5), top = Rs.h(Rs.dIn) + 14;
      for (const sx of [-1, 1]) {
        const x = sx * hx;
        beam(beams, x, T.top * 0.5, zb, x, top, zb + 3, 1);
        beam(beams, x - sx * 4, top - 6, zb + 2, x, top, zb + 3, 0.6);
        for (const f of [0.12, 0.3]) beam(beams, x, top, zb + 3, x - sx * hx * f * 2, Rs.h(Rs.dIn) - 0.3, -(shape.b + Rs.dIn + 0.5), 0.12);
      }
    }
  }

  if (st.facade === 'panels') {
    // rivestimento a pannelli del colore delle fasce, con le giunture verticali e la fascia luminosa in cima
    const pos = [], idx = [[], [], []];
    for (const ring of shape.runs) {
    const o = runOuter(ring), H = runTop(ring).top + 2.2;
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
    for (const ring of shape.runs) {
    const cum = runLengths(ring), o = runOuter(ring), H = runTop(ring).top + 2.2;
    for (const u of stations(ring, cum, 4.5)) {
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
    const o = runOuter(ring), H = runTop(ring).top + 2.2;
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
    for (const ring of shape.runs) {
    const cum = runLengths(ring), o = runOuter(ring), H = runTop(ring).top + 2.2;
    for (const u of stations(ring, cum, 3.2)) {
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
    const o0 = Math.min(...shape.runs.map(runOuter)), o = shape.outer, H = ESPLANADE_H, W = ESPLANADE_W, ring = { pts: shape.path, closed: true };
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
    for (const u of stations(ring, cum, 9)) {
      for (const d of [o + W - 1.2, o + W - 4.5]) { const [x, z] = pointAt(ring, cum, u, d); beam(pilasters, x, 0, z, x, H - 0.8, z, 0.8); }
    }
  }

  if (st.facade === 'bands') {
    // fasce orizzontali chiare e sporgenti (come le rampe di San Siro) sul muro esterno più scuro
    const rect = (d0, d1, h0, h1, m) => [[d0, h0], [d1, h0], [d1, h1], [d0, h1]].map(([d, h]) => ({ d, h, m }));
    const pos = [], idx = [[], [], []];
    for (const run of shape.runs) {
      const o = runOuter(run), Ht = runTop(run).top + 2.2;
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
    const bands = new THREE.Mesh(g, [parapetMat, dark, structMat]); // 2 = tappi dei tratti aperti
    bands.castShadow = bands.receiveShadow = true;
    group.add(bands);
    own.push(g);
  }

  // torri cilindriche con la rampa a spirale (anima scura, fascia bianca che sale girando) fino a Hs;
  // le torri d'angolo continuano sopra con un cilindro bianco liscio fino a H
  let towerCount = 0;
  const spiralTower = (x, z, r, Hs, H = Hs) => {
    const core = r * 0.74, t = RAMP_BAND, SEG = 40, dir = towerCount++ % 2 ? 1 : -1; // le torri vicine girano in versi opposti
    boxAt(towerCores, x, Hs / 2, z, [core, 0, 0], [0, Hs, 0], [0, 0, core]);
    if (H > Hs + 0.5) boxAt(towerCaps, x, (Hs + H) / 2, z, [r, 0, 0], [0, H - Hs, 0], [0, 0, r]);
    else boxAt(towerCaps, x, Hs - 0.3, z, [r, 0, 0], [0, 0.6, 0], [0, 0, r]);
    const y0 = 1.2 + t / 2, steps = Math.floor((Hs - 0.6 - t / 2 - y0) / RAMP_PITCH * SEG);
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
      const cum = runLengths(run), foot = footOf({ ...shape, outer: runOuter(run) }, st), H = runTop(run).top + 2.2;
      for (const u of rampStations(run, cum)) {
        const [x, z] = pointAt(run, cum, u, foot + RAMP_R - 0.4);
        spiralTower(x, z, RAMP_R, H);
      }
    }
  }

  if (G) {
    const Hs = shape.tiers[shape.tiers.length - 1].top + 2.2;
    for (const [x, z] of G.towers) spiralTower(x, z, CORNER_R, Hs, G.top + TOWER_OVER);
    // trave reticolare piana da (x1, z1) a (x2, z2): correnti a quota yb(s) e yt(s), montanti e diagonali alternate
    const planeTruss = (x1, z1, x2, z2, yb, yt, panels, tc, tm) => {
      let prev = null;
      for (let k = 0; k <= panels; k++) {
        const f = k / panels, x = x1 + (x2 - x1) * f, z = z1 + (z2 - z1) * f, b = yb(f), tp = yt(f);
        beam(girderBeams, x, b, z, x, tp, z, tm);
        if (prev) {
          beam(girderBeams, prev.x, prev.b, prev.z, x, b, z, tc);
          beam(girderBeams, prev.x, prev.tp, prev.z, x, tp, z, tc);
          if (k % 2) beam(girderBeams, prev.x, prev.b, prev.z, x, tp, z, tm); else beam(girderBeams, prev.x, prev.tp, prev.z, x, b, z, tm);
        }
        prev = { x, z, b, tp };
      }
    };
    // travi principali: due pareti reticolari unite da traversi, da una torre all'altra
    const girder = (x1, z1, x2, z2) => {
      const len = Math.hypot(x2 - x1, z2 - z1), nx = -(z2 - z1) / len, nz = (x2 - x1) / len;
      const n = Math.max(2, Math.round(len / GIRDER_PANEL)), y0 = G.y0, y1 = G.top;
      for (const side of [-1, 1]) {
        planeTruss(x1 + nx * GIRDER_W * side, z1 + nz * GIRDER_W * side, x2 + nx * GIRDER_W * side, z2 + nz * GIRDER_W * side, () => y0, () => y1, n, 0.9, 0.5);
      }
      for (let k = 0; k <= n; k++) {
        const x = x1 + (x2 - x1) * k / n, z = z1 + (z2 - z1) * k / n;
        beam(girderBeams, x - nx * GIRDER_W, y0, z - nz * GIRDER_W, x + nx * GIRDER_W, y0, z + nz * GIRDER_W, 0.4);
        beam(girderBeams, x - nx * GIRDER_W, y1, z - nz * GIRDER_W, x + nx * GIRDER_W, y1, z + nz * GIRDER_W, 0.4);
      }
    };
    girder(-G.X, G.Z, G.X, G.Z); girder(-G.X, -G.Z, G.X, -G.Z);
    girder(G.X, -G.Z, G.X, G.Z); girder(-G.X, -G.Z, -G.X, G.Z);

    // anello interno (due pareti lungo il bordo interno del tetto) e travi trasversali fino al bordo esterno:
    // con le travi principali formano la griglia rossa sopra la copertura
    const R2 = roofOf(shape, st.roof, reachOf_(st)), ri = [R2.dIn + 1.2, R2.dIn + 4.2], hRing = 4.5;
    for (const run of roofRuns) {
      const cum = runLengths(run), st5 = stations(run, cum, 5), last = run.closed ? st5.length : st5.length - 1;
      for (let i = 0; i < last; i++) {
        const ua = st5[i], ub = st5[(i + 1) % st5.length] || cum[cum.length - 1];
        for (const d of ri) {
          const [xa, za] = pointAt(run, cum, ua, d), [xb, zb] = pointAt(run, cum, ub, d);
          planeTruss(xa, za, xb, zb, () => R2.h(d) + 0.5, () => R2.h(d) + 0.5 + hRing, 1, 0.55, 0.35);
        }
        const [xa, za] = pointAt(run, cum, ua, ri[0]), [xb, zb] = pointAt(run, cum, ua, ri[1]);
        beam(girderBeams, xa, R2.h(ri[0]) + 0.5 + hRing, za, xb, R2.h(ri[1]) + 0.5 + hRing, zb, 0.35);
      }
      for (const u of stations(run, cum, 13)) {
        const [xa, za] = pointAt(run, cum, u, ri[1]), [xb, zb] = pointAt(run, cum, u, R2.dOut - 0.3);
        const span = R2.dOut - 0.3 - ri[1];
        const yb = (f) => R2.h(ri[1] + span * f) + 0.5;
        planeTruss(xa, za, xb, zb, yb, (f) => yb(f) + hRing + 4 * f, Math.max(2, Math.round(span / 4)), 0.55, 0.35);
      }
    }

    // sbalzi rossi a cuneo fuori dalle torri, uno per ogni trave che ci passa sopra (punte rialzate)
    for (const [tx0, tz0] of G.towers) {
      for (const [dx, dz] of [[Math.sign(tx0), 0], [0, Math.sign(tz0)]]) {
        const nx = -dz, nz = dx, w = GIRDER_W + 0.5, s0 = CORNER_R * 0.6, s1 = CORNER_R + GIRDER_L;
        const P = (sv, y, side) => [tx0 + dx * sv + nx * w * side, y, tz0 + dz * sv + nz * w * side];
        const nb = [s0, G.y0], nt = [s0, G.top + 0.5], tb = [s1, G.top - 2.5], tt = [s1, G.top + 3.5];
        const c = [tx0 + dx * (s0 + s1) / 2, (G.y0 + G.top) / 2 + 1, tz0 + dz * (s0 + s1) / 2];
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
      const cum = runLengths(run), total = cum[cum.length - 1], H = runTop(run).top + 2.2, d = runOuter(run) + 0.35;
      for (const u of stations(run, cum, PILASTER_EVERY)) {
        const [x, z] = pointAt(run, cum, u, d);
        const [xa, za] = pointAt(run, cum, Math.max(0, u - 0.5), d), [xb, zb] = pointAt(run, cum, Math.min(total, u + 0.5), d);
        const tl = Math.hypot(xb - xa, zb - za) || 1, tx = (xb - xa) / tl, tz = (zb - za) / tl;
        boxAt(pilasters, x + tz * 0.35, H / 2, z - tx * 0.35, [tx * 1.1, 0, tz * 1.1], [0, H, 0], [-tz * 0.7, 0, tx * 0.7]);
      }
    }
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
  inst(steel, beams);
  inst(structMat, pilasters);
  inst(glass, windows);
  inst(screenFrame, frames);
  inst(dark, seams);
  inst(sculptMat, sculpt);
  if (bandPos.length) {
    // fasce orizzontali dei piani sulle vetrate
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(bandPos, 3));
    g.setIndex(bandIdx[0]);
    g.computeVertexNormals();
    group.add(new THREE.Mesh(g, structMat));
    own.push(g);
  }
  inst(dark, towerCores, cylinder);
  inst(parapetMat, towerCaps, cylinder);
  inst(steel, drums, cylinder);
  for (const [surf, mat] of [[ramps, parapetMat], [wedges, girderMat]]) {
    const g = surf.geometry(THREE);
    if (!g) continue;
    const m = new THREE.Mesh(g, mat);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    own.push(g);
  }
  inst(girderMat, girderBeams);
  inst([steel, steel, steel, steel, lamp, steel], lamps); // la faccia +z del proiettore è quella accesa

  return { group, steel, deckMat, shellMat, lamp, accent, dark, girder: girderMat, spots, screen, roofDecor };
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

  // fondo (sotto tutto lo stadio) con erba, pista e pavimento dipinti
  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = 2048; baseCanvas.height = Math.round(2048 * ext.z / ext.x);
  const baseTex = new THREE.CanvasTexture(baseCanvas);
  baseTex.colorSpace = THREE.SRGBColorSpace;
  const foot = shape.path.map(p => new THREE.Vector2(p.x + p.mx * reach.d, p.z + p.mz * reach.d));
  const baseGeo = new THREE.BufferGeometry();
  baseGeo.setAttribute('position', new THREE.Float32BufferAttribute(foot.flatMap(v => [v.x, 0, v.y]), 3));
  baseGeo.setAttribute('normal', new THREE.Float32BufferAttribute(foot.flatMap(() => [0, 1, 0]), 3));
  baseGeo.setAttribute('uv', new THREE.Float32BufferAttribute(foot.flatMap(v => [(v.x + ext.x) / (ext.x * 2), 1 - (v.y + ext.z) / (ext.z * 2)]), 2));
  // triangoli rivolti verso l'alto (il percorso è antiorario visto dall'alto: va girato)
  baseGeo.setIndex(THREE.ShapeUtils.triangulateShape(foot, []).flatMap(([i, j, k]) => [i, k, j]));
  const baseMat = new THREE.MeshStandardMaterial({ map: baseTex, roughness: 1 });
  addDetail(THREE, baseMat, detail, new THREE.Vector2(ext.x * 2 / 3, ext.z * 2 / 3), 0.18);
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.receiveShadow = true;
  group.add(base);
  own.push(baseGeo, baseMat, baseTex);

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

  let paintKey = '', seatColorKey = '', signKey = '', screenKey = '', sign = null, night = false;
  return {
    key: geomKey(st), group, shape, ext, height: reach.h, capacity: seats.count,
    setNight(on) {
      night = on;
      if (sign) sign.glow(on); // la scritta si accende
      outside.lamp.emissiveIntensity = on ? 5 : 0.6;
      if (outside.shellMat) outside.shellMat.emissiveIntensity = on ? 0.85 : 0; // l'involucro si accende
      nightLights.forEach(l => { l.visible = on; });
    },
    recolor(s) {
      const c = s.colors;
      outside.steel.color.set(c.steel);
      outside.accent.color.set(c.accent);
      outside.dark.color.set(shade(c.structure, 0.62));
      outside.girder.color.set(c.girder);
      if (outside.deckMat) outside.deckMat.color.set(c.roof);
      if (outside.roofDecor) {
        outside.roofDecor.tubes.color.set(c.steel);
        if (outside.roofDecor.floor) outside.roofDecor.floor.color.set(shade(c.structure, 0.85));
      }
      if (outside.shellMat) { outside.shellMat.color.set(c.roof); if (SHELLISH.includes(s.roof)) outside.shellMat.emissive.set(c.glow); }
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
      const pk = [c.grass, c.track, c.trackLines, c.structure, s.mowing, s.trackApron ? c.apron : ''].join('|');
      if (pk !== paintKey) {
        paintKey = pk;
        paintPitch(pitchCanvas, s); pitchTex.needsUpdate = true;
        paintBase(baseCanvas, s, shape, ext); baseTex.needsUpdate = true;
      }
      const sk = JSON.stringify([s.seatMode, c.seatA, c.seatB, c.seatC, c.seatD, c.mosaicB, c.mosaicC, s.seatGrid, s.seatMosaic, s.standText, s.standTextSide, s.standTextRing, s.standTextFont, c.standText]);
      if (sk !== seatColorKey) {
        seatColorKey = sk;
        // tavolozza: 0-3 colori A-D, 4-15 settore e anello (lato * 3 + anello); ognuno con le varianti per il mosaico
        const white = new THREE.Color(1, 1, 1);
        const pal = [c.seatA, c.seatB, c.seatC, c.seatD];
        for (let side = 0; side < 4; side++) for (let r = 0; r < 3; r++) pal.push(s.seatGrid[gridKey(side, r)]);
        const mixB = new THREE.Color(c.mosaicB), mixC = new THREE.Color(c.mosaicC);
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
          else if (s.seatMosaic === 'mix') col = h < 0.6 ? base[k] : h < 0.88 ? mixB : mixC;
          if (mask && mask[i]) col = txt;
          arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b;
        }
        seatMesh.instanceColor.needsUpdate = true;
      }
    },
    dispose() { own.forEach(o => o.dispose()); seatMesh.dispose(); if (sign) sign.dispose(); }
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

  /** Mostra lo stadio: ricostruisce la geometria solo se cambia la struttura, altrimenti cambia i colori. */
  setStadium(st) {
    if (!this.built || this.built.key !== geomKey(st)) {
      if (this.built) { this.scene.remove(this.built.group); this.built.dispose(); }
      this.built = buildStadium(this.L, st);
      this.built.setNight(this.night);
      this.scene.add(this.built.group);
      this.fit();
    }
    this.built.recolor(st);
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
 * Restituisce { ready, update(stadium) → capienza, setView('aerial'|'top'|'stand'|'outside'), setNight(on), zoomBy(f), dispose() }.
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
    async update(st) {
      const my = ++token, n = normalizeStadium(st);
      const [s] = await Promise.all([ready, loadTextFonts(n)]);
      if (!s || disposed || my !== token) return 0;
      const capacity = s.setStadium(n);
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

/** Foto PNG dello stadio (data URL, sfondo trasparente, ritagliata). opts: { width (default 800), view } */
export function renderStadiumImage(st, opts = {}) {
  const width = Math.round(opts.width || 800), height = Math.round(width * 0.6);
  const job = queue.then(async () => {
    const L = await loadLib();
    if (!shot) shot = new Stage(L, document.createElement('canvas'), { width, height });
    shot.resize(width, height);
    shot.setNight(false);
    const n = normalizeStadium(st);
    await loadTextFonts(n);
    shot.setStadium(n);
    shot.setView(opts.view || 'aerial');
    shot.render();
    return cropToContent(shot.renderer.domElement);
  }).catch(e => { console.error('Stadio 3D:', e); return ''; });
  queue = job;
  return job;
}
