export const CompetizioniSection = {
  renderHTML() {
    return `
    <div id="sec-crea-competizioni" class="admin-sec" style="display:none">
      <div class="sec-title">🏆 Gestione & Creazione Competizioni</div>
      
      <div class="card" style="max-width:600px">
        <div class="label" style="margin-bottom:.5rem">Crea Nuova Competizione</div>
        
        <input type="text" id="compId" class="input-login" placeholder="ID Univoco (es: championz-2026)">
        <input type="text" id="compName" class="input-login" placeholder="Nome Visibile (es: Champions League)">
        
        <label class="label">Tipologia Torneo</label>
        <select id="compType" class="input-login" onchange="window.toggleCompFields(this.value)">
          <option value="campionato">Campionato classico (Girone all'italiana)</option>
          <option value="eliminazione">Eliminazione Diretta (Coppa)</option>
          <option value="misto">Misto (Campionato + Fase Finale a Eliminazione)</option>
        </select>

        <div id="fieldGironi" style="display:block;">
          <label class="label">Numero di Gironi (Andata/Ritorno o ripetizioni)</label>
          <input type="number" id="compGironi" class="input-login" value="2" min="1">
        </div>

        <div id="fieldQualificati" style="display:none;">
          <label class="label">Squadre Qualificate alla Fase Finale (es: prime 4 della classifica)</label>
          <input type="number" id="compQualificati" class="input-login" value="4" min="2">
        </div>

        <button class="btn btn-green" onclick="window.creaCompetizione()">⚡ Crea & Inizializza Competizione</button>
      </div>

      <div class="card">
        <div class="label">Competizioni Attive nel Database</div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr><th>ID</th><th>Nome</th><th>Tipo</th><th>Dettagli Configurazione</th></tr>
            </thead>
            <tbody id="compTableBody"></tbody>
          </table>
        </div>
      </div>
    </div>`;
  },

  render({ competitions }) {
    const tbody = document.getElementById('compTableBody');
    if (!tbody) return;

    const list = competitions || [];
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text3)">Nessuna competizione configurata nel database. Creane una qui sopra.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map(c => {
      let dettagli = '—';
      if (c.type === 'campionato') dettagli = `${c.gironi} Giri di calendario`;
      if (c.type === 'misto') dettagli = `${c.gironi} Giri Classifica + Primi ${c.qualificatiFaseFinale} ai Playoff`;
      if (c.type === 'eliminazione') dettagli = `Tabellone scontro diretto`;
      return `
        <tr>
          <td><code style="color:var(--accent)">${c.id}</code></td>
          <td><strong>${c.name}</strong></td>
          <td><span class="badge badge-blue">${c.type}</span></td>
          <td>${dettagli}</td>
        </tr>
      `;
    }).join('');
  }
};
