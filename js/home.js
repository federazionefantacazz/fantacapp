export const HomePage = {
  renderHTML() {
    return `
      <div class="page" id="page-home">
        <div class="app-header">
          <div class="logo">FANTACAZZ</div>
          <div id="user-badge" style="font-size:.85rem;font-weight:600;color:var(--accent)"></div>
        </div>
        <div class="card" style="background:linear-gradient(135deg, var(--card), var(--bg3))">
          <div class="label">Giornata Attuale</div>
          <div id="home-gw" style="font-size:2rem;font-family:'Bebas Neue';color:#fff">-</div>
        </div>
        <div class="sec">🔴 Voti Live GW</div>
        <div id="live-votes" style="max-height:300px;overflow-y:auto"></div>
      </div>
    `;
  },
  render(STATE) {
    const badge = document.getElementById('user-badge');
    const gw = document.getElementById('home-gw');
    const lv = document.getElementById('live-votes');
    if(!badge) return;

    badge.textContent = `${STATE.user.emoji||'⚽'} ${STATE.user.name}`;
    gw.textContent = `GIORNATA ${STATE.status.currentGW || 1}`;

    const vArr = Object.entries(STATE.votes);
    if(vArr.length === 0) {
      lv.innerHTML = `<div style="color:var(--text3);font-size:.85rem;text-align:center;padding:1rem">Nessun voto live inserito.</div>`;
    } else {
      lv.innerHTML = vArr.map(([pid, val]) => {
        const p = STATE.players.find(x=>x.id===pid) || {name: pid, role:'C', club:''};
        return `
          <div class="pcard">
            <div class="rbadge r${p.role}">${p.role}</div>
            <div class="pi"><div class="pn">${p.name}</div><div class="pm">${p.club}</div></div>
            <div class="pr"><span class="mv-badge ${val>=7?'mv-up':'mv-dn'}">${val.toFixed(1)}</span></div>
          </div>
        `;
      }).join('');
    }
  }
};