/**
 * PlayerCard - scheda del calciatore
 * ------------------------------------------------------------------
 * Si apre cliccando qualsiasi elemento con  data-player-id="<id>"
 * (listone, svincolati, rosa delle squadre...). Il collegamento è globale,
 * fatto una volta sola in index.html con PlayerCard.bindGlobal().
 *
 * Dati:
 *   playerStats/{id}/g{n}  (scritti dalla Cloud Function, una riga per giornata)
 *     s: "t" titolare | "s" subentrato | "i" infortunato | "q" squalificato
 *     v: voto (assente = s.v.), sv, gf, gs, rp, rs, rf, au, amm, esp, ass, out
 *   STATE.statsMeta.giornate  = giornate importate (per capire chi era "inutilizzato")
 */
import { db, ref, get } from '../firebase-config.js';
import { RULE_MATCH } from '../services/calcoloMatch.js';
import { ProbabiliService, STATUS_INFO } from '../services/probabiliService.js';
import { OfflineStore } from '../services/offlineStore.js';
import { BackNav } from '../services/backNav.js';
import { FavoritesService } from '../services/favoritesService.js';
import { esc } from '../utils.js';

const fmt1 = (n) => (n === null || n === undefined || !Number.isFinite(n)) ? '–' : n.toFixed(2).replace(/0$/, '');
const ROLE_NAMES = { P: 'Portiere', D: 'Difensore', C: 'Centrocampista', A: 'Attaccante' };
const favLabel = (on) => on ? 'Togli dai preferiti' : 'Aggiungi ai preferiti';
// statistiche già lette in questa sessione: riaprendo la scheda si vedono subito
const statsCache = new Map();
const inflight = new Map(); // letture in corso (il tocco le avvia prima che la scheda si apra)

function fetchStats(path) {
  if (inflight.has(path)) return inflight.get(path);
  const job = OfflineStore.withTimeout(get(ref(db, path)))
    .then(snap => {
      const fresh = snap.val() || {};
      statsCache.set(path, fresh);
      OfflineStore.save(path, fresh);
      return fresh;
    })
    .finally(() => inflight.delete(path));
  inflight.set(path, job);
  return job;
}

// Stato di una giornata -> aspetto della cella
const CELL = {
  t:   { label: 'Titolare',       cls: 'pc-t' },
  s:   { label: 'Subentrato',     cls: 'pc-s' },
  n:   { label: 'Inutilizzato',   cls: 'pc-n' },
  i:   { label: 'Infortunato',    cls: 'pc-i' },
  q:   { label: 'Squalificato',   cls: 'pc-q' },
  f:   { label: 'Da giocare',     cls: 'pc-f' },
};

/**
 * Fantavoto: voto + bonus/malus con i valori del regolamento della lega
 * (RULE_MATCH in calcoloMatch.js). Su fantacalcio.it i gol su azione (gf)
 * e i rigori segnati (rf) sono conteggiati separatamente. Il portiere senza
 * gol subiti prende anche il bonus porta inviolata.
 */
function fantavoto(e, ruolo) {
  if (!e || typeof e.v !== 'number') return null;
  return e.v
    + (e.gf || 0) * RULE_MATCH.gol
    + (e.rf || 0) * RULE_MATCH.rigore_segnato
    + (e.ass || 0) * RULE_MATCH.assist
    + (e.amm || 0) * RULE_MATCH.ammonizione
    + (e.esp || 0) * RULE_MATCH.espulsione
    + (e.au || 0) * RULE_MATCH.autogol
    + (e.rp || 0) * RULE_MATCH.rigore_parato
    + (e.rs || 0) * RULE_MATCH.rigore_sbagliato
    + (e.gs || 0) * RULE_MATCH.gol_subito
    + (ruolo === 'P' && !e.gs ? RULE_MATCH.porta_inviolata : 0);
}

