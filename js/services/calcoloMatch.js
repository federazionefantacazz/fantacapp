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
   * @param {Object} nodoLineup - Il nodo della formazione (es: lineup[teamId])
   * @param {Object} mappaFantavotiLocali - I fantavoti calcolati della giornata
   * @returns {Number} Somma totale dei fantavoti
   */
  calcolaTotaleSquadra(nodoLineup, mappaFantavotiLocali) {
    if (!nodoLineup) return 0;
    
    // Fallback: se mancano i titolari, controlla in panchina
    const giocatori = nodoLineup.titolari || nodoLineup.panchina || {};
    if (typeof giocatori !== 'object') return 0;
    
    let totale = 0;
    Object.keys(giocatori).forEach(pId => {
      if (mappaFantavotiLocali[pId] !== undefined) {
        totale += mappaFantavotiLocali[pId];
      }
    });
    return totale;
  }
};
