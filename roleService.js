import { db, ref, get } from '../firebase-config.js';

/**
 * Profilo/ruolo dell'utente.
 *
 * Il ruolo vive nel Realtime Database, in `users/{uid}/role`.
 * Per abilitare un Patron basta impostare quel nodo al valore "patron"
 * (da console Firebase). Non dipende più dall'email dell'account.
 */
export const ROLE_PATRON = 'patron';

export async function getUserRole(user) {
  if (!user || !user.uid) return null;
  try {
    const snap = await get(ref(db, `users/${user.uid}/role`));
    return snap.val() || null;
  } catch (err) {
    // Permesso negato o errore di rete: nessun ruolo speciale
    console.warn('Lettura ruolo non riuscita:', err);
    return null;
  }
}

export async function isPatron(user) {
  return (await getUserRole(user)) === ROLE_PATRON;
}
