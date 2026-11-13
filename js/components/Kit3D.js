import { paintKitTexture, normalizeKit, KIT3D_FILES, UV, UV_RAGLAN } from './KitRenderer.js';
import { isDeformed } from './kitShapes.js';

/**
 * Maglia 3D (three.js, in vendor/three): il modello in icons/kit3d/shirt.glb viene "vestito"
 * con la texture UV dipinta da paintKitTexture. three.js si carica solo quando serve.
 *
 * - createKitViewer(container): maglia ruotabile col dito (editor).
 * - renderKitImage(kit, opts): foto PNG (data URL) della maglia, per miniature e per il salvataggio.
 * - kitImageHTML(kit, opts, attrs): <img> della maglia (usa kit.image se c'è, altrimenti la genera).
 */
let lib = null;
function loadLib() {
  if (!lib) {
    lib = Promise.all([
      import('../../vendor/three/three.module.min.js'),
      import('../../vendor/three/GLTFLoader.js'),
      import('../../vendor/three/meshopt_decoder.module.js'),
      import('../../vendor/three/OrbitControls.js'),
      import('../../vendor/three/RoomEnvironment.js')
    ]).then(([THREE, g, m, o, r]) => ({ THREE, GLTFLoader: g.GLTFLoader, MeshoptDecoder: m.MeshoptDecoder, OrbitControls: o.OrbitControls, RoomEnvironment: r.RoomEnvironment }));
  }
  return lib;
}

let modelJob = null;
function loadModel() {
  if (!modelJob) {
    modelJob = loadLib().then(async L => {
      const loader = new L.GLTFLoader().setMeshoptDecoder(L.MeshoptDecoder);
      const gltf = await loader.loadAsync(KIT3D_FILES.model);
      return gltf.scene;
    });
  }
  return modelJob;
}

let raglanJob = null;
// pieghe del modello raglan vicino al collo (triangolini girati al contrario della stoffa intorno: da dentro il collo si
// vedevano come segnetti chiari). Si girano nel verso giusto senza cambiare la numerazione dei triangoli, che i
// file dei tagli (neck-cut*.bin) usano. Trovati con tools/kit3d (normale della faccia contro quella dei vertici).
const RAGLAN_FOLDS = { front: [37604, 37609, 37611, 37898], back: [39092, 39093, 39125, 39135] };
/** Dopo uno spostamento della stoffa le pieghe di RAGLAN_FOLDS possono essersi distese: ognuna guarda fuori (dal centro del collo). */
function fixFolds(THREE, model) {
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  model.traverse(m => {
    const tris = m.isMesh && RAGLAN_FOLDS[m.name.replace(/_1$/, '')];
    if (!tris) return;
    const idx = m.geometry.index, p = m.geometry.getAttribute('position'), inner = /_1$/.test(m.name);
    tris.forEach(t => {
      a.fromBufferAttribute(p, idx.getX(3 * t)); b.fromBufferAttribute(p, idx.getX(3 * t + 1)); c.fromBufferAttribute(p, idx.getX(3 * t + 2));
      const nrm = b.clone().sub(a).cross(c.clone().sub(a)), cx = (a.x + b.x + c.x) / 3, cz = (a.z + b.z + c.z) / 3;
      if (nrm.x * cx + nrm.z * cz < 0) { const v = idx.getX(3 * t + 1); idx.setX(3 * t + 1, idx.getX(3 * t + 2)); idx.setX(3 * t + 2, v); }
    });
    idx.needsUpdate = true;
  });
}
function loadRaglan() {
  if (!raglanJob) raglanJob = loadLib().then(async L => {
    const scene = (await new L.GLTFLoader().loadAsync(KIT3D_FILES.raglan)).scene;
    scene.traverse(m => {
      const tris = m.isMesh && RAGLAN_FOLDS[m.name.replace(/_1$/, '')];
      if (!tris) return;
      const idx = m.geometry.index;
      // girati dal verso giusto (scambio di due vertici): guardano fuori come la stoffa intorno, senza lasciare buchi
      tris.forEach(t => { const b = idx.getX(3 * t + 1); idx.setX(3 * t + 1, idx.getX(3 * t + 2)); idx.setX(3 * t + 2, b); });
      idx.needsUpdate = true;
    });
    return scene;
  });
  return raglanJob;
}

/** Copia della geometria con posizioni decimali (quelle compresse non si possono spostare liberamente). */
function floatGeometry(THREE, geometry) {
  const g = geometry.clone();
  ['position', 'normal'].forEach(name => {
    const a = g.getAttribute(name);
    if (!a) return;
    const f = new Float32Array(a.count * 3);
    for (let i = 0; i < a.count; i++) { f[i * 3] = a.getX(i); f[i * 3 + 1] = a.getY(i); f[i * 3 + 2] = a.getZ(i); }
    g.setAttribute(name, new THREE.BufferAttribute(f, 3));
  });
  return g;
}

/**
 * Maglia con le cuciture e la forma di colletto richieste (una volta per variante).
 * Cuciture: 'setin' maglia classica (icons/kit3d/shirt.glb), 'raglan' cucitura raglan e girocollo (icons/kit3d/shirt-raglan.glb).
 * 'polo': colletto alto di icons/kit3d/collar-polo.glb, già posizionato sulla maglia. Classica: bordo del collo portato
 *         sulla cucitura del colletto (icons/kit3d/neck-polo.bin) e costina nascosta. Raglan: colletto adattato
 *         (icons/kit3d/collar-polo-raglan.glb) sopra la costina del girocollo e maglia tagliata a V sotto le strisce
 *         (icons/kit3d/neck-cut-raglan.bin).
 */
const variants = new Map();
const COLLAR_TOP = 1.675;
/** Fascia da capitano 3D: circonferenza / altezza (il disegno della fascia va steso con queste proporzioni). */
export const BAND_RING_ASPECT = 3.8; // punto più alto del colletto alto (collar-polo.glb), con un po' di margine
/** Spostamenti precalcolati dei vertici ('NKP1': n. mesh, poi per mesh n, indici uint32, spostamenti int16 x3 in unità di 0,05 mm). */
async function applyShift(THREE, model, url) {
  const dv = new DataView(await fetch(url).then(r => r.arrayBuffer()));
  let o = 6;
  const meshes = [];
  model.traverse(m => { if (m.isMesh) meshes.push(m); });
  model.updateMatrixWorld(true);
  const v = new THREE.Vector3(), inv = new THREE.Matrix4();
  for (let k = 0; k < dv.getUint16(4, true); k++) {
    const n = dv.getUint32(o, true), idx = o + 4, d = idx + 4 * n;
    o = d + 6 * n;
    if (!n) continue;
    const m = meshes[k], g = floatGeometry(THREE, m.geometry), pos = g.getAttribute('position');
    inv.copy(m.matrixWorld).invert();
    for (let j = 0; j < n; j++) {
      const i = dv.getUint32(idx + 4 * j, true);
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      v.x += dv.getInt16(d + 6 * j, true) / 20000;
      v.y += dv.getInt16(d + 6 * j + 2, true) / 20000;
      v.z += dv.getInt16(d + 6 * j + 4, true) / 20000;
      v.applyMatrix4(inv);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeBoundingBox(); g.computeBoundingSphere(); // normali originali: lo spostamento è piccolo
    m.geometry = g;
  }
}

/** Triangoli da togliere ('NKC1': n. mesh, poi per mesh n e gli indici uint32 dei triangoli). */
async function applyCut(model, url) {
  const dv = new DataView(await fetch(url).then(r => r.arrayBuffer()));
  const meshes = [];
  model.traverse(m => { if (m.isMesh) meshes.push(m); });
  let o = 6;
  for (let k = 0; k < dv.getUint16(4, true); k++) {
    const n = dv.getUint32(o, true);
    const cut = new Set();
    for (let j = 0; j < n; j++) cut.add(dv.getUint32(o + 4 + 4 * j, true));
    o += 4 + 4 * n;
    if (!n) continue;
    const m = meshes[k], g = m.geometry.clone(), idx = g.index.array, keep = [];
    for (let t = 0; t < idx.length / 3; t++) if (!cut.has(t)) keep.push(idx[3 * t], idx[3 * t + 1], idx[3 * t + 2]);
    g.setIndex(keep);
    m.geometry = g;
  }
}

/** Classica col girocollo: posizione della costina della raglan (la stoffa in neck-crew-setin.bin arriva al suo bordo). */
const CREW_FIT = { pivot: [0, 1.58, 0], dy: 0.003238, dz: -0.010652, tilt: -0.092575, sx: 1.015959, sz: 1.031167 };
/** Raglan con la V: la costina a V della classica rimpicciolita (scale), inclinata (tilt, radianti), allargata ai lati
 * (sx) e davanti-dietro (sz) e spostata (m) attorno a pivot, così combacia con lo scollo della raglan ai lati e dietro e
 * con il petto davanti; la stoffa in neck-v-raglan.bin arriva al suo bordo. */
const V_FIT = { pivot: [0, 1.52, 0], dy: 0.007651, dz: -0.000199, tilt: 0.055347, scale: 0.890214, sx: 1.118983, sz: 1.016285 };
/** Raglan con la V: dietro la costina scende di V_BEND m (la raglan ha il collo dietro più alto della classica: la V
 * sembrava rialzata), solo in verticale e appena in fuori, graduale da 90 a 150 gradi (= v_bend in tools/kit3d/neckmorph.py). */
const V_BEND = 0.005;
function bendRib(THREE, wrap) {
  wrap.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  wrap.traverse(o => {
    if (!o.isMesh) return;
    o.geometry = floatGeometry(THREE, o.geometry);
    const p = o.geometry.getAttribute('position'), M = o.matrixWorld, inv = M.clone().invert();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(M);
      const a = Math.abs(Math.atan2(v.x, v.z)) * 180 / Math.PI, r = Math.hypot(v.x, v.z) || 1e-9;
      const t = Math.min(1, Math.max(0, (a - 90) / 60)), d = V_BEND * t * t * (3 - 2 * t), f = (r + 0.5 * d) / r;
      v.set(v.x * f, v.y - d, v.z * f).applyMatrix4(inv);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    p.needsUpdate = true;
    o.geometry.computeBoundingSphere();
  });
}

/** Coordinate della texture della costina presa dall'altra maglia: dal riquadro del colletto a a quello b. */
function remapUV(THREE, node, a, b) {
  node.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry.clone(), uv = g.getAttribute('uv'), f = new Float32Array(uv.count * 2);
    for (let i = 0; i < uv.count; i++) {
      f[2 * i] = b.x + (uv.getX(i) - a.x) / a.w * b.w;
      f[2 * i + 1] = b.y + (uv.getY(i) - a.y) / a.h * b.h;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(f, 2));
    o.geometry = g;
  });
}

