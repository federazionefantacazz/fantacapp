import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

export const ClassificaPage = {
  db: null,

  init(database) {
    this.db = database;
  },

  renderHTML() {
    return `
      <div id="page-classifica" class="page">
        <div class="sec">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
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

    // Gestore dello switch visivo per mostrare o nascondere il tabellone grafico dell'albero
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
    
    // Ordinamento meritocratico basato sui punti accumulati nella competizione corrente
    compTeams.sort((a, b) => {
      const ptsA = (a.competitions && a.competitions[compId]?.pts) !== undefined ? a.competitions[compId].pts : (a.pts || 0);
      const ptsB = (b.competitions && b.competitions[compId]?.pts) !== undefined ? b.competitions[compId].pts : (b.pts || 0);
      return ptsB - ptsA;
    });

    // 1) CASO CAMPIONATO STANDARD
    if (compType === 'campionato') {
      contentDiv.innerHTML = this.renderTabellaClassica(compTeams, compId);
    } 
    
    // 2) CASO TORNEO MISTO
    else if (compType === 'misto') {
      this.renderModoConTabellone(actionsDiv, contentDiv, compData, state, () => {
        const gironiMap = {};
        
        // Separiamo le squadre in base al girone di appartenenza salvato su Firebase
        compTeams.forEach(t => {
          const gironeId = (t.competitions && t.competitions[compId]?.girone) || t.girone || 'A';
          if (!gironiMap[gironeId]) gironiMap[gironeId] = [];
          gironiMap[gironeId].push(t);
        });

        const numQualificati = parseInt(compData.qualificatiFaseFinale) || 2;
        let html = '<div id="view-dati-classifica">';
        
        Object.keys(gironiMap).sort().forEach(g => {
          html += `<div class="label" style="font-size:0.95rem; margin-top:1.5rem; color:var(--accent); font-weight:600;">🏆 GIRONE ${g.toUpperCase()}</div>`;
          html += this.renderTabellaClassica(gironiMap[g], compId, (index) => {
            return index < numQualificati ? 'background: rgba(80,227,194,0.08); border-left: 4px solid var(--accent);' : '';
          });
        });
        html += '</div>';
        return html;
      });
    } 
    
    // 3) CASO CAMPIONATO MISTO-SPECIALE (12 SQUADRE)
    else if (compType === 'misto-speciale') {
      this.renderModoConTabellone(actionsDiv, contentDiv, compData, state, () => {
        let html = `
          <div id="view-dati-classifica">
            <div class="card" style="font-size:0.75rem; display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:0.5rem; margin-bottom:1rem; background:var(--bg2); border:1px solid var(--border);">
              <div style="display:flex; align-items:center; gap:0.5rem;"><span style="width:12px; height:12px; background:var(--gold); border-radius:3px;"></span> <span style="color:var(--text);">🥇 Oro: Ai quarti scontrano play off</span></div>
              <div style="display:flex; align-items:center; gap:0.5rem;"><span style="width:12px; height:12px; background:var(--accent2); border-radius:3px;"></span> <span style="color:var(--text);">🥈 Blu: Scontrano ai quarti un degno avv.</span></div>
              <div style="display:flex; align-items:center; gap:0.5rem;"><span style="width:12px; height:12px; background:var(--accent); border-radius:3px;"></span> <span style="color:var(--text);">🥉 Verde: Play off</span></div>
              <div style="display:flex; align-items:center; gap:0.5rem;"><span style="width:12px; height:12px; background:var(--accent3); border-radius:3px;"></span> <span style="color:var(--text);">❌ Rosso: Eliminato</span></div>
            </div>
        `;

        const top12 = compTeams.slice(0, 12);

        html += this.renderTabellaClassica(top12, compId, (index) => {
          const pos = index + 1;
          if (pos <= 2) return 'background: rgba(245,166,35,0.08); border-left: 4px solid var(--gold);';
          if (pos <= 6) return 'background: rgba(74,144,226,0.08); border-left: 4px solid var(--accent2);';
          if (pos <= 10) return 'background: rgba(80,227,194,0.08); border-left: 4px solid var(--accent);';
          return 'background: rgba(255,107,107,0.08); border-left: 4px solid var(--accent3);';
        });

        html += '</div>';
        return html;
      });
    } 
    
    // 4) CASO ELIMINAZIONE DIRETTA PURA
    else if (compType === 'diretta') {
      if (compData.tabelloneStructure) {
        contentDiv.innerHTML = this.renderStrutturaTabelloneGrafico(compData.tabelloneStructure, state);
      } else {
        contentDiv.innerHTML = `<div class="card" style="text-align:center; color:var(--text2); padding:2rem;">🛡️ Nessun tabellone ad eliminazione diretta generato dal pannello Admin.</div>`;
      }
    }
  },

  renderTabellaClassica(teamsList, compId, rowStyleCallback = null) {
    let html = `
      <div class="card" style="padding:0; overflow:hidden; border:1px solid var(--border);">
        <div style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse; font-size:0.85rem; min-width:420px;">
            <thead>
              <tr style="background:var(--bg2); border-bottom:1px solid var(--border);">
                <th style="padding:0.75rem; text-align:center; width:45px; color:var(--text3);">Pos</th>
                <th style="padding:0.75rem; text-align:left;">Squadra</th>
                <th style="padding:0.75rem; text-align:center; width:50px;">G</th>
                <th style="padding:0.75rem; text-align:center; width:50px; color:#4cd137;">V</th>
                <th style="padding:0.75rem; text-align:center; width:50px; color:var(--text2);">N</th>
                <th style="padding:0.75rem; text-align:center; width:50px; color:var(--accent3);">P</th>
                <th style="padding:0.75rem; text-align:center; width:65px; color:var(--accent); font-weight:bold;">PT</th>
              </tr>
            </thead>
            <tbody>
    `;

    teamsList.forEach((t, idx) => {
      const cData = (t.competitions && t.competitions[compId]) || {};
      const pts = cData.pts !== undefined ? cData.pts : (t.pts || 0);
      const w = cData.w !== undefined ? cData.w : (t.w || 0);
      const d = cData.d !== undefined ? cData.d : (t.d || 0);
      const l = cData.l !== undefined ? cData.l : (t.l || 0);
      const giocate = w + d + l;

      const customStyle = rowStyleCallback ? rowStyleCallback(idx) : '';

      html += `
        <tr style="border-bottom:1px solid var(--border); ${customStyle}">
          <td style="padding:0.75rem; text-align:center; font-weight:600; color:var(--text2);">${idx + 1}</td>
          <td style="padding:0.75rem; display:flex; align-items:center; gap:0.5rem; border:none;">
            <span style="font-size:1.1rem;">🛡️</span>
            <span style="font-weight:500; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${t.name}</span>
          </td>
          <td style="padding:0.75rem; text-align:center; color:var(--text2);">${giocate}</td>
          <td style="padding:0.75rem; text-align:center; color:var(--text2);">${w}</td>
          <td style="padding:0.75rem; text-align:center; color:var(--text2);">${d}</td>
          <td style="padding:0.75rem; text-align:center; color:var(--text2);">${l}</td>
          <td style="padding:0.75rem; text-align:center; font-weight:bold; color:var(--accent); font-family:'DM Mono',monospace; font-size:0.9rem;">${pts}</td>
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
        <button id="btn-mostra-classifica" class="btn btn-green" style="padding:0.4rem .8rem; font-size:0.75rem;" onclick="window._toggleVistaTabellone(false)">📊 Classifica</button>
        <button id="btn-mostra-tabellone" class="btn btn-outline" style="padding:0.4rem .8rem; font-size:0.75rem;" onclick="window._toggleVistaTabellone(true)">🏆 Visualizza Tabellone</button>
      `;
    }

    let htmlContenuto = classificaHtmlCallback();

    htmlContenuto += `<div id="view-dati-tabellone" style="display:none; overflow-x:auto; padding-top:0.5rem;">`;
    if (compData.tabelloneStructure) {
      htmlContenuto += this.renderStrutturaTabelloneGrafico(compData.tabelloneStructure, state);
    } else {
      htmlContenuto += `<div class="card" style="text-align:center; color:var(--text2); padding:1.5rem;">⚠️ Il tabellone ad eliminazione non è ancora stato generato dall'Amministratore per questa fase.</div>`;
    }
    htmlContenuto += `</div>`;

    contentDiv.innerHTML = htmlContenuto;
  },

  renderStrutturaTabelloneGrafico(tabelloneStructure, state) {
    if (!tabelloneStructure || !tabelloneStructure.fasi) {
      return `<div class="card" style="text-align:center; color:var(--text2);">Struttura tabellone non disponibile.</div>`;
    }

    const fasi = tabelloneStructure.fasi;
    const chiaviFasi = Object.keys(fasi).sort();
    const teamsGlobal = state.teams || [];

    let htmlAlbero = `<div style="display: flex; gap: 1.5rem; padding: 0.5rem 0; min-width: max-content; align-items: center;">`;

    htmlAlbero += chiaviFasi.map((chiave, indexFase) => {
      const faseObj = fasi[chiave];
      const matchArray = faseObj.matchList || [];

      const htmlIncontri = matchArray.map(m => {
        const teamHome = teamsGlobal.find(t => String(t.id) === m.homeId);
        const teamAway = teamsGlobal.find(t => String(t.id) === m.awayId);
        
        const nameHome = m.homeId.startsWith("VINCENTE_") ? `✨ ${m.homeId.replace("VINCENTE_", "")}` : (teamHome ? teamHome.name : m.homeId);
        const nameAway = m.awayId.startsWith("VINCENTE_") ? `✨ ${m.awayId.replace("VINCENTE_", "")}` : (teamAway ? teamAway.name : m.awayId);

        return `
          <div style="background: var(--bg2); border: 1px solid var(--border); padding: .6rem; border-radius: 6px; font-size: .8rem; width: 200px; box-shadow: 0 2px 6px rgba(0,0,0,0.15);">
            <div style="color:var(--text3); font-size:0.6rem; font-weight:bold; margin-bottom:4px; display:flex; justify-content:between;">
              <span>🆔 ${m.id.toUpperCase()}</span>
              ${m.gironeProvenienza ? `<span style="color:var(--gold); margin-left:auto;">${m.gironeProvenienza}</span>` : ''}
            </div>
            <div style="padding: 2px 0; color:#fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display:flex; justify-content:space-between;">
              <span>🏠 ${nameHome}</span>
            </div>
            <div style="padding: 2px 0; color:var(--text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display:flex; justify-content:space-between;">
              <span>🚀 ${nameAway}</span>
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
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    `);

    htmlAlbero += `</div>`;
    return htmlAlbero;
  }
};