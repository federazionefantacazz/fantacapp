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

  // Loghi più grandi (36px)
  const getLogoHtml = (team, size = 36) => {
    if (!team || !team.logo) {
      return `<i class="ri-shield-fill" style="font-size:${size}px; color:var(--text2); display:flex; align-items:center; justify-content:center; flex-shrink:0;"></i>`;
    }
    return `<img src="${team.logo}" style="width:${size}px; height:${size}px; object-fit:contain; border-radius:6px; flex-shrink:0;" onerror="this.outerHTML='<i class=\\'ri-shield-fill\\' style=\\'font-size:${size}px; color:var(--text2); display:flex; align-items:center; justify-content:center; flex-shrink:0;\\'></i>';" alt="Logo">`;
  };

  /* 
   * CSS NATIVO PER SMARTPHONE:
   * - clamp(0.7rem, 3.5vw, 0.95rem): Il font scala fluidamente in base alla larghezza dello schermo.
   * - -webkit-line-clamp: 2: Permette al testo di andare su un massimo di 2 righe prima di bloccarsi.
   * - word-break: break-word: Spezza parole impossibili se non c'è spazio.
   */
  const textStyle = `
    font-size: clamp(0.7rem, 3.5vw, 0.95rem); 
    font-weight: 700; 
    color: var(--text); 
    line-height: 1.1; 
    display: -webkit-box; 
    -webkit-line-clamp: 2; 
    -webkit-box-orient: vertical; 
    overflow: hidden; 
    word-break: break-word;
  `;

  return `
    <div class="card card-sm match-card-vs" style="background:var(--bg2); border:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:space-between; gap:0.5rem; padding:1rem 1.15rem;">
      
      <!-- Squadra Casa -->
      <div style="display:flex; align-items:center; gap:0.6rem; min-width:0; flex:1; justify-content:flex-end;">
        <span style="${textStyle} text-align:right;">${tHome.name}</span>
        ${getLogoHtml(tHome, 36)}
      </div>

      <!-- Centro: VS -->
      <div style="font-family:'Bebas Neue',sans-serif; font-size:1.3rem; color:var(--accent); letter-spacing:1px; flex-shrink:0; padding: 0 0.4rem;">VS</div>

      <!-- Squadra Ospite -->
      <div style="display:flex; align-items:center; gap:0.6rem; min-width:0; flex:1; justify-content:flex-start;">
        ${getLogoHtml(tAway, 36)}
        <span style="${textStyle} text-align:left;">${tAway.name}</span>
      </div>

    </div>
  `;
};
