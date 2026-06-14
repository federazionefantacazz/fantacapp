import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

export const CalendarioSection = {
  db: null,
  _currentTeams: [],
  _currentCompetitions: [],

  init(database) {
    this.db = database;
  },

  renderHTML() {
    return `
    <div id="sec-calendar-gen" class="admin-sec" style="display:none;">
      <div class="sec-title">🗓️ Configurazione & Generazione Calendario</div>
      
      <div class="card" style="max-width: 650px;">
        <div style="margin-bottom: 1rem; padding: .8rem; background: rgba(80, 227, 194, 0.1); border-left: 4px solid var(--accent); border-radius: 4px;">
          <span style="font-size: .85rem; color: var(--text);">
            Il sistema rileverà automaticamente se la competizione scelta è un <strong>Campionato Standard</strong> o una <strong>Competizione Mista</strong> (generando in questo caso i calendari paralleli per i rispettivi gironi della sola fase a girone).
          </span>
        </div>

        <label class="label" style="color: var(--accent);">1. Competizione Target</label>
        <select id="calendarCompSelect" class="input-login" onchange="window.changeCalendarTargetComp(this.value)">
          <option value="">Caricamento competizioni...</option>
        </select>

        <div style="display: flex; gap: 1rem; margin-bottom: 1rem; background: var(--bg3); padding: .75rem; border-radius: 6px; border: 1px solid var(--border);">
          <div>
            <div class="label">Tipo Rilevato</div>
            <div id="calTypeBadge" style="font-weight:bold; color:#fff; font-size:.9rem;">-</div>
          </div>
          <div style="margin-left: auto; text-align: right;">
            <div class="label">Gironi Rilevati</div>
            <div id="calGironiCount" style="font-weight:bold; color:var(--accent); font-size:.9rem;">-</div>
          </div>
        </div>

        <label class="label" style="color: var(--accent); margin-top: .5rem;">2. Parametri Strutturali</label>
        <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
          <div style="flex: 1;">
            <label class="label">Numero Squadre Max</label>
            <select id="genMaxTeamsCount" class="input-login" style="margin-bottom:0; background: var(--bg3); color:#fff; padding:.5rem; border-radius:6px; width:100%;">
              <option value="4">4 Squadre</option>
              <option value="6">6 Squadre</option>
              <option value="8">8 Squadre</option>
              <option value="10" selected>10 Squadre</option>
              <option value="12">12 Squadre</option>
              <option value="14">14 Squadre</option>
              <option value="16">16 Squadre</option>
            </select>
          </div>
          <div style="flex: 1;">
            <label class="label">Rotazione Incontri</label>
            <select id="genRotationType" class="input-login" style="margin-bottom:0; background: var(--bg3); color:#fff; padding:.5rem; border-radius:6px; width:100%;">
              <option value="solo-andata">Solo Andata</option>
              <option value="andata-ritorno" selected>Andata e Ritorno</option>
              <option value="tre-giri">Tre Giri (Andata/Ritorno/Andata)</option>
            </select>
          </div>
        </div>

        <button class="btn btn-green" style="margin-top: .5rem;" onclick="window.generateRandomCalendar()">⚡ Elabora & Salva su Firebase</button>
      </div>

      <div class="card">
        <div class="label">Squadre Attuali nel Database:</div>
        <div id="genTeamsPreview" style="display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .5rem; font-size: .85rem; color: var(--text2);"></div>
      </div>
    </div>`;
  },

  render(state) {
    const { TEAMS, competitions } = state;
    this._currentTeams = TEAMS || [];
    this._currentCompetitions = competitions || [];

    // Anteprima squadre
    const container = document.getElementById('genTeamsPreview');
    if (container) {
      if (this._currentTeams.length === 0) {
        container.innerHTML = '❌ Nessuna squadra globale trovata nel database.';
      } else {
        container.innerHTML = this._currentTeams.map(t => `
          <span style="background:var(--bg2); padding:.4rem .6rem; border-radius:4px; border:1px solid var(--border); display:inline-flex; align-items:center;">🛡️ ${t.name}</span>
        `).join('');
      }
    }

    // Popolamento tendina competizioni
    const compSelect = document.getElementById('calendarCompSelect');
    if (compSelect) {
      if (this._currentCompetitions.length === 0) {
        compSelect.innerHTML = '<option value="">Nessuna competizione creata</option>';
      } else {
        const currentSelection = window.CURRENT_COMPETITION || (this._currentCompetitions[0] ? this._currentCompetitions[0].id : "");
        if (!window.CURRENT_COMPETITION && this._currentCompetitions[0]) {
          window.CURRENT_COMPETITION = this._currentCompetitions[0].id;
        }

        compSelect.innerHTML = this._currentCompetitions.map(c => `
          <option value="${c.id}" ${currentSelection === c.id ? 'selected' : ''}>🏆 ${c.name} (${c.id})</option>
        `).join('');
        
        this.updateBadgeDinamici(window.CURRENT_COMPETITION);
      }
    }
  },

  updateBadgeDinamici(compId) {
    const tBadge = document.getElementById('calTypeBadge');
    const gBadge = document.getElementById('calGironiCount');
    if (!tBadge || !gBadge) return;

    const comp = this._currentCompetitions.find(c => c.id === compId);
    if (!comp) {
      tBadge.textContent = "-";
      gBadge.textContent = "-";
      return;
    }

    if (comp.type === 'misto-speciale') {
      tBadge.innerHTML = `<span style="color:var(--gold)">MISTA (Campionato + Coppa)</span>`;
      const numGironi = comp.gironi ? Object.keys(comp.gironi).length : 3; // default 3 se non popolato
      gBadge.textContent = `${numGironi} Gironi Interni`;
    } else {
      tBadge.innerHTML = `<span style="color:var(--accent2)">CAMPIONATO STANDARD</span>`;
      gBadge.textContent = "1 (Girone Unico)";
    }
  }
};

