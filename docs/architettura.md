# Architettura di FantaCapp

Guida per Claude (e per chi vuole capire come è fatta l'app). Le regole di lavoro con l'utente sono in
[`CLAUDE.md`](../CLAUDE.md); questo file spiega **dove sta cosa**.

## 1. In breve
- **PWA senza build step**: HTML + moduli ES caricati così come sono. Niente npm, niente bundler. Pubblicata con
  GitHub Pages dal ramo `main`.
- **Dati**: Firebase Realtime Database + Firebase Auth (SDK 10.7.1 da `gstatic.com`, `js/firebase-config.js`).
- **Immagini caricate dagli utenti** (loghi, foto delle maglie e dello stadio, patch...): ImgBB
  (`js/services/integrationImgBB.js`), si salva su Firebase solo l'indirizzo.
- **3D**: three.js in `vendor/three/` (maglia: `js/components/Kit3D.js`; stadio: `js/components/Stadium3D.js`).
- **Icone**: Remix Icon (`ri-*`) da jsDelivr. **Font**: Google Fonts + quelli in `fonts/`.
- Due pagine: `index.html` (l'app delle squadre) e `admin.html` (area **Patron**, l'amministratore della lega).

## 2. File principali

### Radice
| File | Cosa fa |
|---|---|
| `index.html` | Tutta la struttura dell'app: CSS di base (variabili `--bg`, `--accent`...), login/registrazione, barra in basso, menu laterale, avvio (`window.STATE`, sottoscrizioni Firebase, `refreshUI`, `goPage`). |
| `admin.html` | Area Patron: dashboard, squadre, giocatori, voti, calendario, competizioni, regole, temi, divise, trofei, notifiche, account. Usa i moduli in `js/admin/`. |
| `sw.js` | Service worker: cache dei file (`CACHE_NAME` = versione, **va alzata a ogni PR**), cache delle immagini, librerie esterne. Ogni file statico nuovo va in `ASSETS_TO_CACHE`. |
| `manifest.json` | Manifest della PWA (nome, icone, colori). |
| `js/pwaBoot.js` | Registrazione del service worker e avviso "nuova versione disponibile". |
| `js/utils.js` | `esc` (testo sicuro dentro l'HTML), `sameId` e piccole funzioni comuni. |

### Pagine (barra in basso) — `js/`
| File | Pagina |
|---|---|
| `home.js` | Home: la tua squadra, ultima e prossima partita. |
| `calendario.js` | Calendario della competizione, partite per turno. |
| `classifica.js` | Classifica (anche gironi/tabellone con `components/AnteprimaClassifica*.js`). |
| `formazione.js` | Schieramento della formazione (titolari + panchina, scelta giocatori). |
| `liveMatch.js` | Live: punteggi in diretta, colonne o **visuale stadio 3D** (`createStadiumViewer` con `framePitch`). |
| `mercato.js` | Scambi e prestiti tra squadre (`services/mercatoService.js`). |
| `teams.js` | Le squadre della lega: rosa, divise, stadio, palmarès. |

### Menu laterale — `js/menu/` (si aprono in `components/MenuPanel.js`, pannello a tutto schermo)
| File | Cosa fa |
|---|---|
| `ImpostazioniApp.js` | Impostazioni dell'utente (tema, sfondo, notifiche...). |
| `ConfigurazioneSquadra.js` | Logo, nome, staff della squadra; apre gli editor della divisa e dello stadio. |
| `DivisaSquadra.js` | **Editor della maglia** (8 fasi). Vedi [editor.md](editor.md) e [kit3d.md](kit3d.md). |
| `StadioSquadra.js` | **Editor dello stadio** (11 fasi). Vedi [editor.md](editor.md) e [stadio3d.md](stadio3d.md). |
| `ListoneView.js` | Listone dei calciatori e svincolati, con ricerca e preferiti. |
| `NotificheView.js` | Elenco delle notifiche. |
| `menuUtils.js` | `esc` per i menu. |

### Componenti — `js/components/`
| File | Cosa fa |
|---|---|
| `Kit3D.js`, `KitRenderer.js`, `kitShapes.js`, `CaptainBand.js` | Maglia 3D, texture dipinta, forme del colletto, fascia da capitano. |
| `Stadium3D.js` | Stadio 3D costruito via codice (editor, scheda del club, live). |
| `PlayerCard.js` | Scheda del calciatore (si apre toccando un giocatore). |
| `SelectSheet.js` | Sostituisce i `<select>` con un foglio dal basso, comodo sul telefono. |
| `ColorPicker.js` | Selettore colore dell'app (uguale su iPhone e Android). |
| `ImageCropper.js` | Ritaglio delle immagini prima del caricamento. |
| `MatchCardResult.js`, `MatchCardVS.js` | Schede delle partite. |
| `StaffEditor.js` | Allenatore, presidente, ecc. |
| `MenuPanel.js` | Pannello dei menu (stile `.mp-*`, `.lv-chip`). |

### Servizi — `js/services/`
| File | Cosa fa |
|---|---|
| `offlineStore.js` | Copia locale (IndexedDB) dei nodi Firebase: l'app si apre anche senza rete. `watch(path, cb)` al posto di `onValue`. |
| `calcoloMatch.js` | Fantavoto, bonus/malus, sostituzioni dalla panchina, modificatore difesa, fasce gol. |
| `classificaService.js`, `gwService.js` | Classifica e giornate (turni, accoppiamenti, fase passata/corrente/futura). |
| `mercatoService.js` | Regole e stato degli scambi/prestiti. |
| `accountService.js`, `roleService.js` | Registrazione, approvazione degli account, ruolo Patron. |
| `themeService.js`, `themeElements.js`, `themePreview.js` | Temi grafici per competizione/utente (variabili CSS). |
| `notificationService.js`, `notificationCenter.js`, `pushService.js` | Notifiche nell'app e push (Firebase Messaging). |
| `kitAssets.js` | Disegni, marchi, patch e simboli PNG caricati dal Patron per l'editor della maglia. |
| `imageCutout.js` | Toglie lo sfondo uniforme dalle immagini (loghi). |
| `assetPreloader.js` | Scarica in anticipo le immagini (cache `fantacapp-images-v1`). |
| `backNav.js` | Tasto Indietro del telefono: chiude prima finestre e pannelli aperti. |
| `connectivity.js` | Stato online/offline. |
| `settingsService.js`, `favoritesService.js`, `staffService.js`, `palmaresService.js`, `playerStatsService.js`, `probabiliService.js` | Impostazioni, preferiti, staff, trofei vinti, statistiche, probabili formazioni. |

### Strumenti — `tools/`
`tools/kit3d/`: script Python/Node per i colletti delle maglie e i **render di prova** (`render/render.sh`), vedi
[tools/kit3d/README.md](../tools/kit3d/README.md).

## 3. Dati su Firebase (nodi principali)
| Nodo | Contenuto |
|---|---|
| `teams/{id}` | Squadra: nome, logo, rosa, `kit` e `kit2` (prima e seconda maglia), `captainBand`, `stadium`, staff... |
| `players/{id}` | Calciatori (nome, ruolo, squadra reale, quotazioni...). |
| `competitions/{id}` | Competizioni: `matches`, `status`, tema (`themeId`), sfondo, regole del formato. |
| `status/live`, `status/currentRealGW`, `status/regole` | Diretta attiva, giornata reale corrente, bonus/malus della lega. |
| `trades/{id}` | Scambi e prestiti del mercato. |
| `trophies` | Trofei (palmarès). |
| `themes/{id}` | Temi grafici creati dal Patron. |
| `users/{uid}` | Account: `role` (`patron`), `status` (pending/approved/rejected), squadra associata. |
| `settings/{uid}` | Impostazioni dell'utente. |
| `accountRequests`, `meta/patronExists` | Richieste di accesso e "c'è già un Patron". |
| `notifications`, `notificationTemplates` | Notifiche e modelli dei testi. |
| `kitAssets` | PNG per l'editor della maglia (disegni, marchi, patch, simboli). |

Lo stato in memoria è `window.STATE` (`user` = squadra dell'utente, `teams`, `players`, `votes`, `matches`,
`competitions`, `currentCompetition`, `live`, `settings`...). Quando cambiano i dati si chiama `refreshUI()`, che
aggiorna la pagina aperta e il pannello del menu (`MenuPanel.refresh`).

## 4. Avvio dell'app (index.html)
1. Schermata col logo, impostazioni e tema dalla cache del dispositivo (subito, anche offline).
2. `onAuthStateChanged`: senza login → schermata di accesso; account in attesa → messaggio; altrimenti scelta della
   squadra e avvio.
3. Sottoscrizioni (`watch` di `offlineStore`) a squadre, giocatori, temi, trofei, competizione corrente.
4. `goPage(start)`; con il live attivo si apre il live (stadio 3D compreso) prima di togliere il logo.
5. La libreria 3D si precarica dopo 2,5 s (`preloadStadium3D`), per live ed editor.

## 5. Stile e temi
- Colori e font sono **variabili CSS** (`:root` in `index.html`): `--bg`, `--bg2`, `--bg3`, `--card`, `--border`,
  `--text`, `--text2`, `--text3`, `--accent`, `--title`, `--label`, `--btn-primary`... I temi del Patron le
  ridefiniscono per pagina: **non scrivere colori fissi**, usa sempre le variabili (con un ripiego: `var(--title, var(--accent))`).
- Gli stili dei componenti sono iniettati da JS (`injectStyle()` con un `id`, una volta sola).
- Spazio per la barretta di iPhone: `var(--safe-b)` e `env(safe-area-inset-*)`.

## 6. Regole per lavorare (riassunto, il dettaglio è in CLAUDE.md)
- Italiano, frasi semplici. L'utente prova dal telefono e manda screenshot.
- Branch da `origin/main`; "crea pr e mergia" = merge di main nel branch, `CACHE_NAME` +1 sopra main, PR, merge.
- Ogni file statico nuovo → `sw.js`.
- Prima del commit: controllo sintassi con `node --check` (vedi CLAUDE.md), niente righe di debug, niente file di prova
  nella radice (`_test_*.html`, `_dump.html`).
- Maglie: **render da tutti i lati** prima di consegnare (`tools/kit3d/render/render.sh`).
- Testo dentro l'HTML: sempre con `esc(...)` se viene dagli utenti (nomi, scritte).

## 7. Controllo automatico del codice (facoltativo)
Non c'è un linter nel progetto. Per cercare variabili non definite o codice morto si può usare eslint in una cartella
temporanea (non nel repo):
```bash
mkdir -p /tmp/lint && cd /tmp/lint && npm init -y >/dev/null && npm i eslint@8.57.0 >/dev/null
cd - && /tmp/lint/node_modules/.bin/eslint --no-eslintrc --env browser,es2022 --parser-options=ecmaVersion:2023,sourceType:module \
  --rule '{"no-undef":"error","no-unused-vars":"warn","no-dupe-keys":"error","no-unreachable":"error"}' "js/**/*.js"
```
