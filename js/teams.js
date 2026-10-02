export const TeamsPage = {
  // Struttura HTML unificata: Lista -> Dettaglio Rosa -> Modal Info Club
  renderHTML() {
    return `
      <div class="page" id="page-teams">
        
        <div id="teams-list-view">
          <div class="sec" style="margin-top:1.2rem">
            <svg viewBox="0 0 24 24" style="width:20px; height:20px; stroke:currentColor; stroke-width:2; fill:none; stroke-linecap:round; stroke-linejoin:round; display:inline-block; vertical-align:middle; margin-right:4px;">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            Squadre della Lega
          </div>
          
          <div id="teams-grid-container" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(100%, 1fr)); gap:1rem; margin-top:.5rem;">
            <div style="text-align:center; color:var(--text2); padding:2rem;">Caricamento squadre...</div>
          </div>
        </div>

        <div id="team-detail-view" style="display:none; margin-top:1.2rem; animation: fadeIn 0.25s ease-out;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; gap:1rem;">
            <button class="btn btn-outline" onclick="window.backToTeamsList()" style="width:auto; padding:.5rem 1rem; font-size:.8rem; display:inline-flex; align-items:center; gap:.4rem; margin:0;">
              <svg viewBox="0 0 24 24" style="width:16px; height:16px; stroke:currentColor; stroke-width:2; fill:none;"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              Lista
            </button>
            
            <h2 id="team-detail-title" style="font-family:'Bebas Neue',sans-serif; font-size:1.6rem; color:var(--text); flex:1; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin:0;">Rosa</h2>
            
            <button class="btn btn-green" id="btn-info-club" style="width:auto; padding:.5rem 1rem; font-size:.8rem; display:inline-flex; align-items:center; gap:.4rem; margin:0;">
              Info Club
            </button>
          </div>
          
          <div id="team-roster-container"></div>
        </div>

        <div id="club-info-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(10,15,30,0.85); backdrop-filter:blur(8px); z-index:2000; padding:2rem 1.5rem; box-sizing:border-box; align-items:center; justify-content:center;">
          <div class="card" style="width:100%; max-width:450px; max-height:85vh; overflow-y:auto; position:relative; background:var(--card); border:1px solid rgba(255,255,255,0.1); animation: fadeIn 0.2s ease-out;">
            <button class="btn btn-outline" id="close-info-modal" style="position:absolute; top:1rem; right:1rem; width:auto; padding:.4rem .6rem; font-size:.75rem;">Chiudi</button>
            <div id="club-info-content" style="margin-top:1.5rem;"></div>
          </div>
        </div>

      </div>
    `;
  },

  // Renderizza la griglia delle squadre
  render(STATE) {
    window.openTeamDetail = (teamId) => this.openTeamDetail(teamId, STATE);
    window.backToTeamsList = () => this.backToTeamsList();

    const container = document.getElementById('teams-grid-container');
    if (!container) return;

    if (!STATE.teams || STATE.teams.length === 0) {
      container.innerHTML = `<div style="text-align:center; color:var(--text2); padding:2rem;">Nessuna squadra nel database.</div>`;
      return;
    }

    const sortedTeams = [...STATE.teams].sort((a, b) => a.name.localeCompare(b.name));

    container.innerHTML = sortedTeams.map(t => {
      const logoUrl = t.logo || 'icons/icon-192.png';

      return `
        <div class="card" onclick="window.openTeamDetail('${t.id}')" style="display:flex; align-items:center; gap:1.25rem; padding:1rem; background:var(--card); cursor:pointer; transition:transform 0.15s, background-color 0.15s;">
          <div style="width:52px; height:52px; flex-shrink:0; background:var(--bg2); border-radius:12px; border:1px solid rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; overflow:hidden;">
            <img src="${logoUrl}" alt="Logo ${t.name}" loading="lazy" decoding="async" style="width:100%; height:100%; object-fit:contain;" onerror="this.src='icons/icon-192.png'">
          </div>
          <div style="flex:1; min-width:0;">
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <h3 style="font-size:1.1rem; font-weight:600; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin:0;">${t.name}</h3>
            </div>
            <p style="font-size:.72rem; color:var(--text2); margin-top:2px;">Proprietario: <span style="color:var(--accent); font-weight:500;">${t.owner || 'Nessuno'}</span></p>
          </div>
          <svg viewBox="0 0 24 24" style="width:18px; height:18px; stroke:var(--text3); stroke-width:2; fill:none;"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
      `;
    }).join('');

    if(document.getElementById('team-detail-view')?.style.display === 'block' && this.activeTeamId) {
      this.drawRosa(this.activeTeamId, STATE);
    }
  },

  openTeamDetail(teamId, STATE) {
    this.activeTeamId = teamId;
    const listView = document.getElementById('teams-list-view');
    const detailView = document.getElementById('team-detail-view');
    const titleView = document.getElementById('team-detail-title');
    const btnInfo = document.getElementById('btn-info-club');

    if (!listView || !detailView) return;

    const team = STATE.teams.find(t => t.id === teamId);
    if (!team) return;

    if (titleView) titleView.innerHTML = `${team.name}`;

    if (btnInfo) {
      btnInfo.onclick = () => this.openInfoModal(team, STATE);
    }

    this.drawRosa(teamId, STATE);

    listView.style.display = 'none';
    detailView.style.display = 'block';

    const pageContainer = document.getElementById('dynamic-pages-container');
    if (pageContainer) pageContainer.scrollTop = 0;
  },

  // Generazione della Rosa
  drawRosa(teamId, STATE) {
    const container = document.getElementById('team-roster-container');
    if (!container) return;

    const roster = STATE.players.filter(p => p.teamId === teamId);
    if (roster.length === 0) {
      container.innerHTML = `<div style="color:var(--text3);text-align:center;padding:2rem;font-size:.85rem">Rosa vuota.</div>`;
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
        const v = STATE.votes[p.id];
        const mvHtml = v ? `<span class="mv-badge ${v>=7?'mv-up':'mv-dn'}">${v.toFixed(1)}</span>` : '';

        const photoUrl = p.photoPersonal || p.photoStandard || '';
        const imgHtml = photoUrl
          ? `<img src="${photoUrl}" alt="${p.name}" loading="lazy" decoding="async" style="width:28px; height:28px; object-fit:contain; border-radius:4px; flex-shrink:0;">`
          : `<div style="width:28px; height:28px; background:var(--bg3); display:flex; align-items:center; justify-content:center; border-radius:4px; font-size:0.7rem; color:var(--text3); flex-shrink:0;"><i class="ri-user-3-line"></i></div>`;

        return `
          <div class="pcard" style="display:flex; align-items:center; gap:0.6rem;">
            <div class="rbadge r${p.role}" style="width:24px;height:24px;font-size:.6rem;border-radius:5px;flex-shrink:0;">${p.role}</div>
            ${imgHtml}
            <div class="pi" style="flex:1; min-width:0;">
              <div class="pn" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}${mvHtml}</div>
              <div class="pm">${p.club}</div>
            </div>
            <div class="pr" style="text-align:right; flex-shrink:0;">
              <div class="price">${p.price||0}M</div>
              <div class="pavg">Mv ${(p.avg||6).toFixed(1)}</div>
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

    const logoUrl = team.logo || 'icons/icon-192.png';
    const mottoText = team.motto ? `"${team.motto}"` : 'Nessun motto impostato';
    const descriptionText = team.description || 'Nessuna descrizione o storia inserita per questa fanta-squadra.';

    // 1. Recupero dinamico dei trofei dal nodo Firebase
    const rawTrophies = STATE.trophies || window.TROPHIES || [];
    const allTrophies = Array.isArray(rawTrophies)
      ? rawTrophies
      : Object.entries(rawTrophies).map(([k, v]) => (typeof v === 'object' ? { id: k, ...v } : { id: k, name: v }));

    const trophiesMap = Object.fromEntries(allTrophies.map(t => [t.id, t]));

    const competitionsList = Array.isArray(STATE.competitions)
      ? STATE.competitions
      : Object.values(STATE.competitions || {});
    const compMap = Object.fromEntries(competitionsList.map(c => [c.id, c]));

    // 2. Estrazione dei trofei vinti dal Palmarès della squadra
    let wonTrophies = [];

    if (team.palmares) {
      Object.entries(team.palmares).forEach(([season, seasonComps]) => {
        if (seasonComps && typeof seasonComps === 'object') {
          Object.entries(seasonComps).forEach(([compId, item]) => {
            if (item && item.trofeo_vinto) {
              const trophyId = typeof item.trofeo_vinto === 'string'
                ? item.trofeo_vinto
                : (compMap[compId]?.trophyId || compId);

              const trophyObj = trophiesMap[trophyId];
              const trophyName = trophyObj?.name || compMap[compId]?.name || trophyId;
              const trophyImage = trophyObj?.image || trophyObj?.img || trophyObj?.url || '';

              wonTrophies.push({
                trophyId,
                season,
                name: trophyName,
                image: trophyImage
              });
            }
          });
        }
      });
    }

    // Fallback retrocompatibile per strutture legacy in team.trophies
    if (wonTrophies.length === 0 && team.trophies && Array.isArray(team.trophies) && team.trophies.length > 0) {
      wonTrophies = team.trophies.map(tr => ({
        trophyId: tr.id || 'trophy',
        season: tr.year || '—',
        name: tr.title || tr.name || 'Trofeo',
        image: tr.image || tr.img || ''
      }));
    }

    // 3. Generazione HTML del Palmarès con immagini ed icone
    let trophiesHTML = `<div style="color:var(--text2); font-size:.85rem; font-style:italic;">Bacheca vuota. Nessun trofeo vinto finora.</div>`;

    if (wonTrophies.length > 0) {
      trophiesHTML = `
        <div style="display:flex; flex-direction:column; gap:.5rem;">
          ${wonTrophies.map(tr => {
            const imgHtml = tr.image
              ? `<img src="${tr.image}" alt="${tr.name}" style="width:40px; height:40px; object-fit:contain; vertical-align:middle; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));" onerror="this.outerHTML='<span style=\\'font-size:1.5rem\\'>🏆</span>'">`
              : `<span style="font-size:1.5rem">🏆</span>`;

            return `
              <div style="background:var(--bg3); border:1px solid rgba(255,255,255,0.06); padding:.6rem .8rem; border-radius:10px; display:flex; align-items:center; gap:.8rem;">
                <div style="width:42px; height:42px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                  ${imgHtml}
                </div>
                <div style="text-align:left; flex:1; min-width:0;">
                  <div style="font-size:.9rem; font-weight:600; color:var(--gold); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${tr.name}</div>
                  <div style="font-size:.75rem; color:var(--text2);">Stagione: <strong style="color:var(--text);">${tr.season}</strong></div>
                </div>
                <div style="background:rgba(245,166,35,0.15); color:var(--gold); font-size:.7rem; font-weight:600; padding:.2rem .5rem; border-radius:6px; flex-shrink:0;">
                  🏆 Vinto
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    content.innerHTML = `
      <div style="text-align:center; margin-bottom:1.5rem;">
        <div style="width:90px; height:90px; background:var(--bg2); border-radius:20px; border:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; overflow:hidden; margin:0 auto 1rem auto;">
          <img src="${logoUrl}" alt="Logo XL" loading="lazy" decoding="async" style="width:100%; height:100%; object-fit:contain;" onerror="this.src='icons/icon-192.png'">
        </div>
        <h2 style="font-family:'Bebas Neue',sans-serif; font-size:2rem; color:var(--text); margin-bottom:0.2rem;">
          ${team.name}
        </h2>
        <div style="font-size:.75rem; text-transform:uppercase; color:var(--text2);">
          Allenatore: <span style="color:var(--text); font-weight:500;">${team.owner || 'Senza Proprietario'}</span>
        </div>
        <p style="font-size:.85rem; color:var(--accent); font-style:italic; margin-top:0.5rem;">
          ${mottoText}
        </p>
      </div>

      <div class="card" style="margin-bottom:1rem; background:var(--card); text-align:left;">
        <div class="label">Storia del Club & Descrizione</div>
        <p style="font-size:.85rem; color:var(--text); line-height:1.4; margin-top:.4rem; white-space:pre-line;">
          ${descriptionText}
        </p>
      </div>

      <div class="card" style="background:var(--card); text-align:left;">
        <div class="label" style="color:var(--gold)">Palmarès & Coppe Vinte</div>
        <div style="margin-top:.6rem;">
          ${trophiesHTML}
        </div>
      </div>
    `;

    modal.style.display = 'flex';
    closeBtn.onclick = () => { modal.style.display = 'none'; };
  },

  backToTeamsList() {
    this.activeTeamId = null;
    const listView = document.getElementById('teams-list-view');
    const detailView = document.getElementById('team-detail-view');
    if (listView && detailView) {
      detailView.style.display = 'none';
      listView.style.display = 'block';
    }
  }
};
