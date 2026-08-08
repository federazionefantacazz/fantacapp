export const createMatchCardResult = (match, teamsList = []) => {
  if (!match) {
    return `
      <div class="card card-sm" style="background:var(--bg2); border:1px solid rgba(255,255,255,0.08); text-align:center; color:var(--text3); padding:1rem; font-size:.85rem;">
        Nessun risultato disponibile.
      </div>
    `;
  }

  const tHome = teamsList.find(t => t && t.id === match.homeId) || { name: match.homeId || 'Casa' };
  const tAway = teamsList.find(t => t && t.id === match.awayId) || { name: match.awayId || 'Ospite' };

  const getLogoHtml = (team, size = 36) => {
    if (!team || !team.logo) {
      return `<div style="width:${size}px; height:${size}px; background:var(--bg3); display:flex; align-items:center; justify-content:center; border-radius:6px; font-size:1.2rem; color:var(--text3); flex-shrink:0;"><i class="ri-shield-fill"></i></div>`;
    }
    return `<img src="${team.logo}" style="width:${size}px; height:${size}px; object-fit:contain; border-radius:6px; flex-shrink:0; background:var(--bg3);" onerror="this.outerHTML='<div style=\\'width:${size}px; height:${size}px; background:var(--bg3); display:flex; align-items:center; justify-content:center; border-radius:6px; font-size:1.2rem; color:var(--text3); flex-shrink:0;\\'><i class=\\'ri-shield-fill\\'></i></div>';" alt="Logo">`;
  };

  const textStyle = `
    font-size: clamp(0.7rem, 3.5vw, 0.9rem); 
    font-weight: 700; 
    color: var(--text); 
    line-height: 1.15; 
    display: -webkit-box; 
    -webkit-line-clamp: 2; 
    -webkit-box-orient: vertical; 
    overflow: hidden; 
    word-break: break-word;
  `;

  const isFinished = match.finished === true;
  const scoreHome = (isFinished || match.goalHome != null) ? match.goalHome : '-';
  const scoreAway = (isFinished || match.goalAway != null) ? match.goalAway : '-';
  
  const pointsHTML = isFinished && (match.punteggioFinaleHome != null || match.punteggioFinaleAway != null) 
    ? `<div style="font-size:.65rem; color:var(--text2); text-align:center; margin-top:.3rem; white-space:nowrap;">${match.punteggioFinaleHome ?? 0} - ${match.punteggioFinaleAway ?? 0} pt</div>` 
    : '';

  // Gestione etichetta girone/playoff
  const labelText = match.label || match.girone;
  const labelHTML = labelText ? `<div style="font-size:.65rem; color:var(--gold); font-weight:bold; text-transform:uppercase; margin-bottom:.5rem;">📍 ${labelText}</div>` : '';

  return `
    <div class="card card-sm match-card-result" style="background:var(--card); border:1px solid rgba(255,255,255,0.05); display:flex; flex-direction:column; padding:1rem;">
      ${labelHTML}
      <div style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem;">
        
        <!-- Squadra Casa -->
        <div style="display:flex; align-items:center; gap:0.6rem; min-width:0; flex:1; justify-content:flex-start;">
          ${getLogoHtml(tHome, 36)}
          <span style="${textStyle} text-align:left;">${tHome.name}</span>
        </div>

        <!-- Centro: Risultato e Punti -->
        <div style="flex-shrink:0; text-align:center; padding: 0 0.2rem;">
          <div style="font-family:'DM Mono',monospace; font-size:1.2rem; font-weight:700; background:var(--bg3); padding:.2rem .6rem; border-radius:6px; color:var(--accent); display:inline-block; letter-spacing:1px;">
            ${scoreHome}:${scoreAway}
          </div>
          ${pointsHTML}
        </div>

        <!-- Squadra Ospite -->
        <div style="display:flex; align-items:center; gap:0.6rem; min-width:0; flex:1; justify-content:flex-end;">
          <span style="${textStyle} text-align:right;">${tAway.name}</span>
          ${getLogoHtml(tAway, 36)}
        </div>

      </div>
    </div>
  `;
};
