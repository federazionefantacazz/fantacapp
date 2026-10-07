import { PlayerStatsService } from '../services/playerStatsService.js';
import { esc, sid, playerThumb } from './menuUtils.js';

const PAGE_SIZE = 60;
const ROLE_ORDER = { P: 0, D: 1, C: 2, A: 3 };

/**
 * Colonne ordinabili. `dir` = verso del primo click.
 * I valori mancanti (es. nessun voto) finiscono sempre in fondo.
 */
const COLS = [
  { key: 'role',  label: 'R',          dir: 1,  cls: 'c-r', get: p => ROLE_ORDER[p.role] ?? 9 },
  { key: 'name',  label: 'Giocatore',  dir: 1,  cls: 'c-n', get: p => p.name || '' },
  { key: 'club',  label: 'Squadra',    dir: 1,  get: p => p.club || '' },
  { key: 'mv',    label: 'Voto',       dir: -1, get: (p, s) => s.mv },
  { key: 'fv',    label: 'Fantavoto',  dir: -1, get: (p, s) => s.fv },
  { key: 'pres',  label: 'Pres.',      dir: -1, get: (p, s) => s.pres || 0 },
  { key: 'value', label: 'Qt.',        dir: -1, get: p => (Number.isFinite(Number(p.value)) ? Number(p.value) : null) },
  { key: 'owner', label: 'Fantasquadra', dir: 1, get: (p, s, ctx) => ctx.ownerName(p), onlyListone: true }
];

const fmt = (n) => (n === null || n === undefined ? '–' : n.toFixed(2));

function fvStyle(n) {
  if (n === null || n === undefined) return 'color:var(--text3);';
  if (n >= 7) return 'color:var(--accent); font-weight:700;';
  if (n < 6) return 'color:var(--accent3); font-weight:700;';
  return 'font-weight:700;';
}

