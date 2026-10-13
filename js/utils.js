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
