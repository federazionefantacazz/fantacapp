import { ref, onValue, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { CalcoloMatchService } from "./services/calcoloMatch.js";

export const LiveMatchModule = {
  db: null,
  myTeamId: null,
  currentCompId: null,
  activeListener: null,

  init(database, teamId, compId) {
    this.db = database;
    this.myTeamId = teamId;
    this.currentCompId = compId;
  },

  startLiveTracking(gwReale, associazioniGwRealiMap) {
    this.stopLiveTracking();
    const container = document.getElementById('live-match-container');
    if (!container) return;

    // Puliamo la giornata reale per sicurezza (es: 15 o "15")
    const numeroGwReale = String(gwReale).replace(/\D/g, '');

    // 🔄 LOGICA INVERTITA PER IL TUO DB: 
    // Cerchiamo il numero della giornata reale dentro la CHIAVE (k) pulendola da eventuali testi
    const entry = Object.entries(associazioniGwRealiMap || {}).find(([k, v]) => {
      const numeroChiaveMappa = String(k).replace(/\D/g, '');
      return numeroChiaveMappa === numeroGwReale;
    });

    if (!entry) {
      container.innerHTML = `
        <div style="text-align:center; padding: 2rem; color:var(--text2);">
          <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">🔴 Live Match non attivo</p>
          <p style="font-size: 0.85rem; opacity: 0.7;">Nessun match di lega pianificato per la Giornata Reale ${gwReale}.</p>
        </div>`;
      return;
    }

    // 🔄 LA GIORNATA DI LEGA (es: "gw1") ORA SI TROVA NEL VALORE (entry[1])
    const gwCompetizione = entry[1]; 
    container.innerHTML = `<p style="text-align:center; padding: 2rem; color:var(--text2);">Caricamento dati live...</p>`;

    if (!this.myTeamId) {
      container.innerHTML = `<p style="text-align:center; padding: 2rem; color:var(--text2);">Errore: ID Squadra mancante.</p>`;
      return;
    }

    // Puntiamo al nodo corretto su Firebase usando la gwCompetizione ("gw1", "gw2", ecc.)
    const livePath = `competitions/${this.currentCompId}/matches/${gwCompetizione}`;
    
    // Ascoltatore Firebase ottimizzato con Promise.all per scaricare tutto in parallelo
    this.activeListener = onValue(ref(this.db, livePath), async (snapshot) => {
      const data = snapshot.val() || {};
      const lineups = data.lineups || {};
      const couples = data.couples || {}; 
      
      let opponentTeamId = null;

      // Cerchiamo in quale coppia giochiamo e chi è l'avversario
      for (const key in couples) {
        const match = couples[key];
        if (String(match.homeId) === String(this.myTeamId)) {
          opponentTeamId = String(match.awayId);
          break;
        } else if (String(match.awayId) === String(this.myTeamId)) {
          opponentTeamId = String(match.homeId);
          break;
        }
      }

      // Estraiamo le formazioni dal nodo lineups
      const myData = lineups[this.myTeamId]; 
      const oppData = opponentTeamId ? lineups[opponentTeamId] : null;

      try {
        // 🔄 RECUPERO VOTI LIVE DALLA GIORNATA REALE SPECIFICA
        const [vSnap, pSnap] = await Promise.all([
          get(ref(this.db, `votes/gw${numeroGwReale}`)),
          get(ref(this.db, 'players'))
        ]);

        this.renderLiveScreen(
          container, 
          myData, 
          oppData, 
          vSnap.val() || {}, 
          pSnap.val() || {}, 
          gwCompetizione
        );
      } catch (err) {
        console.error("Errore nel recupero dati live:", err);
        container.innerHTML = `<p style="text-align:center; padding: 2rem; color:var(--text2);">Errore di sincronizzazione dati.</p>`;
      }
    });
  },

  stopLiveTracking() {
    if (this.activeListener) {
      this.activeListener();
      this.activeListener = null;
    }
  },

  renderLiveScreen(container, myData, oppData, votes, players, gwLabel) {
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

    const generateTeamMarkup = (teamData, title) => {
      if (!teamData || !teamData.titolari) {
        return `
          <div style="flex: 1; min-width: 280px;">
            <div class="label" style="margin-bottom:0.6rem; font-size:0.85rem; color:var(--accent);">${title}</div>
            <div style="text-align:center; padding: 2rem; background: var(--bg3); border-radius: 8px; color:var(--text2); border: 1px dashed rgba(255,255,255,0.05);">
              <p style="font-size:0.9rem;">Formazione non schierata</p>
            </div>
          </div>`;
      }

      let totPuntiTitolari = 0;
      const titolariMapped = teamData.titolari.map(mapPlayer);
      const panchinaMapped = (teamData.panchina || []).map(mapPlayer);

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
        panchinaHTML = `<p style="text-align:center; font-size:0.75rem; color:var(--text2); opacity:0.6; padding:0.5rem 0;">Nessun panchinaro</p>`;
      }

      const moduloText = teamData.modulo ? `(${teamData.modulo})` : '';

      return `
        <div style="flex: 1; min-width: 280px; background: rgba(0,0,0,0.15); padding: 1rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.02);">
          <div class="label" style="margin-bottom:1rem; font-size:0.9rem; font-weight:bold; color:var(--text1); text-align:center; letter-spacing: 0.5px;">
            ${title} <span style="font-size:0.75rem; color:var(--text2); font-weight:normal;">${moduloText}</span>
          </div>
          
          <div class="label" style="margin-bottom:0.6rem; font-size:0.75rem; opacity:0.7;">Titolari</div>
          <div style="margin-bottom: 1.5rem;">
            ${titolariHTML}
          </div>

          <div class="label" style="margin-bottom:0.6rem; font-size:0.75rem; opacity:0.7;">Panchina</div>
          <div style="margin-bottom: 1.5rem; opacity: 0.85;">
            ${panchinaHTML}
          </div>

          <div style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 1rem; display:flex; justify-content:space-between; align-items:center;">
            <span class="label" style="margin:0; font-size:0.75rem;">Punteggio Parziale</span>
            <span style="font-size:1.4rem; font-weight:700; color:var(--accent); font-family:'DM Mono',monospace;">
              ${totPuntiTitolari.toFixed(1)}
            </span>
          </div>
        </div>
      `;
    };

    container.innerHTML = `
      <div class="card" style="margin-top: 0.5rem;">
        <div class="sec" style="justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <div style="display:flex; align-items:center; gap:0.5rem; font-weight:bold;">
            <span style="color: var(--accent3); animation: pulse 1.5s infinite;">🔴</span> LIVE MATCH
          </div>
          <span style="font-size: 0.85rem; background: var(--bg3); padding: 0.2rem 0.6rem; border-radius: 20px; color: var(--text2); font-weight: 500;">
            ${gwLabel.toUpperCase()}
          </span>
        </div>

        <div style="display: flex; flex-wrap: wrap; gap: 1.5rem;">
          ${generateTeamMarkup(myData, "LA TUA SQUADRA")}
          ${oppData ? generateTeamMarkup(oppData, "SQUADRA AVVERSARIA") : generateTeamMarkup(null, "SQUADRA AVVERSARIA")}
        </div>
      </div>
    `;
  }
};
