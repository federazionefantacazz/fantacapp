import { ref, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { uploadBackgroundToImgBB } from "../services/integrationImgBB.js";
import { THEME_PAGES, THEME_VERSION, normalizeTheme } from "../services/themeService.js";

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

        <!-- Tema per pagina e per tipo -->
        <div class="card" style="max-width: 760px;">
          <div class="label" style="color: var(--accent); margin-bottom: 1rem; font-size: .85rem;">Personalizza Tema per Pagina</div>

          <div style="font-size: .75rem; color: var(--text3); margin-bottom: .8rem;">
            Scegli la pagina, poi imposta i singoli tipi (titoli, testi, sottotesti, label, pulsanti, testi dei pulsanti).
            Quello che lasci vuoto eredita da <strong>Generale</strong>. Il nome sotto ogni campo è la variabile CSS usata nell'app.
          </div>

          <div id="themeLegacyNotice" style="display:none; font-size:.75rem; color: var(--gold); margin-bottom: .8rem;">
            Questa competizione ha un tema nel vecchio formato: è stato convertito qui sotto e passerà al nuovo formato al primo salvataggio.
          </div>

          <div id="themePageTabs" style="display: flex; flex-wrap: wrap; gap: .4rem; margin-bottom: 1rem;">
            ${THEME_PAGES.map((pg, i) => `
              <button type="button" class="btn ${i === 0 ? 'btn-blue' : ''}" data-theme-page="${pg.key}"
                onclick="window.switchThemePage('${pg.key}')"
                style="padding: .35rem .7rem; font-size: .8rem; width: auto; ${i === 0 ? '' : 'background: var(--bg3); color: var(--text2);'}">${pg.label}</button>`).join('')}
          </div>

          ${this.renderPagePanels()}

          <div style="display: flex; gap: .8rem; margin-top: 1.5rem;">
            <button id="btn-save-theme-colors" class="btn btn-green" onclick="window.salvaPaletteColori()" style="flex: 1;">🎨 Salva Tema</button>
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

  renderField(page, v) {
    const id = `${page.key}__${v.key}`;
    return `
            <div>
              <label class="label" style="text-transform: none; letter-spacing: 0; margin-bottom: .1rem;">${v.label || v.hint}</label>
              <div style="font-family: 'DM Mono', monospace; font-size: .68rem; color: var(--text3); margin-bottom: .3rem;">${v.css}${v.label ? ' · ' + v.hint : ''}</div>
              <div style="display: flex; gap: .5rem; align-items: center;">
                ${v.kind === 'color'
                  ? `<input type="color" id="theme-color-${id}" class="input-login" value="${v.def}" style="padding: 0; height: 38px; width: 50px; cursor: pointer; margin-bottom: 0;">`
                  : ''}
                <input type="text" id="theme-text-${id}" class="input-login" style="margin-bottom: 0;" placeholder="${v.def}">
              </div>
            </div>`;
  },

  renderPagePanels() {
    return THEME_PAGES.map((page, i) => {
      // i campi si raggruppano per "group" (solo la pagina Generale ne ha)
      const groups = [];
      page.fields.forEach(f => {
        const name = f.group || '';
        let g = groups.find(x => x.name === name);
        if (!g) groups.push(g = { name, fields: [] });
        g.fields.push(f);
      });
      return `
        <div id="theme-page-${page.key}" class="theme-page-panel" style="display: ${i === 0 ? 'block' : 'none'};">
          <div style="font-size: .8rem; color: var(--text2); margin-bottom: .2rem;">${page.desc}</div>
          <div style="font-family: 'DM Mono', monospace; font-size: .7rem; color: var(--text3); margin-bottom: 1rem;">Ambito CSS: ${page.selector}</div>
          ${groups.map(g => `
            ${g.name ? `<div class="label" style="color: var(--accent); margin: 1rem 0 .6rem;">${g.name}</div>` : ''}
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: .8rem;">
              ${g.fields.map(f => this.renderField(page, f)).join('')}
            </div>`).join('')}
        </div>`;
    }).join('');
  },

  render(globalState) {
    const comps = globalState.competitions || [];
    this.competitionsCache = comps;

    const select = document.getElementById('themeCompSelect');
    if (!select) return;

    const currentSelected = select.value;

    select.innerHTML = `<option value="">-- Seleziona una competizione --</option>` +  
      comps.map(c => `<option value="${c.id}" ${c.id === currentSelected ? 'selected' : ''}>${c.name} (${c.id})</option>`).join('');

    // Ripopola i campi solo se è cambiata la competizione o il suo tema/sfondo nel DB:
    // altrimenti un aggiornamento in tempo reale cancellerebbe le modifiche non ancora salvate
    if (currentSelected) {
      const comp = comps.find(c => c.id === currentSelected);
      const sig = currentSelected + JSON.stringify([comp && comp.theme, comp && comp.backgroundImage]);
      if (sig !== this._lastSig) {
        this._lastSig = sig;
        window.onThemeCompChange(currentSelected);
      }
    }
  },

  registerGlobalActions() {
    // elenco piatto di tutti i campi: id = "pagina__tipo"
    const allFields = THEME_PAGES.flatMap(pg => pg.fields.map(f => ({ page: pg.key, key: f.key, id: `${pg.key}__${f.key}`, def: f.def })));

    // Sincronizzazione bidirezionale input color e text (delegata: funziona anche se il markup viene creato dopo)
    document.addEventListener('input', (e) => {
      const id = e.target && e.target.id;
      if (!id) return;
      if (id.startsWith('theme-color-')) {
        const textInput = document.getElementById('theme-text-' + id.slice('theme-color-'.length));
        if (textInput) textInput.value = e.target.value;
      } else if (id.startsWith('theme-text-')) {
        const colorInput = document.getElementById('theme-color-' + id.slice('theme-text-'.length));
        const v = e.target.value.trim();
        if (colorInput && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) {
          colorInput.value = v.length === 4 ? '#' + [1, 2, 3].map(i => v[i] + v[i]).join('') : v;
        }
      }
    });

    // Cambio pagina del tema (le altre restano compilate, si salva tutto insieme)
    window.switchThemePage = (pageKey) => {
      THEME_PAGES.forEach(pg => {
        const panel = document.getElementById(`theme-page-${pg.key}`);
        const btn = document.querySelector(`#themePageTabs [data-theme-page="${pg.key}"]`);
        const on = pg.key === pageKey;
        if (panel) panel.style.display = on ? 'block' : 'none';
        if (btn) {
          btn.className = on ? 'btn btn-blue' : 'btn';
          btn.style.background = on ? '' : 'var(--bg3)';
          btn.style.color = on ? '' : 'var(--text2)';
        }
      });
    };

    const fillThemeFields = (themeData) => {
      allFields.forEach(f => {
        const ci = document.getElementById(`theme-color-${f.id}`);
        const ti = document.getElementById(`theme-text-${f.id}`);
        const val = (themeData && themeData[f.page] && themeData[f.page][f.key]) || '';
        if (ti) ti.value = val;
        if (ci) ci.value = /^#[0-9a-fA-F]{6}$/.test(val) ? val : f.def;
      });
    };

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
      ThemesSection._lastSig = null;
      const previewContainer = document.getElementById('themePreviewContainer');
      const bgPreview = document.getElementById('themeBgPreview');
      const btnRemove = document.getElementById('btn-remove-theme-bg');

      if (!compId || !previewContainer || !bgPreview) {
        if (previewContainer) previewContainer.style.display = 'none';
        fillThemeFields(null);
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

      // Popola i campi in base al tema salvato (un tema nel vecchio formato viene convertito al volo)
      const saved = comp ? comp.theme : null;
      const notice = document.getElementById('themeLegacyNotice');
      if (notice) notice.style.display = (saved && Number(saved.v) !== THEME_VERSION && normalizeTheme(saved)) ? 'block' : 'none';
      fillThemeFields(normalizeTheme(saved));
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

      // { v: 2, home: { title: '#...' }, ... } : le pagine senza valori non vengono salvate
      const newTheme = { v: THEME_VERSION };
      allFields.forEach(f => {
        const ti = document.getElementById(`theme-text-${f.id}`);
        if (ti && ti.value.trim() !== "") {
          (newTheme[f.page] = newTheme[f.page] || {})[f.key] = ti.value.trim();
        }
      });
      const isEmpty = Object.keys(newTheme).length === 1;

      try {
        await update(ref(database, `competitions/${compId}`), {
          theme: isEmpty ? null : newTheme
        });

        window.toast("Tema salvato con successo!", "ok");

        const comp = ThemesSection.competitionsCache.find(c => c.id === compId);
        if (comp) comp.theme = isEmpty ? null : newTheme;
        window.onThemeCompChange(compId);

      } catch (err) {
        console.error("Errore salvataggio palette colori:", err);
        window.toast("Errore durante il salvataggio del tema", "err");
      }
    };

    // Reset/Rimuovi Palette Colori Tema
    window.resetPaletteColori = async () => {
      if (!database) return;
      const select = document.getElementById('themeCompSelect');
      const compId = select ? select.value : '';

      if (!compId) return;

      if (confirm("Sei sicuro di voler resettare il tema personalizzato (tutte le pagine) per questa competizione?")) {
        try {
          await update(ref(database, `competitions/${compId}`), {
            theme: null
          });

          window.toast("Tema resettato!", "info");

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
