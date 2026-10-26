/**
 * SelectSheet - scelta da un elenco, uguale su iPhone, Android e computer.
 * ------------------------------------------------------------------
 * Al posto della tendina del sistema (rotella su iPhone, finestrella su Android) si apre
 * dal basso una lista come quella della scelta giocatore in Formazione.
 *
 * installSelectSheets() trasforma da sola ogni <select> della pagina, anche quelli creati dopo:
 * il <select> resta nel DOM (nascosto) con il suo valore e i suoi eventi, al suo posto c'è un
 * pulsante con la voce scelta. Scegliendo una riga il valore va nel <select> e parte "change",
 * quindi il codice che già lo usava funziona com'era.
 *
 * Attributi facoltativi:
 *   <select data-title="Scegli la squadra">      titolo della lista (altrimenti label / aria-label)
 *   <select data-native>                         resta la tendina del sistema
 *   <select data-search="on|off">                campo di ricerca sempre / mai (di solito: solo per
 *                                                 elenchi lunghi di nomi, non per giornate o numeri)
 *   <option data-img="url">                      logo a sinistra (squadre, competizioni)
 *   <option data-icon="ri-...">                  icona a sinistra
 *   <option data-label="Nome" data-sub="...">    testo della riga e riga sotto (il pulsante usa il testo dell'option)
 */
import { BackNav } from '../services/backNav.js';
import { esc } from '../utils.js';

const STYLE_ID = 'select-sheet-style';
const SEARCH_FROM = 15; // con tante voci (di nomi) compare il campo di ricerca

