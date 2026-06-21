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

    // 1. Traduzione: Quale GW di lega corrisponde alla GW reale?
    const entry = Object.entries(associazioniGwRealiMap || {}).find(([k, v]) => v == gwReale);
    if (!entry) {
      container.innerHTML = `<p style="text-align:center; padding: 2rem; color:var(--text2);">Nessun match di lega attivo per questa giornata.</p>`;
      return;
    }

    const gwCompetizione = entry[0];
    container.innerHTML = `<p style="text-align:center; padding: 2rem; color:var(--text2);">Caricamento dati live...</p>`;

    // 2. Fetch dei dati
    const lineupPath = `competitions/${this.currentCompId}/lineups/${this.currentUserId}/${gwCompetizione}`;
    get(ref(this.db, lineupPath)).then((snap) => {
      if (!snap.exists()) {
        container.innerHTML = `<p style="text-align:center; padding: 2rem; color:var(--text2);">Nessuna formazione schierata.</p>`;
        return;
      }

      const data = snap.val();
      const votesRef = ref(this.db, `votes/gw${gwReale}`);
      
      // 3. Listener Real-time sui voti
      this.activeListener = onValue(votesRef, (vSnap) => {
        get(ref(this.db, 'players')).then((pSnap) => {
          this.renderLiveScreen(container, data.titolari, data.panchina, vSnap.val() || {}, pSnap.val() || {}, gwCompetizione);
        });
      });
    });
  },

  // --- LOGICA GRAFICA (Il motore che crea l'HTML) ---
  renderLiveScreen(container, titolari, panchina, voti, players, gwLabel) {
    let sommaTitolari = 0;

    const buildRow = (id) => {
      const p = players[id] || { name: 'Giocatore Sconosciuto', role: '-' };
      const v = voti[id] || { voto: null };
      const fantaVoto = v.voto ? CalcoloMatchService.calcolaFantavoto(v) : 0;
      if (v.voto) sommaTitolari += fantaVoto;

      return `
        <div class="player-row" style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #333;">
          <span>${p.name}</span>
          <span>${v.voto ? v.voto : 'S.V.'} | <b>${fantaVoto}</b></span>
        </div>`;
    };

    container.innerHTML = `
      <div class="live-card" style="background:var(--card); padding:20px; border-radius:10px;">
        <h3>🔴 LIVE - ${gwLabel}</h3>
        <div class="titolari">${titolari.map(id => buildRow(id)).join('')}</div>
        <hr>
        <div class="panchina">${panchina.map(id => buildRow(id)).join('')}</div>
        <div class="total" style="font-size:1.5rem; text-align:right; margin-top:10px;">
          TOTALE: ${sommaTitolari.toFixed(1)}
        </div>
      </div>
    `;
  },

  stopLiveTracking() {
    if (this.activeListener) { this.activeListener(); this.activeListener = null; }
  }
};
