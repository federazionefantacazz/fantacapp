import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Stato interno al modulo per tracciare i voti estratti da Firebase
let localVotes = {};

export const VotesSection = {
  // Inizializza l'ascolto sul nodo 'votes' di Firebase
  init(db) {
    onValue(ref(db, 'votes'), snap => {
      localVotes = snap.val() || {};
      
      // Se il modulo è già renderizzato nella pagina, aggiorna la UI al cambio dei dati
      const container = document.getElementById('votesGridContainer');
      if (container) {
        // Recupera la GW corrente dal badge o dallo stato globale se necessario
        // In alternativa, richiama una funzione di rendering locale o globale
        const gwBadge = document.getElementById('gwBadge');
        const currentGW = gwBadge ? parseInt(gwBadge.textContent.replace('GW ', '')) || 1 : 1;
        this.renderLocal(currentGW);
      }
    });
  },

  renderHTML() {
    return `
    <div id="sec-votes" class="admin-sec" style="display:none">
      <div class="sec-title">Voti Live Ricevuti <span id="gwBadge" class="badge badge-green">GW 1</span></div>
      <div class="card">
        <div class="label">Filtra per Ruolo o Cerca</div>
        <div class="vote-grid" id="votesGridContainer"></div>
      </div>
    </div>`;
  },

  // Render primario invocato dal ciclo globale 'refreshAll' dell'applicazione
  render({ PLAYERS, CURRENT_GW }) {
    const gwBadge = document.getElementById('gwBadge');
    if (gwBadge) gwBadge.textContent = 'GW ' + CURRENT_GW;

    // Memorizza temporaneamente i giocatori sullo scope globale/window per renderLocal
    this.cachedPlayers = PLAYERS || [];
    this.renderLocal(CURRENT_GW);
  },

  // Logica di rendering interna basata sui dati incapsulati in localVotes
  renderLocal(currentGW) {
    const container = document.getElementById('votesGridContainer');
    if (!container) return;

    const gVotes = localVotes[`gw${currentGW}`] || {};
    const items = Object.entries(gVotes);

    if (items.length === 0) {
      container.innerHTML = '<div style="color:var(--text3);font-size:.85rem">Nessun voto caricato per questa GW.</div>';
      return;
    }

    const playersList = this.cachedPlayers || window.PLAYERS || [];

    container.innerHTML = items.map(([pId, v]) => {
      const p = playersList.find(pl => pl.id === pId) || { name: pId };
      return `
        <div class="vote-item">
          <span style="font-weight:600;font-size:.85rem">${p.name}</span>
          <span class="score">${v}</span>
        </div>
      `;
    }).join('');
  }
};
