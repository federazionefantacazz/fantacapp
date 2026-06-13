export const CalendarioSection = {
  renderHTML() {
    return `
    <div id="sec-calendar-gen" class="admin-sec" style="display:none;">
      <div class="sec-title">🗓️ Generatore Calendario Automatico</div>
      
      <div class="card" style="max-width: 600px;">
        <div style="margin-bottom: 1rem; padding: .8rem; background: rgba(80, 227, 194, 0.1); border-left: 4px solid var(--accent); border-radius: 4px;">
          <span style="font-size: .85rem; color: var(--text);">
            Stai per generare il calendario per la competizione attiva selezionata nella sidebar.
          </span>
        </div>

        <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem;">
          <div style="flex: 1;">
            <label class="label">Numero Giornate totali</label>
            <input type="number" id="genTotalGws" class="input-login" value="33" min="1" max="38" style="margin-bottom:0; background: var(--bg3); border: 1px solid var(--border); color:#fff; padding:.5rem; border-radius:6px; width:100%;">
          </div>
          <div style="flex: 1;">
            <label class="label">Tipo di Turno</label>
            <select id="genRotationType" style="width:100%; background:var(--bg3); border:1px solid var(--border); border-radius:6px; color:#fff; padding:.6rem; font-size:.85rem;">
              <option value="andata-ritorno">Andata e Ritorno continui</option>
              <option value="solo-andata">Solo Andata (fino a esaurimento)</option>
            </select>
          </div>
        </div>

        <button class="btn btn-green" onclick="window.generateRandomCalendar()">⚡ Genera & Salva su Firebase</button>
      </div>

      <div class="card">
        <div class="label">Anteprima delle squadre che parteciperanno:</div>
        <div id="genTeamsPreview" style="display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .5rem; font-size: .85rem; color: var(--text2);"></div>
      </div>
    </div>`;
  },

  render({ TEAMS }) {
    const container = document.getElementById('genTeamsPreview');
    if (!container) return;
    if (TEAMS.length === 0) {
      container.innerHTML = '❌ Nessuna squadra trovata. Crea prima le squadre dal pannello.';
      return;
    }
    container.innerHTML = TEAMS.map(t => `
      <span style="background:var(--bg3); border:1px solid var(--border); padding:.4rem .6rem; border-radius:6px; display:inline-block; margin: 2px;">
        ${t.emoji || '⚽'} ${t.name}
      </span>
    `).join('');
  }
};
