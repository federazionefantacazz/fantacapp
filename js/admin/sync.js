export const SyncSection = {
  renderHTML() {
    return `
    <div id="sec-sync" class="admin-sec" style="display:none">
      <div class="sec-title">Sincronizzazione SofaScore</div>
      <div class="card" style="max-width:500px">
        <div class="label" style="margin-bottom:.5rem">ID Turno SofaScore (Unique Tournament ID)</div>
        <input type="text" id="sofaTournId" class="input-login" value="53" placeholder="ID Campionato (es: 53 per Serie A)">
        <input type="number" id="sofaGwNum" class="input-login" value="1" placeholder="Numero Giornata Reale">
        <button class="btn btn-blue" onclick="window.syncSofaScoreVotes()">Avvia Sincronizzazione Voti</button>
        <div id="syncLog" style="margin-top:1rem;font-size:.8rem;font-family:'DM Mono',monospace;color:var(--text2);max-height:150px;overflow-y:auto"></div>
      </div>
    </div>`;
  },

  render(_state) {
    // Nessun dato reattivo da aggiornare in questa sezione
  }
};
