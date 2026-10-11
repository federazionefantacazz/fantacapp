import { ref, set, update, remove, push } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { uploadPngToImgBB } from "../services/integrationImgBB.js";
import {
  KIT_LAYERS, KIT_ANCHORS, BUILTIN_TEMPLATES, defaultAnchors,
  getTemplates, getPngPatterns, getPngBrands, getKitSettings, onKitAssetsChange
} from "../services/kitAssets.js";
import { drawKit, kitCanvasHTML } from "../components/KitRenderer.js";

/**
 * Area Patron → Divise: risorse PNG dell'editor delle maglie (salvate in kitAssets, immagini su ImgBB).
 * - Modelli: maschere delle zone + ombre/luci + posizioni di stemma, marchio, sponsor e patch.
 * - Disegni: PNG a un colore, stessa dimensione dei modelli.
 * - Marchi tecnici: PNG del logo.
 */
let database = null;
const MAX_SIDE = 1600;   // lato massimo dei PNG caricati (i livelli di un modello restano allineati)
const SAMPLE_LOGO = 'icons/logo-federazione.jpg';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toast = (m, t) => (window.toast ? window.toast(m, t) : alert(m));
const clone = (o) => JSON.parse(JSON.stringify(o));

/** Divisa d'esempio per le anteprime: mostra tutte le posizioni (stemma, marchio, sponsor, patch). */
const sampleKit = (templateId, all = true) => ({
  template: templateId,
  colors: { base: '#1e5bb8', sleeves: '#1e5bb8', collar: '#ffffff', cuffs: '#ffffff' },
  layers: [{ type: 'crackle', color: '#0d1b4c', opacity: 80, zone: 'all' }],
  brand: { id: 'nike', color: '#ffffff' },
  crest: { show: true, size: 100 },
  sponsor: { mode: 'text', text: 'SPONSOR', font: 'italic', color: '#ffffff' },
  patches: all ? ['chest', 'belly', 'sleeveL', 'sleeveR', 'hem'].map(pos => ({ id: 'f', src: SAMPLE_LOGO, pos })) : []
});

