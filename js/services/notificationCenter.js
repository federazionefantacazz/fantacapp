/**
 * Notifiche nell'app utente.
 *
 *  - segue notifications/ e notificationTemplates/ (STATE.notifications, STATE.notifTemplates)
 *  - campanella nell'header con il numero di notifiche non lette (lette = più vecchie di settings.notifReadAt)
 *  - le nuove notifiche per la propria squadra diventano notifiche di sistema (se l'utente le ha permesse
 *    e non le ha disattivate dalle impostazioni) oppure un avviso nell'app se questa è aperta
 *  - invito ad attivare le notifiche: una barra che compare dopo l'ingresso, con "Attiva" / "Non ora"
 *    (il permesso del browser va chiesto da un tocco dell'utente, mai all'avvio)
 *
 * Ad app chiusa arrivano col push (js/services/pushService.js + Cloud Function inviaNotifica):
 * stessa notifica, stesso tag, quindi niente doppioni.
 */
import {
  watchNotifications, watchTemplates, isForTeam, showSystemNotification,
  notificationsSupported, permissionState, requestPermission
} from './notificationService.js';
import { PushService } from './pushService.js';

const SHOWN_PREFIX = 'fantacapp-notif-shown-';   // ultima notifica già segnalata su questo dispositivo
const ASK_KEY = 'fantacapp-notif-ask';            // quando l'utente ha scelto "Non ora"
const ASK_AGAIN_MS = 7 * 24 * 3600 * 1000;        // l'invito torna dopo una settimana

const STYLES = `
.hdr-bell{position:relative}
#notif-invite{position:fixed;left:.8rem;right:.8rem;bottom:calc(76px + env(safe-area-inset-bottom, 0px));z-index:1400;
  display:flex;align-items:center;gap:.7rem;padding:.8rem .9rem;border-radius:14px;background:var(--card);border:1px solid var(--border);
  box-shadow:0 10px 30px rgba(0,0,0,.4);transform:translateY(20px);opacity:0;pointer-events:none;transition:all .3s ease;max-width:520px;margin:0 auto}
#notif-invite.show{transform:none;opacity:1;pointer-events:auto}
#notif-invite .ni-ico{width:38px;height:38px;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1.25rem;
  color:var(--accent);background:color-mix(in srgb,var(--accent) 15%,transparent)}
#notif-invite .ni-txt{flex:1;min-width:0;font-size:.78rem;line-height:1.35;color:var(--text2);font-family:var(--font-sub,inherit)}
#notif-invite .ni-txt b{display:block;color:var(--text);font-size:.85rem;margin-bottom:.1rem;font-family:var(--font-text,inherit)}
#notif-invite .ni-btns{display:flex;flex-direction:column;gap:.3rem;flex-shrink:0}
#notif-invite button{border:none;border-radius:8px;padding:.4rem .7rem;font-size:.75rem;font-weight:600;cursor:pointer;font-family:var(--font-btn,inherit)}
#notif-invite .ni-yes{background:var(--btn-primary,var(--accent));color:var(--btn-primary-text,#0a0f1e)}
#notif-invite .ni-no{background:transparent;color:var(--text2);border:1px solid var(--border)}
`;

function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

