/**
 * gwService.js
 * Unico punto in cui si traduce "giornata di Serie A corrente" -> "giornata della competizione".
 *
 * Struttura salvata su Firebase (competitions/<id>/associazioniGwReali):
 *   { "1": "gw1", "7": "gw2", ... }   chiave = giornata Serie A, valore = gwKey della competizione
 * Per robustezza viene gestita anche la mappa invertita ({ "gw2": "7" }).
 */
const digits = (v) => String(v ?? '').replace(/\D/g, '');

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
  }
};
