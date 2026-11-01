import { ClassificaService } from "./services/classificaService.js";
import { esc, sid, sameId } from "./utils.js";

const isVincente = (id) => sid(id).startsWith('VINCENTE_');

export const ClassificaPage = {
  // Vista scelta nei tornei con tabellone (classifica / tabellone): resta tra un aggiornamento e l'altro dei dati
  _showTabellone: false,
  _compId: null,

  renderHTML() {
    return `
      <div id="page-classifica" class="page">
        <div id="classifica-actions" style="margin-bottom: 1rem; display:none; gap:0.5rem;"></div>

        <div id="classifica-content"></div>
      </div>
    `;
  },

  render(state) {
    const contentDiv = document.getElementById('classifica-content');
    const actionsDiv = document.getElementById('classifica-actions');
    if (!contentDiv) return;

    const compId = state.currentCompetition;
    const compData = (state.competitions || []).find(c => sameId(c.id, compId)) || null;
    // cambiando competizione si riparte dalla classifica
    if (!sameId(this._compId, compId)) { this._compId = compId; this._showTabellone = false; }

    if (!compData) {
      contentDiv.innerHTML = `<div class="card" style="text-align:center; color:var(--text2);font-family:var(--font-sub,inherit);">Seleziona una competizione valida nel menu in alto.</div>`;
      if (actionsDiv) actionsDiv.style.display = 'none';
      return;
    }

    const compType = compData.type || 'campionato';
    if (actionsDiv) {
      actionsDiv.innerHTML = '';
      actionsDiv.style.display = 'none';
    }

    let compTeams = state.teams ? [...state.teams] : [];
    const classificaDbNode = compData.classifica || {};

    // Calcolo ed elaborazione tramite il Service
    const teamCalculatedStats = ClassificaService.calcolaStatistiche(compTeams, classificaDbNode);

    // 1) CASO CAMPIONATO STANDARD
    if (compType === 'campionato') {
      const squadreComp = ClassificaService.getSquadreCompetizione(compData, compTeams);
      const sortedTeams = ClassificaService.ordinaSquadre(squadreComp, teamCalculatedStats);
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

              html += `<div class="label" data-th="cls-groupTitle" style="font-size:0.95rem; margin-top:1.5rem; color:var(--title,var(--accent)); font-family:var(--font-title,inherit); font-weight:600; padding-left:0.5rem;"><i class="ri-trophy-line"></i> ${esc(gironeName.toUpperCase())}</div>`;
              
              if (sortedGirone.length > 0) {
                html += this.renderTabellaClassica(sortedGirone, compId, (index) => {
                  return index < numQualificati ? 'border-left: 4px solid var(--accent);' : '';
                }, teamCalculatedStats);
              } else {
                html += `<div class="card" style="text-align:center; color:var(--text2);font-family:var(--font-sub,inherit); padding:1rem;">Nessuna squadra trovata per questo girone.</div>`;
              }
            });
          } else {
            html += `<div class="card" style="text-align:center; color:var(--text2);font-family:var(--font-sub,inherit); padding:2rem;"><i class="ri-alert-line"></i> Il nodo strutturaGironi è vuoto.</div>`;
          }
        } else {
          html += `<div class="card" style="text-align:center; color:var(--text2);font-family:var(--font-sub,inherit); padding:2rem;"><i class="ri-alert-line"></i> Voce "strutturaGironi" non configurata per questa competizione.</div>`;
        }

        html += '</div>';
        return html;
      });
    } 
    
    // 3) CASO CAMPIONATO MISTO-SPECIALE
    else if (compType === 'misto-speciale') {
      const squadreComp = ClassificaService.getSquadreCompetizione(compData, compTeams);
      const sortedTeams = ClassificaService.ordinaSquadre(squadreComp, teamCalculatedStats);

      this.renderModoConTabellone(actionsDiv, contentDiv, compData, state, () => {
        let html = `
          <div id="view-dati-classifica">
            <div class="card" data-th="cls-legend" style="font-size:0.75rem; display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:0.5rem; margin-bottom:1rem; background:var(--subbox-bg); border:1px solid var(--border);">
              <div style="display:flex; align-items:center; gap:0.5rem;"><i class="ri-medal-fill" style="color:var(--gold);"></i> <span style="color:var(--text);">Oro: Quarti scontrano play off</span></div>
              <div style="display:flex; align-items:center; gap:0.5rem;"><i class="ri-medal-fill" style="color:var(--accent2);"></i> <span style="color:var(--text);">Blu: Degno avversario</span></div>
              <div style="display:flex; align-items:center; gap:0.5rem;"><i class="ri-medal-fill" style="color:var(--accent);"></i> <span style="color:var(--text);">Verde: Play off</span></div>
              <div style="display:flex; align-items:center; gap:0.5rem;"><i class="ri-close-circle-fill" style="color:var(--accent3);"></i> <span style="color:var(--text);">Rosso: Eliminato</span></div>
            </div>
        `;

        const top12 = sortedTeams.slice(0, 12);

        html += this.renderTabellaClassica(top12, compId, (index) => {
          const pos = index + 1;
          if (pos <= 2) return 'border-left: 4px solid var(--gold);';
          if (pos <= 6) return 'border-left: 4px solid var(--accent2);';
          if (pos <= 10) return 'border-left: 4px solid var(--accent);';
          return 'border-left: 4px solid var(--accent3);';
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
        contentDiv.innerHTML = `<div class="card" style="text-align:center; color:var(--text2);font-family:var(--font-sub,inherit); padding:2rem;"><i class="ri-shield-line"></i> Nessun tabellone ad eliminazione diretta generato dal pannello Admin.</div>`;
      }
    }
  },

  renderTabellaClassica(teamsList, compId, rowStyleCallback = null, teamCalculatedStats = {}) {
    const myTeamId = window.STATE && window.STATE.user ? String(window.STATE.user.id) : null;

    // Pannello trasparente, come le card della home (--subbox-bg)
    let html = `
      <div class="card" data-th="cls-table" style="padding:0; overflow:hidden; border:1px solid var(--border); border-radius:14px; margin-bottom: 1rem; background: var(--subbox-bg);">
        <div data-th="cls-head" style="background: transparent; color: var(--text2); font-family: var(--font-sub, inherit); border-bottom: 1px solid var(--border); padding: 0.6rem 0.8rem; display: flex; align-items: center; justify-content: flex-end; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.5px;">
          <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; max-width: 250px; text-align: center;">
            <span style="width:24px;">G</span>
            <span style="width:24px;">V</span>
            <span style="width:24px;">N</span>
            <span style="width:24px;">P</span>
            <span style="width:26px;">Gf</span>
            <span style="width:26px;">Gs</span>
            <span style="width:30px; color: var(--accent);">Pt</span>
            <span style="width:50px; text-align:right;">Pt Totali</span>
          </div>
        </div>

        <div style="display: flex; flex-direction: column;">
    `;

    teamsList.forEach((t, idx) => {
      const stats = teamCalculatedStats[t.id] || { giocate: 0, pts: 0, w: 0, d: 0, l: 0, totFanta: 0, gf: 0, gs: 0 };
      const customStyle = rowStyleCallback ? rowStyleCallback(idx) : '';
      const isMe = myTeamId !== null && String(t.id) === myTeamId;
      const isLastRow = idx === teamsList.length - 1;

      const logoHTML = t.logo
        ? `<img src="${esc(t.logo)}" alt="Logo ${esc(t.name)}" style="width:35.75px; height:35.75px; object-fit:contain; border-radius:5px; flex-shrink:0;">`
        : `<div style="width:35.75px; height:35.75px; background:var(--bg3); display:flex; align-items:center; justify-content:center; border-radius:5px; font-size:1.15rem; color:var(--text3);font-family:var(--font-text3,inherit); flex-shrink:0;"><i class="ri-shield-line"></i></div>`;

      const isLast = isLastRow && teamsList.length > 5;
      const fantaPtsColor = isLast ? 'var(--accent3)' : (idx === 0 ? 'var(--accent)' : 'var(--text2)');
      const meBg = isMe ? 'background: color-mix(in srgb, var(--accent) 12%, transparent);' : '';

      // Tutta la riga è cliccabile: apre la scheda della squadra
      html += `
        <div class="row-link" data-th="cls-row" ${isMe ? 'data-me' : ''} role="button" tabindex="0" data-team-id="${esc(t.id)}" onclick="window.openTeamPage(this.dataset.teamId, 'classifica')"
             style="padding: 0.65rem 0.8rem; ${isLastRow ? '' : 'border-bottom: 1px solid var(--border);'} ${meBg} ${customStyle}">
          <!-- RIGA 1: POSIZIONE + LOGO + NOME SQUADRA -->
          <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.35rem;">
            <span data-th="cls-pos" style="font-weight: 700; color: var(--text2); font-family: var(--font-sub, inherit); font-size: 0.95rem; min-width: 18px; text-align: center;">${idx + 1}</span>
            ${logoHTML}
            <span data-th="cls-team" style="font-weight: 600; color: var(--text); font-size: 0.9rem; overflow-wrap: anywhere; flex: 1; min-width: 0;">${esc(t.name)}</span>
            <i class="ri-arrow-right-s-line" style="color: var(--text3); font-family: var(--font-text3, inherit); font-size: 1.1rem; flex-shrink: 0;"></i>
          </div>

          <!-- RIGA 2: GRIGLIA DATI / NUMERI -->
          <div style="display: flex; align-items: center; justify-content: flex-end; font-size: 0.8rem; font-family: 'DM Mono', monospace;">
            <div data-th="cls-stats" style="display: flex; align-items: center; justify-content: space-between; width: 100%; max-width: 250px; text-align: center; color: var(--text2); font-family: var(--font-sub, inherit);">
              <span style="width:24px;">${stats.giocate}</span>
              <span style="width:24px;">${stats.w}</span>
              <span style="width:24px;">${stats.d}</span>
              <span style="width:24px;">${stats.l}</span>
              <span style="width:26px;">${stats.gf}</span>
              <span style="width:26px;">${stats.gs}</span>
              <span data-th="cls-pts" style="width:30px; font-weight: 700; color: var(--accent); font-size: 0.95rem;">${stats.pts}</span>
              <span data-th="cls-tot" style="width:50px; text-align:right; font-weight: 600; color: ${fantaPtsColor};">${(Number(stats.totFanta) || 0).toFixed(1)}</span>
            </div>
          </div>
        </div>
      `;
    });

    html += `</div></div>`;
    return html;
  },

  renderModoConTabellone(actionsDiv, contentDiv, compData, state, classificaHtmlCallback) {
    if (actionsDiv) {
      actionsDiv.style.display = 'flex';
      actionsDiv.innerHTML = `
        <button id="btn-mostra-classifica" class="btn btn-green" style="padding:0.4rem .8rem; font-size:0.75rem;"><i class="ri-bar-chart-2-line"></i> Classifica</button>
        <button id="btn-mostra-tabellone" class="btn btn-outline" style="padding:0.4rem .8rem; font-size:0.75rem;"><i class="ri-trophy-line"></i> Visualizza Tabellone</button>
      `;
      actionsDiv.querySelector('#btn-mostra-classifica').onclick = () => this._setVista(false);
      actionsDiv.querySelector('#btn-mostra-tabellone').onclick = () => this._setVista(true);
    }

    let htmlContenuto = classificaHtmlCallback();

    htmlContenuto += `<div id="view-dati-tabellone" style="display:none; overflow-x:auto; padding-top:0.5rem;">`;
    if (compData.tabelloneStructure) {
      htmlContenuto += this.renderStrutturaTabelloneGrafico(compData.tabelloneStructure, state, compData);
    } else {
      htmlContenuto += `<div class="card" style="text-align:center; color:var(--text2);font-family:var(--font-sub,inherit); padding:1.5rem;"><i class="ri-alert-line"></i> Il tabellone ad eliminazione non è ancora stato generato dall'Amministratore per questa fase.</div>`;
    }
    htmlContenuto += `</div>`;

    contentDiv.innerHTML = htmlContenuto;
    this._setVista(this._showTabellone);
  },

  /** Mostra la classifica (false) o il tabellone (true) e ricorda la scelta. */
  _setVista(mostraTabellone) {
    this._showTabellone = !!mostraTabellone;
    const show = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? 'block' : 'none'; };
    const active = (id, on) => {
      const btn = document.getElementById(id);
      if (btn) { btn.classList.toggle('btn-green', on); btn.classList.toggle('btn-outline', !on); }
    };
    show('view-dati-classifica', !this._showTabellone);
    show('view-dati-tabellone', this._showTabellone);
    active('btn-mostra-classifica', !this._showTabellone);
    active('btn-mostra-tabellone', this._showTabellone);
  },

  renderStrutturaTabelloneGrafico(tabelloneStructure, state, compData = {}) {
    if (!tabelloneStructure || !tabelloneStructure.fasi) {
      return `<div class="card" style="text-align:center; color:var(--text2);font-family:var(--font-sub,inherit);">Struttura tabellone non disponibile.</div>`;
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
        // segnaposto "VINCENTE_<match>" sostituiti dalla squadra vincente, quando è già nota
        const resolve = (id) => (isVincente(id) && resolvedWinners[id]) ? resolvedWinners[id] : id;
        const homeIdActual = resolve(m.homeId);
        const awayIdActual = resolve(m.awayId);

        const teamHome = teamsGlobal.find(t => sameId(t.id, homeIdActual));
        const teamAway = teamsGlobal.find(t => sameId(t.id, awayIdActual));
        
        const isHomePending = !teamHome && isVincente(homeIdActual);
        const isAwayPending = !teamAway && isVincente(awayIdActual);

        const teamName = (team, id, pending) => pending ? sid(id).replace('VINCENTE_', '') : (team ? team.name : sid(id));
        const nameHome = esc(teamName(teamHome, homeIdActual, isHomePending));
        const nameAway = esc(teamName(teamAway, awayIdActual, isAwayPending));

        const logoHTML = (team, pending) => !pending && team?.logo
          ? `<img src="${esc(team.logo)}" alt="" style="width:27.5px; height:27.5px; object-fit:contain; border-radius:3px; flex-shrink:0;">`
          : `<span style="font-size:1.375rem; flex-shrink:0; width:27.5px; text-align:center;"><i class="ri-shield-line"></i></span>`;
        const logoHomeHTML = logoHTML(teamHome, isHomePending);
        const logoAwayHTML = logoHTML(teamAway, isAwayPending);

        const res = matchResultsMap[m.id] || {};
        
        let strAndata = 'A: -';
        if (res.andata && res.andata.finished) {
          const gH = res.andata.goalHome ?? res.andata.homeScore ?? 0;
          const gA = res.andata.goalAway ?? res.andata.awayScore ?? 0;
          strAndata = `A: ${gH}-${gA}`;
        }

        let strRitorno = '';
        // stessa regola del calcolo dei vincitori: solo la finale è in gara secca
        if (isAndataRitorno && !ClassificaService.isFinale(faseObj.nomeFase)) {
          if (res.ritorno && res.ritorno.finished) {
            const gH = res.ritorno.goalHome ?? res.ritorno.homeScore ?? 0;
            const gA = res.ritorno.goalAway ?? res.ritorno.awayScore ?? 0;
            const rHomeId = res.ritorno.homeId || res.ritorno.home;
            const teamAndataCasa = res.andata?.homeId || res.andata?.home;

            strRitorno = (res.andata && !sameId(rHomeId, teamAndataCasa)) ? ` | R: ${gA}-${gH}` : ` | R: ${gH}-${gA}`;
          } else {
            strRitorno = ` | R: -`;
          }
        }

        return `
          <div class="card-mini" data-th="cls-koMatch" style="background: var(--subbox-bg); border: 1px solid var(--border); padding: .6rem; border-radius: 6px; font-size: .8rem; width: 220px;">
            <div style="color:var(--text3);font-family:var(--font-text3,inherit); font-size:0.65rem; font-weight:bold; margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
              <span><i class="ri-hashtag"></i> ${esc(sid(m.id).toUpperCase())}</span>
              <span style="color:var(--accent); font-family:'DM Mono',monospace;">${strAndata}${strRitorno}</span>
            </div>
            <div style="padding: 2px 0; color:var(--text); display:flex; align-items:center; gap:0.4rem;">
              ${logoHomeHTML}
              <span style="min-width: 0; overflow-wrap: anywhere; ${isHomePending ? 'color:var(--text2);font-family:var(--font-sub,inherit); font-style:italic;' : ''}">${nameHome}</span>
            </div>
            <div style="padding: 2px 0; color:var(--text2);font-family:var(--font-sub,inherit); display:flex; align-items:center; gap:0.4rem;">
              ${logoAwayHTML}
              <span style="min-width: 0; overflow-wrap: anywhere; ${isAwayPending ? 'color:var(--text2);font-family:var(--font-sub,inherit); font-style:italic;' : ''}">${nameAway}</span>
            </div>
          </div>
        `;
      }).join('<div style="height: 1rem;"></div>');

      return `
        <div style="display: flex; flex-direction: column; align-items: center;">
          <div class="card-mini" data-th="cls-phase" style="background: var(--subbox-bg); color: var(--accent); padding: .3rem .6rem; font-family:'Bebas Neue',sans-serif; font-size:1rem; border-radius:4px; margin-bottom:0.75rem; border:1px solid var(--border);">
            ${esc(sid(faseObj.nomeFase || chiave).toUpperCase())}
          </div>
          <div style="display: flex; flex-direction: column; justify-content: center;">
            ${htmlIncontri}
          </div>
        </div>
      `;
    }).join(`
      <div style="display:flex; align-items:center; color:var(--text3);font-family:var(--font-text3,inherit); padding-top:1.5rem;">
        <i class="ri-arrow-right-s-line" style="font-size: 18px;"></i>
      </div>
    `);

    htmlAlbero += `</div>`;
    return htmlAlbero;
  }
};
