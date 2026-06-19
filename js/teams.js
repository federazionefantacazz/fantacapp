export const TeamsPage = {
  // Configurazione iniziale della pagina con le due sotto-viste (Lista e Dettaglio)
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
          <button class="btn btn-outline" onclick="window.backToTeamsList()" style="width:auto; padding:.5rem 1rem; font-size:.8rem; margin-bottom:1.5rem; display:inline-flex; align-items:center; gap:.4rem;">
            <svg viewBox="0 0 24 24" style="width:16px; height:16px; stroke:currentColor; stroke-width:2; fill:none;"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            Torna alla lista
          </button>
          
          <div id="team-detail-content"></div>
        </div>

      </div>
    `;
  },

  // Renderizza i dati dello stato globale
  render(STATE) {
    // Esponiamo i metodi di navigazione della pagina all'oggetto window
    window.openTeamDetail = (teamId) => this.openTeamDetail(teamId, STATE);
    window.backToTeamsList = () => this.backToTeamsList();

    const container = document.getElementById('teams-grid-container');
    if (!container) return;

    if (!STATE.teams || STATE.teams.length === 0) {
      container.innerHTML = `<div style="text-align:center; color:var(--text2); padding:2rem;">Nessuna squadra nel database.</div>`;
      return;
    }

    const sortedTeams = [...STATE.teams].sort((a, b) => a.name.localeCompare(b.name));

    // Genera la lista principale con informazioni essenziali: Logo e Nome
    container.innerHTML = sortedTeams.map(t => {
      const logoUrl = t.logo || 'icons/icon-192.png';
      const emojiBadge = t.emoji || '🛡️';

      return `
        <div class="card" onclick="window.openTeamDetail('${t.id}')" style="display:flex; align-items:center; gap:1.25rem; padding:1rem; background:var(--card); cursor:pointer; transition:transform 0.15s, background-color 0.15s;">
          
          <div style="width:52px; height:52px; flex-shrink:0; background:var(--bg2); border-radius:12px; border:1px solid rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; overflow:hidden;">
            <img src="${logoUrl}" alt="Logo ${t.name}" style="width:100%; height:100%; object-fit:contain;" onerror="this.src='icons/icon-192.png'">
          </div>

          <div style="flex:1; min-width:0;">
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <span style="font-size:1rem;">${emojiBadge}</span>
              <h3 style="font-size:1.1rem; font-weight:600; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin:0;">${t.name}</h3>
            </div>
            <p style="font-size:.72rem; color:var(--text2); margin-top:2px;">Proprietario: <span style="color:var(--accent); font-weight:500;">${t.owner || 'Nessuno'}</span></p>
          </div>

          <svg viewBox="0 0 24 24" style="width:18px; height:18px; stroke:var(--text3); stroke-width:2; fill:none;"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
      `;
    }).join('');
  },

  // Apre la vista di dettaglio della singola fanta-squadra
  openTeamDetail(teamId, STATE) {
    const listView = document.getElementById('teams-list-view');
    const detailView = document.getElementById('team-detail-view');
    const detailContent = document.getElementById('team-detail-content');

    if (!listView || !detailView || !detailContent) return;

    const team = STATE.teams.find(t => t.id === teamId);
    if (!team) return;

    // Controllo e fallback dei dati descrittivi inseriti nel DB dal Patron
    const logoUrl = team.logo || 'icons/icon-192.png';
    const mottoText = team.motto ? `"${team.motto}"` : 'Nessun motto impostato';
    const descriptionText = team.description || 'Nessuna descrizione o storia inserita per questa fanta-squadra.';
    const ownerName = team.owner || 'Senza Proprietario';
    
    // Gestione bacheca trofei (coppe vinte)
    let trophiesHTML = `<div style="color:var(--text2); font-size:.85rem; font-style:italic;">Bacheca vuota. Nessun trofeo vinto finora.</div>`;
    if (team.trophies && team.trophies.length > 0) {
      trophiesHTML = `
        <div style="display:flex; flex-direction:column; gap:.5rem;">
          ${team.trophies.map(trophy => `
            <div style="background:var(--bg3); border:1px solid rgba(255,255,255,0.04); padding:.6rem .8rem; border-radius:8px; display:flex; align-items:center; gap:.6rem;">
              <span style="font-size:1.3rem;">🏆</span>
              <div>
                <div style="font-size:.85rem; font-weight:600; color:var(--gold);">${trophy.title || 'Competizione'}</div>
                <div style="font-size:.72rem; color:var(--text2);">Stagione / Anno: ${trophy.year || '—'}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    // Costruisce il layout della pagina unica del club
    detailContent.innerHTML = `
      <div style="text-align:center; margin-bottom:1.5rem;">
        <div style="width:120px; height:120px; background:var(--bg2); border-radius:24px; border:2px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; overflow:hidden; margin:0 auto 1rem auto; box-shadow:0 8px 30px rgba(0,0,0,0.3);">
          <img src="${logoUrl}" alt="Logo XL ${team.name}" style="width:100%; height:100%; object-fit:contain;" onerror="this.src='icons/icon-192.png'">
        </div>
        
        <h2 style="font-family:'Bebas Neue',sans-serif; font-size:2.4rem; color:#fff; letter-spacing:1px; margin-bottom:0.2rem;">
          ${team.emoji || '🛡️'} ${team.name}
        </h2>
        
        <div style="font-size:.75rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--text2); font-weight:600;">
          Allenatore: <span style="color:var(--text); font-weight:500;">${ownerName}</span>
        </div>

        <p style="font-size:.9rem; color:var(--accent); font-style:italic; margin-top:0.75rem; max-width:320px; margin-left:auto; margin-right:auto;">
          ${mottoText}
        </p>
      </div>

      <div class="card" style="margin-bottom:1.25rem;">
        <div class="label">Storia del Club & Descrizione</div>
        <p style="font-size:.88rem; color:var(--text); line-height:1.5; margin-top:.4rem; white-space:pre-line;">
          ${descriptionText}
        </p>
      </div>

      <div class="card">
        <div class="label" style="color:var(--gold)">Palmarès & Coppe Vinte</div>
        <div style="margin-top:.6rem;">
          ${trophiesHTML}
        </div>
      </div>
    `;

    // Esegue lo switch visivo mostrando la vista di dettaglio e nascondendo la griglia
    listView.style.display = 'none';
    detailView.style.display = 'block';

    // Scorri la pagina in alto automaticamente per vedere il dettaglio dall'inizio
    const pageContainer = document.getElementById('dynamic-pages-container');
    if (pageContainer) pageContainer.scrollTop = 0;
  },

  // Ritorna alla schermata principale dell'elenco squadre
  backToTeamsList() {
    const listView = document.getElementById('teams-list-view');
    const detailView = document.getElementById('team-detail-view');

    if (listView && detailView) {
      detailView.style.display = 'none';
      listView.style.display = 'block';
    }
  }
};
