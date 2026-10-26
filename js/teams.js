import { BackNav } from './services/backNav.js';
import { mountKitShowcase, kitPairHTML, kitPairShown, openKitOverlay } from './components/Kit3D.js';
import { renderStadiumImage, openStadiumOverlay } from './components/Stadium3D.js';
import { getWonTrophies } from './services/palmaresService.js';
import { esc, sameId } from './utils.js';

// riquadri sopra la rosa (maglie e stadio), come quelli della Home
const BOX = 'background: var(--subbox-bg, rgba(0,0,0,0.18)); border: 1px solid var(--border); border-radius: 14px; padding: 0.6rem 0.7rem; min-width: 0;';
const BOX_LABEL = 'display: flex; align-items: center; justify-content: space-between; gap: .3rem; font-size: 0.7rem; font-weight: 700; color: var(--text2); font-family: var(--font-sub, inherit); text-transform: uppercase; margin-bottom: 0.3rem;';
const ZOOM_HINT = '<i class="ri-zoom-in-line" style="font-size: .9rem; color: var(--accent);" aria-hidden="true"></i>';

/* Nome della squadra nella testata: mai tagliato. Si rimpicciolisce (da 26px a 16px) per stare
   su una riga; se non basta, alla misura minima va a capo. */
function fitTitle(el) {
  if (!el || !el.clientWidth) return;
  let size = 26;
  el.style.whiteSpace = 'nowrap';
  el.style.fontSize = size + 'px';
  while (el.scrollWidth > el.clientWidth && size > 16) el.style.fontSize = --size + 'px';
  if (el.scrollWidth > el.clientWidth) el.style.whiteSpace = 'normal';
}

