/**
 * Piccole funzioni di utilità condivise da tutta l'app (utente e area Patron).
 * Prima erano copiate in ogni file: qui c'è l'unica versione.
 */

/** Testo sicuro da inserire in HTML (contenuto e attributi). */
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Id normalizzato a stringa ('' per null/undefined): gli id da Firebase possono essere numeri o stringhe. */
export const sid = (v) => (v === undefined || v === null ? '' : String(v));

/** Due id uguali, indipendentemente dal tipo (numero o stringa). Null/undefined non sono mai uguali. */
export const sameId = (a, b) => a !== null && a !== undefined && b !== null && b !== undefined && String(a) === String(b);

/** Nodo Firebase (oggetto o array) come array, senza buchi. */
export const toArray = (node) => (!node ? [] : (Array.isArray(node) ? node : Object.values(node))).filter(v => v !== null && v !== undefined);

/**
 * Nomi (squadre) su massimo 2 righe senza spezzare le parole: la dimensione del testo
 * scende quanto basta perché la parola più lunga, e il nome intero in 2 righe, stiano nella larghezza disponibile.
 * Restituisce l'HTML: <div class="fit-box"><span class="fit-name">…</span></div>
 * (classi in index.html). maxSize = dimensione massima del testo; style = stile in più del testo.
 */
export function fitName(name, { maxSize = '.9rem', style = '' } = {}) {
  const text = String(name ?? '');
  // la parola più lunga deve stare in una riga e tutto il nome in due
  const longest = Math.max(4, ...text.split(/\s+/).map(w => w.length), Math.ceil(text.length * 0.6));
  return `<div class="fit-box"><span class="fit-name" style="--fit-ch:${longest}; --fit-max:${maxSize}; ${style}">${esc(text)}</span></div>`;
}
