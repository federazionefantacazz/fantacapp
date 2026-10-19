/**
 * Servizio di calcolo condiviso per i voti e bonus/malus del Fantacalcio.
 * Può essere importato sia lato Admin che lato Index (User).
 */

// Valori predefiniti dei bonus/malus (usati finché il Patron non salva i suoi)
export const RULE_DEFAULTS = Object.freeze({
  gol: 3,
  assist: 1,
  ammonizione: -0.5,
  espulsione: -1,
  autogol: -2,
  rigore_parato: 3,
  rigore_sbagliato: -3,
  rigore_segnato: 2,
  gol_subito: -1,
  porta_inviolata: 1
});

export const RULE_LABELS = {
  gol: 'Gol', rigore_segnato: 'Rigore segnato', assist: 'Assist', ammonizione: 'Ammonizione',
  espulsione: 'Espulsione', autogol: 'Autogol', rigore_parato: 'Rigore parato',
  rigore_sbagliato: 'Rigore sbagliato', gol_subito: 'Gol subito', porta_inviolata: 'Porta inviolata'
};

// Fasce predefinite del modificatore difesa: media in [da, a) -> punti (a = null: "da in su")
export const MOD_DIFESA_DEFAULT_FASCE = Object.freeze([
  { da: 6, a: 6.25, punti: 0.5 },
  { da: 6.25, a: 6.5, punti: 1 },
  { da: 6.5, a: 6.75, punti: 1.5 },
  { da: 6.75, a: 7, punti: 2 },
  { da: 7, a: null, punti: 3 }
]);

/**
 * Regole correnti della lega. Sono oggetti condivisi: applicaRegole() li aggiorna
 * sul posto con quanto salvato dal Patron in status/regole, così chi li importa
 * (PlayerCard, live, calcolo giornata) usa sempre i valori aggiornati.
 */
export const RULE_MATCH = { ...RULE_DEFAULTS };
export const MOD_DIFESA = { attivo: false, fasce: MOD_DIFESA_DEFAULT_FASCE.map(f => ({ ...f })) };

const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/** Fasce valide e ordinate per "da" (scarta righe incomplete). */
export function normalizzaFasce(fasce) {
  const list = Array.isArray(fasce) ? fasce : Object.values(fasce || {});
  return list
    .map(f => ({ da: num(f?.da), a: num(f?.a), punti: num(f?.punti) }))
    .filter(f => f.da !== null && f.punti !== null && (f.a === null || f.a > f.da))
    .sort((x, y) => x.da - y.da);
}

/**
 * Applica le regole salvate (status/regole): { bonus: {gol: 3, ...}, modDifesa: { attivo, fasce: [...] } }.
 * Valori mancanti = predefiniti.
 */
export function applicaRegole(cfg) {
  const bonus = cfg?.bonus || {};
  Object.keys(RULE_DEFAULTS).forEach(k => {
    const v = num(bonus[k]);
    RULE_MATCH[k] = v === null ? RULE_DEFAULTS[k] : v;
  });
  const md = cfg?.modDifesa || {};
  MOD_DIFESA.attivo = md.attivo === true;
  MOD_DIFESA.fasce = md.fasce ? normalizzaFasce(md.fasce) : MOD_DIFESA_DEFAULT_FASCE.map(f => ({ ...f }));
}

