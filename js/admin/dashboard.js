import { ref, get, update, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
// Importazione del servizio live condiviso
import { CalcoloMatchService, applicaRegole } from "../services/calcoloMatch.js";
import { GwService } from "../services/gwService.js";
import { esc } from '../utils.js';

export const DashboardSection = {
  db: null,
  _competitions: [],
  _onFire: { weeks: 4, players: 5 },

  init(database) {
    this.db = database;
    onValue(ref(this.db, 'status/onFire'), snap => {
      const v = snap.val() || {};
      this._onFire = {
        weeks: Math.max(1, parseInt(v.weeks, 10) || 4),
        players: Math.max(1, parseInt(v.players, 10) || 5)
      };
      this._syncOnFireInputs();
    });
    onValue(ref(this.db, 'statsMeta/giornate'), snap => {
      this._statsGiornate = snap.val() || {};
      this._renderStatsStatus();
      this._autoSyncVotes(); // giornate appena importate: voti ufficiali in votes
    });
    onValue(ref(this.db, 'settings/statsStatus'), snap => { this._statsStatus = snap.val(); this._renderStatsStatus(); });
    onValue(ref(this.db, 'probabili/meta'), snap => { this._probMeta = snap.val(); this._renderProbabiliStatus(); });
    onValue(ref(this.db, 'settings/probabiliStatus'), snap => { this._probStatus = snap.val(); this._renderProbabiliStatus(); });
    this.registerGlobalActions();
  },

  /**
   * Chiede alla Cloud Function di importare statistiche e voti ufficiali fino alla giornata gw.
   * forza = true: importa anche se la giornata non risulta completa (es. partita rinviata).
   */
  async _richiediStatistiche(gw, forza = false) {
    this._statsPending = Date.now();
    await set(ref(this.db, 'settings/statsRequest'), { gw: Number(gw), at: this._statsPending, forza: !!forza });
    this._renderStatsStatus();
  },

  _renderStatsStatus() {
    const el = document.getElementById('dashboard-stats-status');
    if (!el) return;
    const fmt = (ts) => ts ? new Date(ts).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
    const gws = Object.keys(this._statsGiornate || {}).map(Number).filter(Boolean).sort((a, b) => a - b);
    const st = this._statsStatus;
    let html = gws.length
      ? `<span class="badge badge-green">${gws.length} giornate importate (ultima: ${gws[gws.length - 1]}ª)</span>`
      : `<span class="badge badge-gray">Nessuna giornata importata</span>`;
    if (st) {
      if (st.skipped) html += `<br><span style="color: var(--gold); font-size:.75rem;"><i class="ri-pause-circle-line"></i> Richiesta non eseguita ora (${fmt(st.at)}): ${esc(st.reason)}. Riprova più tardi o attendi il recupero automatico.</span>`;
      else if (st.ok === false) html += `<br><span style="color: var(--accent3); font-size:.75rem;"><i class="ri-error-warning-line"></i> Ultimo tentativo fallito (${fmt(st.at)}): ${esc(st.error)}. Verrà ritentato in automatico.</span>`;
      else if (st.inCorso) html += `<br><span style="color: var(--gold); font-size:.75rem;"><i class="ri-hourglass-line"></i> Import in corso... importate: ${(st.importate || []).join(', ')}</span>`;
      else if (st.importate) html += `<br><span style="font-size:.75rem;"><i class="ri-checkbox-circle-line"></i> ${fmt(st.at)}: importate giornate ${(st.importate || []).join(', ')}${st.restanti ? ` · ne restano ${st.restanti}, proseguo in automatico` : ''}</span>`;
    }
    if (this._statsPending && (!st || !st.at || st.at < this._statsPending)) {
      html += `<br><span style="color: var(--gold); font-size:.75rem;"><i class="ri-hourglass-line"></i> Richiesta inviata, attendi qualche secondo...</span>`;
    }
    el.innerHTML = html;
  },

  _renderProbabiliStatus() {
    const el = document.getElementById('dashboard-probabili-status');
    if (!el) return;
    const fmt = (ts) => ts ? new Date(ts).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
    const m = this._probMeta, st = this._probStatus;
    let html = m
      ? `<span class="badge badge-green">${m.giornata}ª giornata · ${m.matches} partite · ${m.players} giocatori</span><br><span style="font-size:.75rem;">Ultimo aggiornamento dati: ${fmt(m.updatedAt)}</span>`
      : `<span class="badge badge-gray">Nessun dato ancora scaricato</span>`;
    if (st && st.skipped) {
      html += `<br><span style="color: var(--gold); font-size:.75rem;"><i class="ri-pause-circle-line"></i> Richiesta non eseguita (${fmt(st.at)}): ${String(st.reason || '').replace(/</g, '&lt;')}</span>`;
    } else if (st && st.ok && st.invariata) {
      html += `<br><span style="font-size:.75rem;"><i class="ri-checkbox-circle-line"></i> Controllo del ${fmt(st.at)}: nessuna novità su fantacalcio.it</span>`;
    } else if (st && st.ok === false) {
      html += `<br><span style="color: var(--accent3); font-size:.75rem;"><i class="ri-error-warning-line"></i> Ultimo tentativo fallito (${fmt(st.at)}): ${String(st.error || '').replace(/</g, '&lt;')}</span>`;
    }
    if (this._probPending && (!st || !st.at || st.at < this._probPending)) {
      html += `<br><span style="color: var(--gold); font-size:.75rem;"><i class="ri-hourglass-line"></i> Aggiornamento richiesto, attendi qualche secondo...</span>`;
    }
    el.innerHTML = html;
  },

  renderHTML() {
    return `
      <div id="sec-dashboard" class="admin-sec" style="display:block;">
        <h2 class="sec-title"><i class="ri-dashboard-line"></i> Dashboard Patron</h2>

        <!-- Richieste nuovi account (js/admin/accounts.js) -->
        <div id="account-requests-box"></div>
        
        <div class="card" style="max-width: 500px;">
          <div class="label" style="color: var(--accent); margin-bottom: .6rem; font-size: .85rem;">
            Stato Campionato & Giornata Reale (Serie A)
          </div>
          <p style="font-size: .85rem; color: var(--text2); font-family: var(--font-sub, inherit); margin-bottom: 1rem;">
            Seleziona la giornata corrente del campionato reale.
          </p>
          
          <div style="display: flex; flex-direction: column; gap: .4rem;">
            <label class="label" for="realGwSelect">Giornata Attiva:</label>
            <select id="realGwSelect" class="input-login" style="margin: 0; padding: .75rem;" onchange="window.changeRealGW(this.value)">
            </select>
          </div>
          <div id="dashboard-status-badge" style="margin-top: 1rem; font-size: .85rem; font-weight: 500;"></div>
        </div>

        <div class="card" style="max-width: 500px;">
          <div class="label" style="color: var(--accent); margin-bottom: .6rem; font-size: .85rem;">
            <i class="ri-record-circle-line"></i> Stato Calcolo Live Piattaforma
          </div>
          <p style="font-size: .8rem; color: var(--text2); font-family: var(--font-sub, inherit); margin-bottom: 1rem;">
            Abilita o disabilita il calcolo in tempo reale su tutto il sito (Stato Globale). Successivamente questo stato condizionerà le competizioni.
          </p>
          
          <div style="display: flex; flex-direction: column; gap: .4rem; margin-bottom: 1rem;">
            <label class="label" for="globalLiveSelect">Stato Live Generale:</label>
            <select id="globalLiveSelect" class="input-login" style="margin: 0; padding: .75rem;" onchange="window.changeGlobalLiveStatus(this.value)">
              <option value="false">Disabilitato (Statico / Risultati Definitivi)</option>
              <option value="true">Abilitato (Calcolo in Tempo Reale Attivo)</option>
            </select>
          </div>
          <div id="dashboard-live-badge" style="font-size: .85rem; font-weight: 500;"></div>
        </div>

        <div class="card" style="max-width: 500px;">
          <div class="label" style="color: var(--accent); margin-bottom: .6rem; font-size: .85rem;">
            <i class="ri-fire-line"></i> Giocatori On Fire (Home)
          </div>
          <p style="font-size: .8rem; color: var(--text2); font-family: var(--font-sub, inherit); margin-bottom: 1rem;">
            Nella home di ogni patron compaiono i giocatori della sua rosa con la media fantavoto più alta nelle ultime giornate.
          </p>

          <div style="display: flex; gap: .75rem; margin-bottom: .5rem;">
            <div style="flex: 1;">
              <label class="label" for="onFireWeeks">Ultime settimane:</label>
              <select id="onFireWeeks" class="input-login" style="margin: 0; padding: .65rem;" onchange="window.saveOnFireSettings()">
                ${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}">${i + 1} ${i === 0 ? 'giornata' : 'giornate'}</option>`).join('')}
              </select>
            </div>
            <div style="flex: 1;">
              <label class="label" for="onFirePlayers">N° giocatori:</label>
              <select id="onFirePlayers" class="input-login" style="margin: 0; padding: .65rem;" onchange="window.saveOnFireSettings()">
                ${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <div class="card" style="max-width: 500px;">
          <div class="label" style="color: var(--accent); margin-bottom: .6rem; font-size: .85rem;">
            <i class="ri-clipboard-line"></i> Probabili Formazioni (fantacalcio.it)
          </div>
          <p style="font-size: .8rem; color: var(--text2); font-family: var(--font-sub, inherit); margin-bottom: 1rem;">
            Percentuali di impiego, infortunati, squalificati e avversari mostrati ai patron quando scelgono la formazione.
            Si aggiornano da sole ogni 2 ore (dalle 8 alle 22). Qui puoi forzare un aggiornamento: per non sovraccaricare fantacalcio.it è consentito al massimo una volta ogni 20 minuti.
          </p>
          <div id="dashboard-probabili-status" style="font-size: .8rem; color: var(--text2); font-family: var(--font-sub, inherit); margin-bottom: .8rem;">Caricamento...</div>
          <button class="btn btn-blue" onclick="window.aggiornaProbabiliOra()"><i class="ri-refresh-line"></i> Aggiorna probabili ora</button>
        </div>

        <div class="card" style="max-width: 500px;">
          <div class="label" style="color: var(--accent); margin-bottom: .6rem; font-size: .85rem;">
            <i class="ri-bar-chart-line"></i> Voti Ufficiali e Statistiche (fantacalcio.it)
          </div>
          <p style="font-size: .8rem; color: var(--text2); font-family: var(--font-sub, inherit); margin-bottom: 1rem;">
            Voto, gol, assist, cartellini, rigori, gol subiti, titolare/subentrato di ogni giornata. I voti ufficiali
            <strong>sostituiscono i voti live</strong> della giornata (votes) e sono quelli usati dal calcolo qui sotto.
            L'import parte da solo quando il live vede finite tutte le partite e riprova finché fantacalcio.it non pubblica la giornata completa.
            Il pulsante importa le giornate <strong>concluse</strong> (di default fino a quella prima della giornata attiva) e
            riscrive subito i voti di tutte le giornate già importate partendo dalle statistiche salvate (senza nuove richieste a fantacalcio.it).
          </p>
          <div id="dashboard-stats-status" style="font-size: .8rem; color: var(--text2); font-family: var(--font-sub, inherit); margin-bottom: .8rem;">Caricamento...</div>
          <div style="display:flex; gap:.5rem; align-items:center;">
            <input type="number" id="statsGwInput" class="input-login" min="1" max="38" placeholder="Giornata" style="margin:0; padding:.6rem; max-width:110px;">
            <button class="btn btn-blue" style="flex:1;" onclick="window.importaStatisticheOra()"><i class="ri-download-line"></i> Importa voti ufficiali fino a questa giornata</button>
          </div>
          <label style="display:flex; gap:.45rem; align-items:center; margin-top:.6rem; font-size:.75rem; color: var(--text2); cursor:pointer;">
            <input type="checkbox" id="statsForza" style="width:16px; height:16px; accent-color: var(--accent);">
            Importa anche se l'ultima giornata è incompleta (partita rinviata)
          </label>
        </div>

        <div class="card" style="max-width: 500px;">
          <div class="label" style="color: var(--accent); margin-bottom: .6rem; font-size: .85rem;">
            <i class="ri-calculator-line"></i> Calcolatore Risultati Giornata (Salvataggio Master)
          </div>
          <p style="font-size: .8rem; color: var(--text2); font-family: var(--font-sub, inherit); margin-bottom: 1rem;">
            Scegli la giornata di Serie A: con i suoi voti vengono calcolate insieme tutte le competizioni che hanno
            una giornata associata (punteggi, risultati, classifica e tabellone). Importa prima i voti ufficiali.
          </p>
          
          <div style="display: flex; flex-direction: column; gap: .75rem; margin-bottom: 1rem;">
            <div>
              <label class="label" for="calcRealGwSelect">Giornata di Serie A:</label>
              <select id="calcRealGwSelect" class="input-login" style="margin:0; padding: .65rem;"></select>
            </div>
            <div id="calcPreview" style="font-size: .78rem; color: var(--text2); font-family: var(--font-sub, inherit); line-height: 1.45;"></div>
          </div>
          
          <button class="btn btn-green" onclick="window.eseguiCalcoloPunteggi()"><i class="ri-flashlight-line"></i> Salva Risultati Ufficiali e Classifica</button>
        </div>
      </div>
    `;
  },

  render(state) {
    this._competitions = state.competitions || [];
    this._currentRealGw = Number(state.CURRENT_REAL_GW) || 0;

    const selectEl = document.getElementById('realGwSelect');
    if (selectEl && selectEl.options.length === 0) {
      let optionsHtml = `<option value="0">Giornata 0 (Prima del Campionato)</option>`;
      for (let i = 1; i <= 38; i++) {
        optionsHtml += `<option value="${i}">Giornata ${i}</option>`;
      }
      selectEl.innerHTML = optionsHtml;
    }
    if (selectEl) selectEl.value = state.CURRENT_REAL_GW !== undefined ? state.CURRENT_REAL_GW : 0;

    const badgeEl = document.getElementById('dashboard-status-badge');
    if (badgeEl) {
      const currentRealGw = state.CURRENT_REAL_GW !== undefined ? state.CURRENT_REAL_GW : 0;
      badgeEl.innerHTML = currentRealGw === 0 
        ? `<span class="badge badge-blue">Pre-Campionato attivo</span>` 
        : `<span class="badge badge-green">Campionato in corso: ${currentRealGw}ª Giornata</span>`;
    }

    const globalLiveSelect = document.getElementById('globalLiveSelect');
    const liveBadgeEl = document.getElementById('dashboard-live-badge');
    
    const isGlobalLive = state.LIVE === true || state.LIVE === "true";
    if (globalLiveSelect) globalLiveSelect.value = isGlobalLive ? "true" : "false";
    
    if (liveBadgeEl) {
      liveBadgeEl.innerHTML = isGlobalLive
        ? `<span class="badge badge-green">LIVE GLOBALE ATTIVO (status/live = true)</span>`
        : `<span class="badge badge-gray">LIVE GLOBALE DISABILITATO (status/live = false)</span>`;
    }

    this._syncOnFireInputs();

    // Calcolatore: giornata di Serie A (di default quella attiva) e anteprima delle competizioni
    const calcSel = document.getElementById('calcRealGwSelect');
    if (calcSel) {
      if (calcSel.options.length === 0) {
        calcSel.innerHTML = Array.from({ length: 38 }, (_, i) => `<option value="${i + 1}">${i + 1}ª giornata</option>`).join('');
        calcSel.addEventListener('change', () => { calcSel.dataset.userEdited = 'true'; this._renderCalcPreview(); });
      }
      const cur = Number(state.CURRENT_REAL_GW) || 0;
      if (!calcSel.dataset.userEdited && cur >= 1) calcSel.value = String(cur);
      this._renderCalcPreview();
    }

    // Import voti ufficiali: di default l'ultima giornata conclusa (quella prima della giornata attiva)
    const statsInput = document.getElementById('statsGwInput');
    if (statsInput && !statsInput.dataset.userEdited) {
      const cur = Number(state.CURRENT_REAL_GW) || 0;
      if (cur > 1) statsInput.value = String(cur - 1);
    }
  },

  /**
   * Voti ufficiali di una giornata (formato di votes/gw{n}) a partire dalle statistiche
   * playerStats/{id}/g{n} già importate: nessuna richiesta a fantacalcio.it.
   * Stessi campi scritti dalla Cloud Function (stats.js -> buildVotes).
   */
  _votesDaStatistiche(playerStats, gw) {
    const CAMPI = {
      gf: 'gol', rf: 'rigore_segnato', ass: 'assist', amm: 'ammonizione', esp: 'espulsione',
      au: 'autogol', rp: 'rigore_parato', rs: 'rigore_sbagliato', gs: 'gol_subito'
    };
    const out = {};
    Object.entries(playerStats || {}).forEach(([id, giornate]) => {
      const e = giornate?.[`g${gw}`];
      if (!e || e.s === 'i' || e.s === 'q') return;                    // infortunato / squalificato
      if (typeof e.v !== 'number' && !e.sv && e.s !== 't' && e.s !== 's') return; // non ha giocato
      const sv = !!e.sv || typeof e.v !== 'number';
      const row = { voto: sv ? 0 : e.v, uff: 1 };
      if (sv) row.sv = 1;
      Object.entries(CAMPI).forEach(([k, campo]) => { if (e[k]) row[campo] = e[k]; });
      if (e.s === 's') row.in = 1;
      if (e.out) row.out = 1;
      out[id] = row;
    });
    return out;
  },

  /**
   * Riscrive votes/gw{n} con i voti ufficiali per tutte le giornate già importate (statsMeta)
   * fino a upTo (o solo per `solo`). Ritorna l'elenco delle giornate riscritte.
   */
  async _sincronizzaVotes(upTo, solo = null) {
    const [metaSnap, statsSnap] = await Promise.all([
      get(ref(this.db, 'statsMeta/giornate')),
      get(ref(this.db, 'playerStats'))
    ]);
    const importate = Object.keys(metaSnap.val() || {}).map(Number)
      .filter(g => g >= 1 && (solo ? g === solo : g <= upTo))
      .sort((a, b) => a - b);
    const playerStats = statsSnap.val() || {};
    const updates = {};
    importate.forEach(g => {
      const votes = this._votesDaStatistiche(playerStats, g);
      if (Object.keys(votes).length >= 100) updates[`votes/gw${g}`] = votes; // giornata vera, non un residuo
    });
    const scartate = importate.filter(g => !updates[`votes/gw${g}`]);
    if (scartate.length) console.warn(`Statistiche insufficienti per riscrivere i voti delle giornate ${scartate.join(', ')}`);
    if (Object.keys(updates).length) await update(ref(this.db), updates);
    return Object.keys(updates).map(k => Number(k.replace(/\D/g, '')));
  },

  /**
   * Allineamento automatico: per ogni giornata con le statistiche ufficiali importate
   * (statsMeta) che è nuova o è stata reimportata, oppure i cui voti non sono ancora
   * quelli ufficiali (nessun "uff"), riscrive votes/gw{n} dalle statistiche.
   * Così non dipende dai tempi della Cloud Function né dalla sua versione.
   */
  async _autoSyncVotes() {
    if (!this.db || this._autoSyncRunning) { this._autoSyncAgain = true; return; }
    this._autoSyncRunning = true;
    try {
      const meta = this._statsGiornate || {};
      this._syncedAt = this._syncedAt || {};
      const daFare = [];
      for (const g of Object.keys(meta).map(Number).filter(n => n >= 1)) {
        const at = Number(meta[g]?.at) || 0;
        if (this._syncedAt[g] === at) continue; // già allineata con questo import
        const votes = (await get(ref(this.db, `votes/gw${g}`))).val() || {};
        const ufficiali = Object.values(votes).some(v => v && v.uff);
        if (!ufficiali || (this._syncedAt[g] !== undefined && this._syncedAt[g] !== at)) daFare.push(g);
        else this._syncedAt[g] = at;
      }
      for (const g of daFare) {
        const fatte = await this._sincronizzaVotes(g, g);
        this._syncedAt[g] = Number(meta[g]?.at) || 0;
        if (fatte.length) console.info(`Voti ufficiali della ${g}ª giornata riscritti dalle statistiche`);
      }
      if (daFare.length) window.toast?.(`Voti ufficiali aggiornati: giornate ${daFare.join(', ')}`, "ok");
    } catch (err) {
      console.error('Allineamento voti ufficiali:', err);
    } finally {
      this._autoSyncRunning = false;
      if (this._autoSyncAgain) { this._autoSyncAgain = false; this._autoSyncVotes(); }
    }
  },

  /** Elenco delle competizioni che verranno calcolate per la giornata di Serie A scelta */
  _renderCalcPreview() {
    const el = document.getElementById('calcPreview');
    const gw = parseInt(document.getElementById('calcRealGwSelect')?.value, 10);
    if (!el || !gw) return;
    const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const si = [], no = [];
    (this._competitions || []).forEach(c => {
      const gwId = GwService.getGwKey(c, gw);
      const n = gwId ? Object.keys(c.matches?.[gwId]?.couples || {}).length : 0;
      if (gwId && n) {
        const fatte = Object.values(c.matches[gwId].couples).filter(x => x && x.finished).length;
        si.push(`<strong>${esc(c.name || c.id)}</strong> · ${esc(GwService.label(gwId))} · ${n} partite${fatte ? ` <span style="color:var(--gold);">(già calcolata: verrà ricalcolata)</span>` : ''}`);
      } else {
        no.push(esc(c.name || c.id));
      }
    });
    el.innerHTML = si.length
      ? `Verranno calcolate:<br>${si.join('<br>')}${no.length ? `<br><span style="color:var(--text3);">Non coinvolte: ${no.join(', ')}</span>` : ''}`
      : `<span style="color:var(--accent3);">Nessuna competizione ha partite associate a questa giornata.</span>`;
  },

  _syncOnFireInputs() {
    const w = document.getElementById('onFireWeeks');
    const n = document.getElementById('onFirePlayers');
    if (w) w.value = String(this._onFire.weeks);
    if (n) n.value = String(this._onFire.players);
  },

  /**
   * Risultati di una giornata di una competizione: punteggi e gol delle partite,
   * classifica (se non è a eliminazione diretta pura) e avanzamento nel tabellone.
   * Non scrive nulla: aggiunge i percorsi da aggiornare in `updates`.
   */
  _calcolaCompetizione({ compId, compData, gwId, mappaFantavotiLocali, ruoliGiocatori, votiBase, updates }) {
    const couples = compData.matches?.[gwId]?.couples || {};
    const allLineups = compData.matches?.[gwId]?.lineups || {};

    // 6. Elaborazione Risultati Match di Giornata
    Object.keys(couples).forEach(matchKey => {
      const match = couples[matchKey];
      const homeTeamId = match.homeId || match.home || match.idHome;
      const awayTeamId = match.awayId || match.away || match.idAway;

      const detHome = CalcoloMatchService.calcolaDettaglioSquadra(allLineups, homeTeamId, mappaFantavotiLocali, ruoliGiocatori, votiBase);
      const detAway = CalcoloMatchService.calcolaDettaglioSquadra(allLineups, awayTeamId, mappaFantavotiLocali, ruoliGiocatori, votiBase);
      const ptHome = detHome.totale;
      const ptAway = detAway.totale;

      const gHome = CalcoloMatchService.calcolaGol(ptHome);
      const gAway = CalcoloMatchService.calcolaGol(ptAway);

      const basePath = `competitions/${compId}/matches/${gwId}/couples/${matchKey}`;
      updates[`${basePath}/punteggioFinaleHome`] = ptHome;
      updates[`${basePath}/punteggioFinaleAway`] = ptAway;
      updates[`${basePath}/goalHome`] = gHome;
      updates[`${basePath}/goalAway`] = gAway;
      // Punti del modificatore difesa già compresi nel punteggio finale (0 se non attivo/non applicabile)
      updates[`${basePath}/modDifesaHome`] = detHome.modDifesa.valore;
      updates[`${basePath}/modDifesaAway`] = detAway.modDifesa.valore;
      updates[`${basePath}/finished`] = true;

      // Aggiornamento Classifica Standard (se NON è a eliminazione diretta pura)
      if (compData.type !== 'diretta') {
        let puntiHome = 0, puntiAway = 0;
        let vHome = 0, dHome = 0, lHome = 0;
        let vAway = 0, dAway = 0, lAway = 0;

        if (gHome > gAway) {
          puntiHome = 3; vHome = 1; puntiAway = 0; lAway = 1;
        } else if (gHome < gAway) {
          puntiHome = 0; lHome = 1; puntiAway = 3; vAway = 1;
        } else {
          puntiHome = 1; dHome = 1; puntiAway = 1; dAway = 1;
        }

        if (homeTeamId) {
          const classHomePath = `competitions/${compId}/classifica/${gwId}/${homeTeamId}`;
          updates[`${classHomePath}/punteggiofanta`] = ptHome;
          updates[`${classHomePath}/punti`] = puntiHome;
          updates[`${classHomePath}/golFatti`] = gHome;
          updates[`${classHomePath}/golSubiti`] = gAway;
          updates[`${classHomePath}/vittoria`] = vHome;
          updates[`${classHomePath}/pareggio`] = dHome;
          updates[`${classHomePath}/sconfitta`] = lHome;
        }

        if (awayTeamId) {
          const classAwayPath = `competitions/${compId}/classifica/${gwId}/${awayTeamId}`;
          updates[`${classAwayPath}/punteggiofanta`] = ptAway;
          updates[`${classAwayPath}/punti`] = puntiAway;
          updates[`${classAwayPath}/golFatti`] = gAway;
          updates[`${classAwayPath}/golSubiti`] = gHome;
          updates[`${classAwayPath}/vittoria`] = vAway;
          updates[`${classAwayPath}/pareggio`] = dAway;
          updates[`${classAwayPath}/sconfitta`] = lAway;
        }
      }
    });

    // 7. GESTIONE TABELLONE ED ELIMINAZIONE DIRETTA (Avanzamento Vincenti)
    if ((compData.type === 'diretta' || compData.type === 'misto' || compData.type === 'misto-speciale') && compData.tabelloneStructure && compData.tabelloneStructure.fasi) {
      const tabellone = compData.tabelloneStructure;
      const regola = tabellone.regolaIncontri || tabellone.tipoScontro || tabellone.modalita;
      const isAndataRitorno = regola === 'andata-ritorno' || regola === 'andata_ritorno';
      
      // Copia del calendario della competizione (già letto): si aggiunge la giornata appena calcolata
      const allMatches = JSON.parse(JSON.stringify(compData.matches || {}));

      // Includiamo i dati appena calcolati per la giornata corrente
      allMatches[gwId] = allMatches[gwId] || { couples: {} };
      Object.keys(couples).forEach(matchKey => {
        const match = couples[matchKey];
        const homeTeamId = match.homeId || match.home || match.idHome;
        const awayTeamId = match.awayId || match.away || match.idAway;
        
        const ptHome = CalcoloMatchService.calcolaTotaleSquadra(allLineups, homeTeamId, mappaFantavotiLocali, ruoliGiocatori, votiBase);
        const ptAway = CalcoloMatchService.calcolaTotaleSquadra(allLineups, awayTeamId, mappaFantavotiLocali, ruoliGiocatori, votiBase);

        allMatches[gwId].couples[matchKey] = {
          ...match,
          punteggioFinaleHome: ptHome,
          punteggioFinaleAway: ptAway,
          goalHome: CalcoloMatchService.calcolaGol(ptHome),
          goalAway: CalcoloMatchService.calcolaGol(ptAway),
          finished: true
        };
      });

      const fasi = tabellone.fasi;
      const fasiKeys = Object.keys(fasi).sort();

      fasiKeys.forEach((faseKey, index) => {
        const faseObj = fasi[faseKey];
        const matchList = faseObj.matchList || [];

        matchList.forEach((m) => {
          const matchId = m.id; // es: "tf1_m2"
          let vincenteId = null;

          if (!isAndataRitorno) {
            // --- SOLO ANDATA ---
            let foundMatch = null;
            Object.keys(allMatches).forEach(gw => {
              const couplesGw = allMatches[gw].couples || {};
              if (couplesGw[matchId] && couplesGw[matchId].finished) {
                foundMatch = couplesGw[matchId];
              }
            });

            if (foundMatch) {
              const gH = Number(foundMatch.goalHome ?? foundMatch.homeScore ?? 0);
              const gA = Number(foundMatch.goalAway ?? foundMatch.awayScore ?? 0);
              const ptH = Number(foundMatch.punteggioFinaleHome || 0);
              const ptA = Number(foundMatch.punteggioFinaleAway || 0);

              if (gH > gA) vincenteId = foundMatch.homeId || foundMatch.home;
              else if (gA > gH) vincenteId = foundMatch.awayId || foundMatch.away;
              else {
                // In caso di parità di gol, vince chi ha il fantapunteggio più alto
                if (ptH > ptA) vincenteId = foundMatch.homeId || foundMatch.home;
                else if (ptA > ptH) vincenteId = foundMatch.awayId || foundMatch.away;
                else vincenteId = foundMatch.homeId || foundMatch.home;
              }
            }
          } else {
            // --- ANDATA E RITORNO ---
            let matchAndata = null;
            let matchRitorno = null;

            Object.keys(allMatches).forEach(gw => {
              const couplesGw = allMatches[gw].couples || {};
              if (couplesGw[matchId] && couplesGw[matchId].finished) {
                matchAndata = couplesGw[matchId];
              }
              if (couplesGw[`${matchId}_ritorno`] && couplesGw[`${matchId}_ritorno`].finished) {
                matchRitorno = couplesGw[`${matchId}_ritorno`];
              }
            });

            if (matchAndata && matchRitorno) {
              // Identifichiamo formalmente chi gioca in casa all'andata e chi fuori
              const teamAndataCasa = matchAndata.homeId || matchAndata.home;
              const teamAndataFuori = matchAndata.awayId || matchAndata.away;

              // Gol e Fantapunti totalizzati nell'Andata
              let totGolCasa = Number(matchAndata.goalHome ?? matchAndata.homeScore ?? 0);
              let totGolFuori = Number(matchAndata.goalAway ?? matchAndata.awayScore ?? 0);
              let totPtCasa = Number(matchAndata.punteggioFinaleHome || 0);
              let totPtFuori = Number(matchAndata.punteggioFinaleAway || 0);

              // Al RITORNO i ruoli si invertono:
              // Chi ha giocato fuori all'andata (teamAndataFuori) ora gioca in casa (goalHome al ritorno).
              // Chi ha giocato in casa all'andata (teamAndataCasa) ora gioca fuori (goalAway al ritorno).
              const rHomeId = matchRitorno.homeId || matchRitorno.home;

              if (rHomeId === teamAndataFuori) {
                totGolFuori += Number(matchRitorno.goalHome ?? matchRitorno.homeScore ?? 0);
                totGolCasa += Number(matchRitorno.goalAway ?? matchRitorno.awayScore ?? 0);
                totPtFuori += Number(matchRitorno.punteggioFinaleHome || 0);
                totPtCasa += Number(matchRitorno.punteggioFinaleAway || 0);
              } else {
                // Fallback di sicurezza nel caso i campi fossero ribaltati a DB
                totGolCasa += Number(matchRitorno.goalHome ?? matchRitorno.homeScore ?? 0);
                totGolFuori += Number(matchRitorno.goalAway ?? matchRitorno.awayScore ?? 0);
                totPtCasa += Number(matchRitorno.punteggioFinaleHome || 0);
                totPtFuori += Number(matchRitorno.punteggioFinaleAway || 0);
              }

              // Valutazione esito globale aggregato
              if (totGolCasa > totGolFuori) vincenteId = teamAndataCasa;
              else if (totGolFuori > totGolCasa) vincenteId = teamAndataFuori;
              else {
                // Parità di gol aggregati: spareggio sui fantapunti complessivi
                if (totPtCasa > totPtFuori) vincenteId = teamAndataCasa;
                else if (totPtFuori > totPtCasa) vincenteId = teamAndataFuori;
                else vincenteId = teamAndataCasa;
              }
            }
          }

          // Se abbiamo determinato un vincente, aggiorniamo sia il Tabellone sia il Calendario (Matches)
          if (vincenteId) {
            const targetPlaceholder = `VINCENTE_${matchId}`;

            // A) Aggiorna la struttura visuale del tabellone (per le fasi successive)
            if (fasiKeys[index + 1]) {
              const nextFaseKey = fasiKeys[index + 1];
              const nextMatchList = fasi[nextFaseKey].matchList || [];

              nextMatchList.forEach((nextM, nextMIndex) => {
                const basePathNext = `competitions/${compId}/tabelloneStructure/fasi/${nextFaseKey}/matchList/${nextMIndex}`;

                if (nextM.homeId === targetPlaceholder) {
                  updates[`${basePathNext}/homeId`] = vincenteId;
                }
                if (nextM.awayId === targetPlaceholder) {
                  updates[`${basePathNext}/awayId`] = vincenteId;
                }
              });
            }

            // B) Aggiorna le vere partite a calendario (matches -> gwX -> couples) rispettando il luogo casa/fuori
            Object.keys(allMatches).forEach(gKey => {
              const couplesGw = allMatches[gKey].couples || {};
              Object.keys(couplesGw).forEach(cKey => {
                const coupleObj = couplesGw[cKey];
                const couplePath = `competitions/${compId}/matches/${gKey}/couples/${cKey}`;

                if (coupleObj.homeId === targetPlaceholder) {
                  updates[`${couplePath}/homeId`] = vincenteId;
                }
                if (coupleObj.awayId === targetPlaceholder) {
                  updates[`${couplePath}/awayId`] = vincenteId;
                }
              });
            });
          }
        });
      });
    }
  },

  registerGlobalActions() {
    window.importaStatisticheOra = async () => {
      if (!this.db) return console.error("Database non inizializzato");
      const gw = parseInt(document.getElementById('statsGwInput')?.value, 10);
      if (!(gw >= 1 && gw <= 38)) return window.toast("Indica una giornata di Serie A tra 1 e 38", "err");
      const forza = !!document.getElementById('statsForza')?.checked;
      const attiva = this._currentRealGw || 0;
      if (attiva && gw >= attiva && !forza && !confirm(
        `La ${gw}ª giornata non risulta conclusa (la giornata attiva è la ${attiva}ª).\n` +
        `Se i voti non sono ancora tutti pubblicati l'import di quella giornata verrà riprovato più tardi. Continuare?`)) return;
      try {
        // 1. Voti delle giornate già importate: riscritti subito dalle statistiche salvate
        const riscritte = await this._sincronizzaVotes(gw);
        // 2. Giornate mancanti (e l'ultima, se richiesta di nuovo): le scarica la Cloud Function
        await this._richiediStatistiche(gw, forza);
        window.toast(riscritte.length
          ? `Voti ufficiali riscritti (giornate ${riscritte.join(', ')}); import fino alla ${gw}ª richiesto`
          : `Richiesto import dei voti ufficiali fino alla ${gw}ª giornata`, "ok");
      } catch (err) {
        console.error(err);
        window.toast("Errore durante l'aggiornamento dei voti ufficiali", "err");
      }
    };

    document.addEventListener('input', (e) => {
      if (e.target.id === 'statsGwInput') e.target.dataset.userEdited = "true";
    });

    window.aggiornaProbabiliOra = async () => {
      if (!this.db) return console.error("Database non inizializzato");
      try {
        this._probPending = Date.now();
        await set(ref(this.db, 'settings/probabiliRequest'), this._probPending);
        this._renderProbabiliStatus();
        window.toast("Richiesta inviata: le probabili si aggiornano tra pochi secondi", "ok");
      } catch (err) {
        console.error(err);
        window.toast("Errore nell'invio della richiesta", "err");
      }
    };

    window.saveOnFireSettings = async () => {
      if (!this.db) return console.error("Database non inizializzato");
      const weeks = parseInt(document.getElementById('onFireWeeks')?.value, 10) || 4;
      const players = parseInt(document.getElementById('onFirePlayers')?.value, 10) || 5;
      try {
        await set(ref(this.db, 'status/onFire'), { weeks, players });
        window.toast(`On Fire: ${players} giocatori, ultime ${weeks} giornate`, "ok");
      } catch (err) {
        console.error(err);
        window.toast("Errore nel salvataggio delle impostazioni On Fire", "err");
      }
    };

    document.addEventListener('input', (e) => {
    });

    window.changeGlobalLiveStatus = async (value) => {
      if (!this.db) return console.error("Database non inizializzato");
      const isLive = value === "true";
      try {
        await set(ref(this.db, 'status/live'), isLive);
        window.toast(`Stato Live globale impostato su: ${isLive}`, "ok");
      } catch (err) {
        console.error(err);
        window.toast("Errore nel salvataggio del live globale", "err");
      }
    };

    window.eseguiCalcoloPunteggi = async () => {
      if (!this.db) return console.error("Database non inizializzato");

      const gwSerieA = parseInt(document.getElementById('calcRealGwSelect')?.value, 10);
      if (!(gwSerieA >= 1 && gwSerieA <= 38)) return window.toast("Scegli la giornata di Serie A da calcolare", "err");

      try {
        // 1. Voti della giornata di Serie A (unici per tutte le competizioni).
        //    Se la giornata ha le statistiche ufficiali ma i voti sono ancora quelli live
        //    (o inseriti a mano), prima li riscrivo con i voti ufficiali.
        const votesPath = `votes/gw${gwSerieA}`;
        let votesSnap = await get(ref(this.db, votesPath));
        const haUfficiali = (await get(ref(this.db, `statsMeta/giornate/${gwSerieA}`))).exists();
        const giaUfficiali = Object.values(votesSnap.val() || {}).some(v => v && v.uff);
        if (haUfficiali && !giaUfficiali) {
          await this._sincronizzaVotes(gwSerieA, gwSerieA);
          votesSnap = await get(ref(this.db, votesPath));
        }
        if (!votesSnap.exists()) {
          return window.toast(`Nessun voto per la ${gwSerieA}ª giornata di Serie A!`, "err");
        }

        // Voti ufficiali non ancora importati: si calcolerebbe con i voti live
        if (!haUfficiali && !confirm(
          `I voti ufficiali della ${gwSerieA}ª giornata di Serie A non sono ancora stati importati.\n` +
          `Vuoi calcolare lo stesso con i voti attuali (live o inseriti a mano)?`)) {
          return window.toast("Calcolo annullato: importa prima i voti ufficiali.", "info");
        }

        // 2. Competizioni con una giornata associata a questa giornata di Serie A
        const compsSnap = await get(ref(this.db, 'competitions'));
        const comps = compsSnap.exists() ? compsSnap.val() : {};
        const daCalcolare = Object.entries(comps)
          .map(([compId, compData]) => ({ compId, compData, gwId: GwService.getGwKey(compData, gwSerieA) }))
          .filter(c => c.gwId && Object.keys(c.compData.matches?.[c.gwId]?.couples || {}).length);
        if (!daCalcolare.length) {
          return window.toast(`Nessuna competizione ha partite associate alla ${gwSerieA}ª giornata di Serie A.`, "err");
        }

        window.toast(`Calcolo della ${gwSerieA}ª giornata di Serie A in corso...`, "info");

        // Regole della lega (bonus/malus e modificatore difesa) appena lette dal DB
        applicaRegole((await get(ref(this.db, 'status/regole'))).val());

        const updates = {};
        const mappaFantavotiLocali = {};
        const votiBase = {};

        // 3. Ruoli dei giocatori (servono per far entrare il panchinaro giusto al posto di un s.v.)
        const playersSnap = await get(ref(this.db, 'players'));
        const ruoliGiocatori = {};
        Object.values(playersSnap.exists() ? playersSnap.val() : {}).forEach(pl => {
          if (pl && pl.id !== undefined) ruoliGiocatori[pl.id] = pl.role;
        });

        // 4. Fantavoti dei giocatori (solo chi ha un voto > 0: gli altri sono s.v.)
        const votiGiocatori = votesSnap.val();
        Object.keys(votiGiocatori).forEach(playerId => {
          const datiVoto = votiGiocatori[playerId];
          if (CalcoloMatchService.hasVoto(datiVoto)) {
            const fantavotoFinale = CalcoloMatchService.calcolaFantavoto(datiVoto);
            updates[`${votesPath}/${playerId}/fantavoto`] = fantavotoFinale;
            mappaFantavotiLocali[playerId] = fantavotoFinale;
            votiBase[playerId] = CalcoloMatchService.normalizzaVoto(datiVoto.voto);
          }
        });

        // 5. Risultati, classifica e tabellone di ogni competizione
        daCalcolare.forEach(({ compId, compData, gwId }) => {
          this._calcolaCompetizione({ compId, compData, gwId, mappaFantavotiLocali, ruoliGiocatori, votiBase, updates });
        });

        // 6. Applicazione atomica: tutte le competizioni insieme
        await update(ref(this.db), updates);
        const elenco = daCalcolare.map(c => `${c.compData.name || c.compId} (${GwService.label(c.gwId)})`).join(', ');
        window.toast(`${gwSerieA}ª giornata di Serie A calcolata: ${elenco}`, "ok");
      } catch (err) {
        console.error(err);
        window.toast("Errore critico durante il salvataggio completo della giornata", "err");
      }
    };
  }
};
