export const DashboardSection = {
  renderHTML() {
    return `
    <div id="sec-dashboard" class="admin-sec">
      <div class="sec-title">Dashboard Generale</div>
      
      <div class="card-grid">
        <div class="stat-box">
          <div class="label">Giornata Attiva</div>
          <div class="num" id="adminGWNum">—</div>
        </div>
        <div class="stat-box">
          <div class="label">Calciatori nel Database</div>
          <div class="num" id="pCount">0</div>
        </div>
      </div>

      <div class="card" style="max-width:400px">
        <div class="label" style="margin-bottom:.5rem">Imposta Giornata Gioco (GW)</div>
        <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:1rem">
          <button class="btn btn-blue" style="width:50px;padding:.5rem" onclick="window.changeGW(-1)">-</button>
          <div style="font-size:1.4rem;font-weight:600;min-width:60px;text-align:center;flex:1" id="ds-gw">1</div>
          <button class="btn btn-blue" style="width:50px;padding:.5rem" onclick="window.changeGW(1)">+</button>
        </div>
        <button class="btn btn-green" onclick="window.saveGW()">Aggiorna GW</button>
      </div>
    </div>`;
  },

  render({ CURRENT_GW }) {
    const el1 = document.getElementById('adminGWNum');
    const el2 = document.getElementById('gwBadge');
    const el3 = document.getElementById('ds-gw');
    if (el1) el1.textContent = CURRENT_GW;
    if (el2) el2.textContent = 'GW ' + CURRENT_GW;
    if (el3) el3.textContent = CURRENT_GW;
  }
};
