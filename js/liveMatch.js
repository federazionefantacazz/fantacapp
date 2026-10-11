/**
 * Live Match
 * ------------------------------------------------------------------
 * Due visualizzazioni:
 *  - "colonne": le due formazioni affiancate riga per riga (titolari e panchina),
 *    con voto / fantavoto, eventi (gol, assist, cartellini...) e stato di chi deve ancora giocare
 *  - "stadio":  i due campi con i giocatori schierati (WIP)
 *
 * Stato di ogni giocatore (kind):
 *  voto     ha un voto (live = la sua partita è ancora in corso)
 *  sv       senza voto: ha giocato troppo poco, oppure la sua partita è finita e non è entrato
 *  todo     la sua partita di Serie A non è ancora iniziata (si mostra la probabilità di giocare)
 *  playing  la sua partita è in corso ma non ha (ancora) un voto: non è entrato
 *  wait     la sua partita è finita ma i voti della squadra non sono ancora arrivati
 *
 * Simula partita (solo live): dà 6 a chi deve ancora giocare e/o permette di modificare
 * a mano voto e bonus; il risultato simulato applica le sostituzioni dalla panchina.
 *
 * Usato anche da calendario/home (openViewer) per il replay delle giornate passate
 * e per vedere le formazioni schierate della prossima.
 */
