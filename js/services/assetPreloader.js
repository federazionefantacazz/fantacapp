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

  /** Mette subito in cache un'immagine appena caricata (logo / foto personale). */
  async cacheUrl(url) {
    if (!url || !('caches' in window)) return;
    try {
      const cache = await caches.open(this.CACHE_NAME);
      if (await cache.match(url)) return;
      const response = await fetch(url, { mode: 'cors' });
      if (response.ok) await cache.put(url, response);
    } catch (e) {
      console.warn('Impossibile mettere in cache:', url);
    }
  },

  async startSync(STATE) {
    if (!STATE || !STATE.user) return;
    // senza rete non si scarica nulla; una sola sincronizzazione alla volta
    if (!navigator.onLine || this._running) return;
    this._running = true;
    try { await this._sync(STATE); } finally { this._running = false; }
  },

  async _sync(STATE) {
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

  /** Indicatore compatto sopra la barra in basso: non blocca l'app mentre scarica. */
  showModal() {
    if (document.getElementById('asset-sync-modal')) return;

    const modalHtml = `
      <div id="asset-sync-modal" style="position:fixed; left:50%; transform:translateX(-50%); bottom:calc(76px + env(safe-area-inset-bottom, 0px)); z-index:1250; display:flex; align-items:center; gap:.6rem; width:min(320px, calc(100vw - 2rem)); padding:.55rem .8rem; border-radius:999px; background:var(--card, #282e37); border:1px solid rgba(255,255,255,0.1); box-shadow:0 8px 24px rgba(0,0,0,0.45); color:var(--text, #e2e8f0); pointer-events:none;">
        <i class="ri-download-cloud-2-line" style="font-size:1.1rem; color:var(--accent, #50e3c2);"></i>
        <div style="flex:1; min-width:0;">
          <div style="font-size:.7rem; font-weight:600; margin-bottom:.25rem;">Salvataggio immagini per l'uso offline</div>
          <div style="background:rgba(255,255,255,0.08); border-radius:10px; height:4px; overflow:hidden;">
            <div id="sync-progress-bar" style="background:var(--accent, #50e3c2); height:100%; width:0%; transition:width 0.15s ease-out;"></div>
          </div>
        </div>
        <div id="sync-progress-text" style="font-size:.68rem; font-weight:600; color:var(--text2, #94a3b8); font-family:'DM Mono', monospace;">0%</div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  updateUI(current, total) {
    const percent = Math.round((current / total) * 100);
    const bar = document.getElementById('sync-progress-bar');
    const text = document.getElementById('sync-progress-text');
    if (bar) bar.style.width = `${percent}%`;
    if (text) text.textContent = `${percent}%`;
  },

  hideModal() {
    const modal = document.getElementById('asset-sync-modal');
    if (modal) modal.remove();
  }
};
