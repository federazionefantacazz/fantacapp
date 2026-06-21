import { ref, onValue, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { CalcoloMatchService } from "./services/calcoloMatch.js";

export const LiveMatchModule = {
  db: null,
  currentUserId: null,
  activeListener: null,

  // Salva l'istanza di Firebase e l'utente loggato
  init(database, userId) {
    this.db = database;
    this.currentUserId = userId;
  },

  /**
   * Avvia il tracciamento dei voti real-time e monta l'interfaccia grafica
   */
  startLiveTracking(gwNum) {
    this.stopLiveTracking(); // Pulisce canali vecchi per sicurezza
    
    const container = document.getElementById('live-match-container');
    if (!container) return;

    // Mostra il blocco e inserisce un caricamento iniziale
    container.style.display = 'block';
    container.innerHTML = `<p style="text-align:center; padding: 2rem; color:var(--text2);">Sincronizzazione dati live in corso...</p>`;
    
    const gwId = `gw${gwNum}`;

    try {
      // 1. Recupera la formazione caricata dall'utente per la giornata
      get(ref(this.db, `lineups/${this.currentUserId}/${gwId}`)).then((lineupSnap) => {
        if (!lineupSnap.exists()) {
          container.innerHTML = `
            <div class="card" style="max-width: 600px; margin: 1rem auto; text-align: center;">
              <h3 style="color: var(--accent3); margin-bottom: .5rem;">🔴 LIVE MATCH</h3>
              <p style="color: var(--text2); font-size: .9rem;">
                Non risulta nessuna formazione schierata per la Giornata ${gwNum}.
              </p>
            </div>
          `;
          return;
        }

        const formazione = lineupSnap.val();
        const titolariIds = formazione.titolari || [];
        const panchinaIds = formazione.panchina || [];

        // 2. Apre il canale in tempo reale sui voti della giornata corrente
        const votesRef = ref(this.db, `votes/${gwId}`);
        this.activeListener = onValue(votesRef, (snapshot) => {
          const votiLive = snapshot.val() || {};
          
          // Scarica l'elenco dei giocatori per leggerne nomi e ruoli
          get(ref(this.db, 'players')).then((playersSnap) => {
            const infoGiocatori = playersSnap.val() || {};
            this.renderLiveScreen(container, titolariIds, panchinaIds, votiLive, infoGiocatori, gwNum);
          });
        });
      });

    } catch (error) {
      console.error("Errore nel tracking live:", error);
      container.innerHTML = `<p style="color:var(--accent3); text-align:center;">Impossibile connettersi al live.</p>`;
    }
  },

  /**
   * Costruisce l'interfaccia grafica calcolando live i bonus/malus
   */
  renderLiveScreen(container, titolari, panchina, voti, players, gwNum) {
    let sommaTitolari = 0;
    
    const elaboraRiga = (id) => {
      const pInfo = players[id] || { name: `Giocatore (${id})`, role: "-" };
      const pVoto = voti[id] || { voto: null };
      
      let badgeRuolo = `<span class="badge-ruolo">${pInfo.role}</span>`;
      let stringaVoto = `<span style="color:var(--text3);">S.V.</span>`;
      let stringaFantavoto = `-`;
      let iconeBonus = [];

      if (pVoto.voto !== null && pVoto.voto !== undefined) {
        // Calcola il punteggio live importando il servizio puro js/calcoloMatch.js
        const fantaVoto = CalcoloMatchService.calcolaFantavoto(pVoto);
        stringaVoto = `<span>${pVoto.voto}</span>`;
        stringaFantavoto = `<b style="color: var(--accent); font-size: 1.05rem;">${fantaVoto}</b>`;
        
        if (pVoto.gol) iconeBonus.push(`⚽ x${pVoto.gol}`);
        if (pVoto.assist) iconeBonus.push(`👟 x${pVoto.assist}`);
        if (pVoto.ammonizione) iconeBonus.push(`🟨`);
        if (pVoto.espulsione) iconeBonus.push(`🟥`);
        if (pVoto.autogol) iconeBonus.push(`❌ Ag`);
        if (pVoto.rigore_parato) iconeBonus.push(`🧤 Parato`);
        if (pVoto.rigore_sbagliato) iconeBonus.push(`📉 Sbagliato`);
        if (pVoto.gol_subito) iconeBonus.push(`🥊 Subiti x${pVoto.gol_subito}`);
      }

      return {
        html: `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: .65rem .5rem; border-bottom: 1px solid rgba(255,255,255,0.04);">
            <div style="display: flex; align-items: center; gap: .6rem; flex: 2;">
              ${badgeRuolo}
              <div>
                <div style="font-weight: 500; font-size: .9rem;">${pInfo.name}</div>
                <div style="font-size: .75rem; color: var(--accent); margin-top: .1rem;">${iconeBonus.join(' ')}</div>
              </div>
            </div>
            <div style="flex: 1; text-align: center; font-size: .85rem; color: var(--text2);">Voto: ${stringaVoto}</div>
            <div style="flex: 1; text-align: right;">${stringaFantavoto}</div>
          </div>
        `,
        fantaVal: pVoto.voto !== null ? CalcoloMatchService.calcolaFantavoto(pVoto) : 0
      };
    };

    let htmlTitolari = "";
    titolari.forEach(id => {
      const res = elaboraRiga(id);
      htmlTitolari += res.html;
      sommaTitolari += res.fantaVal;
    });

    let htmlPanchina = "";
    panchina.forEach(id => {
      const res = elaboraRiga(id);
      htmlPanchina += res.html;
    });

    // Iniezione del blocco visivo finale nell'applicazione
    container.innerHTML = `
      <div class="card" style="max-width: 600px; margin: 1rem auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.2rem; border-bottom: 1px solid var(--border); padding-bottom: .6rem;">
          <div>
            <h3 style="margin: 0; color: var(--accent); font-family: 'Bebas Neue', sans-serif; font-size: 1.6rem; letter-spacing: 0.5px;">🔴 LIVE MATCH</h3>
            <span style="font-size: .75rem; color: var(--text2);">Punteggio Formazione - Giornata ${gwNum}</span>
          </div>
          <span class="badge" style="background: var(--accent3); color: #fff; font-size: .7rem; padding: .25rem .5rem; font-weight: 600; border-radius: 4px;">LIVE</span>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <div class="label" style="font-size: .75rem; color: var(--text2); margin-bottom: .4rem;">🛡️ TITOLARI</div>
          <div style="background: rgba(0,0,0,0.15); border-radius: 6px; padding: 0 .4rem;">
            ${htmlTitolari || '<p style="padding:1rem; color:var(--text3); font-size:.85rem;">Nessun titolare schierato</p>'}
          </div>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <div class="label" style="font-size: .75rem; color: var(--text3); margin-bottom: .4rem;">🪑 PANCHINA</div>
          <div style="background: rgba(0,0,0,0.1); border-radius: 6px; padding: 0 .4rem; opacity: 0.7;">
            ${htmlPanchina || '<p style="padding:1rem; color:var(--text3); font-size:.85rem;">Panchina vuota</p>'}
          </div>
        </div>

        <div style="background: var(--bg3); padding: .85rem 1rem; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border);">
          <div>
            <span style="font-size: .85rem; font-weight: 500; color: var(--text);">Totale Parziale</span>
            <div style="font-size: .7rem; color: var(--text2);">(Cambi e modificatori esclusi)</div>
          </div>
          <div style="font-size: 1.8rem; font-weight: bold; color: var(--accent); font-family: 'DM Mono', monospace;">
            ${sommaTitolari.toFixed(1)}
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Spegne l'ascolto e svuota/nasconde l'interfaccia utente
   */
  stopLiveTracking() {
    if (this.activeListener) {
      this.activeListener(); // Stacca il listener real-time di Firebase
      this.activeListener = null;
    }
    const container = document.getElementById('live-match-container');
    if (container) {
      container.style.display = 'none';
      container.innerHTML = "";
    }
  }
};