/** Colletto grosso: di quanto si allunga la costina (1 = com'è), per il girocollo e per lo scollo a V. */
const BIG_RIB = { crew: 1.45, v: 2.0 };
/** Il bordo basso della costina (questi metri) resta fermo: è quello cucito alla stoffa. */
const BIG_KEEP = 0.0015;
/**
 * Allunga la costina verso l'alto: per ogni angolo intorno al collo il suo bordo basso resta dov'è e ogni punto si
 * allontana da lui (in altezza e nel raggio) di k volte, così la costina resta della sua forma, solo più alta. Il primo
 * millimetro e mezzo resta fermo: il bordo cucito alla stoffa non si muove (sulla punta della V il bordo basso stimato
 * per spicchi è appena sotto quello vero e lo avrebbe alzato).
 */
function growRib(THREE, meshes, k) {
  const v = new THREE.Vector3(), all = [];
  meshes.forEach(m => {
    m.geometry = floatGeometry(THREE, m.geometry);
    const p = m.geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); all.push(v.x, v.y, v.z); }
  });
  const n = all.length / 3;
  if (!n) return;
  let cx = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += all[3 * i]; cz += all[3 * i + 2]; }
  cx /= n; cz /= n;
  // bordo basso per angolo (360 spicchi di 1 grado): altezza e raggio del punto più basso
  const N = 360, loY = new Array(N).fill(Infinity), loR = new Array(N).fill(0);
  const bin = (x, z) => ((Math.atan2(x - cx, z - cz) + Math.PI) / (2 * Math.PI)) * N;
  for (let i = 0; i < n; i++) {
    const x = all[3 * i], y = all[3 * i + 1], z = all[3 * i + 2], b = Math.floor(bin(x, z)) % N;
    if (y < loY[b]) { loY[b] = y; loR[b] = Math.hypot(x - cx, z - cz); }
  }
  for (let b = 0; b < N; b++) if (!isFinite(loY[b])) {
    for (let d = 1; d < N; d++) { const j = (b + d) % N; if (isFinite(loY[j])) { loY[b] = loY[j]; loR[b] = loR[j]; break; } }
  }
  // per ogni spicchio il punto più basso entro ±2 spicchi (uno spicchio da solo può avere solo punti alti della costina),
  // poi lisciato: il bordo basso stimato è una curva continua, sempre appena sotto quello vero (entro BIG_KEEP)
  const ly = new Array(N), lr = new Array(N);
  for (let b = 0; b < N; b++) {
    let best = b;
    for (let d = -2; d <= 2; d++) { const j = (b + d + N) % N; if (loY[j] < loY[best]) best = j; }
    ly[b] = loY[best]; lr[b] = loR[best];
  }
  // lisciatura forte (circa ±5 gradi): il bordo alto si sposta di (k − 1) volte la distanza dal bordo basso stimato, e
  // ogni ondina di quest'ultimo si vedeva amplificata sul bordo interno della V e dietro al centro
  for (let it = 0; it < 40; it++) {
    const y = ly.slice(), r = lr.slice();
    for (let b = 0; b < N; b++) {
      ly[b] = (y[(b + N - 1) % N] + 2 * y[b] + y[(b + 1) % N]) / 4;
      lr[b] = (r[(b + N - 1) % N] + 2 * r[b] + r[(b + 1) % N]) / 4;
    }
  }
  meshes.forEach(m => {
    const p = m.geometry.getAttribute('position'), inv = m.matrixWorld.clone().invert();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld);
      const f = bin(v.x, v.z) - .5, b0 = ((Math.floor(f) % N) + N) % N, b1 = (b0 + 1) % N, t = f - Math.floor(f);
      const y0 = ly[b0] + (ly[b1] - ly[b0]) * t, r0 = lr[b0] + (lr[b1] - lr[b0]) * t;
      // altezza sopra il bordo basso stimato: chi sta sotto (vicino alla punta della V, dove la lisciatura lo alza) o nel
      // primo millimetro e mezzo resta fermo, il resto si allunga
      const r = Math.hypot(v.x - cx, v.z - cz) || 1e-6, dy = v.y - y0, dr = r - r0;
      const g = dy > BIG_KEEP ? (k - 1) * (dy - BIG_KEEP) / dy : 0; // allungamento oltre il bordo fermo
      const ny = v.y + dy * g, nr = r + dr * g;
      v.set(cx + (v.x - cx) / r * nr, ny, cz + (v.z - cz) / r * nr).applyMatrix4(inv);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    p.needsUpdate = true;
    m.geometry.computeBoundingSphere();
  });
}

let neckRibbonJob = null, neckRibbons = null;
/** Bordino per maglia e scollo (icons/kit3d/neck-bands.json: { 'setin:base': { rows, pts: [x, y, z, …] } }, rows punti per campione). */
function loadNeckRibbons() {
  if (!neckRibbonJob) neckRibbonJob = fetch(KIT3D_FILES.neckBands).then(r => (r.ok ? r.json() : null)).catch(() => null).then(d => (neckRibbons = d));
  return neckRibbonJob;
}

/**
 * Bordino 3D: una fascetta di 5 mm che gira intorno al collo appoggiata sulla stoffa, subito sotto la costina (la parte
 * alta finisce sotto la costina). È una superficie vera e non un disegno nella texture: il bordo resta dritto e netto
 * anche dove la stoffa è stirata o compressa (classica girocollo, raglan V). I punti sono sulla stoffa, 0,6 mm fuori.
 */
function buildNeckTrim(THREE, rd) {
  // rd.pts: per ogni campione intorno al collo rd.rows punti dall'alto (sotto la costina) al basso, già sulla stoffa e
  // staccati 0,6 mm verso fuori (neck-bands.json)
  const R = rd.rows || 2, pts = rd.pts, n = pts.length / (3 * R);
  const g = new THREE.BufferGeometry(), idx = [];
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
  // verso dei triangoli: la normale del primo deve guardare fuori (lontano dall'asse del collo)
  const P = (i) => new THREE.Vector3(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]);
  // (prima fila → ultima, non → seconda: la seconda può stare appena sopra la prima, sotto il bordo della costina)
  const nrm = new THREE.Vector3().crossVectors(P(R - 1).sub(P(0)), P(R).sub(P(0)));
  const out = nrm.x * pts[0] + nrm.z * pts[2] > 0;
  for (let i = 0; i < n; i++) {
    const a = i * R, c = ((i + 1) % n) * R;
    for (let j = 0; j < R - 1; j++) {
      if (out) idx.push(a + j, a + j + 1, c + j, c + j, a + j + 1, c + j + 1);
      else idx.push(a + j, c + j, a + j + 1, c + j, c + j + 1, a + j + 1);
    }
  }
  g.setIndex(idx);
  g.computeVertexNormals();
  // luce uniforme su tutta la larghezza: ogni colonna usa la normale della stoffa (file basse), senza il riflesso sulla
  // piega dove la fascetta passa dalla costina alla stoffa
  const nor = g.getAttribute('normal'), v = new THREE.Vector3(), w = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.set(0, 0, 0);
    for (let j = Math.min(2, R - 1); j < R; j++) v.add(w.fromBufferAttribute(nor, i * R + j));
    v.normalize();
    for (let j = 0; j < R; j++) nor.setXYZ(i * R + j, v.x, v.y, v.z);
  }
  // niente polygonOffset: guardando dentro il collo di sbieco tirava la fascetta davanti alla stoffa (si vedeva dietro)
  const m = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, side: THREE.FrontSide });
  const mesh = new THREE.Mesh(g, m);
  mesh.name = 'neck_trim';
  mesh.visible = false;
  return mesh;
}

