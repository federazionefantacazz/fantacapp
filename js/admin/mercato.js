export const MercatoSection = {
  renderHTML() {
    return `
    <div id="sec-mercato" class="admin-sec" style="display:none">
      <div class="sec-title">Assegnazione Calciatori & Mercato</div>
      <div class="card" style="max-width:600px;">
        <div class="label" style="margin-bottom:.5rem">Assegna un Calciatore Svincolato a una Squadra</div>
        <div style="display:flex; gap:1rem; margin-bottom:1rem;">
          <div style="flex:1;">
            <label class="label">Seleziona Giocatore</label>
            <select id="mPlayerSelect" style="width:100%; background:var(--bg3); border:1px solid var(--border); border-radius:6px; color:#fff; padding:.65rem; font-size:.9rem;"></select>
          </div>
          <div style="flex:1;">
            <label class="label">Seleziona Squadra Destinataria</label>
            <select id="mTeamSelect" style="width:100%; background:var(--bg3); border:1px solid var(--border); border-radius:6px; color:#fff; padding:.65rem; font-size:.9rem;"></select>
          </div>
        </div>
        <button class="btn btn-green" onclick="window.assignPlayerToTeam()">Conferma Assegnazione</button>
      </div>

      <div class="card">
        <div class="label">Storico Assegnazioni & Calciatori per Squadra</div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr><th>Giocatore</th><th>Ruolo</th><th>Club</th><th>Squadra Fanta</th><th>Azioni</th></tr>
            </thead>
            <tbody id="mercatoTableBody"></tbody>
          </table>
        </div>
      </div>
    </div>`;
  },

  render({ PLAYERS, TEAMS }) {
    this._populateSelects(PLAYERS, TEAMS);
    this._renderTable(PLAYERS, TEAMS);
  },

  _populateSelects(PLAYERS, TEAMS) {
    const pSelect = document.getElementById('mPlayerSelect');
    const tSelect = document.getElementById('mTeamSelect');
    if (!pSelect || !tSelect) return;

    const svincolati = PLAYERS.filter(p => !p.teamId && p.name).sort((a, b) => a.name.localeCompare(b.name));
    pSelect.innerHTML = svincolati.map(p =>
      `<option value="${p.id}">${p.name} (${p.role} - ${p.club || 'Svincolato'})</option>`
    ).join('');
    tSelect.innerHTML = TEAMS.map(t =>
      `<option value="${t.id}">${t.emoji || '⚽'} ${t.name}</option>`
    ).join('');
  },

  _renderTable(PLAYERS, TEAMS) {
    const tbody = document.getElementById('mercatoTableBody');
    if (!tbody) return;

    const sorted = [...PLAYERS].filter(p => p.name).sort((a, b) => a.name.localeCompare(b.name));
    tbody.innerHTML = sorted.map(p => {
      const fantaTeam = TEAMS.find(t => t.id === p.teamId);
      const teamBadge = fantaTeam
        ? `<span class="badge badge-blue">${fantaTeam.emoji || '⚽'} ${fantaTeam.name}</span>`
        : `<span class="badge badge-gray">❌ Svincolato</span>`;
      return `
        <tr>
          <td><strong>${p.name}</strong></td>
          <td><span class="badge ${p.role === 'P' ? 'badge-gray' : p.role === 'D' ? 'badge-blue' : p.role === 'C' ? 'badge-green' : 'badge-red'}">${p.role}</span></td>
          <td>${p.club || 'Svincolato'}</td>
          <td>${teamBadge}</td>
          <td>
            ${p.teamId ? `<button class="btn btn-red" style="font-size:.7rem;padding:.25rem .5rem;width:auto;" onclick="window.releasePlayer('${p.id}')">Svincola</button>` : '—'}
          </td>
        </tr>
      `;
    }).join('');
  }
};
