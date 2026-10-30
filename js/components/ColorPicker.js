/**
 * Selettore colori dell'app (uguale su iPhone e Android, al posto di quello del sistema).
 * installColorPicker(): ogni <input type="color" class="kit-color"> toccato apre un pannello dal basso con
 * quadrato chiarezza/saturazione, barra della tinta, codice HEX e i colori già usati nella pagina.
 * Il pannello scrive nel campo colore e manda gli eventi 'input' (mentre si sceglie) e 'change' (a fine scelta),
 * così gli editor che già ascoltano il campo funzionano senza cambiare nulla.
 */
const STYLE_ID = 'app-color-picker-style';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const hex2 = (n) => Math.round(n).toString(16).padStart(2, '0');

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgbToHex = (r, g, b) => '#' + hex2(r) + hex2(g) + hex2(b);

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, max ? d / max : 0, max];
}

function hsvToRgb(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** Colore scritto a mano: #rrggbb, #rgb o "r, g, b". */
function parseTyped(str) {
  const s = String(str || '').trim();
  let m = /^#?([0-9a-f]{6})$/i.exec(s);
  if (m) return '#' + m[1].toLowerCase();
  m = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s);
  if (m) return ('#' + m[1] + m[1] + m[2] + m[2] + m[3] + m[3]).toLowerCase();
  m = /^(?:rgb\()?\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*\)?$/i.exec(s);
  if (m && [m[1], m[2], m[3]].every(v => +v <= 255)) return rgbToHex(+m[1], +m[2], +m[3]);
  return null;
}

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement('style');
  st.id = STYLE_ID;
  st.textContent = `
    .acp-back { position: fixed; inset: 0; z-index: 10050; background: rgba(0,0,0,.45); display: flex; align-items: flex-end; justify-content: center; }
    .acp { width: 100%; max-width: 480px; background: var(--bg2, #1a2027); color: var(--text, #eee); border-radius: 18px 18px 0 0;
      border: 1px solid var(--border, #333); border-bottom: none; padding: .9rem 1rem calc(1rem + var(--safe-b, env(safe-area-inset-bottom, 0px))); box-sizing: border-box;
      box-shadow: 0 -8px 30px rgba(0,0,0,.4); font-family: inherit; }
    .acp-head { display: flex; align-items: center; gap: .7rem; margin-bottom: .8rem; }
    .acp-prev { display: flex; width: 64px; height: 36px; border-radius: 10px; overflow: hidden; border: 1px solid var(--border, #333); flex-shrink: 0; }
    .acp-prev span { flex: 1; }
    .acp-hex { flex: 1; min-width: 0; font: 600 1rem/1 'DM Mono', monospace; padding: .55rem .7rem; border-radius: 10px; border: 1px solid var(--border, #333);
      background: var(--bg3, #252d36); color: var(--text, #eee); text-transform: lowercase; }
    .acp-hex.bad { border-color: #e53935; }
    .acp-sv { position: relative; height: 190px; border-radius: 12px; touch-action: none; cursor: crosshair;
      background-image: linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, rgba(255,255,255,0)); }
    .acp-hue { position: relative; height: 26px; margin: .9rem 0 .2rem; border-radius: 13px; touch-action: none; cursor: pointer;
      background: linear-gradient(to right, #f00, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00); }
    .acp-thumb { position: absolute; width: 26px; height: 26px; margin: -13px 0 0 -13px; border-radius: 50%; border: 3px solid #fff;
      box-shadow: 0 0 0 1px rgba(0,0,0,.45), 0 2px 6px rgba(0,0,0,.4); pointer-events: none; box-sizing: border-box; }
    .acp-hue .acp-thumb { top: 50%; }
    .acp-lbl { font-size: .68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; color: var(--text2, #aab); margin: .8rem 0 .4rem; }
    .acp-sw { display: flex; flex-wrap: wrap; gap: .45rem; }
    .acp-sw button { width: 34px; height: 34px; border-radius: 50%; border: 2px solid rgba(255,255,255,.18); padding: 0; cursor: pointer; }
    .acp-sw button.on { border-color: var(--accent, #f5c518); box-shadow: 0 0 0 2px var(--accent, #f5c518); }
    .acp-btns { display: flex; gap: .6rem; margin-top: 1rem; }
    .acp-btns button { flex: 1; padding: .8rem; border-radius: 12px; font: 700 .95rem/1 inherit; cursor: pointer; border: 1px solid var(--border, #333);
      background: var(--bg3, #252d36); color: var(--text, #eee); }
    .acp-btns .ok { background: var(--accent, #f5c518); color: #111; border-color: var(--accent, #f5c518); }
  `;
  document.head.appendChild(st);
}

const BASE = ['#ffffff', '#000000', '#c62828', '#7a1f1f', '#e65100', '#ffd400', '#2e7d32', '#00695c', '#29b6f6', '#1e5bb8', '#0d1b4c', '#6a1b9a', '#ec407a', '#9e9e9e'];

