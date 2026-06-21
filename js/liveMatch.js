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
    // Usiamo String().trim() per prevenire disallineamenti di tipi (es. stringhe vs numeri o spazi nel DB)
    const entry = Object.entries(associazioniGwRealiMap || {}).find(([k, v]) => {
      return String(v).trim() === String(gwReale).trim();
    });

    if (!entry) {
      container.innerHTML = `
        <div style="text-align:center; padding: 2rem; color:var(--text2);">
          <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">🔴 Live Match non attivo</p>
          <p style="font-size: 0.85rem; opacity: 0.7;">Nessun match di lega pianificato per la Giornata Reale ${gwReale}.</p>
        </div>`;
      return;
    }

    const gwCompetizione = entry[0]; // Es: "gw1"
    container.innerHTML = `<p style="text-align:center; padding: 2rem; color:var(--text2);">Caricamento dati live...</p>`;

    // 2. Fetch e monitoraggio in tempo reale della formazione dell'utente
    const livePath = `competitions/${this.currentCompId}/lineups/${this.currentUserId}/${gwCompetizione}`;
    
    this.activeListener = onValue(ref(this.db, livePath), (snapshot) => {
      const data = snapshot.val();
      if (!data || !data.titolari) {
        container.innerHTML = `
          <div style="text-align:center; padding: 2rem; color:var(--text2);">
            <p>Formazione non schierata per la ${gwCompetizione.toUpperCase()}</p>
          </div>`;
        return;
      }

      // Recuperiamo voti e anagrafica giocatori
      get(ref(this.db, 'votes')).then((vSnap) => {
        get(ref(this.db, 'players')).then((pSnap) => {
          this.renderLiveScreen(container, data.titolari, data.panchina, vSnap.val() || {}, pSnap.val() || {}, gwCompetizione);
        });
      });
    });
  },

  stopLiveTracking() {
    if (this.activeListener) {
      // Disattivazione del listener Firebase per evitare spreco di memoria e letture residue
      this.activeListener();
      this.activeListener = null;
    }
  },

  // --- LOGICA GRAFICA (Il motore che crea l'HTML) ---
  renderLiveScreen(container, titolari, panchina, voti, players, gwLabel) {
    let sommaTitolari = 0;

    const buildRow = (id) => {
      const p = players[id] || { name: 'Giocatore Sconosciuto', role: '-' };
      const v = voti[id] || { voto: null };
      const fantaVoto = v.voto ? CalcoloMatchService.calcolaFantavoto(v) : 0;
      if (v.voto) sommaTitolari += fantaVoto;

      // Generazione del badge del ruolo dinamico
      const roleClass = p.role ? `r${p.role.toUpperCase()}` : 'rP';

      return `
        <div class="pcard" style="margin-bottom: 0.5rem;">
          <div class="rbadge ${roleClass}">${p.role || '-'}</div>
          <div class="pi">
            <div class="pn">${p.name}</div>
            <div class="pm">${p.team || 'Squadra Sconosciuta'}</div>
          </div>
          <div class="pr">
            <span class="price" style="font-size: 1rem;">${v.voto ? fantaVoto : 'S.V.'}</span>
            <div class="pavg">${v.voto ? `Voto: ${v.voto}` : 'Non a voto'}</div>
          </div>
        </div>`;
    };

    // Costruisci le righe dei titolari
    const titolariHTML = titolari.map(id => buildRow(id)).join('');
    
    // Costruisci le righe della panchina
    let panchinaHTML = '';
    if (panchina && panchina.length > 0) {
      panchinaHTML = panchina.map(id => buildRow(id)).join('');
    } else {
      panchinaHTML = `<p style="font-size:0.8rem; color:var(--text2); opacity:0.6; padding:0.5rem 0;">Nessun panchinaro schierato</p>`;
    }

    container.innerHTML = `
      <div class="card" style="margin-top: 0.5rem;">
        <div class="sec" style="justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <span style="color: var(--accent3);">🔴</span> LIVE MATCH
          </div>
          <span style="font-size: 0.85rem; background: var(--bg3); padding: 0.2rem 0.6rem; border-radius: 20px; color: var(--text2);">
            ${gwLabel.toUpperCase()}
          </span>
        </div>

        <div class="label" style="margin-bottom:0.6rem; font-size:0.75rem;">Formazione Titolare</div>
        <div style="margin-bottom: 1.5rem;">
          ${titolariHTML}
        </div>

        <div class="label" style="margin-bottom:0.6rem; font-size:0.75rem;">Panchina</div>
        <div style="margin-bottom: 1.5rem; opacity: 0.85;">
          ${panchinaHTML}
        </div>

        <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1rem; display: flex; justify-content: space-between; align-items: center;">
          <div class="label" style="margin: 0;">Punteggio Live Parziale:</div>
          <div style="font-size: 1.4rem; font-weight: bold; font-family: 'DM Mono', monospace; color: var(--accent);">
            ${sommaTitolari.toFixed(1)}
          </div>
        </div>
      </div>
    `;
  }
};