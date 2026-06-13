import { ref, set, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

export const TeamsSection = {
  db: null,
  isEditing: false, // Flag per capire se stiamo creando o modificando
  editingId: null,  // Memorizza l'ID della squadra che stiamo modificando

  init(databaseInstance) {
    this.db = databaseInstance;
    
    // Esponiamo le funzioni globalmente su window per i trigger onclick dell'HTML
    window.addTeam = () => this.addTeam();
    window.deleteTeam = (id) => this.deleteTeam(id);
    window.prepareEditTeam = (id, name, owner, emoji) => this.prepareEditTeam(id, name, owner, emoji);
    window.cancelEditTeam = () => this.cancelEditTeam();
  },

  renderHTML() {
    return `
    <div id="sec-teams" class="admin-sec" style="display:none">
      <div class="sec-title">Gestione Squadre</div>
      <div class="card" style="max-width:500px">
        <div id="formTitle" class="label" style="margin-bottom:.5rem">Aggiungi Nuova Squadra</div>
        <input type="text" id="tId" class="input-login" placeholder="ID Univoco (es: fc-napoli)">
        <input type="text" id="tName" class="input-login" placeholder="Nome Fantasquadra">
        <input type="text" id="tOwner" class="input-login" placeholder="Nome Presidente">
        <input type="text" id="tEmoji" class="input-login" placeholder="Emoji (es: 🌋)" max="2">
        
        <div style="display:flex; gap:.5rem;">
          <button id="btnSubmitTeam" class="btn btn-green" onclick="window.addTeam()">Crea Squadra</button>
          <button id="btnCancelEdit" class="btn btn-red" style="display:none; width:auto;" onclick="window.cancelEditTeam()">Annulla</button>
        </div>
      </div>
      
      <div class="card">
        <div class="label">Squadre Registrate</div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr><th>Emoji</th><th>Nome</th><th>Presidente</th><th>Punti</th><th>Azioni</th></tr>
            </thead>
            <tbody id="teamsTableBody"></tbody>
          </table>
        </div>
      </div>
    </div>`;
  },

  render({ TEAMS }) {
    const tbody = document.getElementById('teamsTableBody');
    if (!tbody) return;
    tbody.innerHTML = TEAMS.map(t => {
      // Escape dei caratteri per evitare problemi nel passaggio parametri della funzione inline onclick
      const safeName = (t.name || '').replace(/'/g, "\\'");
      const safeOwner = (t.owner || '').replace(/'/g, "\\'");
      const safeEmoji = (t.emoji || '').replace(/'/g, "\\'");

      return `
      <tr>
        <td style="font-size:1.3rem">${t.emoji || '⚽'}</td>
        <td><strong>${t.name}</strong></td>
        <td>${t.owner || '—'}</td>
        <td><span class="badge badge-green">${t.pts || 0} pts</span></td>
        <td>
          <div style="display:flex; gap:.25rem;">
            <button class="btn btn-blue" style="padding:.25rem .5rem;font-size:.75rem;width:auto" onclick="window.prepareEditTeam('${t.id}', '${safeName}', '${safeOwner}', '${safeEmoji}')">Modifica</button>
            <button class="btn btn-red" style="padding:.25rem .5rem;font-size:.75rem;width:auto" onclick="window.deleteTeam('${t.id}')">Elimina</button>
          </div>
        </td>
      </tr>
      `;
    }).join('');
  },

  /* ─── LOGICHE ─── */
  
  // 1. Prepara il form per la modifica popolando i campi
  prepareEditTeam(id, name, owner, emoji) {
    this.isEditing = true;
    this.editingId = id;

    document.getElementById('formTitle').textContent = "Modifica Squadra";
    
    const idInput = document.getElementById('tId');
    idInput.value = id;
    idInput.disabled = true; // L'ID univoco non deve essere modificato per non rompere i nodi Firebase
    
    document.getElementById('tName').value = name;
    document.getElementById('tOwner').value = owner;
    document.getElementById('tEmoji').value = emoji === 'undefined' ? '' : emoji;
    
    document.getElementById('btnSubmitTeam').textContent = "Salva Modifiche";
    document.getElementById('btnCancelEdit').style.display = "inline-flex";
  },

  // 2. Annulla lo stato di modifica e resetta il form
  cancelEditTeam() {
    this.isEditing = false;
    this.editingId = null;

    document.getElementById('formTitle').textContent = "Aggiungi Nuova Squadra";
    
    const idInput = document.getElementById('tId');
    idInput.value = '';
    idInput.disabled = false;
    
    ['tName','tOwner','tEmoji'].forEach(f => document.getElementById(f).value = '');
    
    document.getElementById('btnSubmitTeam').textContent = "Crea Squadra";
    document.getElementById('btnCancelEdit').style.display = "none";
  },

  // 3. Gestisce sia la Creazione che la Modifica (In base al flag isEditing)
  async addTeam() {
    const id = document.getElementById('tId').value.trim();
    const name = document.getElementById('tName').value.trim();
    const owner = document.getElementById('tOwner').value.trim();
    const emoji = document.getElementById('tEmoji').value.trim();
    
    if (!id || !name) return window.toast("ID e Nome obbligatori!", "err");
    
    try {
      if (this.isEditing) {
        // MODIFICA: Usiamo update() per modificare solo i campi anagrafici senza azzerare i punti (pts, w, d, l, ecc.)
        await update(ref(this.db, 'teams/' + this.editingId), { name, owner, emoji });
        window.toast("Squadra aggiornata con successo!", "ok");
        this.cancelEditTeam(); // Resetta il form
      } else {
        // CREAZIONE: Usiamo set() per creare una nuova struttura da zero
        await set(ref(this.db, 'teams/' + id), { id, name, owner, emoji, pts: 0, lastGW: 0, w: 0, d: 0, l: 0 });
        window.toast("Squadra creata con successo!", "ok");
        ['tId','tName','tOwner','tEmoji'].forEach(f => document.getElementById(f).value = '');
      }
    } catch (err) { 
      window.toast("Errore durante l'operazione", "err"); 
    }
  },

  // 4. Elimina la squadra
  async deleteTeam(id) {
    if (confirm("Vuoi davvero eliminare questa squadra?")) {
      try { 
        await set(ref(this.db, 'teams/' + id), null); 
        window.toast("Squadra eliminata.", "ok");
        // Se si elimina la squadra che si stava modificando, resetta il form
        if (this.isEditing && this.editingId === id) {
          this.cancelEditTeam();
        }
      } catch (err) { 
        window.toast("Errore nell'eliminazione", "err"); 
      }
    }
  }
};