function readPngSize(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve({ w: img.naturalWidth, h: img.naturalHeight }); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

export const DiviseSection = {
  draft: null,       // modello in modifica { id?, name, order, w, h, layers, anchors }
  anchor: 'crest',
  busy: false,

  init(db) {
    database = db;
    window.diviseAction = (act, a, b) => this.action(act, a, b);
    onKitAssetsChange(() => this.renderLists());
  },

  renderHTML() {
    return `
    <div id="sec-divise" class="admin-sec" style="display:none">
      <div class="sec-title"><i class="ri-shirt-line"></i> Divise</div>

      <div class="card">
        <div class="label" style="color:var(--accent)">Come funziona</div>
        <div style="font-size:.85rem; color:var(--text2); line-height:1.5;">
          La maglia dell'editor è composta sovrapponendo dei <b>PNG tutti della stessa dimensione e allineati</b>:
          le <b>maschere</b> (busto, maniche, colletto, polsini: sagome piene su sfondo trasparente) vengono colorate,
          sopra si applicano disegni, sponsor, stemma e patch, poi le <b>ombre</b> (scala di grigi, bianco = nessuna ombra, in "moltiplica")
          e le <b>luci</b> (bianco su trasparente, in "schermo"). Si ricavano facilmente da un mockup PSD di maglia aprendolo in Photopea ed esportando ogni livello.
          <br>Esempio di formato: modello provvisorio
          ${['body', 'sleeves', 'collar', 'cuffs', 'shadow', 'highlight'].map(k => `<a href="icons/kit/crew-short/${k}.png" target="_blank" style="color:var(--accent)">${k}.png</a>`).join(' · ')}
          (800×840 px).
        </div>
        <label style="display:flex; align-items:center; gap:.5rem; margin-top:.8rem; font-size:.85rem; cursor:pointer;">
          <input type="checkbox" id="kitHideBuiltin" onchange="window.diviseAction('hide-builtin', this.checked)">
          Nascondi i modelli provvisori (quando c'è almeno un modello caricato)
        </label>
      </div>

      <div class="card">
        <div class="label">Modelli di maglia</div>
        <div id="kitTemplatesList" style="display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:.8rem; margin-top:.5rem;"></div>
        <button class="btn btn-green" style="margin-top:1rem; width:auto;" onclick="window.diviseAction('new-template')"><i class="ri-add-line"></i> Nuovo modello</button>
      </div>

      <div class="card" id="kitTemplateEditor" style="display:none;"></div>

      <div class="card">
        <div class="label">Disegni (PNG a un colore, stessa dimensione dei modelli)</div>
        <div id="kitPatternsList" style="display:grid; grid-template-columns:repeat(auto-fill,minmax(110px,1fr)); gap:.6rem; margin:.5rem 0 1rem;"></div>
        <input type="text" id="kitPatternName" class="input-login" placeholder="Nome del disegno (es: Crepe, Onde)">
        <input type="file" id="kitPatternFile" class="input-login" accept="image/png" style="padding-top:.5rem;">
        <button class="btn btn-green" style="width:auto;" onclick="window.diviseAction('add-pattern')"><i class="ri-upload-2-line"></i> Carica disegno</button>
      </div>

      <div class="card">
        <div class="label">Marchi tecnici (PNG del logo su trasparente)</div>
        <div id="kitBrandsList" style="display:grid; grid-template-columns:repeat(auto-fill,minmax(110px,1fr)); gap:.6rem; margin:.5rem 0 1rem;"></div>
        <input type="text" id="kitBrandName" class="input-login" placeholder="Nome del marchio (es: Nike)">
        <input type="file" id="kitBrandFile" class="input-login" accept="image/png" style="padding-top:.5rem;">
        <button class="btn btn-green" style="width:auto;" onclick="window.diviseAction('add-brand')"><i class="ri-upload-2-line"></i> Carica marchio</button>
      </div>
    </div>`;
  },

  render() {
    this.renderLists();
  },

  /* ------------------------------------------------------------- elenchi */
  renderLists() {
    const tl = document.getElementById('kitTemplatesList');
    if (!tl) return;
    const hide = document.getElementById('kitHideBuiltin');
    if (hide) hide.checked = !!getKitSettings().hideBuiltin;

    const templates = getTemplates();
    // refreshAll arriva spesso: ridisegno solo se le risorse sono cambiate
    const key = JSON.stringify([templates, getPngPatterns(), getPngBrands()]);
    if (tl.dataset.key === key) return;
    tl.dataset.key = key;
    const shown = new Set(templates.map(t => t.id));
    const all = templates.concat(BUILTIN_TEMPLATES.filter(t => !shown.has(t.id)));
    tl.innerHTML = all.map(t => `
      <div style="background:var(--bg3); border:1px solid var(--border); border-radius:10px; padding:.5rem; text-align:center;">
        ${kitCanvasHTML(sampleKit(t.id, false), { crestUrl: SAMPLE_LOGO, width: 260 })}
        <div style="font-size:.78rem; font-weight:600; margin:.3rem 0;">${esc(t.name)}</div>
        ${t.builtin
          ? `<div style="font-size:.7rem; color:var(--text3);">Incluso nell'app${shown.has(t.id) ? '' : ' (nascosto)'}</div>
             <button class="btn btn-blue" style="padding:.25rem .5rem; font-size:.72rem; margin-top:.3rem;" onclick="window.diviseAction('copy-template','${t.id}')">Duplica e modifica</button>`
          : `<div style="display:flex; gap:.25rem; justify-content:center;">
               <button class="btn btn-blue" style="padding:.25rem .5rem; font-size:.72rem;" onclick="window.diviseAction('edit-template','${esc(t.id)}')">Modifica</button>
               <button class="btn btn-red" style="padding:.25rem .5rem; font-size:.72rem;" onclick="window.diviseAction('del-template','${esc(t.id)}')">Elimina</button>
             </div>`}
      </div>`).join('');

    const assetCard = (kind, a) => `
      <div style="background:var(--bg3); border:1px solid var(--border); border-radius:10px; padding:.4rem; text-align:center;">
        <div style="aspect-ratio:1; background:repeating-conic-gradient(#3a414c 0% 25%, #2b323c 0% 50%) 50%/16px 16px; border-radius:6px; display:flex; align-items:center; justify-content:center;">
          <img src="${esc(a.url)}" alt="" style="max-width:90%; max-height:90%; object-fit:contain;">
        </div>
        <div style="font-size:.72rem; font-weight:600; margin:.3rem 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(a.name)}</div>
        <button class="btn btn-red" style="padding:.2rem .4rem; font-size:.7rem;" onclick="window.diviseAction('del-${kind}','${esc(a.id)}')">Elimina</button>
      </div>`;
    const pl = document.getElementById('kitPatternsList');
    if (pl) pl.innerHTML = getPngPatterns().map(p => assetCard('pattern', p)).join('') || `<div style="grid-column:1/-1; font-size:.8rem; color:var(--text3);">Nessun disegno caricato: nell'editor ci sono comunque i disegni integrati.</div>`;
    const bl = document.getElementById('kitBrandsList');
    if (bl) bl.innerHTML = getPngBrands().map(b => assetCard('brand', b)).join('') || `<div style="grid-column:1/-1; font-size:.8rem; color:var(--text3);">Nessun marchio caricato: nell'editor ci sono comunque i marchi integrati.</div>`;
  },

  /* -------------------------------------------------- editor del modello */
  openEditor(draft) {
    this.draft = draft;
    this.anchor = this.anchor || 'crest';
    this.renderEditor();
    document.getElementById('kitTemplateEditor').scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  renderEditor() {
    const box = document.getElementById('kitTemplateEditor');
    if (!box) return;
    const d = this.draft;
    if (!d) { box.style.display = 'none'; box.innerHTML = ''; return; }
    box.style.display = 'block';
    const a = d.anchors[this.anchor] || {};
    const def = KIT_ANCHORS.find(x => x.key === this.anchor);
    const num = (field, label, min, max) => `
      <label style="display:flex; align-items:center; gap:.5rem; font-size:.8rem; margin:.3rem 0;">
        <span style="width:90px;">${label}</span>
        <input type="range" min="${min}" max="${max}" value="${a[field] ?? 0}" oninput="window.diviseAction('anchor-num','${field}',this.value)" style="flex:1;">
        <span style="width:44px; text-align:right;">${a[field] ?? 0}</span>
      </label>`;
    const big = Math.max(d.w, d.h);

    box.innerHTML = `
      <div class="label" style="color:var(--accent)">${d.id ? 'Modifica modello' : 'Nuovo modello'}</div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:1rem;">
        <div>
          <input type="text" class="input-login" placeholder="Nome (es: Girocollo maniche corte)" value="${esc(d.name)}" oninput="window.diviseAction('field','name',this.value)">
          <label class="label" style="font-size:.72rem;">Ordine nell'elenco</label>
          <input type="number" class="input-login" value="${d.order ?? 1}" min="0" oninput="window.diviseAction('field','order',this.value)">
          <div class="label" style="margin-top:.4rem;">Livelli PNG ${d.w ? `(${d.w}×${d.h} px)` : ''}</div>
          ${KIT_LAYERS.map(l => `
            <div style="display:flex; align-items:center; gap:.5rem; padding:.35rem 0; border-bottom:1px solid var(--border);">
              <div style="width:44px; height:44px; flex-shrink:0; border-radius:6px; background:repeating-conic-gradient(#3a414c 0% 25%, #2b323c 0% 50%) 50%/10px 10px; display:flex; align-items:center; justify-content:center;">
                ${d.layers[l.key] ? `<img src="${esc(d.layers[l.key])}" style="max-width:100%; max-height:100%;">` : ''}
              </div>
              <div style="flex:1; font-size:.8rem;">${l.label}${l.required ? ' *' : ''}</div>
              <label class="btn btn-blue" style="padding:.25rem .5rem; font-size:.72rem; width:auto;">${d.layers[l.key] ? 'Cambia' : 'Carica'}
                <input type="file" accept="image/png" style="display:none;" onchange="window.diviseAction('layer-file','${l.key}',this)">
              </label>
              ${d.layers[l.key] && !l.required ? `<button class="btn btn-red" style="padding:.25rem .5rem; font-size:.72rem; width:auto;" onclick="window.diviseAction('layer-del','${l.key}')">✕</button>` : ''}
            </div>`).join('')}
          <div style="font-size:.72rem; color:var(--text3); margin-top:.4rem;">Tutti i PNG devono avere la stessa dimensione del busto.</div>
        </div>
        <div>
          <div class="label">Posizioni (tocca l'anteprima per spostare)</div>
          <select class="input-login" style="margin-bottom:.4rem;" onchange="window.diviseAction('anchor-pick', this.value)">
            ${KIT_ANCHORS.map(x => `<option value="${x.key}" ${x.key === this.anchor ? 'selected' : ''}>${x.label}</option>`).join('')}
          </select>
          ${def.type === 'rect' ? num('w', 'Larghezza', 10, big) + num('h', 'Altezza', 10, big) : num('s', 'Dimensione', 8, Math.round(big / 2))}
          ${def.type === 'rot' ? num('r', 'Rotazione', -90, 90) : ''}
          <div style="position:relative; margin-top:.5rem; background:#e9edf2; border-radius:10px; padding:.5rem;">
            <canvas id="kitAnchorCanvas" width="${d.w || 800}" height="${d.h || 840}" style="width:100%; height:auto; display:block; cursor:crosshair;"></canvas>
          </div>
        </div>
      </div>
      <div style="display:flex; gap:.5rem; margin-top:1rem;">
        <button class="btn btn-green" style="width:auto;" onclick="window.diviseAction('save-template')"><i class="ri-save-3-line"></i> Salva modello</button>
        <button class="btn btn-red" style="width:auto;" onclick="window.diviseAction('close-editor')">Annulla</button>
      </div>`;

    const canvas = document.getElementById('kitAnchorCanvas');
    canvas.addEventListener('click', (e) => {
      const r = canvas.getBoundingClientRect();
      const x = Math.round((e.clientX - r.left) / r.width * (this.draft.w || 800));
      const y = Math.round((e.clientY - r.top) / r.height * (this.draft.h || 840));
      this.draft.anchors[this.anchor] = { ...this.draft.anchors[this.anchor], x, y };
      this.drawAnchorPreview();
    });
    this.drawAnchorPreview();
  },

  drawAnchorPreview() {
    const canvas = document.getElementById('kitAnchorCanvas');
    const d = this.draft;
    if (!canvas || !d) return;
    if (!d.layers.body) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#667'; ctx.font = `${Math.round(canvas.width / 20)}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillText('Carica la maschera del busto', canvas.width / 2, canvas.height / 2);
      return;
    }
    drawKit(canvas, sampleKit(''), { crestUrl: SAMPLE_LOGO, template: { ...d, id: '__draft' } }).then(() => {
      // evidenzio la posizione selezionata
      const a = d.anchors[this.anchor];
      if (!a) return;
      const ctx = canvas.getContext('2d');
      const sc = canvas.width / (d.w || 800);
      ctx.save();
      ctx.strokeStyle = '#ff2d55'; ctx.lineWidth = Math.max(2, 3 * sc); ctx.setLineDash([8 * sc, 6 * sc]);
      ctx.translate(a.x * sc, a.y * sc);
      if (a.r) ctx.rotate(a.r * Math.PI / 180);
      const w = (a.w || a.s || 60) * sc, h = (a.h || a.s || 60) * sc;
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    }).catch(e => console.error(e));
  },

  /* ------------------------------------------------------------- azioni */
  async action(act, a, b) {
    try {
      switch (act) {
        case 'hide-builtin':
          await update(ref(database, 'kitAssets/settings'), { hideBuiltin: !!a });
          return;
        case 'new-template':
          this.openEditor({ name: '', order: 1, w: 0, h: 0, layers: {}, anchors: defaultAnchors() });
          return;
        case 'copy-template': {
          const t = BUILTIN_TEMPLATES.find(x => x.id === a);
          if (!t) return;
          // i PNG provvisori sono nell'app (percorsi relativi, validi da index.html e admin.html): il Patron poi li sostituisce con i suoi
          this.openEditor({ name: t.name.replace(' (provvisorio)', '') + ' (copia)', order: 1, w: t.w, h: t.h, layers: { ...t.layers }, anchors: clone(t.anchors) });
          return;
        }
        case 'edit-template': {
          const t = getTemplates().find(x => x.id === a);
          if (!t) return;
          this.openEditor({ id: t.id, name: t.name || '', order: t.order ?? 1, w: t.w, h: t.h, layers: { ...(t.layers || {}) }, anchors: clone(t.anchors) });
          return;
        }
        case 'del-template':
          if (!confirm('Eliminare questo modello? Le squadre che lo usano passeranno al primo modello disponibile.')) return;
          await remove(ref(database, `kitAssets/templates/${a}`));
          toast('Modello eliminato', 'ok');
          return;
        case 'close-editor':
          this.draft = null; this.renderEditor();
          return;
        case 'field':
          if (this.draft) this.draft[a] = a === 'order' ? Number(b) : b;
          return;
        case 'anchor-pick':
          this.anchor = a; this.renderEditor();
          return;
        case 'anchor-num': {
          const cur = this.draft.anchors[this.anchor] || {};
          this.draft.anchors[this.anchor] = { ...cur, [a]: Number(b) };
          const label = document.activeElement && document.activeElement.nextElementSibling;
          if (label) label.textContent = b;
          this.drawAnchorPreview();
          return;
        }
        case 'layer-file': {
          const file = b.files && b.files[0];
          b.value = '';
          if (!file) return;
          if (file.type !== 'image/png') { toast('Serve un file PNG', 'err'); return; }
          if (this.busy) return;
          const size = await readPngSize(file);
          const d = this.draft;
          if (a !== 'body' && d.w && Math.abs(size.w / size.h - d.w / d.h) > 0.01) {
            toast(`Il PNG deve avere le stesse proporzioni del busto (${d.w}×${d.h})`, 'err');
            return;
          }
          this.busy = true;
          toast('Caricamento PNG in corso...', 'info');
          const url = await uploadPngToImgBB(file, MAX_SIDE);
          d.layers[a] = url;
          if (a === 'body') {
            // la dimensione del modello è quella del busto (ridotta a MAX_SIDE come il caricamento)
            const f = Math.min(1, MAX_SIDE / Math.max(size.w, size.h));
            const nw = Math.round(size.w * f), nh = Math.round(size.h * f);
            if (d.w && (d.w !== nw || d.h !== nh)) {
              // riscalo le posizioni alla nuova dimensione
              const sx = nw / d.w, sy = nh / d.h;
              Object.values(d.anchors).forEach(an => {
                an.x = Math.round(an.x * sx); an.y = Math.round(an.y * sy);
                ['s', 'w', 'h'].forEach(k => { if (an[k]) an[k] = Math.round(an[k] * Math.min(sx, sy)); });
              });
            } else if (!d.w) {
              d.anchors = defaultAnchors(nw, nh);
            }
            d.w = nw; d.h = nh;
          }
          this.busy = false;
          toast('PNG caricato', 'ok');
          this.renderEditor();
          return;
        }
        case 'layer-del':
          delete this.draft.layers[a];
          this.renderEditor();
          return;
        case 'save-template': {
          const d = this.draft;
          if (!d.name.trim()) { toast('Dai un nome al modello', 'err'); return; }
          if (!d.layers.body) { toast('Carica almeno la maschera del busto', 'err'); return; }
          const data = { name: d.name.trim(), order: Number(d.order) || 0, w: d.w, h: d.h, layers: d.layers, anchors: d.anchors };
          if (d.id) await set(ref(database, `kitAssets/templates/${d.id}`), data);
          else await push(ref(database, 'kitAssets/templates'), data);
          toast('Modello salvato', 'ok');
          this.draft = null; this.renderEditor();
          return;
        }
        case 'add-pattern':
        case 'add-brand': {
          const kind = act === 'add-pattern' ? 'Pattern' : 'Brand';
          const nameEl = document.getElementById(`kit${kind}Name`), fileEl = document.getElementById(`kit${kind}File`);
          const file = fileEl.files && fileEl.files[0];
          if (!nameEl.value.trim() || !file) { toast('Inserisci nome e file PNG', 'err'); return; }
          if (file.type !== 'image/png') { toast('Serve un file PNG', 'err'); return; }
          if (this.busy) return;
          this.busy = true;
          toast('Caricamento PNG in corso...', 'info');
          const url = await uploadPngToImgBB(file, act === 'add-pattern' ? MAX_SIDE : 600);
          await push(ref(database, `kitAssets/${act === 'add-pattern' ? 'patterns' : 'brands'}`), { name: nameEl.value.trim(), url });
          nameEl.value = ''; fileEl.value = '';
          this.busy = false;
          toast('Caricato!', 'ok');
          return;
        }
        case 'del-pattern':
        case 'del-brand':
          if (!confirm('Eliminare?')) return;
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
