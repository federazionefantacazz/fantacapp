export const HomePage = {
  // 1. Metodo che genera lo scheletro HTML della pagina interna
  renderHTML(STATE = {}) {
    return `
      <div class="page" id="page-home" style="padding-top: 1rem;">
        <div class="app-header" style="margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between; position: relative;">
          <div style="width: 32px;"></div> 
          <div class="logo" id="homeHeaderTitle" style="font-size: 2rem; letter-spacing: 2px; text-transform: uppercase; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: calc(100% - 80px);">FANTACAZZ</div>
          <button onclick="window.doFirebaseLogout()" style="background: transparent; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; -webkit-tap-highlight-color: transparent;" title="Disconnetti">
            <svg viewBox="0 0 24 24" width="22" height="22" stroke="var(--accent3)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>

        <!-- CARD SQUADRA (INFO + TROFEI + ANTEPRIMA WIP) -->
        <div class="card" style="margin-bottom: 1.2rem; background: linear-gradient(135deg, var(--card) 0%, rgba(80,227,194,0.06) 100%); border: 1px solid rgba(255,255,255,0.08); padding: 1.25rem;">
          
          <!-- RIGA SUPERIORE: INFO SQUADRA + BOX WIP -->
          <div style="display: flex; gap: 1rem; align-items: stretch;">
            
            <!-- Colonna Sinistra: Dettagli Squadra -->
            <div style="flex: 1.2; display: flex; flex-direction: column; justify-content: space-between; min-width: 0;">
              <div>
                <div style="display: flex; align-items: flex-start; gap: 0.8rem; margin-bottom: 0.8rem;">
                  <div id="userTeamLogo" style="flex-shrink: 0; margin-top: 2px;"></div>
                  <div style="flex: 1; min-width: 0;">
                    <div class="label" style="margin: 0; font-size: 0.68rem;">La mia squadra</div>
                    <!-- Nome squadra sbloccato per leggersi interamente -->
                    <h3 id="homeTeamName" style="font-family: 'Bebas Neue', sans-serif; font-size: 1.7rem; letter-spacing: 0.5px; color: var(--text); margin-top: -3px; line-height: 1.1; word-break: break-word;">Caricamento...</h3>
                    <p id="homeTeamOwner" style="font-size: 0.75rem; color: var(--text2); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">...</p>
                  </div>
                </div>

                <div style="display: flex; align-items: baseline; gap: 0.4rem; margin-top: 0.4rem;">
                  <span style="font-size: 0.72rem; color: var(--text2); text-transform: uppercase; font-weight: 600;">Totale Punti:</span>
                  <span id="homeTeamPts" style="font-family: 'Bebas Neue', sans-serif; font-size: 1.8rem; color: var(--accent); line-height: 1;">0.0</span>
                </div>
              </div>
            </div>

            <!-- Colonna Destra: Box Anteprima WIP -->
            <div style="flex: 0.9; min-width: 110px; background: rgba(0,0,0,0.25); border: 1.5px dashed rgba(255,255,255,0.15); border-radius: 10px; padding: 0.75rem; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; position: relative; overflow: hidden;">
              <div style="position: absolute; top: 6px; right: 6px; background: var(--accent2); color: #fff; font-size: 0.55rem; font-weight: 700; padding: 1px 5px; border-radius: 4px; letter-spacing: 0.5px;">WIP</div>
              <div id="homePreviewBox">
                <div style="font-size: 1.5rem; margin-bottom: 0.2rem; opacity: 0.8;">📊</div>
                <div style="font-size: 0.72rem; font-weight: 600; color: var(--text); line-height: 1.2;">Anteprima</div>
                <div style="font-size: 0.62rem; color: var(--text3); margin-top: 3px;">Modulo / Stats</div>
              </div>
            </div>

          </div>

          <!-- RIGA INFERIORE: SEZIONE TROFEI / PALMARÈS (FULL WIDTH SOTTO AI DUE BOX) -->
          <div style="margin-top: 1rem; padding-top: 0.8rem; border-top: 1px dashed rgba(255,255,255,0.1); width: 100%;">
            <div class="label" style="margin-bottom: 0.4rem; font-size: 0.65rem; color: var(--gold); letter-spacing: 0.5px; text-transform: uppercase;">🏆 Palmarès / Trofei</div>
            <div id="homeTeamTrophies" style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
              <span style="font-size: 0.75rem; color: var(--text3); font-style: italic;">Nessun trofeo</span>
            </div>
          </div>

        </div>
		
        <div id="home-status-banner" style="margin-bottom: 1.2rem;"></div>

        <!-- PROSSIMO AVVERSARIO -->
        <div class="sec" style="margin-bottom:.6rem;">Prossimo Avversario</div>
        <div id="homeNextMatch" style="margin-bottom:1.5rem;">
          <div style="text-align:center; color:var(--text3); padding:1rem; font-size:.85rem;">Nessun match programmato.</div>
        </div>

        <!-- 🟢 NUOVA SEZIONE: GIOCATORI ON FIRE -->
        <div class="sec" id="onFireTitle" style="margin-bottom:.6rem;">Giocatori On Fire</div>
        <div class="scroll-voti" id="homeOnFirePlayers">
          <div style="text-align:center; color:var(--text3); padding:1.5rem; font-size:.85rem; width:100%;">Nessun dato sulle prestazioni disponibile.</div>
        </div>
      </div>
    `;
  },

  // 2. Metodo di rendering dei dati dinamici dello stato
  render(STATE) {
    const banner = document.getElementById('home-status-banner');
    const headerTitle = document.getElementById('homeHeaderTitle');
    const tn = document.getElementById('homeTeamName');
    const to = document.getElementById('homeTeamOwner');
    const tp = document.getElementById('homeTeamPts');
    const trophiesContainer = document.getElementById('homeTeamTrophies');
    const nm = document.getElementById('homeNextMatch');
    const onFireContainer = document.getElementById('homeOnFirePlayers');
    const onFireTitle = document.getElementById('onFireTitle');
    const teamLogoContainer = document.getElementById('userTeamLogo');

    // Helper per ottenere l'HTML del logo
    const getLogoHtml = (team, size = 28) => {
      if (!team) return `<span style="font-size:${size * 0.7}px;">🛡️</span>`;
      if (team.logo) {
        return `<img src="${team.logo}" style="width:${size}px; height:${size}px; object-fit:contain; border-radius:4px; flex-shrink:0;" onerror="this.outerHTML='🛡️';" alt="Logo">`;
      }
      return `<span style="font-size:${size * 0.7}px; flex-shrink:0;">${team.emoji || '🛡️'}</span>`;
    };

    // 🟢 COMPATIBILITÀ DIZIONARIO/ARRAY FIREBASE
    let competitionsList = [];
    if (STATE.competitions) {
      competitionsList = Array.isArray(STATE.competitions) 
        ? STATE.competitions 
        : Object.values(STATE.competitions);
    }
    
    const activeId = STATE.currentCompetition || STATE.activeCompetitionId;
    if (!activeId && competitionsList.length > 0) {
      STATE.activeCompetitionId = competitionsList[0].id;
    }

    const comp = competitionsList.find(c => c && String(c.id) === String(activeId || STATE.activeCompetitionId));

    // 🟢 AGGIORNAMENTO TITOLO HEADER
    if (headerTitle) {
      headerTitle.textContent = (comp && comp.name) ? comp.name : "FANTACAZZ";
    }

    // 🟢 BANNER GIORNATA REALE
    const realGw = STATE.giornataRealeCorrente || STATE.currentRealGW || STATE.status?.currentGW || 0;
    if (banner) {
      if (realGw === 0) {
        banner.innerHTML = `
          <div class="card card-sm" style="border-left: 4px solid var(--accent2); background: rgba(100, 116, 139, 0.1); padding: .75rem 1rem; margin-bottom: 0;">
            <div style="display: flex; align-items: center; gap: .6rem;">
              <span style="font-size: 1.2rem; line-height: 1;">⏳</span>
              <div>
                <div style="font-size: .85rem; font-weight: 600; color: var(--text);">Pre-Campionato Attivo</div>
                <div style="font-size: .75rem; color: var(--text2); margin-top: 1px;">Le liste sono aperte. Prepara la rosa prima della 1ª Giornata!</div>
              </div>
            </div>
          </div>
        `;
      } else {
        banner.innerHTML = `
          <div class="card card-sm" style="border-left: 4px solid var(--accent); background: rgba(80, 227, 194, 0.08); padding: .75rem 1rem; margin-bottom: 0;">
            <div style="display: flex; align-items: center; gap: .6rem;">
              <span style="font-size: 1.2rem; line-height: 1;">⚽</span>
              <div>
                <div style="font-size: .85rem; font-weight: 600; color: var(--text);">Campionato Live — Serie A</div>
                <div style="font-size: .75rem; color: var(--text2); margin-top: 1px;">Siamo attualmente alla <strong style="color: var(--accent);">${realGw}ª Giornata</strong> reale.</div>
              </div>
            </div>
          </div>
        `;
      }
    }

    // 🟢 DATI SQUADRA UTENTE LOGGATO
    if (!STATE.user) return;
    
    let teamsList = [];
    if (STATE.teams) {
      teamsList = Array.isArray(STATE.teams) ? STATE.teams : Object.values(STATE.teams);
    }
    const myTeam = teamsList.find(t => t && t.id === STATE.user.id);

    if (myTeam) {
      if (tn) tn.textContent = myTeam.name || "Senza Nome";
      if (to) to.textContent = `Patron: ${myTeam.owner || "Sconosciuto"}`;
      if (tp) tp.textContent = (myTeam.pts !== undefined) ? myTeam.pts.toFixed(1) : "0.0";
      
      if (onFireTitle) {
        onFireTitle.textContent = `🔥 Giocatori ${myTeam.name || ''} On Fire`;
      }

      if (teamLogoContainer) {
        if (myTeam.logo) {
          teamLogoContainer.innerHTML = `<img src="${myTeam.logo}" style="width:52px; height:52px; object-fit:contain; border-radius:8px; background:var(--bg3); padding:2px; border:1px solid rgba(255,255,255,0.08);" onerror="this.src=''; this.innerHTML='🛡️';" alt="Logo">`;
        } else {
          teamLogoContainer.innerHTML = `<div style="width:52px; height:52px; background:var(--bg3); border:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; border-radius:8px; font-size:1.5rem; color:var(--text2)">${myTeam.emoji || '🛡️'}</div>`;
        }
      }

      if (trophiesContainer) {
        let trophiesList = [];
        if (myTeam.trophies) {
          trophiesList = Array.isArray(myTeam.trophies) ? myTeam.trophies : Object.values(myTeam.trophies);
        }

        if (trophiesList.length > 0) {
          trophiesContainer.innerHTML = trophiesList.map(tr => `
            <span style="font-size: 1rem;" title="${(tr && tr.name) || 'Trofeo'}">${(tr && tr.icon) || '🏆'}</span>
          `).join('');
        } else if (myTeam.trophiesCount) {
          trophiesContainer.innerHTML = `<span style="font-size:0.85rem; font-weight:bold; color:var(--gold);">🏆 x${myTeam.trophiesCount}</span>`;
        } else {
          trophiesContainer.innerHTML = `<span style="font-size: 0.72rem; color: var(--text3); font-style: italic;">Nessun trofeo in bacheca</span>`;
        }
      }

    } else {
      if (tn) tn.textContent = "Spettatore";
      if (to) to.textContent = STATE.user.email;
      if (tp) tp.textContent = "0.0";
      if (onFireTitle) onFireTitle.textContent = `Giocatori On Fire!!`;
      if (teamLogoContainer) teamLogoContainer.innerHTML = `<div style="width:52px; height:52px; background:var(--bg3); border:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; border-radius:8px; font-size:1.5rem; color:var(--text2)">👁️</div>`;
      if (trophiesContainer) trophiesContainer.innerHTML = `<span style="font-size: 0.72rem; color: var(--text3);">--</span>`;
    }

    // PROSSIMO AVVERSARIO
    if (comp) {
      // 1. Recupera la giornata reale corrente (default a 1 se non specificata)
      const currentRealGw = STATE.giornataRealeCorrente || STATE.currentRealGW || STATE.status?.currentGW || 1;
      
      // 2. Trova la giornata interna (GW) della competizione tramite la mappatura associazioniGwReali
      const assoc = comp.associazioniGwReali || {};
      const targetGwKey = assoc[String(currentRealGw)] || `gw${currentRealGw}`;

      // 3. Estrai le partite della giornata selezionata e forza l'array sicuro
      const gwData = (comp.matches && comp.matches[targetGwKey]) ? comp.matches[targetGwKey] : null;
      let couplesList = [];
      if (gwData && gwData.couples) {
        couplesList = Array.isArray(gwData.couples) 
          ? gwData.couples 
          : Object.values(gwData.couples);
      }

      // 4. Cerca il match dell'utente loggato
      const myMatch = couplesList.find(m => m && (m.homeId === STATE.user.id || m.awayId === STATE.user.id));

      if (myMatch) {
        const tHome = teamsList.find(t => t && t.id === myMatch.homeId) || { name: myMatch.homeId };
        const tAway = teamsList.find(t => t && t.id === myMatch.awayId) || { name: myMatch.awayId };
        
        if (nm) {
          nm.innerHTML = `
            <div class="card card-sm" style="background:var(--bg2); border:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; gap:0.75rem; padding:0.85rem 1rem;">
              <div style="display:flex; align-items:center; gap:0.5rem; min-width:0; flex:1; justify-content:flex-end;">
                ${getLogoHtml(tHome, 28)}
                <span style="font-size:0.85rem; font-weight:600; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${tHome.name}</span>
              </div>

              <div style="font-family:'Bebas Neue',sans-serif; font-size:1.2rem; color:var(--text2); letter-spacing:1px; flex-shrink:0;">VS</div>

              <div style="display:flex; align-items:center; gap:0.5rem; min-width:0; flex:1; justify-content:flex-start;">
                <span style="font-size:0.85rem; font-weight:600; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${tAway.name}</span>
                ${getLogoHtml(tAway, 28)}
              </div>
            </div>
          `;
        }
      } else {
        if (nm) nm.innerHTML = `<div style="text-align:center; color:var(--text3); padding:1rem; font-size:.85rem;">Riposo o nessun match trovato per la ${currentRealGw}ª Giornata Reale (${targetGwKey.toUpperCase()}).</div>`;
      }
    } else {
      if (nm) nm.innerHTML = `<div style="text-align:center; color:var(--text3); padding:1rem; font-size:.85rem;">Seleziona una competizione dal menu in alto.</div>`;
    }

    // 🟢 CALCOLO GIOCATORI ON FIRE (Ultime 4 Giornate Reali)
    if (onFireContainer) {
      let playersList = [];
      if (STATE.players) {
        playersList = Array.isArray(STATE.players) ? STATE.players : Object.values(STATE.players);
      }

      // Filtra i giocatori per la squadra dell'utente (se la squadra esiste ed ha dei giocatori)
      let targetPlayers = playersList;
      if (myTeam && myTeam.players) {
        const teamPlayersArray = Array.isArray(myTeam.players) ? myTeam.players : Object.values(myTeam.players);
        if (teamPlayersArray.length > 0) {
          targetPlayers = playersList.filter(p => p && (teamPlayersArray.includes(p.id) || teamPlayersArray.some(tp => (tp && tp.id === p.id) || tp === p.id)));
        }
      }

      // Determina le ultime 4 giornate reali disponibili da STATE.votes
      const allVotes = STATE.votes || {};
      let targetGwKeys = [];

      if (realGw > 0) {
        for (let i = realGw; i > Math.max(0, realGw - 4); i--) {
          targetGwKeys.push(`gw${i}`);
        }
      } else {
        // Fallback in assenza di realGw: prendi le ultime 4 giornate presenti nei voti
        targetGwKeys = Object.keys(allVotes)
          .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
          .slice(0, 4);
      }

      // Calcolo media ultimi 4 voti per ciascun giocatore
      const stats = targetPlayers.map(p => {
        if (!p) return null;
        let sum = 0;
        let count = 0;

        targetGwKeys.forEach(gwKey => {
          if (allVotes[gwKey] && allVotes[gwKey][p.id] !== undefined) {
            const v = Number(allVotes[gwKey][p.id]);
            if (!isNaN(v) && v > 0) {
              sum += v;
              count++;
            }
          }
        });

        const avg = count > 0 ? sum / count : 0;
        return { player: p, avg, count };
      }).filter(item => item && item.count > 0); // Considera solo giocatori con almeno un voto nelle ultime 4 giornate

      // Ordina per media decrescente e prendi i Top 5
      stats.sort((a, b) => b.avg - a.avg);
      const top5 = stats.slice(0, 5);

      if (top5.length > 0) {
        onFireContainer.innerHTML = top5.map(({ player: p, avg, count }) => {
          let customStyle = 'padding: .2rem .5rem; border-radius: 6px; font-weight: bold; font-family: "DM Mono", monospace; ';
          if (avg >= 7) customStyle += 'background: rgba(80, 227, 194, 0.15); color: var(--accent);';
          else if (avg < 6) customStyle += 'background: rgba(255, 107, 107, 0.15); color: var(--accent3);';
          else customStyle += 'background: rgba(255, 255, 255, 0.08); color: var(--text);';

          return `
            <div class="pcard" style="background:var(--card2); border: 1px solid rgba(255,255,255,0.05); margin-bottom: 0.4rem;">
              <div class="rbadge r${p.role}">${p.role}</div>
              <div class="pi" style="flex:1; min-width:0;">
                <div class="pn" style="color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</div>
                <div class="pm" style="color:var(--text2); font-size:0.7rem;">${p.club} • ${count} pres. nelle ultime 4</div>
              </div>
              <div style="text-align:right;">
                <div style="${customStyle}">${avg.toFixed(2)}</div>
              </div>
            </div>
          `;
        }).join('');
      } else {
        onFireContainer.innerHTML = `<div style="text-align:center; color:var(--text3); padding:1.5rem; font-size:.85rem; width:100%;">Nessun voto registrato nelle ultime 4 giornate.</div>`;
      }
    }
  }
};