import { ClassificaService } from "./services/classificaService.js";
import { GwService } from "./services/gwService.js";
import { LiveMatchModule } from "./liveMatch.js";
import { openSimulaGiornate } from "./components/SimulaGiornate.js";
import { esc, sid, sameId } from "./utils.js";

const isVincente = (id) => sid(id).startsWith('VINCENTE_');
const isBye = (id) => /BYE|RIPOSO/i.test(String(id ?? ''));
const isKnockoutCouple = (c) => /^(ELIMINAZIONE|FINALE)/i.test(String(c?.type || '')) || !!c?.phaseKey;
/** Partita che conta per la classifica (no riposi, no tabellone). */
const contaInClassifica = (c) => c && c.homeId && c.awayId && !isBye(c.homeId) && !isBye(c.awayId) && !isKnockoutCouple(c);
const SIM_KEY = (compId) => `fantacapp-cls-sim-${compId}`;

const MODE_CSS = `
#cls-mode{display:flex;gap:.35rem;margin-bottom:.6rem;background:var(--subbox-bg);border:1px solid var(--border);border-radius:999px;padding:.25rem}
#cls-mode button{flex:1;border:none;background:transparent;color:var(--text2);font-family:var(--font-btn,inherit);font-size:.78rem;font-weight:600;padding:.45rem .3rem;border-radius:999px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:.3rem}
#cls-mode button.on{background:var(--btn-primary);color:var(--btn-primary-text)}
#cls-mode .dot{width:7px;height:7px;border-radius:50%;background:var(--accent3);animation:clsPulse 1.4s infinite}
@keyframes clsPulse{50%{opacity:.3}}
.cls-banner{display:flex;align-items:center;gap:.5rem;font-size:.75rem;color:var(--text2);font-family:var(--font-sub,inherit);background:var(--subbox-bg);border:1px solid var(--border);border-radius:12px;padding:.5rem .7rem;margin-bottom:.8rem}
.cls-banner span{flex:1;min-width:0}
.cls-banner .btn{width:auto;padding:.35rem .7rem;font-size:.72rem;flex-shrink:0}
.cls-delta{font-size:.68rem;font-weight:700;font-family:'DM Mono',monospace;flex-shrink:0;display:inline-flex;align-items:center}
.cls-live{font-size:.68rem;font-weight:700;font-family:'DM Mono',monospace;border-radius:6px;padding:.05rem .35rem;flex-shrink:0;border:1px solid currentColor}
`;

