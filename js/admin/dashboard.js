export const DashboardSection = {
  db: null,

  // Inizializza il modulo salvando il riferimento a Firebase DB
  init(database) {
    this.db = database;
  },

  // Genera la struttura HTML della pagina
  renderHTML() {
    return `
      <div id="sec-dashboard" class="admin-sec" style="display:block;">
        <h2 class="sec-title">📊 Dashboard Patron</h2>
        
        <div class="card" style="max-width: 500px;">
          <div class="label" style="color: var(--accent); margin-bottom: .6rem; font-size: .85rem;">
            Stato Campionato & Giornata Reale (Serie A)
          </div>
          <p style="font-size: .85rem; color: var(--text2); margin-bottom: 1rem;">
            Seleziona la giornata corrente del campionato reale. Imposta su "Prima del Campionato" se la stagione non è ancora iniziata.
          </p>
          
          <div style="display: flex; flex-direction: column; gap: .4rem;">
            <label class="label" for="realGwSelect">Giornata Attiva:</label>
            <select id="realGwSelect" class="input-login" style="margin: 0; padding: .75rem;" onchange="window.changeRealGW(this.value)">
              </select>
          </div>
          
          <div id="dashboard-status-badge" style="margin-top: 1rem; font-size: .85rem; font-weight: 500;">
            </div>
        </div>

        <div class="card" style="max-width: 500px; opacity: 0.6;">
          <div class="label">Pannello di Controllo Rapido</div>
          <p style="font-size: .8rem; color: var(--text2);">
            Altre impostazioni rapide verranno integrate qui.
          </p>
        </div>
      </div>
    `;
  },

  // Gestisce il popolamento e lo stato attuale dei selettori
  render(state) {
    const selectEl = document.getElementById('realGwSelect');
    if (!selectEl) return;

    // Se il select è vuoto, lo popola da 0 a 38
    if (selectEl.options.length === 0) {
      let optionsHtml = `<option value="0">⏳ Giornata 0 (Prima del Campionato)</option>`;
      for (let i = 1; i <= 38; i++) {
        optionsHtml += `<option value="${i}">⚽ Giornata ${i}</option>`;
      }
      selectEl.innerHTML = optionsHtml;
    }

    // Imposta il valore corrente preso dallo stato globale di Firebase
    const currentRealGw = state.CURRENT_REAL_GW !== undefined ? state.CURRENT_REAL_GW : 0;
    selectEl.value = currentRealGw;

    // Aggiorna il badge visivo di testo
    const badgeEl = document.getElementById('dashboard-status-badge');
    if (badgeEl) {
      if (currentRealGw === 0) {
        badgeEl.innerHTML = `<span class="badge badge-blue">Pre-Campionato attivo</span>`;
      } else {
        badgeEl.innerHTML = `<span class="badge badge-green">Campionato in corso: ${currentRealGw}ª Giornata</span>`;
      }
    }
  }
};