/* ─── Funzioni Globali d'Azione ────────────────────────────────────────── */

window.changeCalendarTargetComp = function(compId) {
  window.CURRENT_COMPETITION = compId;
  CalendarioSection.updateBadgeDinamici(compId);
  if (typeof window.toast === "function") {
    window.toast(`Configurazione orientata su: ${compId.toUpperCase()}`, "info");
  }
};

window.generateRandomCalendar = async function() {
  const compSelectEl = document.getElementById('calendarCompSelect');
  const targetCompId = compSelectEl ? compSelectEl.value : window.CURRENT_COMPETITION;

  if (!targetCompId) return window.toast?.("Seleziona una competizione!", "err");

  const comp = CalendarioSection._currentCompetitions.find(c => c.id === targetCompId);
  if (!comp) return window.toast?.("Competizione non trovata!", "err");

  const maxSquadreScelte = parseInt(document.getElementById('genMaxTeamsCount').value) || 12;
  const rotationType = document.getElementById('genRotationType').value;

  // Filtriamo le squadre totali per il limite massimo scelto
  let squadreDisponibili = [...CalendarioSection._currentTeams].slice(0, maxSquadreScelte).map(t => t.id);
  if (squadreDisponibili.length < 2) {
    return window.toast?.("Servono almeno 2 squadre aggregate!", "err");
  }

  if (!confirm(`Vuoi generare il calendario della fase campionato per la competizione "${comp.name.toUpperCase()}"?`)) return;

  let calendarioCompleto = {};
  
  // ─── LOGICA 1: COMPETIZIONE MISTA ───────────────────────────────────────
  if (comp.type === 'misto-speciale') {
    // Determiniamo i gironi (da db o strutturati di default come A, B, C)
    let gironiIds = comp.gironi ? Object.keys(comp.gironi) : ['gironeA', 'gironeB', 'gironeC'];
    let numGironi = gironiIds.length;
    
    // Distribuiamo le squadre selezionate nei gironi in modo bilanciato
    let squadrePerGirone = {};
    gironiIds.forEach(gId => squadrePerGirone[gId] = []);
    
    squadreDisponibili.sort(() => Math.random() - 0.5);
    squadreDisponibili.forEach((teamId, index) => {
      let targetGirone = gironiIds[index % numGironi];
      squadrePerGirone[targetGirone].push(teamId);
    });

    // Calcoliamo i round-robin per ogni girone indipendentemente
    let agendeGironi = {};
    let maxGiornateFase = 0;

    gironiIds.forEach(gId => {
      let lista = [...squadrePerGirone[gId]];
      if (lista.length % 2 !== 0) lista.push("RIPOSO");
      
      const n = lista.length;
      const turniUnici = n - 1;
      let giri = 1;
      if (rotationType === 'andata-ritorno') giri = 2;
      if (rotationType === 'tre-giri') giri = 3;
      
      const giornateTotaliGirone = turniUnici * giri;
      if (giornateTotaliGirone > maxGiornateFase) maxGiornateFase = giornateTotaliGirone;

      agendeGironi[gId] = {
        squadre: lista,
        turniUnici: turniUnici
      };
    });

    // Compiliamo le giornate inserendo i match di tutti i gironi in parallelo
    for (let g = 1; g <= maxGiornateFase; g++) {
      let matchGiornata = {};
      let matchCounter = 1;

      gironiIds.forEach(gId => {
        const agenda = agendeGironi[gId];
        const lista = agenda.squadre;
        const turniUnici = agenda.turniUnici;
        const numSquadre = lista.length;
        
        const gironeCorrente = Math.floor((g - 1) / turniUnici);
        const turnoNelGirone = (g - 1) % turniUnici;
        
        // Inversione casa/trasferta al secondo giro
        const inverti = (gironeCorrente === 1 || gironeCorrente === 3); 

        // Se la combinazione di giri di questo girone è inferiore alla giornata corrente, non produce match
        if (g > turniUnici * (rotationType === 'solo-andata' ? 1 : rotationType === 'andata-ritorno' ? 2 : 3)) {
          return;
        }

        const matchPerGiornata = numSquadre / 2;
        for (let m = 0; m < matchPerGiornata; m++) {
          let casaIdx = (turnoNelGirone + m) % (numSquadre - 1);
          let trasfIdx = m === 0 ? numSquadre - 1 : (numSquadre - 1 - m + turnoNelGirone) % (numSquadre - 1);
          
          let idCasa = lista[casaIdx];
          let idTrasf = lista[trasfIdx];

          if (idCasa === "RIPOSO" || idTrasf === "RIPOSO") continue;

          if (inverti) {
            const tmp = idCasa; idCasa = idTrasf; idTrasf = tmp;
          }

          matchGiornata[`m${matchCounter++}`] = {
            id: `m${matchCounter - 1}`,
            girone: gId.toUpperCase().replace("GIRONE", "Girone "),
            homeId: idCasa,
            awayId: idTrasf,
            homeScore: null,
            awayScore: null,
            finished: false
          };
        }
      });

      calendarioCompleto[`gw${g}`] = matchGiornata;
    }

  // ─── LOGICA 2: CAMPIONATO STANDARD ──────────────────────────────────────
  } else {
    let lista = [...squadreDisponibili].sort(() => Math.random() - 0.5);
    if (lista.length % 2 !== 0) lista.push("RIPOSO");

    const numSquadre = lista.length;
    const matchPerGiornata = numSquadre / 2;
    const turniUnici = numSquadre - 1;
    
    let giri = 1;
    if (rotationType === 'andata-ritorno') giri = 2;
    if (rotationType === 'tre-giri') giri = 3;
    const totalGwsRequested = turniUnici * giri;

    for (let g = 1; g <= totalGwsRequested; g++) {
      const gironeCorrente = Math.floor((g - 1) / turniUnici);
      const turnoNelGirone = (g - 1) % turniUnici;
      const inverti = (gironeCorrente === 1 || gironeCorrente === 3);
      
      let matchGiornata = {};
      let counter = 1;

      for (let m = 0; m < matchPerGiornata; m++) {
        let casaIdx = (turnoNelGirone + m) % (numSquadre - 1);
        let trasfIdx = m === 0 ? numSquadre - 1 : (numSquadre - 1 - m + turnoNelGirone) % (numSquadre - 1);
        
        let idCasa = lista[casaIdx];
        let idTrasf = lista[trasfIdx];

        if (idCasa === "RIPOSO" || idTrasf === "RIPOSO") continue;
        if (inverti) { 
          const tmp = idCasa; idCasa = idTrasf; idTrasf = tmp; 
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
  }

  // ─── SALVATAGGIO SU FIREBASE ───────────────────────────────────────────
  try {
    const database = CalendarioSection.db || getDatabase();
    await set(ref(database, `competitions/${targetCompId}/matches`), calendarioCompleto);
    await set(ref(database, `competitions/${targetCompId}/status`), { currentGW: 1 });
    
    window.toast?.(`🎯 Calendario campionato salvato con successo per ${comp.name.toUpperCase()}!`, "ok");
  } catch (err) {
    console.error(err);
    window.toast?.("Errore durante il salvataggio su Firebase", "err");
  }
};
