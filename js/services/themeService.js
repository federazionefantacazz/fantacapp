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
  // --- Sfondi ---
  { key: 'bg',          css: '--bg',           kind: 'color', def: '#1a1e24', hint: 'Sfondo principale' },
  { key: 'bg2',         css: '--bg2',          kind: 'color', def: '#22272f', hint: 'Sfondo secondario (barra navigazione)' },
  { key: 'bg3',         css: '--bg3',          kind: 'color', def: '#2b323c', hint: 'Sfondo input' },
  { key: 'card',        css: '--card',         kind: 'color', def: '#282e37', hint: 'Colore schede' },
  { key: 'card2',       css: '--card2',        kind: 'color', def: '#333a46', hint: 'Righe / sub-box' },
  // --- Accenti ---
  { key: 'accent',      css: '--accent',       kind: 'color', def: '#50e3c2', hint: 'Accento principale' },
  { key: 'accent2',     css: '--accent2',      kind: 'color', def: '#64748b', hint: 'Accento secondario' },
  { key: 'accent3',     css: '--accent3',      kind: 'color', def: '#ff6b6b', hint: 'Errore / live' },
  { key: 'gold',        css: '--gold',         kind: 'color', def: '#f5a623', hint: 'Oro (trofei, evidenze)' },
  // --- Testi ---
  { key: 'text',        css: '--text',         kind: 'color', def: '#e2e8f0', hint: 'Testo principale' },
  { key: 'text2',       css: '--text2',        kind: 'color', def: '#94a3b8', hint: 'Testo secondario' },
  { key: 'text3',       css: '--text3',        kind: 'color', def: '#475569', hint: 'Testo terziario' },
  { key: 'onAccent',    css: '--on-accent',    kind: 'color', def: '#0a0f1e', hint: 'Testo sopra i pulsanti accento' },
  { key: 'navInactive', css: '--nav-inactive', kind: 'color', def: '#64748b', hint: 'Tab inattivi' },
  // --- Bordi e superfici semitrasparenti (accettano rgba) ---
  { key: 'border',      css: '--border',       kind: 'text',  def: 'rgba(255,255,255,0.08)', hint: 'Bordi di card, righe e separatori' },
  { key: 'headerBg',    css: '--header-bg',    kind: 'text',  def: 'rgba(26,30,36,0.72)',    hint: 'Barra in alto (header)' },
  { key: 'subbox',      css: '--subbox-bg',    kind: 'text',  def: 'rgba(0,0,0,0.25)',       hint: 'Card principale home e mini classifica' },
  // --- Ruoli giocatori ---
  { key: 'roleP',       css: '--role-p',       kind: 'color', def: '#4a5568', hint: 'Badge ruolo Portiere' },
  { key: 'roleD',       css: '--role-d',       kind: 'color', def: '#0077ff', hint: 'Badge ruolo Difensore' },
  { key: 'roleC',       css: '--role-c',       kind: 'color', def: '#00e5a0', hint: 'Badge ruolo Centrocampista' },
  { key: 'roleA',       css: '--role-a',       kind: 'color', def: '#ff4757', hint: 'Badge ruolo Attaccante' }
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

/** Applica (o rimuove) il tema nel tag <style id="dynamic-theme">. */
export function applyThemeVars(theme) {
  let tag = document.getElementById('dynamic-theme');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'dynamic-theme';
    document.head.appendChild(tag);
  }
  tag.textContent = buildThemeCss(theme);
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