import { ref, onValue, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { CalcoloMatchService, RULE_MATCH } from "./services/calcoloMatch.js";
import { GwService } from "./services/gwService.js";
import { ProbabiliService } from "./services/probabiliService.js";

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const fmt = (n) => {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return '-';
  const r = Math.round(Number(n) * 100) / 100;
  return String(r);
};

const VIEW_KEY = 'fantacapp-live-view';
const MATCH_MINUTES = 115; // durata indicativa di una partita (con intervallo e recupero)

// Eventi riconosciuti: chiave regolamento -> chiavi alternative usate dagli import (fantacalcio.it)
const EVENTI = {
  gol: ['gol', 'gf'],
  rigore_segnato: ['rigore_segnato', 'rf'],
  assist: ['assist', 'ass'],
  ammonizione: ['ammonizione', 'amm'],
  espulsione: ['espulsione', 'esp'],
  autogol: ['autogol', 'au'],
  rigore_parato: ['rigore_parato', 'rp'],
  rigore_sbagliato: ['rigore_sbagliato', 'rs'],
  gol_subito: ['gol_subito', 'gs'],
  porta_inviolata: ['porta_inviolata']
};

const EV_LABEL = {
  gol: 'Gol', rigore_segnato: 'Rigore segnato', assist: 'Assist', ammonizione: 'Ammonizione',
  espulsione: 'Espulsione', autogol: 'Autogol', rigore_parato: 'Rigore parato',
  rigore_sbagliato: 'Rigore sbagliato', gol_subito: 'Gol subito', porta_inviolata: 'Porta inviolata'
};

const LIVE_STYLES = `
.lv-wrap{--lv-ok:#5ec82b;--lv-warn:#f5a623;--lv-bad:#ff4757;--lv-sim:#a78bfa}
.lv-toolbar{display:flex;gap:.5rem;align-items:center;margin-bottom:.8rem;flex-wrap:wrap}
.lv-toolbar .select-rose{flex:1;min-width:180px}
.lv-seg{display:inline-flex;background:var(--bg3);border-radius:10px;padding:3px;gap:2px;flex-shrink:0}
.lv-seg button{border:none;background:transparent;color:var(--text2);font:600 .75rem 'DM Sans',sans-serif;padding:.45rem .7rem;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:.3rem}
.lv-seg button.on{background:var(--accent);color:#0a0f1e}
.lv-wip{font-size:.55rem;font-weight:700;background:var(--lv-warn);color:#0a0f1e;padding:1px 4px;border-radius:4px}

.lv-head{position:relative;overflow:hidden;border-radius:16px;padding:1rem .6rem .9rem;background:linear-gradient(135deg,color-mix(in srgb,var(--accent2) 55%,#0a0f1e),color-mix(in srgb,var(--accent2) 25%,#0a0f1e) 60%,#0a0f1e);color:#fff;display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:.4rem;box-shadow:0 6px 20px rgba(0,0,0,.3)}
.lv-head::after{content:'';position:absolute;left:0;right:0;bottom:0;height:4px;background:var(--accent)}
.lv-team{display:flex;flex-direction:column;align-items:center;text-align:center;min-width:0;gap:2px}
.lv-logo{width:54px;height:54px;object-fit:contain;filter:drop-shadow(0 3px 6px rgba(0,0,0,.4))}
.lv-logo-ph{width:54px;height:54px;border-radius:50%;background:rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;font:1.4rem 'Bebas Neue',sans-serif}
.lv-tname{font-weight:700;font-size:.88rem;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:.25rem}
.lv-towner{font-size:.68rem;opacity:.75;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lv-tmod{font-size:.68rem;opacity:.6;font-family:'DM Mono',monospace}
.lv-score{text-align:center;padding:0 .2rem}
.lv-pts{font:2rem/1 'Bebas Neue',sans-serif;letter-spacing:1px;white-space:nowrap}
.lv-pts-sub{font-size:.58rem;text-transform:uppercase;letter-spacing:.6px;opacity:.75;margin-top:3px}
.lv-pts-goals{font-size:.7rem;opacity:.85;margin-top:4px;font-family:'DM Mono',monospace}
.lv-livechip{display:inline-flex;align-items:center;gap:4px;font-size:.6rem;font-weight:700;background:var(--accent3);color:#fff;padding:1px 7px;border-radius:10px;margin-bottom:4px}
.lv-livechip i{width:6px;height:6px;border-radius:50%;background:#fff;animation:lvPulse 1.2s infinite}
@keyframes lvPulse{0%,100%{opacity:1}50%{opacity:.3}}

.lv-sim{margin:.7rem 0 .9rem;background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:.6rem .7rem}
.lv-sim.on{border-color:var(--lv-sim);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--lv-sim) 40%,transparent)}
.lv-sim-top{display:flex;align-items:center;justify-content:space-between;gap:.5rem}
.lv-sim-title{font-weight:700;font-size:.85rem;display:flex;align-items:center;gap:.4rem;color:var(--text)}
.lv-sim-title i{color:var(--lv-sim);font-size:1.1rem}
.lv-btn{border:1px solid var(--border);background:var(--bg3);color:var(--text);font:600 .75rem 'DM Sans',sans-serif;padding:.4rem .7rem;border-radius:9px;cursor:pointer;display:inline-flex;align-items:center;gap:.3rem}
.lv-btn.prim{background:var(--lv-sim);border-color:var(--lv-sim);color:#0a0f1e}
.lv-sim-body{margin-top:.6rem;display:flex;flex-direction:column;gap:.5rem}
.lv-sim-row{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;font-size:.78rem;color:var(--text2)}
.lv-sim-row label{display:flex;align-items:center;gap:.4rem;cursor:pointer;color:var(--text)}
.lv-sim-row input{width:17px;height:17px;accent-color:var(--lv-sim)}
.lv-sim-res{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;background:var(--bg3);border-radius:10px;padding:.5rem .6rem;text-align:center}
.lv-sim-res .g{font:1.9rem/1 'Bebas Neue',sans-serif;color:var(--lv-sim)}
.lv-sim-res .p{font-size:.72rem;color:var(--text2);font-family:'DM Mono',monospace}
.lv-sim-res .mid{font-size:.6rem;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);padding:0 .4rem}

.lv-sec{text-align:center;font-size:.78rem;font-weight:600;color:var(--accent2);margin:.8rem 0 .4rem}
.lv-rows{display:flex;flex-direction:column;gap:4px}
.lv-row{display:grid;grid-template-columns:1fr 1fr;gap:4px}
.lv-half{display:flex;align-items:center;gap:.4rem;background:var(--card2);border-radius:10px;padding:.3rem .35rem;min-width:0;min-height:50px}
.lv-half.away{flex-direction:row-reverse;text-align:right}
.lv-half.empty{background:transparent}
.lv-half.out{opacity:.55}
.lv-half.in{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--lv-ok) 60%,transparent)}
.lv-ph{position:relative;width:36px;height:40px;flex-shrink:0;display:flex;align-items:flex-end;justify-content:center;border-radius:50%;background:color-mix(in srgb,var(--text) 8%,transparent)}
.lv-ph img{width:36px;height:40px;object-fit:contain;object-position:bottom}
.lv-ph .lv-ph-r{font-weight:700;font-size:.8rem;color:var(--text3);align-self:center}
.lv-role{position:absolute;top:-3px;left:-3px;width:15px;height:15px;border-radius:50%;font-size:.55rem;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px var(--card2)}
.lv-half.away .lv-role{left:auto;right:-3px}
.lv-info{flex:1;min-width:0}
.lv-name{font-weight:600;font-size:.82rem;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lv-evs{display:flex;gap:3px;align-items:center;margin-top:3px;min-height:12px;flex-wrap:wrap}
.lv-half.away .lv-evs{justify-content:flex-end}
.lv-ev{font-size:.62rem;line-height:1;display:inline-flex;align-items:center}
.lv-card{width:8px;height:11px;border-radius:2px;display:inline-block}
.lv-card.y{background:#f5d90a}.lv-card.r{background:#e53935}
.lv-chip{font-size:.52rem;font-weight:700;padding:1px 3px;border-radius:3px;background:var(--bg3);color:var(--text2)}
.lv-chip.bad{color:var(--lv-bad)}.lv-chip.ok{color:var(--lv-ok)}
.lv-arr-in{color:var(--lv-ok);font-size:.85rem}.lv-arr-out{color:var(--lv-bad);font-size:.85rem}

.lv-box{width:36px;height:40px;flex-shrink:0;border-radius:7px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'DM Mono',monospace;font-size:.72rem;font-weight:600;border:1px solid var(--border);background:var(--bg3);color:var(--text2);position:relative;overflow:hidden}
.lv-box.vote{padding:0}
.lv-box.vote span{flex:1;width:100%;display:flex;align-items:center;justify-content:center}
.lv-box.vote .v{color:var(--text2)}
.lv-box.vote .f{color:var(--accent2);background:color-mix(in srgb,var(--accent2) 14%,transparent);font-weight:700}
.lv-box.live{border-color:var(--lv-ok);background:color-mix(in srgb,var(--lv-ok) 16%,var(--bg3))}
.lv-box.live .f{color:var(--lv-ok);background:color-mix(in srgb,var(--lv-ok) 22%,transparent)}
.lv-box.live::after{content:'';position:absolute;top:2px;right:2px;width:5px;height:5px;border-radius:50%;background:var(--lv-ok);animation:lvPulse 1.2s infinite}
.lv-box.sv{border-style:solid;color:var(--text3);font-size:.62rem;letter-spacing:.3px}
.lv-box.todo-tit{border-color:var(--lv-ok);color:var(--lv-ok);background:transparent;font-size:.62rem}
.lv-box.todo-pan{background:transparent;font-size:.56rem;color:var(--text2)}
.lv-box.todo-pan i{font-size:.7rem;line-height:.6}
.lv-box.todo-low{border-color:var(--lv-bad);color:var(--lv-bad);background:transparent;font-size:.62rem}
.lv-box.todo-inf{border-color:var(--lv-bad);color:var(--lv-bad);background:transparent;font-size:1rem}
.lv-box.todo-out{background:transparent;color:var(--text3);font-size:1rem}
.lv-box.todo-time{background:transparent;color:var(--text2);font-size:.5rem;text-align:center;line-height:1.15}
.lv-box.todo-time i{font-size:.8rem}
.lv-box.playing{border-color:var(--lv-warn);color:var(--lv-warn);background:transparent;font-size:.9rem}
.lv-box.wait{background:transparent;color:var(--text3);font-size:.9rem}
.lv-box.sim{border:1px dashed var(--lv-sim);background:color-mix(in srgb,var(--lv-sim) 12%,transparent)}
.lv-box.sim .v,.lv-box.sim .f{color:var(--lv-sim);background:transparent;font-style:italic}
.lv-box.sim.sv{color:var(--lv-sim)}
.lv-box.editable{cursor:pointer}
.lv-box.editable:active{transform:scale(.95)}

.lv-foot{margin-top:1rem;background:var(--bg2);border-radius:16px;padding:.9rem .8rem;border:1px solid var(--border)}
.lv-foot-title{display:block;width:fit-content;margin:-1.6rem auto .8rem;background:var(--accent2);color:#fff;font-weight:700;font-size:.8rem;padding:.35rem 1rem;border-radius:20px}
.lv-tot{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;text-align:center;gap:.4rem;margin:.3rem 0}
.lv-tot .n{font:700 1.3rem 'DM Mono',monospace;color:var(--text2)}
.lv-tot .n.b{color:var(--accent2)}
.lv-tot .l{font-size:.7rem;color:var(--text2)}
.lv-sent{display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin-top:.8rem;font-size:.66rem;color:var(--text3)}
.lv-sent div:last-child{text-align:right}
.lv-legend{display:flex;flex-wrap:wrap;gap:.35rem .8rem;margin-top:.9rem;font-size:.66rem;color:var(--text2);justify-content:center}
.lv-legend span{display:inline-flex;align-items:center;gap:.3rem}
.lv-legend .lv-box{width:22px;height:22px;font-size:.5rem;border-radius:5px}
.lv-legend .lv-box i{font-size:.7rem}

.lv-nolineup{grid-column:1/-1;text-align:center;font-size:.75rem;color:var(--text3);padding:.4rem}

.lv-stadium{display:flex;flex-wrap:wrap;gap:1rem}
.lv-stadium>div{flex:1;min-width:280px}
.lv-stadium-t{text-align:center;font-weight:700;font-size:.85rem;margin-bottom:.4rem;color:var(--text)}
.lv-wip-banner{display:flex;gap:.5rem;align-items:center;background:color-mix(in srgb,var(--lv-warn) 12%,transparent);border:1px solid color-mix(in srgb,var(--lv-warn) 45%,transparent);color:var(--text);border-radius:10px;padding:.5rem .7rem;font-size:.75rem;margin-bottom:.8rem}
.lv-wip-banner i{color:var(--lv-warn);font-size:1.1rem}
.lf-field{position:relative;width:100%;height:420px;background:repeating-linear-gradient(to bottom,rgba(34,139,34,.85),rgba(34,139,34,.85) 40px,rgba(28,115,28,.85) 40px,rgba(28,115,28,.85) 80px);background-color:#228b22;border:3px solid rgba(255,255,255,.3);border-radius:20px;overflow:hidden;box-shadow:inset 0 0 40px rgba(0,0,0,.5)}
.lf-lines{position:absolute;inset:0;pointer-events:none}
.lf-lines::before{content:'';position:absolute;top:50%;left:0;width:100%;height:3px;background:rgba(255,255,255,.6)}
.lf-lines::after{content:'';position:absolute;top:0;left:50%;width:160px;height:60px;border:3px solid rgba(255,255,255,.6);border-top:none;transform:translateX(-50%)}
.lf-circle{position:absolute;top:50%;left:50%;width:90px;height:90px;border:3px solid rgba(255,255,255,.6);border-radius:50%;transform:translate(-50%,-50%)}
.lf-box{position:absolute;bottom:0;left:50%;width:160px;height:60px;border:3px solid rgba(255,255,255,.6);border-bottom:none;transform:translateX(-50%)}
.lf-player{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;width:78px;z-index:10}
.lf-shirt{position:relative;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:.9rem;color:#fff}
.lf-shirt.has-png{width:48px;height:54px;background-size:contain;background-repeat:no-repeat;background-position:center bottom}
.lf-shirt.is-circle{width:40px;height:40px;border-radius:50%;border:2px solid #fff}
.lf-score{position:absolute;top:-6px;right:-16px;min-width:24px;padding:1px 5px;border-radius:10px;background:#fff;color:#0a0f1e;font-family:'DM Mono',monospace;font-size:.66rem;font-weight:700;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,.5)}
.lf-score.live{background:#5ec82b}
.lf-score.sv{background:#94a3b8}
.lf-name{margin-top:2px;background:rgba(10,15,30,.85);color:#fff;font-size:.64rem;font-weight:600;padding:2px 6px;border-radius:6px;max-width:84px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center}

#lv-editor{position:fixed;inset:0;z-index:6000;background:rgba(5,8,15,.65);backdrop-filter:blur(3px);display:flex;align-items:flex-end;justify-content:center}
@media (min-width:700px){#lv-editor{align-items:center}}
.lv-ed{width:100%;max-width:440px;background:var(--bg);border:1px solid var(--border);border-radius:18px 18px 0 0;padding:1rem;padding-bottom:calc(1rem + env(safe-area-inset-bottom,0px));box-shadow:0 -10px 40px rgba(0,0,0,.5)}
@media (min-width:700px){.lv-ed{border-radius:18px}}
.lv-ed-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:.8rem}
.lv-ed-h b{font-size:.95rem;color:var(--text)}
.lv-ed-h small{display:block;font-size:.7rem;color:var(--text2);font-weight:400}
.lv-ed-x{background:var(--bg2);border:none;color:var(--text);width:32px;height:32px;border-radius:50%;font-size:1.1rem;cursor:pointer}
.lv-ed-v{display:flex;align-items:center;justify-content:center;gap:.8rem;margin-bottom:.8rem}
.lv-ed-v button{width:42px;height:42px;border-radius:50%;border:1px solid var(--border);background:var(--bg2);color:var(--text);font-size:1.2rem;cursor:pointer}
.lv-ed-v .val{font:2.2rem/1 'Bebas Neue',sans-serif;min-width:70px;text-align:center;color:var(--text)}
.lv-ed-g{display:grid;grid-template-columns:1fr 1fr;gap:.35rem;margin-bottom:.8rem}
.lv-ed-e{display:flex;align-items:center;justify-content:space-between;background:var(--bg2);border-radius:9px;padding:.25rem .3rem .25rem .55rem;font-size:.72rem;color:var(--text)}
.lv-ed-e small{color:var(--text3)}
.lv-ed-e div{display:flex;align-items:center;gap:.25rem}
.lv-ed-e button{width:24px;height:24px;border-radius:6px;border:none;background:var(--bg3);color:var(--text);cursor:pointer;font-weight:700}
.lv-ed-e b{min-width:12px;text-align:center;font-family:'DM Mono',monospace}
.lv-ed-fv{text-align:center;font-size:.8rem;color:var(--text2);margin-bottom:.8rem}
.lv-ed-fv b{color:var(--lv-sim,#a78bfa);font-family:'DM Mono',monospace;font-size:1rem}
.lv-ed-a{display:flex;gap:.4rem}
.lv-ed-a .lv-btn{flex:1;justify-content:center;padding:.6rem}
`;

export const LiveMatchModule = {
  db: null,
  myTeamId: null,
  currentCompId: null,
  unsubscribers: [],
  activeListener: null,

  selectedMatchKey: null,
  _pendingKey: null,   // partita da aprire quando si arriva dal calendario
  _ctxKey: null,
  _data: null,
  _viewer: null,       // argomenti dell'overlay replay/formazioni
  _sim: { key: null, on: false, six: true, overrides: {} },

  init(database, teamId, compId) {
    this.db = database;
    this.myTeamId = teamId;
    this.currentCompId = compId;
  },

  // ------------------------------------------------------------------
  // Preferenze e stili
  // ------------------------------------------------------------------
  get view() {
    try { return localStorage.getItem(VIEW_KEY) === 'stadio' ? 'stadio' : 'colonne'; } catch (e) { return this._view || 'colonne'; }
  },
  set view(v) {
    this._view = v;
    try { localStorage.setItem(VIEW_KEY, v); } catch (e) {}
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

  // ------------------------------------------------------------------
  // Tracking live
  // ------------------------------------------------------------------
  startLiveTracking(gwReale, associazioniGwRealiMap) {
    const container = document.getElementById('live-match-container');
    if (!container) return;
    this._injectStyles();
    this._bindEvents(container, () => this.render());

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
      if (this._pendingKey) { this.selectedMatchKey = this._pendingKey; this._pendingKey = null; }
      if (this._data) {
        this._data.status = status;
        this._data.compData = compForStatus;
        this.render();
      }
      return;
    }

    this.stopLiveTracking();
    this._ctxKey = ctxKey;
    this.selectedMatchKey = this._pendingKey || null;
    this._pendingKey = null;
    this._data = {
      status, compData: compForStatus, gwKey, gwReale: Number(numeroGwReale) || null,
      lineups: {}, matchesNode: {}, votes: {}, players: {}, liveMatches: {},
      ready: { match: false, votes: false, players: false }
    };
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

    // Orari e stato delle partite di Serie A (facoltativo: se manca si usano le probabili)
    const unsubLiveMatches = onValue(ref(this.db, `liveMatches/gw${numeroGwReale}`), snap => {
      this._data.liveMatches = snap.val() || {};
      if (Object.values(this._data.ready).every(Boolean)) this.render();
    }, () => {});

    this.unsubscribers = [unsubMatch, unsubVotes, unsubLiveMatches];
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
    this._closeEditor();
  },

  _teamInfo(id) {
    const sid = String(id ?? '');
    if (/BYE|RIPOSO/i.test(sid)) return { name: 'Riposo', logo: '', owner: '' };
    const team = (window.STATE?.teams || []).find(t => String(t.id) === sid);
    if (team) return { name: team.name || sid, logo: team.logo || '', owner: team.owner || '' };
    if (sid.startsWith('VINCENTE_')) return { name: `Vincente ${sid.replace('VINCENTE_', '')}`, logo: '', owner: '' };
    return { name: sid || '—', logo: '', owner: '' };
  },

  _playersList(players) {
    const list = Array.isArray(players) ? players : Object.values(players || {});
    return list.filter(Boolean);
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
    this.selectedMatchKey = selKey;
    const sel = couples.find(c => c.key === selKey);
    const isMyKey = (c) => mine && c.key === mine.key;

    // La simulazione vale per la singola partita
    const simKey = `${this._ctxKey}|${selKey}`;
    if (this._sim.key !== simKey) this._sim = { key: simKey, on: false, six: true, overrides: {} };

    const options = couples.map(c => {
      const h = this._teamInfo(c.homeId).name;
      const a = this._teamInfo(c.awayId).name;
      const label = c.label ? `${c.label}: ` : '';
      return `<option value="${esc(c.key)}" ${c.key === selKey ? 'selected' : ''}>${isMyKey(c) ? '★ ' : ''}${esc(label)}${esc(h)} vs ${esc(a)}</option>`;
    }).join('');

    const notice = d.status.canPlay ? '' : `
      <div style="display:flex; gap:.6rem; align-items:flex-start; background:var(--bg2); border:1px solid var(--border); border-radius:10px; padding:.7rem .9rem; margin-bottom:.8rem;">
        <i class="ri-information-line" style="font-size:1.2rem; color:var(--accent2);"></i>
        <div style="font-size:.8rem; color:var(--text2);">
          <strong style="color:var(--text);">Non giochi in questa giornata.</strong> ${esc(d.status.reason)}<br>
          Puoi seguire gli altri incontri scegliendoli dal menu.
        </div>
      </div>`;

    const body = this._matchMarkup({
      mode: 'live',
      homeId: sel.homeId,
      awayId: sel.awayId,
      lineups: d.lineups,
      players: this._playersList(d.players),
      votes: d.votes,
      gwReale: d.gwReale,
      liveMatches: d.liveMatches,
      couple: sel
    });

    // Mantengo la posizione di scorrimento ai refresh dei voti
    const scrollY = window.scrollY;
    container.innerHTML = `
      <div class="lv-wrap" style="margin-top:.5rem;">
        <div class="sec" style="justify-content:space-between; align-items:center; margin-bottom:.7rem;">
          <span style="display:flex; align-items:center; gap:.5rem;"><span class="lv-livechip" style="margin:0;"><i></i>LIVE</span> Live Match</span>
          <span style="font-family:'DM Sans',sans-serif; font-size:.78rem; background:var(--bg3); padding:.2rem .6rem; border-radius:20px; color:var(--text2); font-weight:500; letter-spacing:0;">${esc(GwService.label(d.gwKey))}</span>
        </div>
        ${notice}
        <div class="lv-toolbar">
          <select id="live-match-select" class="select-rose">${options}</select>
          ${this._viewSwitchMarkup()}
        </div>
        ${body}
      </div>
    `;
    if (Math.abs(window.scrollY - scrollY) > 2) window.scrollTo(0, scrollY);

    const selectEl = document.getElementById('live-match-select');
    if (selectEl) {
      selectEl.addEventListener('change', (e) => {
        this.selectedMatchKey = e.target.value;
        this.render();
      });
    }
  },

  // ------------------------------------------------------------------
  // Overlay replay / formazioni (calendario, home)
  // ------------------------------------------------------------------
  /** Compatibilità: HTML di una partita (senza simulazione). */
  buildMatchHTML(homeId, awayId, lineups, players, votes, opts = {}) {
    this._injectStyles();
    return `<div class="lv-wrap">${this._matchMarkup({
      mode: opts.applySubs ? 'past' : (opts.mode || 'next'),
      homeId, awayId, lineups, players: this._playersList(players), votes, gwReale: opts.gwReale ?? null
    })}</div>`;
  },

  closeViewer() {
    document.getElementById('match-viewer')?.remove();
    this._viewer = null;
    this._closeEditor();
  },

  /**
   * Apre a tutto schermo una partita non "live":
   *  mode 'past' = replay con voti, sostituzioni e risultato
   *  mode 'next' = formazioni schierate (o "Formazione non inserita") con le probabilità
   */
  openViewer({ comp, gwKey, couple, mode }) {
    this._injectStyles();
    document.getElementById('match-viewer')?.remove();
    this._viewer = { comp, gwKey, couple, mode };

    const home = this._teamInfo(couple.homeId);
    const away = this._teamInfo(couple.awayId);
    const isPast = mode === 'past';

    const overlay = document.createElement('div');
    overlay.id = 'match-viewer';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:5000;background:var(--bg);overflow-y:auto;-webkit-overflow-scrolling:touch;padding-bottom:2rem;';
    overlay.innerHTML = `
      <div style="position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:.8rem;padding:.8rem 1rem;background:var(--bg2);border-bottom:1px solid var(--border);">
        <button id="mv-close" class="btn btn-outline" style="width:auto;padding:.45rem .8rem;"><i class="ri-arrow-left-line"></i> Indietro</button>
        <div style="min-width:0;">
          <div style="font-size:.7rem;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;">${isPast ? 'Replay match' : 'Formazioni schierate'} · ${esc(GwService.label(gwKey))}</div>
          <div style="font-weight:700;font-size:.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(home.name)} vs ${esc(away.name)}</div>
        </div>
      </div>
      <div id="mv-body" class="lv-wrap" style="padding:1rem;max-width:900px;margin:0 auto;"></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#mv-close').addEventListener('click', () => this.closeViewer());
    this._bindEvents(overlay, () => this._renderViewer());
    this._renderViewer();
  },

  _renderViewer() {
    const body = document.getElementById('mv-body');
    const v = this._viewer;
    if (!body || !v) return;
    const STATE = window.STATE || {};
    const isPast = v.mode === 'past';
    const gwReale = GwService.getRealOf(v.comp, v.gwKey);
    const lineups = v.comp.matches?.[v.gwKey]?.lineups || {};
    let votes = {};
    if (isPast && gwReale !== null) {
      const raw = STATE.votes?.[`gw${gwReale}`] || {};
      Object.keys(raw).forEach(id => { votes[id] = raw[id] && typeof raw[id] === 'object' ? { ...raw[id], live: false } : raw[id]; });
    }

    body.innerHTML = `
      ${v.couple.label ? `<div style="font-size:.7rem;color:var(--gold);font-weight:bold;text-transform:uppercase;margin-bottom:.6rem;">${esc(v.couple.label)}</div>` : ''}
      <div class="lv-toolbar" style="justify-content:flex-end;">${this._viewSwitchMarkup()}</div>
      ${this._matchMarkup({
        mode: isPast ? 'past' : 'next',
        homeId: v.couple.homeId,
        awayId: v.couple.awayId,
        lineups,
        players: this._playersList(STATE.players),
        votes,
        gwReale,
        couple: v.couple
      })}`;
  },

  // ------------------------------------------------------------------
  // Eventi (delegati: il contenuto viene ridisegnato a ogni aggiornamento)
  // ------------------------------------------------------------------
  _bindEvents(root, rerender) {
    if (root._lvBound) { root._lvRerender = rerender; return; }
    root._lvBound = true;
    root._lvRerender = rerender;
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-lv]');
      if (!btn || !root.contains(btn)) return;
      const act = btn.dataset.lv;
      if (act === 'view') {
        this.view = btn.dataset.v;
        root._lvRerender();
      } else if (act === 'sim-toggle') {
        this._sim.on = !this._sim.on;
        root._lvRerender();
      } else if (act === 'sim-reset') {
        this._sim.overrides = {};
        root._lvRerender();
      } else if (act === 'edit' && this._sim.on) {
        e.stopPropagation(); // non apro la scheda giocatore
        this._openEditor(btn.dataset.pid, root._lvRerender);
      }
    });
    root.addEventListener('change', (e) => {
      if (e.target.matches('[data-lv="sim-six"]')) {
        this._sim.six = e.target.checked;
        root._lvRerender();
      }
    });
  },

  _viewSwitchMarkup() {
    const v = this.view;
    return `
      <div class="lv-seg" role="tablist" aria-label="Visualizzazione">
        <button data-lv="view" data-v="colonne" class="${v === 'colonne' ? 'on' : ''}" role="tab" aria-selected="${v === 'colonne'}"><i class="ri-layout-column-line"></i> Colonne</button>
        <button data-lv="view" data-v="stadio" class="${v === 'stadio' ? 'on' : ''}" role="tab" aria-selected="${v === 'stadio'}"><i class="ri-football-line"></i> Stadio <span class="lv-wip">WIP</span></button>
      </div>`;
  },

  // ------------------------------------------------------------------
  // Modello dati
  // ------------------------------------------------------------------
  /** Eventi di un voto normalizzati sulle chiavi del regolamento. */
  _events(entry) {
    const out = {};
    if (!entry || typeof entry !== 'object') return out;
    const src = [entry, entry.bonus && typeof entry.bonus === 'object' ? entry.bonus : null].filter(Boolean);
    Object.entries(EVENTI).forEach(([k, alias]) => {
      let n = 0;
      src.forEach(s => alias.forEach(a => { if (s[a] !== undefined && s[a] !== null && s[a] !== true) n = Math.max(n, parseInt(s[a]) || 0); }));
      if (n > 0) out[k] = n;
    });
    return out;
  },

  _fantavoto(voto, ev) {
    return CalcoloMatchService.calcolaFantavoto({ voto, ...ev });
  },

  /**
   * Kickoff (ms) o null. Formati gestiti:
   *  - timestamp numerico (ms o secondi), ISO
   *  - probabili formazioni: "sabato 10 ottobre, 15:00"
   *  - "10/10 15:00", "10/10/2026 15:00"
   */
  _parseDate(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number' || /^\d{9,13}$/.test(String(v))) {
      const n = Number(v);
      return n > 0 ? (n < 1e12 ? n * 1000 : n) : null;
    }
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) { const t = Date.parse(s); return Number.isNaN(t) ? null : t; }
    const mesi = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
    const it = s.toLowerCase().match(/(\d{1,2})\s+([a-z]+)\D*?(\d{1,2})[:.](\d{2})/);
    if (it) {
      const mese = mesi.findIndex(m => m.startsWith(it[2].slice(0, 3)));
      if (mese >= 0) {
        // l'anno non c'è: prendo quello che rende la data più vicina a oggi (cambio d'anno)
        const now = new Date();
        const cands = [-1, 0, 1].map(dy => new Date(now.getFullYear() + dy, mese, Number(it[1]), Number(it[3]), Number(it[4])).getTime());
        return cands.reduce((a, b) => Math.abs(b - now) < Math.abs(a - now) ? b : a);
      }
    }
    const m = s.match(/(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\D+(\d{1,2})[:.](\d{2})/);
    if (m) {
      let y = m[3] ? Number(m[3]) : new Date().getFullYear();
      if (y < 100) y += 2000;
      return new Date(y, Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5])).getTime();
    }
    const t = Date.parse(s);
    return Number.isNaN(t) ? null : t;
  },

  /** Contesto comune a tutti i giocatori della partita. */
  _ctx({ mode, votes, playersById, gwReale, liveMatches = null }) {
    const STATE = window.STATE || {};
    const meta = ProbabiliService.meta(STATE);
    // Le probabili valgono solo per la loro giornata
    const probOk = ProbabiliService.hasData(STATE) &&
      (!meta?.giornata || !gwReale || String(meta.giornata) === String(gwReale) || mode === 'next');

    // Club che hanno già dei voti (la loro partita è iniziata o finita).
    // Nota: l'import live scrive live:true su tutti i voti della giornata, anche delle
    // partite finite, quindi "in corso" si ricava solo dall'orario della partita.
    const clubs = new Map();
    let updatedAt = 0;
    Object.entries(votes || {}).forEach(([pid, e]) => {
      if (e && typeof e === 'object' && Number(e.updatedAt) > updatedAt) updatedAt = Number(e.updatedAt);
      const p = playersById.get(String(pid));
      if (!p) return;
      clubs.set(norm(p.club), { any: true });
    });
    // Partite di Serie A dal feed live (liveMatches/gw{n}, scritto dalla Cloud Function)
    const matches = new Map();
    Object.entries(liveMatches || {}).forEach(([k, m]) => { if (m && typeof m === 'object') matches.set(norm(m.name || k), m); });
    return { mode, votes: votes || {}, probOk, clubs, matches, updatedAt, now: Date.now(), STATE };
  },

  _player(id, playersById, ctx) {
    const p = playersById.get(String(id));
    const base = p
      ? { id: String(id), name: p.name, role: p.role, club: p.club || '', photo: p.photoPersonal || p.photoStandard || '' }
      : { id: String(id), name: 'Sconosciuto', role: '?', club: '', photo: '' };

    const raw = ctx.votes[id] ?? ctx.votes[String(id)];
    const entry = raw !== undefined && raw !== null && typeof raw !== 'object' ? { voto: raw } : raw;
    const ev = this._events(entry);
    base.ev = ev;
    base.subIn = !!(entry && (entry.in || entry.entrato || entry.subentrato || entry.s === 's'));
    base.subOut = !!(entry && (entry.out || entry.uscito || entry.sostituito));

    if (ctx.mode === 'next') {
      return { ...base, ...this._todo(p, ctx) };
    }

    const todo = this._todo(p, ctx);
    const stato = this._matchState(base.club, todo.kickoff, ctx);
    const kick = stato.kickoff;
    const inCorso = stato.state === 'live';

    if (entry) {
      const voto = CalcoloMatchService.normalizzaVoto(entry.voto);
      if (voto > 0) {
        const saved = entry.fantavoto ?? entry.fVoto;
        const fv = saved !== undefined && saved !== null && Number.isFinite(Number(saved)) ? Number(saved) : this._fantavoto(voto, ev);
        return { ...base, kind: 'voto', voto, fv, live: ctx.mode === 'live' && inCorso };
      }
      return { ...base, kind: 'sv', live: ctx.mode === 'live' && inCorso };
    }

    if (ctx.mode === 'past') return { ...base, kind: 'sv' };

    // Live, nessun voto: dipende da come sta andando la partita del suo club
    const club = ctx.clubs.get(norm(base.club));
    if (stato.state) {
      if (stato.state === 'todo') return { ...base, ...todo, kickoff: kick };
      if (inCorso) return { ...base, kind: 'playing', kickoff: kick };
      return { ...base, kind: club?.any || stato.fromFeed ? 'sv' : 'wait', kickoff: kick };
    }
    // Orario sconosciuto: se il suo club ha già i voti e lui no, non è entrato
    if (club?.any) return { ...base, kind: 'sv' };
    return { ...base, ...todo };
  },

  /**
   * Stato della partita di Serie A di un club: { state: 'todo'|'live'|'done'|null, kickoff, fromFeed }.
   * Prima il feed live (status, orario esatto e inizio secondo tempo), poi l'orario delle probabili.
   */
  _matchState(club, probKickoff, ctx) {
    const m = ctx.matches?.get(norm(club));
    const kick = (m && this._parseDate(m.date)) || probKickoff || null;
    if (!kick) return { state: null, kickoff: null, fromFeed: !!m };
    // status del feed: 4 = finita, 3 = secondo tempo (gli altri valori non sono ancora verificati)
    const status = m ? Number(m.status) || 0 : 0;
    if (m && (m.finished === true || status === 4)) return { state: 'done', kickoff: kick, fromFeed: true };
    if (status === 3) return { state: 'live', kickoff: kick, fromFeed: true };
    if (ctx.now < kick) return { state: 'todo', kickoff: kick, fromFeed: !!m };
    const sh = m ? this._parseDate(m.sh) : null; // inizio secondo tempo
    const fine = sh ? sh + 55 * 60000 : kick + MATCH_MINUTES * 60000;
    return { state: ctx.now < fine ? 'live' : 'done', kickoff: kick, fromFeed: !!m };
  },

  /** Giocatore che deve ancora giocare: probabilità e stato dalle probabili formazioni. */
  _todo(p, ctx) {
    const out = { kind: 'todo', pct: null, xi: null, st: null, kickoff: null, opp: null };
    if (!p || !ctx.probOk) return out;
    const info = ProbabiliService.getInfo(p, ctx.STATE);
    out.pct = info.pct; out.xi = info.xi; out.st = info.st; out.opp = info.opp;
    out.kickoff = info.opp ? this._parseDate(info.opp.date) : null;
    out.probKnown = info.known;
    return out;
  },

  _team(teamId, lineups, playersById, ctx) {
    const info = this._teamInfo(teamId);
    let lineup = lineups?.[teamId];
    if (!lineup) {
      const k = Object.keys(lineups || {}).find(x => lineups[x] && String(lineups[x].teamId) === String(teamId));
      if (k) lineup = lineups[k];
    }
    if (!lineup || !Array.isArray(lineup.titolari)) return { id: teamId, info, lineup: null, tit: [], pan: [] };
    return {
      id: teamId,
      info,
      lineup,
      tit: lineup.titolari.map(id => this._player(id, playersById, ctx)),
      pan: (lineup.panchina || []).map(id => this._player(id, playersById, ctx))
    };
  },

  /** Punteggio "effettivo" di un giocatore: reale oppure simulato. null = senza voto. */
  _score(pl, sim) {
    if (sim) {
      const o = this._sim.overrides[pl.id];
      if (o !== undefined) return o; // null = s.v. simulato
      if (pl.kind === 'voto') return { voto: pl.voto, fv: pl.fv };
      if (this._sim.six && (pl.kind === 'todo' || pl.kind === 'playing' || pl.kind === 'wait') && pl.st !== 'squal' && pl.st !== 'inf') {
        return { voto: 6, fv: 6, six: true };
      }
      return null;
    }
    return pl.kind === 'voto' ? { voto: pl.voto, fv: pl.fv } : null;
  },

  /**
   * Totali di una squadra.
   * withSubs: applica le sostituzioni dalla panchina (risultato finale / simulato),
   * altrimenti somma solo i titolari (parziale).
   */
  _totals(team, { sim = false, withSubs = false } = {}) {
    if (!team.lineup) return null;
    const all = new Map([...team.tit, ...team.pan].map(p => [p.id, p]));
    const score = (id) => { const p = all.get(String(id)); return p ? this._score(p, sim) : null; };

    if (!withSubs) {
      let voti = 0, fv = 0, n = 0;
      team.tit.forEach(p => { const s = this._score(p, sim); if (s) { voti += s.voto; fv += s.fv; n++; } });
      return { voti, fv, n, subs: [] };
    }

    const res = CalcoloMatchService.applicaSostituzioni(
      team.tit.map(p => p.id), team.pan.map(p => p.id),
      (id) => all.get(String(id))?.role,
      (id) => { const s = score(id); return s ? s.fv : null; }
    );
    let voti = 0, n = 0;
    res.slots.forEach(sl => { if (sl.score !== null) { voti += score(sl.id)?.voto || 0; n++; } });
    return { voti, fv: res.totale, n, subs: res.sostituzioni };
  },

  // ------------------------------------------------------------------
  // Markup
  // ------------------------------------------------------------------
  _matchMarkup({ mode, homeId, awayId, lineups, players, votes, gwReale, couple, liveMatches }) {
    const playersById = new Map((players || []).filter(p => p && p.id !== undefined).map(p => [String(p.id), p]));
    const ctx = this._ctx({ mode, votes, playersById, gwReale, liveMatches });
    const home = this._team(homeId, lineups, playersById, ctx);
    const away = this._team(awayId, lineups, playersById, ctx);
    const isLive = mode === 'live';
    const sim = isLive && this._sim.on;

    // Parziale (solo titolari) o finale (con sostituzioni)
    const withSubs = mode === 'past';
    const tH = this._totals(home, { withSubs });
    const tA = this._totals(away, { withSubs });

    // Sostituzioni da evidenziare: finale nel replay, simulate nel live
    let subsH = tH?.subs || [], subsA = tA?.subs || [];
    let simH = null, simA = null;
    if (sim) {
      simH = this._totals(home, { sim: true, withSubs: true });
      simA = this._totals(away, { sim: true, withSubs: true });
      subsH = simH?.subs || []; subsA = simA?.subs || [];
    }
    const subsMark = (subs) => ({ out: new Set(subs.map(s => String(s.out))), in: new Set(subs.map(s => String(s.in))) });
    const mH = subsMark(subsH), mA = subsMark(subsA);

    const header = this._headerMarkup({ mode, home, away, tH, tA, couple, updatedAt: ctx.updatedAt });
    const simBox = isLive ? this._simMarkup(home, away, simH, simA) : '';

    const content = this.view === 'stadio'
      ? this._stadiumMarkup(home, away, sim)
      : this._columnsMarkup(home, away, { sim, mH, mA });

    return `
      ${header}
      ${simBox}
      ${content}
      ${this._footerMarkup({ mode, home, away, tH, tA })}
    `;
  },

  _headerMarkup({ mode, home, away, tH, tA, couple, updatedAt }) {
    const team = (t) => `
      <div class="lv-team">
        ${t.info.logo
          ? `<img class="lv-logo" src="${esc(t.info.logo)}" alt="" loading="lazy">`
          : `<div class="lv-logo-ph">${esc((t.info.name || '?').charAt(0))}</div>`}
        <div class="lv-tname">${esc(t.info.name)}</div>
        ${t.info.owner ? `<div class="lv-towner">${esc(t.info.owner)}</div>` : ''}
        <div class="lv-tmod">${t.lineup?.modulo ? esc(t.lineup.modulo) : (t.lineup ? '' : 'senza formazione')}</div>
      </div>`;

    let center = '';
    if (mode === 'live') {
      center = `
        <span class="lv-livechip"><i></i>LIVE</span>
        <div class="lv-pts">${tH ? fmt(tH.fv) : '-'} - ${tA ? fmt(tA.fv) : '-'}</div>
        <div class="lv-pts-sub">Parziale titolari</div>
        ${updatedAt ? `<div class="lv-pts-goals">voti delle ${new Date(updatedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</div>` : ''}`;
    } else if (mode === 'past') {
      const gH = couple?.goalHome ?? couple?.homeScore ?? (tH ? CalcoloMatchService.calcolaGol(tH.fv) : null);
      const gA = couple?.goalAway ?? couple?.awayScore ?? (tA ? CalcoloMatchService.calcolaGol(tA.fv) : null);
      const pH = couple?.punteggioFinaleHome ?? tH?.fv;
      const pA = couple?.punteggioFinaleAway ?? tA?.fv;
      center = `
        <div class="lv-pts">${gH ?? '-'} - ${gA ?? '-'}</div>
        <div class="lv-pts-sub">Risultato finale</div>
        <div class="lv-pts-goals">${fmt(pH)} - ${fmt(pA)} pt</div>`;
    } else {
      center = `<div class="lv-pts">VS</div><div class="lv-pts-sub">Da giocare</div>`;
    }
    return `<div class="lv-head">${team(home)}<div class="lv-score">${center}</div>${team(away)}</div>`;
  },

  _simMarkup(home, away, simH, simA) {
    const s = this._sim;
    const edits = Object.keys(s.overrides).length;
    if (!s.on) {
      return `
        <div class="lv-sim">
          <div class="lv-sim-top">
            <div class="lv-sim-title"><i class="ri-magic-line"></i> Simula partita</div>
            <button class="lv-btn prim" data-lv="sim-toggle"><i class="ri-play-line"></i> Simula</button>
          </div>
        </div>`;
    }
    const g = (t) => t ? CalcoloMatchService.calcolaGol(t.fv) : '-';
    return `
      <div class="lv-sim on">
        <div class="lv-sim-top">
          <div class="lv-sim-title"><i class="ri-magic-line"></i> Simulazione</div>
          <button class="lv-btn" data-lv="sim-toggle"><i class="ri-close-line"></i> Chiudi</button>
        </div>
        <div class="lv-sim-body">
          <div class="lv-sim-res">
            <div><div class="g">${g(simH)}</div><div class="p">${simH ? fmt(simH.fv) : '-'} pt</div></div>
            <div class="mid">Risultato<br>simulato</div>
            <div><div class="g">${g(simA)}</div><div class="p">${simA ? fmt(simA.fv) : '-'} pt</div></div>
          </div>
          <div class="lv-sim-row">
            <label><input type="checkbox" data-lv="sim-six" ${s.six ? 'checked' : ''}> 6 a chi deve ancora giocare</label>
          </div>
          <div class="lv-sim-row">
            <i class="ri-hand-coin-line" style="color:var(--lv-sim);"></i> Tocca il voto di un giocatore per modificarlo (anche chi ha già giocato).
            ${edits ? `<button class="lv-btn" data-lv="sim-reset" style="margin-left:auto;"><i class="ri-arrow-go-back-line"></i> Annulla modifiche (${edits})</button>` : ''}
          </div>
          <div class="lv-sim-row" style="font-size:.7rem; color:var(--text3);">Il risultato simulato applica le sostituzioni dalla panchina (stesso ruolo) per chi resta senza voto.</div>
        </div>
      </div>`;
  },

  _columnsMarkup(home, away, { sim, mH, mA }) {
    const rows = (a, b, ma, mb) => {
      const n = Math.max(a.length, b.length);
      let html = '';
      for (let i = 0; i < n; i++) {
        html += `<div class="lv-row">${this._halfMarkup(a[i], 'home', sim, ma)}${this._halfMarkup(b[i], 'away', sim, mb)}</div>`;
      }
      return html;
    };
    const noLineup = (!home.lineup || !away.lineup)
      ? `<div class="lv-row">${!home.lineup ? '<div class="lv-half empty" style="justify-content:center;color:var(--text3);font-size:.75rem;">Formazione non inserita</div>' : '<div></div>'}${!away.lineup ? '<div class="lv-half empty" style="justify-content:center;color:var(--text3);font-size:.75rem;">Formazione non inserita</div>' : '<div></div>'}</div>`
      : '';
    return `
      <div class="lv-rows" style="margin-top:.8rem;">
        ${noLineup}
        ${rows(home.tit, away.tit, mH, mA)}
      </div>
      ${(home.pan.length || away.pan.length) ? `
        <div class="lv-sec">Panchina</div>
        <div class="lv-rows">${rows(home.pan, away.pan, mH, mA)}</div>` : ''}
    `;
  },

  _halfMarkup(pl, side, sim, marks) {
    if (!pl) return `<div class="lv-half ${side} empty"></div>`;
    const out = marks?.out.has(pl.id);
    const inn = marks?.in.has(pl.id);
    const simOv = sim ? this._sim.overrides[pl.id] : undefined; // eventi simulati a mano
    const photo = pl.photo
      ? `<img src="${esc(pl.photo)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">`
      : `<span class="lv-ph-r">${esc(pl.role)}</span>`;
    return `
      <div class="lv-half ${side}${out ? ' out' : ''}${inn ? ' in' : ''}" data-player-id="${esc(pl.id)}">
        <div class="lv-ph">${photo}<span class="lv-role rbadge r${esc(pl.role)}">${esc(pl.role)}</span></div>
        <div class="lv-info">
          <div class="lv-name">${esc(pl.name)}</div>
          <div class="lv-evs">${this._eventsMarkup(simOv ? { ...pl, ev: simOv.ev || {} } : pl, { out, inn })}</div>
        </div>
        ${this._boxMarkup(pl, sim)}
      </div>`;
  },

  _eventsMarkup(pl, { out, inn }) {
    const ev = pl.ev || {};
    const rep = (n, html) => Array.from({ length: Math.min(n, 5) }, () => html).join('');
    let h = '';
    if (ev.gol) h += rep(ev.gol, `<span class="lv-ev" title="Gol">⚽</span>`);
    if (ev.rigore_segnato) h += rep(ev.rigore_segnato, `<span class="lv-chip ok" title="Rigore segnato">R</span>`);
    if (ev.assist) h += rep(ev.assist, `<span class="lv-chip ok" title="Assist">A</span>`);
    if (ev.rigore_parato) h += rep(ev.rigore_parato, `<span class="lv-ev" title="Rigore parato">🧤</span>`);
    if (ev.porta_inviolata) h += `<span class="lv-chip ok" title="Porta inviolata">PI</span>`;
    if (ev.gol_subito) h += `<span class="lv-chip bad" title="Gol subiti">-${ev.gol_subito}</span>`;
    if (ev.autogol) h += rep(ev.autogol, `<span class="lv-chip bad" title="Autogol">AG</span>`);
    if (ev.rigore_sbagliato) h += rep(ev.rigore_sbagliato, `<span class="lv-chip bad" title="Rigore sbagliato">RS</span>`);
    if (ev.ammonizione) h += `<span class="lv-card y" title="Ammonizione"></span>`;
    if (ev.espulsione) h += `<span class="lv-card r" title="Espulsione"></span>`;
    // Ingresso / uscita nella partita di Serie A
    if (pl.subIn) h += `<i class="ri-arrow-up-fill lv-arr-in" title="Subentrato"></i>`;
    if (pl.subOut) h += `<i class="ri-arrow-down-fill lv-arr-out" title="Sostituito"></i>`;
    // Sostituzione al fantacalcio (dalla panchina)
    if (inn) h += `<span class="lv-chip ok" title="Entra dalla panchina">IN</span>`;
    if (out) h += `<span class="lv-chip bad" title="Sostituito dalla panchina">OUT</span>`;
    return h;
  },

  _kickLabel(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const days = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
    return `${days[d.getDay()]}<br>${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  },

  _boxMarkup(pl, sim) {
    const editable = sim ? ` editable" data-lv="edit" data-pid="${esc(pl.id)}` : '';
    const vote = (v, f, cls = '') => `<div class="lv-box vote ${cls}${editable}"><span class="v">${fmt(v)}</span><span class="f">${fmt(f)}</span></div>`;

    if (sim) {
      const o = this._sim.overrides[pl.id];
      if (o === null) return `<div class="lv-box sv sim${editable}" title="s.v. (simulato)">S.V.</div>`;
      if (o !== undefined) return vote(o.voto, o.fv, 'sim');
      const s = this._score(pl, true);
      if (s?.six) return vote(6, 6, 'sim');
    }

    switch (pl.kind) {
      case 'voto':
        return vote(pl.voto, pl.fv, pl.live ? 'live' : '');
      case 'sv':
        return `<div class="lv-box sv${editable}" title="Senza voto">S.V.</div>`;
      case 'playing':
        return `<div class="lv-box playing${editable}" title="Partita in corso: non ancora entrato / senza voto"><i class="ri-timer-flash-line"></i></div>`;
      case 'wait':
        return `<div class="lv-box wait${editable}" title="Partita finita: voti in arrivo"><i class="ri-hourglass-line"></i></div>`;
      default: { // todo: deve ancora giocare
        if (pl.st === 'squal') return `<div class="lv-box todo-out${editable}" title="Squalificato"><i class="ri-forbid-line"></i></div>`;
        if (pl.st === 'inf') return `<div class="lv-box todo-inf${editable}" title="Infortunato"><i class="ri-first-aid-kit-fill"></i></div>`;
        if (pl.pct !== null && pl.pct !== undefined) {
          if (pl.xi === 'tit' && pl.pct >= 45) return `<div class="lv-box todo-tit${editable}" title="Titolare nelle probabili">${pl.pct}%</div>`;
          if (pl.xi === 'tit' || pl.pct < 20) return `<div class="lv-box todo-low${editable}" title="Probabilità di giocare">${pl.pct}%</div>`;
          return `<div class="lv-box todo-pan${editable}" title="In panchina nelle probabili"><i class="ri-arrow-up-s-fill"></i>${pl.pct}%</div>`;
        }
        if (pl.probKnown) return `<div class="lv-box todo-out${editable}" title="Non presente nelle probabili formazioni"><i class="ri-forbid-line"></i></div>`;
        return `<div class="lv-box todo-time${editable}" title="Deve ancora giocare">${pl.kickoff ? this._kickLabel(pl.kickoff) : '<i class="ri-time-line"></i>'}</div>`;
      }
    }
  },

  _stadiumMarkup(home, away, sim) {
    const field = (t) => {
      if (!t.lineup) return `<div><div class="lv-stadium-t">${esc(t.info.name)}</div><div style="text-align:center;padding:2rem;background:var(--bg2);border-radius:12px;color:var(--text3);font-size:.85rem;">Formazione non inserita</div></div>`;
      const byRole = { P: [], D: [], C: [], A: [] };
      t.tit.forEach(p => { if (byRole[p.role]) byRole[p.role].push(p); });
      const rowY = { A: 18, C: 44, D: 70, P: 89 };
      const shirtBg = { P: '#475569', D: '#2196f3', C: '#e91e63', A: '#ff5722' };
      let html = '';
      ['P', 'D', 'C', 'A'].forEach(role => {
        const list = byRole[role];
        list.forEach((p, i) => {
          const x = list.length === 1 ? 50 : (100 / (list.length + 1)) * (i + 1);
          const s = this._score(p, sim);
          const scoreTag = s
            ? `<span class="lf-score ${p.live ? 'live' : ''}">${fmt(s.fv)}</span>`
            : (p.kind === 'sv' ? `<span class="lf-score sv">s.v.</span>` : '');
          const shirt = p.photo
            ? `<div class="lf-shirt has-png" style="background-image:url('${esc(p.photo)}')">`
            : `<div class="lf-shirt is-circle" style="background-color:${shirtBg[role]}">${role}`;
          html += `
            <div class="lf-player" style="left:${x}%; top:${rowY[role]}%;" data-player-id="${esc(p.id)}">
              ${shirt}${scoreTag}</div>
              <div class="lf-name">${esc(p.name)}</div>
            </div>`;
        });
      });
      return `
        <div>
          <div class="lv-stadium-t">${esc(t.info.name)}${t.lineup.modulo ? ` <span style="font-weight:400;color:var(--text2);font-size:.75rem;">(${esc(t.lineup.modulo)})</span>` : ''}</div>
          <div class="lf-field"><div class="lf-lines"><div class="lf-box"></div><div class="lf-circle"></div></div>${html}</div>
        </div>`;
    };
    return `
      <div style="margin-top:.8rem;">
        <div class="lv-wip-banner"><i class="ri-hammer-line"></i> Visuale stadio in lavorazione: per ora mostra solo i titolari con il fantavoto.</div>
        <div class="lv-stadium">${field(home)}${field(away)}</div>
      </div>`;
  },

  _footerMarkup({ mode, home, away, tH, tA }) {
    const title = mode === 'past' ? 'Totale finale' : (mode === 'live' ? 'Totale parziali' : 'Formazioni');
    const sent = (t) => {
      if (!t.lineup) return 'Formazione non inserita';
      const ts = Number(t.lineup.timestamp);
      return ts ? `Formazione inviata<br>${new Date(ts).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Formazione inviata';
    };
    const totals = mode === 'next' ? '' : `
      <div class="lv-tot"><span class="n">${tH ? fmt(tH.voti) : '-'}</span><span class="l">solo voti</span><span class="n">${tA ? fmt(tA.voti) : '-'}</span></div>
      <div class="lv-tot"><span class="n b">${tH ? fmt(tH.fv) : '-'}</span><span class="l">con bonus/malus</span><span class="n b">${tA ? fmt(tA.fv) : '-'}</span></div>
      ${mode === 'live' ? `<div class="lv-tot"><span class="n" style="font-size:.85rem;">${tH ? tH.n : 0}/11</span><span class="l">a referto</span><span class="n" style="font-size:.85rem;">${tA ? tA.n : 0}/11</span></div>` : ''}
      ${mode === 'past' ? `<div style="text-align:center;font-size:.66rem;color:var(--text3);margin-top:.3rem;">Totali con le sostituzioni dalla panchina</div>` : ''}`;
    return `
      <div class="lv-foot" style="margin-top:1.6rem;">
        <span class="lv-foot-title">${title}</span>
        ${totals}
        <div class="lv-sent"><div>${sent(home)}</div><div>${sent(away)}</div></div>
        ${mode === 'past' ? '' : this._legendMarkup(mode)}
      </div>`;
  },

  _legendMarkup(mode) {
    const items = [];
    if (mode === 'live') {
      items.push(`<span><span class="lv-box vote"><span class="v">6</span><span class="f">7</span></span> voto / fantavoto</span>`);
      items.push(`<span><span class="lv-box vote live"><span class="v">6</span><span class="f">6</span></span> in campo ora</span>`);
      items.push(`<span><span class="lv-box sv">S.V.</span> senza voto (ha giocato poco o non è entrato)</span>`);
      items.push(`<span><span class="lv-box playing"><i class="ri-timer-flash-line"></i></span> partita in corso, non ancora entrato</span>`);
      items.push(`<span><span class="lv-box wait"><i class="ri-hourglass-line"></i></span> voti in arrivo</span>`);
    }
    items.push(`<span><span class="lv-box todo-tit">90%</span> deve ancora giocare: titolare</span>`);
    items.push(`<span><span class="lv-box todo-pan"><i class="ri-arrow-up-s-fill"></i>%</span> parte dalla panchina</span>`);
    items.push(`<span><span class="lv-box todo-inf"><i class="ri-first-aid-kit-fill"></i></span> infortunato</span>`);
    items.push(`<span><span class="lv-box todo-out"><i class="ri-forbid-line"></i></span> squalificato / non convocato</span>`);
    return `<div class="lv-legend">${items.join('')}</div>`;
  },

  // ------------------------------------------------------------------
  // Editor del voto simulato
  // ------------------------------------------------------------------
  _closeEditor() {
    document.getElementById('lv-editor')?.remove();
  },

  _findPlayerForEdit(pid) {
    const d = this._data;
    const list = d ? this._playersList(d.players) : this._playersList(window.STATE?.players);
    const p = list.find(x => String(x.id) === String(pid));
    if (!p) return null;
    const votes = d?.votes || {};
    const playersById = new Map([[String(p.id), p]]);
    const ctx = this._ctx({ mode: 'live', votes, playersById, gwReale: d?.gwReale, liveMatches: d?.liveMatches });
    return this._player(pid, playersById, ctx);
  },

  _openEditor(pid, rerender) {
    this._closeEditor();
    const pl = this._findPlayerForEdit(pid);
    if (!pl) return;
    const cur = this._sim.overrides[pid];
    const start = cur !== undefined
      ? (cur ? { voto: cur.voto, ev: { ...(cur.ev || {}) } } : { voto: 6, ev: {} })
      : { voto: pl.kind === 'voto' ? pl.voto : 6, ev: { ...(pl.ev || {}) } };
    const state = { voto: start.voto, ev: start.ev };

    const keys = Object.keys(EVENTI);
    const el = document.createElement('div');
    el.id = 'lv-editor';
    const draw = () => {
      const fv = this._fantavoto(state.voto, state.ev);
      el.innerHTML = `
        <div class="lv-ed lv-wrap" role="dialog" aria-modal="true" aria-label="Modifica voto simulato">
          <div class="lv-ed-h">
            <div><b>${esc(pl.name)}</b><small>${esc(pl.club)} · ${esc(pl.role)} · voto simulato</small></div>
            <button class="lv-ed-x" data-ed="close" aria-label="Chiudi"><i class="ri-close-line"></i></button>
          </div>
          <div class="lv-ed-v">
            <button data-ed="v-" aria-label="Diminuisci voto">−</button>
            <div class="val">${fmt(state.voto)}</div>
            <button data-ed="v+" aria-label="Aumenta voto">+</button>
          </div>
          <div class="lv-ed-g">
            ${keys.map(k => `
              <div class="lv-ed-e">
                <span>${EV_LABEL[k]} <small>${RULE_MATCH[k] > 0 ? '+' : ''}${RULE_MATCH[k]}</small></span>
                <div><button data-ed="e-" data-k="${k}" aria-label="Meno">−</button><b>${state.ev[k] || 0}</b><button data-ed="e+" data-k="${k}" aria-label="Più">+</button></div>
              </div>`).join('')}
          </div>
          <div class="lv-ed-fv">Fantavoto: <b>${fmt(fv)}</b></div>
          <div class="lv-ed-a">
            <button class="lv-btn" data-ed="reset"><i class="ri-arrow-go-back-line"></i> Reale</button>
            <button class="lv-btn" data-ed="sv">S.V.</button>
            <button class="lv-btn prim" data-ed="ok"><i class="ri-check-line"></i> Applica</button>
          </div>
        </div>`;
    };
    draw();
    document.body.appendChild(el);

    el.addEventListener('click', (e) => {
      if (e.target === el) { this._closeEditor(); return; }
      const b = e.target.closest('[data-ed]');
      if (!b) return;
      const a = b.dataset.ed;
      if (a === 'close') { this._closeEditor(); return; }
      if (a === 'v-') state.voto = Math.max(1, state.voto - 0.5);
      if (a === 'v+') state.voto = Math.min(10, state.voto + 0.5);
      if (a === 'e-' || a === 'e+') {
        const k = b.dataset.k;
        const n = Math.max(0, Math.min(9, (state.ev[k] || 0) + (a === 'e+' ? 1 : -1)));
        if (n) state.ev[k] = n; else delete state.ev[k];
      }
      if (a === 'reset') { delete this._sim.overrides[pid]; this._closeEditor(); rerender(); return; }
      if (a === 'sv') { this._sim.overrides[pid] = null; this._closeEditor(); rerender(); return; }
      if (a === 'ok') {
        this._sim.overrides[pid] = { voto: state.voto, fv: this._fantavoto(state.voto, state.ev), ev: { ...state.ev } };
        this._closeEditor(); rerender(); return;
      }
      draw();
    });
  }
};