export const CalcoloMatchService = {
  /**
   * Normalizza un voto: un voto valido è tra 0 e 10. fantacalcio.it usa il
   * valore 55 come codice di "senza voto" (s.v.), tipico di chi subentra e
   * gioca pochi minuti: qualsiasi valore fuori scala viene trattato come s.v. (0).
   */
  normalizzaVoto(v) {
    const n = parseFloat(String(v ?? '').replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0 || n > 10) return 0;
    return Math.round(n * 100) / 100;
  },

  /**
   * Calcola dinamicamente il Fantavoto di un singolo giocatore.
   * @param {Object} datiVoto - L'oggetto contenente il voto base e i vari eventi (es: {voto: 6, gol: 1, ammonizione: 1})
   * @returns {Number} Il fantavoto totale calcolato comprensivo di bonus/malus
   */
  calcolaFantavoto(datiVoto) {
    if (!datiVoto || datiVoto.voto === undefined || datiVoto.voto === null) {
      return 0;
    }

    const votoBase = this.normalizzaVoto(datiVoto.voto);
    let totaleBonusMalus = 0;

    // Scansiona i modificatori dall'oggetto RULE_MATCH
    Object.keys(RULE_MATCH).forEach(evento => {
      if (datiVoto[evento]) {
        const quantitaEvento = parseInt(datiVoto[evento]) || 0;
        const valoreMoltiplicatore = parseFloat(RULE_MATCH[evento]) || 0;
        totaleBonusMalus += (quantitaEvento * valoreMoltiplicatore);
      }
    });

    // Ritorna la somma algebrica finale
    return votoBase + totaleBonusMalus;
  },

  /**
   * Calcola i gol totali basandosi sulle soglie (66 = 1 gol, +6 per ogni gol successivo)
   * @param {Number} punteggio - Il totale della fantasquadra
   * @returns {Number} Numero di gol segnati
   */
  calcolaGol(punteggio) {
    if (!punteggio || punteggio < 66) return 0;
    return Math.floor((punteggio - 66) / 6) + 1;
  },

  /**
   * Un giocatore "ha il voto" solo se ha un voto base numerico > 0.
   * Voto mancante, vuoto o 0 = s.v. (senza voto): per la formazione è la stessa cosa.
   */
  hasVoto(datiVoto) {
    if (!datiVoto || typeof datiVoto !== 'object') return false;
    if (datiVoto.voto === undefined || datiVoto.voto === null || datiVoto.voto === '') return false;
    return this.normalizzaVoto(datiVoto.voto) > 0; // 55 = s.v.
  },

  /**
   * Applica le sostituzioni dalla panchina.
   * Ogni titolare senza voto viene rimpiazzato dal primo panchinaro DELLO STESSO RUOLO
   * (nell'ordine in cui è schierato in panchina) che abbia il voto e non sia già entrato.
   * Se non c'è nessun panchinaro disponibile per quel ruolo, il titolare resta senza punteggio.
   *
   * @param {Array} titolari   id dei titolari
   * @param {Array} panchina   id dei panchinari (in ordine di priorità)
   * @param {Function} getRole  id -> 'P'|'D'|'C'|'A'
   * @param {Function} getScore id -> numero (fantavoto) oppure null se s.v.
   * @returns {{ slots: Array, sostituzioni: Array, totale: number }}
   *   slots: un elemento per titolare { id, score, entratoPer?, senzaVoto? }
   */
  applicaSostituzioni(titolari, panchina, getRole, getScore) {
    const usati = new Set();
    const sostituzioni = [];
    const slots = [];

    (titolari || []).forEach(id => {
      const score = getScore(id);
      if (score !== null && score !== undefined) {
        slots.push({ id, score });
        return;
      }
      const role = getRole(id);
      const sub = role
        ? (panchina || []).find(b =>
            b && !usati.has(String(b)) &&
            getRole(b) === role &&
            getScore(b) !== null && getScore(b) !== undefined)
        : null;

      if (sub) {
        usati.add(String(sub));
        sostituzioni.push({ out: id, in: sub });
        slots.push({ id: sub, score: getScore(sub), entratoPer: id });
      } else {
        slots.push({ id, score: null, senzaVoto: true });
      }
    });

    const totale = slots.reduce((acc, sl) => acc + (sl.score || 0), 0);
    return { slots, sostituzioni, totale };
  },

  /**
   * Calcola il punteggio totale di una squadra per una giornata, comprese le sostituzioni.
   * @param {Object} allLineups - L'intero nodo lineups della giornata
   * @param {String|Number} targetTeamId - L'ID della squadra (es: "1" o 1)
   * @param {Object} mappaFantavotiLocali - { playerId: fantavoto } dei SOLI giocatori con voto
   * @param {Object} [ruoliGiocatori] - { playerId: 'P'|'D'|'C'|'A' }. Se omesso non ci sono sostituzioni.
   * @returns {Number} Somma totale dei fantavoti
   */
  calcolaTotaleSquadra(allLineups, targetTeamId, mappaFantavotiLocali, ruoliGiocatori = null, votiBase = null) {
    return this.calcolaDettaglioSquadra(allLineups, targetTeamId, mappaFantavotiLocali, ruoliGiocatori, votiBase).totale;
  },

  /**
   * Modificatore difesa (se attivo nelle regole della lega).
   * Vale solo se tra i titolari schierati ci sono almeno 4 difensori. Si prendono il
   * portiere e i 3 difensori con il voto base più alto tra quelli scesi in campo
   * (dopo le sostituzioni): la media dei 4 voti base cade in una fascia, che dà i punti.
   * Senza voto del portiere o con meno di 3 difensori a voto il modificatore non si applica.
   *
   * @param {Array} slots     slot finali di applicaSostituzioni
   * @param {Array} titolari  id dei titolari schierati
   * @param {Function} getRole id -> 'P'|'D'|'C'|'A'
   * @param {Function} getVoto id -> voto base (0 / null = s.v.)
   * @returns {{ valore: number, attivo: boolean, media?: number, ids?: Array, motivo?: string }}
   */
  calcolaModificatoreDifesa(slots, titolari, getRole, getVoto) {
    if (!MOD_DIFESA.attivo) return { valore: 0, attivo: false };
    const difSchierati = (titolari || []).filter(id => getRole(id) === 'D').length;
    if (difSchierati < 4) return { valore: 0, attivo: true, motivo: 'meno di 4 difensori schierati' };

    const inCampo = (slots || [])
      .filter(sl => sl.score !== null && sl.score !== undefined)
      .map(sl => ({ id: sl.id, role: getRole(sl.id), voto: this.normalizzaVoto(getVoto(sl.id)) }))
      .filter(p => p.voto > 0)
      .sort((x, y) => y.voto - x.voto);
    const portiere = inCampo.find(p => p.role === 'P');
    const difensori = inCampo.filter(p => p.role === 'D').slice(0, 3);
    if (!portiere) return { valore: 0, attivo: true, motivo: 'portiere senza voto' };
    if (difensori.length < 3) return { valore: 0, attivo: true, motivo: 'meno di 3 difensori a voto' };

    const scelti = [portiere, ...difensori];
    const media = Math.round(scelti.reduce((a, p) => a + p.voto, 0) / 4 * 10000) / 10000;
    const fascia = MOD_DIFESA.fasce.find(f => media >= f.da && (f.a === null || media < f.a));
    return { valore: fascia ? fascia.punti : 0, attivo: true, media, ids: scelti.map(p => p.id) };
  },

  /**
   * Come calcolaTotaleSquadra ma restituisce anche slot, sostituzioni e modificatore difesa.
   * votiBase: { playerId: voto base } per il modificatore difesa (senza, non si applica).
   */
  calcolaDettaglioSquadra(allLineups, targetTeamId, mappaFantavotiLocali, ruoliGiocatori = null, votiBase = null) {
    const vuoto = { totale: 0, slots: [], sostituzioni: [], modDifesa: { valore: 0, attivo: MOD_DIFESA.attivo } };
    if (!allLineups) return vuoto;

    // 1. Cerchiamo il nodo della squadra controllando sia la chiave diretta sia la proprietà teamId interna
    let squadData = allLineups[targetTeamId];
    if (!squadData) {
      const foundKey = Object.keys(allLineups).find(k => allLineups[k] && String(allLineups[k].teamId) === String(targetTeamId));
      if (foundKey) squadData = allLineups[foundKey];
    }
    if (!squadData) return vuoto; // Squadra non trovata o formazione non inserita

    const titolari = squadData.titolari || squadData.panchina || null;
    if (!titolari || !Array.isArray(titolari)) return vuoto;

    const getScore = (id) => {
      const v = mappaFantavotiLocali ? mappaFantavotiLocali[id] : undefined;
      return v === undefined || v === null || Number.isNaN(Number(v)) ? null : Number(v);
    };

    // Senza mappa dei ruoli (o senza panchina) non si possono fare sostituzioni
    const panchina = Array.isArray(squadData.panchina) && squadData.titolari ? squadData.panchina : [];
    const getRole = (id) => (ruoliGiocatori ? ruoliGiocatori[id] : undefined);

    const res = this.applicaSostituzioni(titolari, ruoliGiocatori ? panchina : [], getRole, getScore);
    const modDifesa = this.calcolaModificatoreDifesa(res.slots, titolari, getRole, (id) => (votiBase ? votiBase[id] : null));
    return { ...res, modDifesa, totale: res.totale + modDifesa.valore };
  }
};
