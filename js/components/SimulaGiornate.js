/**
 * Finestra "Simula giornate" (pagina Classifica).
 * Per ogni partita ancora da giocare si sceglie 1 / X / 2; "Giornate avanti" decide quante giornate contare.
 * Le partite senza scelta non contano. Lo stato (sim = { n, picks: { gwKey: { coupleKey: '1'|'X'|'2' } } })
 * è di chi apre la finestra: qui si modifica e si avvisa con onChange; onApply quando si chiede di vedere la classifica.
 */
import { esc, sameId } from '../utils.js';
import { BackNav } from '../services/backNav.js';

const STYLE_ID = 'cls-sim-styles';
const CSS = `
.cs-ov{position:fixed;inset:0;z-index:6000;background:var(--bg);display:flex;flex-direction:column;color:var(--text)}
.cs-head{display:flex;align-items:center;gap:.6rem;padding:calc(.7rem + env(safe-area-inset-top,0px)) 16px .7rem;border-bottom:1px solid var(--border);background:var(--bg2)}
.cs-head b{flex:1;font-family:var(--font-title,inherit);color:var(--title,var(--accent));font-size:1.05rem}
.cs-x{background:none;border:none;color:var(--text2);font-size:1.5rem;padding:.2rem;cursor:pointer;line-height:1}
.cs-bar{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;padding:.6rem 16px;border-bottom:1px solid var(--border);font-size:.85rem}
.cs-step{display:inline-flex;align-items:center;border:1px solid var(--border);border-radius:999px;overflow:hidden}
.cs-step button{background:var(--bg3);color:var(--text);border:none;width:34px;height:30px;font-size:1rem;cursor:pointer}
.cs-step button:disabled{opacity:.35}
.cs-step span{min-width:30px;text-align:center;font-weight:700;font-family:'DM Mono',monospace}
.cs-sub{color:var(--text2);font-family:var(--font-sub,inherit);font-size:.75rem}
.cs-body{flex:1;overflow-y:auto;padding:.6rem 16px 1rem;-webkit-overflow-scrolling:touch}
.cs-gw{background:var(--subbox-bg);border:1px solid var(--border);border-radius:14px;margin-bottom:.8rem;overflow:hidden}
.cs-gwh{display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding:.5rem .7rem;border-bottom:1px solid var(--border);flex-wrap:wrap}
.cs-gwh>span{font-weight:700;font-size:.85rem;color:var(--title,var(--accent));font-family:var(--font-title,inherit)}
.cs-q{display:flex;gap:.3rem;align-items:center;font-size:.7rem;color:var(--text2)}
.cs-q button{background:var(--bg3);color:var(--text2);border:1px solid var(--border);border-radius:6px;padding:.15rem .45rem;font-size:.72rem;cursor:pointer}
.cs-m{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:.4rem;padding:.45rem .7rem;border-bottom:1px solid var(--border)}
.cs-m:last-child{border-bottom:none}
.cs-t{display:flex;align-items:center;gap:.35rem;font-size:.8rem;min-width:0}
.cs-t.a{justify-content:flex-end;text-align:right}
.cs-t span{overflow-wrap:anywhere;min-width:0}
.cs-t img,.cs-t i{width:22px;height:22px;object-fit:contain;flex-shrink:0;font-size:1rem;color:var(--text3);text-align:center}
.cs-p{display:flex;gap:.25rem}
.cs-p button{width:34px;height:32px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);color:var(--text2);font-weight:700;font-size:.85rem;cursor:pointer;font-family:'DM Mono',monospace}
.cs-p button.on{background:var(--accent);border-color:var(--accent);color:var(--btn-primary-text,#000)}
.cs-foot{display:flex;gap:.5rem;padding:.7rem 16px calc(.7rem + env(safe-area-inset-bottom,0px));border-top:1px solid var(--border);background:var(--bg2)}
.cs-foot .btn{padding:.6rem .5rem;font-size:.8rem}
.cs-empty{text-align:center;color:var(--text2);padding:2rem 1rem;font-size:.9rem}
`;

const ESITI = ['1', 'X', '2'];

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement('style');
  st.id = STYLE_ID;
  st.textContent = CSS;
  document.head.appendChild(st);
}

/**
 * @param {Object} o
 * @param {Array} o.giornate  [{ gwKey, label, couples: [{ key, homeId, awayId }] }] in ordine, solo da giocare
 * @param {Array} o.teams     squadre (nome e logo)
 * @param {Object} o.sim      { n, picks } (viene modificato)
 * @param {Function} o.onChange chiamata a ogni modifica
 * @param {Function} o.onApply  "Mostra classifica"
 */
