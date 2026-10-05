import { db, ref, update } from '../firebase-config.js';
import { uploadImageToImgBB } from '../services/integrationImgBB.js';
import { AssetPreloader } from '../services/assetPreloader.js';
import { esc, sid, playerThumb } from './menuUtils.js';

const MAX_FILE_MB = 8;
const ROLE_ORDER = { P: 0, D: 1, C: 2, A: 3 };

/** Giocatori della mia rosa (inclusi quelli che ho dato in prestito, esclusi quelli ricevuti). */
function myPlayers(STATE) {
  const me = sid(STATE.user && STATE.user.id);
  const list = Array.isArray(STATE.players) ? STATE.players : Object.values(STATE.players || {});
  return list
    .filter(p => p && p.id !== undefined && (
      p.loan ? sid(p.loan.fromTeamId) === me : sid(p.teamId) === me
    ))
    .sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) || String(a.name).localeCompare(String(b.name), 'it'));
}

export const ConfigurazioneSquadra = {
  title: 'Configurazione squadra',
  _busy: false,

  mount(body, STATE) {
    const root = document.createElement('div');
    body.appendChild(root);
    this._root = root;
    this._renderAll(STATE);

    root.addEventListener('change', (e) => {
      const input = e.target.closest('input[type="file"]');
      if (!input || !input.files || !input.files[0]) return;
      const file = input.files[0];
      input.value = '';
      if (input.dataset.kind === 'logo') this._setLogo(file);
      else if (input.dataset.kind === 'player') this._setPlayerPhoto(input.dataset.pid, file);
    });

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'remove-logo') this._removeLogo();
      else if (btn.dataset.action === 'reset-photo') this._resetPlayerPhoto(btn.dataset.pid);
    });
  },

  refresh(STATE) {
    if (!this._root || this._busy) return;
    this._renderLogo(STATE);
    this._renderPlayers(STATE);
  },

  unmount() { this._root = null; },

  /* ---------------------------------------------------------------- render */
  _renderAll(STATE) {
    this._root.innerHTML = `
      <div class="mp-card" id="cfg-logo-card"></div>
      <div class="mp-card">
        <div class="mp-card-title">Immagini dei giocatori</div>
        <div class="mp-muted" style="margin-bottom:.6rem;">Carica una foto personalizzata per i giocatori della tua rosa. Se la rimuovi torna l'immagine standard.</div>
        <div id="cfg-players"></div>
      </div>
    `;
    this._renderLogo(STATE);
    this._renderPlayers(STATE);
  },

  _renderLogo(STATE) {
    const card = this._root.querySelector('#cfg-logo-card');
    if (!card) return;
    const team = STATE.user || {};
    const logo = team.logo || 'icons/icon-192.png';
    card.innerHTML = `
      <div class="mp-card-title">Logo squadra</div>
      <div style="display:flex; align-items:center; gap:1rem;">
        <img class="cfg-logo" src="${esc(logo)}" alt="Logo" onerror="this.src='icons/icon-192.png'">
        <div style="min-width:0;">
          <div style="font-family:'Bebas Neue',sans-serif; font-size:1.5rem; line-height:1.1; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(team.name || '')}</div>
          <div style="display:flex; gap:.5rem; margin-top:.6rem; flex-wrap:wrap;">
            <label class="mp-btn" id="cfg-logo-btn"><i class="ri-image-edit-line"></i> Cambia logo
              <input type="file" accept="image/png,image/jpeg,image/webp" data-kind="logo" style="display:none;">
            </label>
            ${team.logo ? `<button class="mp-btn danger" data-action="remove-logo"><i class="ri-delete-bin-line"></i> Rimuovi</button>` : ''}
          </div>
        </div>
      </div>
    `;
  },

  _renderPlayers(STATE) {
    const box = this._root.querySelector('#cfg-players');
    if (!box) return;
    const players = myPlayers(STATE);
    if (!players.length) {
      box.innerHTML = `<div class="lv-empty">Nessun giocatore nella tua rosa.</div>`;
      return;
    }
    box.innerHTML = players.map(p => `
      <div class="cfg-player">
        ${playerThumb(p)}
        <div style="flex:1; min-width:0;">
          <div class="nm">${esc(p.name)}${p.photoPersonal ? '<span class="cfg-tag">PERSONALE</span>' : ''}</div>
          <div class="sub">${esc(p.role || '')} • ${esc(p.club || '')}${p.loan ? ' • in prestito' : ''}</div>
        </div>
        <label class="mp-btn ghost" style="padding:.4rem .6rem;" title="Cambia foto"><i class="ri-camera-line"></i>
          <input type="file" accept="image/png,image/jpeg,image/webp" data-kind="player" data-pid="${esc(p.id)}" style="display:none;">
        </label>
        ${p.photoPersonal ? `<button class="mp-btn ghost" style="padding:.4rem .6rem;" data-action="reset-photo" data-pid="${esc(p.id)}" title="Ripristina standard"><i class="ri-restart-line"></i></button>` : ''}
      </div>`).join('');
  },

  /* ---------------------------------------------------------------- azioni */
  _validate(file) {
    if (!file.type.startsWith('image/')) { window.showToast('Seleziona un file immagine', 'err'); return false; }
    if (file.size > MAX_FILE_MB * 1024 * 1024) { window.showToast(`Immagine troppo pesante (max ${MAX_FILE_MB} MB)`, 'err'); return false; }
    return true;
  },

  async _run(task, okMsg) {
    if (this._busy) return;
    this._busy = true;
    window.showToast('Caricamento in corso...', 'ok');
    try {
      await task();
      window.showToast(okMsg, 'ok');
    } catch (err) {
      console.error(err);
      window.showToast('Operazione non riuscita, riprova', 'err');
    } finally {
      this._busy = false;
      if (this._root) this.refresh(window.STATE);
    }
  },

  async _setLogo(file) {
    if (!this._validate(file)) return;
    const team = window.STATE.user;
    if (!team) return;
    await this._run(async () => {
      const url = await uploadImageToImgBB(file);
      await update(ref(db, `teams/${team.id}`), { logo: url });
      team.logo = url; // aggiornamento immediato; il listener del DB lo riconferma
      await AssetPreloader.cacheUrl(url);
    }, 'Logo aggiornato!');
  },

  async _removeLogo() {
    const team = window.STATE.user;
    if (!team || !confirm('Rimuovere il logo della squadra?')) return;
    await this._run(async () => {
      await update(ref(db, `teams/${team.id}`), { logo: null });
      team.logo = null;
    }, 'Logo rimosso');
  },

  async _setPlayerPhoto(pid, file) {
    if (!this._validate(file)) return;
    await this._run(async () => {
      const url = await uploadImageToImgBB(file);
      await update(ref(db, `players/${pid}`), { photoPersonal: url });
      const p = (window.STATE.players || []).find(x => sid(x.id) === sid(pid));
      if (p) p.photoPersonal = url;
      await AssetPreloader.cacheUrl(url);
    }, 'Foto aggiornata!');
  },

  async _resetPlayerPhoto(pid) {
    await this._run(async () => {
      await update(ref(db, `players/${pid}`), { photoPersonal: null });
      const p = (window.STATE.players || []).find(x => sid(x.id) === sid(pid));
      if (p) p.photoPersonal = null;
    }, 'Foto standard ripristinata');
  }
};
