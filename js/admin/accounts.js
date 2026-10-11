import { watchAccountRequests, approveAccount, rejectAccount, notifyNewRequest, approveLegacyOwners } from "../services/accountService.js";

/**
 * Box "Richieste nuovi account" nella dashboard del Patron.
 * Si disegna in #account-requests-box (creato da DashboardSection.renderHTML)
 * e mostra il numero di richieste sulla voce Dashboard del menu.
 */
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const AccountRequestsSection = {
  _auth: null,
  _list: [],
  _known: null,

  init(auth) {
    this._auth = auth;
    approveLegacyOwners();
    watchAccountRequests(list => {
      // notifica solo per le richieste arrivate dopo l'apertura del pannello
      if (this._known) {
        list.filter(r => !this._known.has(r.uid)).forEach(r => {
          notifyNewRequest(r.email);
          if (window.toast) window.toast(`Nuova richiesta di account: ${r.email || r.uid}`, 'ok');
        });
      }
      this._known = new Set(list.map(r => r.uid));
      this._list = list;
      this.render();
    });

    window.approvaAccount = (uid) => this._act(uid, true);
    window.rifiutaAccount = (uid) => this._act(uid, false);
    window.attivaNotificheAccount = async () => {
      if (!('Notification' in window)) return window.toast('Notifiche non supportate su questo dispositivo', 'err');
      const res = await Notification.requestPermission();
      window.toast(res === 'granted' ? 'Notifiche attivate' : 'Notifiche non consentite', res === 'granted' ? 'ok' : 'err');
      this.render();
    };
  },

  async _act(uid, approve) {
    const req = this._list.find(r => r.uid === uid);
    const who = (req && req.email) || uid;
    if (!approve && !confirm(`Rifiutare la richiesta di ${who}?`)) return;
    const patronUid = this._auth && this._auth.currentUser ? this._auth.currentUser.uid : null;
    try {
      await (approve ? approveAccount(uid, patronUid) : rejectAccount(uid, patronUid));
      window.toast(approve ? `Account di ${who} accettato` : `Richiesta di ${who} rifiutata`, 'ok');
    } catch (e) {
      console.error(e);
      window.toast('Operazione non riuscita (permessi del database?)', 'err');
    }
  },

  _updateNavBadge() {
    const btn = document.querySelector('.snav[data-sec="dashboard"]');
    if (!btn) return;
    let badge = btn.querySelector('.req-badge');
    if (!this._list.length) { if (badge) badge.remove(); return; }
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'req-badge';
      badge.style.cssText = 'margin-left:auto; min-width:18px; height:18px; padding:0 5px; border-radius:9px; background:var(--accent3); color:#fff; font-size:.68rem; font-weight:700; display:inline-flex; align-items:center; justify-content:center;';
      btn.appendChild(badge);
    }
    badge.textContent = this._list.length;
  },

  render() {
    this._updateNavBadge();
    const box = document.getElementById('account-requests-box');
    if (!box) return;
    const canNotify = ('Notification' in window) && Notification.permission !== 'granted' && Notification.permission !== 'denied';
    const notifyBtn = canNotify
      ? `<button class="btn btn-outline" style="width:auto; padding:.35rem .7rem; font-size:.75rem;" onclick="window.attivaNotificheAccount()"><i class="ri-notification-3-line"></i> Attiva notifiche</button>`
      : '';

    if (!this._list.length) {
      box.innerHTML = `
        <div class="card" style="max-width: 500px;">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:.6rem;">
            <div class="label" style="color: var(--accent); margin: 0; font-size: .85rem;"><i class="ri-user-add-line"></i> Richieste nuovi account</div>
            ${notifyBtn}
          </div>
          <div style="font-size:.8rem; color:var(--text3); margin-top:.6rem;">Nessuna richiesta in attesa.</div>
        </div>`;
      return;
    }

    const fmt = (ts) => ts ? new Date(ts).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    box.innerHTML = `
      <div class="card" style="max-width: 500px; border-left: 4px solid var(--accent3);">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:.6rem; margin-bottom:.8rem;">
          <div class="label" style="color: var(--accent3); margin: 0; font-size: .85rem;"><i class="ri-user-add-line"></i> Richieste nuovi account (${this._list.length})</div>
          ${notifyBtn}
        </div>
        ${this._list.map(r => `
          <div style="display:flex; align-items:center; gap:.6rem; padding:.6rem 0; border-top:1px solid var(--border);">
            <div style="flex:1; min-width:0;">
              <div style="font-size:.88rem; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(r.email || r.uid)}</div>
              <div style="font-size:.7rem; color:var(--text3);">${esc(fmt(r.createdAt))}</div>
            </div>
            <button class="btn btn-green" style="width:auto; padding:.4rem .7rem; font-size:.78rem;" onclick="window.approvaAccount('${esc(r.uid)}')"><i class="ri-check-line"></i> Accetta</button>
            <button class="btn btn-red" style="width:auto; padding:.4rem .7rem; font-size:.78rem;" onclick="window.rifiutaAccount('${esc(r.uid)}')"><i class="ri-close-line"></i> Rifiuta</button>
          </div>`).join('')}
      </div>`;
  }
};
