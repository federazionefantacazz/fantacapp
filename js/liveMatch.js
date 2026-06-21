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

    // --- CORREZIONE DEL PERCORSO DI LETTURA ---
    // Invertito l'ordine: impostato gwCompetizione (gw1) PRIMA di currentUserId
    const livePath = `competitions/${this.currentCompId}/lineups/${gwCompetizione}/${this.currentUserId}`;
    
    this.activeListener = onValue(ref(this.db, livePath), (snapshot) => {
      const data = snapshot.val();
      if (!data || !data.titolari) {
        container.innerHTML = `
          <div style="text-align:center; padding: 2rem; color:var(--text2);">
            <p>Formazione non schierata per la ${gwCompetizione.toUpperCase()}</p>
          </div>`;
        return;
      }

      get(ref(this.db, 'votes')).then((vSnap) => {
        get(ref(this.db, 'players')).then((pSnap) => {
          this.renderLiveScreen(container, data.titolari, data.panchina, vSnap.val() || {}, pSnap.val() || {}, gwCompetizione);
        });
      });
    });
  },

  stopLiveTracking() {
    if (this.activeListener) {
      this.activeListener();
      this.activeListener = null;
    }
  },

  renderLiveScreen(container, titolariIds, panchinaIds, votes, players, gwLabel) {
    let totPuntiTitolari = 0;
    
    const mapPlayer = (id) => {
      const p = Object.values(players).find(pl => String(pl.id) === String(id));
      if (!p) return { name: "Sconosciuto", role: "?", club: "?", voto: 0, bonus: 0, malus: 0, fv: 0, live: false };
      
      const vObj = votes[id] || {};
      const votoPuro = vObj.voto !== undefined ? Number(vObj.voto) : 0;
      const fantaVoto = vObj.fVoto !== undefined ? Number(vObj.fVoto) : 0;
      
      return {
        name: p.name,
        role: p.role,
        club: p.club,
        voto: votoPuro,
        fv: fantaVoto,
        live: !!vObj.live
      };
    };

    const titolariMapped = titolariIds.map(mapPlayer);
    const panchinaMapped = (panchinaIds || []).map(mapPlayer);

    titolariMapped.forEach(p => {
      totPuntiTitolari += p.fv > 0 ? p.fv : (p.voto > 0 ? p.voto : 0);
    });

    let titolariHTML = "";
    titolariMapped.forEach(p => {
      let badgeColor = "var(--accent2)";
      if (p.role === 'P') badgeColor = "#4a5568";
      if (p.role === 'D') badgeColor = "#0077ff";
      if (p.role === 'C') badgeColor = "#00e5a0";
      if (p.role === 'A') badgeColor = "#ff4757";

      const textColor = p.role === 'C' ? '#0a0f1e' : '#fff';
      const indicatorLive = p.live ? `<span style="color:var(--accent3); font-size:0.65rem; margin-left:4px; animation: fadeIn 1s infinite alternate;">●</span>` : "";
      
      let scoreText = "-";
      if (p.fv > 0) scoreText = p.fv;
      else if (p.voto > 0) scoreText = p.voto;

      titolariHTML += `
        <div class="pcard" style="margin-bottom:0.4rem; padding:0.4rem 0.6rem;">
          <div class="rbadge" style="background:${badgeColor}; color:${textColor}; width:24px; height:24px; font-size:0.7rem; border-radius:6px;">${p.role}</div>
          <div class="pi">
            <div class="pn" style="font-size:0.85rem;">${p.name} ${indicatorLive}</div>
            <div class="pm" style="font-size:0.65rem;">${p.club.toUpperCase()}</div>
          </div>
          <div class="pr">
            <span class="price" style="font-size:0.9rem; color:${p.live ? 'var(--accent)' : 'var(--gold)'};">${scoreText}</span>
          </div>
        </div>
      `;
    });

    let panchinaHTML = "";
    if (panchinaMapped.length > 0) {
      panchinaMapped.forEach(p => {
        let badgeColor = "rgba(255,255,255,0.1)";
        if (p.role === 'P') badgeColor = "rgba(74,85,104,0.4)";
        if (p.role === 'D') badgeColor = "rgba(0,119,255,0.4)";
        if (p.role === 'C') badgeColor = "rgba(0,229,160,0.4)";
        if (p.role === 'A') badgeColor = "rgba(255,71,87,0.4)";

        let scoreText = "-";
        if (p.fv > 0) scoreText = p.fv;
        else if (p.voto > 0) scoreText = p.voto;

        panchinaHTML += `
          <div class="pcard" style="margin-bottom:0.3rem; padding:0.3rem 0.5rem; background: rgba(255,255,255,0.02); border-radius:8px;">
            <div class="rbadge" style="background:${badgeColor}; width:20px; height:20px; font-size:0.65rem; border-radius:4px;">${p.role}</div>
            <div class="pi">
              <div class="pn" style="font-size:0.8rem; opacity:0.8;">${p.name}</div>
            </div>
            <div class="pr">
              <span style="font-size:0.8rem; font-family:'DM Mono',monospace; color:var(--text2);">${scoreText}</span>
            </div>
          </div>
        `;
      });
    } else {
      panchinaHTML = `<p style="text-align:center; font-size:0.75rem; color:var(--text2); opacity:0.6; padding:0.5rem 0;">Nessun panchinaro schierato</p>`;
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

        <div style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 1rem; display:flex; justify-content:space-between; align-items:center;">
          <span class="label" style="margin:0;">Punteggio Parziale (Titolari)</span>
          <span style="font-size:1.3rem; font-weight:700; color:var(--accent); font-family:'DM Mono',monospace;">
            ${totPuntiTitolari.toFixed(1)}
          </span>
        </div>
      </div>
    `;
  }
};