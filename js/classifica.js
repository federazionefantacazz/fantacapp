import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { ClassificaService } from "./services/classificaService.js";

export const ClassificaPage = {
  db: null,

  init(database) {
    this.db = database;
  },

  renderHTML() {
    return `
      <div id="page-classifica" class="page">
        <div class="sec">
          <i class="ri-bar-chart-2-line" style="font-size: 24px;"></i>
          <span id="classifica-title">Classifica</span>
        </div>
        
        <div id="classifica-actions" style="margin-bottom: 1rem; display:none; gap:0.5rem;"></div>

        <div id="classifica-content"></div>
      </div>
    `;
  },

  render(state) {
    const contentDiv = document.getElementById('classifica-content');
    const actionsDiv = document.getElementById('classifica-actions');
    const titleSpan = document.getElementById('classifica-title');
    if (!contentDiv) return;

    const compId = state.currentCompetition || window.CURRENT_COMPETITION;
    const compData = state.competitions ? state.competitions.find(c => c.id === compId) : null;

    if (!compData) {
      contentDiv.innerHTML = `<div class="card" style="text-align:center; color:var(--text2);">Seleziona una competizione valida nel menu in alto.</div>`;
      if (actionsDiv) actionsDiv.style.display = 'none';
      return;
    }

    const compType = compData.type || 'campionato';
    titleSpan.textContent = `Classifica — ${compData.name ? compData.name.toUpperCase() : compId.toUpperCase()}`;
    
    if (actionsDiv) {
      actionsDiv.innerHTML = '';
      actionsDiv.style.display = 'none';
    }

    window._toggleVistaTabellone = (mostra) => {
      const btnTab = document.getElementById('btn-mostra-tabellone');
      const btnClas = document.getElementById('btn-mostra-classifica');
      const viewClassifica = document.getElementById('view-dati-classifica');
      const viewTabellone = document.getElementById('view-dati-tabellone');

      if (mostra) {
        if(viewClassifica) viewClassifica.style.display = 'none';
        if(viewTabellone) viewTabellone.style.display = 'block';
        if(btnTab) { btnTab.classList.add('btn-green'); btnTab.classList.remove('btn-outline'); }
        if(btnClas) { btnClas.classList.remove('btn-green'); btnClas.classList.add('btn-outline'); }
      } else {
        if(viewClassifica) viewClassifica.style.display = 'block';
        if(viewTabellone) viewTabellone.style.display = 'none';
        if(btnTab) { btnTab.classList.remove('btn-green'); btnTab.classList.add('btn-outline'); }
        if(btnClas) { btnClas.classList.add('btn-green'); btnClas.classList.remove('btn-outline'); }
      }
    };

    let compTeams = state.teams ? [...state.teams] : [];
    const classificaDbNode = compData.classifica || {};

    // Calcolo ed elaborazione tramite il Service
    const teamCalculatedStats = ClassificaService.calcolaStatistiche(compTeams, classificaDbNode);

    // 1) CASO CAMPIONATO STANDARD
    if (compType === 'campionato') {
      const sortedTeams = ClassificaService.ordinaSquadre(compTeams, teamCalculatedStats);
      contentDiv.innerHTML = this.renderTabellaClassica(sortedTeams, compId, null, teamCalculatedStats);
    } 
    
    // 2) CASO TORNEO MISTO
    else if (compType === 'misto') {
      this.renderModoConTabellone(actionsDiv, contentDiv, compData, state, () => {
        let html = '<div id="view-dati-classifica">';
        
        if (compData.strutturaGironi) {
          const gironiKeys = Object.keys(compData.strutturaGironi);
          
          if (gironiKeys.length > 0) {
            gironiKeys.sort().forEach(gironeName => {
              const squadreIdList = compData.strutturaGironi[gironeName];
              if (!squadreIdList) return;

              const listaSquadreGirone = [];
              Object.keys(squadreIdList).forEach(idx => {
                const teamId = squadreIdList[idx]; 
                if (teamId) {
                  const teamData = compTeams.find(t => String(t.id) === String(teamId));
                  if (teamData) listaSquadreGirone.push(teamData);
                }
              });

              const sortedGirone = ClassificaService.ordinaSquadre(listaSquadreGirone, teamCalculatedStats);
              const numQualificati = parseInt(compData.qualificatiFaseFinale) || 2;

              html += `<div class="label" style="font-size:0.95rem; margin-top:1.5rem; color:var(--accent); font-weight:600; padding-left:0.5rem;"><i class="ri-trophy-line"></i> ${gironeName.toUpperCase()}</div>`;
              
              if (sortedGirone.length > 0) {
                html += this.renderTabellaClassica(sortedGirone, compId, (index) => {
                  return index < numQualificati ? 'background: rgba(80,227,194,0.08); border-left: 4px solid var(--accent);' : '';
                }, teamCalculatedStats);
              } else {
                html += `<div class="card" style="text-align:center; color:var(--text2); padding:1rem;">Nessuna squadra trovata per questo girone.</div>`;
              }
            });
          } else {
            html += `<div class="card" style="text-align:center; color:var(--text2); padding:2rem;"><i class="ri-alert-line"></i> Il nodo strutturaGironi è vuoto.</div>`;
          }
        } else {
          html += `<div class="card" style="text-align:center; color:var(--text2); padding:2rem;"><i class="ri-alert-line"></i> Voce "strutturaGironi" non configurata per questa competizione.</div>`;
        }

        html += '</div>';
        return html;
      });
    } 
    
    // 3) CASO CAMPIONATO MISTO-SPECIALE
    else if (compType === 'misto-speciale') {
      const sortedTeams = ClassificaService.ordinaSquadre(compTeams, teamCalculatedStats);

      this.renderModoConTabellone(actionsDiv, contentDiv, compData, state, () => {
        let html = `
          <div id="view-dati-classifica">
            <div class="card" style="font-size:0.75rem; display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:0.5rem; margin-bottom:1rem; background:var(--bg2); border:1px solid var(--border);">
              <div style="display:flex; align-items:center; gap:0.5rem;"><i class="ri-medal-fill" style="color:var(--gold);"></i> <span style="color:var(--text);">Oro: Ai quarti scontrano play off</span></div>
              <div style="display:flex; align-items:center; gap:0.5rem;"><i class="ri-medal-fill" style="color:var(--accent2);"></i> <span style="color:var(--text);">Blu: Scontrano ai quarti un degno avv.</span></div>
              <div style="display:flex; align-items:center; gap:0.5rem;"><i class="ri-medal-fill" style="color:var(--accent);"></i> <span style="color:var(--text);">Verde: Play off</span></div>
              <div style="display:flex; align-items:center; gap:0.5rem;"><i class="ri-close-circle-fill" style="color:var(--accent3);"></i> <span style="color:var(--text);">Rosso: Eliminato</span></div>
            </div>
        `;

        const top12 = sortedTeams.slice(0, 12);

        html += this.renderTabellaClassica(top12, compId, (index) => {
          const pos = index + 1;
          if (pos <= 2) return 'background: rgba(245,166,35,0.08); border-left: 4px solid var(--gold);';
          if (pos <= 6) return 'background: rgba(74,144,226,0.08); border-left: 4px solid var(--accent2);';
          if (pos <= 10) return 'background: rgba(80,227,194,0.08); border-left: 4px solid var(--accent);';
          return 'background: rgba(255,107,107,0.08); border-left: 4px solid var(--accent3);';
        }, teamCalculatedStats);

        html += '</div>';
        return html;
      });
    } 
    
    // 4) CASO ELIMINAZIONE DIRETTA PURA
    else if (compType === 'diretta') {
      if (compData.tabelloneStructure) {
        contentDiv.innerHTML = this.renderStrutturaTabelloneGrafico(compData.tabelloneStructure, state, compData);
      } else {
        contentDiv.innerHTML = `<div class="card" style="text-align:center; color:var(--text2); padding:2rem;"><i class="ri-shield-line"></i> Nessun tabellone ad eliminazione diretta generato dal pannello Admin.</div>`;
      }
    }
  },

  renderTabellaClassica(teamsList, compId, rowStyleCallback = null, teamCalculatedStats = {}) {
    let html = `
      <div class="card" style="padding:0; overflow:hidden; border:1px solid var(--border); margin-bottom: 1rem;">
        <div style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse; font-size:0.85rem; min-width:600px;">
            <thead>
              <tr style="background:var(--bg2); border-bottom:1px solid var(--border);">
                <th style="padding:0.75rem; text-align:center; width:40px; color:var(--text3);">Pos</th>
                <th style="padding:0.75rem; text-align:left;">Squadra</th>
                <th style="padding:0.75rem; text-align:center; width:55px; color:var(--accent); font-weight:bold;">PT</th>
                <th style="padding:0.75rem; text-align:center; width:130px; color:var(--accent2); font-weight:bold;">TOT PUNTI FANTAVOTO</th>
                <th style="padding:0.75rem; text-align:center; width:45px;">G</th>
                <th style="padding:0.75rem; text-align:center; width:45px; color:#4cd137;">V</th>
                <th style="padding:0.75rem; text-align:center; width:45px; color:var(--text2);">N</th>
                <th style="padding:0.75rem; text-align:center; width:45px; color:var(--accent3);">P</th>
                <th style="padding:0.75rem; text-align:center; width:45px; color:var(--text2);">GF</th>
                <th style="padding:0.75rem; text-align:center; width:45px; color:var(--text2);">GS</th>
              </tr>
            </thead>
            <tbody>
    `;

    teamsList.forEach((t, idx) => {
      const stats = teamCalculatedStats[t.id] || { giocate: 0, pts: 0, w: 0, d: 0, l: 0, totFanta: 0, gf: 0, gs: 0 };
      const customStyle = rowStyleCallback ? rowStyleCallback(idx) : '';

      const logoHTML = t.logo 
        ? `<img src="${t.logo}" alt="Logo ${t.name}" style="width:32px; height:32px; object-fit:contain; border-radius:4px; flex-shrink:0;">`
        : `<div style="width:32px; height:32px; background:var(--bg3); display:flex; align-items:center; justify-content:center; border-radius:4px; font-size:1rem; color:var(--text3); flex-shrink:0;"><i class="ri-shield-line"></i></div>`;

      html += `
        <tr style="border-bottom:1px solid var(--border); ${customStyle}">
          <td style="padding:0.75rem; text-align:center; font-weight:600; color:var(--text2);">${idx + 1}</td>
          <td style="padding:0.75rem; display:flex; align-items:center; gap:0.5rem; border:none;">
            ${logoHTML}
            <span style="font-weight:500; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${t.name}</span>
          </td>
          <td style="padding:0.75rem; text-align:center; font-weight:bold; color:var(--accent); font-family:'DM Mono',monospace; font-size:0.9rem;">${stats.pts}</td>
          <td style="padding:0.75rem; text-align:center; font-weight:bold; color:var(--accent2); font-family:'DM Mono',monospace; font-size:0.85rem;">${stats.totFanta.toFixed(1)}</td>
          <td style="padding:0.75rem; text-align:center; color:var(--text2);">${stats.giocate}</td>
          <td style="padding:0.75rem; text-align:center; color:var(--text2);">${stats.w}</td>
          <td style="padding:0.75rem; text-align:center; color:var(--text2);">${stats.d}</td>
          <td style="padding:0.75rem; text-align:center; color:var(--text2);">${stats.l}</td>
          <td style="padding:0.75rem; text-align:center; color:var(--text2);">${stats.gf}</td>
          <td style="padding:0.75rem; text-align:center; color:var(--text2);">${stats.gs}</td>
        </tr>
      `;
    });

    html += `</tbody></table></div></div>`;
    return html;
  },

  renderModoConTabellone(actionsDiv, contentDiv, compData, state, classificaHtmlCallback) {
    if (actionsDiv) {
      actionsDiv.style.display = 'flex';
      actionsDiv.innerHTML = `
        <button id="btn-mostra-classifica" class="btn btn-green" style="padding:0.4rem .8rem; font-size:0.75rem;" onclick="window._toggleVistaTabellone(false)"><i class="ri-bar-chart-2-line"></i> Classifica</button>
        <button id="btn-mostra-tabellone" class="btn btn-outline" style="padding:0.4rem .8rem; font-size:0.75rem;" onclick="window._toggleVistaTabellone(true)"><i class="ri-trophy-line"></i> Visualizza Tabellone</button>
      `;
    }

    let htmlContenuto = classificaHtmlCallback();

    htmlContenuto += `<div id="view-dati-tabellone" style="display:none; overflow-x:auto; padding-top:0.5rem;">`;
    if (compData.tabelloneStructure) {
      htmlContenuto += this.renderStrutturaTabelloneGrafico(compData.tabelloneStructure, state, compData);
    } else {
      htmlContenuto += `<div class="card" style="text-align:center; color:var(--text2); padding:1.5rem;"><i class="ri-alert-line"></i> Il tabellone ad eliminazione non è ancora stato generato dall'Amministratore per questa fase.</div>`;
    }
    htmlContenuto += `</div>`;

    contentDiv.innerHTML = htmlContenuto;
  },

  renderStrutturaTabelloneGrafico(tabelloneStructure, state, compData = {}) {
    if (!tabelloneStructure || !tabelloneStructure.fasi) {
      return `<div class="card" style="text-align:center; color:var(--text2);">Struttura tabellone non disponibile.</div>`;
    }

    const fasi = tabelloneStructure.fasi;
    const chiaviFasi = Object.keys(fasi).sort();
    const teamsGlobal = state.teams || [];
    const matchesMap = compData.matches || {};

    const modalita = tabelloneStructure.regolaIncontri || tabelloneStructure.tipoScontro || tabelloneStructure.modalita;
    const isAndataRitorno = modalita === 'andata-ritorno' || modalita === 'andata_ritorno';

    // Sfruttiamo il service per calcolare i vincitori
    const { matchResultsMap, resolvedWinners } = ClassificaService.risolviVincitoriTabellone(tabelloneStructure, matchesMap);

    let htmlAlbero = `<div style="display: flex; gap: 1.5rem; padding: 0.5rem 0; min-width: max-content; align-items: center;">`;

    htmlAlbero += chiaviFasi.map((chiave) => {
      const faseObj = fasi[chiave];
      const matchList = faseObj.matchList || [];

      const htmlIncontri = matchList.map(m => {
        let homeIdActual = m.homeId;
        let awayIdActual = m.awayId;

        if (homeIdActual && homeIdActual.startsWith("VINCENTE_") && resolvedWinners[homeIdActual]) {
          homeIdActual = resolvedWinners[homeIdActual];
        }
        if (awayIdActual && awayIdActual.startsWith("VINCENTE_") && resolvedWinners[awayIdActual]) {
          awayIdActual = resolvedWinners[awayIdActual];
        }

        const teamHome = teamsGlobal.find(t => String(t.id) === String(homeIdActual));
        const teamAway = teamsGlobal.find(t => String(t.id) === String(awayIdActual));
        
        const isHomePending = !teamHome && String(homeIdActual).startsWith("VINCENTE_");
        const isAwayPending = !teamAway && String(awayIdActual).startsWith("VINCENTE_");

        const nameHome = isHomePending ? `${homeIdActual.replace("VINCENTE_", "")}` : (teamHome ? teamHome.name : homeIdActual);
        const nameAway = isAwayPending ? `${awayIdActual.replace("VINCENTE_", "")}` : (teamAway ? teamAway.name : awayIdActual);

        let logoHomeHTML = !isHomePending && teamHome?.logo
          ? `<img src="${teamHome.logo}" alt="" style="width:20px; height:20px; object-fit:contain; border-radius:2px; flex-shrink:0;">`
          : `<span style="font-size:1rem; flex-shrink:0; width:20px; text-align:center;"><i class="ri-shield-line"></i></span>`;

        let logoAwayHTML = !isAwayPending && teamAway?.logo
          ? `<img src="${teamAway.logo}" alt="" style="width:20px; height:20px; object-fit:contain; border-radius:2px; flex-shrink:0;">`
          : `<span style="font-size:1rem; flex-shrink:0; width:20px; text-align:center;"><i class="ri-shield-line"></i></span>`;

        const res = matchResultsMap[m.id] || {};
        
        let strAndata = 'A: -';
        if (res.andata && res.andata.finished) {
          const gH = res.andata.goalHome ?? res.andata.homeScore ?? 0;
          const gA = res.andata.goalAway ?? res.andata.awayScore ?? 0;
          strAndata = `A: ${gH}-${gA}`;
        }

        let strRitorno = '';
        if (isAndataRitorno && !faseObj.nomeFase.toLowerCase().includes('final')) {
          if (res.ritorno && res.ritorno.finished) {
            const gH = res.ritorno.goalHome ?? res.ritorno.homeScore ?? 0;
            const gA = res.ritorno.goalAway ?? res.ritorno.awayScore ?? 0;
            const rHomeId = res.ritorno.homeId || res.ritorno.home;
            const teamAndataCasa = res.andata?.homeId || res.andata?.home;

            strRitorno = (res.andata && rHomeId !== teamAndataCasa) ? ` | R: ${gA}-${gH}` : ` | R: ${gH}-${gA}`;
          } else {
            strRitorno = ` | R: -`;
          }
        }

        return `
          <div style="background: var(--bg2); border: 1px solid var(--border); padding: .6rem; border-radius: 6px; font-size: .8rem; width: 220px; box-shadow: 0 2px 6px rgba(0,0,0,0.15);">
            <div style="color:var(--text3); font-size:0.65rem; font-weight:bold; margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
              <span><i class="ri-hashtag"></i> ${m.id.toUpperCase()}</span>
              <span style="color:var(--accent); font-family:'DM Mono',monospace;">${strAndata}${strRitorno}</span>
            </div>
            <div style="padding: 2px 0; color:#fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display:flex; align-items:center; gap:0.4rem;">
              ${logoHomeHTML}
              <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; ${isHomePending ? 'color:var(--text2); font-style:italic;' : ''}">${nameHome}</span>
            </div>
            <div style="padding: 2px 0; color:var(--text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display:flex; align-items:center; gap:0.4rem;">
              ${logoAwayHTML}
              <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; ${isAwayPending ? 'color:var(--text2); font-style:italic;' : ''}">${nameAway}</span>
            </div>
          </div>
        `;
      }).join('<div style="height: 1rem;"></div>');

      return `
        <div style="display: flex; flex-direction: column; align-items: center;">
          <div style="background: var(--card2); color: var(--accent); padding: .3rem .6rem; font-family:'Bebas Neue',sans-serif; font-size:1rem; border-radius:4px; margin-bottom:0.75rem; border:1px solid var(--border);">
            ${faseObj.nomeFase.toUpperCase()}
          </div>
          <div style="display: flex; flex-direction: column; justify-content: center;">
            ${htmlIncontri}
          </div>
        </div>
      `;
    }).join(`
      <div style="display:flex; align-items:center; color:var(--text3); padding-top:1.5rem;">
        <i class="ri-arrow-right-s-line" style="font-size: 18px;"></i>
      </div>
    `);

    htmlAlbero += `</div>`;
    return htmlAlbero;
  }
};
