/**
 * ProbabiliService
 * ------------------------------------------------------------------
 * Legge i dati scritti dalla Cloud Function in `probabili/` (fonte:
 * fantacalcio.it/probabili-formazioni-serie-a) e li collega ai giocatori
 * del listone. Il collegamento avviene per ID (l'id del listone è lo
 * stesso id di fantacalcio.it), con fallback sul nome della squadra
 * per ricavare l'avversario.
 *
 * STATE.probabili = {
 *   meta:     { giornata, updatedAt },
 *   fixtures: { genoa: { opp, oppName, name, home, date } },
 *   players:  { "7332": { pct, xi: "tit"|"pan", st: "inf"|"squal"|"diff"|"dubbio", note, team } }
 * }
 */

const norm = (s) => String(s || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z]/g, '');

export const STATUS_INFO = {
  squal:  { label: 'Squalificato', short: 'SQ',  icon: 'ri-forbid-2-line',     color: '#ff4757' },
  inf:    { label: 'Infortunato',  short: 'INF', icon: 'ri-first-aid-kit-line', color: '#ff7a2f' },
  dubbio: { label: 'In dubbio',    short: '?',   icon: 'ri-question-line',      color: '#f5a623' },
  diff:   { label: 'Diffidato',    short: 'DIFF', icon: 'ri-error-warning-line', color: '#f5c518' },
};

export const ProbabiliService = {
  hasData(STATE) {
    return !!(STATE?.probabili?.fixtures && Object.keys(STATE.probabili.fixtures).length);
  },

  meta(STATE) {
    return STATE?.probabili?.meta || null;
  },

  /** Trova lo slug squadra (es. "genoa") a partire dal club del listone. */
  _teamSlug(club, fixtures) {
    const c = norm(club);
    if (!c || !fixtures) return null;
    if (fixtures[c]) return c;
    for (const [slug, f] of Object.entries(fixtures)) {
      const s = norm(slug), n = norm(f.name);
      if (s === c || n === c) return slug;
    }
    // es. "Verona" <-> "hellas-verona"
    for (const [slug, f] of Object.entries(fixtures)) {
      const s = norm(slug), n = norm(f.name);
      if (c.length >= 4 && (s.includes(c) || c.includes(s) || n.includes(c) || c.includes(n))) return slug;
    }
    return null;
  },

  /**
   * Info di un giocatore del listone:
   * { known, pct, xi, st, note, opp: { name, home, date } | null, inList }
   */
  getInfo(player, STATE) {
    const data = STATE?.probabili;
    const empty = { known: false, pct: null, xi: null, st: null, note: '', opp: null, inList: false };
    if (!data || !player) return empty;

    const pp = data.players?.[String(player.id)] || null;
    const fixtures = data.fixtures || {};
    const slug = (pp?.team && fixtures[pp.team]) ? pp.team : this._teamSlug(player.club, fixtures);
    const fx = slug ? fixtures[slug] : null;

    return {
      known: true,
      pct: (pp && typeof pp.pct === 'number') ? pp.pct : null,
      xi: pp?.xi || null,
      st: pp?.st || null,
      note: pp?.note || '',
      inList: !!(pp && typeof pp.pct === 'number'),
      opp: fx ? { name: fx.oppName || fx.opp, home: !!fx.home, date: fx.date || '' } : null,
    };
  },

  pctColor(pct) {
    if (pct === null || pct === undefined) return 'var(--text3)';
    if (pct >= 70) return '#5ec82b';
    if (pct >= 45) return '#f5a623';
    return '#ff4757';
  },
};
