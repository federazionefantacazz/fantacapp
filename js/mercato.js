import { db, ref, set, update } from './firebase-config.js';
import { MercatoService, ROLES, LOAN_MIN, LOAN_MAX } from './services/mercatoService.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const sid = (v) => String(v ?? '');
const ROLE_COLOR = { P: '#475569', D: '#2196f3', C: '#e91e63', A: '#ff5722' };
const ROLE_NAME = { P: 'Portieri', D: 'Difensori', C: 'Centrocampisti', A: 'Attaccanti' };

const STATUS = {
  pending:   { label: 'In attesa',  color: 'var(--gold)',    icon: 'ri-time-line' },
  accepted:  { label: 'Accettata',  color: 'var(--accent)',  icon: 'ri-checkbox-circle-line' },
  active:    { label: 'Prestito attivo', color: 'var(--accent)', icon: 'ri-loop-right-line' },
  returned:  { label: 'Prestito concluso', color: 'var(--text2)', icon: 'ri-arrow-go-back-line' },
  rejected:  { label: 'Rifiutata',  color: 'var(--accent3)', icon: 'ri-close-circle-line' },
  withdrawn: { label: 'Ritirata',   color: 'var(--text2)',   icon: 'ri-arrow-go-back-line' },
  cancelled: { label: 'Annullata',  color: 'var(--text2)',   icon: 'ri-forbid-line' }
};

const STYLES = `
.mk-tabs{display:flex;gap:.4rem;margin-bottom:1.2rem;background:var(--bg2);padding:.4rem;border-radius:12px}
.mk-tabs .btn{padding:.5rem .3rem;font-size:.75rem;flex:1;position:relative}
.mk-dot{position:absolute;top:-4px;right:-2px;min-width:18px;height:18px;border-radius:9px;background:var(--accent3);color:#fff;font-size:.65rem;display:flex;align-items:center;justify-content:center;padding:0 4px}
.mk-seg{display:flex;gap:.4rem;margin:.2rem 0 1rem}
.mk-seg .btn{padding:.55rem;font-size:.8rem}
.mk-rosters{display:flex;gap:.8rem;flex-wrap:wrap}
.mk-roster{flex:1;min-width:280px}
.mk-rhead{font-weight:600;font-size:.85rem;margin-bottom:.5rem;display:flex;align-items:center;gap:.4rem}
.mk-rgroup{font-size:.68rem;letter-spacing:.5px;text-transform:uppercase;color:var(--text2);margin:.6rem 0 .3rem}
.mk-prow{display:flex;align-items:center;gap:.6rem;padding:.4rem .55rem;border-radius:10px;background:var(--card2);margin-bottom:.3rem;cursor:pointer;border:1px solid transparent;transition:all .15s}
.mk-prow.sel{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 10%,transparent)}
.mk-prow.lock{opacity:.45;cursor:not-allowed}
.mk-prow .nm{font-size:.82rem;font-weight:500;line-height:1.1}
.mk-prow .sub{font-size:.68rem;color:var(--text2)}
.mk-check{margin-left:auto;width:20px;height:20px;border-radius:6px;border:2px solid rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:.8rem;flex-shrink:0}
.mk-prow.sel .mk-check{background:var(--accent);border-color:var(--accent);color:#0a0f1e}
.mk-sumcols{display:flex;gap:.8rem;flex-wrap:wrap}
.mk-sumcol{flex:1;min-width:140px;background:var(--bg3);border-radius:10px;padding:.6rem .7rem}
.mk-badge{display:inline-flex;align-items:center;gap:.25rem;font-size:.68rem;font-weight:600;padding:.15rem .5rem;border-radius:20px;border:1px solid currentColor}
.mk-trade{margin-bottom:.7rem}
.mk-line{font-size:.78rem;display:flex;align-items:center;gap:.4rem;padding:.15rem 0}
.mk-sec{margin:1.2rem 0 .5rem;display:flex;align-items:center;gap:.4rem}
`;

