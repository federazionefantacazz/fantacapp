import { GwService } from './services/gwService.js';
import { ProbabiliService, STATUS_INFO } from './services/probabiliService.js';

export const FormazionePage = {
  renderHTML() {
    return `
      <div class="page" id="page-formazione">
        <div class="sec" style="margin-top:1.2rem">Schiera Formazione</div>
        <div id="f-lock-banner"></div>
        <div id="f-editor">
        
        <div class="card card-sm" style="margin-bottom: 1rem;">
          <div class="label" style="margin-bottom: .4rem;">Seleziona Modulo</div>
          <select id="f-modulo" class="select-rose">
            <option value="3-4-3">3-4-3</option>
            <option value="3-5-2">3-5-2</option>
            <option value="4-3-3" selected>4-3-3</option>
            <option value="4-4-2">4-4-2</option>
            <option value="4-5-1">4-5-1</option>
            <option value="5-3-2">5-3-2</option>
            <option value="5-4-1">5-4-1</option>
          </select>
        </div>

        <div class="label" style="margin-bottom: .5rem; color:var(--title,var(--accent)); display: flex; align-items: center; gap: 0.4rem;"><i class="ri-t-shirt-line"></i> TITOLARI (RETTANGOLO DI GIOCO)</div>
        
        <div class="soccer-field" id="soccer-field-container">
          <div class="field-lines">
            <div class="field-penalty-box"></div>
            <div class="field-center-circle"></div>
          </div>
          <div id="titolari-field-slots"></div>
        </div>

        <div class="label" style="margin-bottom: .5rem; color: var(--gold); margin-top: 1.5rem; display: flex; align-items: center; gap: 0.4rem;"><i class="ri-user-shared-line"></i> PANCHINA (1 P | 2 D | 2 C | 2 A)</div>
        <div id="panchina-slots" style="display: flex; flex-direction: column; gap: .4rem; margin-bottom: 1rem;"></div>

        <div class="card card-sm" style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.8rem; background: var(--bg2);">
          <input type="checkbox" id="save-all-comps" checked style="width: 18px; height: 18px; accent-color: var(--accent); cursor: pointer;">
          <label for="save-all-comps" class="label" style="margin: 0; cursor: pointer; color: var(--text);">Salva per tutte le competizioni</label>
        </div>
        
        <div id="f-save-info" style="font-size:.75rem; color:var(--text2); margin:-.4rem 0 1rem; line-height:1.4;"></div>

        <button class="btn btn-green" style="width: 100%; padding: .8rem; margin-bottom:2rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;" id="btn-save-lineup"><i class="ri-save-line"></i> Salva Formazione</button>
        </div>

        <style>
        .soccer-field {
          position: relative;
          width: 100%;
          height: 480px;
          background: 
            repeating-linear-gradient(
              to bottom,
              rgba(34, 139, 34, 0.85),
              rgba(34, 139, 34, 0.85) 40px,
              rgba(28, 115, 28, 0.85) 40px,
              rgba(28, 115, 28, 0.85) 80px
            ),
            radial-gradient(circle at center, rgba(0,0,0,0) 40%, rgba(0,0,0,0.35) 100%);
          background-color: #228b22;
          border: 3px solid rgba(255, 255, 255, 0.3);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: inset 0 0 40px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.3);
        }
        .field-lines {
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          pointer-events: none;
        }
        .field-lines::before {
          content: ''; position: absolute; top: 50%; left: 0; width: 100%; height: 3px;
          background: rgba(255, 255, 255, 0.6);
          box-shadow: 0 0 4px rgba(0,0,0,0.3);
        }
        .field-center-circle {
          position: absolute; top: 50%; left: 50%; width: 100px; height: 100px;
          border: 3px solid rgba(255, 255, 255, 0.6); border-radius: 50%;
          transform: translate(-50%, -50%);
          box-shadow: 0 0 4px rgba(0,0,0,0.3);
        }
        .field-center-circle::after {
          content: ''; position: absolute; top: 50%; left: 50%; width: 6px; height: 6px;
          background: rgba(255, 255, 255, 0.6); border-radius: 50%;
          transform: translate(-50%, -50%);
        }
        .field-penalty-box {
          position: absolute; bottom: 0; left: 50%; width: 180px; height: 70px;
          border: 3px solid rgba(255, 255, 255, 0.6); border-bottom: none;
          transform: translateX(-50%);
          box-shadow: 0 0 4px rgba(0,0,0,0.3);
        }
        .field-lines::after {
          content: ''; position: absolute; top: 0; left: 50%; width: 180px; height: 70px;
          border: 3px solid rgba(255, 255, 255, 0.6); border-top: none;
          transform: translateX(-50%);
          box-shadow: 0 0 4px rgba(0,0,0,0.3);
        }
        .field-player {
          position: absolute;
          transform: translate(-50%, -50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 80px;
          z-index: 10;
        }

        /* Stili base dello slot */
        .player-shirt {
          display: flex; 
          align-items: center; 
          justify-content: center;
          font-size: 0.9rem; 
          font-family: 'Bebas Neue', sans-serif; 
          letter-spacing: 0.5px;
          color: #fff;
          transition: transform 0.1s ease-out;
          cursor: pointer;
          text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        }

        /* PNG PURO (senza cerchio, senza bordo, senza sfondo) */
        .player-shirt.has-png {
          width: 52px !important; 
          height: 58px !important;
          border-radius: 0 !important;
          border: none !important;
          box-shadow: none !important;
          background-size: contain !important;
          background-repeat: no-repeat !important;
          background-position: center bottom !important;
          background-color: transparent !important;
        }

        /* FALLBACK CERCHIO (quando lo slot è vuoto o non ha immagini) */
        .player-shirt.is-circle {
          width: 44px !important;
          height: 44px !important;
          border-radius: 50% !important;
          border: 2px solid #ffffff !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.3) !important;
          background-image: none !important;
        }

        .field-player:active .player-shirt {
          transform: translateY(2px);
        }
        .field-player { cursor: pointer; }
        .field-player select { display: none; }
        .shirt-wrap { position: relative; }
        .slot-badge-wrap { position: absolute; top: -4px; right: -18px; pointer-events: none; }
        .slot-badge {
          display: inline-flex; align-items: center; justify-content: center; gap: 1px;
          min-width: 22px; height: 16px; padding: 0 4px; border-radius: 8px;
          font-size: .58rem; font-weight: 700; color: #fff; line-height: 1;
          font-family: 'DM Sans', sans-serif; box-shadow: 0 2px 5px rgba(0,0,0,.45);
          border: 1px solid rgba(255,255,255,.35);
        }
        .pan-slot { cursor: pointer; }
        .pan-pick {
          flex: 1; min-width: 0; background: var(--bg2); border-radius: 8px; padding: .45rem .6rem;
          font-size: .8rem; color: var(--text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .pan-badge .slot-badge { height: 18px; font-size: .62rem; }

        /* ===== Box scelta giocatore ===== */
        .fp-overlay {
          position: fixed; inset: 0; z-index: 9999; background: rgba(5,8,15,.65);
          backdrop-filter: blur(3px); display: none; align-items: flex-end; justify-content: center;
        }
        .fp-overlay.open { display: flex; }
        .fp-sheet {
          width: 100%; max-width: 560px; max-height: 85vh; display: flex; flex-direction: column;
          background: var(--bg, #181c22); border: 1px solid rgba(255,255,255,.08);
          border-radius: 18px 18px 0 0; box-shadow: 0 -10px 40px rgba(0,0,0,.5);
          padding-bottom: env(safe-area-inset-bottom, 0px); animation: fpUp .18s ease-out;
        }
        @media (min-width: 700px) {
          .fp-overlay { align-items: center; }
          .fp-sheet { border-radius: 18px; }
        }
        @keyframes fpUp { from { transform: translateY(30px); opacity: 0; } to { transform: none; opacity: 1; } }
        .fp-head { display: flex; justify-content: space-between; align-items: flex-start; gap: .5rem; padding: 1rem 1rem .6rem; border-bottom: 1px solid rgba(255,255,255,.06); }
        .fp-title { font-weight: 700; font-size: .95rem; color: var(--text); display: flex; align-items: center; }
        .fp-sub { font-size: .72rem; color: var(--text2); margin-top: 3px; }
        .fp-close { background: var(--bg2); border: none; color: var(--text); width: 32px; height: 32px; border-radius: 50%; font-size: 1.1rem; cursor: pointer; flex-shrink: 0; }
        .fp-list { overflow-y: auto; padding: .5rem .6rem; display: flex; flex-direction: column; gap: .4rem; }
        .fp-foot { padding: 0 .6rem .7rem; }
        .fp-foot:empty { display: none; }
        .fp-empty { text-align: center; color: var(--text3); padding: 2rem 1rem; font-size: .85rem; }
        .fp-row {
          display: flex; align-items: center; gap: .65rem; padding: .55rem .65rem;
          background: var(--bg2); border: 1px solid rgba(255,255,255,.05); border-radius: 12px;
          cursor: pointer; transition: background .12s, transform .08s;
        }
        .fp-row:hover { background: var(--bg3); }
        .fp-row:active { transform: scale(.99); }
        .fp-row.is-current { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
        .fp-row.is-used { opacity: .35; filter: grayscale(1); cursor: not-allowed; pointer-events: none; }
        .fp-img { width: 44px; height: 48px; flex-shrink: 0; display: flex; align-items: flex-end; justify-content: center; }
        .fp-img img { width: 44px; height: 48px; object-fit: contain; object-position: bottom; }
        .fp-ph { width: 36px; height: 36px; border-radius: 50%; background: var(--bg3); color: var(--text3); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: .8rem; }
        .fp-main { flex: 1; min-width: 0; }
        .fp-name { font-weight: 600; font-size: .88rem; color: var(--text); display: flex; align-items: center; flex-wrap: wrap; gap: .35rem; }
        .fp-meta { font-size: .72rem; color: var(--text2); margin-top: 2px; display: flex; flex-wrap: wrap; gap: .4rem; align-items: center; }
        .fp-club { color: var(--text3); }
        .fp-opp { color: var(--text); font-weight: 600; }
        .fp-opp em { font-style: normal; font-weight: 400; color: var(--text3); }
        .fp-status { margin-top: 4px; display: flex; flex-direction: column; gap: 2px; }
        .fp-chip { display: inline-flex; align-items: center; gap: 3px; width: fit-content; font-size: .65rem; font-weight: 700; padding: 1px 7px; border-radius: 10px; border: 1px solid; text-transform: uppercase; letter-spacing: .3px; }
        .fp-note { font-size: .68rem; color: var(--text2); line-height: 1.3; }
        .fp-pct { width: 64px; flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 3px; text-align: right; }
        .fp-pct-val { font-weight: 700; font-size: .9rem; font-family: 'DM Mono', monospace; line-height: 1.1; }
        .fp-bar { width: 100%; height: 5px; border-radius: 3px; background: rgba(255,255,255,.12); overflow: hidden; }
        .fp-bar > div { height: 100%; border-radius: 3px; }
        .fp-xi { font-size: .6rem; color: var(--text3); text-transform: uppercase; letter-spacing: .3px; }
        .fp-used-tag, .fp-cur-tag { font-size: .6rem; font-weight: 700; padding: 1px 6px; border-radius: 8px; text-transform: uppercase; }
        .fp-used-tag { background: rgba(255,255,255,.15); color: var(--text); }
        .fp-cur-tag { background: var(--accent); color: #000; }
        .player-name-label {
          margin-top: 2px;
          background: rgba(10, 15, 30, 0.85);
          backdrop-filter: blur(4px);
          color: #fff;
          font-size: 0.7rem;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 6px;
          max-width: 90px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          border: 1px solid rgba(255,255,255,0.2);
          text-align: center;
          box-shadow: 0 3px 6px rgba(0,0,0,0.4);
        }
        </style>
      </div>
    `;
  },

  render(STATE) {
    const modSelect = document.getElementById('f-modulo');
    if (!modSelect) return;
    
    if (!window._formazioneInitialized) {
      modSelect.addEventListener('change', () => this.buildSlots(STATE, true));
      
      const saveBtn = document.getElementById('btn-save-lineup');
      if (saveBtn) {
        saveBtn.addEventListener('click', () => this.save(STATE));
      }

      const navButtons = document.querySelectorAll('#nav window, .nav-btn, [onclick*="formazione"]');
      navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          setTimeout(() => this.buildSlots(window.STATE), 50);
        });
      });

      window._formazioneInitialized = true;
    }

    this.buildSlots(STATE);
  },

  // Giornata della COMPETIZIONE (es. "gw2") corrispondente alla giornata di Serie A corrente.
  // Ritorna null se la competizione non ha una giornata associata alla Serie A corrente.
  getGwCompetizione(compData, STATE) {
    return GwService.getGwKey(compData, GwService.getGwReale(STATE));
  },

  // Stato della mia squadra in una competizione per la giornata Serie A corrente
  getStatus(compData, STATE) {
    return GwService.getTeamStatus(compData, GwService.getGwReale(STATE), STATE.user?.id);
  },

  // Mostra/nasconde il blocco e il motivo per la competizione selezionata
  applyLock(compData, STATE) {
    const banner = document.getElementById('f-lock-banner');
    const editor = document.getElementById('f-editor');
    const saveBtn = document.getElementById('btn-save-lineup');
    const info = document.getElementById('f-save-info');
    const modSelect = document.getElementById('f-modulo');
    if (!banner || !editor) return true;

    const status = compData ? this.getStatus(compData, STATE) : { canPlay: false, reason: 'Seleziona una competizione.' };
    const compName = compData?.name || 'questa competizione';

    if (!status.canPlay) {
      banner.innerHTML = `
        <div class="card card-sm" style="margin-bottom:1rem; border-left:4px solid var(--accent3, #ff4757); background:rgba(255,71,87,.08);">
          <div style="display:flex; gap:.6rem; align-items:flex-start;">
            <i class="ri-lock-line" style="font-size:1.3rem; color:var(--accent3, #ff4757);"></i>
            <div>
              <div style="font-weight:600; font-size:.9rem;">Formazione non modificabile — ${compName}</div>
              <div style="font-size:.8rem; color:var(--text2); margin-top:2px;">${status.reason}</div>
            </div>
          </div>
        </div>`;
    } else {
      banner.innerHTML = '';
    }

    editor.style.opacity = status.canPlay ? '' : '0.45';
    editor.style.pointerEvents = status.canPlay ? '' : 'none';
    if (saveBtn) saveBtn.disabled = !status.canPlay;
    if (modSelect) modSelect.disabled = !status.canPlay;
    editor.querySelectorAll('select, input').forEach(el => { el.disabled = !status.canPlay; });

    // Riepilogo del "salva per tutte"
    if (info) {
      const all = Array.isArray(STATE.competitions) ? STATE.competitions : [];
      const ok = [], no = [];
      all.forEach(c => {
        const st = this.getStatus(c, STATE);
        (st.canPlay ? ok : no).push({ name: c.name || c.id, reason: st.reason, gw: st.gwKey });
      });
      const okTxt = ok.length ? `Verrà salvata in: ${ok.map(o => `<strong>${o.name}</strong> (${GwService.label(o.gw)})`).join(', ')}.` : '';
      const noTxt = no.length ? `<br>Esclusa: ${no.map(o => `<strong>${o.name}</strong> — ${o.reason}`).join('<br>')}` : '';
      info.innerHTML = `${okTxt}${noTxt}`;
    }
    return status.canPlay;
  },

  buildSlots(STATE, userChangedModulo = false) {
    if (!STATE || !STATE.user || !STATE.players || STATE.players.length === 0) return;

    const modSelect = document.getElementById('f-modulo');
    if (!modSelect) return;

    const userId = STATE.user.id;
    const compId = STATE.currentCompetition;
    
    const compData = STATE.competitions?.find ? STATE.competitions.find(c => c.id === compId) : null;
    
    // Calcolo corretto della GW della competizione
    const gwCompetizione = this.getGwCompetizione(compData, STATE);

    let savedLineup = null;
    
    if (gwCompetizione) {
      savedLineup = compData?.matches?.[gwCompetizione]?.lineups?.[userId] || null;
    }

    if (savedLineup && savedLineup.modulo && !userChangedModulo) {
        modSelect.value = savedLineup.modulo;
    }

    const modulo = modSelect.value;
    const [def, mid, att] = modulo.split('-').map(Number);
    
    const miaRosa = STATE.players.filter(p => {
        const pTeamId = String(p.teamId || p.team || '');
        const uId = String(userId || '');
        return pTeamId !== '' && pTeamId === uId;
    });

    this._rosa = miaRosa;
    if (this._picker) this._closePicker();

    const savedTitolariIds = savedLineup?.titolari || [];
    const savedPanchinaIds = savedLineup?.panchina || [];

    this.drawFieldTitolari(def, mid, att, miaRosa, savedTitolariIds);
    const schemaPan = [{role:'P', count:1}, {role:'D', count:2}, {role:'C', count:2}, {role:'A', count:2}];
    this.drawSchemaPanchina('panchina-slots', schemaPan, 'pan', miaRosa, savedPanchinaIds);

    this.refreshAllDropdowns(miaRosa);
    this.applyLock(compData, STATE);
  },

  refreshAllDropdowns(rosa) {
    const allSelects = document.querySelectorAll('#titolari-field-slots select, #panchina-slots select');
    const selectedIds = Array.from(allSelects).map(s => s.value).filter(Boolean);

    allSelects.forEach(sel => {
      const currentVal = sel.value;
      Array.from(sel.options).forEach(opt => {
        if (!opt.value) return; 
        if (selectedIds.includes(opt.value) && opt.value !== currentVal) {
          opt.disabled = true;
        } else {
          opt.disabled = false;
        }
      });
    });
  },

  // ------------------------------------------------------------------
  // Helper grafici
  // ------------------------------------------------------------------
  _esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  _photo(p) {
    return p ? (p.photoPersonal || p.photoStandard || '') : '';
  },

  /** Piccolo badge sullo slot: % di impiego o icona di stato (infortunato, squalificato...). */
  _badgeHtml(player) {
    if (!player) return '';
    const info = ProbabiliService.getInfo(player, window.STATE);
    if (!info.known) return '';
    if (info.st === 'squal' || info.st === 'inf') {
      const s = STATUS_INFO[info.st];
      return `<span class="slot-badge" style="background:${s.color};" title="${s.label}"><i class="${s.icon}"></i></span>`;
    }
    if (info.pct === null) {
      return `<span class="slot-badge" style="background:#5b6b80;" title="Non presente nelle probabili">—</span>`;
    }
    const dot = info.st ? `<i class="${STATUS_INFO[info.st].icon}" style="margin-left:1px;"></i>` : '';
    return `<span class="slot-badge" style="background:${ProbabiliService.pctColor(info.pct)};">${info.pct}%${dot}</span>`;
  },

  _updateSlotBadge(selectEl, rosa) {
    const target = document.getElementById(selectEl.dataset.badgeTarget || '');
    if (!target) return;
    const pObj = rosa.find(p => String(p.id) === String(selectEl.value));
    target.innerHTML = this._badgeHtml(pObj);
  },

  /** Chiamato da index.html quando arrivano/aggiornano i dati delle probabili. */
  onProbabiliUpdate() {
    const rosa = this._rosa || [];
    document.querySelectorAll('#titolari-field-slots select, #panchina-slots select')
      .forEach(sel => this._updateSlotBadge(sel, rosa));
    if (this._picker?.select) this._renderPicker();
  },

  // ------------------------------------------------------------------
  // BOX DI SCELTA GIOCATORE
  // ------------------------------------------------------------------
  _ensurePickerDom() {
    let ov = document.getElementById('fp-overlay');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'fp-overlay';
    ov.className = 'fp-overlay';
    ov.innerHTML = `
      <div class="fp-sheet" role="dialog" aria-modal="true">
        <div class="fp-head">
          <div>
            <div class="fp-title" id="fp-title"></div>
            <div class="fp-sub" id="fp-sub"></div>
          </div>
          <button class="fp-close" id="fp-close" aria-label="Chiudi"><i class="ri-close-line"></i></button>
        </div>
        <div class="fp-list" id="fp-list"></div>
        <div class="fp-foot" id="fp-foot"></div>
      </div>`;
    document.body.appendChild(ov);

    ov.addEventListener('click', (e) => { if (e.target === ov) this._closePicker(); });
    ov.querySelector('#fp-close').addEventListener('click', () => this._closePicker());
    ov.querySelector('#fp-list').addEventListener('click', (e) => {
      const row = e.target.closest('.fp-row');
      if (!row || row.classList.contains('is-used')) return;
      this._choose(row.dataset.id);
    });
    ov.querySelector('#fp-foot').addEventListener('click', (e) => {
      if (e.target.closest('[data-clear]')) this._choose('');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && ov.classList.contains('open')) this._closePicker();
    });
    return ov;
  },

  _openPicker(selectEl, rosa) {
    if (!selectEl || selectEl.disabled) return;
    this._picker = { select: selectEl, rosa };
    const ov = this._ensurePickerDom();
    this._renderPicker();
    ov.classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  _closePicker() {
    const ov = document.getElementById('fp-overlay');
    if (ov) ov.classList.remove('open');
    document.body.style.overflow = '';
    this._picker = null;
  },

  _choose(id) {
    const sel = this._picker?.select;
    if (!sel) return;
    sel.value = id;
    sel.dispatchEvent(new Event('change'));
    this._closePicker();
  },

  _renderPicker() {
    const { select, rosa } = this._picker || {};
    if (!select) return;
    const STATE = window.STATE;
    const role = select.dataset.role;
    const roleNames = { P: 'Portieri', D: 'Difensori', C: 'Centrocampisti', A: 'Attaccanti' };
    const isPan = select.closest('#panchina-slots') !== null;

    // Giocatori già schierati negli altri slot (titolari o panchina)
    const used = {};
    document.querySelectorAll('#titolari-field-slots select').forEach(s => {
      if (s !== select && s.value) used[s.value] = 'Già titolare';
    });
    document.querySelectorAll('#panchina-slots select').forEach(s => {
      if (s !== select && s.value) used[s.value] = 'Già in panchina';
    });

    const rows = rosa
      .filter(p => p.role === role)
      .map(p => ({ p, info: ProbabiliService.getInfo(p, STATE), used: used[String(p.id)] || null }))
      .sort((a, b) => {
        if (!!a.used !== !!b.used) return a.used ? 1 : -1;               // già schierati in fondo
        // squalificati e infortunati contano come 0%: finiscono sotto chi gioca
        const eff = (i) => (i.st === 'squal' || i.st === 'inf') ? 0 : (i.pct ?? -1);
        const pa = eff(a.info), pb = eff(b.info);
        if (pb !== pa) return pb - pa;                                     // % di impiego decrescente
        return String(a.p.name).localeCompare(String(b.p.name));
      });

    const meta = ProbabiliService.meta(STATE);
    const gwReale = STATE?.giornataRealeCorrente;
    let sub = isPan ? 'Panchina' : 'Titolare';
    if (!ProbabiliService.hasData(STATE)) {
      sub += ' · probabili formazioni non ancora disponibili';
    } else if (meta?.giornata) {
      const stale = gwReale && Number(meta.giornata) !== Number(gwReale);
      sub += ` · Probabili ${meta.giornata}ª giornata`;
      if (meta.updatedAt) {
        const d = new Date(meta.updatedAt);
        sub += ` (agg. ${d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })})`;
      }
      if (stale) sub += ` <span style="color:var(--gold);">· la giornata attiva è la ${gwReale}ª</span>`;
    }

    document.getElementById('fp-title').innerHTML =
      `<span class="rbadge r${role}" style="width:22px;height:22px;font-size:.65rem;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;margin-right:.4rem;">${role}</span>Scegli tra i tuoi ${roleNames[role] || role}`;
    document.getElementById('fp-sub').innerHTML = sub;

    const esc = (s) => this._esc(s);
    const list = document.getElementById('fp-list');

    if (!rows.length) {
      list.innerHTML = `<div class="fp-empty">Nessun giocatore in rosa per questo ruolo.</div>`;
    } else {
      list.innerHTML = rows.map(({ p, info, used: usedAs }) => {
        const photo = this._photo(p);
        const isCurrent = String(p.id) === String(select.value);
        const img = photo
          ? `<img src="${esc(photo)}" alt="" loading="lazy">`
          : `<div class="fp-ph">${role}</div>`;

        // Avversario
        let opp = '';
        if (info.opp) {
          opp = `<span class="fp-opp">vs ${esc(info.opp.name)} <em>${info.opp.home ? '(C)' : '(T)'}</em></span>`;
        } else if (info.known) {
          opp = `<span class="fp-opp" style="opacity:.6;">avversario n.d.</span>`;
        }

        // Probabilità
        let pctHtml;
        if (!info.known) {
          pctHtml = `<div class="fp-pct"><span class="fp-pct-val" style="color:var(--text3);">—</span></div>`;
        } else if (info.pct === null && (info.st === 'squal' || info.st === 'inf')) {
          pctHtml = `<div class="fp-pct"><span class="fp-pct-val" style="color:${STATUS_INFO[info.st].color};">OUT</span></div>`;
        } else if (info.pct === null) {
          pctHtml = `<div class="fp-pct"><span class="fp-pct-val" style="color:var(--text3); font-size:.65rem;">non in<br>lista</span></div>`;
        } else {
          const col = ProbabiliService.pctColor(info.pct);
          pctHtml = `
            <div class="fp-pct">
              <span class="fp-pct-val" style="color:${col};">${info.pct}%</span>
              <div class="fp-bar"><div style="width:${info.pct}%; background:${col};"></div></div>
              ${info.xi ? `<span class="fp-xi">${info.xi === 'tit' ? "dal 1'" : 'panchina'}</span>` : ''}
            </div>`;
        }

        // Stato (infortunato / squalificato / diffidato / in dubbio)
        let stato = '';
        if (info.st && STATUS_INFO[info.st]) {
          const s = STATUS_INFO[info.st];
          stato = `<div class="fp-status" style="color:${s.color};">
              <span class="fp-chip" style="background:${s.color}22; border-color:${s.color};"><i class="${s.icon}"></i> ${s.label}</span>
              ${info.note ? `<span class="fp-note">${esc(info.note)}</span>` : ''}
            </div>`;
        }

        const usedTag = usedAs ? `<span class="fp-used-tag"><i class="ri-lock-line"></i> ${usedAs}</span>` : '';
        const curTag = isCurrent ? `<span class="fp-cur-tag"><i class="ri-check-line"></i> Selezionato</span>` : '';

        return `
          <div class="fp-row ${usedAs ? 'is-used' : ''} ${isCurrent ? 'is-current' : ''}" data-id="${esc(p.id)}" ${usedAs ? 'aria-disabled="true"' : 'role="button" tabindex="0"'}>
            <div class="fp-img">${img}</div>
            <div class="fp-main">
              <div class="fp-name">${esc(p.name)} ${curTag}${usedTag}</div>
              <div class="fp-meta"><span class="fp-club">${esc(p.club || '')}</span>${opp}</div>
              ${stato}
            </div>
            ${pctHtml}
          </div>`;
      }).join('');
    }

    document.getElementById('fp-foot').innerHTML = select.value
      ? `<button class="btn btn-outline" data-clear style="width:100%; padding:.6rem;"><i class="ri-delete-bin-line"></i> Svuota questo slot</button>`
      : '';
  },

  drawFieldTitolari(def, mid, att, rosa, savedIds) {
    const container = document.getElementById('titolari-field-slots');
    if (!container) return;
    container.innerHTML = '';

    const ruoli = [
      { role: 'P', count: 1 },
      { role: 'D', count: def },
      { role: 'C', count: mid },
      { role: 'A', count: att }
    ];

    const rowPositions = { 'A': 20, 'C': 45, 'D': 70, 'P': 90 };

    ruoli.forEach(reparto => {
      const y = rowPositions[reparto.role];
      const count = reparto.count;

      for (let i = 1; i <= count; i++) {
        const x = count === 1 ? 50 : (100 / (count + 1)) * i;
        const slotId = `tit-${reparto.role}-${i}`;
        
        const ops = rosa.filter(p => p.role === reparto.role);

        let preselectedId = "";
        let preselectedText = "Scegli";
        let isSelected = false;
        let photoUrl = "";

        if (savedIds && savedIds.length > 0) {
          const ruoloSavedIds = savedIds.filter(id => {
            const p = rosa.find(player => player.id === id);
            return p && p.role === reparto.role;
          });
          
          if (ruoloSavedIds[i - 1]) {
            preselectedId = ruoloSavedIds[i - 1];
            const pObj = rosa.find(p => p.id === preselectedId);
            if (pObj) {
              preselectedText = pObj.name;
              isSelected = true;
              photoUrl = this._photo(pObj);
            }
          }
        }

        let bgShirt = '#475569'; 
        if (reparto.role === 'D') bgShirt = '#2196f3'; 
        if (reparto.role === 'C') bgShirt = '#e91e63'; 
        if (reparto.role === 'A') bgShirt = '#ff5722'; 

        const playerDiv = document.createElement('div');
        playerDiv.className = 'field-player';
        playerDiv.style.left = `${x}%`;
        playerDiv.style.top = `${y}%`;

        const shirtClass = photoUrl ? 'player-shirt has-png' : 'player-shirt is-circle';
        const shirtStyle = photoUrl 
          ? `background-image: url('${photoUrl}');`
          : `background-color: ${bgShirt}; color: #fff;`;

        const preObj = rosa.find(p => p.id === preselectedId);

        playerDiv.innerHTML = `
          <div class="shirt-wrap">
            <div class="${shirtClass}" id="shirt-${slotId}" style="${shirtStyle}">
              ${photoUrl ? '' : reparto.role}
            </div>
            <div class="slot-badge-wrap" id="badge-${slotId}">${this._badgeHtml(preObj)}</div>
          </div>
          <div class="player-name-label" id="label-${slotId}" style="${isSelected ? 'color: var(--accent); border-color: var(--accent);' : ''}">
            ${this._esc(preselectedText)}
          </div>
          
          <select id="${slotId}" data-role="${reparto.role}" data-label-target="label-${slotId}" data-shirt-target="shirt-${slotId}" data-badge-target="badge-${slotId}" class="field-select" tabindex="-1" aria-hidden="true">
            <option value="">-- ${reparto.role} --</option>
            ${ops.map(p => `<option value="${p.id}" ${p.id === preselectedId ? 'selected' : ''}>${this._esc(p.name)} (${this._esc(p.club)})</option>`).join('')}
          </select>
        `;

        container.appendChild(playerDiv);

        const sel = playerDiv.querySelector('select');
        playerDiv.addEventListener('click', () => this._openPicker(sel, rosa));

        sel.addEventListener('change', (e) => {
          const val = e.target.value;
          const labelId = e.target.dataset.labelTarget;
          const shirtId = e.target.dataset.shirtTarget;
          const labelEl = document.getElementById(labelId);
          const shirtEl = document.getElementById(shirtId);

          if (!val) {
            labelEl.textContent = 'Scegli';
            labelEl.style.color = '';
            labelEl.style.borderColor = '';
            
            shirtEl.className = 'player-shirt is-circle';
            shirtEl.style.cssText = `background-color: ${bgShirt}; color: #fff;`;
            shirtEl.textContent = reparto.role;
          } else {
            const pObj = rosa.find(p => String(p.id) === String(val));
            const pPhoto = this._photo(pObj);

            labelEl.textContent = pObj ? pObj.name : 'Scegli';
            labelEl.style.color = 'var(--accent)';
            labelEl.style.borderColor = 'var(--accent)';

            if (pPhoto) {
              shirtEl.className = 'player-shirt has-png';
              shirtEl.style.cssText = `background-image: url('${pPhoto}');`;
              shirtEl.textContent = '';
            } else {
              shirtEl.className = 'player-shirt is-circle';
              shirtEl.style.cssText = `background-color: ${bgShirt}; color: #fff;`;
              shirtEl.textContent = reparto.role;
            }
          }
          this._updateSlotBadge(e.target, rosa);
          this.refreshAllDropdowns(rosa);
        });
      }
    });
  },

  drawSchemaPanchina(id, schema, prefix, rosa, savedIds) {
    const container = document.getElementById(id);
    if (!container) return;
    container.innerHTML = '';

    const placeholderImg = (imgId) => `<div id="${imgId}" style="width:28px; height:28px; background:var(--bg3); display:flex; align-items:center; justify-content:center; border-radius:4px; font-size:0.65rem; color:var(--text3); flex-shrink:0;"><i class="ri-user-3-line"></i></div>`;
    const photoImg = (imgId, url) => `<img id="${imgId}" src="${url}" style="width:28px; height:28px; object-fit:contain; flex-shrink:0;">`;
    
    schema.forEach(item => {
      for (let i = 1; i <= item.count; i++) {
        const slotId = `${prefix}-${item.role}-${i}`;
        const ops = rosa.filter(p => p.role === item.role);

        let preselectedId = "";
        let currentPhoto = "";
        let preObj = null;

        if (savedIds && savedIds.length > 0) {
          const ruoloSavedIds = savedIds.filter(id => {
            const p = rosa.find(player => player.id === id);
            return p && p.role === item.role;
          });
          if (ruoloSavedIds[i - 1]) {
            preselectedId = ruoloSavedIds[i - 1];
            preObj = rosa.find(p => p.id === preselectedId) || null;
            if (preObj) currentPhoto = this._photo(preObj);
          }
        }

        const div = document.createElement('div');
        div.className = 'pcard pan-slot'; 
        div.style.padding = '.4rem .6rem';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.gap = '0.5rem';

        const imgHtml = currentPhoto ? photoImg(`img-${slotId}`, currentPhoto) : placeholderImg(`img-${slotId}`);
        const emptyTxt = `-- Seleziona ${item.role} --`;

        div.innerHTML = `
          <div class="rbadge r${item.role}" style="width:24px;height:24px;font-size:.65rem;border-radius:5px;flex-shrink:0;">${item.role}</div>
          ${imgHtml}
          <div class="pan-pick" id="name-${slotId}" style="${preObj ? 'color:var(--text);' : ''}">${preObj ? `${this._esc(preObj.name)} <span style="color:var(--text3); font-size:.72rem;">(${this._esc(preObj.club)})</span>` : emptyTxt}</div>
          <div id="badge-${slotId}" class="pan-badge">${this._badgeHtml(preObj)}</div>
          <i class="ri-arrow-down-s-line" style="color:var(--text3);"></i>
          <select id="${slotId}" data-role="${item.role}" data-img-target="img-${slotId}" data-badge-target="badge-${slotId}" style="display:none;" tabindex="-1" aria-hidden="true">
            <option value="">${emptyTxt}</option>
            ${ops.map(p => `<option value="${p.id}" ${p.id === preselectedId ? 'selected' : ''}>${this._esc(p.name)} (${this._esc(p.club)})</option>`).join('')}
          </select>
        `;
        container.appendChild(div);

        const sel = div.querySelector('select');
        div.addEventListener('click', () => this._openPicker(sel, rosa));

        sel.addEventListener('change', (e) => {
          const val = e.target.value;
          const imgTargetId = e.target.dataset.imgTarget;
          const imgEl = document.getElementById(imgTargetId);
          const pObj = rosa.find(p => String(p.id) === String(val));
          const pPhoto = this._photo(pObj);

          if (imgEl) imgEl.outerHTML = pPhoto ? photoImg(imgTargetId, pPhoto) : placeholderImg(imgTargetId);

          const nameEl = document.getElementById(`name-${slotId}`);
          if (nameEl) {
            nameEl.innerHTML = pObj ? `${this._esc(pObj.name)} <span style="color:var(--text3); font-size:.72rem;">(${this._esc(pObj.club)})</span>` : emptyTxt;
            nameEl.style.color = pObj ? 'var(--text)' : '';
          }

          this._updateSlotBadge(e.target, rosa);
          this.refreshAllDropdowns(rosa);
        });
      }
    });
  },

  async save(STATE) {
    const modulo = document.getElementById('f-modulo').value;
    
    const titS = document.querySelectorAll('#titolari-field-slots select');
    const panS = document.querySelectorAll('#panchina-slots select');
    
    let titIds = []; 
    let panIds = [];
    
    titS.forEach(s => { if(s.value) titIds.push(s.value); });
    panS.forEach(s => { if(s.value) panIds.push(s.value); });

    if (titIds.length < 11 || panIds.length < 7) { 
      window.showToast(`Completa tutta la formazione (titolari e panchina) prima di salvare!`, 'err'); 
      return; 
    }
    
    const saveAllChecked = document.getElementById('save-all-comps')?.checked;
    const competitionsToSave = [];

    if (saveAllChecked && Array.isArray(STATE.competitions)) {
      STATE.competitions.forEach(c => competitionsToSave.push(c));
    } else {
      const currentCompId = STATE.currentCompetition;
      const currentCompData = STATE.competitions?.find ? STATE.competitions.find(c => c.id === currentCompId) : null;
      if (currentCompData) competitionsToSave.push(currentCompData);
    }

    // Competizione corrente bloccata: non si salva nulla
    const curComp = Array.isArray(STATE.competitions) ? STATE.competitions.find(c => c.id === STATE.currentCompetition) : null;
    const curStatus = curComp ? this.getStatus(curComp, STATE) : null;
    if (!curStatus || !curStatus.canPlay) {
      window.showToast(curStatus?.reason || 'Formazione non modificabile.', 'err');
      return;
    }

    try {
      const saltate = [];
      let salvate = 0;

      for (const comp of competitionsToSave) {
        const compId = comp.id;
        
        // Giornata di competizione specifica per QUESTA competizione, ricavata dalla giornata Serie A corrente
        const status = this.getStatus(comp, STATE);
        const gwCompetizione = status.gwKey;
        if (!status.canPlay || !gwCompetizione) {
          saltate.push(`${comp.name || compId} (${status.reason})`);
          continue;
        }

        const path = `competitions/${compId}/matches/${gwCompetizione}/lineups/${STATE.user.id}`;
        
        const dataToSave = {
          teamId: STATE.user.id, 
          modulo, 
          titolari: titIds, 
          panchina: panIds, 
          timestamp: Date.now()
        };
        
        await window._saveNode(path, dataToSave);

        if (!comp.matches) comp.matches = {};
        if (!comp.matches[gwCompetizione]) comp.matches[gwCompetizione] = {};
        if (!comp.matches[gwCompetizione].lineups) comp.matches[gwCompetizione].lineups = {};
        
        comp.matches[gwCompetizione].lineups[STATE.user.id] = dataToSave;
        salvate++;
      }

      if (salvate === 0) {
        window.showToast('Formazione non salvata: nessuna competizione disponibile per questa giornata.', 'err');
      } else if (saltate.length) {
        window.showToast(`Salvata. Esclusa: ${saltate.join('; ')}`, 'ok');
      } else {
        window.showToast('Formazione salvata con successo!', 'ok');
      }
    } catch(e) { 
      console.error(e);
      window.showToast('Errore durante il salvataggio', 'err'); 
    }
  }
};
