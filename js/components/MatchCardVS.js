import { esc, sameId, fitName } from '../utils.js';

export const createMatchCardVS = (match, teamsList = []) => {
  if (!match) {
    return `
      <div class="card card-sm card-mini" data-th="empty" style="background:var(--mini-bg,var(--bg2)); border:1px solid var(--border); text-align:center; color:var(--text3);font-family:var(--font-text3,inherit); padding:1rem; font-size:.85rem;">
        Nessun match programmato.
      </div>
    `;
  }

  const tHome = teamsList.find(t => t && sameId(t.id, match.homeId)) || { name: match.homeId || 'Casa' };
  const tAway = teamsList.find(t => t && sameId(t.id, match.awayId)) || { name: match.awayId || 'Ospite' };

  // Loghi più grandi (36px)
  const getLogoHtml = (team, size = 36) => {
    if (!team || !team.logo) {
      return `<i class="ri-shield-fill" style="font-size:${size}px; color:var(--text2);font-family:var(--font-sub,inherit); display:flex; align-items:center; justify-content:center; flex-shrink:0;"></i>`;
    }
    return `<img src="${esc(team.logo)}" style="width:${size}px; height:${size}px; object-fit:contain; border-radius:6px; flex-shrink:0;" onerror="this.outerHTML='<i class=\\'ri-shield-fill\\' style=\\'font-size:${size}px; color:var(--text2);font-family:var(--font-sub,inherit); display:flex; align-items:center; justify-content:center; flex-shrink:0;\\'></i>';" alt="Logo">`;
  };

  // nome su 2 righe al massimo: si rimpicciolisce invece di spezzare le parole (fitName)
  const nameStyle = 'font-weight:700; color:var(--text);';


  return `
    <div class="card card-sm card-mini match-card-vs" style="background:var(--mini-bg,var(--bg2)); border:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; gap:0.5rem; padding:1rem 1.15rem;">
      
      <!-- Squadra Casa -->
      <div style="display:flex; align-items:center; gap:0.6rem; min-width:0; flex:1; justify-content:flex-end;">
        ${fitName(tHome.name, { maxSize: '.95rem', style: `${nameStyle} text-align:right;` })}
        ${getLogoHtml(tHome, 36)}
      </div>

      <!-- Centro: VS -->
      <div data-th="match-vs" style="font-family:'Bebas Neue',sans-serif; font-size:1.3rem; color:var(--accent); letter-spacing:1px; flex-shrink:0; padding: 0 0.4rem;">VS</div>

      <!-- Squadra Ospite -->
      <div style="display:flex; align-items:center; gap:0.6rem; min-width:0; flex:1; justify-content:flex-start;">
        ${getLogoHtml(tAway, 36)}
        ${fitName(tAway.name, { maxSize: '.95rem', style: `${nameStyle} text-align:left;` })}
      </div>

    </div>
  `;
};
