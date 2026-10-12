import { esc } from './menuUtils.js';

/**
 * Impostazioni dell'applicazione (per utente).
 * Per aggiungerne una nuova: nuova voce qui + default in services/settingsService.js.
 */
const SCHEMA = [
  {
    key: 'showBackground',
    type: 'toggle',
    label: 'Mostra sfondo',
    desc: "Mostra l'immagine di sfondo della competizione. Se disattivato vedrai solo il colore del tema."
  },
  {
    key: 'kit3dQuality',
    type: 'choice',
    label: 'Risoluzione editor 3D',
    desc: 'Nitidezza della maglia nell\'editor della divisa. Alta è più nitida; su telefoni meno potenti scegli Bassa se la rotazione non è fluida.',
    def: 'medium',
    options: [{ id: 'low', label: 'Bassa' }, { id: 'medium', label: 'Media' }, { id: 'high', label: 'Alta' }]
  }
];

export const ImpostazioniApp = {
  title: 'Impostazioni',

  mount(body, STATE) {
    const root = document.createElement('div');
    body.appendChild(root);
    this._root = root;
    this._render(STATE);

    root.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-choice]');
      if (!btn) return;
      await window.setUserSetting(btn.dataset.choice, btn.dataset.v);
      this._render(window.STATE);
    });

    root.addEventListener('change', async (e) => {
      const input = e.target.closest('input[data-setting]');
      if (!input) return;
      const def = SCHEMA.find(s => s.key === input.dataset.setting);
      if (!def) return;
      const value = def.type === 'toggle' ? input.checked : input.value;
      await window.setUserSetting(def.key, value);
    });
  },

  refresh(STATE) {
    // Riallinea gli interruttori se le impostazioni cambiano (es. arrivano dal DB dopo l'apertura)
    if (!this._root) return;
    SCHEMA.forEach(def => {
      const input = this._root.querySelector(`input[data-setting="${def.key}"]`);
      const v = (STATE.settings || {})[def.key];
      if (def.type === 'choice') {
        this._root.querySelectorAll(`button[data-choice="${def.key}"]`).forEach(b => b.classList.toggle('on', b.dataset.v === (v || def.def)));
        return;
      }
      if (input && def.type === 'toggle' && input.checked !== (v !== false)) input.checked = v !== false;
    });
  },

  unmount() { this._root = null; },

  _render(STATE) {
    const s = STATE.settings || {};
    this._root.innerHTML = `
      <div class="mp-card">
        <div class="mp-card-title">Aspetto</div>
        ${SCHEMA.map(def => def.type === 'choice' ? `
          <div class="mp-row" style="flex-wrap:wrap;">
            <div class="mp-row-main">
              <div class="mp-row-label">${esc(def.label)}</div>
              <div class="mp-muted">${esc(def.desc)}</div>
            </div>
            <div style="display:flex; gap:.35rem; flex-wrap:wrap;">
              ${def.options.map(o => `<button class="lv-chip ${(s[def.key] || def.def) === o.id ? 'on' : ''}" data-choice="${def.key}" data-v="${o.id}">${esc(o.label)}</button>`).join('')}
            </div>
          </div>` : `
          <div class="mp-row">
            <div class="mp-row-main">
              <div class="mp-row-label">${esc(def.label)}</div>
              <div class="mp-muted">${esc(def.desc)}</div>
            </div>
            <label class="mp-switch">
              <input type="checkbox" data-setting="${def.key}" ${s[def.key] !== false ? 'checked' : ''}>
              <span></span>
            </label>
          </div>`).join('')}
      </div>
      <div class="mp-muted" style="text-align:center;">Le impostazioni sono legate al tuo account e salvate anche su questo dispositivo.</div>
    `;
  }
};
