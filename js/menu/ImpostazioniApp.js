import { esc, sid } from './menuUtils.js';
import { NotificationCenter } from '../services/notificationCenter.js';
import { notificationsSupported, permissionState } from '../services/notificationService.js';

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
      if (e.target.id === 'set-notifiche') return this._toggleNotifiche(e.target);
      if (e.target.id === 'set-theme') return window.setUserSetting('theme', e.target.value);
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
    const themeSel = this._root.querySelector('#set-theme');
    if (themeSel) {
      const { html, value } = this._themeOptions(STATE);
      if (themeSel.dataset.sig !== html) { themeSel.dataset.sig = html; themeSel.innerHTML = html; }
      if (themeSel.value !== value) themeSel.value = value;
    }
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

  /**
   * Temi tra cui scegliere: Automatico (tema della competizione aperta), i temi delle
   * competizioni (quelle con tema o sfondo) e i temi aggiuntivi creati dal Patron.
   */
  _themeOptions(STATE) {
    const comps = (STATE.competitions || []).filter(c => c && (c.theme || c.backgroundImage));
    const custom = Object.entries(STATE.customThemes || {})
      .filter(([, t]) => t && typeof t === 'object')
      .map(([id, t]) => ({ id, name: t.name || id }))
      .sort((a, b) => a.name.localeCompare(b.name, 'it'));
    const values = ['auto', ...comps.map(c => `comp:${sid(c.id)}`), ...custom.map(t => `custom:${t.id}`)];
    const chosen = String((STATE.settings || {}).theme || '');
    const html = `
      <option value="auto" data-icon="ri-magic-line" data-sub="Tema e sfondo della competizione aperta">Automatico</option>
      ${comps.length ? `<optgroup label="Competizioni">${comps.map(c => `
        <option value="comp:${esc(c.id)}" ${c.logo ? `data-img="${esc(c.logo)}"` : 'data-icon="ri-trophy-line"'}>${esc(c.name || c.id)}</option>`).join('')}</optgroup>` : ''}
      ${custom.length ? `<optgroup label="Altri temi">${custom.map(t => `
        <option value="custom:${esc(t.id)}" data-icon="ri-palette-line">${esc(t.name)}</option>`).join('')}</optgroup>` : ''}`;
    return { html, value: values.includes(chosen) ? chosen : 'auto' };
  },

  /** Notifiche sul dispositivo: accendere l'interruttore chiede il permesso (serve il tocco dell'utente). */
  async _toggleNotifiche(input) {
    if (input.checked && permissionState() !== 'granted') {
      const res = await NotificationCenter.enable();
      if (res !== 'granted') { input.checked = false; this._render(window.STATE); return; }
    }
    await window.setUserSetting('notificationsEnabled', input.checked);
    NotificationCenter.syncPush(); // registra o cancella il token push di questo dispositivo
    this._render(window.STATE);
  },

  _notificheCard(s) {
    const st = permissionState();
    const on = st === 'granted' && s.notificationsEnabled !== false;
    let note = 'Offerte di mercato ricevute, risposte alle tue proposte, fine dei prestiti e comunicazioni della lega.';
    if (!notificationsSupported()) note = 'Non disponibili su questo dispositivo. Su iPhone installa l\'app nella schermata Home (Condividi → Aggiungi alla schermata Home) e riaprila da lì.';
    else if (st === 'denied') note = 'Bloccate dal telefono/browser: per riattivarle apri le impostazioni del sito o dell\'app e consenti le notifiche.';
    const disabled = !notificationsSupported() || st === 'denied';
    return `
      <div class="mp-card">
        <div class="mp-card-title">Notifiche</div>
        <div class="mp-row">
          <div class="mp-row-main">
            <div class="mp-row-label">Notifiche su questo dispositivo</div>
            <div class="mp-muted">${esc(note)}</div>
          </div>
          <label class="mp-switch" ${disabled ? 'style="opacity:.4;"' : ''}>
            <input type="checkbox" id="set-notifiche" ${on ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
            <span></span>
          </label>
        </div>
      </div>`;
  },

  _render(STATE) {
    const s = STATE.settings || {};
    const theme = this._themeOptions(STATE);
    this._root.innerHTML = `
      <div class="mp-card">
        <div class="mp-card-title">Aspetto</div>
        <div class="mp-row" style="flex-wrap:wrap;">
          <div class="mp-row-main">
            <div class="mp-row-label">Tema</div>
            <div class="mp-muted">Automatico usa colori e sfondo della competizione aperta. Puoi sceglierne uno da tenere sempre.</div>
          </div>
          <select id="set-theme" class="mp-select" data-title="Tema dell'app">${theme.html}</select>
        </div>
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
      ${this._notificheCard(s)}
      <div class="mp-muted" style="text-align:center;">Le impostazioni sono legate al tuo account e salvate anche su questo dispositivo.</div>
    `;
    const themeSel = this._root.querySelector('#set-theme');
    themeSel.dataset.sig = theme.html;
    themeSel.value = theme.value;
  }
};