export const MercatoPage = {
  STATE: null,
  _sig: '',
  ui: { tab: 'nuova', dest: '', tipo: 'scambio', durata: LOAN_MIN, give: new Set(), get: new Set() },

  renderHTML() {
    return `
      <div class="page" id="page-mercato">
        <div class="sec" style="margin-top:1.2rem">Mercato</div>

        <div class="mk-tabs">
          <button class="btn tab-btn btn-green" data-act="tab" data-tab="nuova"><i class="ri-exchange-line"></i> Nuova</button>
          <button class="btn tab-btn btn-outline" data-act="tab" data-tab="trattative"><i class="ri-history-line"></i> Trattative<span class="mk-dot" id="mk-dot" style="display:none"></span></button>
          <button class="btn tab-btn btn-outline" data-act="tab" data-tab="gestione"><i class="ri-settings-3-line"></i> Rosa</button>
        </div>

        <div id="mk-nuova" class="market-subpage">
          <div class="card">
            <div class="label" style="color:var(--title,var(--text)); margin-bottom: .6rem; display: flex; align-items: center; gap: 0.4rem;"><i class="ri-add-circle-line"></i> Proponi una trattativa</div>

            <div class="label">Tipo di trattativa</div>
            <div class="mk-seg">
              <button class="btn btn-green" data-act="tipo" data-tipo="scambio"><i class="ri-exchange-line"></i> Scambio</button>
              <button class="btn btn-outline" data-act="tipo" data-tipo="prestito"><i class="ri-loop-right-line"></i> Prestito</button>
            </div>

            <div class="label">Con quale squadra?</div>
            <select id="mk-dest" class="select-rose" style="background: var(--bg3);"><option value="">Caricamento squadre...</option></select>
          </div>
          <div id="mk-builder"></div>
        </div>

        <div id="mk-trattative" class="market-subpage" style="display:none"></div>

        <div id="mk-gestione" class="market-subpage" style="display: none;">
          <div class="card" style="text-align: center; padding: 2.5rem 1.5rem; border: 1px dashed var(--accent3);">
            <div style="font-size: 2.5rem; margin-bottom: .8rem; color: var(--accent3);"><i class="ri-lock-line"></i></div>
            <div class="label" style="color: var(--accent3); font-size: .9rem; margin-bottom: .5rem;">Sessione Chiusa</div>
            <p style="font-size: .8rem; color: var(--text2); line-height: 1.4;">
              Acquisti e svincoli dal mercato degli svincolati sono momentaneamente disattivati dall'amministratore della lega.
            </p>
          </div>
        </div>
      </div>
    `;
  },

  /* ───────────────────────── render ───────────────────────── */

  render(STATE) {
    this.STATE = STATE;
    const root = document.getElementById('page-mercato');
    if (!root || !STATE?.user) return;

    if (!root.dataset.bound) {
      root.dataset.bound = '1';
      this._injectStyles();
      root.addEventListener('click', (e) => this._onClick(e));
      root.addEventListener('change', (e) => this._onChange(e));
      this._sig = '';
    }

    this._fillDest();

    const sig = this._signature();
    if (sig !== this._sig) {
      this._sig = sig;
      this._refresh();
    }
  },

  _injectStyles() {
    if (document.getElementById('mercato-styles')) return;
    const st = document.createElement('style');
    st.id = 'mercato-styles';
    st.textContent = STYLES;
    document.head.appendChild(st);
  },

  _me() { return sid(this.STATE.user.id); },
  _gw() { return Number(this.STATE.giornataRealeCorrente) || 0; },
  _team(id) { return (this.STATE.teams || []).find(t => sid(t.id) === sid(id)); },
  _teamName(id) { return this._team(id)?.name || `Squadra ${id}`; },
  _roster(teamId) { return (this.STATE.players || []).filter(p => p && sid(p.teamId) === sid(teamId)); },
  _myTrades() {
    const me = this._me();
    return Object.values(this.STATE.trades || {})
      .filter(t => t && (sid(t.fromTeamId) === me || sid(t.toTeamId) === me))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },

  _signature() {
    const me = this._me();
    const parts = [this.ui.tab, this.ui.dest, this._gw(), (this.STATE.teams || []).length];
    this._myTrades().forEach(t => parts.push(`${t.id}:${t.status}`));
    (this.STATE.players || []).forEach(p => {
      if (p && (sid(p.teamId) === me || sid(p.teamId) === sid(this.ui.dest) || p.loan)) parts.push(`${p.id}:${p.teamId}:${p.loan ? 1 : 0}`);
    });
    return parts.join('|');
  },

  _fillDest() {
    const select = document.getElementById('mk-dest');
    if (!select) return;
    const others = (this.STATE.teams || []).filter(t => sid(t.id) !== this._me());
    const key = others.map(t => `${t.id}:${t.name}`).join('|');
    if (select.dataset.key === key) return;
    select.dataset.key = key;
    select.innerHTML = '<option value="">-- Scegli la squadra --</option>' +
      others.map(t => `<option value="${esc(t.id)}">${esc(t.name)}${t.owner ? ` (${esc(t.owner)})` : ''}</option>`).join('');
    select.value = this.ui.dest || '';
  },

  _refresh() {
    this._updateTabs();
    this._updateTipoButtons();
    if (this.ui.tab === 'nuova') this._renderBuilder();
    if (this.ui.tab === 'trattative') this._renderTrattative();
    const pendingIn = this._myTrades().filter(t => t.status === 'pending' && sid(t.toTeamId) === this._me()).length;
    const dot = document.getElementById('mk-dot');
    if (dot) { dot.style.display = pendingIn ? 'flex' : 'none'; dot.textContent = pendingIn; }
  },

  _updateTabs() {
    document.querySelectorAll('#page-mercato .mk-tabs [data-act="tab"]').forEach(b => {
      b.className = `btn tab-btn ${b.dataset.tab === this.ui.tab ? 'btn-green' : 'btn-outline'}`;
    });
    ['nuova', 'trattative', 'gestione'].forEach(t => {
      const el = document.getElementById(`mk-${t}`);
      if (el) el.style.display = t === this.ui.tab ? 'block' : 'none';
    });
  },

  _updateTipoButtons() {
    document.querySelectorAll('#page-mercato [data-act="tipo"]').forEach(b => {
      b.className = `btn ${b.dataset.tipo === this.ui.tipo ? 'btn-green' : 'btn-outline'}`;
    });
  },

  /* ───────────────────────── eventi ───────────────────────── */

  _onChange(e) {
    if (e.target.id === 'mk-dest') {
      this.ui.dest = e.target.value;
      this.ui.give.clear();
      this.ui.get.clear();
      this._sig = '';
      this.render(this.STATE);
    } else if (e.target.id === 'mk-durata') {
      this.ui.durata = Number(e.target.value);
      this._renderBuilder();
    }
  },

  _onClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;

    if (act === 'tab') { this.ui.tab = el.dataset.tab; this._sig = ''; this.render(this.STATE); }
    else if (act === 'tipo') { this.ui.tipo = el.dataset.tipo; this._updateTipoButtons(); this._renderBuilder(); }
    else if (act === 'toggle') this._toggle(el.dataset.side, el.dataset.pid);
    else if (act === 'send') this._send();
    else if (act === 'reset') { this.ui.give.clear(); this.ui.get.clear(); this._renderBuilder(); }
    else if (act === 'withdraw') this._withdraw(el.dataset.tid);
    else if (act === 'accept') this._accept(el.dataset.tid);
    else if (act === 'reject') this._reject(el.dataset.tid);
  },

  _toggle(side, pid) {
    const set = side === 'give' ? this.ui.give : this.ui.get;
    if (set.has(pid)) set.delete(pid); else set.add(pid);
    this._renderBuilder();
  },

  /* ───────────────────────── builder ───────────────────────── */

  _playerRow(p, side, selected) {
    const locked = !!p.loan;
    const lockTxt = locked ? `In prestito fino alla G${p.loan.endGw}` : (p.club || '');
    return `
      <div class="mk-prow ${selected ? 'sel' : ''} ${locked ? 'lock' : ''}" ${locked ? '' : `data-act="toggle" data-side="${side}" data-pid="${esc(p.id)}"`}>
        <div class="rbadge" style="background:${ROLE_COLOR[p.role] || '#555'}">${esc(p.role)}</div>
        <div><div class="nm">${esc(p.name)}</div><div class="sub">${esc(lockTxt)}</div></div>
        <div class="mk-check">${locked ? '<i class="ri-lock-line" style="font-size:.7rem"></i>' : (selected ? '<i class="ri-check-line"></i>' : '')}</div>
      </div>`;
  },

  _rosterColumn(title, teamId, side) {
    const sel = side === 'give' ? this.ui.give : this.ui.get;
    const roster = this._roster(teamId);
    let html = `<div class="mk-roster card card-sm"><div class="mk-rhead"><i class="ri-team-line"></i> ${esc(title)}</div>`;
    if (!roster.length) html += `<div style="font-size:.8rem;color:var(--text2);padding:.5rem">Nessun giocatore in rosa.</div>`;
    ROLES.forEach(r => {
      const list = roster.filter(p => p.role === r).sort((a, b) => String(a.name).localeCompare(String(b.name)));
      if (!list.length) return;
      html += `<div class="mk-rgroup">${ROLE_NAME[r]}</div>` + list.map(p => this._playerRow(p, side, sel.has(sid(p.id)))).join('');
    });
    return html + '</div>';
  },

  _renderBuilder() {
    const box = document.getElementById('mk-builder');
    if (!box) return;
    const dest = this.ui.dest;
    if (!dest || !this._team(dest)) {
      box.innerHTML = `<div style="text-align:center;color:var(--text3);font-size:.85rem;padding:1.5rem">Scegli una squadra per vedere le due rose.</div>`;
      return;
    }

    const me = this._me();
    const pmap = MercatoService.playerMap(this.STATE.players);
    const give = [...this.ui.give].filter(id => pmap.get(id)?.teamId !== undefined && sid(pmap.get(id).teamId) === me);
    const get = [...this.ui.get].filter(id => pmap.get(id) && sid(pmap.get(id).teamId) === sid(dest));
    this.ui.give = new Set(give);
    this.ui.get = new Set(get);

    const isLoan = this.ui.tipo === 'prestito';
    const proposta = { tipo: this.ui.tipo, fromTeamId: me, toTeamId: dest, give, get, durata: this.ui.durata };
    const check = (give.length || get.length) ? MercatoService.valida(proposta, this.STATE.players) : { ok: false, error: 'Seleziona i giocatori da scambiare.' };

    const cg = MercatoService.roleCounts(give, pmap);
    const cr = MercatoService.roleCounts(get, pmap);
    const roleLines = ROLES.filter(r => cg[r] || cr[r]).map(r => {
      const ok = cg[r] === cr[r];
      return `<div class="mk-line" style="color:${ok ? 'var(--accent)' : 'var(--accent3)'}"><i class="${ok ? 'ri-check-line' : 'ri-close-line'}"></i> ${ROLE_NAME[r]}: cedi ${cg[r]} · ricevi ${cr[r]}</div>`;
    }).join('');

    const names = (ids) => ids.map(id => {
      const p = pmap.get(id);
      return `<div class="mk-line"><span class="rbadge" style="width:20px;height:20px;font-size:.62rem;border-radius:5px;background:${ROLE_COLOR[p.role]}">${esc(p.role)}</span>${esc(p.name)}</div>`;
    }).join('') || `<div style="font-size:.75rem;color:var(--text3)">Nessuno</div>`;

    const gw = this._gw();
    const durataBox = isLoan ? `
      <div style="margin-top:1rem">
        <div class="label">Durata del prestito (giornate di Serie A)</div>
        <select id="mk-durata" class="select-rose" style="background:var(--bg3)">
          ${Array.from({ length: LOAN_MAX - LOAN_MIN + 1 }, (_, i) => LOAN_MIN + i).map(n => `<option value="${n}" ${n === this.ui.durata ? 'selected' : ''}>${n} giornate</option>`).join('')}
        </select>
        <div style="font-size:.75rem;color:var(--text2);margin-top:.4rem">Se accettato ora: dalla G${gw} alla G${gw + this.ui.durata}, poi i giocatori tornano alle squadre di origine.</div>
      </div>` : '';

    box.innerHTML = `
      <div class="mk-rosters">
        ${this._rosterColumn(`La tua rosa — ${this._teamName(me)}`, me, 'give')}
        ${this._rosterColumn(`Rosa di ${this._teamName(dest)}`, dest, 'get')}
      </div>

      <div class="card" style="margin-top:.8rem">
        <div class="label" style="color:var(--title,var(--accent));margin-bottom:.6rem"><i class="ri-clipboard-line"></i> Riepilogo ${isLoan ? 'prestito' : 'scambio'}</div>
        <div class="mk-sumcols">
          <div class="mk-sumcol"><div class="label" style="font-size:.7rem">Cedi (${give.length})</div>${names(give)}</div>
          <div class="mk-sumcol"><div class="label" style="font-size:.7rem">Ricevi (${get.length})</div>${names(get)}</div>
        </div>
        <div style="margin-top:.7rem">${roleLines}</div>
        ${durataBox}
        ${!check.ok && (give.length || get.length) ? `<div style="font-size:.78rem;color:var(--accent3);margin-top:.7rem"><i class="ri-error-warning-line"></i> ${esc(check.error)}</div>` : ''}
        <div style="display:flex;gap:.5rem;margin-top:1rem">
          <button class="btn btn-outline" data-act="reset" style="width:35%">Azzera</button>
          <button class="btn btn-green" data-act="send" ${check.ok ? '' : 'disabled style="opacity:.5;cursor:not-allowed"'}><i class="ri-send-plane-line"></i> Invia offerta</button>
        </div>
      </div>`;
  },

  async _send() {
    const me = this._me();
    const proposta = { tipo: this.ui.tipo, fromTeamId: me, toTeamId: this.ui.dest, give: [...this.ui.give], get: [...this.ui.get], durata: this.ui.durata };
    const check = MercatoService.valida(proposta, this.STATE.players);
    if (!check.ok) return window.showToast(check.error, 'err');

    const trade = MercatoService.buildTrade(proposta, this.STATE.players, this._gw());
    try {
      await set(ref(db, `trades/${trade.id}`), trade);
      window.showToast('Offerta inviata!', 'ok');
      this.ui.give.clear();
      this.ui.get.clear();
      this.ui.tab = 'trattative';
      this.STATE.trades = { ...(this.STATE.trades || {}), [trade.id]: trade };
      this._sig = '';
      this.render(this.STATE);
    } catch (err) {
      console.error(err);
      window.showToast("Errore nell'invio dell'offerta", 'err');
    }
  },

  /* ───────────────────────── trattative ───────────────────────── */

  _tradeCard(t) {
    const me = this._me();
    const mine = sid(t.fromTeamId) === me;
    const other = mine ? t.toTeamId : t.fromTeamId;
    const st = STATUS[t.status] || { label: t.status, color: 'var(--text2)', icon: 'ri-question-line' };
    const cedo = mine ? t.giveInfo : t.getInfo;
    const ricevo = mine ? t.getInfo : t.giveInfo;
    const date = t.createdAt ? new Date(t.createdAt).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    const list = (arr) => (arr || []).map(p => `<div class="mk-line"><span class="rbadge" style="width:20px;height:20px;font-size:.62rem;border-radius:5px;background:${ROLE_COLOR[p.role] || '#555'}">${esc(p.role)}</span>${esc(p.name)}</div>`).join('');

    let loanInfo = '';
    if (t.tipo === 'prestito') {
      if (t.status === 'active') {
        const left = MercatoService.giornateRimaste(t, this._gw());
        loanInfo = `<div style="font-size:.75rem;color:var(--text2);margin-top:.6rem"><i class="ri-calendar-line"></i> Dalla G${t.startGw} alla G${t.endGw} · rientro alla G${t.endGw} (${left === 0 ? 'in scadenza' : `restano ${left} giornate`})</div>`;
      } else if (t.status === 'returned') {
        loanInfo = `<div style="font-size:.75rem;color:var(--text2);margin-top:.6rem"><i class="ri-calendar-line"></i> G${t.startGw} → G${t.endGw} · giocatori rientrati (G${t.returnedAtGw})</div>`;
      } else {
        loanInfo = `<div style="font-size:.75rem;color:var(--text2);margin-top:.6rem"><i class="ri-calendar-line"></i> Durata proposta: ${t.durata} giornate</div>`;
      }
    }

    let actions = '';
    let warn = '';
    if (t.status === 'pending') {
      if (mine) {
        actions = `<button class="btn btn-red" data-act="withdraw" data-tid="${esc(t.id)}" style="margin-top:.8rem"><i class="ri-arrow-go-back-line"></i> Ritira offerta</button>`;
      } else {
        const v = MercatoService.valida(t, this.STATE.players);
        if (!v.ok) warn = `<div style="font-size:.75rem;color:var(--accent3);margin-top:.6rem"><i class="ri-error-warning-line"></i> Non più valida: ${esc(v.error)}</div>`;
        actions = `
          <div style="display:flex;gap:.5rem;margin-top:.8rem">
            <button class="btn btn-outline" data-act="reject" data-tid="${esc(t.id)}"><i class="ri-close-line"></i> Rifiuta</button>
            <button class="btn btn-green" data-act="accept" data-tid="${esc(t.id)}" ${v.ok ? '' : 'disabled style="opacity:.5;cursor:not-allowed"'}><i class="ri-check-line"></i> Accetta</button>
          </div>`;
      }
    }
    const reason = t.reason ? `<div style="font-size:.72rem;color:var(--text2);margin-top:.5rem">${esc(t.reason)}</div>` : '';

    return `
      <div class="card card-sm mk-trade">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;margin-bottom:.6rem">
          <div style="font-size:.85rem;font-weight:600">
            <i class="${t.tipo === 'prestito' ? 'ri-loop-right-line' : 'ri-exchange-line'}" style="color:var(--accent)"></i>
            ${t.tipo === 'prestito' ? 'Prestito' : 'Scambio'} ${mine ? 'con' : 'da'} ${esc(this._teamName(other))}
          </div>
          <span class="mk-badge" style="color:${st.color}"><i class="${st.icon}"></i> ${st.label}</span>
        </div>
        <div class="mk-sumcols">
          <div class="mk-sumcol"><div class="label" style="font-size:.7rem">Cedi</div>${list(cedo)}</div>
          <div class="mk-sumcol"><div class="label" style="font-size:.7rem">Ricevi</div>${list(ricevo)}</div>
        </div>
        ${loanInfo}${warn}${reason}
        <div style="font-size:.68rem;color:var(--text3);margin-top:.5rem">${mine ? 'Inviata da te' : 'Ricevuta'} · ${date}</div>
        ${actions}
      </div>`;
  },

  _renderTrattative() {
    const box = document.getElementById('mk-trattative');
    if (!box) return;
    const me = this._me();
    const all = this._myTrades();

    const received = all.filter(t => t.status === 'pending' && sid(t.toTeamId) === me);
    const sent = all.filter(t => t.status === 'pending' && sid(t.fromTeamId) === me);
    const loans = all.filter(t => t.status === 'active');
    const history = all.filter(t => !['pending', 'active'].includes(t.status));

    const section = (icon, title, list, empty) => `
      <div class="label mk-sec"><i class="${icon}"></i> ${title} <span style="color:var(--title)">(${list.length})</span></div>
      ${list.length ? list.map(t => this._tradeCard(t)).join('') : `<div style="text-align:center;color:var(--text3);font-size:.8rem;padding:.8rem">${empty}</div>`}`;

    box.innerHTML =
      section('ri-inbox-line', 'Offerte ricevute', received, 'Nessuna offerta da gestire.') +
      section('ri-send-plane-line', 'Offerte inviate in corso', sent, 'Nessuna offerta in attesa di risposta.') +
      section('ri-loop-right-line', 'Prestiti attivi', loans, 'Nessun prestito attivo.') +
      section('ri-history-line', 'Storico', history, 'Ancora nessuna trattativa conclusa.');
  },

  _tradeById(id) { return Object.values(this.STATE.trades || {}).find(t => t && t.id === id); },

  async _withdraw(id) {
    const t = this._tradeById(id);
    if (!t || t.status !== 'pending' || sid(t.fromTeamId) !== this._me()) return;
    if (!confirm("Vuoi ritirare l'offerta?")) return;
    try {
      await update(ref(db, `trades/${id}`), { status: 'withdrawn', respondedAt: Date.now() });
      window.showToast('Offerta ritirata', 'ok');
    } catch (err) { console.error(err); window.showToast('Errore nel ritiro', 'err'); }
  },

  async _reject(id) {
    const t = this._tradeById(id);
    if (!t || t.status !== 'pending' || sid(t.toTeamId) !== this._me()) return;
    try {
      await update(ref(db, `trades/${id}`), { status: 'rejected', respondedAt: Date.now() });
      window.showToast('Offerta rifiutata', 'ok');
    } catch (err) { console.error(err); window.showToast('Errore nel rifiuto', 'err'); }
  },

  async _accept(id) {
    const t = this._tradeById(id);
    if (!t || t.status !== 'pending' || sid(t.toTeamId) !== this._me()) return;

    const res = MercatoService.buildAccept(t, this.STATE.players, Object.values(this.STATE.trades || {}), this._gw());
    if (!res.ok) return window.showToast(res.error, 'err');

    const msg = t.tipo === 'prestito'
      ? `Accetti il prestito di ${t.durata} giornate? I giocatori rientreranno alla G${this._gw() + Number(t.durata)}.`
      : 'Accetti lo scambio? I giocatori cambieranno squadra definitivamente.';
    if (!confirm(msg)) return;

    try {
      await update(ref(db), res.updates);
      window.showToast(t.tipo === 'prestito' ? 'Prestito accettato!' : 'Scambio concluso!', 'ok');
    } catch (err) { console.error(err); window.showToast("Errore nell'accettazione", 'err'); }
  }
};
