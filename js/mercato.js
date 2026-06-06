export const MercatoPage = {
  renderHTML() {
    return `
      <div class="page" id="page-mercato">
        <div class="sec" style="margin-top:1.2rem">Mercato Svincolati</div>
        <div class="card">
          <div class="label">Lista Calciatori Disponibili</div>
          <div id="lista-svincolati" style="max-height:500px;overflow-y:auto;margin-top:.5rem"></div>
        </div>
      </div>
    `;
  },
  render(STATE) {
    const container = document.getElementById('lista-svincolati');
    if(!container) return;
    const svincolati = STATE.players.filter(p => !p.teamId || p.teamId === "");
    if(svincolati.length === 0) {
      container.innerHTML = `<div style="color:var(--text3);text-align:center;padding:1rem;font-size:.85rem">Tutti i calciatori sono acquistati!</div>`;
      return;
    }
    container.innerHTML = svincolati.sort((a,b)=>a.name.localeCompare(b.name)).map(p => `
      <div class="pcard">
        <div class="rbadge r${p.role}">${p.role}</div>
        <div class="pi"><div class="pn">${p.name}</div><div class="pm">${p.club}</div></div>
        <div class="pr"><div class="price">${p.price||0}M</div><div class="pavg">Mv ${(p.avg||6).toFixed(1)}</div></div>
      </div>
    `).join('');
  }
};