function loadVariant(kit) {
  const raglan = kit.sleeveCut === 'raglan';
  const shape = isDeformed(kit.collarShape, raglan) ? kit.collarShape : 'base';
  const big = !!kit.collarBig && kit.collarShape !== 'polo';
  const key = (raglan ? 'raglan:' : 'setin:') + shape + (big ? ':big' : '');
  if (!variants.has(key)) {
    variants.set(key, Promise.all([loadLib(), raglan ? loadRaglan() : loadModel(), loadNeckRibbons()]).then(async ([L, base]) => {
      const { THREE } = L;
      if (big) {
        // colletto grosso: la stessa maglia (girocollo o V) con la costina allungata verso l'alto dal suo bordo basso; la
        // stoffa resta com'è
        const m = (await loadVariant({ ...kit, collarBig: false })).clone(true);
        m.updateMatrixWorld(true);
        const isRib = (o) => /Pattern2D_3805002|raglan_collar/.test(`${o.name}|${o.parent ? o.parent.name : ''}`);
        const ribs = [];
        m.traverse(o => { if (o.isMesh && o.visible && (isRib(o) || o.userData.swappedRib)) ribs.push(o); });
        growRib(THREE, ribs, BIG_RIB[kit.collarShape === 'v' ? 'v' : 'crew']);
        return m;
      }
      if (shape === 'base') return base;
      const model = base.clone(true);
      const rib = /Pattern2D_3805002|raglan_collar/; // costina del collo (classica: a V, raglan: girocollo)
      const isRib = (o) => rib.test(`${o.name}|${o.parent ? o.parent.name : ''}`);
      if (shape === 'v') {
        // raglan con la V della classica: la sua costina così com'è al posto del girocollo, la stoffa dentro la V tolta e il
        // bordo del taglio sotto la costina. Nella texture la costina usa il riquadro del colletto della raglan
        await applyShift(THREE, model, KIT3D_FILES.neckVRaglan);
        await applyCut(model, KIT3D_FILES.neckCutVRaglan);
        fixFolds(THREE, model);
        model.traverse(o => { if (o.isMesh && isRib(o)) o.visible = false; });
        const setin = await loadModel();
        setin.updateMatrixWorld(true);
        let src = null;
        setin.traverse(o => { if (!src && o.name === 'Pattern2D_3805002') src = o; });
        if (src) {
          const rib = src.clone(true);
          src.matrixWorld.decompose(rib.position, rib.quaternion, rib.scale);
          remapUV(THREE, rib, UV.collar, UV_RAGLAN.collar);
          const f = V_FIT, p = new THREE.Vector3(...f.pivot), M = new THREE.Matrix4();
          M.makeTranslation(p.x, p.y + f.dy, p.z + f.dz)
            .multiply(new THREE.Matrix4().makeScale(f.sx, 1, f.sz))
            .multiply(new THREE.Matrix4().makeRotationX(f.tilt))
            .multiply(new THREE.Matrix4().makeScale(f.scale, f.scale, f.scale))
            .multiply(new THREE.Matrix4().makeTranslation(-p.x, -p.y, -p.z));
          const wrap = new THREE.Group();
          wrap.matrixAutoUpdate = false;
          wrap.matrix.copy(M);
          wrap.add(rib);
          rib.traverse(o => { o.userData.swappedRib = true; });
          bendRib(THREE, wrap);
          model.add(wrap);
        }
        return model;
      }
      if (shape === 'crew') {
        // classica col girocollo della raglan: la sua costina così com'è al posto di quella a V, e la stoffa di davanti e di
        // dietro arriva fino al suo bordo (neck-crew-setin.bin). Nella texture la costina usa il riquadro del colletto della classica
        await applyShift(THREE, model, KIT3D_FILES.neckCrewSetin);
        model.traverse(o => { if (o.isMesh && isRib(o)) o.visible = false; });
        const rag = await loadRaglan();
        rag.updateMatrixWorld(true);
        let src = null;
        rag.traverse(o => { if (!src && o.name === 'raglan_collar') src = o; });
        if (src) {
          const rib = src.clone(true);
          src.matrixWorld.decompose(rib.position, rib.quaternion, rib.scale);
          // spostata, inclinata e appena allargata (CREW_FIT): combacia con lo scollo originale ai lati e dietro
          const f = CREW_FIT, p = new THREE.Vector3(...f.pivot);
          const wrap = new THREE.Group();
          wrap.matrixAutoUpdate = false;
          wrap.matrix.makeTranslation(p.x, p.y + f.dy, p.z + f.dz)
            .multiply(new THREE.Matrix4().makeScale(f.sx, 1, f.sz))
            .multiply(new THREE.Matrix4().makeRotationX(f.tilt))
            .multiply(new THREE.Matrix4().makeTranslation(-p.x, -p.y, -p.z));
          wrap.add(rib);
          remapUV(THREE, rib, UV_RAGLAN.collar, UV.collar);
          rib.traverse(o => { o.userData.swappedRib = true; });
          model.add(wrap);
        }
        return model;
      }
      // colletto alto: bordo della stoffa sulla cucitura del colletto (neck-polo.bin); raglan (neck-polo-raglan.bin):
      // la stoffa che resterebbe davanti al colletto o alle strisce va appena dietro
      await applyShift(THREE, model, raglan ? KIT3D_FILES.neckPoloRaglan : KIT3D_FILES.neckPolo);
      // la costina dello scollo a V non serve: il colletto è cucito direttamente alla stoffa (raglan: in neck-cut-raglan.bin)
      if (!raglan) model.traverse(o => { if (o.isMesh && isRib(o)) o.visible = false; });
      // raglan: la costina del girocollo fa da base al colletto (l'attaccatura coincide); davanti la maglia si apre a V come la
      // classica: stoffa e costina dentro l'apertura si tolgono, il bordo del taglio resta sotto le strisce
      if (raglan) await applyCut(model, KIT3D_FILES.neckCutRaglan);
      // colletto (raglan: adattato, strisce della V stese sul petto della raglan)
      const loader = new L.GLTFLoader();
      const collar = (await loader.loadAsync(raglan ? KIT3D_FILES.collarPoloRaglan : KIT3D_FILES.collarPolo)).scene;
      collar.traverse(o => { if (o.isMesh) o.geometry.computeVertexNormals(); });
      model.add(collar);
      return model;
    }).then(m => {
      // quale linea del collo ha questa maglia (per il bordino, vedi buildNeckTrim); il colletto alto non ne ha
      if (m) m.userData.neckKey = shape === 'polo' ? null : `${raglan ? 'raglan' : 'setin'}:${shape}`;
      return m;
    }));
  }
  return variants.get(key);
}