export const ClassificaPage = {
  // Vista scelta nei tornei con tabellone (classifica / tabellone): resta tra un aggiornamento e l'altro dei dati
  _showTabellone: false,
  _compId: null,
  // Modo della classifica scelto dall'utente: 'ufficiale' | 'live' | 'simulata' (null = automatico: live se c'è la diretta)
  _mode: null,
  _sim: null, // { n, picks } della competizione aperta (simulazione)

  renderHTML() {
    return `
      <div id="page-classifica" class="page">
        <div id="cls-mode-wrap"></div>
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
    // cambiando competizione si riparte dalla classifica (e dal modo automatico)
    if (!sameId(this._compId, compId)) { this._compId = compId; this._showTabellone = false; this._mode = null; this._sim = null; }
    this._state = state;

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

    // Calcolo ed elaborazione tramite il Service (classifica ufficiale)
    const officialStats = ClassificaService.calcolaStatistiche(compTeams, classificaDbNode);

    // Modo: ufficiale / live (diretta in corso sommata) / simulata (risultati scelti dall'utente)
    const modeWrap = document.getElementById('cls-mode-wrap');
    const modo = compType === 'diretta' ? null : this._calcolaModo(state, compData, compTeams, officialStats);
    if (modeWrap) modeWrap.innerHTML = modo ? this._modeBarHTML(modo) : '';
    if (modo) this._bindModeBar(modeWrap, compData);
    const teamCalculatedStats = modo ? modo.stats : officialStats;
    // confronto con la classifica ufficiale (frecce su/giù) e risultato live accanto al nome
    const extra = modo && modo.mode !== 'ufficiale' ? { baseStats: officialStats, liveRes: modo.liveRes || null } : {};

    // 1) CASO CAMPIONATO STANDARD
    if (compType === 'campionato') {
      const squadreComp = ClassificaService.getSquadreCompetizione(compData, compTeams);
      const sortedTeams = ClassificaService.ordinaSquadre(squadreComp, teamCalculatedStats);
      contentDiv.innerHTML = this.renderTabellaClassica(sortedTeams, compId, null, teamCalculatedStats, extra);
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
                }, teamCalculatedStats, extra);
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
        }, teamCalculatedStats, extra.baseStats ? { ...extra, baseRank: ClassificaService.mappaPosizioni(squadreComp, extra.baseStats) } : extra);

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

  renderTabellaClassica(teamsList, compId, rowStyleCallback = null, teamCalculatedStats = {}, extra = {}) {
    const myTeamId = window.STATE && window.STATE.user ? String(window.STATE.user.id) : null;
    // posizioni nella classifica ufficiale, per le frecce (solo in live / simulata)
    const baseRank = extra.baseRank || (extra.baseStats ? ClassificaService.mappaPosizioni(teamsList, extra.baseStats) : null);
    const liveRes = extra.liveRes || null;

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
        ? `<img src="${esc(t.logo)}" alt="Logo ${esc(t.name)}" style="width:32px; height:32px; object-fit:contain; border-radius:5px; flex-shrink:0;">`
        : `<div style="width:32px; height:32px; background:var(--bg3); display:flex; align-items:center; justify-content:center; border-radius:5px; font-size:1.15rem; color:var(--text3);font-family:var(--font-text3,inherit); flex-shrink:0;"><i class="ri-shield-line"></i></div>`;

      const isLast = isLastRow && teamsList.length > 5;
      const fantaPtsColor = isLast ? 'var(--accent3)' : (idx === 0 ? 'var(--accent)' : 'var(--text2)');
      const meBg = isMe ? 'background: color-mix(in srgb, var(--accent) 12%, transparent);' : '';

      let deltaHTML = '';
      if (baseRank && baseRank[String(t.id)] !== undefined) {
        const d = baseRank[String(t.id)] - idx;
        deltaHTML = d > 0
          ? `<span class="cls-delta" style="color:var(--accent);" title="Sale di ${d}"><i class="ri-arrow-up-s-fill"></i>${d}</span>`
          : d < 0
            ? `<span class="cls-delta" style="color:var(--accent3);" title="Scende di ${-d}"><i class="ri-arrow-down-s-fill"></i>${-d}</span>`
            : `<span class="cls-delta" style="color:var(--text3);" title="Stessa posizione">=</span>`;
      }
      const lr = liveRes ? liveRes[String(t.id)] : null;
      const liveHTML = lr
        ? `<span class="cls-live" style="color:${lr.esito === 'V' ? 'var(--accent)' : lr.esito === 'P' ? 'var(--accent3)' : 'var(--text2)'};" title="Risultato live">${lr.gf}-${lr.gs}</span>`
        : '';

      // Tutta la riga è cliccabile: apre la scheda della squadra
      html += `
        <div class="row-link" data-th="cls-row" ${isMe ? 'data-me' : ''} role="button" tabindex="0" data-team-id="${esc(t.id)}" onclick="window.openTeamPage(this.dataset.teamId, 'classifica')"
             style="padding: 0.42rem 0.8rem; ${isLastRow ? '' : 'border-bottom: 1px solid var(--border);'} ${meBg} ${customStyle}">
          <!-- RIGA 1: POSIZIONE + LOGO + NOME SQUADRA -->
          <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.1rem;">
            <span data-th="cls-pos" style="font-weight: 700; color: var(--text2); font-family: var(--font-sub, inherit); font-size: 0.95rem; min-width: 18px; text-align: center;">${idx + 1}</span>
            ${logoHTML}
            <span data-th="cls-team" style="font-weight: 600; color: var(--text); font-size: 0.9rem; overflow-wrap: anywhere; flex: 1; min-width: 0;">${esc(t.name)}</span>
            ${liveHTML}${deltaHTML}
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

  // ------------------------------------------------------------------
  // Classifica live e simulata
  // ------------------------------------------------------------------

  /** Competizione con il calendario aggiornato (STATE.matches è quello della competizione aperta). */
  _compConMatches(state, compData) {
    const m = state.matches && Object.keys(state.matches).length ? state.matches : (compData.matches || {});
    return { ...compData, matches: m };
  },

  /** Giornata in diretta di questa competizione, con le sue partite di classifica; null se non c'è. */
  _liveInfo(state, compData) {
    if (state.live !== true) return null;
    const realGw = GwService.getGwReale(state);
    if (realGw === null) return null;
    const comp = this._compConMatches(state, compData);
    const gwKey = GwService.getGwKey(comp, realGw);
    if (!gwKey) return null;
    const couples = GwService.getCouples(comp, gwKey).filter(contaInClassifica);
    if (!couples.length) return null;
    return { comp, gwKey, realGw, couples };
  },

  /** Giornate con partite di classifica ancora da giocare, in ordine (per la simulazione). */
  _giornateDaGiocare(state, compData) {
    const comp = this._compConMatches(state, compData);
    const giocate = compData.classifica || {};
    const ord = (k) => {
      const r = GwService.getRealOf(comp, k);
      const n = parseInt(String(k).replace(/\D/g, '')) || 0;
      return (String(k).startsWith('gw_playoff_') ? 1e6 : 0) + (r !== null ? r * 1000 : 0) + n;
    };
    return Object.keys(comp.matches || {})
      .sort((a, b) => ord(a) - ord(b))
      .map(gwKey => ({
        gwKey,
        label: GwService.label(gwKey),
        couples: GwService.getCouples(comp, gwKey)
          .filter(c => contaInClassifica(c) && c.finished !== true && !(giocate[gwKey] && giocate[gwKey][c.homeId]))
          .map(c => ({ key: String(c.key), homeId: c.homeId, awayId: c.awayId }))
      }))
      .filter(g => g.couples.length > 0);
  },

  _loadSim(compId) {
    if (this._sim) return this._sim;
    let s = null;
    try { s = JSON.parse(localStorage.getItem(SIM_KEY(compId)) || 'null'); } catch (e) {}
    this._sim = s && typeof s === 'object' ? { n: Number(s.n) || 1, picks: s.picks || {} } : { n: 1, picks: {} };
    return this._sim;
  },

  _saveSim(compId) {
    try { localStorage.setItem(SIM_KEY(compId), JSON.stringify(this._sim)); } catch (e) {}
  },

  /**
   * Statistiche del modo attivo.
   * live: classifica senza la giornata in diretta + risultati live (6 a chi deve ancora giocare, sostituzioni).
   * simulata: classifica ufficiale + i risultati 1/X/2 scelti (solo punti e V/N/P; gol e fanta restano quelli reali).
   */
  _calcolaModo(state, compData, compTeams, officialStats) {
    const live = this._liveInfo(state, compData);
    let mode = this._mode || (live ? 'live' : 'ufficiale');
    if (mode === 'live' && !live) mode = 'ufficiale';
    const out = { mode, liveOn: !!live, stats: officialStats };

    if (mode === 'live') {
      const node = { ...(compData.classifica || {}) };
      delete node[live.gwKey]; // la giornata in diretta si rifà da capo coi punteggi live
      const stats = ClassificaService.calcolaStatistiche(compTeams, node);
      const liveRes = {};
      live.couples.forEach(c => {
        let gH, gA, fH, fA;
        if (c.finished === true && (c.goalHome ?? c.homeScore) !== undefined) {
          gH = Number(c.goalHome ?? c.homeScore) || 0; gA = Number(c.goalAway ?? c.awayScore) || 0;
          fH = Number(c.punteggioFinaleHome) || 0; fA = Number(c.punteggioFinaleAway) || 0;
        } else {
          let r = null;
          try { r = LiveMatchModule.liveSummary({ comp: live.comp, gwKey: live.gwKey, couple: c, gwReale: live.realGw }); } catch (e) { console.warn('Classifica live:', e); }
          gH = Number(r?.goalHome) || 0; gA = Number(r?.goalAway) || 0;
          fH = Number(r?.fvHome) || 0; fA = Number(r?.fvAway) || 0;
        }
        const esH = gH > gA ? 'V' : gH < gA ? 'P' : 'N';
        const esA = esH === 'V' ? 'P' : esH === 'P' ? 'V' : 'N';
        ClassificaService.aggiungiRisultato(stats, c.homeId, { esito: esH, gf: gH, gs: gA, fanta: fH });
        ClassificaService.aggiungiRisultato(stats, c.awayId, { esito: esA, gf: gA, gs: gH, fanta: fA });
        liveRes[String(c.homeId)] = { gf: gH, gs: gA, esito: esH };
        liveRes[String(c.awayId)] = { gf: gA, gs: gH, esito: esA };
      });
      return { ...out, stats, liveRes, gwKey: live.gwKey };
    }

    if (mode === 'simulata') {
      const sim = this._loadSim(compData.id);
      const giornate = this._giornateDaGiocare(state, compData);
      const stats = ClassificaService.copiaStatistiche(officialStats);
      let partite = 0;
      const usate = giornate.slice(0, Math.max(1, sim.n));
      usate.forEach(g => g.couples.forEach(c => {
        const v = sim.picks[g.gwKey]?.[c.key];
        if (!v) return;
        partite++;
        const esH = v === '1' ? 'V' : v === '2' ? 'P' : 'N';
        const esA = v === '1' ? 'P' : v === '2' ? 'V' : 'N';
        ClassificaService.aggiungiRisultato(stats, c.homeId, { esito: esH });
        ClassificaService.aggiungiRisultato(stats, c.awayId, { esito: esA });
      }));
      return { ...out, stats, partite, giornate: usate.length, ultima: usate.length ? usate[usate.length - 1].label : null };
    }
    return out;
  },

  _modeBarHTML(modo) {
    if (!document.getElementById('cls-mode-css')) {
      const st = document.createElement('style');
      st.id = 'cls-mode-css';
      st.textContent = MODE_CSS;
      document.head.appendChild(st);
    }
    const btn = (m, html) => `<button data-mode="${m}" class="${modo.mode === m ? 'on' : ''}">${html}</button>`;
    let html = `<div id="cls-mode" role="tablist">
      ${btn('ufficiale', '<i class="ri-bar-chart-2-line"></i> Ufficiale')}
      ${modo.liveOn ? btn('live', '<span class="dot"></span> Live') : ''}
      ${btn('simulata', '<i class="ri-magic-line"></i> Simulata')}
    </div>`;
    if (modo.mode === 'live') {
      html += `<div class="cls-banner"><i class="ri-record-circle-fill" style="color:var(--accent3);"></i>
        <span>${esc(GwService.label(modo.gwKey))} in diretta: risultati live sommati alla classifica, con 6 a chi deve ancora giocare.</span></div>`;
    } else if (modo.mode === 'simulata') {
      const txt = modo.partite
        ? `${modo.partite} risultat${modo.partite === 1 ? 'o' : 'i'} simulat${modo.partite === 1 ? 'o' : 'i'} fino alla ${esc(modo.ultima)} (contano solo i punti).`
        : 'Nessun risultato scelto: tocca Scegli per simulare le prossime giornate.';
      html += `<div class="cls-banner"><i class="ri-magic-line" style="color:var(--accent);"></i><span>${txt}</span>
        <button class="btn btn-green" data-act="sim-open"><i class="ri-edit-line"></i> Scegli</button></div>`;
    }
    return html;
  },

  _bindModeBar(wrap, compData) {
    wrap.querySelectorAll('[data-mode]').forEach(b => {
      b.onclick = () => {
        const m = b.dataset.mode;
        if (m === 'simulata') {
          const sim = this._loadSim(compData.id);
          const vuota = !Object.keys(sim.picks || {}).length;
          this._mode = 'simulata';
          this._rerender();
          if (vuota) this._openSim(compData); // prima volta: si apre subito la finestra
          return;
        }
        this._mode = m;
        this._rerender();
      };
    });
    const open = wrap.querySelector('[data-act="sim-open"]');
    if (open) open.onclick = () => this._openSim(compData);
  },

  _openSim(compData) {
    const state = this._state || window.STATE || {};
    const sim = this._loadSim(compData.id);
    openSimulaGiornate({
      giornate: this._giornateDaGiocare(state, compData),
      teams: state.teams || [],
      sim,
      onChange: () => { this._saveSim(compData.id); if (this._mode === 'simulata') this._rerender(); },
      onApply: () => { this._mode = 'simulata'; this._rerender(); }
    });
  },

  _rerender() {
    this.render(this._state || window.STATE);
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
