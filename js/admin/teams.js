export const TeamsSection = {
  renderHTML() {
    return `
    <div id="sec-teams" class="admin-sec" style="display:none">
      <div class="sec-title">Gestione Squadre</div>
      <div class="card" style="max-width:500px">
        <div class="label" style="margin-bottom:.5rem">Aggiungi Nuova Squadra</div>
        <input type="text" id="tId" class="input-login" placeholder="ID Univoco (es: fc-napoli)">
        <input type="text" id="tName" class="input-login" placeholder="Nome Fantasquadra">
        <input type="text" id="tOwner" class="input-login" placeholder="Nome Presidente">
        <input type="text" id="tEmoji" class="input-login" placeholder="Emoji (es: 🌋)" max="2">
        <button class="btn btn-green" onclick="window.addTeam()">Crea Squadra</button>
      </div>
      
      <div class="card">
        <div class="label">Squadre Registrate</div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr><th>Emoji</th><th>Nome</th><th>Presidente</th><th>Punti</th><th>Azioni</th></tr>
            </thead>
            <tbody id="teamsTableBody"></tbody>
          </table>
        </div>
      </div>
    </div>`;
  },

  render({ TEAMS }) {
    const tbody = document.getElementById('teamsTableBody');
    if (!tbody) return;
    tbody.innerHTML = TEAMS.map(t => `
      <tr>
        <td style="font-size:1.3rem">${t.emoji || '⚽'}</td>
        <td><strong>${t.name}</strong></td>
        <td>${t.owner || '—'}</td>
        <td><span class="badge badge-green">${t.pts || 0} pts</span></td>
        <td><button class="btn btn-red" style="padding:.25rem .5rem;font-size:.75rem;width:auto" onclick="window.deleteTeam('${t.id}')">Elimina</button></td>
      </tr>
    `).join('');
  }
};
