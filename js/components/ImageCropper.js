/**
 * ImageCropper - ritaglio quadrato di un'immagine prima del caricamento (logo squadra).
 * ------------------------------------------------------------------
 * cropSquare(file) apre una schermata con l'immagine e un riquadro quadrato:
 *  - si trascina il riquadro per spostarlo
 *  - si tirano gli angoli (o si usa il cursore "Dimensione") per farlo grande quanto si vuole
 * Risolve con un File PNG ritagliato (trasparenza mantenuta), con il file originale
 * se si sceglie "Intera", oppure con null se si annulla.
 */
import { BackNav } from '../services/backNav.js';

const MAX_OUT = 1024;  // lato massimo del PNG ritagliato (poi l'upload lo comprime comunque)
const MIN_SIDE = 32;   // lato minimo del riquadro, in pixel dell'immagine
const MIN_SCREEN = 56; // ...e a schermo, così gli angoli restano afferrabili
const STYLE_ID = 'image-cropper-style';

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
#crop-overlay{position:fixed;inset:0;z-index:10070;display:flex;flex-direction:column;background:var(--overlay-bg, rgba(5,8,15,.94));color:var(--text);
  padding:calc(env(safe-area-inset-top,0px) + .8rem) 1rem calc(env(safe-area-inset-bottom,0px) + .9rem);-webkit-user-select:none;user-select:none;animation:fadeIn .2s ease-out}
#crop-overlay .cr-title{font-family:'Bebas Neue',sans-serif;font-size:1.6rem;letter-spacing:.5px;line-height:1.1;text-align:center}
#crop-overlay .cr-hint{font-size:.78rem;color:var(--text2);font-family:var(--font-sub,inherit);text-align:center;margin-top:.15rem}
#crop-overlay .cr-stage{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;margin:.8rem 0;touch-action:none}
#crop-overlay .cr-wrap{position:relative;overflow:hidden;border-radius:4px;touch-action:none;
  background:repeating-conic-gradient(rgba(255,255,255,.08) 0 25%, transparent 0 50%) 0 0/16px 16px}
#crop-overlay .cr-wrap img{display:block;width:100%;height:100%;pointer-events:none}
#crop-overlay .cr-box{position:absolute;border:2px solid #fff;box-shadow:0 0 0 9999px rgba(0,0,0,.6);cursor:move;touch-action:none}
#crop-overlay .cr-box::before,#crop-overlay .cr-box::after{content:'';position:absolute;pointer-events:none;border:0 solid rgba(255,255,255,.35)}
#crop-overlay .cr-box::before{left:33.33%;right:33.33%;top:0;bottom:0;border-left-width:1px;border-right-width:1px}
#crop-overlay .cr-box::after{top:33.33%;bottom:33.33%;left:0;right:0;border-top-width:1px;border-bottom-width:1px}
#crop-overlay .cr-h{position:absolute;width:34px;height:34px;touch-action:none;z-index:1}
#crop-overlay .cr-h::after{content:'';position:absolute;width:16px;height:16px;border:0 solid var(--accent,#50e3c2)}
#crop-overlay .cr-h[data-c="nw"]{left:-2px;top:-2px;cursor:nwse-resize}
#crop-overlay .cr-h[data-c="ne"]{right:-2px;top:-2px;cursor:nesw-resize}
#crop-overlay .cr-h[data-c="sw"]{left:-2px;bottom:-2px;cursor:nesw-resize}
#crop-overlay .cr-h[data-c="se"]{right:-2px;bottom:-2px;cursor:nwse-resize}
#crop-overlay .cr-h[data-c="nw"]::after{left:0;top:0;border-left-width:4px;border-top-width:4px}
#crop-overlay .cr-h[data-c="ne"]::after{right:0;top:0;border-right-width:4px;border-top-width:4px}
#crop-overlay .cr-h[data-c="sw"]::after{left:0;bottom:0;border-left-width:4px;border-bottom-width:4px}
#crop-overlay .cr-h[data-c="se"]::after{right:0;bottom:0;border-right-width:4px;border-bottom-width:4px}
#crop-overlay .cr-size{display:flex;align-items:center;gap:.7rem;max-width:460px;width:100%;margin:0 auto .8rem;font-size:.8rem;color:var(--text2);font-family:var(--font-sub,inherit)}
#crop-overlay .cr-size i{font-size:1.1rem}
#crop-overlay .cr-size input{flex:1;accent-color:var(--accent,#50e3c2)}
#crop-overlay .cr-actions{display:flex;gap:.5rem;max-width:460px;width:100%;margin:0 auto}
#crop-overlay .cr-actions button{flex:1;min-height:46px;border-radius:12px;border:1px solid var(--border);background:var(--bg3);color:var(--text);
  font-family:inherit;font-size:.9rem;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:.35rem}
