import { ref, get, update, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
// Importazione del servizio live condiviso
import { CalcoloMatchService } from "../services/calcoloMatch.js";

export const DashboardSection = {
  db: null,
  _competitions: [],

  init(database) {
    this.db = database;
    this.registerGlobalActions();
  },

  renderHTML() {
    return `
      <div id="sec-dashboard" class="admin-sec" style="display:block;">
        <h2 class="sec-title">📊 Dashboard Patron</h2>
        
        <div class="card" style="max-width: 500px;">
          <div class="label" style="color: var(--accent); margin-bottom: .6rem; font-size: .85rem;">
            Stato Campionato & Giornata Reale (Serie A)
          </div>
          <p style="font-size: .85rem; color: var(--text2); margin-bottom: 1rem;">
            Seleziona la giornata corrente del campionato reale.
          </p>
          
          <div style="display: flex; flex-direction: column; gap: .4rem;">
            <label class="label" for="realGwSelect">Giornata Attiva:</label>
            <select id="realGwSelect" class="input-login" style="margin: 0; padding: .75rem;" onchange="window.changeRealGW(this.value)">
            </select>
          </div>
          <div id="dashboard-status-badge" style="margin-top: 1rem; font-size: .85rem; font-weight: 500;"></div>
        </div>

        <div class="card" style="max-width: 500px;">
          <div class="label" style="color: var(--accent); margin-bottom: .6rem; font-size: .85rem;">
            🔴 Stato Calcolo Live Piattaforma
          </div>
          <p style="font-size: .8rem; color: var(--text2); margin-bottom: 1rem;">
            Abilita o disabilita il calcolo in tempo reale su tutto il sito (Stato Globale). Successivamente questo stato condizionerà le competizioni.
          </p>
          
          <div style="display: flex; flex-direction: column; gap: .4rem; margin-bottom: 1rem;">
            <label class="label" for="globalLiveSelect">Stato Live Generale:</label>
            <select id="globalLiveSelect" class="input-login" style="margin: 0; padding: .75rem;" onchange="window.changeGlobalLiveStatus(this.value)">
              <option value="false">❌ Disabilitato (Statico / Risultati Definitivi)</option>
              <option value="true">🟢 Abilitato (Calcolo in Tempo Reale Attivo)</option>
            </select>
          </div>
          <div id="dashboard-live-badge" style="font-size: .85rem; font-weight: 500;"></div>
        </div>

        <div class="card" style="max-width: 500px;">
          <div class="label" style="color: var(--accent); margin-bottom: .6rem; font-size: .85rem;">
            🧮 Calcolatore Risultati Giornata (Salvataggio Master)
          </div>
          <p style="font-size: .8rem; color: var(--text2); margin-bottom: 1rem;">
            Elabora e salva i fantavoti ufficiali su Firebase utilizzando il motore di calcolo live condiviso.
          </p>
          
          <div style="display: flex; flex-direction: column; gap: .75rem; margin-bottom: 1rem;">
            <div>
              <label class="label">Competizione Target:</label>
              <select id="calcCompSelect" class="input-login" style="margin:0; padding: .65rem;" onchange="window.selectCompetition(this.value)">
                <option value="">Caricamento competizioni...</option>
              </select>
            </div>
            <div>
              <label class="label">Giornata di Gioco (GW):</label>
              <input type="number" id="calcGwInput" class="input-login" style="margin:0; padding: .65rem;" value="1" min="1">
            </div>
          </div>
          
          <button class="btn btn-green" onclick="window.eseguiCalcoloPunteggi()">⚡ Salva Punteggi Ufficiali</button>
        </div>
      </div>
    `;
  },

  render(state) {
    this._competitions = state.competitions || [];
    const activeCompId = window.CURRENT_COMPETITION || (this._competitions[0]?.id || "");

    // 1. Popolamento Giornata Reale Serie A
    const selectEl = document.getElementById('realGwSelect');
    if (selectEl && selectEl.options.length === 0) {
      let optionsHtml = `<option value="0">⏳ Giornata 0 (Prima del Campionato)</option>`;
      for (let i = 1; i <= 38; i++) {
        optionsHtml += `<option value="${i}">⚽ Giornata ${i}</option>`;
      }
      selectEl.innerHTML = optionsHtml;
    }
    if (selectEl) selectEl.value = state.CURRENT_REAL_GW !== undefined ? state.CURRENT_REAL_GW : 0;

    const badgeEl = document.getElementById('dashboard-status-badge');
    if (badgeEl) {
      const currentRealGw = state.CURRENT_REAL_GW !== undefined ? state.CURRENT_REAL_GW : 0;
      badgeEl.innerHTML = currentRealGw === 0 
        ? `<span class="badge badge-blue">Pre-Campionato attivo</span>` 
        : `<span class="badge badge-green">Campionato in corso: ${currentRealGw}ª Giornata</span>`;
    }

    // 2. Sincronizzazione Selettore e Badge dello STATO LIVE GLOBALE
    const globalLiveSelect = document.getElementById('globalLiveSelect');
    const liveBadgeEl = document.getElementById('dashboard-live-badge');
    
    const isGlobalLive = state.LIVE === true || state.LIVE === "true";
    if (globalLiveSelect) globalLiveSelect.value = isGlobalLive ? "true" : "false";
    
    if (liveBadgeEl) {
      liveBadgeEl.innerHTML = isGlobalLive
        ? `<span class="badge badge-green">LIVE GLOBALE ATTIVO (status/live = true)</span>`
        : `<span class="badge badge-gray">LIVE GLOBALE DISABILITATO (status/live = false)</span>`;
    }

    // 3. Popolamento Selettore Competizioni Target
    const calcCompSelect = document.getElementById('calcCompSelect');
    if (calcCompSelect) {
      if (this._competitions.length === 0) {
        calcCompSelect.innerHTML = '<option value="">Nessuna competizione trovata</option>';
      } else {
        calcCompSelect.innerHTML = this._competitions.map(c => `
          <option value="${c.id}" ${activeCompId === c.id ? 'selected' : ''}>🏆 ${c.name}</option>
        `).join('');
      }
    }
    
    const currentComp = this._competitions.find(c => c.id === activeCompId);
    const calcGwInput = document.getElementById('calcGwInput');
    if (currentComp && calcGwInput && !calcGwInput.dataset.userEdited) {
      calcGwInput.value = currentComp.status?.currentGW || 1;
    }
  },

  registerGlobalActions() {
    document.addEventListener('input', (e) => {
      if (e.target.id === 'calcGwInput') e.target.dataset.userEdited = "true";
    });

    window.changeGlobalLiveStatus = async (value) => {
      if (!this.db) return console.error("Database non inizializzato");
      const isLive = value === "true";
      try {
        await set(ref(this.db, 'status/live'), isLive);
        window.toast(`Stato Live globale impostato su: ${isLive}`, "ok");
      } catch (err) {
        console.error(err);
        window.toast("Errore nel salvataggio del live globale", "err");
      }
    };

    window.eseguiCalcoloPunteggi = async () => {
      if (!this.db) return console.error("Database non inizializzato");

      const compId = document.getElementById('calcCompSelect')?.value;
      const gwNum = document.getElementById('calcGwInput')?.value;
      if (!compId || !gwNum) return window.toast("Competizione e Giornata obbligatorie!", "err");

      const gwId = `gw${gwNum}`;

      try {
        window.toast("Esecuzione calcolo con motore live...", "info");

        const votesSnap = await get(ref(this.db, `votes/${gwId}`));
        if (!votesSnap.exists()) {
          return window.toast(`Nessun voto inserito per la giornata ${gwId.toUpperCase()}!`, "err");
        }

        const votiGiocatori = votesSnap.val();
        const updates = {};
        let conteggioCalcolati = 0;

        Object.keys(votiGiocatori).forEach(playerId => {
          const datiVoto = votiGiocatori[playerId];
          
          if (datiVoto && datiVoto.voto !== undefined) {
            const fantavotoFinale = CalcoloMatchService.calcolaFantavoto(datiVoto);
            updates[`votes/${gwId}/${playerId}/fantavoto`] = fantavotoFinale;
            conteggioCalcolati++;
          }
        });

        if (conteggioCalcolati > 0) {
          await update(ref(this.db), updates);
          window.toast(`🎯 Salvati con successo ${conteggioCalcolati} fantavoti per ${gwId.toUpperCase()}!`, "ok");
        } else {
          window.toast("Nessun voto calcolabile.", "err");
        }
      } catch (err) {
        console.error(err);
        window.toast("Errore critico durante il salvataggio", "err");
      }
    };
  }
};
