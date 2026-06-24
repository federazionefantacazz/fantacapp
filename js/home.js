export const HomePage = {
  // 1. Metodo che genera lo scheletro HTML della pagina interna
  renderHTML(STATE = {}) {
    return `
      <div class="page" id="page-home" style="padding-top: 1.5rem;">
        <div class="app-header" style="margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; position: relative;">
          <div style="width: 32px;"></div> 
          <div class="logo" style="font-size: 2.4rem; letter-spacing: 2px;">FANTACAZZ</div>
          <button onclick="window.doFirebaseLogout()" style="background: transparent; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; -webkit-tap-highlight-color: transparent;" title="Disconnetti">
            <svg viewBox="0 0 24 24" width="22" height="22" stroke="var(--accent3)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>

        <div id="home-status-banner" style="margin-bottom: 1.2rem;"></div>

        <div class="card" style="margin-bottom: 1.2rem; background: linear-gradient(135deg, var(--card) 0%, rgba(80,227,194,0.04) 100%);">
          <div style="display:flex; align-items:center; gap:.8rem;">
            <div id="userTeamLogo" style="flex-shrink:0;"></div>
            <div style="flex:1; min-width:0;">
              <div class="label" style="margin:0;">La mia squadra</div>
              <h3 id="homeTeamName" style="font-family:'Bebas Neue',sans-serif; font-size:1.6rem; letter-spacing:0.5px; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:-2px;">Caricamento...</h3>
              <p id="homeTeamOwner" style="font-size:.78rem; color:var(--text2); margin-top:-2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">...</p>
            </div>
            <div id="homeTeamPts" style="font-family:'Bebas Neue',sans-serif; font-size:2.2rem; color:var(--accent); line-height:1; padding-left:.5rem; text-align:right;">0.0</div>
          </div>
        </div>

        <div class="card" style="padding:1rem 1.25rem; margin-bottom:1.5rem;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div class="label" style="margin:0;">Lega e Competizione attiva</div>
              <div id="homeActiveCompName" style="font-size:1rem; font-weight:600; color:#fff; margin-top:.1rem;">Nessuna</div>
            </div>
            <div style="text-align:right;">
              <div class="label" style="margin:0;">Giornata di Lega</div>
              <div id="homeActiveCompGw" style="font-family:'DM Mono',monospace; font-size:1.1rem; font-weight:600; color:var(--gold); margin-top:.1rem;">GW --</div>
            </div>
          </div>
        </div>

        <div class="sec" style="margin-bottom:.6rem;">🎯 Prossimo Turno</div>
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
    const tn = document.getElementById('homeTeamName');
    const to = document.getElementById('homeTeamOwner');
    const tp = document.getElementById('homeTeamPts');
    const tl = document.getElementById('homeActiveCompName');
    const tg = document.getElementById('homeActiveCompGw');
    const nm = document.getElementById('homeNextMatch');
    const lv = document.getElementById('homeLastVotes');
    const teamLogoContainer = document.getElementById('userTeamLogo');

    // Recuperiamo il contenitore globale del logo nella navbar in alto
    const globalNavbarLogoContainer = document.getElementById('app-global-navbar-logo-container');

    // 🟢 CORREZIONE COMPATIBILITÀ DIZIONARIO/ARRAY FIREBASE
    let competitionsList = [];
    if (STATE.competitions) {
      competitionsList = Array.isArray(STATE.competitions) 
        ? STATE.competitions 
        : Object.values(STATE.competitions);
    }
    
    // Se non c'è una competizione attiva impostata nello stato globale, forziamo la prima disponibile
    if (!STATE.activeCompetitionId && competitionsList.length > 0) {
      STATE.activeCompetitionId = competitionsList[0].id;
    }

    const comp = competitionsList.find(c => String(c.id) === String(STATE.activeCompetitionId));

    // 🟢 GESTIONE DELLO SFONDO DINAMICO DEDICATO ALLA HOME PAGE
    if (comp && comp.backgroundImage && comp.backgroundImage.trim() !== "") {
      document.body.style.backgroundImage = `linear-gradient(rgba(26, 30, 36, 0.3), rgba(26, 30, 36, 0.88)), url('${comp.backgroundImage}')`;
      document.body.style.backgroundSize = "100% auto";
      document.body.style.backgroundPosition = "cover";
      document.body.style.backgroundAttachment = "fixed";
      document.body.style.backgroundRepeat = "no-repeat";
    } else {
      document.body.style.backgroundImage = "none";
      document.body.style.backgroundColor = "var(--bg)";
    }

    // 🟢 AGGIORNAMENTO BANNER GIORNATA REALE
    if (banner) {
      const realGw = STATE.giornataRealeCorrente || STATE.currentRealGW || STATE.status?.currentGW || 0;
      if (realGw === 0) {
        banner.innerHTML = `
          <div class="card card-sm" style="border-left: 4px solid var(--accent2); background: rgba(74, 144, 226, 0.05); padding: .75rem 1rem; margin-bottom: 0;">
            <div style="display: flex; align-items: center; gap: .6rem;">
              <span style="font-size: 1.2rem; line-height: 1;">⏳</span>
              <div>
                <div style="font-size: .85rem; font-weight: 600; color: #fff;">Pre-Campionato Attivo</div>
                <div style="font-size: .75rem; color: var(--text2); margin-top: 1px;">Le liste sono aperte. Prepara la rosa prima della 1ª Giornata!</div>
              </div>
            </div>
          </div>
        `;
      } else {
        banner.innerHTML = `
          <div class="card card-sm" style="border-left: 4px solid var(--accent); background: rgba(80, 227, 194, 0.05); padding: .75rem 1rem; margin-bottom: 0;">
            <div style="display: flex; align-items: center; gap: .6rem;">
              <span style="font-size: 1.2rem; line-height: 1;">⚽</span>
              <div>
                <div style="font-size: .85rem; font-weight: 600; color: #fff;">Campionato Live — Serie A</div>
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
          teamLogoContainer.innerHTML = `<img src="${myTeam.logo}" style="width:44px; height:44px; object-fit:contain; border-radius:6px; background:var(--bg3); padding:2px;" onerror="this.src=''; this.innerHTML='🛡️';" alt="Logo">`;
        } else {
          teamLogoContainer.innerHTML = `<div style="width:44px; height:44px; background:var(--bg3); display:flex; align-items:center; justify-content:center; border-radius:6px; font-size:1.3rem; color:var(--text3)">${myTeam.emoji || '🛡️'}</div>`;
        }
      }
    } else {
      if (tn) tn.textContent = "Spettatore";
      if (to) to.textContent = STATE.user.email;
      if (tp) tp.textContent = "0.0";
      if (teamLogoContainer) teamLogoContainer.innerHTML = `<div style="width:44px; height:44px; background:var(--bg3); display:flex; align-items:center; justify-content:center; border-radius:6px; font-size:1.3rem; color:var(--text3)">👁️</div>`;
    }

    // 🟢 INFO COMPETIZIONE ATTIVA E PROSSIMO MATCH
    if (comp) {
      if (tl) tl.textContent = comp.name || comp.id.toUpperCase();
      if (tg) tg.textContent = comp.status ? `GW ${comp.status.currentGW || 1}` : "GW 1";
      
      const currentGwNum = comp.status ? (comp.status.currentGW || 1) : 1;
      const allMatches = STATE.matches || {};
      const gwMatches = allMatches[currentGwNum] || [];
      const myMatch = gwMatches.find(m => m.homeId === STATE.user.id || m.awayId === STATE.user.id);

      if (myMatch) {
        const tHome = teamsList.find(t => t.id === myMatch.homeId) || { name: myMatch.homeId, emoji: '🏠' };
        const tAway = teamsList.find(t => t.id === myMatch.awayId) || { name: myMatch.awayId, emoji: '🚀' };
        
        if (nm) {
          nm.innerHTML = `
            <div class="card card-sm" style="background:var(--bg2); border:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; text-align:center; padding:1rem 1.25rem;">
              <div style="flex:1; text-align:right; min-width:0;">
                <div style="font-size:1.1rem; margin-bottom:.1rem;">${tHome.emoji || '⚽'}</div>
                <div style="font-size:.85rem; font-weight:600; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${tHome.name}</div>
              </div>
              <div style="font-family:'Bebas Neue',sans-serif; font-size:1.4rem; color:var(--text3); padding:0 1.25rem; letter-spacing:1px;">VS</div>
              <div style="flex:1; text-align:left; min-width:0;">
                <div style="font-size:1.1rem; margin-bottom:.1rem;">${tAway.emoji || '⚽'}</div>
                <div style="font-size:.85rem; font-weight:600; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${tAway.name}</div>
              </div>
            </div>
          `;
        }
      } else {
        if (nm) nm.innerHTML = `<div style="text-align:center; color:var(--text3); padding:1rem; font-size:.85rem;">Riposo o nessun match trovato per questa GW.</div>`;
      }
    } else {
      if (tl) tl.textContent = "Nessuna";
      if (tg) tg.textContent = "GW --";
      if (nm) nm.innerHTML = `<div style="text-align:center; color:var(--text3); padding:1rem; font-size:.85rem;">Seleziona una competizione dal menu in alto.</div>`;
    }

    // 🟢 ULTIMI VOTI RILASCIATI
    const vArr = Object.entries(STATE.votes || {});
    if (vArr.length > 0) {
      if (lv) {
        let playersList = [];
        if (STATE.players) {
          playersList = Array.isArray(STATE.players) ? STATE.players : Object.values(STATE.players);
        }
        lv.innerHTML = vArr.map(([pid, val]) => {
          const p = playersList.find(x => x.id === pid) || { name: pid, role: 'C', club: '' };
          let customStyle = 'padding: .2rem .5rem; border-radius: 6px; font-weight: bold; font-family: "DM Mono", monospace; ';
          if (val >= 7) customStyle += 'background: rgba(80, 227, 194, 0.15); color: var(--accent);';
          else if (val < 5.5) customStyle += 'background: rgba(255, 107, 107, 0.15); color: var(--accent3);';
          else customStyle += 'background: rgba(255, 255, 255, 0.08); color: var(--text);';

          return `
            <div class="pcard">
              <div class="rbadge r${p.role}">${p.role}</div>
              <div class="pname">${p.name} <span class="pclub">${p.club}</span></div>
              <div style="${customStyle}">${val.toFixed(1)}</div>
            </div>
          `;
        }).join('');
      }
    } else {
      if (lv) lv.innerHTML = `<div style="text-align:center; color:var(--text3); padding:1.5rem; font-size:.85rem; width:100%;">Nessun voto rilasciato al momento.</div>`;
    }
  }
};