#crop-overlay .cr-actions .cr-ok{background:var(--btn-primary, var(--accent));color:var(--btn-primary-text, #000);border-color:transparent;font-family:var(--font-btn,inherit)}
`;
  document.head.appendChild(style);
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export async function cropSquare(file, { title = 'Ritaglia il logo' } = {}) {
  injectStyle();
  const url = URL.createObjectURL(file);
  let img;
  try {
    img = await loadImage(url);
  } catch (e) {
    // immagine non leggibile dal browser: si carica com'è
    URL.revokeObjectURL(url);
    return file;
  }
  const W = img.naturalWidth, H = img.naturalHeight;
  const maxS = Math.min(W, H);
  let minS = Math.min(MIN_SIDE, maxS);
  // riquadro in pixel dell'immagine: all'inizio il quadrato più grande, al centro
  const box = { s: maxS, x: (W - maxS) / 2, y: (H - maxS) / 2 };

  const ov = document.createElement('div');
  ov.id = 'crop-overlay';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.innerHTML = `
    <div class="cr-title">${title}</div>
    <div class="cr-hint">Trascina il quadrato e tira gli angoli per sceglierne la grandezza</div>
    <div class="cr-stage">
      <div class="cr-wrap">
        <img src="${url}" alt="">
        <div class="cr-box">
          <span class="cr-h" data-c="nw"></span><span class="cr-h" data-c="ne"></span>
          <span class="cr-h" data-c="sw"></span><span class="cr-h" data-c="se"></span>
        </div>
      </div>
    </div>
    <label class="cr-size"><i class="ri-zoom-out-line"></i>
      <input type="range" min="${minS}" max="${maxS}" step="1" value="${maxS}" aria-label="Dimensione del ritaglio">
      <i class="ri-zoom-in-line"></i>
    </label>
    <div class="cr-actions">
      <button type="button" data-act="cancel">Annulla</button>
      <button type="button" data-act="full" title="Carica l'immagine senza ritagliarla">Intera</button>
      <button type="button" class="cr-ok" data-act="ok"><i class="ri-crop-line"></i> Ritaglia</button>
    </div>`;
  document.body.appendChild(ov);

  const stage = ov.querySelector('.cr-stage');
  const wrap = ov.querySelector('.cr-wrap');
  const boxEl = ov.querySelector('.cr-box');
  const range = ov.querySelector('input[type="range"]');
  let k = 1; // pixel a schermo per pixel dell'immagine

  // immagine adattata allo spazio disponibile (si ricalcola se ruota lo schermo)
  function layout() {
    const availW = stage.clientWidth, availH = stage.clientHeight;
    if (!availW || !availH) return;
    k = Math.min(availW / W, availH / H);
    minS = Math.min(maxS, Math.max(MIN_SIDE, MIN_SCREEN / k));
    range.min = Math.round(minS);
    wrap.style.width = Math.round(W * k) + 'px';
    wrap.style.height = Math.round(H * k) + 'px';
    draw();
  }
  function draw() {
    boxEl.style.left = (box.x * k) + 'px';
    boxEl.style.top = (box.y * k) + 'px';
    boxEl.style.width = boxEl.style.height = (box.s * k) + 'px';
    range.value = Math.round(box.s);
  }
  // nuovo lato mantenendo il centro del riquadro
  function resizeAroundCenter(s) {
    const cx = box.x + box.s / 2, cy = box.y + box.s / 2;
    box.s = clamp(s, minS, maxS);
    box.x = clamp(cx - box.s / 2, 0, W - box.s);
    box.y = clamp(cy - box.s / 2, 0, H - box.s);
    draw();
  }

  // trascinamento: spostamento del riquadro o di un angolo (l'angolo opposto resta fermo)
  let drag = null;
  const toImg = (e) => {
    const r = wrap.getBoundingClientRect();
    return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
  };
  boxEl.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const p = toImg(e);
    const corner = e.target.closest('.cr-h')?.dataset.c || null;
    drag = { id: e.pointerId, corner, p0: p, x0: box.x, y0: box.y, s0: box.s,
      ax: corner && corner.includes('w') ? box.x + box.s : box.x,
      ay: corner && corner.includes('n') ? box.y + box.s : box.y };
    boxEl.setPointerCapture(e.pointerId);
  });
  boxEl.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const p = toImg(e);
    if (!drag.corner) {
      box.x = clamp(drag.x0 + p.x - drag.p0.x, 0, W - box.s);
      box.y = clamp(drag.y0 + p.y - drag.p0.y, 0, H - box.s);
    } else {
      const west = drag.corner.includes('w'), north = drag.corner.includes('n');
      const dx = west ? drag.ax - p.x : p.x - drag.ax;
      const dy = north ? drag.ay - p.y : p.y - drag.ay;
      // spazio libero dal lato dell'angolo che si tira
      const roomX = west ? drag.ax : W - drag.ax;
      const roomY = north ? drag.ay : H - drag.ay;
      box.s = clamp(Math.max(dx, dy), minS, Math.min(roomX, roomY));
      box.x = west ? drag.ax - box.s : drag.ax;
      box.y = north ? drag.ay - box.s : drag.ay;
    }
    draw();
  });
  const endDrag = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
  boxEl.addEventListener('pointerup', endDrag);
  boxEl.addEventListener('pointercancel', endDrag);

  range.addEventListener('input', () => resizeAroundCenter(Number(range.value)));

  const ro = 'ResizeObserver' in window ? new ResizeObserver(layout) : null;
  if (ro) ro.observe(stage); else window.addEventListener('resize', layout);
  layout();

  return new Promise((resolve) => {
    let done = false;
    function finish(result, { fromBack = false } = {}) {
      if (done) return;
      done = true;
      if (ro) ro.disconnect(); else window.removeEventListener('resize', layout);
      document.removeEventListener('keydown', onKey);
      ov.remove();
      URL.revokeObjectURL(url);
      if (!fromBack) BackNav.pop('image-cropper');
      resolve(result);
    }
    function onKey(e) { if (e.key === 'Escape') finish(null); }
    document.addEventListener('keydown', onKey);
    // "Indietro" del telefono = Annulla
    BackNav.push('image-cropper', () => finish(null, { fromBack: true }));

    ov.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'cancel') finish(null);
      else if (act === 'full') finish(file);
      else if (act === 'ok') {
        const sx = Math.round(box.x), sy = Math.round(box.y), ss = Math.round(box.s);
        const out = Math.min(ss, MAX_OUT);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = out;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, ss, ss, 0, 0, out, out);
        canvas.toBlob((blob) => {
          if (!blob) return finish(file); // canvas non esportabile: meglio l'originale che niente
          const name = String(file.name || 'logo').replace(/\.[^/.]+$/, '') + '.png';
          finish(new File([blob], name, { type: 'image/png' }));
        }, 'image/png');
      }
    });
  });
}
