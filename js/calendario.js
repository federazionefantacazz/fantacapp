import { createMatchCardResult } from './components/MatchCardResult.js';

export const CalendarioPage = {
  renderHTML() {
    return `
      <div class="page" id="page-calendario">
        <div class="sec" style="margin-top:1.2rem">Calendario Incontri</div>
        
        <div class="card card-sm" style="margin-bottom:1rem; border:1px solid rgba(255,255,255,0.08); background:var(--bg2);">
          <div class="label" style="margin-bottom:.4rem;">Seleziona Turno di Gioco</div>
          <select id="calGwSelect" class="select-rose"></select>
        </div>

        <div class="label" id="calGwTitle" style="margin-bottom:.5rem; color:var(--accent);">GIORNATA DI CAMPIONATO</div>
        <div id="calendarMatchesContainer" style="display:flex; flex-direction:column; gap:.5rem; padding-bottom:2rem;"></div>
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
    
    // Recupera la mappa delle giornate
    const matchesNode = STATE.matches || (currentCompData ? currentCompData.matches : null);

    if (!matchesNode || Object.keys(matchesNode).length === 0) {
      select.innerHTML = '<option value="">Nessun turno disponibile</option>';
      
      // Sostituita l'emoji con Remix Icon
      container.innerHTML = `
        <div style="text-align:center; padding:2.5rem 1rem; color:var(--text3); font-size:.9rem; background:var(--bg2); border-radius:12px; border:1px solid rgba(255,255,255,0.05); display:flex; flex-direction:column; align-items:center; gap:0.5rem;">
          <i class="ri-calendar-close-line" style="font-size:2rem; color:var(--text2);"></i>
          <span>Nessun calendario generato.</span>
        </div>
      `;
      return;
    }

    // Ordina le giornate (es. gw1, gw2, gw_playoff_1...)
    const giornateEstraibili = Object.keys(matchesNode).sort((a, b) => {
      const isAPlayoff = a.startsWith('gw_playoff_');
      const isBPlayoff = b.startsWith('gw_playoff_');
      if (isAPlayoff && !isBPlayoff) return 1;
      if (!isAPlayoff && isBPlayoff) return -1;
      const numA = parseInt(a.replace('gw_playoff_', '').replace('gw', '')) || 0;
      const numB = parseInt(b.replace('gw_playoff_', '').replace('gw', '')) || 0;
      return numA - numB;
    });

    // Popola la select se cambia la competizione
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

    const drawSelectedTurn = () => {
      const selectedGW = select.value;
      if (!selectedGW || !matchesNode[selectedGW]) return;

      if (titleEl) {
        const compName = CalendarioPage._selectedCompName(currentCompData);
        const turnNum = selectedGW.replace('gw_playoff_', '').replace('gw', '');
        titleEl.textContent = `${compName} — TURNO ${turnNum}`;
      }

      // Estrae le partite della giornata selezionata
      const couplesObj = matchesNode[selectedGW]?.couples || matchesNode[selectedGW] || {};
      const turnMatches = Array.isArray(couplesObj) ? couplesObj : Object.values(couplesObj);
      const currentTeams = STATE.teams || [];

      // Generiamo le card usando il componente importato
      container.innerHTML = turnMatches.map(match => createMatchCardResult(match, currentTeams)).join('');
    };

    select.onchange = drawSelectedTurn;
    drawSelectedTurn();
  }
};
