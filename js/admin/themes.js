import { ref, update, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { uploadBackgroundToImgBB } from "../services/integrationImgBB.js";
import { DiviseSection } from "./divise.js";
import { THEME_PAGES, THEME_VERSION, THEME_FONTS, normalizeTheme, buildThemeCss, legacyPageKeys } from "../services/themeService.js";
import { THEME_SECTIONS, SECTION_GROUPS, PROPS, propsOf } from "../services/themeElements.js";
import { esc } from "../utils.js";
import { fillPreviewTeams } from "./previewTeams.js";

let database = null;

/*
 * Temi: tutti in themes/{id} = { name, theme, backgroundImage, createdAt }.
 * Le competizioni scelgono il loro con competitions/{id}/themeId; gli utenti possono sceglierne
 * un altro in Impostazioni → Tema.
 *
 * Editor: "Colori di base" (theme.general) e, pagina per pagina, gli elementi con il loro nome
 * (theme.el, catalogo in js/services/themeElements.js). Accanto c'è l'anteprima dell'app
 * (index.html?themePreview=1, vedi js/services/themePreview.js) con il tema non ancora salvato:
 * scegliendo un elemento si evidenzia nell'anteprima, e toccandolo nell'anteprima si apre qui.
 */

const BASE = THEME_PAGES.find(p => p.key === 'general');
const BASE_KEY = 'base'; // sezione "Colori di base" nell'editor

const isHex = (v) => /^#[0-9a-fA-F]{6}$/.test(v || '');
const clone = (o) => JSON.parse(JSON.stringify(o || {}));
const keySafe = (v) => String(v).replace(/[.#$\[\]\/\s]/g, '_');

function sectionOf(key) { return THEME_SECTIONS.find(s => s.key === key); }

export const ThemesSection = {
  competitionsCache: [],
  customCache: [],
  draft: null,        // tema in modifica (non salvato)
  dirty: false,
  themeId: '',
  section: BASE_KEY,
  openEl: '',

  init(databaseInstance) {
    database = databaseInstance;
    this.registerGlobalActions();
    window.addEventListener('message', (e) => this.onPreviewMessage(e));
  },

  renderHTML() {
    const chips = [
      `<button type="button" class="th-chip on" data-th-sec="${BASE_KEY}"><i class="ri-palette-line"></i> Colori di base</button>`,
      ...SECTION_GROUPS.map(g => `
        <div class="th-chip-group">${g}</div>
        ${THEME_SECTIONS.filter(s => s.group === g).map(s =>
          `<button type="button" class="th-chip" data-th-sec="${s.key}"><i class="${s.icon}"></i> ${s.label}</button>`).join('')}`)
    ].join('');
    return `
    <div id="sec-themes" class="admin-sec" style="display:none">
      <style>
        .th-layout { display: grid; grid-template-columns: minmax(0, 1fr) 400px; gap: 1.2rem; align-items: start; }
        .th-preview { position: sticky; top: 1rem; }
        .th-team { max-width: 375px; margin: 0 auto .6rem; }
        .th-team .input-login, .th-team .cs-btn { margin-bottom: 0 !important; }
        .th-phone { width: 375px; height: 740px; max-width: 100%; border: 10px solid #0b0d12; border-radius: 34px; overflow: hidden; background: #000; box-shadow: 0 12px 40px rgba(0,0,0,.45); margin: 0 auto; }
        .th-phone iframe { width: 100%; height: 100%; border: 0; display: block; background: var(--bg); }
        @media (max-width: 1100px) {
          .th-layout { grid-template-columns: minmax(0, 1fr) 320px; }
          .th-phone { width: 300px; height: 620px; }
        }
        /* l'anteprima c'è solo su PC */
        @media (max-width: 991px) {
          .th-layout { grid-template-columns: 1fr; }
          .th-preview { display: none; }
        }
        .th-chips { display: flex; flex-wrap: wrap; gap: .35rem; margin-bottom: 1rem; align-items: center; }
        .th-chip-group { width: 100%; font-size: .68rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text3); margin-top: .4rem; }
        .th-chip { background: var(--bg3); color: var(--text2); border: 1px solid var(--border); border-radius: 999px; padding: .35rem .7rem; font-size: .78rem; cursor: pointer; display: inline-flex; gap: .3rem; align-items: center; font-family: inherit; }
        .th-chip.on { background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--accent); border-color: var(--accent); }
        .th-chip .th-count { background: var(--accent); color: #0a0f1e; border-radius: 999px; font-size: .62rem; padding: 0 .35rem; font-weight: 700; }
        .th-el { border: 1px solid var(--border); border-radius: 12px; margin-bottom: .45rem; background: var(--bg2); }
        .th-el.open { border-color: var(--accent); }
        .th-el-head { display: flex; align-items: center; gap: .6rem; padding: .6rem .75rem; cursor: pointer; }
        .th-el-name { font-weight: 600; font-size: .88rem; color: var(--text); }
        .th-el-hint { font-size: .72rem; color: var(--text3); margin-top: 1px; }
        .th-el-main { flex: 1; min-width: 0; }
        .th-el-sw { display: flex; gap: 3px; flex-shrink: 0; }
        .th-el-sw span { width: 14px; height: 14px; border-radius: 4px; border: 1px solid rgba(255,255,255,.25); }
        .th-el-mod { font-size: .62rem; font-weight: 700; color: var(--accent); border: 1px solid var(--accent); border-radius: 4px; padding: 0 .3rem; flex-shrink: 0; }
        .th-el-body { display: none; padding: .2rem .75rem .8rem; }
        .th-el.open .th-el-body { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: .6rem .8rem; }
        .th-prop label { display: block; font-size: .7rem; text-transform: uppercase; letter-spacing: .5px; color: var(--text2); margin-bottom: .2rem; }
        .th-prop .row { display: flex; gap: .35rem; align-items: center; }
        .th-prop input[type=color] { width: 40px; height: 36px; padding: 0; border: 1px solid var(--border); border-radius: 8px; background: none; cursor: pointer; flex-shrink: 0; }
        .th-prop input[type=text], .th-prop input[type=number] { flex: 1; min-width: 0; height: 36px; background: var(--bg3); border: 1px solid var(--border); border-radius: 8px; color: var(--text); padding: 0 .55rem; font-family: inherit; font-size: .85rem; }
        .th-prop select { margin: 0 !important; }
        .th-prop .cs-btn { min-height: 36px !important; margin: 0 !important; }
        .th-x { width: 30px; height: 36px; border: none; background: transparent; color: var(--text3); cursor: pointer; font-size: 1rem; flex-shrink: 0; }
        .th-x:hover { color: var(--accent3); }
        .th-base-group { font-size: .75rem; color: var(--accent); text-transform: uppercase; letter-spacing: .5px; margin: 1rem 0 .5rem; font-weight: 600; }
        .th-tools { display: flex; gap: .5rem; flex-wrap: wrap; align-items: center; margin: .6rem 0; justify-content: center; }
        .th-tools .btn { width: auto; padding: .4rem .75rem; font-size: .78rem; }
        .th-pick-on { background: #ff3d7f !important; color: #fff !important; }
        .th-note { font-size: .75rem; color: var(--text3); line-height: 1.45; }
        .th-warn { font-size: .78rem; color: var(--gold); border: 1px solid color-mix(in srgb, var(--gold) 45%, transparent); border-radius: 10px; padding: .6rem .75rem; margin-bottom: .8rem; }
        .th-comp { display: flex; align-items: center; gap: .6rem; padding: .45rem 0; border-bottom: 1px solid var(--border); font-size: .85rem; }
        .th-comp:last-child { border-bottom: none; }
        .th-comp img { width: 26px; height: 26px; object-fit: contain; }
        .th-comp .sub { font-size: .72rem; color: var(--text3); }
        .th-savebar { position: sticky; bottom: 0; background: var(--card); padding: .8rem 0 .2rem; display: flex; gap: .6rem; z-index: 5; }
      </style>

      <div class="sec-title"><i class="ri-palette-line"></i> Gestione Temi & Personalizzazione</div>

      <div style="display: flex; gap: .5rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: .8rem;">
        <button id="tab-btn-theme-competizioni" class="btn btn-blue" onclick="window.switchThemeSubTab('competizioni')" style="padding: .4rem .8rem; font-size: .85rem; width: auto;">
          <i class="ri-palette-line"></i> Temi
        </button>
        <button id="tab-btn-theme-squadre" class="btn" onclick="window.switchThemeSubTab('squadre')" style="padding: .4rem .8rem; font-size: .85rem; width: auto; background: var(--bg3); color: var(--text2); font-family: var(--font-sub, inherit);">
          <i class="ri-shirt-line"></i> Squadre
        </button>
      </div>

      <div id="subtab-theme-competizioni" style="display: block;">
        <div class="card" style="max-width: 760px; margin-bottom: 1.2rem;">
          <label class="label">Tema da modificare</label>
          <select id="themeCompSelect" class="input-login" data-title="Tema da modificare" onchange="window.onThemeCompChange(this.value)">
            <option value="">-- Seleziona un tema --</option>
          </select>
          <div style="display: flex; gap: .5rem; flex-wrap: wrap; margin-top: .3rem;">
            <button type="button" class="btn btn-blue" onclick="window.nuovoTemaAggiuntivo()" style="width: auto; padding: .4rem .8rem; font-size: .8rem;"><i class="ri-add-line"></i> Nuovo tema</button>
            <button type="button" id="btn-dup-theme" class="btn" onclick="window.duplicaTema()" style="width: auto; padding: .4rem .8rem; font-size: .8rem; background: var(--bg3); color: var(--text2); display: none;"><i class="ri-file-copy-line"></i> Duplica</button>
            <button type="button" id="btn-ren-theme" class="btn" onclick="window.rinominaTemaAggiuntivo()" style="width: auto; padding: .4rem .8rem; font-size: .8rem; background: var(--bg3); color: var(--text2); display: none;"><i class="ri-edit-line"></i> Rinomina</button>
            <button type="button" id="btn-del-theme" class="btn btn-red" onclick="window.eliminaTemaAggiuntivo()" style="width: auto; padding: .4rem .8rem; font-size: .8rem; display: none;"><i class="ri-delete-bin-line"></i> Elimina</button>
          </div>
          <div class="th-note" style="margin-top: .6rem;">
            Tutti i temi sono indipendenti dalle competizioni: ogni competizione usa il tema che le assegni qui sotto,
            e gli utenti possono sceglierne un altro in Impostazioni → Tema.
          </div>
        </div>

        <div id="themeBody" style="display: none;">
          <div class="card" style="max-width: 760px; margin-bottom: 1.2rem;">
            <div class="label" style="color: var(--accent); margin-bottom: .6rem; font-size: .85rem;">Competizioni che usano questo tema</div>
            <div id="themeComps"></div>
          </div>

          <div class="card" style="max-width: 760px; margin-bottom: 1.2rem;">
            <div class="label" style="color: var(--accent); margin-bottom: .6rem; font-size: .85rem;">Sfondo</div>
            <div id="themeBgPreview" style="width: 100%; height: 140px; border-radius: 8px; border: 1px solid var(--border); background-size: cover; background-position: center; background-repeat: no-repeat; background-color: var(--bg3); display: flex; align-items: center; justify-content: center; color: var(--text3); font-size: .85rem;">Nessuno sfondo</div>
            <button id="btn-remove-theme-bg" class="btn btn-red" onclick="window.rimuoviSfondoCompetizione()" style="margin-top: .5rem; padding: .3rem .6rem; font-size: .75rem; width: auto; display: none;"><i class="ri-delete-bin-line"></i> Rimuovi sfondo</button>
            <div class="label" style="font-size:.8rem; margin-top: 1rem; color:var(--text2);">Nuova immagine di sfondo (.jpg, .jpeg, .png)</div>
            <input type="file" id="themeBgFile" class="input-login" accept=".jpg, .jpeg, .png, .JPG, .JPEG, .PNG, image/jpeg, image/png" style="padding-top:.5rem;">
            <button id="btn-save-theme-bg" class="btn btn-green" onclick="window.salvaSfondoCompetizione()" style="margin-top: .6rem;"><i class="ri-image-line"></i> Salva sfondo</button>
          </div>

          <div class="th-layout">
            <div class="card" style="min-width: 0;">
              <div class="label" style="color: var(--accent); margin-bottom: .4rem; font-size: .85rem;">Personalizza</div>
              <div class="th-note" style="margin-bottom: .8rem;">
                Scegli la pagina, poi l'elemento: ognuno ha il suo nome (es. Home → Nome squadra, Pannello logo squadra)
                e puoi cambiarne colore, font, dimensione, sfondo e bordo. Quello che lasci vuoto resta com'è.
                Su PC puoi anche toccare un elemento nell'anteprima per aprirlo qui.
              </div>
              <div id="themeLegacy"></div>
              <div class="th-chips" id="themeChips">${chips}</div>
              <div id="themeSectionHead"></div>
              <div id="themeEditor"></div>
              <div class="th-savebar">
                <button id="btn-save-theme-colors" class="btn btn-green" onclick="window.salvaPaletteColori()" style="flex: 1;"><i class="ri-save-line"></i> Salva tema</button>
                <button class="btn" onclick="window.annullaModificheTema()" style="width: auto; background: var(--bg3); color: var(--text2);"><i class="ri-arrow-go-back-line"></i> Annulla modifiche</button>
                <button class="btn btn-red" onclick="window.resetPaletteColori()" style="width: auto;"><i class="ri-delete-bin-line"></i> Azzera</button>
              </div>
            </div>

            <div class="th-preview">
              <div class="th-team">
                <label class="label" for="th-team">Squadra mostrata nell'anteprima</label>
                <select id="th-team" class="input-login" data-title="Squadra dell'anteprima"></select>
              </div>
              <div class="th-phone"><iframe id="themePreviewFrame" title="Anteprima dell'app" loading="lazy"></iframe></div>
              <div class="th-tools">
                <button type="button" id="th-pick" class="btn" onclick="window.themePickToggle()" style="background: var(--bg3); color: var(--text2);"><i class="ri-cursor-line"></i> Tocca un elemento</button>
                <button type="button" class="btn" onclick="window.themePreviewReload()" style="background: var(--bg3); color: var(--text2);"><i class="ri-refresh-line"></i> Ricarica</button>
              </div>
              <div class="th-note" id="th-preview-note" style="text-align: center;">
                Anteprima con le modifiche non ancora salvate.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="subtab-theme-squadre" style="display: none;">
        ${DiviseSection.renderHTML()}
      </div>
    </div>`;
  },

  /* ─────────────────────────── dati ─────────────────────────── */

  render(globalState) {
    this.competitionsCache = globalState.competitions || [];
    this.customCache = globalState.customThemes || [];
    const before = document.getElementById('th-team')?.value;
    const team = fillPreviewTeams(document.getElementById('th-team'), globalState.TEAMS);
    if (team && team !== before) this.post({ type: 'fc-team', id: team });
    this.migrateLegacy();

    const select = document.getElementById('themeCompSelect');
    if (!select) return;
    let want = this._pendingSelect && this.themeById(this._pendingSelect) ? this._pendingSelect : select.value;
    if (this._pendingSelect && want === this._pendingSelect) this._pendingSelect = null;
    this.fillSelect(want);

    const t = this.themeById(select.value);
    const sig = JSON.stringify(t ? [t.theme, t.backgroundImage] : null);
    // il tema scelto è cambiato nel DB: si ricarica solo se non ci sono modifiche non salvate
    if (select.value !== this.themeId) window.onThemeCompChange(select.value);
    else if (sig !== this._sig && !this.dirty) this.load(select.value);
    this.renderComps();
  },

  themeById(id) { return id ? this.customCache.find(t => t.id === id) : null; },

  usersOf(id) { return this.competitionsCache.filter(c => String(c.themeId || '') === String(id)); },

  /**
   * Formato vecchio: tema e sfondo dentro competitions/{id}. Si spostano in themes/c_<id> e la
   * competizione ci punta con themeId (una volta sola, con un unico aggiornamento).
   */
  async migrateLegacy() {
    if (this._migrating || !database) return;
    this._migrated = this._migrated || new Set(); // già spostate, in attesa della conferma del DB
    const legacy = this.competitionsCache.filter(c => !c.themeId && !this._migrated.has(c.id) &&
      ((c.theme && typeof c.theme === 'object') || (typeof c.backgroundImage === 'string' && c.backgroundImage.trim())));
    if (!legacy.length) return;
    this._migrating = true;
    const updates = {};
    const taken = new Set(this.customCache.map(t => t.id));
    legacy.forEach(c => {
      this._migrated.add(c.id);
      let id = 'c_' + keySafe(c.id), n = 2;
      while (taken.has(id)) id = `c_${keySafe(c.id)}_${n++}`;
      taken.add(id);
      updates[`themes/${id}`] = {
        name: c.name || c.id, createdAt: Date.now(),
        theme: c.theme || null, backgroundImage: (c.backgroundImage || '').trim()
      };
      updates[`competitions/${c.id}/themeId`] = id;
      updates[`competitions/${c.id}/theme`] = null;
      updates[`competitions/${c.id}/backgroundImage`] = null;
    });
    try {
      await update(ref(database), updates);
      window.toast(`Temi di ${legacy.length} competizion${legacy.length === 1 ? 'e spostato' : 'i spostati'} tra i temi`, 'ok');
    } catch (err) {
      legacy.forEach(c => this._migrated.delete(c.id));
      console.error('Errore spostamento temi:', err);
      window.toast('Non è stato possibile spostare i temi delle competizioni', 'err');
    } finally {
      this._migrating = false;
    }
  },

  fillSelect(value) {
    const select = document.getElementById('themeCompSelect');
    if (!select) return;
    const themes = [...this.customCache].sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id), 'it'));
    const html = `<option value="">-- Seleziona un tema --</option>` + themes.map(t => {
      const used = this.usersOf(t.id).map(c => c.name || c.id);
      return `<option value="${esc(t.id)}" data-icon="ri-palette-line" data-sub="${esc(used.length ? 'Usato da: ' + used.join(', ') : 'Non usato da nessuna competizione')}">${esc(t.name || t.id)}</option>`;
    }).join('');
    if (select.dataset.sig !== html) {
      select.dataset.sig = html;
      select.innerHTML = html;
    }
    select.value = this.themeById(value) ? value : '';
  },

  renderComps() {
    const box = document.getElementById('themeComps');
    if (!box) return;
    const id = this.themeId;
    if (!id) { box.innerHTML = ''; return; }
    if (!this.competitionsCache.length) { box.innerHTML = '<div class="th-note">Nessuna competizione.</div>'; return; }
    const html = this.competitionsCache.map(c => {
      const other = c.themeId && c.themeId !== id ? this.themeById(c.themeId) : null;
      return `
        <label class="th-comp">
          <input type="checkbox" data-th-comp="${esc(c.id)}" ${String(c.themeId || '') === id ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--accent);">
          ${c.logo ? `<img src="${esc(c.logo)}" alt="">` : '<i class="ri-trophy-line" style="color: var(--gold);"></i>'}
          <span style="flex: 1; min-width: 0;">${esc(c.name || c.id)}
            <div class="sub">${other ? `Ora usa: ${esc(other.name || other.id)}` : (c.themeId ? 'Usa questo tema' : 'Tema predefinito')}</div></span>
        </label>`;
    }).join('');
    if (box.dataset.sig !== html) { box.dataset.sig = html; box.innerHTML = html; }
  },

  /** Carica il tema scelto nell'editor (scarta le modifiche non salvate). */
  load(id) {
    const t = this.themeById(id);
    this.themeId = t ? id : '';
    this._sig = JSON.stringify(t ? [t.theme, t.backgroundImage] : null);
    this.draft = t ? (clone(normalizeTheme(t.theme)) || {}) : null;
    if (this.draft) {
      this.draft.v = THEME_VERSION;
      this.draft.general = this.draft.general || {};
      this.draft.el = this.draft.el || {};
    }
    this.dirty = false;

    const body = document.getElementById('themeBody');
    if (body) body.style.display = t ? 'block' : 'none';
    const show = (bid, on) => { const b = document.getElementById(bid); if (b) b.style.display = on ? 'inline-flex' : 'none'; };
    show('btn-dup-theme', !!t); show('btn-ren-theme', !!t); show('btn-del-theme', !!t);
    if (!t) return;

    const bgPreview = document.getElementById('themeBgPreview');
    const btnRemove = document.getElementById('btn-remove-theme-bg');
    if (t.backgroundImage) {
      bgPreview.style.backgroundImage = `url('${t.backgroundImage}')`;
      bgPreview.textContent = '';
      btnRemove.style.display = 'inline-flex';
    } else {
      bgPreview.style.backgroundImage = 'none';
      bgPreview.textContent = 'Nessuno sfondo';
      btnRemove.style.display = 'none';
    }
    this.renderComps();
    this.renderEditor();
    this.ensurePreview();
    this.pushPreview();
  },

  /* ─────────────────────────── editor ─────────────────────────── */

  renderEditor() {
    const ed = document.getElementById('themeEditor');
    const head = document.getElementById('themeSectionHead');
    if (!ed || !this.draft) return;

    // pagine con modifiche: contatore sui pulsanti
    document.querySelectorAll('#themeChips [data-th-sec]').forEach(b => {
      const k = b.dataset.thSec;
      b.classList.toggle('on', k === this.section);
      const n = k === BASE_KEY ? Object.keys(this.draft.general || {}).length : Object.keys((this.draft.el || {})[k] || {}).length;
      let c = b.querySelector('.th-count');
      if (n && !c) { c = document.createElement('span'); c.className = 'th-count'; b.appendChild(c); }
      if (c) { if (n) c.textContent = n; else c.remove(); }
    });

    const legacy = document.getElementById('themeLegacy');
    const old = legacyPageKeys(this.draft);
    legacy.innerHTML = old.length ? `
      <div class="th-warn"><i class="ri-information-line"></i> Questo tema ha ancora impostazioni del vecchio editor per tipo di testo
        (${old.map(k => esc((THEME_PAGES.find(p => p.key === k) || {}).label || k)).join(', ')}): si applicano ancora sotto quelle nuove.
        <button type="button" class="btn" onclick="window.rimuoviVecchioTema()" style="width: auto; padding: .25rem .6rem; font-size: .72rem; margin-left: .4rem; background: var(--bg3); color: var(--text2);">Rimuovile</button>
      </div>` : '';

    if (this.section === BASE_KEY) {
      head.innerHTML = `<div class="th-note" style="margin-bottom: .6rem;">Colori e font di partenza di tutta l'app: ogni elemento li usa finché non gli dai un valore suo.</div>`;
      ed.innerHTML = this.baseHTML();
      return;
    }
    const sec = sectionOf(this.section);
    head.innerHTML = sec.desc ? `<div class="th-note" style="margin-bottom: .6rem;">${esc(sec.desc)}</div>` : '';
    const vals = (this.draft.el || {})[sec.key] || {};
    ed.innerHTML = sec.elements.map(e => this.elementHTML(sec, e, vals[e.key] || {})).join('');
  },

  baseHTML() {
    const g = this.draft.general || {};
    const groups = [];
    BASE.fields.forEach(f => {
      let grp = groups.find(x => x.name === f.group);
      if (!grp) groups.push(grp = { name: f.group, fields: [] });
      grp.fields.push(f);
    });
    // nomi chiari per i "tipi base"
    const NAMES = { title: 'Titoli', text: 'Testo principale', sub: 'Testo secondario', text3: 'Testo disattivato', label: 'Etichette dei campi', btn: 'Pulsante principale · sfondo', btnText: 'Pulsante principale · testo' };
    return groups.map(grp => `
      <div class="th-base-group">${grp.name === 'Tipi base' ? 'Testi e pulsanti' : esc(grp.name)}</div>
      <div class="th-el open"><div class="th-el-body">
        ${grp.fields.map(f => `
          <div class="th-prop">
            <label title="${esc(f.hint || '')}">${esc(NAMES[f.key] || f.label || f.hint)}</label>
            ${this.colorControl(`base|${f.key}`, g[f.key], f.def, f.kind === 'text')}
            ${f.font ? `<div style="margin-top: .3rem;">${this.fontControl(`base|${f.font.key}`, g[f.font.key], f.font.defLabel)}</div>` : ''}
          </div>`).join('')}
      </div></div>`).join('');
  },

  elementHTML(sec, e, v) {
    const props = propsOf(e);
    const set = props.filter(p => v[p] !== undefined && v[p] !== '');
    const sw = ['bg', 'color', 'border'].filter(p => v[p]).map(p => `<span title="${PROPS[p].label}" style="background: ${esc(v[p])};"></span>`).join('');
    const id = `${sec.key}|${e.key}`;
    return `
      <div class="th-el ${this.openEl === id ? 'open' : ''}" data-th-el="${esc(id)}">
        <div class="th-el-head" data-th-toggle="${esc(id)}">
          <div class="th-el-main">
            <div class="th-el-name">${esc(e.label)}</div>
            ${e.hint ? `<div class="th-el-hint">${esc(e.hint)}</div>` : ''}
          </div>
          <div class="th-el-sw">${sw}</div>
          ${set.length ? `<span class="th-el-mod">${set.length}</span>` : ''}
          <i class="ri-arrow-down-s-line" style="color: var(--text3);"></i>
        </div>
        <div class="th-el-body">
          ${props.map(p => `
            <div class="th-prop">
              <label>${PROPS[p].label}</label>
              ${this.propControl(`el|${sec.key}|${e.key}|${p}`, p, v[p])}
            </div>`).join('')}
          ${set.length ? `<div class="th-prop" style="align-self: end;"><button type="button" class="btn" data-th-clear="${esc(id)}" style="width: auto; padding: .4rem .7rem; font-size: .75rem; background: var(--bg3); color: var(--text2);"><i class="ri-eraser-line"></i> Togli le modifiche</button></div>` : ''}
        </div>
      </div>`;
  },

  propControl(path, p, val) {
    const def = PROPS[p];
    if (def.type === 'color') return this.colorControl(path, val, p === 'color' ? '#ffffff' : '#282e37', true);
    if (def.type === 'font') return this.fontControl(path, val, 'come adesso');
    if (def.type === 'weight') return `
      <select data-th-path="${esc(path)}" class="input-login" data-title="Spessore" data-search="off">
        <option value="" ${!val ? 'selected' : ''}>Come adesso</option>
        <option value="normal" ${val === 'normal' ? 'selected' : ''}>Normale</option>
        <option value="bold" ${val === 'bold' ? 'selected' : ''}>Grassetto</option>
      </select>`;
    return `<div class="row">
        <input type="number" data-th-path="${esc(path)}" min="${def.min}" max="${def.max}" step="1" value="${val ?? ''}" placeholder="come adesso">
        <span class="th-note">px</span>
        <button type="button" class="th-x" data-th-x="${esc(path)}" title="Togli" aria-label="Togli"><i class="ri-close-line"></i></button>
      </div>`;
  },

  colorControl(path, val, def, free) {
    return `<div class="row">
        <input type="color" data-th-color="${esc(path)}" value="${isHex(val) ? val : def}">
        <input type="text" data-th-path="${esc(path)}" value="${esc(val || '')}" placeholder="${free ? 'come adesso (anche rgba)' : 'come adesso'}">
        <button type="button" class="th-x" data-th-x="${esc(path)}" title="Togli" aria-label="Togli"><i class="ri-close-line"></i></button>
      </div>`;
  },

  fontControl(path, val, defLabel) {
    return `<select data-th-path="${esc(path)}" class="input-login" data-title="Font" data-search="off">
        <option value="">Font ${esc(defLabel ? `(${defLabel})` : 'come adesso')}</option>
        ${THEME_FONTS.filter(f => f.css).map(f => `<option value="${f.key}" ${val === f.key ? 'selected' : ''}>${esc(f.label)}</option>`).join('')}
      </select>`;
  },

  /** Scrive un valore nel tema in modifica. path = "base|chiave" oppure "el|sezione|elemento|proprietà" */
  setValue(path, raw) {
    const parts = path.split('|');
    const val = String(raw ?? '').trim();
    if (parts[0] === 'base') {
      if (val) this.draft.general[parts[1]] = val; else delete this.draft.general[parts[1]];
    } else {
      const [, sec, el, p] = parts;
      const secObj = this.draft.el[sec] = this.draft.el[sec] || {};
      const elObj = secObj[el] = secObj[el] || {};
      if (val) elObj[p] = (PROPS[p].type === 'px') ? Number(val) : val;
      else delete elObj[p];
      if (!Object.keys(elObj).length) delete secObj[el];
      if (!Object.keys(secObj).length) delete this.draft.el[sec];
    }
    this.dirty = true;
    this.pushPreviewSoon();
  },

  /** Aggiorna intestazione e contatori dell'elemento senza ridisegnare i campi (il focus resta). */
  refreshElementHead(path) {
    const parts = path.split('|');
    if (parts[0] !== 'el') return this.renderChipsOnly();
    const sec = sectionOf(parts[1]);
    const e = sec && sec.elements.find(x => x.key === parts[2]);
    const box = document.querySelector(`[data-th-el="${CSS.escape(parts[1] + '|' + parts[2])}"]`);
    if (!e || !box) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = this.elementHTML(sec, e, ((this.draft.el || {})[sec.key] || {})[e.key] || {});
    box.querySelector('.th-el-head').replaceWith(tmp.querySelector('.th-el-head'));
    this.renderChipsOnly();
  },

  renderChipsOnly() {
    document.querySelectorAll('#themeChips [data-th-sec]').forEach(b => {
      const k = b.dataset.thSec;
      const n = k === BASE_KEY ? Object.keys(this.draft.general || {}).length : Object.keys((this.draft.el || {})[k] || {}).length;
      let c = b.querySelector('.th-count');
      if (n && !c) { c = document.createElement('span'); c.className = 'th-count'; b.appendChild(c); }
      if (c) { if (n) c.textContent = n; else c.remove(); }
    });
  },

  /* ─────────────────────────── anteprima ─────────────────────────── */

  frame() { return document.getElementById('themePreviewFrame'); },

  ensurePreview() {
    const f = this.frame();
    if (f && !f.getAttribute('src') && window.matchMedia('(min-width: 992px)').matches) f.src = 'index.html?themePreview=1';
  },

  post(msg) {
    const f = this.frame();
    if (f && f.contentWindow) f.contentWindow.postMessage(msg, location.origin);
  },

  pushPreviewSoon() {
    clearTimeout(this._pt);
    this._pt = setTimeout(() => this.pushPreview(), 120);
  },

  pushPreview() {
    if (!this.draft) return;
    const t = this.themeById(this.themeId);
    this.post({ type: 'fc-theme', css: buildThemeCss(this.draft), bg: (t && t.backgroundImage) || '' });
  },

  goPreview() {
    const sec = sectionOf(this.section);
    this.post({ type: 'fc-go', go: sec ? sec.go : 'page:home' });
    this.highlightOpen();
  },

  highlightOpen() {
    const [s, k] = (this.openEl || '').split('|');
    const sec = sectionOf(s);
    const e = sec && sec.elements.find(x => x.key === k);
    // la pagina appena aperta deve prima disegnarsi
    setTimeout(() => this.post({ type: 'fc-hl', sel: e ? (e.vscope ? e.sel : e.sel) : '' }), 350);
  },

  onPreviewMessage(e) {
    if (e.origin !== location.origin || !this.frame() || e.source !== this.frame().contentWindow) return;
    const m = e.data || {};
    if (m.type === 'fc-ready' || m.type === 'fc-booted') {
      const team = document.getElementById('th-team')?.value;
      if (m.type === 'fc-ready' && team) this.post({ type: 'fc-team', id: team });
      this.pushPreview();
      if (m.type === 'fc-booted') this.goPreview();
    } else if (m.type === 'fc-picked') {
      if (!m.section) return window.toast('Questo punto non ha un elemento modificabile: prova a toccare un testo o un riquadro', 'info');
      this.section = m.section;
      this.openEl = `${m.section}|${m.key}`;
      this.renderEditor();
      this.highlightOpen();
      const box = document.querySelector(`[data-th-el="${CSS.escape(this.openEl)}"]`);
      if (box) box.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  },

  /* ─────────────────────────── azioni ─────────────────────────── */

  registerGlobalActions() {
    // campi dell'editor (delegati: il markup si ridisegna)
    document.addEventListener('input', (e) => {
      const t = e.target;
      if (!t || !t.closest || !t.closest('#sec-themes') || !this.draft) return;
      if (t.dataset.thColor) {
        const txt = document.querySelector(`[data-th-path="${CSS.escape(t.dataset.thColor)}"]`);
        if (txt) txt.value = t.value;
        this.setValue(t.dataset.thColor, t.value);
        this.refreshElementHead(t.dataset.thColor);
      } else if (t.dataset.thPath && t.tagName !== 'SELECT') {
        const col = document.querySelector(`[data-th-color="${CSS.escape(t.dataset.thPath)}"]`);
        if (col && isHex(t.value.trim())) col.value = t.value.trim();
        this.setValue(t.dataset.thPath, t.value);
        this.refreshElementHead(t.dataset.thPath);
      }
    });
    document.addEventListener('change', (e) => {
      const t = e.target;
      if (t && t.tagName === 'SELECT' && t.dataset.thPath && this.draft) {
        this.setValue(t.dataset.thPath, t.value);
        this.refreshElementHead(t.dataset.thPath);
      }
      if (t && t.id === 'th-team' && t.value) {
        this.post({ type: 'fc-team', id: t.value });
        setTimeout(() => this.highlightOpen(), 300);
      }
      const comp = t && t.dataset && t.dataset.thComp;
      if (comp) this.assignComp(comp, t.checked);
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest || !e.target.closest('#sec-themes')) return;
      const chip = e.target.closest('[data-th-sec]');
      const tog = e.target.closest('[data-th-toggle]');
      const x = e.target.closest('[data-th-x]');
      const clr = e.target.closest('[data-th-clear]');
      if (chip) {
        this.section = chip.dataset.thSec;
        this.openEl = '';
        this.renderEditor();
        this.goPreview();
      } else if (tog) {
        const id = tog.dataset.thToggle;
        this.openEl = this.openEl === id ? '' : id;
        document.querySelectorAll('#themeEditor .th-el').forEach(el => el.classList.toggle('open', el.dataset.thEl === this.openEl));
        this.highlightOpen();
      } else if (x) {
        const path = x.dataset.thX;
        document.querySelectorAll(`[data-th-path="${CSS.escape(path)}"]`).forEach(i => { i.value = ''; });
        this.setValue(path, '');
        this.refreshElementHead(path);
      } else if (clr) {
        const [s, k] = clr.dataset.thClear.split('|');
        if (this.draft.el[s]) { delete this.draft.el[s][k]; if (!Object.keys(this.draft.el[s]).length) delete this.draft.el[s]; }
        this.dirty = true;
        this.renderEditor();
        this.pushPreview();
      }
    });

    window.themePickToggle = () => {
      this._picking = !this._picking;
      document.getElementById('th-pick')?.classList.toggle('th-pick-on', this._picking);
      this.post({ type: 'fc-pick', on: this._picking });
    };
    window.themePreviewReload = () => {
      const f = this.frame();
      if (f) f.src = 'index.html?themePreview=1&r=' + Date.now();
      this._picking = false;
      document.getElementById('th-pick')?.classList.remove('th-pick-on');
    };

    window.rimuoviVecchioTema = () => {
      legacyPageKeys(this.draft).forEach(k => delete this.draft[k]);
      this.dirty = true;
      this.renderEditor();
      this.pushPreview();
      window.toast('Impostazioni vecchie tolte: salva il tema per confermare', 'info');
    };

    window.switchThemeSubTab = (tab) => {
      const on = tab === 'competizioni';
      document.getElementById('subtab-theme-competizioni').style.display = on ? 'block' : 'none';
      document.getElementById('subtab-theme-squadre').style.display = on ? 'none' : 'block';
      const style = (b, active) => { b.className = active ? 'btn btn-blue' : 'btn'; b.style.background = active ? '' : 'var(--bg3)'; b.style.color = active ? '' : 'var(--text2)'; };
      style(document.getElementById('tab-btn-theme-competizioni'), on);
      style(document.getElementById('tab-btn-theme-squadre'), !on);
    };

    window.onThemeCompChange = (value) => {
      if (this.dirty && value !== this.themeId && !confirm('Ci sono modifiche non salvate al tema: vuoi lasciarle?')) {
        this.fillSelect(this.themeId);
        return;
      }
      this.load(value);
      this.goPreview();
    };

    window.annullaModificheTema = () => { this.load(this.themeId); };

    window.salvaPaletteColori = async () => {
      const t = this.themeById(this.themeId);
      if (!t || !this.draft) return window.toast('Seleziona un tema!', 'err');
      const theme = clone(this.draft);
      if (!Object.keys(theme.general || {}).length) delete theme.general;
      if (!Object.keys(theme.el || {}).length) delete theme.el;
      const isEmpty = Object.keys(theme).filter(k => k !== 'v').length === 0;
      try {
        await update(ref(database, `themes/${t.id}`), { theme: isEmpty ? null : theme });
        t.theme = isEmpty ? null : theme;
        this._sig = JSON.stringify([t.theme, t.backgroundImage]);
        this.dirty = false;
        window.toast('Tema salvato!', 'ok');
      } catch (err) {
        console.error('Errore salvataggio tema:', err);
        window.toast('Errore durante il salvataggio del tema', 'err');
      }
    };

    window.resetPaletteColori = async () => {
      const t = this.themeById(this.themeId);
      if (!t || !confirm(`Azzerare tutte le personalizzazioni di "${t.name || t.id}"? Lo sfondo resta.`)) return;
      try {
        await update(ref(database, `themes/${t.id}`), { theme: null });
        t.theme = null;
        this.load(t.id);
        window.toast('Tema azzerato', 'info');
      } catch (err) {
        console.error('Errore reset tema:', err);
        window.toast('Errore durante l\'azzeramento', 'err');
      }
    };

    window.salvaSfondoCompetizione = async () => {
      const t = this.themeById(this.themeId);
      const input = document.getElementById('themeBgFile');
      if (!t) return window.toast('Seleziona un tema!', 'err');
      if (!input || !input.files || !input.files.length) return window.toast('Scegli un\'immagine di sfondo da caricare!', 'err');
      const btn = document.getElementById('btn-save-theme-bg');
      const label = btn.innerHTML;
      btn.innerHTML = '<i class="ri-loader-4-line"></i> Caricamento...';
      btn.disabled = true;
      try {
        const file = input.files[0];
        const type = file.type || 'image/jpeg';
        const url = await uploadBackgroundToImgBB(new File([file], `bg-${t.id}.${type.split('/')[1] || 'jpg'}`, { type }));
        if (!url) throw new Error('Impossibile caricare l\'immagine su ImgBB');
        await update(ref(database, `themes/${t.id}`), { backgroundImage: url });
        t.backgroundImage = url;
        input.value = '';
        const keepDraft = this.dirty ? clone(this.draft) : null;
        this.load(t.id);
        if (keepDraft) { this.draft = keepDraft; this.dirty = true; this.renderEditor(); this.pushPreview(); }
        window.toast('Sfondo aggiornato!', 'ok');
      } catch (err) {
        console.error('Errore salvataggio sfondo:', err);
        window.toast(err.message || 'Errore durante il caricamento dello sfondo', 'err');
      } finally {
        btn.innerHTML = label;
        btn.disabled = false;
      }
    };

    window.rimuoviSfondoCompetizione = async () => {
      const t = this.themeById(this.themeId);
      if (!t || !confirm(`Rimuovere lo sfondo di "${t.name || t.id}"?`)) return;
      try {
        await update(ref(database, `themes/${t.id}`), { backgroundImage: '' });
        t.backgroundImage = '';
        const keepDraft = this.dirty ? clone(this.draft) : null;
        this.load(t.id);
        if (keepDraft) { this.draft = keepDraft; this.dirty = true; this.renderEditor(); this.pushPreview(); }
        window.toast('Sfondo rimosso', 'info');
      } catch (err) {
        console.error('Errore rimozione sfondo:', err);
        window.toast('Errore durante la rimozione dello sfondo', 'err');
      }
    };

    // Nuovo tema: vuoto, oppure copia di quello scelto (Duplica)
    window.nuovoTemaAggiuntivo = async (fromId = null) => {
      const src = fromId ? this.themeById(fromId) : null;
      const name = (prompt(src ? 'Nome della copia' : 'Nome del nuovo tema', src ? `Copia di ${src.name || src.id}` : '') || '').trim();
      if (!name) return;
      const id = 't' + Date.now().toString(36);
      const data = { name, createdAt: Date.now() };
      if (src && src.theme) data.theme = src.id === this.themeId && this.draft ? clone(this.draft) : src.theme;
      if (src && src.backgroundImage) data.backgroundImage = src.backgroundImage;
      try {
        await set(ref(database, `themes/${id}`), data);
        if (!this.customCache.some(t => t.id === id)) this.customCache = [...this.customCache, { id, ...data }];
        this.dirty = false;
        this._pendingSelect = id;
        this.fillSelect(id);
        window.onThemeCompChange(id);
        window.toast(`Tema "${name}" creato: ora personalizzalo qui sotto`, 'ok');
      } catch (err) {
        console.error('Errore creazione tema:', err);
        window.toast('Errore durante la creazione del tema', 'err');
      }
    };

    window.duplicaTema = () => {
      if (!this.themeById(this.themeId)) return window.toast('Seleziona il tema da duplicare!', 'err');
      window.nuovoTemaAggiuntivo(this.themeId);
    };

    window.rinominaTemaAggiuntivo = async () => {
      const t = this.themeById(this.themeId);
      if (!t) return;
      const name = (prompt('Nuovo nome del tema', t.name || '') || '').trim();
      if (!name || name === t.name) return;
      try {
        await update(ref(database, `themes/${t.id}`), { name });
        t.name = name;
        this.fillSelect(t.id);
        window.toast('Tema rinominato', 'ok');
      } catch (err) {
        console.error('Errore rinomina tema:', err);
        window.toast('Errore durante la rinomina del tema', 'err');
      }
    };

    // Le competizioni che lo usavano tornano al tema predefinito; gli utenti che l'avevano scelto ad Automatico
    window.eliminaTemaAggiuntivo = async () => {
      const t = this.themeById(this.themeId);
      if (!t) return;
      const used = this.usersOf(t.id);
      const msg = used.length
        ? `Eliminare il tema "${t.name || t.id}"? Lo usano ${used.map(c => c.name || c.id).join(', ')}: torneranno al tema predefinito.`
        : `Eliminare il tema "${t.name || t.id}"? Chi lo ha scelto tornerà al tema automatico.`;
      if (!confirm(msg)) return;
      const updates = { [`themes/${t.id}`]: null };
      used.forEach(c => { updates[`competitions/${c.id}/themeId`] = null; });
      try {
        await update(ref(database), updates);
        this.customCache = this.customCache.filter(x => x.id !== t.id);
        this.dirty = false;
        this.fillSelect('');
        this.load('');
        window.toast('Tema eliminato', 'info');
      } catch (err) {
        console.error('Errore eliminazione tema:', err);
        window.toast('Errore durante l\'eliminazione del tema', 'err');
      }
    };
  },

  async assignComp(compId, on) {
    const c = this.competitionsCache.find(x => String(x.id) === String(compId));
    if (!c || !this.themeId) return;
    try {
      await update(ref(database, `competitions/${c.id}`), { themeId: on ? this.themeId : null });
      c.themeId = on ? this.themeId : null;
      this.fillSelect(this.themeId);
      this.renderComps();
      window.toast(on ? `${c.name || c.id} ora usa questo tema` : `${c.name || c.id} torna al tema predefinito`, 'ok');
    } catch (err) {
      console.error('Errore assegnazione tema:', err);
      window.toast('Errore durante l\'assegnazione del tema', 'err');
    }
  }
};
