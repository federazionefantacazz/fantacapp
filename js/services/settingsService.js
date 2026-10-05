import { db } from '../firebase-config.js';
import { ref, get, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

/**
 * Impostazioni dell'applicazione legate all'utente (account Firebase, uid).
 *
 *  - DB:    settings/{uid}
 *  - Cache: localStorage "fantacapp-settings-{uid}" (letta subito all'avvio, poi riallineata col DB)
 *
 * Per aggiungere una nuova impostazione: aggiungila ai default qui sotto e allo
 * SCHEMA in js/menu/ImpostazioniApp.js.
 */
const CACHE_PREFIX = 'fantacapp-settings-';

export const SettingsService = {
  // Valori predefiniti nel caso in cui l'utente non abbia ancora salvato nulla
  getDefaultSettings() {
    return {
      theme: 'default',
      notificationsEnabled: true,
      soundEnabled: false,
      compactView: false,
      showBackground: true
    };
  },

  /** Impostazioni salvate su questo dispositivo (sincrone, per l'avvio immediato). */
  getCachedSettings(userId) {
    const defaults = this.getDefaultSettings();
    if (!userId) return defaults;
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + userId);
      return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
    } catch (e) {
      return defaults;
    }
  },

  cacheSettings(userId, settings) {
    if (!userId) return;
    try {
      localStorage.setItem(CACHE_PREFIX + userId, JSON.stringify(settings));
    } catch (e) { /* storage pieno o non disponibile: si resta sul DB */ }
  },

  async getSettings(userId) {
    if (!userId) return this.getDefaultSettings();

    try {
      const snapshot = await get(ref(db, `settings/${userId}`));
      const base = this.getCachedSettings(userId);
      // Il DB ha la precedenza; se non c'è ancora nulla si tiene la cache locale
      const merged = snapshot.exists() ? { ...this.getDefaultSettings(), ...snapshot.val() } : base;
      this.cacheSettings(userId, merged);
      return merged;
    } catch (error) {
      console.error("Errore nel recupero delle impostazioni utente:", error);
      return this.getCachedSettings(userId);
    }
  },

  async updateSettings(userId, newSettings) {
    if (!userId) return;

    // Prima la cache: l'impostazione resta anche se il DB non risponde
    this.cacheSettings(userId, { ...this.getCachedSettings(userId), ...newSettings });

    try {
      await update(ref(db, `settings/${userId}`), newSettings);
    } catch (error) {
      console.error("Errore durante il salvataggio delle impostazioni:", error);
      throw error;
    }
  }
};
