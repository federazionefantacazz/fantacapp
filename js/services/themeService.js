/**
 * Servizio condiviso per i temi (app principale + pagina Patron).
 * Unica fonte di verità per: struttura del tema, costruzione del CSS dinamico
 * e gestione dello sfondo della competizione.
 *
 * STRUTTURA DEL TEMA (Firebase: competitions/{id}/theme, versione 2)
 *
 *   {
 *     v: 2,
 *     general:   { ...superfici, evidenze, ruoli, tipi base },   // base di tutte le pagine
 *     header:    { bg, text },                                    // barra in alto
 *     nav:       { bg, text, btn },                               // barra in basso
 *     drawer:    { bg, title, text, sub },                        // menu laterale
 *     menuPanel | menuSettings | menuTeam | menuKit | menuListone | menuSvincolati:
 *                { bg, title, text, sub, text3, label, btn, btnText }     // pannelli del menu
 *     liveEditor | matchViewer | formPicker | playerCard:
 *                { bg, title, text, sub, text3, label, btn, btnText }     // finestre sopra le pagine
 *     login | home | calendario | classifica | formazione |
 *     mercato | teams | live | patron:
 *                { title, text, sub, text3, label, btn, btnText }
 *   }
 *
 * Ogni pagina ha un proprio "scope" CSS (selector): le variabili impostate per una
 * pagina valgono SOLO dentro quella pagina; quelle non impostate ereditano da "general".
 *
 * - page.key  = chiave della pagina nel tema
 * - field.key = chiave del tipo dentro la pagina
 * - field.css = nome esatto della variabile CSS usata nei fogli di stile
 * - kind      = 'color' (HEX, con color picker) | 'text' (valore libero, es. rgba(...))
 *               | 'font' (chiave di THEME_FONTS, scelta da menu a tendina)
 */

/* Font selezionabili dal Patron. Il tema salva la chiave, non il CSS.
   I file dei font sono in /fonts, dichiarati con @font-face in index.html e admin.html. */
export const THEME_FONTS = [
  { key: 'default', label: 'Font default (DM Sans)', css: "'DM Sans', sans-serif" },
  { key: 'pirates', label: 'Pirates of Cydonia',     css: "'Pirates of Cydonia', 'DM Sans', sans-serif" }
];

/* Tipi comuni a tutte le pagine di contenuto */
const TYPE_TITLE    = { key: 'title',   css: '--title',            kind: 'color', def: '#94a3b8', label: 'Titoli',             hint: 'Titoli di sezione (vuoto = come Sottotesti)' };
const TYPE_TEXT     = { key: 'text',    css: '--text',             kind: 'color', def: '#e2e8f0', label: 'Testi',              hint: 'Testo principale' };
const TYPE_FONT     = { key: 'font',    css: '--font-text',        kind: 'font',  def: '',        label: 'Font dei testi',     hint: 'Font del testo della pagina (vuoto = come Generale)' };
const TYPE_SUB      = { key: 'sub',     css: '--text2',            kind: 'color', def: '#94a3b8', label: 'Sottotesti',         hint: 'Descrizioni, dettagli secondari' };
const TYPE_TEXT3    = { key: 'text3',   css: '--text3',            kind: 'color', def: '#5b6b80', label: 'Testi disattivati',  hint: 'Testo disattivato, segnaposto, note secondarie' };
const TYPE_LABEL    = { key: 'label',   css: '--label',            kind: 'color', def: '#94a3b8', label: 'Label',              hint: 'Etichette dei campi e dei riquadri (vuoto = come Sottotesti)' };
const TYPE_BTN      = { key: 'btn',     css: '--btn-primary',      kind: 'color', def: '#50e3c2', label: 'Pulsanti',           hint: 'Sfondo del pulsante principale (vuoto = come Evidenza principale)' };
const TYPE_BTN_TEXT = { key: 'btnText', css: '--btn-primary-text', kind: 'color', def: '#0a0f1e', label: 'Testi dei pulsanti', hint: 'Testo sul pulsante principale' };

