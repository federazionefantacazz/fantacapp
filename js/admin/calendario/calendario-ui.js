/**
 * calendario-ui.js
 * Responsabilità: template HTML del modulo e rendering UI (badge, anteprime squadre, gironi, albero tabellone).
 */

import { CalendarioState } from './calendario-state.js';

export const CalendarioUI = {

  renderHTML() {
    return `
    <div id="sec-calendar-gen" class="admin-sec" style="display:none;">
      <div class="sec-title">🗓️ Configurazione & Generazione Calendario</div>
      
      <div class="card" style="max-width: 650px;">
        <div style="margin-bottom: 1rem; padding: .8rem; background: rgba(80, 227, 194, 0.1); border-left: 4px solid var(--accent); border-radius: 4px;">
          <span style="font-size: .85rem; color: var(--text);">
            Gestione dei Calendari e della Fase Finale. Rileva automaticamente la tipologia di torneo per generare la Regular Season o l'Albero dei Playoff ad Eliminazione Diretta.
          </span>
        </div>

        <label class="label" style="color: var(--accent);">1. Competizione Target</label>
        <select id="calendarCompSelect" class="input-login" onchange="window.changeCalendarTargetComp(this.value)">
          <option value="">Caricamento competizioni...</option>
        </select>

        <div style="display: flex; gap: 1rem; margin-bottom: 1rem; background: var(--bg3); padding: .75rem; border-radius: 6px; border: 1px solid var(--border);">
          <div>
            <div class="label">Tipo Rilevato</div>
            <div id="calTypeBadge" style="font-weight:bold; color:#fff; font-size:.9rem;">-</div>
          </div>
          <div style="margin-left: auto; text-align: right;">
            <div class="label">Parametri Fase Finale</div>
            <div id="calFaseFinaleBadge" style="font-weight:bold; color:var(--accent); font-size:.9rem;">-</div>
          </div>
        </div>

        <div id="actionsBlock" style="display: flex; flex-direction: column; gap: .75rem; margin-top: .5rem;">
          
          <div id="drawGironiContainer" style="display:none; background: rgba(245, 166, 35, 0.05); padding: 1rem; border: 1px dashed var(--gold); border-radius: 6px;">
            <div class="label" style="color: var(--gold); margin-bottom: .5rem;">Fase 1: Regular Season (Gironi)</div>
            <button class="btn btn-gold" style="width: 100%;" onclick="window.sorteggiaGironiCompetizione()">🎲 Effettua Sorteggio Gruppi</button>
          </div>

          <div id="regSeasonGenBlock" style="background: var(--bg2); padding: 1rem; border-radius: 6px; border: 1px solid var(--border);">
            <label class="label" style="color: var(--accent);">Generatore Regular Season</label>
            <select id="genRotationType" class="input-login" style="background: var(--bg3); color:#fff; padding:.5rem; border-radius:6px; width:100%; margin-bottom: 1rem;">
              <option value="solo-andata" selected>Solo Andata</option>
              <option value="andata-ritorno">Andata e Ritorno</option>
              <option value="tre-giri">Tre Giri</option>
            </select>
            <button class="btn btn-green" style="width: 100%;" onclick="window.generateRandomCalendar()">⚡ Genera Regular Season Match</button>
          </div>

          <div id="tabelloneGenBlock" style="background: rgba(74, 144, 226, 0.08); padding: 1rem; border-radius: 6px; border: 1px solid var(--accent2);">
            <label class="label" style="color: var(--accent2); margin-bottom: .5rem;">Fase 2: Fase Finale ad Eliminazione Diretta</label>
            
            <div style="margin-bottom: 1rem;">
              <label class="label" style="font-size:0.65rem;">Formato Incontri Fasi Intermedie</label>
              <select id="playoffRotationType" class="input-login" style="background: var(--bg3); color:#fff; padding:.5rem; border-radius:6px; width:100%; margin-bottom:0;">
                <option value="solo-andata">Solo Andata (Gara Secca)</option>
                <option value="andata-ritorno" selected>Andata & Ritorno (Finale Secca)</option>
              </select>
            </div>

            <button class="btn btn-blue" style="width: 100%;" onclick="window.creaTabelloneFaseFinale()">🏆 Crea Tabellone ad Albero</button>
          </div>

        </div>
      </div>

      <div class="card" id="previewGironiCard" style="display: none;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: .5rem; margin-bottom: 1rem;">
          <div class="label" style="color: var(--gold); font-weight: 600; margin-bottom: 0;">🏆 Composizione Attuale dei Gironi</div>
          <div id="gironiActionButtons"></div>
        </div>
        <div id="gironiVisualContainer" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;"></div>
      </div>

      <div class="card" id="treeTabelloneCard" style="display: none; overflow-x: auto;">
        <div class="label" style="color: var(--accent2); font-weight: 600; border-bottom: 1px solid var(--border); padding-bottom: .5rem; margin-bottom: 1rem;">🌳 Albero e Sviluppo del Tabellone della Competizione</div>
        <div id="treeVisualContainer" style="display: flex; gap: 2rem; padding: 1rem 0; min-width: max-content; align-items: center;"></div>
      </div>

      <div class="card" id="gwMappingCard">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: .5rem; margin-bottom: 1rem;">
          <div>
            <div class="label" style="color: var(--accent); font-weight: 600; margin-bottom: .15rem;">📅 Associazione Giornate Reali Serie A</div>
            <div style="font-size: .75rem; color: var(--text3);">Abbina ogni giornata del calendario generato a una giornata reale (1–38).</div>
          </div>
          <button class="btn btn-green" style="padding: .35rem .9rem; font-size: .8rem; white-space: nowrap;" onclick="window.salvaAssociazioniGwReali()">💾 Salva Associazioni</button>
        </div>
        <div id="gwMappingBody" style="display: flex; flex-direction: column; gap: .5rem; max-height: 420px; overflow-y: auto; padding-right: .25rem;">
          <div style="color: var(--text3); font-size: .85rem;">Seleziona prima una competizione con un calendario generato.</div>
        </div>
      </div>

      <div class="card">
        <div class="label" id="genTeamsPreviewTitle">Squadre iscritte a questa competizione:</div>
        <div id="genTeamsPreview" style="display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .5rem; font-size: .85rem; color: var(--text2);"></div>
      </div>
    </div>`;
  },

  /**
   * Aggiorna i badge informativi e la visibilità dei blocchi azione
   * in base al tipo di competizione selezionata.
   */
  updateBadgeDinamici(compId) {
    const tBadge = document.getElementById('calTypeBadge');
    const gBadge = document.getElementById('calFaseFinaleBadge');
    const container = document.getElementById('genTeamsPreview');
    const titleContainer = document.getElementById('genTeamsPreviewTitle');
    const drawContainer = document.getElementById('drawGironiContainer');
    const previewGironiCard = document.getElementById('previewGironiCard');
    const gironiVisualContainer = document.getElementById('gironiVisualContainer');
    const btnContainer = document.getElementById('gironiActionButtons');
    const regSeasonGenBlock = document.getElementById('regSeasonGenBlock');
    const tabelloneGenBlock = document.getElementById('tabelloneGenBlock');

    if (!tBadge || !gBadge) return;

    const comp = CalendarioState.getCompetizione(compId);
    if (!comp) {
      tBadge.textContent = "-";
      gBadge.textContent = "-";
      if (container) container.innerHTML = '';
      if (drawContainer) drawContainer.style.display = "none";
      if (previewGironiCard) previewGironiCard.style.display = "none";
      return;
    }

    // Visibilità blocchi in base al tipo competizione
    if (comp.type === 'campionato') {
      tBadge.innerHTML = `<span style="color:var(--accent2)">CAMPIONATO STANDARD</span>`;
      gBadge.textContent = "Girone Unico";
      if (drawContainer) drawContainer.style.display = "none";
      if (regSeasonGenBlock) regSeasonGenBlock.style.display = "block";
      if (tabelloneGenBlock) tabelloneGenBlock.style.display = "none";
    } else if (comp.type === 'diretta') {
      tBadge.innerHTML = `<span style="color:var(--accent3)">ELIMINAZIONE DIRETTA PURA</span>`;
      gBadge.textContent = "Tabellone Immediato";
      if (drawContainer) drawContainer.style.display = "none";
      if (regSeasonGenBlock) regSeasonGenBlock.style.display = "none";
      if (tabelloneGenBlock) tabelloneGenBlock.style.display = "block";
    } else {
      const gPrevisti = comp.gironi || 1;
      const qFase = comp.qualificatiFaseFinale || 2;
      tBadge.innerHTML = `<span style="color:var(--gold)">${comp.type.toUpperCase()}</span>`;
      gBadge.textContent = comp.type === 'misto-speciale'
        ? 'Regole Speciali Playoff'
        : `${gPrevisti} Gir. (Qualif. top ${qFase})`;
      if (drawContainer) drawContainer.style.display = "block";
      if (regSeasonGenBlock) regSeasonGenBlock.style.display = "block";
      if (tabelloneGenBlock) tabelloneGenBlock.style.display = "block";
    }

    // Anteprima squadre iscritte
    const compTeamsIds = CalendarioState.getTeamIdsCompetizione(comp);

    if (titleContainer) {
      titleContainer.innerHTML = `Squadre totali iscritte a <strong>${comp.name.toUpperCase()}</strong> (${compTeamsIds.length}):`;
    }

    if (container) {
      if (compTeamsIds.length === 0) {
        container.innerHTML = '<span style="color:var(--accent3);">❌ Nessuna squadra associata a questa competizione.</span>';
      } else {
        container.innerHTML = compTeamsIds.map(tId => {
          const teamObj = CalendarioState.getTeam(tId);
          return `<span style="background:var(--bg2); padding:.4rem .6rem; border-radius:4px; border:1px solid var(--border); display:inline-flex; align-items:center;">🛡️ ${teamObj ? teamObj.name : tId}</span>`;
        }).join('');
      }
    }

    // Visualizzazione gironi (se tipo misto con struttura esistente)
    if ((comp.type === 'misto' || comp.type === 'misto-speciale') && comp.strutturaGironi) {
      if (previewGironiCard && gironiVisualContainer && btnContainer) {
        previewGironiCard.style.display = "block";
        this._renderGironiButtons(btnContainer);
        this._renderGironiGrid(gironiVisualContainer, comp, compTeamsIds);
      }
    } else {
      if (previewGironiCard) previewGironiCard.style.display = "none";
    }

    // Albero tabellone già esistente
    this.renderAlberoGraficoTabellone(comp);
  },

  _renderGironiButtons(btnContainer) {
    if (CalendarioState.isEditingManually) {
      btnContainer.innerHTML = `
        <button class="btn btn-green" style="padding: .3rem .75rem; font-size: .8rem;" onclick="window.salvaModificheGironiManuali()">💾 Salva Gruppi</button>
        <button class="btn btn-red" style="padding: .3rem .75rem; font-size: .8rem; margin-left: .25rem;" onclick="window.annullaModificaManualeGironi()">Annulla</button>
      `;
    } else {
      btnContainer.innerHTML = `
        <button class="btn" style="background: var(--bg3); border:1px solid var(--border); padding: .3rem .75rem; font-size: .8rem; color:#fff;" onclick="window.attivaModificaManualeGironi()">✏️ Personalizza Manualmente</button>
      `;
    }
  },

  _renderGironiGrid(container, comp, compTeamsIds) {
    const gironiIds = Object.keys(comp.strutturaGironi);
    container.innerHTML = gironiIds.map(gId => {
      const elencoSquadreIds = comp.strutturaGironi[gId] || [];
      let htmlSquadre = "";

      if (CalendarioState.isEditingManually) {
        htmlSquadre = elencoSquadreIds.map((currentSelectedId, slotIdx) => {
          const optionsHtml = compTeamsIds.map(tId => {
            const teamObj = CalendarioState.getTeam(tId);
            return `<option value="${tId}" ${tId === currentSelectedId ? 'selected' : ''}>🛡️ ${teamObj ? teamObj.name : tId}</option>`;
          }).join('');

          return `
            <div style="margin-bottom: 6px;">
              <select class="input-login class-manual-team-slot" data-girone="${gId}" data-slot="${slotIdx}" style="background: var(--bg3); padding: .3rem; font-size: .85rem; width: 100%; border-radius: 4px; border: 1px solid var(--border); color:#fff; margin-bottom:0;">
                ${optionsHtml}
              </select>
            </div>
          `;
        }).join('');
      } else {
        htmlSquadre = elencoSquadreIds.map(tId => {
          const teamObj = CalendarioState.getTeam(tId);
          return `<div style="padding: .3rem .5rem; background: var(--bg3); margin-bottom: 4px; border-radius: 4px; font-size: .85rem; border: 1px solid var(--border);">🛡️ ${teamObj ? teamObj.name : tId}</div>`;
        }).join('');
      }

      return `
        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border); padding: .75rem; border-radius: 6px;">
          <div style="color: var(--accent); font-weight: bold; margin-bottom: .5rem; border-bottom: 1px solid var(--border); padding-bottom: .25rem; font-size: .9rem;">${gId.toUpperCase()}</div>
          ${htmlSquadre || '<div style="color:var(--text3); font-size:.8rem;">Vuoto</div>'}
        </div>
      `;
    }).join('');
  },

  renderAlberoGraficoTabellone(comp) {
    const cardTree = document.getElementById('treeTabelloneCard');
    const containerTree = document.getElementById('treeVisualContainer');
    if (!cardTree || !containerTree) return;

    if (!comp?.tabelloneStructure?.fasi) {
      cardTree.style.display = "none";
      return;
    }

    cardTree.style.display = "block";
    const fasi = comp.tabelloneStructure.fasi;
    const chiaviFasi = Object.keys(fasi).sort();

    containerTree.innerHTML = chiaviFasi.map(chiave => {
      const faseObj = fasi[chiave];
      const matchArray = faseObj.matchList || [];

      const htmlIncontri = matchArray.map(m => {
        const teamHome = CalendarioState.getTeam(m.homeId);
        const teamAway = CalendarioState.getTeam(m.awayId);
        
        const nameHome = m.homeId.startsWith("VINCENTE_")
          ? `✨ ${m.homeId.replace("VINCENTE_", "")}`
          : (teamHome ? teamHome.name : m.homeId);
        const nameAway = m.awayId.startsWith("VINCENTE_")
          ? `✨ ${m.awayId.replace("VINCENTE_", "")}`
          : (teamAway ? teamAway.name : m.awayId);

        return `
          <div style="background: var(--bg2); border: 1px solid var(--border); padding: .6rem; border-radius: 6px; font-size: .8rem; width: 210px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
            <div style="color:var(--text3); font-size:0.65rem; font-weight:bold; margin-bottom:4px; display:flex; justify-content:space-between;">
              <span>🆔 ${m.id.toUpperCase()}</span>
              ${m.gironeProvenienza ? `<span style="color:var(--gold);">${m.gironeProvenienza}</span>` : ''}
            </div>
            <div style="padding: 2px 0; color:#fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">🏠 ${nameHome}</div>
            <div style="padding: 2px 0; color:var(--text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">🚀 ${nameAway}</div>
          </div>
        `;
      }).join('<div style="height: 1.2rem;"></div>');

      return `
        <div style="display: flex; flex-direction: column; align-items: center;">
          <div style="background: var(--card2); color: var(--accent); padding: .4rem .8rem; font-family:'Bebas Neue',sans-serif; font-size:1.1rem; border-radius:4px; margin-bottom:1rem; border:1px solid var(--border); letter-spacing:0.5px;">
            ${faseObj.nomeFase.toUpperCase()}
          </div>
          <div style="display: flex; flex-direction: column; justify-content: center; height: 100%;">
            ${htmlIncontri}
          </div>
        </div>
      `;
    }).join(`
      <div style="display:flex; align-items:center; color:var(--text3);">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    `);
  },

  /**
   * Popola il body del card gwMapping con una riga per ogni gwX trovata
   * nei matches della competizione corrente.
   * @param {string[]} gwKeys   - es. ['gw1','gw2',...] già ordinati
   * @param {Object}   saved   - associazioni già salvate { "1": "gw3", ... } (chiave = giornata reale)
   */
  renderGwMapping(gwKeys, saved) {
    const body = document.getElementById('gwMappingBody');
    if (!body) return;

    if (!gwKeys || gwKeys.length === 0) {
      body.innerHTML = '<div style="color: var(--text3); font-size: .85rem;">Nessuna giornata trovata — genera prima il calendario.</div>';
      return;
    }

    // Mappa inversa: gwKey → giornataReale già salvata
    const inversa = {};
    if (saved) {
      Object.entries(saved).forEach(([reale, gwKey]) => { inversa[gwKey] = reale; });
    }

    // Opzioni 1–38 per il dropdown
    const opzioniReali = Array.from({ length: 38 }, (_, i) => i + 1)
      .map(n => `<option value="${n}">Giornata ${n}</option>`)
      .join('');

    body.innerHTML = gwKeys.map((gwKey, idx) => {
      const label = gwKey.startsWith('gw_playoff_')
        ? `Turno Playoff ${gwKey.replace('gw_playoff_', '')}`
        : `Giornata ${idx + 1} (${gwKey})`;

      const selectedReale = inversa[gwKey] || '';

      return `
        <div style="display: flex; align-items: center; gap: .75rem; background: var(--bg2); padding: .5rem .75rem; border-radius: 6px; border: 1px solid var(--border);">
          <div style="min-width: 180px; font-size: .85rem; color: var(--text2);">🗓️ ${label}</div>
          <div style="color: var(--text3); font-size: .8rem;">→</div>
          <select
            class="input-login gw-mapping-select"
            data-gw="${gwKey}"
            style="background: var(--bg3); color:#fff; padding:.3rem .5rem; border-radius:5px; font-size:.85rem; flex:1; margin-bottom:0;"
          >
            <option value="">— Non assegnata —</option>
            ${opzioniReali}
          </select>
        </div>
      `;
    }).join('');

    // Ripristina selezioni salvate dopo il render
    if (saved) {
      document.querySelectorAll('.gw-mapping-select').forEach(sel => {
        const gwKey = sel.getAttribute('data-gw');
        if (inversa[gwKey]) sel.value = inversa[gwKey];
      });
    }
  },

  /**
   * Popola il <select> delle competizioni e aggiorna i badge.
   */
  renderSelectCompetizioni(competitions) {
    const compSelect = document.getElementById('calendarCompSelect');
    if (!compSelect) return;

    if (competitions.length === 0) {
      compSelect.innerHTML = '<option value="">Nessuna competizione creata</option>';
      return;
    }

    const currentSelection = window.CURRENT_COMPETITION || competitions[0]?.id || "";
    if (!window.CURRENT_COMPETITION && competitions[0]) {
      window.CURRENT_COMPETITION = competitions[0].id;
    }

    compSelect.innerHTML = competitions.map(c =>
      `<option value="${c.id}" ${currentSelection === c.id ? 'selected' : ''}>🏆 ${c.name} (${c.id})</option>`
    ).join('');

    this.updateBadgeDinamici(window.CURRENT_COMPETITION);
  }
};
