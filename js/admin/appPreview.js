/**
 * Anteprima dell'app nel Patron, solo su PC: quando si cambia il tema dal selettore della barra
 * laterale compare in basso a destra un telefono con l'app (index.html?themePreview=1,
 * vedi js/services/themePreview.js) colorata con quel tema. Si chiude con la X e si riapre
 * al prossimo cambio. Nella sezione Temi c'è già l'anteprima accanto all'editor: lì non compare.
 */
import { fillPreviewTeams } from './previewTeams.js';

const DESKTOP = '(min-width: 992px)';
let box = null;
let last = { css: '', bg: '', title: '' };
let teams = [];

function injectStyle() {
  if (document.getElementById('app-preview-style')) return;
  const st = document.createElement('style');
  st.id = 'app-preview-style';
  st.textContent = `
    #app-preview { position: fixed; right: 1.2rem; bottom: 1.2rem; z-index: 3000; width: 360px; display: flex; flex-direction: column; gap: .4rem;
      animation: apIn .2s ease-out; }
    @keyframes apIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
    #app-preview .ap-head { display: flex; align-items: center; gap: .4rem; background: var(--card); border: 1px solid var(--border); border-radius: 12px;
      padding: .35rem .4rem .35rem .7rem; font-size: .78rem; color: var(--text2); box-shadow: 0 8px 24px rgba(0,0,0,.35); }
    #app-preview .ap-head b { color: var(--text); font-weight: 600; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    #app-preview .ap-head select { margin: 0 !important; }
    #app-preview .ap-head .cs-btn { min-height: 30px !important; padding: .2rem .5rem !important; font-size: .75rem !important; margin: 0 !important; width: auto !important; }
    #app-preview .ap-teamrow .cs-btn { flex: 1; width: 100% !important; }
    #app-preview .ap-x { width: 28px; height: 28px; border: none; background: transparent; color: var(--text2); cursor: pointer; font-size: 1.1rem; flex-shrink: 0; }
    #app-preview .ap-phone { height: min(600px, calc(100vh - 7rem)); border: 8px solid #0b0d12; border-radius: 28px; overflow: hidden; background: #000; box-shadow: 0 12px 40px rgba(0,0,0,.5); }
    #app-preview iframe { width: 100%; height: 100%; border: 0; display: block; }
    @media not all and ${DESKTOP} { #app-preview { display: none; } }`;
  document.head.appendChild(st);
}

const PAGES = [['page:home', 'Home'], ['page:calendario', 'Calendario'], ['page:classifica', 'Classifica'], ['page:formazione', 'Formazione'],
  ['page:mercato', 'Mercato'], ['page:teams', 'Squadre'], ['drawer', 'Menu laterale'], ['menu:settings', 'Impostazioni']];

function post(msg) {
  const f = box && box.querySelector('iframe');
  if (f && f.contentWindow) f.contentWindow.postMessage(msg, location.origin);
}

function ensureBox() {
  if (box) return box;
  injectStyle();
  box = document.createElement('div');
  box.id = 'app-preview';
  box.innerHTML = `
    <div class="ap-head">
      <i class="ri-smartphone-line"></i><b></b>
      <select class="ap-page" data-title="Pagina dell'anteprima" data-search="off">${PAGES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
      <button type="button" class="ap-x" aria-label="Chiudi anteprima"><i class="ri-close-line"></i></button>
    </div>
    <div class="ap-head ap-teamrow"><i class="ri-team-line"></i><select class="ap-team" data-title="Squadra dell'anteprima"></select></div>
    <div class="ap-phone"><iframe title="Anteprima dell'app" src="index.html?themePreview=1"></iframe></div>`;
  document.body.appendChild(box);
  box.querySelector('.ap-x').addEventListener('click', () => AppPreview.hide());
  box.querySelector('select.ap-page').addEventListener('change', (e) => post({ type: 'fc-go', go: e.target.value }));
  box.querySelector('select.ap-team').addEventListener('change', (e) => { if (e.target.value) post({ type: 'fc-team', id: e.target.value }); });
  fillPreviewTeams(box.querySelector('select.ap-team'), teams);
  window.addEventListener('message', (e) => {
    const f = box && box.querySelector('iframe');
    if (!f || e.origin !== location.origin || e.source !== f.contentWindow) return;
    if (e.data && (e.data.type === 'fc-ready' || e.data.type === 'fc-booted')) {
      const team = box.querySelector('select.ap-team').value;
      if (e.data.type === 'fc-ready' && team) post({ type: 'fc-team', id: team });
      post({ type: 'fc-theme', css: last.css, bg: last.bg });
      if (e.data.type === 'fc-booted') post({ type: 'fc-go', go: box.querySelector('select.ap-page').value });
    }
  });
  return box;
}

export const AppPreview = {
  /** Mostra (o aggiorna) l'anteprima con un tema già trasformato in CSS. Solo su PC. */
  show({ css = '', bg = '', title = '' } = {}) {
    last = { css, bg, title };
    if (!window.matchMedia(DESKTOP).matches) return;
    const b = ensureBox();
    b.style.display = '';
    b.querySelector('b').textContent = title ? `Anteprima app · ${title}` : 'Anteprima app';
    post({ type: 'fc-theme', css, bg });
  },
  hide() { if (box) box.style.display = 'none'; },

  /** Squadre della combobox sopra il telefono (dal Patron, a ogni aggiornamento dei dati). */
  setTeams(list) {
    teams = list || [];
    if (!box) return;
    const sel = box.querySelector('select.ap-team');
    const before = sel.value;
    const now = fillPreviewTeams(sel, teams);
    if (now && now !== before) post({ type: 'fc-team', id: now });
  }
};
