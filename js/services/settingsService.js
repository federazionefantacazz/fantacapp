import { db } from '../firebase-config.js';
import { ref, get, set, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

export const SettingsService = {
  // Valori predefiniti nel caso in cui l'utente non abbia ancora salvato nulla
  getDefaultSettings() {
    return {
      theme: 'default',
      notificationsEnabled: true,
      soundEnabled: false,
      compactView: false
    };
  },

  async getSettings(userId) {
    if (!userId) return this.getDefaultSettings();
    
    try {
      const settingsRef = ref(db, `settings/${userId}`);
      const snapshot = await get(settingsRef);
      
      if (snapshot.exists()) {
        return { ...this.getDefaultSettings(), ...snapshot.val() };
      } else {
        // Se non esistono, inizializza con i default
        const defaults = this.getDefaultSettings();
        await set(settingsRef, defaults);
        return defaults;
      }
    } catch (error) {
      console.error("Errore nel recupero delle impostazioni utente:", error);
      return this.getDefaultSettings();
    }
  },

  async updateSettings(userId, newSettings) {
    if (!userId) return;
    
    try {
      const settingsRef = ref(db, `settings/${userId}`);
      await update(settingsRef, newSettings);
    } catch (error) {
      console.error("Errore durante il salvataggio delle impostazioni:", error);
      throw error;
    }
  }
};