export function openSimulaGiornate({ giornate, teams, sim, onChange, onApply }) {
  injectStyle();
  document.getElementById('cls-sim')?.remove();
  sim.picks = sim.picks || {};
  sim.n = Math.max(1, Math.min(Number(sim.n) || 1, giornate.length || 1));

  const team = (id) => (teams || []).find(t => sameId(t.id, id));
  const teamHTML = (id, side) => {
    const t = team(id);
    const logo = t?.logo ? `<img src="${esc(t.logo)}" alt="">` : `<i class="ri-shield-line"></i>`;
    const name = `<span>${esc(t ? t.name : id)}</span>`;
    return `<div class="cs-t ${side}">${side === 'h' ? logo + name : name + logo}</div>`;
  };

  const el = document.createElement('div');
  el.id = 'cls-sim';
  el.className = 'cs-ov';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Simula giornate');
  document.body.appendChild(el);

  const visibili = () => giornate.slice(0, sim.n);
  const contaScelte = () => visibili().reduce((a, g) => a + g.couples.filter(c => sim.picks[g.gwKey]?.[c.key]).length, 0);
  const contaPartite = () => visibili().reduce((a, g) => a + g.couples.length, 0);

  const setPick = (gwKey, key, v) => {
    const gw = sim.picks[gwKey] || (sim.picks[gwKey] = {});
    if (v) gw[key] = v; else delete gw[key];
    if (!Object.keys(gw).length) delete sim.picks[gwKey];
  };

  const draw = () => {
    const body = giornate.length
      ? visibili().map(g => `
        <div class="cs-gw">
          <div class="cs-gwh"><span>${esc(g.label)}</span>
            <div class="cs-q">Tutte: ${ESITI.map(v => `<button data-all="${esc(g.gwKey)}" data-v="${v}">${v}</button>`).join('')}
              <button data-all="${esc(g.gwKey)}" data-v="" aria-label="Togli le scelte"><i class="ri-eraser-line"></i></button></div>
          </div>
          ${g.couples.map(c => {
            const cur = sim.picks[g.gwKey]?.[c.key] || '';
            return `<div class="cs-m">
              ${teamHTML(c.homeId, 'h')}
              <div class="cs-p">${ESITI.map(v => `<button class="${cur === v ? 'on' : ''}" data-gw="${esc(g.gwKey)}" data-key="${esc(c.key)}" data-v="${v}">${v}</button>`).join('')}</div>
              ${teamHTML(c.awayId, 'a')}
            </div>`;
          }).join('')}
        </div>`).join('')
      : `<div class="cs-empty"><i class="ri-calendar-check-line" style="font-size:2rem;display:block;margin-bottom:.5rem;"></i>Non ci sono partite ancora da giocare.</div>`;

    el.innerHTML = `
      <div class="cs-head"><i class="ri-magic-line" style="color:var(--accent);font-size:1.2rem;"></i><b>Simula giornate</b>
        <button class="cs-x" data-act="close" aria-label="Chiudi"><i class="ri-close-line"></i></button></div>
      ${giornate.length ? `
      <div class="cs-bar">Giornate avanti
        <div class="cs-step"><button data-act="minus" ${sim.n <= 1 ? 'disabled' : ''} aria-label="Meno">−</button><span>${sim.n}</span><button data-act="plus" ${sim.n >= giornate.length ? 'disabled' : ''} aria-label="Più">+</button></div>
        <span class="cs-sub" id="cs-count">${contaScelte()}/${contaPartite()} risultati scelti · le partite senza scelta non contano</span>
      </div>` : ''}
      <div class="cs-body">${body}</div>
      <div class="cs-foot">
        ${giornate.length ? `<button class="btn btn-outline" data-act="reset"><i class="ri-delete-bin-line"></i> Azzera</button>
        <button class="btn btn-outline" data-act="random"><i class="ri-shuffle-line"></i> Casuale</button>` : ''}
        <button class="btn btn-green" data-act="apply"><i class="ri-bar-chart-2-line"></i> Classifica</button>
      </div>`;
  };

  const updateCount = () => {
    const c = el.querySelector('#cs-count');
    if (c) c.textContent = `${contaScelte()}/${contaPartite()} risultati scelti · le partite senza scelta non contano`;
  };

  const close = () => { el.remove(); };
  const closeByUser = () => { close(); BackNav.pop('cls-sim'); };

  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'close') return closeByUser();
    if (act === 'apply') { closeByUser(); onApply && onApply(); return; }
    if (act === 'minus' || act === 'plus') {
      sim.n = Math.max(1, Math.min(giornate.length, sim.n + (act === 'plus' ? 1 : -1)));
      const scroll = el.querySelector('.cs-body')?.scrollTop || 0;
      draw();
      const nb = el.querySelector('.cs-body'); if (nb) nb.scrollTop = scroll;
      onChange && onChange();
      return;
    }
    if (act === 'reset' || act === 'random') {
      visibili().forEach(g => g.couples.forEach(c => setPick(g.gwKey, c.key, act === 'random' ? ESITI[Math.floor(Math.random() * 3)] : '')));
    } else if (b.dataset.all !== undefined) {
      const g = giornate.find(x => x.gwKey === b.dataset.all);
      if (g) g.couples.forEach(c => setPick(g.gwKey, c.key, b.dataset.v));
    } else if (b.dataset.gw !== undefined) {
      const cur = sim.picks[b.dataset.gw]?.[b.dataset.key];
      setPick(b.dataset.gw, b.dataset.key, cur === b.dataset.v ? '' : b.dataset.v); // ritocco = togli la scelta
    } else return;
    // aggiorna solo i pulsanti, senza ridisegnare (resta la posizione dello scorrimento)
    el.querySelectorAll('.cs-p button').forEach(x => {
      x.classList.toggle('on', sim.picks[x.dataset.gw]?.[x.dataset.key] === x.dataset.v);
    });
    updateCount();
    onChange && onChange();
  });

  draw();
  BackNav.push('cls-sim', close);
}
