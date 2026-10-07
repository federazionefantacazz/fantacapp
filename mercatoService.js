/**
 * mercatoService.js
 * Logica del mercato tra utenti (scambi e prestiti).
 *
 * Dati su Firebase:
 *   trades/<tradeId> = {
 *     id, tipo: 'scambio' | 'prestito',
 *     fromTeamId, toTeamId,            // proponente / destinatario
 *     give: [playerId], get: [playerId],   // give = cede il proponente, get = riceve il proponente
 *     giveInfo: [{id,name,role,club}], getInfo: [...],  // snapshot per lo storico
 *     durata,                          // solo prestiti (5..8 giornate di Serie A)
 *     status: pending | accepted | rejected | withdrawn | cancelled | active | returned,
 *     createdAt, respondedAt, startGw, endGw, returnedAt, returnedAtGw, reason
 *   }
 *   players/<id>/loan = { tradeId, fromTeamId (proprietario), toTeamId (chi lo ha in prestito), startGw, endGw }
 *
 * Durante un prestito il campo players/<id>/teamId viene spostato sulla squadra che lo riceve,
 * così rosa, formazione e live funzionano senza modifiche. Alla scadenza torna al proprietario.
 */
import { db, ref, update } from '../firebase-config.js';

export const ROLES = ['P', 'D', 'C', 'A'];
export const LOAN_MIN = 5;
export const LOAN_MAX = 8;

const sid = (v) => String(v ?? '');

