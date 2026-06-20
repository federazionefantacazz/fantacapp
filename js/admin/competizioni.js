import { ref, set, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

let database = null;

export const CompetizioniSection = {
  init(db) {
    database = db;
    this.registerGlobalActions();
  },

  renderHTML() {
    return `
    <div id="sec-crea-competizioni" class="admin-sec" style="display:none;">
      <div class="sec-title">🏆 Gestione & Nuova Competizione</div>
      
      <div class="card" style="max-width: 600px;">
        <div id="form-comp-title" class="label" style="color: var(--accent); margin-bottom: 1rem; font-size: .85rem;">Crea una nuova competizione</div>
        
        <label class="label">ID Competizione</label>
        <input type="text" id="compId" class="input-login" placeholder="ID univoco senza spazi (es: serie-a-2026)">

        <label class="label">Nome Competizione</label>
        <input type="text" id="compName" class="input-login" placeholder="Nome visibile">

        <label class="label">Tipo Competizione</label>
        <select id="compType" class="input-login" onchange="window.toggleCompFields(this.value)">
          <option value="campionato">Campionato Standard</option>
          <option value="misto">Fase a Gironi + Fase Finale</option>
          <option value="diretta">Scontri Diretti / Coppa</option>
        </select>

        <div id="fieldGironi" style="display:block;">
          <label class="label">Numero Gironi</label>
          <input type="number" id="compGironi" class="input-login" value="1" min="1">
        </div>

        <div id="fieldQualificati" style="display:none;">
          <label class="label">Squadre Qualificate per Girone</label>
          <input type="number" id="compQualificati" class="input-login" value="2" min="1">
        </div>

        <label class="label">Seleziona Squadre Partecipanti</label>
        <div id="compTeamsCheckboxList" style="max-height: 200px; overflow-y: auto; background: var(--bg3); padding: 10px; border-radius: 6px; border: 1px solid var(--border); margin-bottom: 1rem;">
          <div style="color: var(--text3);">Caricamento squadre...</div>
        </div>

        <div style="display: flex; gap: 1rem;">
          <button id="btn-submit-comp" class="btn btn-green" onclick="window.creaCompetizione()">✨ Crea Competizione</button>
          <button id="btn-cancel-edit-comp" class="btn btn-red" onclick="window.annullaModificaComp()" style="display: none; width: auto;">Annulla</button>
        </div>
      </div>

      <div class="card">
        <div class="label" style="color: var(--accent); margin-bottom: 1rem; font-size: .85rem;">Competizioni Esistenti</div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>Squadre</th>
                <th style="text-align: right;">Azioni</th>
              </tr>
            </thead>
            <tbody id="admin-competitions-list">
              <tr><td colspan="4" style="text-align: center;">Caricamento...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
  },

  // Popola la lista delle checkbox accettando l'array delle squadre e i check correnti
  populateTeamsList(allTeams = [], selectedIds = []) {
    const container = document.getElementById('compTeamsCheckboxList');
    if (!container) return;

    if (!allTeams || allTeams.length === 0) {
      container.innerHTML = "<div style='color:var(--text3)'>Nessuna squadra disponibile nel DB.</div>";
      return;
    }

    container.innerHTML = allTeams.map(t => `
      <label style="display:flex; align-items:center; gap: 8px; margin-bottom: 5px; cursor: pointer; font-size: 0.85rem;">
        <input type="checkbox" name="teamSelect" value="${t.id}" ${selectedIds.includes(t.id) ? 'checked' : ''}>
        ${t.name}
      </label>
    `).join('');
  },

  render(state) {
    const listContainer = document.getElementById('admin-competitions-list');
    if (!listContainer) return;

    // Recupera le squadre dallo stato, o usa window.TEAMS come fallback secondario
    const allTeams = state.teams || window.TEAMS || [];
    
    // Controlla se siamo in modalità modifica guardando lo stato del pulsante "Annulla"
    const isEditing = document.getElementById('btn-cancel-edit-comp')?.style.display === "inline-flex";
    
    if (!isEditing) {
      // Se non siamo in modifica, svuota o resetta i check
      this.populateTeamsList(allTeams, []);
    } else {
      // Se siamo in modifica, recupera i check attuali salvandoli al volo prima del re-render
      const checkedBoxes = Array.from(document.querySelectorAll('input[name="teamSelect"]:checked')).map(cb => cb.value);
      this.populateTeamsList(allTeams, checkedBoxes);
    }

    const comps = state.competitions || [];
    listContainer.innerHTML = comps.map(c => `
      <tr>
        <td style="font-family: monospace; font-size: .8rem;">${c.id}</td>
        <td style="font-weight: 500;">${c.name}</td>
        <td>${c.teams ? c.teams.length : 0}</td>
        <td style="text-align: right;">
          <button class="btn btn-blue" style="padding: .3rem .6rem; width: auto;" 
            onclick="window.caricaCompetizioneNelForm('${c.id}', '${c.name.replace(/'/g, "\\'")}', '${c.type}', ${c.gironi || 1}, ${c.qualificatiFaseFinale || 0}, '${(c.teams || []).join(',')}')">
            ✏️
          </button>
        </td>
      </tr>
    `).join('');
  },

  registerGlobalActions() {
    window.toggleCompFields = (type) => {
      document.getElementById('fieldGironi').style.display = (type === 'campionato' || type === 'misto') ? 'block' : 'none';
      document.getElementById('fieldQualificati').style.display = (type === 'misto') ? 'block' : 'none';
    };

    window.caricaCompetizioneNelForm = (id, name, type, gironi, qualificati, teamsString) => {
      document.getElementById('compId').value = id;
      document.getElementById('compId').disabled = true;
      document.getElementById('compName').value = name;
      document.getElementById('compType').value = type;
      document.getElementById('compGironi').value = gironi;
      document.getElementById('compQualificati').value = qualificati;
      
      const selectedIds = teamsString ? teamsString.split(',') : [];
      const allTeams = window.TEAMS || []; // Usa le squadre globali per il caricamento istantaneo nel form
      this.populateTeamsList(allTeams, selectedIds);
      
      window.toggleCompFields(type);
      document.getElementById('btn-submit-comp').innerText = "💾 Salva Modifiche";
      document.getElementById('btn-cancel-edit-comp').style.display = "inline-flex";
    };

    window.annullaModificaComp = () => {
      document.getElementById('compId').disabled = false;
      document.getElementById('compId').value = '';
      document.getElementById('compName').value = '';
      
      const allTeams = window.TEAMS || [];
      this.populateTeamsList(allTeams, []);
      
      document.getElementById('btn-submit-comp').innerText = "✨ Crea Competizione";
      document.getElementById('btn-cancel-edit-comp').style.display = "none";
    };

    window.creaCompetizione = async () => {
      const id = document.getElementById('compId').value.trim().toLowerCase().replace(/\s+/g, '-');
      const name = document.getElementById('compName').value.trim();
      const checkboxes = document.querySelectorAll('input[name="teamSelect"]:checked');
      const teams = Array.from(checkboxes).map(cb => cb.value);

      if (!id || !name) return window.toast("ID e Nome obbligatori", "err");
      if (teams.length === 0) return window.toast("Seleziona almeno una squadra!", "err");

      const payload = {
        id, name, type: document.getElementById('compType').value,
        gironi: parseInt(document.getElementById('compGironi').value),
        qualificatiFaseFinale: parseInt(document.getElementById('compQualificati').value),
        teams: teams
      };

      try {
        await update(ref(database, `competitions/${id}`), payload);
        window.toast("Competizione salvata!", "ok");
        window.annullaModificaComp();
      } catch (e) { window.toast("Errore salvataggio", "err"); }
    };
  }
};