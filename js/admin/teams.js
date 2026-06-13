import { ref, set, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
// IMPORTA IL SERVIZIO CENTRALIZZATO PER L'UPLOAD (Verifica che il percorso relativo sia corretto)
import { uploadImageToImgBB } from "../services/integrationImgBB.js"; 

export const TeamsSection = {
  db: null,
  isEditing: false,    // Flag per capire se siamo in modalità "Crea" o "Modifica"
  editingId: null,     // Memorizza l'ID della squadra che stiamo modificando
  currentLogoUrl: '',  // Tiene in memoria il vecchio logo se non viene cambiato in modifica

  // 1. PUNTO DI INIZIALIZZAZIONE (Riceve solo l'istanza db di Firebase Realtime)
  init(databaseInstance) {
    this.db = databaseInstance;
    
    // Esponiamo le funzioni globalmente su window per i trigger onclick dell'HTML
    window.addTeam = () => this.addTeam();
    window.deleteTeam = (id) => this.deleteTeam(id);
    window.prepareEditTeam = (id, name, owner, logo, motto, desc) => this.prepareEditTeam(id, name, owner, logo, motto, desc);
    window.cancelEditTeam = () => this.cancelEditTeam();
  },

  // 2. INTERFACCIA GRAFICA DEL FORM (Rimossi ID ed Emoji, aggiunti File Android, Motto e Descrizione)
  renderHTML() {
    return `
    <div id="sec-teams" class="admin-sec" style="display:none">
      <div class="sec-title">Gestione Squadre</div>
      <div class="card" style="max-width:500px">
        <div id="formTitle" class="label" style="margin-bottom:.5rem">Aggiungi Nuova Squadra</div>
        
        <input type="text" id="tName" class="input-login" placeholder="Nome Fantasquadra">
        <input type="text" id="tOwner" class="input-login" placeholder="Nome Presidente">
        
        <div class="label" style="font-size:.8rem; margin-top:.5rem; color:var(--text2)">Logo Squadra (Seleziona da Android)</div>
        <input type="file" id="tLogoFile" class="input-login" accept="image/png, image/jpeg, image/jpg" style="padding-top:.5rem;">
        
        <input type="text" id="tMotto" class="input-login" placeholder="Motto della squadra" style="margin-top:.5rem;">
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

  // 3. RENDERING DELLA TABELLA (Mostra l'anteprima del logo ImgBB, il motto e il tasto Modifica)
  render({ TEAMS }) {
    const tbody = document.getElementById('teamsTableBody');
    if (!tbody) return;
    tbody.innerHTML = TEAMS.map(t => {
      // Escape dei caratteri speciali per evitare bug di sintassi JavaScript nei parametri onclick
      const safeName = (t.name || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const safeOwner = (t.owner || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const safeLogo = (t.logo || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const safeMotto = (t.motto || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const safeDesc = (t.desc || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');

      // Se non c'è un logo internet, mostra uno scudetto grigio di default
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

  // 4. STATO DI MODIFICA (Attiva il form inserendo i dati esistenti della squadra cliccata)
  prepareEditTeam(id, name, owner, logo, motto, desc) {
    this.isEditing = true;
    this.editingId = id;
    this.currentLogoUrl = logo === 'undefined' ? '' : logo;

    document.getElementById('formTitle').textContent = "Modifica Squadra (" + id + ")";
    document.getElementById('tName').value = name;
    document.getElementById('tOwner').value = owner;
    document.getElementById('tMotto').value = motto === 'undefined' ? '' : motto;
    document.getElementById('tDesc').value = desc === 'undefined' ? '' : desc;
    
    document.getElementById('tLogoFile').value = ''; // Svuota l'input file (facoltativo ricaricarlo)
    document.getElementById('btnSubmitTeam').textContent = "Salva Modifiche";
    document.getElementById('btnCancelEdit').style.display = "inline-flex";
  },

  // 5. ANNULLA MODIFICA (Ripristina il form allo stato originale di creazione vuoto)
  cancelEditTeam() {
    this.isEditing = false;
    this.editingId = null;
    this.currentLogoUrl = '';

    document.getElementById('formTitle').textContent = "Aggiungi Nuova Squadra";
    ['tName', 'tOwner', 'tLogoFile', 'tMotto', 'tDesc'].forEach(f => document.getElementById(f).value = '');
    
    document.getElementById('btnSubmitTeam').textContent = "Crea Squadra";
    document.getElementById('btnCancelEdit').style.display = "none";
  },

  // 6. CREAZIONE E AGGIORNAMENTO LOGICO (Gestisce l'upload automatico e il salvataggio Firebase)
  async addTeam() {
    const name = document.getElementById('tName').value.trim();
    const owner = document.getElementById('tOwner').value.trim();
    const motto = document.getElementById('tMotto').value.trim();
    const desc = document.getElementById('tDesc').value.trim();
    const fileInput = document.getElementById('tLogoFile');
    
    if (!name) return window.toast("Il Nome della squadra è obbligatorio!", "err");
    
    // Feedback visivo di caricamento per l'utente Android
    const btnSubmit = document.getElementById('btnSubmitTeam');
    const originalBtnText = btnSubmit.textContent;
    btnSubmit.textContent = "Caricamento Immagine...";
    btnSubmit.disabled = true;

    try {
      let targetId = this.editingId;
      
      if (!this.isEditing) {
        // Generazione ID automatica (slug testuale pulito dai caratteri speciali)
        targetId = name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().replace(/\s+/g, '-');
        if (!targetId) throw new Error("Nome non valido per generare un ID");
      }

      let finalLogoUrl = this.isEditing ? this.currentLogoUrl : '';

      // Se l'utente ha selezionato un file immagine da Android, eseguiamo l'upload su ImgBB
      if (fileInput.files.length > 0) {