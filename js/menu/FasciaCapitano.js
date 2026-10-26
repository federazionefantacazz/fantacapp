import { db, ref, update } from '../firebase-config.js';
import { injectStyle, parseColor, SWATCHES } from './DivisaSquadra.js';
import { esc } from './menuUtils.js';
import {
  captainBandSVG, normalizeBand, BAND_DEFAULT, BAND_SHAPES, BAND_PATTERNS, BAND_FONTS, BAND_MAX_TEXT
} from '../components/CaptainBand.js';

/**
 * Editor 2D della fascia da capitano (Configurazione squadra → Fascia da capitano).
 * La fascia si vede accanto al capitano in Formazione e nel Live.
 * Firebase: teams/{id}/captainBand (vedi js/components/CaptainBand.js).
 */
const COLORS = [
  { key: 'bg',     label: 'Sfondo' },
  { key: 'bg2',    label: 'Seconda tinta', pattern: true },
  { key: 'fg',     label: 'Lettera' },
  { key: 'border', label: 'Bordo' }
];

const STYLE_ID = 'band-editor-style';
function injectBandStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .band-stage { display: flex; align-items: center; justify-content: center; gap: 1.2rem; padding: 1.2rem .6rem; border-radius: 14px;
      background: repeating-linear-gradient(to bottom, #2e7d32 0 22px, #2a7230 22px 44px); }
    .band-stage .big { filter: drop-shadow(0 4px 10px rgba(0,0,0,.45)); line-height: 0; }
    .band-sizes { display: flex; flex-direction: column; align-items: center; gap: .5rem; line-height: 0; }
    .band-text { width: 70px; text-align: center; text-transform: uppercase; font-weight: 700; }
  `;
  document.head.appendChild(style);
}

export const FasciaCapitano = {
  title: 'Fascia da capitano',

  mount(body, STATE) {
    injectStyle();
    injectBandStyle();
    const team = STATE.user || {};
    this._teamId = team.id;
    this._band = normalizeBand(team.captainBand);
    this._saved = JSON.stringify(this._band);
    this._busy = false;

    const root = document.createElement('div');
    body.appendChild(root);
    this._root = root;
    this._render();

    root.addEventListener('click', (e) => this._onClick(e));
    root.addEventListener('input', (e) => this._onInput(e));
    root.addEventListener('change', (e) => this._onInput(e, true));
  },

  unmount() { this._root = null; },

  /* ------------------------------------------------------------ disegno */
  _render() {
    if (!this._root) return;
    const b = this._band;
    const chip = (act, v, label, on) => `<button class="lv-chip ${on ? 'on' : ''}" data-act="${act}" data-v="${esc(v)}">${esc(label)}</button>`;
    this._root.innerHTML = `
      <div class="mp-card">
        <div class="band-stage">
          <div class="big" data-preview="big"></div>
          <div class="band-sizes"><div data-preview="field"></div><div data-preview="live"></div></div>
        </div>
        <div class="mp-muted" style="text-align:center; margin-top:.5rem;">A destra come appare sul campo della Formazione e nel Live.</div>
      </div>

      <div class="mp-card">
        <div class="kit-sub">Forma</div>
        <div class="kit-chips">${BAND_SHAPES.map(s => chip('shape', s.id, s.label, b.shape === s.id)).join('')}</div>
        <div class="kit-sub">Disegno</div>
        <div class="kit-chips">${BAND_PATTERNS.map(p => chip('pattern', p.id, p.label, b.pattern === p.id)).join('')}</div>
        <div class="kit-sub">Lettera</div>
        <div class="kit-field">
          <span>Testo (max ${BAND_MAX_TEXT})</span>
          <input type="text" class="band-text" data-band-text value="${esc(b.text)}" maxlength="${BAND_MAX_TEXT * 2}" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Lettera della fascia">
        </div>
        <div class="kit-chips">${BAND_FONTS.map(f => chip('font', f.id, f.label, b.font === f.id)).join('')}</div>
      </div>

      <div class="mp-card">
        <div class="kit-sub">Colori</div>
        ${COLORS.filter(c => !c.pattern || b.pattern !== 'plain').map(c => `
          <div class="kit-color-row">
            <span class="nm">${esc(c.label)}</span>
            <input type="color" class="kit-color" data-color="${c.key}" value="${esc(b[c.key])}" aria-label="${esc(c.label)}">
            <input type="text" class="kit-hex" data-hex="${c.key}" value="${esc(b[c.key])}" maxlength="24" spellcheck="false" autocomplete="off" autocapitalize="off" title="Codice HEX (#1e5bb8) o RGB (30, 91, 184)">
            <div class="kit-swatches">${SWATCHES.map(s => `<button class="kit-sw ${b[c.key] === s ? 'on' : ''}" style="background:${s}" data-act="swatch" data-key="${c.key}" data-v="${s}" aria-label="${s}"></button>`).join('')}</div>
          </div>`).join('')}
      </div>

      <div style="display:flex; gap:.5rem; margin-bottom:1rem;">
        <button class="mp-btn ghost" data-act="reset" style="flex:1;"><i class="ri-restart-line"></i> Predefinita</button>
        <button class="mp-btn" data-act="save" style="flex:2;"><i class="ri-save-line"></i> Salva fascia</button>
      </div>`;
    this._preview();
  },

  /** Solo le anteprime (mentre si sceglie un colore o si scrive la lettera) */
  _preview() {
    if (!this._root) return;
    const put = (k, h) => { const el = this._root.querySelector(`[data-preview="${k}"]`); if (el) el.innerHTML = captainBandSVG(this._band, { height: h }); };
    put('big', 84);
    put('field', 15);
    put('live', 13);
  },

  _set(key, value, { full = false } = {}) {
    this._band = normalizeBand({ ...this._band, [key]: value });
    if (full) this._render(); else this._preview();
  },

  /* ------------------------------------------------------------ eventi */
  _onClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn || this._busy) return;
    const act = btn.dataset.act, v = btn.dataset.v;
    if (act === 'shape' || act === 'pattern' || act === 'font') this._set(act, v, { full: true });
    else if (act === 'swatch') this._set(btn.dataset.key, v, { full: true });
    else if (act === 'reset') { this._band = normalizeBand(BAND_DEFAULT); this._render(); }
    else if (act === 'save') this._save();
  },

  _onInput(e, committed = false) {
    const t = e.target;
    if (t.dataset.bandText !== undefined) {
      this._set('text', t.value);
      if (committed) t.value = this._band.text; // tolto ciò che va oltre i caratteri ammessi
    } else if (t.dataset.color) {
      this._set(t.dataset.color, t.value);
      const hx = this._root.querySelector(`.kit-hex[data-hex="${t.dataset.color}"]`);
      if (hx) { hx.value = t.value; hx.classList.remove('bad'); }
      if (committed) this._render(); // aggiorna i quadratini evidenziati
    } else if (t.dataset.hex) {
      const c = parseColor(t.value);
      t.classList.toggle('bad', !c && (committed || t.value.trim().length >= 7));
      if (c) {
        this._set(t.dataset.hex, c);
        const ci = this._root.querySelector(`.kit-color[data-color="${t.dataset.hex}"]`);
        if (ci) ci.value = c;
      }
    }
  },

  async _save() {
    const team = window.STATE && window.STATE.user;
    if (!team || String(team.id) !== String(this._teamId)) return;
    this._busy = true;
    try {
      await update(ref(db, `teams/${team.id}`), { captainBand: this._band });
      team.captainBand = this._band; // subito, il listener del DB lo riconferma
      this._saved = JSON.stringify(this._band);
      window.showToast('Fascia salvata!', 'ok');
    } catch (err) {
      console.error(err);
      window.showToast('Salvataggio non riuscito, riprova', 'err');
    } finally {
      this._busy = false;
    }
  }
};
