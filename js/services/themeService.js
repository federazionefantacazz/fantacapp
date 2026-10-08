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
 *     menuPanel: { title, text, sub, label, btn, btnText },       // pannelli del menu
 *     login | home | calendario | classifica | formazione |
 *     mercato | teams | live | patron:
 *                { title, text, sub, label, btn, btnText }
 *   }
 *
 * Ogni pagina ha un proprio "scope" CSS (selector): le variabili impostate per una
 * pagina valgono SOLO dentro quella pagina; quelle non impostate ereditano da "general".
 *
 * - page.key  = chiave della pagina nel tema
 * - field.key = chiave del tipo dentro la pagina
 * - field.css = nome esatto della variabile CSS usata nei fogli di stile
 * - kind      = 'color' (HEX, con color picker) | 'text' (valore libero, es. rgba(...))
 */

/* Tipi comuni a tutte le pagine di contenuto */
const TYPE_TITLE    = { key: 'title',   css: '--title',            kind: 'color', def: '#94a3b8', label: 'Titoli',             hint: 'Titoli di sezione (vuoto = come Sottotesti)' };
const TYPE_TEXT     = { key: 'text',    css: '--text',             kind: 'color', def: '#e2e8f0', label: 'Testi',              hint: 'Testo principale' };
const TYPE_SUB      = { key: 'sub',     css: '--text2',            kind: 'color', def: '#94a3b8', label: 'Sottotesti',         hint: 'Descrizioni, dettagli secondari' };
const TYPE_LABEL    = { key: 'label',   css: '--label',            kind: 'color', def: '#94a3b8', label: 'Label',              hint: 'Etichette dei campi e dei riquadri (vuoto = come Sottotesti)' };
const TYPE_BTN      = { key: 'btn',     css: '--btn-primary',      kind: 'color', def: '#50e3c2', label: 'Pulsanti',           hint: 'Sfondo del pulsante principale (vuoto = come Evidenza principale)' };
const TYPE_BTN_TEXT = { key: 'btnText', css: '--btn-primary-text', kind: 'color', def: '#0a0f1e', label: 'Testi dei pulsanti', hint: 'Testo sul pulsante principale' };

const CONTENT_TYPES = [TYPE_TITLE, TYPE_TEXT, TYPE_SUB, TYPE_LABEL, TYPE_BTN, TYPE_BTN_TEXT];

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
    { key: 'text3',            css: '--text3',              kind: 'color', def: '#5b6b80', hint: 'Testo disattivato, segnaposto' },
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
    { key: 'roleA', css: '--role-a', kind: 'color', def: '#ff4757', hint: 'Badge ruolo Attaccante' }
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
    key: 'nav', label: 'Barra in basso', selector: '#nav',
    desc: 'Navigazione principale (Home, Calendario, Classifica, ...).',
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
  { key: 'menuPanel', label: 'Pannelli del menu', selector: '#menu-panel',
    desc: 'Impostazioni, configurazione squadra, listone, svincolati.', fields: CONTENT_TYPES },
  { key: 'login',       label: 'Login',        selector: '#page-login',       desc: 'Accesso e scelta squadra.',   fields: CONTENT_TYPES },
  { key: 'home',        label: 'Home',         selector: '#page-home',        desc: 'Schermata principale.',       fields: CONTENT_TYPES },
  { key: 'calendario',  label: 'Calendario',   selector: '#page-calendario',  desc: 'Calendario incontri.',        fields: CONTENT_TYPES },
  { key: 'classifica',  label: 'Classifica',   selector: '#page-classifica',  desc: 'Classifica e tabellone.',     fields: CONTENT_TYPES },
  { key: 'formazione',  label: 'Formazione',   selector: '#page-formazione',  desc: 'Schieramento formazione.',    fields: CONTENT_TYPES },
  { key: 'mercato',     label: 'Mercato',      selector: '#page-mercato',     desc: 'Scambi e prestiti.',          fields: CONTENT_TYPES },
  { key: 'teams',       label: 'Squadre',      selector: '#page-teams',       desc: 'Elenco squadre e scheda club.', fields: CONTENT_TYPES },
  { key: 'live',        label: 'Live',         selector: '#page-live',        desc: 'Partita in diretta.',         fields: CONTENT_TYPES },
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
    const decls = page.fields
      .filter(f => values[f.key] && sanitize(values[f.key]))
      .map(f => `${f.css}: ${sanitize(values[f.key])};`);
    if (decls.length) blocks.push(`${page.selector} { ${decls.join(' ')} }`);
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

  if (!clean) {
    layer.classList.remove('on');
    layer.style.backgroundImage = 'none';
    return;
  }

  const safe = clean.replace(/['"\\()\s]/g, ch => '%' + ch.charCodeAt(0).toString(16).toUpperCase());

  // Precarico l'immagine: niente flash/scatti e nessun sfondo "a metà" sui dispositivi lenti
  const img = new Image();
  img.onload = () => {
    if (token !== bgToken) return; // nel frattempo è arrivato un altro sfondo
    layer.style.backgroundImage = `url("${safe}")`;
    layer.classList.add('on');
  };
  img.onerror = () => {
    if (token !== bgToken) return;
    layer.classList.remove('on');
    layer.style.backgroundImage = 'none';
  };
  img.src = clean;
}