function createView({ mode, title, emptyMsg }) {
  const isListone = mode === 'listone';
  const cols = COLS.filter(c => !c.onlyListone || isListone);

  // Stato che sopravvive ai refresh (dati Firebase che cambiano) ma non alla chiusura
  const st = { root: null, sortKey: 'role', sortDir: 1, q: '', role: 'ALL', limit: PAGE_SIZE };

  function buildRows(STATE) {
    const stats = PlayerStatsService.buildStats(STATE);
    const teamsById = new Map((STATE.teams || []).map(t => [sid(t.id), t]));
    const ctx = {
      ownerName: (p) => {
        const t = teamsById.get(sid(p.teamId));
        return t ? (t.name || '') : '';
      }
    };

    let list = PlayerStatsService.getPlayers(STATE);
    if (!isListone) list = list.filter(p => PlayerStatsService.isFree(p));

    const q = st.q.trim().toLowerCase();
    if (st.role !== 'ALL') list = list.filter(p => p.role === st.role);
    if (q) list = list.filter(p => `${p.name} ${p.club || ''} ${ctx.ownerName(p)}`.toLowerCase().includes(q));

    const col = COLS.find(c => c.key === st.sortKey) || COLS[0];
    const rows = list.map(p => ({ p, s: stats.get(sid(p.id)) || { mv: null, fv: null, pres: 0 } }));
    rows.sort((a, b) => {
      const va = col.get(a.p, a.s, ctx), vb = col.get(b.p, b.s, ctx);
      const na = va === null || va === undefined || va === '', nb = vb === null || vb === undefined || vb === '';
      if (na !== nb) return na ? 1 : -1;               // vuoti sempre in fondo
      let c = 0;
      if (!na) c = typeof va === 'string' ? va.localeCompare(vb, 'it') : va - vb;
      if (c === 0 && col.key !== 'name') c = String(a.p.name).localeCompare(String(b.p.name), 'it');
      return c * st.sortDir;
    });
    return { rows, ctx };
  }

  function renderResults(STATE) {
    if (!st.root) return;
    const { rows, ctx } = buildRows(STATE);
    const shown = rows.slice(0, st.limit);

    const count = st.root.querySelector('.lv-count');
    if (count) count.textContent = `${rows.length} giocatori`;

    const box = st.root.querySelector('#lv-results');
    if (!rows.length) {
      box.innerHTML = `<div class="lv-empty">${esc(emptyMsg)}</div>`;
      return;
    }

    const arrow = (c) => (st.sortKey === c.key ? (st.sortDir === 1 ? ' ▲' : ' ▼') : '');
    const head = cols.map(c =>
      `<th class="${c.cls || ''} ${st.sortKey === c.key ? 'on' : ''}" data-sort="${c.key}">${esc(c.label)}${arrow(c)}</th>`).join('');

    const body = shown.map(({ p, s }) => `
      <tr>
        <td class="c-r"><span class="rbadge r${esc(p.role)}" style="width:22px; height:22px; font-size:.65rem; border-radius:6px;">${esc(p.role)}</span></td>
        <td class="c-n l"><div class="lv-name">${playerThumb(p)}<span>${esc(p.name)}</span></div></td>
        <td style="color:var(--text2);">${esc(p.club || '–')}</td>
        <td style="font-family:'DM Mono',monospace;">${fmt(s.mv)}</td>
        <td style="font-family:'DM Mono',monospace; ${fvStyle(s.fv)}">${fmt(s.fv)}</td>
        <td style="font-family:'DM Mono',monospace; color:var(--text2);">${s.pres || '–'}</td>
        <td style="font-family:'DM Mono',monospace; color:var(--gold);">${esc(p.value ?? '–')}</td>
        ${isListone ? `<td style="color:var(--text2);">${esc(ctx.ownerName(p) || (p.loan ? 'In prestito' : 'Svincolato'))}</td>` : ''}
      </tr>`).join('');

    box.innerHTML = `
      <div class="lv-wrap"><table class="lv-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
      ${rows.length > shown.length
        ? `<button class="mp-btn ghost lv-more" data-more>Mostra altri ${Math.min(PAGE_SIZE, rows.length - shown.length)} (${shown.length}/${rows.length})</button>`
        : ''}
    `;
  }

  return {
    title,

    mount(body, STATE) {
      Object.assign(st, { sortKey: 'role', sortDir: 1, q: '', role: 'ALL', limit: PAGE_SIZE });

      const root = document.createElement('div');
      body.appendChild(root);
      st.root = root;

      root.innerHTML = `
        <div class="lv-controls">
          <input type="search" class="lv-search" placeholder="Cerca giocatore, squadra${isListone ? ' o fantasquadra' : ''}…" autocomplete="off">
          <div class="lv-chips">
            ${['ALL', 'P', 'D', 'C', 'A'].map(r => `<button class="lv-chip ${r === 'ALL' ? 'on' : ''}" data-role="${r}">${r === 'ALL' ? 'Tutti' : r}</button>`).join('')}
            <span class="lv-count"></span>
          </div>
        </div>
        <div id="lv-results"></div>
      `;

      root.querySelector('.lv-search').addEventListener('input', (e) => {
        st.q = e.target.value;
        st.limit = PAGE_SIZE;
        renderResults(window.STATE);
      });

      root.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-role]');
        if (chip) {
          st.role = chip.dataset.role;
          st.limit = PAGE_SIZE;
          root.querySelectorAll('.lv-chip').forEach(c => c.classList.toggle('on', c === chip));
          renderResults(window.STATE);
          return;
        }
        const th = e.target.closest('[data-sort]');
        if (th) {
          const col = COLS.find(c => c.key === th.dataset.sort);
          if (st.sortKey === col.key) st.sortDir = -st.sortDir;
          else { st.sortKey = col.key; st.sortDir = col.dir; }
          renderResults(window.STATE);
          return;
        }
        if (e.target.closest('[data-more]')) {
          st.limit += PAGE_SIZE;
          renderResults(window.STATE);
        }
      });

      renderResults(STATE);
    },

    refresh(STATE) { renderResults(STATE); },

    unmount() { st.root = null; }
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
