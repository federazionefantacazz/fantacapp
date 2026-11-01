/**
 * Anteprima dei temi nel Patron: l'app gira dentro un iframe (index.html?themePreview=1)
 * e il Patron la comanda con postMessage (solo dalla stessa origine):
 *   { type: 'fc-theme', css, bg }   tema in modifica (non salvato) e sfondo
 *   { type: 'fc-go', go }           cosa mostrare: 'page:home', 'menu:settings', 'drawer', 'login', 'toast',
 *                                    'update', 'invite', 'offline', 'player', 'choice' (vedi THEME_SECTIONS.go)
 *   { type: 'fc-hl', sel }          evidenzia gli elementi (selettore del catalogo)
 *   { type: 'fc-team', id }         squadra da mostrare (non serve sceglierla nell'app né accedere:
 *                                    la sessione è quella del Patron, il login resta nascosto)
 *   { type: 'fc-pick', on }         "tocca un elemento": il tocco non fa nulla nell'app e manda al Patron
 *                                    { type: 'fc-picked', section, key }
 * In anteprima l'app non applica il tema del DB e non salva il tema in cache.
 */
import { applyThemeCss, applyBackground } from './themeService.js';
import { THEME_SECTIONS, findElementAt } from './themeElements.js';
import { MenuPanel } from '../components/MenuPanel.js';
import { PlayerCard } from '../components/PlayerCard.js';
import { NotificationCenter } from './notificationCenter.js';

export const isThemePreview = new URLSearchParams(location.search).has('themePreview');

let currentGo = 'page:home';
let picking = false;

const send = (msg) => { try { window.parent.postMessage(msg, location.origin); } catch (e) { /* fuori dal Patron */ } };

function injectStyle() {
  const st = document.createElement('style');
  st.textContent = `
    .th-hl { outline: 2px dashed #ff3d7f !important; outline-offset: 2px !important; box-shadow: 0 0 0 4px rgba(255,61,127,.25) !important; }
    html.th-picking, html.th-picking * { cursor: crosshair !important; }
    /* niente login né scelta della squadra: si aspetta la sessione del Patron */
    html:not(.booted) #page-login > * { display: none !important; }
    html:not(.booted) #page-login::after { content: 'Caricamento anteprima…'; display: block; margin-top: 40vh; color: var(--text2); font-size: .9rem; }`;
  document.head.appendChild(st);
}

function clearHighlight() {
  document.querySelectorAll('.th-hl').forEach(n => n.classList.remove('th-hl'));
}

function highlight(sel) {
  clearHighlight();
  if (!sel) return;
  let nodes = [];
  // ::placeholder e simili non si possono evidenziare: si evidenzia l'elemento che li contiene
  try { nodes = [...document.querySelectorAll(sel.split(',').map(s => s.split('::')[0]).join(','))]; } catch (e) { return; }
  nodes = nodes.filter(n => n.getClientRects().length);
  nodes.forEach(n => n.classList.add('th-hl'));
  if (nodes[0]) nodes[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
  send({ type: 'fc-hl-count', count: nodes.length });
}

function closeAll() {
  document.querySelector('.cs-overlay')?.click();
  window.closeSideMenu && window.closeSideMenu();
  MenuPanel.close();
  if (document.getElementById('pc-overlay')?.classList.contains('open')) PlayerCard.close();
  document.getElementById('match-viewer')?.remove();
  document.getElementById('update-banner')?.classList.remove('show');
  document.getElementById('offline-banner')?.classList.remove('show');
  document.getElementById('toast')?.classList.remove('show');
  NotificationCenter.previewInvite(false);
  const login = document.getElementById('page-login');
  if (login && login.dataset.thPreview) {
    delete login.dataset.thPreview;
    login.style.display = 'none';
    document.getElementById('dynamic-pages-container').style.display = 'block';
  }
}

function go(target) {
  currentGo = target || 'page:home';
  closeAll();
  const [kind, arg] = currentGo.split(':');
  const STATE = window.STATE || {};
  if (kind === 'page') {
    if (STATE.booted && window.goPage) window.goPage(arg);
  } else if (kind === 'menu') {
    if (arg === 'kit') window.openKitEditor && window.openKitEditor();
    else window.openMenuPage && window.openMenuPage(arg);
  } else if (kind === 'drawer') {
    window.openSideMenu && window.openSideMenu();
  } else if (kind === 'login') {
    const login = document.getElementById('page-login');
    if (login && STATE.booted) {
      login.dataset.thPreview = '1';
      login.style.display = 'block';
      document.getElementById('dynamic-pages-container').style.display = 'none';
    }
  } else if (kind === 'toast') {
    window.toast && window.toast('Formazione salvata!', 'ok');
  } else if (kind === 'update') {
    document.getElementById('update-banner')?.classList.add('show');
  } else if (kind === 'invite') {
    NotificationCenter.previewInvite(true);
  } else if (kind === 'offline') {
    let el = document.getElementById('offline-banner');
    if (!el) { el = document.createElement('div'); el.id = 'offline-banner'; document.body.appendChild(el); }
    el.innerHTML = '<i class="ri-wifi-off-line"></i><span>Offline · 5 minuti fa</span>';
    el.classList.remove('online');
    el.classList.add('show');
  } else if (kind === 'player') {
    const mine = (STATE.players || []).find(p => STATE.user && String(p.fantaTeam ?? p.team ?? '') === String(STATE.user.id));
    const p = mine || (STATE.players || [])[0];
    if (p) PlayerCard.open(p.id);
  } else if (kind === 'choice') {
    document.querySelector('[data-cs-for="userCompSelect"]')?.click();
  }
}

export function startThemePreview() {
  if (!isThemePreview) return;
  injectStyle();
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.source !== window.parent) return;
    const m = e.data || {};
    if (m.type === 'fc-theme') {
      applyThemeCss(m.css || '');
      applyBackground(m.bg || '');
    } else if (m.type === 'fc-go') go(m.go);
    else if (m.type === 'fc-hl') highlight(m.sel);
    else if (m.type === 'fc-team') {
      window.__previewTeamId = m.id;
      if (window.__previewSetTeam) window.__previewSetTeam(m.id);
    }
    else if (m.type === 'fc-pick') {
      picking = !!m.on;
      document.documentElement.classList.toggle('th-picking', picking);
    }
  });
  // in modalità "tocca un elemento" il tocco sceglie l'elemento invece di usare l'app
  const pick = (e) => {
    if (!picking) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.type !== 'click') return;
    const preferred = THEME_SECTIONS.filter(s => s.go === currentGo).map(s => s.key);
    const hit = findElementAt(e.target, preferred);
    send({ type: 'fc-picked', section: hit ? hit.section : null, key: hit ? hit.key : null });
  };
  ['click', 'pointerdown', 'pointerup', 'mousedown', 'touchstart'].forEach(t => document.addEventListener(t, pick, { capture: true, passive: false }));
  send({ type: 'fc-ready' });
  // l'app pronta (dopo il login e la scelta della squadra): il Patron rimanda tema e pagina
  const iv = setInterval(() => {
    if ((window.STATE || {}).booted) { clearInterval(iv); send({ type: 'fc-booted' }); }
  }, 300);
}
