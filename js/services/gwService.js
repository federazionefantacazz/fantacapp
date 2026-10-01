/**
 * gwService.js
 * Unico punto in cui si traduce "giornata di Serie A corrente" -> "giornata della competizione"
 * e si stabilisce se una squadra può schierare la formazione / ha un incontro in quella giornata.
 *
 * Struttura salvata su Firebase (competitions/<id>/associazioniGwReali):
 *   { "1": "gw1", "7": "gw2", ... }   chiave = giornata Serie A, valore = gwKey della competizione
 * Per robustezza viene gestita anche la mappa invertita ({ "gw2": "7" }).
 */
import { ClassificaService } from './classificaService.js';

const digits = (v) => String(v ?? '').replace(/\D/g, '');
const same = (a, b) => a !== null && a !== undefined && b !== null && b !== undefined && String(a) === String(b);
const isBye = (id) => /BYE|RIPOSO/i.test(String(id ?? ''));
const isKnockoutCouple = (c) => /^(ELIMINAZIONE|FINALE)/i.test(String(c?.type || '')) || !!c?.phaseKey;
const gwNumber = (gwKey) => parseInt(digits(gwKey)) || 0;

function coupleOrder(a, b) {
  const na = parseInt((String(a.key).match(/m(\d+)/) || [])[1]);
  const nb = parseInt((String(b.key).match(/m(\d+)/) || [])[1]);
  if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
  return String(a.key).localeCompare(String(b.key), undefined, { numeric: true });
}

export const GwService = {
  /** Giornata Serie A corrente impostata dall'admin (status/currentRealGW). */
  getGwReale(STATE) {
    const v = STATE?.giornataRealeCorrente ?? STATE?.status?.giornataReale ?? null;
    return v === null || v === undefined || v === '' ? null : Number(v);
  },

  /** Ritorna la gwKey della competizione (es. "gw2") per la giornata Serie A data, o null. */
  getGwKey(compData, gwReale) {
    if (!compData || gwReale === null || gwReale === undefined) return null;
    const map = compData.associazioniGwReali || compData.associazioniGwRealiMap || {};
    const target = digits(gwReale);
    if (!target) return null;

    for (const [k, v] of Object.entries(map)) {
      const kIsGw = String(k).startsWith('gw');
      const vIsGw = String(v).startsWith('gw');
      if (!kIsGw && vIsGw && digits(k) === target) return String(v);   // { "7": "gw2" }
      if (kIsGw && !vIsGw && digits(v) === target) return String(k);   // { "gw2": "7" }
    }
    return null;
  },

  /** Etichetta leggibile: "gw2" -> "Giornata 2", "gw_playoff_1" -> "Turno Playoff 1". */
  label(gwKey) {
    if (!gwKey) return '';
    if (String(gwKey).startsWith('gw_playoff_')) return `Turno Playoff ${digits(gwKey)}`;
    return `Giornata ${digits(gwKey)}`;
  },

  /** Mappa dei vincitori risolti del tabellone ({ "VINCENTE_qf_m1": "teamId" }). */
  getWinners(compData) {
    try {
      const r = ClassificaService.risolviVincitoriTabellone(compData?.tabelloneStructure, compData?.matches || {});
      return r?.resolvedWinners || {};
    } catch (e) {
      return {};
    }
  },

  /** Incontri di una giornata, ordinati, con i segnaposto VINCENTE_ già risolti. */
  getCouples(compData, gwKey, winners = null) {
    if (!compData || !gwKey) return [];
    const w = winners || this.getWinners(compData);
    const node = compData.matches?.[gwKey]?.couples || {};
    const list = Array.isArray(node) ? node.map((c, i) => ({ c, key: String(i) })) : Object.entries(node).map(([key, c]) => ({ c, key }));
    return list
      .filter(x => x.c)
      .map(({ c, key }) => ({
        ...c,
        key,
        id: c.id || key,
        homeId: w[c.homeId] || c.homeId,
        awayId: w[c.awayId] || c.awayId
      }))
      .sort(coupleOrder);
  },

  /**
   * Stabilisce se `teamId` ha un incontro nella giornata Serie A corrente per quella competizione.
   * code: ok | unmapped | no_matches | not_in_comp | bye | eliminated | not_qualified | pending
   */
  getTeamStatus(compData, gwReale, teamId) {
    const out = (code, reason, extra = {}) => ({ canPlay: code === 'ok', code, reason, gwKey: null, couple: null, ...extra });
    if (!compData) return out('not_in_comp', 'Competizione non trovata.');

    const gwKey = this.getGwKey(compData, gwReale);
    if (!gwKey) {
      return out('unmapped', `Nessuna giornata di "${compData.name || 'questa competizione'}" è associata alla giornata ${gwReale ?? '?'} di Serie A.`);
    }

    const winners = this.getWinners(compData);
    const couples = this.getCouples(compData, gwKey, winners);
    const mine = couples.find(c => same(c.homeId, teamId) || same(c.awayId, teamId));

    if (mine) {
      if (isBye(mine.homeId) || isBye(mine.awayId)) {
        return out('bye', 'Questa giornata riposi (turno di bye).', { gwKey });
      }
      return { canPlay: true, code: 'ok', reason: null, gwKey, couple: mine };
    }

    if (couples.length === 0) {
      return out('no_matches', 'Non ci sono incontri in calendario per questa giornata.', { gwKey });
    }

    // Partecipa alla competizione?
    const rawTeams = compData.teams ? (Array.isArray(compData.teams) ? compData.teams : Object.values(compData.teams)) : [];
    const inTeams = rawTeams.some(id => same(id, teamId));
    const allGw = Object.keys(compData.matches || {});
    const everPlays = allGw.some(k => this.getCouples(compData, k, winners).some(c => same(c.homeId, teamId) || same(c.awayId, teamId)));
    if (!inTeams && !everPlays) {
      return out('not_in_comp', 'La tua squadra non partecipa a questa competizione.', { gwKey });
    }

    // Fase a eliminazione diretta: eliminato / non qualificato / in attesa
    if (couples.some(isKnockoutCouple)) {
      const earlier = [];
      allGw.forEach(k => {
        if (gwNumber(k) >= gwNumber(gwKey)) return;
        this.getCouples(compData, k, winners).forEach(c => {
          if (isKnockoutCouple(c) && (same(c.homeId, teamId) || same(c.awayId, teamId))) earlier.push({ ...c, gwN: gwNumber(k) });
        });
      });

      if (earlier.length === 0) {
        return out('not_qualified', 'Non ti sei qualificato a questa fase della competizione.', { gwKey });
      }

      earlier.sort((a, b) => a.gwN - b.gwN);
      const last = earlier[earlier.length - 1];
      const baseId = String(last.id).replace(/_ritorno$/, '');
      const winner = winners[`VINCENTE_${baseId}`];

      if (winner && !same(winner, teamId)) {
        return out('eliminated', `Sei stato eliminato dalla competizione${last.phaseName ? ` (${last.phaseName})` : ''}.`, { gwKey });
      }
      return out('pending', 'Il tuo turno precedente non è ancora concluso: il tuo prossimo incontro non è ancora definito.', { gwKey });
    }

    // Campionato / girone: assente dagli incontri = riposo
    return out('bye', 'Questa giornata riposi (numero dispari di squadre).', { gwKey });
  }
};
