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

  _selectedCompName(comp) {
    if (!comp || !comp.name) return "CAMPIONATO";
    return comp.name.toUpperCase();
  },

  render(STATE) {
    const select = document.getElementById('calGwSelect');
    const container = document.getElementById('calendarMatchesContainer');
    const titleEl = document.getElementById('calGwTitle');
    
    if (!select || !container) return;

    const previousUserSelection = select.value;
    const currentCompId = STATE.currentCompetition;
    const currentCompData = STATE.competitions ? STATE.competitions.find(c => c.id === currentCompId) : null;
    const matchesNode = STATE.matches || (currentCompData ? currentCompData.matches : null);

    if (!matchesNode || Object.keys(matchesNode).length === 0) {
      select.innerHTML = '<option value="">Nessun turno disponibile</option>';
      container.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text2); font-size:.85rem;">🗓️ Nessun calendario generato.</div>`;
      return;
    }

    // Ordina le giornate
    const giornateEstraibili = Object.keys(matchesNode).sort((a, b) => {
      const isAPlayoff = a.startsWith('gw_playoff_');
      const isBPlayoff = b.startsWith('gw_playoff_');
      if (isAPlayoff && !isBPlayoff) return 1;
      if (!isAPlayoff && isBPlayoff) return -1;
      const numA = parseInt(a.replace('gw_playoff_', '').replace('gw', ''));
      const numB = parseInt(b.replace('gw_playoff_', '').replace('gw', ''));
      return numA - numB;
    });

    if (select.dataset.currentComp !== currentCompId || select.options.length !== giornateEstraibili.length) {
      select.dataset.currentComp = currentCompId;
      select.innerHTML = giornateEstraibili.map(gwKey => {
        const label = gwKey.startsWith('gw_playoff_')
          ? `Turno Playoff ${gwKey.replace('gw_playoff_', '')}`
          : `Giornata ${gwKey.replace('gw', '')}`;
        return `<option value="${gwKey}">${label}</option>`;
      }).join('');

      const associazioni = currentCompData?.associazioniGwReali || {};
      const gwDaReale = STATE.giornataRealeCorrente ? associazioni[String(STATE.giornataRealeCorrente)] : null;
      select.value = gwDaReale && select.querySelector(`option[value="${gwDaReale}"]`) ? gwDaReale : giornateEstraibili[0];
    } else if (previousUserSelection && select.querySelector(`option[value="${previousUserSelection}"]`)) {
      select.value = previousUserSelection;
    }

    const getTeamData = (teamId, teamsArray) => {
      if (!teamsArray || !Array.isArray(teamsArray)) return { name: teamId || "...", logo: null };
      const team = teamsArray.find(t => t.id === teamId);
      return team || { name: teamId || "...", logo: null };
    };

    const drawSelectedTurn = () => {
      const selectedGW = select.value;
      if (!selectedGW || !matchesNode[selectedGW]) return;

      if (titleEl) {
        titleEl.textContent = `${this._selectedCompName(currentCompData)} — TURNO ${selectedGW.replace('gw_playoff_', '').replace('gw', '')}`;
      }

      const turnMatches = Object.values(matchesNode[selectedGW]?.couples || {});
      const currentTeams = STATE.teams || [];

      container.innerHTML = turnMatches.map(match => {
        const teamHome = getTeamData(match.homeId, currentTeams);
        const teamAway = getTeamData(match.awayId, currentTeams);
        
        const logoHomeHTML = teamHome.logo ? `<img src="${teamHome.logo}" style="width:32px; height:32px; object-fit:contain; border-radius:4px; flex-shrink:0;">` : `<div style="width:32px; height:32px; background:var(--bg3); display:flex; align-items:center; justify-content:center; border-radius:4px; font-size:1rem; color:var(--text3); flex-shrink:0;">🛡️</div>`;
        const logoAwayHTML = teamAway.logo ? `<img src="${teamAway.logo}" style="width:32px; height:32px; object-fit:contain; border-radius:4px; flex-shrink:0;">` : `<div style="width:32px; height:32px; background:var(--bg3); display:flex; align-items:center; justify-content:center; border-radius:4px; font-size:1rem; color:var(--text3); flex-shrink:0;">🛡️</div>`;
        
        const scoreHome = (match.finished || match.homeScore != null) ? match.homeScore : '-';
        const scoreAway = (match.finished || match.awayScore != null) ? match.awayScore : '-';
        const labelHTML = match.label || match.girone ? `<div style="font-size:.65rem; color:var(--gold); font-weight:bold; text-transform:uppercase; margin-bottom:.2rem;">📍 ${match.label || match.girone}</div>` : '';

        return `
          <div class="pcard" style="padding:1rem; display:flex; flex-direction:column; gap:0.2rem;">
            ${labelHTML}
            <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
              <div style="width:40%; display:flex; align-items:center; gap:.5rem; min-width:0;">
                ${logoHomeHTML}
                <div style="font-size:.85rem; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${teamHome.name}</div>
              </div>
              <div style="width:20%; text-align:center;">
                <div style="font-family:'DM Mono',monospace; font-size:1.1rem; font-weight:600; background:var(--bg3); padding:.2rem .4rem; border-radius:6px; color:#fff;">${scoreHome}:${scoreAway}</div>
              </div>
              <div style="width:40%; display:flex; align-items:center; justify-content:flex-end; gap:.5rem; min-width:0;">
                <div style="font-size:.85rem; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-align:right;">${teamAway.name}</div>
                ${logoAwayHTML}
              </div>
            </div>
          </div>
        `;
      }).join('');
    };

    select.onchange = drawSelectedTurn;
    drawSelectedTurn();
  }
};
