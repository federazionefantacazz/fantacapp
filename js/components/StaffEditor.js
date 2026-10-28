/**
 * Editor della presidenza (Configurazione squadra e gestione squadre del Patron).
 *  - prima riga: Presidente o Copresidente
 *  - dalla seconda: "Aggiungi copresidente" o "Aggiungi altro titolo" (titolo scritto a mano)
 *  - aggiungendo un Copresidente, anche il primo diventa Copresidente
 * Regole e salvataggio in js/services/staffService.js.
 *
 * createStaffEditor(container, staff) → { get(), set(staff), error() }
 */
import { esc } from '../utils.js';
import { validateStaff, ROLES } from '../services/staffService.js';

const STYLE_ID = 'staff-editor-style';
function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.se-row{display:grid;grid-template-columns:minmax(0,8.6rem) minmax(0,1fr) auto;gap:.4rem;align-items:center;margin-bottom:.45rem}
.se-row .se-title{grid-column:2 / 3}
.se-row input,.se-row .se-role{width:100%;min-height:42px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);
  padding:.45rem .6rem;font-family:inherit;font-size:16px;margin:0;-webkit-user-select:text;user-select:text}
.se-row .se-role{font-size:.85rem;font-weight:600}
.se-row input:focus{outline:none;border-color:var(--accent)}
.se-del{width:38px;height:38px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--accent3);cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center}
.se-del.ghost{visibility:hidden}
.se-note{font-size:.75rem;color:var(--gold);font-family:var(--font-sub,inherit);margin:.1rem 0 .5rem;line-height:1.35}
.se-note:empty{display:none}
.se-add{display:flex;gap:.4rem;flex-wrap:wrap}
.se-add button{background:transparent;border:1px dashed color-mix(in srgb, var(--accent) 60%, transparent);color:var(--accent);border-radius:10px;padding:.45rem .7rem;
  font-family:inherit;font-size:.8rem;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:.25rem}
`;
  document.head.appendChild(style);
}

export function createStaffEditor(container, staff = []) {
  injectStyle();
  let list = [];
  let note = '';

  const set = (s) => {
    list = (s && s.length ? s : [{ name: '', role: 'presidente', title: '' }]).map((m, i) => ({
      name: m.name || '',
      role: i === 0 ? (m.role === 'copresidente' ? 'copresidente' : 'presidente') : (m.role === 'copresidente' ? 'copresidente' : 'altro'),
      title: m.title || ''
    }));
    note = '';
    render();
  };

  // regole sui Copresidenti mostrate subito; nomi e titoli vuoti solo al salvataggio
  const liveError = () => {
    const err = validateStaff(list.map(m => ({ ...m, name: m.name || '-', title: m.title || '-' })));
    return err;
  };

  function render() {
    container.innerHTML = `
      <div class="se">
        ${list.map((m, i) => `
          <div class="se-row">
            <select class="se-role" data-i="${i}" data-title="${i === 0 ? 'Chi guida la squadra' : 'Titolo'}" aria-label="Titolo">
              ${(i === 0 ? ['presidente', 'copresidente'] : ['copresidente', 'altro'])
                .map(r => `<option value="${r}" ${m.role === r ? 'selected' : ''}>${ROLES[r]}</option>`).join('')}
            </select>
            <input type="text" class="se-name" data-i="${i}" value="${esc(m.name)}" placeholder="Nome" maxlength="40" autocomplete="off" aria-label="Nome">
            <button type="button" class="se-del${i === 0 ? ' ghost' : ''}" data-del="${i}" aria-label="Rimuovi" ${i === 0 ? 'tabindex="-1" aria-hidden="true"' : ''}><i class="ri-delete-bin-line"></i></button>
            ${i > 0 && m.role === 'altro' ? `<input type="text" class="se-title" data-i="${i}" value="${esc(m.title)}" placeholder="Titolo (es. Vicepresidente)" maxlength="30" autocomplete="off" aria-label="Titolo">` : ''}
          </div>`).join('')}
        <div class="se-note">${esc(note || liveError())}</div>
        <div class="se-add">
          <button type="button" data-add="copresidente"><i class="ri-add-line"></i> Aggiungi copresidente</button>
          <button type="button" data-add="altro"><i class="ri-add-line"></i> Aggiungi altro titolo</button>
        </div>
      </div>`;
  }

  // un Copresidente in più rende Copresidente anche il primo
  const coLeader = () => {
    if (list[0].role === 'presidente' && list.slice(1).some(m => m.role === 'copresidente')) {
      list[0].role = 'copresidente';
      note = 'Con più Copresidenti anche il primo è Copresidente.';
    }
  };

  container.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    const del = e.target.closest('[data-del]');
    if (add) {
      list.push({ name: '', role: add.dataset.add, title: '' });
      note = '';
      coLeader();
      render();
      const inputs = container.querySelectorAll('.se-name');
      if (inputs.length) inputs[inputs.length - 1].focus();
    } else if (del && Number(del.dataset.del) > 0) {
      list.splice(Number(del.dataset.del), 1);
      note = '';
      render();
    }
  });
  container.addEventListener('change', (e) => {
    const sel = e.target.closest('select.se-role'); // non il pulsante della lista, che ne copia la classe
    if (!sel) return;
    list[Number(sel.dataset.i)].role = sel.value;
    note = '';
    coLeader();
    render();
  });
  container.addEventListener('input', (e) => {
    const t = e.target;
    const i = Number(t.dataset.i);
    if (t.classList.contains('se-name')) list[i].name = t.value;
    else if (t.classList.contains('se-title')) list[i].title = t.value;
  });

  set(staff);
  return {
    get: () => list.map(m => ({ name: m.name.trim(), role: m.role, title: m.role === 'altro' ? m.title.trim() : '' })),
    set,
    error: () => validateStaff(list)
  };
}
