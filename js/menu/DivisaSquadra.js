import { db, ref, update } from '../firebase-config.js';
import { uploadPngToImgBB } from '../services/integrationImgBB.js';
import { getCutout, whenCutoutsReady } from '../services/imageCutout.js';
import { esc } from './menuUtils.js';
import {
  renderKitSvg, normalizeKit, defaultKit,
  PRESETS, PATTERNS, COLLARS, SLEEVES, CUFFS, SLEEVE_DECO, BRANDS, SPONSOR_FONTS, PATCH_POSITIONS
} from '../components/KitRenderer.js';

/**
 * Editor della divisa della squadra (menu laterale → Divisa squadra).
 * La divisa è salvata in teams/{id}/kit (vedi components/KitRenderer.js per lo schema).
 */
const MAX_LAYERS = 6;
const MAX_PATCHES = 4;
const MAX_FILE_MB = 8;
const FEDERAZIONE_LOGO = 'icons/logo-federazione.jpg';

const SWATCHES = ['#ffffff', '#000000', '#c62828', '#7a1f1f', '#e65100', '#ffd400', '#f5a623', '#2e7d32',
  '#0b5d3b', '#00bcd4', '#1e88e5', '#1e5bb8', '#0d1b4c', '#6a1b9a', '#ec407a', '#9e9e9e'];

const COLOR_FIELDS = [
  { key: 'base',    label: 'Colore principale' },
  { key: 'sleeves', label: 'Maniche' },
  { key: 'collar',  label: 'Colletto' },
  { key: 'cuffs',   label: 'Polsini' },
  { key: 'trim',    label: 'Finiture maniche' }
];