const validColor = (c, def = '#ffffff') => (/^#[0-9a-f]{3,8}$/i.test(String(c || '')) ? c : def);

/** Pixel per punto dell'editor 3D (Impostazioni → Risoluzione editor 3D): bassa 2, media 2,5 (predefinita), alta 3. */
function editorPixelRatio() {
  const q = ((window.STATE && window.STATE.settings) || {}).kit3dQuality;
  return q === 'low' ? 2 : q === 'high' ? 3 : 2.5;
}

/** Risoluzione della texture dell'editor (stessa impostazione): più alta = stemma, marchi e scritte più nitidi. */
function editorTextureSize() {
  const q = ((window.STATE && window.STATE.settings) || {}).kit3dQuality;
  return q === 'low' ? 2048 : q === 'high' ? 4096 : 3072;
}

class Stage {
  constructor(L, model, canvas, { interactive = false, zoom = false, width = 600, height = 640 } = {}) {
    const { THREE } = L;
    this.L = L;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(interactive ? Math.min(window.devicePixelRatio || 1, editorPixelRatio()) : 1);
    this.renderer.setSize(width, height, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new L.RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55; // luce morbida da studio: colori fedeli, senza sbiancare il davanti
    const key = new THREE.DirectionalLight(0xffffff, 0.8);
    key.position.set(2.5, 3, 2);
    this.scene.add(key);

    this.texture = new THREE.CanvasTexture(document.createElement('canvas'));
    this.texture.flipY = false;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    // la maglia si vede quasi alla risoluzione della texture: senza mipmap loghi e scritte restano nitidi
    this.texture.generateMipmaps = false;
    this.texture.minFilter = THREE.LinearFilter;
    this.setModel(model);

    const box = new THREE.Box3().setFromObject(this.model);
    box.max.y = Math.max(box.max.y, COLLAR_TOP); // inquadratura uguale per tutte le forme: c'è posto anche per il colletto alto
    this.center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    this.size = size;
    this.dist = Math.max(size.y, size.x * height / width) / 2 / Math.tan(THREE.MathUtils.degToRad(11)) * 1.06;
    // piano vicino il più lontano possibile (la camera non va mai più vicina di dist × 0,22 al punto guardato): sui telefoni
    // la profondità è meno precisa e con 0,01 m la stoffa bucava il bordino (0,6 mm sopra) con delle seghettature
    this.camera = new THREE.PerspectiveCamera(22, width / height, this.dist * 0.04, this.dist * 6);
    this.setView(0);

    if (interactive) {
      const c = new L.OrbitControls(this.camera, canvas);
      c.target.copy(this.center);
      if (zoom) {
        // vista ingrandita: zoom (due dita / rotella), spostamento e un po' di rotazione verticale
        c.enablePan = true; c.screenSpacePanning = true;
        c.enableZoom = true; c.minDistance = this.dist * .22; c.maxDistance = this.dist * 1.15;
        c.minPolarAngle = Math.PI * .3; c.maxPolarAngle = Math.PI * .7;
        c.enableDamping = true; c.dampingFactor = .12;
        const loop = () => { if (this.controls) { if (c.update()) this.render(); this._raf = requestAnimationFrame(loop); } };
        this._raf = requestAnimationFrame(loop);
      } else {
        c.enablePan = false;
        c.enableZoom = false;
        c.minPolarAngle = c.maxPolarAngle = Math.PI / 2; // solo rotazione orizzontale
      }
      c.addEventListener('change', () => this.render());
      this.controls = c;
      this.setView(0); // i controlli appena creati puntano all'origine: riallineo sulla maglia
    }
  }

  /** Copia del modello (forma del colletto) con materiali propri: la texture cambia per ogni maglia. */
  setModel(model) {
    // stessa maglia: niente da rifare (a meno che il bordino non sia ancora stato preparato: la maglia di partenza si
    // carica prima di sapere che linea del collo ha)
    if (this.source === model && this.trimKey === (model.userData.neckKey || null)) return;
    if (this.model) this.scene.remove(this.model);
    this.source = model;
    this.model = model.clone(true);
    this.collarMats = {};
    this.innerMats = [];
    this.ribInnerMats = [];
    this.model.traverse(o => {
      if (!o.isMesh) return;
      const name = o.material.name;
      o.material = o.material.clone();
      o.material.metalness = 0;
      // costina presa dall'altra maglia: il rovescio ha il colore del colletto (sotto il bordo non resta una riga scura)
      if (o.userData.swappedRib && /^shirt_inner/.test(name)) {
        if (name === 'shirt_inner_flip') o.material.side = this.L.THREE.BackSide;
        this.ribInnerMats.push(o.material);
        return;
      }
      if (name === 'shirt_outer') { o.material.map = this.texture; o.material.needsUpdate = true; }
      if (name === 'shirt_inner') (this.innerMats ||= []).push(o.material);
      // maglia raglan: l'interno è il rovescio della stessa superficie
      if (name === 'shirt_inner_flip') {
        o.material.side = this.L.THREE.BackSide; this.innerMats.push(o.material);
        // rovescio della costina della raglan: senza la spinta indietro dell'interno (polygonOffset), che guardando il colletto
        // di sbieco lo mandava dietro alla stoffa e al bordino di fuori (linee chiare dentro il collo)
        if (/raglan_collar/.test(`${o.name}|${o.parent ? o.parent.name : ''}`)) o.material.userData.noOffset = true;
      }
      if (/^polo_/.test(name)) (this.collarMats[name] ||= []).push(o.material);
    });
    // bordino 3D (si vede solo con la rifinitura "Con bordino", vedi applyKit)
    this.trimMesh = null;
    const nk = this.model.userData.neckKey, rd = nk && neckRibbons && neckRibbons[nk];
    this.trimKey = nk || null;
    if (rd && rd.pts) { this.trimMesh = buildNeckTrim(this.L.THREE, rd); this.model.add(this.trimMesh); }
    this.scene.add(this.model);
  }

  /** Veste la maglia: texture UV dipinta, interno in ombra, colore del colletto alto (se c'è). */
  applyKit(kit, full) {
    this.setTexture(full);
    // interno della maglia in ombra: colore della maglia molto scurito
    const inner = new this.L.THREE.Color(validColor(kit.colors.base, '#888888')).multiplyScalar(0.22);
    this.innerMats.forEach(m => {
      m.color.copy(inner); m.roughness = 1; m.envMapIntensity = 0.4;
      m.polygonOffset = !m.userData.noOffset; m.polygonOffsetFactor = 1; m.polygonOffsetUnits = 2; // l'interno non buca mai la stoffa esterna
    });
    const ribInner = new this.L.THREE.Color(validColor(kit.colors.collar)).multiplyScalar(0.8);
    (this.ribInnerMats || []).forEach(m => { m.color.copy(ribInner); m.map = null; m.roughness = 0.9; m.needsUpdate = true; });
    if (this.trimMesh) {
      this.trimMesh.visible = kit.collar === 'trim' && kit.collarShape !== 'polo';
      this.trimMesh.material.color.set(validColor(kit.colors.trim));
    }
    const M = this.collarMats || {};
    const each = (name, fn) => (M[name] || []).forEach(fn);
    // colletto alto: tinta unita del colore del colletto
    // il colletto vince sulla maglia dove le due superfici quasi coincidono (attaccatura): niente sfarfallii né punte che bucano
    each('polo_collar', m => {
      m.color.set(validColor(kit.colors.collar)); m.roughness = 0.85;
      m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -6;
    });
  }

  /** Avvicina (f < 1) o allontana (f > 1) la camera dal punto guardato, nei limiti dei controlli. */
  zoomBy(f) {
    if (!this.controls) return;
    const c = this.controls, v = this.camera.position.clone().sub(c.target);
    const len = Math.min(c.maxDistance, Math.max(c.minDistance, v.length() * f));
    this.camera.position.copy(c.target).add(v.setLength(len));
    c.update(); this.render();
  }

  setView(yawDeg) {
    if (this._tween) cancelAnimationFrame(this._tween);
    this._tween = 0;
    const a = yawDeg * Math.PI / 180;
    this.camera.position.set(this.center.x + Math.sin(a) * this.dist, this.center.y, this.center.z + Math.cos(a) * this.dist);
    this.camera.lookAt(this.center);
    if (this.controls) { this.controls.target.copy(this.center); this.controls.update(); }
  }

  /**
   * Inquadra una parte della maglia con un movimento morbido: f = { yaw (gradi), x, y, z (frazioni della maglia
   * rispetto al centro), d (distanza rispetto alla vista intera) }. La camera resta all'altezza del punto guardato
   * (nell'editor la maglia ruota solo in orizzontale).
   */
  focus(f, ms = 480) {
    const { THREE } = this.L;
    // il punto guardato (e quindi il centro della rotazione) resta sempre sull'asse della maglia: cambia solo l'altezza.
    // Con x/z il centro finiva sulla spalla o sulla manica e, girando col dito, la maglia ruotava intorno alla spalla
    // e usciva dallo schermo. Per le parti di lato si gira la maglia (yaw), non si sposta il centro.
    const t1 = new THREE.Vector3(this.center.x, this.center.y + (f.y || 0) * this.size.y, this.center.z);
    const a1 = (f.yaw || 0) * Math.PI / 180, d1 = this.dist * (f.d || 1);
    const t0 = this.controls ? this.controls.target.clone() : this.center.clone();
    const off = this.camera.position.clone().sub(t0);
    const a0 = Math.atan2(off.x, off.z), d0 = Math.hypot(off.x, off.z) || this.dist;
    let da = a1 - a0; da = Math.atan2(Math.sin(da), Math.cos(da)); // giro più corto
    if (this._tween) cancelAnimationFrame(this._tween);
    const start = performance.now();
    const step = (now) => {
      const p = ms > 0 ? Math.min(1, (now - start) / ms) : 1, e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const t = t0.clone().lerp(t1, e), a = a0 + da * e, d = d0 + (d1 - d0) * e;
      // f.pitch: camera più in alto (gradi), solo dove i controlli lo permettono (vista ingrandita)
      this.camera.position.set(t.x + Math.sin(a) * d, t.y + Math.tan((f.pitch || 0) * Math.PI / 180) * d * e, t.z + Math.cos(a) * d);
      this.camera.lookAt(t);
      if (this.controls) { this.controls.target.copy(t); this.controls.update(); }
      this.render();
      this._tween = p < 1 ? requestAnimationFrame(step) : 0;
    };
    if (ms > 0) this._tween = requestAnimationFrame(step); else step(start);
  }

  /** Anello della fascia di raggio 1 (alto 2π / BAND_RING_ASPECT) con i materiali condivisi; la "C" guarda verso +z. */
  _bandRing() {
    const { THREE } = this.L;
    const Hh = 2 * Math.PI / BAND_RING_ASPECT;
    const m = this.bandMats;
    // davanti (+z) il centro del disegno (la "C"): l'anello parte dal retro
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(1, .975, Hh, 160, 1, true, Math.PI, Math.PI * 2), m.outer);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(.985, .96, Hh * .995, 160, 1, true, Math.PI, Math.PI * 2), m.inner);
    // linguetta col velcro sul retro: sovrapposta, con la cucitura
    const flap = new THREE.Mesh(new THREE.CylinderGeometry(1.014, .989, Hh * .97, 40, 1, true, Math.PI - .45, .9), m.flap);
    // spessore del bordo (sottile, cucito)
    const edge = (y, r) => { const t = new THREE.Mesh(new THREE.TorusGeometry(r, Hh * .012, 6, 160), m.edge); t.rotation.x = Math.PI / 2; t.position.y = y; return t; };
    const ring = new THREE.Group();
    ring.add(outer, inner, flap, edge(Hh / 2, .993), edge(-Hh / 2, .968));
    [outer, inner, flap].forEach(o => { o.material.polygonOffset = true; o.material.polygonOffsetFactor = -2; o.material.polygonOffsetUnits = -4; });
    return ring;
  }

  /**
   * Dove sta la fascia sul braccio: anello della manica sinistra del modello alla riga row = { rect (riquadro UV della manica), t }.
   * Restituisce { center, axis (verso la spalla), out (lato esterno del braccio), side, rOut, rSide } in coordinate del mondo.
   */
  _sleeveRing(row) {
    const { THREE } = this.L;
    const key = this.source.uuid + JSON.stringify(row);
    if (this._ringKey === key) return this._ring;
    this.model.updateMatrixWorld(true);
    const pick = (v0, tol) => {
      const pts = [];
      this.model.traverse(o => {
        if (!o.isMesh || !o.visible || o.material.name !== 'shirt_outer') return;
        const pos = o.geometry.attributes.position, uv = o.geometry.attributes.uv;
        if (!pos || !uv) return;
        const v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
          const u = uv.getX(i), w = uv.getY(i);
          if (u < row.rect.x || u > row.rect.x + row.rect.w || Math.abs(w - v0) > tol) continue;
          pts.push(v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(o.matrixWorld).clone());
        }
      });
      return pts;
    };
    const mean = (ps) => ps.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(ps.length || 1);
    const ringAt = (t) => {
      const v0 = row.rect.y + row.rect.h * t;
      let tol = row.rect.h * .015, ps = pick(v0, tol);
      while (ps.length < 40 && tol < row.rect.h * .2) { tol *= 1.6; ps = pick(v0, tol); }
      return ps;
    };
    let c, axis, pts, fit = null;
    if (row.mode === 'rows') {
      // raglan: le righe del riquadro della manica girano intorno al braccio
      pts = ringAt(row.t);
      if (pts.length < 8) { this._ringKey = key; this._ring = null; return null; }
      c = mean(pts);
      axis = mean(ringAt(Math.max(0, row.t - .25))).sub(c).normalize(); // verso la spalla
    } else {
      // manica attaccata sulla spalla: le righe interne del riquadro non girano dritte intorno al braccio,
      // ma il bordo in fondo al pezzo è l'orlo del polsino: da lì ricavo asse e larghezza del braccio
      const edge = pick(row.rect.y + row.rect.h * .985, row.rect.h * .015);
      if (edge.length < 12) { this._ringKey = key; this._ring = null; return null; }
      const cc = mean(edge);
      // asse: perpendicolare all'orlo (direzione in cui i punti variano meno), verso la spalla
      const cov = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      edge.forEach(p => { const d = [p.x - cc.x, p.y - cc.y, p.z - cc.z]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cov[i][j] += d[i] * d[j]; });
      const mul = (m, v) => new THREE.Vector3(m[0][0] * v.x + m[0][1] * v.y + m[0][2] * v.z, m[1][0] * v.x + m[1][1] * v.y + m[1][2] * v.z, m[2][0] * v.x + m[2][1] * v.y + m[2][2] * v.z);
      const eig = (m, seed) => { let v = seed.clone().normalize(); for (let i = 0; i < 80; i++) v = mul(m, v).normalize(); return v; };
      const e1 = eig(cov, new THREE.Vector3(.3, 1, .2));
      const l1 = mul(cov, e1).dot(e1);
      const def = cov.map((r, i) => r.map((x, j) => x - l1 * e1.getComponent(i) * e1.getComponent(j)));
      const seed = new THREE.Vector3(.2, .3, 1); seed.sub(e1.clone().multiplyScalar(e1.dot(seed)));
      const e2 = eig(def, seed);
      axis = new THREE.Vector3().crossVectors(e1, e2).normalize();
      const toBody = new THREE.Vector3(this.center.x, cc.y, this.center.z).sub(cc);
      if (axis.dot(toBody) < 0) axis.negate();
      pts = edge;
      // la fascia sta un po' sopra il polsino (row.t = quante altezze della fascia)
      const rm = Math.sqrt(2 * edge.reduce((a, p) => { const d = p.clone().sub(cc); d.sub(axis.clone().multiplyScalar(d.dot(axis))); return a + d.lengthSq(); }, 0) / edge.length / 2);
      c = cc.clone().add(axis.clone().multiplyScalar(rm * 2 * Math.PI / BAND_RING_ASPECT * .88 * row.t));
      // la stoffa dentro l'altezza della fascia non deve sporgere: larghezze massime della manica in quel tratto
      const half = rm * Math.PI / BAND_RING_ASPECT * .88;
      const sec = pick(row.rect.y + row.rect.h / 2, row.rect.h / 2).filter(p => Math.abs(p.clone().sub(c).dot(axis)) < half);
      fit = sec.length > 8 ? sec : null;
      pts = edge.map(p => p.clone().add(c.clone().sub(cc)));
    }
    // lato esterno: lontano dal centro della maglia, perpendicolare al braccio
    const out = c.clone().sub(new THREE.Vector3(this.center.x, c.y, this.center.z));
    out.sub(axis.clone().multiplyScalar(out.dot(axis))).normalize();
    const side = new THREE.Vector3().crossVectors(axis, out).normalize();
    // raggi: quanto è largo il braccio verso l'esterno e di lato (la manica non è tonda)
    const rad = (dir) => Math.sqrt(2 * pts.reduce((a, p) => { const d = p.clone().sub(c); d.sub(axis.clone().multiplyScalar(d.dot(axis))); return a + d.dot(dir) ** 2; }, 0) / pts.length);
    this._ringKey = key;
    const rmax = (dir) => Math.max(...fit.map(p => { const d = p.clone().sub(c); d.sub(axis.clone().multiplyScalar(d.dot(axis))); return Math.abs(d.dot(dir)); })) * .96;
    this._ring = fit ? { tight: true, center: c, axis, out, side, rOut: Math.max(rad(out), rmax(out)), rSide: Math.max(rad(side), rmax(side)) }
      : { center: c, axis, out, side, rOut: rad(out), rSide: rad(side) };
    return this._ring;
  }

  /**
   * Fascia indossata: superficie che segue la manica sinistra (per ogni direzione intorno al braccio e altezza, quanto sporge
   * la stoffa), appena sollevata; sotto l'orlo della manica prosegue dritta con la larghezza dell'orlo.
   * u = giro intorno al braccio (0,5 = lato esterno, dove sta la "C"), v = altezza della fascia (0,12..0,88 della texture).
   */
  _wornBand(row, r) {
    const { THREE } = this.L;
    const rm = (r.rOut + r.rSide) / 2, half = rm * Math.PI / BAND_RING_ASPECT * .9; // metà altezza della fascia
    const lift = rm * .05; // spessore: quanto sta sopra la stoffa
    const NT = 96, NA = 14;
    const grid = Array.from({ length: NA }, () => new Float32Array(NT).fill(-1));
    const P = new THREE.Vector3(), N = new THREE.Vector3(), D = new THREE.Vector3();
    this.model.updateMatrixWorld(true);
    this.model.traverse(o => {
      if (!o.isMesh || o.material.name !== 'shirt_outer') return;
      const g = o.geometry, ap = g.attributes.position, an = g.attributes.normal, au = g.attributes.uv;
      if (!ap || !au) return;
      const nm = new THREE.Matrix3().getNormalMatrix(o.matrixWorld);
      for (let i = 0; i < ap.count; i++) {
        const u = au.getX(i), v = au.getY(i);
        if (u < row.rect.x || u > row.rect.x + row.rect.w || v < row.rect.y || v > row.rect.y + row.rect.h) continue;
        P.set(ap.getX(i), ap.getY(i), ap.getZ(i)).applyMatrix4(o.matrixWorld);
        D.copy(P).sub(r.center);
        const a = D.dot(r.axis);
        if (a < -half * 1.1 || a > half * 1.1) continue;
        D.addScaledVector(r.axis, -a);
        if (an && N.set(an.getX(i), an.getY(i), an.getZ(i)).applyMatrix3(nm).dot(D) < 0) continue; // risvolto interno dell'orlo
        const ang = Math.atan2(D.dot(r.side), D.dot(r.out));
        const ti = Math.round((ang / (2 * Math.PI) + .5) * NT) % NT;
        const aj = Math.round((a + half) / (2 * half) * (NA - 1));
        if (aj < 0 || aj >= NA) continue;
        grid[aj][ti] = Math.max(grid[aj][ti], D.length());
      }
    });
    // buchi del giro: dai vicini; sotto l'orlo (nessuna stoffa): la larghezza della riga più vicina con la stoffa
    const fillRow = (rw) => {
      if (!rw.some(x => x > 0)) return false;
      for (let pass = 0; pass < NT && rw.some(x => x < 0); pass++) {
        const c = Float32Array.from(rw);
        for (let i = 0; i < NT; i++) if (c[i] < 0) { const l = c[(i + NT - 1) % NT], rr = c[(i + 1) % NT]; if (l > 0 || rr > 0) rw[i] = l > 0 && rr > 0 ? (l + rr) / 2 : Math.max(l, rr); }
      }
      return true;
    };
    const ok = grid.map(fillRow);
    if (!ok.some(Boolean)) return null;
    for (let j = 0; j < NA; j++) if (!ok[j]) {
      let k = j; while (k >= 0 && !ok[k]) k--;
      if (k < 0) { k = j; while (k < NA && !ok[k]) k++; }
      grid[j] = Float32Array.from(grid[k]);
      ok[j] = 2; // copiata
    }
    // le righe senza stoffa vicina sono più strette di quelle sopra: niente scalini, la fascia scende dritta
    for (let j = NA - 2; j >= 0; j--) for (let i = 0; i < NT; i++) grid[j][i] = Math.max(grid[j][i], grid[j + 1][i] * .985);
    // ammorbidisco il giro (pieghe minute)
    grid.forEach(rw => { const c = Float32Array.from(rw); for (let i = 0; i < NT; i++) rw[i] = (c[(i + NT - 1) % NT] + 2 * c[i] + c[(i + 1) % NT]) / 4; });
    const pos = [], uvs = [], index = [];
    for (let j = 0; j < NA; j++) {
      const a = -half + 2 * half * j / (NA - 1);
      for (let i = 0; i <= NT; i++) {
        const ang = (i / NT - .5) * 2 * Math.PI, rho = grid[j][i % NT] + lift;
        const p = r.center.clone().addScaledVector(r.axis, a).addScaledVector(r.out, Math.cos(ang) * rho).addScaledVector(r.side, Math.sin(ang) * rho);
        pos.push(p.x, p.y, p.z);
        uvs.push(i / NT, .5 - a / half * .38);
      }
    }
    for (let j = 0; j < NA - 1; j++) for (let i = 0; i < NT; i++) {
      const q = j * (NT + 1) + i, w = q + NT + 1;
      index.push(q, q + 1, w, q + 1, w + 1, w);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(index);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, this.bandMats.worn);
    mesh.renderOrder = 2;
    return mesh;
  }

  /**
   * Fascia da capitano 3D. ab = { canvas (disegno steso, components/CaptainBand.js → bandRaster con aspect BAND_RING_ASPECT),
   * bg, border, row } o null (niente fascia). Con ab.row la fascia è indossata sulla manica sinistra della maglia;
   * senza, è da sola al posto della maglia.
   */
  setArmband(ab) {
    const { THREE } = this.L;
    if (!ab || !ab.canvas) {
      if (this.band) this.band.visible = false;
      if (this.bandWorn) this.bandWorn.visible = false;
      if (this.model) this.model.visible = true;
      return;
    }
    const src = ab.canvas, bg = validColor(ab.bg, '#888888'), border = validColor(ab.border, '#111111');
    if (!this.bandMats) {
      const tex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = this.renderer.capabilities.getMaxAnisotropy(); return t; };
      this.bandCanvas = document.createElement('canvas');
      this.bandInnerCanvas = document.createElement('canvas');
      this.bandFlapCanvas = document.createElement('canvas');
      this.bandTex = tex(this.bandCanvas);
      this.bandInnerTex = tex(this.bandInnerCanvas);
      this.bandFlapTex = tex(this.bandFlapCanvas);
      // costine del tessuto elastico (rilievo)
      const ribs = document.createElement('canvas'); ribs.width = 8; ribs.height = 512;
      const rc = ribs.getContext('2d');
      for (let y = 0; y < 512; y++) { const v = Math.round(128 + 120 * Math.sin(y / 512 * Math.PI * 2 * 34)); rc.fillStyle = `rgb(${v},${v},${v})`; rc.fillRect(0, y, 8, 1); }
      const bump = new THREE.CanvasTexture(ribs);
      bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
      const mat = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1.2, roughness: .9, metalness: 0, ...extra });
      this.bandWornCanvas = document.createElement('canvas');
      this.bandWornTex = tex(this.bandWornCanvas);
      this.bandWornTex.wrapS = THREE.RepeatWrapping;
      this.bandMats = { outer: mat(this.bandTex), inner: mat(this.bandInnerTex, { side: THREE.BackSide }), flap: mat(this.bandFlapTex),
        edge: new THREE.MeshStandardMaterial({ roughness: .9, metalness: 0 }),
        // indossata: bordi netti dove finisce la fascia (parte trasparente della texture), sempre sopra la stoffa
        worn: mat(this.bandWornTex, { alphaTest: .5, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }) };
    }
    const worn = !!ab.row;
    if (!worn && !this.band) {
      // da sola: misure di una fascia vera (circonferenza ~30 cm, altezza ~7 cm) rispetto alla maglia, un po' ovale come quando è chiusa
      const g = new THREE.Group(), ring = this._bandRing(), R = this.size.x * .13;
      ring.scale.set(R * 1.1, R, R * .9);
      g.add(ring);
      g.position.copy(this.center);
      g.rotation.x = .24; // un po' dall'alto: si vede anche l'interno, come nelle foto
      this.band = g;
      this.scene.add(g);
    }
    if (worn) {
      // indossata: la fascia è la stoffa della manica sinistra in quel tratto, appena sollevata, con il tessuto della fascia
      // sopra: segue pieghe e forma della maglia. La "C" sul lato esterno del braccio.
      const r = this._sleeveRing(ab.row);
      if (r && this._wornKey !== this._ringKey) {
        if (this.bandWorn) { this.scene.remove(this.bandWorn); this.bandWorn.geometry.dispose(); }
        this.bandWorn = this._wornBand(ab.row, r);
        this._wornKey = this._ringKey;
        if (this.bandWorn) this.scene.add(this.bandWorn);
      }
      if (this.bandWorn) this.bandWorn.visible = !!r;
      if (this.band) this.band.visible = false;
      if (this.model) this.model.visible = true;
    } else {
      this.band.visible = true;
      if (this.bandWorn) this.bandWorn.visible = false;
      if (this.model) this.model.visible = false;
    }
    // stoffa: il disegno con le costine e i bordi cuciti
    const W = src.width, H = src.height;
    const weave = (c, w, h) => {
      const x = c.getContext('2d');
      x.globalCompositeOperation = 'multiply';
      for (let i = 0; i < 34; i++) {
        const y = i / 34 * h;
        x.fillStyle = 'rgba(0,0,0,.16)'; x.fillRect(0, y + h / 34 * .55, w, h / 34 * .45);
      }
      x.globalCompositeOperation = 'source-over';
    };
    const stitch = (x, w, h, inset) => {
      x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = Math.max(1, h * .012); x.setLineDash([h * .035, h * .025]);
      x.beginPath(); x.moveTo(0, inset); x.lineTo(w, inset); x.moveTo(0, h - inset); x.lineTo(w, h - inset); x.stroke();
      x.setLineDash([]);
    };
    const oc = this.bandCanvas; oc.width = W; oc.height = H;
    const o = oc.getContext('2d');
    o.drawImage(src, 0, 0);
    weave(oc, W, H);
    o.fillStyle = border; o.fillRect(0, 0, W, H * .035); o.fillRect(0, H * .965, W, H * .035);
    stitch(o, W, H, H * .06);
    // interno: tessuto scuro a righe del colore della fascia
    const ic = this.bandInnerCanvas; ic.width = 64; ic.height = 256;
    const ix = ic.getContext('2d');
    const dark = new THREE.Color(bg).multiplyScalar(.18), mid = new THREE.Color(bg).multiplyScalar(.55);
    ix.fillStyle = '#' + dark.getHexString(); ix.fillRect(0, 0, 64, 256);
    ix.fillStyle = '#' + mid.getHexString();
    for (let i = 0; i < 22; i++) ix.fillRect(0, i * 256 / 22, 64, 256 / 22 * .3);
    // linguetta: tinta della fascia, costine e cucitura tutto intorno
    const fc = this.bandFlapCanvas; fc.width = 128; fc.height = 256;
    const fx = fc.getContext('2d');
    fx.fillStyle = bg; fx.fillRect(0, 0, 128, 256);
    weave(fc, 128, 256);
    fx.strokeStyle = 'rgba(0,0,0,.35)'; fx.lineWidth = 2; fx.setLineDash([8, 6]); fx.strokeRect(9, 12, 110, 232); fx.setLineDash([]);
    fx.fillStyle = 'rgba(0,0,0,.25)'; fx.fillRect(0, 0, 3, 256); fx.fillRect(125, 0, 3, 256); // bordi della linguetta
    // indossata: la stessa stoffa con sopra e sotto un margine trasparente (v 0,12..0,88) e la linguetta col velcro sul retro
    const wc = this.bandWornCanvas; wc.width = W; wc.height = Math.round(H / .76);
    const wx = wc.getContext('2d'), m0 = Math.round(wc.height * .12);
    wx.clearRect(0, 0, W, wc.height);
    wx.drawImage(oc, 0, m0, W, H);
    wx.fillStyle = 'rgba(0,0,0,.28)'; wx.fillRect(W * .045, m0, Math.max(2, W * .004), H); wx.fillRect(W * .955, m0, Math.max(2, W * .004), H);
    [this.bandTex, this.bandInnerTex, this.bandFlapTex, this.bandWornTex].forEach(t => { t.dispose(); t.needsUpdate = true; });
    this.bandMats.edge.color.set(border);
  }

  setTexture(canvas) {
    const old = this.texture.image;
    // la memoria della texture sulla GPU ha dimensione fissa: se cambia la ricreo
    if (old && (old.width !== canvas.width || old.height !== canvas.height)) this.texture.dispose();
    this.texture.image = canvas;
    this.texture.needsUpdate = true;
  }

  resize(width, height) {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  render() { this.renderer.render(this.scene, this.camera); }

  dispose() {
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._tween) cancelAnimationFrame(this._tween);
    [this.bandTex, this.bandInnerTex, this.bandFlapTex, this.bandWornTex].forEach(t => t && t.dispose());
    if (this.controls) this.controls.dispose();
    this.controls = null;
    this.texture.dispose();
    this.renderer.dispose();
  }
}

