import { CalcoloMatchService } from './calcoloMatch.js';

const sid = (v) => (v === undefined || v === null ? '' : String(v));

/**
 * Statistiche aggregate per giocatore, usate da Listone e Svincolati.
 *  - mv:   media voto (solo giornate con voto > 0)
 *  - fv:   media fantavoto
 *  - pres: presenze (giornate con voto)
 */
export const PlayerStatsService = {
  getPlayers(STATE) {
    const list = Array.isArray(STATE.players) ? STATE.players : Object.values(STATE.players || {});
    return list.filter(p => p && p.id !== undefined && p.name);
  },

  /** Svincolato = nessuna squadra e non in prestito. */
  isFree(p) {
    return !sid(p.teamId) && !p.loan;
  },

  _voto(entry) {
    if (entry === undefined || entry === null) return null;
    const n = CalcoloMatchService.normalizzaVoto(typeof entry === 'object' ? entry.voto : entry);
    return n > 0 ? n : null;
  },

  // Stessa regola della home ("Giocatori On Fire"): fantavoto salvato, altrimenti voto + bonus/malus
  _fantavoto(entry) {
    const voto = this._voto(entry);
    if (voto === null) return null;
    if (typeof entry !== 'object') return voto;
    const fv = entry.fantavoto !== undefined && entry.fantavoto !== null
      ? Number(entry.fantavoto)
      : CalcoloMatchService.calcolaFantavoto(entry);
    return Number.isFinite(fv) ? fv : null;
  },

  /** @returns {Map<string, {mv:number|null, fv:number|null, pres:number}>} */
  buildStats(STATE) {
    const votes = STATE.votes || {};
    const realGw = Number(STATE.giornataRealeCorrente) || 0;
    const gwNum = (k) => parseInt(String(k).replace(/\D/g, ''), 10);

    const gwKeys = Object.keys(votes)
      .filter(k => /^gw\d+$/i.test(k) && votes[k] && typeof votes[k] === 'object')
      .filter(k => realGw > 0 ? gwNum(k) <= realGw : true);

    const acc = new Map();
    gwKeys.forEach(k => {
      const gw = votes[k];
      Object.keys(gw).forEach(pid => {
        const v = this._voto(gw[pid]);
        if (v === null) return;
        const fv = this._fantavoto(gw[pid]);
        const a = acc.get(pid) || { sumV: 0, sumF: 0, nF: 0, pres: 0 };
        a.sumV += v;
        a.pres += 1;
        if (fv !== null) { a.sumF += fv; a.nF += 1; }
        acc.set(pid, a);
      });
    });

    const out = new Map();
    acc.forEach((a, pid) => {
      out.set(pid, {
        mv: a.pres ? a.sumV / a.pres : null,
        fv: a.nF ? a.sumF / a.nF : null,
        pres: a.pres
      });
    });
    return out;
  }
};
