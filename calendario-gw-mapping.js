/**
 * calendario-gw-mapping.js
 * Responsabilità: lettura delle gwX generate su Firebase, costruzione e salvataggio
 * della struttura `associazioniGwReali` nella competizione.
 *
 * Struttura salvata su Firebase:
 *   competitions/<compId>/associazioniGwReali: {
 *     "1":  "gw1",
 *     "5":  "gw2",
 *     "12": "gw3",
 *     ...
 *     "34": "gw_playoff_1"
 *   }
 * La chiave è la giornata reale Serie A (1–38), il valore è la gwKey interna.
 */

import { getDatabase, ref, get, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { CalendarioState } from './calendario-state.js';
import { CalendarioUI } from './calendario-ui.js';

/* ─── Lettura gwKeys da Firebase e render del mapping ─────────────────────── */

/**
 * Carica le chiavi delle giornate generate per la competizione corrente
 * e popola il selettore UI. Chiamata ogni volta che cambia la competizione.
 */
window.caricaGwMapping = async function (compId) {
  if (!compId) return;

  const comp = CalendarioState.getCompetizione(compId);
  const database = CalendarioState.db || getDatabase();

  try {
    const matchesSnap = await get(ref(database, `competitions/${compId}/matches`));
    const matchesData = matchesSnap.exists() ? matchesSnap.val() : {};

    // Ordina: prima le gw normali (numericamente), poi i turni playoff
    const gwKeys = Object.keys(matchesData).sort((a, b) => {
      const aIsPlayoff = a.startsWith('gw_playoff_');
      const bIsPlayoff = b.startsWith('gw_playoff_');
      if (aIsPlayoff && !bIsPlayoff) return 1;
      if (!aIsPlayoff && bIsPlayoff) return -1;
      const numA = parseInt(a.replace('gw_playoff_', '').replace('gw', ''));
      const numB = parseInt(b.replace('gw_playoff_', '').replace('gw', ''));
      return numA - numB;
    });

    // Legge associazioni già salvate (se esistono)
    const saved = comp?.associazioniGwReali || null;

    CalendarioUI.renderGwMapping(gwKeys, saved);

  } catch (err) {
    console.error('Errore caricamento gwMapping:', err);
    CalendarioUI.renderGwMapping([], null);
  }
};

/* ─── Salvataggio ─────────────────────────────────────────────────────────── */

window.salvaAssociazioniGwReali = async function () {
  const compId = window.CURRENT_COMPETITION;
  if (!compId) return window.toast?.("Seleziona prima una competizione!", "err");

  const selectors = document.querySelectorAll('.gw-mapping-select');
  if (!selectors.length) return window.toast?.("Nessuna giornata da associare.", "err");

  const associazioni = {};
  const giornateRealiUsate = new Set();
  const gwSenzaAssegnazione = [];

  selectors.forEach(sel => {
    const gwKey = sel.getAttribute('data-gw');
    const reale = sel.value;

    if (!reale) {
      gwSenzaAssegnazione.push(gwKey);
      return;
    }

    if (giornateRealiUsate.has(reale)) {
      // Segnala duplicato ma non blocca — l'ultimo vince (l'utente è avvisato)
      window.toast?.(`⚠️ Giornata reale ${reale} assegnata più volte!`, "warn");
    }

    associazioni[reale] = gwKey;
    giornateRealiUsate.add(reale);
  });

  if (gwSenzaAssegnazione.length) {
    const nomi = gwSenzaAssegnazione.join(', ');
    if (!confirm(`Le seguenti giornate non sono state assegnate e verranno ignorate:\n${nomi}\n\nContinuare comunque?`)) return;
  }

  try {
    const database = CalendarioState.db || getDatabase();
    await update(ref(database, `competitions/${compId}`), { associazioniGwReali: associazioni });

    // Aggiorna la copia locale in memoria
    const comp = CalendarioState.getCompetizione(compId);
    if (comp) comp.associazioniGwReali = associazioni;

    window.toast?.(`✅ Associazioni salvate (${Object.keys(associazioni).length} giornate mappate)!`, "ok");

  } catch (err) {
    console.error(err);
    window.toast?.("Errore durante il salvataggio delle associazioni.", "err");
  }
};
