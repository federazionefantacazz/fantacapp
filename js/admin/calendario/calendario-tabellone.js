/**
 * calendario-tabellone.js
 * Responsabilità: costruzione dell'albero della fase finale (eliminazione diretta)
 * per i tipi di competizione "diretta", "misto" e "misto-speciale".
 * Include la trasformazione dell'albero in giornate reali su Firebase.
 */

import { getDatabase, ref, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { CalendarioState } from './calendario-state.js';
import { CalendarioUI } from './calendario-ui.js';

/* ─── Helpers costruzione albero ──────────────────────────────────────────── */

/**
 * Dato un numero di squadre, restituisce il nome della fase di partenza.
 */
function nomeFaseDaCount(count) {
  if (count <= 2) return "Finale";
  if (count <= 4) return "Semifinali";
  if (count <= 8) return "Quarti di Finale";
  return "Ottavi di Finale";
}

/**
 * Genera l'albero completo per una competizione a eliminazione diretta pura.
 */
function costruisciAlberoDiretta(squadreTabellone) {
  const strutturaFasi = {};
  const count = squadreTabellone.length;

  // Fase di partenza
  const matchPartenza = [];
  for (let i = 0; i < count; i += 2) {
    matchPartenza.push({
      id: `tf1_m${Math.floor(i / 2) + 1}`,
      homeId: squadreTabellone[i],
      awayId: i + 1 < count ? squadreTabellone[i + 1] : "BYE / RIPOSO"
    });
  }
  strutturaFasi["fase_1_diretta"] = { nomeFase: nomeFaseDaCount(count), matchList: matchPartenza };

  // Round successivi (segnaposto)
  let currentMatchCount = matchPartenza.length;
  let step = 2;
  while (currentMatchCount > 1) {
    const nextMatchCount = Math.ceil(currentMatchCount / 2);
    const nextMatches = [];
    for (let k = 1; k <= nextMatchCount; k++) {
      nextMatches.push({
        id: `tf${step}_m${k}`,
        homeId: `VINCENTE_tf${step - 1}_m${(k * 2) - 1}`,
        awayId: (k * 2) <= currentMatchCount ? `VINCENTE_tf${step - 1}_m${k * 2}` : "BYE"
      });
    }
    const nomi = { 4: "Quarti di Finale", 2: "Semifinali", 1: "Finale" };
    strutturaFasi[`fase_${step}_diretta`] = {
      nomeFase: nomi[nextMatchCount] || "Fase Successiva",
      matchList: nextMatches
    };
    currentMatchCount = nextMatchCount;
    step++;
  }

  return strutturaFasi;
}

/**
 * Genera l'albero per una competizione misto standard (4 gironi, 2 qualificate per girone → Quarti).
 */
function costruisciAlberoMisto(comp) {
  const numQualificatePerGirone = parseInt(comp.qualificatiFaseFinale) || 2;
  const gironiKeys = Object.keys(comp.strutturaGironi);

  if (numQualificatePerGirone !== 2 || gironiKeys.length !== 4) {
    throw new Error("Questa automazione supporta il formato standard: 4 gironi con 2 qualificate ciascuno (Totale 8 squadre per i Quarti)!");
  }

  const primeClassificate = [];
  const secondeClassificate = [];
  gironiKeys.forEach(gKey => {
    const sqGirone = comp.strutturaGironi[gKey] || [];
    if (sqGirone.length >= 2) {
      primeClassificate.push({ id: sqGirone[0], girone: gKey });
      secondeClassificate.push({ id: sqGirone[1], girone: gKey });
    }
  });

  // Accoppiamento Quarti: Prime vs Seconde senza ripetere lo stesso girone
  const matchQuarti = [];
  const secondeUsate = new Set();

  for (let i = 0; i < primeClassificate.length; i++) {
    const prima = primeClassificate[i];
    let abbinata = secondeClassificate.find(s => !secondeUsate.has(s.id) && s.girone !== prima.girone);

    // Fallback: ignora il vincolo di girone se non trovata
    if (!abbinata) {
      abbinata = secondeClassificate.find(s => !secondeUsate.has(s.id));
    }

    if (abbinata) {
      matchQuarti.push({
        id: `qf_m${i + 1}`,
        gironeProvenienza: abbinata.girone !== prima.girone
          ? `${prima.girone} vs ${abbinata.girone}`
          : "Incrocio Forzato",
        homeId: prima.id,
        awayId: abbinata.id
      });
      secondeUsate.add(abbinata.id);
    }
  }

  return {
    fase_1_quarti: { nomeFase: "Quarti di Finale", matchList: matchQuarti },
    fase_2_semifinali: {
      nomeFase: "Semifinali",
      matchList: [
        { id: "sf_m1", homeId: "VINCENTE_qf_m1", awayId: "VINCENTE_qf_m2" },
        { id: "sf_m2", homeId: "VINCENTE_qf_m3", awayId: "VINCENTE_qf_m4" }
      ]
    },
    fase_3_finale: {
      nomeFase: "Finalissima",
      matchList: [{ id: "fn_m1", homeId: "VINCENTE_sf_m1", awayId: "VINCENTE_sf_m2" }]
    }
  };
}

/**
 * Genera l'albero per una competizione misto-speciale (playoff 7-10, quarti 1-6).
 */
function costruisciAlberoMistoSpeciale(totalTeams) {
  if (totalTeams.length < 10) {
    throw new Error("Il Misto Speciale richiede la presenza di almeno 10/12 squadre posizionate!");
  }

  const pos = [...totalTeams];

  return {
    fase_1_playoff: {
      nomeFase: "Playoff Preliminari",
      matchList: [
        { id: "po_m1", homeId: pos[6] || "7° Classificato", awayId: pos[9] || "10° Classificato" },
        { id: "po_m2", homeId: pos[7] || "8° Classificato", awayId: pos[8] || "9° Classificato" }
      ]
    },
    fase_2_quarti: {
      nomeFase: "Quarti di Finale",
      matchList: [
        { id: "qf_m1", homeId: pos[0] || "1° Classificato", awayId: "VINCENTE_po_m2" },
        { id: "qf_m2", homeId: pos[1] || "2° Classificato", awayId: "VINCENTE_po_m1" },
        { id: "qf_m3", homeId: pos[2] || "3° Classificato", awayId: pos[5] || "6° Classificato" },
        { id: "qf_m4", homeId: pos[3] || "4° Classificato", awayId: pos[4] || "5° Classificato" }
      ]
    },
    fase_3_semifinali: {
      nomeFase: "Semifinali",
      matchList: [
        { id: "sf_m1", homeId: "VINCENTE_qf_m1", awayId: "VINCENTE_qf_m4" },
        { id: "sf_m2", homeId: "VINCENTE_qf_m2", awayId: "VINCENTE_qf_m3" }
      ]
    },
    fase_4_finale: {
      nomeFase: "Finalissima",
      matchList: [{ id: "fn_m1", homeId: "VINCENTE_sf_m1", awayId: "VINCENTE_sf_m2" }]
    }
  };
}

/**
 * Trasforma l'albero delle fasi in giornate reali di Firebase (`matches`).
 */
function costruisciMatchDaAlbero(strutturaAlberofasi, playoffMode) {
  const matchesFaseFinaleNode = {};
  let globalGwCounter = 1;

  const chiaviFasiOrdinate = Object.keys(strutturaAlberofasi).sort();

  chiaviFasiOrdinate.forEach(chiaveFase => {
    const fase = strutturaAlberofasi[chiaveFase];
    const nomeLower = fase.nomeFase.toLowerCase();
    const isFinaleSecca = nomeLower.includes("finale") && !nomeLower.includes("quarti") && !nomeLower.includes("semi");

    // Turno Andata (o Gara Secca)
    const couplesAndata = {};
    fase.matchList.forEach(m => {
      couplesAndata[`match_a_${m.id}`] = {
        id: `match_a_${m.id}`,
        phaseKey: chiaveFase,
        phaseName: fase.nomeFase,
        type: isFinaleSecca ? "FINALE" : "ELIMINAZIONE_DIRETTA",
        homeId: m.homeId,
        awayId: m.awayId,
        homeScore: null,
        awayScore: null,
        finished: false,
        label: `${fase.nomeFase} - Andata`
      };
    });
    matchesFaseFinaleNode[`gw_playoff_${globalGwCounter}`] = { couples: couplesAndata };
    globalGwCounter++;

    // Turno Ritorno (se richiesto e non è la finalissima)
    if (playoffMode === 'andata-ritorno' && !isFinaleSecca) {
      const couplesRitorno = {};
      fase.matchList.forEach(m => {
        couplesRitorno[`match_r_${m.id}`] = {
          id: `match_r_${m.id}`,
          phaseKey: chiaveFase,
          phaseName: fase.nomeFase,
          type: "ELIMINAZIONE_DIRETTA_RITORNO",
          homeId: m.awayId, // Campi invertiti per il ritorno
          awayId: m.homeId,
          homeScore: null,
          awayScore: null,
          finished: false,
          label: `${fase.nomeFase} - Ritorno`
        };
      });
      matchesFaseFinaleNode[`gw_playoff_${globalGwCounter}`] = { couples: couplesRitorno };
      globalGwCounter++;
    }
  });

  return matchesFaseFinaleNode;
}

/* ─── Handler globale ─────────────────────────────────────────────────────── */

window.creaTabelloneFaseFinale = async function () {
  const targetCompId = window.CURRENT_COMPETITION;
  const comp = CalendarioState.getCompetizione(targetCompId);
  if (!comp) return window.toast?.("Seleziona una competizione valida!", "err");

  if (comp.type === 'campionato') {
    return window.toast?.("Impossibile creare un tabellone per una competizione di tipo Campionato standard!", "err");
  }

  const playoffMode = document.getElementById('playoffRotationType').value;
  const totalTeams = CalendarioState.getTeamIdsCompetizione(comp);

  let strutturaAlberofasi = {};

  try {
    if (comp.type === 'diretta') {
      if (totalTeams.length < 2) return window.toast?.("Servono almeno 2 squadre per creare una diretta!", "err");
      if (!confirm(`Generare un tabellone ad eliminazione diretta pura per ${totalTeams.length} squadre?`)) return;
      const squadreMischiate = [...totalTeams].sort(() => Math.random() - 0.5);
      strutturaAlberofasi = costruisciAlberoDiretta(squadreMischiate);

    } else if (comp.type === 'misto') {
      if (!comp.strutturaGironi) return window.toast?.("Devi prima generare e completare i gironi della Regular Season!", "err");
      if (!confirm("Generare il Tabellone dei Quarti accoppiando Prime contro Seconde (evitando squadre dello stesso girone)?")) return;
      strutturaAlberofasi = costruisciAlberoMisto(comp);

    } else if (comp.type === 'misto-speciale') {
      if (!confirm("Generare il Tabellone con le regole speciali (Playoff per posizioni 7-10, Quarti di finale per 1-6)?")) return;
      strutturaAlberofasi = costruisciAlberoMistoSpeciale(totalTeams);
    }

    const matchesFaseFinaleNode = costruisciMatchDaAlbero(strutturaAlberofasi, playoffMode);

    const database = CalendarioState.db || getDatabase();
    await update(ref(database, `competitions/${targetCompId}`), {
      tabelloneStructure: {
        tipoGenerato: comp.type,
        regolaIncontri: playoffMode,
        fasi: strutturaAlberofasi
      }
    });
    await update(ref(database, `competitions/${targetCompId}/matches`), matchesFaseFinaleNode);

    window.toast?.("🏆 Tabellone e Turni ad eliminazione salvati con successo!", "ok");

    comp.tabelloneStructure = { fasi: strutturaAlberofasi };
    CalendarioUI.updateBadgeDinamici(targetCompId);

  } catch (err) {
    console.error(err);
    window.toast?.(err.message || "Errore durante la creazione del Tabellone", "err");
  }
};
