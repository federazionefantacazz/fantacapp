import { ref, get, update, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
// Importazione del servizio live condiviso
import { CalcoloMatchService } from "../services/calcoloMatch.js";

export const DashboardSection = {
  db: null,
  _competitions: [],

  init(database) {
    this.db = database;
    this.registerGlobalActions();
  },

  renderHTML() {
    return `
      <div id="sec-dashboard" class="admin-sec" style="display:block;">
        <h2 class="sec-title">📊 Dashboard Patron</h2>
        
        <div class="card" style="max-width: 500px;">
          <div class="label" style="color: var(--accent); margin-bottom: .6rem; font-size: .85rem;">
            Stato Campionato & Giornata Reale (Serie A)
          </div>
          <p style="font-size: .85rem; color: var(--text2); margin-bottom: 1rem;">
            Seleziona la giornata corrente del campionato reale.
          </p>
          
          <div style="display: flex; flex-direction: column; gap: .4rem;">
            <label class="label" for="realGwSelect">Giornata Attiva:</label>
            <select id="realGwSelect" class="input-login" style="margin: 0; padding: .75rem;" onchange="window.changeRealGW(this.value)">
            </select>
          </div>
          <div id="dashboard-status-badge" style="margin-top: 1rem; font-size: .85rem; font-weight: 500;"></div>
        </div>

        <div class="card" style="max-width: 500px;">
          <div class="label" style="color: var(--accent); margin-bottom: .6rem; font-size: .85rem;">
            🔴 Stato Calcolo Live Piattaforma
          </div>
          <p style="font-size: .8rem; color: var(--text2); margin-bottom: 1rem;">
            Abilita o disabilita il calcolo in tempo reale su tutto il sito (Stato Globale). Successivamente questo stato condizionerà le competizioni.
          </p>
          
          <div style="display: flex; flex-direction: column; gap: .4rem; margin-bottom: 1rem;">
            <label class="label" for="globalLiveSelect">Stato Live Generale:</label>
            <select id="globalLiveSelect" class="input-login" style="margin: 0; padding: .75rem;" onchange="window.changeGlobalLiveStatus(this.value)">
              <option value="false">❌ Disabilitato (Statico / Risultati Definitivi)</option>
              <option value="true">🟢 Abilitato (Calcolo in Tempo Reale Attivo)</option>
            </select>
          </div>
          <div id="dashboard-live-badge" style="font-size: .85rem; font-weight: 500;"></div>
        </div>

        <div class="card" style="max-width: 500px;">
          <div class="label" style="color: var(--accent); margin-bottom: .6rem; font-size: .85rem;">
            🧮 Calcolatore Risultati Giornata (Salvataggio Master)
          </div>
          <p style="font-size: .8rem; color: var(--text2); margin-bottom: 1rem;">
            Elabora i fantavoti, calcola i punteggi delle squadre, congela i match di questa giornata e aggiorna la classifica o il tabellone.
          </p>
          
          <div style="display: flex; flex-direction: column; gap: .75rem; margin-bottom: 1rem;">
            <div>
              <label class="label">Competizione Target:</label>
              <select id="calcCompSelect" class="input-login" style="margin:0; padding: .65rem;">
                <option value="">Caricamento competizioni...</option>
              </select>
            </div>
            <div>
              <label class="label">Giornata di Gioco (GW):</label>
              <input type="number" id="calcGwInput" class="input-login" style="margin:0; padding: .65rem;" value="1" min="1">
            </div>
          </div>
          
          <button class="btn btn-green" onclick="window.eseguiCalcoloPunteggi()">⚡ Salva Risultati Ufficiali e Classifica</button>
        </div>
      </div>
    `;
  },

  render(state) {
    this._competitions = state.competitions || [];
    const activeCompId = window.CURRENT_COMPETITION || (this._competitions[0]?.id || "");

    const selectEl = document.getElementById('realGwSelect');
    if (selectEl && selectEl.options.length === 0) {
      let optionsHtml = `<option value="0">⏳ Giornata 0 (Prima del Campionato)</option>`;
      for (let i = 1; i <= 38; i++) {
        optionsHtml += `<option value="${i}">⚽ Giornata ${i}</option>`;
      }
      selectEl.innerHTML = optionsHtml;
    }
    if (selectEl) selectEl.value = state.CURRENT_REAL_GW !== undefined ? state.CURRENT_REAL_GW : 0;

    const badgeEl = document.getElementById('dashboard-status-badge');
    if (badgeEl) {
      const currentRealGw = state.CURRENT_REAL_GW !== undefined ? state.CURRENT_REAL_GW : 0;
      badgeEl.innerHTML = currentRealGw === 0 
        ? `<span class="badge badge-blue">Pre-Campionato attivo</span>` 
        : `<span class="badge badge-green">Campionato in corso: ${currentRealGw}ª Giornata</span>`;
    }

    const globalLiveSelect = document.getElementById('globalLiveSelect');
    const liveBadgeEl = document.getElementById('dashboard-live-badge');
    
    const isGlobalLive = state.LIVE === true || state.LIVE === "true";
    if (globalLiveSelect) globalLiveSelect.value = isGlobalLive ? "true" : "false";
    
    if (liveBadgeEl) {
      liveBadgeEl.innerHTML = isGlobalLive
        ? `<span class="badge badge-green">LIVE GLOBALE ATTIVO (status/live = true)</span>`
        : `<span class="badge badge-gray">LIVE GLOBALE DISABILITATO (status/live = false)</span>`;
    }

    const calcCompSelect = document.getElementById('calcCompSelect');
    if (calcCompSelect) {
      if (this._competitions.length === 0) {
        calcCompSelect.innerHTML = '<option value="">Nessuna competizione trovata</option>';
      } else {
        calcCompSelect.innerHTML = this._competitions.map(c => `
          <option value="${c.id}" ${activeCompId === c.id ? 'selected' : ''}>🏆 ${c.name}</option>
        `).join('');
      }
    }
    
    const currentComp = this._competitions.find(c => c.id === activeCompId);
    const calcGwInput = document.getElementById('calcGwInput');
    if (currentComp && calcGwInput && !calcGwInput.dataset.userEdited) {
      calcGwInput.value = currentComp.status?.currentGW || 1;
    }
  },

  registerGlobalActions() {
    document.addEventListener('input', (e) => {
      if (e.target.id === 'calcGwInput') e.target.dataset.userEdited = "true";
    });

    window.changeGlobalLiveStatus = async (value) => {
      if (!this.db) return console.error("Database non inizializzato");
      const isLive = value === "true";
      try {
        await set(ref(this.db, 'status/live'), isLive);
        window.toast(`Stato Live globale impostato su: ${isLive}`, "ok");
      } catch (err) {
        console.error(err);
        window.toast("Errore nel salvataggio del live globale", "err");
      }
    };

    window.eseguiCalcoloPunteggi = async () => {
      if (!this.db) return console.error("Database non inizializzato");

      const compId = document.getElementById('calcCompSelect')?.value;
      const gwNum = document.getElementById('calcGwInput')?.value;
      if (!compId || !gwNum) return window.toast("Competizione e Giornata obbligatorie!", "err");

      const gwId = `gw${gwNum}`;

      try {
        window.toast("Esecuzione calcolo master e congelamento giornata...", "info");

        // 1. Recupero dati competizione
        const compSnap = await get(ref(this.db, `competitions/${compId}`));
        if (!compSnap.exists()) return window.toast("Competizione non trovata!", "err");
        const compData = compSnap.val();

        // 2. Recupero Voti Globale
        const votesSnap = await get(ref(this.db, `votes/${gwId}`));
        if (!votesSnap.exists()) {
          return window.toast(`Nessun voto inserito per la giornata ${gwId.toUpperCase()}!`, "err");
        }
        const votiGiocatori = votesSnap.val();

        // 3. Recupero Match della giornata
        const matchesSnap = await get(ref(this.db, `competitions/${compId}/matches/${gwId}/couples`));
        if (!matchesSnap.exists()) {
          return window.toast("Nessun match trovato per questa giornata in questa competizione.", "err");
        }
        const couples = matchesSnap.val();

        // 4. Recupero Lineups della giornata
        const lineupsSnap = await get(ref(this.db, `competitions/${compId}/matches/${gwId}/lineups`));
        const allLineups = lineupsSnap.exists() ? lineupsSnap.val() : {};

        const updates = {};
        const mappaFantavotiLocali = {};

        // 5. Calcolo Voti Giocatori
        Object.keys(votiGiocatori).forEach(playerId => {
          const datiVoto = votiGiocatori[playerId];
          if (datiVoto && datiVoto.voto !== undefined) {
            const fantavotoFinale = CalcoloMatchService.calcolaFantavoto(datiVoto);
            updates[`votes/${gwId}/${playerId}/fantavoto`] = fantavotoFinale;
            mappaFantavotiLocali[playerId] = fantavotoFinale;
          }
        });

        // 6. Elaborazione Risultati Match di Giornata
        Object.keys(couples).forEach(matchKey => {
          const match = couples[matchKey];
          const homeTeamId = match.homeId || match.home || match.idHome;
          const awayTeamId = match.awayId || match.away || match.idAway;

          const ptHome = CalcoloMatchService.calcolaTotaleSquadra(allLineups, homeTeamId, mappaFantavotiLocali);
          const ptAway = CalcoloMatchService.calcolaTotaleSquadra(allLineups, awayTeamId, mappaFantavotiLocali);

          const gHome = CalcoloMatchService.calcolaGol(ptHome);
          const gAway = CalcoloMatchService.calcolaGol(ptAway);

          const basePath = `competitions/${compId}/matches/${gwId}/couples/${matchKey}`;
          updates[`${basePath}/punteggioFinaleHome`] = ptHome;
          updates[`${basePath}/punteggioFinaleAway`] = ptAway;
          updates[`${basePath}/goalHome`] = gHome;
          updates[`${basePath}/goalAway`] = gAway;
          updates[`${basePath}/finished`] = true;

          // Aggiornamento Classifica Standard (se NON è a eliminazione diretta pura)
          if (compData.type !== 'diretta') {
            let puntiHome = 0, puntiAway = 0;
            let vHome = 0, dHome = 0, lHome = 0;
            let vAway = 0, dAway = 0, lAway = 0;

            if (gHome > gAway) {
              puntiHome = 3; vHome = 1; puntiAway = 0; lAway = 1;
            } else if (gHome < gAway) {
              puntiHome = 0; lHome = 1; puntiAway = 3; vAway = 1;
            } else {
              puntiHome = 1; dHome = 1; puntiAway = 1; dAway = 1;
            }

            if (homeTeamId) {
              const classHomePath = `competitions/${compId}/classifica/${gwId}/${homeTeamId}`;
              updates[`${classHomePath}/punteggiofanta`] = ptHome;
              updates[`${classHomePath}/punti`] = puntiHome;
              updates[`${classHomePath}/golFatti`] = gHome;
              updates[`${classHomePath}/golSubiti`] = gAway;
              updates[`${classHomePath}/vittoria`] = vHome;
              updates[`${classHomePath}/pareggio`] = dHome;
              updates[`${classHomePath}/sconfitta`] = lHome;
            }

            if (awayTeamId) {
              const classAwayPath = `competitions/${compId}/classifica/${gwId}/${awayTeamId}`;
              updates[`${classAwayPath}/punteggiofanta`] = ptAway;
              updates[`${classAwayPath}/punti`] = puntiAway;
              updates[`${classAwayPath}/golFatti`] = gAway;
              updates[`${classAwayPath}/golSubiti`] = gHome;
              updates[`${classAwayPath}/vittoria`] = vAway;
              updates[`${classAwayPath}/pareggio`] = dAway;
              updates[`${classAwayPath}/sconfitta`] = lAway;
            }
          }
        });

        // 7. GESTIONE TABELLONE ED ELIMINAZIONE DIRETTA (Avanzamento Vincenti)
        if ((compData.type === 'diretta' || compData.type === 'misto' || compData.type === 'misto-speciale') && compData.tabelloneStructure && compData.tabelloneStructure.fasi) {
          const tabellone = compData.tabelloneStructure;
          const regola = tabellone.regolaIncontri || tabellone.tipoScontro || tabellone.modalita;
          const isAndataRitorno = regola === 'andata-ritorno' || regola === 'andata_ritorno';
          
          const allMatchesSnap = await get(ref(this.db, `competitions/${compId}/matches`));
          const allMatches = allMatchesSnap.exists() ? allMatchesSnap.val() : {};

          // Includiamo temporaneamente i risultati calcolati nello step 6 per consentire la valutazione immediata
          allMatches[gwId] = allMatches[gwId] || { couples: {} };
          Object.keys(couples).forEach(matchKey => {
            const match = couples[matchKey];
            const homeTeamId = match.homeId || match.home || match.idHome;
            const awayTeamId = match.awayId || match.away || match.idAway;
            
            const ptHome = CalcoloMatchService.calcolaTotaleSquadra(allLineups, homeTeamId, mappaFantavotiLocali);
            const ptAway = CalcoloMatchService.calcolaTotaleSquadra(allLineups, awayTeamId, mappaFantavotiLocali);

            allMatches[gwId].couples[matchKey] = {
              ...match,
              punteggioFinaleHome: ptHome,
              punteggioFinaleAway: ptAway,
              goalHome: CalcoloMatchService.calcolaGol(ptHome),
              goalAway: CalcoloMatchService.calcolaGol(ptAway),
              finished: true
            };
          });

          const fasi = tabellone.fasi;
          const fasiKeys = Object.keys(fasi).sort();

          fasiKeys.forEach((faseKey, index) => {
            const faseObj = fasi[faseKey];
            const matchList = faseObj.matchList || [];

            matchList.forEach((m) => {
              const matchId = m.id; // es: "tf1_m2"
              let vincenteId = null;

              if (!isAndataRitorno) {
                // --- SOLO ANDATA ---
                let foundMatch = null;
                Object.keys(allMatches).forEach(gw => {
                  const couplesGw = allMatches[gw].couples || {};
                  if (couplesGw[matchId] && couplesGw[matchId].finished) {
                    foundMatch = couplesGw[matchId];
                  }
                });

                if (foundMatch) {
                  const gH = Number(foundMatch.goalHome ?? foundMatch.homeScore ?? 0);
                  const gA = Number(foundMatch.goalAway ?? foundMatch.awayScore ?? 0);
                  const ptH = Number(foundMatch.punteggioFinaleHome || 0);
                  const ptA = Number(foundMatch.punteggioFinaleAway || 0);

                  if (gH > gA) vincenteId = foundMatch.homeId || foundMatch.home;
                  else if (gA > gH) vincenteId = foundMatch.awayId || foundMatch.away;
                  else {
                    if (ptH > ptA) vincenteId = foundMatch.homeId || foundMatch.home;
                    else if (ptA > ptH) vincenteId = foundMatch.awayId || foundMatch.away;
                    else vincenteId = foundMatch.homeId || foundMatch.home;
                  }
                }
              } else {
                // --- ANDATA E RITORNO ---
                let matchAndata = null;
                let matchRitorno = null;

                Object.keys(allMatches).forEach(gw => {
                  const couplesGw = allMatches[gw].couples || {};
                  if (couplesGw[matchId] && couplesGw[matchId].finished) {
                    matchAndata = couplesGw[matchId];
                  }
                  if (couplesGw[`${matchId}_ritorno`] && couplesGw[`${matchId}_ritorno`].finished) {
                    matchRitorno = couplesGw[`${matchId}_ritorno`];
                  }
                });

                // Avanza solo quando SIA l'Andata CHE il Ritorno sono terminati
                if (matchAndata && matchRitorno) {
                  const hId = matchAndata.homeId || matchAndata.home;
                  const aId = matchAndata.awayId || matchAndata.away;

                  let totGolH = Number(matchAndata.goalHome ?? matchAndata.homeScore ?? 0);
                  let totGolA = Number(matchAndata.goalAway ?? matchAndata.awayScore ?? 0);
                  let totPtH = Number(matchAndata.punteggioFinaleHome || 0);
                  let totPtA = Number(matchAndata.punteggioFinaleAway || 0);

                  if ((matchRitorno.homeId || matchRitorno.home) === aId) {
                    totGolA += Number(matchRitorno.goalHome ?? matchRitorno.homeScore ?? 0);
                    totGolH += Number(matchRitorno.goalAway ?? matchRitorno.awayScore ?? 0);
                    totPtA += Number(matchRitorno.punteggioFinaleHome || 0);
                    totPtH += Number(matchRitorno.punteggioFinaleAway || 0);
                  } else {
                    totGolH += Number(matchRitorno.goalHome ?? matchRitorno.homeScore ?? 0);
                    totGolA += Number(matchRitorno.goalAway ?? matchRitorno.awayScore ?? 0);
                    totPtH += Number(matchRitorno.punteggioFinaleHome || 0);
                    totPtA += Number(matchRitorno.punteggioFinaleAway || 0);
                  }

                  if (totGolH > totGolA) vincenteId = hId;
                  else if (totGolA > totGolH) vincenteId = aId;
                  else {
                    if (totPtH > totPtA) vincenteId = hId;
                    else if (totPtA > totPtH) vincenteId = aId;
                    else vincenteId = hId;
                  }
                }
              }

              // Se abbiamo identificato la vincente, aggiorniamo SIA il tabellone SIA il calendario (matches)!
              if (vincenteId) {
                const targetPlaceholder = `VINCENTE_${matchId}`;

                // A) Aggiorna la struttura visiva del tabellone per le fasi successive
                if (fasiKeys[index + 1]) {
                  const nextFaseKey = fasiKeys[index + 1];
                  const nextMatchList = fasi[nextFaseKey].matchList || [];

                  nextMatchList.forEach((nextM, nextMIndex) => {
                    const basePathNext = `competitions/${compId}/tabelloneStructure/fasi/${nextFaseKey}/matchList/${nextMIndex}`;

                    if (nextM.homeId === targetPlaceholder) {
                      updates[`${basePathNext}/homeId`] = vincenteId;
                    }
                    if (nextM.awayId === targetPlaceholder) {
                      updates[`${basePathNext}/awayId`] = vincenteId;
                    }
                  });
                }

                // B) Aggiorna LE PARTITE NEL CALENDARIO REALE (matches -> gwX -> couples)
                Object.keys(allMatches).forEach(gKey => {
                  const couplesGw = allMatches[gKey].couples || {};
                  Object.keys(couplesGw).forEach(cKey => {
                    const coupleObj = couplesGw[cKey];
                    const couplePath = `competitions/${compId}/matches/${gKey}/couples/${cKey}`;

                    if (coupleObj.homeId === targetPlaceholder) {
                      updates[`${couplePath}/homeId`] = vincenteId;
                    }
                    if (coupleObj.awayId === targetPlaceholder) {
                      updates[`${couplePath}/awayId`] = vincenteId;
                    }
                  });
                });
              }
            });
          });
        }

        // 8. Applicazione Atomica degli Aggiornamenti su Firebase
        await update(ref(this.db), updates);
        window.toast(`🎯 Giornata ${gwId.toUpperCase()} salvata e dati aggiornati correttamente!`, "ok");

      } catch (err) {
        console.error(err);
        window.toast("Errore critico durante il salvataggio completo della giornata", "err");
      }
    };
  }
};
