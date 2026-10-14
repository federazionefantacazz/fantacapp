import { ref, update, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
// IMPORTA SIA uploadImageToImgBB SIA LA NUOVA FUNZIONE PER GLI URL
import { uploadImageToImgBB, uploadUrlToImgBB } from "../services/integrationImgBB.js"; 
import { esc } from '../utils.js';

export const PlayersSection = {
  _filter: '',
  _db: null,

  init(db) {
    this._db = db;
    
    // Filtro di ricerca
    window.filterPlayersAdmin = (val) => {
      this.setFilter(val);
      if (window.PLAYERS) {
        this.render({ PLAYERS: window.PLAYERS });
      }
    };

    // Funzione per svincolare un giocatore
    window.releasePlayer = async (playerId) => {
      if (!window.PLAYERS) return;
      const giocatore = window.PLAYERS.find(p => p.id === playerId);
      if (!giocatore) return;
      
      if (confirm(`Vuoi svincolare ${giocatore.name}?`)) {
        try {
          if (!this._db) throw new Error("Database non inizializzato");
          await update(ref(this._db, 'players/' + playerId), { teamId: null });
          if (typeof window.toast === 'function') window.toast(`${giocatore.name} svincolato.`, 'ok');
        } catch (err) {
          if (typeof window.toast === 'function') window.toast("Errore durante lo svincolo", "err");
          console.error(err);
        }
      }
    };

    // NUOVA FUNZIONE: Elimina l'intero listone dei calciatori da Firebase
    window.clearPlayersDatabase = async () => {
      if (!this._db) {
        if (typeof window.toast === 'function') window.toast("Database non inizializzato", "err");
        return;
      }

      if (confirm("ATTENZIONE!\nStai per eliminare TUTTI i calciatori dal database.\nQuesta azione rimuoverà anche i giocatori associati alle squadre. Vuoi procedere?")) {
        if (confirm("Sei assolutamente sicuro? L'azione è irreversibile e resetterà il listone.")) {
          try {
            await set(ref(this._db, 'players'), null);
            if (typeof window.toast === 'function') {
              window.toast("Database calciatori svuotato con successo!", "ok");
            }
          } catch (err) {
            console.error(err);
            if (typeof window.toast === 'function') {
              window.toast("Errore durante l'eliminazione del listone", "err");
            }
          }
        }
      }
    };

    // LOGICA DI IMPORTAZIONE SPECIFICA PER IL CSV/EXCEL DI FANTACALCIO
    window.importPlayersData = async () => {
      const textarea = document.getElementById('pImportInput');
      if (!textarea || !textarea.value.trim()) {
        if (typeof window.toast === 'function') window.toast("Incolla i dati della lista!", "err");
        return;
      }

      try {
        let playersArray = [];
        const rawData = textarea.value.trim();

        if (rawData.startsWith('[') || rawData.startsWith('{')) {
          const parsed = JSON.parse(rawData);
          const listaGrezza = Array.isArray(parsed) ? parsed : Object.values(parsed);
          playersArray = listaGrezza.map((p, index) => ({
            id: p.id || (p.name || p.n || '').toLowerCase().replace(/[^a-z0-9]/g, '') + index,
            name: p.name || p.n || 'Sconosciuto',
            role: (p.role || p.r || 'D').toUpperCase().charAt(0),
            club: p.club || p.team || p.s || 'Svincolato',
            value: parseInt(p.value || p.q || p.fvm || 1),
            teamId: p.teamId || null,
            photoStandard: p.photoStandard || null,
            photoPersonal: p.photoPersonal || null
          }));
        } 
        else {
          const lines = rawData.split('\n');
          
          lines.forEach((line) => {
            if (!line.trim()) return;

            let parts = line.split(',');
            if (parts.length < 5) parts = line.split('\t');

            if (parts[0].toLowerCase().includes('id') || parts[0].toLowerCase().includes('quotazioni') || isNaN(parts[0].trim())) {
              return; 
            }

            if (parts.length >= 5) {
              const id = parts[0].trim();            
              const role = parts[1].trim().toUpperCase(); 
              const name = parts[3].trim();          
              const club = parts[4].trim();          
              const value = parseInt(parts[5]) || 1; 

              if (id && name) {
                playersArray.push({
                  id: id,
                  name: name,
                  role: role,
                  club: club || 'Svincolato',
                  value: value,
                  teamId: null
                });
              }
            }
          });
        }

        if (playersArray.length === 0) {
          throw new Error("Nessun calciatore valido rilevato. Controlla di aver incluso i dati corretti.");
        }

        if (confirm(`Rilevati ${playersArray.length} calciatori pronti per l'importazione. Vuoi aggiornare il database Firebase?\n(I calciatori esistenti con lo stesso ID verranno aggiornati, i nuovi inseriti)`)) {
          if (!this._db) throw new Error("Database non inizializzato");
          
          const updates = {};
          playersArray.forEach(p => {
            updates['players/' + p.id] = p;
          });

          await update(ref(this._db), updates);
          if (typeof window.toast === 'function') window.toast(`Importati/Aggiornati con successo ${playersArray.length} giocatori!`, 'ok');
          textarea.value = '';
        }

      } catch (err) {
        console.error(err);
        if (typeof window.toast === 'function') {
          window.toast("Errore durante l'importazione. Controlla il formato.", "err");
        }
      }
    };

    // AGGIORNA CAMPIONCINI STANDARD USANDO LA NUOVA FUNZIONE uploadUrlToImgBB
    // Stagioni Fantacalcio da cui prendere il campioncino, dalla più recente
    const CAMPIONCINI_SEASONS = [21, 20, 19];

    // Giocatori il cui campioncino non è stato aggiornato, con il motivo: { id, name, reason }
    this._photoFailures = [];

    // Carica su ImgBB il campioncino di un giocatore e lo salva in 'photoStandard'.
    // Restituisce l'URL finale, altrimenti lancia l'errore con il motivo.
    const uploadStandardPhoto = async (player) => {
      if (!player.id || isNaN(player.id)) throw new Error("ID giocatore non valido");

      // Se la foto della stagione corrente non esiste (giocatore nuovo o non più in Serie A)
      // ImgBB risponde 400: si riprova con le stagioni precedenti prima di arrendersi.
      let finalImgUrl = null;
      let lastErr = null;
      for (const season of CAMPIONCINI_SEASONS) {
        const fantacalcioUrl = `https://content.fantacalcio.it/web/campioncini/${season}/medium/${player.id}.png`;
        try {
          finalImgUrl = await uploadUrlToImgBB(fantacalcioUrl, `campioncino_${player.id}`);
          if (finalImgUrl) break;
        } catch (err) {
          lastErr = err;
          // Solo un 400 indica un'immagine sorgente non valida: per gli altri errori
          // (chiave, limiti, rete) cambiare stagione non serve.
          if (err.status !== 400) break;
        }
      }
      if (!finalImgUrl) throw lastErr || new Error("Errore durante l'upload su ImgBB");

      await update(ref(this._db, `players/${player.id}`), { photoStandard: finalImgUrl });
      return finalImgUrl;
    };

    const setFailure = (player, err) => {
      this._photoFailures = this._photoFailures.filter(f => String(f.id) !== String(player.id));
      if (err) this._photoFailures.push({ id: player.id, name: player.name, reason: err.message });
    };

    window.updateStandardPhotosImgBB = async () => {
      if (!window.PLAYERS || window.PLAYERS.length === 0) {
        if (typeof window.toast === 'function') window.toast("Nessun giocatore nel database!", "err");
        return;
      }

      if (!confirm(`Vuoi scaricare le foto da Fantacalcio (stagione 21) per ${window.PLAYERS.length} giocatori e caricarle su ImgBB salvando 'photoStandard'?`)) {
        return;
      }

      const statusBox = document.getElementById('campionciniStatus');
      if (statusBox) statusBox.style.display = 'block';

      let successCount = 0;
      const players = [...window.PLAYERS];
      const total = players.length;
      this._photoFailures = [];
      this.renderPhotoFailures();

      for (let i = 0; i < total; i++) {
        const player = players[i];

        if (statusBox) {
          statusBox.textContent = `Elaborazione ${i + 1}/${total}: ${player.name}... (Caricati: ${successCount}, Errore: ${this._photoFailures.length})`;
        }

        try {
          await uploadStandardPhoto(player);
          successCount++;
        } catch (err) {
          console.warn(`Errore caricamento per ${player.name} (ID: ${player.id}): ${err.message}`);
          setFailure(player, err);
        }
      }

      const failCount = this._photoFailures.length;
      if (failCount) {
        console.warn(`Campioncini non aggiornati (${failCount}):\n` +
          this._photoFailures.map(f => `${f.name} (${f.id}): ${f.reason}`).join('\n'));
      }

      if (statusBox) {
        statusBox.textContent = `Completato! Caricate ${successCount} foto su ImgBB (${failCount} non trovate o fallite).`;
      }
      this.renderPhotoFailures();

      if (typeof window.toast === 'function') {
        if (failCount) window.toast(`Aggiornati ${successCount} campioncini, ${failCount} in errore: vedi elenco sotto.`, 'err');
        else window.toast(`Aggiornati ${successCount} campioncini standard!`, 'ok');
      }
    };

    // Ricarica il campioncino di un solo giocatore (dall'elenco errori o dalla tabella)
    window.retryStandardPhoto = async (playerId, btn) => {
      const player = (window.PLAYERS || []).find(p => String(p.id) === String(playerId));
      if (!player) return;
      if (btn) { btn.disabled = true; btn.textContent = '...'; }

      try {
        await uploadStandardPhoto(player);
        setFailure(player, null);
        if (typeof window.toast === 'function') window.toast(`Campioncino di ${player.name} aggiornato.`, 'ok');
      } catch (err) {
        console.warn(`Errore caricamento per ${player.name} (ID: ${player.id}): ${err.message}`);
        setFailure(player, err);
        if (typeof window.toast === 'function') window.toast(`${player.name}: ${err.message}`, 'err');
      }

      if (btn) { btn.disabled = false; btn.textContent = 'Foto'; }
      this.renderPhotoFailures();
    };

    // Riprova tutti i giocatori rimasti in errore
    window.retryFailedStandardPhotos = async () => {
      const ids = this._photoFailures.map(f => f.id);
      for (const id of ids) await window.retryStandardPhoto(id);
    };
  },

  renderHTML() {
    return `
    <div id="sec-players" class="admin-sec" style="display:none">
      <div class="sec-title">Database Calciatori</div>
      
      <!-- Box Gestione Strumenti Listone -->
      <div class="card" style="border-left: 4px solid var(--accent2)">
        <div class="label" style="color: var(--accent2)">Importazione Listone Fantacalcio (CSV / Excel)</div>
        <p style="font-size: 0.8rem; color: var(--text2); font-family: var(--font-sub, inherit); margin-bottom: 0.75rem;">
          Apri il file Excel, seleziona e copia le righe dei calciatori che desideri importare (inclusa o meno la riga di intestazione), poi incollale qui sotto. Il sistema riconoscerà automaticamente ID, Ruolo, Nome, Squadra e Quotazione.
        </p>
        <textarea id="pImportInput" class="input-login" rows="4" placeholder="Incolla qui le righe del file (es: 4312,P,Por,Maignan,Milan,16...)" style="font-family:'DM Mono',monospace; font-size:0.8rem; height:120px; resize:vertical; margin-bottom:0.75rem;"></textarea>
        
        <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.75rem;">
          <button class="btn btn-blue" style="width:auto; padding:0.5rem 1.5rem;" onclick="window.importPlayersData()">Elabora ed Importa</button>
          <button class="btn btn-outline" style="width:auto; padding:0.5rem 1.5rem; border-color: var(--accent);" onclick="window.updateStandardPhotosImgBB()"><i class="ri-image-line"></i> Aggiorna Campioncini Standard</button>
          <button class="btn btn-red" style="width:auto; padding:0.5rem 1.5rem; background: var(--accent3);" onclick="window.clearPlayersDatabase()"><i class="ri-delete-bin-line"></i> Svuota Intero Listone</button>
        </div>

        <div id="campionciniStatus" style="display:none; font-size: 0.8rem; color: var(--accent); font-weight: 600; padding: 0.5rem; background: rgba(0,0,0,0.2); border-radius: 6px;"></div>
        <div id="campionciniErrors" style="display:none; margin-top: 0.5rem;"></div>
      </div>

      <div class="card">
        <div style="display:flex;gap:1rem;margin-bottom:1rem;align-items:center">
          <input type="text" id="pSearch" class="input-login" placeholder="Cerca calciatore per nome..." style="margin-bottom:0;max-width:300px" oninput="window.filterPlayersAdmin(this.value)">
          <div style="font-size:.85rem;color:var(--text2);font-family:var(--font-sub,inherit)" id="pFoundCount"></div>
        </div>
        <div class="table-wrapper" style="max-height:500px">
          <table>
            <thead>
              <tr><th>Foto</th><th>Nome</th><th>Ruolo</th><th>Club</th><th>Valore</th><th>Azioni</th></tr>
            </thead>
            <tbody id="playersTableBody"></tbody>
          </table>
        </div>
      </div>
    </div>`;
  },

  render({ PLAYERS }) {
    const tbody = document.getElementById('playersTableBody');
    if (!tbody) return;

    const f = this._filter.toLowerCase();
    const filtered = PLAYERS ? PLAYERS.filter(p => p.name && p.name.toLowerCase().includes(f)) : [];

    const pFoundCount = document.getElementById('pFoundCount');
    if (pFoundCount) pFoundCount.textContent = `Trovati: ${filtered.length}`;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text3);font-family:var(--font-text3,inherit); padding:2rem;">Nessun calciatore nel database. Usa il box sopra per importarli.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.slice(0, 50).map(p => {
      const imgUrl = p.photoPersonal || p.photoStandard || '';
      const imgHTML = imgUrl 
        ? `<img src="${imgUrl}" alt="${p.name}" style="width:32px; height:32px; object-fit:contain; border-radius:4px;">`
        : `<div style="width:32px; height:32px; background:var(--bg3); display:flex; align-items:center; justify-content:center; border-radius:4px; font-size:0.7rem; color:var(--text3);font-family:var(--font-text3,inherit);"><i class="ri-user-3-line"></i></div>`;

      return `
      <tr>
        <td>${imgHTML}</td>
        <td><strong>${p.name}</strong></td>
        <td><span class="badge ${p.role === 'P' ? 'badge-gray' : p.role === 'D' ? 'badge-blue' : p.role === 'C' ? 'badge-green' : 'badge-red'}">${p.role}</span></td>
        <td>${p.club || 'Svincolato'}</td>
        <td><strong>${p.value || '—'}</strong></td>
        <td>
          <button class="btn btn-outline" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; width: auto;" title="Ricarica campioncino standard" onclick="window.retryStandardPhoto('${p.id}', this)">Foto</button>
          <button class="btn btn-red" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; width: auto;" onclick="window.releasePlayer('${p.id}')">Svincola</button>
        </td>
      </tr>
      `;
    }).join('');
  },

  // Elenco dei campioncini in errore, ognuno con il motivo e il pulsante per riprovare
  renderPhotoFailures() {
    const box = document.getElementById('campionciniErrors');
    if (!box) return;
    const failures = this._photoFailures || [];
    if (failures.length === 0) {
      box.style.display = 'none';
      box.innerHTML = '';
      return;
    }
    box.style.display = 'block';
    box.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem; margin-bottom:0.4rem;">
        <div style="font-size:0.8rem; font-weight:600; color:var(--accent3);">Campioncini in errore: ${failures.length}</div>
        <button class="btn btn-outline" style="width:auto; padding:0.3rem 0.8rem; font-size:0.75rem;" onclick="window.retryFailedStandardPhotos()">Riprova tutti</button>
      </div>
      <div style="max-height:200px; overflow-y:auto;">
        ${failures.map(f => `
        <div style="display:flex; align-items:center; gap:0.5rem; padding:0.3rem 0; border-top:1px solid var(--bg3); font-size:0.75rem;">
          <div style="flex:1; min-width:0;">
            <strong>${esc(f.name)}</strong> <span style="color:var(--text3);font-family:var(--font-text3,inherit);">(ID ${esc(f.id)})</span>
            <div style="color:var(--text2);font-family:var(--font-sub,inherit); overflow-wrap:anywhere;">${esc(f.reason)}</div>
          </div>
          <button class="btn btn-outline" style="width:auto; padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="window.retryStandardPhoto('${esc(f.id)}', this)">Foto</button>
        </div>`).join('')}
      </div>`;
  },

  setFilter(val) {
    this._filter = val;
  }
};
