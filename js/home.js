export const HomePage = {
renderHTML() {
    // Recuperiamo le competizioni dallo stato globale (popolato in index.html)
    const allComps = (window.STATE && window.STATE.allCompetitions) ? window.STATE.allCompetitions : [];
    const currentId = (window.STATE && window.STATE.currentCompetition) ? window.STATE.currentCompetition : 'fantacazz';

    // Generiamo le opzioni in modo dinamico
    const optionsHTML = allComps.map(c => `
      <option value="${c.id}" ${currentId === c.id ? 'selected' : ''}>
        🏆 ${c.name || c.id}
      </option>
    `).join('');

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
          <div id="home-team-name" class:"text" style="font-size: 1.8rem; font-family: 'Bebas Neue'; line-height: 1.2; margin-bottom: .8rem;">-</div>
          
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

        <div class="card card-sm" style="margin-bottom: 1.2rem; padding: .8rem 1rem;">
          <div class="label" style="margin-bottom: .4rem;">Seleziona Competizione</div>
          <select id="home-competition-select" class="select-rose" style="background: var(--bg3); width:100%; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:.6rem; color:#fff;" onchange="window._handleCompetitionChange(this.value)">
            ${optionsHTML}
          </select>
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

  render(STATE) {
    const gw = document.getElementById('home-gw');
    const lv = document.getElementById('live-votes');
    const compSelect = document.getElementById('home-competition-select');
    
    // Elementi del nuovo box squadra stile giornata
    const teamNameEl = document.getElementById('home-team-name');
    const teamPosEl = document.getElementById('home-team-pos');
    const teamPtsEl = document.getElementById('home-team-pts');
    
    if (!gw) return;

    // 1. Sincronizza il selettore grafico con la competizione attiva nello stato
    if (compSelect && STATE.currentCompetition) {
      compSelect.value = STATE.currentCompetition;
    }

    // 2. Imposta la giornata corrente
    gw.textContent = `GIORNATA ${STATE.status?.currentGW || 1}`;

    // 3. Calcolo dinamico della Posizione e dei Punti della squadra loggata
    if (STATE.user && STATE.teams && STATE.teams.length > 0) {
      // Imposta Nome ed Emoji
      teamNameEl.textContent = `${STATE.user.emoji || '⚽'} ${STATE.user.name.toUpperCase()}`;
      
      // Troviamo l'indice (la posizione) della nostra squadra nell'array teams (che è già ordinato per punti dal server)
      const miaPosizioneIndex = STATE.teams.findIndex(t => t.id === STATE.user.id);
      
      if (miaPosizioneIndex !== -1) {
        const miaSquadraDati = STATE.teams[miaPosizioneIndex];
        const posizioneReale = miaPosizioneIndex + 1;
        
        teamPosEl.textContent = `${posizioneReale}° Posto`;
        // Gestione di sicurezza se i punti sono decimali o non definiti
        const puntiSvd = miaSquadraDati.pts !== undefined ? miaSquadraDati.pts : 0;
        teamPtsEl.textContent = typeof puntiSvd === 'number' ? puntiSvd.toFixed(1) : puntiSvd;
      } else {
        // Fallback se la squadra non viene trovata nell'elenco globale
        teamPosEl.textContent = N/A;
        teamPtsEl.textContent = `--`;
      }
    } else {
      teamNameEl.textContent = STATE.user ? `${STATE.user.emoji || '⚽'} ${STATE.user.name}` : 'Nessuna Squadra';
      teamPosEl.textContent = `--`;
      teamPtsEl.textContent = `--`;
    }

    // 4. Rendering dei Voti Live
    const vArr = Object.entries(STATE.votes || {});
    if (vArr.length === 0) {
      lv.innerHTML = `<div style="color:var(--text3);font-size:.85rem;text-align:center;padding:1rem">Nessun voto live inserito.</div>`;
    } else {
      lv.innerHTML = vArr.map(([pid, val]) => {
        const p = STATE.players.find(x => x.id === pid) || { name: pid, role: 'C', club: '' };
        
        // Assegna la classe di colore in base al voto (verde se >= 7, rosso se grave insufficienza, grigio altrimenti)
        let badgeClass = 'mv-badge';
        let customStyle = 'padding: .2rem .5rem; border-radius: 6px; font-weight: bold; font-family: "DM Mono", monospace; ';
        if (val >= 7) {
          customStyle += 'background: rgba(80, 227, 194, 0.15); color: var(--accent);';
        } else if (val < 5.5) {
          customStyle += 'background: rgba(255, 107, 107, 0.15); color: var(--accent3);';
        } else {
          customStyle += 'background: rgba(255, 255, 255, 0.08); color: var(--text);';
        }

        return `
          <div class="pcard">
            <div class="rbadge r${p.role}">${p.role}</div>
            <div class="pi">
              <div class="pn">${p.name}</div>
              <div class="pm">${p.club}</div>
            </div>
            <div class="pr">
              <span style="${customStyle}">${val.toFixed(1)}</span>
            </div>
          </div>
        `;
      }).join('');
    }
  }
};