const CONTENT_TYPES = [TYPE_TITLE, TYPE_TEXT, TYPE_FONT, TYPE_SUB, TYPE_TEXT3, TYPE_LABEL, TYPE_BTN, TYPE_BTN_TEXT];

/* Sfondo dei pannelli del menu: sotto il colore c'è lo sfondo della competizione,
   quindi un colore trasparente (rgba) lo lascia vedere come nelle altre pagine */
const MENU_BG  = { key: 'bg', css: '--menu-bg', kind: 'text', def: '#1a1e24', label: 'Sfondo',
  hint: 'Colore di sfondo (vuoto = come Sfondo pagina). Con un rgba trasparente si vede lo sfondo della competizione' };
/* Sfondo delle finestre che si aprono sopra le pagine */
const SHEET_BG = { key: 'bg', css: '--bg', kind: 'color', def: '#1a1e24', label: 'Sfondo', hint: 'Sfondo della finestra (vuoto = come Sfondo pagina)' };

const withGroup = (group, fields) => fields.map(f => ({ ...f, group }));

/* Solo in "general": superfici, evidenze, ruoli, pulsanti secondari */
const GENERAL_ONLY_FIELDS = [
  ...withGroup('Sfondi e superfici', [
    { key: 'bg',      css: '--bg',         kind: 'color', def: '#1a1e24',                hint: 'Sfondo pagina' },
    { key: 'bg2',     css: '--bg2',        kind: 'color', def: '#22272f',                hint: 'Superficie secondaria (mini-card, selettori, tab)' },
    { key: 'bg3',     css: '--bg3',        kind: 'color', def: '#2b323c',                hint: 'Campi input' },
    { key: 'card',    css: '--card',       kind: 'color', def: '#282e37',                hint: 'Schede' },
    { key: 'card2',   css: '--card2',      kind: 'color', def: '#333a46',                hint: 'Righe e sub-box dentro le schede' },
    { key: 'subbox',  css: '--subbox-bg',  kind: 'text',  def: 'rgba(0,0,0,0.25)',       hint: 'Pannelli trasparenti (home e classifica)' },
    { key: 'border',  css: '--border',     kind: 'text',  def: 'rgba(255,255,255,0.08)', hint: 'Bordi, righe e separatori' }
  ]),
  ...withGroup('Altri testi e pulsanti', [
    { key: 'btnSecondary',     css: '--btn-secondary',      kind: 'color', def: '#3a4352', hint: 'Pulsante secondario' },
    { key: 'btnSecondaryText', css: '--btn-secondary-text', kind: 'color', def: '#e2e8f0', hint: 'Testo sul pulsante secondario' },
    { key: 'btnOutline',       css: '--btn-outline',        kind: 'color', def: '#94a3b8', hint: 'Pulsante con solo bordo (testo e bordo)' }
  ]),
  ...withGroup('Evidenze (dati, non pulsanti)', [
    { key: 'accent',  css: '--accent',  kind: 'color', def: '#50e3c2', hint: 'Evidenza principale: punti, selezioni, interruttori' },
    { key: 'accent2', css: '--accent2', kind: 'color', def: '#5b9dff', hint: 'Evidenza secondaria / informazioni' },
    { key: 'accent3', css: '--accent3', kind: 'color', def: '#ff6b6b', hint: 'Errore e Live' },
    { key: 'gold',    css: '--gold',    kind: 'color', def: '#f5a623', hint: 'Oro (trofei, qualificazioni)' }
  ]),
  ...withGroup('Ruoli giocatori', [
    { key: 'roleP', css: '--role-p', kind: 'color', def: '#4a5568', hint: 'Badge ruolo Portiere' },
    { key: 'roleD', css: '--role-d', kind: 'color', def: '#0077ff', hint: 'Badge ruolo Difensore' },
    { key: 'roleC', css: '--role-c', kind: 'color', def: '#00e5a0', hint: 'Badge ruolo Centrocampista' },
    { key: 'roleA', css: '--role-a', kind: 'color', def: '#ff4757', hint: 'Badge ruolo Attaccante' },
    { key: 'roleTextP', css: '--role-p-text', kind: 'color', def: '#ffffff', hint: 'Testo nel badge Portiere' },
    { key: 'roleTextD', css: '--role-d-text', kind: 'color', def: '#ffffff', hint: 'Testo nel badge Difensore' },
    { key: 'roleTextC', css: '--role-c-text', kind: 'color', def: '#0a0f1e', hint: 'Testo nel badge Centrocampista' },
    { key: 'roleTextA', css: '--role-a-text', kind: 'color', def: '#ffffff', hint: 'Testo nel badge Attaccante' }
  ])
];

