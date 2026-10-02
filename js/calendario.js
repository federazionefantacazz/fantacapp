import { GwService } from './services/gwService.js';
import { LiveMatchModule } from './liveMatch.js';
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

  _ctx: null,

  // Comportamento del click su una partita in base alla fase della giornata
  onMatchClick(matchKey) {
    const ctx = this._ctx;
    if (!ctx) return;
    const couple = ctx.couples.find(c => String(c.key) === String(matchKey));
    if (!couple) return;

    if (ctx.phase === 'past') {
      LiveMatchModule.openViewer({ comp: ctx.comp, gwKey: ctx.gwKey, couple, mode: 'past' });
    } else if (ctx.phase === 'next') {
      LiveMatchModule.openViewer({ comp: ctx.comp, gwKey: ctx.gwKey, couple, mode: 'next' });
    } else if (ctx.phase === 'current') {
      LiveMatchModule._pendingKey = couple.key;
      window.goPage('live', document.getElementById('btn-nav-formazione'));
    } else {
      this._popup('Non è ancora possibile vedere questo match.');
    }
  },

  _popup(message) {
    document.getElementById('cal-popup')?.remove();
    const el = document.createElement('div');
    el.id = 'cal-popup';
    el.style.cssText = 'position:fixed;inset:0;z-index:6000;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:1.5rem;';
    el.innerHTML = `
      <div class="card" style="max-width:340px;width:100%;text-align:center;padding:1.5rem;">
        <div style="font-size:2rem;color:var(--text2);margin-bottom:.5rem;"><i class="ri-lock-line"></i></div>
        <div style="font-size:.95rem;margin-bottom:1.2rem;">${message}</div>
        <button class="btn btn-green" id="cal-popup-ok">OK</button>
      </div>`;
    document.body.appendChild(el);
    const close = () => el.remove();
    el.querySelector('#cal-popup-ok').addEventListener('click', close);
    el.addEventListener('click', (e) => { if (e.target === el) close(); });
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

      const gwDaReale = GwService.getGwKey(currentCompData, STATE.giornataRealeCorrente);
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

      // Incontri della giornata (segnaposto del tabellone già risolti)
      const compForCouples = { ...(currentCompData || {}), matches: matchesNode };
      const turnMatches = GwService.getCouples(compForCouples, selectedGW);
      const currentTeams = STATE.teams || [];
      const phase = GwService.getGwPhase(compForCouples, selectedGW, STATE.giornataRealeCorrente);

      const chip = {
        past:    { icon: 'ri-play-circle-line', text: 'Rivedi',        color: 'var(--text2)' },
        current: { icon: 'ri-record-circle-line', text: 'Live',        color: 'var(--accent3)' },
        next:    { icon: 'ri-team-line',        text: 'Formazioni',    color: 'var(--accent)' },
        future:  { icon: 'ri-lock-line',        text: 'Non disponibile', color: 'var(--text3)' }
      }[phase];

      CalendarioPage._ctx = { STATE, comp: compForCouples, gwKey: selectedGW, phase, couples: turnMatches };

      container.innerHTML = turnMatches.map(match => `
        <div data-match-key="${String(match.key).replace(/"/g, '&quot;')}" style="position:relative; cursor:pointer;">
          ${createMatchCardResult(match, currentTeams)}
          <span style="position:absolute; top:.5rem; right:.7rem; display:flex; align-items:center; gap:.25rem; font-size:.65rem; font-weight:600; color:${chip.color};">
            <i class="${chip.icon}"></i>${chip.text}
          </span>
        </div>`).join('');
    };

    if (!container.dataset.bound) {
      container.dataset.bound = '1';
      container.addEventListener('click', (e) => {
        const card = e.target.closest('[data-match-key]');
        if (card) CalendarioPage.onMatchClick(card.dataset.matchKey);
      });
    }

    select.onchange = drawSelectedTurn;
    drawSelectedTurn();
  }
};
