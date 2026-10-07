/**
 * calendario-state.js
 * Responsabilità: stato condiviso del modulo (competizioni, squadre, modalità editing).
 * Tutti gli altri file lo importano invece di accedere direttamente a CalendarioSection.
 */

export const CalendarioState = {
  db: null,
  _teams: [],
  _competitions: [],
  isEditingManually: false,

  init(database) {
    this.db = database;
  },

  setData({ TEAMS, competitions }) {
    this._teams = TEAMS || [];
    this._competitions = competitions || [];
  },

  getTeam(teamId) {
    return this._teams.find(t => String(t.id) === String(teamId)) || null;
  },

  getCompetizione(compId) {
    return this._competitions.find(c => c.id === compId) || null;
  },

  getCompetizioniList() {
    return this._competitions;
  },

  /**
   * Restituisce la lista di ID squadre di una competizione come array di stringhe pulite.
   */
  getTeamIdsCompetizione(comp) {
    if (!comp?.teams) return [];
    const raw = Array.isArray(comp.teams) ? comp.teams : Object.values(comp.teams);
    return raw.filter(id => id !== null && id !== undefined).map(id => String(id));
  }
};