export const THEME_PAGES = [
  {
    key: 'general', label: 'Generale', selector: ':root',
    desc: 'Base di tutta l\'app: ogni pagina eredita da qui i valori che non imposti nella sua scheda.',
    fields: [...withGroup('Tipi base', CONTENT_TYPES), ...GENERAL_ONLY_FIELDS]
  },
  {
    key: 'header', label: 'Barra in alto', selector: '#app-header, .mp-head',
    desc: 'Barra con selettore competizione e pulsante menu (e testata dei pannelli del menu).',
    fields: [
      { key: 'bg',   css: '--header-bg', kind: 'text',  def: 'rgba(18,22,28,0.80)', label: 'Sfondo',          hint: 'Sfondo della barra' },
      { key: 'text', css: '--bar-text',  kind: 'color', def: '#e2e8f0',             label: 'Testi e icone',   hint: 'Testo, selettore e icone' }
    ]
  },
  {
    key: 'nav', label: 'Barra in basso', selector: '#nav, #status-bar',
    desc: 'Navigazione principale (Home, Calendario, Classifica, ...). Lo sfondo colora anche la fascia in alto sotto l\'ora su iPhone.',
    fields: [
      { key: 'bg',   css: '--nav-bg',       kind: 'color', def: '#13171c', label: 'Sfondo',               hint: 'Sfondo della barra (vuoto = automatico, più scuro dello sfondo)' },
      { key: 'text', css: '--nav-inactive', kind: 'color', def: '#6b7a90', label: 'Testi (tab inattivo)', hint: 'Testo e icona dei tab non selezionati' },
      { key: 'btn',  css: '--nav-active',   kind: 'color', def: '#50e3c2', label: 'Pulsanti (tab attivo)', hint: 'Tab selezionato (vuoto = come Evidenza principale)' }
    ]
  },
  {
    key: 'drawer', label: 'Menu laterale', selector: '#side-menu',
    desc: 'Menu che si apre dall\'hamburger.',
    fields: [
      { key: 'bg',    css: '--drawer-bg', kind: 'color', def: '#171b21', label: 'Sfondo',      hint: 'Sfondo del menu (vuoto = automatico)' },
      { key: 'title', css: '--title',     kind: 'color', def: '#e2e8f0', label: 'Titoli',      hint: 'Titolo "Menu" (vuoto = come Testi)' },
      { key: 'text',  css: '--bar-text',  kind: 'color', def: '#e2e8f0', label: 'Testi',       hint: 'Voci del menu' },
      { key: 'sub',   css: '--text2',     kind: 'color', def: '#94a3b8', label: 'Sottotesti',  hint: 'Icone delle voci' }
    ]
  },
  {
    key: 'cards', label: 'Card', selector: '.card, .card-mini, .mp-card',
    desc: 'Tutte le schede e le card (partite, squadre, pannelli, banner). Valgono solo dentro le card: lo sfondo pagina e i testi fuori dalle card restano quelli di Generale.',
    fields: [
      { key: 'bg',     css: '--card',        kind: 'color', def: '#282e37',                hint: 'Sfondo delle schede (vuoto = come Generale)', label: 'Sfondo' },
      { key: 'mini',   css: '--mini-bg',     kind: 'color', def: '#22272f',                hint: 'Sfondo di partite, squadre, selettore turno, banner (vuoto = come Superficie secondaria)', label: 'Sfondo card piccole' },
      { key: 'rows',   css: '--card2',       kind: 'color', def: '#333a46',                hint: 'Righe e sub-box dentro le card', label: 'Righe interne' },
      { key: 'inner',  css: '--bg3',         kind: 'color', def: '#2b323c',                hint: 'Selettori, campi, riquadro punteggio, segnaposto loghi', label: 'Campi e segnaposto' },
      { key: 'border', css: '--border',      kind: 'text',  def: 'rgba(255,255,255,0.08)', hint: 'Bordi e separatori dentro le card', label: 'Bordo' },
      { ...TYPE_TITLE },
      { ...TYPE_TEXT },
      { ...TYPE_FONT },
      { ...TYPE_SUB },
      { ...TYPE_TEXT3 },
      { ...TYPE_LABEL },
      { key: 'accent', css: '--accent',      kind: 'color', def: '#50e3c2',                hint: 'VS, punteggi, nomi dei proprietari, selezioni', label: 'Evidenze' },
      { key: 'gold',   css: '--gold',        kind: 'color', def: '#f5a623',                hint: 'Etichette girone/playoff, trofei', label: 'Oro' },
      { ...TYPE_BTN },
      { ...TYPE_BTN_TEXT }
    ]
  },
  { key: 'menuPanel', label: 'Pannelli del menu', selector: '#menu-panel',
    desc: 'Base di tutti i pannelli del menu (impostazioni, configurazione squadra, divisa, listone, svincolati): ognuno può poi essere specializzato nella sua scheda.',
    fields: [MENU_BG, ...CONTENT_TYPES] },
  { key: 'menuSettings',   label: 'Impostazioni',            selector: '#menu-panel[data-view="settings"]',
    desc: 'Pannello Impostazioni applicazione (vuoto = come Pannelli del menu).', fields: [MENU_BG, ...CONTENT_TYPES] },
  { key: 'menuTeam',       label: 'Configurazione squadra',  selector: '#menu-panel[data-view="team"]',
    desc: 'Pannello Configurazione squadra (vuoto = come Pannelli del menu).', fields: [MENU_BG, ...CONTENT_TYPES] },
  { key: 'menuKit',        label: 'Divisa squadra',          selector: '#menu-panel[data-view="kit"]',
    desc: 'Pannello Divisa squadra (vuoto = come Pannelli del menu).', fields: [MENU_BG, ...CONTENT_TYPES] },
  { key: 'menuListone',    label: 'Listone',                 selector: '#menu-panel[data-view="listone"]',
    desc: 'Pannello Listone (vuoto = come Pannelli del menu).', fields: [MENU_BG, ...CONTENT_TYPES] },
  { key: 'menuSvincolati', label: 'Svincolati',              selector: '#menu-panel[data-view="svincolati"]',
    desc: 'Pannello Svincolati (vuoto = come Pannelli del menu).', fields: [MENU_BG, ...CONTENT_TYPES] },
  { key: 'login',       label: 'Login',        selector: '#page-login',       desc: 'Accesso e scelta squadra.',
    fields: [
      ...CONTENT_TYPES,
      { key: 'inputBg',          css: '--input-bg',          kind: 'text',  def: '#22272f',               label: 'Sfondo campi',       hint: 'Sfondo dei campi email, password e scelta squadra (vuoto = come Superficie secondaria)' },
      { key: 'inputText',        css: '--input-text',        kind: 'color', def: '#94a3b8',               label: 'Testo campi',        hint: 'Testo scritto nei campi e icona "mostra password" (vuoto = come Sottotesti)' },
      { key: 'inputPlaceholder', css: '--input-placeholder', kind: 'color', def: '#5b6b80',               label: 'Segnaposto campi',   hint: 'Testo di esempio nei campi vuoti (vuoto = come Testi disattivati)' },
      { key: 'inputBorder',      css: '--input-border',      kind: 'text',  def: 'rgba(255,255,255,0.15)', label: 'Bordo campi',       hint: 'Bordo dei campi (quando selezionati usano Evidenza principale)' }
    ] },
  { key: 'home',        label: 'Home',         selector: '#page-home',        desc: 'Schermata principale.',       fields: CONTENT_TYPES },
  { key: 'calendario',  label: 'Calendario',   selector: '#page-calendario, #cal-popup',  desc: 'Calendario incontri.',        fields: CONTENT_TYPES },
  { key: 'classifica',  label: 'Classifica',   selector: '#page-classifica',  desc: 'Classifica e tabellone.',     fields: CONTENT_TYPES },
  { key: 'formazione',  label: 'Formazione',   selector: '#page-formazione',  desc: 'Schieramento formazione.',    fields: CONTENT_TYPES },
  { key: 'mercato',     label: 'Mercato',      selector: '#page-mercato',     desc: 'Scambi e prestiti.',          fields: CONTENT_TYPES },
  { key: 'teams',       label: 'Squadre',      selector: '#page-teams',       desc: 'Elenco squadre e scheda club.', fields: CONTENT_TYPES },
  { key: 'live',        label: 'Live',         selector: '#page-live',        desc: 'Partita in diretta.',         fields: CONTENT_TYPES },
  { key: 'liveEditor',  label: 'Modifica voto (Live)', selector: '#lv-editor',
    desc: 'Finestra per simulare voto e bonus di un giocatore nel Live.', fields: [SHEET_BG, ...CONTENT_TYPES] },
  { key: 'matchViewer', label: 'Partita (replay)',     selector: '#match-viewer',
    desc: 'Replay delle giornate passate e formazioni schierate (aperto da Home e Calendario).', fields: [SHEET_BG, ...CONTENT_TYPES] },
  { key: 'formPicker',  label: 'Scelta giocatore',     selector: '.fp-overlay',
    desc: 'Finestra di scelta del giocatore in Formazione (con le probabili formazioni).', fields: [SHEET_BG, ...CONTENT_TYPES] },
  { key: 'playerCard',  label: 'Scheda giocatore',     selector: '#pc-overlay',
    desc: 'Scheda con statistiche e voti del giocatore (si apre toccando un giocatore).',
    fields: [SHEET_BG, ...CONTENT_TYPES, { key: 'accent', css: '--accent', kind: 'color', def: '#50e3c2', label: 'Evidenze', hint: 'Media, selezione giornata, alone della foto (vuoto = come Generale)' }] },
  { key: 'patron',      label: 'Patron',       selector: 'body.page-patron',  desc: 'Pannello Patron (admin.html).', fields: CONTENT_TYPES }
];

