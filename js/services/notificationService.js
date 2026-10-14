/**
 * notificationService.js
 * Notifiche dell'app: create dal Patron o automatiche (mercato), lette dall'app utente.
 *
 * Dati su Firebase:
 *   notifications/<id> = {
 *     id, type: 'manual' | <chiave di TEMPLATES>,
 *     title, body,                     // testo finale (i segnaposto sono già sostituiti)
 *     all: true | teams: { <teamId>: true },   // destinatari
 *     page,                            // pagina da aprire al tocco (home, mercato, ...) — facoltativa
 *     icon, image,                     // URL facoltativi (icona piccola / immagine grande su Android)
 *     requireInteraction, silent,      // opzioni della notifica di sistema
 *     createdAt, createdBy (uid), tradeId
 *   }
 *   notificationTemplates/<chiave> = { enabled, title, body }   // testi automatici modificati dal Patron
 *
 * Le notifiche automatiche hanno id fisso (evento + trattativa + squadra): se due dispositivi
 * registrano lo stesso evento (es. rientro dei prestiti) la notifica resta una sola.
 */
import { db, ref, onValue, update } from '../firebase-config.js';
import { query, orderByChild, limitToLast } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { sid } from '../utils.js';

export const DEFAULT_ICON = 'icons/icon-192.png';
const HISTORY_LIMIT = 100;

/** Pagine dell'app che una notifica può aprire. */
export const NOTIF_PAGES = [
  { id: '', label: 'Nessuna (solo apertura app)' },
  { id: 'home', label: 'Home' },
  { id: 'calendario', label: 'Calendario' },
  { id: 'classifica', label: 'Classifica' },
  { id: 'formazione', label: 'Formazione' },
  { id: 'mercato', label: 'Mercato' },
  { id: 'teams', label: 'Squadre' }
];

/** Segnaposto utilizzabili nei testi automatici del mercato. */
export const PLACEHOLDERS = [
  { key: 'squadra', desc: "L'altra squadra della trattativa" },
  { key: 'ricevi', desc: 'Giocatori che la trattativa porta a chi riceve la notifica' },
  { key: 'cedi', desc: 'Giocatori che chi riceve la notifica cede nella trattativa' },
  { key: 'tipo', desc: 'scambio / prestito' },
  { key: 'durata', desc: 'Durata del prestito (giornate)' },
  { key: 'rientro', desc: 'Giornata di rientro del prestito' }
];

/** Notifiche automatiche del mercato (testi di default: il Patron li può cambiare). */
export const TEMPLATES = {
  scambioProposto: {
    label: 'Proposta di scambio ricevuta',
    who: 'Alla squadra che riceve la proposta',
    title: 'Nuova proposta di scambio',
    body: '{squadra} ti offre {ricevi} in cambio di {cedi}'
  },
  prestitoProposto: {
    label: 'Proposta di prestito ricevuta',
    who: 'Alla squadra che riceve la proposta',
    title: 'Nuova proposta di prestito',
    body: '{squadra} ti propone un prestito di {durata} giornate: {ricevi} in cambio di {cedi}'
  },
  scambioAccettato: {
    label: 'Scambio accettato',
    who: 'Alla squadra che aveva proposto',
    title: 'Scambio concluso!',
    body: '{squadra} ha accettato: arrivano {ricevi}, partono {cedi}'
  },
  prestitoAccettato: {
    label: 'Prestito accettato',
    who: 'Alla squadra che aveva proposto',
    title: 'Prestito accettato!',
    body: '{squadra} ha accettato il prestito: arrivano {ricevi} fino alla G{rientro}'
  },
  offertaRifiutata: {
    label: 'Offerta rifiutata',
    who: 'Alla squadra che aveva proposto',
    title: 'Offerta rifiutata',
    body: '{squadra} ha rifiutato la tua proposta di {tipo}'
  },
  offertaRitirata: {
    label: 'Offerta ritirata',
    who: 'Alla squadra che aveva ricevuto la proposta',
    title: 'Offerta ritirata',
    body: '{squadra} ha ritirato la proposta di {tipo} che ti aveva fatto'
  },
  offertaAnnullata: {
    label: 'Offerta annullata',
    who: 'A entrambe le squadre (un giocatore è finito in un\'altra trattativa)',
    title: 'Offerta annullata',
    body: 'La trattativa di {tipo} con {squadra} non è più valida: un giocatore è stato coinvolto in un\'altra trattativa'
  },
  prestitoConcluso: {
    label: 'Prestito concluso',
    who: 'A entrambe le squadre',
    title: 'Prestito concluso',
    body: 'Il prestito con {squadra} è terminato: tornano a casa {cedi}, ripartono {ricevi}'
  }
};

