import { fitText } from '../services/utilityService.js';

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

  const getLogoHtml = (team, size = 31) => {
    if (!team || !team.logo) {
      return `<i class="ri-shield-fill" style="font-size:${size}px; color:var(--text2); display:flex; align-items:center; justify-content:center; flex-shrink:0;"></i>`;
    }
    return `<img src="${team.logo}" style="width:${size}px; height:${size}px; object-fit:contain; border-radius:4px; flex-shrink:0;" onerror="this.outerHTML='<i class=\\'ri-shield-fill\\' style=\\'font-size:${size}px; color:var(--text2); display:flex; align-items:center; justify-content:center; flex-shrink:0;\\'></i>';" alt="Logo">`;
  };

  const homeNameId = `match-home-${Math.random().toString(36).substring(2, 9)}`;
  const awayNameId = `match-away-${Math.random().toString(36).substring(2, 9)}`;

  setTimeout(() => {
    fitText(document.getElementById(homeNameId), 0.85, 0.65);
    fitText(document.getElementById(awayNameId), 0.85, 0.65);
  }, 0);

  return `
    <div class="card card-sm match-card-vs" style="background:var(--bg2); border:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:space-between; gap:0.5rem; padding:0.85rem 1rem;">
      
      <!-- Squadra Casa -->
      <div style="display:flex; align-items:center; gap:0.5rem; min-width:0; flex:1; justify-content:flex-end; overflow:hidden;">
        <span id="${homeNameId}" style="font-size:0.85rem; font-weight:600; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${tHome.name}</span>
        ${getLogoHtml(tHome, 31)}
      </div>

      <!-- Centro: VS -->
      <div style="font-family:'Bebas Neue',sans-serif; font-size:1.2rem; color:var(--text2); letter-spacing:1px; flex-shrink:0; padding: 0 0.2rem;">VS</div>

      <!-- Squadra Ospite -->
      <div style="display:flex; align-items:center; gap:0.5rem; min-width:0; flex:1; justify-content:flex-start; overflow:hidden;">
        ${getLogoHtml(tAway, 31)}
        <span id="${awayNameId}" style="font-size:0.85rem; font-weight:600; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${tAway.name}</span>
      </div>

    </div>
  `;
};
