import { ref, update, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

export const PlayersSection = {
  _filter: '',
  _db: null,

  init(db) {
    this._db = db;
    
    // Filtro di ricerca
    window.filterPlayersAdmin = (val) => {
      this.setFilter(val);
      if (window.PLAYERS) {
        this.render({ PLAYERS: window.PLAYERS });
      }
    };

    // Funzione per svincolare un giocatore
    window.releasePlayer = async (playerId) => {
      if (!window.PLAYERS) return;
      const giocatore = window.PLAYERS.find(p => p.id === playerId);
      if (!giocatore) return;
      
      if (confirm(`Vuoi svincolare ${giocatore.name}?`)) {
        try {
          if (!this._db) throw new Error("Database non inizializzato");
          await update(ref(this._db, 'players/' + playerId), { teamId: null });
          if (typeof window.toast === 'function') window.toast(`${giocatore.name} svincolato.`, 'ok');
        } catch (err) {
          if (typeof window.toast === 'function') window.toast("Errore durante lo svincolo", "err");
          console.error(err);
        }
      }
    };

    // NUOVA FUNZIONE: Elimina l'intero listone dei calciatori da Firebase
    window.clearPlayersDatabase = async () => {
      if (!this._db) {
        if (typeof window.toast === 'function') window.toast("Database non inizializzato", "err");
        return;
      }

      // Prima conferma di sicurezza
      if (confirm("ATTENZIONE!\nStai per eliminare TUTTI i calciatori dal database.\nQuesta azione rimuoverà anche i giocatori associati alle squadre. Vuoi procedere?")) {
        // Seconda conferma esplicita
        if (confirm("Sei assolutamente sicuro? L'azione è irreversibile e resetterà il listone.")) {
          try {
            // Elimina (o setta a null) l'intero nodo 'players'
            await set(ref(this._db, 'players'), null);
            if (typeof window.toast === 'function') {
              window.toast("Database calciatori svuotato con successo!", "ok");
            }
          } catch (err) {
            console.error(err);
            if (typeof window.toast === 'function') {
              window.toast("Errore durante l'eliminazione del listone", "err");
            }
          }
        }
      }
    };

    // LOGICA DI IMPORTAZIONE SPECIFICA PER IL CSV/EXCEL DI FANTACALCIO
    window.importPlayersData = async () => {
      const textarea = document.getElementById('pImportInput');
      if (!textarea || !textarea.value.trim()) {
        if (typeof window.toast === 'function') window.toast("Incolla i dati della lista!", "err");
        return;
      }

      try {
        let playersArray = [];
        const rawData = textarea.value.trim();

        if (rawData.startsWith('[') || rawData.startsWith('{')) {
          const parsed = JSON.parse(rawData);
          const listaGrezza = Array.isArray(parsed) ? parsed : Object.values(parsed);
          playersArray = listaGrezza.map((p, index) => ({
            id: p.id || (p.name || p.n || '').toLowerCase().replace(/[^a-z0-9]/g, '') + index,
            name: p.name || p.n || 'Sconosciuto',
            role: (p.role || p.r || 'D').toUpperCase().charAt(0),
            club: p.club || p.team || p.s || 'Svincolato',
            value: parseInt(p.value || p.q || p.fvm || 1),
            teamId: p.teamId || null
          }));
        } 
        else {
          const lines = rawData.split('\n');
          
          lines.forEach((line) => {
            if (!line.trim()) return;

            let parts = line.split(',');
            if (parts.length < 5) parts = line.split('\t');

            if (parts[0].toLowerCase().includes('id') || parts[0].toLowerCase().includes('quotazioni') || isNaN(parts[0].trim())) {
              return; 
            }

            if (parts.length >= 5) {
              const id = parts[0].trim();            
              const role = parts[1].trim().toUpperCase(); 
              const name = parts[3].trim();          
              const club = parts[4].trim();          
              const value = parseInt(parts[5]) || 1; 

              if (id && name) {
                playersArray.push({
                  id: id,
                  name: name,
                  role: role,
                  club: club || 'Svincolato',
                  value: value,
                  teamId: null 
                });
              }
            }
          });
        }

        if (playersArray.length === 0) {
          throw new Error("Nessun calciatore valido rilevato. Controlla di aver incluso i dati corretti.");
        }

        if (confirm(`Rilevati ${playersArray.length} calciatori pronti per l'importazione. Vuoi aggiornare il database Firebase?\n(I calciatori esistenti con lo stesso ID verranno aggiornati, i nuovi inseriti)`)) {
          if (!this._db) throw new Error("Database non inizializzato");
          
          const updates = {};
          playersArray.forEach(p => {
            updates['players/' + p.id] = p;
          });

          await update(ref(this._db), updates);
          if (typeof window.toast === 'function') window.toast(`Importati/Aggiornati con successo ${playersArray.length} giocatori!`, 'ok');
          textarea.value = '';
        }

      } catch (err) {
        console.error(err);
        if (typeof window.toast === 'function') {
          window.toast("Errore durante l'importazione. Controlla il formato.", "err");
        }
      }
    };
  },

  renderHTML() {
    return `
    <div id="sec-players" class="admin-sec" style="display:none">
      <div class="sec-title">Database Calciatori</div>
      
      <!-- Box Gestione Strumenti Listone -->
      <div class="card" style="border-left: 4px solid var(--accent2)">
        <div class="label" style="color: var(--accent2)">Importazione Listone Fantacalcio (CSV / Excel)</div>
        <p style="font-size: 0.8rem; color: var(--text2); margin-bottom: 0.75rem;">
          Apri il file Excel, seleziona e copia le righe dei calciatori che desideri importare (inclusa o meno la riga di intestazione), poi incollale qui sotto. Il sistema riconoscerà automaticamente ID, Ruolo, Nome, Squadra e Quotazione.
        </p>
        <textarea id="pImportInput" class="input-login" rows="4" placeholder="Incolla qui le righe del file (es: 4312,P,Por,Maignan,Milan,16...)" style="font-family:'DM Mono',monospace; font-size:0.8rem; height:120px; resize:vertical; margin-bottom:0.75rem;"></textarea>
        
        <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
          <button class="btn btn-blue" style="width:auto; padding:0.5rem 1.5rem;" onclick="window.importPlayersData()">Elabora ed Importa</button>
          <button class="btn btn-red" style="width:auto; padding:0.5rem 1.5rem; background: var(--accent3);" onclick="window.clearPlayersDatabase()">❌ Svuota Intero Listone</button>
        </div>
      </div>

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
    const filtered = PLAYERS ? PLAYERS.filter(p => p.name && p.name.toLowerCase().includes(f)) : [];

    const pFoundCount = document.getElementById('pFoundCount');
    if (pFoundCount) pFoundCount.textContent = `Trovati: ${filtered.length}`;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text3); padding:2rem;">Nessun calciatore nel database. Usa il box sopra per importarli.</td></tr>`;
      return;
    }

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
