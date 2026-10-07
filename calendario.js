/**
 * calendario.js  ← Entry point del modulo (questo è il file referenziato da index.html)
 *
 * Responsabilità: inizializzazione, esposizione dell'oggetto CalendarioSection
 * (compatibilità con il resto dell'app) e registrazione del gestore selezione competizione.
 *
 * Struttura del modulo:
 *   calendario.js              ← questo file (entry point)
 *   calendario-state.js        ← stato condiviso (db, squadre, competizioni)
 *   calendario-ui.js           ← HTML template + rendering badge/gironi/albero
 *   calendario-gironi.js       ← sorteggio + modifica manuale gironi
 *   calendario-regular-season.js ← generazione calendario regular season
 *   calendario-tabellone.js    ← generazione tabellone fase finale
 */

import { CalendarioState } from './calendario-state.js';
import { CalendarioUI } from './calendario-ui.js';

// Side-effect imports: registrano le funzioni window.* necessarie
import './calendario-gironi.js';
import './calendario-regular-season.js';
import './calendario-tabellone.js';
import './calendario-gw-mapping.js';

/**
 * CalendarioSection è l'interfaccia pubblica che il resto dell'applicazione
 * già conosce (es. l'index chiama CalendarioSection.init() e CalendarioSection.render()).
 * Deleghiamo internamente a State e UI.
 */
export const CalendarioSection = {

  init(database) {
    CalendarioState.init(database);
  },

  renderHTML() {
    return CalendarioUI.renderHTML();
  },

  render(state) {
    CalendarioState.setData(state);
    CalendarioUI.renderSelectCompetizioni(CalendarioState.getCompetizioniList());
    if (window.CURRENT_COMPETITION) {
      window.caricaGwMapping(window.CURRENT_COMPETITION);
    }
  }
};

/* ─── Cambio competizione selezionata ─────────────────────────────────────── */

window.changeCalendarTargetComp = function (compId) {
  window.CURRENT_COMPETITION = compId;
  CalendarioState.isEditingManually = false;
  CalendarioUI.updateBadgeDinamici(compId);
  window.caricaGwMapping(compId);
  window.toast?.(`Configurazione orientata su: ${compId.toUpperCase()}`, "info");
};