export const NotificationCenter = {
  _started: false,
  _list: null,
  _uid: '',
  onChange: null,     // richiamata quando cambiano le notifiche (per aggiornare la vista aperta)

  /** getUid = () => uid dell'utente collegato */
  start(STATE, getUid) {
    if (this._started) return;
    this._started = true;
    this.STATE = STATE;
    this._getUid = getUid;
    this._injectStyles();

    watchTemplates(t => { STATE.notifTemplates = t; });
    watchNotifications(list => {
      if (!list) return;
      this._list = list;
      STATE.notifications = list;
      this._checkNew();
      this.updateBadge();
      if (typeof this.onChange === 'function') this.onChange();
    });

    // tocco su una notifica di sistema (vedi sw.js): apre la pagina indicata
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', e => {
        if (e.data && e.data.type === 'notification-click') this.openTarget(e.data.page);
      });
    }
    this.syncPush();
  },

  /** Notifiche della propria squadra, dalla più recente. */
  mine() {
    const teamId = this.STATE && this.STATE.user ? this.STATE.user.id : null;
    return (this._list || []).filter(n => isForTeam(n, teamId));
  },

  readAt() {
    return Number((this.STATE && this.STATE.settings || {}).notifReadAt) || 0;
  },

  unreadCount() {
    const readAt = this.readAt();
    return this.mine().filter(n => (n.createdAt || 0) > readAt).length;
  },

  markAllRead() {
    const newest = Math.max(Date.now(), ...this.mine().map(n => n.createdAt || 0));
    if (newest > this.readAt()) window.setUserSetting('notifReadAt', newest);
    this.updateBadge();
  },

  updateBadge() {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    const n = this.unreadCount();
    badge.textContent = n > 99 ? '99+' : n;
    badge.style.display = n ? 'flex' : 'none';
  },

  /** Pagina indicata dalla notifica, altrimenti l'elenco delle notifiche. */
  openTarget(page) {
    if (!this.STATE || !this.STATE.booted) return;
    if (page && typeof window.goPage === 'function') {
      if (typeof window.closeMenuPanel === 'function') window.closeMenuPanel();
      window.goPage(page === 'formazione' && this.STATE.live ? 'live' : page);
    } else if (typeof window.openMenuPage === 'function') {
      window.openMenuPage('notifiche');
    }
  },

  /* ───────────── nuove notifiche → avviso ───────────── */

  _checkNew() {
    const uid = this._getUid ? this._getUid() : '';
    if (!uid || !this.STATE.user) return;
    const key = SHOWN_PREFIX + uid;
    const mine = this.mine();
    const newest = mine.reduce((m, n) => Math.max(m, n.createdAt || 0), 0);
    const last = Number(lsGet(key));

    // primo avvio su questo dispositivo: niente raffica di vecchie notifiche
    if (!last) { lsSet(key, String(Math.max(newest, Date.now()))); return; }

    const fresh = mine.filter(n => (n.createdAt || 0) > last);
    if (newest > last) lsSet(key, String(newest));
    if (!fresh.length) return;

    const enabled = (this.STATE.settings || {}).notificationsEnabled !== false;
    const visible = document.visibilityState === 'visible';
    if (!visible && enabled && permissionState() === 'granted') {
      fresh.slice(0, 5).reverse().forEach(n => showSystemNotification(n));
    } else if (visible && typeof window.showToast === 'function') {
      window.showToast(fresh.length === 1 ? fresh[0].title : `Hai ${fresh.length} nuove notifiche`, 'ok');
    }
  },

  /* ───────────── invito ad attivare le notifiche ───────────── */

  /** Dopo l'ingresso nell'app: mostra l'invito se il permesso non è ancora stato chiesto. */
  maybeInvite() {
    if (!notificationsSupported() || permissionState() !== 'default') return;
    if ((this.STATE.settings || {}).notificationsEnabled === false) return;
    const dismissed = Number(lsGet(ASK_KEY)) || 0;
    if (Date.now() - dismissed < ASK_AGAIN_MS) return;

    setTimeout(() => {
      if (permissionState() !== 'default') return;
      let box = document.getElementById('notif-invite');
      if (!box) {
        box = document.createElement('div');
        box.id = 'notif-invite';
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-label', 'Attiva le notifiche');
        box.innerHTML = `
          <div class="ni-ico"><i class="ri-notification-3-line"></i></div>
          <div class="ni-txt"><b>Attiva le notifiche</b>Saprai subito quando ricevi un'offerta di mercato o una comunicazione dalla lega.</div>
          <div class="ni-btns">
            <button type="button" class="ni-yes">Attiva</button>
            <button type="button" class="ni-no">Non ora</button>
          </div>`;
        document.body.appendChild(box);
        box.querySelector('.ni-yes').addEventListener('click', async () => {
          box.classList.remove('show');
          await this.enable();
        });
        box.querySelector('.ni-no').addEventListener('click', () => {
          lsSet(ASK_KEY, String(Date.now()));
          box.classList.remove('show');
        });
      }
      requestAnimationFrame(() => box.classList.add('show'));
    }, 2500);
  },

  /** Push ad app chiusa: token registrato solo con permesso concesso e notifiche attive. */
  syncPush() {
    const uid = this._getUid ? this._getUid() : '';
    if (!uid || !this.STATE) return;
    const on = (this.STATE.settings || {}).notificationsEnabled !== false && permissionState() === 'granted';
    if (on) PushService.register(uid, this.STATE.user && this.STATE.user.id);
    else PushService.unregister(uid);
  },

  /** Chiede il permesso (da un tocco dell'utente) e attiva l'impostazione. Ritorna lo stato del permesso. */
  async enable() {
    const res = await requestPermission();
    if (res === 'granted') {
      if ((this.STATE.settings || {}).notificationsEnabled === false) await window.setUserSetting('notificationsEnabled', true);
      window.showToast('Notifiche attivate', 'ok');
      this.syncPush();
    } else if (res === 'denied') {
      window.showToast('Notifiche bloccate: puoi riattivarle dalle impostazioni del telefono', 'err');
    }
    const box = document.getElementById('notif-invite');
    if (box) box.classList.remove('show');
    return res;
  },

  _injectStyles() {
    if (document.getElementById('notif-center-styles')) return;
    const st = document.createElement('style');
    st.id = 'notif-center-styles';
    st.textContent = STYLES;
    document.head.appendChild(st);
  }
};
