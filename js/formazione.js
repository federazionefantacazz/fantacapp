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

        <div class="label" style="margin-bottom: .5rem; color: var(--accent);">👕 TITOLARI (CAMPOSANTO DI GIOCO)</div>
        
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
            background: linear-gradient(to bottom, #1b4d22, #2e7d32);
            border: 2px solid rgba(255,255,255,0.4);
            border-radius: 12px;
            overflow: hidden;
            box-shadow: inset 0 0 40px rgba(0,0,0,0.5), 0 4px 15px rgba(0,0,0,0.3);
          }
          .field-lines {
            position: absolute;
            top: 0; left: 0; width: 100%; height: 100%;
            pointer-events: none;
          }
          /* Linea di centrocampo */
          .field-lines::before {
            content: ''; position: absolute; top: 50%; left: 0; width: 100%; height: 2px;
            background: rgba(255,255,255,0.3);
          }
          /* Cerchio di centrocampo */
          .field-center-circle {
            position: absolute; top: 50%; left: 50%; width: 90px; height: 90px;
            border: 2px solid rgba(255,255,255,0.3); border-radius: 50%;
            transform: translate(-50%, -50%);
          }
          /* Area di rigore inferiore (Portiere) */
          .field-penalty-box {
            position: absolute; bottom: 0; left: 50%; width: 160px; height: 60px;
            border: 2px solid rgba(255,255,255,0.3); border-bottom: none;
            transform: translateX(-50%);
          }
          /* Area superiore (Estetica finta) */
          .field-lines::after {
            content: ''; position: absolute; top: 0; left: 50%; width: 160px; height: 60px;
            border: 2px solid rgba(255,255,255,0.2); border-top: none;
            transform: translateX(-50%);
          }
          /* Singolo giocatore posizionato sul campo */
          .field-player {
            position: absolute;
            transform: translate(-50%, -50%);
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 75px;
            z-index: 10;
          }
          /* Icona maglia/cerchio giocatore */
          .player-shirt {
            width: 38px; height: 38px;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 0.75rem; font-weight: bold; color: #fff;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            border: 2px solid #fff;
            transition: transform 0.2s;
            cursor: pointer;
          }
          .field-player:active .player-shirt {
            transform: scale(1.1);
          }
          /* Dropdown stilizzato invisibile sopra la maglia */
          .field-player select {
            position: absolute;
            top: 0; left: 0; width: 100%; height: 38px;
            opacity: 0; cursor: pointer; z-index: 12;
          }
          /* Etichetta col nome sotto la maglia */
          .player-name-label {
            margin-top: 4px;
            background: rgba(10, 15, 30, 0.85);
            color: #fff;
            font-size: 0.7rem;
            padding: 2px 6px;
            border-radius: 4px;
            max-width: 85px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            border: 1px solid rgba(255,255,255,0.1);
            text-align: center;
          }
        </style>
      </div>
    `;
  },

  render(STATE) {
    const modSelect = document.getElementById('f-modulo');
    if (!modSelect) return;
    
    if (!window._formazioneInitialized) {
      modSelect.addEventListener('change', () => this.buildSlots(STATE));
      document.getElementById('btn-save-lineup').addEventListener('click', () => this.save(STATE));
      window._formazioneInitialized = true;
      this.buildSlots(STATE);
    }
  },

  buildSlots(STATE) {
    const modulo = document.getElementById('f-modulo').value;
    const [def, mid, att] = modulo.split('-').map(Number);
    
    const miaRosa = STATE.players.filter(p => p.teamId === STATE.user.id);

    // 1. Disegna i Titolari sul Finto Campo
    this.drawFieldTitolari(def, mid, att, miaRosa);

    // 2. Disegna la panchina normalmente sotto il campo
    const schemaPan = [{role:'P', count:1}, {role:'D', count:2}, {role:'C', count:2}, {role:'A', count:2}];
    this.drawSchemaPanchina('panchina-slots', schemaPan, 'pan', miaRosa);
  },

  // FUNZIONE PER GENERARE I CALCIATORI NELLE COORDINATE DEL CAMPO
  drawFieldTitolari(def, mid, att, rosa) {
    const container = document.getElementById('titolari-field-slots');
    container.innerHTML = '';

    // Generiamo la mappa dei ruoli e quanti ce ne sono
    const ruoli = [
      { role: 'P', count: 1 },
      { role: 'D', count: def },
      { role: 'C', count: mid },
      { role: 'A', count: att }
    ];

    // Coordinate 'Y' (Altezza da top in percentuale) per i 4 reparti sul campo (Attacco in alto, Portiere in basso)
    const rowPositions = {
      'A': 20,  // 20% dall'alto
      'C': 45,  // 45% dall'alto
      'D': 70,  // 70% dall'alto
      'P': 90   // 90% dall'alto
    };

    ruoli.forEach(reparto => {
      const y = rowPositions[reparto.role];
      const count = reparto.count;

      for (let i = 1; i <= count; i++) {
        // Calcolo coordinata 'X' (Larghezza in percentuale) per distribuire i giocatori in orizzontale
        // Se c'è 1 giocatore va al 50%. Se sono di più, si dividono lo spazio simmetricamente.
        const x = count === 1 ? 50 : (100 / (count + 1)) * i;
        
        const slotId = `tit-${reparto.role}-${i}`;
        const ops = rosa.filter(p => p.role === reparto.role);

        // Identifichiamo il colore della maglia in base al ruolo (riutilizzando i tuoi colori)
        let bgShirt = '#64748b'; // rD
        if (reparto.role === 'P') bgShirt = '#475569';
        if (reparto.role === 'C') bgShirt = '#50e3c2';
        if (reparto.role === 'A') bgShirt = '#ff6b6b';
        let colorText = reparto.role === 'C' ? '#0a0f1e' : '#fff';

        const playerDiv = document.createElement('div');
        playerDiv.className = 'field-player';
        playerDiv.style.left = `${x}%`;
        playerDiv.style.top = `${y}%`;

        playerDiv.innerHTML = `
          <div class="player-shirt" style="background: ${bgShirt}; color: ${colorText};">
            ${reparto.role}
          </div>
          <div class="player-name-label" id="label-${slotId}">Scegli</div>
          
          <select id="${slotId}" data-label-target="label-${slotId}" class="field-select">
            <option value="">-- ${reparto.role} --</option>
            ${ops.map(p => `<option value="${p.id}">${p.name} (${p.club})</option>`).join('')}
          </select>
         shadow`;

        container.appendChild(playerDiv);

        // Controllo duplicati e aggiornamento del nome sotto la maglia grafica
        const selectEl = playerDiv.querySelector('select');
        selectEl.addEventListener('change', (e) => {
          const val = e.target.value;
          const labelId = e.target.dataset.labelTarget;
          const labelEl = document.getElementById(labelId);

          if (!val) {
            labelEl.textContent = 'Scegli';
            labelEl.style.color = '#fff';
            return;
          }

          // Controllo duplicati globale (Campo + Panchina)
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
          } else {
            // Aggiorna il testo grafico sotto il giocatore col cognome corretto
            const selectedText = e.target.options[e.target.selectedIndex].text;
            labelEl.textContent = selectedText.split(' (')[0]; // Prende solo il nome, esclude il club
            labelEl.style.color = 'var(--accent)';
          }
        });
      }
    });
  },

  // FUNZIONE PANCHINA STANDARD (RIMANE UNA COMODA LISTA SOTTO IL CAMPO)
  drawSchemaPanchina(id, schema, prefix, rosa) {
    const container = document.getElementById(id);
    container.innerHTML = '';
    schema.forEach(item => {
      for (let i = 1; i <= item.count; i++) {
        const slotId = `${prefix}-${item.role}-${i}`;
        const ops = rosa.filter(p => p.role === item.role);
        const div = document.createElement('div');
        div.className = 'pcard'; 
        div.style.padding = '.4rem .6rem';
        div.innerHTML = `
          <div class="rbadge r${item.role}" style="width:24px;height:24px;font-size:.65rem;border-radius:5px">${item.role}</div>
          <div style="flex:1;">
            <select id="${slotId}" class="select-rose" style="padding:.4rem .6rem;font-size:.8rem;background:var(--bg2);">
              <option value="">-- Seleziona Panchina --</option>
              ${ops.map(p => `<option value="${p.id}">${p.name} (${p.club})</option>`).join('')}
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

  // OPERAZIONE DI SALVATAGGIO SU FIREBASE REALTIME DATABASE (Invariata a livello logico)
  async save(STATE) {
    const currentGw = STATE.status?.currentGW || 1;
    const modulo = document.getElementById('f-modulo').value;
    
    // Raccoglie i selettori dal campo e dalla panchina
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
      await window._saveNode(`lineups/gw${currentGw}/${STATE.user.id}`, {
        teamId: STATE.user.id, 
        modulo, 
        titolari: titIds, 
        panchina: panIds, 
        timestamp: Date.now()
      });
      window.showToast('Formazione salvata sul campo!', 'ok');
    } catch(e) { 
      window.showToast('Errore durante il salvataggio', 'err'); 
    }
  }
};
