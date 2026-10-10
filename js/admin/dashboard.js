import { ref, get, update, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
// Importazione del servizio live condiviso
import { CalcoloMatchService } from "../services/calcoloMatch.js";

export const DashboardSection = {
  db: null,
  _competitions: [],
  _onFire: { weeks: 4, players: 5 },

  init(database) {
    this.db = database;
    onValue(ref(this.db, 'status/onFire'), snap => {
      const v = snap.val() || {};
      this._onFire = {
        weeks: Math.max(1, parseInt(v.weeks, 10) || 4),
        players: Math.max(1, parseInt(v.players, 10) || 5)
      };
      this._syncOnFireInputs();
    });
    onValue(ref(this.db, 'probabili/meta'), snap => { this._probMeta = snap.val(); this._renderProbabiliStatus(); });
    onValue(ref(this.db, 'settings/probabiliStatus'), snap => { this._probStatus = snap.val(); this._renderProbabiliStatus(); });
    this.registerGlobalActions();
  },

  _renderProbabiliStatus() {
    const el = document.getElementById('dashboard-probabili-status');
    if (!el) return;
    const fmt = (ts) => ts ? new Date(ts).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
    const m = this._probMeta, st = this._probStatus;
    let html = m
      ? `<span class="badge badge-green">${m.giornata}ª giornata · ${m.matches} partite · ${m.players} giocatori</span><br><span style="font-size:.75rem;">Ultimo aggiornamento dati: ${fmt(m.updatedAt)}</span>`
      : `<span class="badge badge-gray">Nessun dato ancora scaricato</span>`;
    if (st && st.ok === false) {
      html += `<br><span style="color: var(--accent3); font-size:.75rem;">⚠️ Ultimo tentativo fallito (${fmt(st.at)}): ${String(st.error || '').replace(/</g, '&lt;')}</span>`;
    }
    if (this._probPending && (!st || !st.at || st.at < this._probPending)) {
      html += `<br><span style="color: var(--gold); font-size:.75rem;">⏳ Aggiornamento richiesto, attendi qualche secondo...</span>`;
    }
    el.innerHTML = html;
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
            🔥 Giocatori On Fire (Home)
          </div>
          <p style="font-size: .8rem; color: var(--text2); margin-bottom: 1rem;">
            Nella home di ogni patron compaiono i giocatori della sua rosa con la media fantavoto più alta nelle ultime giornate.
          </p>

          <div style="display: flex; gap: .75rem; margin-bottom: .5rem;">
            <div style="flex: 1;">
              <label class="label" for="onFireWeeks">Ultime settimane:</label>
              <select id="onFireWeeks" class="input-login" style="margin: 0; padding: .65rem;" onchange="window.saveOnFireSettings()">
                ${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}">${i + 1} ${i === 0 ? 'giornata' : 'giornate'}</option>`).join('')}
              </select>
            </div>
            <div style="flex: 1;">
              <label class="label" for="onFirePlayers">N° giocatori:</label>
              <select id="onFirePlayers" class="input-login" style="margin: 0; padding: .65rem;" onchange="window.saveOnFireSettings()">
                ${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <div class="card" style="max-width: 500px;">
          <div class="label" style="color: var(--accent); margin-bottom: .6rem; font-size: .85rem;">
            📋 Probabili Formazioni (fantacalcio.it)
          </div>
          <p style="font-size: .8rem; color: var(--text2); margin-bottom: 1rem;">
            Percentuali di impiego, infortunati, squalificati e avversari mostrati ai patron quando scelgono la formazione.
            Si aggiornano da sole ogni 30 minuti; qui puoi forzare un aggiornamento immediato.
          </p>
          <div id="dashboard-probabili-status" style="font-size: .8rem; color: var(--text2); margin-bottom: .8rem;">Caricamento...</div>
          <button class="btn btn-blue" onclick="window.aggiornaProbabiliOra()">🔄 Aggiorna probabili ora</button>
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

    this._syncOnFireInputs();

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

  _syncOnFireInputs() {
    const w = document.getElementById('onFireWeeks');
    const n = document.getElementById('onFirePlayers');
    if (w) w.value = String(this._onFire.weeks);
    if (n) n.value = String(this._onFire.players);
  },

  registerGlobalActions() {
    window.aggiornaProbabiliOra = async () => {
      if (!this.db) return console.error("Database non inizializzato");
      try {
        this._probPending = Date.now();
        await set(ref(this.db, 'settings/probabiliRequest'), this._probPending);
        this._renderProbabiliStatus();
        window.toast("Richiesta inviata: le probabili si aggiornano tra pochi secondi", "ok");
      } catch (err) {
        console.error(err);
        window.toast("Errore nell'invio della richiesta", "err");
      }
    };

    window.saveOnFireSettings = async () => {
      if (!this.db) return console.error("Database non inizializzato");
      const weeks = parseInt(document.getElementById('onFireWeeks')?.value, 10) || 4;
      const players = parseInt(document.getElementById('onFirePlayers')?.value, 10) || 5;
      try {
        await set(ref(this.db, 'status/onFire'), { weeks, players });
        window.toast(`On Fire: ${players} giocatori, ultime ${weeks} giornate`, "ok");
      } catch (err) {
        console.error(err);
        window.toast("Errore nel salvataggio delle impostazioni On Fire", "err");
      }
    };

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

        // 4b. Ruoli dei giocatori (servono per far entrare il panchinaro giusto al posto di un s.v.)
        const playersSnap = await get(ref(this.db, 'players'));
        const ruoliGiocatori = {};
        Object.values(playersSnap.exists() ? playersSnap.val() : {}).forEach(pl => {
          if (pl && pl.id !== undefined) ruoliGiocatori[pl.id] = pl.role;
        });

        // 5. Calcolo Voti Giocatori (solo chi ha un voto > 0: gli altri sono s.v.)
        Object.keys(votiGiocatori).forEach(playerId => {
          const datiVoto = votiGiocatori[playerId];
          if (CalcoloMatchService.hasVoto(datiVoto)) {
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

          const ptHome = CalcoloMatchService.calcolaTotaleSquadra(allLineups, homeTeamId, mappaFantavotiLocali, ruoliGiocatori);
          const ptAway = CalcoloMatchService.calcolaTotaleSquadra(allLineups, awayTeamId, mappaFantavotiLocali, ruoliGiocatori);

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

          // Includiamo i dati appena calcolati per la giornata corrente
          allMatches[gwId] = allMatches[gwId] || { couples: {} };
          Object.keys(couples).forEach(matchKey => {
            const match = couples[matchKey];
            const homeTeamId = match.homeId || match.home || match.idHome;
            const awayTeamId = match.awayId || match.away || match.idAway;
            
            const ptHome = CalcoloMatchService.calcolaTotaleSquadra(allLineups, homeTeamId, mappaFantavotiLocali, ruoliGiocatori);
            const ptAway = CalcoloMatchService.calcolaTotaleSquadra(allLineups, awayTeamId, mappaFantavotiLocali, ruoliGiocatori);

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
                    // In caso di parità di gol, vince chi ha il fantapunteggio più alto
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

                if (matchAndata && matchRitorno) {
                  // Identifichiamo formalmente chi gioca in casa all'andata e chi fuori
                  const teamAndataCasa = matchAndata.homeId || matchAndata.home;
                  const teamAndataFuori = matchAndata.awayId || matchAndata.away;

                  // Gol e Fantapunti totalizzati nell'Andata
                  let totGolCasa = Number(matchAndata.goalHome ?? matchAndata.homeScore ?? 0);
                  let totGolFuori = Number(matchAndata.goalAway ?? matchAndata.awayScore ?? 0);
                  let totPtCasa = Number(matchAndata.punteggioFinaleHome || 0);
                  let totPtFuori = Number(matchAndata.punteggioFinaleAway || 0);

                  // Al RITORNO i ruoli si invertono:
                  // Chi ha giocato fuori all'andata (teamAndataFuori) ora gioca in casa (goalHome al ritorno).
                  // Chi ha giocato in casa all'andata (teamAndataCasa) ora gioca fuori (goalAway al ritorno).
                  const rHomeId = matchRitorno.homeId || matchRitorno.home;

                  if (rHomeId === teamAndataFuori) {
                    totGolFuori += Number(matchRitorno.goalHome ?? matchRitorno.homeScore ?? 0);
                    totGolCasa += Number(matchRitorno.goalAway ?? matchRitorno.awayScore ?? 0);
                    totPtFuori += Number(matchRitorno.punteggioFinaleHome || 0);
                    totPtCasa += Number(matchRitorno.punteggioFinaleAway || 0);
                  } else {
                    // Fallback di sicurezza nel caso i campi fossero ribaltati a DB
                    totGolCasa += Number(matchRitorno.goalHome ?? matchRitorno.homeScore ?? 0);
                    totGolFuori += Number(matchRitorno.goalAway ?? matchRitorno.awayScore ?? 0);
                    totPtCasa += Number(matchRitorno.punteggioFinaleHome || 0);
                    totPtFuori += Number(matchRitorno.punteggioFinaleAway || 0);
                  }

                  // Valutazione esito globale aggregato
                  if (totGolCasa > totGolFuori) vincenteId = teamAndataCasa;
                  else if (totGolFuori > totGolCasa) vincenteId = teamAndataFuori;
                  else {
                    // Parità di gol aggregati: spareggio sui fantapunti complessivi
                    if (totPtCasa > totPtFuori) vincenteId = teamAndataCasa;
                    else if (totPtFuori > totPtCasa) vincenteId = teamAndataFuori;
                    else vincenteId = teamAndataCasa;
                  }
                }
              }

              // Se abbiamo determinato un vincente, aggiorniamo sia il Tabellone sia il Calendario (Matches)
              if (vincenteId) {
                const targetPlaceholder = `VINCENTE_${matchId}`;

                // A) Aggiorna la struttura visuale del tabellone (per le fasi successive)
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

                // B) Aggiorna le vere partite a calendario (matches -> gwX -> couples) rispettando il luogo casa/fuori
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

        // 8. Applicazione Atomica degli Aggiornamenti
        await update(ref(this.db), updates);
        window.toast(`🎯 Giornata ${gwId.toUpperCase()} salvata e dati aggiornati correttamente!`, "ok");

      } catch (err) {
        console.error(err);
        window.toast("Errore critico durante il salvataggio completo della giornata", "err");
      }
    };
  }
};
