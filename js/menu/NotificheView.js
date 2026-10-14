import { esc } from './menuUtils.js';
import { NotificationCenter } from '../services/notificationCenter.js';
import { notificationsSupported, permissionState } from '../services/notificationService.js';

/**
 * Elenco delle notifiche della propria squadra (campanella nell'header) e stato del permesso.
 * All'apertura le notifiche vengono segnate come lette; quelle nuove restano evidenziate finché la vista è aperta.
 */

const PAGE_ICON = { mercato: 'ri-exchange-line', formazione: 'ri-shield-user-line', calendario: 'ri-calendar-line', classifica: 'ri-bar-chart-2-line', teams: 'ri-team-line', home: 'ri-home-4-line' };

const STYLES = `
.nf-item{display:flex;gap:.75rem;align-items:flex-start;padding:.8rem;border-radius:12px;background:var(--card);border:1px solid var(--border);margin-bottom:.55rem;cursor:pointer}
.nf-item.new{border-color:color-mix(in srgb,var(--accent) 55%,transparent);background:color-mix(in srgb,var(--accent) 7%,var(--card))}
.nf-ico{width:36px;height:36px;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1.1rem;color:var(--accent);background:color-mix(in srgb,var(--accent) 14%,transparent)}
.nf-ico img{width:100%;height:100%;object-fit:cover;border-radius:10px}
.nf-t{font-size:.88rem;font-weight:600;color:var(--text);line-height:1.25}
.nf-b{font-size:.78rem;color:var(--text2);font-family:var(--font-sub,inherit);line-height:1.4;margin-top:.15rem;white-space:pre-wrap;word-break:break-word}
.nf-img{width:100%;max-height:170px;object-fit:cover;border-radius:10px;margin-top:.5rem}
.nf-d{font-size:.68rem;color:var(--text3);font-family:var(--font-text3,inherit);margin-top:.35rem;display:flex;align-items:center;gap:.35rem}
.nf-dot{width:8px;height:8px;border-radius:50%;background:var(--accent);flex-shrink:0;margin-top:.35rem}
`;

const fmt = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  const same = d.toDateString() === today.toDateString();
  return same ? `Oggi, ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`
    : d.toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export const NotificheView = {
  title: 'Notifiche',

  mount(body, STATE) {
    if (!document.getElementById('notifiche-view-styles')) {
      const st = document.createElement('style');
      st.id = 'notifiche-view-styles';
      st.textContent = STYLES;
      document.head.appendChild(st);
    }
    this._root = document.createElement('div');
    body.appendChild(this._root);
    // quelle non lette all'apertura restano evidenziate
    this._readAt = NotificationCenter.readAt();
    this._render(STATE);
    NotificationCenter.markAllRead();
    NotificationCenter.onChange = () => { if (this._root) { this._render(window.STATE); NotificationCenter.markAllRead(); } };

    this._root.addEventListener('click', async (e) => {
      const act = e.target.closest('[data-act]');
      if (act && act.dataset.act === 'enable') {
        await NotificationCenter.enable();
        this._render(window.STATE);
        return;
      }
      if (act && act.dataset.act === 'settings') { window.openMenuPage('settings'); return; }
      const item = e.target.closest('.nf-item');
      if (item && item.dataset.page) NotificationCenter.openTarget(item.dataset.page);
    });
  },

  refresh(STATE) { if (this._root) this._render(STATE); },

  unmount() {
    this._root = null;
    NotificationCenter.onChange = null;
  },

  _permissionCard(STATE) {
    const st = permissionState();
    const off = (STATE.settings || {}).notificationsEnabled === false;
    if (st === 'granted' && !off) return '';
    let txt, btn = '';
    if (!notificationsSupported()) {
      txt = 'Su questo dispositivo le notifiche di sistema non sono disponibili. Su iPhone installa l\'app nella schermata Home (Condividi → Aggiungi alla schermata Home), poi riaprila da lì.';
    } else if (st === 'denied') {
      txt = 'Le notifiche sono bloccate per questa app: riattivale dalle impostazioni del telefono o del browser. Le trovi comunque qui.';
    } else if (off) {
      txt = 'Hai disattivato le notifiche sul dispositivo. Le trovi comunque qui.';
      btn = `<button class="mp-btn ghost" data-act="settings"><i class="ri-settings-3-line"></i> Impostazioni</button>`;
    } else {
      txt = 'Attiva le notifiche per sapere subito quando ricevi un\'offerta di mercato o una comunicazione dalla lega.';
      btn = `<button class="mp-btn" data-act="enable"><i class="ri-notification-3-line"></i> Attiva</button>`;
    }
    return `
      <div class="mp-card" style="display:flex; gap:.8rem; align-items:center;">
        <div class="mp-muted" style="flex:1;">${txt}</div>
        ${btn}
      </div>`;
  },

  _render(STATE) {
    const list = NotificationCenter.mine();
    const items = list.map(n => {
      const isNew = (n.createdAt || 0) > this._readAt;
      const icon = n.icon
        ? `<img src="${esc(n.icon)}" alt="" onerror="this.outerHTML='<i class=&quot;ri-notification-3-line&quot;></i>'">`
        : `<i class="${PAGE_ICON[n.page] || 'ri-notification-3-line'}"></i>`;
      return `
        <div class="nf-item ${isNew ? 'new' : ''}" data-page="${esc(n.page || '')}" ${n.page ? 'role="button" tabindex="0"' : ''}>
          <div class="nf-ico">${icon}</div>
          <div style="flex:1; min-width:0;">
            <div class="nf-t">${esc(n.title || '')}</div>
            ${n.body ? `<div class="nf-b">${esc(n.body)}</div>` : ''}
            ${n.image ? `<img class="nf-img" src="${esc(n.image)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
            <div class="nf-d">${esc(fmt(n.createdAt))}${n.page ? ' · <i class="ri-arrow-right-s-line"></i>Apri' : ''}</div>
          </div>
          ${isNew ? '<span class="nf-dot" aria-label="Nuova"></span>' : ''}
        </div>`;
    }).join('');

    this._root.innerHTML = this._permissionCard(STATE) + (items || `
      <div style="text-align:center; padding:3rem 1rem; color:var(--text3); font-family:var(--font-text3,inherit);">
        <i class="ri-notification-off-line" style="font-size:2.2rem; display:block; margin-bottom:.6rem;"></i>
        Nessuna notifica per ora.
      </div>`);
  }
};
