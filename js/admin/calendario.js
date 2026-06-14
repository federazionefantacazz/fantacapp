import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

export const CalendarioSection = {
  db: null,

  // Inizializzatore opzionale se si vuole passare l'istanza del DB dall'esterno
  init(database) {
    this.db = database;
  },

  renderHTML() {
    return `
    <div id="sec-calendar-gen" class="admin-sec" style="display:none;">
      <div class="sec-title">🗓️ Generatore Calendario Automatico</div>
      
      <div class="card" style="max-width: 600px;">
        <div style="margin-bottom: 1rem; padding: .8rem; background: rgba(80, 227, 194, 0.1); border-left: 4px solid var(--accent); border-radius: 4px;">
          <span style="font-size: .85rem; color: var(--text);">
            Seleziona la competizione target nella tendina sottostante per generare e sovrascrivere i relativi turni di gioco.
          </span>
        </div>

        <label class="label" style="color: var(--accent);">1. Seleziona Competizione</label>
        <select id="calendarCompSelect" class="input-login" onchange="window.changeCalendarTargetComp(this.value)">
          <option value="">Caricamento competizioni...</option>
        </select>

        <label class="label" style="color: var(--accent); margin-top: .5rem;">2. Configura Parametri</label>
        <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem;">
          <div style="flex: 1;">
            <label class="label">Numero Giornate totali</label>
            <input type="number" id="genTotalGws" class="input-login" value="33" min="1" max="38" style="margin-bottom:0; background: var(--bg3); border: 1px solid var(--border); color:#fff; padding:.5rem; border-radius:6px; width:100%;">
          </div>
          <div style="flex: 1;">
            <label class="label">Tipo di Turno</label>
            <select id="genRotationType" style="width:100%; background:var(--bg3); border:1px solid var(--border); border-radius:6px; color:#fff; padding:.6rem; font-size:.85rem;">
              <option value="andata-ritorno">Andata e Ritorno continui</option>
              <option value="solo-andata">Solo Andata (fino a esaurimento)</option>
            </select>
          </div>
        </div>

        <button class="btn btn-green" onclick="window.generateRandomCalendar()">⚡ Genera & Salva su Firebase</button>
      </div>

      <div class="card">
        <div class="label">Anteprima delle squadre che parteciperanno:</div>
        <div id="genTeamsPreview" style="display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .5rem; font-size: .85rem; color: var(--text2);"></div>
      </div>
    </div>`;
  },

  render(state) {
    const { TEAMS, competitions } = state;
    
    // Per sicurezza locale se non inizializzato con init()
    if (!this.db && window.fapp) {
      this.db = getDatabase(window.fapp);
    }

    // Cache locale temporanea dei dati dello stato per l'algoritmo globale
    this._currentTeams = TEAMS || [];

    // 1. Renderizzazione Anteprima delle squadre
    const container = document.getElementById('genTeamsPreview');
    if (container) {
      if (this._currentTeams.length === 0) {
        container.innerHTML = '❌ Nessuna squadra trovata. Crea prima le squadre dal pannello.';
      } else {
        container.innerHTML = this._currentTeams.map(t => `
          <span style="background:var(--bg2); padding:.4rem .6rem; border-radius:4px; border:1px solid var(--border); display:inline-flex; align-items:center;">🛡️ ${t.name}</span>
        `).join('');
      }
    }

    // 2. Popolamento dinamico e sincronizzazione della Combobox Competizioni
    const compSelect = document.getElementById('calendarCompSelect');
    if (compSelect) {
      const listaComps = competitions || [];
      if (listaComps.length === 0) {
        compSelect.innerHTML = '<option value="">Nessuna competizione creata</option>';
      } else {
        const currentSelection = window.CURRENT_COMPETITION || (listaComps[0] ? listaComps[0].id : "");
        if (!window.CURRENT_COMPETITION && listaComps[0]) {
          window.CURRENT_COMPETITION = listaComps[0].id;
        }

        compSelect.innerHTML = listaComps.map(c => `
          <option value="${c.id}" ${currentSelection === c.id ? 'selected' : ''}>🏆 ${c.name} (${c.id})</option>
        `).join('');
      }
    }
  }
};

