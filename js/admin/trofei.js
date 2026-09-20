import { ref, set, update, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { uploadImageToImgBB } from "../services/integrationImgBB.js";

let database = null;

export const TrofeiSection = {
  isEditing: false,
  editingId: null,
  currentImageUrl: '',

  init(db) {
    database = db;
    window.addTrophy = () => this.addTrophy();
    window.deleteTrophy = (id) => this.deleteTrophy(id);
    window.prepareEditTrophy = (id, name, desc, image) => this.prepareEditTrophy(id, name, desc, image);
    window.cancelEditTrophy = () => this.cancelEditTrophy();
  },

  renderHTML() {
    return `
    <div id="sec-trofei" class="admin-sec" style="display:none">
      <div class="sec-title">🏆 Gestione Trofei</div>
      
      <div class="card" style="max-width:500px">
        <div id="formTitleTrophy" class="label" style="color:var(--accent); margin-bottom:.5rem">Aggiungi Nuovo Trofeo</div>
        
        <input type="text" id="trName" class="input-login" placeholder="Nome Trofeo (es: Coppa delle Coppe, Scudetto)">
        <textarea id="trDesc" class="input-login" placeholder="Descrizione o note sul trofeo" style="min-height:70px; font-family:inherit; resize:vertical;"></textarea>
        
        <div class="label" style="font-size:.8rem; margin-top:.5rem; color:var(--text2)">Immagine / Icona Trofeo (.png, .jpg)</div>
        <input type="file" id="trImageFile" class="input-login" accept="image/png, image/jpeg, image/jpg" style="padding-top:.5rem;">
        
        <div style="display:flex; gap:.5rem; margin-top:.5rem;">
          <button id="btnSubmitTrophy" class="btn btn-green" onclick="window.addTrophy()">Crea Trofeo</button>
          <button id="btnCancelEditTrophy" class="btn btn-red" style="display:none; width:auto;" onclick="window.cancelEditTrophy()">Annulla</button>
        </div>
      </div>
      
      <div class="card">
        <div class="label">Trofei Registrati</div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr><th>Icona</th><th>Nome Trofeo</th><th>Descrizione</th><th>Azioni</th></tr>
            </thead>
            <tbody id="trophiesTableBody">
              <tr><td colspan="4" style="text-align:center">Caricamento trofei...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
  },

  render({ trophies = [] }) {
    const tbody = document.getElementById('trophiesTableBody');
    if (!tbody) return;

    if (!trophies || trophies.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text3)">Nessun trofeo creato. Usa il modulo sopra per aggiungerne uno.</td></tr>`;
      return;
    }

    tbody.innerHTML = trophies.map(t => {
      const clean = (str) => (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\r?\n|\r/g, ' ');
      const safeName = clean(t.name);
      const safeDesc = clean(t.desc);
      const safeImage = clean(t.image);

      const imageHtml = t.image 
        ? `<img src="${t.image}" alt="Trofeo" style="width:48px; height:48px; object-fit:contain; border-radius:6px; vertical-align:middle;">`
        : `<div style="width:48px; height:48px; background:var(--bg3); display:flex; align-items:center; justify-content:center; border-radius:6px; font-size:1.5rem; color:var(--gold); vertical-align:middle;">🏆</div>`;

      return `
      <tr>
        <td style="width:60px; text-align:center; vertical-align:middle;">${imageHtml}</td>
        <td style="vertical-align:middle;"><strong>${t.name}</strong></td>
        <td style="vertical-align:middle; color:var(--text2); font-size:.85rem;">${t.desc || '—'}</td>
        <td style="vertical-align:middle;">
          <div style="display:flex; gap:.25rem;">
            <button class="btn btn-blue" style="padding:.25rem .5rem; font-size:.75rem; width:auto" onclick="window.prepareEditTrophy('${t.id}', '${safeName}', '${safeDesc}', '${safeImage}')">Modifica</button>
            <button class="btn btn-red" style="padding:.25rem .5rem; font-size:.75rem; width:auto" onclick="window.deleteTrophy('${t.id}')">Elimina</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  },

  prepareEditTrophy(id, name, desc, image) {
    this.isEditing = true;
    this.editingId = id;
    this.currentImageUrl = image === 'undefined' ? '' : image;

    document.getElementById('formTitleTrophy').textContent = "Modifica Trofeo (" + id + ")";
    document.getElementById('trName').value = name;
    document.getElementById('trDesc').value = desc === 'undefined' ? '' : desc;
    document.getElementById('trImageFile').value = '';

    document.getElementById('btnSubmitTrophy').textContent = "Salva Modifiche";
    document.getElementById('btnSubmitTrophy').className = "btn btn-blue";
    document.getElementById('btnCancelEditTrophy').style.display = "inline-flex";
  },

  cancelEditTrophy() {
    this.isEditing = false;
    this.editingId = null;
    this.currentImageUrl = '';

    document.getElementById('formTitleTrophy').textContent = "Aggiungi Nuovo Trofeo";
    document.getElementById('trName').value = '';
    document.getElementById('trDesc').value = '';
    document.getElementById('trImageFile').value = '';

    document.getElementById('btnSubmitTrophy').textContent = "Crea Trofeo";
    document.getElementById('btnSubmitTrophy').className = "btn btn-green";
    document.getElementById('btnCancelEditTrophy').style.display = "none";
  },

  async addTrophy() {
    const name = document.getElementById('trName').value.trim();
    const desc = document.getElementById('trDesc').value.trim();
    const fileInput = document.getElementById('trImageFile');

    if (!name) return window.toast("Il Nome del trofeo è obbligatorio!", "err");

    const btnSubmit = document.getElementById('btnSubmitTrophy');
    const originalBtnText = btnSubmit.textContent;
    btnSubmit.textContent = "Caricamento Immagine...";
    btnSubmit.disabled = true;

    try {
      let targetId = this.editingId;

      if (!this.isEditing) {
        targetId = name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().replace(/\s+/g, '-');
        if (!targetId) throw new Error("Nome non valido per generare un ID");
      }

      let finalImageUrl = this.isEditing ? this.currentImageUrl : '';

      if (fileInput && fileInput.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        finalImageUrl = await uploadImageToImgBB(file);
      }

      const payload = { id: targetId, name, desc, image: finalImageUrl };

      if (this.isEditing) {
        await update(ref(database, 'trophies/' + targetId), payload);
        window.toast("Trofeo aggiornato con successo!", "ok");
      } else {
        await set(ref(database, 'trophies/' + targetId), payload);
        window.toast("Trofeo creato con successo!", "ok");
      }

      this.cancelEditTrophy();
    } catch (err) {
      window.toast(err.message || "Errore durante il salvataggio", "err");
    } finally {
      btnSubmit.textContent = originalBtnText;
      btnSubmit.disabled = false;
    }
  },

  async deleteTrophy(id) {
    if (confirm("Vuoi davvero eliminare questo trofeo?")) {
      try {
        await remove(ref(database, 'trophies/' + id));
        window.toast("Trofeo eliminato.", "ok");
        if (this.isEditing && this.editingId === id) this.cancelEditTrophy();
      } catch (err) {
        window.toast("Errore nell'eliminazione del trofeo", "err");
      }
    }
  }
};
