/**
 * ─────────────────────────────────────────────────────────────────────
 *  fantacalcio-sync  ·  sync.js
 *
 *  Fetcha i voti live da fantacalcio.it e li scrive su Firebase
 *  via REST API (nessun SDK, zero dipendenze pesanti).
 *
 *  Uso diretto:
 *    node sync.js              → 1 fetch e basta
 *    node sync.js --loop 5 --interval 60  → 5 fetch, 1 al minuto
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

import fetch from 'node-fetch';

// ── Parametri CLI ────────────────────────────────────────────────────
const args        = process.argv.slice(2);
const loopCount   = parseInt(getArg(args, '--loop',     '1'));
const intervalSec = parseInt(getArg(args, '--interval', '0'));
const gwOverride  = process.env.GIORNATA_OVERRIDE?.trim() || getArg(args, '--gw', '');

// ── Env ──────────────────────────────────────────────────────────────
const FIREBASE_DB_URL  = process.env.FIREBASE_DB_URL;
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

if (!FIREBASE_DB_URL) {
  console.error('❌  FIREBASE_DB_URL non impostata. Aggiungila come GitHub Secret.');
  process.exit(1);
}

// ── Fantacalcio.it endpoint ──────────────────────────────────────────
const FC_BASE    = 'https://www.fantacalcio.it/api/v1/Giornata';
const FC_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; FantacalcioSync/1.0)',
  'Referer':    'https://www.fantacalcio.it/',
  'Accept':     'application/json',
};

// ────────────────────────────────────────────────────────────────────
//  MAIN
// ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🚀  fantacalcio-sync  |  loop=${loopCount}  interval=${intervalSec}s`);

  for (let i = 0; i < loopCount; i++) {
    if (i > 0) {
      console.log(`\n⏳  Attendo ${intervalSec}s prima del prossimo ciclo…`);
      await sleep(intervalSec * 1000);
    }

    console.log(`\n── Ciclo ${i + 1}/${loopCount}  ${new Date().toISOString()} ──`);
    await runSync();
  }

  console.log('\n✅  Tutti i cicli completati.');
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

    // 2) Fetch live da fantacalcio.it
    const players = await fetchLiveFromFC(gw);
    if (!players.length) {
      console.warn('⚠️   Nessun dato ricevuto dall\'API. Giornata non ancora iniziata?');
      await writeStatus(gw, false);
      return;
    }

    console.log(`📥  Ricevuti ${players.length} calciatori dall'API`);

    // 3) Costruisci mappa voti
    const votes    = {};
    let   withVote = 0;
    let   isLive   = false;

    for (const p of players) {
      const id   = String(p.IdCalciatore ?? p.id ?? '');
      const voto = parseFloat(p.MediaVoto ?? p.Voto ?? 0);

      if (!id || isNaN(voto) || voto <= 0) continue;

      votes[id] = { voto: Math.round(voto * 10) / 10 };
      withVote++;

      // Se almeno un giocatore ha un voto != sv è in corso/conclusa
      if (p.Status === 'live' || p.InCampo === true || p.Status === 'played') {
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
    // Non rilanciare: il workflow deve continuare con i cicli successivi
  }
}

// ────────────────────────────────────────────────────────────────────
//  FANTACALCIO.IT
// ────────────────────────────────────────────────────────────────────
async function fetchLiveFromFC(gw) {
  const url = `${FC_BASE}/${gw}/live`;
  console.log(`🌐  GET ${url}`);

  const res = await fetch(url, { headers: FC_HEADERS, timeout: 15000 });

  if (!res.ok) {
    throw new Error(`fantacalcio.it risponde HTTP ${res.status}`);
  }

  const json = await res.json();

  // Struttura risposta: { data: [...] } oppure array diretto
  return Array.isArray(json)
    ? json
    : (json.data ?? json.Data ?? json.players ?? []);
}

// ────────────────────────────────────────────────────────────────────
//  FIREBASE REST (nessun SDK)
// ────────────────────────────────────────────────────────────────────

/** Legge la giornata corrente (prova due percorsi) */
async function readCurrentGW() {
  // Prima prova status/currentRealGW (come nel tuo admin)
  let gw = await fbGet('status/currentRealGW');
  if (!gw || isNaN(parseInt(gw))) {
    // Fallback: config/currentGW
    gw = await fbGet('config/currentGW');
  }
  const parsed = parseInt(gw);
  if (isNaN(parsed) || parsed < 1) {
    console.warn('⚠️   GW non trovato in Firebase, uso GW 1');
    return 1;
  }
  return parsed;
}

/** Scrive tutti i voti della giornata */
async function writeVotes(gw, votes) {
  // PUT sovrascrive l'intera chiave — tutti i voti della GW in un colpo solo
  await fbPut(`votes/gw${gw}`, votes);
}

/** Aggiorna stato live e timestamp ultimo sync */
async function writeStatus(gw, isLive) {
  await fbPatch('status', {
    live:       isLive,
    lastSync:   new Date().toISOString(),
    lastSyncGW: gw,
  });
}

// ── Firebase REST helpers ────────────────────────────────────────────

function fbUrl(path) {
  // Se c'è un API Key usa autenticazione anonima (non richiede regole aperte)
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
