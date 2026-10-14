import {
  TEMPLATES, PLACEHOLDERS, NOTIF_PAGES, DEFAULT_ICON, resolveTemplate, newNotificationId,
  watchNotifications, watchTemplates, saveNotification, deleteNotification,
  permissionState, requestPermission, showSystemNotification
} from '../services/notificationService.js';
import { ref, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { esc } from '../utils.js';

/**
 * Sezione "Notifiche" del Patron:
 *  - creazione di una notifica (testo, destinatari, pagina da aprire, icona, immagine, opzioni) con anteprima
 *  - testi delle notifiche automatiche del mercato (attivabili/disattivabili)
 *  - elenco delle notifiche inviate
 */

const STYLES = `
#sec-notifiche .nt-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,340px);gap:1.25rem;align-items:start}
@media (max-width: 900px){#sec-notifiche .nt-grid{grid-template-columns:minmax(0,1fr)}}
#sec-notifiche textarea.input-login{resize:vertical;min-height:80px;font-family:inherit}
#sec-notifiche .nt-teams{display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:1rem}
#sec-notifiche .nt-chip{display:inline-flex;align-items:center;gap:.35rem;padding:.35rem .7rem;border-radius:999px;border:1px solid var(--border);background:var(--bg3);color:var(--text2);font-family:var(--font-sub,inherit);font-size:.78rem;cursor:pointer;user-select:none}
#sec-notifiche .nt-chip.on{border-color:var(--accent);color:var(--accent);background:color-mix(in srgb,var(--accent) 14%,transparent)}
#sec-notifiche .nt-chip input{display:none}
#sec-notifiche .nt-opt{display:flex;align-items:center;gap:.5rem;font-size:.82rem;color:var(--text2);font-family:var(--font-sub,inherit);margin-bottom:.6rem;cursor:pointer}
#sec-notifiche .nt-preview{background:#f2f3f5;color:#1b1d21;border-radius:16px;padding:.8rem .9rem;box-shadow:0 6px 24px rgba(0,0,0,.35);font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
#sec-notifiche .nt-preview .nt-app{display:flex;align-items:center;gap:.4rem;font-size:.7rem;color:#5d636c;margin-bottom:.45rem}
#sec-notifiche .nt-preview .nt-app img{width:16px;height:16px;border-radius:4px}
#sec-notifiche .nt-preview .nt-main{display:flex;gap:.7rem;align-items:flex-start}
#sec-notifiche .nt-preview .nt-txt{flex:1;min-width:0}
#sec-notifiche .nt-preview .nt-t{font-weight:700;font-size:.88rem;margin-bottom:.15rem;word-break:break-word}
#sec-notifiche .nt-preview .nt-b{font-size:.82rem;line-height:1.35;color:#30343a;word-break:break-word;white-space:pre-wrap}
#sec-notifiche .nt-preview .nt-ic{width:40px;height:40px;border-radius:8px;object-fit:cover;flex-shrink:0}
#sec-notifiche .nt-preview .nt-img{width:100%;max-height:180px;object-fit:cover;border-radius:10px;margin-top:.6rem}
#sec-notifiche .nt-tpl{border-top:1px solid var(--border);padding:1rem 0}
#sec-notifiche .nt-tpl:first-of-type{border-top:none;padding-top:.3rem}
#sec-notifiche .nt-tpl-head{display:flex;align-items:center;gap:.6rem;margin-bottom:.6rem}
#sec-notifiche .nt-tpl.off .nt-fields{opacity:.45}
#sec-notifiche .nt-ph{display:inline-block;font-family:'DM Mono',monospace;font-size:.72rem;padding:.1rem .4rem;border-radius:4px;background:var(--bg3);border:1px solid var(--border);color:var(--accent);margin:0 .25rem .3rem 0;cursor:pointer}
#sec-notifiche .nt-sent{display:flex;gap:.7rem;align-items:flex-start;padding:.7rem 0;border-top:1px solid var(--border)}
#sec-notifiche .nt-sent:first-child{border-top:none}
#sec-notifiche .nt-switch{position:relative;width:40px;height:22px;flex-shrink:0}
#sec-notifiche .nt-switch input{opacity:0;position:absolute;inset:0;width:100%;height:100%;margin:0;cursor:pointer;z-index:1}
#sec-notifiche .nt-switch span{position:absolute;inset:0;background:var(--bg3);border:1px solid var(--border);border-radius:22px;transition:background .2s}
#sec-notifiche .nt-switch span::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--text2);transition:transform .2s,background .2s}
#sec-notifiche .nt-switch input:checked + span{background:color-mix(in srgb,var(--accent) 30%,transparent);border-color:var(--accent)}
#sec-notifiche .nt-switch input:checked + span::after{transform:translateX(18px);background:var(--accent)}
`;

const fmt = (ts) => ts ? new Date(ts).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

export const NotificheSection = {
  db: null,
  auth: null,
  teams: [],
  sent: [],
  templates: {},
  _teamsSig: '',
  _tplSig: null,
  draft: { title: '', body: '', all: true, teams: new Set(), page: '', icon: '', image: '', requireInteraction: false, silent: false },

  init(databaseInstance, auth) {
    this.db = databaseInstance;
    this.auth = auth;

    window.ntSend = () => this._send();
    window.ntTest = () => this._test();
    window.ntDelete = (id) => this._delete(id);
    window.ntSaveTemplate = (key) => this._saveTemplate(key);
    window.ntResetTemplate = (key) => this._resetTemplate(key);
    window.ntEnablePermission = async () => {
      const res = await requestPermission();
      window.toast(res === 'granted' ? 'Notifiche attivate su questo dispositivo' : 'Notifiche non consentite', res === 'granted' ? 'ok' : 'err');
      this._renderPermission();
    };

    watchNotifications(list => { this.sent = list || []; this._renderSent(); });
    watchTemplates(t => {
      this.templates = t;
      // i testi si ridisegnano solo se cambiano sul DB (non mentre il Patron sta scrivendo)
      const sig = JSON.stringify(t);
      if (sig !== this._tplSig) { this._tplSig = sig; this._renderTemplates(); }
    });
  },

  renderHTML() {
    return `
    <div id="sec-notifiche" class="admin-sec" style="display:none">
      <style>${STYLES}</style>
      <div class="sec-title">Notifiche</div>
      <div id="nt-permission"></div>

      <div class="nt-grid">
        <div class="card">
          <div class="label" style="color:var(--accent); font-size:.85rem; margin-bottom:1rem;"><i class="ri-notification-badge-line"></i> Nuova notifica</div>

          <label class="label" for="nt-title">Titolo</label>
          <input id="nt-title" class="input-login" maxlength="80" placeholder="Es. Mercato aperto!">

          <label class="label" for="nt-body">Testo</label>
          <textarea id="nt-body" class="input-login" maxlength="400" placeholder="Es. Da oggi fino a domenica puoi proporre scambi e prestiti."></textarea>

          <div class="label">Destinatari</div>
          <div class="nt-teams" id="nt-teams"></div>

          <label class="label" for="nt-page">Al tocco apre</label>
          <select id="nt-page" class="input-login">
            ${NOTIF_PAGES.map(p => `<option value="${p.id}">${esc(p.label)}</option>`).join('')}
          </select>

          <label class="label" for="nt-icon">Icona (URL, facoltativa)</label>
          <input id="nt-icon" class="input-login" placeholder="Vuoto = logo dell'app" inputmode="url">

          <label class="label" for="nt-image">Immagine grande (URL, facoltativa — visibile su Android)</label>
          <input id="nt-image" class="input-login" placeholder="https://i.ibb.co/..." inputmode="url">

          <label class="nt-opt"><input type="checkbox" id="nt-require"> Resta visibile finché l'utente non la tocca</label>
          <label class="nt-opt"><input type="checkbox" id="nt-silent"> Silenziosa (senza suono né vibrazione)</label>

          <div style="display:flex; gap:.6rem; margin-top:.8rem;">
            <button class="btn btn-outline" style="width:40%;" onclick="window.ntTest()"><i class="ri-eye-line"></i> Prova su di me</button>
            <button class="btn btn-green" onclick="window.ntSend()"><i class="ri-send-plane-line"></i> Invia notifica</button>
          </div>
        </div>

        <div>
          <div class="card">
            <div class="label" style="margin-bottom:.8rem;">Anteprima</div>
            <div id="nt-preview"></div>
            <div style="font-size:.72rem; color:var(--text3);font-family:var(--font-text3,inherit); margin-top:.8rem; line-height:1.4;">L'aspetto reale dipende dal telefono. Nell'app la notifica compare anche nell'elenco della campanella.</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="label" style="color:var(--accent); font-size:.85rem; margin-bottom:.4rem;"><i class="ri-exchange-line"></i> Notifiche automatiche del mercato</div>
        <div style="font-size:.78rem; color:var(--text2);font-family:var(--font-sub,inherit); margin-bottom:.6rem; line-height:1.4;">
          Partono da sole quando una squadra propone, accetta, rifiuta o ritira una trattativa e quando finisce un prestito.
          Nei testi puoi usare (tocca per inserire):
        </div>
        <div style="margin-bottom:.4rem;">
          ${PLACEHOLDERS.map(p => `<span class="nt-ph" title="${esc(p.desc)}" data-ph="${p.key}">{${p.key}}</span>`).join('')}
        </div>
        <div id="nt-templates"></div>
      </div>

      <div class="card">
        <div class="label" style="margin-bottom:.6rem;"><i class="ri-history-line"></i> Ultime notifiche</div>
        <div id="nt-sent"></div>
      </div>
    </div>`;
  },

  render({ TEAMS }) {
    const root = document.getElementById('sec-notifiche');
    if (!root) return;
    if (!root.dataset.bound) {
      root.dataset.bound = '1';
      this._bind(root);
      this._renderPermission();
      this._renderTemplates();
      this._renderSent();
    }
    this.teams = TEAMS || [];
    const sig = this.teams.map(t => `${t.id}:${t.name}`).join('|');
    if (sig !== this._teamsSig) {
      this._teamsSig = sig;
      this._renderTeams();
      this._renderSent();
    }
    this._renderPreview();
  },

  _bind(root) {
    const map = { 'nt-title': 'title', 'nt-body': 'body', 'nt-page': 'page', 'nt-icon': 'icon', 'nt-image': 'image' };
    root.addEventListener('input', e => {
      const k = map[e.target.id];
      if (k) { this.draft[k] = e.target.value; this._renderPreview(); }
    });
    root.addEventListener('change', e => {
      const k = map[e.target.id];
      if (k) this.draft[k] = e.target.value;
      if (e.target.id === 'nt-require') this.draft.requireInteraction = e.target.checked;
      if (e.target.id === 'nt-silent') this.draft.silent = e.target.checked;
      if (e.target.dataset.ntTeam !== undefined) {
        const id = e.target.dataset.ntTeam;
        if (id === '__all') {
          this.draft.all = e.target.checked;
        } else {
          if (e.target.checked) this.draft.teams.add(id); else this.draft.teams.delete(id);
          this.draft.all = false;
        }
        this._renderTeams();
      }
      if (e.target.dataset.tplToggle) {
        const tpl = e.target.closest('.nt-tpl');
        tpl.classList.toggle('off', !e.target.checked);
        this._saveTemplate(tpl.dataset.tpl); // l'interruttore vale subito
      }
    });
    // segnaposto: si inseriscono nell'ultimo campo di testo automatico usato
    let lastField = null;
    root.addEventListener('focusin', e => { if (e.target.dataset && e.target.dataset.tplField) lastField = e.target; });
    root.addEventListener('mousedown', e => { if (e.target.closest('.nt-ph')) e.preventDefault(); });
    root.addEventListener('click', e => {
      const ph = e.target.closest('.nt-ph');
      if (!ph) return;
      if (!lastField) return window.toast('Tocca prima il campo in cui inserirlo', 'info');
      const txt = `{${ph.dataset.ph}}`;
      const s = lastField.selectionStart ?? lastField.value.length;
      const en = lastField.selectionEnd ?? s;
      lastField.value = lastField.value.slice(0, s) + txt + lastField.value.slice(en);
      lastField.focus();
      lastField.setSelectionRange(s + txt.length, s + txt.length);
    });
  },

  _renderPermission() {
    const box = document.getElementById('nt-permission');
    if (!box) return;
    const st = permissionState();
    if (st === 'granted') { box.innerHTML = ''; return; }
    const msg = st === 'unsupported'
      ? 'Questo dispositivo non supporta le notifiche (su iPhone servono iOS 16.4+ e l\'app installata nella schermata Home).'
      : st === 'denied'
        ? 'Le notifiche sono bloccate su questo dispositivo: riattivale dalle impostazioni del browser per ricevere le prove.'
        : 'Attiva le notifiche su questo dispositivo per ricevere le richieste di account e provare quelle che crei.';
    box.innerHTML = `
      <div class="card" style="display:flex; align-items:center; gap:.8rem; border-left:4px solid var(--gold);">
        <i class="ri-notification-off-line" style="font-size:1.4rem; color:var(--gold);"></i>
        <div style="flex:1; font-size:.82rem; color:var(--text2);font-family:var(--font-sub,inherit); line-height:1.4;">${msg}</div>
        ${st === 'default' ? `<button class="btn btn-green" style="width:auto; padding:.5rem .9rem;" onclick="window.ntEnablePermission()"><i class="ri-notification-3-line"></i> Attiva</button>` : ''}
      </div>`;
  },

  _renderTeams() {
    const box = document.getElementById('nt-teams');
    if (!box) return;
    const d = this.draft;
    // squadre non più esistenti escluse dalla selezione
    d.teams = new Set([...d.teams].filter(id => this.teams.some(t => String(t.id) === id)));
    box.innerHTML = `
      <label class="nt-chip ${d.all ? 'on' : ''}"><input type="checkbox" data-nt-team="__all" ${d.all ? 'checked' : ''}><i class="ri-group-line"></i> Tutte le squadre</label>
      ${this.teams.map(t => {
        const on = !d.all && d.teams.has(String(t.id));
        return `<label class="nt-chip ${on ? 'on' : ''}"><input type="checkbox" data-nt-team="${esc(t.id)}" ${on ? 'checked' : ''}>${esc(t.name || t.id)}</label>`;
      }).join('')}`;
  },

  _renderPreview() {
    const box = document.getElementById('nt-preview');
    if (!box) return;
    const d = this.draft;
    const icon = d.icon.trim();
    const image = d.image.trim();
    box.innerHTML = `
      <div class="nt-preview">
        <div class="nt-app"><img src="${DEFAULT_ICON}" alt=""> FantaCApp · ora</div>
        <div class="nt-main">
          <div class="nt-txt">
            <div class="nt-t">${esc(d.title.trim() || 'Titolo della notifica')}</div>
            <div class="nt-b">${esc(d.body.trim() || 'Il testo della notifica comparirà qui.')}</div>
          </div>
          ${icon ? `<img class="nt-ic" src="${esc(icon)}" alt="" onerror="this.style.display='none'">` : ''}
        </div>
        ${image ? `<img class="nt-img" src="${esc(image)}" alt="" onerror="this.style.display='none'">` : ''}
      </div>`;
  },

  _build() {
    const d = this.draft;
    const title = d.title.trim();
    const body = d.body.trim();
    if (!title) { window.toast('Scrivi il titolo della notifica', 'err'); return null; }
    if (!d.all && !d.teams.size) { window.toast('Scegli almeno una squadra', 'err'); return null; }
    const n = {
      id: newNotificationId(),
      type: 'manual',
      title,
      body,
      page: d.page || '',
      createdAt: Date.now(),
      createdBy: (this.auth && this.auth.currentUser && this.auth.currentUser.uid) || null
    };
    if (d.all) n.all = true;
    else n.teams = Object.fromEntries([...d.teams].map(id => [id, true]));
    if (d.icon.trim()) n.icon = d.icon.trim();
    if (d.image.trim()) n.image = d.image.trim();
    if (d.requireInteraction) n.requireInteraction = true;
    if (d.silent) n.silent = true;
    return n;
  },

  _test() {
    const n = this._build();
    if (!n) return;
    if (permissionState() !== 'granted') return window.toast('Attiva prima le notifiche su questo dispositivo', 'err');
    showSystemNotification({ ...n, id: 'test' });
  },

  async _send() {
    const n = this._build();
    if (!n) return;
    const dest = n.all ? 'tutte le squadre' : `${Object.keys(n.teams).length} squadr${Object.keys(n.teams).length === 1 ? 'a' : 'e'}`;
    if (!confirm(`Inviare la notifica "${n.title}" a ${dest}?`)) return;
    try {
      await saveNotification(n);
      window.toast('Notifica inviata', 'ok');
      this.draft = { title: '', body: '', all: true, teams: new Set(), page: '', icon: '', image: '', requireInteraction: false, silent: false };
      ['nt-title', 'nt-body', 'nt-icon', 'nt-image'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      ['nt-require', 'nt-silent'].forEach(id => { const el = document.getElementById(id); if (el) el.checked = false; });
      const page = document.getElementById('nt-page'); if (page) page.value = '';
      this._renderTeams();
      this._renderPreview();
    } catch (e) {
      console.error(e);
      window.toast('Invio non riuscito (permessi del database?)', 'err');
    }
  },

  async _delete(id) {
    if (!confirm('Eliminare questa notifica? Sparirà anche dall\'elenco degli utenti.')) return;
    try {
      await deleteNotification(id);
      window.toast('Notifica eliminata', 'ok');
    } catch (e) { console.error(e); window.toast('Eliminazione non riuscita', 'err'); }
  },

  _renderTemplates() {
    const box = document.getElementById('nt-templates');
    if (!box) return;
    box.innerHTML = Object.entries(TEMPLATES).map(([key, def]) => {
      const t = resolveTemplate(key, this.templates);
      return `
        <div class="nt-tpl ${t.enabled ? '' : 'off'}" data-tpl="${key}">
          <div class="nt-tpl-head">
            <label class="nt-switch" title="Attiva/disattiva"><input type="checkbox" id="nt-tpl-on-${key}" data-tpl-toggle="1" ${t.enabled ? 'checked' : ''}><span></span></label>
            <div style="flex:1; min-width:0;">
              <div style="font-size:.9rem; font-weight:600;">${esc(def.label)}</div>
              <div style="font-size:.72rem; color:var(--text3);font-family:var(--font-text3,inherit);">${esc(def.who)}</div>
            </div>
          </div>
          <div class="nt-fields">
            <label class="label" for="nt-tpl-title-${key}">Titolo</label>
            <input id="nt-tpl-title-${key}" data-tpl-field="1" class="input-login" style="margin-bottom:.6rem;" value="${esc(t.title)}" placeholder="${esc(def.title)}">
            <label class="label" for="nt-tpl-body-${key}">Testo</label>
            <textarea id="nt-tpl-body-${key}" data-tpl-field="1" class="input-login" style="min-height:60px; margin-bottom:.6rem;" placeholder="${esc(def.body)}">${esc(t.body)}</textarea>
          </div>
          <div style="display:flex; gap:.5rem; justify-content:flex-end;">
            <button class="btn btn-outline" style="width:auto; padding:.4rem .8rem; font-size:.78rem;" onclick="window.ntResetTemplate('${key}')"><i class="ri-arrow-go-back-line"></i> Testo originale</button>
            <button class="btn btn-green" style="width:auto; padding:.4rem .8rem; font-size:.78rem;" onclick="window.ntSaveTemplate('${key}')"><i class="ri-save-line"></i> Salva</button>
          </div>
        </div>`;
    }).join('');
  },

  async _saveTemplate(key) {
    const val = (id) => (document.getElementById(id) || {}).value;
    const enabled = !!(document.getElementById(`nt-tpl-on-${key}`) || {}).checked;
    const title = (val(`nt-tpl-title-${key}`) || '').trim();
    const body = (val(`nt-tpl-body-${key}`) || '').trim();
    if (!title) return window.toast('Il titolo non può essere vuoto', 'err');
    try {
      await update(ref(this.db, `notificationTemplates/${key}`), { enabled, title, body });
      window.toast(`"${TEMPLATES[key].label}" salvata`, 'ok');
    } catch (e) { console.error(e); window.toast('Salvataggio non riuscito (permessi del database?)', 'err'); }
  },

  async _resetTemplate(key) {
    if (!confirm('Ripristinare il testo originale di questa notifica?')) return;
    try {
      await update(ref(this.db), { [`notificationTemplates/${key}`]: null });
      this._tplSig = null; // ridisegna anche se il nodo era già vuoto
      this._renderTemplates();
      window.toast('Testo originale ripristinato', 'ok');
    } catch (e) { console.error(e); window.toast('Ripristino non riuscito', 'err'); }
  },

  _renderSent() {
    const box = document.getElementById('nt-sent');
    if (!box) return;
    if (!this.sent.length) {
      box.innerHTML = `<div style="font-size:.8rem; color:var(--text3);font-family:var(--font-text3,inherit);">Ancora nessuna notifica.</div>`;
      return;
    }
    const teamName = (id) => (this.teams.find(t => String(t.id) === String(id)) || {}).name || id;
    box.innerHTML = this.sent.map(n => {
      const auto = n.type && n.type !== 'manual';
      const dest = n.all ? 'Tutte le squadre' : Object.keys(n.teams || {}).map(teamName).join(', ');
      return `
        <div class="nt-sent">
          <i class="${auto ? 'ri-exchange-line' : 'ri-notification-3-line'}" style="font-size:1.1rem; color:${auto ? 'var(--accent2)' : 'var(--accent)'}; margin-top:.15rem;"></i>
          <div style="flex:1; min-width:0;">
            <div style="font-size:.88rem; font-weight:600;">${esc(n.title || '')}</div>
            ${n.body ? `<div style="font-size:.8rem; color:var(--text2);font-family:var(--font-sub,inherit); margin:.15rem 0; white-space:pre-wrap;">${esc(n.body)}</div>` : ''}
            <div style="font-size:.7rem; color:var(--text3);font-family:var(--font-text3,inherit);">${esc(fmt(n.createdAt))} · ${esc(dest)}${auto ? ' · automatica' : ''}</div>
          </div>
          <button class="btn btn-outline" style="width:auto; padding:.3rem .55rem; font-size:.75rem;" title="Elimina" onclick="window.ntDelete('${esc(n.id)}')"><i class="ri-delete-bin-line"></i></button>
        </div>`;
    }).join('');
  }
};
