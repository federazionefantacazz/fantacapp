import { ref, remove, push, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { uploadPngToImgBB } from "../services/integrationImgBB.js";
import { getPngPatterns, getPngBrands, getPngPatches, getPngSymbols, onKitAssetsChange } from "../services/kitAssets.js";
import { kitImageHTML } from "../components/Kit3D.js";
import { esc } from '../utils.js';

/**
 * Area Patron → Temi → Squadre (Divise): disegni e marchi in PNG per l'editor della maglia 3D
 * (salvati in kitAssets, immagini su ImgBB).
 */
let database = null;
const MAX_SIDE = 2048;
const SAMPLE_LOGO = 'icons/logo-federazione.jpg';

const FOLDERS = { Pattern: 'patterns', Patch: 'patches', CompPatch: 'patches', Symbol: 'symbols', Brand: 'brands' };
const toast = (m, t) => (window.toast ? window.toast(m, t) : alert(m));

/** Maglia d'esempio per l'anteprima di un disegno o di un marchio. */
const sampleKit = (patch) => ({
  colors: { base: '#1e5bb8', sleeves: '#1e5bb8', collar: '#ffffff', cuffs: '#ffffff', trim: '#ffffff' },
  layers: [], brand: { id: 'nike', color: '#ffffff' }, crest: { show: false },
  sponsor: { mode: 'none' }, patches: [], ...patch
});

export const DiviseSection = {
  busy: false,

  init(db) {
    database = db;
    window.diviseAction = (act, a, b) => this.action(act, a, b);
    onKitAssetsChange(() => this.renderLists());
  },

  renderHTML() {
    return `
    <div id="sec-divise">
      <div class="label" style="color: var(--accent); margin-bottom: 1rem; font-size: .85rem;"><i class="ri-shirt-line"></i> Divise delle squadre</div>

      <div class="card">
        <div class="label" style="color:var(--accent)">Come funziona</div>
        <div style="font-size:.85rem; color:var(--text2);font-family:var(--font-sub,inherit); line-height:1.5;">
          La maglia dell'editor è un <b>modello 3D</b>: colori, disegni, sponsor, stemma e patch vengono dipinti sulla sua
          <b>mappa UV</b> (la maglia "scucita": davanti, dietro, maniche, colletto) e le pieghe del tessuto sono quelle reali del modello.
          Qui puoi aggiungere <b>disegni</b> e <b>marchi tecnici</b> in PNG che i giocatori ritrovano nell'editor.
          <br><br>
          <b>Disegno adattato ai pezzi</b>: PNG a un colore su sfondo trasparente (es. strisce, crepe), viene steso su davanti, dietro
          e/o maniche e colorato dal giocatore. <b>Grafica UV completa</b>: disegnata sopra il
          <a href="icons/kit3d/uv-template.png" target="_blank" style="color:var(--accent)">modello della mappa UV (2048×2048)</a>
          (anche con il file Illustrator <i>textures.ai</i>), con gli elementi al posto giusto su ogni pezzo.
        </div>
      </div>

      <div class="card">
        <div class="label">Disegni</div>
        <div id="kitPatternsList" style="display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:.6rem; margin:.5rem 0 1rem;"></div>
        <input type="text" id="kitPatternName" class="input-login" placeholder="Nome del disegno (es: Crepe, Onde)">
        <div style="display:flex; gap:.5rem; flex-wrap:wrap;">
          <select id="kitPatternMode" class="input-login" style="flex:1; min-width:200px;">
            <option value="panel">Adattato ai pezzi (PNG a un colore)</option>
            <option value="uv">Grafica UV completa (2048×2048)</option>
          </select>
          <select id="kitPatternColors" class="input-login" style="flex:1; min-width:200px;">
            <option value="tint">Colorabile dal giocatore</option>
            <option value="original">Colori originali del PNG (solo grafica UV)</option>
          </select>
        </div>
        <input type="file" id="kitPatternFile" class="input-login" accept="image/png" style="padding-top:.5rem;">
        <button class="btn btn-green" style="width:auto;" onclick="window.diviseAction('add-pattern')"><i class="ri-upload-2-line"></i> Carica disegno</button>
      </div>

      <div class="card">
        <div class="label">Marchi tecnici (PNG del logo su trasparente)</div>
        <div id="kitBrandsList" style="display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:.6rem; margin:.5rem 0 1rem;"></div>
        <input type="text" id="kitBrandName" class="input-login" placeholder="Nome del marchio (es: Nike)">
        <input type="file" id="kitBrandFile" class="input-login" accept="image/png" style="padding-top:.5rem;">
        <button class="btn btn-green" style="width:auto;" onclick="window.diviseAction('add-brand')"><i class="ri-upload-2-line"></i> Carica marchio</button>
      </div>

      <div class="card">
        <div class="label">Patch delle competizioni (manica sinistra, automatiche)</div>
        <div style="font-size:.8rem; color:var(--text3);font-family:var(--font-text3,inherit); margin-top:.2rem;">Ogni patch è legata a una competizione e si mette <b>da sola sulla manica sinistra</b>: nel Live (e nei replay) le maglie 3D delle due squadre hanno <b>tutte</b> le patch della competizione della partita (una competizione può averne più di una). Le squadre scelgono dimensione e posizione di ognuna sulla manica (FASE 7: Patch).</div>
        <div id="kitCompPatchesList" style="display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:.6rem; margin:.5rem 0 1rem;"></div>
        <input type="text" id="kitCompPatchName" class="input-login" placeholder="Nome della patch (es: Fantacazz)">
        <select id="kitCompPatchComp" class="input-login"></select>
        <input type="file" id="kitCompPatchFile" class="input-login" accept="image/png" style="padding-top:.5rem;">
        <button class="btn btn-green" style="width:auto;" onclick="window.diviseAction('add-comp-patch')"><i class="ri-upload-2-line"></i> Carica patch competizione</button>
      </div>

      <div class="card">
        <div class="label">Patch campione (PNG su trasparente)</div>
        <div style="font-size:.8rem; color:var(--text3);font-family:var(--font-text3,inherit); margin-top:.2rem;">Le squadre le scelgono nell'editor (FASE 7: Patch) e decidono posizione e dimensione: petto, sotto lo sponsor, manica destra o fondo maglia (la manica sinistra è della patch della competizione).</div>
        <div id="kitPatchesList" style="display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:.6rem; margin:.5rem 0 1rem;"></div>
        <input type="text" id="kitPatchName" class="input-login" placeholder="Nome della patch (es: Campioni 2025)">
        <input type="file" id="kitPatchFile" class="input-login" accept="image/png" style="padding-top:.5rem;">
        <button class="btn btn-green" style="width:auto;" onclick="window.diviseAction('add-patch')"><i class="ri-upload-2-line"></i> Carica patch campione</button>
      </div>

      <div class="card">
        <div class="label">Simboli per le forme (PNG su trasparente)</div>
        <div style="font-size:.8rem; color:var(--text3);font-family:var(--font-text3,inherit); margin-top:.2rem;">Nei disegni a livelli (Forme → Numero e misure) le squadre possono ripetere il simbolo sulla maglia quante volte vogliono, colorato o con i suoi colori. Meglio un PNG quadrato.</div>
        <div id="kitSymbolsList" style="display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:.6rem; margin:.5rem 0 1rem;"></div>
        <input type="text" id="kitSymbolName" class="input-login" placeholder="Nome del simbolo (es: Stella, Leone)">
        <input type="file" id="kitSymbolFile" class="input-login" accept="image/png" style="padding-top:.5rem;">
        <button class="btn btn-green" style="width:auto;" onclick="window.diviseAction('add-symbol')"><i class="ri-upload-2-line"></i> Carica simbolo</button>
      </div>
    </div>`;
  },

  render(state) {
    if (state) this._comps = (state.competitions || []).map(c => ({ id: String(c.id), name: c.name || String(c.id) }));
    this.renderLists();
  },

  /** <option> delle competizioni (sel = id scelto). */
  _compOptions(sel) {
    const comps = this._comps || [];
    return `<option value="">-- Scegli la competizione --</option>` + comps.map(c => `<option value="${esc(c.id)}" ${String(sel) === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  },

  renderLists() {
    const pl = document.getElementById('kitPatternsList');
    if (!pl) return;
    const patterns = getPngPatterns(), brands = getPngBrands(), patches = getPngPatches(), symbols = getPngSymbols();
    // refreshAll arriva spesso: ridisegno solo se le risorse (o le competizioni) sono cambiate
    const key = JSON.stringify([patterns, brands, patches, symbols, this._comps || []]);
    if (pl.dataset.key === key) return;
    pl.dataset.key = key;
    const newComp = document.getElementById('kitCompPatchComp');
    if (newComp) newComp.innerHTML = this._compOptions(newComp.value);

    const card = (kind, a, kit, sub, extra = '', opts = {}) => `
      <div style="background:var(--bg3); border:1px solid var(--border); border-radius:10px; padding:.4rem; text-align:center;">
        ${kitImageHTML(kit, { width: 280, textureSize: 1024, crestUrl: SAMPLE_LOGO, live: true, ...opts })}
        <div style="font-size:.75rem; font-weight:600; margin:.3rem 0 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(a.name)}</div>
        <div style="font-size:.65rem; color:var(--text3);font-family:var(--font-text3,inherit); margin-bottom:.3rem;">${sub}</div>
        ${extra}
        <button class="btn btn-red" style="padding:.2rem .4rem; font-size:.7rem;" onclick="window.diviseAction('del-${kind}','${esc(a.id)}')">Elimina</button>
      </div>`;
    pl.innerHTML = patterns.map(p => card('pattern', p,
      sampleKit({ layers: [{ type: 'png:' + p.id, color: '#0d1b4c', opacity: 100, zone: 'all' }] }),
      p.mode === 'uv' ? `Grafica UV${p.colors === 'original' ? ', colori originali' : ''}` : 'Adattato ai pezzi')).join('')
      || `<div style="grid-column:1/-1; font-size:.8rem; color:var(--text3);font-family:var(--font-text3,inherit);">Nessun disegno caricato: nell'editor ci sono comunque i disegni integrati.</div>`;
    const bl = document.getElementById('kitBrandsList');
    if (bl) bl.innerHTML = brands.map(b => card('brand', b, sampleKit({ brand: { id: 'png:' + b.id } }), 'Marchio')).join('')
      || `<div style="grid-column:1/-1; font-size:.8rem; color:var(--text3);font-family:var(--font-text3,inherit);">Nessun marchio caricato: nell'editor ci sono comunque i marchi integrati.</div>`;
    const ptl = document.getElementById('kitPatchesList');
    const moveBtn = (b, to, label) => `<button class="btn btn-outline" style="padding:.2rem .4rem; font-size:.65rem; margin-bottom:.3rem; width:100%;" onclick="window.diviseAction('patch-kind','${esc(b.id)}','${to}')">${label}</button>`;
    const champ = patches.filter(b => b.kind === 'champ'), compP = patches.filter(b => b.kind === 'comp');
    if (ptl) ptl.innerHTML = champ.map(b => card('patch', b, sampleKit({ patches: [{ id: 'png:' + b.id, name: b.name, src: b.url, pos: 'chest' }] }), 'Patch campione',
      moveBtn(b, 'comp', 'È di una competizione'))).join('')
      || `<div style="grid-column:1/-1; font-size:.8rem; color:var(--text3);font-family:var(--font-text3,inherit);">Nessuna patch campione caricata.</div>`;
    const cpl = document.getElementById('kitCompPatchesList');
    const compName = (id) => ((this._comps || []).find(c => c.id === String(id)) || {}).name;
    if (cpl) cpl.innerHTML = compP.map(b => {
      const twins = b.compId ? compP.filter(o => o.id !== b.id && String(o.compId) === String(b.compId)).length : 0;
      return card('patch', b, sampleKit(), b.compId && compName(b.compId) ? `Manica sinistra · ${esc(compName(b.compId))}` : '<span style="color:var(--accent3)">Scegli la competizione</span>', `
        <select class="input-login" style="font-size:.7rem; padding:.3rem; margin:0 0 .3rem;" onchange="window.diviseAction('patch-comp','${esc(b.id)}',this.value)">${this._compOptions(b.compId)}</select>
        ${twins ? `<div style="font-size:.62rem; color:var(--text3); margin-bottom:.3rem;">Sulla manica sinistra insieme ${twins === 1 ? "all'altra patch" : `alle altre ${twins} patch`} di questa competizione.</div>` : ''}
        ${moveBtn(b, 'champ', 'È una patch campione')}`, { compPatches: [{ id: b.id, url: b.url }], view: -60 });
    }).join('')
      || `<div style="grid-column:1/-1; font-size:.8rem; color:var(--text3);font-family:var(--font-text3,inherit);">Nessuna patch di competizione caricata.</div>`;
    const sl = document.getElementById('kitSymbolsList');
    if (sl) sl.innerHTML = symbols.map(b => card('symbol', b, sampleKit({ layers: [{ type: 'm-shape', shape: 'png', symUrl: b.url, symMono: true, all: true, size: 14, gap: 6, stagger: true, color: '#ffffff', opacity: 100, zone: 'body', wrap: 'whole' }] }), 'Simbolo')).join('')
      || `<div style="grid-column:1/-1; font-size:.8rem; color:var(--text3);font-family:var(--font-text3,inherit);">Nessun simbolo caricato: nell'editor ci sono comunque le forme integrate.</div>`;
  },

  async action(act, a, b) {
    try {
      switch (act) {
        case 'add-pattern':
        case 'add-brand':
        case 'add-patch':
        case 'add-comp-patch':
        case 'add-symbol': {
          const isPattern = act === 'add-pattern';
          const kind = isPattern ? 'Pattern' : act === 'add-patch' ? 'Patch' : act === 'add-comp-patch' ? 'CompPatch' : act === 'add-symbol' ? 'Symbol' : 'Brand';
          const nameEl = document.getElementById(`kit${kind}Name`), fileEl = document.getElementById(`kit${kind}File`);
          const file = fileEl.files && fileEl.files[0];
          if (!nameEl.value.trim() || !file) { toast('Inserisci nome e file PNG', 'err'); return; }
          if (file.type !== 'image/png') { toast('Serve un file PNG', 'err'); return; }
          const compSel = kind === 'CompPatch' ? document.getElementById('kitCompPatchComp').value : '';
          if (kind === 'CompPatch' && !compSel) { toast('Scegli la competizione della patch', 'err'); return; }
          if (this.busy) return;
          this.busy = true;
          toast('Caricamento PNG in corso...', 'info');
          const url = await uploadPngToImgBB(file, isPattern ? MAX_SIDE : 600);
          const data = { name: nameEl.value.trim(), url };
          if (kind === 'Patch') data.kind = 'champ';
          if (kind === 'CompPatch') { data.kind = 'comp'; data.compId = compSel; }
          if (isPattern) {
            data.mode = document.getElementById('kitPatternMode').value;
            data.colors = data.mode === 'uv' ? document.getElementById('kitPatternColors').value : 'tint';
          }
          await push(ref(database, `kitAssets/${FOLDERS[kind]}`), data);
          nameEl.value = ''; fileEl.value = '';
          this.busy = false;
          toast('Caricato!', 'ok');
          return;
        }
        case 'patch-kind':
          await update(ref(database, `kitAssets/patches/${a}`), { kind: b === 'comp' ? 'comp' : 'champ' });
          toast(b === 'comp' ? 'Ora è una patch di competizione: scegli la competizione' : 'Ora è una patch campione', 'ok');
          return;
        case 'patch-comp':
          await update(ref(database, `kitAssets/patches/${a}`), { kind: 'comp', compId: b || null });
          toast('Competizione della patch salvata', 'ok');
          return;
        case 'del-pattern':
        case 'del-brand':
        case 'del-patch':
        case 'del-symbol':
          if (!confirm(act === 'del-patch' ? 'Eliminare? Non si potrà più aggiungere alle maglie (quelle che la usano già la tengono).'
            : act === 'del-symbol' ? 'Eliminare? Non si potrà più scegliere (le maglie che lo usano già lo tengono).' : 'Eliminare? Le maglie che lo usano non lo mostreranno più.')) return;
          await remove(ref(database, `kitAssets/${{ 'del-pattern': 'patterns', 'del-patch': 'patches', 'del-symbol': 'symbols', 'del-brand': 'brands' }[act]}/${a}`));
          return;
      }
    } catch (err) {
      console.error(err);
      this.busy = false;
      toast('Operazione non riuscita: ' + (err.message || err), 'err');
    }
  }
};