export const TeamsPage = {
  // Struttura HTML unificata: Lista -> Dettaglio Rosa -> Modal Info Club
  renderHTML() {
    return `
      <div class="page" id="page-teams">
        
        <div id="teams-list-view">
          <div id="teams-grid-container" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(100%, 1fr)); gap:.6rem;">
            <div style="text-align:center; color:var(--text2);font-family:var(--font-sub,inherit); padding:2rem;">Caricamento squadre...</div>
          </div>
        </div>

        <div id="team-detail-view" style="display:none; animation: fadeIn 0.25s ease-out;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; gap:1rem;">
            <button class="btn btn-outline" onclick="window.teamDetailBack()" style="width:auto; padding:.5rem 1rem; font-size:.8rem; display:inline-flex; align-items:center; gap:.4rem; margin:0;">
              <svg viewBox="0 0 24 24" style="width:16px; height:16px; stroke:currentColor; stroke-width:2; fill:none;"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              <span id="team-detail-back-label">Lista</span>
            </button>
            
            <h2 id="team-detail-title" style="font-family:'Bebas Neue',sans-serif; font-size:1.6rem; line-height:1.05; color:var(--text); flex:1; min-width:0; text-align:center; overflow-wrap:anywhere; margin:0;">Rosa</h2>
            
            <button class="btn btn-green" id="btn-info-club" style="width:auto; padding:.5rem 1rem; font-size:.8rem; display:inline-flex; align-items:center; gap:.4rem; margin:0;">
              Info Club
            </button>
          </div>
          
          <div id="team-detail-boxes"></div>
          <div id="team-roster-container"></div>
        </div>

        <div id="club-info-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:var(--overlay-bg, rgba(10,15,30,0.85)); backdrop-filter:blur(8px); z-index:2000; padding:2rem 1.5rem; box-sizing:border-box; align-items:center; justify-content:center;">
          <div class="card" style="width:100%; max-width:450px; max-height:85vh; overflow-y:auto; position:relative; background:var(--card); border:1px solid var(--border); animation: fadeIn 0.2s ease-out;">
            <button class="btn btn-outline" id="close-info-modal" style="position:absolute; top:1rem; right:1rem; width:auto; padding:.4rem .6rem; font-size:.75rem;">Chiudi</button>
            <div id="club-info-content" style="margin-top:1.5rem;"></div>
          </div>
        </div>

      </div>
    `;
  },

  render(STATE) {
    window.openTeamDetail = (teamId) => this.openTeamDetail(teamId, STATE);
    window.backToTeamsList = () => this.backToTeamsList();
    // Freccia "indietro" della scheda squadra: torna alla pagina da cui si è arrivati (es. classifica)
    window.teamDetailBack = () => {
      const from = this.returnTo;
      this.backToTeamsList();
      if (from === 'classifica' || from === 'home') {
        window.goPage(from);
      }
    };

    const container = document.getElementById('teams-grid-container');
    if (!container) return;

    if (!STATE.teams || STATE.teams.length === 0) {
      container.innerHTML = `<div style="text-align:center; color:var(--text2);font-family:var(--font-sub,inherit); padding:2rem;">Nessuna squadra nel database.</div>`;
      return;
    }

    // la propria squadra in cima, le altre in ordine alfabetico
    const myId = STATE.user && STATE.user.id;
    const isMine = (t) => sameId(t.id, myId);
    const sortedTeams = [...STATE.teams].sort((a, b) => (isMine(b) - isMine(a)) || String(a.name || '').localeCompare(String(b.name || '')));

    container.innerHTML = sortedTeams.map(t => {
      const logoUrl = esc(t.logo || 'icons/icon-192.png');
      const mineTag = isMine(t) ? `<span style="flex-shrink:0; font-size:.6rem; font-weight:700; letter-spacing:.3px; text-transform:uppercase; color:var(--accent); border:1px solid color-mix(in srgb, var(--accent) 50%, transparent); border-radius:6px; padding:0 .4rem;">La tua</span>` : '';

      return `
        <div class="card card-mini" data-team-id="${esc(t.id)}" onclick="window.openTeamDetail(this.dataset.teamId)" style="display:flex; align-items:center; gap:1.25rem; padding:.5rem; margin-bottom:0; background:var(--mini-bg,var(--card)); border-color:var(--border); cursor:pointer; transition:transform 0.15s, background-color 0.15s;">
          <img src="${logoUrl}" alt="Logo ${esc(t.name)}" loading="lazy" decoding="async" style="width:52px; height:52px; flex-shrink:0; object-fit:contain;" onerror="this.src='icons/icon-192.png'">
          <div style="flex:1; min-width:0;">
            <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
              <h3 style="font-size:1.1rem; font-weight:600; color:var(--text); overflow-wrap:anywhere; margin:0; line-height:1.2;">${esc(t.name)}</h3>
              ${mineTag}
            </div>
            <p style="font-size:.72rem; color:var(--text2);font-family:var(--font-sub,inherit); margin-top:2px;">Proprietario: <span style="color:var(--accent); font-weight:500;">${esc(t.owner || 'Nessuno')}</span></p>
          </div>
          <svg viewBox="0 0 24 24" style="width:18px; height:18px; stroke:var(--text3); stroke-width:2; fill:none;"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
      `;
    }).join('');

    if(document.getElementById('team-detail-view')?.style.display === 'block' && this.activeTeamId) {
      const active = STATE.teams.find(t => sameId(t.id, this.activeTeamId));
      if (active) this.drawBoxes(active);
      this.drawRosa(this.activeTeamId, STATE);
    }
  },

  openTeamDetail(teamId, STATE, opts = {}) {
    // Il click arriva da attributi HTML (stringhe): si risale alla squadra con confronto tra stringhe
    const found = (STATE.teams || []).find(t => String(t.id) === String(teamId));
    if (found) teamId = found.id;
    this.activeTeamId = teamId;
    this.returnTo = opts.from || null;
    const backLabel = document.getElementById('team-detail-back-label');
    if (backLabel) backLabel.textContent = { classifica: 'Classifica', home: 'Home' }[this.returnTo] || 'Lista';
    const listView = document.getElementById('teams-list-view');
    const detailView = document.getElementById('team-detail-view');
    const titleView = document.getElementById('team-detail-title');
    const btnInfo = document.getElementById('btn-info-club');

    if (!listView || !detailView) return;

    const team = STATE.teams.find(t => sameId(t.id, teamId));
    if (!team) return;

    if (titleView) titleView.textContent = team.name || '';

    if (btnInfo) {
      btnInfo.onclick = () => this.openInfoModal(team, STATE);
    }

    this.drawBoxes(team);
    this.drawRosa(teamId, STATE);

    listView.style.display = 'none';
    detailView.style.display = 'block';
    fitTitle(titleView);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitTitle(titleView));
    // "Indietro" del telefono = freccia indietro della scheda
    BackNav.push('team-detail', () => (window.teamDetailBack ? window.teamDetailBack() : this.backToTeamsList()));

    const pageContainer = document.getElementById('dynamic-pages-container');
    if (pageContainer) pageContainer.scrollTop = 0;

    if (opts.info) this.openInfoModal(team, STATE);
  },

  /**
   * Maglie (prima e seconda, come in Home) e stadio della squadra, sopra la rosa.
   * Toccando la maglia mostrata in grande (o lo stadio) si apre lo zoom 3D; la maglia piccola le scambia.
   */
  drawBoxes(team) {
    const box = document.getElementById('team-detail-boxes');
    if (!box) return;
    this._boxTeam = team;
    if (!box.dataset.bound) {
      box.dataset.bound = '1';
      const open = (e) => {
        const t = this._boxTeam;
        if (!t) return;
        if (e.target.closest('[data-zoom="kit"]')) this.openKitZoom(t, kitPairShown(box));
        else if (e.target.closest('[data-zoom="stadium"]')) this.openStadiumZoom(t);
      };
      box.addEventListener('click', open);
      box.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e); } });
    }
    const st = team.stadium;
    const hasKit = !!(team.kit || team.kit2);
    // si ridisegna solo se cambiano maglie, logo o stadio (i refresh dei dati sono frequenti)
    const key = JSON.stringify([team.id, team.kit || null, team.kit2 || null, team.logo || '', st || null]);
    if (box.dataset.key === key) return;
    box.dataset.key = key;
    if (!hasKit && !st) { box.innerHTML = ''; return; }

    const kitBox = hasKit ? `
      <div data-zoom="kit" role="button" tabindex="0" aria-label="Ingrandisci la maglia" style="${BOX} display:flex; flex-direction:column; cursor:pointer;">
        <div style="${BOX_LABEL}">${team.kit && team.kit2 ? 'Maglie' : 'Maglia'} ${ZOOM_HINT}</div>
        <div style="flex:1; display:flex; align-items:center; justify-content:center;">
          ${kitPairHTML(team.kit, team.kit2, { crestUrl: team.logo || '', width: 360 }, `style="width:100%; max-width:${team.kit && team.kit2 ? 190 : 150}px; margin:0 auto;"`)}
        </div>
      </div>` : '';
    const stadiumBox = st ? `
      <div data-zoom="stadium" role="button" tabindex="0" aria-label="Ingrandisci lo stadio" style="${BOX} display:flex; flex-direction:column; cursor:pointer;">
        <div style="${BOX_LABEL}">Stadio ${ZOOM_HINT}</div>
        <div style="flex:1; display:flex; flex-direction:column; justify-content:center; gap:.3rem;">
          <div class="td-stadium" style="width:100%; aspect-ratio:5 / 3; display:flex; align-items:center; justify-content:center;">
            ${st.image ? `<img src="${esc(st.image)}" alt="Stadio" loading="lazy" decoding="async" style="width:100%; height:100%; object-fit:contain;">` : '<i class="ri-building-2-line" style="font-size:2.4rem; color:var(--text3);"></i>'}
          </div>
          <div style="font-size:.8rem; font-weight:700; color:var(--text); text-align:center; overflow-wrap:anywhere;">${esc(st.name || 'Stadio senza nome')}</div>
          ${st.capacity ? `<div style="font-size:.68rem; color:var(--text2); font-family:var(--font-sub, inherit); text-align:center;">${Number(st.capacity).toLocaleString('it-IT')} posti</div>` : ''}
        </div>
      </div>` : '';
    box.innerHTML = `<div style="display:grid; grid-template-columns:${hasKit && st ? '1fr 1fr' : '1fr'}; gap:.6rem; margin-bottom:.4rem;">${kitBox}${stadiumBox}</div>`;

    // stadio salvato senza foto (caricamento non riuscito): la disegno qui, come in Home
    if (st && !st.image) {
      renderStadiumImage(st, { width: 600, logo: team.logo || '' }).then(url => {
        const ph = box.querySelector('.td-stadium');
        if (url && ph && box.dataset.key === key) ph.innerHTML = `<img src="${url}" alt="Stadio" style="width:100%; height:100%; object-fit:contain;">`;
      });
    }
  },

  /** Zoom 3D delle maglie, a partire da quella mostrata in grande (1 o 2) */
  openKitZoom(team, shown = 1) {
    const items = [
      team.kit && { kit: team.kit, label: 'Prima maglia', title: `${team.name || ''} · Prima maglia`, crestUrl: team.logo || '' },
      team.kit2 && { kit: team.kit2, label: 'Seconda maglia', title: `${team.name || ''} · Seconda maglia`, crestUrl: team.logo || '' }
    ].filter(Boolean);
    if (!items.length) return;
    this._closeZoom();
    const start = team.kit && team.kit2 && shown === 2 ? 1 : 0;
    this._zoom = openKitOverlay(items, start, { onClose: () => { this._zoom = null; BackNav.pop('team-zoom'); } });
    BackNav.push('team-zoom', () => this._closeZoom());
  },

  /** Zoom 3D dello stadio (come nell'editor: inquadrature, notte, zoom) */
  openStadiumZoom(team) {
    if (!team.stadium) return;
    this._closeZoom();
    this._zoom = openStadiumOverlay(team.stadium, { logo: team.logo || '', onClose: () => { this._zoom = null; BackNav.pop('team-zoom'); } });
    BackNav.push('team-zoom', () => this._closeZoom());
  },

  _closeZoom() {
    if (this._zoom) this._zoom.close();
  },

  drawRosa(teamId, STATE) {
    const container = document.getElementById('team-roster-container');
    if (!container) return;

    const roster = (STATE.players || []).filter(p => p && sameId(p.teamId, teamId));
    if (roster.length === 0) {
      container.innerHTML = `<div style="color:var(--text3);font-family:var(--font-text3,inherit);text-align:center;padding:2rem;font-size:.85rem">Rosa vuota.</div>`;
      return;
    }

    const roles = {'P':[], 'D':[], 'C':[], 'A':[]};
    roster.forEach(p => { if(roles[p.role]) roles[p.role].push(p); });

    let html = '';
    const names = {'P':'Portieri', 'D':'Difensori', 'C':'Centrocampisti', 'A':'Attaccanti'};
    
    Object.keys(roles).forEach(rk => {
      if(roles[rk].length === 0) return;
      html += `<div class="label" style="margin: 1rem 0 .4rem;">${names[rk]} (${roles[rk].length})</div>`;
      html += roles[rk].sort((a,b)=>(b.price||0)-(a.price||0)).map(p => {
        const photoUrl = p.photoPersonal || p.photoStandard || '';
        const imgHtml = photoUrl
          ? `<img src="${esc(photoUrl)}" alt="${esc(p.name)}" loading="lazy" decoding="async" style="width:28px; height:28px; object-fit:contain; border-radius:4px; flex-shrink:0;">`
          : `<div style="width:28px; height:28px; background:var(--bg3); display:flex; align-items:center; justify-content:center; border-radius:4px; font-size:0.7rem; color:var(--text3);font-family:var(--font-text3,inherit); flex-shrink:0;"><i class="ri-user-3-line"></i></div>`;

        return `
          <div class="pcard" data-player-id="${esc(p.id)}" style="display:flex; align-items:center; gap:0.6rem; cursor:pointer;">
            <div class="rbadge r${p.role}" style="width:24px;height:24px;font-size:.6rem;border-radius:5px;flex-shrink:0;">${p.role}</div>
            ${imgHtml}
            <div class="pi" style="flex:1; min-width:0;">
              <div class="pn" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(p.name)}</div>
              <div class="pm">${esc(p.club || '')}</div>
            </div>
            <div class="pr" style="text-align:right; flex-shrink:0;">
              <div class="price">${Number(p.price) || 0}M</div>
              <div class="pavg">Mv ${(Number(p.avg) || 6).toFixed(1)}</div>
            </div>
          </div>
        `;
      }).join('');
    });
    
    container.innerHTML = html;
  },

  openInfoModal(team, STATE = {}) {
    const modal = document.getElementById('club-info-modal');
    const content = document.getElementById('club-info-content');
    const closeBtn = document.getElementById('close-info-modal');
    if (!modal || !content) return;

    const logoUrl = esc(team.logo || 'icons/icon-192.png');
    const mottoText = team.motto ? `"${esc(team.motto)}"` : 'Nessun motto impostato';
    const descriptionText = esc(team.desc || team.description || 'Nessuna descrizione o storia inserita per questa fanta-squadra.');

    const wonTrophies = getWonTrophies(team, STATE.trophies, STATE.competitions);

    let trophiesHTML = `<div style="color:var(--text2);font-family:var(--font-sub,inherit); font-size:.85rem; font-style:italic;">Bacheca vuota. Nessun trofeo vinto finora.</div>`;

    if (wonTrophies.length > 0) {
      trophiesHTML = `
        <div style="display:flex; flex-direction:column; gap:.5rem;">
          ${wonTrophies.map(tr => {
            // Calcolo dimensione percentuale (dimensione base 42px)
            const sizePx = Math.round(42 * (tr.scale / 100));

            const imgHtml = tr.image
              ? `<img src="${esc(tr.image)}" alt="${esc(tr.name)}" style="width:${sizePx}px; height:${sizePx}px; object-fit:contain; vertical-align:middle; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));" onerror="this.outerHTML='<i class=\\'ri-trophy-fill\\' style=\\'font-size:1.5rem;color:var(--gold)\\'></i>'">`
              : `<i class="ri-trophy-fill" style="font-size:1.5rem;color:var(--gold)"></i>`;

            return `
              <div style="background:var(--bg3); border:1px solid var(--border); padding:.6rem .8rem; border-radius:10px; display:flex; align-items:center; gap:.8rem;">
                <div style="width:50px; height:50px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                  ${imgHtml}
                </div>
                <div style="text-align:left; flex:1; min-width:0;">
                  <div style="font-size:.9rem; font-weight:600; color:var(--gold); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(tr.name)}</div>
                  <div style="font-size:.75rem; color:var(--text2);font-family:var(--font-sub,inherit);">Stagione: <strong style="color:var(--text);">${esc(tr.season)}</strong></div>
                </div>
                <div style="background:rgba(245,166,35,0.15); color:var(--gold); font-size:.7rem; font-weight:600; padding:.2rem .5rem; border-radius:6px; flex-shrink:0;">
                  <i class="ri-trophy-fill"></i> Vinto
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    content.innerHTML = `
      <div style="text-align:center; margin-bottom:1.5rem;">
        <img src="${logoUrl}" alt="Logo XL" loading="lazy" decoding="async" style="width:90px; height:90px; object-fit:contain; display:block; margin:0 auto 1rem auto;" onerror="this.src='icons/icon-192.png'">
        <h2 style="font-family:'Bebas Neue',sans-serif; font-size:2rem; color:var(--text); margin-bottom:0.2rem;">
          ${esc(team.name)}
        </h2>
        <div style="font-size:.75rem; text-transform:uppercase; color:var(--text2);font-family:var(--font-sub,inherit);">
          Allenatore: <span style="color:var(--text); font-weight:500;">${esc(team.owner || 'Senza Proprietario')}</span>
        </div>
        <p style="font-size:.85rem; color:var(--accent); font-style:italic; margin-top:0.5rem;">
          ${mottoText}
        </p>
      </div>

      ${team.kit || team.kit2 ? `
      <div class="card" style="margin-bottom:1rem; background:var(--card); text-align:left;">
        <div class="label">${team.kit && team.kit2 ? 'Divise' : 'Divisa'}</div>
        <div id="club-info-kit" style="margin-top:.4rem;"></div>
        <div style="font-size:.68rem; color:var(--text3); font-family:var(--font-text3, inherit); text-align:center; margin-top:.3rem;"><i class="ri-drag-move-line"></i> Trascina per ruotare, due dita per lo zoom</div>
      </div>` : ''}

      ${team.stadium && team.stadium.image ? `
      <div class="card" style="margin-bottom:1rem; background:var(--card); text-align:left;">
        <div class="label">Stadio</div>
        <img src="${esc(team.stadium.image)}" alt="Stadio" loading="lazy" decoding="async" style="width:100%; display:block; margin-top:.4rem;">
        <div style="text-align:center; font-size:.85rem; color:var(--text); font-weight:600;">${esc(team.stadium.name || '')}</div>
        ${team.stadium.capacity ? `<div style="text-align:center; font-size:.72rem; color:var(--text2); font-family:var(--font-sub, inherit);">${Number(team.stadium.capacity).toLocaleString('it-IT')} posti</div>` : ''}
      </div>` : ''}

      <div class="card" style="margin-bottom:1rem; background:var(--card); text-align:left;">
        <div class="label">Storia del club</div>
        <p style="font-size:.85rem; color:var(--text); line-height:1.4; margin-top:.4rem; white-space:pre-line;">
          ${descriptionText}
        </p>
      </div>

      <div class="card" style="background:var(--card); text-align:left;">
        <div class="label" style="color:var(--gold)">Palmarès</div>
        <div style="margin-top:.6rem;">
          ${trophiesHTML}
        </div>
      </div>
    `;

    modal.style.display = 'flex';
    // maglie in 3D (ruotabili e ingrandibili): il contesto WebGL si libera alla chiusura
    if (this._kitShow) this._kitShow.dispose();
    this._kitShow = mountKitShowcase(content.querySelector('#club-info-kit'), team.kit, team.kit2, { crestUrl: team.logo || '' });
    const hide = () => {
      modal.style.display = 'none';
      if (this._kitShow) { this._kitShow.dispose(); this._kitShow = null; }
    };
    const closeInfo = () => { hide(); BackNav.pop('club-info'); };
    closeBtn.onclick = closeInfo;
    BackNav.push('club-info', hide);
  },

  backToTeamsList() {
    this._closeZoom();
    BackNav.pop('team-detail');
    this.activeTeamId = null;
    this.returnTo = null;
    const listView = document.getElementById('teams-list-view');
    const detailView = document.getElementById('team-detail-view');
    if (listView && detailView) {
      detailView.style.display = 'none';
      listView.style.display = 'block';
    }
  }
};
