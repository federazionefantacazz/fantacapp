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
 * Maglia con la forma di colletto richiesta (una volta per forma).
 * 'polo': bordo del collo portato sulla cucitura del colletto (icons/kit3d/neck-polo.bin), costina nascosta
 *         e colletto alto di icons/kit3d/collar-polo.glb, già posizionato sulla maglia.
 */
const variants = new Map();
const COLLAR_TOP = 1.675; // punto più alto del colletto alto (collar-polo.glb), con un po' di margine
function loadVariant(shape) {
  const key = isDeformed(shape) ? shape : 'v';
  if (!variants.has(key)) {
    variants.set(key, Promise.all([loadLib(), loadModel()]).then(async ([L, base]) => {
      if (key === 'v') return base;
      const { THREE } = L;
      const model = base.clone(true);
      if (key === 'polo') {
        // bordo della stoffa sulla cucitura del colletto: spostamenti precalcolati per ogni vertice vicino al collo
        // (neck-polo.bin: 'NKP1', n. mesh, poi per mesh n, indici uint32, spostamenti int16 x3 in unità di 0,05 mm)
        const data = await fetch(KIT3D_FILES.neckPolo).then(r => r.arrayBuffer());
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
        // la costina dello scollo a V non serve: il colletto è cucito direttamente alla stoffa
        model.traverse(o => { if (o.isMesh && /Pattern2D_3805002/.test(`${o.name}|${o.parent ? o.parent.name : ''}`)) o.visible = false; });
        const loader = new L.GLTFLoader();
        const collar = (await loader.loadAsync(KIT3D_FILES.collarPolo)).scene;
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

class Stage {
  constructor(L, model, canvas, { interactive = false, width = 600, height = 640 } = {}) {
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
      c.enablePan = false;
      c.enableZoom = false;
      c.minPolarAngle = c.maxPolarAngle = Math.PI / 2; // solo rotazione orizzontale
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
    if (this.controls) this.controls.dispose();
    this.texture.dispose();
    this.renderer.dispose();
  }
}

/**
 * Maglia 3D ruotabile dentro `container`. Restituisce { update(kit, opts), setView('front'|'back'), dispose() }.
 * opts di update: { crestUrl }
 */
export function createKitViewer(container) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%; height:100%; display:block; touch-action:pan-y; cursor:grab;';
  container.innerHTML = '';
  container.appendChild(canvas);
  let stage = null, disposed = false, token = 0;
  const ready = Promise.all([loadLib(), loadModel()]).then(([L, model]) => {
    if (disposed) return null;
    const r = container.getBoundingClientRect();
    stage = new Stage(L, model, canvas, { interactive: true, width: Math.max(1, r.width), height: Math.max(1, r.height) });
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
      const [st, tex, model] = await Promise.all([ready, paintKitTexture(k, { ...opts, size: opts.size || 2048 }), loadVariant(k.collarShape)]);
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
      loadVariant(k.collarShape)
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
