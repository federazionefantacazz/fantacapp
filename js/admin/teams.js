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
    window.prepareEditTeam = (id, name, owner, logo, motto, desc) => this.prepareEditTeam(id, name, owner, logo, motto, desc);
    window.cancelEditTeam = () => this.cancelEditTeam();
  },

  renderHTML() {
    return `
    <div id="sec-teams" class="admin-sec" style="display:none">
      <div class="sec-title">Gestione Squadre</div>
      <div class="card" style="max-width:500px">
        <div id="formTitle" class="label" style="margin-bottom:.5rem">Aggiungi Nuova Squadra</div>
        
        <input type="text" id="tName" class="input-login" placeholder="Nome Fantasquadra">
        <input type="text" id="tOwner" class="input-login" placeholder="Nome Presidente">
        
        <input type="text" id="tLogo" class="input-login" placeholder="URL Logo PNG (es: https://site.com/logo.png)">
        <input type="text" id="tMotto" class="input-login" placeholder="Motto della squadra">
        <textarea id="tDesc" class="input-login" placeholder="Descrizione / Storia della squadra" style="min-height:80px; font-family:inherit; resize:vertical;"></textarea>
        
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
              <tr><th>Logo</th><th>Nome / Motto</th><th>Presidente</th><th>Punti</th><th>Azioni</th></tr>
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
      // Escape dei caratteri per evitare bug di sintassi nelle funzioni inline onclick
      const safeName = (t.name || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const safeOwner = (t.owner || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const safeLogo = (t.logo || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const safeMotto = (t.motto || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const safeDesc = (t.desc || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');

      // Gestione del segnaposto se l'URL del logo è vuoto
      const logoHtml = t.logo 
        ? `<img src="${t.logo}" alt="Logo" style="width:32px; height:32px; object-fit:contain; border-radius:4px;">`
        : `<div style="width:32px; height:32px; background:var(--bg3); display:flex; align-items:center; justify-content:center; border-radius:4px; font-size:.8rem; color:var(--text3)">🛡️</div>`;

      return `
      <tr>
        <td>${logoHtml}</td>
        <td>
          <strong>${t.name}</strong>
          ${t.motto ? `<br><small style="color:var(--text2); font-style:italic;">"${t.motto}"</small>` : ''}
        </td>
        <td>${t.owner || '—'}</td>
        <td><span class="badge badge-green">${t.pts || 0} pts</span></td>
        <td>
          <div style="display:flex; gap:.25rem;">
            <button class="btn btn-blue" style="padding:.25rem .5rem;font-size:.75rem;width:auto" onclick="window.prepareEditTeam('${t.id}', '${safeName}', '${safeOwner}', '${safeLogo}', '${safeMotto}', '${safeDesc}')">Modifica</button>
            <button class="btn btn-red" style="padding:.25rem .5rem;font-size:.75rem;width:auto" onclick="window.deleteTeam('${t.id}')">Elimina</button>
          </div>
        </td>
      </tr>
      `;
    }).join('');
  },

  /* ─── LOGICHE ─── */
  
  // Prepara il form per la modifica popolando i nuovi campi
  prepareEditTeam(id, name, owner, logo, motto, desc) {
    this.isEditing = true;
    this.editingId = id;

    document.getElementById('formTitle').textContent = "Modifica Squadra (" + id + ")";
    
    document.getElementById('tName').value = name;
    document.getElementById('tOwner').value = owner;
    document.getElementById('tLogo').value = logo === 'undefined' ? '' : logo;
    document.getElementById('tMotto').value = motto === 'undefined' ? '' : motto;
    document.getElementById('tDesc').value = desc === 'undefined' ? '' : desc;
    
    document.getElementById('btnSubmitTeam').textContent = "Salva Modifiche";
    document.getElementById('btnCancelEdit').style.display = "inline-flex";
  },

  // Annulla lo stato di modifica e resetta tutti i campi di input
  cancelEditTeam() {
    this.isEditing = false;
    this.editingId = null;

    document.getElementById('formTitle').textContent = "Aggiungi Nuova Squadra";
    
    ['tName', 'tOwner', 'tLogo', 'tMotto', 'tDesc'].forEach(f => document.getElementById(f).value = '');
    
    document.getElementById('btnSubmitTeam').textContent = "Crea Squadra";
    document.getElementById('btnCancelEdit').style.display = "none";
  },

  // Gestisce l'inserimento o la modifica con la nuova struttura dati
  async addTeam() {
    const name = document.getElementById('tName').value.trim();
    const owner = document.getElementById('tOwner').value.trim();
    const logo = document.getElementById('tLogo').value.trim();
    const motto = document.getElementById('tMotto').value.trim();
    const desc = document.getElementById('tDesc').value.trim();
    
    if (!name) return window.toast("Il Nome della squadra è obbligatorio!", "err");
    
    try {
      if (this.isEditing) {
        // MODIFICA: Aggiorna solo i campi anagrafici inclusi i nuovi parametri testo/logo
        await update(ref(this.db, 'teams/' + this.editingId), { name, owner, logo, motto, desc });
        window.toast("Squadra aggiornata con successo!", "ok");
        this.cancelEditTeam();
      } else {
        // CREAZIONE: Genera lo slug dell'ID basato sul nome
        const generatedId = name
          .toLowerCase()
          .replace(/[^a-z0-9 ]/g, '')
          .trim()
          .replace(/\s+/g, '-');
          
        if (!generatedId) return window.toast("Nome non valido per generare un ID!", "err");

        // Salva la nuova struttura comprensiva di logo, motto e descrizione su Firebase
        await set(ref(this.db, 'teams/' + generatedId), { 
          id: generatedId, 
          name, 
          owner, 
          logo,
          motto,
          desc,
          pts: 0, 
          lastGW: 0, 
          w: 0, 
          d: 0, 
          l: 0 
        });
        
        window.toast("Squadra creata con ID: " + generatedId, "ok");
        ['tName', 'tOwner', 'tLogo', 'tMotto', 'tDesc'].forEach(f => document.getElementById(f).value = '');
      }
    } catch (err) { 
      window.toast("Errore durante l'operazione", "err"); 
    }
  },

  // Elimina la squadra
  async deleteTeam(id) {
    if (confirm("Vuoi davvero eliminare questa squadra?")) {
      try { 
        await set(ref(this.db, 'teams/' + id), null); 
        window.toast("Squadra eliminata.", "ok");
        if (this.isEditing && this.editingId === id) {
          this.cancelEditTeam();
        }
      } catch (err) { 
        window.toast("Errore nell'eliminazione", "err"); 
      }
    }
  }
};