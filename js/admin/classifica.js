export const ClassificaSection = {
  renderHTML() {
    return `
    <div id="sec-classifica" class="admin-sec" style="display:none">
      <div class="sec-title">Modifica Manuale Classifica Punti</div>
      <div class="card">
        <div class="label" style="margin-bottom:.5rem">Gestione Punteggi Globali (Punti Totali, Vittorie, Pareggi, Sconfitte)</div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr><th>Squadra</th><th>Punti Totali</th><th>Punti Ultima GW</th><th>Vinte (W)</th><th>Nulle (D)</th><th>Perse (L)</th><th>Azioni</th></tr>
            </thead>
            <tbody id="rankAdminTableBody"></tbody>
          </table>
        </div>
      </div>
    </div>`;
  },

  render({ TEAMS }) {
    const tbody = document.getElementById('rankAdminTableBody');
    if (!tbody) return;
    tbody.innerHTML = TEAMS.map(t => `
      <tr>
        <td><strong>${t.emoji || '⚽'} ${t.name}</strong></td>
        <td><input type="number" step="0.5" id="rk-pts-${t.id}" class="input-login" style="width:70px;margin-bottom:0;padding:.3rem" value="${t.pts || 0}"></td>
        <td><input type="number" step="0.5" id="rk-lgw-${t.id}" class="input-login" style="width:70px;margin-bottom:0;padding:.3rem" value="${t.lastGW || 0}"></td>
        <td><input type="number" id="rk-w-${t.id}" class="input-login" style="width:55px;margin-bottom:0;padding:.3rem" value="${t.w || 0}"></td>
        <td><input type="number" id="rk-d-${t.id}" class="input-login" style="width:55px;margin-bottom:0;padding:.3rem" value="${t.d || 0}"></td>
        <td><input type="number" id="rk-l-${t.id}" class="input-login" style="width:55px;margin-bottom:0;padding:.3rem" value="${t.l || 0}"></td>
        <td><button class="btn btn-green" style="font-size:.75rem;padding:.3rem .6rem;width:auto" onclick="window.saveRankRow('${t.id}')">Salva</button></td>
      </tr>
    `).join('');
  }
};
