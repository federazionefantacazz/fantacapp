export const RosePage = {
  renderHTML() {
    return `
      <div class="page" id="page-rose">
        <div class="sec" style="margin-top:1.2rem">Rose Lega</div>
        <div class="card card-sm" style="margin-bottom: 1rem;">
          <div class="label" style="margin-bottom: .4rem;">Seleziona Squadra</div>
          <select id="roseTeamSelect" class="select-rose"></select>
        </div>
        <div id="roseContainer"></div>
      </div>
    `;
  },
  render(STATE, defaultId) {
    const select = document.getElementById('roseTeamSelect');
    if(!select) return;

    if(select.options.length === 0) {
      select.innerHTML = STATE.teams.map(t => `<option value="${t.id}">${t.emoji||'⚽'} ${t.name} - ${t.owner}</option>`).join('');
      select.value = defaultId;
      select.addEventListener('change', () => this.drawRosa(STATE));
    }
    this.drawRosa(STATE);
  },
  drawRosa(STATE) {
    const select = document.getElementById('roseTeamSelect');
    const container = document.getElementById('roseContainer');
    if(!select || !container) return;
    const tId = select.value; if(!tId) return;

    const roster = STATE.players.filter(p => p.teamId === tId);
    if(roster.length === 0) {
      container.innerHTML = `<div style="color:var(--text3);text-align:center;padding:2rem;font-size:.85rem">Rosa vuota.</div>`;
      return;
    }
    const roles = {'P':[], 'D':[], 'C':[], 'A':[]};
    roster.forEach(p => { if(roles[p.role]) roles[p.role].push(p); });

    let html = '';
    const names = {'P':'🧤 Portieri', 'D':'🛡️ Difensori', 'C':'🪄 Centrocampisti', 'A':'🏹 Attaccanti'};
    Object.keys(roles).forEach(rk => {
      if(roles[rk].length === 0) return;
      html += `<div class="label" style="margin: 1rem 0 .4rem;">${names[rk]} (${roles[rk].length})</div>`;
      html += roles[rk].sort((a,b)=>(b.price||0)-(a.price||0)).map(p => {
        const v = STATE.votes[p.id];
        const mvHtml = v ? `<span class="mv-badge ${v>=7?'mv-up':'mv-dn'}">${v.toFixed(1)}</span>` : '';
        return `
          <div class="pcard">
            <div class="rbadge r${p.role}" style="width:24px;height:24px;font-size:.6rem;border-radius:5px">${p.role}</div>
            <div class="pi"><div class="pn">${p.name}${mvHtml}</div><div class="pm">${p.club}</div></div>
            <div class="pr"><div class="price">${p.price||0}M</div><div class="pavg">Mv ${(p.avg||6).toFixed(1)}</div></div>
          </div>
        `;
      }).join('');
    });
    container.innerHTML = html;
  }
};