/* ------------------------------------------------------------------------ *
 * COMPATIBILITÀ: i temi salvati prima della versione 2 sono "piatti"
 * ({ bg, accent, onAccent, headerBg, ... }). Vengono convertiti al volo,
 * senza toccare il DB: al primo salvataggio dal Patron passano al nuovo formato.
 * ------------------------------------------------------------------------ */
const LEGACY_MAP = {
  // chiave storica -> [pagina, chiave nuova]
  bg: ['general', 'bg'], bg2: ['general', 'bg2'], bg3: ['general', 'bg3'],
  card: ['general', 'card'], card2: ['general', 'card2'],
  subbox: ['general', 'subbox'], border: ['general', 'border'],
  text: ['general', 'text'], text2: ['general', 'sub'], text3: ['general', 'text3'],
  accent: ['general', 'accent'], accent2: ['general', 'accent2'], accent3: ['general', 'accent3'], gold: ['general', 'gold'],
  roleP: ['general', 'roleP'], roleD: ['general', 'roleD'], roleC: ['general', 'roleC'], roleA: ['general', 'roleA'],
  btnPrimary: ['general', 'btn'], onAccent: ['general', 'btnText'],
  btnSecondary: ['general', 'btnSecondary'], btnSecondaryText: ['general', 'btnSecondaryText'], btnOutline: ['general', 'btnOutline'],
  headerBg: ['header', 'bg'], navBg: ['nav', 'bg'], drawerBg: ['drawer', 'bg'],
  navInactive: ['nav', 'text'], navActive: ['nav', 'btn']
};

