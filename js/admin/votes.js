import { ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Stato interno isolato del modulo
let localVotes = {};
let selectedCompId = ""; // Competizione scelta internamente nella scheda voti
let selectedGW = 1;      // Giornata scelta internamente nella scheda voti
let databaseRef = null;
let unsubscribeVotes = null;

export const VotesSection = {
  init(db) {
    databaseRef = db;
  },

  renderHTML() {
    // Generiamo le opzioni per le 38 giornate
    let gwOptions = '';
    for (let i = 1; i <= 38; i++) {
      gwOptions += `<option value="${i}">GW ${i}</option>`;
    }

    return `
    <div id="sec-votes" class="admin-sec" style="display:none">
      <div class="sec-title">Archivio & Modifica Voti Universale</div>
      
      <div class="card" style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 200px;">
          <div class="label">1. Seleziona Competizione</div>
          <select id="voteCompSelector" class="input-login" style="margin-bottom:0;">
            <option value="">-- Seleziona Competizione --</option>
          </select>
        </div>
        <div>
          <div class="label">2. Seleziona Giornata</div>
          <select id="voteGwSelector" class="input-login" style="margin-bottom:0; width: auto; min-width: 120px;">
            ${gwOptions}
          </select>
        </div>
        <div style="margin-top: auto;">
          <button class="btn btn-green" id="btnSaveVotes">💾 Salva Voti Sezione</button>
        </div>
      </div>

      <div class="card">
        <div class="label">Lista Calciatori e Voti Assegnati</div>
        <div class="vote-grid" id="votesGridContainer"></div>
      </div>
    </div>`;
  },

  // Invocato dal ciclo globale refreshAll
  render({ PLAYERS, competitions }) {
    this.cachedPlayers = PLAYERS || [];
    this.cachedCompetitions = competitions || [];

    // Popola il selettore delle competizioni se non è già stato fatto
    const compSelector = document.getElementById('voteCompSelector');
    if (compSelector && compSelector.options.length <= 1 && this.cachedCompetitions.length > 0) {
      this.cachedCompetitions.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name ? `${c.name} (${c.id.toUpperCase()})` : c.id.toUpperCase();
        compSelector.appendChild(opt);
      });
      
      // Di default seleziona la prima competizione disponibile se non vi è una selezione precedente dell'utente
      if (!selectedCompId && this.cachedCompetitions.length > 0) {
        selectedCompId = this.cachedCompetitions[0].id;
        compSelector.value = selectedCompId;
        this.listenToVotes();
      }
    }

    this.setupListeners();
    this.renderLocal();
  },

  // Sottoscrizione in tempo reale ai voti della competizione selezionata nel menu interno
  listenToVotes() {
    if (!databaseRef || !selectedCompId) {
      localVotes = {};
      this.renderLocal();
      return;
    }

    if (unsubscribeVotes) unsubscribeVotes();

    const votesRef = ref(databaseRef, `votes`);
    unsubscribeVotes = onValue(votesRef, snap => {
      localVotes = snap.val() || {};
      this.renderLocal();
    });
  },

  setupListeners() {
    const compSelector = document.getElementById('voteCompSelector');
    if (compSelector && !compSelector.dataset.hasListener) {
      compSelector.dataset.hasListener = "true";
      compSelector.addEventListener('change', (e) => {
        selectedCompId = e.target.value;
        this.listenToVotes();
      });
    }

    const gwSelector = document.getElementById('voteGwSelector');
    if (gwSelector && !gwSelector.dataset.hasListener) {
      gwSelector.dataset.hasListener = "true";
      gwSelector.addEventListener('change', (e) => {
        selectedGW = parseInt(e.target.value) || 1;
        this.renderLocal();
      });
    }

    const saveBtn = document.getElementById('btnSaveVotes');
    if (saveBtn && !saveBtn.dataset.hasListener) {
      saveBtn.dataset.hasListener = "true";
      saveBtn.addEventListener('click', () => this.saveVotesToFirebase());
    }
  },

  renderLocal() {
    const container = document.getElementById('votesGridContainer');
    if (!container) return;

    if (!selectedCompId) {
      container.innerHTML = '<div style="color:var(--accent3);font-size:.85rem">Scegli una competizione dal menu a tendina sopra per visualizzare o inserire i voti.</div>';
      return;
    }

    const gVotes = localVotes[`votes/gw${selectedGW}`] || {};
    const playersList = this.cachedPlayers || window.PLAYERS || [];

    if (playersList.length === 0) {
      container.innerHTML = '<div style="color:var(--text3);font-size:.85rem">Nessun calciatore presente nell\'applicazione.</div>';
      return;
    }

    container.innerHTML = playersList.map(p => {
      const currentVote = gVotes[p.id] !== undefined ? gVotes[p.id] : "";
      
      return `
        <div class="vote-item" style="flex-direction: column; align-items: flex-start; gap: 0.5rem;">
          <span style="font-weight:600;font-size:.85rem; color:#fff;">${p.name}</span>
          <input type="number" 
                 step="0.5" 
                 class="input-login player-vote-input" 
                 data-pid="${p.id}" 
                 value="${currentVote}" 
                 placeholder="N.V." 
                 style="margin-bottom:0; padding: .4rem .5rem; font-size:.8rem;">
        </div>
      `;
    }).join('');
  },

  async saveVotesToFirebase() {
    if (!databaseRef) return window.toast("Database non inizializzato!", "err");
    if (!selectedCompId) return window.toast("Seleziona prima una competizione!", "err");

    const inputs = document.querySelectorAll('.player-vote-input');
    const updatedVotes = {};

    inputs.forEach(input => {
      const pId = input.dataset.pid;
      const val = input.value.trim();
      
      if (val !== "") {
        updatedVotes[pId] = parseFloat(val);
      }
    });

    try {
      // Salva nel percorso mirato scelto liberamente dall'utente
      await set(ref(databaseRef, `votes/gw${selectedGW}/voto`), updatedVotes);
      window.toast(`Voti salvati con successo per ${selectedCompId.toUpperCase()} (GW ${selectedGW})!`, "ok");
    } catch (err) {
      console.error(err);
      window.toast("Errore durante il salvataggio dei voti", "err");
    }
  }
};
