/**
 * Notifiche push ad app chiusa (Firebase Cloud Messaging).
 *
 *  - pushTokens/{uid}/{token} = { teamId, updatedAt, ua }   indirizzo FCM di ogni dispositivo dell'utente
 *  - la Cloud Function "inviaNotifica" (functions/) legge questi token quando nasce notifications/{id}
 *    e invia il messaggio; sw.js lo mostra anche ad app chiusa (evento "push")
 *
 * Il token si registra solo con il permesso concesso e le notifiche attive nelle impostazioni;
 * si cancella quando l'utente le spegne o esce dall'account.
 */
import { app, db, ref, update } from '../firebase-config.js';

const VAPID_KEY = 'BMYD16S2ZNHh-NsvriQXqWlKZJGh6ri1zINx9FD8xAsTCWxrvUWvuhqI0Nj4z5HEYCSMZl4x0KxOq8TYbELbfn0';
const MESSAGING_URL = 'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js';
const TOKEN_KEY = 'fantacapp-push-token';

function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) {} }

let modPromise = null;
// caricato solo quando serve: offline o su browser senza push l'app parte comunque
function messagingModule() {
  if (!modPromise) modPromise = import(MESSAGING_URL).catch(err => { modPromise = null; throw err; });
  return modPromise;
}

async function messaging() {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return null;
  const m = await messagingModule();
  if (!(await m.isSupported())) return null;
  return { m, messaging: m.getMessaging(app) };
}

export const PushService = {
  _busy: null,

  /** Registra (o aggiorna) il token di questo dispositivo per l'utente. */
  register(uid, teamId) {
    if (!uid || Notification.permission !== 'granted') return Promise.resolve(null);
    if (this._busy) return this._busy;
    this._busy = (async () => {
      try {
        const fcm = await messaging();
        if (!fcm) return null;
        const reg = await navigator.serviceWorker.ready;
        const token = await fcm.m.getToken(fcm.messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
        if (!token) return null;
        const old = lsGet(TOKEN_KEY);
        const upd = { [`pushTokens/${uid}/${token}`]: { teamId: teamId ? String(teamId) : null, updatedAt: Date.now(), ua: navigator.userAgent.slice(0, 150) } };
        if (old && old !== token) upd[`pushTokens/${uid}/${old}`] = null;
        await update(ref(db), upd);
        lsSet(TOKEN_KEY, token);
        return token;
      } catch (err) {
        console.warn('Notifiche push non attivate:', err?.message);
        return null;
      } finally {
        this._busy = null;
      }
    })();
    return this._busy;
  },

  /** Cancella il token di questo dispositivo (notifiche spente o logout). Da chiamare prima del signOut. */
  async unregister(uid) {
    const token = lsGet(TOKEN_KEY);
    lsSet(TOKEN_KEY, null);
    if (!token) return;
    try { if (uid) await update(ref(db), { [`pushTokens/${uid}/${token}`]: null }); } catch (e) { console.warn('Token push non rimosso:', e?.message); }
    try {
      const fcm = await messaging();
      if (fcm) await fcm.m.deleteToken(fcm.messaging);
    } catch (e) { /* già scaduto o offline */ }
  }
};