export const THEME_VERSION = 2;

function migrateLegacyTheme(old) {
  const out = { v: THEME_VERSION };
  const put = (page, key, val) => { (out[page] = out[page] || {})[key] = val; };
  Object.keys(LEGACY_MAP).forEach(k => {
    if (old[k]) put(...LEGACY_MAP[k], old[k]);
  });
  // barText era unico per tutte le barre
  if (old.barText) { put('header', 'text', old.barText); put('drawer', 'text', old.barText); }
  return out;
}

/** Restituisce sempre un tema in formato v2 (o null se vuoto). */
export function normalizeTheme(theme) {
  if (!theme || typeof theme !== 'object') return null;
  if (Number(theme.v) === THEME_VERSION) return theme;
  const migrated = migrateLegacyTheme(theme);
  return Object.keys(migrated).length > 1 ? migrated : null;
}

/** Rimuove i caratteri che potrebbero uscire dalla dichiarazione CSS. */
function sanitize(value) {
  return String(value).replace(/[;{}<>\\]/g, '').trim();
}

/** Costruisce un blocco CSS per ogni pagina, con le sole variabili valorizzate nel tema. */
export function buildThemeCss(rawTheme) {
  const theme = normalizeTheme(rawTheme);
  if (!theme) return '';
  const blocks = [];
  THEME_PAGES.forEach(page => {
    const values = theme[page.key];
    if (!values || typeof values !== 'object') return;
    const decls = [];
    let font = null;
    page.fields.forEach(f => {
      if (!values[f.key]) return;
      if (f.kind === 'font') {
        font = THEME_FONTS.find(x => x.key === values[f.key]);
        if (font) decls.push(`${f.css}: ${font.css};`, 'font-family: var(--font-text);');
        return;
      }
      const v = sanitize(values[f.key]);
      if (v) decls.push(`${f.css}: ${v};`);
    });
    if (decls.length) blocks.push(`${page.selector} { ${decls.join(' ')} }`);
    // pulsanti e campi non ereditano il font dal browser: si allineano a quello scelto
    if (font) {
      const scoped = page.selector.split(',').map(s => s.trim())
        .map(s => `${s} :is(button, input, select, textarea)`).join(', ');
      blocks.push(`${scoped} { font-family: var(--font-text); }`);
    }
  });
  return blocks.join('\n');
}

