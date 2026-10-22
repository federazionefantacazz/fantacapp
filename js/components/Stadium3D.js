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
  { id: 'mosaic',  label: 'Mosaico' },
  { id: 'sides',   label: 'Un colore per lato' }
];
export const ROOFS = [
  { id: 'none',     label: 'Nessuna' },
  { id: 'truss',    label: 'Reticolare in acciaio' },
  { id: 'membrane', label: 'Moderna' },
  { id: 'girders',  label: 'Travi rosse su torri' },
  { id: 'shell',    label: 'Involucro a cuscini' }
];
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
  { id: 'esplanade', label: 'Spianata rialzata' }
];

const DEFAULT = {
  name: '', rings: 2, track: false, shape: 'rounded', corners: 'closed', mowing: 'stripes', seatMode: 'single',
  roof: 'none', lights: 'towers', facade: 'wall', ramps: false,
  colors: {
    grass: '#3d8b37', track: '#b4452f', seatA: '#1e5bb8', seatB: '#ffffff', seatC: '#c62828', seatD: '#ffd400', parapet: '#e6e6e6', structure: '#a5a5a5',
    roof: '#5b6169', steel: '#767d86', accent: '#1e5bb8', girder: '#c0392b', glow: '#e30613'
  }
};

/** Stili rapidi: cambiano struttura, copertura e colori (il nome resta). */
export const PRESETS = [
  {
    id: 'maradona', label: 'Stile Maradona',
    desc: 'Ovale con pista blu, due anelli a mosaico azzurro, tetto in lamiera retto da piloni a traliccio, cemento a vista e basamento bianco.',
    st: {
      rings: 2, track: true, shape: 'oval', corners: 'closed', mowing: 'stripes', seatMode: 'mosaic', roof: 'truss', lights: 'roof', facade: 'struts',
      colors: { grass: '#3f8a35', track: '#1f5fbf', seatA: '#29a3e0', seatB: '#1565c0', seatC: '#ffffff', parapet: '#ececec', structure: '#b3b1ab', roof: '#a9aeb3', steel: '#858c93', accent: '#1f6fd1' }
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
    id: 'english', label: 'Stile inglese',
    desc: 'Quattro tribune squadrate attaccate al campo, senza pista, tetto moderno.',
    st: {
      rings: 2, track: false, shape: 'rect', corners: 'closed', mowing: 'checks', seatMode: 'single', roof: 'membrane', lights: 'roof', facade: 'wall',
      colors: { grass: '#3b8a34', seatA: '#c62828', parapet: '#f2f2f2', structure: '#9e9e9e', roof: '#e9ecef', steel: '#d0d4d9' }
    }
  },
  {
    id: 'arena', label: 'Arena moderna',
    desc: 'Tre anelli con angoli arrotondati, seggiolini a mosaico e copertura chiara.',
    st: {
      rings: 3, track: false, shape: 'rounded', corners: 'closed', mowing: 'stripes', seatMode: 'mosaic', roof: 'membrane', lights: 'roof', facade: 'columns',
      colors: { grass: '#3d8b37', seatA: '#212121', seatB: '#616161', seatC: '#ffd400', parapet: '#e0e0e0', structure: '#8d8d8d', roof: '#f1f3f5', steel: '#c8cdd3' }
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

/** Stadio con lo stile rapido applicato: nome (e foto, capienza) restano quelli di `st`. */
export function applyPreset(st, id) {
  const p = PRESETS.find(x => x.id === id);
  if (!p) return normalizeStadium(st);
  const base = defaultStadium();
  return normalizeStadium({ ...base, ...p.st, colors: { ...base.colors, ...p.st.colors }, name: st.name, capacityCustom: st.capacityCustom, image: st.image, capacity: st.capacity });
}

export function defaultStadium() { return JSON.parse(JSON.stringify(DEFAULT)); }

const validColor = (c, def) => (/^#[0-9a-f]{6}$/i.test(String(c || '')) ? String(c).toLowerCase() : def);
const oneOf = (list, v, def) => (list.some(o => o.id === v) ? v : def);

/** Stadio con tutti i campi validi (quelli mancanti o sbagliati tornano ai valori predefiniti). */
export function normalizeStadium(s) {
  const src = s && typeof s === 'object' ? s : {};
  const c = src.colors || {};
  const out = {
    name: String(src.name || '').slice(0, MAX_NAME),
    rings: oneOf(RINGS, Number(src.rings), DEFAULT.rings),
    track: !!src.track,
    shape: oneOf(SHAPES, src.shape, DEFAULT.shape),
    corners: oneOf(CORNERS, src.corners, DEFAULT.corners),
    mowing: oneOf(MOWING, src.mowing, DEFAULT.mowing),
    seatMode: oneOf(SEAT_MODES, src.seatMode, DEFAULT.seatMode),
    roof: oneOf(ROOFS, src.roof, DEFAULT.roof),
    lights: oneOf(LIGHTS, src.lights, DEFAULT.lights),
    facade: oneOf(FACADES, src.facade, DEFAULT.facade),
    ramps: !!src.ramps,
    // capienza scelta dalla squadra (0 = calcolata dai seggiolini)
    capacityCustom: Math.min(MAX_CAPACITY, Math.max(0, Math.round(Number(src.capacityCustom) || 0))),
    colors: Object.fromEntries(Object.entries(DEFAULT.colors).map(([k, d]) => [k, validColor(c[k], d)]))
  };
  if (src.image) out.image = String(src.image);
  if (src.capacity) out.capacity = Number(src.capacity) || 0;
  return out;
}

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
const M_PARAPET = 0, M_STEPS = 1, M_STRUCT = 2;

const seatKey = (st) => [st.rings, st.track ? 1 : 0, st.shape, st.corners].join('|');
const geomKey = (st) => [seatKey(st), st.roof, st.lights, st.facade, st.ramps ? 1 : 0].join('|');

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
  ROWS[st.rings].forEach((rows, i) => {
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
  return { a, b, r, tiers, path, runs: buildRuns(path, a, b, st.corners), outer: Math.max(...tiers.map(t => t.back)) + WALL, height: last.top + 2.2 };
}

/** Profilo di un anello (d = distanza dal bordo, h = altezza): parapetto, gradoni, muro dietro, sotto. */
function tierProfile(t, next, exposed) {
  const pts = [];
  const add = (d, h, m) => pts.push({ d, h, m }); // m = materiale del lato che parte da questo punto
  add(t.D, t.i === 0 ? 0 : t.H - 1.6, M_PARAPET);
  add(t.D, t.H + 1, M_PARAPET);
  add(t.D + 0.25, t.H + 1, M_PARAPET);
  add(t.D + 0.25, t.H, M_STEPS);
  for (let k = 0; k < t.rows; k++) {
    const last = k === t.rows - 1;
    add(t.D + (k + 1) * TREAD, t.H + k * t.R, last ? M_STRUCT : M_STEPS);
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
function standsGeometry(THREE, shape, exposed) {
  const pos = [], idx = [[], [], []];
  for (const run of shape.runs) {
    shape.tiers.forEach((t, i) => {
      extrude(THREE, run, tierProfile(t, shape.tiers[i + 1], exposed), pos, idx);
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
 * Seggiolini: una matrice per posto (lungo ogni fila, rivolto verso il campo) e info = settore | anello << 1 | lato << 3
 * (settore 0 = tribune sui lati lunghi, 1 = curve; lato 0 = tribuna verso z+, 1 = curva destra, 2 = distinti, 3 = curva sinistra).
 * Le scalette sono allineate da una fila all'altra.
 */
const seatCache = new Map();
function seatsOf(st) {
  const key = seatKey(st);
  if (seatCache.has(key)) return seatCache.get(key);
  const shape = shapeOf(st);
  const mats = [], info = [];
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
    for (const t of shape.tiers) {
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
          }
          carry = s - l;
        }
      }
    }
  }
  const val = { count: info.length, matrices: new Float32Array(mats), info: Uint8Array.from(info) };
  if (seatCache.size >= 4) seatCache.delete(seatCache.keys().next().value);
  seatCache.set(key, val);
  return val;
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
  if (st.track) { ctx.beginPath(); ovalPath(ctx, TRACK.r - 0.3); ctx.clip(); }
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
  ctx.fillStyle = shade(st.colors.grass, 0.95);
  ctx.beginPath();
  shape.path.forEach((p, i) => (i ? ctx.lineTo(p.x, p.z) : ctx.moveTo(p.x, p.z)));
  ctx.closePath();
  ctx.fill();
  if (!st.track) return;
  const outer = TRACK.r + TRACK.lanes * TRACK.lane;
  ctx.fillStyle = st.colors.track;
  ctx.beginPath(); ovalPath(ctx, outer + 0.6); ovalPath(ctx, TRACK.r - 0.3); ctx.fill('evenodd');
  ctx.strokeStyle = 'rgba(255,255,255,.8)';
  ctx.lineWidth = Math.max(0.06, 1.1 / s);
  for (let k = 0; k <= TRACK.lanes; k++) { ctx.beginPath(); ovalPath(ctx, TRACK.r + k * TRACK.lane); ctx.stroke(); }
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
function roofOf(shape, roof) {
  const top = shape.tiers[shape.tiers.length - 1];
  const dIn = roof === 'girders' ? 4 : Math.max(top.D - 2, 3), dOut = shape.outer + 4, hIn = top.top + 9;
  return { dIn, dOut, h: (d) => hIn - (d - dIn) * 0.04, depth: (d) => 1.4 + 3.6 * (d - dIn) / (dOut - dIn) };
}

const towerHeight = (shape, st) => (st.roof !== 'none' ? roofOf(shape, st.roof).h(0) : shape.height) + 18;
const towerDist = (shape, st) => Math.max(shape.outer, st.roof !== 'none' ? roofOf(shape, st.roof).dOut : 0) + 6;

/** Piloni a traliccio del tetto reticolare: appena fuori dal bordo del tetto, più alti di lui. */
const pylonDist = (R) => R.dOut + 1.5;
const pylonHeight = (R) => R.h(R.dOut) + 7;

/** Distanza dal bordo occupata dal muro esterno (con basamento o fasce). */
const footOf = (shape, st) => shape.outer + ({ struts: PLATFORM_OUT + 0.2, bands: 1.8, columns: 0.8, esplanade: ESPLANADE_W + 0.2 }[st.facade] || 0);

/**
 * Profilo dell'involucro a cuscini (stile Allianz Arena), come punti (d, h): parte poco sopra la base, si gonfia
 * verso fuori, gira sopra gli spalti e continua come tetto trasparente fino all'apertura sopra il campo.
 * `split` = indice del primo punto della parte trasparente.
 */
function shellOf(shape, st) {
  const T = shape.tiers[shape.tiers.length - 1], o = shape.outer;
  const base = st.facade === 'esplanade' ? ESPLANADE_H : 0, h0 = base + 3, crest = T.top + 9;
  const drop = Math.min(12, (crest - h0) * 0.32), dIn = 2;   // il tetto scende verso l'apertura, sopra il bordo del campo
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
  return { pts, split, base, dIn, hIn: crest - drop, top: crest, out: o + 12, rowAt };
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
  const R = roofOf(shape, st.roof), foot = footOf(shape, st);
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
  if (st.roof === 'shell') { const S = shellOf(shape, st); d = Math.max(d, S.out + 1); h = Math.max(h, S.top + 1); }
  else if (st.roof !== 'none') { const R = roofOf(shape, st.roof); d = Math.max(d, st.roof === 'truss' ? pylonDist(R) + 2.5 : R.dOut); h = Math.max(R.h(R.dIn), st.roof === 'truss' ? pylonHeight(R) : 0) + 1; }
  if (st.ramps) d = Math.max(d, foot + RAMP_R * 2);
  if (st.roof === 'girders') {
    const G = girdersOf(shape, st);
    d = Math.max(d, foot + CORNER_R * 2 + 2);
    h = Math.max(h, G.top + TOWER_OVER + 8);
    x = G.X + GIRDER_L + 2; z = G.Z + GIRDER_L + 2;
  } else if (lightsOf(st) === 'towers') { d = Math.max(d, towerDist(shape, st) + 6); h = towerHeight(shape, st) + 6; }
  return { d: d + 1.5, h, x, z };
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

/** Punto del bordo su un lato lungo (tribune), non sulle curve. */
const onLongSide = (p) => Math.abs(p.mz) > 0.995;

/** Cuscini a rombo dell'involucro (quasi bianchi: il colore scelto li tinge), con le giunture più scure. */
function cushionCanvas() {
  const W = 256, H = 164, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#868e97'; ctx.fillRect(0, 0, W, H);
  for (const [cx, cy] of [[W / 2, H / 2], [0, 0], [W, 0], [0, H], [W, H]]) {
    // cuscino gonfio: chiaro in alto al centro, più scuro verso le giunture
    const g = ctx.createRadialGradient(cx - W * 0.06, cy - H * 0.14, 2, cx, cy, W * 0.42);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#eef0f3'); g.addColorStop(1, '#bcc3cb');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx, cy - H / 2 + 3); ctx.lineTo(cx + W / 2 - 4, cy); ctx.lineTo(cx, cy + H / 2 - 3); ctx.lineTo(cx - W / 2 + 4, cy);
    ctx.closePath(); ctx.fill();
  }
  return c;
}

/**
 * Superficie che gira tutto intorno allo stadio con il profilo `prof` (punti d, h), dalla riga j0 alla j1;
 * rowAt(d) dà la pianta chiusa a quella distanza. Coordinate per la texture lungo la pianta (numero intero di
 * cuscini per giro, niente cuciture) e lungo il profilo.
 */
function sweepAround(THREE, rowAt, prof, j0, j1) {
  const pos = [], uv = [], idx = [];
  let v = 0, cols = 0;
  for (let j = j0; j <= j1; j++) {
    if (j > j0) v += Math.hypot(prof[j].d - prof[j - 1].d, prof[j].h - prof[j - 1].h) / SHELL_CELL_V;
    const { d, h } = prof[j], row = rowAt(d), us = [0];
    cols = row.length;
    for (let i = 1; i < cols; i++) us.push(us[i - 1] + Math.hypot(row[i][0] - row[i - 1][0], row[i][1] - row[i - 1][1]));
    const len = us[cols - 1] || 1, cells = Math.max(1, Math.round(len / SHELL_CELL_U));
    for (let i = 0; i < cols; i++) { pos.push(row[i][0], h, row[i][1]); uv.push(us[i] / len * cells, v); }
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
  const towerCores = [], towerCaps = [], girderBeams = [], drums = [];
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

  const R = st.roof !== 'none' && st.roof !== 'shell' ? roofOf(shape, st.roof) : null;
  let shellMat = null;
  if (st.roof === 'shell') {
    // involucro a cuscini: parte bianca (fuori e sopra) e tetto trasparente fino all'apertura; gira tutto intorno
    // anche con le curve staccate. Di notte i cuscini si accendono del colore scelto.
    const S = shellOf(shape, st);
    const tex = new THREE.CanvasTexture(cushionCanvas());
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    shellMat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissiveIntensity: 0, roughness: 0.38, side: THREE.DoubleSide });
    // la parte verso l'apertura è di cuscini trasparenti: un po' più grigia e non fa ombra
    const clearMat = new THREE.MeshStandardMaterial({ map: tex, color: 0xe3e6ea, roughness: 0.25, side: THREE.DoubleSide });
    const outer = new THREE.Mesh(sweepAround(THREE, S.rowAt, S.pts, 0, S.split), shellMat);
    const clear = new THREE.Mesh(sweepAround(THREE, S.rowAt, S.pts, S.split, S.pts.length - 1), clearMat);
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
    const deck = new THREE.Mesh(deckGeometry(THREE, shape, R), deckMat);
    deck.castShadow = deck.receiveShadow = true;
    group.add(deck);
    own.push(tex, deckMat, deck.geometry);

    // travi lungo tutto il tetto: bordo davanti e, nel reticolare, i correnti inferiori
    const N = Math.max(2, Math.round((R.dOut - R.dIn) / 3.5));
    const pos = [], idx = [[], [], []];
    const bar = (d, h, w, t) => [{ d: d - w / 2, h: h - t / 2, m: 0 }, { d: d + w / 2, h: h - t / 2, m: 0 }, { d: d + w / 2, h: h + t / 2, m: 0 }, { d: d - w / 2, h: h + t / 2, m: 0 }];
    const PD = pylonDist(R), PH = pylonHeight(R), chordLow = R.h(R.dOut) - 1, chordHigh = PH - 1.2;
    for (const run of shape.runs) {
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

    for (const run of shape.runs) {
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
    const tiers = shape.tiers, T = tiers[tiers.length - 1], o = shape.outer;
    const rect = (d0, d1, h0, h1, m) => [[d0, h0], [d1, h0], [d1, h1], [d0, h1]].map(([d, h]) => ({ d, h, m }));
    const Hw = Math.max(8.5, tiers[0].top * 0.6);                       // ballatoio
    const walk = [[tiers[0].back - 1, Hw - 0.5], [o + 0.4, Hw - 0.5], [o + 0.4, Hw + 1.1], [o + 0.15, Hw + 1.1], [o + 0.15, Hw], [tiers[0].back - 1, Hw]].map(([d, h]) => ({ d, h, m: 1 }));
    const pos = [], idx = [[], [], [], []];
    for (const run of shape.runs) {
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
      for (const t of tiers) {
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

  if (st.facade === 'esplanade') {
    // spianata rialzata tutto intorno (anche con le curve staccate): piano grigio, bordo chiaro,
    // pilastri sotto il bordo e il fondo scuro dei parcheggi sotto
    const o = shape.outer, H = ESPLANADE_H, W = ESPLANADE_W, ring = { pts: shape.path, closed: true };
    const rect = (d0, d1, h0, h1, m) => [[d0, h0], [d1, h0], [d1, h1], [d0, h1]].map(([d, h]) => ({ d, h, m }));
    const pos = [], idx = [[], [], []];
    extrude(THREE, ring, rect(o - 0.1, o + W, H - 0.8, H, 0), pos, idx);           // piano
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
    const T = shape.tiers[shape.tiers.length - 1], o = shape.outer, Ht = T.top + 2.2;
    const rect = (d0, d1, h0, h1, m) => [[d0, h0], [d1, h0], [d1, h1], [d0, h1]].map(([d, h]) => ({ d, h, m }));
    const pos = [], idx = [[], [], []];
    for (const run of shape.runs) {
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
    const foot = footOf(shape, st), H = shape.tiers[shape.tiers.length - 1].top + 2.2;
    for (const run of shape.runs) {
      const cum = runLengths(run);
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
    const R2 = roofOf(shape, st.roof), ri = [R2.dIn + 1.2, R2.dIn + 4.2], hRing = 4.5;
    for (const run of shape.runs) {
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

  if (st.facade === 'columns') {
    const top = shape.tiers[shape.tiers.length - 1], H = top.top + 2.2, d = shape.outer + 0.35;
    for (const run of shape.runs) {
      const cum = runLengths(run), total = cum[cum.length - 1];
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

  return { group, steel, deckMat, shellMat, lamp, accent, dark, girder: girderMat, spots };
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
  const stands = new THREE.Mesh(standsGeometry(THREE, shape, st.facade === 'struts'), mats);
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

  let paintKey = '', seatColorKey = '';
  return {
    key: geomKey(st), group, shape, ext, height: reach.h, capacity: seats.count,
    setNight(on) {
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
      if (outside.shellMat) { outside.shellMat.color.set(c.roof); outside.shellMat.emissive.set(c.glow); }
      mats[M_PARAPET].color.set(c.parapet);
      mats[M_STEPS].color.set(shade(c.structure, 1.12));
      mats[M_STRUCT].color.set(shade(c.structure, 0.82));
      const pk = [c.grass, c.track, c.structure, s.mowing].join('|');
      if (pk !== paintKey) {
        paintKey = pk;
        paintPitch(pitchCanvas, s); pitchTex.needsUpdate = true;
        paintBase(baseCanvas, s, shape, ext); baseTex.needsUpdate = true;
      }
      const sk = [s.seatMode, c.seatA, c.seatB, c.seatC, c.seatD].join('|');
      if (sk !== seatColorKey) {
        seatColorKey = sk;
        const pal = [c.seatA, c.seatB, c.seatC, c.seatD].map(h => new THREE.Color(h));
        const arr = seatMesh.instanceColor.array, info = seats.info;
        for (let i = 0; i < seats.count; i++) {
          let k = 0;
          if (s.seatMode === 'sectors') k = info[i] & 1;
          else if (s.seatMode === 'rings') k = (info[i] >> 1) & 3;
          else if (s.seatMode === 'sides') k = info[i] >> 3;
          else if (s.seatMode === 'mosaic') { const h = (Math.imul(i + 1, 2654435761) >>> 0) / 4294967296; k = h < 0.6 ? 0 : h < 0.88 ? 1 : 2; }
          arr[i * 3] = pal[k].r; arr[i * 3 + 1] = pal[k].g; arr[i * 3 + 2] = pal[k].b;
        }
        seatMesh.instanceColor.needsUpdate = true;
      }
    },
    dispose() { own.forEach(o => o.dispose()); seatMesh.dispose(); }
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
  let stage = null, disposed = false, night = false;
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
      const s = await ready;
      if (!s || disposed) return 0;
      const capacity = s.setStadium(normalizeStadium(st));
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
    shot.setStadium(normalizeStadium(st));
    shot.setView(opts.view || 'aerial');
    shot.render();
    return cropToContent(shot.renderer.domElement);
  }).catch(e => { console.error('Stadio 3D:', e); return ''; });
  queue = job;
  return job;
}
