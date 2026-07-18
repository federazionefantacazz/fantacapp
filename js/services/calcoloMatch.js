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
  gol_subito: -1
};

export const CalcoloMatchService = {
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
   * Calcola il punteggio totale di una lineup (titolari o panchina)
   * @param {Object} allLineups - L'intero nodo lineups della giornata
   * @param {String|Number} targetTeamId - L'ID della squadra (es: "1" o 1)
   * @param {Object} mappaFantavotiLocali - I fantavoti calcolati della giornata
   * @returns {Number} Somma totale dei fantavoti
   */
  calcolaTotaleSquadra(allLineups, targetTeamId, mappaFantavotiLocali) {
    if (!allLineups) return 0;

    // 1. Cerchiamo il nodo della squadra controllando sia la chiave diretta sia la proprietà teamId interna
    let squadData = allLineups[targetTeamId];

    // Se non lo trova direttamente tramite la chiave, fa una ricerca interna tra tutte le chiavi presenti
    if (!squadData) {
      const keys = Object.keys(allLineups);
      const foundKey = keys.find(k => allLineups[k] && String(allLineups[k].teamId) === String(targetTeamId));
      if (foundKey) {
        squadData = allLineups[foundKey];
      }
    }

    if (!squadData) return 0; // Squadra non trovata o formazione non inserita

    // 2. Recuperiamo l'array dei titolari (o panchina come fallback)
    const giocatori = squadData.titolari || squadData.panchina || null;
    if (!giocatori || !Array.isArray(giocatori)) return 0;

    let totale = 0;

    // 3. Cicliamo l'array lineare dei giocatori (es: ["6966", "4159", ...])
    giocatori.forEach(pId => {
      if (pId && mappaFantavotiLocali[pId] !== undefined) {
        totale += mappaFantavotiLocali[pId];
      }
    });

    return totale;
  }
};
