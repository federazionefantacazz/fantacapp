/**
 * Cloud Function "inviaNotifica": quando nasce notifications/{id} (Patron o mercato)
 * invia la notifica push (Firebase Cloud Messaging) ai dispositivi delle squadre destinatarie.
 *
 * Installazione: copia questo file nella cartella functions/ del progetto e in functions/index.js aggiungi
 *   exports.inviaNotifica = require('./inviaNotifica').inviaNotifica;
 * poi: firebase deploy --only functions:inviaNotifica
 *
 * Dati letti:
 *   notifications/{id}         = { title, body, page, icon, image, all | teams: {teamId: true}, ... }
 *   teams/{teamId}/owners      = { uid: true }
 *   pushTokens/{uid}/{token}   = { teamId, updatedAt }   (scritti dall'app, js/services/pushService.js)
 */
const { onValueCreated } = require('firebase-functions/v2/database');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();

const INVALID = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument'
]);

exports.inviaNotifica = onValueCreated(
  { ref: '/notifications/{id}', region: 'europe-west1' },   // stessa regione del Realtime Database
  async (event) => {
    const n = event.data.val();
    if (!n) return;
    const db = admin.database();

    const [teamsSnap, tokensSnap] = await Promise.all([db.ref('teams').get(), db.ref('pushTokens').get()]);
    const teams = teamsSnap.val() || {};
    const allTokens = tokensSnap.val() || {};

    // squadre destinatarie → proprietari (uid)
    const teamIds = new Set((n.all ? Object.keys(teams) : Object.keys(n.teams || {})).map(String));
    const uids = new Set();
    teamIds.forEach(id => Object.keys((teams[id] || {}).owners || {}).forEach(u => uids.add(u)));

    // token: dei proprietari, oppure registrati con una delle squadre destinatarie
    const targets = [];   // [{ uid, token }]
    Object.entries(allTokens).forEach(([uid, list]) => {
      Object.entries(list || {}).forEach(([token, info]) => {
        const team = info && info.teamId !== undefined && info.teamId !== null ? String(info.teamId) : '';
        if (uids.has(uid) || (team && teamIds.has(team)) || n.all) targets.push({ uid, token });
      });
    });
    if (!targets.length) return;

    // FCM accetta solo stringhe nei dati
    const data = {
      id: String(n.id || event.params.id),
      title: String(n.title || 'FantaCApp'),
      body: String(n.body || ''),
      page: String(n.page || ''),
      icon: String(n.icon || ''),
      image: String(n.image || ''),
      requireInteraction: n.requireInteraction ? 'true' : 'false',
      silent: n.silent ? 'true' : 'false'
    };

    const remove = {};
    for (let i = 0; i < targets.length; i += 500) {   // massimo 500 token per invio
      const chunk = targets.slice(i, i + 500);
      const res = await admin.messaging().sendEachForMulticast({
        tokens: chunk.map(t => t.token),
        data,
        webpush: { headers: { Urgency: 'high', TTL: '86400' } }
      });
      res.responses.forEach((r, j) => {
        if (!r.success && r.error && INVALID.has(r.error.code)) {
          remove[`pushTokens/${chunk[j].uid}/${chunk[j].token}`] = null;   // app disinstallata o permesso revocato
        }
      });
    }
    if (Object.keys(remove).length) await db.ref().update(remove);
  }
);
