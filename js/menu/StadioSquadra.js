import { db, ref, update } from '../firebase-config.js';
import { uploadPngToImgBB } from '../services/integrationImgBB.js';
import { dataUrlToBlob } from '../components/Kit3D.js';
import {
  createStadiumViewer, renderStadiumImage, stadiumCapacity, normalizeStadium, defaultStadium,
  RINGS, SHAPES, CORNERS, MOWING, SEAT_MODES, MAX_NAME
} from '../components/Stadium3D.js';
import { injectStyle, parseColor, SWATCHES } from './DivisaSquadra.js';
import { esc } from './menuUtils.js';

/**
 * Editor dello stadio della squadra (Configurazione squadra → Stadio).
 * Lo stadio è costruito via codice da components/Stadium3D.js (solo l'interno: campo, pista, spalti, seggiolini);
 * al salvataggio si genera anche una foto PNG (stadium.image) usata nel resto dell'app.
 */
const clone = (o) => JSON.parse(JSON.stringify(o));
/** Confronto per "modifiche non salvate": foto e capienza si ricalcolano al salvataggio. */
const sig = (st) => { const { image, capacity, ...rest } = st; return JSON.stringify(rest); };
const fmt = (n) => Number(n || 0).toLocaleString('it-IT');

const STYLE_ID = 'stadium-editor-style';
function injectStadiumStyle() {
  injectStyle();
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .kit-preview > #std-3d { position: absolute; inset: 0; }
    .std-cap { text-align: center; font-size: .75rem; color: var(--text2); font-family: var(--font-sub, inherit); margin-top: .35rem; }
    .std-cap b { color: var(--text); font-variant-numeric: tabular-nums; }
  `;
  document.head.appendChild(style);
}

/** Colori dei seggiolini richiesti da ogni modalità: [chiave, etichetta]. */
function seatFields(st) {
  switch (st.seatMode) {
    case 'sectors': return [['seatA', 'Tribune (lati lunghi)'], ['seatB', 'Curve']];
    case 'rings':   return [['seatA', 'Primo anello'], ['seatB', 'Secondo anello'], ['seatC', 'Terzo anello']].slice(0, st.rings);
    case 'mosaic':  return [['seatA', 'Colore principale'], ['seatB', 'Secondo colore'], ['seatC', 'Terzo colore']];
    default:        return [['seatA', 'Seggiolini']];
  }
}

const VIEWS = [['aerial', 'Aerea'], ['top', "Dall'alto"], ['stand', 'Tribuna']];

export const StadioSquadra = {
  title: 'Stadio',
  _open: 'structure',
  _busy: false,

  mount(body, STATE) {
    injectStadiumStyle();
    const team = STATE.user;
    const root = document.createElement('div');
    body.appendChild(root);
    this._root = root;
    if (!team) {
      root.innerHTML = `<div class="lv-empty">Accedi con la tua squadra per costruire lo stadio.</div>`;
      return;
    }
    this._teamId = team.id;
    this._st = normalizeStadium(team.stadium || defaultStadium());
    this._saved = sig(this._st);
    this._open = 'structure';
    this._renderAll();

    root.addEventListener('click', (e) => this._onClick(e));
    root.addEventListener('input', (e) => this._onInput(e));
    root.addEventListener('change', (e) => this._onChange(e));
    root.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.dataset && (e.target.dataset.hex || e.target.dataset.text)) e.target.blur(); });
  },

  unmount() {
    if (this._zoom) this._zoom.close();
    if (this._viewer) this._viewer.dispose();
    this._viewer = null;
    this._root = null;
    this._st = null;
  },

  /* -------------------------------------------------------------- render */
  _dirty() { return sig(this._st) !== this._saved; },

  _renderAll() {
    const sections = [
      ['structure', 'FASE 1: Anelli, curve e pista'],
      ['pitch',     'FASE 2: Campo'],
      ['seats',     'FASE 3: Colore dei seggiolini'],
      ['walls',     'FASE 4: Parapetti e cemento'],
      ['name',      'FASE 5: Nome dello stadio']
    ];
    this._root.innerHTML = `
      <div class="kit-stage">
        <div class="kit-preview">
          <div class="kit-loading" id="std-loading">Costruzione dello stadio…</div>
          <div id="std-3d"></div>
          <div class="kit-hint"><i class="ri-drag-move-line"></i> Trascina per ruotare</div>
          <div class="kit-view-btns">${VIEWS.map(([v, l]) => `<button data-act="view" data-v="${v}">${l}</button>`).join('')}</div>
          <button class="kit-zoom-btn" data-act="zoom-open" title="Ingrandisci lo stadio" aria-label="Ingrandisci lo stadio"><i class="ri-zoom-in-line"></i></button>
        </div>
        <div class="std-cap" id="std-cap"></div>
        <div class="kit-dirty" id="std-dirty"></div>
        <div class="kit-actions">
          <button class="mp-btn ghost" data-act="undo"><i class="ri-arrow-go-back-line"></i> Annulla modifiche</button>
          <button class="mp-btn" data-act="save"><i class="ri-save-3-line"></i> Salva stadio</button>
        </div>
      </div>
      ${sections.map(([key, label]) => `
        <div class="kit-acc ${this._open === key ? 'open' : ''}" data-sec="${key}">
          <button class="kit-acc-head" data-act="toggle" data-sec="${key}"><span>${label}</span><i class="ri-arrow-down-s-line"></i></button>
          <div class="kit-acc-body" id="std-sec-${key}"></div>
        </div>`).join('')}
      <div class="mp-muted" style="text-align:center; margin-top:.4rem;">Lo stadio è visibile a tutti nella scheda del tuo club.</div>
      <div class="kit-actions" style="margin-top:1rem;">
        <button class="mp-btn danger" data-act="reset"><i class="ri-delete-bin-line"></i> Elimina stadio e ricomincia da zero</button>
      </div>
    `;
    this._renderPreview();
    this._renderSection();
  },

  _renderPreview() {
    if (!this._root) return;
    const box = this._root.querySelector('#std-3d');
    if (box && !this._viewer) {
      this._viewer = createStadiumViewer(box);
      this._viewer.ready.then(() => { const l = this._root && this._root.querySelector('#std-loading'); if (l) l.remove(); })
        .catch(e => { console.error(e); const l = this._root && this._root.querySelector('#std-loading'); if (l) l.textContent = 'Il 3D non è supportato su questo dispositivo'; });
    }
    if (this._viewer) this._viewer.update(this._st).catch(e => console.error('Stadio:', e));
    const cap = this._root.querySelector('#std-cap');
    if (cap) cap.innerHTML = `Capienza: <b>${fmt(stadiumCapacity(this._st))}</b> posti`;
    const dirty = this._root.querySelector('#std-dirty');
    if (dirty) dirty.textContent = this._dirty() ? 'Modifiche non salvate' : '';
  },

  /** Durante trascinamenti (selettore colore) ridisegno al massimo una volta per frame. */
  _schedulePreview() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => { this._raf = 0; this._renderPreview(); });
  },

  /** Ridisegna il contenuto della sezione aperta (le altre restano vuote finché non si aprono). */
  _renderSection() {
    if (!this._root) return;
    this._root.querySelectorAll('.kit-acc-body').forEach(b => { b.innerHTML = ''; });
    const key = this._open;
    const box = key && this._root.querySelector(`#std-sec-${key}`);
    if (!box) return;
    const fn = { structure: this._secStructure, pitch: this._secPitch, seats: this._secSeats, walls: this._secWalls, name: this._secName }[key];
    box.innerHTML = fn.call(this);
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
    mutator(this._st);
    this._renderPreview();
    if (section) this._renderSection();
  },

  _chip(key, value, label, on) {
    return `<button class="lv-chip ${on ? 'on' : ''}" data-act="set" data-k="${key}" data-v="${esc(value)}">${esc(label)}</button>`;
  },

  _colorRow(label, path, value) {
    return `
      <div class="kit-color-row">
        <span class="nm">${esc(label)}</span>
        <input type="color" class="kit-color" data-color="${path}" value="${esc(value)}">
        <input type="text" class="kit-hex" data-hex="${path}" value="${esc(value)}" maxlength="24" spellcheck="false" autocomplete="off" autocapitalize="off" title="Codice HEX (#1e5bb8) o RGB (30, 91, 184)">
        <div class="kit-swatches">${SWATCHES.map(c => `<button class="kit-sw ${String(value).toLowerCase() === c ? 'on' : ''}" style="background:${c}" data-act="swatch" data-path="${path}" data-v="${c}" aria-label="${c}"></button>`).join('')}</div>
      </div>`;
  },

  /* ------------------------------------------------------------ sezioni */
  _secStructure() {
    const s = this._st;
    return `
      <div class="kit-sub">Anelli di spalti</div>
      <div class="kit-chips">${RINGS.map(r => this._chip('rings', r.id, r.label, s.rings === r.id)).join('')}</div>
      <div class="kit-sub">Pista d'atletica</div>
      <div class="kit-chips">${this._chip('track', '1', 'Sì', s.track)}${this._chip('track', '0', 'No', !s.track)}</div>
      <div class="mp-muted" style="margin-top:.3rem;">Con la pista gli spalti sono più lontani dal campo.</div>
      <div class="kit-sub">Forma delle curve</div>
      <div class="kit-chips">${SHAPES.map(o => this._chip('shape', o.id, o.label, s.shape === o.id)).join('')}</div>
      <div class="kit-sub">Curve e tribune</div>
      <div class="kit-chips">${CORNERS.map(o => this._chip('corners', o.id, o.label, s.corners === o.id)).join('')}</div>
      <div class="mp-muted" style="margin-top:.3rem;">${s.corners === 'open' ? 'Quattro settori separati, con gli angoli aperti.' : 'Un unico anello di spalti tutto intorno al campo.'}</div>`;
  },

  _secPitch() {
    const s = this._st;
    return `
      <div class="kit-sub">Taglio dell'erba</div>
      <div class="kit-chips">${MOWING.map(o => this._chip('mowing', o.id, o.label, s.mowing === o.id)).join('')}</div>
      <div class="kit-sub">Colori</div>
      ${this._colorRow('Erba', 'colors.grass', s.colors.grass)}
      ${s.track ? this._colorRow('Pista', 'colors.track', s.colors.track) : ''}`;
  },

  _secSeats() {
    const s = this._st;
    return `
      <div class="kit-sub">Come colorarli</div>
      <div class="kit-chips">${SEAT_MODES.map(o => this._chip('seatMode', o.id, o.label, s.seatMode === o.id)).join('')}</div>
      ${s.seatMode === 'rings' && s.rings === 1 ? `<div class="mp-muted" style="margin-top:.3rem;">Lo stadio ha un solo anello: aggiungine altri nella FASE 1 per colorarli in modo diverso.</div>` : ''}
      ${s.seatMode === 'mosaic' ? `<div class="mp-muted" style="margin-top:.3rem;">Seggiolini mescolati a caso: tanti del colore principale, meno degli altri due.</div>` : ''}
      <div class="kit-sub">Colori</div>
      ${seatFields(s).map(([k, label]) => this._colorRow(label, `colors.${k}`, s.colors[k])).join('')}`;
  },

  _secWalls() {
    const s = this._st;
    return `
      ${this._colorRow('Parapetti', 'colors.parapet', s.colors.parapet)}
      ${this._colorRow('Cemento e scalette', 'colors.structure', s.colors.structure)}
      <div class="mp-muted" style="margin-top:.6rem;">I parapetti sono il bordo campo e le balconate davanti a ogni anello.</div>`;
  },

  _secName() {
    const s = this._st;
    return `
      <label class="kit-field"><span>Nome</span><input type="text" data-text="name" value="${esc(s.name)}" maxlength="${MAX_NAME}" placeholder="Es. Stadio Comunale"></label>
      <div class="mp-muted">Compare nella scheda del tuo club insieme alla capienza.</div>`;
  },

  /* ------------------------------------------------------------- eventi */
  _set(path, value) {
    const parts = path.split('.');
    let o = this._st;
    parts.slice(0, -1).forEach(p => { o = o[p]; });
    o[parts[parts.length - 1]] = value;
  },

  /** Finestra a tutto schermo con lo stadio: ruota in ogni direzione, zoom (due dita, rotella o + / −) e spostamento. */
  _openZoom() {
    if (this._zoom) return;
    const el = document.createElement('div');
    el.className = 'kit-zoom';
    el.innerHTML = `
      <div class="kit-zoom-head"><span>${esc(this._st.name || 'Stadio')}</span><button data-z="close" aria-label="Chiudi"><i class="ri-close-line"></i> Chiudi</button></div>
      <div class="kit-zoom-stage"><div></div></div>
      <div class="kit-zoom-bar">
        ${VIEWS.map(([v, l]) => `<button data-z="${v}">${l}</button>`).join('')}
        <button data-z="in" aria-label="Avvicina">＋ Zoom</button>
        <button data-z="out" aria-label="Allontana">− Zoom</button>
      </div>`;
    document.body.appendChild(el);
    const viewer = createStadiumViewer(el.querySelector('.kit-zoom-stage > div'), { zoom: true });
    viewer.update(this._st).catch(err => console.error('Stadio:', err));
    const close = () => { viewer.dispose(); el.remove(); this._zoom = null; };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-z]');
      if (!b) return;
      const z = b.dataset.z;
      if (z === 'close') close();
      else if (z === 'in') viewer.zoomBy(.75);
      else if (z === 'out') viewer.zoomBy(1 / .75);
      else viewer.setView(z);
    });
    this._zoom = { close };
  },

  _onClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn || !this._root || !this._root.contains(btn) || btn.disabled) return;
    const act = btn.dataset.act;
    const v = btn.dataset.v;

    switch (act) {
      case 'toggle':
        this._open = this._open === btn.dataset.sec ? null : btn.dataset.sec;
        this._root.querySelectorAll('.kit-acc').forEach(a => a.classList.toggle('open', a.dataset.sec === this._open));
        this._renderSection();
        this._scrollToOpen();
        return;
      case 'save': this._save(); return;
      case 'reset': this._reset(); return;
      case 'undo':
        if (!this._dirty()) return;
        this._st = normalizeStadium({ ...JSON.parse(this._saved), image: this._st.image, capacity: this._st.capacity });
        this._renderPreview(); this._renderSection();
        return;
      case 'zoom-open': this._openZoom(); return;
      case 'view':
        if (this._viewer) this._viewer.setView(v);
        return;
      case 'set': {
        const k = btn.dataset.k;
        const value = k === 'rings' ? Number(v) : k === 'track' ? v === '1' : v;
        this._update(st => { st[k] = value; });
        return;
      }
      case 'swatch':
        this._update(() => this._set(btn.dataset.path, v));
        return;
    }
  },

  /** Durante il trascinamento del color picker aggiorno solo l'anteprima. */
  _onInput(e) {
    const t = e.target;
    if (t.dataset.color) {
      this._set(t.dataset.color, t.value);
      const hx = t.parentElement.querySelector(`.kit-hex[data-hex="${t.dataset.color}"]`);
      if (hx) { hx.value = t.value; hx.classList.remove('bad'); }
      this._schedulePreview();
    } else if (t.dataset.hex) {
      // mentre scrivo: applico solo un HEX completo (#rrggbb); il resto (#rgb, RGB) quando confermo
      const c = /^#?[0-9a-f]{6}$/i.test(t.value.trim()) ? parseColor(t.value) : null;
      t.classList.toggle('bad', !parseColor(t.value) && t.value.trim().length >= 7);
      if (c) { this._set(t.dataset.hex, c); const ci = t.parentElement.querySelector(`.kit-color[data-color="${t.dataset.hex}"]`); if (ci) ci.value = c; this._schedulePreview(); }
    } else if (t.dataset.text) {
      this._set(t.dataset.text, t.value.slice(0, MAX_NAME));
      this._schedulePreview();
    }
  },

  _onChange(e) {
    const t = e.target;
    if (t.dataset.hex) {
      const c = parseColor(t.value);
      if (!c) { window.showToast('Codice non valido: usa #1e5bb8 oppure 30, 91, 184', 'err'); return; }
      this._set(t.dataset.hex, c);
      this._renderPreview(); this._renderSection();
    } else if (t.dataset.color) {
      // a fine scelta ridisegno la sezione (pallini dei colori)
      this._renderSection();
    } else if (t.dataset.text) {
      this._set(t.dataset.text, t.value.trim().slice(0, MAX_NAME));
      this._renderPreview();
    }
  },

  /** Cancella lo stadio salvato e riparte da quello di base. */
  async _reset() {
    if (this._busy || !this._st) return;
    const team = window.STATE.user;
    if (!team || String(team.id) !== String(this._teamId)) return;
    if (!confirm('Eliminare lo stadio? Verrà cancellato e ripartirai dallo stadio di base.')) return;
    this._busy = true;
    try {
      if (team.stadium) await update(ref(db, `teams/${team.id}`), { stadium: null });
      team.stadium = null; // aggiornamento immediato; il listener del DB lo riconferma
      this._st = normalizeStadium(defaultStadium());
      this._saved = sig(this._st);
      this._open = 'structure';
      this._root.querySelectorAll('.kit-acc').forEach(a => a.classList.toggle('open', a.dataset.sec === this._open));
      this._renderPreview(); this._renderSection();
      window.showToast('Stadio eliminato: puoi ricostruirlo da zero', 'ok');
    } catch (err) {
      console.error(err);
      window.showToast('Eliminazione non riuscita, riprova', 'err');
    } finally {
      this._busy = false;
    }
  },

  async _save() {
    if (this._busy || !this._st) return;
    const team = window.STATE.user;
    if (!team || String(team.id) !== String(this._teamId)) return;
    this._busy = true;
    const btn = this._root.querySelector('[data-act="save"]');
    if (btn) btn.classList.add('busy');
    window.showToast('Salvataggio in corso...', 'ok');
    const st = clone(this._st);
    delete st.image;
    st.name = st.name.trim();
    st.capacity = stadiumCapacity(st);
    try {
      // foto dello stadio per il resto dell'app (configurazione squadra, scheda club)
      try {
        const dataUrl = await renderStadiumImage(st, { width: 1300 });
        if (dataUrl) {
          const blob = await dataUrlToBlob(dataUrl);
          st.image = await uploadPngToImgBB(new File([blob], `stadio-${team.id}.png`, { type: 'image/png' }), 800);
        }
      } catch (e) { console.warn('Foto dello stadio non caricata', e); }
      await update(ref(db, `teams/${team.id}`), { stadium: st });
      team.stadium = st; // aggiornamento immediato; il listener del DB lo riconferma
      if (!this._st) return;
      this._st.name = st.name;
      this._st.image = st.image;
      this._st.capacity = st.capacity;
      this._saved = sig(this._st);
      this._renderPreview();
      window.showToast('Stadio salvato!', 'ok');
    } catch (err) {
      console.error(err);
      window.showToast('Salvataggio non riuscito, riprova', 'err');
    } finally {
      this._busy = false;
      if (btn) btn.classList.remove('busy');
    }
  }
};