/** Testo del template (default + modifiche del Patron), con eventuale disattivazione. */
export function resolveTemplate(key, saved) {
  const def = TEMPLATES[key];
  const s = (saved && saved[key]) || {};
  return {
    enabled: s.enabled !== false,
    title: (typeof s.title === 'string' && s.title.trim()) ? s.title : def.title,
    body: (typeof s.body === 'string' && s.body.trim()) ? s.body : def.body
  };
}

export function fillPlaceholders(text, vars) {
  return String(text || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null) ? String(vars[k]) : m);
}

export function newNotificationId() {
  return `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** La notifica è destinata a questa squadra? */
export function isForTeam(n, teamId) {
  if (!n) return false;
  if (n.all) return true;
  return !!(n.teams && teamId !== undefined && teamId !== null && n.teams[sid(teamId)]);
}

/* ───────────────────────── mercato ───────────────────────── */

const names = (info) => (info || []).map(p => p && p.name).filter(Boolean).join(', ') || '—';

/**
 * Aggiornamenti multi-path che creano la notifica automatica `key` per la squadra `teamId`
 * relativa alla trattativa `trade` (da unire all'update che cambia lo stato della trattativa).
 *
 * opts: { templates (notificationTemplates dal DB), teams (STATE.teams), createdBy (uid), rientro }
 */
export function tradeNotificationUpdates(key, trade, teamId, opts = {}) {
  if (!TEMPLATES[key] || !trade || !teamId) return {};
  const tpl = resolveTemplate(key, opts.templates);
  if (!tpl.enabled) return {};

  const me = sid(teamId);
  const isFrom = sid(trade.fromTeamId) === me;
  const otherId = isFrom ? trade.toTeamId : trade.fromTeamId;
  const other = (opts.teams || []).find(t => t && sid(t.id) === sid(otherId));
  const vars = {
    squadra: (other && other.name) || `Squadra ${otherId}`,
    // il proponente cede "give" e riceve "get"; il destinatario il contrario
    ricevi: names(isFrom ? trade.getInfo : trade.giveInfo),
    cedi: names(isFrom ? trade.giveInfo : trade.getInfo),
    tipo: trade.tipo === 'prestito' ? 'prestito' : 'scambio',
    durata: trade.durata || '',
    rientro: opts.rientro !== undefined ? opts.rientro : (trade.endGw !== undefined ? trade.endGw : '')
  };

  const id = `n_${key}_${trade.id}_${me}`;
  return {
    [`notifications/${id}`]: {
      id,
      type: key,
      title: fillPlaceholders(tpl.title, vars),
      body: fillPlaceholders(tpl.body, vars),
      teams: { [me]: true },
      page: 'mercato',
      tradeId: trade.id,
      createdAt: Date.now(),
      createdBy: opts.createdBy || null
    }
  };
}

/* ───────────────────────── lettura ───────────────────────── */

/** Ultime notifiche (più recenti per prime). Ritorna l'unsubscribe. */
export function watchNotifications(cb) {
  const q = query(ref(db, 'notifications'), orderByChild('createdAt'), limitToLast(HISTORY_LIMIT));
  return onValue(q, snap => {
    const list = [];
    snap.forEach(child => { const v = child.val(); if (v) list.push({ ...v, id: child.key }); });
    cb(list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
  }, err => { console.warn('Notifiche non leggibili:', err?.message); cb(null); });
}

/** Testi automatici modificati dal Patron. Ritorna l'unsubscribe. */
export function watchTemplates(cb) {
  return onValue(ref(db, 'notificationTemplates'), snap => cb(snap.val() || {}), () => cb({}));
}

export function saveNotification(n) {
  return update(ref(db), { [`notifications/${n.id}`]: n });
}

export function deleteNotification(id) {
  return update(ref(db), { [`notifications/${id}`]: null });
}

/* ───────────────────────── notifiche di sistema ───────────────────────── */

export function notificationsSupported() {
  return 'Notification' in window;
}

export function permissionState() {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}

export async function requestPermission() {
  if (!notificationsSupported()) return 'unsupported';
  try { return await Notification.requestPermission(); } catch (e) { return Notification.permission; }
}

/** Mostra la notifica di sistema (tramite il service worker, necessario su Android). */
export function showSystemNotification(n) {
  try {
    if (!notificationsSupported() || Notification.permission !== 'granted') return false;
    const opts = {
      body: n.body || '',
      icon: n.icon || DEFAULT_ICON,
      badge: DEFAULT_ICON,
      tag: n.id,
      data: { page: n.page || '', id: n.id },
      requireInteraction: !!n.requireInteraction,
      silent: !!n.silent
    };
    if (n.image) opts.image = n.image;
    const title = n.title || 'FantaCApp';
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(reg => reg.showNotification(title, opts))
        .catch(() => new Notification(title, opts));
    } else {
      new Notification(title, opts);
    }
    return true;
  } catch (e) { return false; }
}
