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
            Elabora i fantavoti, calcola i punteggi delle squadre e congela i match di questa giornata (Stato Finished, Punteggi e Gol).
          </p>
          
          <div style="display: flex; flex-direction: column; gap: .75rem; margin-bottom: 1rem;">
            <div>
              <label class="label">Competizione Target:</label>
              <select id="calcCompSelect" class="input-login" style="margin:0; padding: .65rem;">
                <option value="">Caricamento competizioni...</option>
              </select>
            </div>
            <div>
              <label class="label">Giornata di Gioco (GW):</label>
              <input type="number" id="calcGwInput" class="input-login" style="margin:0; padding: .65rem;" value="1" min="1">
            </div>
          </div>
          
          <button class="btn btn-green" onclick="window.eseguiCalcoloPunteggi()">⚡ Salva Risultati Ufficiali Giornata</button>
        </div>
      </div>
    `;
  },

  render(state) {
    this._competitions = state.competitions || [];
    const activeCompId = window.CURRENT_COMPETITION || (this._competitions[0]?.id || "");

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

    const globalLiveSelect = document.getElementById('globalLiveSelect');
    const liveBadgeEl = document.getElementById('dashboard-live-badge');
    
    const isGlobalLive = state.LIVE === true || state.LIVE === "true";
    if (globalLiveSelect) globalLiveSelect.value = isGlobalLive ? "true" : "false";
    
    if (liveBadgeEl) {
      liveBadgeEl.innerHTML = isGlobalLive
        ? `<span class="badge badge-green">LIVE GLOBALE ATTIVO (status/live = true)</span>`
        : `<span class="badge badge-gray">LIVE GLOBALE DISABILITATO (status/live = false)</span>`;
    }

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
        window.toast("Esecuzione calcolo master e congelamento giornata...", "info");

        // 1. Recupero Voti Recenti
        const votesSnap = await get(ref(this.db, `votes/${gwId}`));
        if (!votesSnap.exists()) {
          return window.toast(`Nessun voto inserito per la giornata ${gwId.toUpperCase()}!`, "err");
        }
        const votiGiocatori = votesSnap.val();

        // 2. Recupero i Match della competizione per questa giornata
        const matchesSnap = await get(ref(this.db, `competitions/${compId}/matches/${gwId}/couples`));
        if (!matchesSnap.exists()) {
          return window.toast("Nessun match trovato per questa giornata in questa competizione.", "err");
        }
        const couples = matchesSnap.val();

        const updates = {};

        // 3. Fase A: Aggiornamento dei singoli fantavoti nel dizionario globale dei voti
        Object.keys(votiGiocatori).forEach(playerId => {
          const datiVoto = votiGiocatori[playerId];
          if (datiVoto && datiVoto.voto !== undefined) {
            const fantavotoFinale = CalcoloMatchService.calcolaFantavoto(datiVoto);
            updates[`votes/${gwId}/${playerId}/fantavoto`] = fantavotoFinale;
          }
        });

        // Helper interno per calcolare il totale di una squadra prendendo i dati dal CalcoloMatchService condiviso
        const calcolaTotaleFantasquadra = (formazione) => {
          if (!formazione) return 0;
          // Se CalcoloMatchService ha già una funzione per mappare e calcolare i titolari + panchine:
          // altrimenti applichiamo la logica standard basata sui voti calcolati in questa sessione.
          let totale = 0;
          const titolari = formazione.titolari || {};
          
          Object.keys(titolari).forEach(pId => {
            const vObj = votiGiocatori[pId];
            if (vObj && vObj.voto !== undefined) {
              totale += CalcoloMatchService.calcolaFantavoto(vObj);
            }
          });
          // Nota: Espandibile qui con la logica dei cambi panchina se CalcoloMatchService la espone
          return totale;
        };

        // Funzione helper per calcolare i gol in base alle soglie (66 = 1 gol, 72 = 2 gol, ogni 6 punti un gol)
        const calcolaGol = (punteggio) => {
          if (punteggio < 66) return 0;
          return Math.floor((punteggio - 66) / 6) + 1;
        };

        // 4. Fase B: Elaborazione di ogni singolo Match
        Object.keys(couples).forEach(matchKey => {
          const match = couples[matchKey];
          
          // Calcoliamo i punteggi complessivi delle due squadre (es. 66, 70.5, ecc.)
          const ptHome = calcolaTotaleFantasquadra(match.homeFormazione);
          const ptAway = calcolaTotaleFantasquadra(match.awayFormazione);

          // Calcoliamo i gol corrispondenti
          const gHome = calcolaGol(ptHome);
          const gAway = calcolaGol(ptAway);

          const basePath = `competitions/${compId}/matches/${gwId}/couples/${matchKey}`;
          
          // Prepariamo gli update richiesti per il calendario e la classifica
          updates[`${basePath}/punteggioFinaleHome`] = ptHome;
          updates[`${basePath}/punteggioFinaleAway`] = ptAway;
          updates[`${basePath}/goalHome`] = gHome;
          updates[`${basePath}/goalAway`] = gAway;
          updates[`${basePath}/finished`] = true;
        });

        // 5. Invio atomico dei dati a Firebase
        await update(ref(this.db), updates);
        window.toast(`🎯 Giornata ${gwId.toUpperCase()} congelata e salvata con successo!`, "ok");

      } catch (err) {
        console.error(err);
        window.toast("Errore critico durante il salvataggio completo della giornata", "err");
      }
    };
  }
};
