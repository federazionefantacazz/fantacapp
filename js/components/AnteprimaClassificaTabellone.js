export function renderAnteprimaClassificaTabellone(comp, teamsList, myTeamId) {
  if (!comp || !teamsList || !myTeamId) {
    return `<div style="font-size: 0.7rem; color: var(--text3);">Dati competizione o squadra non disponibili.</div>`;
  }

  // Cerca lo scontro diretto o la fase del tabellone della squadra
  let foundMatch = null;
  const matchesNode = comp.matches || {};
  
  for (const gwKey of Object.keys(matchesNode)) {
    const gw = matchesNode[gwKey];
    const couples = gw.couples ? (Array.isArray(gw.couples) ? gw.couples : Object.values(gw.couples)) : [];
    const match = couples.find(m => m && (String(m.homeId) === String(myTeamId) || String(m.awayId) === String(myTeamId)));
    if (match) {
      foundMatch = match;
      break;
    }
  }

  // Dati di default per le squadre del match o fallback estetico
  let homeTeam = teamsList.find(t => foundMatch && String(t.id) === String(foundMatch.homeId));
  let awayTeam = teamsList.find(t => foundMatch && String(t.id) === String(foundMatch.awayId));

  // Se non troviamo un match preciso, prendiamo la squadra utente e un'altra di riserva per disegnare il mini-schema
  const myTeam = teamsList.find(t => String(t.id) === String(myTeamId));
  if (!homeTeam && myTeam) homeTeam = myTeam;
  if (!awayTeam) {
    awayTeam = teamsList.find(t => String(t.id) !== String(myTeamId)) || { name: 'TBD', logo: '' };
  }

  const getLogoHtml = (team) => {
    if (team && team.logo) {
      return `<img src="${team.logo}" style="width: 20px; height: 20px; object-fit: contain;" alt="Logo">`;
    }
    const initials = team && team.name ? team.name.substring(0, 2).toUpperCase() : '??';
    return `<div style="width: 20px; height: 20px; background: var(--bg3); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.55rem; font-weight: bold; color: var(--text);">${initials}</div>`;
  };

  return `
    <div onclick="
      const btnClassifica = document.querySelector('button[onclick*=\\'classifica\\']');
      window.goPage('classifica', btnClassifica);
    " 
         style="display: flex; flex-direction: column; gap: 0.4rem; width: 100%; cursor: pointer; transition: transform 0.1s ease;"
         onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'"
         title="Clicca per visualizzare il tabellone completo">
      
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div style="font-size: 0.68rem; font-weight: 600; color: var(--text2); text-transform: uppercase;"><i class="ri-git-branch-line"></i> Mini Tabellone</div>
        <div style="font-size: 0.65rem; color: var(--accent); display: flex; align-items: center; gap: 2px;">Vedi intero <i class="ri-arrow-right-s-line"></i></div>
      </div>

      <!-- DISEGNO MINI TABELLONE A LOGHI -->
      <div style="display: flex; align-items: center; justify-content: space-around; background: rgba(0,0,0,0.25); border: 1px dashed rgba(255,255,255,0.1); border-radius: 6px; padding: 0.5rem; position: relative;">
        
        <!-- Colonna Sinistra (es. Semifinale / Quarti) -->
        <div style="display: flex; flex-direction: column; gap: 0.4rem;">
          <div style="display: flex; align-items: center; gap: 4px; background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05);">
            ${getLogoHtml(homeTeam)}
            <div style="width: 12px; height: 1px; background: var(--text3);"></div>
          </div>
          <div style="display: flex; align-items: center; gap: 4px; background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05);">
            ${getLogoHtml(awayTeam)}
            <div style="width: 12px; height: 1px; background: var(--text3);"></div>
          </div>
        </div>

        <!-- Connessione Grafica Centrale (Simil Albero del Tabellone) -->
        <div style="display: flex; align-items: center;">
          <div style="width: 8px; height: 16px; border-top: 1px solid var(--accent); border-right: 1px solid var(--accent); border-bottom: 1px solid var(--accent);"></div>
          <div style="width: 10px; height: 1px; background: var(--accent);"></div>
        </div>

        <!-- Box Finale / Vincitore -->
        <div style="display: flex; align-items: center; justify-content: center; background: color-mix(in srgb, var(--accent) 15%, transparent); border: 1px solid var(--accent); border-radius: 6px; padding: 0.3rem 0.5rem;">
          <i class="ri-trophy-fill" style="color: var(--gold); font-size: 0.9rem;" title="Finale"></i>
        </div>

      </div>
    </div>
  `;
}
