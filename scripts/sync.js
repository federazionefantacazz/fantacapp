/**
 * ─────────────────────────────────────────────────────────────────────
 *  fantacalcio-sync  ·  sync.js
 *
 *  Fetcha i voti live tramite la libreria esterna fantacalcio-voti-live
 *  e li scrive su Firebase via REST API.
 *
 *  Uso diretto:
 *    node sync.js              → 1 fetch e basta
 *    node sync.js --interval 60  → loop continuo ogni 60 secondi
 *
 *  Env richieste (GitHub Secrets):
 *    FIREBASE_DB_URL   es. https://mio-progetto-default-rtdb.europe-west1.firebasedatabase.app
 *    FIREBASE_API_KEY  chiave web dell'app Firebase (per auth anonima)
 *
 *  Struttura Firebase scritta:
 *    /votes/gw{N}/{playerId} = { voto: 7.5 }
 *    /status/lastSync        = "2025-01-15T20:31:00Z"
 *    /status/live            = true | false
 * ─────────────────────────────────────────────────────────────────────
 */

import { execSync } from 'child_process';
import fetch from 'node-fetch';

// ── Parametri CLI ────────────────────────────────____________________
const args        = process.argv.slice(2);
const intervalSec = parseInt(getArg(args, '--interval', '0'));
const gwOverride  = process.env.GIORNATA_OVERRIDE?.trim() || getArg(args, '--gw', '');

// ── Env ────────────────────────────────________________──────────────
const FIREBASE_DB_URL  = process.env.FIREBASE_DB_URL;
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

if (!FIREBASE_DB_URL) {
  console.error('❌  FIREBASE_DB_URL non impostata. Aggiungila come GitHub Secret.');
  process.exit(1);
}

// ────────────────────────────────────────────────────────────────────
//  MAIN (Loop continuo per evitare lo stop)
// ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🚀  fantacalcio-sync avviato | interval=${intervalSec}s (Loop continuo attivo)`);

  let cycle = 1;

  while (true) {
    console.log(`\n── Ciclo ${cycle}  ${new Date().toISOString()} ──`);
    
    try {
      await runSync();
    } catch (err) {
      console.error('❌  Errore critico non gestito nel ciclo:', err.message);
    }

    // Se non è specificato un intervallo, esegue una sola volta ed esce (utile per test singoli)
    if (intervalSec <= 0) {
      console.log('\n✅  Esecuzione singola completata.');
      break;
    }

    console.log(`\n⏳  Attendo ${intervalSec}s prima del prossimo ciclo…`);
    await sleep(intervalSec * 1000);
    cycle++;
  }
}

// ────────────────────────────────────────────────────────────────────
//  SINGOLO CICLO DI SYNC
// ────────────────────────────────────────────────────────────────────
async function runSync() {
  try {
    // 1) Leggi giornata corrente da Firebase (config/currentGW o status/currentRealGW)
    const gw = gwOverride
      ? parseInt(gwOverride)
      : await readCurrentGW();

    console.log(`📅  Giornata target: GW ${gw}`);

    // 2) Fetch tramite la libreria fantacalcio-voti-live
    const players = fetchPlayersViaLib(gw);
    if (!players.length) {
      console.warn('⚠️   Nessun dato ricevuto dalla libreria. Giornata non ancora iniziata?');
      await writeStatus(gw, false);
      return;
    }

    console.log(`📥  Ricevuti ${players.length} calciatori dalla libreria`);

    // 3) Costruisci mappa voti
    const votes    = {};
    let   withVote = 0;
    let   isLive   = false;

    for (const p of players) {
      const id   = String(p.IdCalciatore ?? p.id ?? p.Id ?? '');
      const voto = parseFloat(p.MediaVoto ?? p.Voto ?? p.voto ?? 0);

      if (!id || isNaN(voto) || voto <= 0) continue;

      votes[id] = { voto: Math.round(voto * 10) / 10 };
      withVote++;

      // Considera "live" se almeno una partita è in corso
      if (p.Status === 'live' || p.InGioco === true || p.InCampo === true) {
        isLive = true;
      }
    }

    console.log(`📊  ${withVote} calciatori con voto assegnato  |  live=${isLive}`);

    // 4) Scrivi su Firebase
    if (withVote > 0) {
      await writeVotes(gw, votes);
      await writeStatus(gw, isLive);
      console.log(`✅  Firebase aggiornato → votes/gw${gw}`);
    } else {
      console.warn('⚠️   Nessun voto utile trovato, Firebase non aggiornato.');
    }

  } catch (err) {
    console.error('❌  Errore nel ciclo di sync:', err.message);
  }
}

// ────────────────────────────────────────────────────────────────────
//  FETCH TRAMITE LIBRERIA ESTERNA (npx fantacalcio-voti-live)
// ────────────────────────────────────────────────────────────────────
function fetchPlayersViaLib(gw) {
  try {
    console.log(`⚙️   Esecuzione tool fantacalcio-voti-live per la GW ${gw}...`);
    const stdout = execSync(`npx fantacalcio-voti-live ${gw}`, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024 // 10MB di buffer per sicurezza
    });

    const json = JSON.parse(stdout);
    return Array.isArray(json) ? json : (json.data ?? json.Data ?? json.players ?? []);
  } catch (err) {
    console.warn(`⚠️   Impossibile recuperare i dati tramite tool: ${err.message}`);
    return [];
  }
}

// ────────────────────────────────────────────────────────────────────
//  FIREBASE REST (nessun SDK)
// ────────────────────────────────────────────────────────────────────

async function readCurrentGW() {
  let gw = await fbGet('status/currentRealGW');
  if (!gw || isNaN(parseInt(gw))) {
    gw = await fbGet('config/currentGW');
  }
  const parsed = parseInt(gw);
  if (isNaN(parsed) || parsed < 1) {
    console.warn('⚠️   GW non trovato in Firebase, uso GW 1');
    return 1;
  }
  return parsed;
}

async function writeVotes(gw, votes) {
  await fbPut(`votes/gw${gw}`, votes);
}

async function writeStatus(gw, isLive) {
  await fbPatch('status', {
    live:       isLive,
    lastSync:   new Date().toISOString(),
    lastSyncGW: gw,
  });
}

// ── Firebase REST helpers ────────────────────────────────────────────

function fbUrl(path) {
  const base = `${FIREBASE_DB_URL}/${path}.json`;
  return FIREBASE_API_KEY ? `${base}?key=${FIREBASE_API_KEY}` : base;
}

async function fbGet(path) {
  const res = await fetch(fbUrl(path));
  if (!res.ok) throw new Error(`Firebase GET /${path} → HTTP ${res.status}`);
  return res.json();
}

async function fbPut(path, data) {
  const res = await fetch(fbUrl(path), {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Firebase PUT /${path} → HTTP ${res.status}: ${body}`);
  }
}

async function fbPatch(path, data) {
  const res = await fetch(fbUrl(path), {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Firebase PATCH /${path} → HTTP ${res.status}: ${body}`);
  }
}

// ── Utility ──────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function getArg(args, flag, def) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : def;
}

// ── Avvio ─────────────────────────────────────────────────────────────
main().catch(err => {
  console.error('💥  Errore fatale:', err);
  process.exit(1);
});