/** Inquadrature delle parti della maglia per l'editor (yaw in gradi: 0 davanti, 180 retro, negativo = lato sinistro). */
export const FOCUS = {
  all:      { yaw: 0 },
  front:    { yaw: 0 },
  back:     { yaw: 180 },
  collar:   { yaw: 0, y: .4, z: .1, d: .42 },
  collarBack: { yaw: 180, y: .4, d: .42 },
  // parti di lato: il centro resta sull'asse della maglia (vedi Stage.focus), la maglia si gira verso la parte
  shoulder: { yaw: -60, y: .28, d: .64 },
  sleeve:   { yaw: -68, y: .18, d: .62 },
  sleeveR:  { yaw: 68, y: .18, d: .62 },
  sleevePatch: { yaw: -88, y: .2, d: .62 }, // patch della competizione (esterno della manica sinistra)
  bandArm:  { yaw: -88, y: .12, d: .62 },  // fascia da capitano (manica sinistra, sotto la patch)
  bandAlone: { yaw: 0, d: .5 },                      // fascia da capitano 3D da sola (al centro della scena)
  cuff:     { yaw: -75, y: .13, d: .6 },
  chest:    { yaw: 0, y: .22, d: .55 },
  sponsor:  { yaw: 0, y: .05, d: .62 },
  backTop:  { yaw: 180, y: .1, d: .7 },
  backLow:  { yaw: 180, y: -.12, d: .7 },
  hem:      { yaw: 0, y: -.3, d: .6 }
};

