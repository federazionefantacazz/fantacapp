export const FormazionePage = {
  renderHTML() {
    return `
      <div class="page" id="page-formazione">
        <div class="sec" style="margin-top:1.2rem">Schiera Formazione</div>
        
        <div class="card card-sm" style="margin-bottom: 1rem;">
          <div class="label" style="margin-bottom: .4rem;">Seleziona Modulo</div>
          <select id="f-modulo" class="select-rose">
            <option value="3-4-3">3-4-3</option>
            <option value="3-5-2">3-5-2</option>
            <option value="4-3-3" selected>4-3-3</option>
            <option value="4-4-2">4-4-2</option>
            <option value="4-5-1">4-5-1</option>
            <option value="5-3-2">5-3-2</option>
            <option value="5-4-1">5-4-1</option>
          </select>
        </div>

        <div class="label" style="margin-bottom: .5rem; color: var(--accent); display: flex; align-items: center; gap: 0.4rem;"><i class="ri-t-shirt-line"></i> TITOLARI (RETTANGOLO DI GIOCO)</div>
        
        <div class="soccer-field" id="soccer-field-container">
          <div class="field-lines">
            <div class="field-penalty-box"></div>
            <div class="field-center-circle"></div>
          </div>
          <div id="titolari-field-slots"></div>
        </div>

        <div class="label" style="margin-bottom: .5rem; color: var(--gold); margin-top: 1.5rem; display: flex; align-items: center; gap: 0.4rem;"><i class="ri-user-shared-line"></i> PANCHINA (1 P | 2 D | 2 C | 2 A)</div>
        <div id="panchina-slots" style="display: flex; flex-direction: column; gap: .4rem; margin-bottom: 1rem;"></div>

        <div class="card card-sm" style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.8rem; background: var(--bg2);">
          <input type="checkbox" id="save-all-comps" checked style="width: 18px; height: 18px; accent-color: var(--accent); cursor: pointer;">
          <label for="save-all-comps" class="label" style="margin: 0; cursor: pointer; color: var(--text);">Salva per tutte le competizioni</label>
        </div>
        
        <button class="btn btn-green" style="width: 100%; padding: .8rem; margin-bottom:2rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;" id="btn-save-lineup"><i class="ri-save-line"></i> Salva Formazione</button>

        <style>
        .soccer-field {
          position: relative;
          width: 100%;
          height: 480px;
          background: 
            repeating-linear-gradient(
              to bottom,
              rgba(34, 139, 34, 0.85),
              rgba(34, 139, 34, 0.85) 40px,
              rgba(28, 115, 28, 0.85) 40px,
              rgba(28, 115, 28, 0.85) 80px
            ),
            radial-gradient(circle at center, rgba(0,0,0,0) 40%, rgba(0,0,0,0.35) 100%);
          background-color: #228b22;
          border: 3px solid rgba(255, 255, 255, 0.3);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: inset 0 0 40px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.3);
        }
        .field-lines {
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          pointer-events: none;
        }
        .field-lines::before {
          content: ''; position: absolute; top: 50%; left: 0; width: 100%; height: 3px;
          background: rgba(255, 255, 255, 0.6);
          box-shadow: 0 0 4px rgba(0,0,0,0.3);
        }
        .field-center-circle {
          position: absolute; top: 50%; left: 50%; width: 100px; height: 100px;
          border: 3px solid rgba(255, 255, 255, 0.6); border-radius: 50%;
          transform: translate(-50%, -50%);
          box-shadow: 0 0 4px rgba(0,0,0,0.3);
        }
        .field-center-circle::after {
          content: ''; position: absolute; top: 50%; left: 50%; width: 6px; height: 6px;
          background: rgba(255, 255, 255, 0.6); border-radius: 50%;
          transform: translate(-50%, -50%);
        }
        .field-penalty-box {
          position: absolute; bottom: 0; left: 50%; width: 180px; height: 70px;
          border: 3px solid rgba(255, 255, 255, 0.6); border-bottom: none;
          transform: translateX(-50%);
          box-shadow: 0 0 4px rgba(0,0,0,0.3);
        }
        .field-lines::after {
          content: ''; position: absolute; top: 0; left: 50%; width: 180px; height: 70px;
          border: 3px solid rgba(255, 255, 255, 0.6); border-top: none;
          transform: translateX(-50%);
          box-shadow: 0 0 4px rgba(0,0,0,0.3);
        }
        .field-player {
          position: absolute;
          transform: translate(-50%, -50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 80px;
          z-index: 10;
        }

        /* Stili base dello slot */
        .player-shirt {
          display: flex; 
          align-items: center; 
          justify-content: center;
          font-size: 0.9rem; 
          font-family: 'Bebas Neue', sans-serif; 
          letter-spacing: 0.5px;
          color: #fff;
          transition: transform 0.1s ease-out;
          cursor: pointer;
          text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        }

        /* PNG PURO (senza cerchio, senza bordo, senza sfondo) */
        .player-shirt.has-png {
          width: 52px !important; 
          height: 58px !important;
          border-radius: 0 !important;
          border: none !important;
          box-shadow: none !important;
          background-size: contain !important;
          background-repeat: no-repeat !important;
          background-position: center bottom !important;
          background-color: transparent !important;
        }

        /* FALLBACK CERCHIO (quando lo slot è vuoto o non ha immagini) */
        .player-shirt.is-circle {
          width: 44px !important;
          height: 44px !important;
          border-radius: 50% !important;
          border: 2px solid #ffffff !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.3) !important;
          background-image: none !important;
        }

        .field-player:active .player-shirt {
          transform: translateY(2px);
        }
        .field-player select {
          position: absolute;
          top: 0; left: 0; width: 100%; height: 58px;
          opacity: 0; cursor: pointer; z-index: 12;
        }
        .player-name-label {
          margin-top: 2px;
          background: rgba(10, 15, 30, 0.85);
          backdrop-filter: blur(4px);
          color: #fff;
          font-size: 0.7rem;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 6px;
          max-width: 90px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          border: 1px solid rgba(255,255,255,0.2);
          text-align: center;
          box-shadow: 0 3px 6px rgba(0,0,0,0.4);
        }
        </style>
      </div>
    `;
  },

  render(STATE) {
    const modSelect = document.getElementById('f-modulo');
    if (!modSelect) return;
    
    if (!window._formazioneInitialized) {
      modSelect.addEventListener('change', () => this.buildSlots(STATE, true));
      
      const saveBtn = document.getElementById('btn-save-lineup');
      if (saveBtn) {
        saveBtn.addEventListener('click', () => this.save(STATE));
      }

      const navButtons = document.querySelectorAll('#nav window, .nav-btn, [onclick*="formazione"]');
      navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          setTimeout(() => this.buildSlots(window.STATE), 50);
        });
      });

      window._formazioneInitialized = true;
    }

    this.buildSlots(STATE);
  },

  // Helper per calcolare la corretta giornata della COMPETIZIONE (es: gw1)
  getGwCompetizione(compData, STATE) {
    if (!compData) return 'gw1';

    const gwReale = STATE.giornataRealeCorrente || STATE.status?.currentGW || 1;
    const associazioni = compData.associazioniGwReali || {};

    // 1. Cerca se la giornata reale corrente corrisponde a una giornata della competizione
    const entry = Object.entries(associazioni).find(([k, v]) => String(v).trim() === String(gwReale).trim());
    if (entry) {
      return entry[0]; // Restituisce ad esempio "gw1"
    }

    // 2. Se la competizione ha un attributo esplicito di giornata corrente, usalo
    if (compData.currentGw) return `gw${compData.currentGw}`;
    if (compData.giornataCorrente) return `gw${compData.giornataCorrente}`;

    // 3. Fallback sicuro: usa la prima giornata della competizione (gw1) e NON la giornata reale
    return 'gw1';
  },

  buildSlots(STATE, userChangedModulo = false) {
    if (!STATE || !STATE.user || !STATE.players || STATE.players.length === 0) return;

    const modSelect = document.getElementById('f-modulo');
    if (!modSelect) return;

    const userId = STATE.user.id;
    const compId = STATE.currentCompetition;
    
    const compData = STATE.competitions?.find ? STATE.competitions.find(c => c.id === compId) : null;
    
    // Calcolo corretto della GW della competizione
    const gwCompetizione = this.getGwCompetizione(compData, STATE);

    let savedLineup = null;
    
    if (compData && compData.matches?.[gwCompetizione]?.lineups?.[userId]) {
        savedLineup = compData.matches[gwCompetizione].lineups[userId];
    } else if (STATE.competitions?.[compId]?.matches?.[gwCompetizione]?.lineups?.[userId]) {
        savedLineup = STATE.competitions[compId].matches[gwCompetizione].lineups[userId];
    }

    if (savedLineup && savedLineup.modulo && !userChangedModulo) {
        modSelect.value = savedLineup.modulo;
    }

    const modulo = modSelect.value;
    const [def, mid, att] = modulo.split('-').map(Number);
    
    const miaRosa = STATE.players.filter(p => {
        const pTeamId = String(p.teamId || p.team || '');
        const uId = String(userId || '');
        return pTeamId !== '' && pTeamId === uId;
    });

    const savedTitolariIds = savedLineup?.titolari || [];
    const savedPanchinaIds = savedLineup?.panchina || [];

    this.drawFieldTitolari(def, mid, att, miaRosa, savedTitolariIds);
    const schemaPan = [{role:'P', count:1}, {role:'D', count:2}, {role:'C', count:2}, {role:'A', count:2}];
    this.drawSchemaPanchina('panchina-slots', schemaPan, 'pan', miaRosa, savedPanchinaIds);

    this.refreshAllDropdowns(miaRosa);
  },

  refreshAllDropdowns(rosa) {
    const allSelects = document.querySelectorAll('#titolari-field-slots select, #panchina-slots select');
    const selectedIds = Array.from(allSelects).map(s => s.value).filter(Boolean);

    allSelects.forEach(sel => {
      const currentVal = sel.value;
      Array.from(sel.options).forEach(opt => {
        if (!opt.value) return; 
        if (selectedIds.includes(opt.value) && opt.value !== currentVal) {
          opt.disabled = true;
        } else {
          opt.disabled = false;
        }
      });
    });
  },

  drawFieldTitolari(def, mid, att, rosa, savedIds) {
    const container = document.getElementById('titolari-field-slots');
    if (!container) return;
    container.innerHTML = '';

    const ruoli = [
      { role: 'P', count: 1 },
      { role: 'D', count: def },
      { role: 'C', count: mid },
      { role: 'A', count: att }
    ];

    const rowPositions = { 'A': 20, 'C': 45, 'D': 70, 'P': 90 };

    ruoli.forEach(reparto => {
      const y = rowPositions[reparto.role];
      const count = reparto.count;

      for (let i = 1; i <= count; i++) {
        const x = count === 1 ? 50 : (100 / (count + 1)) * i;
        const slotId = `tit-${reparto.role}-${i}`;
        
        const ops = rosa.filter(p => p.role === reparto.role);

        let preselectedId = "";
        let preselectedText = "Scegli";
        let isSelected = false;
        let photoUrl = "";

        if (savedIds && savedIds.length > 0) {
          const ruoloSavedIds = savedIds.filter(id => {
            const p = rosa.find(player => player.id === id);
            return p && p.role === reparto.role;
          });
          
          if (ruoloSavedIds[i - 1]) {
            preselectedId = ruoloSavedIds[i - 1];
            const pObj = rosa.find(p => p.id === preselectedId);
            if (pObj) {
              preselectedText = pObj.name;
              isSelected = true;
              photoUrl = pObj.photoPersonal || pObj.photoStandard || '';
            }
          }
        }

        let bgShirt = '#475569'; 
        if (reparto.role === 'D') bgShirt = '#2196f3'; 
        if (reparto.role === 'C') bgShirt = '#e91e63'; 
        if (reparto.role === 'A') bgShirt = '#ff5722'; 

        const playerDiv = document.createElement('div');
        playerDiv.className = 'field-player';
        playerDiv.style.left = `${x}%`;
        playerDiv.style.top = `${y}%`;

        const shirtClass = photoUrl ? 'player-shirt has-png' : 'player-shirt is-circle';
        const shirtStyle = photoUrl 
          ? `background-image: url('${photoUrl}');`
          : `background-color: ${bgShirt}; color: #fff;`;

        playerDiv.innerHTML = `
          <div class="${shirtClass}" id="shirt-${slotId}" style="${shirtStyle}">
            ${photoUrl ? '' : reparto.role}
          </div>
          <div class="player-name-label" id="label-${slotId}" style="${isSelected ? 'color: var(--accent); border-color: var(--accent);' : ''}">
            ${preselectedText}
          </div>
          
          <select id="${slotId}" data-role="${reparto.role}" data-label-target="label-${slotId}" data-shirt-target="shirt-${slotId}" class="field-select">
            <option value="">-- ${reparto.role} --</option>
            ${ops.map(p => `<option value="${p.id}" ${p.id === preselectedId ? 'selected' : ''}>${p.name} (${p.club})</option>`).join('')}
          </select>
        `;

        container.appendChild(playerDiv);

        playerDiv.querySelector('select').addEventListener('change', (e) => {
          const val = e.target.value;
          const labelId = e.target.dataset.labelTarget;
          const shirtId = e.target.dataset.shirtTarget;
          const labelEl = document.getElementById(labelId);
          const shirtEl = document.getElementById(shirtId);

          if (!val) {
            labelEl.textContent = 'Scegli';
            labelEl.style.color = '';
            labelEl.style.borderColor = '';
            
            shirtEl.className = 'player-shirt is-circle';
            shirtEl.style.cssText = `background-color: ${bgShirt}; color: #fff;`;
            shirtEl.textContent = reparto.role;
          } else {
            const pObj = rosa.find(p => String(p.id) === String(val));
            const pPhoto = pObj ? (pObj.photoPersonal || pObj.photoStandard || '') : '';

            labelEl.textContent = pObj ? pObj.name : 'Scegli';
            labelEl.style.color = 'var(--accent)';
            labelEl.style.borderColor = 'var(--accent)';

            if (pPhoto) {
              shirtEl.className = 'player-shirt has-png';
              shirtEl.style.cssText = `background-image: url('${pPhoto}');`;
              shirtEl.textContent = '';
            } else {
              shirtEl.className = 'player-shirt is-circle';
              shirtEl.style.cssText = `background-color: ${bgShirt}; color: #fff;`;
              shirtEl.textContent = reparto.role;
            }
          }
          this.refreshAllDropdowns(rosa);
        });
      }
    });
  },

  drawSchemaPanchina(id, schema, prefix, rosa, savedIds) {
    const container = document.getElementById(id);
    if (!container) return;
    container.innerHTML = '';
    
    schema.forEach(item => {
      for (let i = 1; i <= item.count; i++) {
        const slotId = `${prefix}-${item.role}-${i}`;
        const ops = rosa.filter(p => p.role === item.role);

        let preselectedId = "";
        let currentPhoto = "";

        if (savedIds && savedIds.length > 0) {
          const ruoloSavedIds = savedIds.filter(id => {
            const p = rosa.find(player => player.id === id);
            return p && p.role === item.role;
          });
          if (ruoloSavedIds[i - 1]) {
            preselectedId = ruoloSavedIds[i - 1];
            const pObj = rosa.find(p => p.id === preselectedId);
            if (pObj) currentPhoto = pObj.photoPersonal || pObj.photoStandard || '';
          }
        }

        const div = document.createElement('div');
        div.className = 'pcard'; 
        div.style.padding = '.4rem .6rem';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.gap = '0.5rem';

        const imgHtml = currentPhoto 
          ? `<img id="img-${slotId}" src="${currentPhoto}" style="width:28px; height:28px; object-fit:contain; flex-shrink:0;">`
          : `<div id="img-${slotId}" style="width:28px; height:28px; background:var(--bg3); display:flex; align-items:center; justify-content:center; border-radius:4px; font-size:0.65rem; color:var(--text3); flex-shrink:0;"><i class="ri-user-3-line"></i></div>`;

        div.innerHTML = `
          <div class="rbadge r${item.role}" style="width:24px;height:24px;font-size:.65rem;border-radius:5px;flex-shrink:0;">${item.role}</div>
          ${imgHtml}
          <div style="flex:1;">
            <select id="${slotId}" data-role="${item.role}" data-img-target="img-${slotId}" class="select-rose" style="padding:.4rem .6rem;font-size:.8rem;background:var(--bg2);">
              <option value="">-- Seleziona ${item.role} --</option>
              ${ops.map(p => `<option value="${p.id}" ${p.id === preselectedId ? 'selected' : ''}>${p.name} (${p.club})</option>`).join('')}
            </select>
          </div>
        `;
        container.appendChild(div);

        div.querySelector('select').addEventListener('change', (e) => {
          const val = e.target.value;
          const imgTargetId = e.target.dataset.imgTarget;
          const imgEl = document.getElementById(imgTargetId);
          const pObj = rosa.find(p => String(p.id) === String(val));
          const pPhoto = pObj ? (pObj.photoPersonal || pObj.photoStandard || '') : '';

          if (imgEl) {
            if (pPhoto) {
              imgEl.outerHTML = `<img id="${imgTargetId}" src="${pPhoto}" style="width:28px; height:28px; object-fit:contain; flex-shrink:0;">`;
            } else {
              imgEl.outerHTML = `<div id="${imgTargetId}" style="width:28px; height:28px; background:var(--bg3); display:flex; align-items:center; justify-content:center; border-radius:4px; font-size:0.65rem; color:var(--text3); flex-shrink:0;"><i class="ri-user-3-line"></i></div>`;
            }
          }

          this.refreshAllDropdowns(rosa);
        });
      }
    });
  },

  async save(STATE) {
    const modulo = document.getElementById('f-modulo').value;
    
    const titS = document.querySelectorAll('#titolari-field-slots select');
    const panS = document.querySelectorAll('#panchina-slots select');
    
    let titIds = []; 
    let panIds = [];
    
    titS.forEach(s => { if(s.value) titIds.push(s.value); });
    panS.forEach(s => { if(s.value) panIds.push(s.value); });

    if (titIds.length < 11 || panIds.length < 7) { 
      window.showToast(`Completa tutta la formazione (titolari e panchina) prima di salvare!`, 'err'); 
      return; 
    }
    
    const saveAllChecked = document.getElementById('save-all-comps')?.checked;
    const competitionsToSave = [];

    if (saveAllChecked && Array.isArray(STATE.competitions)) {
      STATE.competitions.forEach(c => competitionsToSave.push(c));
    } else {
      const currentCompId = STATE.currentCompetition;
      const currentCompData = STATE.competitions?.find ? STATE.competitions.find(c => c.id === currentCompId) : null;
      if (currentCompData) competitionsToSave.push(currentCompData);
    }

    try {
      for (const comp of competitionsToSave) {
        const compId = comp.id;
        
        // Calcola la giornata di competizione specifica per QUESTA competizione
        const gwCompetizione = this.getGwCompetizione(comp, STATE);

        const path = `competitions/${compId}/matches/${gwCompetizione}/lineups/${STATE.user.id}`;
        
        const dataToSave = {
          teamId: STATE.user.id, 
          modulo, 
          titolari: titIds, 
          panchina: panIds, 
          timestamp: Date.now()
        };
        
        await window._saveNode(path, dataToSave);

        if (!comp.matches) comp.matches = {};
        if (!comp.matches[gwCompetizione]) comp.matches[gwCompetizione] = {};
        if (!comp.matches[gwCompetizione].lineups) comp.matches[gwCompetizione].lineups = {};
        
        comp.matches[gwCompetizione].lineups[STATE.user.id] = dataToSave;
      }

      window.showToast('Formazione salvata con successo!', 'ok');
    } catch(e) { 
      console.error(e);
      window.showToast('Errore durante il salvataggio', 'err'); 
    }
  }
};
