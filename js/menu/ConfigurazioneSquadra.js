import { db, ref, update } from '../firebase-config.js';
import { uploadImageToImgBB } from '../services/integrationImgBB.js';
import { AssetPreloader } from '../services/assetPreloader.js';
import { esc, sid, playerThumb } from './menuUtils.js';
import { MenuPanel } from '../components/MenuPanel.js';
import { kitPairHTML } from '../components/Kit3D.js';
import { cropImage } from '../components/ImageCropper.js';
import { DivisaSquadra } from './DivisaSquadra.js';
import { StadioSquadra } from './StadioSquadra.js';
import { captainBandSVG } from '../components/CaptainBand.js';
import { createStaffEditor } from '../components/StaffEditor.js';
import { getStaff, staffToSave } from '../services/staffService.js';

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
      if (btn.dataset.action === 'open-kit') MenuPanel.open(DivisaSquadra, 'kit');
      else if (btn.dataset.action === 'open-stadium') MenuPanel.open(StadioSquadra, 'stadium');
      else if (btn.dataset.action === 'open-band') { DivisaSquadra.startSection = 'band'; MenuPanel.open(DivisaSquadra, 'kit'); } // fascia: nell'editor della divisa
      else if (btn.dataset.action === 'remove-logo') this._removeLogo();
      else if (btn.dataset.action === 'save-staff') this._saveStaff();
      else if (btn.dataset.action === 'reset-photo') this._resetPlayerPhoto(btn.dataset.pid);
    });
  },

  refresh(STATE) {
    if (!this._root || this._busy) return;
    this._renderLogo(STATE);
    this._renderStaff(STATE);
    this._renderKit(STATE);
    this._renderBand(STATE);
    this._renderStadium(STATE);
    this._renderPlayers(STATE);
  },

  unmount() { this._root = null; },

  /* ---------------------------------------------------------------- render */
  _renderAll(STATE) {
    this._root.innerHTML = `
      <div class="mp-card" id="cfg-logo-card"></div>
      <div class="mp-card" id="cfg-staff-card">
        <div class="mp-card-title">Presidenza</div>
        <div class="mp-muted" style="margin-bottom:.6rem;">Chi guida la squadra: un Presidente oppure più Copresidenti. Puoi aggiungere altre persone con il titolo che vuoi (es. Vicepresidente).</div>
        <div id="cfg-staff"></div>
        <button class="mp-btn" data-action="save-staff" style="margin-top:.7rem;"><i class="ri-save-line"></i> Salva presidenza</button>
      </div>
      <div class="mp-card" id="cfg-kit-card"></div>
      <div class="mp-card" id="cfg-band-card"></div>
      <div class="mp-card" id="cfg-stadium-card"></div>
      <div class="mp-card">
        <div class="mp-card-title">Immagini dei giocatori</div>
        <div class="mp-muted" style="margin-bottom:.6rem;">Carica una foto personalizzata per i giocatori della tua rosa. Se la rimuovi torna l'immagine standard.</div>
        <div id="cfg-players"></div>
      </div>
    `;
    this._staffEditor = createStaffEditor(this._root.querySelector('#cfg-staff'), getStaff(STATE.user || {}));
    this._staffKey = JSON.stringify(getStaff(STATE.user || {}));
    this._renderLogo(STATE);
    this._renderKit(STATE);
    this._renderBand(STATE);
    this._renderStadium(STATE);
    this._renderPlayers(STATE);
  },

  /** Presidenza arrivata dal DB: si ridisegna solo se non si stanno facendo modifiche */
  _renderStaff(STATE) {
    if (!this._staffEditor) return;
    const saved = getStaff(STATE.user || {});
    const key = JSON.stringify(saved);
    if (key === this._staffKey) return;
    const editing = JSON.stringify(this._staffEditor.get()) !== this._staffKey;
    this._staffKey = key;
    if (!editing) this._staffEditor.set(saved);
  },

  async _saveStaff() {
    const team = window.STATE.user;
    if (!team || !this._staffEditor) return;
    const err = this._staffEditor.error();
    if (err) { window.showToast(err, 'err'); return; }
    const data = staffToSave(this._staffEditor.get());
    await this._run(async () => {
      await update(ref(db, `teams/${team.id}`), data);
      team.staff = data.staff; // subito, il listener del DB lo riconferma
      team.owner = data.owner;
      this._staffKey = JSON.stringify(getStaff(team));
    }, 'Presidenza salvata!');
  },

  _renderBand(STATE) {
    const card = this._root.querySelector('#cfg-band-card');
    if (!card) return;
    const band = (STATE.user || {}).captainBand || null;
    const key = JSON.stringify(band);
    if (card.dataset.key === key) return;
    card.dataset.key = key;
    card.innerHTML = `
      <div class="mp-card-title">Fascia da capitano</div>
      <div style="display:flex; align-items:center; gap:1rem;">
        <div style="width:100px; flex-shrink:0; display:flex; justify-content:center; line-height:0;">${captainBandSVG(band, { height: 52 })}</div>
        <div style="min-width:0;">
          <div class="mp-muted">${band ? 'La tua fascia: si vede accanto al capitano in Formazione e nel Live.' : 'Disegna la fascia del tuo capitano nell\'editor della divisa: livelli, immagini e lettera.'}</div>
          <button class="mp-btn" data-action="open-band" style="margin-top:.6rem;"><i class="ri-brush-line"></i> ${band ? 'Modifica fascia' : 'Crea fascia'}</button>
        </div>
      </div>
    `;
  },

  _renderKit(STATE) {
    const card = this._root.querySelector('#cfg-kit-card');
    if (!card) return;
    const team = STATE.user || {};
    // ridisegno solo se divisa o logo sono cambiati (refresh arriva spesso: eviterebbe sfarfallii)
    const key = JSON.stringify([team.kit || null, team.kit2 || null, team.logo || '']);
    if (card.dataset.key === key) return;
    card.dataset.key = key;
    card.innerHTML = `
      <div class="mp-card-title">Divisa</div>
      <div style="display:flex; align-items:center; gap:1rem;">
        ${team.kit || team.kit2 ? kitPairHTML(team.kit, team.kit2, { crestUrl: team.logo || '', width: 240 }, `style="width:${team.kit && team.kit2 ? 120 : 100}px; flex-shrink:0;"`) : '<div style="width:100px; flex-shrink:0; text-align:center; font-size:2.6rem; color:var(--text3);font-family:var(--font-text3,inherit);"><i class="ri-shirt-line"></i></div>'}
        <div style="min-width:0;">
          <div class="mp-muted">${team.kit || team.kit2 ? 'Modifica colletto, maniche, disegno, colori, sponsor e patch della prima e della seconda maglia.' : 'Non hai ancora creato la tua maglia: personalizzala ora!'}</div>
          <button class="mp-btn" data-action="open-kit" style="margin-top:.6rem;"><i class="ri-shirt-line"></i> ${team.kit || team.kit2 ? 'Modifica divise' : 'Crea divisa'}</button>
        </div>
      </div>
    `;
  },

  _renderStadium(STATE) {
    const card = this._root.querySelector('#cfg-stadium-card');
    if (!card) return;
    const st = (STATE.user || {}).stadium;
    const key = JSON.stringify(st ? [st.image || '', st.name || '', st.capacity || 0] : null);
    if (card.dataset.key === key) return;
    card.dataset.key = key;
    card.innerHTML = `
      <div class="mp-card-title">Stadio</div>
      <div style="display:flex; align-items:center; gap:1rem;">
        ${st && st.image ? `<img src="${esc(st.image)}" alt="Stadio" style="width:120px; flex-shrink:0; object-fit:contain;">` : '<div style="width:100px; flex-shrink:0; text-align:center; font-size:2.6rem; color:var(--text3);font-family:var(--font-text3,inherit);"><i class="ri-building-2-line"></i></div>'}
        <div style="min-width:0;">
          ${st ? `<div style="font-size:.9rem; font-weight:600; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(st.name || 'Stadio senza nome')}</div>
          <div class="mp-muted">${st.capacity ? `${Number(st.capacity).toLocaleString('it-IT')} posti` : ''}</div>` : '<div class="mp-muted">Non hai ancora costruito il tuo stadio: scegli anelli, curve, pista e colori!</div>'}
          <button class="mp-btn" data-action="open-stadium" style="margin-top:.6rem;"><i class="ri-building-2-line"></i> ${st ? 'Modifica stadio' : 'Crea stadio'}</button>
        </div>
      </div>
    `;
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
          <div style="font-family:'Bebas Neue',sans-serif; font-size:1.5rem; line-height:1.1; color:var(--text); overflow-wrap:anywhere;">${esc(team.name || '')}</div>
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
    if (!team || this._busy) return;
    // prima del caricamento si sceglie il ritaglio (Annulla = non cambia niente)
    const logo = await cropImage(file);
    if (!logo) return;
    await this._run(async () => {
      const url = await uploadImageToImgBB(logo);
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
