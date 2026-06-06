export const StatsPage = {
  renderHTML() {
    return `
      <div class="page" id="page-stats">
        <div class="sec" style="margin-top:1.2rem">Statistiche Lega</div>
        <div class="card">
          <div class="label">Migliori per Media Voto (Top 15)</div>
          <div id="stats-ranking" style="margin-top:.5rem"></div>
        </div>
      </div>
    `;
  },
  render(STATE) {
    const container = document.getElementById('stats-ranking');
    if(!container) return;
    const sorted = [...STATE.players].sort((a,b) => (b.avg||0) - (a.avg||0)).slice(0, 15);
    container.innerHTML = sorted.map((p, idx) => `
      <div class="pcard">
        <div style="font-size:.8rem;font-weight:600;color:var(--text2);width:20px">${idx+1}</div>
        <div class="rbadge r${p.role}" style="width:22px;height:22px;font-size:.6rem;border-radius:4px">${p.role}</div>
        <div class="pi"><div class="pn">${p.name}</div><div class="pm">${p.club}</div></div>
        <div class="pr"><div class="price" style="color:var(--accent)">${(p.avg||6).toFixed(2)}</div></div>
      </div>
    `).join('');
  }
};