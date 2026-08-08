import { createMatchCardVS } from './components/MatchCardVS.js';

export const HomePage = {
  renderHTML(STATE = {}) {
    return `
      <div class="page" id="page-home" style="padding-top: 1rem;">
        <div class="app-header" style="margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between; position: relative;">
          <div style="width: 32px;"></div> 
          <div class="logo" id="homeHeaderTitle" style="font-size: 2rem; letter-spacing: 2px; text-transform: uppercase; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: calc(100% - 80px);">FANTACAZZ</div>
          <button onclick="window.doFirebaseLogout()" style="background: transparent; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; -webkit-tap-highlight-color: transparent;" title="Disconnetti">
            <i class="ri-logout-box-r-line" style="font-size: 1.35rem; color: var(--accent3);"></i>
          </button>
        </div>

        <!-- CARD SQUADRA (LAYOUT A COLONNA RIPULITO) -->
        <div class="card" style="margin-bottom: 1.2rem; background: linear-gradient(135deg, var(--card) 0%, color-mix(in srgb, var(--accent) 6%, transparent) 100%); border: 1px solid rgba(255,255,255,0.08); padding: 1.25rem;">
          
          <!-- RIGA PRINCIPALE: LOGO + NOME SQUADRA -->
          <div style="display: flex; align-items: center; gap: 0.8rem; margin-bottom: 1rem; min-width: 0;">
            <div id="userTeamLogo" style="flex-shrink: 0;"></div>
            <div style="flex: 1; min-width: 0; overflow: hidden;">
              <div class="label" style="margin: 0; font-size: 0.68rem;">La mia squadra</div>
              <h3 id="homeTeamName" style="font-family: 'Bebas Neue', sans-serif; font-size: 2rem; letter-spacing: 0.5px; color: var(--text); margin: 0; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Caricamento...</h3>
              <p id="homeTeamOwner" style="font-size: 0.75rem; color: var(--text2); margin: 2px 0 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">...</p>
            </div>
          </div>

          <!-- RIGA SOTTOSTANTE: INFO PUNTI + BOX WIP -->
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding-top: 0.8rem; border-top: 1px dashed rgba(255,255,255,0.1);">
            <div style="display: flex; align-items: baseline; gap: 0.4rem;">
              <span style="font-size: 0.72rem; color: var(--text2); text-transform: uppercase; font-weight: 600;">Totale Punti:</span>
              <span id="homeTeamPts" style="font-family: 'Bebas Neue', sans-serif; font-size: 1.8rem; color: var(--accent); line-height: 1;">0.0</span>
            </div>

            <!-- Box Anteprima WIP Spostato Sotto -->
            <div style="background: rgba(0,0,0,0.25); border: 1.5px dashed rgba(255,255,255,0.15); border-radius: 8px; padding: 0.4rem 0.8rem; display: flex; align-items: center; gap: 0.5rem; position: relative;">
              <div style="font-size: 1rem;">📊</div>
              <div style="font-size: 0.7rem; font-weight: 600; color: var(--text);">Anteprima WIP</div>
            </div>
          </div>

          <!-- RIGA TROFEI / PALMARÈS -->
          <div style="margin-top: 0.8rem; padding-top: 0.8rem; border-top: 1px dashed rgba(255,255,255,0.1); width: 100%;">
            <div class="label" style="margin-bottom: 0.4rem; font-size: 0.65rem; color: var(--gold); letter-spacing: 0.5px; text-transform: uppercase;"><i class="ri-trophy-line"></i> Palmarès / Trofei</div>
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

        <div class="sec" id="onFireTitle" style="margin-bottom:.6rem;">Giocatori On Fire <i class="ri-fire-fill" style="color: #ff4757;"></i></div>
        <div class="scroll-voti" id="homeOnFirePlayers">
          <div style="text-align:center; color:var(--text3); padding:1.5rem; font-size:.85rem; width:100%;">Nessun dato sulle prestazioni disponibile.</div>
        </div>
      </div>
    `;
  },

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

    let competitionsList = [];
    if (STATE.competitions) {
      competitionsList = Array.isArray(STATE.competitions) ? STATE.competitions : Object.values(STATE.competitions);
    }
    
    const activeId = STATE.currentCompetition || STATE.activeCompetitionId;
    if (!activeId && competitionsList.length > 0) {
      STATE.activeCompetitionId = competitionsList[0].id;
    }

    const comp = competitionsList.find(c => c && String(c.id) === String(activeId || STATE.activeCompetitionId));

    if (headerTitle) {
      headerTitle.textContent = (comp && comp.name) ? comp.name : "FANTACAZZ";
    }

    const realGw = STATE.giornataRealeCorrente || STATE.currentRealGW || STATE.status?.currentGW || 0;
    if (banner) {
      if (realGw === 0) {
        banner.innerHTML = `
          <div class="card card-sm" style="border-left: 4px solid var(--accent2); background: rgba(100, 116, 139, 0.1); padding: .75rem 1rem; margin-bottom: 0;">
            <div style="display: flex; align-items: center; gap: .6rem;">
              <i class="ri-time-line" style="font-size: 1.2rem; color: var(--accent2);"></i>
              <div>
                <div style="font-size: .85rem; font-weight: 600; color: var(--text);">Pre-Campionato Attivo</div>
                <div style="font-size: .75rem; color: var(--text2); margin-top: 1px;">Le liste sono aperte. Prepara la rosa prima della 1ª Giornata!</div>
              </div>
            </div>
          </div>
        `;
      } else {
        banner.innerHTML = `
          <div class="card card-sm" style="border-left: 4px solid var(--accent); background: color-mix(in srgb, var(--accent) 8%, transparent); padding: .75rem 1rem; margin-bottom: 0;">
            <div style="display: flex; align-items: center; gap: .6rem;">
              <i class="ri-football-line" style="font-size: 1.2rem; color: var(--accent);"></i>
              <div>
                <div style="font-size: .85rem; font-weight: 600; color: var(--text);">Campionato Live — Serie A</div>
                <div style="font-size: .75rem; color: var(--text2); margin-top: 1px;">Siamo attualmente alla <strong style="color: var(--accent);">${realGw}ª Giornata</strong> reale.</div>
              </div>
            </div>
          </div>
        `;
      }
    }

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
        onFireTitle.textContent = `Giocatori ${myTeam.name || ''} On Fire`;
      }

      if (teamLogoContainer) {
        if (myTeam.logo) {
          teamLogoContainer.innerHTML = `<img src="${myTeam.logo}" style="width:100px; height:100px; object-fit:contain; border-radius:8px; background:var(--bg3); padding:2px; border:1px solid rgba(255,255,255,0.08);" onerror="this.src=''; this.innerHTML='<i class=\\'ri-shield-fill\\' style=\\'font-size:1.5rem; color:var(--text2);\\'></i>';" alt="Logo">`;
        } else {
          teamLogoContainer.innerHTML = `<div style="width:100px; height:100px; background:var(--bg3); border:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; border-radius:8px;"><i class="ri-shield-fill" style="font-size:1.5rem; color:var(--text2)"></i></div>`;
        }
      }

      if (trophiesContainer) {
        let trophiesList = [];
        if (myTeam.trophies) {
          trophiesList = Array.isArray(myTeam.trophies) ? myTeam.trophies : Object.values(myTeam.trophies);
        }

        if (trophiesList.length > 0) {
          trophiesContainer.innerHTML = trophiesList.map(tr => `
            <span style="font-size: 1rem;" title="${(tr && tr.name) || 'Trofeo'}"><i class="ri-trophy-fill" style="color: var(--gold);"></i></span>
          `).join('');
        } else if (myTeam.trophiesCount) {
          trophiesContainer.innerHTML = `<span style="font-size:0.85rem; font-weight:bold; color:var(--gold);"><i class="ri-trophy-fill"></i> x${myTeam.trophiesCount}</span>`;
        } else {
          trophiesContainer.innerHTML = `<span style="font-size: 0.72rem; color: var(--text3); font-style: italic;">Nessun trofeo in bacheca</span>`;
        }
      }

    } else {
      if (tn) tn.textContent = "Spettatore";
      if (to) to.textContent = STATE.user.email;
      if (tp) tp.textContent = "0.0";
      if (onFireTitle) onFireTitle.textContent = `Giocatori On Fire`;
      if (teamLogoContainer) teamLogoContainer.innerHTML = `<div style="width:52px; height:52px; background:var(--bg3); border:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; border-radius:8px;"><i class="ri-eye-line" style="font-size:1.5rem; color:var(--text2)"></i></div>`;
      if (trophiesContainer) trophiesContainer.innerHTML = `<span style="font-size: 0.72rem; color: var(--text3);">--</span>`;
    }

    if (comp) {
      const currentRealGw = STATE.giornataRealeCorrente || STATE.currentRealGW || STATE.status?.currentGW || 1;
      const assoc = comp.associazioniGwReali || {};
      const targetGwKey = assoc[String(currentRealGw)] || `gw${currentRealGw}`;

      const gwData = (comp.matches && comp.matches[targetGwKey]) ? comp.matches[targetGwKey] : null;
      let couplesList = [];
      if (gwData && gwData.couples) {
        couplesList = Array.isArray(gwData.couples) ? gwData.couples : Object.values(gwData.couples);
      }

      const myMatch = couplesList.find(m => m && (m.homeId === STATE.user.id || m.awayId === STATE.user.id));

      if (nm) {
        nm.innerHTML = createMatchCardVS(myMatch, teamsList);
      }
    } else {
      if (nm) nm.innerHTML = `<div style="text-align:center; color:var(--text3); padding:1rem; font-size:.85rem;">Seleziona una competizione dal menu in alto.</div>`;
    }

    if (onFireContainer) {
      let playersList = [];
      if (STATE.players) {
        playersList = Array.isArray(STATE.players) ? STATE.players : Object.values(STATE.players);
      }

      let targetPlayers = playersList;
      if (myTeam && myTeam.players) {
        const teamPlayersArray = Array.isArray(myTeam.players) ? myTeam.players : Object.values(myTeam.players);
        if (teamPlayersArray.length > 0) {
          targetPlayers = playersList.filter(p => p && (teamPlayersArray.includes(p.id) || teamPlayersArray.some(tp => (tp && tp.id === p.id) || tp === p.id)));
        }
      }

      const allVotes = STATE.votes || {};
      let targetGwKeys = [];

      if (realGw > 0) {
        for (let i = realGw; i > Math.max(0, realGw - 4); i--) {
          targetGwKeys.push(`gw${i}`);
        }
      } else {
        targetGwKeys = Object.keys(allVotes)
          .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
          .slice(0, 4);
      }

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
      }).filter(item => item && item.count > 0);

      stats.sort((a, b) => b.avg - a.avg);
      const top5 = stats.slice(0, 5);

      if (top5.length > 0) {
        onFireContainer.innerHTML = top5.map(({ player: p, avg, count }) => {
          let customStyle = 'padding: .2rem .5rem; border-radius: 6px; font-weight: bold; font-family: "DM Mono", monospace; ';
          if (avg >= 7) customStyle += 'background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent);';
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
