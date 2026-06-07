export const MercatoPage = {
  renderHTML() {
    return `
      <div class="page" id="page-mercato">
        <div class="sec" style="margin-top:1.2rem">Mercato</div>
        
        <div style="display: flex; gap: .5rem; margin-bottom: 1.5rem; background: var(--bg2); padding: .4rem; border-radius: 12px;">
          <button class="btn tab-btn btn-green" id="tab-scambi" style="padding: .5rem; font-size: .8rem; width: 50%;">
            🤝 Scambi Utenti
          </button>
          <button class="btn tab-btn btn-outline" id="tab-gestione" style="padding: .5rem; font-size: .8rem; width: 50%;">
            ⚙️ Gestione Rosa
          </button>
        </div>

        <div id="subpage-scambi" class="market-subpage">
          <div class="card">
            <div class="label" style="color: var(--accent); margin-bottom: .6rem;">Proponi uno Scambio</div>
            <p style="font-size: .85rem; color: var(--text2); margin-bottom: 1rem;">
              Seleziona un fanta-allenatore per avviare la trattativa di scambio dei cartellini.
            </p>
            
            <div class="label">Seleziona Destinatario</div>
            <select id="scambio-destinatario" class="select-rose" style="margin-bottom: 1rem; background: var(--bg3);">
              <option value="">Caricamento utenti...</option>
            </select>

            <button class="btn btn-outline" id="btn-apri-trattativa" style="width: 100%;">
              Inizia Trattativa
            </button>
          </div>
          
          <div class="label" style="margin-bottom: .5rem;">Trattative in Corso</div>
          <div id="lista-trattative">
            <div style="text-align: center; color: var(--text3); font-size: .8rem; padding: 1rem;">
              Nessuna trattativa attiva al momento.
            </div>
          </div>
        </div>

        <div id="subpage-gestione" class="market-subpage" style="display: none;">
          <div class="card" style="text-align: center; padding: 2.5rem 1.5rem; border: 1px dashed var(--accent3);">
            <div style="font-size: 2.5rem; margin-bottom: .8rem;">🔒</div>
            <div class="label" style="color: var(--accent3); font-size: .9rem; margin-bottom: .5rem;">Sessione Chiusa</div>
            <p style="font-size: .8rem; color: var(--text2); line-height: 1.4;">
              Acquisti e svincoli dal mercato degli svincolati sono momentaneamente **disattivati** dall'amministratore della lega.
            </p>
          </div>
        </div>
      </div>
    `;
  },

  render(STATE) {
    if (!window._mercatoInitialized) {
      this.initTabs();
      this.popolaDestinatari(STATE);
      
      document.getElementById('btn-apri-trattativa').addEventListener('click', () => {
        const dest = document.getElementById('scambio-destinatario').value;
        if(!dest) {
          window.showToast('Seleziona un avversario!', 'err');
          return;
        }
        window.showToast('Funzionalità scambi in attivazione!', 'ok');
      });

      window._mercatoInitialized = true;
    }
  },

  // LOGICA DI SWITCH TRA LE DUE TAB (SOTTOMENU)
  initTabs() {
    const btnScambi = document.getElementById('tab-scambi');
    const btnGestione = document.getElementById('tab-gestione');
    const subScambi = document.getElementById('subpage-scambi');
    const subGestione = document.getElementById('subpage-gestione');

    btnScambi.addEventListener('click', () => {
      // Attiva tab scambi
      btnScambi.className = "btn tab-btn btn-green";
      btnGestione.className = "btn tab-btn btn-outline";
      subScambi.style.display = "block";
      subGestione.style.display = "none";
    });

    btnGestione.addEventListener('click', () => {
      // Attiva tab gestione
      btnScambi.className = "btn tab-btn btn-outline";
      btnGestione.className = "btn tab-btn btn-green";
      subScambi.style.display = "none";
      subGestione.style.display = "block";
    });
  },

  // PRENDE GLI UTENTI DISPONIBILI PER GLI SCAMBI (ESCLUDENDO SE STESSI)
  popolaDestinatari(STATE) {
    const select = document.getElementById('scambio-destinatario');
    if (!select) return;

    if (!STATE.teams || STATE.teams.length === 0) {
      select.innerHTML = '<option value="">Nessuna squadra trovata</option>';
      return;
    }

    // Filtra escludendo l'utente attualmente loggato
    const avversari = STATE.teams.filter(t => t.id !== STATE.user.id);

    select.innerHTML = '<option value="">-- Scegli Sfidante --</option>' + 
      avversari.map(t => `
        <option value="${t.id}">${t.emoji || '⚽'} ${t.name} (${t.owner})</option>
      `).join('');
  }
};
