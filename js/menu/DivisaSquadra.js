import { db, ref, update } from '../firebase-config.js';
import { uploadPngToImgBB } from '../services/integrationImgBB.js';
import { createKitViewer, renderKitImage, kitImageHTML, dataUrlToBlob } from '../components/Kit3D.js';
import { getCutout } from '../services/imageCutout.js';
import { getPngPatterns, getPngBrands, getPngPatches, onKitAssetsChange } from '../services/kitAssets.js';
import { esc } from './menuUtils.js';
import {
  normalizeKit, defaultKit, patternLabel,
  PRESETS, PATTERNS, BRANDS, SPONSOR_FONTS, PATCH_POSITIONS, ZONES, COLLARS, COLLAR_SHAPES, CUFFS, SLEEVE_DECO
} from '../components/KitRenderer.js';

/**
 * Editor della divisa della squadra (menu laterale → Divisa squadra).
 * La maglia è un modello 3D (components/Kit3D.js) vestito con la texture dipinta da components/KitRenderer.js;
 * disegni e marchi in PNG si aggiungono dall'area Patron (sezione Divise).
 * Al salvataggio si genera anche una foto PNG (kit.image) usata nel resto dell'app.
 */
const MAX_LAYERS = 6;
// come si stende un disegno sui pezzi della maglia
const LAYER_WRAPS = [
  { id: 'whole',  label: 'Default', desc: 'Davanti e dietro come un unico pezzo: il disegno continua dal davanti al dietro.' },
  { id: 'repeat', label: 'Ripetuto', desc: 'Lo stesso disegno uguale su davanti, dietro e maniche.' },
  { id: 'mirror', label: 'Specchiato', desc: 'Dietro e manica destra sono lo specchio di davanti e manica sinistra.' }
];
const MAX_PATCHES = 4;
const MAX_FILE_MB = 8;
const FEDERAZIONE_LOGO = 'icons/logo-federazione.jpg';

const SWATCHES = ['#ffffff', '#000000', '#c62828', '#7a1f1f', '#e65100', '#ffd400', '#f5a623', '#2e7d32',
  '#0b5d3b', '#00bcd4', '#1e88e5', '#1e5bb8', '#0d1b4c', '#6a1b9a', '#ec407a', '#9e9e9e'];

const COLOR_FIELDS = [
  { key: 'base',    label: 'Busto' },
  { key: 'sleeves', label: 'Maniche' },
  { key: 'collar',  label: 'Colletto' },
  { key: 'cuffs',   label: 'Polsini' },
  { key: 'trim',    label: 'Finiture (righe colletto, maniche)' }
];

