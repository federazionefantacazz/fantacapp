export const ClassificaService = {
  
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
   * Elabora i risultati dei match e restituisce la mappa dei vincitori per il tabellone a eliminazione.
   */
  risolviVincitoriTabellone(tabelloneStructure, matchesMap) {
    if (!tabelloneStructure || !tabelloneStructure.fasi) return {};

    const fasi = tabelloneStructure.fasi;
    const chiaviFasi = Object.keys(fasi).sort();

    const modalita = tabelloneStructure.regolaIncontri || tabelloneStructure.tipoScontro || tabelloneStructure.modalita;
    const isAndataRitorno = modalita === 'andata-ritorno' || modalita === 'andata_ritorno';

    const matchResultsMap = {};

    Object.keys(matchesMap).forEach(gwKey => {
      const couples = matchesMap[gwKey].couples || {};
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
        const isFinale = faseObj.nomeFase && faseObj.nomeFase.toLowerCase().includes('final') && !faseObj.nomeFase.toLowerCase().includes('semi');

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

            if (rHomeId === teamAndataFuori) {
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
