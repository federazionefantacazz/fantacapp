/**
 * Scontorna le immagini da applicare sulla maglia (patch delle competizioni, stemma):
 * se il logo ha uno sfondo pieno (es. JPG bianco) lo rende trasparente partendo dai bordi,
 * poi ritaglia l'immagine sul contenuto. Il risultato è un PNG (data URL) tenuto in memoria.
 *
 * Uso: cutoutSync(url) restituisce subito il PNG se è già pronto ('' se è in lavorazione);
 * whenCutoutsReady(urls) risolve quando tutti sono pronti.
 */
const MAX_SIDE = 1024;    // risoluzione massima del logo scontornato (più alta = più nitido sulla maglia)
const TOLERANCE = 52;     // distanza di colore dallo sfondo considerata "sfondo"
const FEATHER = 90;       // oltre la tolleranza: bordo sfumato fino a questa distanza

const cache = new Map();   // url -> data URL PNG (o url originale se non elaborabile)
const pending = new Map(); // url -> Promise

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!/^data:/i.test(url)) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

const dist = (d, i, c) => Math.max(Math.abs(d[i] - c[0]), Math.abs(d[i + 1] - c[1]), Math.abs(d[i + 2] - c[2]));

function process(img) {
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h); // lancia un errore se l'immagine non è CORS
  const d = data.data;

  // bordo: se è già in gran parte trasparente il logo è già scontornato
  const border = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y++) border.push(y * w, y * w + w - 1);
  const opaque = border.filter(p => d[p * 4 + 3] > 200);
  if (opaque.length > border.length * 0.4) {
    // colore di sfondo = mediana dei pixel opachi del bordo
    const med = (k) => opaque.map(p => d[p * 4 + k]).sort((a, b) => a - b)[opaque.length >> 1];
    const bg = [med(0), med(1), med(2)];
    // flood fill dai bordi sui pixel simili allo sfondo
    const seen = new Uint8Array(w * h);
    const stack = border.filter(p => d[p * 4 + 3] > 0 && dist(d, p * 4, bg) <= FEATHER);
    stack.forEach(p => { seen[p] = 1; });
    while (stack.length) {
      const p = stack.pop();
      const i = p * 4;
      const dd = dist(d, i, bg);
      if (dd <= TOLERANCE) d[i + 3] = 0;
      else { d[i + 3] = Math.min(d[i + 3], Math.round(255 * (dd - TOLERANCE) / (FEATHER - TOLERANCE))); continue; }
      const x = p % w, y = (p / w) | 0;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of nb) {
        if (q < 0 || seen[q]) continue;
        seen[q] = 1;
        if (d[q * 4 + 3] === 0 || dist(d, q * 4, bg) <= FEATHER) stack.push(q);
      }
    }
    ctx.putImageData(data, 0, 0);
  }

  // ritaglio sul contenuto visibile
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return canvas.toDataURL('image/png');
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const out = document.createElement('canvas');
  out.width = cw; out.height = ch;
  out.getContext('2d').drawImage(canvas, x0, y0, cw, ch, 0, 0, cw, ch);
  return out.toDataURL('image/png');
}

export function getCutout(url) {
  if (!url) return Promise.resolve('');
  if (cache.has(url)) return Promise.resolve(cache.get(url));
  if (pending.has(url)) return pending.get(url);
  const job = loadImage(url)
    .then(img => { try { return process(img); } catch (e) { return url; } }) // CORS: uso l'originale
    .catch(() => url)
    .then(res => { cache.set(url, res); pending.delete(url); return res; });
  pending.set(url, job);
  return job;
}

/** PNG scontornato se pronto, '' se ancora in lavorazione (e la avvia). */
export function cutoutSync(url) {
  if (!url) return '';
  if (cache.has(url)) return cache.get(url);
  getCutout(url);
  return '';
}

export function whenCutoutsReady(urls) {
  const todo = urls.filter(u => u && !cache.has(u));
  return todo.length ? Promise.all(todo.map(getCutout)).then(() => true) : null;
}
