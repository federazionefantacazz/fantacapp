# FantaCapp — istruzioni per Claude

PWA senza build step (HTML + JS moduli ES), pubblicata con GitHub Pages da `main`. Firebase per i dati.

## Come lavorare con l'utente
- Rispondere sempre in **italiano**, frasi semplici. L'utente prova tutto dal telefono e manda screenshot.
- Prima di ogni nuovo lavoro: `git fetch origin main && git checkout -B <branch> origin/main`.
- Quando l'utente scrive **"crea pr e mergia"** (o simili):
  1. `git fetch origin main`; se `main` è avanti, fai il merge nel branch (merge commit, niente rebase).
  2. Porta `CACHE_NAME` in `sw.js` (`fantacapp-pwa-alpha-v1.1.0.N`) **sopra** quello di `main` (+1), commit, push.
  3. Crea la PR con gli strumenti GitHub MCP e fai il merge (`merge_method: merge`). Controlla il numero della PR giusta.
- Ogni file statico nuovo va anche nella lista di `sw.js`.
- Prima del commit: controllo sintassi (`sed 's#^import .*https.*##' file.js > /tmp/t.mjs && node --check /tmp/t.mjs`),
  togliere righe di debug (`window.__stage = stage; // DEBUG`) e i file di prova nella radice (`_test_*.html`, `_dump.html`).
- Nessun identificativo del modello AI nei commit o nelle PR.

## Documentazione
Indice in **[docs/README.md](docs/README.md)**: architettura e dati ([docs/architettura.md](docs/architettura.md)), editor
della maglia e dello stadio con barra delle fasi e zoom sulle parti ([docs/editor.md](docs/editor.md)), stadio 3D
([docs/stadio3d.md](docs/stadio3d.md)), bug noti e idee ([docs/bug-e-idee.md](docs/bug-e-idee.md)), guida per l'utente
([docs/guida-utente.md](docs/guida-utente.md)). Leggere il documento giusto prima di lavorare e aggiornarlo nello
stesso commit quando cambia qualcosa di importante.

## Maglie 3D (editor "Divisa squadra")
Tutto quello che serve per costruire e modificare maglie, colletti, bordini, righe, colletto grosso, patch e fascia da
capitano è in **[docs/kit3d.md](docs/kit3d.md)**: leggilo prima di toccare `js/components/Kit3D.js`,
`js/components/KitRenderer.js`, `js/components/kitShapes.js`, `js/menu/DivisaSquadra.js` o `icons/kit3d/`.
Gli script che generano i file dei colletti e gli strumenti per i render sono in **[tools/kit3d/](tools/kit3d/README.md)**.

Regola d'oro per le maglie: **prima di consegnare, render da tutti i lati** (davanti, 3/4, lato, dietro, dentro il collo
dall'alto, zoom ravvicinato sul colletto, zoom minimo) con `tools/kit3d/render/render.sh`, guardare i ritagli ingranditi
e mandare le immagini all'utente.