/**
 * Maglia 3D ruotabile dentro `container` (zoom: true = vista ingrandita con zoom e spostamento).
 * Restituisce { update(kit, opts), setView('front'|'back'), zoomBy(f), dispose() }.
 * opts di update: { crestUrl, compPatches, compPatchOnly } (vedi paintKitTexture)
 */
export function createKitViewer(container, { zoom = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = `width:100%; height:100%; display:block; touch-action:${zoom ? 'none' : 'pan-y'}; cursor:grab;`;
  container.innerHTML = '';
  container.appendChild(canvas);
  let stage = null, disposed = false, token = 0;
  const ready = Promise.all([loadLib(), loadModel()]).then(([L, model]) => {
    if (disposed) return null;
    const r = container.getBoundingClientRect();
    stage = new Stage(L, model, canvas, { interactive: true, zoom, width: Math.max(1, r.width), height: Math.max(1, r.height) });
    return stage;
  });
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
    if (!stage) return;
    const r = container.getBoundingClientRect();
    if (r.width && r.height) { stage.resize(r.width, r.height); stage.render(); }
  }) : null;
  if (ro) ro.observe(container);

  return {
    ready,
    async update(kit, opts = {}) {
      const my = ++token;
      const k = normalizeKit(kit);
      const [st, tex, model] = await Promise.all([ready, paintKitTexture(k, { ...opts, size: opts.size || editorTextureSize() }), loadVariant(k)]);
      if (!st || disposed || my !== token) return;
      st.setModel(model);
      st.applyKit(k, tex);
      st.render();
      requestAnimationFrame(() => { if (!disposed) st.render(); });
    },
    setView(view) {
      if (!stage) return;
      stage.focus(view === 'back' ? FOCUS.back : FOCUS.front);
    },
    zoomBy(f) { if (stage) stage.zoomBy(f); },
    /** Inquadra una parte della maglia (vedi FOCUS): 'all', 'back', 'collar', 'shoulder', ... */
    focus(name) {
      if (!stage) return;
      const f = FOCUS[name] || FOCUS.all;
      stage.focus(f);
    },
    /** Fascia da capitano 3D da sola al posto della maglia (ab = bandRaster) o null per tornare alla maglia. */
    async setArmband(ab) {
      const st = await ready;
      if (!st || disposed) return;
      st.setArmband(ab);
      st.render();
    },
    dispose() {
      disposed = true;
      if (ro) ro.disconnect();
      if (stage) stage.dispose();
    }
  };
}