export const PlayerCard = {
  _bound: false,
  _current: null,

  bindGlobal() {
    if (this._bound) return;
    this._bound = true;
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-player-id]');
      if (!el) return;
      // non intercetto pulsanti/link/campi dentro la riga (es. "Svincola", select...)
      const inner = e.target.closest('button, a, select, input, textarea, label');
      if (inner && el.contains(inner) && inner !== el) return;
      this.open(el.dataset.playerId);
    });
    // appena il dito tocca un giocatore parte la lettura delle statistiche (guadagna il tempo del tocco)
    document.addEventListener('pointerdown', (e) => {
      const el = e.target.closest && e.target.closest('[data-player-id]');
      const path = el && `playerStats/${el.dataset.playerId}`;
      if (path && !statsCache.has(path)) fetchStats(path).catch(() => {});
    }, { passive: true });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._current) this.close();
    });
    // stile e finestra si preparano prima, a riposo: al primo tocco la scheda si apre subito
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1200));
    idle(() => this._ensureDom());
  },

  _ensureDom() {
    let ov = document.getElementById('pc-overlay');
    if (ov) return ov;
    const style = document.createElement('style');
    style.id = 'pc-style';
    style.textContent = this._css();
    document.head.appendChild(style);
    ov = document.createElement('div');
    ov.id = 'pc-overlay';
    ov.innerHTML = `<div class="pc-sheet" role="dialog" aria-modal="true" aria-labelledby="pc-name" tabindex="-1"><div class="pc-top"></div><div class="pc-content"></div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', (e) => {
      if (e.target === ov || e.target.closest('[data-pc-close]')) this.close();
      const fav = e.target.closest('[data-pc-fav]');
      if (fav && this._current) this._paintFav(fav, FavoritesService.toggle(this._current.p.id));
      const cell = e.target.closest('[data-gw]');
      if (cell) this._showDay(Number(cell.dataset.gw));
    });
    return ov;
  },

  close() {
    const ov = document.getElementById('pc-overlay');
    if (ov) ov.classList.remove('open');
    this._current = null;
    BackNav.pop('player-card');
    // il focus torna dove si era toccato (lettori di schermo / tastiera)
    if (this._opener && this._opener.isConnected) this._opener.focus({ preventScroll: true });
    this._opener = null;
  },

  async open(playerId) {
    const STATE = window.STATE || {};
    const players = Array.isArray(STATE.players) ? STATE.players : Object.values(STATE.players || {});
    const p = players.find(x => String(x.id) === String(playerId));
    if (!p) return;

    const ov = this._ensureDom();
    const path = `playerStats/${p.id}`;
    const cur = this._current = { p, rows: statsCache.get(path) || null };
    this._renderTop();
    this._renderBody();
    ov.classList.add('open');
    this._opener = this._opener || document.activeElement;
    BackNav.push('player-card', () => this.close());
    // il focus va sulla scheda (resta valido anche quando il contenuto si ridisegna)
    const sheet = ov.querySelector('.pc-sheet');
    sheet.scrollTop = 0;
    sheet.focus({ preventScroll: true });

    const still = () => this._current === cur; // chiusa o cambiata nel frattempo?
    // intanto l'ultima copia salvata sul dispositivo (arriva prima della rete)
    if (!cur.rows) {
      OfflineStore.read(path).then(cached => {
        if (still() && !cur.rows && cached !== undefined) { cur.rows = cached; this._renderBody(); }
      });
    }
    try {
      const fresh = await fetchStats(path);
      if (!still()) return;
      if (JSON.stringify(fresh) === JSON.stringify(cur.rows)) return; // già quella mostrata
      cur.rows = fresh;
    } catch (err) {
      console.warn('Statistiche non leggibili:', err?.message);
      if (!still() || cur.rows) return; // offline: resta la copia già mostrata
      const cached = await OfflineStore.read(path);
      if (!still()) return;
      cur.rows = cached || {};
      if (cached === undefined) cur.error = true;
    }
    this._renderBody();
  },

  /** Riassunto delle giornate: stato per ognuna + totali */
  _compute(p, rows) {
    const STATE = window.STATE || {};
    const imported = Object.keys(STATE.statsMeta?.giornate || {}).map(Number).filter(Boolean);
    const lastImported = imported.length ? Math.max(...imported) : 0;
    const importedSet = new Set(imported);

    const days = [];
    const tot = { gol: 0, pres: 0, tit: 0, sub: 0, aVoto: 0, gf: 0, ass: 0, gs: 0, rp: 0, rs: 0, rf: 0, au: 0, amm: 0, esp: 0, inviolate: 0, sumV: 0, sumF: 0 };

    for (let g = 1; g <= 38; g++) {
      const e = rows?.[`g${g}`] || null;
      let st;
      if (e && (e.s === 't' || e.s === 's')) st = e.s;
      else if (e && (e.s === 'i' || e.s === 'q')) st = e.s;
      else if (importedSet.has(g)) st = 'n';
      else st = 'f';
      const fv = st === 't' || st === 's' ? fantavoto(e, p.role) : null;
      days.push({ g, st, e, fv });

      if (st === 't' || st === 's') {
        tot.pres++;
        st === 't' ? tot.tit++ : tot.sub++;
        ['gf', 'ass', 'gs', 'rp', 'rs', 'rf', 'au', 'amm', 'esp'].forEach(k => { tot[k] += e[k] || 0; });
        tot.gol = (tot.gol || 0) + (e.gf || 0) + (e.rf || 0);
        if (typeof e.v === 'number') {
          tot.aVoto++;
          tot.sumV += e.v;
          tot.sumF += fv;
          if (p.role === 'P' && !e.gs) tot.inviolate++;
        }
      }
    }
    tot.mv = tot.aVoto ? tot.sumV / tot.aVoto : null;
    tot.mfv = tot.aVoto ? tot.sumF / tot.aVoto : null;
    return { days, tot, lastImported };
  },

  /** Parte alta: foto, nome, squadra, prossima partita (disegnata una volta per apertura) */
  _renderTop() {
    const top = document.querySelector('#pc-overlay .pc-top');
    if (!top || !this._current) return;
    const { p } = this._current;
    const STATE = window.STATE || {};

    const photo = p.photoPersonal || p.photoStandard || '';
    const team = (STATE.teams || []).find(t => String(t.id) === String(p.teamId));
    const owner = team ? team.name : (p.loan ? 'In prestito' : 'Svincolato');

    // prossima partita dalle probabili formazioni
    const info = ProbabiliService.getInfo(p, STATE);
    let next = '';
    if (info.opp) {
      const stato = info.st && STATUS_INFO[info.st]
        ? `<span class="pc-chip" style="--c:${STATUS_INFO[info.st].color}">${STATUS_INFO[info.st].label}</span>`
        : '';
      const pct = info.pct !== null ? `<b style="color:${ProbabiliService.pctColor(info.pct)}">${info.pct}%</b> di giocare` : '';
      next = `<div class="pc-next">Prossima: <b>vs ${esc(info.opp.name)}</b> ${info.opp.home ? '(casa)' : '(trasferta)'} ${pct ? '· ' + pct : ''} ${stato}</div>`;
    }

    const hero = `
      <div class="pc-hero">
        <button class="pc-close" data-pc-close aria-label="Chiudi"><i class="ri-close-line"></i></button>
        ${this._favHTML(FavoritesService.has(p.id))}
        <div class="pc-photo">${photo ? `<img src="${esc(photo)}" alt="">` : `<span>${esc(p.role)}</span>`}</div>
        <div class="pc-id">
          <div class="pc-role"><span class="rbadge r${esc(p.role)}">${esc(p.role)}</span> ${ROLE_NAMES[p.role] || ''}</div>
          <h2 id="pc-name" class="pc-name">${esc(p.name)}</h2>
          <div class="pc-club">${esc(p.club || '')} <span class="pc-owner">${esc(owner)}</span></div>
        </div>
      </div>
      ${next}`;
    top.innerHTML = hero;
  },

  /**
   * Statistiche: si ridisegnano solo queste quando arrivano i dati.
   * Mentre si caricano la scheda ha già la sua forma completa (numeri e giornate "in caricamento"):
   * si apre subito alla sua altezza invece di allungarsi quando arrivano i dati.
   */
  _renderBody() {
    const box = document.querySelector('#pc-overlay .pc-content');
    if (!box || !this._current) return;
    const { p, rows, error } = this._current;
    const loading = !rows;

    const { days, tot, lastImported } = this._compute(p, rows || {});

    if (!lastImported || (error && !Object.keys(rows || {}).length)) {
      box.innerHTML = `<div class="pc-empty">${error
        ? 'Non riesco a leggere le statistiche. Controlla la connessione e riapri la scheda.'
        : 'Le statistiche compaiono dopo il primo "Calcola giornata" del Patron.'}</div>`;
      return;
    }

    const isGk = p.role === 'P';
    const dash = (v) => loading ? '–' : v;
    const big = [
      { v: tot.pres, l: 'Presenze', sub: tot.pres ? `${tot.tit} da titolare` : '' },
      isGk ? { v: tot.gs, l: 'Gol subiti', sub: tot.aVoto ? `${(tot.gs / tot.aVoto).toFixed(2).replace('.', ',')} a partita` : '' }
           : { v: tot.gol, l: 'Gol', sub: tot.rf ? `${tot.rf} su rigore` : '' },
      isGk ? { v: tot.rp, l: 'Rigori parati', sub: tot.inviolate ? `${tot.inviolate} porte inviolate` : '' }
           : { v: tot.ass, l: 'Assist', sub: '' },
    ].map(b => ({ ...b, v: dash(b.v) }));
    const avg = [
      { v: fmt1(tot.mv), l: 'Media voto' },
      { v: fmt1(tot.mfv), l: 'Media fantavoto' },
    ];
    const extra = [
      { v: tot.amm, l: 'Ammonizioni', icon: '<span class="pc-card y"></span>' },
      { v: tot.esp, l: 'Espulsioni', icon: '<span class="pc-card r"></span>' },
      ...(isGk && tot.gol ? [{ v: tot.gol, l: 'Gol' }] : []),
      ...(isGk && tot.ass ? [{ v: tot.ass, l: 'Assist' }] : []),
      ...(!isGk && tot.rs ? [{ v: tot.rs, l: 'Rigori sbagliati' }] : []),
      ...(tot.au ? [{ v: tot.au, l: 'Autogol' }] : []),
      { v: tot.sub, l: 'Da subentrato' },
    ].map(x => ({ ...x, v: dash(x.v) }));

    const cells = days.map(d => {
      if (loading && d.st !== 'f') {
        return `<button class="pc-cell pc-sk" disabled aria-label="Giornata ${d.g}: in caricamento"><span class="pc-g">${d.g}</span></button>`;
      }
      const c = CELL[d.st];
      const val = (d.st === 't' || d.st === 's')
        ? (typeof d.e?.v === 'number' ? String(d.e.v).replace('.', ',') : 'sv')
        : d.st === 'i' ? '<i class="ri-first-aid-kit-line"></i>' : d.st === 'q' ? '<i class="ri-forbid-2-line"></i>' : '';
      const marks = (d.e?.gf || d.e?.rf ? '<i class="pc-dot g"></i>' : '') + (d.e?.ass ? '<i class="pc-dot a"></i>' : '') + (d.e?.esp ? '<i class="pc-dot r"></i>' : d.e?.amm ? '<i class="pc-dot y"></i>' : '');
      return `<button class="pc-cell ${c.cls}" data-gw="${d.g}" ${d.st === 'f' ? 'disabled' : ''} aria-label="Giornata ${d.g}: ${c.label}">
          <span class="pc-g">${d.g}</span><span class="pc-v">${val}</span>${marks ? `<span class="pc-marks">${marks}</span>` : ''}
        </button>`;
    }).join('');

    const legend = ['t', 's', 'n', 'i', 'q'].map(k => `<span><i class="pc-sw ${CELL[k].cls}"></i>${CELL[k].label}</span>`).join('');

    box.innerHTML = `
      <div class="pc-body">
        <div class="pc-big">${big.map(b => `<div><div class="pc-num">${b.v}</div><div class="pc-lab">${b.l}</div><div class="pc-sub">${b.sub || '&nbsp;'}</div></div>`).join('')}</div>
        <div class="pc-avg">${avg.map(a => `<div><span class="pc-lab">${a.l}</span><span class="pc-num sm">${a.v}</span></div>`).join('')}</div>
        <div class="pc-extra">${extra.map(x => `<div>${x.icon || ''}<span class="pc-lab">${x.l}</span><b>${x.v}</b></div>`).join('')}</div>

        <h3 class="pc-h3">Stagione giornata per giornata</h3>
        <div class="pc-strip">${cells}</div>
        <div class="pc-legend">${legend}</div>
        <div class="pc-day" id="pc-day">${loading ? 'Carico le statistiche…' : 'Tocca una giornata per il dettaglio.'}</div>
      </div>`;

    if (loading) return;
    this._current.days = days;
    // dettaglio dell'ultima giornata giocata di default
    const lastPlayed = [...days].reverse().find(d => d.st !== 'f');
    if (lastPlayed) this._showDay(lastPlayed.g);
  },

  /** Stella dei preferiti in alto a destra, accanto alla X */
  _favHTML(on) {
    return `<button class="pc-fav${on ? ' on' : ''}" data-pc-fav aria-pressed="${on}" aria-label="${favLabel(on)}" title="${favLabel(on)}"><i class="${on ? 'ri-star-fill' : 'ri-star-line'}"></i></button>`;
  },

  // aggiornata sul posto: il focus resta sulla stella
  _paintFav(btn, on) {
    const label = favLabel(on);
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', label);
    btn.title = label;
    btn.querySelector('i').className = on ? 'ri-star-fill' : 'ri-star-line';
  },

  _showDay(g) {
    const box = document.getElementById('pc-day');
    const d = this._current?.days?.find(x => x.g === g);
    if (!box || !d || d.st === 'f') return;
    document.querySelectorAll('#pc-overlay .pc-cell').forEach(c => c.classList.toggle('sel', Number(c.dataset.gw) === g));

    const e = d.e || {};
    let txt = `<b>${g}ª giornata</b> · ${CELL[d.st].label}`;
    if (d.st === 't' || d.st === 's') {
      txt += typeof e.v === 'number'
        ? ` · voto <b>${String(e.v).replace('.', ',')}</b> · fantavoto <b>${String(Math.round(d.fv * 100) / 100).replace('.', ',')}</b>`
        : ' · senza voto';
      const ev = [];
      const gol = (e.gf || 0) + (e.rf || 0);
      if (gol) ev.push(`${gol} gol${e.rf ? ` (${e.rf} su rigore)` : ''}`);
      if (e.ass) ev.push(`${e.ass} assist`);
      if (e.gs) ev.push(`${e.gs} gol subiti`);
      if (e.rp) ev.push(`${e.rp} rigori parati`);
      if (e.rs) ev.push(`${e.rs} rigori sbagliati`);
      if (e.au) ev.push(`${e.au} autogol`);
      if (e.amm) ev.push('ammonito');
      if (e.esp) ev.push('espulso');
      if (e.out) ev.push('sostituito');
      if (ev.length) txt += `<br>${ev.join(', ')}`;
    }
    box.innerHTML = txt;
  },

  _css() {
    return `
#pc-overlay{position:fixed;inset:0;z-index:10050;background:var(--overlay-bg, rgba(5,8,15,.7));display:none;align-items:flex-end;justify-content:center}
#pc-overlay.open{display:flex}
#pc-overlay .pc-sheet{width:100%;max-width:560px;max-height:92vh;overflow-y:auto;background:var(--bg,#1a1e24);border:1px solid var(--border);border-radius:20px 20px 0 0;padding-bottom:calc(1rem + var(--safe-b, env(safe-area-inset-bottom, 0px)));animation:pcUp .2s ease-out;outline:none}
@media (min-width:700px){#pc-overlay{align-items:center}#pc-overlay .pc-sheet{border-radius:20px}}
@media (prefers-reduced-motion:reduce){#pc-overlay .pc-sheet{animation:none}}
@keyframes pcUp{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
.pc-hero{position:relative;display:flex;align-items:flex-end;gap:1rem;padding:1.4rem 1.2rem 1rem;background:radial-gradient(120% 140% at 0% 100%,color-mix(in srgb,var(--accent) 22%,transparent) 0%,transparent 60%);border-bottom:1px solid rgba(255,255,255,.06)}
.pc-close{position:absolute;top:.8rem;right:.8rem;width:34px;height:34px;border-radius:50%;border:none;background:var(--bg2);color:var(--text);font-size:1.15rem;cursor:pointer}
.pc-fav{position:absolute;top:.8rem;right:calc(.8rem + 42px);width:34px;height:34px;border-radius:50%;border:none;background:var(--bg2);color:var(--text2);font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center}
.pc-fav.on{color:var(--gold)}
.pc-close:focus-visible,.pc-fav:focus-visible,.pc-cell:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.pc-photo{width:92px;height:104px;flex-shrink:0;display:flex;align-items:flex-end;justify-content:center}
.pc-photo img{max-width:100%;max-height:100%;object-fit:contain;filter:drop-shadow(0 6px 10px rgba(0,0,0,.5))}
.pc-photo span{width:72px;height:72px;border-radius:50%;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:2rem;color:var(--text3)}
.pc-id{min-width:0;padding-bottom:.2rem}
.pc-role{display:flex;align-items:center;gap:.4rem;font-size:.75rem;color:var(--text2);font-family:var(--font-sub,inherit)}
.pc-role .rbadge{width:20px;height:20px;font-size:.6rem;border-radius:5px}
.pc-name{font-family:'Bebas Neue',sans-serif;font-size:2.3rem;line-height:1;letter-spacing:.5px;margin:.25rem 0;color:var(--text);word-break:break-word}
.pc-club{font-size:.82rem;color:var(--text2);font-family:var(--font-sub,inherit)}
.pc-owner{display:inline-block;margin-left:.35rem;padding:1px 8px;border-radius:10px;background:var(--bg2);color:var(--gold);font-size:.72rem}
.pc-next{padding:.6rem 1.2rem;font-size:.78rem;color:var(--text2);font-family:var(--font-sub,inherit);border-bottom:1px solid var(--border)}
.pc-next b{color:var(--text)}
.pc-chip{display:inline-block;margin-left:.3rem;padding:0 7px;border-radius:9px;font-size:.66rem;font-weight:700;color:var(--c);border:1px solid var(--c);background:color-mix(in srgb,var(--c) 14%,transparent)}
.pc-empty{padding:2rem 1.2rem;text-align:center;color:var(--text2);font-family:var(--font-sub,inherit);font-size:.85rem}
.pc-body{padding:1rem 1.2rem 0}
.pc-big{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem}
.pc-big>div{padding:.2rem 0}
.pc-num{font-family:'Bebas Neue',sans-serif;font-size:2.6rem;line-height:1;color:var(--text)}
.pc-num.sm{font-size:1.7rem;color:var(--accent)}
.pc-lab{font-size:.75rem;color:var(--text2);font-family:var(--font-sub,inherit)}
.pc-sub{font-size:.68rem;color:var(--text3);font-family:var(--font-text3,inherit);margin-top:1px}
.pc-avg{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin:.9rem 0 .6rem}
.pc-avg>div{display:flex;align-items:baseline;justify-content:space-between;gap:.5rem;padding:.55rem .8rem;border-radius:12px;background:var(--bg2)}
.pc-avg .pc-num{min-width:2.3em;text-align:right}
.pc-extra{display:grid;grid-template-columns:1fr 1fr;column-gap:1.2rem}
.pc-extra>div{display:flex;align-items:center;gap:.45rem;padding:.45rem 0;border-bottom:1px solid var(--border)}
.pc-extra .pc-lab{flex:1}
.pc-extra b{font-weight:700;color:var(--text);font-size:.9rem}
.pc-card{width:10px;height:14px;border-radius:2px;display:inline-block}
.pc-card.y{background:#f5c518}.pc-card.r{background:#ff4757}
.pc-h3{font-size:.9rem;font-weight:700;color:var(--text);margin:1.3rem 0 .6rem}
.pc-strip{display:grid;grid-template-columns:repeat(10,1fr);gap:4px}
@media (min-width:480px){.pc-strip{grid-template-columns:repeat(13,1fr)}}
.pc-cell{position:relative;aspect-ratio:1/1.15;border-radius:7px;border:1px solid transparent;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;padding:0;cursor:pointer;font-family:inherit;color:#fff;background:var(--bg3)}
.pc-cell:disabled{cursor:default}
.pc-cell.sel{box-shadow:0 0 0 2px var(--text)}
.pc-g{position:absolute;top:2px;left:4px;font-size:.52rem;opacity:.75}
.pc-v{font-size:.78rem;font-weight:700;margin-top:6px}
.pc-marks{position:absolute;bottom:3px;display:flex;gap:2px}
.pc-dot{width:5px;height:5px;border-radius:50%;display:block}
.pc-dot.g{background:#fff}.pc-dot.a{background:#7fd3ff}.pc-dot.y{background:#f5c518}.pc-dot.r{background:#ff4757}
.pc-t{background:#2f8f3a}
.pc-s{background:#2563c9}
.pc-n{background:transparent;border-color:rgba(255,255,255,.18);color:var(--text3);font-family:var(--font-text3,inherit)}
.pc-i{background:#c2410c}
.pc-q{background:#7e3fbf}
.pc-sk{background:var(--bg3);color:var(--text3);animation:pcPulse 1.1s ease-in-out infinite}
@keyframes pcPulse{0%,100%{opacity:.45}50%{opacity:.85}}
@media (prefers-reduced-motion:reduce){.pc-sk{animation:none;opacity:.6}}
.pc-f{background:transparent;border:1px dashed rgba(255,255,255,.1);color:var(--text3);font-family:var(--font-text3,inherit)}
.pc-legend{display:flex;flex-wrap:wrap;gap:.35rem .9rem;margin-top:.6rem;font-size:.68rem;color:var(--text2);font-family:var(--font-sub,inherit)}
.pc-legend span{display:flex;align-items:center;gap:.3rem}
.pc-sw{width:10px;height:10px;border-radius:3px;display:inline-block}
.pc-sw.pc-n{border:1px solid rgba(255,255,255,.35)}
.pc-day{margin-top:.8rem;padding:.7rem .8rem;border-radius:12px;background:var(--bg2);font-size:.8rem;color:var(--text2);font-family:var(--font-sub,inherit);line-height:1.5}
.pc-day b{color:var(--text)}
`;
  },
};
