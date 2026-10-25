import { PlayerStatsService } from '../services/playerStatsService.js';
import { FavoritesService, FAVORITES_EVENT } from '../services/favoritesService.js';
import { esc, sid, playerThumb } from './menuUtils.js';

const PAGE_SIZE = 40;
const ROLES = ['P', 'D', 'C', 'A'];
const ROLE_ORDER = { P: 0, D: 1, C: 2, A: 3 };
const STYLE_ID = 'listone-view-style';

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/**
 * Criteri di ordinamento. `dir` = verso alla prima scelta (toccando di nuovo si inverte).
 * I valori mancanti (es. nessun voto) finiscono sempre in fondo.
 */
const SORTS = [
  { key: 'role',  label: 'Ruolo',             dir: 1,  get: p => ROLE_ORDER[p.role] ?? 9 },
  { key: 'name',  label: 'Nome calciatore',   dir: 1,  get: p => p.name || '' },
  { key: 'fv',    label: 'Fanta media',       dir: -1, get: (p, s) => s.fv },
  { key: 'mv',    label: 'Media voto',        dir: -1, get: (p, s) => s.mv },
  { key: 'pres',  label: 'Presenze',          dir: -1, get: (p, s) => s.pres || 0 },
  { key: 'value', label: 'Quotazione',        dir: -1, get: p => num(p.value) },
  { key: 'club',  label: 'Squadra',           dir: 1,  get: p => p.club || '' },
  { key: 'owner', label: 'Fantasquadra',      dir: 1,  get: (p, s, ctx) => ctx.ownerName(p), onlyListone: true }
];

