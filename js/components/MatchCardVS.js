export const createMatchCardVS = (match, teamsList = []) => {
  if (!match) {
    return `
      <div class="card card-sm" style="background:var(--bg2); border:1px solid rgba(255,255,255,0.08); text-align:center; color:var(--text3); padding:1rem; font-size:.85rem;">
        Nessun match programmato.
      </div>
    `;
  }

  const tHome = teamsList.find(t => t && t.id === match.homeId) || { name: match.homeId || 'Casa' };
  const tAway = teamsList.find(t => t && t.id === match.awayId) || { name: match.awayId || 'Ospite' };

  const getLogoHtml = (team, size = 42) => {
    if (!team || !team.logo) {
      return `<i class="ri-shield-fill" style="font-size:${size}px; color:var(--text2); display:flex; align-items:center; justify-content:center; flex-shrink:0;"></i>`;
    }
    return `<img src="${team.logo}" style="width:${size}px; height:${size}px; object-fit:contain; border-radius:6px; flex-shrink:0;" onerror="this.outerHTML='<i class=\\'ri-shield-fill\\' style=\\'font-size:${size}px; color:var(--text2); display:flex; align-items:center; justify-content:center; flex-shrink:0;\\'></i>';" alt="Logo">`;
  };

  return `
    <div class="card card-sm match-card-vs" style="background:var(--bg2); border:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:space-between; gap:0.75rem; padding:1.15rem 1.25rem;">
      
      <!-- Squadra Casa -->
      <div style="display:flex; align-items:center; gap:0.75rem; min-width:0; flex:1; justify-content:flex-end; overflow:hidden;">
        <span style="font-size:0.95rem; font-weight:700; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; flex-shrink:1;">${tHome.name}</span>
        ${getLogoHtml(tHome, 42)}
      </div>

      <!-- Centro: VS -->
      <div style="font-family:'Bebas Neue',sans-serif; font-size:1.4rem; color:var(--accent); letter-spacing:1px; flex-shrink:0; padding: 0 0.4rem;">VS</div>

      <!-- Squadra Ospite -->
      <div style="display:flex; align-items:center; gap:0.75rem; min-width:0; flex:1; justify-content:flex-start; overflow:hidden;">
        ${getLogoHtml(tAway, 42)}
        <span style="font-size:0.95rem; font-weight:700; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; flex-shrink:1;">${tAway.name}</span>
      </div>

    </div>
  `;
};
