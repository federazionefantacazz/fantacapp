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
        <div class="card" style="max-width: 600px; margin-bottom: 1.5rem;">
          <div class="label" style="color: var(--accent); margin-bottom: 1rem; font-size: .85rem;">Seleziona Competizione</div>

          <label class="label">Competizione</label>
          <select id="themeCompSelect" class="input-login" onchange="window.onThemeCompChange(this.value)">
            <option value="">-- Seleziona una competizione --</option>
          </select>
        </div>

        <!-- Sfondo Competizione -->
        <div class="card" style="max-width: 600px; margin-bottom: 1.5rem;">
          <div class="label" style="color: var(--accent); margin-bottom: 1rem; font-size: .85rem;">Personalizza Sfondo Competizione</div>

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

        <!-- Palette Colori Tema (CSS Variables) -->
        <div class="card" style="max-width: 600px;">
          <div class="label" style="color: var(--accent); margin-bottom: 1rem; font-size: .85rem;">Personalizza Palette Colori Tema</div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: .8rem; margin-bottom: 1rem;">
            <div>
              <label class="label">Sfondo Principale (--bg)</label>
              <div style="display: flex; gap: .5rem; align-items: center;">
                <input type="color" id="theme-color-bg" class="input-login" style="padding: 0; height: 38px; width: 50px; cursor: pointer;">
                <input type="text" id="theme-text-bg" class="input-login" style="margin-bottom: 0;" placeholder="#1a1e24">
              </div>
            </div>
            <div>
              <label class="label">Sfondo Secondario (--bg2)</label>
              <div style="display: flex; gap: .5rem; align-items: center;">
                <input type="color" id="theme-color-bg2" class="input-login" style="padding: 0; height: 38px; width: 50px; cursor: pointer;">
                <input type="text" id="theme-text-bg2" class="input-login" style="margin-bottom: 0;" placeholder="#22272f">
              </div>
            </div>
            <div>
              <label class="label">Sfondo Input (--bg3)</label>
              <div style="display: flex; gap: .5rem; align-items: center;">
                <input type="color" id="theme-color-bg3" class="input-login" style="padding: 0; height: 38px; width: 50px; cursor: pointer;">
                <input type="text" id="theme-text-bg3" class="input-login" style="margin-bottom: 0;" placeholder="#2b323c">
              </div>
            </div>
            <div>
              <label class="label">Colore Schede (--card)</label>
              <div style="display: flex; gap: .5rem; align-items: center;">
                <input type="color" id="theme-color-card" class="input-login" style="padding: 0; height: 38px; width: 50px; cursor: pointer;">
                <input type="text" id="theme-text-card" class="input-login" style="margin-bottom: 0;" placeholder="#282e37">
              </div>
            </div>
            <div>
              <label class="label">Sub-box (--card2)</label>
              <div style="display: flex; gap: .5rem; align-items: center;">
                <input type="color" id="theme-color-card2" class="input-login" style="padding: 0; height: 38px; width: 50px; cursor: pointer;">
                <input type="text" id="theme-text-card2" class="input-login" style="margin-bottom: 0;" placeholder="#333a46">
              </div>
            </div>
            <div>
              <label class="label">Colore Accento (--accent)</label>
              <div style="display: flex; gap: .5rem; align-items: center;">
                <input type="color" id="theme-color-accent" class="input-login" style="padding: 0; height: 38px; width: 50px; cursor: pointer;">
                <input type="text" id="theme-text-accent" class="input-login" style="margin-bottom: 0;" placeholder="#50e3c2">
              </div>
            </div>
            <div>
              <label class="label">Accento 2 (--accent2)</label>
              <div style="display: flex; gap: .5rem; align-items: center;">
                <input type="color" id="theme-color-accent2" class="input-login" style="padding: 0; height: 38px; width: 50px; cursor: pointer;">
                <input type="text" id="theme-text-accent2" class="input-login" style="margin-bottom: 0;" placeholder="#64748b">
              </div>
            </div>
            <div>
              <label class="label">Accento 3 / Errore (--accent3)</label>
              <div style="display: flex; gap: .5rem; align-items: center;">
                <input type="color" id="theme-color-accent3" class="input-login" style="padding: 0; height: 38px; width: 50px; cursor: pointer;">
                <input type="text" id="theme-text-accent3" class="input-login" style="margin-bottom: 0;" placeholder="#ff6b6b">
              </div>
            </div>
            <div>
              <label class="label">Oro Ambrato (--gold)</label>
              <div style="display: flex; gap: .5rem; align-items: center;">
                <input type="color" id="theme-color-gold" class="input-login" style="padding: 0; height: 38px; width: 50px; cursor: pointer;">
                <input type="text" id="theme-text-gold" class="input-login" style="margin-bottom: 0;" placeholder="#f5a623">
              </div>
            </div>
            <div>
              <label class="label">Testo Principale (--text)</label>
              <div style="display: flex; gap: .5rem; align-items: center;">
                <input type="color" id="theme-color-text" class="input-login" style="padding: 0; height: 38px; width: 50px; cursor: pointer;">
                <input type="text" id="theme-text-text" class="input-login" style="margin-bottom: 0;" placeholder="#e2e8f0">
              </div>
            </div>
            <div>
              <label class="label">Testo Secondario (--text2)</label>
              <div style="display: flex; gap: .5rem; align-items: center;">
                <input type="color" id="theme-color-text2" class="input-login" style="padding: 0; height: 38px; width: 50px; cursor: pointer;">
                <input type="text" id="theme-text-text2" class="input-login" style="margin-bottom: 0;" placeholder="#94a3b8">
              </div>
            </div>
            <div>
              <label class="label">Testo Terziario (--text3)</label>
              <div style="display: flex; gap: .5rem; align-items: center;">
                <input type="color" id="theme-color-text3" class="input-login" style="padding: 0; height: 38px; width: 50px; cursor: pointer;">
                <input type="text" id="theme-text-text3" class="input-login" style="margin-bottom: 0;" placeholder="#475569">
              </div>
            </div>
            <div style="grid-column: span 2;">
              <label class="label">Tab Inattivi (--navInactive)</label>
              <div style="display: flex; gap: .5rem; align-items: center;">
                <input type="color" id="theme-color-navInactive" class="input-login" style="padding: 0; height: 38px; width: 50px; cursor: pointer;">
                <input type="text" id="theme-text-navInactive" class="input-login" style="margin-bottom: 0;" placeholder="#64748b">
              </div>
            </div>
          </div>

          <div style="display: flex; gap: .8rem; margin-top: 1.5rem;">
            <button id="btn-save-theme-colors" class="btn btn-green" onclick="window.salvaPaletteColori()" style="flex: 1;">🎨 Salva Palette</button>
            <button id="btn-reset-theme-colors" class="btn btn-red" onclick="window.resetPaletteColori()" style="width: auto;">🗑️ Reset Tema</button>
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
    const themeKeys = ['bg', 'bg2', 'bg3', 'card', 'card2', 'accent', 'accent2', 'accent3', 'gold', 'text', 'text2', 'text3', 'navInactive'];

    // Sincronizzazione bidirezionale input color e text
    themeKeys.forEach(key => {
      window.setTimeout(() => {
        const colorInput = document.getElementById(`theme-color-${key}`);
        const textInput = document.getElementById(`theme-text-${key}`);
        if (colorInput && textInput) {
          colorInput.addEventListener('input', (e) => { textInput.value = e.target.value; });
          textInput.addEventListener('input', (e) => {
            if (e.target.value.startsWith('#') && (e.target.value.length === 4 || e.target.value.length === 7)) {
              colorInput.value = e.target.value;
            }
          });
        }
      }, 100);
    });

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
        themeKeys.forEach(k => {
          const ci = document.getElementById(`theme-color-${k}`);
          const ti = document.getElementById(`theme-text-${k}`);
          if (ci) ci.value = '#000000';
          if (ti) ti.value = '';
        });
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

      // Popola i campi colore della palette in base al tema salvato
      const themeData = (comp && comp.theme) ? comp.theme : {};
      themeKeys.forEach(k => {
        const ci = document.getElementById(`theme-color-${k}`);
        const ti = document.getElementById(`theme-text-${k}`);
        const val = themeData[k] || '';
        if (ti) ti.value = val;
        if (ci) {
          if (val.startsWith('#')) ci.value = val;
        }
      });
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
        
        const cleanBgFile = new File(
          [originalBgFile], 
          `bg-${compId}.${extensionBg}`, 
          { type: mimeTypeBg }
        );

        const uploadedBgUrl = await uploadBackgroundToImgBB(cleanBgFile);

        if (!uploadedBgUrl) {
          throw new Error("Impossibile caricare l'immagine su ImgBB");
        }

        await update(ref(database, `competitions/${compId}`), {
          backgroundImage: uploadedBgUrl
        });

        window.toast("Sfondo aggiornato con successo!", "ok");

        const newBgInput = bgFileInput.cloneNode(true);
        newBgInput.value = '';
        bgFileInput.parentNode.replaceChild(newBgInput, bgFileInput);

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

    // Salva Palette Colori Tema
    window.salvaPaletteColori = async () => {
      if (!database) return console.error("Database non inizializzato");
      const select = document.getElementById('themeCompSelect');
      const compId = select ? select.value : '';

      if (!compId) {
        return window.toast("Seleziona una competizione!", "err");
      }

      const newTheme = {};
      themeKeys.forEach(k => {
        const ti = document.getElementById(`theme-text-${k}`);
        if (ti && ti.value.trim() !== "") {
          newTheme[k] = ti.value.trim();
        }
      });

      try {
        await update(ref(database, `competitions/${compId}`), {
          theme: newTheme
        });

        window.toast("Palette colori salvata con successo!", "ok");

        const comp = ThemesSection.competitionsCache.find(c => c.id === compId);
        if (comp) comp.theme = newTheme;

      } catch (err) {
        console.error("Errore salvataggio palette colori:", err);
        window.toast("Errore durante il salvataggio della palette", "err");
      }
    };

    // Reset/Rimuovi Palette Colori Tema
    window.resetPaletteColori = async () => {
      if (!database) return;
      const select = document.getElementById('themeCompSelect');
      const compId = select ? select.value : '';

      if (!compId) return;

      if (confirm("Sei sicuro di voler resettare la palette colori personalizzata per questa competizione?")) {
        try {
          await update(ref(database, `competitions/${compId}`), {
            theme: null
          });

          window.toast("Palette colori resettata!", "info");

          const comp = ThemesSection.competitionsCache.find(c => c.id === compId);
          if (comp) comp.theme = null;
          window.onThemeCompChange(compId);

        } catch (err) {
          console.error("Errore reset palette:", err);
          window.toast("Errore durante il reset della palette", "err");
        }
      }
    };
  }
};
