import { ref, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

export const PlayersSection = {
  _filter: '',
  _db: null,

  // Inizializza il modulo passando l'istanza del database Firebase
  init(db) {
    this._db = db;
    
    // Espone i metodi necessari alla UI globale
    window.filterPlayersAdmin = (val) => {
      this.setFilter(val);
      // Esegue un re-render istantaneo del modulo passando i dati correnti memorizzati globalmente
      if (window.PLAYERS) {
        this.render({ PLAYERS: window.PLAYERS });
      }
    };

    window.releasePlayer = async (playerId) => {
      if (!window.PLAYERS) return;
      const giocatore = window.PLAYERS.find(p => p.id === playerId);
      if (!giocatore) return;
      
      if (confirm(`Vuoi svincolare ${giocatore.name}?`)) {
        try {
          if (!this._db) throw new Error("Database non inizializzato nel modulo Players");
          await update(ref(this._db, 'players/' + playerId), { teamId: null });
          if (typeof window.toast === 'function') {
            window.toast(`${giocatore.name} svincolato.`, 'ok');
          }
        } catch (err) {
          if (typeof window.toast === 'function') {
            window.toast("Errore durante lo svincolo", "err");
          }
          console.error(err);
        }
      }
    };
  },

  renderHTML() {
    return `
    <div id="sec-players" class="admin-sec" style="display:none">
      <div class="sec-title">Database Calciatori</div>
      <div class="card">
        <div style="display:flex;gap:1rem;margin-bottom:1rem;align-items:center">
          <input type="text" id="pSearch" class="input-login" placeholder="Cerca calciatore per nome..." style="margin-bottom:0;max-width:300px" oninput="window.filterPlayersAdmin(this.value)">
          <div style="font-size:.85rem;color:var(--text2)" id="pFoundCount"></div>
        </div>
        <div class="table-wrapper" style="max-height:500px">
          <table>
            <thead>
              <tr><th>Nome</th><th>Ruolo</th><th>Club</th><th>Valore</th><th>Azioni</th></tr>
            </thead>
            <tbody id="playersTableBody"></tbody>
          </table>
        </div>
      </div>
    </div>`;
  },

  render({ PLAYERS }) {
    const tbody = document.getElementById('playersTableBody');
    if (!tbody) return;

    const f = this._filter.toLowerCase();
    const filtered = PLAYERS.filter(p => p.name && p.name.toLowerCase().includes(f));

    const pFoundCount = document.getElementById('pFoundCount');
    if (pFoundCount) pFoundCount.textContent = `Trovati: ${filtered.length}`;

    const pCount = document.getElementById('pCount');
    if (pCount) pCount.textContent = PLAYERS.length;

    tbody.innerHTML = filtered.slice(0, 50).map(p => `
      <tr>
        <td><strong>${p.name}</strong></td>
        <td><span class="badge ${p.role === 'P' ? 'badge-gray' : p.role === 'D' ? 'badge-blue' : p.role === 'C' ? 'badge-green' : 'badge-red'}">${p.role}</span></td>
        <td>${p.club || 'Svincolato'}</td>
        <td><strong>${p.value || '—'}</strong></td>
        <td>
          <button class="btn btn-red" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; width: auto;" onclick="window.releasePlayer('${p.id}')">Svincola</button>
        </td>
      </tr>
    `).join('');
  },

  setFilter(val) {
    this._filter = val;
  }
};
