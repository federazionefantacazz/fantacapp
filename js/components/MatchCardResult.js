/**
 * Card risultato di un incontro.
 * opts.chip = { text, icon, color, live } -> etichetta di stato nell'intestazione della card
 *             (nel flusso, accanto all'etichetta girone: non si sovrappone mai al contenuto)
 * opts.matchNumber = numero progressivo, mostrato a sinistra come "Match N"
 * opts.label = testo che sostituisce l'etichetta girone/playoff
 */
export const createMatchCardResult = (match, teamsList = [], opts = {}) => {
  if (!match) {
    return `
      <div class="card card-sm card-mini" style="background:var(--mini-bg,var(--bg2)); border:1px solid var(--border); text-align:center; color:var(--text3); padding:1rem; font-size:.85rem;">
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

  // Intestazione: "Match N" (+ etichetta girone/playoff) a sinistra, stato a destra
  const labelText = opts.label || match.label || match.girone;
  const matchNumHTML = opts.matchNumber
    ? `<span style="font-size:.7rem; font-weight:700; color:var(--text2); letter-spacing:.4px; text-transform:uppercase; white-space:nowrap; flex-shrink:0;">Match ${opts.matchNumber}</span>`
    : '';
  const labelHTML = labelText
    ? `<span style="min-width:0; font-size:.65rem; color:var(--gold); font-weight:700; text-transform:uppercase; display:inline-flex; align-items:center; gap:0.2rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"><i class="ri-map-pin-line"></i><span style="overflow:hidden; text-overflow:ellipsis;">${labelText}</span></span>`
    : '';
  const leftHTML = `<div style="min-width:0; flex:1; display:flex; align-items:center; gap:.6rem; overflow:hidden;">${matchNumHTML}${labelHTML}</div>`;

  const chip = opts.chip;
  const chipHTML = chip
    ? `<span class="status-chip${chip.live ? ' live' : ''}" style="--chip-color:${chip.color || 'var(--text2)'};">${chip.live ? '<span class="dot"></span>' : `<i class="${chip.icon}"></i>`}${chip.text}</span>`
    : '';

  const headerHTML = (labelText || chip || opts.matchNumber)
    ? `<div style="display:flex; align-items:center; justify-content:space-between; gap:.5rem; margin-bottom:.6rem; min-height:20px;">${leftHTML}${chipHTML}</div>`
    : '';

  return `
    <div class="card card-sm card-mini match-card-result" style="background:var(--mini-bg,var(--card)); border:1px solid var(--border); display:flex; flex-direction:column; padding:1rem;">
      ${headerHTML}
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
