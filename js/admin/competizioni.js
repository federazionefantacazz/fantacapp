import { ref, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

let database = null;

export const CompetizioniSection = {
  // Inizializza il modulo passando l'istanza del Database Firebase
  init(db) {
    database = db;
    this.registerGlobalActions();
  },

  renderHTML() {
    return `
    <div id="sec-crea-competizioni" class="admin-sec" style="display:none;">
      <div class="sec-title">🏆 Gestione & Nuova Competizione</div>
      
      <div class="card" style="max-width: 600px;">
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
    </div>`;
  },

  render(state) {
    // Gestito dal refreshAll globale se necessario aggiornare elementi dinamici interni
  },

  registerGlobalActions() {
    // Gestione visibilità campi condizionali nel form
    window.toggleCompFields = function(type) {
      const fg = document.getElementById('fieldGironi');
      const fq = document.getElementById('fieldQualificati');
      if (!fg || !fq) return;
      
      fg.style.display = (type === 'campionato' || type === 'misto') ? 'block' : 'none';
      fq.style.display = (type === 'misto') ? 'block' : 'none';
    };

    // Logica di creazione della competizione su Firebase
    window.creaCompetizione = async function() {
      if (!database) return console.error("Database non inizializzato in CompetizioniSection");

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

    // Injection opzione personalizzata Misto Speciale nel menu a tendina
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
    }, 800);
  }
};
