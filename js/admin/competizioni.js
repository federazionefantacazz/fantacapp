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
        <div class="label" style="color: var(--accent); margin-bottom: 1rem; font-size: .85rem;">Crea una nuova competizione</div>
        
        <label class="label">ID Competizione (es: serie-a-2024)</label>
        <input type="text" id="compId" class="input-login" placeholder="ID univoco senza spazi">

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

        <button class="btn btn-green" onclick="window.creaCompetizione()">✨ Crea Competizione</button>
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
      const marketOpen = c.marketOpen !== false; // Di default è true se non impostato
      
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
            <button class="btn btn-red" onclick="window.eliminaCompetizione('${c.id}', '${c.name.replace(/'/g, "\\'")}')" style="padding: .35rem .6rem; font-size: .75rem; width: auto; display: inline-flex;">
              🗑️ Elimina
            </button>
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

    window.creaCompetizione = async function() {
      if (!database) return console.error("Database non inizializzato");

      const idInput   = document.getElementById('compId');
      const nameInput = document.getElementById('compName');
      if (!idInput || !nameInput) return;
      
      const id   = idInput.value.trim().toLowerCase().replace(/\s+/g, '-');
      const name = nameInput.value.trim();
      const type = document.getElementById('compType').value;
      
      if (!id || !name) return window.toast("ID e Nome Competizione sono obbligatori!", "err");
      
      let compPayload = { 
        id, 
        name, 
        type, 
        status: { currentGW: 1 }, 
        marketOpen: true, 
        fixtures: {}, 
        teams: {}, 
        standings: {} 
      };
      
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
        await set(ref(database, `competitions/${id}`), compPayload);
        window.toast(`Competizione "${name}" creata con successo!`, "ok");
        idInput.value = ''; 
        nameInput.value = '';
      } catch (err) { 
        window.toast("Errore durante la creazione", "err"); 
      }
    };

    // Azione Rapida: Modifica Turno Corrente GW
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

    // Azione Rapida: Apertura/Chiusura Mercato di una specifica competizione
    window.toggleCompMarket = async function(compId, currentlyOpen) {
      if (!database) return;
      try {
        await update(ref(database, `competitions/${compId}`), { marketOpen: !currentlyOpen });
        window.toast(`Mercato della competizione aggiornato!`, "ok");
      } catch (err) {
        window.toast("Errore durante la modifica del mercato", "err");
      }
    };

    // Azione: Elimina Competizione da Firebase
    window.eliminaCompetizione = async function(compId, compName) {
      if (!database) return;
      if (confirm(`⚠️ SEI SICURO?\nEliminando la competizione "${compName}" rimuoverai per sempre tutti i suoi calendari, risultati e classifiche.`)) {
        try {
          await remove(ref(database, `competitions/${compId}`));
          window.toast(`Competizione "${compName}" eliminata definitivamente`, "info");
        } catch (err) {
          window.toast("Errore durante l'eliminazione", "err");
        }
      }
    };

    // Iniezione dinamica opzione "Misto Speciale" nel selettore HTML
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
