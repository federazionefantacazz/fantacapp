/**
 * calendario-sync-reale.js
 * Responsabilità: allineare le giornate delle competizioni al calendario reale della lega
 * (accoppiamenti + giornata di Serie A associata) e, per la Space Iks Cup, la composizione dei gironi.
 *
 * Copre solo le giornate fino alla 7ª di Serie A: le giornate successive non vengono toccate.
 * Per le giornate già giocate (4ª–6ª di Serie A) inserisce anche le formazioni reali.
 * I risultati non vengono considerati: un incontro già presente con la stessa coppia casa/trasferta
 * viene mantenuto così com'è, gli altri vengono ricreati vuoti.
 */

import { getDatabase, ref, get, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { CalendarioState } from './calendario-state.js';
import { CalendarioUI } from './calendario-ui.js';

/*
 * ID squadre (nodo teams):
 *   1 SSC Crociere · AL Acqua Lilia 50cl · AST AS Tronzi · BS Benfica Sozinha · FE R.Z. Feyesuud
 *   MDF Muro di Fumo · MR Marescapoli · OM Omeh · OV Olympique Ventriglia · PSP Paris Saint Peace-elli
 *   QG Quarenta a Girlfriend · SD Shaktar Donisisk
 * Ogni giornata: [giornata Serie A, [[casa, trasferta], ...]]
 */
const CALENDARIO_REALE = [
  {
    key: 'fantacazz',
    label: 'FANTACAZZ (campionato)',
    guess: (n) => n.includes('fantacazz') && !/cannon|space|iks|super|fessa/.test(n),
    giornate: [
      [4, [['MR', 'FE'], ['BS', 'OV'], ['AL', 'OM'], ['1', 'MDF'], ['AST', 'SD'], ['QG', 'PSP']]],
      [5, [['FE', 'QG'], ['SD', 'BS'], ['PSP', '1'], ['OM', 'MR'], ['OV', 'AL'], ['MDF', 'AST']]],
      [6, [['1', 'FE'], ['AL', 'BS'], ['AST', 'PSP'], ['MR', 'OV'], ['QG', 'OM'], ['MDF', 'SD']]],
      [7, [['FE', 'AST'], ['SD', 'AL'], ['BS', 'MR'], ['PSP', 'MDF'], ['OM', '1'], ['OV', 'QG']]]
    ]
  },
  {
    key: 'cannoni',
    label: 'COPPA DEI CANNONI (fase a gironi)',
    guess: (n) => n.includes('cannon'),
    giornate: [
      [5, [['AL', 'FE'], ['1', 'BS'], ['MR', 'AST'], ['SD', 'QG'], ['PSP', 'OM'], ['OV', 'MDF']]],
      [6, [['FE', '1'], ['QG', 'AL'], ['MDF', 'MR'], ['OM', 'OV'], ['BS', 'PSP'], ['AST', 'SD']]],
      [7, [['PSP', 'FE'], ['1', 'AL'], ['MR', 'OM'], ['SD', 'MDF'], ['OV', 'BS'], ['AST', 'QG']]]
    ]
  },
  {
    key: 'spaceiks',
    label: 'SPACE IKS CUP (fase a gruppi)',
    guess: (n) => n.includes('space') || n.includes('iks'),
    gironi: {
      A: ['QG', 'PSP', 'AST'],
      B: ['AL', '1', 'OV'],
      C: ['BS', 'MDF', 'SD'],
      D: ['OM', 'FE', 'MR']
    },
    giornate: [
      // Riposano: AST (A), OV (B), SD (C), MR (D)
      [6, [['QG', 'PSP', 'A'], ['AL', '1', 'B'], ['BS', 'MDF', 'C'], ['OM', 'FE', 'D']]]
    ]
  }
];

/*
 * Formazioni schierate nel fantacalcio reale, per giornata di Serie A e squadra:
 * [modulo, titolari (ID in ordine), panchina (ID in ordine di sostituzione)].
 * Valgono per tutte le competizioni che giocano quella giornata di Serie A.
 * Gli ID sono quelli del nodo players, indipendentemente dalla squadra attuale del giocatore.
 */
const FORMAZIONI_REALI = {
  4: {
    '1': ['3-4-3', '4431,7329,5833,4409,4856,2077,6190,1870,309,6646,5995', '7626,4,7621,4137,256,7070,6010,4777,6831,2832,6434'],
    'MDF': ['4-3-3', '4964,1852,7469,6989,6867,7223,1850,2194,6060,4923,7023', '7603,7332,7220,5678,5010,7060,6398,2423,6530,7120,7620'],
    'AL': ['5-4-1', '6966,2816,4976,6869,5022,4502,2517,4179,2606,7625,2764', '6344,2809,7131,6664,4210,5507,5878,5844,2061,7561,7612'],
    'OM': ['4-3-3', '6248,6727,2296,254,6320,6684,2848,1933,7252,6967,5436', '6534,133,6202,6485,4263,6151,7551,4973,4463,2155,7351'],
    'BS': ['4-4-2', '5841,7181,2514,2788,5877,536,5559,5792,795,6572,5951', '2134,610,6632,6495,6896,5589,4287,6015,6669,5882,7623'],
    'OV': ['3-4-3', '4360,4705,5641,4159,5800,6252,6294,6884,7600,7017,7071', '4236,572,7410,7069,6672,6677,2765,7311,4371,7347,7554'],
    'QG': ['3-4-3', '4312,4317,6042,7414,4436,632,7078,7126,5637,6435,5694', '2815,6813,6660,4734,7235,7129,5858,6680,6145,7001,7161'],
    'PSP': ['3-4-3', '6462,6631,4177,7599,6844,6875,779,6274,4871,2137,6752', '543,7611,5739,554,5701,6678,7535,5301,7547,6519,7622'],
    'AST': ['3-5-2', '4485,5365,4998,5620,6506,5119,6618,7556,6827,6204,6397', '6415,7301,4657,6496,4952,5823,7472,5888,5734,6904,7484'],
    'SD': ['4-4-2', '2521,5514,2120,4807,6531,4465,2379,7412,5172,4359,2097', '6403,6662,5555,5862,5675,4911,5680,5791,6675,7374,7449'],
    'MR': ['4-3-3', '6482,7485,5750,7219,5885,5687,184,7436,531,5585,7523', '7337,7534,5578,4994,7268,6372,7618,4892,6229,608,7272'],
    'FE': ['4-3-3', '5116,4887,5526,6217,4378,6908,152,4220,2038,6052,4896', '2814,2170,7580,4664,4751,7314,4479,5036,6164,6215,2012']
  },
  5: {
    'PSP': ['3-4-3', '6462,5701,5739,7599,6844,6875,7036,6274,6752,2137,4871', '7611,543,6631,554,4177,6678,5301,779,7547,6519,7622'],
    '1': ['4-4-2', '4431,4137,4409,5833,7621,6190,4364,1870,4856,309,5995', '7626,4,7329,256,6956,7070,6010,2077,6831,2832,6434'],
    'FE': ['3-4-3', '2170,7580,6217,4887,7314,152,6908,5500,6052,4896,2038', '5116,2814,5526,4378,4664,6666,4220,4479,6164,6215,2012'],
    'QG': ['3-4-3', '4312,4317,4734,7414,4436,632,7078,7126,6435,5694,5637', '2815,6813,6047,7212,7235,7129,2528,5858,7001,7161,6145'],
    'SD': ['4-3-3', '6662,2120,5675,5862,5555,2167,5172,2379,7374,2097,4359', '2521,6403,4807,6531,7253,7412,4465,4911,6675,7342,7449'],
    'BS': ['4-4-2', '5841,7181,6495,2788,5877,536,4287,5792,5559,5951,6572', '2134,610,6632,6642,6896,5589,795,5674,6669,7623,5882'],
    'OM': ['4-4-2', '133,2296,254,6727,6320,1933,2848,6684,4973,4463,6967', '6534,6248,6766,4263,6202,6151,6020,7551,5436,7252,2155'],
    'MR': ['3-4-3', '6482,7485,5750,4994,6372,5687,7436,2766,7523,5585,531', '7337,7534,7268,5578,7219,184,7618,4892,6229,7272,608'],
    'OV': ['3-4-3', '4236,4159,6021,5641,5800,6677,2765,6884,4371,7017,7554', '4360,572,4705,7069,7410,7311,6294,6252,7071,7600,7347'],
    'AL': ['4-4-2', '6966,2816,6869,5022,7131,7223,2517,4179,2606,2764,2061', '6344,2809,6664,4976,4502,5844,5878,6783,6530,7612,7561'],
    'MDF': ['4-3-3', '7332,5678,7220,6989,6867,1850,2423,7625,6060,4923,7023', '4964,7603,1852,7469,5010,7060,6398,22,7620,7120,7349'],
    'AST': ['4-3-3', '6415,6496,5620,4998,7563,6618,6827,5823,6204,6397,5734', '7301,4485,4657,5365,4952,7556,7472,5119,6904,7484,5029']
  },
  6: {
    '1': ['4-3-3', '4431,6956,4409,5833,7621,4777,4856,1870,309,6831,5995', '7626,4,7329,256,4137,2077,7070,6010,6646,6434,2832'],
    'FE': ['4-3-3', '2170,7580,6217,4887,5526,7314,152,4479,6052,2038,4896', '5116,2814,4378,4664,4751,5500,5036,6666,6164,6215,2012'],
    'AL': ['4-3-3', '6344,7131,4976,5022,2816,2517,2606,4179,2061,2764,6530', '6966,2809,4502,4210,6869,5844,6783,5878,7612,7561,4387'],
    'BS': ['4-4-2', '2134,7181,6632,2788,5877,795,5559,5589,5792,7623,6669', '5841,610,6495,6642,6896,5674,4287,536,5951,6572,5882'],
    'AST': ['3-4-3', '6415,5620,4998,7294,7556,7472,6618,5119,5734,6397,6204', '7301,4485,5365,6496,4657,6827,5823,5888,7484,6904,5029'],
    'PSP': ['3-4-3', '6462,5739,5982,4177,7036,6844,6875,6274,6752,4871,2137', '7611,543,7599,5701,554,7535,5301,6678,6519,7547,7622'],
    'MR': ['3-4-3', '6482,7219,7485,5520,7436,184,5687,6372,7523,5585,531', '7337,7534,5750,4994,7268,7618,2766,4892,608,6229,7272'],
    'OV': ['4-3-3', '572,4159,5641,4705,4433,6677,6294,6884,7600,7071,7017', '4360,4236,6021,7410,6672,7311,5422,6252,7347,7554,4371'],
    'MDF': ['4-4-2', '4964,1852,7220,6989,6867,2423,2194,7625,6398,6060,7023', '7332,7603,7469,5010,2724,1850,7060,22,7349,7120,7620'],
    'SD': ['4-4-2', '2521,6531,5555,5675,2120,4465,4911,2379,2167,7374,4359', '6403,6662,5514,4807,5862,5680,5791,7412,6675,7449,7342'],
    'QG': ['3-4-3', '4312,7414,4317,4734,4436,632,7078,7126,5637,5694,6435', '2815,6813,6042,7212,6047,7129,6680,5858,7001,7161,6145'],
    'OM': ['4-4-2', '133,2296,254,6320,6727,1933,6684,4973,2848,6967,4463', '6534,6248,6485,6202,4263,7551,6020,6151,5436,2155,7351']
  }
};

const toArr = (n) => (!n ? [] : (Array.isArray(n) ? n : Object.values(n))).filter(v => v !== null && v !== undefined).map(String);
const isBye = (id) => /BYE|RIPOSO/i.test(String(id ?? ''));
const gwNum = (k) => parseInt(String(k).replace(/\D/g, '')) || 0;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const teamName = (id) => CalendarioState.getTeam(id)?.name || id;

/** Normalizza associazioniGwReali nel formato { "<giornata Serie A>": "gwX" }. */
function normalizzaMappa(map) {
  const out = {};
  Object.entries(map || {}).forEach(([k, v]) => {
    if (String(v).startsWith('gw') && !String(k).startsWith('gw')) out[String(gwNum(k))] = String(v);
    else if (String(k).startsWith('gw') && !String(v).startsWith('gw')) out[String(gwNum(v))] = String(k);
  });
  return out;
}

/**
 * Abbina ogni girone reale (A, B, ...) a una chiave di strutturaGironi già esistente,
 * scegliendo quella con più squadre in comune, così da non rinominare i gironi nell'app.
 */
function abbinaGironi(gironiReali, strutturaEsistente) {
  const esistenti = Object.keys(strutturaEsistente || {}).sort();
  const lettere = Object.keys(gironiReali);
  if (esistenti.length !== lettere.length) {
    return Object.fromEntries(lettere.map((l, i) => [l, `Girone ${i + 1}`]));
  }
  const coppie = [];
  lettere.forEach(l => esistenti.forEach(k => {
    const comuni = toArr(strutturaEsistente[k]).filter(id => gironiReali[l].includes(id)).length;
    coppie.push({ l, k, comuni });
  }));
  coppie.sort((a, b) => b.comuni - a.comuni || a.l.localeCompare(b.l) || a.k.localeCompare(b.k, undefined, { numeric: true }));
  const res = {};
  const usate = new Set();
  coppie.forEach(({ l, k }) => {
    if (res[l] || usate.has(k)) return;
    res[l] = k;
    usate.add(k);
  });
  return res;
}

/** Calcola tutte le scritture per una competizione + un riepilogo leggibile delle differenze. */
function pianificaCompetizione(def, comp) {
  const log = [];
  const avvisi = [];
  const payload = {};
  const matches = comp.matches || {};
  const teamIds = toArr(comp.teams);

  // Squadre sconosciute o non iscritte
  const squadreReali = new Set(def.giornate.flatMap(([, cs]) => cs.flatMap(c => [c[0], c[1]])));
  squadreReali.forEach(id => {
    if (!CalendarioState.getTeam(id)) avvisi.push(`Squadra con ID "${id}" non trovata nel nodo teams.`);
    else if (teamIds.length && !teamIds.includes(id)) avvisi.push(`${teamName(id)} non risulta tra le squadre iscritte alla competizione.`);
  });

  // Gironi (solo Space Iks)
  let nomiGironi = null;
  if (def.gironi) {
    nomiGironi = abbinaGironi(def.gironi, comp.strutturaGironi);
    const nuovaStruttura = {};
    Object.entries(def.gironi).forEach(([l, ids]) => { nuovaStruttura[nomiGironi[l]] = [...ids]; });

    const vecchia = comp.strutturaGironi || {};
    const uguale = Object.keys(nuovaStruttura).length === Object.keys(vecchia).length &&
      Object.entries(nuovaStruttura).every(([k, ids]) => {
        const old = toArr(vecchia[k]);
        return old.length === ids.length && ids.every(id => old.includes(id));
      });

    if (uguale) {
      log.push(`<div class="sync-ok"><i class="ri-check-line"></i> Gironi già corretti.</div>`);
    } else {
      payload.strutturaGironi = nuovaStruttura;
      log.push(`<div class="sync-chg"><i class="ri-edit-line"></i> Gironi da correggere:</div>`);
      Object.entries(def.gironi).forEach(([l, ids]) => {
        const k = nomiGironi[l];
        const old = toArr(vecchia[k]);
        if (old.length === ids.length && ids.every(id => old.includes(id))) return;
        log.push(`<div class="sync-row">${esc(k)} (Gruppo ${l}): <s>${toArr(vecchia[k]).map(teamName).map(esc).join(', ') || '—'}</s> → <b>${ids.map(teamName).map(esc).join(', ')}</b></div>`);
      });
    }
  }

  // Associazione giornate Serie A
  const mappaVecchia = normalizzaMappa(comp.associazioniGwReali || comp.associazioniGwRealiMap);
  const mappaNuova = { ...mappaVecchia };

  def.giornate.forEach(([serieA, coppie], idx) => {
    const gwKey = `gw${idx + 1}`;
    const vecchie = Object.values(matches[gwKey]?.couples || {}).filter(Boolean);

    // Associazione: rimuove altre giornate Serie A puntate su gwKey e fissa serieA -> gwKey
    Object.keys(mappaNuova).forEach(r => { if (mappaNuova[r] === gwKey && r !== String(serieA)) delete mappaNuova[r]; });
    const precedente = mappaVecchia[String(serieA)];
    mappaNuova[String(serieA)] = gwKey;

    // Incontri
    const couples = {};
    let cambiati = 0;
    coppie.forEach(([home, away, gruppo], i) => {
      const mKey = `m${i + 1}`;
      const girone = gruppo ? nomiGironi[gruppo] : null;
      const esistente = vecchie.find(c => String(c.homeId) === home && String(c.awayId) === away);
      if (esistente) {
        couples[mKey] = { ...esistente, id: mKey, ...(girone ? { girone } : {}) };
        if (girone && esistente.girone !== girone) cambiati++;
      } else {
        couples[mKey] = { id: mKey, homeId: home, awayId: away, homeScore: null, awayScore: null, finished: false, ...(girone ? { girone } : {}) };
        cambiati++;
      }
    });
    const realiNonBye = vecchie.filter(c => !isBye(c.homeId) && !isBye(c.awayId));
    if (realiNonBye.length !== coppie.length) cambiati++;

    // Formazioni reali delle squadre in campo (giornate già giocate)
    const formazioni = FORMAZIONI_REALI[serieA] || {};
    const lineupsVecchie = matches[gwKey]?.lineups || {};
    const formazioniDaScrivere = [];
    coppie.flatMap(([h, a]) => [h, a]).forEach(teamId => {
      const f = formazioni[teamId];
      if (!f) return;
      const [modulo, tit, pan] = f;
      const titolari = tit.split(',');
      const panchina = pan.split(',');
      const old = lineupsVecchie[teamId];
      if (old && old.modulo === modulo && toArr(old.titolari).join() === tit && toArr(old.panchina).join() === pan) return;
      payload[`matches/${gwKey}/lineups/${teamId}`] = {
        teamId, modulo, titolari, panchina,
        kit: old?.kit === 2 ? 2 : 1,
        timestamp: old?.timestamp || Date.now()
      };
      formazioniDaScrivere.push(teamId);
    });

    const titolo = `${idx + 1}ª di Lega (${gwKey}) → ${serieA}ª Serie A`;
    const mappaOk = precedente === gwKey && !Object.entries(mappaVecchia).some(([r, g]) => g === gwKey && r !== String(serieA));

    if (!cambiati && mappaOk && !formazioniDaScrivere.length) {
      log.push(`<div class="sync-ok"><i class="ri-check-line"></i> ${esc(titolo)}: già corretta.</div>`);
      return;
    }

    log.push(`<div class="sync-chg"><i class="ri-edit-line"></i> ${esc(titolo)}</div>`);
    if (!mappaOk) {
      const vecchieReali = Object.entries(mappaVecchia).filter(([, g]) => g === gwKey).map(([r]) => `${r}ª`).join(', ') || 'nessuna';
      log.push(`<div class="sync-row">Associazione Serie A: <s>${esc(vecchieReali)}</s> → <b>${serieA}ª</b>${precedente && precedente !== gwKey ? ` (la ${serieA}ª era su ${esc(precedente)})` : ''}</div>`);
    }
    if (cambiati) {
      payload[`matches/${gwKey}/couples`] = couples;
      const prima = realiNonBye.map(c => `${teamName(c.homeId)} - ${teamName(c.awayId)}`).map(esc).join(' · ') || '—';
      const dopo = coppie.map(([h, a, g]) => `${g ? `[${g}] ` : ''}${teamName(h)} - ${teamName(a)}`).map(esc).join(' · ');
      log.push(`<div class="sync-row"><span style="color:var(--text3)">Prima:</span> <s>${prima}</s></div>`);
      log.push(`<div class="sync-row"><span style="color:var(--text3)">Dopo:</span> <b>${dopo}</b></div>`);
    }
    if (formazioniDaScrivere.length) {
      log.push(`<div class="sync-row">Formazioni reali da inserire: <b>${formazioniDaScrivere.map(teamName).map(esc).join(', ')}</b></div>`);
    }
  });

  const mappaCambiata = JSON.stringify(Object.entries(mappaNuova).sort()) !== JSON.stringify(Object.entries(mappaVecchia).sort()) ||
    !comp.associazioniGwReali;
  if (mappaCambiata) payload.associazioniGwReali = mappaNuova;

  // Giornate successive (non toccate): segnala incontri incompatibili con i nuovi gironi
  if (def.gironi && payload.strutturaGironi) {
    const gruppoDi = {};
    Object.entries(def.gironi).forEach(([l, ids]) => ids.forEach(id => { gruppoDi[id] = l; }));
    Object.keys(matches).filter(k => /^gw\d+$/.test(k) && gwNum(k) > def.giornate.length).forEach(k => {
      const errati = Object.values(matches[k]?.couples || {}).filter(c => c && !isBye(c.homeId) && !isBye(c.awayId) && !c.phaseKey && !/^(ELIMINAZIONE|FINALE)/i.test(String(c.type || '')))
        .filter(c => gruppoDi[String(c.homeId)] && gruppoDi[String(c.homeId)] !== gruppoDi[String(c.awayId)]);
      if (errati.length) avvisi.push(`${k}: ${errati.length} incontri tra squadre di gironi diversi (giornata successiva alla 7ª di Serie A, non modificata).`);
    });
  }

  return { payload, log, avvisi };
}

/* ─── UI ──────────────────────────────────────────────────────────────────── */

export const CalendarioSyncReale = {
  renderHTML() {
    return `
      <div class="card" id="syncRealeCard" style="max-width: 650px;">
        <style>
          #syncRealeCard .sync-ok { color: var(--accent); font-size: .8rem; margin-top: .35rem; }
          #syncRealeCard .sync-chg { color: var(--gold); font-size: .8rem; margin-top: .5rem; font-weight: 600; }
          #syncRealeCard .sync-row { color: var(--text2); font-size: .75rem; margin: .15rem 0 0 1.1rem; line-height: 1.35; }
          #syncRealeCard .sync-warn { color: var(--accent3); font-size: .75rem; margin-top: .3rem; }
          #syncRealeCard s { opacity: .6; }
        </style>
        <div class="label" style="color: var(--accent); font-weight: 600; border-bottom: 1px solid var(--border); padding-bottom: .5rem; margin-bottom: .75rem;"><i class="ri-git-merge-line"></i> Allinea al calendario reale (fino alla 7ª di Serie A)</div>
        <div style="font-size: .75rem; color: var(--text3); margin-bottom: .75rem;">Imposta accoppiamenti, giornata di Serie A associata e (Space Iks Cup) composizione dei gironi come nel calendario ufficiale della lega, e inserisce le formazioni reali della 4ª, 5ª e 6ª di Serie A. Le giornate successive non vengono toccate. Dopo l'applicazione, ricalcola quelle giornate dalla Dashboard.</div>
        <div id="syncRealeSelects" style="display:flex; flex-direction:column; gap:.5rem;"></div>
        <button class="btn btn-blue" style="width:100%; margin-top:.75rem;" onclick="window.anteprimaSyncReale()"><i class="ri-eye-line"></i> Anteprima modifiche</button>
        <div id="syncRealePreview" style="margin-top:.75rem;"></div>
      </div>`;
  },

  render() {
    const box = document.getElementById('syncRealeSelects');
    if (!box) return;
    const comps = CalendarioState.getCompetizioniList();
    const prev = {};
    box.querySelectorAll('select[data-sync]').forEach(s => { prev[s.dataset.sync] = s.value; });

    box.innerHTML = CALENDARIO_REALE.map(def => {
      const guessed = comps.find(c => def.guess(String(c.name || c.id).toLowerCase()));
      const selected = prev[def.key] !== undefined ? prev[def.key] : (guessed?.id || '');
      const opts = comps.map(c => `<option value="${esc(c.id)}" ${c.id === selected ? 'selected' : ''}>${esc(c.name)} (${esc(c.id)})</option>`).join('');
      return `
        <div style="display:flex; align-items:center; gap:.5rem; background: var(--bg2); padding:.5rem .75rem; border-radius:6px; border:1px solid var(--border);">
          <div style="min-width: 190px; font-size:.8rem; color: var(--text2);">${esc(def.label)}</div>
          <select class="input-login" data-sync="${def.key}" style="flex:1; margin-bottom:0; background: var(--bg3); color:#fff; padding:.3rem .5rem; font-size:.8rem;">
            <option value="" ${selected ? '' : 'selected'}>— Non modificare —</option>${opts}
          </select>
        </div>`;
    }).join('');
  }
};

let _piano = null;

async function calcolaPiano() {
  const database = CalendarioState.db || getDatabase();
  const scelte = {};
  document.querySelectorAll('#syncRealeSelects select[data-sync]').forEach(s => { if (s.value) scelte[s.dataset.sync] = s.value; });

  const ids = Object.values(scelte);
  if (new Set(ids).size !== ids.length) throw new Error('La stessa competizione è selezionata più volte.');

  const piano = [];
  for (const def of CALENDARIO_REALE) {
    const compId = scelte[def.key];
    if (!compId) continue;
    const snap = await get(ref(database, `competitions/${compId}`));
    if (!snap.exists()) throw new Error(`Competizione ${compId} non trovata.`);
    const comp = { id: compId, ...snap.val() };
    piano.push({ def, compId, comp, ...pianificaCompetizione(def, comp) });
  }
  return piano;
}

window.anteprimaSyncReale = async function () {
  const out = document.getElementById('syncRealePreview');
  if (!out) return;
  out.innerHTML = '<div style="font-size:.8rem; color:var(--text3);">Calcolo in corso...</div>';
  try {
    _piano = await calcolaPiano();
  } catch (err) {
    console.error(err);
    _piano = null;
    out.innerHTML = `<div class="sync-warn"><i class="ri-error-warning-line"></i> ${esc(err.message)}</div>`;
    return;
  }
  if (!_piano.length) {
    out.innerHTML = '<div style="font-size:.8rem; color:var(--text3);">Nessuna competizione selezionata.</div>';
    return;
  }

  const daScrivere = _piano.filter(p => Object.keys(p.payload).length);
  out.innerHTML = _piano.map(p => `
    <div style="background: var(--bg2); border:1px solid var(--border); border-radius:6px; padding:.6rem .75rem; margin-bottom:.5rem;">
      <div style="font-weight:600; font-size:.85rem; color:#fff;">${esc(p.comp.name || p.compId)} <span style="color:var(--text3); font-weight:400;">· ${esc(p.def.label)}</span></div>
      ${p.log.join('')}
      ${p.avvisi.map(a => `<div class="sync-warn"><i class="ri-alert-line"></i> ${esc(a)}</div>`).join('')}
    </div>`).join('') + (daScrivere.length
    ? `<button class="btn btn-green" style="width:100%;" onclick="window.applicaSyncReale()"><i class="ri-save-line"></i> Applica modifiche su Firebase (${daScrivere.length} competizion${daScrivere.length === 1 ? 'e' : 'i'})</button>`
    : '<div class="sync-ok"><i class="ri-check-double-line"></i> Tutto già allineato al calendario reale.</div>');
};

window.applicaSyncReale = async function () {
  if (!_piano) return window.toast?.('Calcola prima l\'anteprima.', 'err');
  const daScrivere = _piano.filter(p => Object.keys(p.payload).length);
  if (!daScrivere.length) return;
  if (!confirm(`Scrivere su Firebase le modifiche per: ${daScrivere.map(p => p.comp.name || p.compId).join(', ')}?`)) return;

  try {
    // Ricalcola sui dati più recenti prima di scrivere
    const fresco = await calcolaPiano();
    const database = CalendarioState.db || getDatabase();
    for (const p of fresco) {
      if (!Object.keys(p.payload).length) continue;
      await update(ref(database, `competitions/${p.compId}`), p.payload);
      const local = CalendarioState.getCompetizione(p.compId);
      if (local && p.payload.strutturaGironi) local.strutturaGironi = p.payload.strutturaGironi;
      if (local && p.payload.associazioniGwReali) local.associazioniGwReali = p.payload.associazioniGwReali;
    }
    window.toast?.('Calendario allineato al calendario reale!', 'ok');
    if (window.CURRENT_COMPETITION) {
      CalendarioUI.updateBadgeDinamici(window.CURRENT_COMPETITION);
      window.caricaGwMapping?.(window.CURRENT_COMPETITION);
    }
    await window.anteprimaSyncReale();
  } catch (err) {
    console.error(err);
    window.toast?.('Errore durante il salvataggio su Firebase', 'err');
  }
};
