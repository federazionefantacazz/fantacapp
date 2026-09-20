export const AssetPreloader = {
  CACHE_NAME: 'fantacapp-images-v1',

  getPriorityUrls(STATE) {
    const urls = new Set();
    const myTeamId = String(STATE.user?.id || '');

    // 1. Loghi di tutte le squadre
    const teamsList = Array.isArray(STATE.teams) ? STATE.teams : Object.values(STATE.teams || {});
    teamsList.forEach(t => {
      if (t && t.logo) urls.add(t.logo);
    });

    // 2. Foto dei calciatori appartenenti ESCLUSIVAMENTE alla TUA rosa
    const playersList = Array.isArray(STATE.players) ? STATE.players : Object.values(STATE.players || {});
    if (myTeamId) {
      playersList.forEach(p => {
        if (!p) return;
        const pTeamId = String(p.teamId || p.team || '');
        if (pTeamId === myTeamId) {
          const photo = p.photoPersonal || p.photoStandard;
          if (photo) urls.add(photo);
        }
      });
    }

    return Array.from(urls);
  },

  async startSync(STATE) {
    if (!STATE || !STATE.user) return;

    const priorityUrls = this.getPriorityUrls(STATE);
    if (priorityUrls.length === 0) return;

    let cache = null;
    if ('caches' in window) {
      try {
        cache = await caches.open(this.CACHE_NAME);
      } catch (e) {
        console.warn('Cache Storage non disponibile:', e);
      }
    }

    const missingUrls = [];
    if (cache) {
      for (const url of priorityUrls) {
        const match = await cache.match(url);
        if (!match) missingUrls.push(url);
      }
    } else {
      missingUrls.push(...priorityUrls);
    }

    if (missingUrls.length === 0) return;

    this.showModal();

    let completed = 0;
    const total = missingUrls.length;
    const CONCURRENCY_LIMIT = 6;
    const queue = [...missingUrls];

    const worker = async () => {
      while (queue.length > 0) {
        const url = queue.shift();
        try {
          const response = await fetch(url, { mode: 'cors' });
          if (response.ok && cache) {
            await cache.put(url, response);
          }
        } catch (e) {
          console.warn('Errore precaricamento immagine:', url);
        } finally {
          completed++;
          this.updateUI(completed, total);
        }
      }
    };

    const workers = Array.from({ length: CONCURRENCY_LIMIT }, () => worker());
    await Promise.all(workers);

    setTimeout(() => this.hideModal(), 300);
  },

  showModal() {
    if (document.getElementById('asset-sync-modal')) return;

    const modalHtml = `
      <div id="asset-sync-modal" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(10,15,30,0.85); backdrop-filter:blur(8px); z-index:99999; display:flex; align-items:center; justify-content:center; color:#fff;">
        <div style="background:var(--card, #282e37); border:1px solid rgba(255,255,255,0.1); padding:1.25rem; border-radius:16px; width:80%; max-width:300px; text-align:center; box-shadow:0 12px 32px rgba(0,0,0,0.6);">
          <i class="ri-refresh-line" style="font-size:2rem; color:var(--accent, #50e3c2); display:inline-block; animation: spin 1s linear infinite; margin-bottom:0.4rem;"></i>
          <h3 style="margin:0 0 0.2rem 0; font-size:1rem; font-weight:700;">Sincronizzazione</h3>
          <p style="font-size:0.72rem; color:var(--text2, #94a3b8); margin-bottom:1rem;">Caricamento loghi e rosa titolare...</p>
          
          <div style="background:rgba(255,255,255,0.08); border-radius:10px; height:6px; overflow:hidden; margin-bottom:0.5rem;">
            <div id="sync-progress-bar" style="background:var(--accent, #50e3c2); height:100%; width:0%; transition:width 0.15s ease-out;"></div>
          </div>

          <div id="sync-progress-text" style="font-size:0.72rem; font-weight:600; color:var(--text2);">0 / 0</div>
        </div>
        <style>
          @keyframes spin { 100% { transform: rotate(360deg); } }
        </style>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  updateUI(current, total) {
    const percent = Math.round((current / total) * 100);
    const bar = document.getElementById('sync-progress-bar');
    const text = document.getElementById('sync-progress-text');
    if (bar) bar.style.width = `${percent}%`;
    if (text) text.textContent = `${current} / ${total} (${percent}%)`;
  },

  hideModal() {
    const modal = document.getElementById('asset-sync-modal');
    if (modal) modal.remove();
  }
};
