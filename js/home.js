export const HomePage = {
  // 1. Metodo che genera lo scheletro HTML (senza la select competizione)
  renderHTML(STATE = {}) {
    return `
      <div class="page" id="page-home" style="padding-top: 1.5rem;">
        <div class="app-header" style="margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; position: relative;">
          <div style="width: 32px;"></div> <div class="logo" style="font-size: 2.4rem; letter-spacing: 2px;">FANTACAZZ</div>
          <button onclick="window.doFirebaseLogout()" style="background: transparent; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; -webkit-tap-highlight-color: transparent;" title="Disconnetti">
            <svg viewBox="0 0 24 24" width="22" height="22" stroke="var(--accent3)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>

        <div class="card" style="background: linear-gradient(135deg, var(--card), var(--bg3)); margin-bottom: 1rem; padding: 1.2rem;">
          <div class="text2" id="home-team-title">LA TUA SQUADRA</div>
          
          <div style="display: flex; align-items: center; gap: .8rem; margin-top: .4rem; margin-bottom: .8rem;">
            <div id="home-team-logo-container"></div>
            <div id="home-team-name" style="font-size: 1.8rem; font-family: 'Bebas Neue'; line-height: 1.2; padding-top: 2px;">-</div>
          </div>
          
          <div style="display: flex; gap: 1rem; border-top: 1px solid rgba(255,255,255,0.08); padding-top: .8rem;">
            <div style="flex: 1;">
              <div class="label" style="font-size: .65rem;">Posizione</div>
              <div id="home-team-pos" style="font-size: 1.4rem; font-family: 'DM Mono', monospace; font-weight: 600; color: var(--accent);">-</div>
            </div>
            <div style="flex: 1; border-left: 1px solid rgba(255,255,255,0.08); padding-left: 1rem;">
              <div class="label" style="font-size: .65rem;">Punti Totali</div>
              <div id="home-team-pts" style="font-size: 1.4rem; font-family: 'DM Mono', monospace; font-weight: 600; color: var(--gold);">-</div>
            </div>
          </div>
        </div>

        <div class="card" style="background: linear-gradient(135deg, var(--card), rgba(255,255,255,0.02)); margin-bottom: 1.5rem;">
          <div class="label">Giornata Attuale</div>
          <div id="home-gw" style="font-size: 2rem; font-family: 'Bebas Neue'; color: #fff">-</div>
        </div>

        <div class="sec">🔴 Voti Live GW</div>
        <div id="live-votes" style="max-height: 300px; overflow-y: auto; padding-right: .2rem;"></div>
      </div>
    `;
  },

  // 2. Metodo per popolare i dati aggiornato
  render(STATE = {}) {
    const container = document.getElementById('page-home');
    if (!container) return;

    // Se il container è vuoto, inizializzalo
    if (container.innerHTML === "") {
        container.innerHTML = this.renderHTML(STATE);
    }

    const gw = document.getElementById('home-gw');
    const lv = document.getElementById('live-votes');
    const teamLogoContainer = document.getElementById('home-team-logo-container');
    const teamNameEl = document.getElementById('home-team-name');
    const teamPosEl = document.getElementById('home-team-pos');
    const teamPtsEl = document.getElementById('home-team-pts');
    
    if (!gw) return;

    gw.textContent = `GIORNATA ${STATE.status?.currentGW || 1}`;

    if (STATE.user && STATE.teams && STATE.teams.length > 0) {
      teamNameEl.textContent = STATE.user.name.toUpperCase();
      
      const miaSquadraDati = STATE.teams.find(t => t.id === STATE.user.id);
      
      if (miaSquadraDati) {
        if (teamLogoContainer) {
          teamLogoContainer.innerHTML = miaSquadraDati.logo 
            ? `<img src="${miaSquadraDati.logo}" alt="Logo" style="width:40px; height:40px; object-fit:contain; border-radius:6px; display:block;">`
            : `<div style="width:40px; height:40px; background:var(--bg3); display:flex; align-items:center; justify-content:center; border-radius:6px; font-size:1.2rem; color:var(--text3)">🛡️</div>`;
        }

        const posizioneReale = STATE.teams.indexOf(miaSquadraDati) + 1;
        teamPosEl.textContent = `${posizioneReale}° Posto`;
        teamPtsEl.textContent = typeof miaSquadraDati.pts === 'number' ? miaSquadraDati.pts.toFixed(1) : (miaSquadraDati.pts || 0);
      } else {
        if (teamLogoContainer) teamLogoContainer.innerHTML = `<div style="width:40px; height:40px; background:var(--bg3); display:flex; align-items:center; justify-content:center; border-radius:6px; font-size:1.2rem; color:var(--text3)">🛡️</div>`;
      }
    }

    const vArr = Object.entries(STATE.votes || {});
    if (vArr.length > 0) {
        lv.innerHTML = vArr.map(([pid, val]) => {
            const p = (STATE.players || []).find(x => x.id === pid) || { name: pid, role: 'C', club: '' };
            let customStyle = 'padding: .2rem .5rem; border-radius: 6px; font-weight: bold; font-family: "DM Mono", monospace; ';
            if (val >= 7) customStyle += 'background: rgba(80, 227, 194, 0.15); color: var(--accent);';
            else if (val < 5.5) customStyle += 'background: rgba(255, 107, 107, 0.15); color: var(--accent3);';
            else customStyle += 'background: rgba(255, 255, 255, 0.08); color: var(--text);';

            return `
            <div class="pcard">
                <div class="rbadge r${p.role}">${p.role}</div>
                <div class="pi"><div class="pn">${p.name}</div><div class="pm">${p.club}</div></div>
                <div class="pr"><span style="${customStyle}">${val.toFixed(1)}</span></div>
            </div>`;
        }).join('');
    } else {
        lv.innerHTML = `<div style="text-align:center; padding:1.5rem; color:var(--text2); font-size:.85rem;">Nessun voto live disponibile al momento.</div>`;
    }
  }
};
