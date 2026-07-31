import { ref, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { uploadBackgroundToImgBB } from "../services/integrationImgBB.js";

let database = null;

export const ThemesSection = {
  competitionsCache: [],

  init(databaseInstance) {
    database = databaseInstance;
    this.registerGlobalActions();
  },

  renderHTML() {
    return `
    <div id="sec-themes" class="admin-sec" style="display:none">
      <div class="sec-title">🎨 Gestione Temi & Personalizzazione</div>

      <!-- NAVIGAZIONE SOTTO-MENU (TAB) -->
      <div style="display: flex; gap: .5rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: .8rem;">
        <button id="tab-btn-theme-competizioni" class="btn btn-blue" onclick="window.switchThemeSubTab('competizioni')" style="padding: .4rem .8rem; font-size: .85rem; width: auto;">
          🏆 Competizioni
        </button>
        <button id="tab-btn-theme-squadre" class="btn" onclick="window.switchThemeSubTab('squadre')" style="padding: .4rem .8rem; font-size: .85rem; width: auto; background: var(--bg3); color: var(--text2);">
          🛡️ Squadre <span style="font-size: .7rem; background: var(--gold); color: #000; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-left: 4px;">WIP</span>
        </button>
      </div>

      <!-- SOTTO-PAGINA 1: COMPETIZIONI -->
      <div id="subtab-theme-competizioni" style="display: block;">
        <div class="card" style="max-width: 600px;">
          <div class="label" style="color: var(--accent); margin-bottom: 1rem; font-size: .85rem;">Personalizza Sfondo Competizione</div>

          <label class="label">Seleziona Competizione</label>
          <select id="themeCompSelect" class="input-login" onchange="window.onThemeCompChange(this.value)">
            <option value="">-- Seleziona una competizione --</option>
          </select>

          <!-- Preview Sfondo Attuale -->
          <div id="themePreviewContainer" style="margin-top: 1rem; display: none; text-align: center;">
            <div class="label" style="font-size: .8rem; color: var(--text2); margin-bottom: .4rem;">Sfondo Attuale</div>
            <div id="themeBgPreview" style="width: 100%; height: 160px; border-radius: 8px; border: 1px solid var(--border); background-size: cover; background-position: center; background-repeat: no-repeat; background-color: var(--bg3); display: flex; align-items: center; justify-content: center; color: var(--text3); font-size: .85rem;">
              Nessun Sfondo Impostato
            </div>
            <button id="btn-remove-theme-bg" class="btn btn-red" onclick="window.rimuoviSfondoCompetizione()" style="margin-top: .5rem; padding: .3rem .6rem; font-size: .75rem; width: auto; display: none;">
              🗑️ Rimuovi Sfondo
            </button>
          </div>

          <div class="label" style="font-size:.8rem; margin-top: 1rem; color:var(--text2)">Nuova Immagine di Sfondo (.jpg, .jpeg, .png)</div>
          <input type="file" id="themeBgFile" name="themeBgFile" class="input-login" accept=".jpg, .jpeg, .png, .JPG, .JPEG, .PNG, image/jpeg, image/png" style="padding-top:.5rem;">

          <div style="margin-top: 1.5rem;">
            <button id="btn-save-theme-bg" class="btn btn-green" onclick="window.salvaSfondoCompetizione()">🎨 Salva Sfondo</button>
          </div>
        </div>
      </div>

      <!-- SOTTO-PAGINA 2: SQUADRE (WIP) -->
      <div id="subtab-theme-squadre" style="display: none;">
        <div class="card" style="text-align: center; padding: 3rem 1rem; border-left: 4px solid var(--gold); max-width: 600px;">
          <div class="num" style="font-size: 2rem; color: var(--gold); margin-bottom: 0.5rem;">⚠️ WORK IN PROGRESS</div>
          <p style="color: var(--text2); font-size: 0.95rem; max-width: 400px; margin: 0 auto; line-height: 1.5;">
            La personalizzazione dei temi e degli sfondi specifici per le <strong>Squadre</strong> è in fase di sviluppo.<br>
            Presto potrai personalizzare i colori sociali e gli sfondi dei singoli club!
          </p>
        </div>
      </div>

    </div>`;
  },

  render(globalState) {
    const comps = globalState.competitions || [];
    this.competitionsCache = comps;

    const select = document.getElementById('themeCompSelect');
    if (!select) return;

    const currentSelected = select.value;

    select.innerHTML = `<option value="">-- Seleziona una competizione --</option>` + 
      comps.map(c => `<option value="${c.id}" ${c.id === currentSelected ? 'selected' : ''}>${c.name} (${c.id})</option>`).join('');

    if (currentSelected) {
      window.onThemeCompChange(currentSelected);
    }
  },

  registerGlobalActions() {
    // Gestione cambio sotto-tab del menu Temi
    window.switchThemeSubTab = (tab) => {
      const tabComp = document.getElementById('subtab-theme-competizioni');
      const tabSquadre = document.getElementById('subtab-theme-squadre');
      const btnComp = document.getElementById('tab-btn-theme-competizioni');
      const btnSquadre = document.getElementById('tab-btn-theme-squadre');

      if (!tabComp || !tabSquadre || !btnComp || !btnSquadre) return;

      if (tab === 'competizioni') {
        tabComp.style.display = 'block';
        tabSquadre.style.display = 'none';

        btnComp.className = 'btn btn-blue';
        btnComp.style.background = '';
        btnComp.style.color = '';

        btnSquadre.className = 'btn';
        btnSquadre.style.background = 'var(--bg3)';
        btnSquadre.style.color = 'var(--text2)';
      } else if (tab === 'squadre') {
        tabComp.style.display = 'none';
        tabSquadre.style.display = 'block';

        btnSquadre.className = 'btn btn-blue';
        btnSquadre.style.background = '';
        btnSquadre.style.color = '';

        btnComp.className = 'btn';
        btnComp.style.background = 'var(--bg3)';
        btnComp.style.color = 'var(--text2)';
      }
    };

    // Cambio opzione select competizione
    window.onThemeCompChange = (compId) => {
      const previewContainer = document.getElementById('themePreviewContainer');
      const bgPreview = document.getElementById('themeBgPreview');
      const btnRemove = document.getElementById('btn-remove-theme-bg');

      if (!compId || !previewContainer || !bgPreview) {
        if (previewContainer) previewContainer.style.display = 'none';
        return;
      }

      const comp = ThemesSection.competitionsCache.find(c => c.id === compId);
      previewContainer.style.display = 'block';

      if (comp && comp.backgroundImage) {
        bgPreview.style.backgroundImage = `url('${comp.backgroundImage}')`;
        bgPreview.innerText = '';
        if (btnRemove) btnRemove.style.display = 'inline-block';
      } else {
        bgPreview.style.backgroundImage = 'none';
        bgPreview.innerText = 'Nessun Sfondo Impostato';
        if (btnRemove) btnRemove.style.display = 'none';
      }
    };

    // Salva/Aggiorna Sfondo Competizione
    window.salvaSfondoCompetizione = async () => {
      if (!database) return console.error("Database non inizializzato");

      const select = document.getElementById('themeCompSelect');
      const bgFileInput = document.getElementById('themeBgFile');
      const compId = select ? select.value : '';

      if (!compId) {
        return window.toast("Seleziona una competizione!", "err");
      }

      if (!bgFileInput || !bgFileInput.files || bgFileInput.files.length === 0) {
        return window.toast("Seleziona un'immagine di sfondo da caricare!", "err");
      }

      const btnSave = document.getElementById('btn-save-theme-bg');
      const originalText = btnSave.innerText;
      btnSave.innerText = "⌛ Caricamento Sfondo...";
      btnSave.disabled = true;

      try {
        const originalBgFile = bgFileInput.files[0];
        const mimeTypeBg = originalBgFile.type || 'image/jpeg';
        const extensionBg = mimeTypeBg.split('/')[1] || 'jpg';
        
        // Normalizzazione File per Webview Android
        const cleanBgFile = new File(
          [originalBgFile], 
          `bg-${compId}.${extensionBg}`, 
          { type: mimeTypeBg }
        );

        console.log("Inviando sfondo a ImgBB:", cleanBgFile.name);
        const uploadedBgUrl = await uploadBackgroundToImgBB(cleanBgFile);

        if (!uploadedBgUrl) {
          throw new Error("Impossibile caricare l'immagine su ImgBB");
        }

        await update(ref(database, `competitions/${compId}`), {
          backgroundImage: uploadedBgUrl
        });

        window.toast("Sfondo aggiornato con successo!", "ok");

        // Reset Input File
        const newBgInput = bgFileInput.cloneNode(true);
        newBgInput.value = '';
        bgFileInput.parentNode.replaceChild(newBgInput, bgFileInput);

        // Aggiorna la preview locale
        const comp = ThemesSection.competitionsCache.find(c => c.id === compId);
        if (comp) comp.backgroundImage = uploadedBgUrl;
        window.onThemeCompChange(compId);

      } catch (err) {
        console.error("Errore salvataggio sfondo:", err);
        window.toast(err.message || "Errore durante il caricamento dello sfondo", "err");
      } finally {
        btnSave.innerText = originalText;
        btnSave.disabled = false;
      }
    };

    // Rimuovi Sfondo Competizione
    window.rimuoviSfondoCompetizione = async () => {
      if (!database) return;
      const select = document.getElementById('themeCompSelect');
      const compId = select ? select.value : '';

      if (!compId) return;

      if (confirm("Sei sicuro di voler rimuovere lo sfondo per questa competizione?")) {
        try {
          await update(ref(database, `competitions/${compId}`), {
            backgroundImage: ""
          });

          window.toast("Sfondo rimosso!", "info");

          const comp = ThemesSection.competitionsCache.find(c => c.id === compId);
          if (comp) comp.backgroundImage = "";
          window.onThemeCompChange(compId);

        } catch (err) {
          console.error("Errore rimozione sfondo:", err);
          window.toast("Errore durante la rimozione dello sfondo", "err");
        }
      }
    };
  }
};