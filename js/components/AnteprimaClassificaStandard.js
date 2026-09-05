import { ClassificaService } from "../services/classificaService.js";

export function renderAnteprimaClassificaStandard(comp, teamsList, myTeamId) {
  if (!comp || !teamsList || !myTeamId) {
    return `<div style="font-size: 0.7rem; color: var(--text3);">Dati competizione o squadra non disponibili.</div>`;
  }

  let compTeams = [...teamsList];
  const classificaDbNode = comp.classifica || {};
  
  const teamCalculatedStats = ClassificaService.calcolaStatistiche(compTeams, classificaDbNode);
  const sortedTeams = ClassificaService.ordinaSquadre(compTeams, teamCalculatedStats);

  const myIndex = sortedTeams.findIndex(t => String(t.id) === String(myTeamId));
  
  if (myIndex === -1) {
    return `<div style="font-size: 0.7rem; color: var(--text3);">Squadra non presente in classifica.</div>`;
  }

  const subset = [];
  if (myIndex > 0) {
    subset.push({ team: sortedTeams[myIndex - 1], pos: myIndex });
  }
  subset.push({ team: sortedTeams[myIndex], pos: myIndex + 1 });
  if (myIndex < sortedTeams.length - 1) {
    subset.push({ team: sortedTeams[myIndex + 1], pos: myIndex + 2 });
  }

  // Nota: Sostituisci "navigateTo('classifica')" o l'istruzione che usi nella tua app per cambiare pagina 
  // (es. window.location.hash = '#classifica' oppure una funzione globale tipo changePage('classifica')).
  return `
    <div onclick="if(typeof window.navigateTo === 'function') { window.navigateTo('classifica'); } else { window.location.hash = '#classifica'; }" 
         style="display: flex; flex-direction: column; gap: 0.3rem; width: 100%; cursor: pointer; transition: transform 0.1s ease;"
         onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'"
         title="Clicca per visualizzare la classifica completa">
      
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div style="font-size: 0.68rem; font-weight: 600; color: var(--text2); text-transform: uppercase;"><i class="ri-bar-chart-2-line"></i> Mini Classifica</div>
        <div style="font-size: 0.65rem; color: var(--accent); display: flex; align-items: center; gap: 2px;">Vedi intera <i class="ri-arrow-right-s-line"></i></div>
      </div>

      ${subset.map(({ team, pos }) => {
        const stats = teamCalculatedStats[team.id] || { pts: 0 };
        const isMe = String(team.id) === String(myTeamId);
        const rowBg = isMe ? 'background: color-mix(in srgb, var(--accent) 15%, transparent); border: 1px solid var(--accent);' : 'background: rgba(0,0,0,0.15);';
        
        return `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.3rem 0.5rem; border-radius: 4px; ${rowBg} font-size: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; overflow: hidden;">
              <span style="font-weight: bold; color: ${isMe ? 'var(--accent)' : 'var(--text3)'}; width: 18px; text-align: center;">${pos}°</span>
              <span style="color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: ${isMe ? 'bold' : 'normal'};">${team.name}</span>
            </div>
            <span style="font-family: 'DM Mono', monospace; font-weight: bold; color: ${isMe ? 'var(--accent)' : 'var(--text)'};">${stats.pts} pt</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}
