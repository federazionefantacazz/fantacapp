import { ref, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

export const MercatoSection = {
  db: null,
  rawPlayers: [],
  rawTeams: [],

  init(databaseInstance) {
    this.db = databaseInstance;

    // Espone i metodi globali richiesti dal DOM
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
            <input type="text" id="mPlayerSearch" list="dl-players" placeholder="Scrivi per filtrare..." autocomplete="off" style="width:100%; background:var(--bg3); border:1px solid var(--border); border-radius:6px; color:#fff; padding:.65rem; font-size:.9rem;">
            <datalist id="dl-players"></datalist>
          </div>
          
          <div style="flex:1;">
            <label class="label">Cerca Squadra Destinataria</label>
            <input type="text" id="mTeamSearch" list="dl-teams" placeholder="Scrivi per filtrare..." autocomplete="off" style="width:100%; background:var(--bg3); border:1px solid var(--border); border-radius:6px; color:#fff; padding:.65rem; font-size:.9rem;">
            <datalist id="dl-teams"></datalist>
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
    // Salviamo lo stato locale per poter ricavare gli ID durante il salvataggio
    this.rawPlayers = PLAYERS;
    this.rawTeams = TEAMS;

    this._populateDatalists(PLAYERS, TEAMS);
    this._renderTable(PLAYERS, TEAMS);
  },

  _populateDatalists(PLAYERS, TEAMS) {
    const dlPlayers = document.getElementById('dl-players');
    const dlTeams = document.getElementById('dl-teams');
    if (!dlPlayers || !dlTeams) return;

    // Filtra solo i giocatori svincolati
    const svincolati = PLAYERS.filter(p => !p.teamId && p.name).sort((a, b) => a.name.localeCompare(b.name));
    // Nel datalist, il 'value' è quello che l'utente seleziona/scrive. Sfruttiamo il formato per renderlo leggibile.
    dlPlayers.innerHTML = svincolati.map(p =>
      `<option value="${p.name} (${p.role} - ${p.club || 'Svincolato'})"></option>`
    ).join('');

    dlTeams.innerHTML = TEAMS.map(t =>
      `<option value="${t.emoji || '⚽'} ${t.name}"></option>`
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

  /* ─── Logiche di recupero dell'ID basate sul testo scritto nell'input ─── */
  async assignPlayerToTeam() {
    const playerInputValue = document.getElementById('mPlayerSearch').value.trim();
    const teamInputValue = document.getElementById('mTeamSearch').value.trim();

    if (!playerInputValue || !teamInputValue) {
      return window.toast("Compila sia il campo giocatore che il campo squadra!", "err");
    }

    // Risaliamo all'ID del giocatore controllando se il valore del campo di testo inizia con il nome del giocatore
    const targetPlayer = this.rawPlayers.find(p => !p.teamId && playerInputValue.startsWith(p.name));
    
    // Risaliamo all'ID della squadra verificando se il valore include il nome della fanta-squadra
    const targetTeam = this.rawTeams.find(t => teamInputValue.includes(t.name));

    if (!targetPlayer) {
      return window.toast("Giocatore non trovato o non più svincolato. Selezionalo dalla lista.", "err");
    }
    if (!targetTeam) {
      return window.toast("Squadra destinataria non trovata. Selezionala dalla lista.", "err");
    }
    
    try {
      await update(ref(this.db, 'players/' + targetPlayer.id), { teamId: targetTeam.id });
      
      // Resettiamo i campi di ricerca per l'inserimento successivo
      document.getElementById('mPlayerSearch').value = "";
      document.getElementById('mTeamSearch').value = "";
      
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
