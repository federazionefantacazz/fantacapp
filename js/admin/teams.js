import { ref, set, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
// IMPORTA IL SERVIZIO CENTRALIZZATO PER L'UPLOAD (Verifica che il percorso relativo sia corretto)
import { uploadImageToImgBB } from "../services/integrationImgBB.js"; 
import { cropImage } from "../components/ImageCropper.js";
import { createStaffEditor } from "../components/StaffEditor.js";
import { getStaff, staffToSave, titleOf } from "../services/staffService.js";

export const TeamsSection = {
  db: null,
  isEditing: false,    // Flag per capire se siamo in modalità "Crea" o "Modifica"
  editingId: null,     // Memorizza l'ID della squadra che stiamo modificando
  currentLogoUrl: '',  // Tiene in memoria il vecchio logo se non viene cambiato in modifica
  croppedLogo: null,   // Logo scelto e ritagliato, da caricare al salvataggio

  // 1. PUNTO DI INIZIALIZZAZIONE (Riceve solo l'istanza db di Firebase Realtime)
  init(databaseInstance) {
    this.db = databaseInstance;
    
    // Esponiamo le funzioni globalmente su window per i trigger onclick dell'HTML
    window.addTeam = () => this.addTeam();
    window.deleteTeam = (id) => this.deleteTeam(id);
    window.prepareEditTeam = (id, name, owner, logo, motto, desc) => this.prepareEditTeam(id, name, owner, logo, motto, desc);
    window.cancelEditTeam = () => this.cancelEditTeam();

    // Appena si sceglie il logo si apre il ritaglio
    document.addEventListener('change', (e) => {
      if (e.target && e.target.id === 'tLogoFile') this.cropLogo(e.target);
    });
  },

  async cropLogo(input) {
    this.croppedLogo = null;
    const file = input.files && input.files[0];
    if (!file) return;
    const logo = await cropImage(file);
    if (!logo) { input.value = ''; return; } // annullato: nessun logo nuovo
    this.croppedLogo = logo;
  },

  // 2. INTERFACCIA GRAFICA DEL FORM (Rimossi ID ed Emoji, aggiunti File Android, Motto e Descrizione)
  renderHTML() {
    return `
    <div id="sec-teams" class="admin-sec" style="display:none">
      <div class="sec-title">Gestione Squadre</div>
      <div class="card" style="max-width:500px">
        <div id="formTitle" class="label" style="margin-bottom:.5rem">Aggiungi Nuova Squadra</div>
        
        <input type="text" id="tName" class="input-login" placeholder="Nome Fantasquadra">
        <div class="label" style="font-size:.8rem; margin-top:.2rem; color:var(--text2);font-family:var(--font-sub,inherit)">Presidenza</div>
        <div id="tStaff" style="margin-bottom:1rem;"></div>
        
        <div class="label" style="font-size:.8rem; margin-top:.5rem; color:var(--text2);font-family:var(--font-sub,inherit)">Logo Squadra (Seleziona da Android)</div>
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

  // 3. RENDERING DELLA TABELLA (Loghi ingranditi a 48px e centrati)
  render({ TEAMS }) {
    this.teamsCache = TEAMS || [];
    // editor della presidenza (Presidente / Copresidenti / altri titoli), creato una volta
    const staffBox = document.getElementById('tStaff');
    if (staffBox && (!this.staffEditor || this.staffBox !== staffBox)) {
      this.staffBox = staffBox;
      this.staffEditor = createStaffEditor(staffBox, []);
    }
    const tbody = document.getElementById('teamsTableBody');
    if (!tbody) return;
    tbody.innerHTML = TEAMS.map(t => {
      // FUNZIONE HELPER: Pulisce apici, virgolette e rimuove gli andate a capo (sostituiti con uno spazio)
      const clean = (str) => (str || '')
        .replace(/'/g, "\\'")
        .replace(/"/g, '&quot;')
        .replace(/\r?\n|\r/g, ' ');

      const safeName = clean(t.name);
      const safeOwner = clean(t.owner);
      const safeLogo = clean(t.logo);
      const safeMotto = clean(t.motto);
      const safeDesc = clean(t.desc);

      // Loghi modificati: portati da 32px a 48px con object-fit proporzionale
      const logoHtml = t.logo 
        ? `<img src="${t.logo}" alt="Logo" style="width:48px; height:48px; object-fit:contain; border-radius:6px; vertical-align:middle;">`
        : `<div style="width:48px; height:48px; background:var(--bg3); display:flex; align-items:center; justify-content:center; border-radius:6px; font-size:1.5rem; color:var(--text3);font-family:var(--font-text3,inherit); vertical-align:middle;"><i class="ri-shield-line"></i></div>`;

      return `
      <tr>
        <td style="width:60px; text-align:center;">${logoHtml}</td>
        <td style="vertical-align:middle;">
          <strong>${t.name}</strong>
          ${t.motto ? `<br><small style="color:var(--text2);font-family:var(--font-sub,inherit); font-style:italic;">"${t.motto}"</small>` : ''}
        </td>
        <td style="vertical-align:middle;">${getStaff(t).map(m => `${m.name} <small style="color:var(--text2);font-family:var(--font-sub,inherit);">(${titleOf(m)})</small>`).join('<br>') || '—'}</td>
        <td style="vertical-align:middle;"><span class="badge badge-green">${t.pts || 0} pts</span></td>
        <td style="vertical-align:middle;">
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
    const team = (this.teamsCache || []).find(t => String(t.id) === String(id));
    if (this.staffEditor) this.staffEditor.set(team ? getStaff(team) : (owner && owner !== 'undefined' ? [{ name: owner, role: 'presidente' }] : []));
    document.getElementById('tMotto').value = motto === 'undefined' ? '' : motto;
    document.getElementById('tDesc').value = desc === 'undefined' ? '' : desc;
    
    document.getElementById('tLogoFile').value = ''; // Svuota l'input file (facoltativo ricaricarlo)
    this.croppedLogo = null;
    document.getElementById('btnSubmitTeam').textContent = "Salva Modifiche";
    document.getElementById('btnCancelEdit').style.display = "inline-flex";
  },

  // 5. ANNULLA MODIFICA (Ripristina il form allo stato originale di creazione vuoto)
  cancelEditTeam() {
    this.isEditing = false;
    this.editingId = null;
    this.currentLogoUrl = '';
    this.croppedLogo = null;

    document.getElementById('formTitle').textContent = "Aggiungi Nuova Squadra";
    ['tName', 'tLogoFile', 'tMotto', 'tDesc'].forEach(f => document.getElementById(f).value = '');
    if (this.staffEditor) this.staffEditor.set([]);
    
    document.getElementById('btnSubmitTeam').textContent = "Crea Squadra";
    document.getElementById('btnCancelEdit').style.display = "none";
  },

  // 6. CREAZIONE E AGGIORNAMENTO LOGICO (Gestisce l'upload automatico e il salvataggio Firebase)
  async addTeam() {
    const name = document.getElementById('tName').value.trim();
    // presidenza facoltativa per il Patron: se c'è almeno un nome deve rispettare le regole
    const staffList = this.staffEditor ? this.staffEditor.get() : [];
    const hasStaff = staffList.some(m => m.name);
    if (hasStaff && this.staffEditor.error()) return window.toast(this.staffEditor.error(), "err");
    const { staff, owner } = hasStaff ? staffToSave(staffList) : { staff: null, owner: '' };
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
        const file = this.croppedLogo || fileInput.files[0];
        // Chiama la logica condivisa nel file di integrazione esterno
        finalLogoUrl = await uploadImageToImgBB(file);
      }

      if (this.isEditing) {
        // MODIFICA: Aggiorna solo l'anagrafica preservando punti storici e record di gioco
        await update(ref(this.db, 'teams/' + targetId), { name, owner, staff, logo: finalLogoUrl, motto, desc });
        window.toast("Squadra aggiornata con successo!", "ok");
        this.cancelEditTeam();
      } else {
        // CREAZIONE: Salva una nuova squadra azzerando i parametri della classifica
        await set(ref(this.db, 'teams/' + targetId), { 
          id: targetId, name, owner, staff, logo: finalLogoUrl, motto, desc,
          pts: 0, lastGW: 0, w: 0, d: 0, l: 0 
        });
        window.toast("Squadra creata con successo!", "ok");
        ['tName', 'tLogoFile', 'tMotto', 'tDesc'].forEach(f => document.getElementById(f).value = '');
        if (this.staffEditor) this.staffEditor.set([]);
        this.croppedLogo = null;
      }
    } catch (err) { 
      window.toast(err.message || "Errore durante il salvataggio", "err"); 
    } finally {
      // Ripristina lo stato del bottone d'invio
      btnSubmit.textContent = originalBtnText;
      btnSubmit.disabled = false;
    }
  },

  // 7. ELIMINAZIONE SQUADRA (Rimuove il nodo e resetta il form in caso di cancellazione concorrente)
  async deleteTeam(id) {
    if (confirm("Vuoi davvero eliminare questa squadra?")) {
      try { 
        await set(ref(this.db, 'teams/' + id), null); 
        window.toast("Squadra eliminata.", "ok");
        // Se elimini la stessa squadra che stavi modificando a schermo, pulisci il form
        if (this.isEditing && this.editingId === id) {
          this.cancelEditTeam();
        }
      } catch (err) { 
        window.toast("Errore nell'eliminazione", "err"); 
      }
    }
  }
};