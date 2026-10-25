/**
 * Giocatori preferiti dell'utente: stella nella scheda del giocatore (PlayerCard),
 * filtro "solo preferiti" in Listone e Svincolati (ListoneView).
 *
 * Stanno nelle impostazioni dell'account: settings/{uid}/favorites = { [playerId]: true }
 * (con la cache locale delle impostazioni: si vedono subito, anche offline).
 * A ogni cambio parte l'evento window "favorites-change", così le viste aperte si aggiornano.
 */
export const FAVORITES_EVENT = 'favorites-change';

function current() {
  const fav = ((window.STATE && window.STATE.settings) || {}).favorites;
  return fav && typeof fav === 'object' ? fav : {};
}

export const FavoritesService = {
  has(playerId) {
    return current()[String(playerId)] === true;
  },

  count() {
    return Object.keys(current()).length;
  },

  /** Aggiunge o toglie il giocatore dai preferiti; ritorna true se ora è tra i preferiti. */
  toggle(playerId) {
    const id = String(playerId);
    const next = { ...current() };
    if (next[id]) delete next[id];
    else next[id] = true;
    if (window.setUserSetting) window.setUserSetting('favorites', next);
    else if (window.STATE) window.STATE.settings = { ...window.STATE.settings, favorites: next };
    window.dispatchEvent(new CustomEvent(FAVORITES_EVENT, { detail: { id, on: !!next[id] } }));
    return !!next[id];
  }
};