/* ------------------------------------------------------------- foto PNG */
let shot = null; // palcoscenico unico per le foto (un solo contesto WebGL)
let queue = Promise.resolve();
const shotCache = new Map();

/**
 * Foto PNG della maglia (data URL, sfondo trasparente).
 * opts: { crestUrl, width (default 600), view ('front'|'back' o angolo in gradi), textureSize (default 2048), plain,
 *         compPatches ([{ id, url }] patch della competizione sulla manica sinistra) }
 */
export function renderKitImage(kit, opts = {}) {
  const width = Math.round(opts.width || 600), height = Math.round(width * 16 / 15);
  const key = JSON.stringify([kit, opts.crestUrl || '', width, opts.view || 'front', opts.textureSize || 2048, !!opts.plain, opts.compPatches || [], opts.compPatchOnly || '']);
  if (shotCache.has(key)) return shotCache.get(key);
  const job = queue.then(async () => {
    if (opts.isWanted && !opts.isWanted()) { shotCache.delete(key); return ''; }
    const [L, model] = await Promise.all([loadLib(), loadModel()]);
    if (!shot) shot = new Stage(L, model, document.createElement('canvas'), { width, height });
    shot.resize(width, height);
    const k = normalizeKit(kit);
    const [tex, variant] = await Promise.all([
      paintKitTexture(k, { crestUrl: opts.crestUrl, size: opts.textureSize || 2048, plain: opts.plain, compPatches: opts.compPatches, compPatchOnly: opts.compPatchOnly }),
      loadVariant(k)
    ]);
    shot.setModel(variant);
    shot.applyKit(k, tex);
    shot.setView(typeof opts.view === 'number' ? opts.view : opts.view === 'back' ? 180 : 0);
    shot.render();
    return shot.renderer.domElement.toDataURL('image/png');
  }).catch(e => { console.error('Divisa 3D:', e); shotCache.delete(key); return ''; });
  queue = job;
  if (shotCache.size > 150) shotCache.delete(shotCache.keys().next().value);
  shotCache.set(key, job);
  return job;
}

/**
 * Foto PNG della fascia da capitano 3D (data URL, sfondo trasparente) per Formazione e Live.
 * ab = disegno steso (components/CaptainBand.js → bandRaster(band, BAND_RING_ASPECT)).
 */
const BAND_PHOTO = { yaw: 0, d: .27 }; // inquadratura della foto della fascia
export function renderBandImage(ab, { width = 360, height = 240 } = {}) {
  const job = queue.then(async () => {
    const [L, model] = await Promise.all([loadLib(), loadModel()]);
    if (!shot) shot = new Stage(L, model, document.createElement('canvas'), { width, height });
    shot.resize(width, height);
    shot.setArmband(ab);
    shot.focus(BAND_PHOTO, 0);
    shot.render();
    const url = shot.renderer.domElement.toDataURL('image/png');
    shot.setArmband(null);
    shot.setView(0);
    return url;
  }).catch(e => { console.error('Fascia 3D:', e); return ''; });
  queue = job;
  return job;
}

/** Converte un data URL in Blob (per il caricamento su ImgBB). */
export async function dataUrlToBlob(dataUrl) {
  return (await fetch(dataUrl)).blob();
}

let IMG = 0;
/**
 * <img> della maglia: usa kit.image (foto salvata) se presente, altrimenti la genera in 3D.
 * opts: { crestUrl, width, view, textureSize, plain }; attrs: attributi del contenitore.
 */
export function kitImageHTML(kit, opts = {}, attrs = '') {
  if (!kit) return '';
  const style = 'width:100%; height:auto; display:block; aspect-ratio:15/16; object-fit:contain;';
  if (kit.image && !opts.live) return `<div ${attrs}><img src="${String(kit.image).replace(/"/g, '&quot;')}" alt="Divisa" loading="lazy" style="${style}"></div>`;
  const id = `ki${++IMG}`;
  requestAnimationFrame(() => {
    const isWanted = () => !!document.querySelector(`img[data-kit-img="${id}"]`);
    // se la foto era stata chiesta da un'immagine poi tolta (lista ridisegnata) il lavoro è annullato: la richiedo
    renderKitImage(kit, { ...opts, isWanted }).then(src => (!src && isWanted() ? renderKitImage(kit, { ...opts, isWanted }) : src)).then(src => {
      const el = document.querySelector(`img[data-kit-img="${id}"]`);
      if (el && src) { el.src = src; el.style.opacity = 1; }
    });
  });
  return `<div ${attrs}><img data-kit-img="${id}" alt="Divisa" style="${style} opacity:.15; transition:opacity .2s;" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="></div>`;
}

