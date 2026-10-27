import { db, ref, update } from '../firebase-config.js';
import { uploadPngToImgBB } from '../services/integrationImgBB.js';
import { dataUrlToBlob } from '../components/Kit3D.js';
import {
  createStadiumViewer, renderStadiumImage, openStadiumOverlay, STADIUM_VIEWS, stadiumCapacity, shownCapacity, normalizeStadium, defaultStadium, applyPreset,
  RINGS, SHAPES, CORNERS, MOWING, SEAT_MODES, ROOFS, LIGHTS, FACADES, PRESETS, MAX_NAME, MAX_CAPACITY,
  SEAT_SIDES, TEXT_SIDES, TEXT_FONTS, MOSAICS, OUTER_STYLES, TEXT_SIZES, TEXT_PLACES, ROOF_COVERS, ROOF_REACHES, WRAP_ROOFS, SHELL_PATTERNS, SCREENS, MAX_STAND_TEXT, MAX_OUTER_TEXT, gridKey, seatGridFrom, STAND_GAP_MAX, RAKE_MIN, RAKE_MAX, CORNER_GAP_MIN, CORNER_GAP_MAX, WALL_TEXTURES, WALL_TEX_FACADES, APRON_STYLES, GROUND_STYLES, AD_BOARDS, ROOF_GLOWS,
  ringsBySide, maxRingsOf, LOGO_PLACES, logoPlacesFor, ENTRANCES, ENTRANCE_W, ENTRANCE_H, ENTRANCE_LOGO, ENTRANCE_FITS, entranceSkips,
  MIX_ROOFS, ROOF_TEXTURES, TEXTURE_ROOFS, ROOF_WAVES, roofMixed, ARCHES
} from '../components/Stadium3D.js';

/** Nomi corti delle coperture nella scelta settore per settore. */
const MIX_LABELS = { none: 'No', membrane: 'Moderna', truss: 'Reticolare', stands: 'Tribuna', dragon: 'Drago', sliding: 'Wembley' };
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
    .kit-zoom-btn.std-ext-btn { top: calc(.4rem + 44px); }
    .kit-zoom-btn.std-ext-btn.on { border-color: var(--accent); color: var(--accent); }
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
    .std-sides { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 13.5rem); gap: .4rem .6rem; align-items: center; margin-top: .45rem; }
    .std-sides .nm { font-size: .8rem; font-weight: 600; color: var(--text); }
    /* selettore compatto a segmenti (una riga sola) */
    .std-seg { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); background: var(--bg2); border: 1px solid var(--border); border-radius: 999px; padding: 2px; }
    .std-seg button { background: transparent; border: 0; border-radius: 999px; color: var(--text2); font-family: inherit; font-size: .72rem; font-weight: 700; padding: .32rem .2rem; cursor: pointer; white-space: nowrap; }
    .std-seg button.on { background: color-mix(in srgb, var(--accent) 22%, transparent); color: var(--accent); }
    /* griglia di scelte a due colonne, tutte larghe uguali */
    .std-opts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .35rem; }
    .std-opts.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .std-mix-nm { font-size: .8rem; font-weight: 600; color: var(--text); margin: .55rem 0 .3rem; }
    #menu-panel .std-opts .lv-chip, .std-opts .lv-chip { width: 100%; border-radius: 10px; padding: .45rem .5rem; text-align: center; line-height: 1.2; white-space: normal; }
    .std-desc { font-size: .72rem; color: var(--text2); font-family: var(--font-sub, inherit); line-height: 1.35; margin-top: .4rem; background: var(--bg2); border-radius: 10px; padding: .45rem .6rem; }
    .std-range { display: grid; grid-template-columns: minmax(0, 5.5rem) minmax(0, 1fr) 3.4rem; gap: .6rem; align-items: center; margin: .45rem 0; }
    .std-range .nm { font-size: .8rem; font-weight: 600; color: var(--text); }
    .std-range input { width: 100%; accent-color: var(--accent); }
    .std-range b { font-size: .78rem; color: var(--accent); text-align: right; font-variant-numeric: tabular-nums; }
    .std-group { border-top: 1px solid var(--border); margin-top: .9rem; padding-top: .1rem; }
    .std-group:first-child { border-top: 0; margin-top: 0; padding-top: 0; }
    /* con una fase aperta l'anteprima è un po' più bassa: più spazio per le scelte */
    .std-editor.has-open .kit-preview { height: 27vh; min-height: 165px; }
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

const VIEWS = STADIUM_VIEWS;

