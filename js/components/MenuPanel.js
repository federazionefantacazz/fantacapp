/**
 * Pannello a schermo intero aperto dal menu laterale (impostazioni, squadra, listone, svincolati).
 * Ogni "vista" è un oggetto { title, mount(root, STATE), refresh?(STATE), unmount?() }.
 */
const STYLE_ID = 'menu-panel-style';

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #menu-panel { position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 1500; display: flex; flex-direction: column;
      background: var(--bg); transform: translateX(100%); visibility: hidden;
      transition: transform .25s ease, visibility 0s linear .25s; }
    #menu-panel.open { transform: translateX(0); visibility: visible; transition: transform .25s ease; }
    .mp-head { display: flex; align-items: center; gap: .5rem; flex-shrink: 0; min-height: 52px;
      padding: env(safe-area-inset-top, 0px) .8rem 0 .5rem; border-bottom: 1px solid var(--border); background: var(--header-bg); }
    .mp-title { font-family: 'Bebas Neue', sans-serif; font-size: 1.5rem; letter-spacing: .5px; color: var(--text); }
    .mp-body { flex: 1 1 0; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch;
      padding: 1rem 1rem calc(1rem + env(safe-area-inset-bottom, 0px)); }
    .mp-card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 1rem; margin-bottom: 1rem; }
    .mp-card-title { font-size: .75rem; font-weight: 600; letter-spacing: .5px; text-transform: uppercase; color: var(--accent); margin-bottom: .8rem; }
    .mp-muted { font-size: .75rem; color: var(--text2); line-height: 1.4; }
    .mp-btn { display: inline-flex; align-items: center; justify-content: center; gap: .35rem; cursor: pointer;
      background: var(--accent); color: var(--on-accent); border: none; border-radius: 10px; padding: .5rem .9rem;
      font-family: inherit; font-size: .8rem; font-weight: 600; }
    .mp-btn.ghost { background: transparent; color: var(--text2); border: 1px solid var(--border); }
    .mp-btn.danger { background: transparent; color: var(--accent3); border: 1px solid var(--accent3); }
    .mp-btn[disabled], .mp-btn.busy { opacity: .5; pointer-events: none; }

    .mp-row { display: flex; align-items: center; gap: .8rem; padding: .7rem 0; border-bottom: 1px solid var(--border); }
    .mp-row:last-child { border-bottom: none; }
    .mp-row-main { flex: 1; min-width: 0; }
    .mp-row-label { font-size: .9rem; font-weight: 600; color: var(--text); }
    .mp-switch { position: relative; width: 46px; height: 26px; flex-shrink: 0; }
    .mp-switch input { opacity: 0; width: 100%; height: 100%; margin: 0; position: absolute; inset: 0; cursor: pointer; z-index: 1; }
    .mp-switch span { position: absolute; inset: 0; background: var(--bg3); border: 1px solid var(--border); border-radius: 26px; transition: background .2s; }
    .mp-switch span::after { content: ''; position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: var(--text2); transition: transform .2s, background .2s; }
    .mp-switch input:checked + span { background: color-mix(in srgb, var(--accent) 30%, transparent); border-color: var(--accent); }
    .mp-switch input:checked + span::after { transform: translateX(20px); background: var(--accent); }

    .lv-controls { display: flex; flex-direction: column; gap: .6rem; margin-bottom: .8rem; }
    .lv-search { width: 100%; background: var(--bg2); border: 1px solid var(--border); border-radius: 10px; padding: .6rem .8rem; color: var(--text);
      font-family: inherit; font-size: .85rem; outline: none; user-select: text; -webkit-user-select: text; }
    .lv-chips { display: flex; gap: .4rem; align-items: center; flex-wrap: wrap; }
    .lv-chip { background: var(--bg2); color: var(--text2); border: 1px solid var(--border); border-radius: 999px; padding: .25rem .8rem;
      font-family: inherit; font-size: .75rem; font-weight: 600; cursor: pointer; }
    .lv-chip.on { background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--accent); border-color: var(--accent); }
    .lv-count { margin-left: auto; font-size: .72rem; color: var(--text3); }
    .lv-wrap { overflow: auto; -webkit-overflow-scrolling: touch; max-height: 62vh; max-height: calc(100dvh - 250px); border: 1px solid var(--border); border-radius: 12px; background: var(--bg2); }
    .lv-table { border-collapse: separate; border-spacing: 0; width: 100%; min-width: 560px; font-size: .78rem; }
    .lv-table th { position: sticky; top: 0; background: var(--bg3); color: var(--text2); font-size: .68rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: .4px; padding: .55rem .5rem; text-align: center; white-space: nowrap; cursor: pointer; user-select: none; z-index: 2; }
    .lv-table th.on { color: var(--accent); }
    .lv-table td { padding: .4rem .5rem; border-top: 1px solid var(--border); text-align: center; color: var(--text); white-space: nowrap; }
    .lv-table .l { text-align: left; }
    .lv-table .c-r { position: sticky; left: 0; width: 34px; min-width: 34px; background: var(--bg2); z-index: 1; padding-left: .5rem; padding-right: .2rem; }
    .lv-table th.c-r { background: var(--bg3); z-index: 3; }
    .lv-table .c-n { position: sticky; left: 34px; background: var(--bg2); z-index: 1; min-width: 150px; max-width: 190px; box-shadow: 4px 0 6px -4px rgba(0,0,0,.4); }
    .lv-table th.c-n { background: var(--bg3); z-index: 3; text-align: left; }
    .lv-name { display: flex; align-items: center; gap: .5rem; min-width: 0; }
    .lv-name img, .lv-name .ph { width: 30px; height: 30px; flex-shrink: 0; border-radius: 8px; object-fit: contain; }
    .lv-name span { overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
    .lv-more { display: block; margin: .8rem auto 0; }
    .lv-empty { text-align: center; color: var(--text3); font-size: .85rem; padding: 2rem 1rem; }

    .cfg-logo { width: 72px; height: 72px; border-radius: 14px; background: var(--bg3); border: 1px solid var(--border); object-fit: contain; flex-shrink: 0; }
    .cfg-player { display: flex; align-items: center; gap: .7rem; padding: .6rem 0; border-bottom: 1px solid var(--border); }
    .cfg-player:last-child { border-bottom: none; }
    .cfg-player img, .cfg-player .ph { width: 48px; height: 48px; border-radius: 10px; object-fit: contain; background: var(--bg3); flex-shrink: 0; }
    .cfg-player .nm { font-size: .85rem; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cfg-player .sub { font-size: .7rem; color: var(--text2); }
    .cfg-tag { font-size: .62rem; font-weight: 700; color: var(--gold); border: 1px solid var(--gold); border-radius: 4px; padding: 0 .3rem; margin-left: .3rem; }
  `;
  document.head.appendChild(style);
}

function ensurePanel() {
  injectStyle();
  let panel = document.getElementById('menu-panel');
  if (panel) return panel;

  panel = document.createElement('div');
  panel.id = 'menu-panel';
  panel.setAttribute('aria-hidden', 'true');
  panel.innerHTML = `
    <div class="mp-head">
      <button class="menu-header-btn" data-mp-close aria-label="Indietro"><i class="ri-arrow-left-line" style="font-size: 1.5rem;"></i></button>
      <span class="mp-title"></span>
    </div>
    <div class="mp-body"></div>
  `;
  panel.querySelector('[data-mp-close]').addEventListener('click', () => MenuPanel.close());
  document.body.appendChild(panel);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') MenuPanel.close(); });
  return panel;
}

export const MenuPanel = {
  _view: null,

  open(view) {
    const panel = ensurePanel();
    if (this._view && this._view.unmount) this._view.unmount();
    this._view = view;

    panel.querySelector('.mp-title').textContent = view.title;
    const body = panel.querySelector('.mp-body');
    body.innerHTML = '';
    body.scrollTop = 0;
    view.mount(body, window.STATE);

    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
  },

  close() {
    const panel = document.getElementById('menu-panel');
    if (!panel || !panel.classList.contains('open')) return;
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    if (this._view && this._view.unmount) this._view.unmount();
    this._view = null;
  },

  /** Chiamata da refreshUI: aggiorna la vista aperta quando cambiano i dati. */
  refresh(STATE) {
    if (this._view && this._view.refresh) this._view.refresh(STATE);
  }
};
