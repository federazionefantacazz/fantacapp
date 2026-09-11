/**
 * ─────────────────────────────────────────────────────────────────────
 *  fantacalcio-sync  ·  sync.js
 *
 *  Fetcha i voti live da fantacalcio.it e li scrive su Firebase
 *  via REST API (nessun SDK, zero dipendenze pesanti).
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

import fetch from 'node-fetch';

// ── Parametri CLI ────────────────────────────────____________________
const args        = process.argv.slice(2);
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
//  FANTACALCIO.IT  —  strategia a cascata
// ────────────────────────────────────────────────────────────────────
async function fetchLiveFromFC(gw) {
  // ── Tentativo 1: endpoint LIVE ────────────────────────────────────
  const liveUrl = `${FC_BASE}/${gw}/live`;
  console.log(`🌐  GET ${liveUrl}  (tentativo live)`);

  try {
    const liveRes = await fetch(liveUrl, { headers: FC_HEADERS, timeout: 15000 });

    if (liveRes.ok) {
      const json    = await liveRes.json();
      const players = extractPlayers(json);

      if (players.length > 0) {
        console.log(`✅  Endpoint /live OK — ${players.length} calciatori`);
        return players;
      }

      console.warn('⚠️   /live risponde 200 ma con 0 calciatori → provo /voti');
    } else if (liveRes.status === 404) {
      console.warn(`⚠️   /live → 404 (nessuna partita in corso) → provo /voti`);
    } else {
      console.warn(`⚠️   /live → HTTP ${liveRes.status} → provo /voti`);
    }
  } catch (err) {
    console.warn(`⚠️   /live → errore di rete (${err.message}) → provo /voti`);
  }

  // ── Tentativo 2: endpoint VOTI (definitivi post-partita) ──────────
  const votiUrl = `${FC_BASE}/${gw}/voti`;
  console.log(`🌐  GET ${votiUrl}  (tentativo voti definitivi)`);

  const votiRes = await fetch(votiUrl, { headers: FC_HEADERS, timeout: 15000 });

  if (!votiRes.ok) {
    throw new Error(
      `/voti → HTTP ${votiRes.status}. ` +
      `Né /live né /voti disponibili per GW ${gw}. ` +
      `La giornata potrebbe non essere ancora iniziata.`
    );
  }

  const json    = await votiRes.json();
  const players = extractPlayers(json);

  if (players.length > 0) {
    console.log(`✅  Endpoint /voti OK — ${players.length} calciatori (voti definitivi)`);
  } else {
    console.warn('⚠️   /voti risponde 200 ma con 0 calciatori. Giornata non disponibile.');
  }

  return players;
}

/**
 * Normalizza la risposta dell'API fantacalcio.it in un array piatto.
 */
function extractPlayers(json) {
  if (Array.isArray(json)) return json;

  const data = json.data ?? json.Data ?? json.players ?? json;

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const players = [];
    for (const match of Object.values(data)) {
      if (Array.isArray(match)) {
        players.push(...match);
      } else {
        if (Array.isArray(match.home)) players.push(...match.home);
        if (Array.isArray(match.away)) players.push(...match.away);
        if (Array.isArray(match.squadra1)) players.push(...match.squadra1);
        if (Array.isArray(match.squadra2)) players.push(...match.squadra2);
      }
    }
    return players;
  }

  return Array.isArray(data) ? data : [];
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
