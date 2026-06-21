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
  }
};
