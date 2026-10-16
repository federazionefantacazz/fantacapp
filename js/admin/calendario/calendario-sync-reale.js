/**
 * calendario-sync-reale.js
 * Responsabilità: allineare le giornate delle competizioni al calendario reale della lega
 * (accoppiamenti + giornata di Serie A associata) e, per la Space Iks Cup, la composizione dei gironi.
 *
 * Copre solo le giornate fino alla 7ª di Serie A: le giornate successive non vengono toccate.
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

    const titolo = `${idx + 1}ª di Lega (${gwKey}) → ${serieA}ª Serie A`;
    const mappaOk = precedente === gwKey && !Object.entries(mappaVecchia).some(([r, g]) => g === gwKey && r !== String(serieA));

    if (!cambiati && mappaOk) {
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
        <div style="font-size: .75rem; color: var(--text3); margin-bottom: .75rem;">Imposta accoppiamenti, giornata di Serie A associata e (Space Iks Cup) composizione dei gironi come nel calendario ufficiale della lega. Le giornate successive non vengono toccate.</div>
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
