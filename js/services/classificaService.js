export const ClassificaService = {
  /** La fase è la finale (gara secca anche nei tabelloni andata/ritorno)? Le semifinali no. */
  isFinale(nomeFase) {
    const n = String(nomeFase || '').toLowerCase();
    return n.includes('final') && !n.includes('semi');
  },

  
  /**
   * Calcola le statistiche dettagliate di tutte le squadre basandosi sui dati del database.
   */
  calcolaStatistiche(compTeams, classificaDbNode) {
    const teamCalculatedStats = {};
    
    compTeams.forEach(t => {
      teamCalculatedStats[t.id] = {
        giocate: 0,
        pts: 0,
        w: 0,
        d: 0,
        l: 0,
        totFanta: 0,
        gf: 0,
        gs: 0
      };
    });

    Object.keys(classificaDbNode).forEach(gwKey => {
      const gwObj = classificaDbNode[gwKey];
      if (gwObj && typeof gwObj === 'object') {
        Object.keys(gwObj).forEach(teamId => {
          const stats = gwObj[teamId];
          if (!teamCalculatedStats[teamId]) {
            teamCalculatedStats[teamId] = { giocate: 0, pts: 0, w: 0, d: 0, l: 0, totFanta: 0, gf: 0, gs: 0 };
          }
          teamCalculatedStats[teamId].giocate += 1;
          teamCalculatedStats[teamId].pts += Number(stats.punti || 0);
          teamCalculatedStats[teamId].w += Number(stats.vittoria || 0);
          teamCalculatedStats[teamId].d += Number(stats.pareggio || 0);
          teamCalculatedStats[teamId].l += Number(stats.sconfitta || 0);
          teamCalculatedStats[teamId].totFanta += Number(stats.punteggiofanta || 0);
          teamCalculatedStats[teamId].gf += Number(stats.golFatti || 0);
          teamCalculatedStats[teamId].gs += Number(stats.golSubiti || 0);
        });
      }
    });

    return teamCalculatedStats;
  },

  /** Statistiche vuote di una squadra. */
  statsVuote() {
    return { giocate: 0, pts: 0, w: 0, d: 0, l: 0, totFanta: 0, gf: 0, gs: 0 };
  },

  /**
   * Aggiunge un risultato (gol e punti fanta facoltativi) alle statistiche di una squadra.
   * esito: 'V' | 'N' | 'P'. Restituisce lo stesso oggetto stats.
   */
  aggiungiRisultato(stats, teamId, { esito, gf = 0, gs = 0, fanta = 0 }) {
    const s = stats[teamId] || (stats[teamId] = this.statsVuote());
    s.giocate += 1;
    if (esito === 'V') { s.w += 1; s.pts += 3; }
    else if (esito === 'N') { s.d += 1; s.pts += 1; }
    else { s.l += 1; }
    s.gf += Number(gf) || 0;
    s.gs += Number(gs) || 0;
    s.totFanta += Number(fanta) || 0;
    return stats;
  },

  /** Copia profonda delle statistiche (per sommarci risultati live o simulati senza toccare quelle ufficiali). */
  copiaStatistiche(stats) {
    const out = {};
    Object.keys(stats || {}).forEach(id => { out[id] = { ...stats[id] }; });
    return out;
  },

  /** Posizione (0 = primo) di ogni squadra della lista: { teamId: indice }. */
  mappaPosizioni(teamsList, stats) {
    const out = {};
    this.ordinaSquadre(teamsList, stats).forEach((t, i) => { out[String(t.id)] = i; });
    return out;
  },

  /**
   * Ordina una lista di squadre in base a Punti e Totale Fanta.
   */
  ordinaSquadre(teamsList, teamCalculatedStats) {
    return [...teamsList].sort((a, b) => {
      const statsA = teamCalculatedStats[a.id] || {};
      const statsB = teamCalculatedStats[b.id] || {};
      const ptsDiff = (statsB.pts || 0) - (statsA.pts || 0);
      if (ptsDiff !== 0) return ptsDiff;
      return (statsB.totFanta || 0) - (statsA.totFanta || 0);
    });
  },

  /**
   * Squadre che partecipano davvero alla competizione (comp.teams).
   * Se la competizione non ha un elenco iscritti, ripiega sulle squadre presenti
   * nella classifica salvata e, in ultima istanza, su tutte le squadre.
   */
  getSquadreCompetizione(comp, allTeams = []) {
    const toArr = (n) => (!n ? [] : (Array.isArray(n) ? n : Object.values(n)));
    let ids = toArr(comp?.teams).filter(id => id !== null && id !== undefined).map(String);

    if (ids.length === 0) {
      const set = new Set();
      Object.values(comp?.classifica || {}).forEach(gw => {
        if (gw && typeof gw === 'object') Object.keys(gw).forEach(id => set.add(String(id)));
      });
      ids = [...set];
    }
    if (ids.length === 0) return [...allTeams];

    const idSet = new Set(ids);
    return allTeams.filter(t => t && idSet.has(String(t.id)));
  },

  /** Squadre del girone in cui gioca teamId (competizioni miste). Ritorna { nome, squadre } o null. */
  getGironeDiSquadra(comp, teamId, allTeams = []) {
    const gironi = comp?.strutturaGironi;
    if (!gironi) return null;
    const toArr = (n) => (!n ? [] : (Array.isArray(n) ? n : Object.values(n)));

    for (const nome of Object.keys(gironi).sort()) {
      const ids = toArr(gironi[nome]).filter(Boolean).map(String);
      if (ids.includes(String(teamId))) {
        const squadre = ids.map(id => allTeams.find(t => String(t.id) === id)).filter(Boolean);
        return { nome, squadre };
      }
    }
    return null;
  },

  /**
   * Elabora i risultati dei match e restituisce la mappa dei vincitori per il tabellone a eliminazione.
   */
  risolviVincitoriTabellone(tabelloneStructure, matchesMap) {
    if (!tabelloneStructure || !tabelloneStructure.fasi) return { matchResultsMap: {}, resolvedWinners: {} };

    const fasi = tabelloneStructure.fasi;
    const chiaviFasi = Object.keys(fasi).sort();

    const modalita = tabelloneStructure.regolaIncontri || tabelloneStructure.tipoScontro || tabelloneStructure.modalita;
    const isAndataRitorno = modalita === 'andata-ritorno' || modalita === 'andata_ritorno';

    const matchResultsMap = {};

    Object.keys(matchesMap).forEach(gwKey => {
      const couples = matchesMap[gwKey]?.couples || {};
      Object.keys(couples).forEach(cKey => {
        const matchData = couples[cKey];
        if (!matchData) return;

        if (cKey.endsWith('_ritorno')) {
          const baseId = cKey.replace('_ritorno', '');
          matchResultsMap[baseId] = matchResultsMap[baseId] || {};
          matchResultsMap[baseId].ritorno = matchData;
        } else {
          matchResultsMap[cKey] = matchResultsMap[cKey] || {};
          matchResultsMap[cKey].andata = matchData;
        }
      });
    });

    const resolvedWinners = {};

    chiaviFasi.forEach((faseKey) => {
      const faseObj = fasi[faseKey];
      const matchList = faseObj.matchList || [];

      matchList.forEach((m) => {
        const matchId = m.id;
        const res = matchResultsMap[matchId] || {};
        const isFinale = this.isFinale(faseObj.nomeFase);

        let vincenteId = null;

        if (!isAndataRitorno || isFinale) {
          if (res.andata && res.andata.finished) {
            const gH = Number(res.andata.goalHome ?? res.andata.homeScore ?? 0);
            const gA = Number(res.andata.goalAway ?? res.andata.awayScore ?? 0);
            const ptH = Number(res.andata.punteggioFinaleHome || 0);
            const ptA = Number(res.andata.punteggioFinaleAway || 0);

            const teamH = res.andata.homeId || res.andata.home;
            const teamA = res.andata.awayId || res.andata.away;

            if (gH > gA) vincenteId = teamH;
            else if (gA > gH) vincenteId = teamA;
            else {
              if (ptH > ptA) vincenteId = teamH;
              else if (ptA > ptH) vincenteId = teamA;
              else vincenteId = teamH;
            }
          }
        } else {
          if (res.andata && res.andata.finished && res.ritorno && res.ritorno.finished) {
            const teamAndataCasa = res.andata.homeId || res.andata.home;
            const teamAndataFuori = res.andata.awayId || res.andata.away;

            let totGolCasa = Number(res.andata.goalHome ?? res.andata.homeScore ?? 0);
            let totGolFuori = Number(res.andata.goalAway ?? res.andata.awayScore ?? 0);
            let totPtCasa = Number(res.andata.punteggioFinaleHome || 0);
            let totPtFuori = Number(res.andata.punteggioFinaleAway || 0);

            const rHomeId = res.ritorno.homeId || res.ritorno.home;

            if (String(rHomeId) === String(teamAndataFuori)) {
              totGolFuori += Number(res.ritorno.goalHome ?? res.ritorno.homeScore ?? 0);
              totGolCasa += Number(res.ritorno.goalAway ?? res.ritorno.awayScore ?? 0);
              totPtFuori += Number(res.ritorno.punteggioFinaleHome || 0);
              totPtCasa += Number(res.ritorno.punteggioFinaleAway || 0);
            } else {
              totGolCasa += Number(res.ritorno.goalHome ?? res.ritorno.homeScore ?? 0);
              totGolFuori += Number(res.ritorno.goalAway ?? res.ritorno.awayScore ?? 0);
              totPtCasa += Number(res.ritorno.punteggioFinaleHome || 0);
              totPtFuori += Number(res.ritorno.punteggioFinaleAway || 0);
            }

            if (totGolCasa > totGolFuori) vincenteId = teamAndataCasa;
            else if (totGolFuori > totGolCasa) vincenteId = teamAndataFuori;
            else {
              if (totPtCasa > totPtFuori) vincenteId = teamAndataCasa;
              else if (totPtFuori > totPtCasa) vincenteId = teamAndataFuori;
              else vincenteId = teamAndataCasa;
            }
          }
        }

        if (vincenteId) {
          resolvedWinners[`VINCENTE_${matchId}`] = vincenteId;
        }
      });
    });

    return { matchResultsMap, resolvedWinners };
  }
};