/* ─── Funzioni ed Esposizioni Globali per la UI ────────────────────────── */

window.changeCalendarTargetComp = function(compId) {
  window.CURRENT_COMPETITION = compId;
  if (typeof window.toast === "function") {
    window.toast(`Target calendario impostato su: ${compId.toUpperCase()}`, "info");
  }
};

window.generateRandomCalendar = async function() {
  const compSelectEl = document.getElementById('calendarCompSelect');
  const targetCompId = compSelectEl ? compSelectEl.value : window.CURRENT_COMPETITION;

  if (!targetCompId) {
    return window.toast?.("Seleziona prima una competizione dalla lista!", "err");
  }

  const squadreAttuali = CalendarioSection._currentTeams || [];
  if (squadreAttuali.length < 2) {
    return window.toast?.("Servono almeno 2 squadre per generare un calendario!", "err");
  }

  const totalGwsRequested = parseInt(document.getElementById('genTotalGws').value) || 33;
  const rotationType = document.getElementById('genRotationType').value;

  if (!confirm(`Vuoi sovrascrivere il calendario di "${targetCompId.toUpperCase()}" con ${totalGwsRequested} giornate?`)) {
    return;
  }

  // Algoritmo Round-Robin (Girone all'italiana) con randomizzazione
  let lista = squadreAttuali.map(t => t.id).sort(() => Math.random() - 0.5);
  if (lista.length % 2 !== 0) {
    lista.push("RIPOSO");
  }

  const numSquadre = lista.length;
  const matchPerGiornata = numSquadre / 2;
  const turniUnici = numSquadre - 1;
  let calendarioCompleto = {};

  for (let g = 1; g <= totalGwsRequested; g++) {
    const gironeCorrente = Math.floor((g - 1) / turniUnici);
    const turnoNelGirone = (g - 1) % turniUnici;
    const inverti = (rotationType === 'andata-ritorno' && gironeCorrente % 2 !== 0);
    
    let matchGiornata = {};
    let counter = 1;

    for (let m = 0; m < matchPerGiornata; m++) {
      let casaIdx = (turnoNelGirone + m) % (numSquadre - 1);
      let trasfIdx = m === 0 ? numSquadre - 1 : (numSquadre - 1 - m + turnoNelGirone) % (numSquadre - 1);
      
      let idCasa = lista[casaIdx];
      let idTrasf = lista[trasfIdx];

      if (idCasa === "RIPOSO" || idTrasf === "RIPOSO") continue;
      
      if (inverti) { 
        const tmp = idCasa; 
        idCasa = idTrasf; 
        idTrasf = tmp; 
      }

      matchGiornata[`m${counter++}`] = { 
        id: `m${counter - 1}`, 
        homeId: idCasa, 
        awayId: idTrasf, 
        homeScore: null, 
        awayScore: null, 
        finished: false 
      };
    }
    calendarioCompleto[`gw${g}`] = matchGiornata;
  }

  try {
    const database = CalendarioSection.db || getDatabase();
    
    // Scrittura diretta dei nodi corrispondenti alla competizione scelta
    const pathMatches = ref(database, `competitions/${targetCompId}/matches`);
    const pathStatus = ref(database, `competitions/${targetCompId}/status`);
    
    await set(pathMatches, calendarioCompleto);
    await set(pathStatus, { currentGW: 1 });
    
    if (typeof window.toast === "function") {
      window.toast(`🎯 Calendario generato con successo per ${targetCompId.toUpperCase()}!`, "ok");
    }
  } catch (err) {
    console.error(err);
    if (typeof window.toast === "function") {
      window.toast("Errore durante il salvataggio su Firebase", "err");
    }
  }
};
