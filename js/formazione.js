export const FormazionePage = {
  renderHTML() {
    return `
      <div class="page" id="page-formazione">
        <div class="sec">Schiera Formazione</div>
        <div class="card card-sm" style="margin-bottom: 1rem;">
          <div class="label" style="margin-bottom: .4rem;">Seleziona Modulo</div>
          <select id="f-modulo" class="select-rose">
            <option value="3-4-3">3-4-3</option><option value="3-5-2">3-5-2</option>
            <option value="4-3-3" selected>4-3-3</option><option value="4-4-2">4-4-2</option>
            <option value="4-5-1">4-5-1</option><option value="5-3-2">5-3-2</option><option value="5-4-1">5-4-1</option>
          </select>
        </div>
        <div class="label" style="margin-bottom: .5rem; color: var(--accent);">👕 TITOLARI (11)</div>
        <div id="titolari-slots" style="display: flex; flex-direction: column; gap: .4rem; margin-bottom: 1.5rem;"></div>
        <div class="label" style="margin-bottom: .5rem; color: var(--gold);">🪑 PANCHINA (1 P | 2 D | 2 C | 2 A)</div>
        <div id="panchina-slots" style="display: flex; flex-direction: column; gap: .4rem; margin-bottom: 1.5rem;"></div>
        <button class="btn btn-green" style="width: 100%; padding: .8rem;" id="btn-save-lineup">💾 Salva Formazione</button>
      </div>
    `;
  },
  render(STATE) {
    const modSelect = document.getElementById('f-modulo');
    if(!modSelect) return;
    
    if(!window._formazioneInitialized) {
      modSelect.addEventListener('change', () => this.buildSlots(STATE));
      document.getElementById('btn-save-lineup').addEventListener('click', () => this.save(STATE));
      window._formazioneInitialized = true;
      this.buildSlots(STATE);
    }
  },
  buildSlots(STATE) {
    const modulo = document.getElementById('f-modulo').value;
    const [def, mid, att] = modulo.split('-').map(Number);
    const schemaTit = [{role:'P', count:1}, {role:'D', count:def}, {role:'C', count:mid}, {role:'A', count:att}];
    const schemaPan = [{role:'P', count:1}, {role:'D', count:2}, {role:'C', count:2}, {role:'A', count:2}];
    const miaRosa = STATE.players.filter(p => p.teamId === STATE.user.id);

    this.drawSchema('titolari-slots', schemaTit, 'tit', miaRosa);
    this.drawSchema('panchina-slots', schemaPan, 'pan', miaRosa);
  },
  drawSchema(id, schema, prefix, rosa) {
    const container = document.getElementById(id);
    container.innerHTML = '';
    schema.forEach(item => {
      for (let i = 1; i <= item.count; i++) {
        const slotId = `${prefix}-${item.role}-${i}`;
        const ops = rosa.filter(p => p.role === item.role);
        const div = document.createElement('div');
        div.className = 'pcard'; div.style.padding = '.4rem .6rem';
        div.innerHTML = `
          <div class="rbadge r${item.role}" style="width:24px;height:24px;font-size:.65rem;border-radius:5px">${item.role}</div>
          <div style="flex:1;">
            <select id="${slotId}" class="select-rose" style="padding:.4rem .6rem;font-size:.8rem;background:var(--bg2);">
              <option value="">-- Seleziona --</option>
              ${ops.map(p => `<option value="${p.id}">${p.name} (${p.club})</option>`).join('')}
            </select>
          </div>
        `;
        container.appendChild(div);
        div.querySelector('select').addEventListener('change', (e) => {
          const val = e.target.value; if(!val) return;
          const all = document.querySelectorAll('#titolari-slots select, #panchina-slots select');
          let dup = false;
          all.forEach(s => { if(s.id !== slotId && s.value === val) dup = true; });
          if(dup) { window.showToast('Calciatore già inserito!', 'err'); e.target.value = ''; }
        });
      }
    });
  },
  async save(STATE) {
    const currentGw = STATE.status?.currentGW || 1;
    const modulo = document.getElementById('f-modulo').value;
    const titS = document.querySelectorAll('#titolari-slots select');
    const panS = document.querySelectorAll('#panchina-slots select');
    let titIds = []; let panIds = [];
    titS.forEach(s => { if(s.value) titIds.push(s.value); });
    panS.forEach(s => { if(s.value) panIds.push(s.value); });

    if (titIds.length < 11) { window.showToast(`Inserisci 11 titolari!`, 'err'); return; }
    try {
      await window._saveNode(`lineups/gw${currentGw}/${STATE.user.id}`, {
        teamId: STATE.user.id, modulo, titolari: titIds, panchina: panIds, timestamp: Date.now()
      });
      window.showToast('Formazione salvata!', 'ok');
    } catch(e) { window.showToast('Errore salvataggio', 'err'); }
  }
};