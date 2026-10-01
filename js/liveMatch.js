import { ref, onValue, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { CalcoloMatchService } from "./services/calcoloMatch.js";
import { GwService } from "./services/gwService.js";

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

const LIVE_STYLES = `
.lf-field{position:relative;width:100%;height:440px;background:repeating-linear-gradient(to bottom,rgba(34,139,34,.85),rgba(34,139,34,.85) 40px,rgba(28,115,28,.85) 40px,rgba(28,115,28,.85) 80px),radial-gradient(circle at center,rgba(0,0,0,0) 40%,rgba(0,0,0,.35) 100%);background-color:#228b22;border:3px solid rgba(255,255,255,.3);border-radius:20px;overflow:hidden;box-shadow:inset 0 0 40px rgba(0,0,0,.5),0 8px 24px rgba(0,0,0,.3)}
.lf-lines{position:absolute;inset:0;pointer-events:none}
.lf-lines::before{content:'';position:absolute;top:50%;left:0;width:100%;height:3px;background:rgba(255,255,255,.6)}
.lf-lines::after{content:'';position:absolute;top:0;left:50%;width:160px;height:60px;border:3px solid rgba(255,255,255,.6);border-top:none;transform:translateX(-50%)}
.lf-circle{position:absolute;top:50%;left:50%;width:90px;height:90px;border:3px solid rgba(255,255,255,.6);border-radius:50%;transform:translate(-50%,-50%)}
.lf-box{position:absolute;bottom:0;left:50%;width:160px;height:60px;border:3px solid rgba(255,255,255,.6);border-bottom:none;transform:translateX(-50%)}
.lf-player{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;width:78px;z-index:10}
.lf-shirt{position:relative;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:.9rem;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.5)}
.lf-shirt.has-png{width:50px;height:56px;background-size:contain;background-repeat:no-repeat;background-position:center bottom}
.lf-shirt.is-circle{width:42px;height:42px;border-radius:50%;border:2px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.5),inset 0 2px 4px rgba(255,255,255,.3)}
.lf-score{position:absolute;top:-6px;right:-14px;min-width:24px;padding:1px 5px;border-radius:10px;background:var(--gold,#f5b800);color:#0a0f1e;font-family:'DM Mono',monospace;font-size:.68rem;font-weight:700;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,.5)}
.lf-score.live{background:var(--accent,#00e5a0)}
.lf-name{margin-top:2px;background:rgba(10,15,30,.85);color:#fff;font-size:.66rem;font-weight:600;padding:2px 6px;border-radius:6px;max-width:84px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border:1px solid rgba(255,255,255,.2);text-align:center;box-shadow:0 3px 6px rgba(0,0,0,.4)}
.lf-name.has-score{color:var(--accent);border-color:var(--accent)}
`;

export const LiveMatchModule = {
  db: null,
  myTeamId: null,
  currentCompId: null,
  unsubscribers: [],
  activeListener: null,

  selectedMatchKey: null,
  _ctxKey: null,
  _data: null,

  init(database, teamId, compId) {
    this.db = database;
    this.myTeamId = teamId;
    this.currentCompId = compId;
  },

  _injectStyles() {
    if (document.getElementById('live-field-styles')) return;
    const st = document.createElement('style');
    st.id = 'live-field-styles';
    st.textContent = LIVE_STYLES;
    document.head.appendChild(st);
  },

  _getCompData() {
    const comps = window.STATE?.competitions || [];
    return comps.find(c => String(c.id) === String(this.currentCompId)) || null;
  },

  startLiveTracking(gwReale, associazioniGwRealiMap) {
    const container = document.getElementById('live-match-container');
    if (!container) return;
    this._injectStyles();

    const compData = this._getCompData();
    const compForStatus = compData
      ? { ...compData, associazioniGwReali: associazioniGwRealiMap || compData.associazioniGwReali }
      : { associazioniGwReali: associazioniGwRealiMap };
    const status = GwService.getTeamStatus(compForStatus, gwReale, this.myTeamId);
    const gwKey = status.gwKey;

    if (!gwKey) {
      this.stopLiveTracking();
      container.innerHTML = `
        <div style="text-align:center; padding: 2rem; color:var(--text2);">
          <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">🔴 Live Match non attivo</p>
          <p style="font-size: 0.85rem; opacity: 0.7;">Nessuna giornata di questa competizione è associata alla giornata di Serie A ${esc(gwReale)}.</p>
        </div>`;
      return;
    }

    if (!this.myTeamId) {
      container.innerHTML = `<p style="text-align:center; padding: 2rem; color:var(--text2);">Errore: ID Squadra mancante.</p>`;
      return;
    }

    const numeroGwReale = String(gwReale).replace(/\D/g, '');
    const ctxKey = `${this.currentCompId}|${gwKey}|${numeroGwReale}|${this.myTeamId}`;

    // Stesso contesto e listener già attivi: non risottoscrivo (evita sfarfallii), riaggiorno solo la grafica
    if (ctxKey === this._ctxKey && this.unsubscribers.length) {
      if (this._data) {
        this._data.status = status;
        this._data.compData = compForStatus;
        this.render();
      }
      return;
    }

    this.stopLiveTracking();
    this._ctxKey = ctxKey;
    this.selectedMatchKey = null;
    this._data = { status, compData: compForStatus, gwKey, lineups: {}, matchesNode: {}, votes: {}, players: {}, ready: { match: false, votes: false, players: false } };
    container.innerHTML = `<p style="text-align:center; padding: 2rem; color:var(--text2);">Caricamento dati live...</p>`;

    const markReady = (k) => { this._data.ready[k] = true; if (Object.values(this._data.ready).every(Boolean)) this.render(); };

    const unsubMatch = onValue(ref(this.db, `competitions/${this.currentCompId}/matches/${gwKey}`), snap => {
      const node = snap.val() || {};
      this._data.matchesNode = node;
      this._data.lineups = node.lineups || {};
      markReady('match');
    });

    const unsubVotes = onValue(ref(this.db, `votes/gw${numeroGwReale}`), snap => {
      this._data.votes = snap.val() || {};
      markReady('votes');
    });

    this.unsubscribers = [unsubMatch, unsubVotes];
    this.activeListener = () => this.unsubscribers.forEach(u => u());

    get(ref(this.db, 'players'))
      .then(snap => { this._data.players = snap.val() || {}; markReady('players'); })
      .catch(err => {
        console.error("Errore nel recupero giocatori:", err);
        container.innerHTML = `<p style="text-align:center; padding: 2rem; color:var(--text2);">Errore di sincronizzazione dati.</p>`;
      });
  },

  stopLiveTracking() {
    this.unsubscribers.forEach(u => { try { u(); } catch (e) {} });
    this.unsubscribers = [];
    this.activeListener = null;
    this._ctxKey = null;
  },

  _teamInfo(id) {
    const sid = String(id ?? '');
    if (/BYE|RIPOSO/i.test(sid)) return { name: 'Riposo', logo: '' };
    const team = (window.STATE?.teams || []).find(t => String(t.id) === sid);
    if (team) return { name: team.name || sid, logo: team.logo || '' };
    if (sid.startsWith('VINCENTE_')) return { name: `Vincente ${sid.replace('VINCENTE_', '')}`, logo: '' };
    return { name: sid || '—', logo: '' };
  },

  render() {
    const container = document.getElementById('live-match-container');
    const d = this._data;
    if (!container || !d) return;

    // Incontri della giornata (segnaposto del tabellone già risolti), usando i dati live
    const tmpComp = { ...d.compData, matches: { ...(d.compData.matches || {}), [d.gwKey]: d.matchesNode } };
    const couples = GwService.getCouples(tmpComp, d.gwKey);

    if (couples.length === 0) {
      container.innerHTML = `
        <div class="card" style="margin-top:.5rem; text-align:center; padding:2rem; color:var(--text2);">
          <p style="font-size:1.05rem; margin-bottom:.4rem;">🔴 Nessun incontro</p>
          <p style="font-size:.85rem; opacity:.7;">Non ci sono partite in calendario per ${esc(GwService.label(d.gwKey))}.</p>
        </div>`;
      return;
    }

    const mine = d.status.canPlay ? d.status.couple : null;
    let selKey = this.selectedMatchKey;
    if (!selKey || !couples.some(c => c.key === selKey)) {
      selKey = mine && couples.some(c => c.key === mine.key) ? mine.key : couples[0].key;
    }
    const sel = couples.find(c => c.key === selKey);
    const isMyKey = (c) => mine && c.key === mine.key;

    const options = couples.map(c => {
      const h = this._teamInfo(c.homeId).name;
      const a = this._teamInfo(c.awayId).name;
      const label = c.label ? `${c.label}: ` : '';
      return `<option value="${esc(c.key)}" ${c.key === selKey ? 'selected' : ''}>${isMyKey(c) ? '★ ' : ''}${esc(label)}${esc(h)} vs ${esc(a)}</option>`;
    }).join('');

    const notice = d.status.canPlay ? '' : `
      <div style="display:flex; gap:.6rem; align-items:flex-start; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); border-radius:10px; padding:.7rem .9rem; margin-bottom:1rem;">
        <i class="ri-information-line" style="font-size:1.2rem; color:var(--accent2);"></i>
        <div style="font-size:.8rem; color:var(--text2);">
          <strong style="color:var(--text);">Non giochi in questa giornata.</strong> ${esc(d.status.reason)}<br>
          Puoi seguire gli altri incontri scegliendoli dal menu.
        </div>
      </div>`;

    const playersById = new Map(Object.values(d.players).map(p => [String(p.id), p]));
    const homeTeam = this._buildTeam(sel.homeId, d.lineups, playersById, d.votes);
    const awayTeam = this._buildTeam(sel.awayId, d.lineups, playersById, d.votes);

    container.innerHTML = `
      <div class="card" style="margin-top:.5rem;">
        <div class="sec" style="justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <div style="display:flex; align-items:center; gap:.5rem; font-weight:bold;">
            <span style="color:var(--accent3); animation:pulse 1.5s infinite;">🔴</span> LIVE MATCH
          </div>
          <span style="font-size:.85rem; background:var(--bg3); padding:.2rem .6rem; border-radius:20px; color:var(--text2); font-weight:500;">
            ${esc(GwService.label(d.gwKey))}
          </span>
        </div>

        ${notice}

        <div style="margin-bottom:1.2rem;">
          <div class="label" style="margin-bottom:.4rem;">Scegli la partita</div>
          <select id="live-match-select" class="select-rose">${options}</select>
        </div>

        <div style="display:flex; flex-wrap:wrap; gap:1.5rem;">
          ${this._teamMarkup(homeTeam)}
          ${this._teamMarkup(awayTeam)}
        </div>
      </div>
    `;

    const selectEl = document.getElementById('live-match-select');
    if (selectEl) {
      selectEl.addEventListener('change', (e) => {
        this.selectedMatchKey = e.target.value;
        this.render();
      });
    }
  },

  _mapPlayer(id, playersById, votes) {
    const p = playersById.get(String(id));
    if (!p) return { id, name: 'Sconosciuto', role: '?', club: '?', voto: 0, fv: 0, emoji: '', live: false, photo: '' };
    const vObj = votes[id] || {};
    return {
      id,
      name: p.name,
      role: p.role,
      club: p.club || '',
      voto: vObj.voto !== undefined && vObj.voto !== null ? Number(vObj.voto) : 0,
      fv: vObj.fVoto !== undefined && vObj.fVoto !== null ? Number(vObj.fVoto) : 0,
      emoji: CalcoloMatchService.emojiFromBonus(vObj.bonus),
      live: !!vObj.live,
      photo: p.photoPersonal || p.photoStandard || ''
    };
  },

  _buildTeam(teamId, lineups, playersById, votes) {
    const info = this._teamInfo(teamId);
    const lineup = lineups[teamId];
    if (!lineup || !lineup.titolari) return { info, lineup: null };
    return {
      info,
      lineup,
      titolari: lineup.titolari.map(id => this._mapPlayer(id, playersById, votes)),
      panchina: (lineup.panchina || []).map(id => this._mapPlayer(id, playersById, votes))
    };
  },

  _scoreOf(p) {
    if (p.fv > 0) return p.fv.toFixed(1).replace(/\.0$/, '');
    if (p.voto > 0) return String(p.voto);
    return '';
  },

  _fieldMarkup(titolari) {
    const byRole = { P: [], D: [], C: [], A: [] };
    titolari.forEach(p => { if (byRole[p.role]) byRole[p.role].push(p); });
    const rowY = { A: 20, C: 45, D: 70, P: 90 };
    const shirtBg = { P: '#475569', D: '#2196f3', C: '#e91e63', A: '#ff5722' };

    let html = '';
    ['P', 'D', 'C', 'A'].forEach(role => {
      const list = byRole[role];
      list.forEach((p, i) => {
        const x = list.length === 1 ? 50 : (100 / (list.length + 1)) * (i + 1);
        const score = this._scoreOf(p);
        const shirt = p.photo
          ? `<div class="lf-shirt has-png" style="background-image:url('${esc(p.photo)}')">`
          : `<div class="lf-shirt is-circle" style="background-color:${shirtBg[role]}">${role}`;
        html += `
          <div class="lf-player" style="left:${x}%; top:${rowY[role]}%;">
            ${shirt}${score ? `<span class="lf-score ${p.live ? 'live' : ''}">${score}</span>` : ''}</div>
            <div class="lf-name ${score ? 'has-score' : ''}">${esc(p.name)}${p.emoji ? ' ' + p.emoji : ''}${p.live ? ' <span style="color:var(--accent3);">●</span>' : ''}</div>
          </div>`;
      });
    });
    return html;
  },

  _teamMarkup(team) {
    const logo = team.info.logo
      ? `<img src="${esc(team.info.logo)}" alt="" style="width:22px; height:22px; object-fit:contain; border-radius:3px;">`
      : '';
    const header = `
      <div style="display:flex; align-items:center; justify-content:center; gap:.5rem; margin-bottom:.8rem;">
        ${logo}
        <span style="font-weight:700; font-size:1rem; letter-spacing:.5px; color:var(--text1);">${esc(team.info.name)}</span>
        ${team.lineup?.modulo ? `<span style="font-size:.75rem; color:var(--text2);">(${esc(team.lineup.modulo)})</span>` : ''}
      </div>`;

    if (!team.lineup) {
      return `
        <div style="flex:1; min-width:300px;">
          ${header}
          <div style="text-align:center; padding:2rem; background:var(--bg3); border-radius:12px; color:var(--text2); border:1px dashed rgba(255,255,255,.08);">
            <p style="font-size:.9rem;">Formazione non schierata</p>
          </div>
        </div>`;
    }

    const tot = team.titolari.reduce((acc, p) => acc + (p.fv > 0 ? p.fv : (p.voto > 0 ? p.voto : 0)), 0);

    const panchina = team.panchina.length
      ? team.panchina.map(p => {
          const badge = { P: 'rgba(74,85,104,.4)', D: 'rgba(0,119,255,.4)', C: 'rgba(0,229,160,.4)', A: 'rgba(255,71,87,.4)' }[p.role] || 'rgba(255,255,255,.1)';
          const sc = this._scoreOf(p) || '-';
          return `
            <div class="pcard" style="margin-bottom:.3rem; padding:.3rem .5rem; background:rgba(255,255,255,.02); border-radius:8px;">
              <div class="rbadge" style="background:${badge}; width:20px; height:20px; font-size:.65rem; border-radius:4px;">${esc(p.role)}</div>
              <div class="pi"><div class="pn" style="font-size:.8rem; opacity:.8;">${esc(p.name)}${p.emoji ? ' ' + p.emoji : ''}</div></div>
              <div class="pr"><span style="font-size:.8rem; font-family:'DM Mono',monospace; color:var(--text2);">${sc}</span></div>
            </div>`;
        }).join('')
      : `<p style="text-align:center; font-size:.75rem; color:var(--text2); opacity:.6; padding:.5rem 0;">Nessun panchinaro</p>`;

    return `
      <div style="flex:1; min-width:300px;">
        ${header}
        <div class="lf-field">
          <div class="lf-lines"><div class="lf-box"></div><div class="lf-circle"></div></div>
          ${this._fieldMarkup(team.titolari)}
        </div>

        <div class="label" style="margin:1rem 0 .5rem; font-size:.75rem; opacity:.7;">Panchina</div>
        <div style="opacity:.9;">${panchina}</div>

        <div style="border-top:1px solid rgba(255,255,255,.05); margin-top:.8rem; padding-top:.8rem; display:flex; justify-content:space-between; align-items:center;">
          <span class="label" style="margin:0; font-size:.75rem;">Punteggio Parziale</span>
          <span style="font-size:1.4rem; font-weight:700; color:var(--accent); font-family:'DM Mono',monospace;">${tot.toFixed(1)}</span>
        </div>
      </div>
    `;
  }
};
