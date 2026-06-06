export const CalendarioPage = {
  renderHTML() {
    return `
      <div class="page" id="page-calendario">
        <div class="sec" style="margin-top:1.2rem">Calendario Incontri</div>
        <div class="card card-sm" style="margin-bottom:1rem;">
          <div class="label" style="margin-bottom:.4rem;">Seleziona Turno di Gioco</div>
          <select id="calGwSelect" class="select-rose"></select>
        </div>
        <div class="label" id="calGwTitle" style="margin-bottom:.5rem; color:var(--accent);">GIORNATA FANTACALCIO</div>
        <div id="calendarMatchesContainer" style="display:flex; flex-direction:column; gap:.5rem;"></div>
      </div>
    `;
  },
  render(STATE) {
    const select = document.getElementById('calGwSelect');
    if(!select) return;

    // Se cambia competizione, forziamo il reset delle opzioni del calendario
    if(select.options.length === 0 || select.dataset.currentComp !== STATE.currentCompetition) {
      select.dataset.currentComp = STATE.currentCompetition;
      let opts = '';
      for (let fantaGw = 1; fantaGw <= 33; fantaGw++) {
        const serieAGw = fantaGw + 2;
        opts += `<option value="${fantaGw}">Giornata ${fantaGw} (${serieAGw}ª Serie A)</option>`;
      }
      select.innerHTML = opts;
      select.value = STATE.status?.currentGW || 1;

      // Cloniamo il select per rimuovere vecchi event listener accumulati
      const newSelect = select.cloneNode(true);
      select.parentNode.replaceChild(newSelect, select);
      newSelect.addEventListener('change', () => this.drawMatches(STATE));
    }
    this.drawMatches(STATE);
  },
  drawMatches(STATE) {
    const select = document.getElementById('calGwSelect');
    const container = document.getElementById('calendarMatchesContainer');
    const title = document.getElementById('calGwTitle');
    if(!select || !container) return;

    const selectedGw = parseInt(select.value) || 1;
    title.textContent = `⚽ INCONTRI GIORNATA ${selectedGw} (${selectedGw + 2}ª SERIE A)`;

    const matchesData = STATE.matches ? STATE.matches[`gw${selectedGw}`] : null;
    if (!matchesData || Object.keys(matchesData).length === 0) {
      container.innerHTML = `<div style="color:var(--text3);text-align:center;padding:2.5rem;font-size:.85rem;background:var(--bg2);border-radius:12px;">Nessun match programmato per questa giornata.</div>`;
      return;
    }

    container.innerHTML = Object.values(matchesData).map(match => {
      const teamHome = STATE.teams.find(t => t.id === match.homeId) || { name: match.homeId, emoji: '🏠' };
      const teamAway = STATE.teams.find(t => t.id === match.awayId) || { name: match.awayId, emoji: '🚌' };
      const scoreHome = match.finished || match.homeScore !== undefined ? match.homeScore : '-';
      const scoreAway = match.finished || match.awayScore !== undefined ? match.awayScore : '-';
      return `
        <div class="pcard" style="padding:1rem; display:flex; align-items:center; justify-content:space-between;">
          <div style="width:40%; display:flex; align-items:center; gap:.5rem;">
            <span style="font-size:1.2rem;">${teamHome.emoji || '⚽'}</span>
            <div style="font-size:.85rem; font-weight:600; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${teamHome.name}</div>
          </div>
          <div style="width:20%; text-align:center;">
            <div style="font-family:'DM Mono',monospace; font-size:1.1rem; font-weight:600; background:var(--bg3); padding:.2rem .6rem; border-radius:6px; letter-spacing:2px;">
              ${scoreHome}:${scoreAway}
            </div>
          </div>
          <div style="width:40%; display:flex; align-items:center; justify-content:flex-end; gap:.5rem; text-align:right;">
            <div style="font-size:.85rem; font-weight:600; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${teamAway.name}</div>
            <span style="font-size:1.2rem;">${teamAway.emoji || '⚽'}</span>
          </div>
        </div>
      `;
    }).join('');
  }
};
