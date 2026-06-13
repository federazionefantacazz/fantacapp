export const VotesSection = {
  renderHTML() {
    return `
    <div id="sec-votes" class="admin-sec" style="display:none">
      <div class="sec-title">Voti Live Ricevuti <span id="gwBadge" class="badge badge-green">GW 1</span></div>
      <div class="card">
        <div class="label">Filtra per Ruolo o Cerca</div>
        <div class="vote-grid" id="votesGridContainer"></div>
      </div>
    </div>`;
  },

  render({ VOTES, PLAYERS, CURRENT_GW }) {
    const container = document.getElementById('votesGridContainer');
    if (!container) return;

    const gwBadge = document.getElementById('gwBadge');
    if (gwBadge) gwBadge.textContent = 'GW ' + CURRENT_GW;

    const gVotes = VOTES[`gw${CURRENT_GW}`] || {};
    const items = Object.entries(gVotes);

    if (items.length === 0) {
      container.innerHTML = '<div style="color:var(--text3);font-size:.85rem">Nessun voto caricato per questa GW.</div>';
      return;
    }

    container.innerHTML = items.map(([pId, v]) => {
      const p = PLAYERS.find(pl => pl.id === pId) || { name: pId };
      return `
        <div class="vote-item">
          <span style="font-weight:600;font-size:.85rem">${p.name}</span>
          <span class="score">${v}</span>
        </div>
      `;
    }).join('');
  }
};
