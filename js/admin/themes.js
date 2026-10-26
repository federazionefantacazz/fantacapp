import { ref, update, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { uploadBackgroundToImgBB } from "../services/integrationImgBB.js";
import { DiviseSection } from "./divise.js";
import { THEME_PAGES, THEME_VERSION, THEME_FONTS, normalizeTheme } from "../services/themeService.js";

let database = null;

/*
 * Temi modificabili: quelli delle competizioni (competitions/{id}) e i temi aggiuntivi
 * (themes/{id} = { name, theme, backgroundImage }), che gli utenti scelgono in Impostazioni → Tema.
 * Nel selettore il valore è "comp:<id>" oppure "custom:<id>"; tema e sfondo hanno la stessa forma.
 */
function targetOf(value) {
  const v = String(value || '');
  if (v.startsWith('custom:')) {
    const id = v.slice(7);
    const t = ThemesSection.customCache.find(x => x.id === id);
    return t ? { kind: 'custom', id, path: `themes/${id}`, data: t, name: t.name || id } : null;
  }
  const id = v.startsWith('comp:') ? v.slice(5) : v;
  const c = id && ThemesSection.competitionsCache.find(x => x.id === id);
  return c ? { kind: 'comp', id, path: `competitions/${id}`, data: c, name: c.name || id } : null;
}

const selectedTarget = () => targetOf(document.getElementById('themeCompSelect')?.value);

// firma di ciò che è nei campi: tema scelto + suo tema/sfondo nel DB
function sigOf(value) {
  const t = targetOf(value);
  return String(value || '') + JSON.stringify(t ? [t.data.theme, t.data.backgroundImage, t.name] : null);
}

export const ThemesSection = {
  competitionsCache: [],
  customCache: [],

  init(databaseInstance) {
    database = databaseInstance;
    this.registerGlobalActions();
  },

  renderHTML() {
    return `
    <div id="sec-themes" class="admin-sec" style="display:none">
      <div class="sec-title"><i class="ri-palette-line"></i> Gestione Temi & Personalizzazione</div>

      <!-- NAVIGAZIONE SOTTO-MENU (TAB) -->
      <div style="display: flex; gap: .5rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: .8rem;">
        <button id="tab-btn-theme-competizioni" class="btn btn-blue" onclick="window.switchThemeSubTab('competizioni')" style="padding: .4rem .8rem; font-size: .85rem; width: auto;">
          <i class="ri-palette-line"></i> Temi
        </button>
        <button id="tab-btn-theme-squadre" class="btn" onclick="window.switchThemeSubTab('squadre')" style="padding: .4rem .8rem; font-size: .85rem; width: auto; background: var(--bg3); color: var(--text2); font-family: var(--font-sub, inherit);">
          <i class="ri-shirt-line"></i> Squadre
        </button>
      </div>

      <!-- SOTTO-PAGINA 1: COMPETIZIONI -->
      <div id="subtab-theme-competizioni" style="display: block;">
        <div class="card" style="max-width: 600px; margin-bottom: 1.5rem;">
          <div class="label" style="color: var(--accent); margin-bottom: 1rem; font-size: .85rem;">Seleziona Tema</div>

          <label class="label">Tema da modificare</label>
          <select id="themeCompSelect" class="input-login" data-title="Tema da modificare" onchange="window.onThemeCompChange(this.value)">
            <option value="">-- Seleziona un tema --</option>
          </select>

          <div style="display: flex; gap: .5rem; flex-wrap: wrap; margin-top: .3rem;">
            <button type="button" class="btn btn-blue" onclick="window.nuovoTemaAggiuntivo()" style="width: auto; padding: .4rem .8rem; font-size: .8rem;"><i class="ri-add-line"></i> Nuovo tema</button>
            <button type="button" id="btn-dup-theme" class="btn" onclick="window.duplicaTema()" style="width: auto; padding: .4rem .8rem; font-size: .8rem; background: var(--bg3); color: var(--text2); display: none;"><i class="ri-file-copy-line"></i> Duplica</button>
            <button type="button" id="btn-ren-theme" class="btn" onclick="window.rinominaTemaAggiuntivo()" style="width: auto; padding: .4rem .8rem; font-size: .8rem; background: var(--bg3); color: var(--text2); display: none;"><i class="ri-edit-line"></i> Rinomina</button>
            <button type="button" id="btn-del-theme" class="btn btn-red" onclick="window.eliminaTemaAggiuntivo()" style="width: auto; padding: .4rem .8rem; font-size: .8rem; display: none;"><i class="ri-delete-bin-line"></i> Elimina</button>
          </div>
          <div style="font-size: .75rem; color: var(--text3); font-family: var(--font-text3, inherit); margin-top: .6rem;">
            Ogni competizione ha il suo tema. I <strong>temi aggiuntivi</strong> non sono legati a una competizione:
            gli utenti li scelgono in Impostazioni → Tema, insieme a quelli delle competizioni.
          </div>
        </div>

        <!-- Sfondo del tema -->
        <div class="card" style="max-width: 600px; margin-bottom: 1.5rem;">
          <div class="label" style="color: var(--accent); margin-bottom: 1rem; font-size: .85rem;">Personalizza Sfondo</div>

          <!-- Preview Sfondo Attuale -->
          <div id="themePreviewContainer" style="margin-top: 1rem; display: none; text-align: center;">
            <div class="label" style="font-size: .8rem; color: var(--text2); font-family: var(--font-sub, inherit); margin-bottom: .4rem;">Sfondo Attuale</div>
            <div id="themeBgPreview" style="width: 100%; height: 160px; border-radius: 8px; border: 1px solid var(--border); background-size: cover; background-position: center; background-repeat: no-repeat; background-color: var(--bg3); display: flex; align-items: center; justify-content: center; color: var(--text3); font-family: var(--font-text3, inherit); font-size: .85rem;">
              Nessun Sfondo Impostato
            </div>
            <button id="btn-remove-theme-bg" class="btn btn-red" onclick="window.rimuoviSfondoCompetizione()" style="margin-top: .5rem; padding: .3rem .6rem; font-size: .75rem; width: auto; display: none;">
              <i class="ri-delete-bin-line"></i> Rimuovi Sfondo
            </button>
          </div>

          <div class="label" style="font-size:.8rem; margin-top: 1rem; color:var(--text2);font-family:var(--font-sub,inherit)">Nuova Immagine di Sfondo (.jpg, .jpeg, .png)</div>
          <input type="file" id="themeBgFile" name="themeBgFile" class="input-login" accept=".jpg, .jpeg, .png, .JPG, .JPEG, .PNG, image/jpeg, image/png" style="padding-top:.5rem;">

          <div style="margin-top: 1.5rem;">
            <button id="btn-save-theme-bg" class="btn btn-green" onclick="window.salvaSfondoCompetizione()"><i class="ri-image-line"></i> Salva Sfondo</button>
          </div>
        </div>

        <!-- Tema per pagina e per tipo -->
        <div class="card" style="max-width: 760px;">
          <div class="label" style="color: var(--accent); margin-bottom: 1rem; font-size: .85rem;">Personalizza Tema per Pagina</div>

          <div style="font-size: .75rem; color: var(--text3); font-family: var(--font-text3, inherit); margin-bottom: .8rem;">
            Scegli la pagina, poi imposta i singoli tipi (titoli, testi, sottotesti, testi disattivati, label, pulsanti, testi dei pulsanti).
            Sotto ogni testo puoi scegliere anche il font. Quello che lasci vuoto eredita da <strong>Generale</strong>. Il nome sotto ogni campo è la variabile CSS usata nell'app.
          </div>

          <div id="themeLegacyNotice" style="display:none; font-size:.75rem; color: var(--gold); margin-bottom: .8rem;">
            Questo tema è nel vecchio formato: è stato convertito qui sotto e passerà al nuovo formato al primo salvataggio.
          </div>

          <div id="themePageTabs" style="display: flex; flex-wrap: wrap; gap: .4rem; margin-bottom: 1rem;">
            ${THEME_PAGES.map((pg, i) => `
              <button type="button" class="btn ${i === 0 ? 'btn-blue' : ''}" data-theme-page="${pg.key}"
                onclick="window.switchThemePage('${pg.key}')"
                style="padding: .35rem .7rem; font-size: .8rem; width: auto; ${i === 0 ? '' : 'background: var(--bg3); color: var(--text2); font-family: var(--font-sub, inherit);'}">${pg.label}</button>`).join('')}
          </div>

          ${this.renderPagePanels()}

          <div style="display: flex; gap: .8rem; margin-top: 1.5rem;">
            <button id="btn-save-theme-colors" class="btn btn-green" onclick="window.salvaPaletteColori()" style="flex: 1;"><i class="ri-palette-line"></i> Salva Tema</button>
            <button id="btn-reset-theme-colors" class="btn btn-red" onclick="window.resetPaletteColori()" style="width: auto;"><i class="ri-delete-bin-line"></i> Reset Tema</button>
          </div>
        </div>
      </div>

      <!-- SOTTO-PAGINA 2: SQUADRE (divise, js/admin/divise.js) -->
      <div id="subtab-theme-squadre" style="display: none;">
        ${DiviseSection.renderHTML()}
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
              ${v.font ? `
              <div style="display: flex; gap: .5rem; align-items: center; margin-top: .4rem;">
                <i class="ri-font-size" title="Font" style="color: var(--text3); width: 50px; text-align: center; flex-shrink: 0;"></i>
                <select id="theme-text-${page.key}__${v.font.key}" class="input-login" style="margin-bottom: 0;" title="${v.font.css}">
                  <option value="">${page.key === 'general' ? `Font predefinito (${v.font.defLabel})` : 'Font: come Generale'}</option>
                  ${THEME_FONTS.filter(fo => fo.css || page.key !== 'general')
                    .map(fo => `<option value="${fo.key}">${fo.css ? fo.label : `${fo.label} (${v.font.defLabel})`}</option>`).join('')}
                </select>
              </div>` : ''}
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
          <div style="font-size: .8rem; color: var(--text2); font-family: var(--font-sub, inherit); margin-bottom: .2rem;">${page.desc}</div>
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
    this.competitionsCache = globalState.competitions || [];
    this.customCache = globalState.customThemes || [];

    const select = document.getElementById('themeCompSelect');
    if (!select) return;

    // tema appena creato: si seleziona appena arriva dal DB
    let currentSelected = this._pendingSelect && targetOf(this._pendingSelect) ? this._pendingSelect : select.value;
    if (this._pendingSelect && currentSelected === this._pendingSelect) this._pendingSelect = null;
    this.fillSelect(currentSelected);

    // Ripopola i campi solo se è cambiato il tema scelto o il suo tema/sfondo nel DB:
    // altrimenti un aggiornamento in tempo reale cancellerebbe le modifiche non ancora salvate
    if (sigOf(select.value) !== this._lastSig) window.onThemeCompChange(select.value);
  },

  /** Elenco: competizioni e temi aggiuntivi (si ridisegna solo se cambia) */
  fillSelect(value) {
    const select = document.getElementById('themeCompSelect');
    if (!select) return;
    const comps = this.competitionsCache, custom = this.customCache;
    const html = `<option value="">-- Seleziona un tema --</option>` +
      (comps.length ? `<optgroup label="Competizioni">${comps.map(c =>
        `<option value="comp:${c.id}" ${c.logo ? `data-img="${c.logo}"` : 'data-icon="ri-trophy-line"'}>${c.name || c.id} (${c.id})</option>`).join('')}</optgroup>` : '') +
      (custom.length ? `<optgroup label="Temi aggiuntivi">${custom.map(t =>
        `<option value="custom:${t.id}" data-icon="ri-palette-line">${t.name || t.id}</option>`).join('')}</optgroup>` : '');
    if (select.dataset.sig !== html) {
      select.dataset.sig = html;
      select.innerHTML = html;
    }
    select.value = targetOf(value) ? value : '';
  },

  registerGlobalActions() {
    // elenco piatto di tutti i campi: id = "pagina__tipo"
    const allFields = THEME_PAGES.flatMap(pg => pg.fields.flatMap(f => [
      { page: pg.key, key: f.key, id: `${pg.key}__${f.key}`, def: f.def },
      ...(f.font ? [{ page: pg.key, key: f.font.key, id: `${pg.key}__${f.font.key}`, def: '' }] : [])
    ]));

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

    // Cambio del tema da modificare
    window.onThemeCompChange = (value) => {
      ThemesSection._lastSig = sigOf(value); // i campi ora mostrano questo
      const previewContainer = document.getElementById('themePreviewContainer');
      const bgPreview = document.getElementById('themeBgPreview');
      const btnRemove = document.getElementById('btn-remove-theme-bg');
      const target = targetOf(value);
      const comp = target ? target.data : null;

      // duplica: per tutti; rinomina ed elimina: solo per i temi aggiuntivi
      const show = (id, on) => { const b = document.getElementById(id); if (b) b.style.display = on ? 'inline-flex' : 'none'; };
      show('btn-dup-theme', !!target);
      show('btn-ren-theme', target && target.kind === 'custom');
      show('btn-del-theme', target && target.kind === 'custom');

      if (!target || !previewContainer || !bgPreview) {
        if (previewContainer) previewContainer.style.display = 'none';
        fillThemeFields(null);
        return;
      }

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

    // Salva/Aggiorna Sfondo del tema scelto
    window.salvaSfondoCompetizione = async () => {
      if (!database) return console.error("Database non inizializzato");

      const target = selectedTarget();
      const bgFileInput = document.getElementById('themeBgFile');

      if (!target) {
        return window.toast("Seleziona un tema!", "err");
      }

      if (!bgFileInput || !bgFileInput.files || bgFileInput.files.length === 0) {
        return window.toast("Seleziona un'immagine di sfondo da caricare!", "err");
      }

      const btnSave = document.getElementById('btn-save-theme-bg');
      const originalText = btnSave.innerHTML;
      btnSave.innerHTML = '<i class="ri-loader-4-line"></i> Caricamento Sfondo...';
      btnSave.disabled = true;

      try {
        const originalBgFile = bgFileInput.files[0];
        const mimeTypeBg = originalBgFile.type || 'image/jpeg';
        const extensionBg = mimeTypeBg.split('/')[1] || 'jpg';
        
        const cleanBgFile = new File(
          [originalBgFile], 
          `bg-${target.id}.${extensionBg}`, 
          { type: mimeTypeBg }
        );

        const uploadedBgUrl = await uploadBackgroundToImgBB(cleanBgFile);

        if (!uploadedBgUrl) {
          throw new Error("Impossibile caricare l'immagine su ImgBB");
        }

        await update(ref(database, target.path), {
          backgroundImage: uploadedBgUrl
        });

        window.toast("Sfondo aggiornato con successo!", "ok");

        const newBgInput = bgFileInput.cloneNode(true);
        newBgInput.value = '';
        bgFileInput.parentNode.replaceChild(newBgInput, bgFileInput);

        target.data.backgroundImage = uploadedBgUrl;
        window.onThemeCompChange(document.getElementById('themeCompSelect').value);

      } catch (err) {
        console.error("Errore salvataggio sfondo:", err);
        window.toast(err.message || "Errore durante il caricamento dello sfondo", "err");
      } finally {
        btnSave.innerHTML = originalText;
        btnSave.disabled = false;
      }
    };

    // Rimuovi Sfondo del tema scelto
    window.rimuoviSfondoCompetizione = async () => {
      if (!database) return;
      const target = selectedTarget();

      if (!target) return;

      if (confirm(`Sei sicuro di voler rimuovere lo sfondo di "${target.name}"?`)) {
        try {
          await update(ref(database, target.path), {
            backgroundImage: ""
          });

          window.toast("Sfondo rimosso!", "info");

          target.data.backgroundImage = "";
          window.onThemeCompChange(document.getElementById('themeCompSelect').value);

        } catch (err) {
          console.error("Errore rimozione sfondo:", err);
          window.toast("Errore durante la rimozione dello sfondo", "err");
        }
      }
    };

    // Salva Palette Colori Tema
    window.salvaPaletteColori = async () => {
      if (!database) return console.error("Database non inizializzato");
      const target = selectedTarget();

      if (!target) {
        return window.toast("Seleziona un tema!", "err");
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
        await update(ref(database, target.path), {
          theme: isEmpty ? null : newTheme
        });

        window.toast("Tema salvato con successo!", "ok");

        target.data.theme = isEmpty ? null : newTheme;
        window.onThemeCompChange(document.getElementById('themeCompSelect').value);

      } catch (err) {
        console.error("Errore salvataggio palette colori:", err);
        window.toast("Errore durante il salvataggio del tema", "err");
      }
    };

    // Reset/Rimuovi Palette Colori Tema
    window.resetPaletteColori = async () => {
      if (!database) return;
      const target = selectedTarget();

      if (!target) return;

      if (confirm(`Sei sicuro di voler resettare il tema personalizzato (tutte le pagine) di "${target.name}"?`)) {
        try {
          await update(ref(database, target.path), {
            theme: null
          });

          window.toast("Tema resettato!", "info");

          target.data.theme = null;
          window.onThemeCompChange(document.getElementById('themeCompSelect').value);

        } catch (err) {
          console.error("Errore reset palette:", err);
          window.toast("Errore durante il reset della palette", "err");
        }
      }
    };

    // Nuovo tema aggiuntivo: vuoto, oppure copia del tema scelto (Duplica)
    window.nuovoTemaAggiuntivo = async (fromValue = null) => {
      if (!database) return;
      const src = fromValue ? targetOf(fromValue) : null;
      const name = (prompt(src ? 'Nome della copia' : 'Nome del nuovo tema', src ? `Copia di ${src.name}` : '') || '').trim();
      if (!name) return;
      const id = 't' + Date.now().toString(36);
      const data = { name, createdAt: Date.now() };
      if (src && src.data.theme) data.theme = src.data.theme;
      if (src && src.data.backgroundImage) data.backgroundImage = src.data.backgroundImage;
      try {
        await set(ref(database, `themes/${id}`), data);
        // subito selezionato (il DB lo riconferma con il prossimo aggiornamento)
        if (!ThemesSection.customCache.some(t => t.id === id)) ThemesSection.customCache = [...ThemesSection.customCache, { id, ...data }];
        ThemesSection._pendingSelect = `custom:${id}`;
        ThemesSection.fillSelect(`custom:${id}`);
        window.onThemeCompChange(`custom:${id}`);
        window.toast(`Tema "${name}" creato: ora personalizzalo qui sotto`, "ok");
      } catch (err) {
        console.error("Errore creazione tema:", err);
        window.toast("Errore durante la creazione del tema", "err");
      }
    };

    window.duplicaTema = () => {
      const value = document.getElementById('themeCompSelect')?.value;
      if (!targetOf(value)) return window.toast("Seleziona il tema da duplicare!", "err");
      window.nuovoTemaAggiuntivo(value);
    };

    window.rinominaTemaAggiuntivo = async () => {
      const target = selectedTarget();
      if (!target || target.kind !== 'custom') return;
      const name = (prompt('Nuovo nome del tema', target.name) || '').trim();
      if (!name || name === target.name) return;
      try {
        await update(ref(database, target.path), { name });
        target.data.name = name;
        ThemesSection.fillSelect(document.getElementById('themeCompSelect').value);
        window.toast("Tema rinominato", "ok");
      } catch (err) {
        console.error("Errore rinomina tema:", err);
        window.toast("Errore durante la rinomina del tema", "err");
      }
    };

    // Chi lo stava usando torna al tema Automatico (vedi index.html, themeSourcePath)
    window.eliminaTemaAggiuntivo = async () => {
      const target = selectedTarget();
      if (!target || target.kind !== 'custom') return;
      if (!confirm(`Eliminare il tema "${target.name}"? Chi lo usa tornerà al tema automatico.`)) return;
      try {
        await set(ref(database, target.path), null);
        ThemesSection.customCache = ThemesSection.customCache.filter(t => t.id !== target.id);
        ThemesSection.fillSelect('');
        window.onThemeCompChange('');
        window.toast("Tema eliminato", "info");
      } catch (err) {
        console.error("Errore eliminazione tema:", err);
        window.toast("Errore durante l'eliminazione del tema", "err");
      }
    };
  }
};
