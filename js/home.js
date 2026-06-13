export const HomePage = {
renderHTML() {
    const state = window.STATE || {};
    // Recupera i dati della competizione attiva dallo stato globale
    const compId = state.currentCompetition || 'fantacazz';
    const compData = (state.competitions && state.competitions[compId]) || {};
    
    // Controlla se la giornata è salvata dentro un sotto-oggetto status o direttamente
    const currentGw = (compData.status && compData.status.currentGW) || compData.currentGw || 1;
    const marketOpen = compData.marketOpen !== false;

    return `
      <div class="page" id="page-home" style="padding-top: 1.5rem;">
        
        <div class="app-header" style="margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; position: relative;">
          <div style="width: 32px;"></div>
          <div class="logo" style="font-size: 2.4rem; letter-spacing: 2px;">FANTACAZZ</div>
          <button onclick=\"window.doFirebaseLogout()\" style="background: transparent; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; -webkit-tap-highlight-color: transparent;" title="Disconnetti">
            <svg viewBox="0 0 24 24" width="22" height=\"22\" stroke="var(--accent3)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>

        <div class="grid-2" style="margin-bottom: 1.5rem;">
          <div class="card stat-card" style="display: flex; align-items: center; gap: 1rem; padding: 1.2rem;">
            <div style="font-size: 2rem;">📅</div>
            <div>
              <div style="font-size: 0.8rem; color: var(--text2); text-transform: uppercase; font-weight: 500;">Giornata</div>
              <div style="font-size: 1.3rem; font-weight: 700; color: var(--accent2);">Giornata ${currentGw}</div>
            </div>
          </div>

          <div class="card stat-card" style="display: flex; align-items: center; gap: 1rem; padding: 1.2rem;">
            <div style="font-size: 2rem;">🛒</div>
            <div>
              <div style="font-size: 0.8rem; color: var(--text2); text-transform: uppercase; font-weight: 500;">Mercato</div>
              <div style="font-size: 1.3rem; font-weight: 700; color: ${marketOpen ? 'var(--accent)' : 'var(--accent3)'};">
                ${marketOpen ? 'APERTO' : 'CHIUSO'}
              </div>
            </div>
          </div>
        </div>

        <div class="card" style="margin-bottom: 1.5rem; padding: 1.2rem;">
          <h3 style="font-size: 1.1rem; margin-bottom: 1rem; font-family: 'Bebas Neue', sans-serif; letter-spacing: 1px; color: var(--text);">
            ⚽ LIVE MATCHES
          </h3>
          <div id="home-live-matches">
            <div style="color:var(--text3); font-size:.85rem; text-align:center; padding:1rem">Nessun match attivo al momento.</div>
          </div>
        </div>

        <div class="card" style="padding: 1.2rem;">
          <h3 style="font-size: 1.1rem; margin-bottom: 1rem; font-family: 'Bebas Neue', sans-serif; letter-spacing: 1px; color: var(--text);">
            📈 VOTI LIVE DEL GIORNO
          </h3>
          <div id="home-live-votes">
            <div style="color:var(--text3); font-size:.85rem; text-align:center; padding:1rem">Nessun voto live inserito.</div>
          </div>
        </div>

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
