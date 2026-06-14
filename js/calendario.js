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

  render(STATE) {
    const select = document.getElementById('calGwSelect');
    const container = document.getElementById('calendarMatchesContainer');
    const titleEl = document.getElementById('calGwTitle');
    if (!select || !container) return;

    // Recuperiamo la competizione corrente dallo stato globale
    const currentCompId = STATE.currentCompetition;
    const currentCompData = STATE.competitions ? STATE.competitions.find(c => c.id === currentCompId) : null;
    const matchesNode = currentCompData ? currentCompData.matches : null;

    if (!matchesNode || Object.keys(matchesNode).length === 0) {
      select.innerHTML = '<option value="">Nessun turno disponibile</option>';
      container.innerHTML = `
        <div style="text-align:center; padding:2rem; color:var(--text2); font-size:.85rem;">
          🗓️ Nessun calendario generato per questa competizione.
        </div>`;
      if (titleEl) titleEl.textContent = "CAMPIONATO";
      return;
    }

    // Ricostruiamo le opzioni del select in base alle giornate reali trovate in Firebase
    const giornateEstraibili = Object.keys(matchesNode).sort((a, b) => {
      return parseInt(a.replace('gw', '')) - parseInt(b.replace('gw', ''));
    });

    if (select.dataset.currentComp !== currentCompId || select.options.length !== giornateEstraibili.length) {
      select.dataset.currentComp = currentCompId;
      
      select.innerHTML = giornateEstraibili.map(gwKey => {
        const num = gwKey.replace('gw', '');
        return `<option value="${gwKey}">Giornata ${num}</option>`;
      }).join('');

      // Ci posizioniamo sulla giornata attiva impostata dall'admin
      const activeGW = currentCompData.status?.currentGW || 1;
      select.value = `gw${activeGW}`;
    }

    // Funzione interna di disegno del turno selezionato
    const drawSelectedTurn = () => {
      const selectedGW = select.value;
      if (!selectedGW || !matchesNode[selectedGW]) {
        container.innerHTML = '';
        return;
      }

      if (titleEl) {
        titleEl.textContent = `${selectedCompName(currentCompData)} — TURNO ${selectedGW.replace('gw', '')}`;
      }

      const turnMatches = Object.values(matchesNode[selectedGW]);
      
      if (turnMatches.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:1rem; font-size:.85rem; color:var(--text3);">Nessun match programmato in questa giornata.</div>';
        return;
      }

      container.innerHTML = turnMatches.map(match => {
        const teamHome = (STATE.teams || []).find(t => t.id === match.homeId) || { name: match.homeId, emoji: '🏠' };
        const teamAway = (STATE.teams || []).find(t => t.id === match.awayId) || { name: match.awayId, emoji: '🚌' };
        
        const scoreHome = match.finished || match.homeScore !== null ? match.homeScore : '-';
        const scoreAway = match.finished || match.awayScore !== null ? match.awayScore : '-';
        
        // Se il match ha un girone di appartenenza (competizione mista), stampiamo il badge dedicato
        const gironeLabel = match.girone ? `
          <div style="font-size: .65rem; color: var(--gold); font-weight: bold; text-transform: uppercase; margin-bottom: .2rem; letter-spacing: 0.5px;">
            📍 ${match.girone}
          </div>` : '';

        return `
          <div class="pcard" style="padding:1rem; display:flex; flex-direction:column; justify-content:center; gap:0.2rem;">
            ${gironeLabel}
            <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
              <div style="width:40%; display:flex; align-items:center; gap:.5rem;">
                <span style="font-size:1.2rem;">${teamHome.emoji || '🛡️'}</span>
                <div style="font-size:.85rem; font-weight:600; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${teamHome.name}</div>
              </div>
              <div style="width:20%; text-align:center;">
                <div style="font-family:'DM Mono',monospace; font-size:1.1rem; font-weight:600; background:var(--bg3); padding:.2rem .6rem; border-radius:6px; letter-spacing:2px; color:#fff;">
                  ${scoreHome}:${scoreAway}
                </div>
              </div>
              <div style="width:40%; display:flex; align-items:center; justify-content:flex-end; gap:.5rem; text-align:right;">
                <div style="font-size:.85rem; font-weight:600; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${teamAway.name}</div>
                <span style="font-size:1.2rem;">${teamAway.emoji || '🛡️'}</span>
              </div>
            </div>
          </div>
        `;
      }).join('');
    };

    // Colleghiamo l'evento onchange se non ancora presente
    select.onchange = () => drawSelectedTurn();
    
    // Disegniamo subito
    drawSelectedTurn();
  }
};

function selectedCompName(comp) {
  if (!comp) return "CAMPIONATO";
  return comp.name.toUpperCase();
}