const PAIR_STYLE_ID = 'kit-pair-style';
function injectPairStyle() {
  if (document.getElementById(PAIR_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PAIR_STYLE_ID;
  style.textContent = `
    .kit-pair { position: relative; width: 100%; aspect-ratio: 10 / 9; }
    .kit-pair .kp-kit { position: absolute; transition: left .35s ease, top .35s ease, width .35s ease, filter .35s ease; }
    .kit-pair:not(.swapped) .kp-1, .kit-pair.swapped .kp-2 { left: 0; top: 0; width: 74%; z-index: 1; }
    .kit-pair:not(.swapped) .kp-2, .kit-pair.swapped .kp-1 { left: 60%; top: 52%; width: 40%; z-index: 2; filter: drop-shadow(0 2px 6px rgba(0,0,0,.45)); }
    .kit-pair:not(.swapped) .kp-2, .kit-pair.swapped .kp-1 { cursor: pointer; }
    /* segno "scambia" sull'angolo della maglia piccola: il tocco arriva comunque alla maglia sotto */
    .kit-pair .kp-swap { position: absolute; right: 0; bottom: 0; z-index: 3; width: 24px; height: 24px; border-radius: 50%; pointer-events: none;
      display: flex; align-items: center; justify-content: center; font-size: .85rem;
      background: color-mix(in srgb, var(--bg2) 85%, transparent); color: var(--accent); border: 1px solid var(--border); }
    .kit-pair .kp-swap i { transition: transform .35s ease; }
    .kit-pair.swapped .kp-swap i { transform: rotate(180deg); }
  `;
  document.head.appendChild(style);
}

/** Prima maglia mostrata in questo momento in grande nella coppia (1 o 2). */
export function kitPairShown(el) {
  const pair = el && el.closest ? (el.classList.contains('kit-pair') ? el : el.querySelector('.kit-pair')) : null;
  return pair && pair.classList.contains('swapped') ? 2 : 1;
}

/**
 * Prima e seconda maglia insieme: una in grande a sinistra, l'altra piccola in basso a destra;
 * toccando quella piccola si scambiano (il tocco su quella grande prosegue, es. apre l'editor in Home).
 * Con una sola maglia mostra solo quella.
 * opts: come kitImageHTML (crestUrl, width = larghezza della maglia grande); attrs: attributi del contenitore.
 */
export function kitPairHTML(kit, kit2, opts = {}, attrs = '') {
  if (!kit || !kit2) return kitImageHTML(kit || kit2, opts, attrs);
  injectPairStyle();
  // tocco sulla maglia piccola (kp-2, oppure kp-1 dopo lo scambio): si scambiano
  const tap = (n) => `onclick="const p=this.closest('.kit-pair'); if (p.classList.contains('swapped') === ${n === 1}) { event.stopPropagation(); p.classList.toggle('swapped'); }"`;
  return `<div ${attrs}><div class="kit-pair">
      ${kitImageHTML(kit, opts, `class="kp-kit kp-1" title="Prima maglia" ${tap(1)}`)}
      ${kitImageHTML(kit2, opts, `class="kp-kit kp-2" title="Seconda maglia" ${tap(2)}`)}
      <span class="kp-swap" aria-hidden="true"><i class="ri-arrow-left-right-line"></i></span>
    </div></div>`;
}

const SHOW_STYLE_ID = 'kit-show-style';
function injectShowStyle() {
  if (document.getElementById(SHOW_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SHOW_STYLE_ID;
  style.textContent = `
    .kit-show { position: relative; width: 100%; height: 320px; }
    .kit-show .ks-3d { position: absolute; inset: 0; }
    .kit-show .ks-loading { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--text3); font-size: .8rem; pointer-events: none; }
    .kit-show .ks-label { position: absolute; top: 0; left: 0; z-index: 2; font-size: .65rem; font-weight: 700; text-transform: uppercase; letter-spacing: .4px;
      color: var(--text2); background: color-mix(in srgb, var(--bg2) 80%, transparent); border: 1px solid var(--border); border-radius: 999px; padding: .15rem .55rem; pointer-events: none; }
    .kit-show .ks-other { position: absolute; right: 0; bottom: 0; z-index: 2; width: 27%; cursor: pointer; filter: drop-shadow(0 2px 6px rgba(0,0,0,.45)); }
    .kit-show-bar { display: flex; gap: .35rem; justify-content: center; flex-wrap: wrap; margin-top: .5rem; }
    .kit-show-bar button { background: var(--bg2); color: var(--text); border: 1px solid var(--border); border-radius: 10px; padding: .4rem .7rem;
      font-family: var(--font-btn, inherit); font-weight: 700; font-size: .78rem; cursor: pointer; display: inline-flex; align-items: center; gap: .3rem; }
    .kit-show-bar button.ks-sw { color: var(--accent); }
  `;
  document.head.appendChild(style);
}

/**
 * Vetrina 3D delle divise (scheda del club): la maglia si ruota in ogni direzione, si ingrandisce e si sposta
 * come nella vista ingrandita dell'editor. Con due maglie l'altra è piccola in basso a destra:
 * toccandola (o con "Scambia") passa in 3D. Restituisce { dispose() }.
 */
export function mountKitShowcase(container, kit, kit2, opts = {}) {
  injectShowStyle();
  const kits = [kit, kit2].filter(Boolean);
  if (!container || !kits.length) return { dispose() {} };
  const labels = kit && kit2 ? ['Prima maglia', 'Seconda maglia'] : [kit ? 'Prima maglia' : 'Seconda maglia'];
  let cur = 0;
  container.innerHTML = `
    <div class="kit-show">
      <div class="ks-loading">Caricamento maglia 3D…</div>
      <div class="ks-3d"></div>
      <div class="ks-label"></div>
      ${kits.length > 1 ? '<div class="ks-other" title="Mostra l\'altra maglia"></div>' : ''}
    </div>
    <div class="kit-show-bar">
      <button data-ks="front">Davanti</button><button data-ks="back">Retro</button>
      <button data-ks="in" aria-label="Avvicina">＋ Zoom</button><button data-ks="out" aria-label="Allontana">− Zoom</button>
      ${kits.length > 1 ? '<button data-ks="swap" class="ks-sw" title="Scambia prima e seconda maglia"><i class="ri-arrow-left-right-line"></i> Scambia</button>' : ''}
    </div>`;
  const viewer = createKitViewer(container.querySelector('.ks-3d'), { zoom: true });
  viewer.ready.then(() => { const l = container.querySelector('.ks-loading'); if (l) l.remove(); })
    .catch(() => { const l = container.querySelector('.ks-loading'); if (l) l.textContent = 'Il 3D non è supportato su questo dispositivo'; });
  const show = () => {
    viewer.update(kits[cur], { crestUrl: opts.crestUrl || '' }).catch(e => console.error('Divisa:', e));
    viewer.setView('front');
    container.querySelector('.ks-label').textContent = labels[cur];
    const other = container.querySelector('.ks-other');
    if (other) other.innerHTML = kitImageHTML(kits[1 - cur], { crestUrl: opts.crestUrl || '', width: 240 });
  };
  show();
  const onClick = (e) => {
    const b = e.target.closest('[data-ks], .ks-other');
    if (!b) return;
    const a = b.classList.contains('ks-other') ? 'swap' : b.dataset.ks;
    if (a === 'swap') { if (kits.length > 1) { cur = 1 - cur; show(); } }
    else if (a === 'in') viewer.zoomBy(.75);
    else if (a === 'out') viewer.zoomBy(1 / .75);
    else viewer.setView(a);
  };
  container.addEventListener('click', onClick);
  return {
    dispose() { container.removeEventListener('click', onClick); viewer.dispose(); }
  };
}

const ZOOM_STYLE_ID = 'kit-zoom-style';
export function injectZoomStyle() {
  if (document.getElementById(ZOOM_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = ZOOM_STYLE_ID;
  // stesse classi della vista ingrandita dell'editor: il tema (Zoom maglia) vale anche qui
  style.textContent = `
    .kit-zoom { position: fixed; inset: 0; z-index: 4000; background: var(--kz-bg, var(--bg, #111)); display: flex; flex-direction: column; }
    .kit-zoom-head { display: flex; align-items: center; justify-content: space-between; gap: .5rem; padding: calc(.6rem + env(safe-area-inset-top, 0px)) .8rem .4rem; color: var(--title, var(--text)); font-family: var(--font-title, inherit); font-weight: 700; }
    .kit-zoom-head span { min-width: 0; overflow-wrap: anywhere; }
    .kit-zoom-stage { flex: 1; min-height: 0; position: relative; }
    .kit-zoom-stage > div { position: absolute; inset: 0; }
    .kit-zoom-bar { display: flex; gap: .4rem; justify-content: center; flex-wrap: wrap; padding: .5rem .8rem calc(.8rem + var(--safe-b, env(safe-area-inset-bottom, 0px))); }
    .kit-zoom-bar button.on { border-color: var(--accent); color: var(--accent); }
    .kit-zoom-bar button, .kit-zoom-head button { background: var(--kz-btn-bg, var(--bg2)); color: var(--kz-btn-text, var(--text)); font-family: var(--font-btn, inherit); border: 1px solid var(--kz-btn-border, var(--border)); border-radius: 10px; padding: .45rem .8rem; font-weight: 700; cursor: pointer; font-size: .85rem; flex-shrink: 0; }
    .kit-zoom-tabs { display: flex; gap: .4rem; justify-content: center; flex-wrap: wrap; padding: 0 .8rem .3rem; }
    .kit-zoom-tabs button { background: var(--kz-btn-bg, var(--bg2)); color: var(--kz-btn-text, var(--text)); border: 1px solid var(--kz-btn-border, var(--border)); border-radius: 999px; padding: .3rem .8rem; font-family: var(--font-btn, inherit); font-weight: 700; font-size: .78rem; cursor: pointer; max-width: 46%; overflow-wrap: anywhere; }
    .kit-zoom-tabs button.on { border-color: var(--accent); color: var(--accent); }
  `;
  document.head.appendChild(style);
}

/**
 * Maglie in 3D a tutto schermo (es. dal live): items = [{ kit, crestUrl, label, compPatches }], start = indice iniziale
 * (compPatches: patch della competizione della partita, tutte sulla manica sinistra).
 * Si ruota in ogni direzione, zoom e spostamento come nella vista ingrandita dell'editor; con più maglie
 * le schede in alto passano dall'una all'altra. Restituisce { close() }; opts.onClose alla chiusura.
 */
export function openKitOverlay(items, start = 0, opts = {}) {
  const list = (items || []).filter(it => it && it.kit);
  if (!list.length) return { close() {} };
  injectZoomStyle();
  let cur = Math.min(Math.max(0, start), list.length - 1);
  const el = document.createElement('div');
  el.className = 'kit-zoom';
  if (opts.zIndex) el.style.zIndex = opts.zIndex;
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  el.innerHTML = `
    <div class="kit-zoom-head"><span></span><button data-z="close" aria-label="Chiudi"><i class="ri-close-line"></i> Chiudi</button></div>
    ${list.length > 1 ? `<div class="kit-zoom-tabs">${list.map((it, i) => `<button data-z="pick" data-i="${i}">${esc(it.label || `Maglia ${i + 1}`)}</button>`).join('')}</div>` : ''}
    <div class="kit-zoom-stage"><div></div></div>
    <div class="kit-zoom-bar">
      <button data-z="front">Davanti</button><button data-z="back">Retro</button>
      <button data-z="in" aria-label="Avvicina">＋ Zoom</button>
      <button data-z="out" aria-label="Allontana">− Zoom</button>
    </div>`;
  document.body.appendChild(el);
  const viewer = createKitViewer(el.querySelector('.kit-zoom-stage > div'), { zoom: true });
  const show = () => {
    const it = list[cur];
    el.querySelector('.kit-zoom-head span').textContent = it.title || it.label || 'Maglia';
    el.querySelectorAll('[data-z="pick"]').forEach(b => b.classList.toggle('on', Number(b.dataset.i) === cur));
    viewer.update(it.kit, { crestUrl: it.crestUrl || '', compPatches: it.compPatches || [] }).catch(err => console.error('Divisa:', err));
    viewer.setView('front');
  };
  show();
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    viewer.dispose(); el.remove();
    if (opts.onClose) opts.onClose();
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-z]');
    if (!b) return;
    const z = b.dataset.z;
    if (z === 'close') close();
    else if (z === 'pick') { cur = Number(b.dataset.i); show(); }
    else if (z === 'in') viewer.zoomBy(.75);
    else if (z === 'out') viewer.zoomBy(1 / .75);
    else viewer.setView(z);
  });
  return { close };
}