export const MercatoService = {
  _sweeping: false,
  _swept: new Set(),

  playerMap(players) {
    return new Map((players || []).filter(Boolean).map(p => [sid(p.id), p]));
  },

  snapshot(p) {
    return { id: sid(p.id), name: p.name || '?', role: p.role || '?', club: p.club || '' };
  },

  roleCounts(ids, pmap) {
    const c = { P: 0, D: 0, C: 0, A: 0 };
    (ids || []).forEach(id => { const p = pmap.get(sid(id)); if (p && c[p.role] !== undefined) c[p.role]++; });
    return c;
  },

  /** Valida una proposta/trattativa rispetto allo stato attuale delle rose. */
  valida({ tipo, fromTeamId, toTeamId, give, get, durata }, players) {
    const pmap = this.playerMap(players);
    if (!fromTeamId || !toTeamId || sid(fromTeamId) === sid(toTeamId)) return { ok: false, error: 'Seleziona una squadra avversaria valida.' };
    if (!give?.length || !get?.length) return { ok: false, error: 'Seleziona almeno un giocatore da cedere e uno da ricevere.' };
    if (give.length !== get.length) return { ok: false, error: 'Devi scambiare lo stesso numero di giocatori.' };
    if (new Set([...give, ...get].map(sid)).size !== give.length + get.length) return { ok: false, error: 'Giocatori duplicati nella trattativa.' };

    for (const id of give) {
      const p = pmap.get(sid(id));
      if (!p || sid(p.teamId) !== sid(fromTeamId)) return { ok: false, error: `${p?.name || 'Un giocatore'} non è più nella rosa del proponente.` };
      if (p.loan) return { ok: false, error: `${p.name} è in prestito e non può essere ceduto.` };
    }
    for (const id of get) {
      const p = pmap.get(sid(id));
      if (!p || sid(p.teamId) !== sid(toTeamId)) return { ok: false, error: `${p?.name || 'Un giocatore'} non è più nella rosa del destinatario.` };
      if (p.loan) return { ok: false, error: `${p.name} è in prestito e non può essere scambiato.` };
    }

    const a = this.roleCounts(give, pmap);
    const b = this.roleCounts(get, pmap);
    for (const r of ROLES) {
      if (a[r] !== b[r]) return { ok: false, error: `Ruoli non corrispondenti: cedi ${a[r]} ${r} e ricevi ${b[r]} ${r}.` };
    }

    if (tipo === 'prestito') {
      const d = Number(durata);
      if (!Number.isInteger(d) || d < LOAN_MIN || d > LOAN_MAX) return { ok: false, error: `La durata del prestito deve essere tra ${LOAN_MIN} e ${LOAN_MAX} giornate.` };
    }
    return { ok: true };
  },

  newId() {
    return `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  },

  /** Costruisce l'oggetto trattativa da salvare. */
  buildTrade({ tipo, fromTeamId, toTeamId, give, get, durata }, players, giornataReale) {
    const pmap = this.playerMap(players);
    const id = this.newId();
    const trade = {
      id,
      tipo,
      fromTeamId: sid(fromTeamId),
      toTeamId: sid(toTeamId),
      give: give.map(sid),
      get: get.map(sid),
      giveInfo: give.map(i => this.snapshot(pmap.get(sid(i)))),
      getInfo: get.map(i => this.snapshot(pmap.get(sid(i)))),
      status: 'pending',
      createdAt: Date.now(),
      createdAtGw: Number(giornataReale) || 0
    };
    if (tipo === 'prestito') trade.durata = Number(durata);
    return trade;
  },

  /**
   * Aggiornamenti multi-path per l'accettazione di una trattativa.
   * Ritorna { ok, error, updates }.
   */
  buildAccept(trade, players, allTrades, giornataReale) {
    const check = this.valida(trade, players);
    if (!check.ok) return { ok: false, error: check.error };

    const now = Date.now();
    const gw = Number(giornataReale) || 0;
    const isLoan = trade.tipo === 'prestito';
    const startGw = gw;
    const endGw = isLoan ? gw + Number(trade.durata) : null;
    const updates = {};

    const move = (playerId, ownerId, newTeamId) => {
      updates[`players/${playerId}/teamId`] = sid(newTeamId);
      if (isLoan) {
        updates[`players/${playerId}/loan`] = {
          tradeId: trade.id,
          fromTeamId: sid(ownerId),
          toTeamId: sid(newTeamId),
          startGw,
          endGw
        };
      }
    };
    trade.give.forEach(id => move(id, trade.fromTeamId, trade.toTeamId));
    trade.get.forEach(id => move(id, trade.toTeamId, trade.fromTeamId));

    updates[`trades/${trade.id}/status`] = isLoan ? 'active' : 'accepted';
    updates[`trades/${trade.id}/respondedAt`] = now;
    if (isLoan) {
      updates[`trades/${trade.id}/startGw`] = startGw;
      updates[`trades/${trade.id}/endGw`] = endGw;
    }

    // Le altre offerte in sospeso che coinvolgono gli stessi giocatori non sono più valide
    const moved = new Set([...trade.give, ...trade.get].map(sid));
    (allTrades || []).forEach(t => {
      if (t.id === trade.id || t.status !== 'pending') return;
      const involved = [...(t.give || []), ...(t.get || [])].some(id => moved.has(sid(id)));
      if (involved) {
        updates[`trades/${t.id}/status`] = 'cancelled';
        updates[`trades/${t.id}/respondedAt`] = now;
        updates[`trades/${t.id}/reason`] = 'Uno o più giocatori sono stati coinvolti in un\'altra trattativa conclusa.';
      }
    });

    return { ok: true, updates };
  },

  /** Giornate rimaste a un prestito attivo. */
  giornateRimaste(trade, giornataReale) {
    if (trade?.endGw === undefined || trade?.endGw === null) return null;
    return Math.max(0, Number(trade.endGw) - (Number(giornataReale) || 0));
  },

  /**
   * Fa rientrare i giocatori dei prestiti scaduti: un prestito che inizia alla giornata S
   * e dura N giornate termina alla giornata S+N (i giocatori tornano quando la giornata
   * di Serie A corrente raggiunge S+N). Idempotente: può essere chiamato da qualunque client.
   */
  async processaScadenze({ trades, players, giornataReale }) {
    const gw = Number(giornataReale);
    if (this._sweeping || !Number.isFinite(gw)) return 0;
    const list = (trades || []).filter(t => t && t.status === 'active' && t.endGw !== undefined && gw >= Number(t.endGw) && !this._swept.has(t.id));
    if (!list.length) return 0;

    const pmap = this.playerMap(players);
    const updates = {};
    list.forEach(t => {
      [...(t.give || []), ...(t.get || [])].forEach(pid => {
        const p = pmap.get(sid(pid));
        if (!p || !p.loan || p.loan.tradeId !== t.id) return;
        if (sid(p.teamId) === sid(p.loan.toTeamId)) updates[`players/${pid}/teamId`] = sid(p.loan.fromTeamId);
        updates[`players/${pid}/loan`] = null;
      });
      updates[`trades/${t.id}/status`] = 'returned';
      updates[`trades/${t.id}/returnedAt`] = Date.now();
      updates[`trades/${t.id}/returnedAtGw`] = gw;
    });

    this._sweeping = true;
    try {
      await update(ref(db), updates);
      list.forEach(t => this._swept.add(t.id));
      return list.length;
    } catch (err) {
      console.error('Errore rientro prestiti:', err);
      return 0;
    } finally {
      this._sweeping = false;
    }
  }
};
