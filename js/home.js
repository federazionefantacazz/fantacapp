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
          <div style="display: flex; gap: 1rem; align-items: stretch;">
            
            <!-- Colonna Sinistra: Dettagli Squadra + Trofei -->
            <div style="flex: 1.2; display: flex; flex-direction: column; justify-content: space-between; min-width: 0;">
              <div>
                <div style="display: flex; align-items: center; gap: 0.8rem; margin-bottom: 0.8rem;">
                  <div id="userTeamLogo" style="flex-shrink: 0;"></div>
                  <div style="flex: 1; min-width: 0;">
                    <div class="label" style="margin: 0; font-size: 0.68rem;">La mia squadra</div>
                    <h3 id="homeTeamName" style="font-family: 'Bebas Neue', sans-serif; font-size: 1.7rem; letter-spacing: 0.5px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: -3px; line-height: 1.1;">Caricamento...</h3>
                    <p id="homeTeamOwner" style="font-size: 0.75rem; color: var(--text2); margin-top: -1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">...</p>
                  </div>
                </div>

                <div style="display: flex; align-items: baseline; gap: 0.4rem; margin-top: 0.4rem;">
                  <span style="font-size: 0.72rem; color: var(--text2); text-transform: uppercase; font-weight: 600;">Totale Punti:</span>
                  <span id="homeTeamPts" style="font-family: 'Bebas Neue', sans-serif; font-size: 1.8rem; color: var(--accent); line-height: 1;">0.0</span>
                </div>
              </div>

              <!-- Sezione Trofei -->
              <div style="margin-top: 1rem; padding-top: 0.8rem; border-top: 1px dashed rgba(255,255,255,0.1);">
                <div class="label" style="margin-bottom: 0.4rem; font-size: 0.65rem; color: var(--gold); letter-spacing: 0.5px; text-transform: uppercase;">🏆 Palmarès / Trofei</div>
                <div id="homeTeamTrophies" style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
                  <span style="font-size: 0.75rem; color: var(--text3); font-style: italic;">Nessun trofeo</span>
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
        </div>
		
        <div id="home-status-banner" style="margin-bottom: 1.2rem;"></div>

        <!-- 🟢 CAMBIATO DA "🎯 Prossimo Turno" A "Prossimo Avversario" -->
        <div class="sec" style="margin-bottom:.6rem;">Prossimo Avversario</div>
        <div id="homeNextMatch" style="margin-bottom:1.5rem;">
          <div style="text-align:center; color:var(--text3); padding:1rem; font-size:.85rem;">Nessun match programmato.</div>
        </div>

        <div class="sec" style="margin-bottom:.6rem;">🗞️ Ultimi Voti Rilasciati</div>
        <div class="scroll-voti" id="homeLastVotes">
          <div style="text-align:center; color:var(--text3); padding:1.5rem; font-size:.85rem; width:100%;">Nessun voto inserito.</div>
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
    const lv = document.getElementById('homeLastVotes');
    const teamLogoContainer = document.getElementById('userTeamLogo');

    // Helper per ottenere l'HTML del logo (immagini o fallback emoji)
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

    const comp = competitionsList.find(c => String(c.id) === String(activeId || STATE.activeCompetitionId));

    // 🟢 AGGIORNAMENTO TITOLO HEADER
    if (headerTitle) {
      headerTitle.textContent = (comp && comp.name) ? comp.name : "FANTACAZZ";
    }

    // 🟢 BANNER GIORNATA REALE
    if (banner) {
      const realGw = STATE.giornataRealeCorrente || STATE.currentRealGW || STATE.status?.currentGW || 0;
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
    const myTeam = teamsList.find(t => t.id === STATE.user.id);

    if (myTeam) {
      if (tn) tn.textContent = myTeam.name || "Senza Nome";
      if (to) to.textContent = `Patron: ${myTeam.owner || "Sconosciuto"}`;
      if (tp) tp.textContent = (myTeam.pts !== undefined) ? myTeam.pts.toFixed(1) : "0.0";
      
      if (teamLogoContainer) {
        if (myTeam.logo) {
          teamLogoContainer.innerHTML = `<img src="${myTeam.logo}" style="width:52px; height:52px; object-fit:contain; border-radius:8px; background:var(--bg3); padding:2px; border:1px solid rgba(255,255,255,0.08);" onerror="this.src=''; this.innerHTML='🛡️';" alt="Logo">`;
        } else {
          teamLogoContainer.innerHTML = `<div style="width:52px; height:52px; background:var(--bg3); border:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; border-radius:8px; font-size:1.5rem; color:var(--text2)">${myTeam.emoji || '🛡️'}</div>`;
        }
      }

      if (trophiesContainer) {
        if (myTeam.trophies && Array.isArray(myTeam.trophies) && myTeam.trophies.length > 0) {
          trophiesContainer.innerHTML = myTeam.trophies.map(tr => `
            <span style="font-size: 1rem;" title="${tr.name || 'Trofeo'}">${tr.icon || '🏆'}</span>
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
      if (teamLogoContainer) teamLogoContainer.innerHTML = `<div style="width:52px; height:52px; background:var(--bg3); border:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; border-radius:8px; font-size:1.5rem; color:var(--text2)">👁️</div>`;
      if (trophiesContainer) trophiesContainer.innerHTML = `<span style="font-size: 0.72rem; color: var(--text3);">--</span>`;
    }

    // 🟢 NUOVA STRUTTURA: PROSSIMO AVVERSARIO (LOGO SQUADRA 1 vs SQUADRA 2 LOGO)
    if (comp) {
      const currentGwNum = comp.status ? (comp.status.currentGW || 1) : 1;
      const allMatches = STATE.matches || {};
      const gwMatches = allMatches[currentGwNum] || [];
      const myMatch = gwMatches.find(m => m.homeId === STATE.user.id || m.awayId === STATE.user.id);

      if (myMatch) {
        const tHome = teamsList.find(t => t.id === myMatch.homeId) || { name: myMatch.homeId };
        const tAway = teamsList.find(t => t.id === myMatch.awayId) || { name: myMatch.awayId };
        
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
        if (nm) nm.innerHTML = `<div style="text-align:center; color:var(--text3); padding:1rem; font-size:.85rem;">Riposo o nessun match trovato per questa GW.</div>`;
      }
    } else {
      if (nm) nm.innerHTML = `<div style="text-align:center; color:var(--text3); padding:1rem; font-size:.85rem;">Seleziona una competizione dal menu in alto.</div>`;
    }

    // 🟢 ULTIMI VOTI RILASCIATI
    if (STATE.votes) {
      if (lv) {
        let playersList = [];
        if (STATE.players) {
          playersList = Array.isArray(STATE.players) ? STATE.players : Object.values(STATE.players);
        }

        const currentGwKey = comp && comp.status ? `gw${comp.status.currentGW}` : null;
        
        let targetVotes = {};
        if (currentGwKey && STATE.votes[currentGwKey]) {
          targetVotes = STATE.votes[currentGwKey];
        } else {
          const keys = Object.keys(STATE.votes);
          if (keys.length > 0) {
            const lastKey = keys.sort((a, b) => b.localeCompare(a, undefined, {numeric: true}))[0];
            targetVotes = STATE.votes[lastKey] || {};
          }
        }

        const vArr = Object.entries(targetVotes);

        if (vArr.length > 0) {
          lv.innerHTML = vArr.map(([pid, rawVal]) => {
            const p = playersList.find(x => x.id === pid) || { name: pid, role: 'C', club: '' };
            const val = Number(rawVal) || 0;

            let customStyle = 'padding: .2rem .5rem; border-radius: 6px; font-weight: bold; font-family: "DM Mono", monospace; ';
            if (val >= 7) customStyle += 'background: rgba(80, 227, 194, 0.15); color: var(--accent);';
            else if (val < 5.5) customStyle += 'background: rgba(255, 107, 107, 0.15); color: var(--accent3);';
            else customStyle += 'background: rgba(255, 255, 255, 0.08); color: var(--text);';

            return `
              <div class="pcard" style="background:var(--card2); border: 1px solid rgba(255,255,255,0.05);">
                <div class="rbadge r${p.role}">${p.role}</div>
                <div class="pi">
                  <div class="pn" style="color:var(--text);">${p.name}</div>
                  <div class="pm" style="color:var(--text2);">${p.club}</div>
                </div>
                <div style="${customStyle}">${val.toFixed(1)}</div>
              </div>
            `;
          }).join('');
        } else {
          lv.innerHTML = `<div style="text-align:center; color:var(--text3); padding:1.5rem; font-size:.85rem; width:100%;">Nessun voto rilasciato per questa giornata.</div>`;
        }
      }
    } else {
      if (lv) lv.innerHTML = `<div style="text-align:center; color:var(--text3); padding:1.5rem; font-size:.85rem; width:100%;">Nessun voto rilasciato al momento.</div>`;
    }
  }
};