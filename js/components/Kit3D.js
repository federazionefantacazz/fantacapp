import { paintKitTexture, normalizeKit, KIT3D_FILES } from './KitRenderer.js';
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
function loadRaglan() {
  if (!raglanJob) raglanJob = loadLib().then(async L => (await new L.GLTFLoader().loadAsync(KIT3D_FILES.raglan)).scene);
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
const COLLAR_TOP = 1.675; // punto più alto del colletto alto (collar-polo.glb), con un po' di margine
function loadVariant(kit) {
  const raglan = kit.sleeveCut === 'raglan', shape = isDeformed(kit.collarShape) ? kit.collarShape : 'v';
  const key = (raglan ? 'raglan:' : 'setin:') + shape;
  if (!variants.has(key)) {
    variants.set(key, Promise.all([loadLib(), raglan ? loadRaglan() : loadModel()]).then(async ([L, base]) => {
      if (shape === 'v') return base;
      const { THREE } = L;
      const model = base.clone(true);
      if (shape === 'polo') {
        // bordo della stoffa sulla cucitura del colletto: spostamenti precalcolati per ogni vertice vicino al collo
        // (neck-polo.bin: 'NKP1', n. mesh, poi per mesh n, indici uint32, spostamenti int16 x3 in unità di 0,05 mm).
        // Raglan (neck-polo-raglan.bin): la stoffa che resterebbe davanti al colletto o alle strisce va appena dietro
        const data = await fetch(raglan ? KIT3D_FILES.neckPoloRaglan : KIT3D_FILES.neckPolo).then(r => r.arrayBuffer());
        const dv = new DataView(data);
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
        // la costina dello scollo a V non serve: il colletto è cucito direttamente alla stoffa (raglan: in neck-cut-raglan.bin)
        if (!raglan) model.traverse(o => { if (o.isMesh && /Pattern2D_3805002/.test(`${o.name}|${o.parent ? o.parent.name : ''}`)) o.visible = false; });
      }
      if (shape === 'polo' && raglan) {
        // la costina del girocollo fa da base al colletto (l'attaccatura coincide); davanti la maglia si apre a V come la
        // classica: stoffa e costina dentro l'apertura si tolgono, il bordo del taglio resta sotto le strisce
        // (neck-cut-raglan.bin: 'NKC1', n. mesh, poi per mesh n e gli indici uint32 dei triangoli da togliere)
        const dv = new DataView(await fetch(KIT3D_FILES.neckCutRaglan).then(r => r.arrayBuffer()));
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
      if (shape === 'polo') {
        // raglan: colletto adattato (strisce della V stese sul petto della raglan)
        const loader = new L.GLTFLoader();
        const collar = (await loader.loadAsync(raglan ? KIT3D_FILES.collarPoloRaglan : KIT3D_FILES.collarPolo)).scene;
        collar.traverse(o => { if (o.isMesh) o.geometry.computeVertexNormals(); });
        model.add(collar);
      }
      return model;
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
    this.camera = new THREE.PerspectiveCamera(22, width / height, 0.01, 50);
    this.dist = Math.max(size.y, size.x * height / width) / 2 / Math.tan(THREE.MathUtils.degToRad(11)) * 1.06;
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
    if (this.source === model) return;
    if (this.model) this.scene.remove(this.model);
    this.source = model;
    this.model = model.clone(true);
    this.collarMats = {};
    this.innerMats = [];
    this.model.traverse(o => {
      if (!o.isMesh) return;
      const name = o.material.name;
      o.material = o.material.clone();
      o.material.metalness = 0;
      if (name === 'shirt_outer') { o.material.map = this.texture; o.material.needsUpdate = true; }
      if (name === 'shirt_inner') (this.innerMats ||= []).push(o.material);
      // maglia raglan: l'interno è il rovescio della stessa superficie
      if (name === 'shirt_inner_flip') { o.material.side = this.L.THREE.BackSide; this.innerMats.push(o.material); }
      if (/^polo_/.test(name)) (this.collarMats[name] ||= []).push(o.material);
    });
    this.scene.add(this.model);
  }

  /** Veste la maglia: texture UV dipinta, interno in ombra, colore del colletto alto (se c'è). */
  applyKit(kit, full) {
    this.setTexture(full);
    // interno della maglia in ombra: colore della maglia molto scurito
    const inner = new this.L.THREE.Color(validColor(kit.colors.base, '#888888')).multiplyScalar(0.22);
    this.innerMats.forEach(m => {
      m.color.copy(inner); m.roughness = 1; m.envMapIntensity = 0.4;
      m.polygonOffset = true; m.polygonOffsetFactor = 1; m.polygonOffsetUnits = 2; // l'interno non buca mai la stoffa esterna
    });
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
    const a = yawDeg * Math.PI / 180;
    this.camera.position.set(this.center.x + Math.sin(a) * this.dist, this.center.y, this.center.z + Math.cos(a) * this.dist);
    this.camera.lookAt(this.center);
    if (this.controls) { this.controls.target.copy(this.center); this.controls.update(); }
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
    if (this.controls) this.controls.dispose();
    this.controls = null;
    this.texture.dispose();
    this.renderer.dispose();
  }
}

/**
 * Maglia 3D ruotabile dentro `container` (zoom: true = vista ingrandita con zoom e spostamento).
 * Restituisce { update(kit, opts), setView('front'|'back'), zoomBy(f), dispose() }.
 * opts di update: { crestUrl }
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
      stage.setView(view === 'back' ? 180 : 0);
      stage.render();
    },
    zoomBy(f) { if (stage) stage.zoomBy(f); },
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
 * opts: { crestUrl, width (default 600), view ('front'|'back' o angolo in gradi), textureSize (default 2048), plain }
 */
export function renderKitImage(kit, opts = {}) {
  const width = Math.round(opts.width || 600), height = Math.round(width * 16 / 15);
  const key = JSON.stringify([kit, opts.crestUrl || '', width, opts.view || 'front', opts.textureSize || 2048, !!opts.plain]);
  if (shotCache.has(key)) return shotCache.get(key);
  const job = queue.then(async () => {
    if (opts.isWanted && !opts.isWanted()) { shotCache.delete(key); return ''; }
    const [L, model] = await Promise.all([loadLib(), loadModel()]);
    if (!shot) shot = new Stage(L, model, document.createElement('canvas'), { width, height });
    shot.resize(width, height);
    const k = normalizeKit(kit);
    const [tex, variant] = await Promise.all([
      paintKitTexture(k, { crestUrl: opts.crestUrl, size: opts.textureSize || 2048, plain: opts.plain }),
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
    renderKitImage(kit, { ...opts, isWanted }).then(src => {
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
    .kit-pair .kp-swap { position: absolute; top: 0; right: 0; z-index: 3; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; padding: 0;
      display: flex; align-items: center; justify-content: center; font-size: 1rem;
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
 * la freccia le scambia. Con una sola maglia mostra solo quella.
 * opts: come kitImageHTML (crestUrl, width = larghezza della maglia grande); attrs: attributi del contenitore.
 */
export function kitPairHTML(kit, kit2, opts = {}, attrs = '') {
  if (!kit || !kit2) return kitImageHTML(kit || kit2, opts, attrs);
  injectPairStyle();
  return `<div ${attrs}><div class="kit-pair">
      ${kitImageHTML(kit, opts, 'class="kp-kit kp-1" title="Prima maglia"')}
      ${kitImageHTML(kit2, opts, 'class="kp-kit kp-2" title="Seconda maglia"')}
      <button type="button" class="kp-swap" title="Scambia prima e seconda maglia" aria-label="Scambia prima e seconda maglia"
        onclick="event.stopPropagation(); this.closest('.kit-pair').classList.toggle('swapped')"><i class="ri-arrow-left-right-line"></i></button>
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
function injectZoomStyle() {
  if (document.getElementById(ZOOM_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = ZOOM_STYLE_ID;
  // stesse classi della vista ingrandita dell'editor: il tema (Zoom maglia) vale anche qui
  style.textContent = `
    .kit-zoom { position: fixed; inset: 0; z-index: 4000; background: var(--kz-bg, var(--bg, #111)); display: flex; flex-direction: column; }
    .kit-zoom-head { display: flex; align-items: center; justify-content: space-between; gap: .5rem; padding: calc(.6rem + env(safe-area-inset-top, 0px)) .8rem .4rem; color: var(--title, var(--text)); font-family: var(--font-title, inherit); font-weight: 700; }
    .kit-zoom-head span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .kit-zoom-stage { flex: 1; min-height: 0; position: relative; }
    .kit-zoom-stage > div { position: absolute; inset: 0; }
    .kit-zoom-bar { display: flex; gap: .4rem; justify-content: center; flex-wrap: wrap; padding: .5rem .8rem calc(.8rem + env(safe-area-inset-bottom, 0px)); }
    .kit-zoom-bar button, .kit-zoom-head button { background: var(--kz-btn-bg, var(--bg2)); color: var(--kz-btn-text, var(--text)); font-family: var(--font-btn, inherit); border: 1px solid var(--kz-btn-border, var(--border)); border-radius: 10px; padding: .45rem .8rem; font-weight: 700; cursor: pointer; font-size: .85rem; flex-shrink: 0; }
    .kit-zoom-tabs { display: flex; gap: .4rem; justify-content: center; flex-wrap: wrap; padding: 0 .8rem .3rem; }
    .kit-zoom-tabs button { background: var(--kz-btn-bg, var(--bg2)); color: var(--kz-btn-text, var(--text)); border: 1px solid var(--kz-btn-border, var(--border)); border-radius: 999px; padding: .3rem .8rem; font-family: var(--font-btn, inherit); font-weight: 700; font-size: .78rem; cursor: pointer; max-width: 46%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .kit-zoom-tabs button.on { border-color: var(--accent); color: var(--accent); }
  `;
  document.head.appendChild(style);
}

/**
 * Maglie in 3D a tutto schermo (es. dal live): items = [{ kit, crestUrl, label }], start = indice iniziale.
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
    viewer.update(it.kit, { crestUrl: it.crestUrl || '' }).catch(err => console.error('Divisa:', err));
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
