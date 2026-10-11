import { paintKitTexture, normalizeKit, KIT3D_FILES } from './KitRenderer.js';
import { deformPoint, isDeformed } from './kitShapes.js';

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

/** Pezzo del modello a cui appartiene una mesh (nome del nodo glTF). */
function partOf(o) {
  const n = `${o.name}|${o.parent ? o.parent.name : ''}`;
  if (/(^|\|)42(_|\||$)/.test(n)) return 'front';
  if (/Pattern2D_3805002/.test(n)) return 'collar';
  return '';
}

/** Modello con la forma di colletto richiesta (geometria deformata, una volta per forma). */
const variants = new Map();
function loadVariant(shape) {
  const key = isDeformed(shape) ? shape : 'v';
  if (!variants.has(key)) {
    variants.set(key, Promise.all([loadLib(), loadModel()]).then(([L, base]) => {
      if (key === 'v') return base;
      const { THREE } = L;
      const model = base.clone(true);
      model.updateMatrixWorld(true);
      const v = new THREE.Vector3(), inv = new THREE.Matrix4();
      model.traverse(o => {
        if (!o.isMesh) return;
        const part = partOf(o);
        if (!part) return;
        const g = o.geometry.clone();
        const src = g.getAttribute('position');
        const out = new Float32Array(src.count * 3);
        inv.copy(o.matrixWorld).invert();
        for (let i = 0; i < src.count; i++) {
          v.fromBufferAttribute(src, i).applyMatrix4(o.matrixWorld);
          const p = deformPoint(key, part, [v.x, v.y, v.z]);
          v.set(p[0], p[1], p[2]).applyMatrix4(inv);
          out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z;
        }
        g.setAttribute('position', new THREE.BufferAttribute(out, 3));
        g.computeBoundingBox(); g.computeBoundingSphere();
        o.geometry = g;
      });
      return model;
    }));
  }
  return variants.get(key);
}

class Stage {
  constructor(L, model, canvas, { interactive = false, width = 600, height = 640 } = {}) {
    const { THREE } = L;
    this.L = L;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(interactive ? Math.min(window.devicePixelRatio || 1, 2) : 1);
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
    this.setModel(model);

    const box = new THREE.Box3().setFromObject(this.model);
    this.center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    this.camera = new THREE.PerspectiveCamera(22, width / height, 0.01, 50);
    this.dist = Math.max(size.y, size.x * height / width) / 2 / Math.tan(THREE.MathUtils.degToRad(11)) * 1.13; // margine anche per i colli alti
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
    this.model.traverse(o => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      o.material.metalness = 0;
      if (o.material.name === 'shirt_outer') { o.material.map = this.texture; o.material.needsUpdate = true; }
    });
    this.scene.add(this.model);
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
      const [st, tex, model] = await Promise.all([ready, paintKitTexture(kit, { ...opts, size: opts.size || 2048 }), loadVariant(normalizeKit(kit).collarShape)]);
      if (!st || disposed || my !== token) return;
      st.setModel(model);
      st.setTexture(tex);
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
 * opts: { crestUrl, width (default 600), view ('front'|'back'), textureSize (default 2048), plain }
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
    const [tex, variant] = await Promise.all([
      paintKitTexture(kit, { crestUrl: opts.crestUrl, size: opts.textureSize || 2048, plain: opts.plain }),
      loadVariant(normalizeKit(kit).collarShape)
    ]);
    shot.setModel(variant);
    shot.setTexture(tex);
    shot.setView(opts.view === 'back' ? 180 : 0);
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