/* Stato del giocatore nel Listone */
const STATUS = [
  { key: 'all',    label: 'Tutti' },
  { key: 'rosa',   label: 'In rosa' },
  { key: 'loan',   label: 'In prestito' },
  { key: 'free',   label: 'Svincolati' }
];

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #menu-panel .ls-bar { background: var(--card); border: 1px solid var(--border); border-radius: 26px; padding: .5rem; margin-bottom: 1rem; }
    #menu-panel .ls-top { display: flex; gap: .5rem; align-items: center; }
    #menu-panel .ls-search { flex: 1; min-width: 0; display: flex; align-items: center; gap: .5rem; background: var(--bg3); border-radius: 999px; padding: 0 .9rem; height: 46px; }
    #menu-panel .ls-search i { font-size: 1.2rem; color: var(--text2); font-family: var(--font-sub, inherit); }
    #menu-panel .ls-search input { flex: 1; min-width: 0; background: none; border: none; outline: none; color: var(--text); font-family: inherit; font-size: 1rem;
      user-select: text; -webkit-user-select: text; }
    #menu-panel .ls-search input::placeholder { color: var(--text3); font-family: var(--font-text3, inherit); }
    #menu-panel .ls-icon { position: relative; width: 46px; height: 46px; flex-shrink: 0; border-radius: 50%; border: none; background: var(--bg3); color: var(--text);
      font-size: 1.3rem; display: flex; align-items: center; justify-content: center; cursor: pointer; }
    #menu-panel .ls-icon.on { background: var(--accent); color: var(--btn-primary-text); }
    #menu-panel .ls-icon.fav.on { background: color-mix(in srgb, var(--gold) 22%, var(--bg3)); color: var(--gold); }
    #menu-panel .ls-icon .ls-dot { position: absolute; top: 2px; right: 2px; min-width: 17px; height: 17px; padding: 0 4px; border-radius: 9px; background: var(--accent3); color: #fff;
      font-size: .62rem; font-weight: 700; display: flex; align-items: center; justify-content: center; font-family: var(--font-text); }
    #menu-panel .ls-icon .ls-dot[hidden] { display: none; }
    #menu-panel .ls-panel { padding: .9rem .6rem .4rem; }
    #menu-panel .ls-panel[hidden] { display: none; }
    #menu-panel .ls-h { font-size: .9rem; font-weight: 600; color: var(--label, var(--text2)); font-family: var(--font-label, inherit); margin: .2rem 0 .6rem; }
    #menu-panel .ls-h + .ls-h, #menu-panel .ls-sect + .ls-h { margin-top: 1.1rem; }

    #menu-panel .ls-radio { display: flex; align-items: center; gap: .8rem; width: 100%; background: none; border: none; padding: .6rem 0; cursor: pointer;
      color: var(--text); font-family: inherit; font-size: 1rem; font-weight: 500; text-align: left; }
    #menu-panel .ls-radio .o { width: 22px; height: 22px; flex-shrink: 0; border-radius: 50%; border: 2px solid var(--text2); display: flex; align-items: center; justify-content: center; }
    #menu-panel .ls-radio.on .o { border-color: var(--accent); }
    #menu-panel .ls-radio.on .o::after { content: ''; width: 12px; height: 12px; border-radius: 50%; background: var(--accent); }
    #menu-panel .ls-radio .dir { margin-left: auto; color: var(--accent); font-size: .8rem; display: flex; align-items: center; gap: .2rem; }

    #menu-panel .ls-scroll { display: flex; gap: .5rem; overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: .3rem; scrollbar-width: none; }
    #menu-panel .ls-scroll::-webkit-scrollbar { display: none; }
    #menu-panel .ls-wrap { display: flex; gap: .5rem; flex-wrap: wrap; }
    #menu-panel .ls-tag { flex-shrink: 0; min-width: 46px; height: 46px; padding: 0 .9rem; border-radius: 12px; border: 1px solid var(--border); background: transparent;
      color: var(--text2); font-family: inherit; font-size: .9rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
    #menu-panel .ls-tag.on { background: color-mix(in srgb, var(--accent) 22%, transparent); border-color: var(--accent); color: var(--text); }
    #menu-panel .ls-tag.role { width: 52px; padding: 0; font-size: 1.05rem; }
    #menu-panel .ls-tag.role.on[data-frole="P"] { background: var(--role-p); color: var(--role-p-text); border-color: var(--role-p); }
    #menu-panel .ls-tag.role.on[data-frole="D"] { background: var(--role-d); color: var(--role-d-text); border-color: var(--role-d); }
    #menu-panel .ls-tag.role.on[data-frole="C"] { background: var(--role-c); color: var(--role-c-text); border-color: var(--role-c); }
    #menu-panel .ls-tag.role.on[data-frole="A"] { background: var(--role-a); color: var(--role-a-text); border-color: var(--role-a); }

    #menu-panel .ls-range { display: flex; align-items: center; gap: .8rem; }
    #menu-panel .ls-range .v { min-width: 50px; height: 42px; padding: 0 .5rem; border-radius: 10px; background: var(--bg3); color: var(--text);
      display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 1rem; }
    #menu-panel .ls-slider { position: relative; flex: 1; height: 42px; }
    #menu-panel .ls-slider .track { position: absolute; left: 11px; right: 11px; top: 50%; height: 8px; margin-top: -4px; border-radius: 4px; background: var(--bg3); }
    #menu-panel .ls-slider .fill { position: absolute; top: 0; bottom: 0; border-radius: 4px; background: var(--accent); }
    #menu-panel .ls-slider input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; background: none; pointer-events: none;
      -webkit-appearance: none; appearance: none; }
    #menu-panel .ls-slider input::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; pointer-events: auto; width: 26px; height: 26px; border-radius: 50%;
      background: var(--text); border: 3px solid var(--accent); cursor: pointer; }
    #menu-panel .ls-slider input::-moz-range-thumb { pointer-events: auto; width: 20px; height: 20px; border-radius: 50%; background: var(--text); border: 3px solid var(--accent); cursor: pointer; }
    #menu-panel .ls-slider input::-moz-range-track { background: none; }
    #menu-panel .ls-reset { display: block; margin: 1.2rem auto .3rem; background: none; border: none; color: var(--accent3); font-family: inherit; font-size: 1rem;
      font-weight: 600; cursor: pointer; padding: .4rem 1rem; }

    #menu-panel .ls-head { display: flex; align-items: center; padding: 0 .9rem .5rem; color: var(--label, var(--text2)); font-family: var(--font-label, inherit); font-size: .85rem; font-weight: 600; }
    #menu-panel .ls-head .t { flex: 1; }
    #menu-panel .ls-head .t small { font-weight: 500; color: var(--text3); font-family: var(--font-text3, inherit); margin-left: .3rem; }
    #menu-panel .ls-head button { width: 54px; background: none; border: none; color: inherit; font: inherit; text-align: center; cursor: pointer; padding: 0; }
    #menu-panel .ls-head button.on { color: var(--accent); }

    #menu-panel .ls-card { background: var(--card); border: 1px solid var(--border); border-radius: 18px; overflow: hidden; margin-bottom: .7rem; cursor: pointer; }
    #menu-panel .ls-card:active { opacity: .85; }
    #menu-panel .ls-main { display: flex; align-items: center; gap: .8rem; padding: .7rem .9rem; }
    #menu-panel .ls-photo { position: relative; width: 60px; height: 60px; flex-shrink: 0; border-radius: 50%; background: var(--bg3); }
    #menu-panel .ls-photo img, #menu-panel .ls-photo .ph { width: 100%; height: 100%; border-radius: 50%; object-fit: contain; }
    #menu-panel .ls-photo .ph { font-size: 1.2rem !important; }
    #menu-panel .ls-role { position: absolute; top: -3px; left: -3px; width: 22px; height: 22px; border-radius: 50%; font-size: .7rem; box-shadow: 0 0 0 2px var(--card); }
    #menu-panel .ls-info { flex: 1; min-width: 0; }
    #menu-panel .ls-name { font-size: 1.15rem; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.25; }
    #menu-panel .ls-name .ls-star { color: var(--gold); font-size: .9rem; margin-left: .3rem; vertical-align: 1px; }
    #menu-panel .ls-club { font-size: .85rem; color: var(--text2); font-family: var(--font-sub, inherit); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: .1rem; }
    #menu-panel .ls-stats { font-size: .75rem; color: var(--text3); font-family: var(--font-text3, inherit); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: .1rem; }
    #menu-panel .ls-num { width: 54px; flex-shrink: 0; text-align: center; font-size: 1.1rem; font-weight: 600; color: var(--text); }
    #menu-panel .ls-num.qt { color: var(--gold); }
    #menu-panel .ls-num.none { color: var(--text3); font-family: var(--font-text3, inherit); font-weight: 500; }
    #menu-panel .ls-num.hi { color: var(--accent); }
    #menu-panel .ls-num.lo { color: var(--accent3); }
    #menu-panel .ls-band { display: flex; justify-content: space-between; gap: .8rem; padding: .4rem 1.1rem; background: var(--accent); color: var(--btn-primary-text);
      font-size: .85rem; font-weight: 600; }
    #menu-panel .ls-band span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-transform: uppercase; letter-spacing: .3px; }
    #menu-panel .ls-band.loan { background: color-mix(in srgb, var(--gold) 80%, #000); color: #fff; }
    #menu-panel .ls-more { display: block; margin: .4rem auto 0; }
    #menu-panel .ls-empty { text-align: center; color: var(--text3); font-family: var(--font-text3, inherit); font-size: .9rem; padding: 2rem 1rem; }
  `;
  document.head.appendChild(style);
}

function fvClass(n) {
  if (n === null || n === undefined) return 'none';
  if (n >= 7) return 'hi';
  if (n < 6) return 'lo';
  return '';
}

const fmtAvg = (n) => (n === null || n === undefined ? '–' : String(Math.round(n * 100) / 100));

function createView({ mode, title, emptyMsg }) {
  const isListone = mode === 'listone';
  const sorts = SORTS.filter(s => !s.onlyListone || isListone);

  // Stato che sopravvive ai refresh (dati Firebase che cambiano) ma non alla chiusura
  const st = {};
  const reset = () => Object.assign(st, {
    panel: null, sortKey: 'role', sortDir: 1, q: '', limit: PAGE_SIZE, favOnly: false,
    clubs: new Set(), roles: new Set(), status: 'all', qtMin: null, qtMax: null
  });
  reset();
  let observer = null;
  // stella tolta o messa nella scheda giocatore (aperta sopra il pannello): elenco aggiornato
  const onFavChange = () => renderResults(window.STATE);

  function context(STATE) {
    const teamsById = new Map((STATE.teams || []).map(t => [sid(t.id), t]));
    return {
      ownerName: (p) => {
        const t = teamsById.get(sid(p.teamId));
        return t ? (t.name || '') : '';
      }
    };
  }

  function basePlayers(STATE) {
    const list = PlayerStatsService.getPlayers(STATE);
    return isListone ? list : list.filter(p => PlayerStatsService.isFree(p));
  }

  /** Limiti della quotazione tra i giocatori della vista */
  function valueBounds(list) {
    const vals = list.map(p => num(p.value)).filter(v => v !== null);
    if (!vals.length) return null;
    return { min: Math.floor(Math.min(...vals)), max: Math.ceil(Math.max(...vals)) };
  }

  function activeFilters() {
    return st.clubs.size + st.roles.size + (st.status !== 'all' ? 1 : 0) + (st.qtMin !== null || st.qtMax !== null ? 1 : 0);
  }

  function buildRows(STATE) {
    const stats = PlayerStatsService.buildStats(STATE);
    const ctx = context(STATE);
    let list = basePlayers(STATE);

    if (st.favOnly) list = list.filter(p => FavoritesService.has(p.id));
    const q = st.q.trim().toLowerCase();
    if (q) list = list.filter(p => `${p.name} ${p.club || ''} ${ctx.ownerName(p)}`.toLowerCase().includes(q));
    if (st.roles.size) list = list.filter(p => st.roles.has(p.role));
    if (st.clubs.size) list = list.filter(p => st.clubs.has(p.club || ''));
    if (st.qtMin !== null) list = list.filter(p => num(p.value) !== null && num(p.value) >= st.qtMin);
    if (st.qtMax !== null) list = list.filter(p => num(p.value) !== null && num(p.value) <= st.qtMax);
    if (isListone && st.status !== 'all') {
      list = list.filter(p => {
        if (st.status === 'loan') return !!p.loan;
        if (st.status === 'free') return PlayerStatsService.isFree(p);
        return !p.loan && !!sid(p.teamId);
      });
    }

    const sort = SORTS.find(s => s.key === st.sortKey) || SORTS[0];
    const rows = list.map(p => ({ p, s: stats.get(sid(p.id)) || { mv: null, fv: null, pres: 0 } }));
    rows.sort((a, b) => {
      const va = sort.get(a.p, a.s, ctx), vb = sort.get(b.p, b.s, ctx);
      const na = va === null || va === undefined || va === '', nb = vb === null || vb === undefined || vb === '';
      if (na !== nb) return na ? 1 : -1;               // vuoti sempre in fondo
      let c = 0;
      if (!na) c = typeof va === 'string' ? va.localeCompare(vb, 'it') : va - vb;
      if (c === 0 && sort.key !== 'name') c = String(a.p.name).localeCompare(String(b.p.name), 'it');
      return c * st.sortDir;
    });
    return { rows, ctx };
  }

  /* ---------- Pannelli ---------- */

  function renderSortPanel() {
    return `
      <div class="ls-h">Ordina per</div>
      ${sorts.map(s => {
        const on = st.sortKey === s.key;
        const dir = on ? `<span class="dir"><i class="${st.sortDir === 1 ? 'ri-arrow-up-line' : 'ri-arrow-down-line'}"></i>${st.sortDir === 1 ? 'crescente' : 'decrescente'}</span>` : '';
        return `<button type="button" class="ls-radio ${on ? 'on' : ''}" data-sortby="${s.key}"><span class="o"></span>${esc(s.label)}${dir}</button>`;
      }).join('')}`;
  }

  function renderFilterPanel(STATE) {
    const list = basePlayers(STATE);
    const clubs = [...new Set(list.map(p => p.club).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'it'));
    const b = valueBounds(list);
    const lo = st.qtMin ?? b?.min, hi = st.qtMax ?? b?.max;
    return `
      ${clubs.length ? `
        <div class="ls-h">Squadre</div>
        <div class="ls-scroll ls-sect">
          ${clubs.map(c => `<button type="button" class="ls-tag ${st.clubs.has(c) ? 'on' : ''}" data-club="${esc(c)}">${esc(c)}</button>`).join('')}
        </div>` : ''}
      <div class="ls-h">Ruoli</div>
      <div class="ls-wrap ls-sect">
        ${ROLES.map(r => `<button type="button" class="ls-tag role ${st.roles.has(r) ? 'on' : ''}" data-frole="${r}">${r}</button>`).join('')}
      </div>
      ${isListone ? `
        <div class="ls-h">Stato</div>
        <div class="ls-wrap ls-sect">
          ${STATUS.map(s => `<button type="button" class="ls-tag ${st.status === s.key ? 'on' : ''}" data-status="${s.key}">${s.label}</button>`).join('')}
        </div>` : ''}
      ${b && b.max > b.min ? `
        <div class="ls-h">Quotazione</div>
        <div class="ls-range ls-sect">
          <span class="v" data-qt-lo>${lo}</span>
          <div class="ls-slider">
            <div class="track"><div class="fill"></div></div>
            <input type="range" data-qt="min" min="${b.min}" max="${b.max}" step="1" value="${lo}" aria-label="Quotazione minima">
            <input type="range" data-qt="max" min="${b.min}" max="${b.max}" step="1" value="${hi}" aria-label="Quotazione massima">
          </div>
          <span class="v" data-qt-hi>${hi}</span>
        </div>` : ''}
      <button type="button" class="ls-reset" data-reset>Reset filtri</button>`;
  }

  /** Aggiorna la barra colorata tra i due cursori della quotazione */
  function syncSlider() {
    const box = st.root && st.root.querySelector('.ls-slider');
    if (!box) return;
    const [a, b] = box.querySelectorAll('input');
    const min = Number(a.min), max = Number(a.max), span = (max - min) || 1;
    const fill = box.querySelector('.fill');
    fill.style.left = ((Number(a.value) - min) / span * 100) + '%';
    fill.style.right = (100 - (Number(b.value) - min) / span * 100) + '%';
    st.root.querySelector('[data-qt-lo]').textContent = a.value;
    st.root.querySelector('[data-qt-hi]').textContent = b.value;
  }

  function renderPanel(STATE) {
    const panel = st.root.querySelector('.ls-panel');
    st.root.querySelectorAll('[data-panel]').forEach(b => b.classList.toggle('on', b.dataset.panel === st.panel));
    const n = activeFilters();
    const dot = st.root.querySelector('[data-panel="filter"] .ls-dot');
    if (dot) { dot.hidden = !n; dot.textContent = n; }
    if (!st.panel) { panel.hidden = true; panel.innerHTML = ''; return; }
    panel.hidden = false;
    // le squadre scorrono in orizzontale: ridisegnando il pannello si resta nello stesso punto
    const prev = panel.querySelector('.ls-scroll');
    const scrollLeft = prev ? prev.scrollLeft : 0;
    panel.innerHTML = st.panel === 'sort' ? renderSortPanel() : renderFilterPanel(STATE);
    const next = panel.querySelector('.ls-scroll');
    if (next) next.scrollLeft = scrollLeft;
    syncSlider();
  }

  /* ---------- Elenco ---------- */

  function card({ p, s }, ctx) {
    const owner = isListone ? ctx.ownerName(p) : '';
    const extra = [s.pres ? `${s.pres} pres.` : '', s.mv !== null && s.mv !== undefined ? `MV ${fmtAvg(s.mv)}` : '']
      .filter(Boolean).join(' · ');
    let band = '';
    if (isListone && p.loan) {
      band = `<div class="ls-band loan"><span>In prestito${p.loan.endGw ? ` fino alla G${esc(p.loan.endGw)}` : ''}</span><span>${esc(owner)}</span></div>`;
    } else if (isListone && owner) {
      band = `<div class="ls-band"><span>In rosa</span><span>${esc(owner)}</span></div>`;
    }
    const qt = num(p.value);
    // senza foto playerThumb mostra già il badge del ruolo: niente doppione nell'angolo
    const hasPhoto = !!(p.photoPersonal || p.photoStandard);
    return `
      <div class="ls-card" data-player-id="${esc(p.id)}" title="Apri la scheda di ${esc(p.name)}">
        <div class="ls-main">
          <div class="ls-photo">${playerThumb(p)}${hasPhoto ? `<span class="ls-role rbadge r${esc(p.role)}">${esc(p.role)}</span>` : ''}</div>
          <div class="ls-info">
            <div class="ls-name">${esc(p.name)}${FavoritesService.has(p.id) ? '<i class="ri-star-fill ls-star" title="Preferito"></i>' : ''}</div>
            <div class="ls-club">${esc(p.club || '–')}</div>
            ${extra ? `<div class="ls-stats">${esc(extra)}</div>` : ''}
          </div>
          <div class="ls-num ${fvClass(s.fv)}">${fmtAvg(s.fv)}</div>
          <div class="ls-num qt ${qt === null ? 'none' : ''}">${qt === null ? '–' : esc(qt)}</div>
        </div>
        ${band}
      </div>`;
  }

  function renderResults(STATE) {
    if (!st.root) return;
    const { rows, ctx } = buildRows(STATE);
    const shown = rows.slice(0, st.limit);

    const head = st.root.querySelector('.ls-head');
    head.innerHTML = `
      <span class="t">Calciatore <small>${rows.length}</small></span>
      <button type="button" class="${st.sortKey === 'fv' ? 'on' : ''}" data-col="fv" title="Fanta media">FM</button>
      <button type="button" class="${st.sortKey === 'value' ? 'on' : ''}" data-col="value" title="Quotazione">Qt.</button>`;

    const box = st.root.querySelector('.ls-results');
    if (observer) observer.disconnect();
    if (!rows.length) {
      const msg = st.favOnly
        ? (FavoritesService.count() ? 'Nessun preferito con questi filtri.' : 'Nessun preferito: apri la scheda di un giocatore e tocca la stella.')
        : emptyMsg;
      box.innerHTML = `<div class="ls-empty">${esc(msg)}</div>`;
      return;
    }
    box.innerHTML = shown.map(r => card(r, ctx)).join('') + (rows.length > shown.length
      ? `<button class="mp-btn ghost ls-more" data-more>Mostra altri (${shown.length}/${rows.length})</button>`
      : '');

    // gli altri giocatori arrivano da soli quando si scorre fino in fondo
    const more = box.querySelector('[data-more]');
    if (more && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries) => {
        if (entries.some(e => e.isIntersecting)) more.click();
      }, { rootMargin: '400px 0px' });
      observer.observe(more);
    }
  }

  function rerender(STATE, { panel = true } = {}) {
    st.limit = PAGE_SIZE;
    if (panel) renderPanel(STATE);
    renderResults(STATE);
  }

  return {
    title,

    mount(body, STATE) {
      injectStyle();
      reset();

      const root = document.createElement('div');
      body.appendChild(root);
      st.root = root;

      root.innerHTML = `
        <div class="ls-bar">
          <div class="ls-top">
            <label class="ls-search">
              <i class="ri-search-line"></i>
              <input type="search" placeholder="Cerca calciatore" autocomplete="off" enterkeyhint="search">
            </label>
            <button type="button" class="ls-icon fav" data-fav title="Solo preferiti" aria-label="Solo preferiti" aria-pressed="false"><i class="ri-star-line"></i></button>
            <button type="button" class="ls-icon" data-panel="sort" title="Ordina" aria-label="Ordina"><i class="ri-sort-desc"></i></button>
            <button type="button" class="ls-icon" data-panel="filter" title="Filtri" aria-label="Filtri"><i class="ri-equalizer-line"></i><span class="ls-dot" hidden></span></button>
          </div>
          <div class="ls-panel" hidden></div>
        </div>
        <div class="ls-head"></div>
        <div class="ls-results"></div>
      `;

      root.querySelector('.ls-search input').addEventListener('input', (e) => {
        st.q = e.target.value;
        rerender(window.STATE, { panel: false });
      });

      // cursori della quotazione: mentre si trascina si aggiorna solo l'elenco
      root.addEventListener('input', (e) => {
        const r = e.target.closest('[data-qt]');
        if (!r) return;
        const box = r.closest('.ls-slider');
        const [a, b] = box.querySelectorAll('input');
        if (Number(a.value) > Number(b.value)) {
          if (r === a) a.value = b.value; else b.value = a.value;
        }
        st.qtMin = Number(a.value) > Number(a.min) ? Number(a.value) : null;
        st.qtMax = Number(b.value) < Number(b.max) ? Number(b.value) : null;
        syncSlider();
        const dot = root.querySelector('[data-panel="filter"] .ls-dot');
        const n = activeFilters();
        if (dot) { dot.hidden = !n; dot.textContent = n; }
        rerender(window.STATE, { panel: false });
      });

      root.addEventListener('click', (e) => {
        const STATE = window.STATE;
        const t = e.target;
        const fb = t.closest('[data-fav]');
        if (fb) {
          st.favOnly = !st.favOnly;
          fb.classList.toggle('on', st.favOnly);
          fb.setAttribute('aria-pressed', String(st.favOnly));
          fb.querySelector('i').className = st.favOnly ? 'ri-star-fill' : 'ri-star-line';
          rerender(STATE, { panel: false });
          return;
        }
        const pb = t.closest('[data-panel]');
        if (pb) {
          st.panel = st.panel === pb.dataset.panel ? null : pb.dataset.panel;
          renderPanel(STATE);
          return;
        }
        const sb = t.closest('[data-sortby]') || t.closest('[data-col]');
        if (sb) {
          const key = sb.dataset.sortby || sb.dataset.col;
          const sort = SORTS.find(s => s.key === key);
          if (st.sortKey === key) st.sortDir = -st.sortDir;
          else { st.sortKey = key; st.sortDir = sort.dir; }
          rerender(STATE);
          return;
        }
        const club = t.closest('[data-club]');
        if (club) {
          const c = club.dataset.club;
          st.clubs.has(c) ? st.clubs.delete(c) : st.clubs.add(c);
          rerender(STATE);
          return;
        }
        const role = t.closest('[data-frole]');
        if (role) {
          const r = role.dataset.frole;
          st.roles.has(r) ? st.roles.delete(r) : st.roles.add(r);
          rerender(STATE);
          return;
        }
        const status = t.closest('[data-status]');
        if (status) {
          st.status = status.dataset.status;
          rerender(STATE);
          return;
        }
        if (t.closest('[data-reset]')) {
          Object.assign(st, { clubs: new Set(), roles: new Set(), status: 'all', qtMin: null, qtMax: null });
          rerender(STATE);
          return;
        }
        if (t.closest('[data-more]')) {
          st.limit += PAGE_SIZE;
          renderResults(STATE);
        }
      });

      window.addEventListener(FAVORITES_EVENT, onFavChange);
      renderPanel(STATE);
      renderResults(STATE);
    },

    refresh(STATE) { renderResults(STATE); },

    unmount() {
      window.removeEventListener(FAVORITES_EVENT, onFavChange);
      if (observer) observer.disconnect();
      observer = null;
      st.root = null;
    }
  };
}

export const ListoneView = createView({
  mode: 'listone',
  title: 'Listone',
  emptyMsg: 'Nessun giocatore trovato.'
});

export const SvincolatiView = createView({
  mode: 'svincolati',
  title: 'Svincolati',
  emptyMsg: 'Nessun giocatore svincolato.'
});
