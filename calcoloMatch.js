/**
 * Servizio di calcolo condiviso per i voti e bonus/malus del Fantacalcio.
 * Può essere importato sia lato Admin che lato Index (User).
 */

// Regole di calcolo centralizzate nel codice JavaScript
export const RULE_MATCH = {
  gol: 3,
  assist: 1,
  ammonizione: -0.5,
  espulsione: -1,
  autogol: -2,
  rigore_parato: 3,
  rigore_sbagliato: -3,
  rigore_segnato: 2,
  gol_subito: -1,
  porta_inviolata: 1
};

// Emoji da mostrare nel live in base al tipo di bonus/malus registrato.
// Usata da liveMatch.js per costruire la stringa di icone accanto al voto.
export const EMOJI_BONUS = {
  gol: "⚽",
  assist: "🅰️",
  ammonizione: "🟨",
  espulsione: "🟥",
  autogol: "⚫",
  rigore_parato: "🧤",
  rigore_sbagliato: "❌",
  rigore_segnato: "🎯",
  gol_subito: "🥅",
  porta_inviolata: "🛡️"
};

export const CalcoloMatchService = {
  /**
   * Costruisce la stringa di emoji da mostrare nel live a partire
   * dall'oggetto bonus (es: {gol: 2, ammonizione: 1} -> "⚽⚽🟨").
   * @param {Object} bonus - conteggio bonus/malus, es. {gol: 1, assist: 1}
   * @returns {String} emoji concatenate, stringa vuota se nessun bonus
   */
  emojiFromBonus(bonus) {
    if (!bonus) return "";
    let out = "";
    Object.keys(EMOJI_BONUS).forEach(evento => {
      const quantita = parseInt(bonus[evento]) || 0;
      out += EMOJI_BONUS[evento].repeat(quantita);
    });
    return out;
  },

  /**
   * Calcola dinamicamente il Fantavoto di un singolo giocatore.
   * @param {Object} datiVoto - L'oggetto contenente il voto base e i vari eventi (es: {voto: 6, gol: 1, ammonizione: 1})
   * @returns {Number} Il fantavoto totale calcolato comprensivo di bonus/malus
   */
  calcolaFantavoto(datiVoto) {
    if (!datiVoto || datiVoto.voto === undefined || datiVoto.voto === null) {
      return 0;
    }

    const votoBase = parseFloat(datiVoto.voto) || 0;
    let totaleBonusMalus = 0;

    // Scansiona i modificatori dall'oggetto RULE_MATCH
    Object.keys(RULE_MATCH).forEach(evento => {
      if (datiVoto[evento]) {
        const quantitaEvento = parseInt(datiVoto[evento]) || 0;
        const valoreMoltiplicatore = parseFloat(RULE_MATCH[evento]) || 0;
        totaleBonusMalus += (quantitaEvento * valoreMoltiplicatore);
      }
    });

    // Ritorna la somma algebrica finale
    return votoBase + totaleBonusMalus;
  },

  /**
   * Calcola i gol totali basandosi sulle soglie (66 = 1 gol, +6 per ogni gol successivo)
   * @param {Number} punteggio - Il totale della fantasquadra
   * @returns {Number} Numero di gol segnati
   */
  calcolaGol(punteggio) {
    if (!punteggio || punteggio < 66) return 0;
    return Math.floor((punteggio - 66) / 6) + 1;
  },

  /**
   * Un giocatore "ha il voto" solo se ha un voto base numerico > 0.
   * Voto mancante, vuoto o 0 = s.v. (senza voto): per la formazione è la stessa cosa.
   */
  hasVoto(datiVoto) {
    if (!datiVoto || typeof datiVoto !== 'object') return false;
    if (datiVoto.voto === undefined || datiVoto.voto === null || datiVoto.voto === '') return false;
    const n = parseFloat(datiVoto.voto);
    return Number.isFinite(n) && n > 0;
  },

  /**
   * Applica le sostituzioni dalla panchina.
   * Ogni titolare senza voto viene rimpiazzato dal primo panchinaro DELLO STESSO RUOLO
   * (nell'ordine in cui è schierato in panchina) che abbia il voto e non sia già entrato.
   * Se non c'è nessun panchinaro disponibile per quel ruolo, il titolare resta senza punteggio.
   *
   * @param {Array} titolari   id dei titolari
   * @param {Array} panchina   id dei panchinari (in ordine di priorità)
   * @param {Function} getRole  id -> 'P'|'D'|'C'|'A'
   * @param {Function} getScore id -> numero (fantavoto) oppure null se s.v.
   * @returns {{ slots: Array, sostituzioni: Array, totale: number }}
   *   slots: un elemento per titolare { id, score, entratoPer?, senzaVoto? }
   */
  applicaSostituzioni(titolari, panchina, getRole, getScore) {
    const usati = new Set();
    const sostituzioni = [];
    const slots = [];

    (titolari || []).forEach(id => {
      const score = getScore(id);
      if (score !== null && score !== undefined) {
        slots.push({ id, score });
        return;
      }
      const role = getRole(id);
      const sub = role
        ? (panchina || []).find(b =>
            b && !usati.has(String(b)) &&
            getRole(b) === role &&
            getScore(b) !== null && getScore(b) !== undefined)
        : null;

      if (sub) {
        usati.add(String(sub));
        sostituzioni.push({ out: id, in: sub });
        slots.push({ id: sub, score: getScore(sub), entratoPer: id });
      } else {
        slots.push({ id, score: null, senzaVoto: true });
      }
    });

    const totale = slots.reduce((acc, sl) => acc + (sl.score || 0), 0);
    return { slots, sostituzioni, totale };
  },

  /**
   * Calcola il punteggio totale di una squadra per una giornata, comprese le sostituzioni.
   * @param {Object} allLineups - L'intero nodo lineups della giornata
   * @param {String|Number} targetTeamId - L'ID della squadra (es: "1" o 1)
   * @param {Object} mappaFantavotiLocali - { playerId: fantavoto } dei SOLI giocatori con voto
   * @param {Object} [ruoliGiocatori] - { playerId: 'P'|'D'|'C'|'A' }. Se omesso non ci sono sostituzioni.
   * @returns {Number} Somma totale dei fantavoti
   */
  calcolaTotaleSquadra(allLineups, targetTeamId, mappaFantavotiLocali, ruoliGiocatori = null) {
    return this.calcolaDettaglioSquadra(allLineups, targetTeamId, mappaFantavotiLocali, ruoliGiocatori).totale;
  },

  /** Come calcolaTotaleSquadra ma restituisce anche slot e sostituzioni. */
  calcolaDettaglioSquadra(allLineups, targetTeamId, mappaFantavotiLocali, ruoliGiocatori = null) {
    const vuoto = { totale: 0, slots: [], sostituzioni: [] };
    if (!allLineups) return vuoto;

    // 1. Cerchiamo il nodo della squadra controllando sia la chiave diretta sia la proprietà teamId interna
    let squadData = allLineups[targetTeamId];
    if (!squadData) {
      const foundKey = Object.keys(allLineups).find(k => allLineups[k] && String(allLineups[k].teamId) === String(targetTeamId));
      if (foundKey) squadData = allLineups[foundKey];
    }
    if (!squadData) return vuoto; // Squadra non trovata o formazione non inserita

    const titolari = squadData.titolari || squadData.panchina || null;
    if (!titolari || !Array.isArray(titolari)) return vuoto;

    const getScore = (id) => {
      const v = mappaFantavotiLocali ? mappaFantavotiLocali[id] : undefined;
      return v === undefined || v === null || Number.isNaN(Number(v)) ? null : Number(v);
    };

    // Senza mappa dei ruoli (o senza panchina) non si possono fare sostituzioni
    const panchina = Array.isArray(squadData.panchina) && squadData.titolari ? squadData.panchina : [];
    const getRole = (id) => (ruoliGiocatori ? ruoliGiocatori[id] : undefined);

    return this.applicaSostituzioni(titolari, ruoliGiocatori ? panchina : [], getRole, getScore);
  }
};
