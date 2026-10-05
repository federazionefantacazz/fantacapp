import { ClassificaService } from "../services/classificaService.js";

const GO_CLASSIFICA = `
  const btnClassifica = document.querySelector('button[onclick*=\\'classifica\\']');
  window.goPage('classifica', btnClassifica);
`;

/**
 * Mini classifica della home. Si adatta al tipo di competizione:
 *  - campionato / misto-speciale: tutte le squadre iscritte alla competizione
 *  - misto: solo il girone della squadra
 * Mostra posizione, squadra, partite giocate (G), punti classifica (Pt) e totale punti fanta (Tot).
 */
export function renderAnteprimaClassificaStandard(comp, teamsList, myTeamId) {
  if (!comp || !teamsList || !myTeamId) {
    return `<div style="font-size: 0.7rem; color: var(--text3);">Dati competizione o squadra non disponibili.</div>`;
  }

  const classificaDbNode = comp.classifica || {};
  const compType = comp.type || 'campionato';

  let compTeams;
  let gironeLabel = '';

  if (compType === 'misto') {
    const girone = ClassificaService.getGironeDiSquadra(comp, myTeamId, teamsList);
    if (!girone) {
      return `<div style="font-size: 0.7rem; color: var(--text3);">Squadra non presente in nessun girone.</div>`;
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
    return `<div style="font-size: 0.7rem; color: var(--text3);">Squadra non presente in classifica.</div>`;
  }

  const subset = [];
  if (myIndex > 0) subset.push({ team: sortedTeams[myIndex - 1], pos: myIndex });
  subset.push({ team: sortedTeams[myIndex], pos: myIndex + 1 });
  if (myIndex < sortedTeams.length - 1) subset.push({ team: sortedTeams[myIndex + 1], pos: myIndex + 2 });

  const colHead = 'font-size: 0.6rem; font-weight: 700; color: var(--text3); text-transform: uppercase; text-align: center;';

  return `
    <div onclick="${GO_CLASSIFICA}"
         style="display: flex; flex-direction: column; gap: 0.3rem; width: 100%; cursor: pointer; background: var(--subbox-bg); border: 1px solid var(--border); border-radius: 10px; padding: 0.6rem 0.7rem;"
         title="Clicca per visualizzare la classifica completa">

      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.15rem;">
        <div style="font-size: 0.7rem; font-weight: 600; color: var(--text2); text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          <i class="ri-bar-chart-2-line"></i> Mini Classifica${gironeLabel ? ` · ${gironeLabel}` : ''}
        </div>
        <div style="font-size: 0.65rem; color: var(--accent); display: flex; align-items: center; gap: 2px; flex-shrink: 0;">Vedi intera <i class="ri-arrow-right-s-line"></i></div>
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
          ? 'background: color-mix(in srgb, var(--accent) 15%, transparent); border: 1px solid var(--accent);'
          : 'background: rgba(0,0,0,0.15); border: 1px solid transparent;';
        const numColor = isMe ? 'var(--accent)' : 'var(--text)';

        return `
          <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem 0.5rem; border-radius: 6px; ${rowBg} font-size: 0.75rem;">
            <span style="font-weight: bold; color: ${isMe ? 'var(--accent)' : 'var(--text3)'}; width: 18px; text-align: center;">${pos}°</span>
            <span style="flex: 1; min-width: 0; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: ${isMe ? 'bold' : 'normal'};">${team.name}</span>
            <span style="font-family: 'DM Mono', monospace; width: 24px; text-align: center; color: var(--text2);">${s.giocate}</span>
            <span style="font-family: 'DM Mono', monospace; width: 28px; text-align: center; font-weight: bold; color: ${numColor};">${s.pts}</span>
            <span style="font-family: 'DM Mono', monospace; width: 52px; text-align: right; color: var(--text2);">${Number(s.totFanta).toFixed(1)}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}
