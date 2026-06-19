import { ref, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

export const MercatoSection = {
  db: null,
  rawPlayers: [],

  init(databaseInstance) {
    this.db = databaseInstance;

    // Espone i metodi globali richiesti dal DOM (attributi onclick)
    window.assignPlayerToTeam = () => this.assignPlayerToTeam();
    window.releasePlayer = (playerId) => this.releasePlayer(playerId);
  },

  renderHTML() {
    return `
    <div id="sec-mercato" class="admin-sec" style="display:none">
      <div class="sec-title">Assegnazione Calciatori & Mercato</div>
      <div class="card" style="max-width:600px;">
        <div class="label" style="margin-bottom:.5rem">Assegna un Calciatore Svincolato a una Squadra</div>
        <div style="display:flex; gap:1rem; margin-bottom:1rem;">
          
          <div style="flex:1;">
            <label class="label">Cerca Giocatore</label>
            <input type="text" id="mPlayerSearch" list="dl-players" placeholder="Scrivi il nome..." autocomplete="off" style="width:100%; background:var(--bg3); border:1px solid var(--border); border-radius:6px; color:#fff; padding:.65rem; font-size:.9rem;">
            <datalist id="dl-players"></datalist>
          </div>
          
          <div style="flex:1;">
            <label class="label">Seleziona Squadra</label>
            <select id="mTeamSelect" style="width:100%; background:var(--bg3); border:1px solid var(--border); border-radius:6px; color:#fff; padding:.65rem; font-size:.9rem;"></select>
          </div>
          
        </div>
        <button class="btn btn-green" onclick="window.assignPlayerToTeam()">Conferma Assegnazione</button>
      </div>

      <div class="card">
        <div class="label">Storico Assegnazioni & Calciatori per Squadra</div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr><th>Giocatore</th><th>Ruolo</th><th>Club</th><th>Squadra Fanta</th><th>Azioni</th></tr>
            </thead>
            <tbody id="mercatoTableBody"></tbody>
          </table>
        </div>
      </div>
    </div>`;
  },

  render({ PLAYERS, TEAMS }) {
    // Salviamo lo stato locale dei giocatori per ricavare l'ID dal testo cercato
    this.rawPlayers = PLAYERS;

    this._populateInputs(PLAYERS, TEAMS);
    this._renderTable(PLAYERS, TEAMS);
  },

  _populateInputs(PLAYERS, TEAMS) {
    const dlPlayers = document.getElementById('dl-players');
    const tSelect = document.getElementById('mTeamSelect');
    if (!dlPlayers || !tSelect) return;

    // 1. Popola la lista di ricerca dei soli calciatori svincolati
    const svincolati = PLAYERS.filter(p => !p.teamId && p.name).sort((a, b) => a.name.localeCompare(b.name));
    dlPlayers.innerHTML = svincolati.map(p =>
      `<option value="${p.name} (${p.role} - ${p.club || 'Svincolato'})"></option>`
    ).join('');

    // 2. Ripristinato il popolamento del select classico delle fanta-squadre usando l'ID nativo
    tSelect.innerHTML = TEAMS.map(t =>
      `<option value="${t.id}">${t.emoji || '⚽'} ${t.name}</option>`
    ).join('');
  },

  _renderTable(PLAYERS, TEAMS) {
    const tbody = document.getElementById('mercatoTableBody');
    if (!tbody) return;

    const sorted = [...PLAYERS].filter(p => p.name).sort((a, b) => a.name.localeCompare(b.name));
    tbody.innerHTML = sorted.map(p => {
      const fantaTeam = TEAMS.find(t => t.id === p.teamId);
      const teamBadge = fantaTeam
        ? `<span class="badge badge-blue">${fantaTeam.emoji || '⚽'} ${fantaTeam.name}</span>`
        : `<span class="badge badge-gray">❌ Svincolato</span>`;
      return `
        <tr>
          <td><strong>${p.name}</strong></td>
          <td><span class="badge ${p.role === 'P' ? 'badge-gray' : p.role === 'D' ? 'badge-blue' : p.role === 'C' ? 'badge-green' : 'badge-red'}">${p.role}</span></td>
          <td>${p.club || 'Svincolato'}</td>
          <td>${teamBadge}</td>
          <td>
            ${p.teamId ? `<button class="btn btn-red" style="font-size:.7rem;padding:.25rem .5rem;width:auto;" onclick="window.releasePlayer('${p.id}')">Svincola</button>` : '—'}
          </td>
        </tr>
      `;
    }).join('');
  },

  async assignPlayerToTeam() {
    const playerInputValue = document.getElementById('mPlayerSearch').value.trim();
    const tId = document.getElementById('mTeamSelect').value; // Recupera direttamente l'ID dal select classico

    if (!playerInputValue || !tId) {
      return window.toast("Compila il campo del giocatore e seleziona una squadra!", "err");
    }

    // Risaliamo all'ID del giocatore verificando se il testo digitato inizia con il suo nome reale
    const targetPlayer = this.rawPlayers.find(p => !p.teamId && playerInputValue.startsWith(p.name));

    if (!targetPlayer) {
      return window.toast("Giocatore non trovato o non più svincolato. Selezionalo dalla lista.", "err");
    }
    
    try {
      await update(ref(this.db, 'players/' + targetPlayer.id), { teamId: tId });
      
      // Resetta solo il campo di ricerca del giocatore per il prossimo inserimento
      document.getElementById('mPlayerSearch').value = "";
      
      window.toast("Giocatore assegnato con successo!", "ok");
    } catch (err) { 
      window.toast("Errore durante l'assegnazione", "err"); 
    }
  },

  async releasePlayer(playerId) {
    if (!playerId) return;
    if (!confirm("Sei sicuro di voler svincolare questo giocatore?")) return;

    try {
      await update(ref(this.db, 'players/' + playerId), { teamId: "" });
      window.toast("Giocatore svincolato con successo!", "ok");
    } catch (err) { 
      window.toast("Errore durante lo svincolo", "err"); 
    }
  }
};
