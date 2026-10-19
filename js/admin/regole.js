import { ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import {
  RULE_MATCH, RULE_DEFAULTS, RULE_LABELS, MOD_DIFESA, MOD_DIFESA_DEFAULT_FASCE,
  FASCE_GOL, FASCE_GOL_DEFAULT, applicaRegole, normalizzaFasce
} from "../services/calcoloMatch.js";

/**
 * Area Patron → Regole calcolo: valore dei bonus/malus, fasce gol e modificatore difesa della lega.
 *
 *  - DB: status/regole = { bonus: { gol: 3, ... }, modDifesa: { attivo, fasce: [{ da, a, punti }] },
 *                          fasceGol: { soglie: [66, 72, ...], incremento: 6 } }
 *  - Letto dall'app (index.html) e dal calcolo della giornata (dashboard.js) tramite applicaRegole().
 *  - Vale per i calcoli successivi al salvataggio: le giornate già calcolate vanno ricalcolate.
 */
let database = null;
const toast = (m, t) => (window.toast ? window.toast(m, t) : alert(m));
const fmtNum = (n) => (n === null || n === undefined) ? '' : String(n);

export const RegoleSection = {
  _fasce: [],
  _soglie: [],
  _caricate: false,

  init(db) {
    database = db;
    window.regoleAction = (act, i) => this.action(act, i);
    // colonna "Fino a" delle fasce gol aggiornata quando si cambia una soglia
    document.addEventListener('change', (e) => {
      if (e.target.matches?.('#rgGolBody [data-soglia]')) { this.readSoglie(); this.renderSoglie(); }
    });
    onValue(ref(database, 'status/regole'), snap => {
      applicaRegole(snap.val());
      this._caricate = true;
      this.fill();
    });
  },

  renderHTML() {
    const bonusInputs = Object.keys(RULE_DEFAULTS).map(k => `
      <div style="flex:1; min-width:140px;">
        <label class="label" for="rg-${k}">${RULE_LABELS[k]}</label>
        <input type="number" step="0.5" id="rg-${k}" class="input-login" style="margin:0; padding:.6rem;" placeholder="${RULE_DEFAULTS[k]}">
      </div>`).join('');

    return `
    <div id="sec-regole" class="admin-sec" style="display:none">
      <div class="sec-title">Regole di calcolo</div>

      <div class="card" style="max-width: 760px;">
        <div class="label" style="color: var(--accent); margin-bottom: .6rem; font-size: .85rem;">
          <i class="ri-scales-3-line"></i> Bonus e malus
        </div>
        <p style="font-size: .8rem; color: var(--text2); font-family: var(--font-sub, inherit); margin-bottom: 1rem;">
          Punti sommati al voto base per ogni evento (usa il segno meno per i malus). Valgono per il calcolo della giornata,
          il live e le schede dei giocatori. Le giornate già calcolate cambiano solo se le ricalcoli dalla Dashboard.
        </p>
        <div style="display:flex; flex-wrap:wrap; gap:.75rem;">${bonusInputs}</div>
      </div>

      <div class="card" style="max-width: 760px;">
        <div class="label" style="color: var(--accent); margin-bottom: .6rem; font-size: .85rem;">
          <i class="ri-football-line"></i> Fasce gol
        </div>
        <p style="font-size: .8rem; color: var(--text2); font-family: var(--font-sub, inherit); margin-bottom: 1rem;">
          Punteggio totale minimo per segnare ogni gol (es. 1° gol da 66, 2° gol da 71: da 66 a 70,5 è 1 gol).
          Oltre l'ultima fascia si segna un gol in più ogni tot punti (0 = nessun gol in più).
        </p>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Gol</th><th>Da punti (≥)</th><th>Fino a</th><th></th></tr></thead>
            <tbody id="rgGolBody"></tbody>
          </table>
        </div>
        <button class="btn btn-outline" style="width:auto; margin-top:.6rem;" onclick="window.regoleAction('add-gol')"><i class="ri-add-line"></i> Aggiungi fascia gol</button>
        <div style="display:flex; align-items:center; gap:.6rem; flex-wrap:wrap; margin-top:1rem;">
          <label class="label" for="rgGolIncremento" style="margin:0;">Oltre l'ultima fascia: +1 gol ogni</label>
          <input type="number" step="0.5" min="0" id="rgGolIncremento" class="input-login" style="width:90px; margin:0; padding:.45rem;" placeholder="${FASCE_GOL_DEFAULT.incremento}">
          <span style="font-size:.85rem;">punti</span>
        </div>
      </div>

      <div class="card" style="max-width: 760px;">
        <div class="label" style="color: var(--accent); margin-bottom: .6rem; font-size: .85rem;">
          <i class="ri-shield-line"></i> Modificatore difesa
        </div>
        <p style="font-size: .8rem; color: var(--text2); font-family: var(--font-sub, inherit); margin-bottom: 1rem;">
          Vale solo per chi schiera <b>almeno 4 difensori</b>. Si fa la media dei voti base (senza bonus/malus) del
          <b>portiere</b> e dei <b>3 difensori con il voto più alto</b> (dopo le sostituzioni dalla panchina): i punti della
          fascia in cui cade la media si aggiungono al totale della squadra. Ogni fascia va da "Da" (compreso) ad "A" (escluso);
          lascia "A" vuoto per "da qui in su". Se il portiere o uno dei 3 difensori è senza voto il modificatore non si applica.
        </p>
        <label style="display:flex; align-items:center; gap:.5rem; font-size:.9rem; margin-bottom:1rem; cursor:pointer;">
          <input type="checkbox" id="rgModAttivo"> Modificatore difesa attivo nella lega
        </label>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Media da (≥)</th><th>a (&lt;)</th><th>Punti</th><th></th></tr></thead>
            <tbody id="rgFasceBody"></tbody>
          </table>
        </div>
        <button class="btn btn-outline" style="width:auto; margin-top:.6rem;" onclick="window.regoleAction('add-fascia')"><i class="ri-add-line"></i> Aggiungi fascia</button>
      </div>

      <div style="display:flex; gap:.6rem; flex-wrap:wrap; max-width: 760px;">
        <button class="btn btn-green" style="width:auto;" onclick="window.regoleAction('save')"><i class="ri-save-line"></i> Salva regole</button>
        <button class="btn btn-outline" style="width:auto;" onclick="window.regoleAction('defaults')"><i class="ri-arrow-go-back-line"></i> Valori predefiniti</button>
      </div>
    </div>`;
  },

  render() {
    // i campi si riempiono con i valori del DB (fill), non a ogni refresh: non si perdono le modifiche in corso
    if (this._caricate && !document.getElementById('rgFasceBody')?.dataset.filled) this.fill();
  },

  /** Campi del form con le regole correnti. */
  fill() {
    const body = document.getElementById('rgFasceBody');
    if (!body) return;
    Object.keys(RULE_DEFAULTS).forEach(k => {
      const el = document.getElementById(`rg-${k}`);
      if (el) el.value = fmtNum(RULE_MATCH[k]);
    });
    const att = document.getElementById('rgModAttivo');
    if (att) att.checked = MOD_DIFESA.attivo;
    this._fasce = MOD_DIFESA.fasce.map(f => ({ ...f }));
    this.renderFasce();
    this._soglie = [...FASCE_GOL.soglie];
    const incr = document.getElementById('rgGolIncremento');
    if (incr) incr.value = fmtNum(FASCE_GOL.incremento);
    this.renderSoglie();
    body.dataset.filled = '1';
  },

  renderFasce() {
    const body = document.getElementById('rgFasceBody');
    if (!body) return;
    const inp = (i, campo, ph) => `<input type="number" step="0.05" data-fascia="${i}" data-campo="${campo}" class="input-login" style="width:90px; margin:0; padding:.35rem;" placeholder="${ph}" value="${fmtNum(this._fasce[i][campo])}">`;
    body.innerHTML = this._fasce.length
      ? this._fasce.map((f, i) => `
        <tr>
          <td>${inp(i, 'da', '6')}</td>
          <td>${inp(i, 'a', 'in su')}</td>
          <td>${inp(i, 'punti', '0.5')}</td>
          <td><button class="btn btn-outline" style="width:auto; padding:.3rem .6rem; font-size:.75rem;" onclick="window.regoleAction('del-fascia', ${i})" aria-label="Elimina fascia"><i class="ri-delete-bin-line"></i></button></td>
        </tr>`).join('')
      : `<tr><td colspan="4" style="color:var(--text3);">Nessuna fascia: il modificatore non darebbe punti.</td></tr>`;
  },

  renderSoglie() {
    const body = document.getElementById('rgGolBody');
    if (!body) return;
    const fino = (i) => {
      const next = this._soglie[i + 1];
      return Number.isFinite(next) ? `meno di ${String(next).replace('.', ',')}` : 'poi fasce automatiche';
    };
    body.innerHTML = this._soglie.length
      ? this._soglie.map((v, i) => `
        <tr>
          <td><b>${i + 1}</b></td>
          <td><input type="number" step="0.5" data-soglia="${i}" class="input-login" style="width:90px; margin:0; padding:.35rem;" value="${fmtNum(v)}"></td>
          <td style="font-size:.8rem; color:var(--text2);">${fino(i)}</td>
          <td><button class="btn btn-outline" style="width:auto; padding:.3rem .6rem; font-size:.75rem;" onclick="window.regoleAction('del-gol', ${i})" aria-label="Elimina fascia gol"><i class="ri-delete-bin-line"></i></button></td>
        </tr>`).join('')
      : `<tr><td colspan="4" style="color:var(--text3);">Aggiungi almeno la soglia del primo gol.</td></tr>`;
  },

  /** Soglie gol come scritte nei campi (null = campo vuoto o non valido). */
  readSoglie() {
    document.querySelectorAll('#rgGolBody [data-soglia]').forEach(el => {
      const v = parseFloat(String(el.value).replace(',', '.'));
      this._soglie[Number(el.dataset.soglia)] = Number.isFinite(v) ? v : null;
    });
    return this._soglie;
  },

  /** Valori delle fasce come scritti nei campi (anche incompleti). */
  readFasce() {
    document.querySelectorAll('#rgFasceBody [data-fascia]').forEach(el => {
      const f = this._fasce[Number(el.dataset.fascia)];
      if (!f) return;
      const v = parseFloat(String(el.value).replace(',', '.'));
      f[el.dataset.campo] = Number.isFinite(v) ? v : null;
    });
    return this._fasce;
  },

  async action(act, i) {
    if (act === 'add-fascia') {
      const fasce = this.readFasce();
      const last = fasce[fasce.length - 1];
      const da = last ? (last.a ?? last.da + 0.25) : 6;
      if (last && last.a === null) last.a = da;
      fasce.push({ da, a: null, punti: last ? last.punti + 0.5 : 0.5 });
      this.renderFasce();
      return;
    }
    if (act === 'del-fascia') {
      this.readFasce().splice(i, 1);
      this.renderFasce();
      return;
    }
    if (act === 'add-gol') {
      const soglie = this.readSoglie();
      const last = soglie[soglie.length - 1];
      const incr = parseFloat(document.getElementById('rgGolIncremento')?.value) || FASCE_GOL_DEFAULT.incremento;
      soglie.push(Number.isFinite(last) ? last + incr : FASCE_GOL_DEFAULT.soglie[0]);
      this.renderSoglie();
      return;
    }
    if (act === 'del-gol') {
      this.readSoglie().splice(i, 1);
      this.renderSoglie();
      return;
    }
    if (act === 'defaults') {
      if (!confirm('Riportare bonus/malus, fasce gol e fasce del modificatore ai valori predefiniti? (Va poi salvato)')) return;
      Object.keys(RULE_DEFAULTS).forEach(k => {
        const el = document.getElementById(`rg-${k}`);
        if (el) el.value = fmtNum(RULE_DEFAULTS[k]);
      });
      this._fasce = MOD_DIFESA_DEFAULT_FASCE.map(f => ({ ...f }));
      this.renderFasce();
      this._soglie = [...FASCE_GOL_DEFAULT.soglie];
      const incr = document.getElementById('rgGolIncremento');
      if (incr) incr.value = fmtNum(FASCE_GOL_DEFAULT.incremento);
      this.renderSoglie();
      return;
    }
    if (act === 'save') return this.save();
  },

  async save() {
    if (!database) return;
    const bonus = {};
    for (const k of Object.keys(RULE_DEFAULTS)) {
      const raw = document.getElementById(`rg-${k}`)?.value ?? '';
      const v = parseFloat(String(raw).replace(',', '.'));
      if (raw !== '' && !Number.isFinite(v)) return toast(`Valore non valido per "${RULE_LABELS[k]}"`, 'err');
      bonus[k] = Number.isFinite(v) ? v : RULE_DEFAULTS[k];
    }

    const soglie = this.readSoglie();
    if (!soglie.length) return toast('Indica almeno la soglia del primo gol', 'err');
    if (soglie.some(v => v === null)) return toast('Ogni fascia gol deve avere il punteggio "Da"', 'err');
    for (let j = 1; j < soglie.length; j++) {
      if (soglie[j] <= soglie[j - 1]) return toast(`Fasce gol: il ${j + 1}° gol (${soglie[j]}) deve partire da un punteggio più alto del ${j}° (${soglie[j - 1]})`, 'err');
    }
    const incrRaw = document.getElementById('rgGolIncremento')?.value ?? '';
    const incremento = incrRaw === '' ? FASCE_GOL_DEFAULT.incremento : parseFloat(String(incrRaw).replace(',', '.'));
    if (!Number.isFinite(incremento) || incremento < 0) return toast('Il passo oltre l\'ultima fascia gol deve essere un numero ≥ 0', 'err');

    const scritte = this.readFasce();
    const fasce = normalizzaFasce(scritte);
    if (fasce.length !== scritte.length) {
      return toast('Ogni fascia deve avere "Da" e "Punti", e "A" (se c\'è) maggiore di "Da"', 'err');
    }
    for (let j = 1; j < fasce.length; j++) {
      const prev = fasce[j - 1];
      if (prev.a === null || prev.a > fasce[j].da) {
        return toast(`Le fasce si sovrappongono: ${prev.da}–${prev.a ?? 'in su'} e ${fasce[j].da}–${fasce[j].a ?? 'in su'}`, 'err');
      }
    }
    const attivo = !!document.getElementById('rgModAttivo')?.checked;
    if (attivo && !fasce.length) return toast('Aggiungi almeno una fascia per attivare il modificatore difesa', 'err');

    try {
      // Firebase non salva i null: "A" vuoto = fascia senza tetto
      const fasceDb = fasce.map(f => (f.a === null ? { da: f.da, punti: f.punti } : f));
      await set(ref(database, 'status/regole'), { bonus, fasceGol: { soglie, incremento }, modDifesa: { attivo, fasce: fasceDb }, updatedAt: Date.now() });
      toast('Regole di calcolo salvate. Ricalcola le giornate già giocate per applicarle.', 'ok');
    } catch (err) {
      console.error(err);
      toast('Errore nel salvataggio delle regole', 'err');
    }
  }
};
