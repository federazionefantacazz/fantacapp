import { ref, update, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
// IMPORTA IL SERVIZIO CENTRALIZZATO PER L'UPLOAD (Verifica che il percorso relativo sia corretto)
import { uploadImageToImgBB } from "../services/integrationImgBB.js"; 

let database = null;

export const CompetizioniSection = {
  currentLogoUrl: '',  // Tiene in memoria il vecchio logo se non viene cambiato in modifica

  init(db) {
    database = db;
    this.registerGlobalActions();
  },

  // 1. INTERFACCIA GRAFICA DEL FORM
  renderHTML() {
    return `
    <div id="sec-crea-competizioni" class="admin-sec" style="display:none;">
      <div class="sec-title">🏆 Gestione & Nuova Competizione</div>
      
      <div class="card" style="max-width: 600px;">
        <div id="form-comp-title" class="label" style="color: var(--accent); margin-bottom: 1rem; font-size: .85rem;">Crea una nuova competizione</div>
        
        <label class="label">ID Competizione (Inmodificabile in fase di modifica)</label>
        <input type="text" id="compId" class="input-login" placeholder="ID univoco senza spazi (es: serie-a-2026)">

        <label class="label">Nome Competizione (es: Serie A Tim)</label>
        <input type="text" id="compName" class="input-login" placeholder="Nome visibile">

        <div class="label" style="font-size:.8rem; margin-top:.5rem; color:var(--text2)">Logo Competizione (Seleziona da Android)</div>
        <input type="file" id="compLogoFile" name="compLogoFile" class="input-login" accept="image/png, image/jpeg, image/jpg" style="padding-top:.5rem;">

        <label class="label">Tipo Competizione</label>
        <select id="compType" class="input-login" onchange="window.toggleCompFields(this.value)">
          <option value="campionato">Campionato Standard (Girone Unico)</option>
          <option value="misto">Fase a Gironi + Fase Finale</option>
          <option value="misto-speciale">Misto Speciale (12 Sq. - 11 GW + Playoff/Quarti)</option>
          <option value="diretta">Scontri Direct / Coppa</option>
        </select>

        <div id="fieldGironi" style="display:block;">
          <label class="label">Numero Gironi</label>
          <input type="number" id="compGironi" class="input-login" value="1" min="1">
        </div>

        <div id="fieldQualificati" style="display:none;">
          <label class="label">Squadre Qualificate per Girone alla Fase Finale</label>
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
        <div class="label" style="color: var(--accent); margin-bottom: 1rem; font-size: .85rem;">Competizioni Esistenti nell'App</div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Logo</th>
                <th>ID</th>
                <th>Nome</th>
                <th>Tipo</th>
                <th>GW Attuale</th>
                <th>Mercato</th>
                <th>Squadre</th>
                <th style="text-align: right;">Azioni</th>
              </tr>
            </thead>
            <tbody id="admin-competitions-list">
              <tr><td colspan="8" style="text-align: center;">Caricamento competizioni...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
  },

  populateTeamsList(allTeams = [], selectedIds = []) {
    const container = document.getElementById('compTeamsCheckboxList');
    if (!container) return;

    if (!allTeams || allTeams.length === 0) {
      container.innerHTML = "<div style='color:var(--text3)'>Nessuna squadra disponibile nel DB.</div>";
      return;
    }

    container.innerHTML = allTeams.map(t => {
      const teamId = t.id ? String(t.id) : '';
      const isChecked = selectedIds.includes(teamId) ? 'checked' : '';
      return `
        <label style="display:flex; align-items:center; gap: 8px; margin-bottom: 5px; cursor: pointer; font-size: 0.85rem;">
          <input type="checkbox" name="teamSelect" value="${teamId}" ${isChecked}>
          ${t.name || teamId}
        </label>
      `;
    }).join('');
  },

  // 2. RENDERING DELLA TABELLA CON LOGO
  render(state) {
    const listContainer = document.getElementById('admin-competitions-list');
    if (!listContainer) return;

    const allTeams = state.TEAMS || window.TEAMS || [];
    const isEditing = document.getElementById('btn-cancel-edit-comp')?.style.display === "inline-flex";
    
    if (!isEditing) {
      this.populateTeamsList(allTeams, []);
    }

    const comps = state.competitions || [];
    if (comps.length === 0) {
      listContainer.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text3);">Nessuna competizione creata. Usa il modulo sopra per crearne una.</td></tr>`;
      return;
    }

    listContainer.innerHTML = comps.map(c => {
      const currentGW = (c.status && c.status.currentGW) ? c.status.currentGW : 1;
      const marketOpen = c.marketOpen !== false;
      const safeName = c.name.replace(/'/g, "\\'");
      const gironi = c.gironi || 1;
      const qualificati = c.qualificatiFaseFinale || 0;
      const safeLogo = c.logo ? c.logo.replace(/'/g, "\\'") : '';

      let teamsArray = [];
      if (c.teams) {
        teamsArray = Array.isArray(c.teams) ? c.teams : Object.values(c.teams);
      }
      teamsArray = teamsArray.filter(t => t !== null && t !== undefined);
      const teamsString = teamsArray.join(',');

      const logoHtml = c.logo 
        ? `<img src="${c.logo}" alt="Logo" style="width:40px; height:40px; object-fit:contain; border-radius:6px; vertical-align:middle;">`
        : `<div style="width:40px; height:40px; background:var(--bg3); display:flex; align-items:center; justify-content:center; border-radius:6px; font-size:1.2rem; color:var(--text3); vertical-align:middle;">🏆</div>`;

      return `
        <tr>
          <td style="width:50px; text-align:center; vertical-align:middle;">${logoHtml}</td>
          <td style="font-family: 'DM Mono', monospace; font-size: .8rem; color: var(--accent2); vertical-align:middle;">${c.id}</td>
          <td style="font-weight: 500; vertical-align:middle;">${c.name}</td>
          <td style="text-transform: capitalize; font-size: .8rem; vertical-align:middle;">${c.type}</td>
          <td style="vertical-align:middle;">
            <div style="display: flex; align-items: center; gap: .5rem;">
              <input type="number" value="${currentGW}" id="gw-input-${c.id}" style="width: 50px; background: var(--bg); border: 1px solid var(--border); color: #fff; padding: .2rem .4rem; border-radius: 4px; text-align: center;">
              <button class="btn btn-blue" onclick="window.updateCompGW('${c.id}')" style="padding: .25rem .5rem; font-size: .75rem; width: auto;">Salva</button>
            </div>
          </td>
          <td style="vertical-align:middle;">
            <button class="btn ${marketOpen ? 'btn-green' : 'btn-red'}" onclick="window.toggleCompMarket('${c.id}', ${marketOpen})" style="padding: .25rem .5rem; font-size: .75rem; width: auto; font-weight:500;">
              ${marketOpen ? '🟢 Aperto' : '🔴 Chiuso'}
            </button>
          </td>
          <td style="vertical-align:middle;"><span class="badge ${teamsArray.length > 0 ? 'badge-green' : 'badge-red'}">${teamsArray.length} sq.</span></td>
          <td style="text-align: right; vertical-align:middle;">
            <div style="display: inline-flex; gap: .4rem;">
              <button class="btn btn-blue" onclick="window.caricaCompetizioneNelForm('${c.id}', '${safeName}', '${c.type}', ${gironi}, ${qualificati}, '${teamsString}', '${safeLogo}')" style="padding: .35rem .6rem; font-size: .75rem; width: auto;">
                ✏️ Modifica
              </button>
              <button class="btn btn-red" onclick="window.eliminaCompetizione('${c.id}', '${safeName}')" style="padding: .35rem .6rem; font-size: .75rem; width: auto;">
                🗑️ Elimina
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  registerGlobalActions() {
    window.toggleCompFields = (type) => {
      const fg = document.getElementById('fieldGironi');
      const fq = document.getElementById('fieldQualificati');
      if (!fg || !fq) return;
      
      fg.style.display = (type === 'campionato' || type === 'misto') ? 'block' : 'none';
      fq.style.display = (type === 'misto') ? 'block' : 'none';
    };

    // 3. CARICA DATI NEL FORM (MODIFICA) - Clone dell'input per Android WebView
    window.caricaCompetizioneNelForm = (id, name, type, gironi, qualificati, teamsString, logo) => {
      const idInput = document.getElementById('compId');
      if (!idInput) return;

      idInput.value = id;
      idInput.readOnly = true;
      idInput.style.opacity = "0.6";
      idInput.style.pointerEvents = "none";

      document.getElementById('compName').value = name;
      document.getElementById('compType').value = type;
      if (document.getElementById('compGironi')) document.getElementById('compGironi').value = gironi;
      if (document.getElementById('compQualificati')) document.getElementById('compQualificati').value = qualificati;

      // SOLUZIONE BUG 403 ANDROID: Rigeneriamo l'elemento DOM dell'input per pulire la sandbox del browser
      const oldInput = document.getElementById('compLogoFile');
      if (oldInput) {
        const newInput = oldInput.cloneNode(true);
        newInput.value = ''; 
        oldInput.parentNode.replaceChild(newInput, oldInput);
      }

      CompetizioniSection.currentLogoUrl = (logo === 'undefined' || !logo) ? '' : logo;

      const selectedIds = teamsString ? teamsString.split(',').map(x => String(x.trim())) : [];
      const allTeams = window.TEAMS || []; 
      CompetizioniSection.populateTeamsList(allTeams, selectedIds);

      window.toggleCompFields(type);

      document.getElementById('form-comp-title').innerText = `Modifica della Competizione: ${id.toUpperCase()}`;
      const btnSubmit = document.getElementById('btn-submit-comp');
      btnSubmit.innerText = "💾 Salva Modifiche";
      btnSubmit.className = "btn btn-blue";
      document.getElementById('btn-cancel-edit-comp').style.display = "inline-flex";

      document.getElementById('sec-crea-competizioni').scrollIntoView({ behavior: 'smooth' });
    };

    // 4. ANNULLA MODIFICA
    window.annullaModificaComp = () => {
      const idInput = document.getElementById('compId');
      if (idInput) {
        idInput.readOnly = false;
        idInput.style.opacity = "1";
        idInput.style.pointerEvents = "auto";
        idInput.value = '';
      }

      if (document.getElementById('compName')) document.getElementById('compName').value = '';
      
      // SOLUZIONE BUG 403 ANDROID: Rigeneriamo l'input anche in fase di reset
      const oldInput = document.getElementById('compLogoFile');
      if (oldInput) {
        const newInput = oldInput.cloneNode(true);
        newInput.value = '';
        oldInput.parentNode.replaceChild(newInput, oldInput);
      }

      if (document.getElementById('compType')) document.getElementById('compType').value = 'campionato';
      if (document.getElementById('compGironi')) document.getElementById('compGironi').value = '1';
      if (document.getElementById('compQualificati')) document.getElementById('compQualificati').value = '2';
      
      CompetizioniSection.currentLogoUrl = '';

      const allTeams = window.TEAMS || [];
      CompetizioniSection.populateTeamsList(allTeams, []);
      window.toggleCompFields('campionato');

      document.getElementById('form-comp-title').innerText = "Crea una nuova competizione";
      const btnSubmit = document.getElementById('btn-submit-comp');
      btnSubmit.innerText = "✨ Crea Competizione";
      btnSubmit.className = "btn btn-green";
      document.getElementById('btn-cancel-edit-comp').style.display = "none";
    };

    // 5. CREAZIONE / AGGIORNAMENTO SU FIREBASE
    window.creaCompetizione = async () => {
      if (!database) return console.error("Database non inizializzato");

      const idInput = document.getElementById('compId');
      const nameInput = document.getElementById('compName');
      
      // Recuperiamo l'input file fresco dal DOM (potrebbe essere stato clonato)
      const fileInput = document.getElementById('compLogoFile');
      if (!idInput || !nameInput) return;

      const isEditingMode = idInput.readOnly;
      const id = idInput.value.trim().toLowerCase().replace(/\s+/g, '-');
      const name = nameInput.value.trim();
      const type = document.getElementById('compType').value;

      const checkboxes = document.querySelectorAll('input[name="teamSelect"]:checked');
      const teams = Array.from(checkboxes).map(cb => cb.value).filter(val => val !== '');

      if (!id || !name) return window.toast("ID e Nome Competizione sono obbligatori!", "err");
      if (teams.length === 0) return window.toast("Seleziona almeno una squadra!", "err");

      const btnSubmit = document.getElementById('btn-submit-comp');
      const originalBtnText = btnSubmit.innerText;
      btnSubmit.innerText = "⌛ Caricamento Immagine...";
      btnSubmit.disabled = true;

      try {
        let finalLogoUrl = isEditingMode ? CompetizioniSection.currentLogoUrl : '';

        // Lettura protetta dell'input file per sistemi Android
        if (fileInput && fileInput.files && fileInput.files.length > 0) {
          const file = fileInput.files[0];
          if (file && file.size > 0) {
            finalLogoUrl = await uploadImageToImgBB(file);
          }
        }

        // Configurazione del payload con voce 'logo' definita esplicitamente
        let compPayload = { 
          id, 
          name, 
          type,
          logo: finalLogoUrl || "", 
          teams: teams
        };

        if (!isEditingMode) {
          compPayload.status = { currentGW: 1 };
          compPayload.marketOpen = true;
        }

        if (type === 'misto-speciale') {
          compPayload.regolamento = {
            fase1: { tipo: "campionato", giornate: 11, squadre: 12 },
            qualificatiDirettiQuarti: 6,
            playoff: {
              posizioni: [7, 8, 9, 10],
              accoppiamenti: [
                { nome: "Playoff 1", casa: "pos_7", trasferta: "pos_10" },
                { nome: "Playoff 2", casa: "pos_8", trasferta: "pos_9" }
              ]
            },
            quartiTabellone: [
              { match: "Q1", casa: "pos_1", trasferta: "vincitore_playoff_2" },
              { match: "Q2", casa: "pos_2", trasferta: "vincitore_playoff_1" },
              { match: "Q3", casa: "pos_3", trasferta: "pos_6" },
              { match: "Q4", casa: "pos_4", trasferta: "pos_5" }
            ],
            eliminate: [11, 12]
          };
        } else {
          const gironi = parseInt(document.getElementById('compGironi').value) || 1;
          const qualificati = parseInt(document.getElementById('compQualificati').value) || 0;
          if (type === 'campionato' || type === 'misto') compPayload.gironi = gironi;
          if (type === 'misto') compPayload.qualificatiFaseFinale = qualificati;
        }

        await update(ref(database, `competitions/${id}`), compPayload);
        window.toast(`Competizione salvata/aggiornata con successo!`, "ok");
        window.annullaModificaComp();
      } catch (err) { 
        console.error("Errore scrittura Firebase:", err);
        window.toast(err.message || "Errore durante il salvataggio dei dati", "err"); 
      } finally {
        btnSubmit.innerText = originalBtnText;
        btnSubmit.disabled = false;
      }
    };

    window.updateCompGW = async function(compId) {
      if (!database) return;
      const gwVal = parseInt(document.getElementById(`gw-input-${compId}`).value) || 1;
      try {
        await update(ref(database, `competitions/${compId}/status`), { currentGW: gwVal });
        window.toast(`GW salvata a ${gwVal} per ${compId.toUpperCase()}`, "ok");
      } catch (err) {
        window.toast("Errore durante il salvataggio della GW", "err");
      }
    };

    window.toggleCompMarket = async function(compId, currentlyOpen) {
      if (!database) return;
      try {
        await update(ref(database, `competitions/${compId}`), { marketOpen: !currentlyOpen });
        window.toast(`Mercato della competizione aggiornato!`, "ok");
      } catch (err) {
        window.toast("Errore durante la modifica del mercato", "err");
      }
    };

    window.eliminaCompetizione = async function(compId, compName) {
      if (!database) return;
      if (confirm(`⚠️ SEI SICURO?\nEliminando la competizione "${compName}" rimuoverai per sempre tutti i suoi calendari, risultati e classifiche.`)) {
        try {
          await remove(ref(database, `competitions/${compId}`));
          window.toast(`Competizione "${compName}" eliminata definitivamente`, "info");
          window.annullaModificaComp();
        } catch (err) {
          window.toast("Errore durante l'eliminazione", "err");
        }
      }
    };
  }
};
