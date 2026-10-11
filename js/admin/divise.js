import { ref, remove, push } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { uploadPngToImgBB } from "../services/integrationImgBB.js";
import { getPngPatterns, getPngBrands, onKitAssetsChange } from "../services/kitAssets.js";
import { kitImageHTML } from "../components/Kit3D.js";

/**
 * Area Patron → Divise: disegni e marchi in PNG per l'editor della maglia 3D
 * (salvati in kitAssets, immagini su ImgBB).
 */
let database = null;
const MAX_SIDE = 2048;
const SAMPLE_LOGO = 'icons/logo-federazione.jpg';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
    window.diviseAction = (act, a) => this.action(act, a);
    onKitAssetsChange(() => this.renderLists());
  },

  renderHTML() {
    return `
    <div id="sec-divise" class="admin-sec" style="display:none">
      <div class="sec-title"><i class="ri-shirt-line"></i> Divise</div>

      <div class="card">
        <div class="label" style="color:var(--accent)">Come funziona</div>
        <div style="font-size:.85rem; color:var(--text2); line-height:1.5;">
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
    </div>`;
  },

  render() {
    this.renderLists();
  },

  renderLists() {
    const pl = document.getElementById('kitPatternsList');
    if (!pl) return;
    const patterns = getPngPatterns(), brands = getPngBrands();
    // refreshAll arriva spesso: ridisegno solo se le risorse sono cambiate
    const key = JSON.stringify([patterns, brands]);
    if (pl.dataset.key === key) return;
    pl.dataset.key = key;

    const card = (kind, a, kit, sub) => `
      <div style="background:var(--bg3); border:1px solid var(--border); border-radius:10px; padding:.4rem; text-align:center;">
        ${kitImageHTML(kit, { width: 280, textureSize: 1024, crestUrl: SAMPLE_LOGO, live: true })}
        <div style="font-size:.75rem; font-weight:600; margin:.3rem 0 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(a.name)}</div>
        <div style="font-size:.65rem; color:var(--text3); margin-bottom:.3rem;">${sub}</div>
        <button class="btn btn-red" style="padding:.2rem .4rem; font-size:.7rem;" onclick="window.diviseAction('del-${kind}','${esc(a.id)}')">Elimina</button>
      </div>`;
    pl.innerHTML = patterns.map(p => card('pattern', p,
      sampleKit({ layers: [{ type: 'png:' + p.id, color: '#0d1b4c', opacity: 100, zone: 'all' }] }),
      p.mode === 'uv' ? `Grafica UV${p.colors === 'original' ? ', colori originali' : ''}` : 'Adattato ai pezzi')).join('')
      || `<div style="grid-column:1/-1; font-size:.8rem; color:var(--text3);">Nessun disegno caricato: nell'editor ci sono comunque i disegni integrati.</div>`;
    const bl = document.getElementById('kitBrandsList');
    if (bl) bl.innerHTML = brands.map(b => card('brand', b, sampleKit({ brand: { id: 'png:' + b.id } }), 'Marchio')).join('')
      || `<div style="grid-column:1/-1; font-size:.8rem; color:var(--text3);">Nessun marchio caricato: nell'editor ci sono comunque i marchi integrati.</div>`;
  },

  async action(act, a) {
    try {
      switch (act) {
        case 'add-pattern':
        case 'add-brand': {
          const isPattern = act === 'add-pattern';
          const kind = isPattern ? 'Pattern' : 'Brand';
          const nameEl = document.getElementById(`kit${kind}Name`), fileEl = document.getElementById(`kit${kind}File`);
          const file = fileEl.files && fileEl.files[0];
          if (!nameEl.value.trim() || !file) { toast('Inserisci nome e file PNG', 'err'); return; }
          if (file.type !== 'image/png') { toast('Serve un file PNG', 'err'); return; }
          if (this.busy) return;
          this.busy = true;
          toast('Caricamento PNG in corso...', 'info');
          const url = await uploadPngToImgBB(file, isPattern ? MAX_SIDE : 600);
          const data = { name: nameEl.value.trim(), url };
          if (isPattern) {
            data.mode = document.getElementById('kitPatternMode').value;
            data.colors = data.mode === 'uv' ? document.getElementById('kitPatternColors').value : 'tint';
          }
          await push(ref(database, `kitAssets/${isPattern ? 'patterns' : 'brands'}`), data);
          nameEl.value = ''; fileEl.value = '';
          this.busy = false;
          toast('Caricato!', 'ok');
          return;
        }
        case 'del-pattern':
        case 'del-brand':
          if (!confirm('Eliminare? Le maglie che lo usano non lo mostreranno più.')) return;
          await remove(ref(database, `kitAssets/${act === 'del-pattern' ? 'patterns' : 'brands'}/${a}`));
          return;
      }
    } catch (err) {
      console.error(err);
      this.busy = false;
      toast('Operazione non riuscita: ' + (err.message || err), 'err');
    }
  }
};
