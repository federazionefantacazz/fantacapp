import { esc, fitName } from '../utils.js';
import { ClassificaService } from "../services/classificaService.js";

const GO_CLASSIFICA = "window.goPage('classifica')";

/**
 * Mini classifica della home. Si adatta al tipo di competizione:
 *  - campionato / misto-speciale: tutte le squadre iscritte alla competizione
 *  - misto: solo il girone della squadra
 * Mostra posizione, squadra, partite giocate (G), punti classifica (Pt) e totale punti fanta (Tot).
 * opts.compact: per mezza card (Home), solo posizione, squadra e Pt, senza riquadro proprio.
 */
export function renderAnteprimaClassificaStandard(comp, teamsList, myTeamId, opts = {}) {
  if (!comp || !teamsList || !myTeamId) {
    return `<div style="font-size: 0.7rem; color: var(--text3); font-family: var(--font-text3, inherit);">Dati competizione o squadra non disponibili.</div>`;
  }

  const classificaDbNode = comp.classifica || {};
  const compType = comp.type || 'campionato';

  let compTeams;
  let gironeLabel = '';

  if (compType === 'misto') {
    const girone = ClassificaService.getGironeDiSquadra(comp, myTeamId, teamsList);
    if (!girone) {
      return `<div style="font-size: 0.7rem; color: var(--text3); font-family: var(--font-text3, inherit);">Squadra non presente in nessun girone.</div>`;
    }
    compTeams = girone.squadre;
    gironeLabel = girone.nome;
  } else {
    compTeams = ClassificaService.getSquadreCompetizione(comp, teamsList);
  }

  const stats = ClassificaService.calcolaStatistiche(compTeams, classificaDbNode);
  const sortedTeams = ClassificaService.ordinaSquadre(compTeams, stats);

  const myIndex = sortedTeams.findIndex(t => String(t.id) === String(myTeamId));
  if (myIndex === -1) {
    return `<div style="font-size: 0.7rem; color: var(--text3); font-family: var(--font-text3, inherit);">Squadra non presente in classifica.</div>`;
  }

  const subset = [];
  if (myIndex > 0) subset.push({ team: sortedTeams[myIndex - 1], pos: myIndex });
  subset.push({ team: sortedTeams[myIndex], pos: myIndex + 1 });
  if (myIndex < sortedTeams.length - 1) subset.push({ team: sortedTeams[myIndex + 1], pos: myIndex + 2 });

  const colHead = 'font-size: 0.6rem; font-weight: 700; color: var(--text3); font-family: var(--font-text3, inherit); text-transform: uppercase; text-align: center;';

  if (opts.compact) {
    // sempre 3 righe quando possibile (anche se la squadra è prima o ultima)
    const from = Math.max(0, Math.min(myIndex - 1, sortedTeams.length - 3));
    const rows = sortedTeams.slice(from, from + 3).map((team, i) => ({ team, pos: from + i + 1 }));
    return `
    <div onclick="${GO_CLASSIFICA}" style="display: flex; flex-direction: column; gap: 0.3rem; width: 100%; cursor: pointer;" title="Clicca per visualizzare la classifica completa">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.3rem; margin-bottom: 0.1rem;">
        <div data-th="home-boxTitle" style="min-width: 0; font-size: 0.7rem; font-weight: 700; color: var(--text2); font-family: var(--font-sub, inherit); text-transform: uppercase; line-height: 1.2;">Classifica${gironeLabel ? `<div style="font-weight: 600; color: var(--text3); font-family: var(--font-text3, inherit);">${esc(gironeLabel)}</div>` : ''}</div>
        <i class="ri-arrow-right-s-line" aria-label="Vedi intera" style="font-size: 1.1rem; color: var(--accent); flex-shrink: 0;"></i>
      </div>
      <div style="display: flex; align-items: center; gap: 0.35rem; padding: 0 0.4rem;">
        <span style="${colHead} width: 22px; text-align: left;">#</span>
        <span style="${colHead} flex: 1; text-align: left;">Squadra</span>
        <span style="${colHead} width: 22px;">Pt</span>
      </div>
      ${rows.map(({ team, pos }) => {
        const s = stats[team.id] || { pts: 0 };
        const isMe = String(team.id) === String(myTeamId);
        // righe dal tema (pagina Home): attiva = la mia squadra
        const rowBg = isMe
          ? 'background: var(--mc-active-bg, color-mix(in srgb, var(--accent) 15%, transparent)); border: 1px solid var(--mc-active-border, var(--accent));'
          : 'background: var(--mc-row-bg, rgba(0,0,0,0.2)); border: 1px solid var(--mc-row-border, transparent);';
        const col = isMe ? 'var(--mc-active-text, var(--accent))' : 'var(--mc-row-text, var(--text))';
        return `
          <div style="display: flex; align-items: center; gap: 0.35rem; padding: 0.3rem 0.4rem; border-radius: 6px; ${rowBg} font-size: 0.74rem;">
            <span style="width: 22px; flex-shrink: 0; color: ${isMe ? col : 'var(--mc-row-text, var(--text2))'}; font-weight: bold;">${pos}°</span>
            ${fitName(team.name, { maxSize: '.74rem', style: `color: ${col}; font-weight: ${isMe ? 'bold' : 'normal'};` })}
            <span style="font-family: 'DM Mono', monospace; width: 22px; flex-shrink: 0; text-align: center; font-weight: bold; color: ${col};">${s.pts}</span>
          </div>`;
      }).join('')}
    </div>`;
  }

  return `
    <div onclick="${GO_CLASSIFICA}"
         style="display: flex; flex-direction: column; gap: 0.3rem; width: 100%; cursor: pointer; background: var(--subbox-bg); border: 1px solid var(--border); border-radius: 10px; padding: 0.6rem 0.7rem;"
         title="Clicca per visualizzare la classifica completa">

      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.15rem;">
        <div data-th="home-boxTitle" style="font-size: 0.7rem; font-weight: 600; color: var(--text2); font-family: var(--font-sub, inherit); text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          <i class="ri-bar-chart-2-line"></i> Mini Classifica${gironeLabel ? ` · ${esc(gironeLabel)}` : ''}
        </div>
        <div data-th="home-boxLink" style="font-size: 0.65rem; color: var(--accent); display: flex; align-items: center; gap: 2px; flex-shrink: 0;">Vedi intera <i class="ri-arrow-right-s-line"></i></div>
      </div>

      <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0 0.5rem;">
        <span style="width: 18px;"></span>
        <span style="flex: 1;"></span>
        <span style="${colHead} width: 24px;">G</span>
        <span style="${colHead} width: 28px;">Pt</span>
        <span style="${colHead} width: 52px; text-align: right;">Tot</span>
      </div>

      ${subset.map(({ team, pos }) => {
        const s = stats[team.id] || { giocate: 0, pts: 0, totFanta: 0 };
        const isMe = String(team.id) === String(myTeamId);
        const rowBg = isMe
          ? 'background: var(--mc-active-bg, color-mix(in srgb, var(--accent) 15%, transparent)); border: 1px solid var(--mc-active-border, var(--accent));'
          : 'background: var(--mc-row-bg, rgba(0,0,0,0.15)); border: 1px solid var(--mc-row-border, transparent);';
        const numColor = isMe ? 'var(--mc-active-text, var(--accent))' : 'var(--mc-row-text, var(--text))';

        return `
          <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem 0.5rem; border-radius: 6px; ${rowBg} font-size: 0.75rem;">
            <span style="font-weight: bold; color: ${isMe ? numColor : 'var(--text3)'}; width: 18px; text-align: center;">${pos}°</span>
            <span data-th="mini-team" style="flex: 1; min-width: 0; color: var(--text); overflow-wrap: anywhere; font-weight: ${isMe ? 'bold' : 'normal'};">${esc(team.name)}</span>
            <span style="font-family: 'DM Mono', monospace; width: 24px; text-align: center; color: var(--text2);">${s.giocate}</span>
            <span style="font-family: 'DM Mono', monospace; width: 28px; text-align: center; font-weight: bold; color: ${numColor};">${s.pts}</span>
            <span style="font-family: 'DM Mono', monospace; width: 52px; text-align: right; color: var(--text2);">${Number(s.totFanta).toFixed(1)}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}
