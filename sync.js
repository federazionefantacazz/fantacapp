/**
 * ─────────────────────────────────────────────────────────────────────
 *  fantacalcio-sync  ·  sync.js (Web Service HTML per Render.com)
 *
 *  Fetcha i voti live tramite la libreria esterna fantacalcio-voti-live
 *  e li scrive su Firebase via REST API. Include un mini server HTTP
 *  con interfaccia HTML per rimanere attivo ed essere triggerato gratis.
 * ─────────────────────────────────────────────────────────────────────
 */

import { execSync } from 'child_process';
import fetch from 'node-fetch';
import http from 'http';

// ── Parametri & Env ──────────────────────────────────────────────────
const PORT              = process.env.PORT || 10000;
const gwOverride        = process.env.GIORNATA_OVERRIDE?.trim() || '';
const FIREBASE_DB_URL   = process.env.FIREBASE_DB_URL;
const FIREBASE_API_KEY  = process.env.FIREBASE_API_KEY;

if (!FIREBASE_DB_URL) {
  console.error('❌  FIREBASE_DB_URL non impostata. Aggiungila nelle Environment Variables.');
  process.exit(1);
}

// Ultimo stato in memoria per mostrarlo nella pagina HTML
let lastSyncStatus = {
  time: 'Mai eseguito',
  status: 'In attesa...',
  success: false
};

// ── Server HTTP con interfaccia HTML per Render ───────────────────────
const server = http.createServer(async (req, res) => {
  // Rotta principale con HTML informativo e interattivo
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="UTF-8">
        <title>Fantacalcio Sync Live</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; display: flex; justify-content: center; }
          .card { background: #1e293b; padding: 30px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); width: 100%; max-width: 500px; }
          h1 { font-size: 22px; margin-bottom: 10px; color: #38bdf8; }
          p { color: #94a3b8; font-size: 14px; }
          .badge { display: inline-block; padding: 6px 12px; border-radius: 6px; font-weight: bold; font-size: 13px; margin-top: 15px; }
          .badge.ok { background: #065f46; color: #34d399; }
          .badge.wait { background: #78350f; color: #fbbf24; }
          button { background: #0284c7; color: white; border: none; padding: 12px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; width: 100%; margin-top: 20px; transition: background 0.2s; }
          button:hover { background: #0369a1; }
          .footer { margin-top: 20px; font-size: 12px; color: #64748b; text-align: center; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>⚽ Fantacalcio Sync Live</h1>
          <p>Servizio di sincronizzazione voti attivo su Render.com</p>
          <hr style="border:0; border-top:1px solid #334155; margin: 20px 0;">
          <p><strong>Ultimo aggiornamento:</strong> ${lastSyncStatus.time}</p>
          <p><strong>Stato:</strong> ${lastSyncStatus.status}</p>
          <div>
            <span class="badge ${lastSyncStatus.success ? 'ok' : 'wait'}">
              ${lastSyncStatus.success ? '● Operativo / Sincronizzato' : '○ In attesa di trigger'}
            </span>
          </div>
          <form action="/sync" method="POST">
            <button type="submit">Forza Sincronizzazione Ora</button>
          </form>
          <div class="footer">Configurato per l'uso con cron-job.org</div>
        </div>
      </body>
      </html>
    `);
    return;
  }

  // Rotta di attivazione del sync (supporta sia GET che POST)
  if (req.url === '/sync') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <h2>🚀 Sincronizzazione avviata in background!</h2>
      <p>Controlla i log di Render per i dettagli. <a href="/">Torna alla home</a></p>
    `);
    
    console.log(`\n🚀  Trigger HTTP ricevuto ${new Date().toISOString()}`);
    runSync().catch(err => console.error('❌  Errore nel ciclo:', err.message));
    return;
  }

  // 404 per qualsiasi altro percorso
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`\n🌐  Server HTTP con interfaccia HTML avviato sulla porta ${PORT}`);
});

// ── SINGOLO CICLO DI SYNC ────────────────────────────────────────────
async function runSync() {
  const timestamp = new Date().toISOString();
  try {
    const gw = gwOverride ? parseInt(gwOverride) : await readCurrentGW();
    console.log(`📅  Giornata target: GW ${gw}`);

    const players = fetchPlayersViaLib(gw);
    if (!players.length) {
      console.warn('⚠️   Nessun dato ricevuto dalla libreria. Giornata non ancora iniziata?');
      await writeStatus(gw, false);
      lastSyncStatus = { time: timestamp, status: `GW ${gw}: Nessun dato (forse non iniziata)`, success: false };
      return;
    }

    console.log(`📥  Ricevuti ${players.length} calciatori dalla libreria`);

    const votes = {};
    let withVote = 0;
    let isLive = false;

    for (const p of players) {
      const id = String(p.IdCalciatore ?? p.id ?? p.Id ?? '');
      const voto = parseFloat(p.MediaVoto ?? p.Voto ?? p.voto ?? 0);

      if (!id || isNaN(voto) || voto <= 0) continue;

      votes[id] = { voto: Math.round(voto * 10) / 10 };
      withVote++;

      if (p.Status === 'live' || p.InGioco === true || p.InCampo === true) {
        isLive = true;
      }
    }

    console.log(`📊  ${withVote} calciatori con voto assegnato  |  live=${isLive}`);

    if (withVote > 0) {
      await writeVotes(gw, votes);
      await writeStatus(gw, isLive);
      console.log(`✅  Firebase aggiornato → votes/gw${gw}`);
      lastSyncStatus = { time: timestamp, status: `GW ${gw}: Aggiornati ${withVote} voti (Live: ${isLive})`, success: true };
    } else {
      console.warn('⚠️   Nessun voto utile trovato, Firebase non aggiornato.');
      lastSyncStatus = { time: timestamp, status: `GW ${gw}: Nessun voto utile trovato`, success: false };
    }

  } catch (err) {
    console.error('❌  Errore nel ciclo di sync:', err.message);
    lastSyncStatus = { time: timestamp, status: `Errore: ${err.message}`, success: false };
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
      maxBuffer: 10 * 1024 * 1024
    });

    const trimmed = stdout.trim();
    if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) {
      console.warn(`⚠️   Messaggio dal tool: "${trimmed}"`);
      return [];
    }

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
