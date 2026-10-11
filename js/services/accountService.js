import { db, ref, get, update, onValue } from '../firebase-config.js';
import { ROLE_PATRON } from './roleService.js';

/**
 * Creazione e approvazione degli account.
 *
 * - meta/patronExists          = true quando esiste almeno un Patron (leggibile da tutti)
 * - users/{uid}                = { email, role?, status: 'pending' | 'approved' | 'rejected', createdAt }
 * - accountRequests/{uid}      = { email, createdAt }  richieste in attesa, viste dal Patron
 *
 * Il primo account creato quando non c'è ancora un Patron diventa Patron (approvato).
 * Tutti gli altri restano "in attesa" finché un Patron non li accetta dal pannello.
 * Gli account creati prima di questo sistema (già associati a una squadra) restano validi.
 */
export const STATUS_PENDING = 'pending';
export const STATUS_APPROVED = 'approved';
export const STATUS_REJECTED = 'rejected';

export async function patronExists() {
  try {
    const snap = await get(ref(db, 'meta/patronExists'));
    return snap.val() === true;
  } catch (e) {
    // in dubbio si considera esistente: nessuno diventa Patron per errore
    return true;
  }
}

/** Il Patron che entra si assicura che il flag sia presente (Patron creati da console). */
export async function ensurePatronFlag() {
  try {
    const snap = await get(ref(db, 'meta/patronExists'));
    if (snap.val() !== true) await update(ref(db), { 'meta/patronExists': true });
  } catch (e) { /* senza permesso: lo imposterà la console */ }
}

/**
 * Da chiamare subito dopo createUserWithEmailAndPassword.
 * Ritorna 'patron' se è il primo account, altrimenti 'pending'.
 */
export async function registerAccount(user) {
  const now = Date.now();
  const email = user.email || '';
  if (!(await patronExists())) {
    try {
      await update(ref(db), {
        [`users/${user.uid}/email`]: email,
        [`users/${user.uid}/role`]: ROLE_PATRON,
        [`users/${user.uid}/status`]: STATUS_APPROVED,
        [`users/${user.uid}/createdAt`]: now,
        'meta/patronExists': true
      });
      return 'patron';
    } catch (e) {
      // nel frattempo qualcun altro è diventato Patron: si passa alla richiesta normale
      console.warn('Creazione primo Patron non riuscita:', e?.message);
    }
  }
  await createRequest(user, now);
  return STATUS_PENDING;
}

async function createRequest(user, now = Date.now()) {
  const email = user.email || '';
  await update(ref(db), {
    [`users/${user.uid}/email`]: email,
    [`users/${user.uid}/status`]: STATUS_PENDING,
    [`users/${user.uid}/createdAt`]: now,
    [`accountRequests/${user.uid}`]: { email, createdAt: now }
  });
}

/**
 * Stato di accesso dell'utente: 'approved' | 'pending' | 'rejected'.
 * teams = elenco squadre (per riconoscere gli account creati prima delle approvazioni).
 */
export async function getAccessStatus(user, teams = []) {
  let profile = null;
  try {
    profile = (await get(ref(db, `users/${user.uid}`))).val();
  } catch (e) {
    console.warn('Profilo non leggibile:', e?.message);
  }
  if (profile && profile.role === ROLE_PATRON) return STATUS_APPROVED;
  if (profile && profile.status) return profile.status;

  // Account precedente al sistema di approvazione: è già proprietario di una squadra
  const isOwner = (teams || []).some(t => t && t.owners && t.owners[user.uid]);
  if (isOwner) return STATUS_APPROVED;

  // Account senza profilo (es. creato da un altro dispositivo): si crea la richiesta
  try { await createRequest(user); } catch (e) { console.warn('Richiesta non salvata:', e?.message); }
  return STATUS_PENDING;
}

/** Segue lo stato dell'utente (es. per entrare appena il Patron approva). Ritorna l'unsubscribe. */
export function watchAccessStatus(uid, cb) {
  return onValue(ref(db, `users/${uid}/status`), snap => cb(snap.val()), () => {});
}

/** Richieste in attesa, per il Patron. cb riceve [{ uid, email, createdAt }] dal più vecchio. */
export function watchAccountRequests(cb) {
  return onValue(ref(db, 'accountRequests'), snap => {
    const raw = snap.val() || {};
    cb(Object.entries(raw)
      .map(([uid, r]) => ({ uid, email: (r && r.email) || '', createdAt: (r && r.createdAt) || 0 }))
      .sort((a, b) => a.createdAt - b.createdAt));
  }, () => cb([]));
}

export function approveAccount(uid, patronUid) {
  return update(ref(db), {
    [`users/${uid}/status`]: STATUS_APPROVED,
    [`users/${uid}/approvedBy`]: patronUid || null,
    [`users/${uid}/approvedAt`]: Date.now(),
    [`accountRequests/${uid}`]: null
  });
}

export function rejectAccount(uid, patronUid) {
  return update(ref(db), {
    [`users/${uid}/status`]: STATUS_REJECTED,
    [`users/${uid}/rejectedBy`]: patronUid || null,
    [`users/${uid}/rejectedAt`]: Date.now(),
    [`accountRequests/${uid}`]: null
  });
}

/** Notifica di sistema (se l'utente l'ha permessa); altrimenti non fa nulla. */
export function notifyNewRequest(email) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const body = email ? `${email} chiede di accedere all'app` : "Un nuovo utente chiede di accedere all'app";
    const opts = { body, icon: 'icons/icon-192.png', tag: 'account-request' };
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(reg => reg.showNotification('Nuova richiesta di account', opts))
        .catch(() => new Notification('Nuova richiesta di account', opts));
    } else {
      new Notification('Nuova richiesta di account', opts);
    }
  } catch (e) { /* notifiche non supportate */ }
}

/**
 * Eseguita dal Patron: gli account creati prima delle approvazioni (proprietari di una squadra
 * senza stato nel profilo) vengono segnati come approvati, così le regole del database
 * possono richiedere status = 'approved' senza bloccarli.
 */
export async function approveLegacyOwners() {
  try {
    const [teamsSnap, usersSnap] = await Promise.all([get(ref(db, 'teams')), get(ref(db, 'users'))]);
    const users = usersSnap.val() || {};
    const patch = {};
    Object.values(teamsSnap.val() || {}).forEach(t => {
      Object.keys((t && t.owners) || {}).forEach(uid => {
        const u = users[uid] || {};
        if (!u.status && u.role !== ROLE_PATRON) patch[`users/${uid}/status`] = STATUS_APPROVED;
      });
    });
    if (Object.keys(patch).length) await update(ref(db), patch);
  } catch (e) {
    console.warn('Allineamento account esistenti non riuscito:', e?.message);
  }
}
