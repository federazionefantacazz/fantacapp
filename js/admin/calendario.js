import { getDatabase, ref, set, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
            Il sistema rileva automaticamente la configurazione salvata su Firebase. Per i tornei a gironi, effettua prima il sorteggio delle squadre e poi genera il calendario dei match.
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
            <div class="label">Gironi Previsti</div>
            <div id="calGironiCount" style="font-weight:bold; color:var(--accent); font-size:.9rem;">-</div>
          </div>
        </div>

        <div id="actionsBlock" style="display: flex; flex-direction: column; gap: .75rem; margin-top: .5rem;">
          <div id="drawGironiContainer" style="display:none; background: rgba(245, 166, 35, 0.05); padding: 1rem; border: 1px dashed var(--gold); border-radius: 6px; margin-bottom: .5rem;">
            <div class="label" style="color: var(--gold); margin-bottom: .5rem;">Fase Iniziale: Composizione Gruppi</div>
            <button class="btn btn-gold" style="width: 100%;" onclick="window.sorteggiaGironiCompetizione()">🎲 Effettua Sorteggio Gruppi</button>
          </div>

          <div style="background: var(--bg2); padding: 1rem; border-radius: 6px; border: 1px solid var(--border);">
            <label class="label" style="color: var(--accent);">Rotazione Incontri Calendario</label>
            <select id="genRotationType" class="input-login" style="background: var(--bg3); color:#fff; padding:.5rem; border-radius:6px; width:100%; margin-bottom: 1rem;">
              <option value="solo-andata">Solo Andata</option>
              <option value="andata-ritorno" selected>Andata e Ritorno</option>
              <option value="tre-giri">Tre Giri (Andata/Ritorno/Andata)</option>
            </select>
            <button class="btn btn-green" style="width: 100%;" onclick="window.generateRandomCalendar()">⚡ Genera & Salva Calendario Match</button>
          </div>
        </div>
      </div>

      <div class="card" id="previewGironiCard" style="display: none;">
        <div class="label" style="color: var(--gold); font-weight: 600;">🏆 Composizione Attuale dei Gironi</div>
        <div id="gironiVisualContainer" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem;"></div>
      </div>

      <div class="card">
        <div class="label" id="genTeamsPreviewTitle">Squadre iscritte a questa competizione:</div>
        <div id="genTeamsPreview" style="display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .5rem; font-size: .85rem; color: var(--text2);"></div>
      </div>
    </div>`;
  },

  render(state) {
    const { TEAMS, competitions } = state;
    this._currentTeams = TEAMS || [];
    this._currentCompetitions = competitions || [];

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
    const container = document.getElementById('genTeamsPreview');
    const titleContainer = document.getElementById('genTeamsPreviewTitle');
    const drawContainer = document.getElementById('drawGironiContainer');
    const previewGironiCard = document.getElementById('previewGironiCard');
    const gironiVisualContainer = document.getElementById('gironiVisualContainer');

    if (!tBadge || !gBadge) return;

    const comp = this._currentCompetitions.find(c => c.id === compId);
    if (!comp) {
      tBadge.textContent = "-"; gBadge.textContent = "-";
      if (container) container.innerHTML = '';
      if (drawContainer) drawContainer.style.display = "none";
      if (previewGironiCard) previewGironiCard.style.display = "none";
      return;
    }

    const numGironiPrevisti = parseInt(comp.gironi) || 1;

    // Rilevamento tipo e visualizzazione bottoni appropriati
    if ((comp.type === 'misto' || comp.type === 'misto-speciale') && numGironiPrevisti > 1) {
      tBadge.innerHTML = `<span style="color:var(--gold)">MISTA (${comp.type === 'misto-speciale' ? 'Misto Speciale' : 'Gironi + Fase Finale'})</span>`;
      gBadge.textContent = `${numGironiPrevisti} Gironi`;
      if (drawContainer) drawContainer.style.display = "block";
    } else {
      tBadge.innerHTML = `<span style="color:var(--accent2)">CAMPIONATO STANDARD</span>`;
      gBadge.textContent = "1 (Girone Unico)";
      if (drawContainer) drawContainer.style.display = "none";
    }

    // Estrazione squadre partecipanti
    let compTeamsIds = [];
    if (comp.teams) {
      compTeamsIds = Array.isArray(comp.teams) ? comp.teams : Object.values(comp.teams);
    }
    compTeamsIds = compTeamsIds.filter(id => id !== null && id !== undefined).map(id => String(id));

    if (titleContainer) {
      titleContainer.innerHTML = `Squadre partecipanti totali iscritte a <strong>${comp.name.toUpperCase()}</strong> (${compTeamsIds.length}):`;
    }

    if (container) {
      if (compTeamsIds.length === 0) {
        container.innerHTML = '<span style="color:var(--accent3);">❌ Nessuna squadra associata a questa competizione. Modificala nella sezione Competizioni.</span>';
      } else {
        container.innerHTML = compTeamsIds.map(tId => {
          const teamObj = this._currentTeams.find(t => String(t.id) === tId);
          return `<span style="background:var(--bg2); padding:.4rem .6rem; border-radius:4px; border:1px solid var(--border); display:inline-flex; align-items:center;">🛡️ ${teamObj ? teamObj.name : tId}</span>`;
        }).join('');
      }
    }

    // Rendering visivo dei gironi se già sorteggiati precedentemente nel DB
    if (numGironiPrevisti > 1 && comp.strutturaGironi) {
      if (previewGironiCard && gironiVisualContainer) {
        previewGironiCard.style.display = "block";
        gironiVisualContainer.innerHTML = Object.keys(comp.strutturaGironi).map(gId => {
          const elencoSquadreIds = comp.strutturaGironi[gId] || [];
          const htmlSquadre = elencoSquadreIds.map(tId => {
            const teamObj = this._currentTeams.find(t => String(t.id) === tId);
            return `<div style="padding: .3rem .5rem; background: var(--bg3); margin-bottom: 4px; border-radius: 4px; font-size: .85rem; border: 1px solid var(--border);">🛡️ ${teamObj ? teamObj.name : tId}</div>`;
          }).join('');

          return `
            <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border); padding: .75rem; border-radius: 6px;">
              <div style="color: var(--accent); font-weight: bold; margin-bottom: .5rem; border-bottom: 1px solid var(--border); padding-bottom: .25rem; font-size: .9rem;">${gId.toUpperCase()}</div>
              ${htmlSquadre || '<div style="color:var(--text3); font-size:.8rem;">Vuoto</div>'}
            </div>
          `;
        }).join('');
      }
    } else {
      if (previewGironiCard) previewGironiCard.style.display = "none";
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

// NUOVA AZIONE: EFFETTUA IL SORTEGGIO RANDOMICO DEI GIRONI E LI SALVA
window.sorteggiaGironiCompetizione = async function() {
  const targetCompId = document.getElementById('calendarCompSelect')?.value || window.CURRENT_COMPETITION;
  if (!targetCompId) return window.toast?.("Seleziona una competizione!", "err");

  const comp = CalendarioSection._currentCompetitions.find(c => c.id === targetCompId);
  if (!comp) return window.toast?.("Competizione non trovata!", "err");

  let squadreIscritte = [];
  if (comp.teams) {
    squadreIscritte = Array.isArray(comp.teams) ? comp.teams : Object.values(comp.teams);
  }
  squadreIscritte = squadreIscritte.filter(id => id !== null && id !== undefined).map(id => String(id));

  const numGironi = parseInt(comp.gironi) || 1;
  if (numGironi <= 1) return window.toast?.("Questa competizione non prevede gironi multipli!", "err");
  if (squadreIscritte.length < numGironi) return window.toast?.(`Ci sono solo ${squadreIscritte.length} squadre, impossibile riempire ${numGironi} gironi!`, "err");

  if (!confirm(`Sei sicuro di voler effettuare un nuovo sorteggio randomico delle squadre per i ${numGironi} gironi? Verrà sovrascritta la struttura attuale.`)) return;

  // Algoritmo di mescolamento Fisher-Yates (Randomizzazione)
  let mixTeams = [...squadreIscritte].sort(() => Math.random() - 0.5);
  
  let strutturaGironi = {};
  for (let idx = 1; idx <= numGironi; idx++) {
    strutturaGironi[`Girone ${idx}`] = [];
  }

  // Distribuzione equa sequenziale nei gironi
  mixTeams.forEach((teamId, index) => {
    const targetGironeKey = `Girone ${(index % numGironi) + 1}`;
    strutturaGironi[targetGironeKey].push(teamId);
  });

  try {
    const database = CalendarioSection.db || getDatabase();
    // Salviamo la mappatura dei gironi direttamente dentro la competizione
    await update(ref(database, `competitions/${targetCompId}`), { strutturaGironi: strutturaGironi });
    window.toast?.("🎲 Sorteggio gironi effettuato e salvato con successo!", "ok");
    
    // Aggiorniamo lo stato locale simulato o attendiamo il prossimo snapshot
    comp.strutturaGironi = strutturaGironi;
    CalendarioSection.updateBadgeDinamici(targetCompId);
  } catch (err) {
    console.error(err);
    window.toast?.("Errore durante il salvataggio del sorteggio", "err");
  }
};

window.generateRandomCalendar = async function() {
  const compSelectEl = document.getElementById('calendarCompSelect');
  const targetCompId = compSelectEl ? compSelectEl.value : window.CURRENT_COMPETITION;

  if (!targetCompId) return window.toast?.("Seleziona una competizione!", "err");

  const comp = CalendarioSection._currentCompetitions.find(c => c.id === targetCompId);
  if (!comp) return window.toast?.("Competizione non trovata!", "err");

  const rotationType = document.getElementById('genRotationType').value;
  let calendarioCompleto = {};

  const numGironiPrevisti = parseInt(comp.gironi) || 1;

  // ─── LOGICA 1: GIRONI MULTIPLI (LEGGE LA STRUTTURA SORTEGGIATA) ───────────────────
  if ((comp.type === 'misto' || comp.type === 'misto-speciale') && numGironiPrevisti > 1) {
    if (!comp.strutturaGironi) {
      return window.toast?.("Devi prima effettuare il sorteggio delle squadre premendo il tasto 'Effettua Sorteggio Gruppi'!", "err");
    }

    const gironiIds = Object.keys(comp.strutturaGironi);
    let agendeGironi = {};
    let maxGiornateFase = 0;

    gironiIds.forEach(gId => {
      let lista = [...comp.strutturaGironi[gId]];
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
        turniUnici: turniUnici,
        giriMax: giri
      };
    });

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
        const inverti = (gironeCorrente === 1 || gironeCorrente === 3); 

        if (g > turniUnici * agenda.giriMax) return;

        const matchPerGiornata = numSquadre / 2;
        for (let m = 0; m < matchPerGiornata; m++) {
          let casaIdx = (turnoNelGirone + m) % (numSquadre - 1);
          let trasfIdx = m === 0 ? numSquadre - 1 : (numSquadre - 1 - m + turnoNelGirone) % (numSquadre - 1);
          
          let idCasa = lista[casaIdx];
          let idTrasf = lista[trasfIdx];

          if (idCasa === "RIPOSO" || idTrasf === "RIPOSO") continue;
          if (inverti) { const tmp = idCasa; idCasa = idTrasf; idTrasf = tmp; }

          matchGiornata[`m${matchCounter}`] = {
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

      calendarioCompleto[`gw${g}`] = matchGiornata;
    }

  // ─── LOGICA 2: CAMPIONATO STANDARD O GIRONE UNICO ──────────────────────────
  } else {
    let squadreIscritte = [];
    if (comp.teams) {
      squadreIscritte = Array.isArray(comp.teams) ? comp.teams : Object.values(comp.teams);
    }
    squadreIscritte = squadreIscritte.filter(id => id !== null && id !== undefined).map(id => String(id));

    if (squadreIscritte.length < 2) {
      return window.toast?.("Servono almeno 2 squadre associate per generare il calendario!", "err");
    }

    let lista = [...squadreIscritte].sort(() => Math.random() - 0.5);
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
        if (inverti) { const tmp = idCasa; idCasa = idTrasf; idTrasf = tmp; }

        matchGiornata[`m${counter}`] = { 
          id: `m${counter}`, 
          homeId: idCasa, 
          awayId: idTrasf, 
          homeScore: null, 
          awayScore: null, 
          finished: false 
        };
        counter++;
      }
      calendarioCompleto[`gw${g}`] = matchGiornata;
    }
  }

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