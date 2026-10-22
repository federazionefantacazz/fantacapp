import { db, ref, update } from '../firebase-config.js';
import { uploadPngToImgBB } from '../services/integrationImgBB.js';
import { dataUrlToBlob } from '../components/Kit3D.js';
import {
  createStadiumViewer, renderStadiumImage, stadiumCapacity, shownCapacity, normalizeStadium, defaultStadium, applyPreset,
  RINGS, SHAPES, CORNERS, MOWING, SEAT_MODES, ROOFS, LIGHTS, FACADES, PRESETS, MAX_NAME, MAX_CAPACITY,
  SEAT_SIDES, TEXT_SIDES, TEXT_FONTS, MOSAICS, OUTER_STYLES, TEXT_SIZES, TEXT_PLACES, ROOF_COVERS, ROOF_REACHES, WRAP_ROOFS, SHELL_PATTERNS, SCREENS, MAX_STAND_TEXT, MAX_OUTER_TEXT, gridKey, seatGridFrom,
  ringsBySide, maxRingsOf
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
    .kit-hint.std-hint { top: .4rem; bottom: auto; } /* in basso ci sono i pulsanti delle viste */
    .std-views { flex-wrap: wrap; justify-content: flex-end; }
    .std-cap { text-align: center; font-size: .75rem; color: var(--text2); font-family: var(--font-sub, inherit); margin-top: .35rem; }
    .std-cap b { color: var(--text); font-variant-numeric: tabular-nums; }
    .std-preset { width: 100%; text-align: left; background: var(--bg3); border: 2px solid transparent; border-radius: 12px; padding: .6rem .75rem;
      margin-bottom: .45rem; cursor: pointer; color: var(--text); font-family: inherit; }
    .std-preset b { display: block; font-size: .85rem; }
    .std-preset span { display: block; font-size: .72rem; color: var(--text2); font-family: var(--font-sub, inherit); margin-top: .15rem; line-height: 1.35; }
    .std-preset:active { border-color: var(--accent); }
    .std-grid { display: grid; grid-template-columns: minmax(0, 1fr) repeat(var(--rings), 46px); gap: .35rem .5rem; align-items: center; }
    .std-grid .hd { font-size: .62rem; font-weight: 700; color: var(--label, var(--text2)); text-align: center; text-transform: uppercase; }
    .std-grid .nm { font-size: .8rem; font-weight: 600; color: var(--text); }
    .std-grid .kit-color { width: 46px; }
    .std-sides { display: grid; grid-template-columns: minmax(0, 7.2rem) minmax(0, 1fr); gap: .45rem .5rem; align-items: center; margin-top: .35rem; }
    .std-sides .nm { font-size: .8rem; font-weight: 600; color: var(--text); }
    .std-sides .kit-chips { margin: 0; }
  `;
  document.head.appendChild(style);
}

/** Colori dei seggiolini richiesti da ogni modalità: [chiave, etichetta]. */
function seatFields(st) {
  switch (st.seatMode) {
    case 'sectors': return [['seatA', 'Tribune (lati lunghi)'], ['seatB', 'Curve']];
    case 'rings':   return [['seatA', 'Primo anello'], ['seatB', 'Secondo anello'], ['seatC', 'Terzo anello']].slice(0, maxRingsOf(st));
    case 'sides':   return [['seatA', 'Tribuna (lato vicino)'], ['seatC', 'Distinti (lato di fronte)'], ['seatD', 'Curva sinistra'], ['seatB', 'Curva destra']];
    default:        return [['seatA', 'Seggiolini']];
  }
}

const VIEWS = [['aerial', 'Aerea'], ['top', "Dall'alto"], ['stand', 'Tribuna'], ['outside', 'Esterno']];

export const StadioSquadra = {
  title: 'Stadio',
  _open: 'name',
  _busy: false,
  _night: false,

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
    this._open = 'name';
    this._night = false;
    this._renderAll();

    root.addEventListener('click', (e) => this._onClick(e));
    root.addEventListener('input', (e) => this._onInput(e));
    root.addEventListener('change', (e) => this._onChange(e));
    root.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.dataset && (e.target.dataset.hex || e.target.dataset.text || e.target.dataset.num)) e.target.blur(); });
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
      ['name',      'FASE 1: Nome e capienza'],
      ['styles',    'FASE 2: Stili rapidi'],
      ['structure', 'FASE 3: Anelli, curve e pista'],
      ['exterior',  'FASE 4: Copertura, fari ed esterno'],
      ['pitch',     'FASE 5: Campo'],
      ['seats',     'FASE 6: Colore dei seggiolini'],
      ['texts',     'FASE 7: Scritte'],
      ['walls',     'FASE 8: Parapetti e cemento']
    ];
    this._root.innerHTML = `
      <div class="kit-stage">
        <div class="kit-preview">
          <div class="kit-loading" id="std-loading">Costruzione dello stadio…</div>
          <div id="std-3d"></div>
          <div class="kit-hint std-hint"><i class="ri-drag-move-line"></i> Trascina per ruotare</div>
          <div class="kit-view-btns std-views">${VIEWS.map(([v, l]) => `<button data-act="view" data-v="${v}">${l}</button>`).join('')}<button data-act="night">${this._night ? 'Giorno' : 'Notte'}</button></div>
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
      if (this._night) this._viewer.setNight(true);
      this._viewer.ready.then(() => { const l = this._root && this._root.querySelector('#std-loading'); if (l) l.remove(); })
        .catch(e => { console.error(e); const l = this._root && this._root.querySelector('#std-loading'); if (l) l.textContent = 'Il 3D non è supportato su questo dispositivo'; });
    }
    if (this._viewer) this._viewer.update(this._st).catch(e => console.error('Stadio:', e));
    const cap = this._root.querySelector('#std-cap');
    if (cap) cap.innerHTML = `${this._st.name.trim() ? `<b>${esc(this._st.name.trim())}</b> · ` : ''}Capienza: <b>${fmt(shownCapacity(this._st))}</b> posti`;
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
    const fn = {
      styles: this._secStyles, structure: this._secStructure, exterior: this._secExterior, pitch: this._secPitch,
      seats: this._secSeats, texts: this._secTexts, walls: this._secWalls, name: this._secName
    }[key];
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
  _secStyles() {
    return `
      <div class="mp-muted" style="margin-bottom:.6rem;">Parti da uno stadio già pronto: poi puoi cambiare tutto nelle altre fasi. Il nome resta quello che hai scelto.</div>
      ${PRESETS.map(p => `<button class="std-preset" data-act="preset" data-v="${p.id}"><b>${esc(p.label)}</b><span>${esc(p.desc)}</span></button>`).join('')}`;
  },

  _secStructure() {
    const s = this._st;
    return `
      <div class="kit-sub">Anelli delle tribune (lati lunghi)</div>
      <div class="kit-chips">${RINGS.map(r => this._chip('rings', r.id, r.label, s.rings === r.id)).join('')}</div>
      <div class="kit-sub">Anelli delle curve</div>
      <div class="kit-chips">${this._chip('ringsEnds', 0, 'Come le tribune', !s.ringsEnds)}${RINGS.map(r => this._chip('ringsEnds', r.id, r.label, s.ringsEnds === r.id)).join('')}</div>
      <div class="mp-muted" style="margin-top:.3rem;">Con un numero diverso di anelli tribune e curve hanno altezze diverse: quella più alta sale sopra l'altra.</div>
      <div class="kit-sub">Anelli settore per settore</div>
      <div class="mp-muted">Per cambiare un solo settore (per esempio la tribuna principale più alta): "Auto" segue le scelte qui sopra.</div>
      <div class="std-sides">${SEAT_SIDES.filter(sd => !(s.horseshoe && sd.id === 3)).map(sd => {
        const auto = sd.id % 2 ? (s.ringsEnds || s.rings) : s.rings, cur = s.ringsSides[sd.id];
        return `<span class="nm">${esc(sd.label)}</span><div class="kit-chips">${[[0, `Auto (${auto})`], ...RINGS.map(r => [r.id, String(r.id)])]
          .map(([n, l]) => `<button class="lv-chip ${cur === n ? 'on' : ''}" data-act="ringsSide" data-side="${sd.id}" data-v="${n}">${esc(l)}</button>`).join('')}</div>`;
      }).join('')}</div>
      <div class="kit-sub">Pista d'atletica</div>
      <div class="kit-chips">${this._chip('track', '1', 'Sì', s.track)}${this._chip('track', '0', 'No', !s.track)}</div>
      ${s.track ? `${this._colorRow('Colore della pista', 'colors.track', s.colors.track)}${this._colorRow('Linee delle corsie', 'colors.trackLines', s.colors.trackLines)}
      <div class="kit-sub">Fondo intorno alla pista</div>
      <div class="kit-chips">${this._chip('trackApron', '0', 'Prato', !s.trackApron)}${this._chip('trackApron', '1', 'Colorato', s.trackApron)}</div>
      ${s.trackApron ? this._colorRow('Colore del fondo (anche ai lati del campo)', 'colors.apron', s.colors.apron) : ''}` : ''}
      <div class="mp-muted" style="margin-top:.3rem;">Con la pista gli spalti sono più lontani dal campo.</div>
      ${maxRingsOf(s) > 1 ? `<div class="kit-sub">Palchi vetrati tra gli anelli</div>
      <div class="kit-chips">${this._chip('boxes', '1', 'Sì', s.boxes)}${this._chip('boxes', '0', 'No', !s.boxes)}</div>` : ''}
      <div class="kit-sub">Forma delle curve</div>
      <div class="kit-chips">${SHAPES.map(o => this._chip('shape', o.id, o.label, s.shape === o.id)).join('')}</div>
      <div class="kit-sub">Curve e tribune</div>
      <div class="kit-chips">${CORNERS.map(o => this._chip('corners', o.id, o.label, s.corners === o.id)).join('')}</div>
      <div class="mp-muted" style="margin-top:.3rem;">${s.corners === 'open' ? 'Quattro settori separati, con gli angoli aperti.' : 'Un unico anello di spalti tutto intorno al campo.'}</div>
      <div class="kit-sub">Una curva aperta (ferro di cavallo)</div>
      <div class="kit-chips">${this._chip('horseshoe', '0', 'No', !s.horseshoe)}${this._chip('horseshoe', '1', 'Sì', s.horseshoe)}</div>
      <div class="mp-muted" style="margin-top:.3rem;">${s.horseshoe ? 'Al posto di una curva un piazzale con le sculture bianche; con lo schermo sulle curve, lì c\'è un maxischermo su pali.' : 'Spalti anche su tutte e due le curve.'}</div>`;
  },

  _secExterior() {
    const s = this._st;
    const roofLights = s.lights === 'roof' && s.roof === 'none';
    return `
      <div class="kit-sub">Copertura</div>
      <div class="kit-chips">${ROOFS.map(o => this._chip('roof', o.id, o.label, s.roof === o.id)).join('')}</div>
      <div class="mp-muted" style="margin-top:.3rem;">${{
        truss: 'Tetto in lamiera sopra l\'anello più alto, con tralicci sotto e piloni in acciaio fuori che reggono una trave tutto intorno.',
        membrane: 'Tetto chiaro e liscio, con le costole sotto.',
        girders: 'Tetto chiaro a botti con la struttura scura sotto, appeso a quattro grandi travi reticolari che poggiano su quattro torri agli angoli.',
        stands: 'Ogni tribuna ha il suo tetto piatto: sotto pannelli traslucidi e travi, davanti la fascia con le luci; dietro la tribuna di fronte due piloni con i tiranti. Gli angoli restano scoperti.',
        wave: 'Copertura bianca quasi tonda a cuscini radiali, alta sopra le curve e più bassa sui lati lunghi, con le travi d\'acciaio sotto. Fuori una fascia bianca che sulle curve scende quasi a terra; sui lati sotto la fascia si vedono i piani in cemento e al centro della tribuna vicina c\'è l\'ingresso principale con la vetrata a lamelle e gli schermi.',
        dome: 'Cupola bianca a raggiera che sale dal basso fino all\'apertura, con i denti a punta tutto attorno alla base.',
        tent: 'Membrana tesa da sei pennoni altissimi, con le punte sopra lo stadio. Di notte si illumina.',
        petals: 'Involucro a petali con le costole, diviso in quattro lobi da valli sulle diagonali. Di notte si illumina.',
        crown: 'Corona di vele bianche piegate a zig-zag: da fuori triangoli con la punta in giù sulle colonne inclinate e l\'anello bianco in cima; dentro le travi sotto le creste, la passerella ad anello e il bordo a denti verso il campo. Di notte le vele si illuminano.',
        dragon: 'Nastro di pannelli solari a scaglie retto da tubi bianchi a spirale che scendono fino a terra. Con una curva aperta (ferro di cavallo) il nastro esce dallo stadio e scende a terra come la coda di un drago.',
        shell: 'Un unico involucro a cuscini che avvolge lo stadio: si gonfia verso fuori, copre gli spalti e diventa trasparente verso il campo. Di notte si illumina.'
      }[s.roof] || 'Spalti scoperti.'}</div>
      ${s.roof !== 'none' ? `
      <div class="kit-sub">Dove mettere la copertura</div>
      ${WRAP_ROOFS.includes(s.roof) ? `<div class="mp-muted">Questa copertura avvolge tutto lo stadio.</div>` : `
      <div class="kit-chips">${ROOF_COVERS.map(o => this._chip('roofCover', o.id, o.label, s.roofCover === o.id)).join('')}</div>
      ${s.roofCover === 'pick' ? `
      <div class="kit-chips" style="margin-top:.45rem;">${SEAT_SIDES.map(sd => `<button class="lv-chip ${s.roofSectors[sd.id] ? 'on' : ''}" data-act="roofSide" data-v="${sd.id}">${esc(sd.label)}</button>`).join('')}</div>
      <div class="mp-muted" style="margin-top:.3rem;">${s.roofSectors.some(Boolean) ? 'Tocca i settori da coprire o scoprire: anche uno solo, come la tribuna del Camp Nou.' : 'Nessun settore scelto: tocca quelli da coprire.'}</div>` : ''}`}
      <div class="kit-sub">Quanto copre verso il campo</div>
      <div class="kit-chips">${ROOF_REACHES.map(o => this._chip('roofReach', o.id, o.label, s.roofReach === o.id)).join('')}</div>` : ''}
      ${s.roof === 'shell' ? `
      <div class="kit-sub">Disegno dell'involucro</div>
      <div class="kit-chips">${SHELL_PATTERNS.map(o => this._chip('shellPattern', o.id, o.label, s.shellPattern === o.id)).join('')}</div>` : ''}
      <div class="kit-sub">Fari</div>
      <div class="kit-chips">${LIGHTS.map(o => this._chip('lights', o.id, o.label, s.lights === o.id)).join('')}</div>
      ${roofLights ? `<div class="mp-muted" style="margin-top:.3rem;">Senza copertura i fari vanno sulle quattro torri.</div>` : ''}
      ${s.lights === 'towers' && s.roof === 'girders' ? `<div class="mp-muted" style="margin-top:.3rem;">Con le travi rosse i fari vanno in cima alle torri d'angolo.</div>` : ''}
      <div class="kit-sub">Muro esterno</div>
      <div class="kit-chips">${FACADES.map(o => this._chip('facade', o.id, o.label, s.facade === o.id)).join('')}</div>
      <div class="kit-sub">Torri delle rampe a spirale</div>
      <div class="kit-chips">${this._chip('ramps', '1', 'Sì', s.ramps)}${this._chip('ramps', '0', 'No', !s.ramps)}</div>
      <div class="mp-muted" style="margin-top:.3rem;">Torri cilindriche lungo il perimetro, con le rampe che salgono a spirale.</div>
      <div class="kit-sub">Maxischermo</div>
      <div class="kit-chips">${SCREENS.map(o => this._chip('screen', o.id, o.label, s.screen === o.id)).join('')}</div>
      ${s.screen !== 'none' ? `<div class="mp-muted" style="margin-top:.3rem;">${s.roof === 'none'
        ? 'Senza copertura lo schermo sta in cima agli spalti.'
        : 'Appeso sotto il bordo del tetto.'} Mostra il nome dello stadio, il risultato e il minuto.</div>` : ''}
      <div class="kit-sub">Colori</div>
      ${s.roof !== 'none' ? this._colorRow(['shell', 'tent', 'petals'].includes(s.roof) ? 'Involucro' : s.roof === 'stands' ? 'Pannelli sotto il tetto' : s.roof === 'dragon' ? 'Pannelli solari' : s.roof === 'crown' ? 'Vele' : 'Tetto', 'colors.roof', s.colors.roof) : ''}
      ${['shell', 'tent', 'petals'].includes(s.roof) ? this._colorRow('Luce dell\'involucro di notte', 'colors.glow', s.colors.glow) : ''}
      ${s.roof !== 'none' || s.lights !== 'none' ? this._colorRow(s.roof === 'dragon' ? 'Acciaio (tubi a spirale, tralicci, torri)' : s.roof === 'crown' ? 'Acciaio (colonne, anello, passerella)' : 'Acciaio (tralicci, pilastri, torri)', 'colors.steel', s.colors.steel) : ''}
      ${s.roof === 'girders' ? this._colorRow('Reticolato sopra il tetto (travi e sbalzi)', 'colors.girder', s.colors.girder) : ''}
      ${s.facade === 'struts' || s.facade === 'panels' ? this._colorRow(s.facade === 'panels' ? 'Rivestimento esterno' : 'Fasce del basamento', 'colors.accent', s.colors.accent) : ''}
      ${s.screen !== 'none' ? this._colorRow('Sfondo del maxischermo', 'colors.screen', s.colors.screen) : ''}
      <div class="mp-muted" style="margin-top:.6rem;">Prova il pulsante Notte sull'anteprima per vedere i fari accesi.</div>`;
  },

  _secPitch() {
    const s = this._st;
    return `
      <div class="kit-sub">Taglio dell'erba</div>
      <div class="kit-chips">${MOWING.map(o => this._chip('mowing', o.id, o.label, s.mowing === o.id)).join('')}</div>
      <div class="kit-sub">Colori</div>
      ${this._colorRow('Erba', 'colors.grass', s.colors.grass)}
      ${s.track ? `${this._colorRow('Pista', 'colors.track', s.colors.track)}${this._colorRow('Linee delle corsie', 'colors.trackLines', s.colors.trackLines)}` : ''}
      ${s.track && s.trackApron ? this._colorRow('Fondo intorno alla pista', 'colors.apron', s.colors.apron) : ''}`;
  },

  _secSeats() {
    const s = this._st;
    const grid = s.seatMode === 'grid';
    return `
      <div class="kit-sub">Effetto mosaico</div>
      <div class="kit-chips">${MOSAICS.map(o => this._chip('seatMosaic', o.id, o.label, s.seatMosaic === o.id)).join('')}</div>
      <div class="mp-muted" style="margin-top:.3rem;">${{
        none: 'Ogni settore di un colore pieno.',
        shades: 'Ogni settore resta del suo colore, con posti più chiari e più scuri sparsi a caso.',
        mix: 'Nel colore di ogni settore si mescolano a caso altri due colori, uguali per tutto lo stadio.'
      }[s.seatMosaic]} Vale con qualsiasi colorazione qui sotto.</div>
      ${s.seatMosaic === 'mix' ? `
      ${this._colorRow('Secondo colore sparso', 'colors.mosaicB', s.colors.mosaicB)}
      ${this._colorRow('Terzo colore sparso', 'colors.mosaicC', s.colors.mosaicC)}` : ''}
      <div class="kit-sub">Come colorarli</div>
      <div class="kit-chips">${SEAT_MODES.map(o => this._chip('seatMode', o.id, o.label, s.seatMode === o.id)).join('')}</div>
      ${(s.seatMode === 'rings' || grid) && maxRingsOf(s) === 1 ? `<div class="mp-muted" style="margin-top:.3rem;">Lo stadio ha un solo anello: aggiungine altri in "Anelli, curve e pista" per colorarli in modo diverso.</div>` : ''}
      ${grid ? `<div class="mp-muted" style="margin-top:.3rem;">Un colore per ogni tribuna e curva, anello per anello.</div>` : ''}
      <div class="kit-sub">Colori</div>
      ${grid ? `
      <div class="std-grid" style="--rings:${maxRingsOf(s)}">
        <span></span>${Array.from({ length: maxRingsOf(s) }, (_, r) => `<span class="hd">${r + 1}° anello</span>`).join('')}
        ${SEAT_SIDES.map(sd => `<span class="nm">${esc(sd.label)}</span>${Array.from({ length: maxRingsOf(s) }, (_, r) => {
          if (r >= ringsBySide(s)[sd.id] || (s.horseshoe && sd.id === 3)) return '<span class="hd">–</span>'; // anello che lì non c'è
          const path = `seatGrid.${gridKey(sd.id, r)}`;
          return `<input type="color" class="kit-color" data-color="${path}" value="${esc(s.seatGrid[gridKey(sd.id, r)])}" aria-label="${esc(sd.label)}, ${r + 1}° anello">`;
        }).join('')}`).join('')}
      </div>` : seatFields(s).map(([k, label]) => this._colorRow(label, `colors.${k}`, s.colors[k])).join('')}`;
  },

  /** Pulsanti per scegliere il carattere di una scritta: ogni nome è scritto nel suo carattere. */
  _fontChips(key, value) {
    return `<div class="kit-chips" style="margin-top:.4rem;">${TEXT_FONTS.map(f => `<button class="lv-chip ${value === f.id ? 'on' : ''}" data-act="set" data-k="${key}" data-v="${f.id}"
      style="font-family:${esc(f.css)}; font-weight:${f.weight}; font-style:${f.style}; font-size:.85rem;">${esc(f.label)}</button>`).join('')}</div>`;
  },

  _secTexts() {
    const s = this._st;
    const rings = [[0, 'Tutti']].concat(Array.from({ length: maxRingsOf(s) }, (_, r) => [r + 1, `${r + 1}° anello`]));
    return `
      <div class="kit-sub">Scritta sugli spalti</div>
      <label class="kit-field"><span>Testo</span><input type="text" data-text="standText" value="${esc(s.standText)}" maxlength="${MAX_STAND_TEXT}" placeholder="Es. FORZA RAGAZZI"></label>
      ${this._fontChips('standTextFont', s.standTextFont)}
      <div class="kit-chips">${TEXT_SIDES.map(o => this._chip('standTextSide', o.id, o.label, s.standTextSide === o.id)).join('')}</div>
      <div class="kit-chips" style="margin-top:.4rem;">${rings.map(([v, l]) => this._chip('standTextRing', v, l, Math.min(s.standTextRing, maxRingsOf(s)) === v)).join('')}</div>
      ${this._colorRow('Colore della scritta', 'colors.standText', s.colors.standText)}
      <div class="mp-muted" style="margin-top:.3rem;">Fatta con i seggiolini, centrata sul settore scelto e leggibile dal campo. Prova la vista Tribuna.</div>
      <div class="kit-sub">Scritta sull'esterno</div>
      <label class="kit-field"><span>Testo</span><input type="text" data-text="outerText" value="${esc(s.outerText)}" maxlength="${MAX_OUTER_TEXT}" placeholder="Es. ${esc(s.name.trim() || 'Stadio Comunale')}"></label>
      ${this._fontChips('outerTextFont', s.outerTextFont)}
      <div class="kit-sub">Dove</div>
      <div class="kit-chips">${TEXT_PLACES.map(o => this._chip('outerTextPlace', o.id, o.label, s.outerTextPlace === o.id)).join('')}</div>
      ${s.outerTextPlace === 'roof' && (s.roof === 'none' || WRAP_ROOFS.includes(s.roof)) ? `<div class="mp-muted" style="margin-top:.3rem;">Con questa copertura la scritta va sulla facciata.</div>` : ''}
      <div class="kit-sub">Stile</div>
      <div class="kit-chips">${OUTER_STYLES.map(o => this._chip('outerTextStyle', o.id, o.label, s.outerTextStyle === o.id)).join('')}</div>
      <div class="kit-sub">Dimensione</div>
      <div class="kit-chips">${TEXT_SIZES.map(o => this._chip('outerTextSize', o.id, o.label, s.outerTextSize === o.id)).join('')}</div>
      ${this._colorRow('Colore della scritta', 'colors.outerText', s.colors.outerText)}
      ${s.outerTextStyle === 'panel' ? this._colorRow('Fondo dell\'insegna', 'colors.outerPanel', s.colors.outerPanel) : ''}
      <div class="mp-muted" style="margin-top:.3rem;">Sui due lati lunghi, dove l'esterno la mostra meglio (involucro, cornicione, ringhiera, muro) e sempre nel tratto libero tra torri e piloni. Il contorno si adatta al colore per farla leggere su qualsiasi fondo. Di notte si accende. Prova la vista Esterno.</div>`;
  },

  _secWalls() {
    const s = this._st;
    return `
      ${this._colorRow('Parapetti', 'colors.parapet', s.colors.parapet)}
      ${this._colorRow('Cemento', 'colors.structure', s.colors.structure)}
      ${this._colorRow('Scalette tra i seggiolini', 'colors.aisle', s.colors.aisle)}
      <div class="mp-muted" style="margin-top:.6rem;">I parapetti sono il bordo campo e le balconate davanti a ogni anello.</div>`;
  },

  _secName() {
    const s = this._st, auto = stadiumCapacity(s);
    return `
      <label class="kit-field"><span>Nome</span><input type="text" data-text="name" value="${esc(s.name)}" maxlength="${MAX_NAME}" placeholder="Es. Stadio Comunale"></label>
      <div class="kit-sub">Capienza</div>
      <div class="kit-chips">
        ${this._chip('capMode', 'auto', `Calcolata (${fmt(auto)} posti)`, !s.capacityCustom)}
        ${this._chip('capMode', 'custom', 'Scelta da me', !!s.capacityCustom)}
      </div>
      ${s.capacityCustom ? `
      <label class="kit-field"><span>Posti</span><input type="text" inputmode="numeric" data-num="capacityCustom" value="${s.capacityCustom}" maxlength="7" autocomplete="off"></label>` : ''}
      <div class="mp-muted">${s.capacityCustom
        ? `Scrivi il numero di posti che vuoi (fino a ${fmt(MAX_CAPACITY)}).`
        : 'Contata dai seggiolini dello stadio: cambia con anelli, curve e pista.'} Nome e capienza compaiono in Home e nella scheda del tuo club.</div>`;
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
        <button data-z="night">${this._night ? 'Giorno' : 'Notte'}</button>
        <button data-z="in" aria-label="Avvicina">＋ Zoom</button>
        <button data-z="out" aria-label="Allontana">− Zoom</button>
      </div>`;
    document.body.appendChild(el);
    const viewer = createStadiumViewer(el.querySelector('.kit-zoom-stage > div'), { zoom: true });
    let night = this._night;
    viewer.update(this._st).then(() => viewer.setNight(night)).catch(err => console.error('Stadio:', err));
    const close = () => { viewer.dispose(); el.remove(); this._zoom = null; };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-z]');
      if (!b) return;
      const z = b.dataset.z;
      if (z === 'close') close();
      else if (z === 'in') viewer.zoomBy(.75);
      else if (z === 'out') viewer.zoomBy(1 / .75);
      else if (z === 'night') { night = !night; b.textContent = night ? 'Giorno' : 'Notte'; viewer.setNight(night); }
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
      case 'night':
        this._night = !this._night;
        btn.textContent = this._night ? 'Giorno' : 'Notte';
        if (this._viewer) this._viewer.setNight(this._night);
        return;
      case 'preset':
        this._update(() => { this._st = applyPreset(this._st, v); });
        window.showToast('Stile applicato: modificalo come vuoi e ricorda di salvare', 'ok');
        return;
      case 'set': {
        const k = btn.dataset.k;
        if (k === 'capMode') {
          this._update(st => { st.capacityCustom = v === 'custom' ? (st.capacityCustom || stadiumCapacity(st)) : 0; });
          const inp = v === 'custom' && this._root.querySelector('[data-num="capacityCustom"]');
          if (inp) { inp.focus(); inp.select(); }
          return;
        }
        const value = k === 'rings' || k === 'ringsEnds' || k === 'standTextRing' ? Number(v) : ['track', 'ramps', 'boxes', 'horseshoe', 'trackApron'].includes(k) ? v === '1' : v;
        // "Ogni settore e anello": si parte dai colori che lo stadio ha adesso
        if (k === 'seatMode' && v === 'grid' && this._st.seatMode !== 'grid') this._update(st => { st.seatGrid = seatGridFrom(st); st.seatMode = 'grid'; });
        else this._update(st => { st[k] = value; });
        return;
      }
      case 'swatch':
        this._update(() => this._set(btn.dataset.path, v));
        return;
      case 'ringsSide':
        this._update(st => { st.ringsSides[Number(btn.dataset.side)] = Number(v); });
        return;
      case 'roofSide':
        this._update(st => { st.roofSectors[Number(v)] = !st.roofSectors[Number(v)]; });
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
      this._set(t.dataset.text, t.value.slice(0, t.maxLength > 0 ? t.maxLength : MAX_NAME));
      this._schedulePreview();
    } else if (t.dataset.num) {
      // capienza: solo cifre (anche scritta con i punti delle migliaia)
      const n = Math.min(MAX_CAPACITY, Number(t.value.replace(/\D/g, '')) || 0);
      if (n) { this._set(t.dataset.num, n); this._schedulePreview(); }
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
      this._set(t.dataset.text, t.value.trim().slice(0, t.maxLength > 0 ? t.maxLength : MAX_NAME));
      this._renderPreview();
    } else if (t.dataset.num) {
      const n = Math.min(MAX_CAPACITY, Number(t.value.replace(/\D/g, '')) || 0);
      if (n < 100) window.showToast('Capienza troppo bassa: almeno 100 posti', 'err');
      this._set(t.dataset.num, Math.max(100, n || this._st.capacityCustom || 100));
      this._renderPreview(); this._renderSection();
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
      this._open = 'name';
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
    st.capacity = shownCapacity(st);
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