/** Voci tutte uguali a parte il numero ("Giornata 1", "Giornata 2"...): si scorrono, non si cercano */
function isNumbered(items) {
  const shapes = new Set(items.map(it => String(it.label).replace(/[\dªº°]+/g, '#').trim()));
  return shapes.size <= 3;
}

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.cs-native{display:none !important}
:where(.cs-btn){font:inherit;color:inherit;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:.5rem .7rem;min-height:36px}
.cs-btn{display:flex;align-items:center;gap:.5rem;text-align:left;cursor:pointer;-webkit-appearance:none;appearance:none;max-width:100%}
.cs-btn .cs-val{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cs-btn .cs-caret{flex-shrink:0;font-size:1.1em;line-height:1;opacity:.75}
.cs-btn:disabled{opacity:.5;cursor:default}
.cs-btn[hidden]{display:none}
.cs-btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

.cs-overlay{position:fixed;inset:0;z-index:10060;background:var(--overlay-bg, rgba(5,8,15,.65));display:flex;align-items:flex-end;justify-content:center;animation:csFade .15s ease-out}
.cs-sheet{outline:none;width:100%;max-width:560px;max-height:80vh;display:flex;flex-direction:column;background:var(--bg,#181c22);color:var(--text);border:1px solid var(--border);
  border-radius:18px 18px 0 0;box-shadow:0 -10px 40px rgba(0,0,0,.5);padding-bottom:env(safe-area-inset-bottom,0px);animation:csUp .18s ease-out;font-family:var(--font-text, inherit)}
@media (min-width:700px){.cs-overlay{align-items:center}.cs-sheet{border-radius:18px}}
@media (prefers-reduced-motion:reduce){.cs-overlay,.cs-sheet{animation:none}}
@keyframes csUp{from{transform:translateY(30px);opacity:0}to{transform:none;opacity:1}}
@keyframes csFade{from{opacity:0}to{opacity:1}}
.cs-head{display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding:.9rem 1rem .6rem;border-bottom:1px solid var(--border)}
.cs-title{font-weight:700;font-size:.95rem;color:var(--text);min-width:0}
.cs-close{background:var(--bg2);border:none;color:var(--text);width:32px;height:32px;border-radius:50%;font-size:1.1rem;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.cs-search{display:flex;align-items:center;gap:.5rem;margin:.6rem .6rem 0;padding:0 .8rem;height:42px;border-radius:12px;background:var(--bg3);color:var(--text2)}
.cs-search input{flex:1;min-width:0;background:none;border:none;outline:none;color:var(--text);font:inherit;font-size:16px;-webkit-user-select:text;user-select:text}
.cs-list{overflow-y:auto;-webkit-overflow-scrolling:touch;padding:.5rem .6rem .7rem;display:flex;flex-direction:column;gap:.4rem}
.cs-group{font-size:.68rem;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--label, var(--text2));font-family:var(--font-label, inherit);padding:.5rem .3rem .1rem}
.cs-row{display:flex;align-items:center;gap:.65rem;width:100%;min-height:48px;padding:.5rem .7rem;text-align:left;font:inherit;color:var(--text);
  background:var(--pcard-bg, var(--bg2));border:1px solid var(--pcard-border, rgba(255,255,255,.05));border-radius:12px;cursor:pointer;transition:background .12s, transform .08s}
.cs-row:active{transform:scale(.99)}
.cs-row.on{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}
.cs-row:disabled{opacity:.4;cursor:default}
.cs-row:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.cs-img{width:34px;height:34px;flex-shrink:0;object-fit:contain;border-radius:6px}
.cs-ico{width:34px;height:34px;flex-shrink:0;border-radius:8px;background:var(--bg3);color:var(--text2);display:flex;align-items:center;justify-content:center;font-size:1.1rem}
.cs-main{flex:1;min-width:0}
.cs-label{font-weight:600;font-size:.9rem;line-height:1.25;overflow-wrap:anywhere}
.cs-sub{font-size:.72rem;color:var(--text2);font-family:var(--font-sub, inherit);margin-top:2px}
.cs-check{color:var(--accent);font-size:1.2rem;flex-shrink:0}
.cs-empty{text-align:center;color:var(--text3);font-family:var(--font-text3, inherit);padding:1.5rem 1rem;font-size:.85rem}
`;
  document.head.appendChild(style);
}

/* ------------------------------------------------------------------ lista */

let current = null; // lista aperta: { ov, close }

/**
 * Apre la lista. items = [{ value, label, sub, img, icon, disabled, group }]
 * onChoose(value) parte quando si tocca una riga (la lista si chiude da sola).
 */
export function openChoiceSheet({ title = 'Scegli', items = [], value = null, search: wantSearch, onChoose, onClose } = {}) {
  injectStyle();
  if (current) current.close();

  const ov = document.createElement('div');
  ov.className = 'cs-overlay';
  const search = wantSearch ?? (items.length >= SEARCH_FROM && !isNumbered(items));
  ov.innerHTML = `
    <div class="cs-sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}" tabindex="-1">
      <div class="cs-head">
        <div class="cs-title">${esc(title)}</div>
        <button type="button" class="cs-close" data-cs-close aria-label="Chiudi"><i class="ri-close-line"></i></button>
      </div>
      ${search ? '<label class="cs-search"><i class="ri-search-line"></i><input type="search" placeholder="Cerca" autocomplete="off" enterkeyhint="search"></label>' : ''}
      <div class="cs-list" role="listbox"></div>
    </div>`;
  const list = ov.querySelector('.cs-list');

  const draw = (q = '') => {
    const needle = q.trim().toLowerCase();
    const shown = needle ? items.filter(it => `${it.label} ${it.sub || ''}`.toLowerCase().includes(needle)) : items;
    let group = null;
    list.innerHTML = shown.map((it) => {
      const i = items.indexOf(it);
      const head = it.group && it.group !== group ? `<div class="cs-group">${esc(it.group)}</div>` : '';
      group = it.group || null;
      const on = value !== null && String(it.value) === String(value);
      const lead = it.img
        ? `<img class="cs-img" src="${esc(it.img)}" alt="" loading="lazy" onerror="this.outerHTML='<span class=&quot;cs-ico&quot;><i class=&quot;ri-shield-fill&quot;></i></span>'">`
        : it.icon ? `<span class="cs-ico"><i class="${esc(it.icon)}"></i></span>` : '';
      return `${head}<button type="button" class="cs-row${on ? ' on' : ''}" role="option" aria-selected="${on}" data-i="${i}" ${it.disabled ? 'disabled' : ''}>
          ${lead}
          <span class="cs-main"><span class="cs-label">${esc(it.label)}</span>${it.sub ? `<span class="cs-sub" style="display:block">${esc(it.sub)}</span>` : ''}</span>
          ${on ? '<i class="ri-check-line cs-check"></i>' : ''}
        </button>`;
    }).join('') || '<div class="cs-empty">Nessun risultato.</div>';
  };
  draw();
  document.body.appendChild(ov);

  let closed = false;
  const opener = document.activeElement;
  function close({ fromBack = false } = {}) {
    if (closed) return;
    closed = true;
    ov.remove();
    document.removeEventListener('keydown', onKey);
    if (!fromBack) BackNav.pop('select-sheet');
    if (current && current.ov === ov) current = null;
    if (opener && opener.isConnected && opener.focus) opener.focus({ preventScroll: true });
    if (onClose) onClose();
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);
  BackNav.push('select-sheet', () => close({ fromBack: true }));
  current = { ov, close };

  ov.addEventListener('click', (e) => {
    if (e.target === ov || e.target.closest('[data-cs-close]')) return close();
    const row = e.target.closest('.cs-row');
    if (!row || row.disabled) return;
    const it = items[Number(row.dataset.i)];
    close();
    if (onChoose) onChoose(it.value, it);
  });
  const input = ov.querySelector('.cs-search input');
  if (input) input.addEventListener('input', () => draw(input.value));

  // la voce scelta è subito in vista; il focus va nella finestra (tastiera / lettori di schermo)
  const cur = list.querySelector('.cs-row.on');
  if (cur) cur.scrollIntoView({ block: 'center' });
  ov.querySelector('.cs-sheet').focus({ preventScroll: true });
  return close;
}

/* ------------------------------------------------- <select> trasformati */

const VALUE = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
const INDEX = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
const PLACEHOLDER = /^\s*(--|scegli|seleziona|caricamento)/i;

const isPlaceholder = (o) => o.value === '' && (o.disabled || PLACEHOLDER.test(o.text));
const cleanTitle = (t) => String(t || '').replace(/^[\s-]+|[\s-.…:]+$/g, '').trim();

function titleOf(select) {
  if (select.dataset.title) return select.dataset.title;
  if (select.getAttribute('aria-label')) return select.getAttribute('aria-label');
  const byFor = select.id && document.querySelector(`label[for="${CSS.escape(select.id)}"]`);
  if (byFor && byFor.textContent.trim()) return cleanTitle(byFor.textContent);
  // etichetta subito prima del campo (es. <label class="label">Competizione</label><select>)
  let prev = select.previousElementSibling;
  while (prev && prev.classList.contains('cs-btn')) prev = prev.previousElementSibling;
  if (prev && (prev.tagName === 'LABEL' || prev.classList.contains('label')) && prev.textContent.trim().length < 60) return cleanTitle(prev.textContent);
  const ph = select.options[0];
  if (ph && isPlaceholder(ph)) return cleanTitle(ph.text) || 'Scegli';
  return 'Scegli';
}

function itemsOf(select) {
  const items = [];
  Array.from(select.options).forEach(o => {
    if (o.hidden || (isPlaceholder(o) && o.index === 0)) return;
    const grp = o.parentElement && o.parentElement.tagName === 'OPTGROUP' ? o.parentElement.label : null;
    items.push({
      value: o.value,
      label: o.dataset.label || o.text,
      sub: o.dataset.sub || '',
      img: o.dataset.img || '',
      icon: o.dataset.icon || '',
      disabled: o.disabled || (grp !== null && o.parentElement.disabled),
      group: grp
    });
  });
  return items;
}

function skip(select) {
  return select.multiple || select.size > 1 || select.hasAttribute('data-native') ||
    select.getAttribute('aria-hidden') === 'true' || select.classList.contains('field-select') ||
    select.classList.contains('cs-native');
}

function enhance(select) {
  if (select._cs || skip(select)) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.innerHTML = '<span class="cs-val"></span><i class="ri-arrow-down-s-line cs-caret" aria-hidden="true"></i>';
  const val = btn.firstChild;
  if (select.id) btn.dataset.csFor = select.id;

  const sync = () => {
    // aspetto e posizione del <select>: stesse classi e stesso stile in linea
    const cls = Array.from(select.classList).filter(c => c !== 'cs-native').join(' ');
    btn.className = (cls ? cls + ' ' : '') + 'cs-btn';
    btn.style.cssText = select.style.cssText;
    btn.disabled = select.disabled;
    btn.hidden = select.hidden;
    btn.title = select.title || '';
    const o = select.options[INDEX.get.call(select)];
    val.textContent = o ? o.text : '';
    btn.setAttribute('aria-label', `${titleOf(select)}: ${o ? o.text : ''}`);
  };
  select._cs = { btn, sync };

  // anche i cambi fatti dal codice (select.value = ..., nuove opzioni) si vedono sul pulsante
  Object.defineProperty(select, 'value', {
    configurable: true,
    get() { return VALUE.get.call(this); },
    set(v) { VALUE.set.call(this, v); sync(); }
  });
  Object.defineProperty(select, 'selectedIndex', {
    configurable: true,
    get() { return INDEX.get.call(this); },
    set(v) { INDEX.set.call(this, v); sync(); }
  });
  new MutationObserver(sync).observe(select, {
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: ['class', 'style', 'disabled', 'hidden', 'title', 'selected', 'label']
  });

  btn.addEventListener('click', () => {
    if (select.disabled) return;
    openChoiceSheet({
      title: titleOf(select),
      items: itemsOf(select),
      value: select.value,
      search: select.dataset.search === 'on' ? true : select.dataset.search === 'off' ? false : undefined,
      onChoose: (v) => {
        if (String(v) === select.value) return;
        select.value = v;
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  });

  select.classList.add('cs-native');
  select.parentNode.insertBefore(btn, select);
  sync();
}

function enhanceIn(node) {
  if (node.nodeType !== 1) return;
  if (node.tagName === 'SELECT') enhance(node);
  else if (node.getElementsByTagName) Array.from(node.getElementsByTagName('select')).forEach(enhance);
}

let installed = false;
/** Trasforma i <select> presenti e tutti quelli che verranno aggiunti. */
export function installSelectSheets(root = document.body) {
  injectStyle();
  enhanceIn(root);
  if (installed) return;
  installed = true;
  // toccare la <label for="..."> di un campo trasformato apre la lista
  document.addEventListener('click', (e) => {
    const label = e.target.closest && e.target.closest('label[for]');
    const select = label && document.getElementById(label.htmlFor);
    if (select && select._cs) { e.preventDefault(); select._cs.btn.click(); }
  });
  // i callback degli observer girano prima del disegno: la tendina del sistema non si vede mai
  new MutationObserver(muts => {
    muts.forEach(m => m.addedNodes.forEach(enhanceIn));
  }).observe(root, { childList: true, subtree: true });
}
