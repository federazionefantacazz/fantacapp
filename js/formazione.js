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

        <div class="label" style="margin-bottom: .5rem; color: var(--accent);">👕 TITOLARI (RETTANGOLO DI GIOCO)</div>
        
        <div class="soccer-field" id="soccer-field-container">
          <div class="field-lines">
            <div class="field-penalty-box"></div>
            <div class="field-center-circle"></div>
          </div>
          <div id="titolari-field-slots"></div>
        </div>

        <div class="label" style="margin-bottom: .5rem; color: var(--gold); margin-top: 1.5rem;">🪑 PANCHINA (1 P | 2 D | 2 C | 2 A)</div>
        <div id="panchina-slots" style="display: flex; flex-direction: column; gap: .4rem; margin-bottom: 1.5rem;"></div>
        
        <button class="btn btn-green" style="width: 100%; padding: .8rem; margin-bottom:2rem;" id="btn-save-lineup">💾 Salva Formazione</button>

        <style>
        .soccer-field {
          position: relative;
          width: 100%;
          height: 480px;
          background: linear-gradient(to bottom, #2e3541, #232932);
          border: 2px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: inset 0 0 30px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.3);
        }
        .field-lines {
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          pointer-events: none;
        }
        .field-lines::before {
          content: ''; position: absolute; top: 50%; left: 0; width: 100%; height: 2px;
          background: rgba(255, 255, 255, 0.2);
        }
        .field-center-circle {
          position: absolute; top: 50%; left: 50%; width: 100px; height: 100px;
          border: 2px solid rgba(255, 255, 255, 0.2); border-radius: 50%;
          transform: translate(-50%, -50%);
        }
        .field-penalty-box {
          position: absolute; bottom: 0; left: 50%; width: 180px; height: 70px;
          border: 2px solid rgba(255, 255, 255, 0.2); border-bottom: none;
          transform: translateX(-50%);
        }
        .field-lines::after {
          content: ''; position: absolute; top: 0; left: 50%; width: 180px; height: 70px;
          border: 2px solid rgba(255, 255, 255, 0.15); border-top: none;
          transform: translateX(-50%);
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
        .player-shirt {
          width: 42px; height: 42px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.85rem; font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.5px;
          color: #fff;
          box-shadow: 0 4px 10px rgba(0,0,0,0.4);
          border: 2px solid rgba(255,255,255,0.2);
          transition: transform 0.1s ease-out, box-shadow 0.1s ease-out;
          cursor: pointer;
        }
        .field-player:active .player-shirt {
          transform: translateY(2px);
          box-shadow: 0 2px 4px rgba(0,0,0,0.4);
        }
        .field-player select {
          position: absolute;
          top: 0; left: 0; width: 100%; height: 42px;
          opacity: 0; cursor: pointer; z-index: 12;
        }
        .player-name-label {
          margin-top: 8px;
          background: #0a0f1e;
          color: #fff;
          font-size: 0.7rem;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 6px;
          max-width: 85px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          border: 1px solid rgba(255,255,255,0.12);
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
      // Ascolta il cambio modulo manuale dell'utente
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

  buildSlots(STATE, userChangedModulo = false) {
    if (!STATE || !STATE.user || !STATE.players || STATE.players.length === 0) return;

    const modSelect = document.getElementById('f-modulo');
    if (!modSelect) return;

    const currentGw = STATE.status?.currentGW || 1;
    const userId = STATE.user.id;
    const compId = STATE.currentCompetition;
    
    // RADAR: Cerca la formazione provando tutti i percorsi possibili nel database
    let savedLineup = null;
    
    if (STATE.competitions?.[compId]?.lineups?.[`gw${currentGw}`]?.[userId]) {
      savedLineup = STATE.competitions[compId].lineups[`gw${currentGw}`][userId];
    } else if (STATE.lineups?.[`gw${currentGw}`]?.[userId]) {
      savedLineup = STATE.lineups[`gw${currentGw}`][userId];
    } else if (STATE.lineups?.[compId]?.[`gw${currentGw}`]?.[userId]) {
      savedLineup = STATE.lineups[compId][`gw${currentGw}`][userId];
    }

    // Se troviamo la formazione e l'utente non ha cambiato modulo a mano, caricalo
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

    // Recuperiamo gli ID dei calciatori salvati
    const savedTitolariIds = savedLineup?.titolari || [];
    const savedPanchinaIds = savedLineup?.panchina || [];

    // Rigenera i campi visivi
    this.drawFieldTitolari(def, mid, att, miaRosa, savedTitolariIds);
    const schemaPan = [{role:'P', count:1}, {role:'D', count:2}, {role:'C', count:2}, {role:'A', count:2}];
    this.drawSchemaPanchina('panchina-slots', schemaPan, 'pan', miaRosa, savedPanchinaIds);
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
    
    // Indice globale per scorrere i giocatori salvati in ordine di ruolo (P -> D -> C -> A)
    let savedIndex = 0;

    ruoli.forEach(reparto => {
      const y = rowPositions[reparto.role];
      const count = reparto.count;

      for (let i = 1; i <= count; i++) {
        const x = count === 1 ? 50 : (100 / (count + 1)) * i;
        const slotId = `tit-${reparto.role}-${i}`;
        
        // Filtra i giocatori disponibili per questo ruolo
        const ops = rosa.filter(p => p.role === reparto.role);

        // Controlla se c'è un ID salvato disponibile per questo slot specifico di ruolo
        let preselectedId = "";
        let preselectedText = "Scegli";
        let isSelected = false;

        // Cerchiamo se tra i giocatori salvati ce n'è uno valido per questo ruolo specifico
        if (savedIds && savedIds.length > 0) {
          // Filtriamo i savedIds per trovare quelli che appartengono a questo ruolo
          const ruoloSavedIds = savedIds.filter(id => {
            const p = rosa.find(player => player.id === id);
            return p && p.role === reparto.role;
          });
          
          // Se ne troviamo uno corrispondente al sotto-indice corrente del ciclo i, lo usiamo
          if (ruoloSavedIds[i - 1]) {
            preselectedId = ruoloSavedIds[i - 1];
            const pObj = rosa.find(p => p.id === preselectedId);
            if (pObj) {
              preselectedText = pObj.name;
              isSelected = true;
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

        playerDiv.innerHTML = `
          <div class="player-shirt" style="background: ${bgShirt}; color: #fff;">
            ${reparto.role}
          </div>
          <div class="player-name-label" id="label-${slotId}" style="${isSelected ? 'color: var(--accent); border-color: var(--accent);' : ''}">
            ${preselectedText}
          </div>
          
          <select id="${slotId}" data-label-target="label-${slotId}" class="field-select">
            <option value="">-- ${reparto.role} --</option>
            ${ops.map(p => `<option value="${p.id}" ${p.id === preselectedId ? 'selected' : ''}>${p.name} (${p.club})</option>`).join('')}
          </select>
        `;

        container.appendChild(playerDiv);

        playerDiv.querySelector('select').addEventListener('change', (e) => {
          const val = e.target.value;
          const labelId = e.target.dataset.labelTarget;
          const labelEl = document.getElementById(labelId);

          if (!val) {
            labelEl.textContent = 'Scegli';
            labelEl.style.color = '#fff';
            labelEl.style.borderColor = 'rgba(255,255,255,0.12)';
            return;
          }

          const allSelects = document.querySelectorAll('#titolari-field-slots select, #panchina-slots select');
          let isDuplicate = false;
          allSelects.forEach(s => {
            if (s.id !== slotId && s.value === val) isDuplicate = true;
          });

          if (isDuplicate) {
            window.showToast('Calciatore già inserito!', 'err');
            e.target.value = '';
            labelEl.textContent = 'Scegli';
            labelEl.style.color = '#fff';
            labelEl.style.borderColor = 'rgba(255,255,255,0.12)';
          } else {
            const selectedText = e.target.options[e.target.selectedIndex].text;
            labelEl.textContent = selectedText.split(' (')[0];
            labelEl.style.color = 'var(--accent)';
            labelEl.style.borderColor = 'var(--accent)';
          }
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

        // Troviamo il giocatore pre-selezionato in panchina per questo specifico ruolo ed indice
        let preselectedId = "";
        if (savedIds && savedIds.length > 0) {
          const ruoloSavedIds = savedIds.filter(id => {
            const p = rosa.find(player => player.id === id);
            return p && p.role === item.role;
          });
          if (ruoloSavedIds[i - 1]) {
            preselectedId = ruoloSavedIds[i - 1];
          }
        }

        const div = document.createElement('div');
        div.className = 'pcard'; 
        div.style.padding = '.4rem .6rem';
        div.innerHTML = `
          <div class="rbadge r${item.role}" style="width:24px;height:24px;font-size:.65rem;border-radius:5px">${item.role}</div>
          <div style="flex:1;">
            <select id="${slotId}" class="select-rose" style="padding:.4rem .6rem;font-size:.8rem;background:var(--bg2);">
              <option value="">-- Seleziona ${item.role} --</option>
              ${ops.map(p => `<option value="${p.id}" ${p.id === preselectedId ? 'selected' : ''}>${p.name} (${p.club})</option>`).join('')}
            </select>
          </div>
        `;
        container.appendChild(div);

        div.querySelector('select').addEventListener('change', (e) => {
          const val = e.target.value; 
          if(!val) return;
          const all = document.querySelectorAll('#titolari-field-slots select, #panchina-slots select');
          let dup = false;
          all.forEach(s => { if(s.id !== slotId && s.value === val) dup = true; });
          if(dup) { 
            window.showToast('Calciatore già inserito!', 'err'); 
            e.target.value = ''; 
          }
        });
      }
    });
  },

  async save(STATE) {
    const currentGw = STATE.status?.currentGW || 1;
    const modulo = document.getElementById('f-modulo').value;
    
    const titS = document.querySelectorAll('#titolari-field-slots select');
    const panS = document.querySelectorAll('#panchina-slots select');
    
    let titIds = []; 
    let panIds = [];
    
    titS.forEach(s => { if(s.value) titIds.push(s.value); });
    panS.forEach(s => { if(s.value) panIds.push(s.value); });

    if (titIds.length < 11) { 
      window.showToast(`Inserisci tutti gli 11 titolari sul campo!`, 'err'); 
      return; 
    }
    
    try {
      const path = `competitions/${STATE.currentCompetition}/lineups/gw${currentGw}/${STATE.user.id}`;
      const dataToSave = {
        teamId: STATE.user.id, 
        modulo, 
        titolari: titIds, 
        panchina: panIds, 
        timestamp: Date.now()
      };

      await window._saveNode(path, dataToSave);

      // Aggiorniamo al volo anche lo STATE locale per riflettere subito il salvataggio senza ricaricare l'app
      if(!STATE.competitions) STATE.competitions = {};
      if(!STATE.competitions[STATE.currentCompetition]) STATE.competitions[STATE.currentCompetition] = {};
      if(!STATE.competitions[STATE.currentCompetition].lineups) STATE.competitions[STATE.currentCompetition].lineups = {};
      if(!STATE.competitions[STATE.currentCompetition].lineups[`gw${currentGw}`]) STATE.competitions[STATE.currentCompetition].lineups[`gw${currentGw}`] = {};
      
      STATE.competitions[STATE.currentCompetition].lineups[`gw${currentGw}`][STATE.user.id] = dataToSave;

      window.showToast('Formazione salvata con successo!', 'ok');
    } catch(e) { 
      window.showToast('Errore durante il salvataggio', 'err'); 
    }
  }
};