/** Applica un CSS già costruito nel tag <style id="dynamic-theme">. */
export function applyThemeCss(css) {
  let tag = document.getElementById('dynamic-theme');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'dynamic-theme';
    document.head.appendChild(tag);
  }
  tag.textContent = css || '';
  syncStatusBarColor();
}

/**
 * Allinea il meta "theme-color" (barra del browser / status bar) al colore della barra in basso.
 * Il colore calcolato può essere color-mix(...) o color(srgb ...): passa da un canvas per avere un #rrggbb.
 */
export function syncStatusBarColor() {
  const bar = document.getElementById('status-bar');
  if (!bar) return;
  try {
    const computed = getComputedStyle(bar).backgroundColor;
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillStyle = computed;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    const hex = '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = hex;
  } catch (e) { /* resta il colore di default */ }
}

/** Applica (o rimuove) il tema e ritorna il CSS generato (utile per salvarlo in cache). */
export function applyThemeVars(theme) {
  const css = buildThemeCss(theme);
  applyThemeCss(css);
  return css;
}

/* ------------------------------------------------------------------------ *
 * TEMA PER UTENTE
 * Il tema (e lo sfondo) dell'ultima competizione vista viene salvato sul
 * dispositivo legato all'utente, come le impostazioni: all'avvio si riapplica
 * subito, senza il "flash" del tema di default in attesa di Firebase.
 *  - fantacapp-theme-{uid}   = { comp, css, bg }
 *  - fantacapp-last-uid      = ultimo utente loggato (letto dallo script nell'<head>
 *                              di index.html, prima ancora che l'app parta)
 * ------------------------------------------------------------------------ */