/** Apre il pannello per il campo colore `input`. */
export function openColorPicker(input) {
  injectStyle();
  const start = (hexToRgb(input.value) ? input.value : '#ffffff').toLowerCase();
  let [h, s, v] = rgbToHsv(...hexToRgb(start));
  let cur = start, raf = 0, dragging = false, lastPush = 0, pushTimer = 0;

  // colori già usati nella pagina (altri campi colore), poi i colori base
  const used = [...new Set([...document.querySelectorAll('input[type="color"].kit-color')].map(i => String(i.value).toLowerCase()))]
    .filter(c => hexToRgb(c)).slice(0, 14);
  const label = input.getAttribute('aria-label') || '';

  const back = document.createElement('div');
  back.className = 'acp-back';
  back.innerHTML = `
    <div class="acp" role="dialog" aria-label="Scegli il colore${label ? ': ' + label.replace(/"/g, '') : ''}">
      <div class="acp-head">
        <div class="acp-prev" title="Prima / adesso"><span style="background:${start}"></span><span class="now"></span></div>
        <input class="acp-hex" type="text" maxlength="24" spellcheck="false" autocomplete="off" autocapitalize="off" inputmode="text" aria-label="Codice HEX o RGB">
      </div>
      <div class="acp-sv"><div class="acp-thumb"></div></div>
      <div class="acp-hue"><div class="acp-thumb"></div></div>
      ${used.length ? `<div class="acp-lbl">Colori usati</div><div class="acp-sw" data-sw="used">${used.map(c => `<button style="background:${c}" data-c="${c}" aria-label="${c}"></button>`).join('')}</div>` : ''}
      <div class="acp-lbl">Colori base</div>
      <div class="acp-sw">${BASE.map(c => `<button style="background:${c}" data-c="${c}" aria-label="${c}"></button>`).join('')}</div>
      <div class="acp-btns"><button class="no">Annulla</button><button class="ok">Fatto</button></div>
    </div>`;
  document.body.appendChild(back);
  const $ = (q) => back.querySelector(q);
  const sv = $('.acp-sv'), svT = sv.firstElementChild, hue = $('.acp-hue'), hueT = hue.firstElementChild, hexIn = $('.acp-hex'), now = $('.acp-prev .now');

  const emit = (type) => input.dispatchEvent(new Event(type, { bubbles: true }));
  const draw = (fromTyping) => {
    cur = rgbToHex(...hsvToRgb(h, s, v));
    sv.style.backgroundColor = rgbToHex(...hsvToRgb(h, 1, 1));
    svT.style.left = (s * 100) + '%'; svT.style.top = ((1 - v) * 100) + '%'; svT.style.background = cur;
    hueT.style.left = (h / 360 * 100) + '%'; hueT.style.background = rgbToHex(...hsvToRgb(h, 1, 1));
    now.style.background = cur;
    if (!fromTyping) { hexIn.value = cur; hexIn.classList.remove('bad'); }
    back.querySelectorAll('.acp-sw button').forEach(b => b.classList.toggle('on', b.dataset.c === cur));
    schedulePush();
  };
  // l'anteprima 3D è pesante: mentre il dito si muove non la ridisegno (così il cerchietto segue il dito),
  // la aggiorno appena il dito si ferma un attimo o si alza
  const PAUSE = 120;
  const push = () => {
    clearTimeout(pushTimer); pushTimer = 0;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    lastPush = performance.now();
    if (input.value !== cur) { input.value = cur; emit('input'); }
  };
  const schedulePush = () => {
    if (!dragging) { if (!raf) raf = requestAnimationFrame(() => { raf = 0; push(); }); return; }
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, PAUSE);
  };
  const setHex = (c, fromTyping) => { [h, s, v] = rgbToHsv(...hexToRgb(c)); draw(fromTyping); };

  const drag = (el, onMove) => {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      dragging = true; lastPush = performance.now();
      const r = el.getBoundingClientRect(); // una volta sola: niente ricalcoli della pagina a ogni movimento
      const move = (ev) => onMove(clamp((ev.clientX - r.left) / r.width, 0, 1), clamp((ev.clientY - r.top) / r.height, 0, 1));
      move(e);
      const up = () => {
        dragging = false; push();
        el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
      };
      el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
  };
  drag(sv, (x, y) => { s = x; v = 1 - y; draw(); });
  drag(hue, (x) => { h = Math.min(359.9, x * 360); draw(); });

  hexIn.addEventListener('input', () => {
    const c = /^#?[0-9a-f]{6}$/i.test(hexIn.value.trim()) ? parseTyped(hexIn.value) : null;
    hexIn.classList.toggle('bad', !parseTyped(hexIn.value) && hexIn.value.trim().length >= 7);
    if (c) setHex(c, true);
  });
  hexIn.addEventListener('change', () => { const c = parseTyped(hexIn.value); if (c) setHex(c); else { hexIn.classList.add('bad'); } });
  hexIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') hexIn.blur(); });

  const close = (keep) => {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    clearTimeout(pushTimer); pushTimer = 0;
    input.value = keep ? cur : start;
    emit('input'); emit('change');
    back.remove();
  };
  back.addEventListener('click', (e) => {
    const sw = e.target.closest('.acp-sw button');
    if (sw) { setHex(sw.dataset.c); return; }
    if (e.target.closest('.ok')) { close(true); return; }
    if (e.target.closest('.no')) { close(false); return; }
    if (e.target === back) close(true); // tocco fuori: tengo il colore scelto
  });
  draw();
}

let installed = false;
/** Da chiamare una volta: i campi colore dell'app aprono questo pannello invece di quello del sistema. */
export function installColorPicker() {
  if (installed) return;
  installed = true;
  document.addEventListener('click', (e) => {
    const input = e.target.closest && e.target.closest('input[type="color"].kit-color');
    if (!input) return;
    e.preventDefault(); // niente selettore del sistema
    openColorPicker(input);
  }, true);
}