const STYLE_ID = 'kit-editor-style';
function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .kit-stage { position: sticky; top: -1rem; z-index: 5; margin: -1rem -1rem 1rem; padding: 1rem 1rem .6rem;
      background-color: var(--bg); background-image: linear-gradient(var(--menu-bg, var(--bg)), var(--menu-bg, var(--bg))); border-bottom: 1px solid var(--border); }
    .kit-preview { position: relative; height: 34vh; max-height: 320px; min-height: 200px; }
    .kit-preview > #kit-3d { position: absolute; inset: 0; }
    .kit-view-btns { position: absolute; right: 0; bottom: 0; display: flex; gap: .3rem; z-index: 2; }
    .kit-view-btns button { background: color-mix(in srgb, var(--bg2) 85%, transparent); color: var(--text2); border: 1px solid var(--border);
      border-radius: 999px; padding: .2rem .6rem; font-family: inherit; font-size: .7rem; font-weight: 600; cursor: pointer; }
    .kit-hint { position: absolute; left: 0; bottom: 0; font-size: .65rem; color: var(--text3); font-family: var(--font-text3, inherit); z-index: 2; }
    .kit-loading { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--text3); font-family: var(--font-text3, inherit); font-size: .8rem; }
    .kit-actions { display: flex; gap: .5rem; justify-content: center; margin-top: .5rem; flex-wrap: wrap; }
    .kit-dirty { font-size: .7rem; color: var(--gold); text-align: center; margin-top: .3rem; min-height: 1em; }

    .kit-acc { background: var(--card); border: 1px solid var(--border); border-radius: 14px; margin-bottom: .6rem; overflow: hidden; }
    .kit-acc-head { width: 100%; display: flex; align-items: center; gap: .5rem; padding: .85rem 1rem; background: none; border: none;
      color: var(--title, var(--accent)); font-family: var(--font-title, inherit); font-size: .8rem; font-weight: 700; text-align: left; cursor: pointer; }
    .kit-acc-head span { flex: 1; }
    .kit-acc-head i { font-size: 1.2rem; transition: transform .2s; }
    .kit-acc.open .kit-acc-head i { transform: rotate(180deg); }
    .kit-acc-body { display: none; padding: 0 1rem 1rem; }
    .kit-acc.open .kit-acc-body { display: block; }

    .kit-sub { font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; color: var(--label, var(--text2)); font-family: var(--font-label, inherit); margin: .9rem 0 .5rem; }
    .kit-sub:first-child { margin-top: 0; }
    .kit-pick-btn { width: 100%; display: flex; align-items: center; gap: .6rem; background: var(--bg3); border: 1px solid var(--border); border-radius: 12px;
      padding: .45rem .6rem; color: var(--text); cursor: pointer; text-align: left; font-size: .85rem; font-weight: 600; }
    .kit-pick-btn .pv { width: 46px; height: 48px; border-radius: 8px; overflow: hidden; background: #2b323c; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
    .kit-pick-btn .pv img { width: 100%; height: 100%; object-fit: cover; }
    .kit-pick-btn .go { margin-left: auto; color: var(--accent); font-size: .8rem; display: flex; align-items: center; gap: .2rem; flex-shrink: 0; }
    .kit-modal { position: fixed; inset: 0; z-index: 3000; background: rgba(0,0,0,.6); display: flex; align-items: flex-end; justify-content: center; }
    .kit-modal-box { width: 100%; max-width: 560px; max-height: 78vh; display: flex; flex-direction: column; background: var(--card); border: 1px solid var(--border);
      border-radius: 18px 18px 0 0; padding: .8rem .9rem calc(.9rem + env(safe-area-inset-bottom, 0px)); }
    .kit-modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: .6rem; font-weight: 700; color: var(--text); }
    .kit-modal-body { overflow-y: auto; -webkit-overflow-scrolling: touch; }
    .kit-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); gap: .45rem; }
    .kit-grid.wide { grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); }
    .kit-opt { position: relative; background: var(--bg3); border: 2px solid transparent; border-radius: 10px; padding: .25rem .2rem .3rem;
      cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: .15rem; color: var(--text2); font-family: inherit; }
    .kit-opt > div { width: 100%; pointer-events: none; }
    .kit-opt .lb { font-size: .6rem; line-height: 1.15; text-align: center; pointer-events: none; }
    .kit-opt.on { border-color: var(--accent); color: var(--accent); }
    .kit-opt.on::after { content: '\\2713'; position: absolute; top: -6px; right: -6px; width: 18px; height: 18px; border-radius: 50%;
      background: var(--accent); color: var(--bg); font-size: .7rem; font-weight: 700; display: flex; align-items: center; justify-content: center; }
    .kit-brand { height: 44px; width: 100%; border-radius: 6px; display: flex; align-items: center; justify-content: center; pointer-events: none; }
    .kit-brand img { max-width: 56px; max-height: 36px; object-fit: contain; }

    .kit-color-row { display: flex; align-items: center; gap: .6rem; padding: .45rem 0; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
    .kit-color-row:last-child { border-bottom: none; }
    .kit-color-row .nm { flex: 1; min-width: 110px; font-size: .82rem; font-weight: 600; color: var(--text); }
    .kit-color { width: 40px; height: 32px; border: 1px solid var(--border); border-radius: 8px; padding: 0; background: none; cursor: pointer; flex-shrink: 0; }
    .kit-color::-webkit-color-swatch-wrapper { padding: 2px; } .kit-color::-webkit-color-swatch { border: none; border-radius: 6px; }
    .kit-swatches { display: flex; flex-wrap: wrap; gap: .3rem; width: 100%; }
    .kit-sw { width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--border); cursor: pointer; padding: 0; }
    .kit-sw.on { outline: 2px solid var(--accent); outline-offset: 1px; }

    .kit-chips { display: flex; flex-wrap: wrap; gap: .35rem; }
    .kit-field { display: flex; align-items: center; gap: .6rem; margin: .5rem 0; font-size: .78rem; color: var(--text2); font-family: var(--font-sub, inherit); }
    .kit-field > span { min-width: 92px; }
    .kit-field input[type="range"] { flex: 1; accent-color: var(--accent); }
    .kit-field input[type="text"], .kit-field select { flex: 1; min-width: 0; background: var(--bg2); border: 1px solid var(--border); border-radius: 8px;
      color: var(--text); padding: .45rem .6rem; font-family: inherit; font-size: .82rem; user-select: text; -webkit-user-select: text; }
    .kit-field .val { width: 38px; text-align: right; color: var(--text); font-variant-numeric: tabular-nums; }

    .kit-layer { display: flex; align-items: center; gap: .5rem; background: var(--bg3); border: 2px solid transparent; border-radius: 10px; padding: .35rem .5rem; margin-bottom: .4rem; cursor: pointer; }
    .kit-layer.on { border-color: var(--accent); }
    .kit-layer .th { width: 40px; flex-shrink: 0; pointer-events: none; }
    .kit-layer .th > div { width: 100%; }
    .kit-layer .nm { flex: 1; min-width: 0; font-size: .8rem; font-weight: 600; color: var(--text); pointer-events: none; }
    .kit-layer .nm small { display: block; font-weight: 400; color: var(--text2); font-family: var(--font-sub, inherit); font-size: .68rem; }
    .kit-icon-btn { background: transparent; border: 1px solid var(--border); color: var(--text2); font-family: var(--font-sub, inherit); border-radius: 8px; width: 30px; height: 30px;
      display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; font-size: 1rem; }
    .kit-icon-btn:disabled { opacity: .3; pointer-events: none; }
    .kit-layer-edit { border: 1px dashed var(--border); border-radius: 12px; padding: .7rem; margin: .4rem 0 .8rem; }

    .kit-patch { display: flex; align-items: center; gap: .6rem; padding: .5rem 0; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
    .kit-patch:last-child { border-bottom: none; }
    .kit-patch img { width: 38px; height: 38px; object-fit: contain; flex-shrink: 0; filter: drop-shadow(0 1px 2px rgba(0,0,0,.4)); }
    .kit-patch .nm { flex: 1; min-width: 0; font-size: .8rem; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .kit-patch-pos { order: 5; flex-basis: 100%; background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; color: var(--text);
      padding: .45rem .5rem; font-family: inherit; font-size: .8rem; }
    .kit-comp { display: flex; flex-direction: column; align-items: center; gap: .25rem; }
    .kit-comp img { width: 44px; height: 44px; object-fit: contain; pointer-events: none; filter: drop-shadow(0 1px 2px rgba(0,0,0,.4)); }
    .kit-upload-thumb { width: 90px; height: 50px; object-fit: contain; background: var(--bg3); border-radius: 8px; border: 1px solid var(--border); }
  `;
  document.head.appendChild(style);
}


const clone = (o) => JSON.parse(JSON.stringify(o));
const svgUrl = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
const brandThumbUrl = (b, color, base) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40">${b.draw(color, base)}</svg>`);
const patternThumbUrl = (p) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${400} ${420}" preserveAspectRatio="xMidYMid slice"><rect width="400" height="420" fill="#2b323c"/>${p.draw('#ffffff', 1, 'th' + p.id)}</svg>`);

/** Patch disponibili: loghi delle competizioni + logo della Federazione. */
/** Patch disponibili: quella del Fantacazz e quelle caricate dal Patron (Patron → Divise → Patch). */
function availablePatches(STATE) {
  const comps = Array.isArray(STATE.competitions) ? STATE.competitions : Object.values(STATE.competitions || {});
  const list = comps.filter(c => c && c.logo && /fantacazz/i.test(c.name || '')).map(c => ({ id: String(c.id), name: c.name, src: c.logo }));
  if (!list.length) list.push({ id: 'federazione', name: 'Fantacazz', src: FEDERAZIONE_LOGO });
  getPngPatches().forEach(p => list.push({ id: 'png:' + p.id, name: p.name || 'Patch', src: p.url }));
  return list;
}

export const DivisaSquadra = {
  title: 'Divisa squadra',
  _open: 'model',
  _layer: 0,
  _busy: false,

  mount(body, STATE) {
    injectStyle();
    const team = STATE.user;
    const root = document.createElement('div');
    body.appendChild(root);
    this._root = root;
    if (!team) {
      root.innerHTML = `<div class="lv-empty">Accedi con la tua squadra per personalizzare la divisa.</div>`;
      return;
    }
    this._teamId = team.id;
    this._kit = normalizeKit(team.kit || defaultKit());
    this._saved = JSON.stringify(this._kit);
    this._layer = 0;
    this._open = 'model';
    this._renderAll();

    root.addEventListener('click', (e) => this._onClick(e));
    root.addEventListener('input', (e) => this._onInput(e));
    root.addEventListener('change', (e) => this._onChange(e));
    // il Patron può aggiungere modelli, disegni e marchi mentre l'editor è aperto
    this._unwatch = onKitAssetsChange(() => { if (this._root) { this._renderPreview(); this._renderSection(); } });
  },

  refresh() {
    // lo stemma può cambiare (Configurazione squadra): aggiorno solo l'anteprima, senza toccare le modifiche
    if (this._root && this._kit) this._renderPreview();
  },

  unmount() {
    if (this._unwatch) this._unwatch();
    this._unwatch = null;
    if (this._viewer) this._viewer.dispose();
    this._viewer = null;
    this._root = null;
    this._kit = null;
  },

  /* -------------------------------------------------------------- render */
  _crest() { return (window.STATE.user && window.STATE.user.logo) || ''; },
  _dirty() { return JSON.stringify(this._kit) !== this._saved; },

  /** Miniatura: maglia disegnata su canvas a bassa risoluzione. */
  _thumb(kit, plain = true) { return kitImageHTML(kit, { crestUrl: this._crest(), width: 180, textureSize: 512, plain, live: true }); },

  _renderAll() {
    const sections = [
      ['model',   'FASE 1: Colletto e maniche'],
      ['styles',  'FASE 2: Stili rapidi'],
      ['design',  'FASE 3: Disegno (livelli)'],
      ['colors',  'FASE 4: Seleziona i colori'],
      ['sponsor', 'FASE 5: Scelta dello SPONSOR'],
      ['brand',   'FASE 6: Stemma e marchio tecnico'],
      ['patches', 'FASE 7: Scelta delle PATCH']
    ];
    this._root.innerHTML = `
      <div class="kit-stage">
        <div class="kit-preview">
          <div class="kit-loading" id="kit-loading">Caricamento maglia 3D…</div>
          <div id="kit-3d"></div>
          <div class="kit-hint"><i class="ri-drag-move-line"></i> Trascina per ruotare</div>
          <div class="kit-view-btns"><button data-act="view" data-v="front">Davanti</button><button data-act="view" data-v="back">Retro</button></div>
        </div>
        <div class="kit-dirty" id="kit-dirty"></div>
        <div class="kit-actions">
          <button class="mp-btn ghost" data-act="undo"><i class="ri-arrow-go-back-line"></i> Annulla modifiche</button>
          <button class="mp-btn" data-act="save"><i class="ri-save-3-line"></i> Salva divisa</button>
        </div>
      </div>
      ${sections.map(([key, label]) => `
        <div class="kit-acc ${this._open === key ? 'open' : ''}" data-sec="${key}">
          <button class="kit-acc-head" data-act="toggle" data-sec="${key}"><span>${label}</span><i class="ri-arrow-down-s-line"></i></button>
          <div class="kit-acc-body" id="kit-sec-${key}"></div>
        </div>`).join('')}
      <div class="mp-muted" style="text-align:center; margin-top:.4rem;">La divisa è visibile a tutti nella scheda del tuo club.</div>
      <div class="kit-actions" style="margin-top:1rem;">
        <button class="mp-btn danger" data-act="reset"><i class="ri-delete-bin-line"></i> Elimina divisa e ricomincia da zero</button>
      </div>
    `;
    this._renderPreview();
    this._renderSection();
  },

  _renderPreview() {
    if (!this._root) return;
    const box = this._root.querySelector('#kit-3d');
    if (box && !this._viewer) {
      this._viewer = createKitViewer(box);
      this._viewer.ready.then(() => { const l = this._root && this._root.querySelector('#kit-loading'); if (l) l.remove(); })
        .catch(e => { console.error(e); const l = this._root && this._root.querySelector('#kit-loading'); if (l) l.textContent = 'Il 3D non è supportato su questo dispositivo'; });
    }
    if (this._viewer) this._viewer.update(this._kit, { crestUrl: this._crest() }).catch(e => console.error('Divisa:', e));
    const dirty = this._root.querySelector('#kit-dirty');
    if (dirty) dirty.textContent = this._dirty() ? 'Modifiche non salvate' : '';
  },

  /** Durante trascinamenti (cursori, selettore colore) ridisegno al massimo una volta per frame. */
  _schedulePreview() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => { this._raf = 0; this._renderPreview(); });
  },

  /** Ridisegna il contenuto della sezione aperta (le altre restano vuote finché non si aprono). */
  _renderSection() {
    if (!this._root) return;
    this._root.querySelectorAll('.kit-acc-body').forEach(b => { b.innerHTML = ''; });
    const key = this._open;
    const box = key && this._root.querySelector(`#kit-sec-${key}`);
    if (!box) return;
    const fn = {
      model: this._secModel, styles: this._secStyles, design: this._secDesign, colors: this._secColors,
      sponsor: this._secSponsor, brand: this._secBrand, patches: this._secPatches
    }[key];
    box.innerHTML = fn.call(this);
    box.querySelectorAll('img[data-cut]').forEach(img => getCutout(img.dataset.cut).then(u => { if (u) img.src = u; }));
  },

  /** Porta la sezione appena aperta subito sotto l'anteprima (che resta fissa in alto). */
  _scrollToOpen() {
    const acc = this._open && this._root.querySelector(`.kit-acc[data-sec="${this._open}"]`);
    const scroller = this._root.closest('.mp-body');
    const stage = this._root.querySelector('.kit-stage');
    if (!acc || !scroller || !stage) return;
    const top = acc.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    scroller.scrollTo({ top: Math.max(0, top - stage.offsetHeight - 8), behavior: 'smooth' });
  },

  _update(mutator, { section = true } = {}) {
    mutator(this._kit);
    this._renderPreview();
    if (section) this._renderSection();
  },

  _opt(act, value, inner, label, on) {
    return `<button class="kit-opt ${on ? 'on' : ''}" data-act="${act}" data-v="${esc(value)}" title="${esc(label)}">${inner}<span class="lb">${esc(label)}</span></button>`;
  },

  _colorPicker(path, value) {
    return `
      <input type="color" class="kit-color" data-color="${path}" value="${esc(value)}">
      <div class="kit-swatches">${SWATCHES.map(c => `<button class="kit-sw ${String(value).toLowerCase() === c ? 'on' : ''}" style="background:${c}" data-act="swatch" data-path="${path}" data-v="${c}" aria-label="${c}"></button>`).join('')}</div>`;
  },

  _range(path, label, value, min, max, unit = '') {
    return `<label class="kit-field"><span>${label}</span><input type="range" min="${min}" max="${max}" value="${value}" data-range="${path}" data-unit="${unit}"><span class="val">${value}${unit}</span></label>`;
  },

  /** Pulsante che apre la finestra di scelta (anteprima, nome, "Cambia"). */
  _pickBtn(kind, src, label, action) {
    return `<button class="kit-pick-btn" data-act="open-picker" data-v="${kind}"><span class="pv"><img src="${esc(src)}" alt=""></span><span>${esc(label)}</span><span class="go">${esc(action)} <i class="ri-arrow-right-s-line"></i></span></button>`;
  },

  /** Finestra (dal basso) con le scelte: si chiude toccando fuori, la X o scegliendo un elemento. */
  _modal(title, body) {
    return `<div class="kit-modal" data-act="close-picker" data-self="1"><div class="kit-modal-box">
      <div class="kit-modal-head"><span>${esc(title)}</span><button class="kit-icon-btn" data-act="close-picker" title="Chiudi"><i class="ri-close-line"></i></button></div>
      <div class="kit-modal-body">${body}</div></div></div>`;
  },

  _chip(act, value, label, on) {
    return `<button class="lv-chip ${on ? 'on' : ''}" data-act="${act}" data-v="${esc(value)}">${esc(label)}</button>`;
  },

  /* ------------------------------------------------------------ sezioni */
  _secModel() {
    const k = this._kit;
    const base = { ...k, sponsor: { mode: 'none' }, patches: [], crest: { show: false } };
    return `
      <div class="kit-sub">Forma del colletto</div>
      <div class="kit-grid wide">${COLLAR_SHAPES.map(c => this._opt('collarShape', c.id, this._thumb({ ...base, collarShape: c.id }), c.label, k.collarShape === c.id)).join('')}</div>
      ${k.collarShape === 'polo' ? '' : `
      <div class="kit-sub">Rifinitura del colletto</div>
      <div class="kit-grid">${COLLARS.map(c => this._opt('collar', c.id, this._thumb({ ...base, collar: c.id }), c.label, k.collar === c.id)).join('')}</div>`}
      <div class="kit-sub">Polsini</div>
      <div class="kit-grid">${CUFFS.map(c => this._opt('cuffs', c.id, this._thumb({ ...base, cuffs: c.id }), c.label, k.cuffs === c.id)).join('')}</div>
      <div class="kit-sub">Decorazioni maniche</div>
      <div class="kit-grid">${SLEEVE_DECO.map(d => this._opt('sleeveDeco', d.id, this._thumb({ ...base, sleeveDeco: d.id }), d.label, k.sleeveDeco === d.id)).join('')}</div>
      ${k.sleeveDeco !== 'none' ? `
      ${this._range('sleeveTf.scale', 'Dimensione', k.sleeveTf.scale, 40, 200, '%')}
      ${this._range('sleeveTf.x', 'Sposta ↔', k.sleeveTf.x, -50, 50)}
      ${this._range('sleeveTf.y', 'Sposta ↕', k.sleeveTf.y, -50, 50)}
      ${this._range('sleeveTf.rot', 'Rotazione', k.sleeveTf.rot, -180, 180, '°')}
      <div class="kit-chips" style="margin-top:.4rem;">${this._chip('sleeve-reset', '1', 'Ripristina posizione', false)}</div>` : ''}
      <div class="mp-muted" style="margin-top:.6rem;">Colori di colletto, polsini e finiture nella FASE 4. Ruota la maglia per vedere maniche e retro.</div>`;
  },

  _secStyles() {
    const k = this._kit;
    return `
      <div class="mp-muted" style="margin-bottom:.6rem;">Parti da un disegno già pronto: poi puoi modificarlo nella FASE 3. Cambia solo il disegno.</div>
      <div class="kit-grid">
        ${PRESETS.map((p, i) => this._opt('preset', i, this._thumb({ ...k, sleeveDeco: p.kit.sleeveDeco || k.sleeveDeco, layers: normalizeKit({ layers: p.kit.layers }).layers }), p.name, false)).join('')}
      </div>`;
  },

  _secDesign() {
    const k = this._kit;
    const sel = Math.min(this._layer, k.layers.length - 1);
    const zoneLabel = (z) => (ZONES.find(x => x.id === z) || {}).label || '';
    const layers = k.layers.map((l, i) => `
      <div class="kit-layer ${i === sel ? 'on' : ''}" data-act="pick-layer" data-i="${i}">
        <div class="th">${this._thumb({ ...k, layers: [l] })}</div>
        <div class="nm">Livello ${i + 1}<small>${esc(patternLabel(l.type))} · ${esc(zoneLabel(l.zone))}</small></div>
        <button class="kit-icon-btn" data-act="layer-up" data-i="${i}" ${i === 0 ? 'disabled' : ''} title="Porta sotto"><i class="ri-arrow-up-line"></i></button>
        <button class="kit-icon-btn" data-act="layer-down" data-i="${i}" ${i === k.layers.length - 1 ? 'disabled' : ''} title="Porta sopra"><i class="ri-arrow-down-line"></i></button>
        <button class="kit-icon-btn" data-act="layer-del" data-i="${i}" title="Elimina"><i class="ri-delete-bin-line"></i></button>
      </div>`).join('');

    let editor = '';
    if (sel >= 0) {
      const l = k.layers[sel];
      const p = `layers.${sel}`;
      const png = getPngPatterns();
      const cell = (type, src, label) => this._opt('layer-type', type, `<div class="kit-brand" style="height:auto; aspect-ratio:400/420; background:#2b323c;"><img src="${esc(src)}" alt="" style="width:100%; height:100%; max-width:none; max-height:none; object-fit:cover;"></div>`, label, l.type === type);
      editor = `
        <div class="kit-layer-edit">
          <div class="kit-sub">Disegno del livello ${sel + 1}</div>
          ${this._pickBtn('layer', (png.find(pp => 'png:' + pp.id === l.type) || {}).url || patternThumbUrl(PATTERNS.find(pt => pt.id === l.type) || PATTERNS[0]), patternLabel(l.type), 'Cambia')}
          ${this._picker === 'layer' ? this._modal(`Disegno del livello ${sel + 1}`, `<div class="kit-grid">
            ${png.map(pp => cell('png:' + pp.id, pp.url, pp.name)).join('')}
            ${PATTERNS.map(pt => cell(pt.id, patternThumbUrl(pt), pt.label)).join('')}
          </div>`) : ''}
          <div class="kit-sub">Dove applicarlo</div>
          <div class="kit-chips">${ZONES.map(z => this._chip('layer-zone', z.id, z.label, l.zone === z.id)).join('')}</div>
          <div class="kit-sub">Avanzate</div>
          <div class="kit-chips">${LAYER_WRAPS.map(w => this._chip('layer-wrap', w.id, w.label, (l.wrap || 'repeat') === w.id)).join('')}</div>
          <div class="mp-muted" style="margin-top:.3rem;">${esc((LAYER_WRAPS.find(w => w.id === (l.wrap || 'repeat')) || {}).desc || '')}</div>
          <div class="kit-sub">Colore del livello</div>
          <div class="kit-color-row">${this._colorPicker(`${p}.color`, l.color)}</div>
          ${this._range(`${p}.opacity`, 'Opacità', l.opacity, 5, 100, '%')}
          ${this._range(`${p}.scale`, 'Dimensione', l.scale, 30, 250, '%')}
          ${this._range(`${p}.x`, 'Sposta ↔', l.x || 0, -50, 50)}
          ${this._range(`${p}.y`, 'Sposta ↕', l.y || 0, -50, 50)}
          ${this._range(`${p}.rot`, 'Rotazione', l.rot || 0, -180, 180, '°')}
          <div class="kit-chips" style="margin-top:.4rem;">
            ${this._chip('layer-flag', 'flipX', 'Specchia ↔', l.flipX)}
            ${this._chip('layer-flag', 'flipY', 'Capovolgi ↕', l.flipY)}
            ${this._chip('layer-reset', '1', 'Ripristina posizione', false)}
          </div>
        </div>`;
    }

    return `
      <div class="mp-muted" style="margin-bottom:.6rem;">Sovrapponi fino a ${MAX_LAYERS} livelli: ognuno ha il suo disegno, colore, opacità, dimensione, posizione e rotazione. Il primo livello è quello più in basso.</div>
      ${layers || '<div class="mp-muted" style="text-align:center; padding:.6rem 0;">Nessun livello: maglia in tinta unita.</div>'}
      ${editor}
      <button class="mp-btn" data-act="layer-add" ${k.layers.length >= MAX_LAYERS ? 'disabled' : ''} style="width:100%;"><i class="ri-add-line"></i> Aggiungi livello</button>`;
  },

  _secColors() {
    const k = this._kit;
    return `
      ${COLOR_FIELDS.map(f => `
        <div class="kit-color-row">
          <div class="nm">${f.label}</div>
          ${this._colorPicker(`colors.${f.key}`, k.colors[f.key])}
        </div>`).join('')}
      <div class="kit-actions" style="justify-content:flex-start; margin-top:.7rem;">
        <button class="mp-btn ghost" data-act="sleeves-as-base"><i class="ri-shirt-line"></i> Maniche come la maglia</button>
        <button class="mp-btn ghost" data-act="swap-colors"><i class="ri-swap-line"></i> Inverti colori</button>
      </div>`;
  },

  _uploadBtn(kind, has, label) {
    return `<label class="mp-btn"><i class="ri-upload-2-line"></i> ${has ? 'Cambia' : 'Carica'} ${label}
      <input type="file" accept="image/png" data-upload="${kind}" style="display:none;"></label>`;
  },

  _secSponsor() {
    const sp = this._kit.sponsor;
    let body = '';
    if (sp.mode === 'image') {
      body = `
        <div class="kit-field" style="flex-wrap:wrap;">
          ${sp.url ? `<img class="kit-upload-thumb" src="${esc(sp.url)}" alt="Sponsor">` : ''}
          ${this._uploadBtn('sponsor', !!sp.url, 'immagine')}
        </div>
        <div class="mp-muted">Solo immagini <b>PNG</b>, meglio se con sfondo trasparente.</div>
        <div class="kit-chips" style="margin:.6rem 0;">
          ${this._chip('sponsor-mono', '0', 'Colori originali', !sp.mono)}
          ${this._chip('sponsor-mono', '1', 'Tinta unica', sp.mono)}
        </div>
        ${sp.mono ? `<div class="kit-color-row">${this._colorPicker('sponsor.color', sp.color)}</div>` : ''}`;
    } else if (sp.mode === 'text') {
      body = `
        <label class="kit-field"><span>Testo</span><input type="text" maxlength="24" value="${esc(sp.text)}" data-text="sponsor.text" placeholder="Nome dello sponsor"></label>
        <div class="kit-sub">Carattere</div>
        <div class="kit-chips">${SPONSOR_FONTS.map(f => this._chip('sponsor-font', f.id, f.label, sp.font === f.id)).join('')}</div>
        <div class="kit-sub">Colore</div>
        <div class="kit-color-row">${this._colorPicker('sponsor.color', sp.color)}</div>`;
    }
    return `
      <div class="kit-chips" style="margin-bottom:.6rem;">
        ${this._chip('sponsor-mode', 'none', 'Nessuno', sp.mode === 'none')}
        ${this._chip('sponsor-mode', 'image', 'Immagine PNG', sp.mode === 'image')}
        ${this._chip('sponsor-mode', 'text', 'Scritta', sp.mode === 'text')}
      </div>
      ${body}
      ${sp.mode !== 'none' ? this._range('sponsor.scale', 'Dimensione', sp.scale, 40, 160, '%') + this._range('sponsor.y', 'Posizione', sp.y, -60, 80) : ''}`;
  },

  _secBrand() {
    const k = this._kit;
    const crest = this._crest();
    const isPng = k.brand.id === 'custom' || String(k.brand.id).startsWith('png:');
    const cell = (id, inner, label) => `<button class="kit-opt ${k.brand.id === id ? 'on' : ''}" data-act="brand" data-v="${esc(id)}" title="${esc(label)}">
        <div class="kit-brand" style="background:${esc(k.colors.base)};">${inner}</div><span class="lb">${esc(label)}</span></button>`;
    const cells = [
      cell('none', '<i class="ri-forbid-line" style="font-size:1.3rem; color:var(--text2);font-family:var(--font-sub,inherit);"></i>', 'Nessuno'),
      ...getPngBrands().map(b => cell('png:' + b.id, `<img src="${esc(b.url)}" alt="">`, b.name)),
      ...BRANDS.filter(b => b.id !== 'none' && b.id !== 'custom').map(b => cell(b.id, `<img src="${brandThumbUrl(b, k.brand.color, k.colors.base)}" alt="">`, b.label)),
      cell('custom', k.brand.url ? `<img src="${esc(k.brand.url)}" alt="">` : '<i class="ri-upload-2-line" style="font-size:1.3rem; color:var(--text2);font-family:var(--font-sub,inherit);"></i>', 'Il tuo PNG')
    ];
    return `
      <div class="kit-sub">Stemma della squadra (in alto a sinistra)</div>
      ${crest ? `
        <div class="kit-chips">
          ${this._chip('crest-show', '1', 'Mostra stemma', k.crest.show)}
          ${this._chip('crest-show', '0', 'Nascondi', !k.crest.show)}
        </div>
        ${k.crest.show ? this._range('crest.size', 'Dimensione', k.crest.size, 60, 150, '%') : ''}
        <div class="mp-muted">Lo stemma viene scontornato automaticamente.</div>`
        : `<div class="mp-muted">Non hai ancora un logo: caricalo da <b>Configurazione squadra</b> e comparirà sulla maglia.</div>`}
      <div class="kit-sub">Marchio tecnico (in alto a destra)</div>
      <div class="kit-grid wide">${cells.join('')}</div>
      ${k.brand.id === 'custom' ? `
        <div class="kit-field">${this._uploadBtn('brand', !!k.brand.url, 'marchio')}</div>
        <div class="mp-muted">Solo immagini <b>PNG</b> con sfondo trasparente.</div>` : ''}
      ${isPng ? `<div class="kit-chips" style="margin:.6rem 0;">
          ${this._chip('brand-mono', '0', 'Colori originali', !k.brand.mono)}
          ${this._chip('brand-mono', '1', 'Tinta unica', k.brand.mono)}
        </div>` : ''}
      ${k.brand.id !== 'none' && (!isPng || k.brand.mono) ? `<div class="kit-sub">Colore del marchio</div><div class="kit-color-row">${this._colorPicker('brand.color', k.brand.color)}</div>` : ''}`;
  },

  _secPatches() {
    const k = this._kit;
    const avail = availablePatches(window.STATE);
    const current = k.patches.map((p, i) => `
      <div class="kit-patch">
        <img data-cut="${esc(p.src)}" alt="">
        <div class="nm">${esc(p.name || 'Patch')}</div>
        <select class="kit-patch-pos" data-patch-pos="${i}">
          ${PATCH_POSITIONS.map(pp => `<option value="${pp.id}" ${p.pos === pp.id ? 'selected' : ''}>${pp.label}</option>`).join('')}
        </select>
        <button class="kit-icon-btn" data-act="patch-del" data-i="${i}" title="Rimuovi"><i class="ri-delete-bin-line"></i></button>
      </div>`).join('');
    const full = k.patches.length >= MAX_PATCHES;
    return `
      <div class="kit-sub">Patch sulla maglia (${k.patches.length}/${MAX_PATCHES})</div>
      ${current || '<div class="mp-muted">Nessuna patch: scegline una qui sotto.</div>'}
      ${full ? `<div class="mp-muted" style="margin-top:.6rem;">Hai raggiunto il massimo di ${MAX_PATCHES} patch.</div>` : `
      <button class="mp-btn" data-act="open-picker" data-v="patch" style="width:100%; margin-top:.6rem;"><i class="ri-add-line"></i> Aggiungi una patch</button>`}
      ${this._picker === 'patch' && !full ? this._modal('Aggiungi una patch', `<div class="kit-grid wide">
        ${avail.map(a => `<button class="kit-opt kit-comp" data-act="patch-add" data-v="${esc(a.id)}" title="${esc(a.name)}">
          <img data-cut="${esc(a.src)}" alt=""><span class="lb">${esc(a.name)}</span></button>`).join('')}
      </div>`) : ''}
      <div class="mp-muted" style="margin-top:.6rem;">Le patch vengono scontornate automaticamente; il Patron può aggiungerne di nuove. Per ogni patch scegli la posizione: centro petto, sotto lo sponsor, sulle maniche o in fondo alla maglia.</div>`;
  },

  /* ------------------------------------------------------------- eventi */
  _set(path, value) {
    const parts = path.split('.');
    let o = this._kit;
    parts.slice(0, -1).forEach(p => { o = o[p]; });
    o[parts[parts.length - 1]] = value;
  },

  _onClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn || !this._root || !this._root.contains(btn) || btn.disabled) return;
    const act = btn.dataset.act;
    const v = btn.dataset.v;
    const i = Number(btn.dataset.i);
    const k = this._kit;

    switch (act) {
      case 'toggle':
        this._picker = null;
        this._open = this._open === btn.dataset.sec ? null : btn.dataset.sec;
        this._root.querySelectorAll('.kit-acc').forEach(a => a.classList.toggle('open', a.dataset.sec === this._open));
        this._renderSection();
        this._scrollToOpen();
        return;
      case 'save': this._save(); return;
      case 'reset': this._reset(); return;
      case 'undo':
        if (!this._dirty()) return;
        this._kit = normalizeKit(JSON.parse(this._saved));
        this._layer = 0;
        this._renderPreview(); this._renderSection();
        return;
      case 'view':
        if (this._viewer) this._viewer.setView(v);
        return;
      case 'layer-reset':
        this._update(kit => { const l = kit.layers[Math.min(this._layer, kit.layers.length - 1)]; if (l) Object.assign(l, { x: 0, y: 0, rot: 0, scale: 100 }); });
        return;
      case 'sleeve-reset':
        this._update(kit => { kit.sleeveTf = { x: 0, y: 0, scale: 100, rot: 0 }; });
        return;
      case 'collarShape': case 'collar': case 'cuffs': case 'sleeveDeco':
        this._update(kit => { kit[act] = v; });
        return;
      case 'preset': {
        const p = PRESETS[Number(v)];
        if (!p) return;
        this._update(kit => {
          kit.layers = normalizeKit({ layers: clone(p.kit.layers) }).layers;
          if (p.kit.sleeveDeco) kit.sleeveDeco = p.kit.sleeveDeco;
        }, { section: false });
        this._layer = 0;
        return;
      }
      case 'swatch':
        this._update(() => this._set(btn.dataset.path, v));
        return;
      case 'sleeves-as-base':
        this._update(kit => { kit.colors.sleeves = kit.colors.base; });
        return;
      case 'swap-colors':
        this._update(kit => {
          const c = kit.colors;
          [c.base, c.collar] = [c.collar, c.base];
          c.sleeves = c.base; c.cuffs = c.collar; c.trim = c.collar;
        });
        return;

      // livelli
      case 'layer-add':
        if (k.layers.length >= MAX_LAYERS) return;
        this._update(kit => {
          kit.layers.push({ type: 'stripes', color: kit.colors.collar || '#ffffff', opacity: 100, scale: 100, flipX: false, flipY: false, x: 0, y: 0, rot: 0, zone: 'body', wrap: 'whole' });
          this._layer = kit.layers.length - 1;
        });
        return;
      case 'pick-layer':
        this._picker = null;
        if (this._layer === i) return;
        this._layer = i; this._renderSection();
        return;
      case 'layer-del':
        e.stopPropagation();
        this._update(kit => { kit.layers.splice(i, 1); this._layer = Math.max(0, Math.min(this._layer, kit.layers.length - 1)); });
        return;
      case 'layer-up': case 'layer-down': {
        e.stopPropagation();
        const j = act === 'layer-up' ? i - 1 : i + 1;
        if (j < 0 || j >= k.layers.length) return;
        this._update(kit => { [kit.layers[i], kit.layers[j]] = [kit.layers[j], kit.layers[i]]; this._layer = j; });
        return;
      }
      case 'open-picker':
        this._picker = v; this._renderSection();
        return;
      case 'close-picker':
        // sul fondo scuro: chiudo solo se il tocco è proprio sul fondo (non dentro la finestra)
        if (btn.dataset.self && e.target !== btn) return;
        this._picker = null; this._renderSection();
        return;
      case 'layer-type':
        this._picker = null;
        this._update(kit => { kit.layers[this._layer].type = v; });
        return;
      case 'layer-zone':
        this._update(kit => { kit.layers[this._layer].zone = v; });
        return;
      case 'layer-wrap':
        this._update(kit => { kit.layers[this._layer].wrap = v; });
        return;
      case 'layer-flag':
        this._update(kit => { const l = kit.layers[this._layer]; l[v] = !l[v]; });
        return;

      // sponsor
      case 'sponsor-mode': this._update(kit => { kit.sponsor.mode = v; }); return;
      case 'sponsor-font': this._update(kit => { kit.sponsor.font = v; }); return;
      case 'sponsor-mono': this._update(kit => { kit.sponsor.mono = v === '1'; }); return;

      // stemma e marchio
      case 'crest-show': this._update(kit => { kit.crest.show = v === '1'; }); return;
      case 'brand': this._update(kit => { kit.brand.id = v; }); return;
      case 'brand-mono': this._update(kit => { kit.brand.mono = v === '1'; }); return;

      // patch
      case 'patch-add': {
        this._picker = null;
        if (k.patches.length >= MAX_PATCHES) return;
        const a = availablePatches(window.STATE).find(x => x.id === v);
        if (!a) return;
        const used = new Set(k.patches.map(p => p.pos));
        const pos = (PATCH_POSITIONS.find(pp => !used.has(pp.id)) || PATCH_POSITIONS[0]).id;
        this._update(kit => { kit.patches.push({ id: a.id, name: a.name, src: a.src, pos }); });
        return;
      }
      case 'patch-del':
        this._update(kit => { kit.patches.splice(i, 1); });
        return;
    }
  },

  /** Durante il trascinamento di slider / color picker aggiorno solo l'anteprima. */
  _onInput(e) {
    const t = e.target;
    if (t.dataset.range) {
      this._set(t.dataset.range, Number(t.value));
      const val = t.parentElement.querySelector('.val');
      if (val) val.textContent = t.value + (t.dataset.unit || '');
      this._schedulePreview();
    } else if (t.dataset.color) {
      this._set(t.dataset.color, t.value);
      this._schedulePreview();
    } else if (t.dataset.text) {
      this._set(t.dataset.text, t.value);
      this._schedulePreview();
    }
  },

  _onChange(e) {
    const t = e.target;
    if (t.dataset.color || t.dataset.range) {
      // a fine scelta ridisegno la sezione (miniature e pallini dei colori)
      this._renderSection();
    } else if (t.dataset.patchPos !== undefined) {
      this._update(kit => { kit.patches[Number(t.dataset.patchPos)].pos = t.value; });
    } else if (t.dataset.upload && t.files && t.files[0]) {
      const file = t.files[0];
      t.value = '';
      this._upload(t.dataset.upload, file);
    }
  },

  async _upload(kind, file) {
    if (file.type !== 'image/png') { window.showToast("Carica un'immagine in formato PNG", 'err'); return; }
    if (file.size > MAX_FILE_MB * 1024 * 1024) { window.showToast(`Immagine troppo pesante (max ${MAX_FILE_MB} MB)`, 'err'); return; }
    if (this._busy) return;
    this._busy = true;
    window.showToast('Caricamento in corso...', 'ok');
    try {
      const url = await uploadPngToImgBB(file);
      if (!this._kit) return;
      this._update(kit => {
        if (kind === 'sponsor') kit.sponsor.url = url;
        else kit.brand.url = url;
      });
      window.showToast('Immagine caricata: ricorda di salvare la divisa', 'ok');
    } catch (err) {
      console.error(err);
      window.showToast('Caricamento non riuscito, riprova', 'err');
    } finally {
      this._busy = false;
    }
  },

  /** Cancella la divisa salvata e riparte dalla maglia di base. */
  async _reset() {
    if (this._busy || !this._kit) return;
    const team = window.STATE.user;
    if (!team || String(team.id) !== String(this._teamId)) return;
    if (!confirm('Eliminare la divisa? Verrà cancellata e ripartirai dalla maglia di base.')) return;
    this._busy = true;
    try {
      if (team.kit) await update(ref(db, `teams/${team.id}`), { kit: null });
      team.kit = null; // aggiornamento immediato; il listener del DB lo riconferma
      this._kit = normalizeKit(defaultKit());
      this._saved = JSON.stringify(this._kit);
      this._layer = 0;
      this._open = 'model';
      this._root.querySelectorAll('.kit-acc').forEach(a => a.classList.toggle('open', a.dataset.sec === this._open));
      this._renderPreview(); this._renderSection();
      window.showToast('Divisa eliminata: puoi ricrearla da zero', 'ok');
    } catch (err) {
      console.error(err);
      window.showToast('Eliminazione non riuscita, riprova', 'err');
    } finally {
      this._busy = false;
    }
  },

  async _save() {
    if (this._busy || !this._kit) return;
    const team = window.STATE.user;
    if (!team || String(team.id) !== String(this._teamId)) return;
    this._busy = true;
    const btn = this._root.querySelector('[data-act="save"]');
    if (btn) btn.classList.add('busy');
    window.showToast('Salvataggio in corso...', 'ok');
    const kit = clone(this._kit);
    delete kit.image;
    try {
      // foto della maglia per il resto dell'app (scheda club, configurazione squadra)
      try {
        const dataUrl = await renderKitImage(kit, { crestUrl: this._crest(), width: 600 });
        if (dataUrl) {
          const blob = await dataUrlToBlob(dataUrl);
          kit.image = await uploadPngToImgBB(new File([blob], `divisa-${team.id}.png`, { type: 'image/png' }), 600);
        }
      } catch (e) { console.warn('Foto della divisa non caricata', e); }
      await update(ref(db, `teams/${team.id}`), { kit });
      team.kit = kit; // aggiornamento immediato; il listener del DB lo riconferma
      if (kit.image) this._kit.image = kit.image;
      this._saved = JSON.stringify(this._kit);
      this._renderPreview();
      window.showToast('Divisa salvata!', 'ok');
    } catch (err) {
      console.error(err);
      window.showToast('Salvataggio non riuscito, riprova', 'err');
    } finally {
      this._busy = false;
      if (btn) btn.classList.remove('busy');
    }
  }
};