export const THEME_CACHE_PREFIX = 'fantacapp-theme-';
export const LAST_UID_KEY = 'fantacapp-last-uid';

export function getCachedUserTheme(uid) {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(THEME_CACHE_PREFIX + uid);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

/** Aggiorna solo i campi passati (comp, css, bg) mantenendo gli altri. */
export function cacheUserTheme(uid, patch) {
  if (!uid) return;
  try {
    const prev = getCachedUserTheme(uid) || {};
    localStorage.setItem(THEME_CACHE_PREFIX + uid, JSON.stringify({ ...prev, ...patch }));
  } catch (e) { /* storage non disponibile: si resta sul DB */ }
}

/* ------------------------------------------------------------------------ *
 * SFONDO COMPETIZIONE
 * Livello fisso dietro ai contenuti (al posto di background-attachment:fixed
 * sul body, che su iOS/Android è inaffidabile) e SENZA gradiente sopra.
 * - schermi stretti/alti (telefoni): cover, ancorato in basso
 *   (nelle grafiche verticali la parte alta è quella sacrificabile)
 * - schermi larghi (tablet/desktop): immagine a tutta altezza, centrata
 * ------------------------------------------------------------------------ */
const BG_STYLE_ID = 'bg-layer-style';
const BG_LAYER_ID = 'bg-layer';
let bgToken = 0;

function ensureBgLayer() {
  if (!document.getElementById(BG_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = BG_STYLE_ID;
    style.textContent = `
      #${BG_LAYER_ID} {
        position: fixed;
        top: 0; right: 0; bottom: 0; left: 0;
        z-index: -1;
        pointer-events: none;
        background-color: var(--bg);
        background-repeat: no-repeat;
        background-position: center bottom;
        background-size: cover;
        opacity: 0;
        transition: opacity .3s ease-in-out;
        -webkit-transform: translateZ(0);
        transform: translateZ(0);
      }
      #${BG_LAYER_ID}.on { opacity: 1; }
      @media (min-aspect-ratio: 3/5) {
        #${BG_LAYER_ID} { background-size: auto 100%; }
      }
    `;
    document.head.appendChild(style);
  }
  let layer = document.getElementById(BG_LAYER_ID);
  if (!layer) {
    layer = document.createElement('div');
    layer.id = BG_LAYER_ID;
    document.body.insertBefore(layer, document.body.firstChild);
  }
  return layer;
}

/** Imposta lo sfondo della competizione. URL vuoto = nessuno sfondo. */
export function applyBackground(url) {
  const layer = ensureBgLayer();
  const clean = (typeof url === 'string') ? url.trim() : '';
  const token = ++bgToken;

  // Lo stesso sfondo è disponibile come variabile CSS (--comp-bg-image) per i pannelli
  // a schermo intero che coprono il livello di sfondo (es. pannelli del menu)
  const rootStyle = document.documentElement.style;

  if (!clean) {
    layer.classList.remove('on');
    layer.style.backgroundImage = 'none';
    rootStyle.setProperty('--comp-bg-image', 'none');
    return;
  }

  const safe = clean.replace(/['"\\()\s]/g, ch => '%' + ch.charCodeAt(0).toString(16).toUpperCase());

  // Precarico l'immagine: niente flash/scatti e nessun sfondo "a metà" sui dispositivi lenti
  const img = new Image();
  img.onload = () => {
    if (token !== bgToken) return; // nel frattempo è arrivato un altro sfondo
    layer.style.backgroundImage = `url("${safe}")`;
    layer.classList.add('on');
    rootStyle.setProperty('--comp-bg-image', `url("${safe}")`);
  };
  img.onerror = () => {
    if (token !== bgToken) return;
    layer.classList.remove('on');
    layer.style.backgroundImage = 'none';
    rootStyle.setProperty('--comp-bg-image', 'none');
  };
  img.src = clean;
}
