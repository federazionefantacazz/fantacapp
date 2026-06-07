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
      /* 1. MODIFICATO: Sfondo Giallo con sfumatura Arcade/Cartoon */
      background: linear-gradient(to bottom, #ffeb3b, #fdd835);
      /* 2. MODIFICATO: Spessore e bordo scuro stile fumetto */
      border: 4px solid var(--bg2);
      border-radius: 20px;
      overflow: hidden;
      box-shadow: inset 0 0 30px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.4);
    }
    .field-lines {
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none;
    }
    /* 3. MODIFICATO: Linea di centrocampo più spessa */
    .field-lines::before {
      content: ''; position: absolute; top: 50%; left: 0; width: 100%; height: 4px;
      background: rgba(255, 255, 255, 0.7);
    }
    /* 4. MODIFICATO: Cerchio di centrocampo più evidente */
    .field-center-circle {
      position: absolute; top: 50%; left: 50%; width: 100px; height: 100px;
      border: 4px solid rgba(255, 255, 255, 0.7); border-radius: 50%;
      transform: translate(-50%, -50%);
    }
    /* 5. MODIFICATO: Area di rigore con linee spesse */
    .field-penalty-box {
      position: absolute; bottom: 0; left: 50%; width: 180px; height: 70px;
      border: 4px solid rgba(255, 255, 255, 0.7); border-bottom: none;
      transform: translateX(-50%);
    }
    .field-lines::after {
      content: ''; position: absolute; top: 0; left: 50%; width: 180px; height: 70px;
      border: 4px solid rgba(255, 255, 255, 0.4); border-top: none;
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
    /* 6. MODIFICATO: Maglia con ombra netta (Stile Adesivo Pop) */
    .player-shirt {
      width: 42px; height: 42px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.85rem; font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.5px;
      color: #fff;
      box-shadow: 0 5px 0px rgba(0,0,0,0.25); /* Ombra cartoon netta */
      border: 3px solid #fff;
      transition: transform 0.1s ease-out, box-shadow 0.1s ease-out;
      cursor: pointer;
    }
    /* Effetto pressione cartoon */
    .field-player:active .player-shirt {
      transform: translateY(3px);
      box-shadow: 0 2px 0px rgba(0,0,0,0.25);
    }
    .field-player select {
      position: absolute;
      top: 0; left: 0; width: 100%; height: 42px;
      opacity: 0; cursor: pointer; z-index: 12;
    }
    /* 7. MODIFICATO: Etichetta nome con più contrasto sul giallo */
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
      border: 2px solid rgba(255,255,255,0.15);
      text-align: center;
      box-shadow: 0 3px 6px rgba(0,0,0,0.3);
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
        let bgShirt = '#475569'; // P: Grigio scuro
        if (reparto.role === 'D') bgShirt = '#2196f3'; // D: Blu Elettrico Cartoon
        if (reparto.role === 'C') bgShirt = '#e91e63'; // C: Rosa/Fucsia Pop
        if (reparto.role === 'A') bgShirt = '#ff5722'; // A: Arancione Fiamma
        let colorText = '#fff';

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
