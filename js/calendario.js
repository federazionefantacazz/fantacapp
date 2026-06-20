export const CalendarioPage = {
  renderHTML() {
    return `
      <div class="page" id="page-calendario">
        <div class="sec" style="margin-top:1.2rem">Calendario Incontri</div>
        
        <div class="card card-sm" style="margin-bottom:1rem;">
          <div class="label" style="margin-bottom:.4rem;">Seleziona Turno di Gioco</div>
          <select id="calGwSelect" class="select-rose"></select>
        </div>

        <div class="label" id="calGwTitle" style="margin-bottom:.5rem; color:var(--accent);">GIORNATA DI CAMPIONATO</div>
        <div id="calendarMatchesContainer" style="display:flex; flex-direction:column; gap:.5rem;"></div>
      </div>
    `;
  },

  // Funzione di supporto interna al modulo
  _selectedCompName(comp) {
    if (!comp || !comp.name) return "CAMPIONATO";
    return comp.name.toUpperCase();
  },

  render(STATE) {
    const select = document.getElementById('calGwSelect');
    const container = document.getElementById('calendarMatchesContainer');
    const titleEl = document.getElementById('calGwTitle');
    if (!select || !container) return;

    // Salva il valore precedentemente selezionato dall'utente prima del re-render per non perderlo
    const previousUserSelection = select.value;

    // Recuperiamo la competizione corrente dallo stato globale
    const currentCompId = STATE.currentCompetition;
    const currentCompData = STATE.competitions ? STATE.competitions.find(c => c.id === currentCompId) : null;
    
    // Prendi i match dallo STATE globale popolato da index.html
    const matchesNode = STATE.matches || (currentCompData ? currentCompData.matches : null);

    if (!matchesNode || Object.keys(matchesNode).length === 0) {
      select.innerHTML = '<option value="">Nessun turno disponibile</option>';
      container.innerHTML = `
        <div style="text-align:center; padding:2rem; color:var(--text2); font-size:.85rem;">
          🗓️ Nessun calendario generato per questa competizione.
        </div>`;
      if (titleEl) titleEl.textContent = "CAMPIONATO";
      return;
    }

    // Ordina le giornate reali (gw1, gw2, ecc.)
    const giornateEstraibili = Object.keys(matchesNode).sort((a, b) => {
      return parseInt(a.replace('gw', '')) - parseInt(b.replace('gw', ''));
    });

    // Aggiorna il menu a tendina solo se cambia la competizione o il numero totale di giornate nel DB
    if (select.dataset.currentComp !== currentCompId || select.options.length !== giornateEstraibili.length) {
      select.dataset.currentComp = currentCompId;
      
      select.innerHTML = giornateEstraibili.map(gwKey => {
        const num = gwKey.replace('gw', '');
        return `<option value="${gwKey}">Giornata ${num}</option>`;
      }).join('');

      // Imposta la giornata attiva dell'admin o dello status della competizione
      const activeGW = STATE.status?.currentGW || (currentCompData?.status?.currentGW) || 1;
      select.value = `gw${activeGW}`;
    } else if (previousUserSelection && select.querySelector(`option[value="${previousUserSelection}"]`)) {
      // Altrimenti mantieni la giornata che l'utente stava guardando
      select.value = previousUserSelection;
    }

    // Funzione che disegna i match a schermo
    const drawSelectedTurn = () => {
      const selectedGW = select.value;
      if (!selectedGW || !matchesNode[selectedGW]) {
        container.innerHTML = '';
        return;
      }

      if (titleEl) {
        titleEl.textContent = `${this._selectedCompName(currentCompData)} — TURNO ${selectedGW.replace('gw', '')}`;
      }

      const turnMatches = Object.values(matchesNode[selectedGW]);
      
      if (turnMatches.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:1rem; font-size:.85rem; color:var(--text3);">Nessun match programmato in questa giornata.</div>';
        return;
      }

      container.innerHTML = turnMatches.map(match => {
        const teamHome = (STATE.teams || []).find(t => t.id === match.homeId) || { name: match.homeId, logo: null };
        const teamAway = (STATE.teams || []).find(t => t.id === match.awayId) || { name: match.awayId, logo: null };
        
        // --- BLOCCO LOGHI DINAMICI COME NELLA HOME ---
        const logoHomeHTML = teamHome.logo 
          ? `<img src="${teamHome.logo}" alt="Logo ${teamHome.name}" style="width:32px; height:32px; object-fit:contain; border-radius:4px; flex-shrink:0;">`
          : `<div style="width:32px; height:32px; background:var(--bg3); display:flex; align-items:center; justify-content:center; border-radius:4px; font-size:1rem; color:var(--text3); flex-shrink:0;">🛡️</div>`;

        const logoAwayHTML = teamAway.logo 
          ? `<img src="${teamAway.logo}" alt="Logo ${teamAway.name}" style="width:32px; height:32px; object-fit:contain; border-radius:4px; flex-shrink:0;">`
          : `<div style="width:32px; height:32px; background:var(--bg3); display:flex; align-items:center; justify-content:center; border-radius:4px; font-size:1rem; color:var(--text3); flex-shrink:0;">🛡️</div>`;
        // ---------------------------------------------
        
        // Controlliamo se la partita è finita o se i punteggi inseriti sono validi (inclusi gli zeri)
        const hasHomeScore = match.homeScore !== undefined && match.homeScore !== null && match.homeScore !== '';
        const hasAwayScore = match.awayScore !== undefined && match.awayScore !== null && match.awayScore !== '';
        
        const scoreHome = (match.finished || hasHomeScore) ? match.homeScore : '-';
        const scoreAway = (match.finished || hasAwayScore) ? match.awayScore : '-';
        
        const gironeLabel = match.grid || match.girone ? `
          <div style="font-size: .65rem; color: var(--gold); font-weight: bold; text-transform: uppercase; margin-bottom: .2rem; letter-spacing: 0.5px;">
            📍 ${match.grid || match.girone}
          </div>` : '';

        return `
          <div class="pcard" style="padding:1rem; display:flex; flex-direction:column; justify-content:center; gap:0.2rem;">
            ${gironeLabel}
            <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
              
              <div style="width:40%; display:flex; align-items:center; gap:.5rem; min-width:0;">
                ${logoHomeHTML}
                <div style="font-size:.85rem; font-weight:600; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${teamHome.name}</div>
              </div>
              
              <div style="width:20%; text-align:center; flex-shrink:0;">
                <div style="font-family:'DM Mono',monospace; font-size:1.1rem; font-weight:600; background:var(--bg3); padding:.2rem .4rem; border-radius:6px; letter-spacing:1px; color:#fff;">
                  ${scoreHome}:${scoreAway}
                </div>
              </div>
              
              <div style="width:40%; display:flex; align-items:center; justify-content:flex-end; gap:.5rem; text-align:right; min-width:0;">
                <div style="font-size:.85rem; font-weight:600; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${teamAway.name}</div>
                ${logoAwayHTML}
              </div>
              
            </div>
          </div>
        `;
      }).join('');
    };

    select.onchange = () => drawSelectedTurn();
    drawSelectedTurn();
  }
};