const STYLE_ID = 'kit-editor-style';
function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .kit-stage { position: sticky; top: -1rem; z-index: 5; margin: -1rem -1rem 1rem; padding: 1rem 1rem .6rem;
      background-color: var(--bg); background-image: linear-gradient(var(--menu-bg, var(--bg)), var(--menu-bg, var(--bg))); border-bottom: 1px solid var(--border); }
    .kit-preview { display: flex; justify-content: center; }
    .kit-preview svg { width: auto; height: 30vh; max-height: 280px; min-height: 170px; max-width: 100%; filter: drop-shadow(0 8px 14px rgba(0,0,0,.35)); }
    .kit-actions { display: flex; gap: .5rem; justify-content: center; margin-top: .5rem; flex-wrap: wrap; }
    .kit-dirty { font-size: .7rem; color: var(--gold); text-align: center; margin-top: .3rem; min-height: 1em; }

    .kit-acc { background: var(--card); border: 1px solid var(--border); border-radius: 14px; margin-bottom: .6rem; overflow: hidden; }
    .kit-acc-head { width: 100%; display: flex; align-items: center; gap: .5rem; padding: .85rem 1rem; background: none; border: none;
      color: var(--title, var(--accent)); font-family: inherit; font-size: .8rem; font-weight: 700; text-align: left; cursor: pointer; }
    .kit-acc-head span { flex: 1; }
    .kit-acc-head i { font-size: 1.2rem; transition: transform .2s; }
    .kit-acc.open .kit-acc-head i { transform: rotate(180deg); }
    .kit-acc-body { display: none; padding: 0 1rem 1rem; }
    .kit-acc.open .kit-acc-body { display: block; }

    .kit-sub { font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; color: var(--label, var(--text2)); margin: .9rem 0 .5rem; }
    .kit-sub:first-child { margin-top: 0; }
    .kit-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); gap: .45rem; }
    .kit-grid.wide { grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); }
    .kit-opt { position: relative; background: var(--bg3); border: 2px solid transparent; border-radius: 10px; padding: .25rem .2rem .3rem;
      cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: .15rem; color: var(--text2); font-family: inherit; }
    .kit-opt svg { width: 100%; height: auto; aspect-ratio: 400 / 420; pointer-events: none; }
    .kit-opt .lb { font-size: .6rem; line-height: 1.15; text-align: center; pointer-events: none; }
    .kit-opt.on { border-color: var(--accent); color: var(--accent); }
    .kit-opt.on::after { content: '\\2713'; position: absolute; top: -6px; right: -6px; width: 18px; height: 18px; border-radius: 50%;
      background: var(--accent); color: var(--bg); font-size: .7rem; font-weight: 700; display: flex; align-items: center; justify-content: center; }
    .kit-brand { height: 44px; width: 100%; border-radius: 6px; display: flex; align-items: center; justify-content: center; pointer-events: none; }
    .kit-brand svg { width: 52px; height: 36px; aspect-ratio: auto; }

    .kit-color-row { display: flex; align-items: center; gap: .6rem; padding: .45rem 0; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
    .kit-color-row:last-child { border-bottom: none; }
    .kit-color-row .nm { flex: 1; min-width: 110px; font-size: .82rem; font-weight: 600; color: var(--text); }
    .kit-color { width: 40px; height: 32px; border: 1px solid var(--border); border-radius: 8px; padding: 0; background: none; cursor: pointer; flex-shrink: 0; }
    .kit-color::-webkit-color-swatch-wrapper { padding: 2px; } .kit-color::-webkit-color-swatch { border: none; border-radius: 6px; }
    .kit-swatches { display: flex; flex-wrap: wrap; gap: .3rem; width: 100%; }
    .kit-sw { width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--border); cursor: pointer; padding: 0; }
    .kit-sw.on { outline: 2px solid var(--accent); outline-offset: 1px; }

    .kit-chips { display: flex; flex-wrap: wrap; gap: .35rem; }
    .kit-field { display: flex; align-items: center; gap: .6rem; margin: .5rem 0; font-size: .78rem; color: var(--text2); }
    .kit-field > span { min-width: 92px; }
    .kit-field input[type="range"] { flex: 1; accent-color: var(--accent); }
    .kit-field input[type="text"], .kit-field select { flex: 1; min-width: 0; background: var(--bg2); border: 1px solid var(--border); border-radius: 8px;
      color: var(--text); padding: .45rem .6rem; font-family: inherit; font-size: .82rem; user-select: text; -webkit-user-select: text; }
    .kit-field .val { width: 38px; text-align: right; color: var(--text); font-variant-numeric: tabular-nums; }

    .kit-layer { display: flex; align-items: center; gap: .5rem; background: var(--bg3); border: 2px solid transparent; border-radius: 10px; padding: .35rem .5rem; margin-bottom: .4rem; cursor: pointer; }
    .kit-layer.on { border-color: var(--accent); }
    .kit-layer .th { width: 40px; flex-shrink: 0; pointer-events: none; }
    .kit-layer .th svg { width: 100%; height: auto; }
    .kit-layer .nm { flex: 1; min-width: 0; font-size: .8rem; font-weight: 600; color: var(--text); pointer-events: none; }
    .kit-layer .nm small { display: block; font-weight: 400; color: var(--text2); font-size: .68rem; }
    .kit-icon-btn { background: transparent; border: 1px solid var(--border); color: var(--text2); border-radius: 8px; width: 30px; height: 30px;
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
const patternLabel = (id) => (PATTERNS.find(p => p.id === id) || {}).label || id;

/** Patch disponibili: loghi delle competizioni + logo della Federazione. */
function availablePatches(STATE) {
  const comps = Array.isArray(STATE.competitions) ? STATE.competitions : Object.values(STATE.competitions || {});
  const list = comps.filter(c => c && c.logo).map(c => ({ id: String(c.id), name: c.name || 'Competizione', src: c.logo }));
  list.push({ id: 'federazione', name: 'Federazione', src: FEDERAZIONE_LOGO });
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
  },

  refresh(STATE) {
    // lo stemma può cambiare (Configurazione squadra): aggiorno solo l'anteprima, senza toccare le modifiche
    if (this._root && this._kit) this._renderPreview();
  },

  unmount() { this._root = null; this._kit = null; },

  /* -------------------------------------------------------------- render */
  _crest() { return (window.STATE.user && window.STATE.user.logo) || ''; },
  _dirty() { return JSON.stringify(this._kit) !== this._saved; },

  _thumb(kit) { return renderKitSvg(kit, { crestUrl: this._crest(), simple: true }); },

  _renderAll() {
    const sections = [
      ['model',   'FASE 1: Seleziona un modello'],
      ['cut',     'FASE 2: Colletto e maniche'],
      ['design',  'FASE 3: Disegno (livelli)'],
      ['colors',  'FASE 4: Seleziona i colori'],
      ['sponsor', 'FASE 5: Scelta dello SPONSOR'],
      ['brand',   'FASE 6: Stemma e marchio tecnico'],
      ['patches', 'FASE 7: Scelta delle PATCH']
    ];
    this._root.innerHTML = `
      <div class="kit-stage">
        <div class="kit-preview" id="kit-preview"></div>
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
    `;
    this._renderPreview();
    this._renderSection();
  },

  _renderPreview() {
    if (!this._root) return;
    const box = this._root.querySelector('#kit-preview');
    if (box) box.innerHTML = renderKitSvg(this._kit, { crestUrl: this._crest() });
    // stemma e patch vengono scontornati in background: appena pronti ridisegno
    const wait = whenCutoutsReady(this._kit.patches.map(p => p.src).concat(this._kit.crest.show ? [this._crest()] : []).filter(Boolean));
    if (wait) wait.then(() => { if (this._root && this._kit) this._renderPreview(); });
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
    this._root.querySelectorAll('.kit-acc-body').forEach(b => { b.innerHTML = ''; });
    const key = this._open;
    const box = key && this._root.querySelector(`#kit-sec-${key}`);
    if (!box) return;
    const fn = {
      model: this._secModel, cut: this._secCut, design: this._secDesign, colors: this._secColors,
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

  _opt(act, value, svg, label, on, extra = '') {
    return `<button class="kit-opt ${on ? 'on' : ''}" data-act="${act}" data-v="${esc(value)}" ${extra} title="${esc(label)}">${svg}<span class="lb">${esc(label)}</span></button>`;
  },

  _colorPicker(path, value) {
    return `
      <input type="color" class="kit-color" data-color="${path}" value="${esc(value)}">
      <div class="kit-swatches">${SWATCHES.map(c => `<button class="kit-sw ${String(value).toLowerCase() === c ? 'on' : ''}" style="background:${c}" data-act="swatch" data-path="${path}" data-v="${c}" aria-label="${c}"></button>`).join('')}</div>`;
  },

  _range(path, label, value, min, max, unit = '') {
    return `<label class="kit-field"><span>${label}</span><input type="range" min="${min}" max="${max}" value="${value}" data-range="${path}"><span class="val">${value}${unit}</span></label>`;
  },

  _chip(act, value, label, on) {
    return `<button class="lv-chip ${on ? 'on' : ''}" data-act="${act}" data-v="${esc(value)}">${esc(label)}</button>`;
  },

  /* ------------------------------------------------------------ sezioni */
  _secModel() {
    const k = this._kit;
    return `
      <div class="mp-muted" style="margin-bottom:.6rem;">Parti da un modello: puoi poi cambiare colletto, maniche, disegno e colori nelle fasi successive. Sponsor, stemma e patch restano invariati.</div>
      <div class="kit-grid">
        ${PRESETS.map((p, i) => this._opt('preset', i, this._thumb({ ...k, ...p.kit, sleeveDeco: p.kit.sleeveDeco || 'none', sponsor: { mode: 'none' }, patches: [], crest: { show: false }, brand: { id: 'none' } }), p.name, false)).join('')}
      </div>`;
  },

  _secCut() {
    const k = this._kit;
    const base = { ...k, sponsor: { mode: 'none' }, patches: [], crest: { show: false } };
    return `
      <div class="kit-sub">Colletto</div>
      <div class="kit-grid">${COLLARS.map(c => this._opt('collar', c.id, this._thumb({ ...base, collar: c.id }), c.label, k.collar === c.id)).join('')}</div>
      <div class="kit-sub">Maniche</div>
      <div class="kit-grid">${SLEEVES.map(s => this._opt('sleeves', s.id, this._thumb({ ...base, sleeves: s.id }), s.label, k.sleeves === s.id)).join('')}</div>
      <div class="kit-sub">Polsini</div>
      <div class="kit-grid">${CUFFS.map(c => this._opt('cuffs', c.id, this._thumb({ ...base, cuffs: c.id }), c.label, k.cuffs === c.id)).join('')}</div>
      <div class="kit-sub">Decorazioni maniche</div>
      <div class="kit-grid">${SLEEVE_DECO.map(d => this._opt('sleeveDeco', d.id, this._thumb({ ...base, sleeveDeco: d.id }), d.label, k.sleeveDeco === d.id)).join('')}</div>
      <div class="mp-muted" style="margin-top:.6rem;">Colori di polsini e decorazioni nella FASE 4.</div>`;
  },

  _secDesign() {
    const k = this._kit;
    const plain = { ...k, layers: [], sponsor: { mode: 'none' }, patches: [], crest: { show: false }, brand: { id: 'none' } };
    const sel = Math.min(this._layer, k.layers.length - 1);
    const layers = k.layers.map((l, i) => `
      <div class="kit-layer ${i === sel ? 'on' : ''}" data-act="pick-layer" data-i="${i}">
        <div class="th">${this._thumb({ ...plain, layers: [l] })}</div>
        <div class="nm">Livello ${i + 1}<small>${esc(patternLabel(l.type))}</small></div>
        <button class="kit-icon-btn" data-act="layer-up" data-i="${i}" ${i === 0 ? 'disabled' : ''} title="Porta sotto"><i class="ri-arrow-up-line"></i></button>
        <button class="kit-icon-btn" data-act="layer-down" data-i="${i}" ${i === k.layers.length - 1 ? 'disabled' : ''} title="Porta sopra"><i class="ri-arrow-down-line"></i></button>
        <button class="kit-icon-btn" data-act="layer-del" data-i="${i}" title="Elimina"><i class="ri-delete-bin-line"></i></button>
      </div>`).join('');

    let editor = '';
    if (sel >= 0) {
      const l = k.layers[sel];
      const p = `layers.${sel}`;
      editor = `
        <div class="kit-layer-edit">
          <div class="kit-sub">Disegno del livello ${sel + 1}</div>
          <div class="kit-grid">${PATTERNS.map(pt => this._opt('layer-type', pt.id, this._thumb({ ...plain, layers: [{ ...l, type: pt.id, opacity: 100 }] }), pt.label, l.type === pt.id)).join('')}</div>
          <div class="kit-sub">Colore del livello</div>
          <div class="kit-color-row">${this._colorPicker(`${p}.color`, l.color)}</div>
          ${this._range(`${p}.opacity`, 'Opacità', l.opacity, 5, 100, '%')}
          ${this._range(`${p}.scale`, 'Dimensione', l.scale, 30, 250, '%')}
          <div class="kit-chips" style="margin-top:.4rem;">
            ${this._chip('layer-flag', 'flipX', 'Specchia ↔', l.flipX)}
            ${this._chip('layer-flag', 'flipY', 'Capovolgi ↕', l.flipY)}
            ${this._chip('layer-flag', 'onSleeves', 'Anche sulle maniche', l.onSleeves)}
          </div>
        </div>`;
    }

    return `
      <div class="mp-muted" style="margin-bottom:.6rem;">Sovrapponi fino a ${MAX_LAYERS} livelli: ognuno ha il suo disegno, colore, opacità e dimensione. Il primo livello è quello più in basso.</div>
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

  _secSponsor() {
    const sp = this._kit.sponsor;
    let body = '';
    if (sp.mode === 'image') {
      body = `
        <div class="kit-field" style="flex-wrap:wrap;">
          ${sp.url ? `<img class="kit-upload-thumb" src="${esc(sp.url)}" alt="Sponsor">` : ''}
          <label class="mp-btn"><i class="ri-upload-2-line"></i> ${sp.url ? 'Cambia immagine' : 'Carica immagine'}
            <input type="file" accept="image/png" data-upload="sponsor" style="display:none;">
          </label>
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
        ${this._chip('sponsor-mode', 'image', 'Immagine', sp.mode === 'image')}
        ${this._chip('sponsor-mode', 'text', 'Scritta', sp.mode === 'text')}
      </div>
      ${body}
      ${sp.mode !== 'none' ? this._range('sponsor.scale', 'Dimensione', sp.scale, 40, 160, '%') + this._range('sponsor.y', 'Posizione', sp.y, -60, 80) : ''}`;
  },

  _secBrand() {
    const k = this._kit;
    const crest = this._crest();
    const brandCell = (b) => {
      const inner = b.id === 'none'
        ? '<i class="ri-forbid-line" style="font-size:1.3rem;"></i>'
        : b.id === 'custom'
          ? (k.brand.url ? `<img src="${esc(k.brand.url)}" alt="" style="max-width:52px; max-height:36px; object-fit:contain;">` : '<i class="ri-upload-2-line" style="font-size:1.3rem;"></i>')
          : `<svg viewBox="0 0 60 40">${b.draw(k.brand.color, k.colors.base)}</svg>`;
      return `<button class="kit-opt ${k.brand.id === b.id ? 'on' : ''}" data-act="brand" data-v="${b.id}" title="${esc(b.label)}">
        <div class="kit-brand" style="background:${esc(k.colors.base)}; color:${esc(k.brand.color)};">${inner}</div><span class="lb">${esc(b.label)}</span></button>`;
    };
    return `
      <div class="kit-sub">Stemma della squadra (in alto a sinistra)</div>
      ${crest ? `
        <div class="kit-chips">
          ${this._chip('crest-show', '1', 'Mostra stemma', k.crest.show)}
          ${this._chip('crest-show', '0', 'Nascondi', !k.crest.show)}
        </div>
        ${k.crest.show ? this._range('crest.size', 'Dimensione', k.crest.size, 60, 150, '%') : ''}`
        : `<div class="mp-muted">Non hai ancora un logo: caricalo da <b>Configurazione squadra</b> e comparirà sulla maglia.</div>`}
      <div class="kit-sub">Marchio tecnico (in alto a destra)</div>
      <div class="kit-grid wide">${BRANDS.map(brandCell).join('')}</div>
      ${k.brand.id === 'custom' ? `
        <div class="kit-field"><label class="mp-btn"><i class="ri-upload-2-line"></i> ${k.brand.url ? 'Cambia marchio' : 'Carica marchio'}
          <input type="file" accept="image/png" data-upload="brand" style="display:none;"></label></div>
        <div class="mp-muted">Solo immagini <b>PNG</b> con sfondo trasparente.</div>` : ''}
      ${k.brand.id !== 'none' && k.brand.id !== 'custom' ? `<div class="kit-sub">Colore del marchio</div><div class="kit-color-row">${this._colorPicker('brand.color', k.brand.color)}</div>` : ''}`;
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
      <div class="kit-sub">Aggiungi una patch</div>
      ${full ? `<div class="mp-muted">Hai raggiunto il massimo di ${MAX_PATCHES} patch.</div>` : `
      <div class="kit-grid wide">
        ${avail.map(a => `<button class="kit-opt kit-comp" data-act="patch-add" data-v="${esc(a.id)}" title="${esc(a.name)}">
          <img data-cut="${esc(a.src)}" alt=""><span class="lb">${esc(a.name)}</span></button>`).join('')}
      </div>`}
      <div class="mp-muted" style="margin-top:.6rem;">I loghi vengono scontornati automaticamente. Per ogni patch scegli la posizione: centro petto, sotto lo sponsor, sulle maniche o in fondo alla maglia.</div>`;
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
    if (!btn || !this._root || !this._root.contains(btn)) return;
    const act = btn.dataset.act;
    const v = btn.dataset.v;
    const i = Number(btn.dataset.i);
    const k = this._kit;

    switch (act) {
      case 'toggle': {
        this._open = this._open === btn.dataset.sec ? null : btn.dataset.sec;
        this._root.querySelectorAll('.kit-acc').forEach(a => a.classList.toggle('open', a.dataset.sec === this._open));
        this._renderSection();
        this._scrollToOpen();
        return;
      }
      case 'save': this._save(); return;
      case 'undo':
        if (!this._dirty()) return;
        this._kit = normalizeKit(JSON.parse(this._saved));
        this._layer = 0;
        this._renderPreview(); this._renderSection();
        return;
      case 'preset': {
        const p = PRESETS[Number(v)];
        if (!p) return;
        this._update(kit => {
          kit.collar = p.kit.collar; kit.sleeves = p.kit.sleeves; kit.cuffs = p.kit.cuffs;
          kit.sleeveDeco = p.kit.sleeveDeco || 'none';
          kit.layers = normalizeKit({ layers: clone(p.kit.layers) }).layers;
        }, { section: false });
        this._layer = 0;
        return;
      }
      case 'collar': case 'sleeves': case 'cuffs': case 'sleeveDeco':
        this._update(kit => { kit[act] = v; });
        return;
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
          kit.layers.push({ type: 'stripes', color: kit.colors.collar || '#ffffff', opacity: 100, scale: 100, flipX: false, flipY: false, onSleeves: false });
          this._layer = kit.layers.length - 1;
        });
        return;
      case 'pick-layer':
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
      case 'layer-type':
        this._update(kit => { kit.layers[this._layer].type = v; });
        return;
      case 'layer-flag':
        this._update(kit => { const l = kit.layers[this._layer]; l[v] = !l[v]; });
        return;

      // sponsor
      case 'sponsor-mode':
        this._update(kit => { kit.sponsor.mode = v; });
        return;
      case 'sponsor-font':
        this._update(kit => { kit.sponsor.font = v; });
        return;
      case 'sponsor-mono':
        this._update(kit => { kit.sponsor.mono = v === '1'; });
        return;

      // stemma e marchio
      case 'crest-show':
        this._update(kit => { kit.crest.show = v === '1'; });
        return;
      case 'brand':
        this._update(kit => { kit.brand.id = v; });
        return;

      // patch
      case 'patch-add': {
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
      if (val) val.textContent = t.value + (val.textContent.endsWith('%') ? '%' : '');
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

  async _save() {
    if (this._busy || !this._kit) return;
    const team = window.STATE.user;
    if (!team || String(team.id) !== String(this._teamId)) return;
    this._busy = true;
    const btn = this._root.querySelector('[data-act="save"]');
    if (btn) btn.classList.add('busy');
    const kit = clone(this._kit);
    try {
      await update(ref(db, `teams/${team.id}`), { kit });
      team.kit = kit; // aggiornamento immediato; il listener del DB lo riconferma
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
