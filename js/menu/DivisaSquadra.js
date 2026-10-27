import { installColorPicker } from '../components/ColorPicker.js';
import { db, ref, update } from '../firebase-config.js';
import { uploadPngToImgBB } from '../services/integrationImgBB.js';
import { createKitViewer, renderKitImage, kitImageHTML, dataUrlToBlob } from '../components/Kit3D.js';
import { getCutout } from '../services/imageCutout.js';
import { getPngPatterns, getPngBrands, getChampPatches, getCompPatches, getCompPatchesOf, getPngSymbols, onKitAssetsChange } from '../services/kitAssets.js';
import { esc } from './menuUtils.js';
import {
  normalizeKit, defaultKit, patternLabel, motifParams, motifMax, shapePath, compPatchTf,
  PRESETS, PATTERNS, PATTERN_CATS, MOTIF_SHAPES, MOTIF_LIMITS, BRANDS, SPONSOR_FONTS, NUMBER_FONTS, PATCH_POSITIONS, ZONES, COLLARS, COLLAR_SHAPES, CUFFS,
  SLEEVE_DECO, SLEEVE_STRIPES_MAX, SHOULDER_SHAPES, SLEEVE_CUTS
} from '../components/KitRenderer.js';

/**
 * Editor della divisa della squadra (menu laterale → Divisa squadra).
 * La maglia è un modello 3D (components/Kit3D.js) vestito con la texture dipinta da components/KitRenderer.js;
 * disegni e marchi in PNG si aggiungono dall'area Patron (sezione Divise).
 * Al salvataggio si genera anche una foto PNG (kit.image) usata nel resto dell'app.
 * Ogni squadra ha due maglie: la prima (team.kit) e la seconda (team.kit2), create allo stesso modo.
 */
const MAX_LAYERS = 6;

