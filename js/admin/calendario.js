import { getDatabase, ref, set, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

export const CalendarioSection = {
  db: null,
  _currentTeams: [],
  _currentCompetitions: [],
  _isEditingManually: false,

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
            Gestione dei Calendari e della Fase Finale. Rileva automaticamente la tipologia di torneo per generare la Regular Season o l'Albero dei Playoff ad Eliminazione Diretta.
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
            <div class="label">Parametri Fase Finale</div>
            <div id="calFaseFinaleBadge" style="font-weight:bold; color:var(--accent); font-size:.9rem;">-</div>
          </div>
        </div>

        <div id="actionsBlock" style="display: flex; flex-direction: column; gap: .75rem; margin-top: .5rem;">
          
          <div id="drawGironiContainer" style="display:none; background: rgba(245, 166, 35, 0.05); padding: 1rem; border: 1px dashed var(--gold); border-radius: 6px;">
            <div class="label" style="color: var(--gold); margin-bottom: .5rem;">Fase 1: Regular Season (Gironi)</div>
            <button class="btn btn-gold" style="width: 100%;" onclick="window.sorteggiaGironiCompetizione()">🎲 Effettua Sorteggio Gruppi</button>
          </div>

          <div id="regSeasonGenBlock" style="background: var(--bg2); padding: 1rem; border-radius: 6px; border: 1px solid var(--border);">
            <label class="label" style="color: var(--accent);">Generatore Regular Season</label>
            <select id="genRotationType" class="input-login" style="background: var(--bg3); color:#fff; padding:.5rem; border-radius:6px; width:100%; margin-bottom: 1rem;">
              <option value="solo-andata" selected>Solo Andata</option>
              <option value="andata-ritorno">Andata e Ritorno</option>
              <option value="tre-giri">Tre Giri</option>
            </select>
            <button class="btn btn-green" style="width: 100%;" onclick="window.generateRandomCalendar()">⚡ Genera Regular Season Match</button>
          </div>

          <div id="tabelloneGenBlock" style="background: rgba(74, 144, 226, 0.08); padding: 1rem; border-radius: 6px; border: 1px solid var(--accent2);">
            <label class="label" style="color: var(--accent2); margin-bottom: .5rem;">Fase 2: Fase Finale ad Eliminazione Diretta</label>
            
            <div style="margin-bottom: 1rem;">
              <label class="label" style="font-size:0.65rem;">Formato Incontri Fasi Intermedie</label>
              <select id="playoffRotationType" class="input-login" style="background: var(--bg3); color:#fff; padding:.5rem; border-radius:6px; width:100%; margin-bottom:0;">
                <option value="solo-andata">Solo Andata (Gara Secca)</option>
                <option value="andata-ritorno" selected>Andata & Ritorno (Finale Secca)</option>
              </select>
            </div>

            <button class="btn btn-blue" style="width: 100%;" onclick="window.creaTabelloneFaseFinale()">🏆 Crea Tabellone ad Albero</button>
          </div>

        </div>
      </div>

      <div class="card" id="assocGwCard">
        <div class="label" style="color: var(--gold); margin-bottom: 1rem;">🔗 Associazione Giornate Reali</div>
        <div id="assocGwContainer" style="display: flex; flex-direction: column; gap: 0.5rem;">
          </div>
        <button class="btn btn-green" style="margin-top: 1rem;" onclick="window.salvaAssociazioniGw()">💾 Salva Mappatura Giornate</button>
      </div>

      <div class="card" id="previewGironiCard" style="display: none;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: .5rem; margin-bottom: 1rem;">
          <div class="label" style="color: var(--gold); font-weight: 600; margin-bottom: 0;">🏆 Composizione Attuale dei Gironi</div>
          <div id="gironiActionButtons"></div>
        </div>
        <div id="gironiVisualContainer" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;"></div>
      </div>

      <div class="card" id="treeTabelloneCard" style="display: none; overflow-x: auto;">
        <div class="label" style="color: var(--accent2); font-weight: 600; border-bottom: 1px solid var(--border); padding-bottom: .5rem; margin-bottom: 1rem;">🌳 Albero e Sviluppo del Tabellone della Competizione</div>
        <div id="treeVisualContainer" style="display: flex; gap: 2rem; padding: 1rem 0; min-width: max-content; align-items: center;"></div>
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
    const gBadge = document.getElementById('calFaseFinaleBadge');
    const container = document.getElementById('genTeamsPreview');
    const titleContainer = document.getElementById('genTeamsPreviewTitle');
    const drawContainer = document.getElementById('drawGironiContainer');
    const previewGironiCard = document.getElementById('previewGironiCard');
    const gironiVisualContainer = document.getElementById('gironiVisualContainer');
    const btnContainer = document.getElementById('gironiActionButtons');
    const regSeasonGenBlock = document.getElementById('regSeasonGenBlock');
    const tabelloneGenBlock = document.getElementById('tabelloneGenBlock');

    if (!tBadge || !gBadge) return;

    const comp = this._currentCompetitions.find(c => c.id === compId);
    if (!comp) {
      tBadge.textContent = "-"; gBadge.textContent = "-";
      if (container) container.innerHTML = '';
      if (drawContainer) drawContainer.style.display = "none";
      if (previewGironiCard) previewGironiCard.style.display = "none";
      return;
    }

    // Configurazione visiva dei blocchi in base al tipo competizione
    if (comp.type === 'campionato') {
      tBadge.innerHTML = `<span style="color:var(--accent2)">CAMPIONATO STANDARD</span>`;
      gBadge.textContent = "Girone Unico";
      if (drawContainer) drawContainer.style.display = "none";
      if (regSeasonGenBlock) regSeasonGenBlock.style.display = "block";
      if (tabelloneGenBlock) tabelloneGenBlock.style.display = "none"; // Vietato da regolamento
      this._isEditingManually = false;
    } else if (comp.type === 'diretta') {
      tBadge.innerHTML = `<span style="color:var(--accent3)">ELIMINAZIONE DIRETTA PURA</span>`;
      gBadge.textContent = "Tabellone Immediato";
      if (drawContainer) drawContainer.style.display = "none";
      if (regSeasonGenBlock) regSeasonGenBlock.style.display = "none";
      if (tabelloneGenBlock) tabelloneGenBlock.style.display = "block";
      this._isEditingManually = false;
    } else {
      const gPrevisti = comp.gironi || 1;
      const qFase = comp.qualificatiFaseFinale || 2;
      tBadge.innerHTML = `<span style="color:var(--gold)">${comp.type.toUpperCase()}</span>`;
      gBadge.textContent = comp.type === 'misto-speciale' ? 'Regole Speciali Playoff' : `${gPrevisti} Gir. (Qualif. top ${qFase})`;
      if (drawContainer) drawContainer.style.display = "block";
      if (regSeasonGenBlock) regSeasonGenBlock.style.display = "block";
      if (tabelloneGenBlock) tabelloneGenBlock.style.display = "block";
    }

    let compTeamsIds = [];
    if (comp.teams) {
      compTeamsIds = Array.isArray(comp.teams) ? comp.teams : Object.values(comp.teams);
    }
    compTeamsIds = compTeamsIds.filter(id => id !== null && id !== undefined).map(id => String(id));

    if (titleContainer) {
      titleContainer.innerHTML = `Squadre totali iscritte a <strong>${comp.name.toUpperCase()}</strong> (${compTeamsIds.length}):`;
    }

    if (container) {
      if (compTeamsIds.length === 0) {
        container.innerHTML = '<span style="color:var(--accent3);">❌ Nessuna squadra associata a questa competizione.</span>';
      } else {
        container.innerHTML = compTeamsIds.map(tId => {
          const teamObj = this._currentTeams.find(t => String(t.id) === tId);
          return `<span style="background:var(--bg2); padding:.4rem .6rem; border-radius:4px; border:1px solid var(--border); display:inline-flex; align-items:center;">🛡️ ${teamObj ? teamObj.name : tId}</span>`;
        }).join('');
      }
    }

    // Gestione visualizzazione gironi
    if ((comp.type === 'misto' || comp.type === 'misto-speciale') && comp.strutturaGironi) {
      if (previewGironiCard && gironiVisualContainer && btnContainer) {
        previewGironiCard.style.display = "block";

        if (this._isEditingManually) {
          btnContainer.innerHTML = `
            <button class="btn btn-green" style="padding: .3rem .75rem; font-size: .8rem;" onclick="window.salvaModificheGironiManuali()">💾 Salva Gruppi</button>
            <button class="btn btn-red" style="padding: .3rem .75rem; font-size: .8rem; margin-left: .25rem;" onclick="window.annullaModificaManualeGironi()">Annulla</button>
          `;
        } else {
          btnContainer.innerHTML = `
            <button class="btn" style="background: var(--bg3); border:1px solid var(--border); padding: .3rem .75rem; font-size: .8rem; color:#fff;" onclick="window.attivaModificaManualeGironi()">✏️ Personalizza Manualmente</button>
          `;
        }

        const gironiIds = Object.keys(comp.strutturaGironi);
        gironiVisualContainer.innerHTML = gironiIds.map(gId => {
          const elencoSquadreIds = comp.strutturaGironi[gId] || [];
          let htmlSquadre = "";

          if (this._isEditingManually) {
            for (let slotIdx = 0; slotIdx < elencoSquadreIds.length; slotIdx++) {
              const currentSelectedId = elencoSquadreIds[slotIdx];
              const optionsHtml = compTeamsIds.map(tId => {
                const teamObj = this._currentTeams.find(t => String(t.id) === tId);
                return `<option value="${tId}" ${tId === currentSelectedId ? 'selected' : ''}>🛡️ ${teamObj ? teamObj.name : tId}</option>`;
              }).join('');

              htmlSquadre += `
                <div style="margin-bottom: 6px;">
                  <select class="input-login class-manual-team-slot" data-girone="${gId}" data-slot="${slotIdx}" style="background: var(--bg3); padding: .3rem; font-size: .85rem; width: 100%; border-radius: 4px; border: 1px solid var(--border); color:#fff; margin-bottom:0;">
                    ${optionsHtml}
                  </select>
                </div>
              `;
            }
          } else {
            htmlSquadre = elencoSquadreIds.map(tId => {
              const teamObj = this._currentTeams.find(t => String(t.id) === tId);
              return `<div style="padding: .3rem .5rem; background: var(--bg3); margin-bottom: 4px; border-radius: 4px; font-size: .85rem; border: 1px solid var(--border);">🛡️ ${teamObj ? teamObj.name : tId}</div>`;
            }).join('');
          }

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

    // Rendering dell'Albero del Tabellone se già esistente nel DB
    this.renderAlberoGraficoTabellone(comp);


    const assocContainer = document.getElementById('assocGwContainer');
    
    if (comp && comp.matches && assocContainer) {
      const gwDisponibili = Object.keys(comp.matches); // gw1, gw2, gw_playoff_1...
      const attuali = comp.associazioniGwReali || {};
      
      assocContainer.innerHTML = Array.from({length: 38}, (_, i) => i + 1).map(realGw => {
        return `
          <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem;">
            <span style="width: 80px;">Serie A GW ${realGw}:</span>
            <select class="input-login assoc-select" data-real-gw="${realGw}" style="margin-bottom:0; padding:0.3rem;">
              <option value="">Nessuna</option>
              ${gwDisponibili.map(gw => `<option value="${gw}" ${attuali[realGw] === gw ? 'selected' : ''}>${gw}</option>`).join('')}
            </select>
          </div>
        `;
      }).join('');
    }
  },

  renderAlberoGraficoTabellone(comp) {
    const cardTree = document.getElementById('treeTabelloneCard');
    const containerTree = document.getElementById('treeVisualContainer');
    if (!cardTree || !containerTree) return;

    if (!comp || !comp.tabelloneStructure || !comp.tabelloneStructure.fasi) {
      cardTree.style.display = "none";
      return;
    }

    cardTree.style.display = "block";
    const fasi = comp.tabelloneStructure.fasi; // Mappa delle fasi ordinate (es. fase_1_playoff, fase_2_quarti...)
    const chiaviFasi = Object.keys(fasi).sort();

    containerTree.innerHTML = chiaviFasi.map(chiave => {
      const faseObj = fasi[chiave];
      const matchArray = faseObj.matchList || [];

      const htmlIncontri = matchArray.map(m => {
        const teamHome = this._currentTeams.find(t => String(t.id) === m.homeId);
        const teamAway = this._currentTeams.find(t => String(t.id) === m.awayId);
        
        const nameHome = m.homeId.startsWith("VINCENTE_") ? `✨ ${m.homeId.replace("VINCENTE_", "")}` : (teamHome ? teamHome.name : m.homeId);
        const nameAway = m.awayId.startsWith("VINCENTE_") ? `✨ ${m.awayId.replace("VINCENTE_", "")}` : (teamAway ? teamAway.name : m.awayId);

        return `
          <div style="background: var(--bg2); border: 1px solid var(--border); padding: .6rem; border-radius: 6px; font-size: .8rem; width: 210px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
            <div style="color:var(--text3); font-size:0.65rem; font-weight:bold; margin-bottom:4px; display:flex; justify-content:space-between;">
              <span>🆔 ${m.id.toUpperCase()}</span>
              ${m.gironeProvenienza ? `<span style="color:var(--gold);">${m.gironeProvenienza}</span>` : ''}
            </div>
            <div style="padding: 2px 0; color:#fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">🏠 ${nameHome}</div>
            <div style="padding: 2px 0; color:var(--text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">🚀 ${nameAway}</div>
          </div>
        `;
      }).join('<div style="height: 1.2rem;"></div>');

      return `
        <div style="display: flex; flex-direction: column; align-items: center;">
          <div style="background: var(--card2); color: var(--accent); padding: .4rem .8rem; font-family:'Bebas Neue',sans-serif; font-size:1.1rem; border-radius:4px; margin-bottom:1rem; border:1px solid var(--border); letter-spacing:0.5px;">
            ${faseObj.nomeFase.toUpperCase()}
          </div>
          <div style="display: flex; flex-direction: column; justify-content: center; height: 100%;">
            ${htmlIncontri}
          </div>
        </div>
      `;
    }).join(`
      <div style="display:flex; align-items:center; color:var(--text3);">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    `);
  }
};

/* ─── Funzioni Globali d'Azione Modulo ─────────────────────────────────── */

window.salvaAssociazioniGw = async function() {
  const targetCompId = window.CURRENT_COMPETITION;
  const selects = document.querySelectorAll('.assoc-select');
  let nuovaMappatura = {};

  selects.forEach(sel => {
    const realGw = sel.getAttribute('data-real-gw');
    const compGw = sel.value;
    if (compGw) {
      nuovaMappatura[realGw] = compGw;
    }
  });

  try {
    const database = CalendarioSection.db || getDatabase();
    await update(ref(database, `competitions/${targetCompId}`), { 
      associazioniGwReali: nuovaMappatura 
    });
    window.toast?.("✅ Mappatura giornate salvata!", "ok");
  } catch (err) {
    window.toast?.("Errore nel salvataggio", "err");
  }
};

window.changeCalendarTargetComp = function(compId) {
  window.CURRENT_COMPETITION = compId;
  CalendarioSection._isEditingManually = false;
  CalendarioSection.updateBadgeDinamici(compId);
  if (typeof window.toast === "function") {
    window.toast(`Configurazione orientata su: ${compId.toUpperCase()}`, "info");
  }
};

window.attivaModificaManualeGironi = function() {
  CalendarioSection._isEditingManually = true;
  CalendarioSection.updateBadgeDinamici(window.CURRENT_COMPETITION);
};

window.annullaModificaManualeGironi = function() {
  CalendarioSection._isEditingManually = false;
  CalendarioSection.updateBadgeDinamici(window.CURRENT_COMPETITION);
};

window.salvaModificheGironiManuali = async function() {
  const targetCompId = window.CURRENT_COMPETITION;
  const comp = CalendarioSection._currentCompetitions.find(c => c.id === targetCompId);
  if (!comp) return;

  const selectors = document.querySelectorAll('.class-manual-team-slot');
  let nuovaStruttura = JSON.parse(JSON.stringify(comp.strutturaGironi));

  let allSelectedIds = [];
  selectors.forEach(sel => {
    const gironeKey = sel.getAttribute('data-girone');
    const slotIndex = parseInt(sel.getAttribute('data-slot'));
    const chosenValue = sel.value;

    nuovaStruttura[gironeKey][slotIndex] = chosenValue;
    allSelectedIds.push(chosenValue);
  });

  const haDuplicati = allSelectedIds.some((val, i) => allSelectedIds.indexOf(val) !== i);
  if (haDuplicati) {
    return window.toast?.("Errore: Ci sono squadre duplicate nei gironi!", "err");
  }

  if (!confirm("Vuoi salvare la composizione manuale dei gruppi su Firebase?")) return;

  try {
    const database = CalendarioSection.db || getDatabase();
    await update(ref(database, `competitions/${targetCompId}`), { strutturaGironi: nuovaStruttura });
    window.toast?.("💾 Gironi personalizzati salvati con successo!", "ok");
    comp.strutturaGironi = nuovaStruttura;
    CalendarioSection._isEditingManually = false;
    CalendarioSection.updateBadgeDinamici(targetCompId);
  } catch (err) {
    console.error(err);
    window.toast?.("Errore durante il salvataggio manuale dei gruppi", "err");
  }
};

window.sorteggiaGironiCompetizione = async function() {
  const targetCompId = window.CURRENT_COMPETITION;
  const comp = CalendarioSection._currentCompetitions.find(c => c.id === targetCompId);
  if (!comp) return window.toast?.("Seleziona una competizione!", "err");

  let squadreIscritte = [];
  if (comp.teams) {
    squadreIscritte = Array.isArray(comp.teams) ? comp.teams : Object.values(comp.teams);
  }
  squadreIscritte = squadreIscritte.filter(id => id !== null && id !== undefined).map(id => String(id));

  const numGironi = parseInt(comp.gironi) || 1;
  if (numGironi <= 1) return window.toast?.("Questa competizione non prevede gironi multipli!", "err");
  if (squadreIscritte.length < numGironi) return window.toast?.("Squadre insufficienti per riempire i gironi!", "err");

  if (!confirm(`Effettuare un nuovo sorteggio randomico per i ${numGironi} gironi? Verrà sovrascritta la struttura attuale.`)) return;

  let mixTeams = [...squadreIscritte].sort(() => Math.random() - 0.5);
  let strutturaGironi = {};
  for (let idx = 1; idx <= numGironi; idx++) {
    strutturaGironi[`Girone ${idx}`] = [];
  }

  mixTeams.forEach((teamId, index) => {
    const targetGironeKey = `Girone ${(index % numGironi) + 1}`;
    strutturaGironi[targetGironeKey].push(teamId);
  });

  try {
    const database = CalendarioSection.db || getDatabase();
    await update(ref(database, `competitions/${targetCompId}`), { strutturaGironi: strutturaGironi });
    window.toast?.("🎲 Sorteggio gironi effettuato!", "ok");
    comp.strutturaGironi = strutturaGironi;
    CalendarioSection._isEditingManually = false;
    CalendarioSection.updateBadgeDinamici(targetCompId);
  } catch (err) {
    window.toast?.("Errore durante il sorteggio", "err");
  }
};

/* ─── NUOVA FUNZIONE: LOGICA GENERAZIONE E CALCOLO DEL TABELLONE FASE FINALE ─── */
window.creaTabelloneFaseFinale = async function() {
  const targetCompId = window.CURRENT_COMPETITION;
  const comp = CalendarioSection._currentCompetitions.find(c => c.id === targetCompId);
  
  if (!comp) return window.toast?.("Seleziona una competizione valida!", "err");
  if (comp.type === 'campionato') {
    return window.toast?.("Impossibile creare un tabellone per un Campionato standard!", "err");
  }

  const playoffMode = document.getElementById('playoffRotationType').value;
  let strutturaAlberofasi = {}; 
  let matchesFaseFinaleNode = {}; 
  let totalTeams = Array.isArray(comp.teams) ? comp.teams : Object.values(comp.teams || {});
  totalTeams = totalTeams.filter(id => id).map(String);

  // ─────────────────────────────────────────────────────────────────────────
  // CASO 1: COMPETIZIONE DIRETTA
  // ─────────────────────────────────────────────────────────────────────────
  if (comp.type === 'diretta') {
    if (totalTeams.length < 2) return window.toast?.("Servono almeno 2 squadre per creare una diretta!", "err");
    
    // Mescoliamo le squadre per l'eliminazione diretta pura
    squadreTabellone = [...totalTeams].sort(() => Math.random() - 0.5);
    const count = squadreTabellone.length;

    if (!confirm(`Generare un tabellone ad eliminazione diretta pura per ${count} squadre?`)) return;

    // Determiniamo la fase di partenza in base alla potenza di 2
    let nomeFasePartenza = "Fase Finale";
    if (count <= 2) nomeFasePartenza = "Finale";
    else if (count <= 4) nomeFasePartenza = "Semifinali";
    else if (count <= 8) nomeFasePartenza = "Quarti di Finale";
    else nomeFasePartenza = "Ottavi di Finale";

    let matchPartenza = [];
    let matchIdIndex = 1;

    for (let i = 0; i < count; i += 2) {
      if (i + 1 < count) {
        matchPartenza.push({
          id: `tf1_m${matchIdIndex}`,
          homeId: squadreTabellone[i],
          awayId: squadreTabellone[i + 1]
        });
        matchIdIndex++;
      } else {
        // Squadra che passa per turno di riposo se dispari
        matchPartenza.push({
          id: `tf1_m${matchIdIndex}`,
          homeId: squadreTabellone[i],
          awayId: "BYE / RIPOSO"
        });
        matchIdIndex++;
      }
    }

    strutturaAlberofasi["fase_1_diretta"] = {
      nomeFase: nomeFasePartenza,
      matchList: matchPartenza
    };

    // Generazione automatica dei round ad albero successivi (Segnaposto)
    let currentMatchCount = matchPartenza.length;
    let step = 2;
    while (currentMatchCount > 1) {
      let nextMatchCount = Math.ceil(currentMatchCount / 2);
      let nextMatches = [];
      for (let k = 1; k <= nextMatchCount; k++) {
        nextMatches.push({
          id: `tf${step}_m${k}`,
          homeId: `VINCENTE_tf${step-1}_m${(k*2)-1}`,
          awayId: (k*2) <= currentMatchCount ? `VINCENTE_tf${step-1}_m${k*2}` : "BYE"
        });
      }
      
      let nomeFaseFtr = "Fase Successiva";
      if (nextMatchCount === 4) nomeFaseFtr = "Quarti di Finale";
      if (nextMatchCount === 2) nomeFaseFtr = "Semifinali";
      if (nextMatchCount === 1) nomeFaseFtr = "Finale";

      strutturaAlberofasi[`fase_${step}_diretta`] = {
        nomeFase: nomeFaseFtr,
        matchList: nextMatches
      };
      currentMatchCount = nextMatchCount;
      step++;
    }

  // ─────────────────────────────────────────────────────────────────────────
  // CASO 2: COMPETIZIONE MISTA STANDARD
  // ─────────────────────────────────────────────────────────────────────────
  } else if (comp.type === 'misto') {
    if (!comp.strutturaGironi) return window.toast?.("Devi prima generare e completare i gironi della Regular Season!", "err");
    
    const numQualificatePerGirone = parseInt(comp.qualificatiFaseFinale) || 2;
    const gironiKeys = Object.keys(comp.strutturaGironi);

    if (numQualificatePerGirone !== 2 || gironiKeys.length !== 4) {
      return window.toast?.("Questa automazione supporta il formato standard: 4 gironi con 2 qualificate ciascuno (Totale 8 squadre per i Quarti)!", "err");
    }

    if (!confirm("Generare il Tabellone dei Quarti accoppiando Prime contro Seconde (evitando squadre dello stesso girone)?")) return;

    // Simulazione/Raccolta delle teste di serie (Prime e Seconde)
    // In produzione queste saranno calcolate dalla classifica reale dei gironi
    let primeClassificate = [];
    let secondeClassificate = [];

    gironiKeys.forEach(gKey => {
      const sqGirone = comp.strutturaGironi[gKey] || [];
      if (sqGirone.length >= 2) {
        primeClassificate.push({ id: sqGirone[0], girone: gKey });
        secondeClassificate.push({ id: sqGirone[1], girone: gKey });
      }
    });

    // Algoritmo di accoppiamento Quarti di Finale (Prime vs Seconde, senza ripetere lo stesso girone)
    let matchQuarti = [];
    let secondeUsate = new Set();

    for (let i = 0; i < primeClassificate.length; i++) {
      const prima = primeClassificate[i];
      let trovata = false;

      for (let j = 0; j < secondeClassificate.length; j++) {
        const seconda = secondeClassificate[j];
        if (!secondeUsate.has(seconda.id) && seconda.girone !== prima.girone) {
          matchQuarti.push({
            id: `qf_m${i+1}`,
            gironeProvenienza: `${prima.girone} vs ${seconda.girone}`,
            homeId: prima.id,
            awayId: seconda.id
          });
          secondeUsate.add(seconda.id);
          trovata = true;
          break;
        }
      }

      // Fallback di sicurezza algoritmica
      if (!trovata) {
        const secondaLibera = secondeClassificate.find(s => !secondeUsate.has(s.id));
        if (secondaLibera) {
          matchQuarti.push({
            id: `qf_m${i+1}`,
            gironeProvenienza: "Incrocio Forzato",
            homeId: prima.id,
            awayId: secondaLibera.id
          });
          secondeUsate.add(secondaLibera.id);
        }
      }
    }

    strutturaAlberofasi["fase_1_quarti"] = { nomeFase: "Quarti di Finale", matchList: matchQuarti };
    strutturaAlberofasi["fase_2_semifinali"] = {
      nomeFase: "Semifinali",
      matchList: [
        { id: "sf_m1", homeId: "VINCENTE_qf_m1", awayId: "VINCENTE_qf_m2" },
        { id: "sf_m2", homeId: "VINCENTE_qf_m3", awayId: "VINCENTE_qf_m4" }
      ]
    };
    strutturaAlberofasi["fase_3_finale"] = {
      nomeFase: "Finalissima",
      matchList: [{ id: "fn_m1", homeId: "VINCENTE_sf_m1", awayId: "VINCENTE_sf_m2" }]
    };

  // ─────────────────────────────────────────────────────────────────────────
  // CASO 3: COMPETIZIONE MISTO SPECIALE
  // ─────────────────────────────────────────────────────────────────────────
  } else if (comp.type === 'misto-speciale') {
    // Regole: 12 e 11 eliminati. 10 vs 7 (Playoff 1), 9 vs 8 (Playoff 2).
    // Quarti: 6 vs 3, 5 vs 4. L'1 scontra il vincente Playoff 2, il 2 scontra il vincente Playoff 1.
    if (totalTeams.length < 10) {
      return window.toast?.("Il Misto Speciale richiede la presenza di almeno 10/12 squadre posizionate!", "err");
    }

    if (!confirm("Generare il Tabellone con le regole speciali (Playoff per posizioni 7-10, Quarti di finale per 1-6)?")) return;

    // Utilizziamo l'ordine della classifica pre-esistente per simulare le posizioni 1-12
    let pos = [...totalTeams]; 

    strutturaAlberofasi["fase_1_playoff"] = {
      nomeFase: "Playoff Preliminari",
      matchList: [
        { id: "po_m1", homeId: pos[6] || "7° Classificato", awayId: pos[9] || "10° Classificato" }, // 7 vs 10
        { id: "po_m2", homeId: pos[7] || "8° Classificato", awayId: pos[8] || "9° Classificato" }   // 8 vs 9
      ]
    };

    strutturaAlberofasi["fase_2_quarti"] = {
      nomeFase: "Quarti di Finale",
      matchList: [
        { id: "qf_m1", homeId: pos[0] || "1° Classificato", awayId: "VINCENTE_po_m2" },            // 1 vs Vincente Playoff 2
        { id: "qf_m2", homeId: pos[1] || "2° Classificato", awayId: "VINCENTE_po_m1" },            // 2 vs Vincente Playoff 1
        { id: "qf_m3", homeId: pos[2] || "3° Classificato", awayId: pos[5] || "6° Classificato" }, // 3 vs 6
        { id: "qf_m4", homeId: pos[3] || "4° Classificato", awayId: pos[4] || "5° Classificato" }  // 4 vs 5
      ]
    };

    strutturaAlberofasi["fase_3_semifinali"] = {
      nomeFase: "Semifinali",
      matchList: [
        { id: "sf_m1", homeId: "VINCENTE_qf_m1", awayId: "VINCENTE_qf_m4" },
        { id: "sf_m2", homeId: "VINCENTE_qf_m2", awayId: "VINCENTE_qf_m3" }
      ]
    };

    strutturaAlberofasi["fase_4_finale"] = {
      nomeFase: "Finalissima",
      matchList: [{ id: "fn_m1", homeId: "VINCENTE_sf_m1", awayId: "VINCENTE_sf_m2" }]
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TRASFORMAZIONE DELL'ALBERO IN GIORNATE DI CALENDARIO REALI (Firebase `matches`)
  // ─────────────────────────────────────────────────────────────────────────
  let globalGwCounter = 1;
  const chiaviFasi = Object.keys(strutturaAlberofasi).sort();

  chiaviFasi.forEach(chiaveFase => {
    const fase = strutturaAlberofasi[chiaveFase];
    const isFinaleSecca = (fase.nomeFase.toLowerCase().includes("finale") && !fase.nomeFase.toLowerCase().includes("quarti") && !fase.nomeFase.toLowerCase().includes("semi"));

    // 1. Gara di Andata
    let matchGiornataAndata = {};
    fase.matchList.forEach((m) => {
      matchGiornataAndata[`match_a_${m.id}`] = {
        id: `match_a_${m.id}`,
        phaseKey: chiaveFase,
        phaseName: fase.nomeFase,
        type: isFinaleSecca ? "FINALE" : "ELIMINAZIONE_DIRETTA",
        couples: {
          m1: { 
            id: m.id, 
            homeId: m.homeId, 
            awayId: m.awayId, 
            homeScore: null, 
            awayScore: null, 
            finished: false 
          }
        },
        lineups: {},
        label: `${fase.nomeFase} - Andata`
      };
    });
    matchesFaseFinaleNode[`gw_playoff_${globalGwCounter}`] = matchGiornataAndata;
    globalGwCounter++;

    // 2. Gara di Ritorno (se necessaria)
    if (playoffMode === 'andata-ritorno' && !isFinaleSecca) {
      let matchGiornataRitorno = {};
      fase.matchList.forEach((m) => {
        matchGiornataRitorno[`match_r_${m.id}`] = {
          id: `match_r_${m.id}`,
          phaseKey: chiaveFase,
          phaseName: fase.nomeFase,
          type: "ELIMINAZIONE_DIRETTA_RITORNO",
          couples: {
            m1: { 
              id: m.id, 
              homeId: m.awayId, 
              awayId: m.homeId, 
              homeScore: null, 
              awayScore: null, 
              finished: false 
            }
          },
          lineups: {},
          label: `${fase.nomeFase} - Ritorno`
        };
      });
      matchesFaseFinaleNode[`gw_playoff_${globalGwCounter}`] = matchGiornataRitorno;
      globalGwCounter++;
    }
  });

  // --- SALVATAGGIO SU FIREBASE ---
  try {
    const database = CalendarioSection.db || getDatabase();
    
    // Salvataggio 1: Struttura Albero
    await update(ref(database, `competitions/${targetCompId}`), {
      tabelloneStructure: {
        tipoGenerato: comp.type,
        regolaIncontri: playoffMode,
        fasi: strutturaAlberofasi
      }
    });

    // Salvataggio 2: Giornate (Matches)
    await update(ref(database, `competitions/${targetCompId}/matches`), matchesFaseFinaleNode);
    
    window.toast?.("🏆 Tabellone salvato con successo!", "ok");
    CalendarioSection.updateBadgeDinamici(targetCompId);
    
  } catch (err) {
    console.error("Errore salvataggio:", err);
    window.toast?.("Errore durante il salvataggio", "err");
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

  // --- LOGICA MISTO ---
  if ((comp.type === 'misto' || comp.type === 'misto-speciale') && numGironiPrevisti > 1) {
    if (!comp.strutturaGironi) {
      return window.toast?.("Devi prima effettuare il sorteggio!", "err");
    }

    const gironiIds = Object.keys(comp.strutturaGironi);
    let agendeGironi = {};
    let maxGiornateFase = 0;

    gironiIds.forEach(gId => {
      let lista = [...comp.strutturaGironi[gId]];
      if (lista.length % 2 !== 0) lista.push("RIPOSO");
      
      const n = lista.length;
      const turniUnici = n - 1; 
      let giri = rotationType === 'andata-ritorno' ? 2 : (rotationType === 'tre-giri' ? 3 : 1);
      
      const giornateTotaliGirone = turniUnici * giri;
      if (giornateTotaliGirone > maxGiornateFase) maxGiornateFase = giornateTotaliGirone;

      agendeGironi[gId] = { squadre: lista, turniUnici: turniUnici, giornateTotali: giornateTotaliGirone };
    });

    for (let g = 1; g <= maxGiornateFase; g++) {
      let matchGiornata = {};
      let matchCounter = 1;

      gironiIds.forEach(gId => {
        const agenda = agendeGironi[gId];
        if (g > agenda.giornateTotali) return; 

        const lista = agenda.squadre;
        const numSquadre = lista.length;
        const gironeCorrente = Math.floor((g - 1) / agenda.turniUnici);
        const turnoNelGirone = (g - 1) % agenda.turniUnici;
        const inverti = (gironeCorrente === 1 || gironeCorrente === 3); 

        for (let m = 0; m < (numSquadre / 2); m++) {
          let casaIdx = (turnoNelGirone + m) % (numSquadre - 1);
          let trasfIdx = m === 0 ? numSquadre - 1 : (numSquadre - 1 - m + turnoNelGirone) % (numSquadre - 1);
          
          let idCasa = lista[casaIdx];
          let idTrasf = lista[trasfIdx];

          if (idCasa === "RIPOSO" || idTrasf === "RIPOSO") continue;
          if (inverti) { let tmp = idCasa; idCasa = idTrasf; idTrasf = tmp; }

          matchGiornata[`m${matchCounter}`] = {
            id: `m${matchCounter}`,
            couples: { m1: { id: `m${matchCounter}`, homeId: idCasa, awayId: idTrasf, homeScore: null, awayScore: null, finished: false } },
            lineups: {},
            girone: gId
          };
          matchCounter++;
        }
      });
      if (Object.keys(matchGiornata).length > 0) calendarioCompleto[`gw${g}`] = matchGiornata;
    }
  } else { 
    // --- LOGICA STANDARD ---
    let squadreIscritte = (comp.teams ? (Array.isArray(comp.teams) ? comp.teams : Object.values(comp.teams)) : []).filter(id => id).map(String);
    if (squadreIscritte.length < 2) return window.toast?.("Servono almeno 2 squadre!", "err");

    let lista = [...squadreIscritte].sort(() => Math.random() - 0.5);
    if (lista.length % 2 !== 0) lista.push("RIPOSO");

    const numSquadre = lista.length;
    const turniUnici = numSquadre - 1;
    let giri = rotationType === 'andata-ritorno' ? 2 : (rotationType === 'tre-giri' ? 3 : 1);
    
    for (let g = 1; g <= (turniUnici * giri); g++) {
      let matchGiornata = {};
      let counter = 1;
      const gironeCorrente = Math.floor((g - 1) / turniUnici);
      const turnoNelGirone = (g - 1) % turniUnici;
      const inverti = (gironeCorrente === 1 || gironeCorrente === 3);

      for (let m = 0; m < (numSquadre / 2); m++) {
        let casaIdx = (turnoNelGirone + m) % turniUnici;
        let trasfIdx = m === 0 ? turniUnici : (turniUnici - m + turnoNelGirone) % turniUnici;
        
        let idCasa = lista[casaIdx];
        let idTrasf = lista[trasfIdx];

        if (idCasa !== "RIPOSO" && idTrasf !== "RIPOSO") {
          if (inverti) { let tmp = idCasa; idCasa = idTrasf; idTrasf = tmp; }
          matchGiornata[`m${counter}`] = { id: `m${counter}`, homeId: idCasa, awayId: idTrasf, homeScore: null, awayScore: null, finished: false };
          counter++;
        }
      }
      calendarioCompleto[`gw${g}`] = matchGiornata;
    }
  }

  // --- SALVATAGGIO ---
  try {
    const database = CalendarioSection.db || getDatabase();
    await set(ref(database, `competitions/${targetCompId}/matches`), calendarioCompleto);
    await set(ref(database, `competitions/${targetCompId}/status`), { currentGW: 1 });
    window.toast?.("🎯 Calendario salvato!", "ok");
  } catch (err) {
    window.toast?.("Errore salvataggio Firebase", "err");
  }
};
