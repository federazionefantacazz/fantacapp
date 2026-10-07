/**
 * calendario-regular-season.js
 * Responsabilità: generazione del calendario regular season (round-robin),
 * sia per gironi singoli che multipli, con supporto andata/ritorno/tre-giri.
 */

import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { CalendarioState } from './calendario-state.js';

/**
 * Genera le giornate round-robin per una lista di squadre.
 * @param {string[]} lista - Array di ID squadre (già con eventuale "RIPOSO" aggiunto se dispari)
 * @param {number} giri - 1 = solo andata, 2 = andata/ritorno, 3 = tre giri
 * @returns {{ [gwKey: string]: { couples: { [matchKey: string]: object } } }}
 */
function generaRoundRobin(lista, giri) {
  const numSquadre = lista.length;
  const matchPerGiornata = numSquadre / 2;
  const turniUnici = numSquadre - 1;
  const totalGiornate = turniUnici * giri;
  const calendario = {};

  for (let g = 1; g <= totalGiornate; g++) {
    const gironeCorrente = Math.floor((g - 1) / turniUnici);
    const turnoNelGirone = (g - 1) % turniUnici;
    const inverti = (gironeCorrente === 1 || gironeCorrente === 3);

    const couples = {};
    let counter = 1;

    for (let m = 0; m < matchPerGiornata; m++) {
      const casaIdx = (turnoNelGirone + m) % (numSquadre - 1);
      const trasfIdx = m === 0
        ? numSquadre - 1
        : (numSquadre - 1 - m + turnoNelGirone) % (numSquadre - 1);

      let idCasa = lista[casaIdx];
      let idTrasf = lista[trasfIdx];

      if (idCasa === "RIPOSO" || idTrasf === "RIPOSO") continue;
      if (inverti) { [idCasa, idTrasf] = [idTrasf, idCasa]; }

      couples[`m${counter}`] = {
        id: `m${counter}`,
        homeId: idCasa,
        awayId: idTrasf,
        homeScore: null,
        awayScore: null,
        finished: false
      };
      counter++;
    }

    calendario[`gw${g}`] = { couples };
  }

  return calendario;
}

/* ─── Handler globale ─────────────────────────────────────────────────────── */

window.generateRandomCalendar = async function () {
  const compSelectEl = document.getElementById('calendarCompSelect');
  const targetCompId = compSelectEl ? compSelectEl.value : window.CURRENT_COMPETITION;
  if (!targetCompId) return window.toast?.("Seleziona una competizione!", "err");

  const comp = CalendarioState.getCompetizione(targetCompId);
  if (!comp) return window.toast?.("Competizione non trovata!", "err");

  const rotationType = document.getElementById('genRotationType').value;
  const giri = rotationType === 'tre-giri' ? 3 : rotationType === 'andata-ritorno' ? 2 : 1;
  const numGironiPrevisti = parseInt(comp.gironi) || 1;

  let calendarioCompleto = {};

  if ((comp.type === 'misto' || comp.type === 'misto-speciale') && numGironiPrevisti > 1) {
    // ── Modalità multi-girone ─────────────────────────────────────────────
    if (!comp.strutturaGironi) {
      return window.toast?.("Devi prima effettuare il sorteggio o comporre i gruppi manualmente!", "err");
    }

    const gironiIds = Object.keys(comp.strutturaGironi);
    let maxGiornateFase = 0;

    // Pre-calcolo struttura per ogni girone
    const agendeGironi = {};
    gironiIds.forEach(gId => {
      const lista = [...comp.strutturaGironi[gId]];
      if (lista.length % 2 !== 0) lista.push("RIPOSO");
      const turniUnici = lista.length - 1;
      const giornateTotali = turniUnici * giri;
      if (giornateTotali > maxGiornateFase) maxGiornateFase = giornateTotali;
      agendeGironi[gId] = { lista, turniUnici, giornateTotali };
    });

    // Generazione giornate sincronizzate tra gironi
    for (let g = 1; g <= maxGiornateFase; g++) {
      const couples = {};
      let matchCounter = 1;

      gironiIds.forEach(gId => {
        const { lista, turniUnici, giornateTotali } = agendeGironi[gId];
        if (g > giornateTotali) return;

        const numSquadre = lista.length;
        const matchPerGiornata = numSquadre / 2;
        const gironeCorrente = Math.floor((g - 1) / turniUnici);
        const turnoNelGirone = (g - 1) % turniUnici;
        const inverti = (gironeCorrente === 1 || gironeCorrente === 3);

        for (let m = 0; m < matchPerGiornata; m++) {
          const casaIdx = (turnoNelGirone + m) % (numSquadre - 1);
          const trasfIdx = m === 0
            ? numSquadre - 1
            : (numSquadre - 1 - m + turnoNelGirone) % (numSquadre - 1);

          let idCasa = lista[casaIdx];
          let idTrasf = lista[trasfIdx];

          if (idCasa === "RIPOSO" || idTrasf === "RIPOSO") continue;
          if (inverti) { [idCasa, idTrasf] = [idTrasf, idCasa]; }

          couples[`m${matchCounter}`] = {
            id: `m${matchCounter}`,
            girone: gId,
            homeId: idCasa,
            awayId: idTrasf,
            homeScore: null,
            awayScore: null,
            finished: false
          };
          matchCounter++;
        }
      });

      if (Object.keys(couples).length > 0) {
        calendarioCompleto[`gw${g}`] = { couples };
      }
    }

  } else {
    // ── Modalità girone unico / campionato ───────────────────────────────
    const squadreIscritte = CalendarioState.getTeamIdsCompetizione(comp);
    if (squadreIscritte.length < 2) {
      return window.toast?.("Servono almeno 2 squadre associate per generare il calendario!", "err");
    }

    const lista = [...squadreIscritte].sort(() => Math.random() - 0.5);
    if (lista.length % 2 !== 0) lista.push("RIPOSO");
    calendarioCompleto = generaRoundRobin(lista, giri);
  }

  try {
    const database = CalendarioState.db || getDatabase();
    await set(ref(database, `competitions/${targetCompId}/matches`), calendarioCompleto);
    await set(ref(database, `competitions/${targetCompId}/status`), { currentGW: 1 });
    window.toast?.("🎯 Calendario regular season salvato con successo!", "ok");
  } catch (err) {
    console.error(err);
    window.toast?.("Errore durante il salvataggio su Firebase", "err");
  }
};
