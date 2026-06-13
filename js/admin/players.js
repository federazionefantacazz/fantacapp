export const PlayersSection = {
  _filter: '',

  renderHTML() {
    return `
    <div id="sec-players" class="admin-sec" style="display:none">
      <div class="sec-title">Database Calciatori</div>
      <div class="card">
        <div style="display:flex;gap:1rem;margin-bottom:1rem;align-items:center">
          <input type="text" id="pSearch" class="input-login" placeholder="Cerca calciatore per nome..." style="margin-bottom:0;max-width:300px" oninput="window.filterPlayersAdmin(this.value)">
          <div style="font-size:.85rem;color:var(--text2)" id="pFoundCount"></div>
        </div>
        <div class="table-wrapper" style="max-height:500px">
          <table>
            <thead>
              <tr><th>Nome</th><th>Ruolo</th><th>Club</th><th>Valore</th></tr>
            </thead>
            <tbody id="playersTableBody"></tbody>
          </table>
        </div>
      </div>
    </div>`;
  },

  render({ PLAYERS }) {
    const tbody = document.getElementById('playersTableBody');
    if (!tbody) return;

    const f = this._filter.toLowerCase();
    const filtered = PLAYERS.filter(p => p.name && p.name.toLowerCase().includes(f));

    const pFoundCount = document.getElementById('pFoundCount');
    if (pFoundCount) pFoundCount.textContent = `Trovati: ${filtered.length}`;

    const pCount = document.getElementById('pCount');
    if (pCount) pCount.textContent = PLAYERS.length;

    tbody.innerHTML = filtered.slice(0, 50).map(p => `
      <tr>
        <td><strong>${p.name}</strong></td>
        <td><span class="badge ${p.role === 'P' ? 'badge-gray' : p.role === 'D' ? 'badge-blue' : p.role === 'C' ? 'badge-green' : 'badge-red'}">${p.role}</span></td>
        <td>${p.club || 'Svincolato'}</td>
        <td><strong>${p.value || '—'}</strong></td>
      </tr>
    `).join('');
  },

  setFilter(val) {
    this._filter = val;
  }
};
