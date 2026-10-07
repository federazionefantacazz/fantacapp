/**
 * Servizio condiviso per i temi (app principale + pagina Patron).
 * Unica fonte di verità per: elenco variabili CSS personalizzabili,
 * costruzione del CSS dinamico e gestione dello sfondo della competizione.
 *
 * - key  = chiave salvata su Firebase in competitions/{id}/theme  (NON cambiarle: retrocompatibilità)
 * - css  = nome esatto della variabile CSS usata nei fogli di stile
 * - kind = 'color' (HEX, con color picker) | 'text' (valore libero, es. rgba(...))
 */
export const THEME_VARS = [
  // --- 1. Sfondi e superfici ---
  { key: 'bg',          css: '--bg',                 kind: 'color', def: '#1a1e24', hint: 'Sfondo pagina' },
  { key: 'bg2',         css: '--bg2',                kind: 'color', def: '#22272f', hint: 'Superficie secondaria (mini-card, selettori, tab)' },
  { key: 'bg3',         css: '--bg3',                kind: 'color', def: '#2b323c', hint: 'Campi input' },
  { key: 'card',        css: '--card',               kind: 'color', def: '#282e37', hint: 'Schede' },
  { key: 'card2',       css: '--card2',              kind: 'color', def: '#333a46', hint: 'Righe e sub-box dentro le schede' },
  { key: 'subbox',      css: '--subbox-bg',          kind: 'text',  def: 'rgba(0,0,0,0.25)',       hint: 'Pannelli trasparenti (home e classifica)' },
  { key: 'border',      css: '--border',             kind: 'text',  def: 'rgba(255,255,255,0.08)', hint: 'Bordi, righe e separatori' },
  // --- 2. Barre (alto, basso, laterale) ---
  { key: 'headerBg',    css: '--header-bg',          kind: 'text',  def: 'rgba(18,22,28,0.80)',    hint: 'Barra in alto' },
  { key: 'navBg',       css: '--nav-bg',             kind: 'color', def: '#13171c', hint: 'Barra in basso (vuoto = automatico, più scuro dello sfondo)' },
  { key: 'drawerBg',    css: '--drawer-bg',          kind: 'color', def: '#171b21', hint: 'Menu laterale e pannelli del menu (vuoto = automatico)' },
  { key: 'barText',     css: '--bar-text',           kind: 'color', def: '#e2e8f0', hint: 'Testo e icone dentro le barre' },
  { key: 'navInactive', css: '--nav-inactive',       kind: 'color', def: '#6b7a90', hint: 'Tab inattivo della barra in basso' },
  { key: 'navActive',   css: '--nav-active',         kind: 'color', def: '#50e3c2', hint: 'Tab attivo (vuoto = come Evidenza principale)' },
  // --- 3. Pulsanti ---
  { key: 'btnPrimary',       css: '--btn-primary',        kind: 'color', def: '#50e3c2', hint: 'Pulsante principale (vuoto = come Evidenza principale)' },
  // chiave storica "onAccent": mantenuta per non perdere i temi già salvati
  { key: 'onAccent',         css: '--btn-primary-text',   kind: 'color', def: '#0a0f1e', hint: 'Testo sul pulsante principale' },
  { key: 'btnSecondary',     css: '--btn-secondary',      kind: 'color', def: '#3a4352', hint: 'Pulsante secondario' },
  { key: 'btnSecondaryText', css: '--btn-secondary-text', kind: 'color', def: '#e2e8f0', hint: 'Testo sul pulsante secondario' },
  { key: 'btnOutline',       css: '--btn-outline',        kind: 'color', def: '#94a3b8', hint: 'Pulsante con solo bordo (testo e bordo)' },
  // --- 4. Testi ---
  { key: 'text',        css: '--text',               kind: 'color', def: '#e2e8f0', hint: 'Testo principale' },
  { key: 'text2',       css: '--text2',              kind: 'color', def: '#94a3b8', hint: 'Sottotesti, etichette, descrizioni' },
  { key: 'text3',       css: '--text3',              kind: 'color', def: '#5b6b80', hint: 'Testo disattivato, segnaposto' },
  // --- 5. Evidenze (dati, non pulsanti) ---
  { key: 'accent',      css: '--accent',             kind: 'color', def: '#50e3c2', hint: 'Evidenza principale: punti, titoli di sezione, interruttori' },
  { key: 'accent2',     css: '--accent2',            kind: 'color', def: '#5b9dff', hint: 'Evidenza secondaria / informazioni' },
  { key: 'accent3',     css: '--accent3',            kind: 'color', def: '#ff6b6b', hint: 'Errore e Live' },
  { key: 'gold',        css: '--gold',               kind: 'color', def: '#f5a623', hint: 'Oro (trofei, qualificazioni)' },
  // --- 6. Ruoli giocatori ---
  { key: 'roleP',       css: '--role-p',             kind: 'color', def: '#4a5568', hint: 'Badge ruolo Portiere' },
  { key: 'roleD',       css: '--role-d',             kind: 'color', def: '#0077ff', hint: 'Badge ruolo Difensore' },
  { key: 'roleC',       css: '--role-c',             kind: 'color', def: '#00e5a0', hint: 'Badge ruolo Centrocampista' },
  { key: 'roleA',       css: '--role-a',             kind: 'color', def: '#ff4757', hint: 'Badge ruolo Attaccante' }
];

/** Rimuove i caratteri che potrebbero uscire dalla dichiarazione CSS. */
function sanitize(value) {
  return String(value).replace(/[;{}<>\\]/g, '').trim();
}

/** Costruisce il blocco :root con le sole variabili valorizzate nel tema. */
export function buildThemeCss(theme) {
  if (!theme) return '';
  const decls = THEME_VARS
    .filter(v => theme[v.key] && sanitize(theme[v.key]))
    .map(v => `${v.css}: ${sanitize(theme[v.key])};`)
    .join('\n');
  return decls ? `:root { ${decls} }` : '';
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