/** Colore scritto o incollato: #rgb, #rrggbb (anche senza #) oppure rgb(r, g, b) / "r, g, b". Restituisce #rrggbb o null. */
export function parseColor(str) {
  const t = String(str || '').trim().toLowerCase();
  const m = t.match(/^(?:rgba?\s*\(\s*)?(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})/);
  if (m) {
    const v = m.slice(1, 4).map(Number);
    if (v.some(n => n > 255)) return null;
    return '#' + v.map(n => n.toString(16).padStart(2, '0')).join('');
  }
  const h = t.replace(/^#/, '');
  if (/^[0-9a-f]{6}$/.test(h)) return '#' + h;
  if (/^[0-9a-f]{3}$/.test(h)) return '#' + h.split('').map(c => c + c).join('');
  return null;
}
const hexToRgb = (hex) => { const h = String(hex).replace('#', ''); return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`; };

/** Copia negli appunti (anche dove navigator.clipboard non c'è). */
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* ripiego sotto */ }
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  ta.remove();
  return ok;
}
// come si stende un disegno sui pezzi della maglia
const LAYER_WRAPS = [
  { id: 'whole',  label: 'Default', desc: 'Davanti e dietro come un unico pezzo: il disegno continua dal davanti al dietro.' },
  { id: 'repeat', label: 'Ripetuto', desc: 'Lo stesso disegno uguale su davanti, dietro e maniche.' },
  { id: 'mirror', label: 'Specchiato', desc: 'Dietro e manica destra sono lo specchio di davanti e manica sinistra.' }
];
// testi dei parametri di ogni motivo (vedi MOTIFS in KitRenderer.js)
const LINE_DIRS = [['v', 'Verticali'], ['h', 'Orizzontali']];
const MOTIF_UI = {
  'm-stripe':  { count: 'Strisce', size: 'Spessore', gap: 'Distanza', dir: LINE_DIRS },
  'm-wave':    { count: 'Righe', size: 'Spessore', gap: 'Distanza', amp: 'Ampiezza', len: 'Lunghezza onda', dir: LINE_DIRS },
  'm-zigzag':  { count: 'Righe', size: 'Spessore', gap: 'Distanza', amp: 'Altezza punte', len: 'Larghezza punte', dir: LINE_DIRS },
  'm-chevron': { count: 'Chevron', size: 'Spessore', gap: 'Distanza', amp: 'Apertura' },
  'm-shape':   { count: 'Forme', size: 'Dimensione', gap: 'Distanza', dir: [['grid', 'Griglia'], ['v', 'In colonna'], ['h', 'In fila']] },
  'm-rings':   { count: 'Cerchi', size: 'Spessore', gap: 'Distanza', amp: 'Foro centrale' },
  'm-rays':    { count: 'Raggi', size: 'Larghezza' },
  'm-checker': { count: 'Quadri per riga' }
};
// dove guarda la maglia 3D quando si apre una fase (vedi FOCUS in Kit3D.js)
const SEC_FOCUS = { model: 'front', styles: 'front', design: 'front', sponsor: 'sponsor', back: 'backTop', brand: 'chest', patches: 'sleevePatch' };
const ZONE_FOCUS = { sleeves: 'sleeve', back: 'back' };
const PATCH_FOCUS = { chest: 'chest', belly: 'sponsor', sleeveR: 'sleeveR', hem: 'hem' };
const COLOR_FOCUS = { base: 'front', sleeves: 'sleeve', sleevesR: 'sleeveR', shoulders: 'shoulder', collar: 'collar', cuffs: 'cuff', trim: 'collar' };
const MAX_PATCHES = 4;
const SLOTS = { 1: { field: 'kit', label: 'Prima maglia' }, 2: { field: 'kit2', label: 'Seconda maglia' } };
const MAX_FILE_MB = 8;

export const SWATCHES = ['#ffffff', '#000000', '#c62828', '#7a1f1f', '#e65100', '#ffd400', '#f5a623', '#2e7d32',
  '#0b5d3b', '#00bcd4', '#1e88e5', '#1e5bb8', '#0d1b4c', '#6a1b9a', '#ec407a', '#9e9e9e'];

const STYLE_ID = 'kit-editor-style';
/** Stile dell'editor (usato anche dall'editor dello stadio). */
export function injectStyle() {
  installColorPicker(); // i quadratini colore aprono il selettore dell'app (uguale su iPhone e Android)
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .kit-stage { position: sticky; top: -1rem; z-index: 5; margin: -1rem -1rem 1rem; padding: 1rem 1rem .6rem;
      background-color: var(--bg); background-image: linear-gradient(var(--menu-bg, var(--bg)), var(--menu-bg, var(--bg))); border-bottom: 1px solid var(--border); }
    .kit-preview { position: relative; height: 34vh; max-height: 320px; min-height: 200px; }
    .kit-preview > #kit-3d { position: absolute; inset: 0; }
    .kit-zoom-btn { position: absolute; top: .4rem; right: 0; z-index: 2; width: 36px; height: 36px; border-radius: 10px; cursor: pointer;
      background: color-mix(in srgb, var(--bg2) 85%, transparent); color: var(--text); border: 1px solid var(--border); font-size: 1.15rem; display: flex; align-items: center; justify-content: center; }
    .kit-zoom { position: fixed; inset: 0; z-index: 4000; background: var(--kz-bg, var(--bg, #111)); display: flex; flex-direction: column; }
    .kit-zoom-head { display: flex; align-items: center; justify-content: space-between; padding: calc(.6rem + env(safe-area-inset-top, 0px)) .8rem .4rem; color: var(--title, var(--text)); font-family: var(--font-title, inherit); font-weight: 700; }
    .kit-zoom-stage { flex: 1; min-height: 0; position: relative; }
    .kit-zoom-stage > div { position: absolute; inset: 0; }
    .kit-zoom-bar { display: flex; gap: .4rem; justify-content: center; flex-wrap: wrap; padding: .5rem .8rem calc(.8rem + env(safe-area-inset-bottom, 0px)); }
    .kit-zoom-bar button, .kit-zoom-head button { background: var(--kz-btn-bg, var(--bg2)); color: var(--kz-btn-text, var(--text)); font-family: var(--font-btn, inherit); border: 1px solid var(--kz-btn-border, var(--border)); border-radius: 10px; padding: .45rem .8rem; font-weight: 700; cursor: pointer; font-size: .85rem; }
    .kit-view-btns { position: absolute; right: 0; bottom: 0; display: flex; gap: .3rem; z-index: 2; }
    .kit-view-btns button { background: color-mix(in srgb, var(--bg2) 85%, transparent); color: var(--text2); border: 1px solid var(--border);
      border-radius: 999px; padding: .2rem .6rem; font-family: inherit; font-size: .7rem; font-weight: 600; cursor: pointer; }
    .kit-hint { position: absolute; left: 0; bottom: 0; font-size: .65rem; color: var(--text3); font-family: var(--font-text3, inherit); z-index: 2; }
    .kit-loading { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--text3); font-family: var(--font-text3, inherit); font-size: .8rem; }
    .kit-actions { display: flex; gap: .5rem; justify-content: center; margin-top: .5rem; flex-wrap: wrap; }
    .kit-slots { display: flex; gap: .4rem; justify-content: center; margin-bottom: .5rem; }
    .kit-slots .lv-chip { position: relative; }
    .kit-slots .lv-chip.dirty::after { content: ''; position: absolute; top: 2px; right: 4px; width: 7px; height: 7px; border-radius: 50%; background: var(--gold); }
    .kit-dirty { font-size: .7rem; color: var(--gold); text-align: center; margin-top: .3rem; min-height: 1em; }

    .kit-acc { background: var(--card); border: 1px solid var(--border); border-radius: 14px; margin-bottom: .6rem; overflow: hidden; }
    .kit-acc-head { width: 100%; display: flex; align-items: center; gap: .5rem; padding: .85rem 1rem; background: none; border: none;
      color: var(--title, var(--accent)); font-family: var(--font-title, inherit); font-size: .8rem; font-weight: 700; text-align: left; cursor: pointer; }
    .kit-acc-head span { flex: 1; }
    .kit-acc-head i { font-size: 1.2rem; transition: transform .2s; }
    .kit-acc.open .kit-acc-head i { transform: rotate(180deg); }
    .kit-acc-body { display: none; padding: 0 1rem 1rem; }
    .kit-acc.open .kit-acc-body { display: block; }

    .kit-sub { font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; color: var(--label, var(--text2)); font-family: var(--font-label, inherit); margin: .9rem 0 .5rem; }
    .kit-sub:first-child { margin-top: 0; }
    .kit-pick-btn { width: 100%; display: flex; align-items: center; gap: .6rem; background: var(--bg3); border: 1px solid var(--border); border-radius: 12px;
      padding: .45rem .6rem; color: var(--text); cursor: pointer; text-align: left; font-size: .85rem; font-weight: 600; }
    .kit-pick-btn .pv { width: 46px; height: 48px; border-radius: 8px; overflow: hidden; background: #2b323c; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
    .kit-pick-btn .pv img { width: 100%; height: 100%; object-fit: cover; }
    .kit-pick-btn .go { margin-left: auto; color: var(--accent); font-size: .8rem; display: flex; align-items: center; gap: .2rem; flex-shrink: 0; }
    .kit-modal { position: fixed; inset: 0; z-index: 3000; background: var(--km-overlay, rgba(0,0,0,.6)); display: flex; align-items: flex-end; justify-content: center; }
    .kit-modal-box { width: 100%; max-width: 560px; max-height: 78vh; display: flex; flex-direction: column; background: var(--km-bg, var(--card)); border: 1px solid var(--km-border, var(--border));
      border-radius: 18px 18px 0 0; padding: .8rem .9rem calc(.9rem + env(safe-area-inset-bottom, 0px)); }
    .kit-modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: .6rem; font-weight: 700; color: var(--title, var(--text)); font-family: var(--font-title, inherit); }
    .kit-modal-body { overflow-y: auto; -webkit-overflow-scrolling: touch; }
    .kit-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); gap: .45rem; }
    .kit-grid.wide { grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); }
    .kit-opt { position: relative; background: var(--bg3); border: 2px solid transparent; border-radius: 10px; padding: .25rem .2rem .3rem;
      cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: .15rem; color: var(--text2); font-family: inherit; }
    .kit-opt > div { width: 100%; pointer-events: none; }
    .kit-opt .lb { font-size: .6rem; line-height: 1.15; text-align: center; pointer-events: none; }
    .kit-opt.on { border-color: var(--accent); color: var(--accent); }
    .kit-opt.on::after { content: '\\2713'; position: absolute; top: -6px; right: -6px; width: 18px; height: 18px; border-radius: 50%;
      background: var(--accent); color: var(--bg); font-size: .7rem; font-weight: 700; display: flex; align-items: center; justify-content: center; }
    .kit-brand { height: 44px; width: 100%; border-radius: 6px; display: flex; align-items: center; justify-content: center; pointer-events: none; }
    .kit-brand img { max-width: 56px; max-height: 36px; object-fit: contain; }

    .kit-color-row { display: flex; align-items: center; gap: .6rem; padding: .45rem 0; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
    .kit-color-row:last-child { border-bottom: none; }
    .kit-color-row .nm { flex: 1; min-width: 72px; font-size: .82rem; font-weight: 600; color: var(--text); }
    .kit-color { width: 40px; height: 32px; border: 1px solid var(--border); border-radius: 8px; padding: 0; background: none; cursor: pointer; flex-shrink: 0; }
    .kit-color::-webkit-color-swatch-wrapper { padding: 2px; } .kit-color::-webkit-color-swatch { border: none; border-radius: 6px; }
    .kit-hex { width: 84px; flex-shrink: 0; background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; padding: .38rem .4rem;
      color: var(--text); font-family: 'DM Mono', monospace; font-size: .74rem; text-transform: uppercase; }
    .kit-hex.bad { border-color: var(--accent3); }
    .kit-copy { background: transparent; border: 1px solid var(--border); color: var(--text2); border-radius: 8px; padding: .32rem .3rem; font-size: .6rem; font-weight: 700; cursor: pointer; flex-shrink: 0; }
    .kit-swatches { display: flex; flex-wrap: wrap; gap: .3rem; width: 100%; }
    .kit-sw { width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--border); cursor: pointer; padding: 0; }
    .kit-sw.on { outline: 2px solid var(--accent); outline-offset: 1px; }

    .kit-chips { display: flex; flex-wrap: wrap; gap: .35rem; }
    .kit-field { display: flex; align-items: center; gap: .6rem; margin: .5rem 0; font-size: .78rem; color: var(--text2); font-family: var(--font-sub, inherit); }
    .kit-field > span { min-width: 92px; }
    .kit-field input[type="range"] { flex: 1; accent-color: var(--accent); }
    .kit-field input[type="text"], .kit-field select { flex: 1; min-width: 0; background: var(--bg2); border: 1px solid var(--border); border-radius: 8px;
      color: var(--text); padding: .45rem .6rem; font-family: inherit; font-size: .82rem; user-select: text; -webkit-user-select: text; }
    .kit-field .val { width: 38px; text-align: right; color: var(--text); font-variant-numeric: tabular-nums; }

    .kit-layer { display: flex; align-items: center; gap: .5rem; background: var(--bg3); border: 2px solid transparent; border-radius: 10px; padding: .35rem .5rem; margin-bottom: .4rem; cursor: pointer; }
    .kit-layer.on { border-color: var(--accent); }
    .kit-layer .th { width: 40px; flex-shrink: 0; pointer-events: none; }
    .kit-layer .th > div { width: 100%; }
    .kit-layer .nm { flex: 1; min-width: 0; font-size: .8rem; font-weight: 600; color: var(--text); pointer-events: none; }
    .kit-layer .nm small { display: block; font-weight: 400; color: var(--text2); font-family: var(--font-sub, inherit); font-size: .68rem; }
    .kit-icon-btn { background: transparent; border: 1px solid var(--border); color: var(--text2); font-family: var(--font-sub, inherit); border-radius: 8px; width: 30px; height: 30px;
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

    /* editor della divisa: viste sotto l'anteprima (non coprono la maglia), gruppi, segmenti, cursori e menu a livelli */
    .kd-editor.has-open .kit-preview { height: 30vh; min-height: 180px; }
    .kd-viewbar { display: flex; align-items: center; justify-content: space-between; gap: .4rem; margin-top: .35rem; }
    .kd-hint { font-size: .65rem; color: var(--text3); font-family: var(--font-text3, inherit); }
    .kd-views { display: flex; gap: .3rem; }
    .kd-views button { background: var(--bg2); color: var(--text2); border: 1px solid var(--border); border-radius: 999px; padding: .22rem .65rem; font-family: inherit; font-size: .7rem; font-weight: 600; cursor: pointer; }
    .kd-group { border-top: 1px solid var(--border); margin-top: .9rem; padding-top: .1rem; }
    .kd-group:first-child { border-top: 0; margin-top: 0; padding-top: 0; }
    .kd-group > .kit-sub { margin-top: .8rem; }
    .kd-group:first-child > .kit-sub:first-child { margin-top: 0; }
    .kd-seg { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); background: var(--bg2); border: 1px solid var(--border); border-radius: 999px; padding: 2px; margin: .4rem 0; }
    .kd-seg button { background: transparent; border: 0; border-radius: 999px; color: var(--text2); font-family: inherit; font-size: .72rem; font-weight: 700; padding: .34rem .2rem; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .kd-seg button.on { background: color-mix(in srgb, var(--accent) 22%, transparent); color: var(--accent); }
    .kd-opts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .35rem; }
    #menu-panel .kd-opts .lv-chip, .kd-opts .lv-chip { width: 100%; border-radius: 10px; padding: .45rem .5rem; text-align: center; line-height: 1.2; white-space: normal; }
    .kd-desc { font-size: .72rem; color: var(--text2); font-family: var(--font-sub, inherit); line-height: 1.35; margin-top: .45rem; background: var(--bg2); border-radius: 10px; padding: .45rem .6rem; }
    .kd-range { display: grid; grid-template-columns: minmax(0, 5.6rem) 30px minmax(0, 1fr) 30px 2.7rem; gap: .35rem; align-items: center; margin: .5rem 0; }
    .kd-range button { height: 30px; border-radius: 8px; background: var(--bg2); border: 1px solid var(--border); color: var(--text); font-size: 1.05rem; font-weight: 700; line-height: 1;
      padding: 0; cursor: pointer; touch-action: manipulation; user-select: none; -webkit-user-select: none; font-family: inherit; }
    .kd-range button:active { border-color: var(--accent); color: var(--accent); }
    .kd-range .nm, .kd-step .nm { font-size: .8rem; font-weight: 600; color: var(--text); }
    .kd-range input, .kd-step input { width: 100%; accent-color: var(--accent); }
    .kd-range .val { font-size: .78rem; color: var(--accent); text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; }
    .kd-step { display: grid; grid-template-columns: minmax(0, 1fr) 42px 3.2rem 42px; gap: .2rem .5rem; align-items: center; margin: .5rem 0 .7rem; }
    .kd-step button { height: 38px; border-radius: 10px; background: var(--bg2); border: 1px solid var(--border); color: var(--text); font-size: 1.3rem; font-weight: 700; line-height: 1;
      cursor: pointer; touch-action: manipulation; user-select: none; -webkit-user-select: none; font-family: inherit; }
    .kd-step button:active { border-color: var(--accent); color: var(--accent); }
    .kd-step .val { text-align: center; font-size: 1.1rem; font-weight: 700; color: var(--accent); font-variant-numeric: tabular-nums; }
    .kd-step input { grid-column: 1 / -1; }
    .kd-nav { width: 100%; display: flex; align-items: center; gap: .65rem; background: var(--bg3); border: 1px solid var(--border); border-radius: 12px; padding: .5rem .65rem;
      margin-bottom: .45rem; color: var(--text); cursor: pointer; text-align: left; font-family: inherit; }
    .kd-nav .ic { width: 40px; height: 40px; border-radius: 9px; background: var(--bg2); display: flex; align-items: center; justify-content: center; font-size: 1.15rem;
      color: var(--accent); flex-shrink: 0; overflow: hidden; pointer-events: none; }
    .kd-nav .ic img { width: 100%; height: 100%; object-fit: cover; }
    .kd-nav .ic .dot { width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--border); }
    .kd-nav .tx { flex: 1; min-width: 0; pointer-events: none; }
    .kd-nav .tx b { display: block; font-size: .84rem; }
    .kd-nav .tx small { display: block; font-size: .7rem; color: var(--text2); font-family: var(--font-sub, inherit); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: .1rem; }
    .kd-nav > i { color: var(--text2); font-size: 1.25rem; pointer-events: none; }
    .kd-back { display: flex; align-items: center; gap: .55rem; margin: 0 0 .75rem; }
    .kd-back button { background: var(--bg2); border: 1px solid var(--border); color: var(--accent); border-radius: 999px; padding: .32rem .75rem .32rem .45rem; font-family: inherit;
      font-weight: 700; font-size: .75rem; cursor: pointer; display: inline-flex; align-items: center; gap: .1rem; flex-shrink: 0; }
    .kd-back span { font-size: .82rem; font-weight: 700; color: var(--title, var(--text)); font-family: var(--font-title, inherit); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .kd-crumb { font-size: .66rem; color: var(--text3); font-family: var(--font-text3, inherit); margin: -.45rem 0 .7rem; }
    .kd-shapes { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: .35rem; margin: .3rem 0 .4rem; }
    .kd-shape { aspect-ratio: 1; background: var(--bg3); border: 2px solid transparent; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: .1rem; cursor: pointer; padding: .3rem .2rem .2rem; color: var(--text2); font-family: inherit; }
    .kd-shape svg { width: 60%; height: 60%; pointer-events: none; }
    .kd-shape span { font-size: .55rem; pointer-events: none; }
    .kd-shape.on { border-color: var(--accent); color: var(--accent); }
    .kd-part + .kd-part { border-top: 2px solid var(--border); margin-top: 1.1rem; padding-top: .9rem; }
    .kd-title { display: flex; align-items: center; gap: .4rem; font-size: .9rem; font-weight: 700; color: var(--title, var(--accent)); font-family: var(--font-title, inherit);
      margin-bottom: .5rem; text-transform: uppercase; letter-spacing: .5px; }
    .kd-title i { font-size: 1.1rem; }
    .kd-title + .kd-group { border-top: 0; margin-top: 0; padding-top: 0; }
    .kd-shape img { width: 62%; height: 62%; object-fit: contain; pointer-events: none; }
    .kd-shape.up i { font-size: 1.2rem; pointer-events: none; }
    .kd-layer-go { color: var(--text2); font-size: 1.2rem; pointer-events: none; }
  `;
  document.head.appendChild(style);
}


const clone = (o) => JSON.parse(JSON.stringify(o));
const svgUrl = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
const brandThumbUrl = (b, color, base) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40">${b.draw(color, base)}</svg>`);
const patternThumbUrl = (p, m) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${400} ${420}" preserveAspectRatio="xMidYMid slice"><rect width="400" height="420" fill="#2b323c"/>${p.draw('#ffffff', 1, 'th' + p.id, m)}</svg>`);

/** Patch campione disponibili: quelle caricate dal Patron (Patron → Divise → Patch campione). */
function availablePatches() {
  return getChampPatches().map(p => ({ id: 'png:' + p.id, name: p.name || 'Patch', src: p.url }));
}

/** Le patch di competizione scelte in passato ora sono automatiche (manica sinistra nel Live): restano solo le campione. */
function champOnly(patches) {
  const comp = new Set(getCompPatches().map(p => 'png:' + p.id));
  return patches.filter(p => String(p.id).startsWith('png:') && !comp.has(p.id));
}

export const DivisaSquadra = {
  title: 'Divisa squadra',
  _open: 'model',
  _layer: 0,
  _busy: false,
  _slot: 1,
  /** Maglia da aprire (1 o 2) alla prossima apertura dell'editor; poi torna null. */
  startSlot: null,

  mount(body, STATE) {
    injectStyle();
    const team = STATE.user;
    const root = document.createElement('div');
    root.className = 'kd-editor';
    body.appendChild(root);
    this._root = root;
    if (!team) {
      root.innerHTML = `<div class="lv-empty">Accedi con la tua squadra per personalizzare la divisa.</div>`;
      return;
    }
    this._teamId = team.id;
    this._drafts = {};
    this._slot = this.startSlot === 2 ? 2 : 1;
    this.startSlot = null;
    this._loadSlot(this._slot);
    this._open = 'model';
    this._layerPage = null;
    this._focusName = 'front';
    this._renderAll();

    root.addEventListener('pointerdown', (e) => this._onPointerDown(e));
    root.addEventListener('click', (e) => this._onClick(e));
    root.addEventListener('input', (e) => this._onInput(e));
    root.addEventListener('change', (e) => this._onChange(e));
    // Invio nel campo del codice colore = conferma
    root.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.dataset && e.target.dataset.hex) e.target.blur(); });
    // il Patron può aggiungere modelli, disegni e marchi mentre l'editor è aperto
    this._unwatch = onKitAssetsChange(() => { if (this._root) { this._renderPreview(); this._renderSection(); } });
  },

  refresh() {
    // lo stemma può cambiare (Configurazione squadra): aggiorno solo l'anteprima, senza toccare le modifiche
    if (this._root && this._kit) { this._renderSlots(); this._renderPreview(); }
  },

  unmount() {
    if (this._zoom) this._zoom.close();
    if (this._stepStop) this._stepStop();
    if (this._unwatch) this._unwatch();
    this._unwatch = null;
    if (this._viewer) this._viewer.dispose();
    this._viewer = null;
    this._root = null;
    this._kit = null;
    this._drafts = null;
  },

  /* --------------------------------------------------- prima / seconda maglia */
  _field(slot = this._slot) { return SLOTS[slot].field; },

  /** Carica nell'editor la maglia indicata: la bozza non salvata se c'è, altrimenti quella salvata. */
  _loadSlot(slot) {
    const d = this._drafts[slot];
    if (d) {
      this._kit = d.kit; this._saved = d.saved; this._layer = d.layer;
    } else {
      this._layerPage = null;
      const team = window.STATE.user || {};
      this._kit = normalizeKit(team[this._field(slot)] || defaultKit());
      this._kit.patches = champOnly(this._kit.patches);
      this._saved = JSON.stringify(this._kit);
      this._layer = 0;
    }
    this._slot = slot;
  },

  /** Passa all'altra maglia tenendo da parte le modifiche non salvate di quella attuale. */
  _switchSlot(slot) {
    if (slot === this._slot || !SLOTS[slot] || this._busy) return;
    this._drafts[this._slot] = { kit: this._kit, saved: this._saved, layer: this._layer };
    this._picker = null;
    this._layerPage = null;
    this._loadSlot(slot);
    this._renderSlots();
    this._renderPreview();
    this._renderSection();
  },

  _renderSlots() {
    const box = this._root && this._root.querySelector('#kit-slots');
    if (!box) return;
    const team = window.STATE.user || {};
    box.innerHTML = Object.entries(SLOTS).map(([n, sl]) => {
      const slot = Number(n);
      const d = slot === this._slot ? { kit: this._kit, saved: this._saved } : this._drafts[slot];
      const dirty = d && JSON.stringify(d.kit) !== d.saved;
      const label = sl.label + (team[sl.field] ? '' : ' (nuova)');
      return `<button class="lv-chip ${slot === this._slot ? 'on' : ''} ${dirty ? 'dirty' : ''}" data-act="slot" data-v="${slot}">${esc(label)}</button>`;
    }).join('');
    const reset = this._root.querySelector('[data-act="reset"]');
    if (reset) reset.innerHTML = `<i class="ri-delete-bin-line"></i> Elimina ${this._slot === 2 ? 'la seconda' : 'la prima'} maglia e ricomincia da zero`;
    const copy = this._root.querySelector('[data-act="copy-first"]');
    if (copy) copy.style.display = this._slot === 2 ? '' : 'none';
  },

  /* -------------------------------------------------------------- render */
  _crest() { return (window.STATE.user && window.STATE.user.logo) || ''; },
  _dirty() { return JSON.stringify(this._kit) !== this._saved; },

  /** Miniatura: maglia disegnata su canvas a bassa risoluzione. */
  _thumb(kit, plain = true) { return kitImageHTML(kit, { crestUrl: this._crest(), width: 180, textureSize: 512, plain, live: true }); },

  _renderAll() {
    const sections = [
      ['model',   'FASE 1: Busto, colletto e maniche'],
      ['styles',  'FASE 2: Stili rapidi'],
      ['design',  'FASE 3: Disegni a livelli'],
      ['sponsor', 'FASE 4: Scelta dello SPONSOR'],
      ['back',    'FASE 5: Retro: nome, numero e sponsor'],
      ['brand',   'FASE 6: Stemma e marchio tecnico'],
      ['patches', 'FASE 7: Scelta delle PATCH']
    ];
    this._root.innerHTML = `
      <div class="kit-stage">
        <div class="kit-slots" id="kit-slots"></div>
        <div class="kit-preview">
          <div class="kit-loading" id="kit-loading">Caricamento maglia 3D…</div>
          <div id="kit-3d"></div>
          <button class="kit-zoom-btn" data-act="zoom-open" title="Ingrandisci la maglia" aria-label="Ingrandisci la maglia"><i class="ri-zoom-in-line"></i></button>
        </div>
        <div class="kd-viewbar">
          <span class="kd-hint"><i class="ri-drag-move-line"></i> Trascina per ruotare</span>
          <div class="kd-views"><button data-act="view" data-v="front">Davanti</button><button data-act="view" data-v="back">Retro</button></div>
        </div>
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
      <div class="mp-muted" style="text-align:center; margin-top:.4rem;">Prima e seconda maglia sono visibili a tutti nella scheda del tuo club.</div>
      <div class="kit-actions" style="margin-top:1rem;">
        <button class="mp-btn ghost" data-act="copy-first"><i class="ri-file-copy-line"></i> Parti dalla prima maglia</button>
        <button class="mp-btn danger" data-act="reset"><i class="ri-delete-bin-line"></i> Elimina maglia e ricomincia da zero</button>
      </div>
    `;
    this._renderSlots();
    this._renderPreview();
    this._renderSection();
  },

  _renderPreview() {
    if (!this._root) return;
    const box = this._root.querySelector('#kit-3d');
    if (box && !this._viewer) {
      this._viewer = createKitViewer(box);
      this._viewer.ready.then(() => {
        const l = this._root && this._root.querySelector('#kit-loading'); if (l) l.remove();
        if (this._viewer && this._focusName !== 'front') this._viewer.focus(this._focusName); // parte scelta prima che il 3D fosse pronto
      })
        .catch(e => { console.error(e); const l = this._root && this._root.querySelector('#kit-loading'); if (l) l.textContent = 'Il 3D non è supportato su questo dispositivo'; });
    }
    if (this._viewer) this._viewer.update(this._kit, { crestUrl: this._crest(), ...this._compPatchOpts() }).catch(e => console.error('Divisa:', e));
    const dirty = this._root.querySelector('#kit-dirty');
    if (dirty) dirty.textContent = this._dirty() ? 'Modifiche non salvate' : '';
    const tab = this._root.querySelector(`#kit-slots [data-v="${this._slot}"]`);
    if (tab) tab.classList.toggle('dirty', this._dirty());
  },

  /** Durante trascinamenti (cursori, selettore colore) ridisegno al massimo una volta per frame. */
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
    const box = key && this._root.querySelector(`#kit-sec-${key}`);
    if (!box) return;
    const fn = {
      model: this._secModel, styles: this._secStyles, design: this._secDesign,
      sponsor: this._secSponsor, back: this._secBack, brand: this._secBrand, patches: this._secPatches
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

  _opt(act, value, inner, label, on) {
    return `<button class="kit-opt ${on ? 'on' : ''}" data-act="${act}" data-v="${esc(value)}" title="${esc(label)}">${inner}<span class="lb">${esc(label)}</span></button>`;
  },

  _colorPicker(path, value) {
    return `
      <input type="color" class="kit-color" data-color="${path}" value="${esc(value)}">
      <input type="text" class="kit-hex" data-hex="${path}" value="${esc(value)}" maxlength="24" spellcheck="false" autocomplete="off" autocapitalize="off" title="Codice HEX (#1e5bb8) o RGB (30, 91, 184)">
      <button class="kit-copy" data-act="copy-color" data-path="${path}" data-fmt="hex" title="Copia il codice HEX"><i class="ri-file-copy-line"></i> HEX</button>
      <button class="kit-copy" data-act="copy-color" data-path="${path}" data-fmt="rgb" title="Copia il codice RGB"><i class="ri-file-copy-line"></i> RGB</button>
      <div class="kit-swatches">${SWATCHES.map(c => `<button class="kit-sw ${String(value).toLowerCase() === c ? 'on' : ''}" style="background:${c}" data-act="swatch" data-path="${path}" data-v="${c}" aria-label="${c}"></button>`).join('')}</div>`;
  },

  /** Finestra (dal basso) con le scelte: si chiude toccando fuori, la X o scegliendo un elemento. */
  _modal(title, body) {
    return `<div class="kit-modal" data-act="close-picker" data-self="1"><div class="kit-modal-box">
      <div class="kit-modal-head"><span>${esc(title)}</span><button class="kit-icon-btn" data-act="close-picker" title="Chiudi"><i class="ri-close-line"></i></button></div>
      <div class="kit-modal-body">${body}</div></div></div>`;
  },

  _chip(act, value, label, on) {
    return `<button class="lv-chip ${on ? 'on' : ''}" data-act="${act}" data-v="${esc(value)}">${esc(label)}</button>`;
  },

  /** Cursore con − e + ai lati (per i ritocchi di un passo; tenendo premuto corre). */
  _range(path, label, value, min, max, unit = '') {
    const btn = (d, t) => `<button type="button" data-step="${path}" data-d="${d}" data-min="${min}" data-max="${max}" aria-label="${d < 0 ? 'Meno' : 'Più'}">${t}</button>`;
    return `<div class="kd-range"><span class="nm">${label}</span>${btn(-1, '−')}<input type="range" min="${min}" max="${max}" value="${value}" data-range="${path}" data-unit="${unit}" aria-label="${esc(String(label))}">${btn(1, '+')}<b class="val">${value}${unit}</b></div>`;
  },

  /** Numero con − e + (tenendo premuto corre) e cursore per i salti grandi. */
  _step(path, label, value, min, max) {
    const btn = (d, t) => `<button type="button" data-step="${path}" data-d="${d}" data-min="${min}" data-max="${max}" aria-label="${d < 0 ? 'Meno' : 'Più'}">${t}</button>`;
    return `<div class="kd-step"><span class="nm">${esc(label)}</span>${btn(-1, '−')}<b class="val">${value}</b>${btn(1, '+')}
      <input type="range" min="${min}" max="${max}" value="${value}" data-range="${path}" aria-label="${esc(label)}"></div>`;
  },

  /** Selettore compatto a segmenti su una riga: items = [[valore, etichetta, attivo], ...]. */
  _seg(items, attrs) {
    return `<div class="kd-seg">${items.map(([v, l, on]) => `<button class="${on ? 'on' : ''}" ${attrs} data-v="${esc(v)}">${esc(l)}</button>`).join('')}</div>`;
  },

  /** Gruppo di scelte: toccandolo la maglia 3D inquadra la parte `focus`. */
  _group(title, focus, body) {
    return `<div class="kd-group" ${focus ? `data-focus="${focus}"` : ''}>${title ? `<div class="kit-sub">${title}</div>` : ''}${body}</div>`;
  },

  /** Voce di menu che apre il livello successivo. */
  _nav(act, v, icon, title, sub) {
    return `<button class="kd-nav" data-act="${act}" data-v="${esc(v)}"><span class="ic">${icon}</span><span class="tx"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span><i class="ri-arrow-right-s-line"></i></button>`;
  },

  /** La maglia 3D inquadra una parte (collar, shoulder, sleeve, ... vedi FOCUS in Kit3D.js). */
  _focusTo(name, force = false) {
    if (!name || (!force && name === this._focusName)) return;
    this._focusName = name;
    if (this._viewer) this._viewer.focus(name);
  },

  /** Forme del motivo: quelle integrate, i simboli PNG del Patron e il PNG del giocatore. */
  _shapePicker(sel, m) {
    const png = m.shape === 'png';
    const syms = getPngSymbols();
    const isPatron = png && syms.some(y => y.url === m.symUrl);
    const own = png && !isPatron ? m.symUrl : '';
    return `<div class="kit-sub">Forma</div><div class="kd-shapes">
      ${MOTIF_SHAPES.map(sh => `<button class="kd-shape ${m.shape === sh.id ? 'on' : ''}" data-act="layer-param" data-k="shape" data-v="${sh.id}" title="${esc(sh.label)}">${this._shapeIcon(sh.id)}<span>${esc(sh.label)}</span></button>`).join('')}
    </div>
    <div class="kit-sub">Simboli PNG</div><div class="kd-shapes">
      <label class="kd-shape up ${own ? 'on' : ''}" title="Carica il tuo PNG">${own ? `<img src="${esc(own)}" alt="">` : '<i class="ri-upload-2-line"></i>'}<span>${own ? 'Cambia PNG' : 'Il tuo PNG'}</span>
        <input type="file" accept="image/png" data-upload="sym:${sel}" style="display:none;"></label>
      ${syms.map(y => `<button class="kd-shape ${png && m.symUrl === y.url ? 'on' : ''}" data-act="layer-param" data-k="shape" data-v="png" data-url="${esc(y.url)}" title="${esc(y.name || 'Simbolo')}"><img src="${esc(y.url)}" alt=""><span>${esc(y.name || 'Simbolo')}</span></button>`).join('')}
    </div>
    ${png ? this._seg([['1', 'Tinta unica', m.symMono], ['0', 'Colori originali', !m.symMono]], 'data-act="layer-param" data-k="symMono"') : ''}
    ${png ? '' : `<div class="kd-desc" style="margin-top:.2rem;">Carica un simbolo in <b>PNG</b> (meglio quadrato, con sfondo trasparente) e ripetilo sulla maglia quante volte vuoi.</div>`}`;
  },

  _shapeIcon(id) {
    return `<svg viewBox="-1.15 -1.15 2.3 2.3"><path d="${shapePath(id)}" fill="currentColor"/></svg>`;
  },

  /* ------------------------------------------------------------ sezioni */
  /** Riga colore di un pezzo (sotto le scelte del pezzo): toccandola la maglia inquadra quella parte. */
  _colorRow(label, key) {
    return `<div class="kit-color-row" data-focus="${COLOR_FOCUS[key] || 'front'}"><div class="nm">${esc(label)}</div>${this._colorPicker(`colors.${key}`, this._kit.colors[key])}</div>`;
  },

  /** Parte della maglia con il suo sottotitolo (Busto, Colletto, Maniche). */
  _part(icon, title, body) {
    return `<div class="kd-part"><div class="kd-title"><i class="${icon}"></i> ${esc(title)}</div>${body}</div>`;
  },

  _secModel() {
    const k = this._kit;
    const base = { ...k, sponsor: { mode: 'none' }, patches: [], crest: { show: false } };
    const raglan = k.sleeveCut === 'raglan';
    const stripes = k.sleeveDeco === 'stripes';
    const onShoulder = stripes && k.sleeveDecoShoulder && !raglan;
    const split = !!k.colors.sleevesR;
    const collarTrim = k.collarShape !== 'polo' && k.collar !== 'plain';
    return `
      ${this._part('ri-t-shirt-line', 'Busto', this._group('', 'front', `
        ${this._colorRow('Colore della maglia', 'base')}
        <div class="kd-opts" style="margin-top:.5rem;">
          <button class="lv-chip" data-act="swap-colors"><i class="ri-swap-line"></i> Inverti colori</button>
          <button class="lv-chip" data-act="sleeves-as-base"><i class="ri-shirt-line"></i> Maniche come la maglia</button>
        </div>`))}
      ${this._part('ri-shirt-line', 'Colletto', `
      ${this._group('Forma', 'collar', `
        <div class="kit-grid wide">${COLLAR_SHAPES.map(c => this._opt('collarShape', c.id, this._thumb({ ...base, collarShape: c.id }), raglan && c.id === 'v' ? 'Girocollo' : c.label, k.collarShape === c.id)).join('')}</div>
        ${this._colorRow('Colore del colletto', 'collar')}`)}
      ${k.collarShape === 'polo' ? '' : this._group('Rifinitura', 'collar', `
        <div class="kit-grid">${COLLARS.map(c => this._opt('collar', c.id, this._thumb({ ...base, collar: c.id }), c.label, k.collar === c.id)).join('')}</div>
        ${collarTrim ? this._colorRow('Colore di righe e bordino', 'trim') : ''}`)}`)}
      ${this._part('ri-t-shirt-2-line', 'Maniche', `
      ${this._group('Cucitura', 'shoulder', `
        <div class="kit-grid wide">${SLEEVE_CUTS.map(c => this._opt('sleeveCut', c.id, this._thumb({ ...base, sleeveCut: c.id }), c.label, k.sleeveCut === c.id)).join('')}</div>
        <div class="kd-desc">${raglan ? 'Cucitura raglan: scende in diagonale dal colletto all\'ascella e la manica copre anche la spalla.' : 'Cucitura spalle: la manica è attaccata sulla spalla, come nelle maglie classiche.'}</div>`)}
      ${this._group('Colore delle maniche', 'sleeve', `
        ${this._seg([['0', 'Uguali', !split], ['1', 'Di colori diversi', split]], 'data-act="sleeves-split"')}
        ${split ? this._colorRow('Manica sinistra', 'sleeves') + this._colorRow('Manica destra', 'sleevesR') : this._colorRow('Maniche', 'sleeves')}
        ${split ? '<div class="kd-desc">Sinistra e destra guardando la maglia di fronte.</div>' : ''}`)}
      ${raglan ? '' : this._group('Spalle', 'shoulder', `
        <div class="kit-grid">${SHOULDER_SHAPES.map(sh => this._opt('shoulderShape', sh.id, this._thumb({ ...base, shoulders: { ...k.shoulders, shape: sh.id } }), sh.label, k.shoulders.shape === sh.id)).join('')}</div>
        ${k.shoulders.shape !== 'none' ? `
        ${this._range('shoulders.size', 'Dimensione', k.shoulders.size, 50, 160, '%')}
        ${this._seg([['1', 'Colore delle maniche', k.shoulders.match], ['0', 'Colore a scelta', !k.shoulders.match]], 'data-act="shoulder-match"')}
        ${k.shoulders.match ? '' : this._colorRow('Colore delle spalle', 'shoulders')}` : ''}`)}
      ${this._group('Decorazioni', 'sleeve', `
        <div class="kit-grid">${SLEEVE_DECO.map(d => this._opt('sleeveDeco', d.id, this._thumb({ ...base, sleeveDeco: d.id }), d.label, k.sleeveDeco === d.id)).join('')}</div>
        ${stripes ? this._step('sleeveDecoN', 'Numero di strisce', k.sleeveDecoN, 1, SLEEVE_STRIPES_MAX) : ''}
        ${stripes && !raglan ? this._seg([['0', 'Solo sulla manica', !k.sleeveDecoShoulder], ['1', 'Dal colletto al polsino', k.sleeveDecoShoulder]], 'data-act="stripes-reach"') : ''}
        ${k.sleeveDeco !== 'none' ? this._colorRow('Colore delle decorazioni', 'trim') : ''}
        ${onShoulder ? `
        ${this._range('sleeveTf.scale', 'Spessore', k.sleeveTf.scale, 40, 200, '%')}
        <div class="kd-desc">Le strisce corrono dal colletto al polsino come un'unica linea: si regola solo lo spessore.</div>` : ''}
        ${k.sleeveDeco !== 'none' && !onShoulder ? `
        ${this._range('sleeveTf.scale', 'Dimensione', k.sleeveTf.scale, 40, 200, '%')}
        ${this._range('sleeveTf.x', 'Sposta ↔', k.sleeveTf.x, -50, 50)}
        ${this._range('sleeveTf.y', 'Sposta ↕', k.sleeveTf.y, -50, 50)}
        ${this._range('sleeveTf.rot', 'Rotazione', k.sleeveTf.rot, -180, 180, '°')}
        <div class="kit-chips" style="margin-top:.4rem;">${this._chip('sleeve-reset', '1', 'Ripristina posizione', false)}</div>` : ''}
        ${k.sleeveDeco !== 'none' && collarTrim ? '<div class="kd-desc">Lo stesso colore vale anche per righe e bordino del colletto.</div>' : ''}`)}
      ${this._group('Polsini', 'cuff', `
        <div class="kit-grid">${CUFFS.map(c => this._opt('cuffs', c.id, this._thumb({ ...base, cuffs: c.id }), c.label, k.cuffs === c.id)).join('')}</div>
        ${k.cuffs !== 'none' ? this._colorRow('Colore dei polsini', 'cuffs') : ''}`)}`)}
      <div class="kd-desc" style="margin-top:.9rem;">Tocca una parte e la maglia la inquadra da vicino. I colori di ogni pezzo sono sotto le sue scelte.</div>`;
  },

  _secStyles() {
    const k = this._kit;
    return `
      <div class="kd-desc" style="margin:0 0 .6rem;">Parti da un disegno già pronto: poi puoi modificarlo nella FASE 3. Cambia solo il disegno.</div>
      <div class="kit-grid">
        ${PRESETS.map((p, i) => this._opt('preset', i, this._thumb(normalizeKit({ ...k, sleeveDeco: p.kit.sleeveDeco || k.sleeveDeco, sleeveDecoN: p.kit.sleeveDecoN || k.sleeveDecoN, layers: normalizeKit({ layers: p.kit.layers }).layers })), p.name, false)).join('')}
      </div>`;
  },

  /** Anteprima di un disegno (come appare nella finestra di scelta). */
  _patternThumb(l) {
    if (l.type === 'img') return l.url || '';
    if (String(l.type).startsWith('png:')) return (getPngPatterns().find(pp => 'png:' + pp.id === l.type) || {}).url || '';
    const p = PATTERNS.find(pt => pt.id === l.type) || PATTERNS[0];
    return patternThumbUrl(p, p.motif ? motifParams(l) : null);
  },

  /** Riassunto dei parametri di un motivo: "5 strisce · spessore 20". */
  _motifSummary(l) {
    const ui = MOTIF_UI[l.type];
    if (!ui) return '';
    const m = motifParams(l);
    const parts = [m.all ? 'tutta la maglia' : `${m.count} ${ui.count.toLowerCase()}`];
    if (l.type === 'm-shape') parts.unshift(m.shape === 'png' ? 'Simbolo PNG' : (MOTIF_SHAPES.find(x => x.id === m.shape) || {}).label || '');
    if (ui.size) parts.push(`${ui.size.toLowerCase()} ${m.size}`);
    if (ui.dir) parts.push(((ui.dir.find(d => d[0] === m.dir) || [])[1] || '').toLowerCase());
    return parts.filter(Boolean).join(' · ');
  },

  _secDesign() {
    const k = this._kit;
    if (!k.layers.length) this._layerPage = null;
    const sel = Math.min(this._layer, k.layers.length - 1);
    if (this._layerPage && sel >= 0) return this._layerView(sel);
    const zoneLabel = (z) => (ZONES.find(x => x.id === z) || {}).label || '';
    const layers = k.layers.map((l, i) => `
      <div class="kit-layer" data-act="open-layer" data-i="${i}">
        <div class="th">${this._thumb({ ...k, layers: [l] })}</div>
        <div class="nm">Livello ${i + 1}<small>${esc(patternLabel(l.type))} · ${esc(zoneLabel(l.zone))}</small></div>
        <button class="kit-icon-btn" data-act="layer-up" data-i="${i}" ${i === 0 ? 'disabled' : ''} title="Porta sotto"><i class="ri-arrow-up-line"></i></button>
        <button class="kit-icon-btn" data-act="layer-down" data-i="${i}" ${i === k.layers.length - 1 ? 'disabled' : ''} title="Porta sopra"><i class="ri-arrow-down-line"></i></button>
        <button class="kit-icon-btn" data-act="layer-dup" data-i="${i}" ${k.layers.length >= MAX_LAYERS ? 'disabled' : ''} title="Crea una copia"><i class="ri-file-copy-line"></i></button>
        <button class="kit-icon-btn" data-act="layer-del" data-i="${i}" title="Elimina"><i class="ri-delete-bin-line"></i></button>
        <i class="ri-arrow-right-s-line kd-layer-go"></i>
      </div>`).join('');
    return `
      <div class="kd-desc" style="margin:0 0 .7rem;">Sovrapponi fino a ${MAX_LAYERS} livelli: tocca un livello per aprire il suo menu (disegno, numero e misure, colore, posizione). Il primo livello è quello più in basso.</div>
      ${layers || '<div class="mp-muted" style="text-align:center; padding:.6rem 0;">Nessun livello: maglia in tinta unita.</div>'}
      <button class="mp-btn" data-act="layer-add" ${k.layers.length >= MAX_LAYERS ? 'disabled' : ''} style="width:100%; margin-top:.3rem;"><i class="ri-add-line"></i> Aggiungi livello</button>`;
  },

  /** Menu di un livello (pagina 'menu') e le sue pagine: disegno, misure, colore, posizione, zona. */
  _layerView(sel) {
    const k = this._kit, l = k.layers[sel], path = `layers.${sel}`;
    const page = this._layerPage;
    const pt = PATTERNS.find(x => x.id === l.type);
    const motif = !!(pt && pt.motif);
    const own = l.type === 'img';
    const zoneLabel = (ZONES.find(x => x.id === l.zone) || {}).label || '';
    const head = (to, back, title) => `<div class="kd-back"><button data-act="layer-page" data-v="${to}"><i class="ri-arrow-left-s-line"></i>${esc(back)}</button><span>${esc(title)}</span></div>`;
    const name = `Livello ${sel + 1}`;

    if (page === 'menu') {
      const thumb = this._patternThumb(l);
      return `
        ${head('', 'Livelli', `${name} · ${patternLabel(l.type)}`)}
        ${this._nav('layer-page', 'pattern', thumb ? `<img src="${esc(thumb)}" alt="">` : '<i class="ri-image-line"></i>', 'Disegno', patternLabel(l.type))}
        ${motif ? this._nav('layer-page', 'shape', '<i class="ri-hashtag"></i>', 'Numero e misure', this._motifSummary(l)) : ''}
        ${this._nav('layer-page', 'color', `<span class="dot" style="background:${esc(own && !l.mono ? 'transparent' : l.color)}"></span>`, 'Colore e opacità', `${own && !l.mono ? 'Colori originali' : String(l.color).toUpperCase()} · ${l.opacity}%`)}
        ${this._nav('layer-page', 'pos', '<i class="ri-drag-move-2-line"></i>', 'Posizione e rotazione', `↔ ${l.x || 0} · ↕ ${l.y || 0} · ${l.rot || 0}°${motif ? '' : ` · ${l.scale}%`}${l.flipX ? ' · specchiato' : ''}${l.flipY ? ' · capovolto' : ''}`)}
        ${this._nav('layer-page', 'zone', '<i class="ri-shirt-line"></i>', 'Dove applicarlo', zoneLabel)}
        <div class="kd-opts" style="margin-top:.6rem;">
          <button class="lv-chip" data-act="layer-dup" data-i="${sel}" ${k.layers.length >= MAX_LAYERS ? 'disabled' : ''}><i class="ri-file-copy-line"></i> Crea una copia</button>
          <button class="lv-chip" data-act="layer-del" data-i="${sel}"><i class="ri-delete-bin-line"></i> Elimina livello</button>
        </div>`;
    }

    const top = head('menu', name, { pattern: 'Disegno', shape: 'Numero e misure', color: 'Colore e opacità', pos: 'Posizione e rotazione', zone: 'Dove applicarlo' }[page] || '');
    if (page === 'pattern') {
      const png = getPngPatterns();
      const box = (inner) => `<div class="kit-brand" style="height:auto; aspect-ratio:400/420; background:#2b323c;">${inner}</div>`;
      const pic = (src) => `<img src="${esc(src)}" alt="" style="width:100%; height:100%; max-width:none; max-height:none; object-fit:cover;">`;
      const cell = (type, src, label) => this._opt('layer-type', type, box(pic(src)), label, l.type === type);
      const ownCell = `<label class="kit-opt ${own ? 'on' : ''}" title="Carica il tuo PNG">
          ${box(own && l.url ? pic(l.url) : '<i class="ri-upload-2-line" style="font-size:1.4rem; color:var(--text2);"></i>')}<span class="lb">Il tuo PNG</span>
          <input type="file" accept="image/png" data-upload="layer:${sel}" style="display:none;"></label>`;
      const cats = PATTERN_CATS.map(c => {
        const list = PATTERNS.filter(x => x.cat === c.id && (!x.legacy || x.id === l.type));
        return list.length ? `<div class="kit-sub">${esc(c.label)}</div><div class="kit-grid">${list.map(x => cell(x.id, patternThumbUrl(x, x.motif ? motifParams({ type: x.id }) : null), x.label)).join('')}</div>` : '';
      }).join('');
      return `${top}
        <div class="kd-desc" style="margin:0 0 .4rem;">Strisce, righe e forme si costruiscono come vuoi: dopo averle scelte apri <b>Numero e misure</b> per decidere quante (fino a 100), quanto grandi e in che direzione.</div>
        ${cats}
        <div class="kit-sub">Immagini PNG</div>
        <div class="kit-grid">${ownCell}${png.map(pp => cell('png:' + pp.id, pp.url, pp.name)).join('')}</div>
        ${own ? `<div class="kit-field">${this._uploadBtn(`layer:${sel}`, true, 'immagine')}</div>
        <div class="kd-desc">Solo immagini <b>PNG</b> (meglio con sfondo trasparente): riempie il pezzo senza deformarsi.</div>` : ''}`;
    }
    if (page === 'shape' && motif) {
      const m = motifParams(l), ui = MOTIF_UI[l.type] || {};
      const par = pt.params;
      const lim = (key) => MOTIF_LIMITS[key];
      return `${top}
        ${par.includes('shape') ? this._shapePicker(sel, m) : ''}
        ${par.includes('all') ? this._seg([['0', 'Numero a scelta', !m.all], ['1', 'Riempi tutta la maglia', m.all]], 'data-act="layer-param" data-k="all"') : ''}
        ${m.all ? '' : this._step(`${path}.count`, ui.count, m.count, 1, motifMax(l.type))}
        ${['size', 'gap', 'amp', 'len'].filter(key => par.includes(key)).map(key => this._range(`${path}.${key}`, ui[key], m[key], ...lim(key))).join('')}
        ${par.includes('dir') && !(m.all && l.type === 'm-shape') ? this._seg(ui.dir.map(([v, t]) => [v, t, m.dir === v]), 'data-act="layer-param" data-k="dir"') : ''}
        ${par.includes('fill') && m.shape !== 'png' ? this._seg([['solid', 'Piene', m.fill === 'solid'], ['line', 'Solo contorno', m.fill === 'line']], 'data-act="layer-param" data-k="fill"') : ''}
        ${par.includes('stagger') && (m.dir === 'grid' || m.all) ? this._seg([['0', 'Allineate', !m.stagger], ['1', 'Sfalsate', m.stagger]], 'data-act="layer-param" data-k="stagger"') : ''}
        <div class="kd-desc">Gli elementi partono dal centro del davanti. Per spostarli o inclinarli (per esempio una fascia diagonale) apri <b>Posizione e rotazione</b>.</div>`;
    }
    if (page === 'color') {
      return `${top}
        ${own ? this._seg([['0', 'Colori originali', !l.mono], ['1', 'Tinta unica', !!l.mono]], 'data-act="layer-mono"') : ''}
        ${!own || l.mono ? `<div class="kit-color-row">${this._colorPicker(`${path}.color`, l.color)}</div>` : ''}
        ${this._range(`${path}.opacity`, 'Opacità', l.opacity, 5, 100, '%')}`;
    }
    if (page === 'pos') {
      return `${top}
        ${motif ? '' : this._range(`${path}.scale`, 'Dimensione', l.scale, 30, 250, '%')}
        ${this._range(`${path}.x`, 'Sposta ↔', l.x || 0, -50, 50)}
        ${this._range(`${path}.y`, 'Sposta ↕', l.y || 0, -50, 50)}
        ${this._range(`${path}.rot`, 'Rotazione', l.rot || 0, -180, 180, '°')}
        <div class="kd-opts" style="margin-top:.5rem;">
          ${this._chip('layer-flag', 'flipX', 'Specchia ↔', l.flipX)}
          ${this._chip('layer-flag', 'flipY', 'Capovolgi ↕', l.flipY)}
        </div>
        <div class="kit-chips" style="margin-top:.5rem;">${this._chip('layer-reset', '1', 'Ripristina posizione', false)}</div>`;
    }
    if (page === 'zone') {
      const single = l.zone === 'front' || l.zone === 'back';
      return `${top}
        <div class="kd-opts">${ZONES.map(z => this._chip('layer-zone', z.id, z.label, l.zone === z.id)).join('')}</div>
        <div class="kit-sub">Come si stende sulla maglia</div>
        ${single ? `<div class="kd-desc">Su un solo pezzo il disegno si stende semplicemente su quel pezzo.</div>` : `
        ${this._seg(LAYER_WRAPS.map(w => [w.id, w.label, (l.wrap || 'repeat') === w.id]), 'data-act="layer-wrap"')}
        <div class="kd-desc">${esc((LAYER_WRAPS.find(w => w.id === (l.wrap || 'repeat')) || {}).desc || '')}</div>`}`;
    }
    this._layerPage = 'menu';
    return this._layerView(sel);
  },

  _uploadBtn(kind, has, label) {
    return `<label class="mp-btn"><i class="ri-upload-2-line"></i> ${has ? 'Cambia' : 'Carica'} ${label}
      <input type="file" accept="image/png" data-upload="${kind}" style="display:none;"></label>`;
  },

  _secSponsor() { return this._group('', 'sponsor', this._sponsorEditor('sponsor')); },

  /** Editor di uno sponsor: 'sponsor' (davanti) o 'backSponsor' (retro). Le azioni hanno data-key con lo sponsor. */
  _sponsorEditor(key) {
    const sp = this._kit[key];
    const chip = (act, value, label, on) => this._chip(act, value, label, on).replace('<button ', `<button data-key="${key}" `);
    let body = '';
    if (sp.mode === 'image') {
      body = `
        <div class="kit-field" style="flex-wrap:wrap;">
          ${sp.url ? `<img class="kit-upload-thumb" src="${esc(sp.url)}" alt="Sponsor">` : ''}
          ${this._uploadBtn(key, !!sp.url, 'immagine')}
        </div>
        <div class="mp-muted">Solo immagini <b>PNG</b>, meglio se con sfondo trasparente.</div>
        <div class="kit-chips" style="margin:.6rem 0;">
          ${chip('sponsor-mono', '0', 'Colori originali', !sp.mono)}
          ${chip('sponsor-mono', '1', 'Tinta unica', sp.mono)}
        </div>
        ${sp.mono ? `<div class="kit-color-row">${this._colorPicker(`${key}.color`, sp.color)}</div>` : ''}`;
    } else if (sp.mode === 'text') {
      body = `
        <label class="kit-field"><span>Testo</span><input type="text" maxlength="24" value="${esc(sp.text)}" data-text="${key}.text" placeholder="Nome dello sponsor"></label>
        <div class="kit-sub">Carattere</div>
        <div class="kit-chips">${SPONSOR_FONTS.map(f => chip('sponsor-font', f.id, f.label, sp.font === f.id)).join('')}</div>
        <div class="kit-sub">Colore</div>
        <div class="kit-color-row">${this._colorPicker(`${key}.color`, sp.color)}</div>`;
    }
    return `
      ${this._seg([['none', 'Nessuno', sp.mode === 'none'], ['image', 'Immagine PNG', sp.mode === 'image'], ['text', 'Scritta', sp.mode === 'text']], `data-act="sponsor-mode" data-key="${key}"`)}
      ${body}
      ${sp.mode !== 'none' ? this._range(`${key}.scale`, 'Dimensione', sp.scale, 40, 160, '%') + this._range(`${key}.y`, 'Posizione', sp.y, -60, 80) : ''}`;
  },

  _secBack() {
    const bp = this._kit.backPrint;
    return `
      <div class="kd-group" data-focus="backTop">
      <div class="kit-sub">Nome e numero</div>
      ${this._seg([['1', 'Mostra nome e numero', bp.show], ['0', 'Nascondi', !bp.show]], 'data-act="back-show"')}
      ${bp.show ? `
        <label class="kit-field"><span>Nome</span><input type="text" maxlength="16" value="${esc(bp.name)}" data-text="backPrint.name" placeholder="Es. ROSSI"></label>
        <label class="kit-field"><span>Numero</span><input type="text" inputmode="numeric" maxlength="2" value="${esc(bp.number)}" data-text="backPrint.number" placeholder="Es. 10"></label>
        <div class="kit-sub">Carattere</div>
        <div class="kit-chips">${NUMBER_FONTS.map(f => this._chip('back-font', f.id, f.label, bp.font === f.id)).join('')}</div>
        <div class="kit-sub">Colore</div>
        <div class="kit-color-row">${this._colorPicker('backPrint.color', bp.color)}</div>
        <div class="kit-sub">Bordo</div>
        <div class="kit-chips">
          ${this._chip('back-outline', '0', 'Senza bordo', !bp.outline)}
          ${this._chip('back-outline', '1', 'Con bordo', !!bp.outline)}
        </div>
        ${bp.outline ? `<div class="kit-color-row" style="margin-top:.4rem;">${this._colorPicker('backPrint.outline', bp.outline)}</div>` : ''}
        ${this._range('backPrint.nameSize', 'Dim. nome', bp.nameSize, 60, 150, '%')}
        ${this._range('backPrint.numSize', 'Dim. numero', bp.numSize, 60, 150, '%')}
        ${this._range('backPrint.y', 'Posizione', bp.y, -50, 50)}` : ''}
      </div>
      ${this._group('Sponsor sul retro (sotto il numero)', 'backLow', this._sponsorEditor('backSponsor'))}
      <div class="kd-desc" style="margin-top:.9rem;">Aprendo questa fase la maglia si gira sul retro: usa <b>Davanti</b> sotto l'anteprima per tornare al fronte.</div>`;
  },

  _secBrand() {
    const k = this._kit;
    const crest = this._crest();
    const isPng = k.brand.id === 'custom' || String(k.brand.id).startsWith('png:');
    const cell = (id, inner, label) => `<button class="kit-opt ${k.brand.id === id ? 'on' : ''}" data-act="brand" data-v="${esc(id)}" title="${esc(label)}">
        <div class="kit-brand" style="background:${esc(k.colors.base)};">${inner}</div><span class="lb">${esc(label)}</span></button>`;
    const cells = [
      cell('none', '<i class="ri-forbid-line" style="font-size:1.3rem; color:var(--text2);font-family:var(--font-sub,inherit);"></i>', 'Nessuno'),
      ...getPngBrands().map(b => cell('png:' + b.id, `<img src="${esc(b.url)}" alt="">`, b.name)),
      ...BRANDS.filter(b => b.id !== 'none' && b.id !== 'custom').map(b => cell(b.id, `<img src="${brandThumbUrl(b, k.brand.color, k.colors.base)}" alt="">`, b.label)),
      cell('custom', k.brand.url ? `<img src="${esc(k.brand.url)}" alt="">` : '<i class="ri-upload-2-line" style="font-size:1.3rem; color:var(--text2);font-family:var(--font-sub,inherit);"></i>', 'Il tuo PNG')
    ];
    return `
      <div class="kd-group" data-focus="chest">
      <div class="kit-sub">Stemma della squadra (in alto a ${k.crest.swap ? 'destra' : 'sinistra'})</div>
      ${crest ? `
        <div class="kit-chips">
          ${this._chip('crest-show', '1', 'Mostra stemma', k.crest.show)}
          ${this._chip('crest-show', '0', 'Nascondi', !k.crest.show)}
        </div>
        ${k.crest.show ? `
        ${this._range('crest.size', 'Dimensione', k.crest.size, 60, 150, '%')}
        ${this._range('crest.x', 'Sposta ↔', k.crest.x || 0, -40, 40)}
        ${this._range('crest.y', 'Sposta ↕', k.crest.y || 0, -30, 30)}
        <div class="kit-chips" style="margin-top:.4rem;">${this._chip('crest-reset', '1', 'Ripristina posizione', false)}</div>` : ''}
        <div class="mp-muted">Lo stemma viene scontornato automaticamente.</div>`
        : `<div class="mp-muted">Non hai ancora un logo: caricalo da <b>Configurazione squadra</b> e comparirà sulla maglia.</div>`}
      <div class="kit-chips" style="margin-top:.6rem;">${this._chip('crest-swap', '1', '⇄ Inverti stemma e marchio tecnico', !!k.crest.swap)}</div>
      </div>
      <div class="kd-group" data-focus="chest">
      <div class="kit-sub">Marchio tecnico (in alto a ${k.crest.swap ? 'sinistra' : 'destra'})</div>
      <div class="kit-grid wide">${cells.join('')}</div>
      ${k.brand.id === 'custom' ? `
        <div class="kit-field">${this._uploadBtn('brand', !!k.brand.url, 'marchio')}</div>
        <div class="mp-muted">Solo immagini <b>PNG</b> con sfondo trasparente.</div>` : ''}
      ${isPng ? `<div class="kit-chips" style="margin:.6rem 0;">
          ${this._chip('brand-mono', '0', 'Colori originali', !k.brand.mono)}
          ${this._chip('brand-mono', '1', 'Tinta unica', k.brand.mono)}
        </div>` : ''}
      ${k.brand.id !== 'none' && (!isPng || k.brand.mono) ? `<div class="kit-sub">Colore del marchio</div><div class="kit-color-row">${this._colorPicker('brand.color', k.brand.color)}</div>` : ''}
      ${k.brand.id !== 'none' ? `
      <div class="kit-sub">Posizione del marchio</div>
      ${this._range('brand.size', 'Dimensione', k.brand.size || 100, 60, 150, '%')}
      ${this._range('brand.x', 'Sposta ↔', k.brand.x || 0, -40, 40)}
      ${this._range('brand.y', 'Sposta ↕', k.brand.y || 0, -30, 30)}
      <div class="kit-chips" style="margin-top:.4rem;">${this._chip('brand-reset', '1', 'Ripristina posizione', false)}</div>` : ''}
      </div>`;
  },

  /**
   * Patch della competizione in anteprima (manica sinistra) mentre è aperta la fase delle patch: quelle della competizione
   * scelta (_compPrev), altrimenti di una a cui partecipa la squadra, altrimenti della prima. Una competizione può averne più di una.
   */
  _compPreview() {
    const all = getCompPatches().filter(p => p.compId);
    if (!all.length) return null;
    const ids = [...new Set(all.map(p => String(p.compId)))];
    const mine = (window.STATE.competitions || []).filter(c => c && c.teams && Object.values(c.teams).some(t => String(t && t.id !== undefined ? t.id : t) === String(this._teamId)));
    const compId = ids.find(id => id === String(this._compPrev)) || ids.find(id => mine.some(c => String(c.id) === id)) || ids[0];
    const list = getCompPatchesOf(compId);
    // _compOnly: nell'editor si vede (e si regola) una sola patch; null = tutte, come nel Live
    const only = list.some(p => p.id === this._compOnly) ? this._compOnly : '';
    return { ids, compId, list, only };
  },

  /** Opzioni dell'anteprima 3D: nella fase delle patch anche quelle della competizione (non finiscono nella foto salvata). */
  _compPatchOpts() {
    const pv = this._open === 'patches' && this._compPreview();
    return pv ? { compPatches: pv.list.map(p => ({ id: p.id, url: p.url })), compPatchOnly: pv.only } : {};
  },

  /** Dimensione e posizione attuali della patch di competizione `id` (quelle di partenza se non è ancora stata regolata). */
  _compTf(id) {
    const p = getCompPatches().find(x => x.id === id);
    const list = p ? getCompPatchesOf(p.compId) : [];
    return compPatchTf(this._kit, id, Math.max(0, list.findIndex(x => x.id === id)), list.length || 1);
  },

  _secPatches() {
    const k = this._kit;
    const avail = availablePatches();
    const pv = this._compPreview();
    const shown = pv ? pv.list.filter(p => !pv.only || p.id === pv.only) : [];
    const compName = (id) => ((window.STATE.competitions || []).find(c => String(c.id) === String(id)) || {}).name || '';
    const current = k.patches.map((p, i) => `
      <div class="kit-patch" data-focus="${PATCH_FOCUS[p.pos] || 'front'}">
        <img data-cut="${esc(p.src)}" alt="">
        <div class="nm">${esc(p.name || 'Patch')}</div>
        <button class="kit-icon-btn" data-act="patch-del" data-i="${i}" title="Rimuovi"><i class="ri-delete-bin-line"></i></button>
        <select class="kit-patch-pos" data-patch-pos="${i}">
          ${PATCH_POSITIONS.map(pp => `<option value="${pp.id}" ${p.pos === pp.id ? 'selected' : ''}>${pp.label}</option>`).join('')}
        </select>
        <div style="order:6; flex-basis:100%;">
          ${this._range(`patches.${i}.size`, 'Dimensione', p.size || 100, 50, 200, '%')}
          ${this._range(`patches.${i}.x`, 'Sposta ↔', p.x || 0, -30, 30)}
          ${this._range(`patches.${i}.y`, 'Sposta ↕', p.y || 0, -30, 30)}
          <div class="kit-chips" style="margin-top:.3rem;"><button class="lv-chip" data-act="patch-reset" data-i="${i}">Ripristina posizione</button></div>
        </div>
      </div>`).join('');
    const full = k.patches.length >= MAX_PATCHES;
    return `
      ${this._group('Patch della competizione · manica sinistra', 'sleevePatch', pv ? `
        <div class="kd-desc" style="margin:0 0 .5rem;">Si mettono <b>da sole</b> sulla manica sinistra: nel Live (e nei replay) la tua maglia ha <b>tutte</b> le patch della competizione della partita. Qui scegli dimensione e posizione di ognuna.</div>
        ${pv.ids.length > 1 ? `<div class="kit-sub">Competizione</div><div class="kd-opts">${pv.ids.map(id => `<button class="lv-chip ${id === pv.compId ? 'on' : ''}" data-act="comp-prev" data-v="${esc(id)}">${esc(compName(id) || 'Competizione')}</button>`).join('')}</div>`
          : `<div class="mp-muted">Competizione: ${esc(compName(pv.compId) || 'Competizione')}</div>`}
        ${pv.list.length > 1 ? `<div class="kit-sub">Cosa vedere</div>
        <div class="kd-opts">${this._chip('comp-only', '', `Tutte (${pv.list.length})`, !pv.only)}${pv.list.map(p => this._chip('comp-only', p.id, `Solo ${p.name || 'patch'}`, pv.only === p.id)).join('')}</div>` : ''}
        ${shown.map(p => {
          const tf = this._compTf(p.id), path = `compPatches.${p.id}`;
          return `<div class="kit-patch">
            <img data-cut="${esc(p.url)}" alt="">
            <div class="nm">${esc(p.name || 'Patch')}</div>
            <div style="order:6; flex-basis:100%;">
              ${this._range(`${path}.size`, 'Dimensione', tf.size, 50, 200, '%')}
              ${this._range(`${path}.x`, 'Sposta ↔', tf.x, -30, 30)}
              ${this._range(`${path}.y`, 'Sposta ↕', tf.y, -30, 30)}
              <div class="kit-chips" style="margin-top:.3rem;">${this._chip('comp-patch-reset', p.id, 'Ripristina posizione', false)}</div>
            </div>
          </div>`;
        }).join('')}`
        : '<div class="kd-desc" style="margin:0;">Le patch della competizione si mettono da sole sulla manica sinistra quando giochi. Il Patron non ne ha ancora caricata nessuna.</div>')}
      ${this._group(`Patch campione (${k.patches.length}/${MAX_PATCHES})`, 'chest', `
        ${current || '<div class="mp-muted">Nessuna patch campione sulla maglia.</div>'}
        ${full ? `<div class="mp-muted" style="margin-top:.6rem;">Hai raggiunto il massimo di ${MAX_PATCHES} patch.</div>` : avail.length ? `
        <button class="mp-btn" data-act="open-picker" data-v="patch" style="width:100%; margin-top:.6rem;"><i class="ri-add-line"></i> Aggiungi una patch campione</button>`
          : '<div class="mp-muted" style="margin-top:.4rem;">Il Patron non ha ancora caricato patch campione.</div>'}
        ${this._picker === 'patch' && !full ? this._modal('Aggiungi una patch campione', `<div class="kit-grid wide">
          ${avail.map(a => `<button class="kit-opt kit-comp" data-act="patch-add" data-v="${esc(a.id)}" title="${esc(a.name)}">
            <img data-cut="${esc(a.src)}" alt=""><span class="lb">${esc(a.name)}</span></button>`).join('')}
        </div>`) : ''}
        <div class="kd-desc">Le patch vengono scontornate automaticamente. Per ognuna scegli il punto (centro petto, sotto lo sponsor, manica destra o fondo maglia), poi regola dimensione e posizione con i cursori: la manica sinistra è della patch della competizione.</div>`)}`;
  },


  /* ------------------------------------------------------------- eventi */
  _set(path, value) {
    const parts = path.split('.');
    // patch della competizione regolata per la prima volta: parte dalla dimensione e posizione che si vedono
    if (parts[0] === 'compPatches' && !this._kit.compPatches[parts[1]]) this._kit.compPatches[parts[1]] = { ...this._compTf(parts[1]) };
    let o = this._kit;
    parts.slice(0, -1).forEach(p => { o = o[p]; });
    o[parts[parts.length - 1]] = value;
  },

  /** Finestra a tutto schermo con la maglia: ruota in ogni direzione, zoom (due dita, rotella o + / −) e spostamento. */
  _openZoom() {
    if (this._zoom) return;
    const el = document.createElement('div');
    el.className = 'kit-zoom';
    el.innerHTML = `
      <div class="kit-zoom-head"><span>${esc(SLOTS[this._slot].label)}</span><button data-z="close" aria-label="Chiudi"><i class="ri-close-line"></i> Chiudi</button></div>
      <div class="kit-zoom-stage"><div></div></div>
      <div class="kit-zoom-bar">
        <button data-z="front">Davanti</button><button data-z="back">Retro</button>
        <button data-z="in" aria-label="Avvicina">＋ Zoom</button>
        <button data-z="out" aria-label="Allontana">− Zoom</button>
      </div>`;
    document.body.appendChild(el);
    const viewer = createKitViewer(el.querySelector('.kit-zoom-stage > div'), { zoom: true });
    viewer.update(this._kit, { crestUrl: this._crest(), ...this._compPatchOpts() }).catch(err => console.error('Divisa:', err));
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
    const i = Number(btn.dataset.i);
    const k = this._kit;

    switch (act) {
      case 'toggle':
        this._picker = null;
        const wasPatches = this._open === 'patches';
        this._open = this._open === btn.dataset.sec ? null : btn.dataset.sec;
        this._root.querySelectorAll('.kit-acc').forEach(a => a.classList.toggle('open', a.dataset.sec === this._open));
        this._renderSection();
        if (wasPatches !== (this._open === 'patches')) this._renderPreview(); // patch della competizione in anteprima
        this._scrollToOpen();
        // senza patch di competizione la fase delle patch inquadra il petto (la manica sinistra resterebbe vuota)
        if (this._open) this._focusTo(this._open === 'patches' && !this._compPreview() ? 'chest' : SEC_FOCUS[this._open] || 'front', true);
        return;
      case 'slot': this._switchSlot(Number(v)); return;
      case 'copy-first': this._copyFirst(); return;
      case 'save': this._save(); return;
      case 'reset': this._reset(); return;
      case 'undo':
        if (!this._dirty()) return;
        this._kit = normalizeKit(JSON.parse(this._saved));
        this._layer = 0; this._layerPage = null;
        this._renderPreview(); this._renderSection();
        return;
      case 'zoom-open': this._openZoom(); return;
      case 'view':
        this._focusTo(v, true);
        return;
      case 'layer-reset':
        this._update(kit => { const l = kit.layers[Math.min(this._layer, kit.layers.length - 1)]; if (l) Object.assign(l, { x: 0, y: 0, rot: 0, scale: 100 }); });
        return;
      case 'sleeve-reset':
        this._update(kit => { kit.sleeveTf = { x: 0, y: 0, scale: 100, rot: 0 }; });
        return;
      case 'collarShape': case 'sleeveCut': case 'collar': case 'cuffs': case 'sleeveDeco':
        this._update(kit => { kit[act] = v; });
        return;
      case 'preset': {
        const p = PRESETS[Number(v)];
        if (!p) return;
        this._update(kit => {
          kit.layers = normalizeKit({ layers: clone(p.kit.layers) }).layers;
          if (p.kit.sleeveDeco) { kit.sleeveDeco = p.kit.sleeveDeco; kit.sleeveDecoN = p.kit.sleeveDecoN || kit.sleeveDecoN; }
        }, { section: false });
        this._layer = 0; this._layerPage = null;
        return;
      }
      case 'swatch':
        this._update(() => this._set(btn.dataset.path, v));
        return;
      case 'sleeves-as-base':
        this._update(kit => { kit.colors.sleeves = kit.colors.base; if (kit.colors.sleevesR) kit.colors.sleevesR = kit.colors.base; });
        return;
      case 'sleeves-split':
        this._update(kit => { kit.colors.sleevesR = v === '1' ? (kit.colors.sleevesR || kit.colors.sleeves) : ''; });
        return;
      case 'shoulderShape':
        this._update(kit => { kit.shoulders.shape = v; });
        return;
      case 'shoulder-match':
        this._update(kit => { kit.shoulders.match = v === '1'; });
        return;
      case 'stripes-reach':
        this._update(kit => { kit.sleeveDecoShoulder = v === '1'; });
        return;
      case 'swap-colors':
        this._update(kit => {
          const c = kit.colors;
          [c.base, c.collar] = [c.collar, c.base];
          c.sleeves = c.base; c.sleevesR = ''; c.cuffs = c.collar; c.trim = c.collar;
        });
        return;

      // livelli
      case 'layer-add':
        if (k.layers.length >= MAX_LAYERS) return;
        this._update(kit => {
          // nuovo livello: una striscia singola, poi si sceglie il disegno e si aumenta il numero
          kit.layers.push({ type: 'm-stripe', ...motifParams({ type: 'm-stripe' }), color: kit.colors.collar || '#ffffff', opacity: 100, scale: 100, flipX: false, flipY: false, x: 0, y: 0, rot: 0, zone: 'body', wrap: 'whole' });
          this._layer = kit.layers.length - 1;
          this._layerPage = 'menu';
        });
        this._scrollToOpen();
        return;
      case 'open-layer':
        this._layer = i; this._layerPage = 'menu';
        this._renderSection();
        this._scrollToOpen();
        this._focusTo(ZONE_FOCUS[(k.layers[i] || {}).zone] || 'front');
        return;
      case 'layer-page':
        this._layerPage = v || null;
        this._renderSection();
        this._scrollToOpen();
        return;
      case 'layer-dup': {
        // copia del livello subito sopra l'originale: si apre la copia per modificarla
        e.stopPropagation();
        if (k.layers.length >= MAX_LAYERS) { window.showToast(`Massimo ${MAX_LAYERS} livelli`, 'err'); return; }
        const src = Number.isFinite(i) ? i : this._layer;
        this._update(kit => { kit.layers.splice(src + 1, 0, clone(kit.layers[src])); this._layer = src + 1; this._layerPage = 'menu'; });
        window.showToast(`Copia creata: è il livello ${this._layer + 1}`, 'ok');
        return;
      }
      case 'layer-param': {
        const key = btn.dataset.k;
        this._update(kit => {
          const l = kit.layers[this._layer];
          l[key] = ['stagger', 'all', 'symMono'].includes(key) ? v === '1' : v;
          if (key === 'shape' && v === 'png') l.symUrl = btn.dataset.url || l.symUrl; // simbolo PNG del Patron
        });
        return;
      }
      case 'layer-del':
        e.stopPropagation();
        this._update(kit => {
          kit.layers.splice(i, 1);
          this._layer = Math.max(0, Math.min(this._layer, kit.layers.length - 1));
          this._layerPage = null;
        });
        return;
      case 'layer-up': case 'layer-down': {
        e.stopPropagation();
        const j = act === 'layer-up' ? i - 1 : i + 1;
        if (j < 0 || j >= k.layers.length) return;
        this._update(kit => { [kit.layers[i], kit.layers[j]] = [kit.layers[j], kit.layers[i]]; this._layer = j; });
        return;
      }
      case 'copy-color': {
        const hex = String(btn.dataset.path.split('.').reduce((o, k2) => (o ? o[k2] : undefined), this._kit) || '').toLowerCase();
        const text = btn.dataset.fmt === 'rgb' ? hexToRgb(hex) : hex;
        copyText(text).then(ok => window.showToast(ok ? `Copiato: ${text}` : 'Copia non riuscita', ok ? 'ok' : 'err'));
        return;
      }
      case 'open-picker':
        this._picker = v; this._renderSection();
        return;
      case 'close-picker':
        // sul fondo scuro: chiudo solo se il tocco è proprio sul fondo (non dentro la finestra)
        if (btn.dataset.self && e.target !== btn) return;
        this._picker = null; this._renderSection();
        return;
      case 'layer-type': {
        const pt = PATTERNS.find(x => x.id === v);
        this._update(kit => {
          const l = kit.layers[this._layer];
          // un motivo nuovo riparte dai suoi valori (striscia singola, una forma, ...)
          if (pt && pt.motif && l.type !== v) Object.assign(l, motifParams({ type: v }));
          l.type = v;
          this._layerPage = 'menu';
        });
        this._scrollToOpen();
        return;
      }
      case 'layer-zone':
        this._update(kit => { kit.layers[this._layer].zone = v; });
        this._focusTo(ZONE_FOCUS[v] || 'front');
        return;
      case 'layer-wrap':
        this._update(kit => { kit.layers[this._layer].wrap = v; });
        return;
      case 'layer-flag':
        this._update(kit => { const l = kit.layers[this._layer]; l[v] = !l[v]; });
        return;
      case 'layer-mono':
        this._update(kit => { kit.layers[this._layer].mono = v === '1'; });
        return;

      // sponsor
      case 'sponsor-mode': this._update(kit => { kit[btn.dataset.key].mode = v; }); return;
      case 'sponsor-font': this._update(kit => { kit[btn.dataset.key].font = v; }); return;
      case 'sponsor-mono': this._update(kit => { kit[btn.dataset.key].mono = v === '1'; }); return;

      // retro: nome e numero
      case 'back-show': this._update(kit => { kit.backPrint.show = v === '1'; }); return;
      case 'back-font': this._update(kit => { kit.backPrint.font = v; }); return;
      case 'back-outline': this._update(kit => { kit.backPrint.outline = v === '1' ? (kit.colors.base === '#000000' ? '#ffffff' : '#000000') : ''; }); return;

      // stemma e marchio
      case 'crest-show': this._update(kit => { kit.crest.show = v === '1'; }); return;
      case 'crest-swap': this._update(kit => { kit.crest.swap = !kit.crest.swap; }); return;
      case 'brand': this._update(kit => { kit.brand.id = v; }); return;
      case 'brand-mono': this._update(kit => { kit.brand.mono = v === '1'; }); return;
      case 'crest-reset': this._update(kit => { Object.assign(kit.crest, { size: 100, x: 0, y: 0 }); }); return;
      case 'brand-reset': this._update(kit => { Object.assign(kit.brand, { size: 100, x: 0, y: 0 }); }); return;

      // patch
      case 'patch-add': {
        this._picker = null;
        if (k.patches.length >= MAX_PATCHES) return;
        const a = availablePatches().find(x => x.id === v);
        if (!a) return;
        const used = new Set(k.patches.map(p => p.pos));
        const pos = (PATCH_POSITIONS.find(pp => !used.has(pp.id)) || PATCH_POSITIONS[0]).id;
        this._update(kit => { kit.patches.push({ id: a.id, name: a.name, src: a.src, pos, size: 100, x: 0, y: 0 }); });
        this._focusTo(PATCH_FOCUS[pos] || 'front');
        return;
      }
      case 'comp-prev':
        this._compPrev = v; this._compOnly = null;
        this._renderPreview(); this._renderSection();
        return;
      case 'comp-only':
        this._compOnly = v || null;
        this._renderPreview(); this._renderSection();
        return;
      case 'comp-patch-reset':
        // torna alla posizione di partenza (con una sola patch nella competizione anche quella del formato di prima)
        this._update(kit => { delete kit.compPatches[v]; kit.compPatchTf = { size: 100, x: 0, y: 0 }; });
        return;
      case 'patch-reset':
        this._update(kit => { Object.assign(kit.patches[i], { size: 100, x: 0, y: 0 }); });
        return;
      case 'patch-del':
        this._update(kit => { kit.patches.splice(i, 1); });
        return;
    }
  },

  /** Tocco su un gruppo: la maglia inquadra quella parte. Tasti − / +: tenendo premuto il numero corre. */
  _onPointerDown(e) {
    const st = e.target.closest('[data-step]');
    if (st && this._root.contains(st)) { e.preventDefault(); this._stepStart(st); }
    const g = e.target.closest('[data-focus]');
    if (g && this._root.contains(g)) this._focusTo(g.dataset.focus);
  },

  _stepStart(btn) {
    if (this._stepStop) this._stepStop();
    const path = btn.dataset.step, d = Number(btn.dataset.d), min = Number(btn.dataset.min), max = Number(btn.dataset.max);
    const box = btn.closest('.kd-step, .kd-range'), input = box.querySelector('input'), out = box.querySelector('.val');
    const unit = input.dataset.unit || '';
    let n = 0;
    const apply = () => {
      // tenendo premuto accelera (su 1000 forme anche di 25 alla volta)
      const cur = Number(input.value), step = n > 60 && max > 100 ? 25 : n > 25 ? 5 : 1; n++;
      const nv = Math.min(max, Math.max(min, cur + d * step));
      if (nv === cur) return;
      input.value = nv; out.textContent = nv + unit;
      this._set(path, nv);
      this._schedulePreview();
    };
    apply();
    let t = setTimeout(function rep() { apply(); t = setTimeout(rep, 80); }, 420);
    const stop = () => {
      clearTimeout(t);
      window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop);
      this._stepStop = null;
      if (this._root) this._renderSection(); // miniature e riassunti
    };
    window.addEventListener('pointerup', stop); window.addEventListener('pointercancel', stop);
    this._stepStop = stop;
  },

  /** Durante il trascinamento di slider / color picker aggiorno solo l'anteprima. */
  _onInput(e) {
    const t = e.target;
    if (t.dataset.range) {
      this._set(t.dataset.range, Number(t.value));
      const val = t.parentElement.querySelector('.val');
      if (val) val.textContent = t.value + (t.dataset.unit || '');
      this._schedulePreview();
    } else if (t.dataset.color) {
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
      this._set(t.dataset.text, t.value);
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
    } else if (t.dataset.color || t.dataset.range) {
      // a fine scelta ridisegno la sezione (miniature e pallini dei colori)
      this._renderSection();
    } else if (t.dataset.patchPos !== undefined) {
      this._update(kit => { kit.patches[Number(t.dataset.patchPos)].pos = t.value; });
      this._focusTo(PATCH_FOCUS[t.value] || 'front');
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
      const li = kind.startsWith('layer:') ? Number(kind.slice(6)) : -1;
      const si = kind.startsWith('sym:') ? Number(kind.slice(4)) : -1; // simbolo PNG di una forma
      // un livello copre tutto il pezzo: serve più risoluzione di marchi e sponsor
      const url = await uploadPngToImgBB(file, li >= 0 ? 1600 : si >= 0 ? 600 : undefined);
      if (!this._kit) return;
      if (si >= 0) {
        this._update(kit => { const l = kit.layers[si]; if (l) Object.assign(l, { shape: 'png', symUrl: url }); });
        window.showToast('Simbolo caricato: ricorda di salvare la divisa', 'ok');
        return;
      }
      if (li >= 0) { this._picker = null; this._layerPage = 'menu'; }
      this._update(kit => {
        if (li >= 0) { const l = kit.layers[li]; if (l) Object.assign(l, { type: 'img', url, mono: !!l.mono && l.type === 'img' }); }
        else if (kind === 'sponsor' || kind === 'backSponsor') kit[kind].url = url;
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

  /** Seconda maglia: riparte da una copia della prima (salvata o in modifica), da salvare poi. */
  _copyFirst() {
    if (this._slot !== 2 || !this._kit) return;
    const first = this._drafts[1] ? this._drafts[1].kit : (window.STATE.user || {}).kit;
    if (!first) { window.showToast('Crea prima la prima maglia', 'err'); return; }
    if (this._dirty() && !confirm('Sostituire la seconda maglia con una copia della prima? Le modifiche non salvate andranno perse.')) return;
    const kit = normalizeKit(clone(first));
    kit.patches = champOnly(kit.patches);
    delete kit.image;
    this._kit = kit;
    this._layer = 0; this._layerPage = null;
    this._renderPreview(); this._renderSection();
    window.showToast('Copiata la prima maglia: modificala e salvala', 'ok');
  },

  /** Cancella la maglia salvata (prima o seconda) e riparte dalla maglia di base. */
  async _reset() {
    if (this._busy || !this._kit) return;
    const team = window.STATE.user;
    if (!team || String(team.id) !== String(this._teamId)) return;
    const field = this._field();
    const name = this._slot === 2 ? 'la seconda maglia' : 'la prima maglia';
    if (!confirm(`Eliminare ${name}? Verrà cancellata e ripartirai dalla maglia di base.`)) return;
    this._busy = true;
    try {
      if (team[field]) await update(ref(db, `teams/${team.id}`), { [field]: null });
      team[field] = null; // aggiornamento immediato; il listener del DB lo riconferma
      this._kit = normalizeKit(defaultKit());
      this._saved = JSON.stringify(this._kit);
      this._layer = 0; this._layerPage = null;
      this._open = 'model';
      this._root.querySelectorAll('.kit-acc').forEach(a => a.classList.toggle('open', a.dataset.sec === this._open));
      this._renderSlots(); this._renderPreview(); this._renderSection();
      window.showToast(`${this._slot === 2 ? 'Seconda' : 'Prima'} maglia eliminata: puoi ricrearla da zero`, 'ok');
    } catch (err) {
      console.error(err);
      window.showToast('Eliminazione non riuscita, riprova', 'err');
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
    window.showToast('Salvataggio in corso...', 'ok');
    const kit = clone(this._kit);
    delete kit.image;
    const field = this._field();
    const slot = this._slot;
    try {
      // foto della maglia per il resto dell'app (scheda club, configurazione squadra)
      try {
        const dataUrl = await renderKitImage(kit, { crestUrl: this._crest(), width: 600 });
        if (dataUrl) {
          const blob = await dataUrlToBlob(dataUrl);
          kit.image = await uploadPngToImgBB(new File([blob], `divisa-${team.id}${slot === 2 ? '-2' : ''}.png`, { type: 'image/png' }), 600);
        }
      } catch (e) { console.warn('Foto della divisa non caricata', e); }
      await update(ref(db, `teams/${team.id}`), { [field]: kit });
      team[field] = kit; // aggiornamento immediato; il listener del DB lo riconferma
      if (!this._kit) return;
      if (kit.image) this._kit.image = kit.image;
      this._saved = JSON.stringify(this._kit);
      this._renderSlots();
      this._renderPreview();
      window.showToast(`${slot === 2 ? 'Seconda' : 'Prima'} maglia salvata!`, 'ok');
    } catch (err) {
      console.error(err);
      window.showToast('Salvataggio non riuscito, riprova', 'err');
    } finally {
      this._busy = false;
      if (btn) btn.classList.remove('busy');
    }
  }
};
