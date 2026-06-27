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

    // Ordina le giornate: prima le gw normali (numericamente), poi i turni playoff
    const giornateEstraibili = Object.keys(matchesNode).sort((a, b) => {
      const aIsPlayoff = a.startsWith('gw_playoff_');
      const bIsPlayoff = b.startsWith('gw_playoff_');
      if (aIsPlayoff && !bIsPlayoff) return 1;
      if (!aIsPlayoff && bIsPlayoff) return -1;
      const numA = parseInt(a.replace('gw_playoff_', '').replace('gw', ''));
      const numB = parseInt(b.replace('gw_playoff_', '').replace('gw', ''));
      return numA - numB;
    });

    // Aggiorna il menu a tendina solo se cambia la competizione o il numero totale di giornate nel DB
    if (select.dataset.currentComp !== currentCompId || select.options.length !== giornateEstraibili.length) {
      select.dataset.currentComp = currentCompId;
      
      select.innerHTML = giornateEstraibili.map(gwKey => {
        const label = gwKey.startsWith('gw_playoff_')
          ? `Turno Playoff ${gwKey.replace('gw_playoff_', '')}`
          : `Giornata ${gwKey.replace('gw', '')}`;
        return `<option value="${gwKey}">${label}</option>`;
      }).join('');

      // Risolve la gwKey a partire dalla giornata reale corrente tramite associazioniGwReali
      const associazioni = currentCompData?.associazioniGwReali || {};
      const giornataReale = STATE.giornataRealeCorrente;
      const gwDaReale = giornataReale ? associazioni[String(giornataReale)] : null;

      if (gwDaReale && select.querySelector(`option[value="${gwDaReale}"]`)) {
        // Priorita': giornata reale corrente mappata tramite associazioniGwReali
        select.value = gwDaReale;
      } else {
        // Fallback: prima gwKey disponibile
        select.value = giornateEstraibili[0] || '';
      }
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
    
      // Recupera i match
      const turnData = matchesNode[selectedGW];
      const turnMatches = Object.values(turnData.couples || {});
      
      if (titleEl) {
        const isPlayoff = selectedGW.startsWith('gw_playoff_');
        const displayGw = selectedGW.replace('gw_playoff_', '').replace('gw', '');
        titleEl.textContent = `${this._selectedCompName(currentCompData)} — ${isPlayoff ? 'PLAYOFF' : 'TURNO'} ${displayGw}`;
      }
    
      if (turnMatches.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:1rem; font-size:.85rem; color:var(--text3);">Nessun match programmato.</div>';
        return;
      }
    
      container.innerHTML = turnMatches.map(match => {
        // Gestione nomi squadre: se l'id contiene "VINCENTE_", mostra il segnaposto
        const getTeamName = (id) => {
          if (id.startsWith('VINCENTE_')) return id.replace(/_/g, ' ').toUpperCase();
          const team = (STATE.teams || []).find(t => t.id === id);
          return team ? team.name : id;
        };
    
        const teamHomeName = getTeamName(match.homeId);
        const teamAwayName = getTeamName(match.awayId);
        
        // Loghi (solo se non è una stringa "VINCENTE_")
        const getLogo = (id) => {
          const team = (STATE.teams || []).find(t => t.id === id);
          return team?.logo || null;
        };
    
        const logoHomeHTML = getLogo(match.homeId) 
          ? `<img src="${getLogo(match.homeId)}" style="width:32px; height:32px; object-fit:contain; border-radius:4px;">`
          : `<div style="width:32px; height:32px; background:var(--bg3); display:flex; align-items:center; justify-content:center; border-radius:4px;">🛡️</div>`;
    
        const logoAwayHTML = getLogo(match.awayId)
          ? `<img src="${getLogo(match.awayId)}" style="width:32px; height:32px; object-fit:contain; border-radius:4px;">`
          : `<div style="width:32px; height:32px; background:var(--bg3); display:flex; align-items:center; justify-content:center; border-radius:4px;">🛡️</div>`;
    
        // Etichetta: priorità alla 'label' (playoff), poi 'girone' (campionato)
        const topLabel = match.label || match.girone;
        const labelHTML = topLabel ? `
          <div style="font-size: .65rem; color: var(--gold); font-weight: bold; text-transform: uppercase; margin-bottom: .2rem; letter-spacing: 0.5px;">
            📍 ${topLabel}
          </div>` : '';
    
        const scoreHome = (match.finished || match.homeScore != null) ? match.homeScore : '-';
        const scoreAway = (match.finished || match.awayScore != null) ? match.awayScore : '-';
    
        return `
          <div class="pcard" style="padding:1rem; display:flex; flex-direction:column; gap:0.2rem;">
            ${labelHTML}
            <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
              <div style="width:45%; display:flex; align-items:center; gap:.5rem;">
                ${logoHomeHTML}
                <div style="font-size:.85rem; font-weight:600; overflow:hidden; text-overflow:ellipsis;">${teamHomeName}</div>
              </div>
              <div style="width:10%; text-align:center; font-family:'DM Mono',monospace; font-weight:600;">${scoreHome}:${scoreAway}</div>
              <div style="width:45%; display:flex; align-items:center; justify-content:flex-end; gap:.5rem;">
                <div style="font-size:.85rem; font-weight:600; overflow:hidden; text-overflow:ellipsis; text-align:right;">${teamAwayName}</div>
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
