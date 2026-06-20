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
        
        <label class="label">ID Competizione (Inmodificabile in fase di modifica)</label>
        <input type="text" id="compId" class="input-login" placeholder="ID univoco senza spazi (es: serie-a-2026)">

        <label class="label">Nome Competizione (es: Serie A Tim)</label>
        <input type="text" id="compName" class="input-login" placeholder="Nome visibile">

        <label class="label">Tipo Competizione</label>
        <select id="compType" class="input-login" onchange="window.toggleCompFields(this.value)">
          <option value="campionato">Campionato Standard (Girone Unico)</option>
          <option value="misto">Fase a Gironi + Fase Finale</option>
          <option value="diretta">Scontri Diretti / Coppa</option>
        </select>

        <div id="fieldGironi" style="display:block;">
          <label class="label">Numero Gironi</label>
          <input type="number" id="compGironi" class="input-login" value="1" min="1">
        </div>

        <div id="fieldQualificati" style="display:none;">
          <label class="label">Squadre Qualificate per Girone alla Fase Finale</label>
          <input type="number" id="compQualificati" class="input-login" value="2" min="1">
        </div>
		
		<div id="fieldSquadre">
		 <label class="label">Numero Squadre</label>
		 <input type="number" id="compNumSquadre" class="input-login" value="10" min="2">
  
		 <label class="label">Elenco Squadre (separati da virgola)</label>
		 <textarea id="compTeamsList" class="input-login" placeholder="Squadra A, Squadra B, Squadra C..." style="height: 80px;"></textarea>
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
                <th>ID</th>
                <th>Nome</th>
                <th>Tipo</th>
                <th>GW Attuale</th>
                <th>Mercato</th>
                <th style="text-align: right;">Azioni</th>
              </tr>
            </thead>
            <tbody id="admin-competitions-list">
              <tr>
                <td colspan="6" style="text-align: center; color: var(--text3);">Caricamento competizioni...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
  },

  render(state) {
    const listContainer = document.getElementById('admin-competitions-list');
    if (!listContainer) return;

    const comps = state.competitions || [];
    if (comps.length === 0) {
      listContainer.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text3);">Nessuna competizione creata. Usa il modulo sopra per crearne una.</td></tr>`;
      return;
    }

    listContainer.innerHTML = comps.map(c => {
      const currentGW = (c.status && c.status.currentGW) ? c.status.currentGW : 1;
      const marketOpen = c.marketOpen !== false;
      const safeName = c.name.replace(/'/g, "\\'");
      
      // Estraiamo i parametri per passarli in sicurezza alla funzione di modifica
      const gironi = c.gironi || 1;
      const qualificati = c.qualificatiFaseFinale || 0;

      return `
        <tr>
          <td style="font-family: 'DM Mono', monospace; font-size: .8rem; color: var(--accent2);">${c.id}</td>
          <td style="font-weight: 500;">${c.name}</td>
          <td style="text-transform: capitalize; font-size: .8rem;">${c.type}</td>
          <td>
            <div style="display: flex; align-items: center; gap: .5rem;">
              <input type="number" value="${currentGW}" id="gw-input-${c.id}" style="width: 50px; background: var(--bg); border: 1px solid var(--border); color: #fff; padding: .2rem .4rem; border-radius: 4px; text-align: center;">
              <button class="btn btn-blue" onclick="window.updateCompGW('${c.id}')" style="padding: .25rem .5rem; font-size: .75rem; width: auto;">Salva</button>
            </div>
          </td>
          <td>
            <button class="btn ${marketOpen ? 'btn-green' : 'btn-red'}" onclick="window.toggleCompMarket('${c.id}', ${marketOpen})" style="padding: .25rem .5rem; font-size: .75rem; width: auto; font-weight:500;">
              ${marketOpen ? '🟢 Aperto' : '🔴 Chiuso'}
            </button>
          </td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: .4rem;">
              <button class="btn btn-blue" onclick="window.caricaCompetizioneNelForm('${c.id}', '${safeName}', '${c.type}', ${gironi}, ${qualificati})" style="padding: .35rem .6rem; font-size: .75rem; width: auto;">
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
    window.toggleCompFields = function(type) {
      const fg = document.getElementById('fieldGironi');
      const fq = document.getElementById('fieldQualificati');
      if (!fg || !fq) return;
      
      fg.style.display = (type === 'campionato' || type === 'misto') ? 'block' : 'none';
      fq.style.display = (type === 'misto') ? 'block' : 'none';
    };

    // Riempie il form in alto con i dati della riga selezionata
    window.caricaCompetizioneNelForm = function(id, name, type, gironi, qualificati) {
      const idInput = document.getElementById('compId');
      const nameInput = document.getElementById('compName');
      const typeSelect = document.getElementById('compType');
      const gironiInput = document.getElementById('compGironi');
      const qualifInput = document.getElementById('compQualificati');
      const numSquadreInput = document.getElementById('compNumSquadre');
	  const teamsInput = document.getElementById('compTeamsList');
  
      if (numSquadreInput) numSquadreInput.value = numSquadre || 10;
      if (teamsInput) teamsInput.value = teamsArray ? teamsArray.join(', ') : '';
      if(!idInput || !nameInput || !typeSelect) return;

      // Compiliamo i campi
      idInput.value = id;
      idInput.disabled = true; // Impediamo di cambiare l'ID per non rompere i nodi Firebase esistenti
      nameInput.value = name;
      typeSelect.value = type;
      if (gironiInput) gironiInput.value = gironi;
      if (qualifInput) qualifInput.value = qualificati;

      window.toggleCompFields(type);

      // Cambiamo i testi dell'interfaccia per mostrare che siamo in modalità "Modifica"
      document.getElementById('form-comp-title').innerText = `Modifica della Competizione: ${id.toUpperCase()}`;
      const btnSubmit = document.getElementById('btn-submit-comp');
      btnSubmit.innerText = "💾 Salva Modifiche";
      btnSubmit.className = "btn btn-blue";
      
      document.getElementById('btn-cancel-edit-comp').style.display = "inline-flex";
      
      // Scorriamo dolcemente la pagina verso il form in alto
      document.getElementById('sec-crea-competizioni').scrollIntoView({ behavior: 'smooth' });
    };

    // Ripristina il form allo stato originale ("Crea")
    window.annullaModificaComp = function() {
      const idInput = document.getElementById('compId');
      if (idInput) { idInput.value = ''; idInput.disabled = false; }
      if (document.getElementById('compName')) document.getElementById('compName').value = '';
      if (document.getElementById('compType')) document.getElementById('compType').value = 'campionato';
      if (document.getElementById('compGironi')) document.getElementById('compGironi').value = '1';
      if (document.getElementById('compQualificati')) document.getElementById('compQualificati').value = '2';
	  if (document.getElementById('compNumSquadre')) document.getElementById('compNumSquadre').value = '10';
	  if (document.getElementById('compTeamsList')) document.getElementById('compTeamsList').value = '';
	  // ...
      
      window.toggleCompFields('campionato');

      document.getElementById('form-comp-title').innerText = "Crea una nuova competizione";
      const btnSubmit = document.getElementById('btn-submit-comp');
      btnSubmit.innerText = "✨ Crea Competizione";
      btnSubmit.className = "btn btn-green";
      
      document.getElementById('btn-cancel-edit-comp').style.display = "none";
    };

    window.creaCompetizione = async function() {
      if (!database) return console.error("Database non inizializzato");

      const idInput   = document.getElementById('compId');
      const nameInput = document.getElementById('compName');
      if (!idInput || !nameInput) return;
      
      const id   = idInput.value.trim().toLowerCase().replace(/\s+/g, '-');
      const name = nameInput.value.trim();
      const type = document.getElementById('compType').value;
      
      if (!id || !name) return window.toast("ID e Nome Competizione sono obbligatori!", "err");
	  const numSquadre = parseInt(document.getElementById('compNumSquadre').value) || 0;
	  const teamsRaw = document.getElementById('compTeamsList').value;
      // Trasformiamo la stringa in un array pulito
      const teams = teamsRaw.split(',').map(s => s.trim()).filter(s => s !== "");
      
      // Usiamo update invece di set per evitare di cancellare i nodi figli (es: matches, teams) se stiamo aggiornando
      let compPayload = { 
        id, 
        name, 
        type
		numSquadre,
		teams
      };
      
      // Se è un inserimento ex-novo (id non disabilitato), aggiungiamo i campi di default
      if (!idInput.disabled) {
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
        const gironi      = parseInt(document.getElementById('compGironi').value) || 1;
        const qualificati = parseInt(document.getElementById('compQualificati').value) || 0;
        if (type === 'campionato' || type === 'misto') compPayload.gironi = gironi;
        if (type === 'misto') compPayload.qualificatiFaseFinale = qualificati;
      }
      
      try {
        await update(ref(database, `competitions/${id}`), compPayload);
        window.toast(`Competizione salvata/aggiornata con successo!`, "ok");
        window.annullaModificaComp(); // Svuota il form e lo rimette in modalità creazione
      } catch (err) { 
        window.toast("Errore durante il salvataggio", "err"); 
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

    setTimeout(() => {
      const compTypeSelect = document.getElementById('compType');
      if (compTypeSelect) {
        if (!compTypeSelect.querySelector('option[value="misto-speciale"]')) {
          const newOpt = document.createElement('option');
          newOpt.value = 'misto-speciale';
          newOpt.textContent = 'Misto Speciale (12 Sq. - 11 GW + Playoff/Quarti)';
          compTypeSelect.appendChild(newOpt);
        }
      }
    }, 500);
  }
};
