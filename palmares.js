import { ref, set, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

let database = null;

export const PalmaresSection = {
  competitionsData: {},
  trophiesData: [],

  init(db) {
    database = db;
    window.savePalmares = () => this.savePalmares();
    window.deletePalmares = (teamId, season, compId) => this.deletePalmares(teamId, season, compId);
    window.onPalCompChange = () => this.handleCompChange();
  },

  renderHTML() {
    return `
    <div id="sec-palmares" class="admin-sec" style="display:none">
      <div class="sec-title">🏅 Assegnazione Palmarès e Piazzamenti</div>
      
      <div class="card" style="max-width:500px">
        <div class="label" style="color:var(--accent); margin-bottom:.5rem">Aggiungi Risultato Stagionale</div>
        
        <label class="label" style="font-size:.8rem; margin-top:.4rem;">Squadra</label>
        <select id="palTeam" class="input-login" style="margin-bottom:.5rem;">
          <option value="">-- Seleziona Squadra --</option>
        </select>

        <label class="label" style="font-size:.8rem; margin-top:.4rem;">Stagione</label>
        <input type="text" id="palSeason" class="input-login" placeholder="es: 2025-2026">
        
        <label class="label" style="font-size:.8rem; margin-top:.4rem;">Competizione</label>
        <select id="palComp" class="input-login" style="margin-bottom:.5rem;" onchange="window.onPalCompChange()">
          <option value="">-- Seleziona Competizione --</option>
        </select>

        <div id="palPositionWrapper">
          <label class="label" style="font-size:.8rem; margin-top:.4rem;">Posizionamento</label>
          <input type="text" id="palPosition" class="input-login" placeholder="Seleziona prima una competizione" disabled>
        </div>
        
        <div style="display:flex; align-items:center; gap:.5rem; margin:.75rem 0 1rem 0;">
          <input type="checkbox" id="palWon" style="width:18px; height:18px; cursor:pointer;">
          <label for="palWon" style="color:var(--text); font-size:.9rem; cursor:pointer;">Ha vinto il trofeo?</label>
        </div>
        
        <button id="btnSubmitPalmares" class="btn btn-green" onclick="window.savePalmares()">Salva in Palmarès</button>
      </div>

      <div class="card" style="margin-top:1rem;">
        <div class="label">Riepilogo Palmarès Registrati</div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Squadra</th>
                <th>Stagione</th>
                <th>Competizione</th>
                <th>Posizione</th>
                <th>Trofeo Vinto</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody id="palmaresTableBody">
              <tr><td colspan="6" style="text-align:center">Caricamento in corso...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
  },

  render(STATE = {}) {
    // 1. Recupero robusto delle squadre (da STATE o globale window.TEAMS)
    let rawTeams = STATE.TEAMS || STATE.teams || window.TEAMS || [];
    const teamsList = Array.isArray(rawTeams)
      ? rawTeams.filter(Boolean)
      : Object.entries(rawTeams || {}).map(([key, val]) => (
          typeof val === 'object' ? { id: key, ...val } : { id: key, name: val }
        ));

    // 2. Recupero delle competizioni
    let rawComps = STATE.competitions || window.COMPETITIONS || [];
    const compArray = Array.isArray(rawComps)
      ? rawComps.filter(Boolean)
      : Object.entries(rawComps || {}).map(([id, comp]) => ({ id, ...comp }));
    
    this.competitionsData = Object.fromEntries(compArray.map(c => [c.id, c]));

    // 3. Recupero dei trofei
    let rawTrophies = STATE.trophies || window.TROPHIES || [];
    this.trophiesData = Array.isArray(rawTrophies) 
      ? rawTrophies 
      : Object.entries(rawTrophies || {}).map(([k, v]) => ({ ...v, id: v.id || k }));

    const teamSelect = document.getElementById('palTeam');
    const compSelect = document.getElementById('palComp');
    const tbody = document.getElementById('palmaresTableBody');

    if (!teamSelect || !compSelect) return;

    // Popola select squadre
    if (teamsList.length > 0) {
      teamSelect.innerHTML = '<option value="">-- Seleziona Squadra --</option>' +
        teamsList.map(t => `<option value="${t.id}">${t.name || t.id} (${t.id})</option>`).join('');
    } else {
      teamSelect.innerHTML = '<option value="">-- Nessuna squadra trovata --</option>';
    }

    // Popola select competizioni
    if (compArray.length > 0) {
      compSelect.innerHTML = '<option value="">-- Seleziona Competizione --</option>' +
        compArray.map(c => `<option value="${c.id}">${c.name || c.id} (${c.type || 'campionato'})</option>`).join('');
    } else {
      compSelect.innerHTML = '<option value="">-- Nessuna competizione trovata --</option>';
    }

    const compNamesMap = Object.fromEntries(compArray.map(c => [c.id, c.name || c.id]));
    const trophyNamesMap = Object.fromEntries(this.trophiesData.map(t => [t.id, t.name || t.id]));

    // Genera la tabella del palmarès registrato
    const rows = [];
    teamsList.forEach(team => {
      if (!team.palmares) return;
      Object.entries(team.palmares).forEach(([season, seasonComps]) => {
        Object.entries(seasonComps || {}).forEach(([compId, details]) => {
          const trophyCode = details.trofeo_vinto;
          const trophyLabel = trophyCode 
            ? `🏆 ${trophyNamesMap[trophyCode] || trophyCode}` 
            : '—';

          rows.push({
            teamId: team.id,
            teamName: team.name || team.id,
            season,
            compId,
            compName: compNamesMap[compId] || compId,
            position: details.posizione ?? '—',
            trophyWonText: trophyLabel
          });
        });
      });
    });

    if (tbody) {
      if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text3)">Nessun piazzamento in palmarès.</td></tr>`;
      } else {
        tbody.innerHTML = rows.map(r => `
          <tr>
            <td><strong>${r.teamName}</strong></td>
            <td>${r.season}</td>
            <td>${r.compName}</td>
            <td>${typeof r.position === 'number' ? `${r.position}° Posto` : r.position}</td>
            <td>${r.trophyWonText}</td>
            <td>
              <button class="btn btn-red" style="padding:.25rem .5rem; font-size:.75rem; width:auto" 
                onclick="window.deletePalmares('${r.teamId}', '${r.season}', '${r.compId}')">
                Elimina
              </button>
            </td>
          </tr>
        `).join('');
      }
    }
  },

  handleCompChange() {
    const compId = document.getElementById('palComp').value;
    const wrapper = document.getElementById('palPositionWrapper');
    const wonCheckbox = document.getElementById('palWon');
    if (!wrapper) return;

    if (!compId || !this.competitionsData[compId]) {
      wrapper.innerHTML = `
        <label class="label" style="font-size:.8rem; margin-top:.4rem;">Posizionamento</label>
        <input type="text" id="palPosition" class="input-login" placeholder="Seleziona prima una competizione" disabled>`;
      if (wonCheckbox) wonCheckbox.checked = false;
      return;
    }

    const comp = this.competitionsData[compId];
    const isCampionato = comp.type === 'campionato';

    if (isCampionato) {
      wrapper.innerHTML = `
        <label class="label" style="font-size:.8rem; margin-top:.4rem;">Posizione Finale in Classifica (Numero)</label>
        <input type="number" id="palPosition" class="input-login" min="1" max="100" placeholder="es: 1 per 1° posto, 2 per 2° posto..." oninput="
          const val = parseInt(this.value, 10);
          document.getElementById('palWon').checked = (val === 1);
        ">`;
    } else {
      const fases = ["Vincitore", "Finalista"];

      if (comp.tabelloneStructure && comp.tabelloneStructure.fasi) {
        Object.values(comp.tabelloneStructure.fasi).forEach(f => {
          if (f.nomeFase && !fases.includes(f.nomeFase)) {
            fases.push(f.nomeFase);
          }
        });
      } else {
        fases.push("Semifinali", "Quarti di Finale", "Fase a Gironi");
      }

      const options = fases.map(f => `<option value="${f}">${f}</option>`).join('');

      wrapper.innerHTML = `
        <label class="label" style="font-size:.8rem; margin-top:.4rem;">Fase / Posizionamento Tabellone</label>
        <select id="palPositionSelect" class="input-login" style="margin-bottom:.4rem;" onchange="
          const isCustom = this.value === 'custom';
          document.getElementById('palPosition').value = isCustom ? '' : this.value;
          document.getElementById('palPositionCustom').style.display = isCustom ? 'block' : 'none';
          document.getElementById('palWon').checked = (this.value === 'Vincitore');
        ">
          ${options}
          <option value="custom">-- Altra Fase (Personalizzata) --</option>
        </select>
        <input type="text" id="palPositionCustom" class="input-login" style="display:none;" placeholder="Inserisci fase personalizzata">
        <input type="hidden" id="palPosition" value="${fases[0]}">`;

      if (wonCheckbox) wonCheckbox.checked = true;
    }
  },

  async savePalmares() {
    const teamId = document.getElementById('palTeam').value;
    const season = document.getElementById('palSeason').value.trim().replace(/\s+/g, '');
    const compId = document.getElementById('palComp').value;
    const won = document.getElementById('palWon').checked;

    if (!teamId) return window.toast("Seleziona una squadra!", "err");
    if (!season) return window.toast("Inserisci la stagione (es: 2025-2026)!", "err");
    if (!compId) return window.toast("Seleziona una competizione!", "err");

    const comp = this.competitionsData[compId];
    if (!comp) return window.toast("Competizione non trovata!", "err");

    const isCampionato = comp.type === 'campionato';

    let rawPosition;
    const customInput = document.getElementById('palPositionCustom');
    if (customInput && customInput.style.display !== 'none') {
      rawPosition = customInput.value.trim();
    } else {
      rawPosition = document.getElementById('palPosition').value;
    }

    if (rawPosition === undefined || rawPosition === '') {
      return window.toast("Inserisci o seleziona un posizionamento valido!", "err");
    }

    let finalPosition;
    if (isCampionato) {
      finalPosition = parseInt(rawPosition, 10);
      if (isNaN(finalPosition) || finalPosition < 1) {
        return window.toast("La posizione per il campionato deve essere un numero valido (1, 2, 3...)!", "err");
      }
    } else {
      finalPosition = String(rawPosition).trim();
    }

    const trophyCodeToSave = won ? (comp.trophyId || compId) : null;

    const btnSubmit = document.getElementById('btnSubmitPalmares');
    const originalText = btnSubmit.textContent;
    btnSubmit.textContent = "Salvataggio...";
    btnSubmit.disabled = true;

    try {
      const targetRef = ref(database, `teams/${teamId}/palmares/${season}/${compId}`);
      
      await set(targetRef, {
        posizione: finalPosition,
        trofeo_vinto: trophyCodeToSave,
        timestamp: Date.now()
      });

      window.toast("Palmarès aggiornato con successo!", "ok");
      this.handleCompChange();

    } catch (err) {
      console.error(err);
      window.toast(err.message || "Errore durante il salvataggio", "err");
    } finally {
      btnSubmit.textContent = originalText;
      btnSubmit.disabled = false;
    }
  },

  async deletePalmares(teamId, season, compId) {
    if (confirm(`Rimuovere questa competizione dal palmarès della squadra?`)) {
      try {
        await remove(ref(database, `teams/${teamId}/palmares/${season}/${compId}`));
        window.toast("Piazzamento rimosso dal palmarès.", "ok");
      } catch (err) {
        window.toast("Errore durante l'eliminazione", "err");
      }
    }
  }
};