export const StadioSquadra = {
  title: 'Stadio',
  _open: 'name',
  _busy: false,
  _night: false,
  _hideExt: false, // esterno nascosto nell'anteprima (non si salva)

  mount(body, STATE) {
    injectStadiumStyle();
    const team = STATE.user;
    const root = document.createElement('div');
    root.className = 'std-editor';
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
    this._hideExt = false;
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

  /** Logo della squadra (per metterlo sullo stadio nei posti scelti). */
  _logo() {
    const team = window.STATE && window.STATE.user;
    return team && String(team.id) === String(this._teamId) ? team.logo || '' : '';
  },

  /* -------------------------------------------------------------- render */
  _dirty() { return sig(this._st) !== this._saved; },

  _renderAll() {
    const sections = [
      ['name',      'FASE 1: Nome e capienza'],
      ['styles',    'FASE 2: Stili rapidi'],
      ['structure', 'FASE 3: Anelli, curve e pista'],
      ['exterior',  'FASE 4: Copertura e maxischermo'],
      ['outside',   'FASE 5: Muro esterno, fari e rampe'],
      ['entrances', 'FASE 6: Ingressi'],
      ['pitch',     'FASE 7: Campo, pista e pavimenti'],
      ['seats',     'FASE 8: Colore dei seggiolini'],
      ['texts',     'FASE 9: Scritte e logo'],
      ['walls',     'FASE 10: Parapetti e cemento']
    ];
    this._root.innerHTML = `
      <div class="kit-stage">
        <div class="kit-preview">
          <div class="kit-loading" id="std-loading">Costruzione dello stadio…</div>
          <div id="std-3d"></div>
          <div class="kit-hint std-hint"><i class="ri-drag-move-line"></i> Trascina per ruotare</div>
          <div class="kit-view-btns std-views">${VIEWS.map(([v, l]) => `<button data-act="view" data-v="${v}">${l}</button>`).join('')}<button data-act="night">${this._night ? 'Giorno' : 'Notte'}</button></div>
          <button class="kit-zoom-btn" data-act="zoom-open" title="Ingrandisci lo stadio" aria-label="Ingrandisci lo stadio"><i class="ri-zoom-in-line"></i></button>
          ${this._extBtn()}
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
      if (this._hideExt) this._viewer.setExterior(false);
      this._viewer.ready.then(() => { const l = this._root && this._root.querySelector('#std-loading'); if (l) l.remove(); })
        .catch(e => { console.error(e); const l = this._root && this._root.querySelector('#std-loading'); if (l) l.textContent = 'Il 3D non è supportato su questo dispositivo'; });
    }
    if (this._viewer) this._viewer.update(this._st, { logo: this._logo() }).catch(e => console.error('Stadio:', e));
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
    this._root.classList.toggle('has-open', !!this._open);
    this._root.querySelectorAll('.kit-acc-body').forEach(b => { b.innerHTML = ''; });
    const key = this._open;
    const box = key && this._root.querySelector(`#std-sec-${key}`);
    if (!box) return;
    const fn = {
      styles: this._secStyles, structure: this._secStructure, exterior: this._secExterior, outside: this._secOutside, entrances: this._secEntrances, pitch: this._secPitch,
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

  /** Scelte in griglia a due colonne (liste lunghe): tutte larghe uguali, niente righe spezzate a caso. */
  _opts(key, list, current) {
    return `<div class="std-opts">${list.map(o => this._chip(key, o.id, o.label, current === o.id)).join('')}</div>`;
  },

  /** Selettore compatto a segmenti su una riga: items = [[valore, etichetta, attivo], ...], act/extra = attributi del pulsante. */
  _seg(items, attrs) {
    return `<div class="std-seg">${items.map(([v, l, on]) => `<button class="${on ? 'on' : ''}" ${attrs} data-v="${esc(v)}">${esc(l)}</button>`).join('')}</div>`;
  },

  /** Cursore: il valore si vede mentre si trascina, lo stadio si ricostruisce quando si lascia. fmt(v) = testo del valore. */
  _range(label, key, min, max, value, fmt) {
    return `<label class="std-range"><span class="nm">${esc(label)}</span>
      <input type="range" min="${min}" max="${max}" step="1" value="${value}" data-range="${key}">
      <b data-range-out="${key}">${esc(fmt(value))}</b></label>`;
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
    const yesNo = (k, on, labels = ['No', 'Sì']) => this._seg([['0', labels[0], !on], ['1', labels[1], on]], `data-act="set" data-k="${k}"`);
    return `
      <div class="std-group">
      <div class="kit-sub">Anelli delle tribune (lati lunghi)</div>
      ${this._seg(RINGS.map(r => [r.id, r.label, s.rings === r.id]), 'data-act="set" data-k="rings"')}
      <div class="kit-sub">Anelli delle curve</div>
      ${this._seg([[0, `Uguali (${s.rings})`, !s.ringsEnds], ...RINGS.map(r => [r.id, String(r.id), s.ringsEnds === r.id])], 'data-act="set" data-k="ringsEnds"')}
      <div class="kit-sub">Anelli settore per settore</div>
      <div class="mp-muted">Per cambiare un solo settore (per esempio la tribuna principale più alta). "Auto" segue le scelte qui sopra.</div>
      <div class="std-sides">${SEAT_SIDES.filter(sd => !(s.horseshoe && sd.id === 3)).map(sd => {
        const auto = sd.id % 2 ? (s.ringsEnds || s.rings) : s.rings, cur = s.ringsSides[sd.id];
        return `<span class="nm">${esc(sd.label)}</span>${this._seg([[0, `Auto (${auto})`, cur === 0], ...RINGS.map(r => [r.id, String(r.id), cur === r.id])], `data-act="ringsSide" data-side="${sd.id}"`)}`;
      }).join('')}</div>
      ${maxRingsOf(s) > 1 ? `<div class="kit-sub">Palchi vetrati tra gli anelli</div>${yesNo('boxes', s.boxes)}` : ''}
      <div class="kit-sub">Vomitori (ingressi sugli spalti)</div>
      ${yesNo('vomitories', s.vomitories)}
      <div class="std-desc">Aperture scure a metà degli anelli più grandi, tra una scaletta e l'altra, con i muretti ai lati (come al Vélodrome).</div>
      </div>
      <div class="std-group">
      <div class="kit-sub">Forma delle curve</div>
      ${this._opts('shape', SHAPES, s.shape)}
      <div class="kit-sub">Curve e tribune</div>
      ${this._seg(CORNERS.map(o => [o.id, o.label, s.corners === o.id]), 'data-act="set" data-k="corners"')}
      <div class="std-desc">${s.corners === 'open' ? 'Quattro settori separati, con gli angoli aperti.' : 'Un unico anello di spalti tutto intorno al campo.'}</div>
      ${s.corners === 'open' ? this._range('Apertura agli angoli', 'cornerGap', CORNER_GAP_MIN, CORNER_GAP_MAX, s.cornerGap, v => `${Math.round(v / 18 * 100)}%`) : ''}
      <div class="kit-sub">Distanza degli spalti dal campo</div>
      ${this._range('Tribune', 'standGap', 0, STAND_GAP_MAX, s.standGap, v => `+${v} m`)}
      ${this._range('Curve', 'endGap', 0, STAND_GAP_MAX, s.endGap, v => `+${v} m`)}
      <div class="kit-sub">Pendenza degli spalti</div>
      ${this._seg([['0', 'Uguale per tutti', !s.rakeEach], ['1', 'Settore per settore', s.rakeEach]], 'data-act="rakeEach"')}
      ${s.rakeEach
        ? SEAT_SIDES.filter(sd => !(s.horseshoe && sd.id === 3)).map(sd => this._range(sd.label, `rakeSides.${sd.id}`, RAKE_MIN, RAKE_MAX, s.rakeSides[sd.id], v => `${v}%`)).join('')
        : this._range('Pendenza', 'rake', RAKE_MIN, RAKE_MAX, s.rake, v => `${v}%`)}
      <div class="std-desc">Più bassa: spalti schiacciati, più larghi che alti (come all'Olimpico). Più alta: spalti ripidi e alti.</div>
      <div class="kit-sub">Una curva aperta (ferro di cavallo)</div>
      ${yesNo('horseshoe', s.horseshoe)}
      ${s.horseshoe ? `<div class="std-desc">Al posto di una curva un piazzale con le sculture bianche; con lo schermo sulle curve, lì c'è un maxischermo su pali.</div>` : ''}
      </div>
      <div class="std-group">
      <div class="kit-sub">Pista d'atletica</div>
      ${yesNo('track', s.track)}
      <div class="std-desc">Con la pista gli spalti sono più lontani dal campo. Colori e pavimenti nella fase "Campo, pista e pavimenti".</div>
      </div>`;
  },

  /** FASE 4: copertura (tipo, dove, quanto copre, disegno, colori) e maxischermo. */
  _secExterior() {
    const s = this._st;
    return `
      <div class="std-group">
      <div class="kit-sub">Tipo di copertura</div>
      ${this._opts('roof', ROOFS, s.roof)}
      <div class="std-desc">${{
        truss: 'Tetto in lamiera sopra l\'anello più alto, con tralicci sotto e piloni in acciaio fuori che reggono una trave tutto intorno.',
        membrane: 'Tetto chiaro e liscio, con le costole sotto.',
        girders: 'Tetto chiaro a botti con la struttura scura sotto, appeso a quattro grandi travi reticolari che poggiano su quattro torri agli angoli.',
        stands: 'Ogni tribuna ha il suo tetto alla sua altezza, come a Stamford Bridge: sopra lamiera con le travi reticolari a vista, davanti la fascia chiara con la riga colorata e le luci, agli angoli i piloni con i tiranti.',
        wave: 'Copertura bianca quasi tonda a cuscini radiali, alta sopra le curve e più bassa sui lati lunghi, con le travi d\'acciaio sotto. Fuori una fascia bianca che sui lati lunghi scende quasi a terra; sulle curve resta alta, sotto si vedono i piani in cemento e al centro di una curva c\'è l\'ingresso principale con la vetrata a lamelle e gli schermi.',
        dome: 'Cupola bianca a raggiera che sale dal basso fino all\'apertura, con i denti a punta tutto attorno alla base.',
        tent: 'Membrana a rete mezza trasparente tirata su da tre pennoni altissimi (su uno l\'anello panoramico): in basso scende fino a terra con una fila di grandi archi, sotto si vede la struttura vetrata. Di notte si illumina del colore scelto.',
        petals: 'Conchiglia ovale come l\'Al Janoub: in basso le fasce di pieghe tutto intorno, sopra i grandi petali con le pieghe a ventaglio che partono dalle curve e la lingua a V sul fianco dei lati lunghi; sotto, il piano terra vetrato; sopra l\'apertura le travi reticolari ad arco con i cavi. Di notte si illumina.',
        crown: 'Corona quasi tonda di vele bianche piegate a zig-zag tra due anelli di tubi bianchi: da fuori triangoli con la punta in giù su colonne a lama inclinate; dentro le travi sotto le creste, la passerella ad anello e il bordo a denti verso il campo. Di notte le vele si illuminano.',
        blades: 'Come il Bernabéu: pianta quasi quadrata, basamento vetrato scuro, facciata di grandi lame d\'acciaio orizzontali che si gonfia verso fuori con il bordo ondulato, camminamento scuro e tetto a lame concentriche fino all\'apertura, con le travi bianche sotto. Di notte la facciata si illumina.',
        dragon: 'Nastro largo di pannelli solari a scaglie retto da grandi tubi bianchi a spirale che salgono da terra. Dove la copertura finisce il nastro scende a terra; con una curva aperta (ferro di cavallo) esce dallo stadio come la coda di un drago.',
        shell: 'Un unico involucro a cuscini che avvolge lo stadio: si gonfia verso fuori, copre gli spalti e diventa trasparente verso il campo. Di notte si illumina.',
        sliding: 'Come Wembley: tetto di grandi pannelli chiari con l\'apertura rettangolare, aperto sulla tribuna verso l\'arco (si vedono i posti fino in cima, con i denti bianchi sul bordo) e con i pannelli scorrevoli raccolti sulla tribuna di fronte; agli angoli le diagonali reticolari bianche, sotto il bordo esterno la fascia reticolare bianca a zig-zag e sotto il tetto la struttura scura. Con l\'arco (qui sotto) diventa Wembley.'
      }[s.roof] || 'Spalti scoperti.'}</div>
      </div>
      <div class="std-group">
      <div class="kit-sub">Copertura settore per settore</div>
      ${WRAP_ROOFS.includes(s.roof) || s.roof === 'girders' ? `<div class="std-desc">${s.roof === 'girders' ? 'Le travi rosse stanno su quattro torri comuni: questa copertura non si mescola con altre.' : 'Questa copertura avvolge tutto lo stadio: non si mescola con altre.'}</div>` : `
      <div class="std-desc">Mescola le coperture: per esempio le tribune con il tetto reticolare e le curve con il drago. "Uguale" segue la copertura scelta sopra (e "Dove mettere la copertura"); "No" lascia il settore scoperto.</div>
      ${SEAT_SIDES.filter(sd => !(s.horseshoe && sd.id === 3)).map(sd => `<div class="std-mix-nm">${esc(sd.label)}</div>
      <div class="std-opts three">${[['', 'Uguale'], ...MIX_ROOFS.map(id => [id, MIX_LABELS[id]])].map(([id, lb]) => `<button class="lv-chip ${(s.roofSides[sd.id] || '') === id ? 'on' : ''}" data-act="roofMix" data-side="${sd.id}" data-v="${id}">${esc(lb)}</button>`).join('')}</div>`).join('')}`}
      </div>
      ${s.roof !== 'none' || roofMixed(s) ? `
      <div class="std-group">
      <div class="kit-sub">Dove mettere la copertura</div>
      ${WRAP_ROOFS.includes(s.roof) ? `<div class="std-desc">Questa copertura avvolge tutto lo stadio.</div>` : `
      ${this._opts('roofCover', ROOF_COVERS, s.roofCover)}
      ${s.roofCover === 'pick' ? `
      <div class="std-opts" style="margin-top:.45rem;">${SEAT_SIDES.map(sd => `<button class="lv-chip ${s.roofSectors[sd.id] ? 'on' : ''}" data-act="roofSide" data-v="${sd.id}">${s.roofSectors[sd.id] ? '✓ ' : ''}${esc(sd.label)}</button>`).join('')}</div>
      <div class="std-desc">${s.roofSectors.some(Boolean) ? 'Tocca i settori da coprire o scoprire: anche uno solo, come la tribuna del Camp Nou.' : 'Nessun settore scelto: tocca quelli da coprire.'}</div>` : ''}`}
      <div class="kit-sub">Quanto copre verso il campo</div>
      ${this._opts('roofReach', ROOF_REACHES, s.roofReach)}
      ${s.roof === 'shell' ? `
      <div class="kit-sub">Disegno dell'involucro</div>
      ${this._opts('shellPattern', SHELL_PATTERNS, s.shellPattern)}` : ''}
      ${s.roof === 'dome' ? `
      <div class="kit-sub">Denti triangolari alla base</div>
      ${this._seg([['1', 'Sì', s.domeTeeth], ['0', 'No', !s.domeTeeth]], 'data-act="set" data-k="domeTeeth"')}
      <div class="std-desc">${s.domeTeeth ? 'La corona di grandi triangoli di lamiera che scendono dal bordo della cupola quasi fino a terra, come alla Samara Arena.' : 'Senza denti il bordo della cupola è chiuso da una fascia di lamiera e sotto si vedono le vetrate.'}</div>` : ''}
      ${this._roofLook()}
      <div class="kit-sub">Colori della copertura</div>
      ${this._colorRow(['shell', 'tent', 'petals'].includes(s.roof) ? 'Involucro' : s.roof === 'dragon' ? 'Pannelli solari' : s.roof === 'crown' ? 'Vele' : s.roof === 'blades' ? 'Lame d\'acciaio (tetto e facciata)' : 'Tetto', 'colors.roof', s.colors.roof)}
      ${['shell', 'tent', 'petals'].includes(s.roof) ? this._colorRow(s.roof === 'tent' ? 'Luce della tenda e delle vetrate di notte' : 'Luce dell\'involucro di notte', 'colors.glow', s.colors.glow) : ''}
      ${ROOF_GLOWS[s.roof] ? this._colorRow('Luce della copertura di notte', 'colors.roofLight', s.colors.roofLight || ROOF_GLOWS[s.roof]) : ''}
      ${s.roof === 'stands' ? this._colorRow('Righe luminose (accese di notte)', 'colors.glow', s.colors.glow) : ''}
      ${this._colorRow(s.roof === 'dragon' ? 'Acciaio (tubi a spirale e tralicci)' : s.roof === 'crown' ? 'Acciaio (colonne, anelli, passerella)' : s.roof === 'stands' ? 'Acciaio (piloni e tiranti)' : s.roof === 'blades' || s.roof === 'sliding' ? 'Travi sotto il tetto' : 'Acciaio (tralicci, pilastri, piloni)', 'colors.steel', s.colors.steel)}
      ${s.roof === 'girders' ? this._colorRow('Reticolato sopra il tetto (travi e sbalzi)', 'colors.girder', s.colors.girder) : ''}
      ${s.roof === 'stands' ? this._colorRow('Travi sopra il tetto e fascia davanti', 'colors.girder', s.colors.girder) : ''}
      ${s.roof === 'sliding' ? this._colorRow('Travi sopra il tetto, corona e pannelli scorrevoli', 'colors.girder', s.colors.girder) : ''}
      </div>` : ''}
      <div class="std-group">
      <div class="kit-sub">Arco sopra lo stadio</div>
      ${this._opts('arch', ARCHES, s.arch)}
      <div class="std-desc">${{
        none: 'Come a Wembley: un grande arco reticolare da una curva all\'altra che regge la copertura con i cavi. Va con tutte le coperture.',
        lean: 'Il grande arco reticolare bianco di Wembley: parte da oltre le curve, si piega sopra una tribuna e regge con i cavi il bordo della copertura (senza copertura i cavi scendono in cima agli spalti). Di notte si accende.',
        upright: 'Arco reticolare dritto sopra il campo, da una curva all\'altra, con i cavi fino al bordo della copertura sulle due tribune. Di notte si accende.'
      }[s.arch]}</div>
      ${s.arch !== 'none' ? this._colorRow('Arco', 'colors.arch', s.colors.arch) : ''}
      </div>
      <div class="std-group">
      <div class="kit-sub">Maxischermo</div>
      ${this._opts('screen', SCREENS, s.screen)}
      ${s.screen !== 'none' ? `<div class="std-desc">${s.roof === 'none'
        ? 'Senza copertura lo schermo sta in cima agli spalti.'
        : 'Appeso sotto il bordo del tetto.'} Mostra il nome dello stadio, il risultato e il minuto.</div>
      ${this._colorRow('Sfondo del maxischermo', 'colors.screen', s.colors.screen)}` : ''}
      </div>`;
  },

  /** Texture e ondulazione della copertura (dentro la fase 4). */
  _roofLook() {
    const s = this._st, types = roofMixed(s) ? s.roofSides.map(t => t || s.roof) : [s.roof];
    const skin = types.some(t => TEXTURE_ROOFS.includes(t));
    return `
      ${skin ? `
      <div class="kit-sub">Texture della copertura</div>
      ${this._opts('roofTexture', ROOF_TEXTURES, s.roofTexture)}
      <div class="std-desc">${s.roofTexture === 'auto' ? 'Quella pensata per lo stile scelto.' : s.roofTexture === 'glass' ? 'Lastre di vetro trasparenti con i montanti: si vedono la struttura e il cielo.' : 'Vale per tutte le coperture che la accettano'}${s.roofTexture !== 'auto' && s.roofTexture !== 'glass' ? ' (non per i tetti per tribuna, la tenda, i cuscini e i petali, che hanno il loro disegno).' : ''}</div>` : ''}
      <div class="kit-sub">Ondulazione</div>
      ${this._range('Altezza delle onde', 'roofWave', 0, 100, s.roofWave, v => `${v}%`)}
      ${s.roofWave ? `${this._range('Numero di onde', 'roofWaves', ROOF_WAVES[0], ROOF_WAVES[1], s.roofWaves, v => `${v}`)}
      ${this._range('Sposta le onde', 'roofWaveShift', 0, 100, s.roofWaveShift, v => `${v}%`)}` : ''}
      <div class="std-desc">${s.roofWave ? 'Il bordo della copertura sale e scende tutto intorno, con tutta la struttura (sotto un po\' meno che sopra, per non toccare gli spalti).' : 'A zero la copertura è dritta: alza il cursore per farla ondulare.'}</div>`;
  },

  /** FASE 5: muro esterno (tipo, texture, colori), torri delle rampe e fari. */
  _secOutside() {
    const s = this._st;
    const roofLights = s.lights === 'roof' && s.roof === 'none' && !s.roofSides.some(r => r && r !== 'none');
    return `
      <div class="std-group">
      <div class="kit-sub">Muro esterno</div>
      ${this._opts('facade', FACADES, s.facade)}
      ${WALL_TEX_FACADES.includes(s.facade) ? `
      <div class="kit-sub">Texture del muro</div>
      ${this._opts('wallTexture', WALL_TEXTURES, s.wallTexture)}
      ${this._colorRow('Colore del muro esterno', 'colors.wall', s.colors.wall || s.colors.structure)}` : ''}
      ${s.facade === 'cladding' ? `${this._colorRow('Pannelli della facciata', 'colors.cladding', s.colors.cladding)}${this._colorRow('Basamento e torri d\'angolo', 'colors.podium', s.colors.podium)}${this._colorRow('Righe luminose (accese di notte)', 'colors.glow', s.colors.glow)}` : ''}
      ${s.facade === 'struts' || s.facade === 'panels' || s.facade === 'cladding' ? this._colorRow({ panels: 'Rivestimento esterno', cladding: 'Cornicione, pinne, tornelli e portale' }[s.facade] || 'Fasce del basamento', 'colors.accent', s.colors.accent) : ''}
      </div>
      <div class="std-group">
      <div class="kit-sub">Torri delle rampe a spirale</div>
      ${this._seg([['0', 'No', !s.ramps], ['1', 'Sì', s.ramps]], 'data-act="set" data-k="ramps"')}
      <div class="std-desc">Torri cilindriche lungo il perimetro, a distanza regolare, con le rampe che salgono a spirale.</div>
      </div>
      <div class="std-group">
      <div class="kit-sub">Fari</div>
      ${this._opts('lights', LIGHTS, s.lights)}
      ${roofLights ? `<div class="std-desc">Senza copertura i fari vanno sulle quattro torri.</div>` : ''}
      ${s.lights === 'towers' && s.roof === 'girders' ? `<div class="std-desc">Con le travi rosse i fari vanno in cima alle torri d'angolo.</div>` : ''}
      ${s.roof === 'none' && (s.lights !== 'none' || s.ramps) ? this._colorRow('Acciaio (torri faro)', 'colors.steel', s.colors.steel) : ''}
      <div class="std-desc">Prova il pulsante Notte sull'anteprima per vedere i fari accesi.</div>
      </div>`;
  },

  /** FASE 6: ingressi monumentali (tipo, lati, misure, colori, immagine personale e logo sopra). */
  _secEntrances() {
    const s = this._st, on = s.entrance !== 'none', logo = this._logo(), velo = s.roof === 'wave', skip = entranceSkips(s);
    // copertura che sporge sopra l'ingresso: resta attaccato al muro (o sotto l'involucro) e se serve si adatta
    const under = { shell: 'l\'involucro a cuscini', petals: 'i petali', crown: 'la corona di vele' }[s.roof];
    const logoWhere = velo && !on ? 'Sul Vélodrome il logo sta sulla fascia bianca sopra l\'ingresso.'
      : s.entrance === 'arch' ? 'Il logo sta sull\'attico sopra l\'arco (più è grande, più l\'attico è alto).'
        : `Il logo sta su un'insegna del colore dell'ingresso con il bordo LED${velo ? '; sul Vélodrome sulla fascia bianca sopra il suo ingresso' : ''}.`;
    return `
      ${velo ? `
      <div class="std-group">
      <div class="kit-sub">Ingresso del Vélodrome</div>
      <div class="std-desc">L'ingresso principale è sulla curva destra, sotto la fascia bianca che sale: atrio vetrato con le porte, lamelle d'alluminio fino alla fascia, pensilina del colore dell'ingresso con i faretti e la striscia LED, due schermi con la tua immagine, il podio con i tornelli e davanti la piazzetta con gli alberi e i pennoni. Colori, immagine e logo qui sotto valgono anche per lui.</div>
      </div>` : ''}
      <div class="std-group">
      <div class="kit-sub">${velo ? 'Un altro ingresso monumentale (sulla curva sinistra)' : 'Tipo di ingresso'}</div>
      ${this._opts('entrance', ENTRANCES, s.entrance)}
      <div class="std-desc">${{
        none: velo ? 'Nessun altro ingresso: resta quello del Vélodrome.' : 'Nessun ingresso monumentale: si entra dal muro esterno.',
        portal: 'Portale vetrato con due grandi pilastri e l\'architrave in pannelli di metallo colorati con le strisce LED, vetrata con le porte, pensilina in cemento con i faretti e le colonnine, gradini, tornelli e due pennoni con le bandiere. Il pannello sopra la pensilina mostra la tua immagine.',
        arch: 'Arco monumentale in blocchi di pietra su zoccolo, con l\'archivolto, la chiave di volta e la cornice colorate, le lesene, l\'attico col logo, il cancello in ferro e due lanterne. I due stendardi ai lati dell\'arco mostrano la tua immagine.',
        canopy: 'Grande pensilina a sbalzo che sale verso fuori, con i faretti sotto e la striscia LED sul frontale, retta da due colonne a V; vetrata d\'ingresso con le porte e maxischermo appeso con la tua immagine.',
        towers: 'Due torri in blocchi di pietra con le feritoie, la cupola e il pennone in cima (come il vecchio Wembley), unite da un ponte colorato con la striscia LED; cancellata sotto e due stendardi appesi con la tua immagine.'
      }[s.entrance]} ${on ? 'Davanti c\'è la piazzetta lastricata con i paletti e due aiuole con gli alberi; di notte vetrate, faretti, LED e pannelli si accendono.' : ''}</div>
      ${on && under ? `<div class="std-desc">Sotto ${under} l'ingresso resta attaccato allo stadio${s.facade === 'esplanade' ? ', sulla spianata' : ''}: se non c'è spazio l'insegna del logo va sul muro e l'ingresso si abbassa quanto serve.</div>` : ''}
      ${on && s.facade === 'esplanade' && !under ? '<div class="std-desc">Con la spianata rialzata l\'ingresso sta sopra la spianata, attaccato al muro.</div>' : ''}
      </div>
      ${on ? `
      <div class="std-group">
      <div class="kit-sub">Su quali lati</div>
      <div class="std-opts">${SEAT_SIDES.map(sd => `<button class="lv-chip ${s.entranceSides[sd.id] && !skip[sd.id] ? 'on' : ''}" data-act="entSide" data-v="${sd.id}" ${skip[sd.id] ? 'disabled' : ''}>${s.entranceSides[sd.id] && !skip[sd.id] ? '✓ ' : ''}${esc(sd.label)}</button>`).join('')}</div>
      ${Object.entries(skip).map(([k, t]) => `<div class="std-desc">${esc(SEAT_SIDES.find(sd => sd.id === Number(k)).label)}: ${esc(t)}.</div>`).join('')}
      <div class="kit-sub">Misure</div>
      ${this._range('Larghezza', 'entranceWidth', ENTRANCE_W[0], ENTRANCE_W[1], s.entranceWidth, v => `${v} m`)}
      ${this._range('Altezza', 'entranceHeight', ENTRANCE_H[0], ENTRANCE_H[1], s.entranceHeight, v => `${v} m`)}
      </div>` : ''}
      ${on || velo ? `
      <div class="std-group">
      <div class="kit-sub">Colori</div>
      ${this._colorRow('Colore dell\'ingresso', 'colors.entrance', s.colors.entrance)}
      ${this._colorRow('Pietra e parti chiare', 'colors.entranceStone', s.colors.entranceStone)}
      </div>
      <div class="std-group">
      <div class="kit-sub">La tua immagine</div>
      ${s.entranceImage ? `<img src="${esc(s.entranceImage)}" alt="" style="display:block; max-width:100%; max-height:120px; border-radius:10px; margin:.2rem 0 .5rem;">` : ''}
      <div class="kit-chips">
        <label class="lv-chip" style="cursor:pointer;"><i class="ri-image-add-line"></i> ${s.entranceImage ? 'Cambia immagine' : 'Carica un\'immagine'}
          <input type="file" accept="image/png,image/jpeg,image/webp" data-upload="entrance" style="display:none;"></label>
        ${s.entranceImage ? `<button class="lv-chip" data-act="entImgClear"><i class="ri-delete-bin-line"></i> Togli</button>` : ''}
      </div>
      ${s.entranceImage ? `<div style="margin-top:.5rem;">${this._seg(ENTRANCE_FITS.map(o => [o.id, o.label, s.entranceImageFit === o.id]), 'data-act="set" data-k="entranceImageFit"')}</div>` : ''}
      <div class="std-desc">Va sui pannelli${velo ? ' e sugli schermi del Vélodrome' : ' dell\'ingresso'} senza deformarsi: "Riempie il pannello" taglia quello che avanza, "Intera" la mostra tutta sul fondo del colore dell'ingresso. Senza immagine c'è il nome dello stadio.</div>
      </div>
      <div class="std-group">
      <div class="kit-sub">Logo della squadra sopra ogni ingresso</div>
      ${logo ? this._seg([['0', 'No', !s.logoPlaces.includes('entrance')], ['1', 'Sì', s.logoPlaces.includes('entrance')]], 'data-act="entLogo"')
        : `<div class="std-desc">Carica il logo della squadra in Configurazione squadra per metterlo sopra gli ingressi.</div>`}
      ${logo && s.logoPlaces.includes('entrance') ? `${this._range('Grandezza del logo', 'entranceLogo', ENTRANCE_LOGO[0], ENTRANCE_LOGO[1], s.entranceLogo, v => `${v}%`)}
      <div class="std-desc">${logoWhere}</div>` : ''}
      </div>` : ''}`;
  },

  _secPitch() {
    const s = this._st, c = s.colors;
    return `
      <div class="std-group">
      <div class="kit-sub">Taglio dell'erba</div>
      ${this._seg(MOWING.map(o => [o.id, o.label, s.mowing === o.id]), 'data-act="set" data-k="mowing"')}
      ${this._colorRow('Erba', 'colors.grass', c.grass)}
      </div>
      ${s.track ? `
      <div class="std-group">
      <div class="kit-sub">Pista d'atletica</div>
      ${this._colorRow('Gomma della pista', 'colors.track', c.track)}
      ${this._colorRow('Linee delle corsie', 'colors.trackLines', c.trackLines)}
      </div>` : ''}
      <div class="std-group">
      <div class="kit-sub">Pavimento intorno al campo</div>
      ${this._opts('apronStyle', APRON_STYLES, s.apronStyle)}
      <div class="std-desc">${{
        grass: s.track ? 'Prato anche dentro la pista, dietro le porte.' : 'Prato fino agli spalti.',
        tartan: 'La stessa gomma della pista, a 2,5 m dalle linee del campo fino agli spalti (come al Maradona).',
        color: 'Resina liscia del colore che vuoi, a 2,5 m dalle linee del campo fino agli spalti.',
        concrete: 'Cemento a lastre, a 2,5 m dalle linee del campo fino agli spalti.'
      }[s.apronStyle]}</div>
      ${s.apronStyle === 'color' ? this._colorRow('Colore della resina', 'colors.apron', c.apron) : ''}
      ${s.apronStyle === 'tartan' && !s.track ? this._colorRow('Colore della gomma', 'colors.track', c.track) : ''}
      </div>
      <div class="std-group">
      <div class="kit-sub">Pavimento fuori dallo stadio</div>
      ${this._opts('groundStyle', GROUND_STYLES, s.groundStyle)}
      ${this._colorRow('Colore del pavimento fuori', 'colors.ground', c.ground || ({ grass: c.grass, asphalt: '#6a6e73', cobbles: '#8f8a84' }[s.groundStyle] || c.structure))}
      </div>
      <div class="std-group">
      <div class="kit-sub">Cartelloni LED</div>
      ${this._opts('adBoards', AD_BOARDS, s.adBoards)}
      ${s.adBoards !== 'none' ? `<div class="std-desc">Mostrano il nome dello stadio${s.adBoards === 'both' ? ', anche sul fronte degli anelli più alti' : ''}. Di notte si accendono.</div>
      ${this._colorRow('Colore dei cartelloni', 'colors.ads', c.ads)}` : ''}
      </div>`;
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
      ${this._colorRow('Terzo colore sparso', 'colors.mosaicC', s.colors.mosaicC)}
      <div class="kit-sub">Quarto colore sparso</div>
      ${this._seg([['0', 'No', !s.colors.mosaicD], ['1', 'Sì', !!s.colors.mosaicD]], 'data-act="mosaicD"')}
      ${s.colors.mosaicD ? this._colorRow('Quarto colore sparso', 'colors.mosaicD', s.colors.mosaicD) : ''}` : ''}
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
    const can = logoPlacesFor(s);
    return `
      <div class="kit-sub">Logo della squadra</div>
      ${this._logo() ? `
      <div class="kit-chips">${LOGO_PLACES.filter(o => can.includes(o.id)).map(o => `<button class="lv-chip ${s.logoPlaces.includes(o.id) ? 'on' : ''}" data-act="logoPlace" data-v="${o.id}">${esc(o.label)}</button>`).join('')}</div>
      <div class="mp-muted" style="margin-top:.3rem;">Tocca i posti dove metterlo, anche più di uno: grande e ben visibile, di notte si illumina. ${can.includes('entrance') ? 'Sull\'ingresso prende il posto dello stemma con le iniziali.' : 'L\'ingresso con il portale c\'è con il muro esterno "Inglese".'}${can.includes('roof') ? '' : ' Sul tetto serve una copertura piatta.'}</div>`
      : `<div class="mp-muted">Carica il logo della squadra in Configurazione squadra: poi puoi metterlo sull'ingresso, sul tetto, sulle curve o al centro del campo.</div>`}
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

  /** Pulsante per nascondere l'esterno (copertura, facciata...) e guardare dentro: solo anteprima, non si salva. */
  _extBtn() {
    const t = this._hideExt ? 'Mostra l\'esterno' : 'Nascondi l\'esterno (si vede dentro)';
    return `<button class="kit-zoom-btn std-ext-btn ${this._hideExt ? 'on' : ''}" data-act="exterior" title="${t}" aria-label="${t}"><i class="${this._hideExt ? 'ri-eye-line' : 'ri-eye-off-line'}"></i></button>`;
  },

  /** Finestra a tutto schermo con lo stadio: ruota in ogni direzione, zoom (due dita, rotella o + / −) e spostamento. */
  _openZoom() {
    if (this._zoom) return;
    // esterno nascosto anche nell'anteprima sotto, che resta uguale quando si chiude lo zoom
    this._zoom = openStadiumOverlay(this._st, { logo: this._logo(), night: this._night, hideExterior: this._hideExt,
      onExterior: (hide) => this._setExterior(hide), onClose: () => { this._zoom = null; } });
  },

  _setExterior(hide) {
    this._hideExt = !!hide;
    if (this._viewer) this._viewer.setExterior(!this._hideExt);
    const old = this._root && this._root.querySelector('.std-ext-btn');
    if (old) old.outerHTML = this._extBtn();
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
      case 'exterior': this._setExterior(!this._hideExt); return;
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
        const value = k === 'rings' || k === 'ringsEnds' || k === 'standTextRing' ? Number(v) : ['track', 'ramps', 'boxes', 'horseshoe', 'vomitories', 'domeTeeth'].includes(k) ? v === '1' : v;
        // "Ogni settore e anello": si parte dai colori che lo stadio ha adesso
        if (k === 'seatMode' && v === 'grid' && this._st.seatMode !== 'grid') this._update(st => { st.seatGrid = seatGridFrom(st); st.seatMode = 'grid'; });
        else if (k === 'entrance' && v !== 'none') this._update(st => {
          // primo ingresso scelto: il logo della squadra va subito sopra (si può togliere)
          if (st.entrance === 'none' && this._logo() && !st.logoPlaces.includes('entrance')) st.logoPlaces = LOGO_PLACES.map(o => o.id).filter(id => id === 'entrance' || st.logoPlaces.includes(id));
          st.entrance = v;
          // almeno un lato dove può stare (sul Vélodrome la curva sinistra)
          const skip = entranceSkips(st);
          if (!st.entranceSides.some((on, i) => on && !skip[i])) { const free = SEAT_SIDES.map(sd => sd.id).find(i => !skip[i]); if (free !== undefined) st.entranceSides[free] = true; }
        });
        else this._update(st => { st[k] = value; });
        return;
      }
      case 'swatch':
        this._update(() => this._set(btn.dataset.path, v));
        return;
      case 'ringsSide':
        this._update(st => { st.ringsSides[Number(btn.dataset.side)] = Number(v); });
        return;
      case 'rakeEach':
        // settore per settore: si parte dalla pendenza di adesso
        this._update(st => { st.rakeEach = v === '1'; if (st.rakeEach) st.rakeSides = st.rakeSides.map(() => st.rake); });
        return;
      case 'mosaicD':
        this._update(st => { st.colors.mosaicD = v === '1' ? (st.colors.mosaicD || '#ffd400') : ''; });
        return;
      case 'roofMix':
        this._update(st => { st.roofSides[Number(btn.dataset.side)] = v; });
        return;
      case 'roofSide':
        this._update(st => { st.roofSectors[Number(v)] = !st.roofSectors[Number(v)]; });
        return;
      case 'entSide':
        this._update(st => { st.entranceSides[Number(v)] = !st.entranceSides[Number(v)]; });
        return;
      case 'entLogo':
        this._update(st => {
          const on = new Set(st.logoPlaces);
          if (v === '1') on.add('entrance'); else on.delete('entrance');
          st.logoPlaces = LOGO_PLACES.map(o => o.id).filter(id => on.has(id));
        });
        return;
      case 'entImgClear':
        this._update(st => { st.entranceImage = ''; });
        return;
      case 'logoPlace':
        this._update(st => {
          const on = new Set(st.logoPlaces);
          if (on.has(v)) on.delete(v); else on.add(v);
          st.logoPlaces = LOGO_PLACES.map(o => o.id).filter(id => on.has(id));
        });
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
    } else if (t.dataset.range) {
      // mentre trascino aggiorno solo il numero accanto al cursore (lo stadio si ricostruisce quando lascio)
      const out = this._root.querySelector(`[data-range-out="${t.dataset.range}"]`), v = Number(t.value);
      if (out) out.textContent = { standGap: `+${v} m`, endGap: `+${v} m`, cornerGap: `${Math.round(v / 18 * 100)}%`, entranceWidth: `${v} m`, entranceHeight: `${v} m`, roofWaves: `${v}` }[t.dataset.range] || `${v}%`;
    } else if (t.dataset.num) {
      // capienza: solo cifre (anche scritta con i punti delle migliaia)
      const n = Math.min(MAX_CAPACITY, Number(t.value.replace(/\D/g, '')) || 0);
      if (n) { this._set(t.dataset.num, n); this._schedulePreview(); }
    }
  },

  _onChange(e) {
    const t = e.target;
    if (t.dataset.upload === 'entrance' && t.files && t.files[0]) { this._uploadEntrance(t.files[0]); t.value = ''; return; }
    if (t.dataset.range) {
      const k = t.dataset.range, v = Number(t.value);
      // l'ondulazione da zero (o a zero) mostra o nasconde gli altri cursori
      const was = k === 'roofWave' ? this._st.roofWave : null;
      this._update(() => this._set(k, v), { section: k === 'roofWave' && !was !== !v });
      return;
    }
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

  /**
   * Immagine personale degli ingressi: si vede subito (anteprima locale), intanto si carica su ImgBB e poi si salva il
   * suo indirizzo. Il salvataggio dello stadio aspetta il caricamento.
   */
  _uploadEntrance(file) {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { window.showToast('Serve un\'immagine PNG, JPG o WEBP', 'err'); return; }
    const job = (async () => {
      const url = URL.createObjectURL(file);
      try {
        const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
        const k = Math.min(1, 1024 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const local = c.toDataURL('image/png');
        this._update(st => { st.entranceImage = local; });
        window.showToast('Caricamento dell\'immagine...', 'ok');
        const blob = await new Promise(r => c.toBlob(r, 'image/png'));
        const remote = await uploadPngToImgBB(new File([blob], 'ingresso.png', { type: 'image/png' }), 1024);
        if (this._st && this._st.entranceImage === local) this._update(st => { st.entranceImage = remote; }, { section: false });
      } catch (err) {
        console.error(err);
        window.showToast('Immagine non caricata, riprova', 'err');
        if (this._st && /^data:/.test(this._st.entranceImage)) this._update(st => { st.entranceImage = ''; });
      } finally { URL.revokeObjectURL(url); }
    })();
    this._entUpload = job;
  },

  async _save() {
    if (this._busy || !this._st) return;
    if (this._entUpload) { await this._entUpload; this._entUpload = null; }
    if (!this._st || /^data:/.test(this._st.entranceImage)) { if (this._st) window.showToast('Immagine dell\'ingresso non ancora caricata, riprova', 'err'); return; }
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
        const dataUrl = await renderStadiumImage(st, { width: 1300, logo: team.logo || '' });
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
