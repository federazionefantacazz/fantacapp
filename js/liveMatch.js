import { ref, onValue, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { CalcoloMatchService } from "./services/calcoloMatch.js";

export const LiveMatchModule = {
  db: null,
  currentUserId: null,
  currentCompId: null,
  activeListener: null,

  init(database, userId, compId) {
    this.db = database;
    this.currentUserId = userId;
    this.currentCompId = compId;
  },

  startLiveTracking(gwReale, associazioniGwRealiMap) {
    this.stopLiveTracking();
    const container = document.getElementById('live-match-container');
    if (!container) return;

    console.log("👉 1. Avvio LiveTracking per GW Reale:", gwReale);
    console.log("👉 2. Associazioni ricevute:", associazioniGwRealiMap);

    // Fallback automatico se la mappa delle associazioni arriva vuota durante i test
    const associazioni = associazioniGwRealiMap && Object.keys(associazioniGwRealiMap).length > 0 
      ? associazioniGwRealiMap 
      : { "gw1": 8 };

    // 1. Traduzione: Quale GW di lega corrisponde alla GW reale?
    const entry = Object.entries(associazioni).find(([k, v]) => v == gwReale);
    if (!entry) {
      console.error("❌ ERRORE: Nessuna corrispondenza trovata per la GW Reale", gwReale, "nelle associazioni:", associazioni);
      container.innerHTML = `<p style="text-align:center; padding: 2rem; color:var(--text2);">Nessun match di lega attivo per questa giornata (GW Reale: ${gwReale}).</p>`;
      return;
    }

    const gwCompetizione = entry[0];
    console.log("👉 3. Corrispondenza trovata! GW di Lega:", gwCompetizione);
    container.innerHTML = `<p style="text-align:center; padding: 2rem; color:var(--text2);">Caricamento dati live...</p>`;

    // 2. Fetch della formazione schierata
    const lineupPath = `competitions/${this.currentCompId}/lineups/${this.currentUserId}/${gwCompetizione}`;
    console.log("👉 4. Cerco formazione nel path:", lineupPath);

    get(ref(this.db, lineupPath)).then((snap) => {
      if (!snap.exists()) {
        console.error("❌ ERRORE: Formazione mancante su Firebase al path:", lineupPath);
        container.innerHTML = `<p style="text-align:center; padding: 2rem; color:var(--text2);">Nessuna formazione schierata per la ${gwCompetizione.toUpperCase()}.</p>`;
        return;
      }

      const data = snap.val() || {};
      console.log("👉 5. Formazione trovata con successo:", data);

      const titolari = data.titolari || [];
      const panchina = data.panchina || [];

      if (titolari.length === 0 && panchina.length === 0) {
        console.warn("⚠️ ATTENZIONE: Liste titolari e panchina vuote o non valide nella formazione.");
      }

      const votesRef = ref(this.db, `votes/gw${gwReale}`);
      console.log("👉 6. Sottoscrizione ai voti live al path: votes/gw" + gwReale);
      
      // 3. Listener Real-time sui voti della giornata reale
      this.activeListener = onValue(votesRef, (vSnap) => {
        const votiVariabili = vSnap.val() || {};
        console.log("👉 7. Ricevuto aggiornamento voti (vuoto se non sono ancora usciti):", votiVariabili);

        // Recupero l'anagrafica dei giocatori per mostrare i nomi reali
        get(ref(this.db, 'players')).then((pSnap) => {
          const playersData = pSnap.val() || {};
          console.log("👉 8. Giocatori globali caricati. Rendering dell'interfaccia...");
          this.renderLiveScreen(container, titolari, panchina, votiVariabili, playersData, gwCompetizione);
        }).catch(err => {
          console.error("❌ ERRORE durante il recupero del nodo 'players':", err);
        });
      });
    }).catch(err => {
      console.error("❌ ERRORE durante il recupero della formazione:", err);
    });
  },

  // --- LOGICA GRAFICA (Il motore che crea l'HTML) ---
  renderLiveScreen(container, titolari, panchina, voti, players, gwLabel) {
    let sommaTitolari = 0;

    const buildRow = (id) => {
      const p = players[id] || { name: `Giocatore Sconosciuto (${id})`, role: '-' };
      const v = voti[id] || { voto: null };
      
      // Se v.voto è assente/null, il fantavoto di base calcolato è 0
      const fantaVoto = v.voto ? CalcoloMatchService.calcolaFantavoto(v) : 0;
      if (v.voto) sommaTitolari += fantaVoto;

      return `
        <div class="player-row" style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #333;">
          <span>[${p.role || '-'}] <b>${p.name}</b></span>
          <span>${v.voto ? v.voto : 'S.V.'} | <b style="color: ${v.voto ? 'var(--accent)' : 'var(--text2)'};">${fantaVoto > 0 ? '+' + fantaVoto : fantaVoto}</b></span>
        </div>`;
    };

    const listaTitolariHTML = Array.isArray(titolari) ? titolari.map(id => buildRow(id)).join('') : '<p>Nessun titolare trovato</p>';
    const listaPanchinaHTML = Array.isArray(panchina) ? panchina.map(id => buildRow(id)).join('') : '<p>Nessun panchinaro trovato</p>';

    container.innerHTML = `
      <div class="live-card" style="background:var(--card); padding:20px; border-radius:10px; border: 1px solid rgba(255,255,255,0.05); max-width: 600px; margin: 0 auto;">
        <h3 style="color: var(--accent3); margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
          <span style="display:inline-block; width:10px; height:10px; background:var(--accent3); border-radius:50%; animation: pulse 1.5s infinite;"></span>
          🔴 LIVE MATCH - ${gwLabel.toUpperCase()}
        </h3>
        
        <div style="margin-bottom: 10px; font-size: 0.8rem; color: var(--text2); text-transform: uppercase; letter-spacing: 1px; font-weight:600;">Titolari</div>
        <div class="titolari" style="margin-bottom: 20px; background: rgba(0,0,0,0.15); border-radius: 8px; padding: 5px;">
          ${listaTitolariHTML}
        </div>
        
        <div style="margin-bottom: 10px; font-size: 0.8rem; color: var(--text2); text-transform: uppercase; letter-spacing: 1px; font-weight:600;">Panchina</div>
        <div class="panchina" style="background: rgba(0,0,0,0.15); border-radius: 8px; padding: 5px; margin-bottom: 20px;">
          ${listaPanchinaHTML}
        </div>
        
        <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin-bottom: 15px;">
        
        <div class="total" style="font-size:1.6rem; font-family:'Bebas Neue', sans-serif; letter-spacing: 1px; text-align:right; color: var(--gold);">
          TOTALE SQUADRA: <span style="font-family:'DM Mono', monospace; font-size: 1.8rem;">${sommaTitolari.toFixed(1)}</span>
        </div>
      </div>
      <style>
        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.5; }
        }
      </style>
    `;
  },

  stopLiveTracking() {
    if (this.activeListener) { 
      this.activeListener(); 
      this.activeListener = null; 
      console.log("🛑 LiveTracking interrotto con successo.");
    }
  }
};