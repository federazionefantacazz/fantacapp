/**
 * calendario-gironi.js
 * Responsabilità: sorteggio automatico e modifica manuale dei gironi.
 */

import { getDatabase, ref, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { CalendarioState } from './calendario-state.js';
import { CalendarioUI } from './calendario-ui.js';

/* ─── Sorteggio automatico gironi ─────────────────────────────────────────── */

window.sorteggiaGironiCompetizione = async function () {
  const targetCompId = window.CURRENT_COMPETITION;
  const comp = CalendarioState.getCompetizione(targetCompId);
  if (!comp) return window.toast?.("Seleziona una competizione!", "err");

  const squadreIscritte = CalendarioState.getTeamIdsCompetizione(comp);
  const numGironi = parseInt(comp.gironi) || 1;

  if (numGironi <= 1) return window.toast?.("Questa competizione non prevede gironi multipli!", "err");
  if (squadreIscritte.length < numGironi) return window.toast?.("Squadre insufficienti per riempire i gironi!", "err");
  if (!confirm(`Effettuare un nuovo sorteggio randomico per i ${numGironi} gironi? Verrà sovrascritta la struttura attuale.`)) return;

  const mixTeams = [...squadreIscritte].sort(() => Math.random() - 0.5);
  const strutturaGironi = {};
  for (let idx = 1; idx <= numGironi; idx++) {
    strutturaGironi[`Girone ${idx}`] = [];
  }
  mixTeams.forEach((teamId, index) => {
    strutturaGironi[`Girone ${(index % numGironi) + 1}`].push(teamId);
  });

  try {
    const database = CalendarioState.db || getDatabase();
    await update(ref(database, `competitions/${targetCompId}`), { strutturaGironi });
    window.toast?.("🎲 Sorteggio gironi effettuato!", "ok");
    comp.strutturaGironi = strutturaGironi;
    CalendarioState.isEditingManually = false;
    CalendarioUI.updateBadgeDinamici(targetCompId);
  } catch (err) {
    console.error(err);
    window.toast?.("Errore durante il sorteggio", "err");
  }
};

/* ─── Modifica manuale gironi ─────────────────────────────────────────────── */

window.attivaModificaManualeGironi = function () {
  CalendarioState.isEditingManually = true;
  CalendarioUI.updateBadgeDinamici(window.CURRENT_COMPETITION);
};

window.annullaModificaManualeGironi = function () {
  CalendarioState.isEditingManually = false;
  CalendarioUI.updateBadgeDinamici(window.CURRENT_COMPETITION);
};

window.salvaModificheGironiManuali = async function () {
  const targetCompId = window.CURRENT_COMPETITION;
  const comp = CalendarioState.getCompetizione(targetCompId);
  if (!comp) return;

  const selectors = document.querySelectorAll('.class-manual-team-slot');
  const nuovaStruttura = JSON.parse(JSON.stringify(comp.strutturaGironi));
  const allSelectedIds = [];

  selectors.forEach(sel => {
    const gironeKey = sel.getAttribute('data-girone');
    const slotIndex = parseInt(sel.getAttribute('data-slot'));
    const chosenValue = sel.value;
    nuovaStruttura[gironeKey][slotIndex] = chosenValue;
    allSelectedIds.push(chosenValue);
  });

  const haDuplicati = allSelectedIds.some((val, i) => allSelectedIds.indexOf(val) !== i);
  if (haDuplicati) return window.toast?.("Errore: Ci sono squadre duplicate nei gironi!", "err");
  if (!confirm("Vuoi salvare la composizione manuale dei gruppi su Firebase?")) return;

  try {
    const database = CalendarioState.db || getDatabase();
    await update(ref(database, `competitions/${targetCompId}`), { strutturaGironi: nuovaStruttura });
    window.toast?.("💾 Gironi personalizzati salvati con successo!", "ok");
    comp.strutturaGironi = nuovaStruttura;
    CalendarioState.isEditingManually = false;
    CalendarioUI.updateBadgeDinamici(targetCompId);
  } catch (err) {
    console.error(err);
    window.toast?.("Errore durante il salvataggio manuale dei gruppi", "err");
  }
};
