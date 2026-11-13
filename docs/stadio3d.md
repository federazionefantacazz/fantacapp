# Stadio 3D (`js/components/Stadium3D.js`)

Lo stadio è costruito **tutto via codice** con three.js (nessun modello da scaricare). Il file è molto lungo (circa
9.700 righe): qui c'è la mappa per orientarsi. L'editor che lo usa è `js/menu/StadioSquadra.js` (vedi
[editor.md](editor.md)).

## 1. Coordinate e misure
- Metri. Il campo (`PITCH = { l: 105, w: 68 }`) è al centro, **lato lungo sull'asse x**, y in alto.
- Lati (`entranceSides`, `SEAT_SIDES`): `0` = tribuna vicina (+z), `1` = curva destra (+x), `2` = tribuna di fronte
  (−z), `3` = curva sinistra (−x). Nella camera (`Spherical.theta`): 0° guarda dal lato 0, 90° dal lato 1, ecc.

## 2. Dati (`team.stadium`)
- `DEFAULT` (riga ~348) = tutti i campi con il valore iniziale. `normalizeStadium(s)` porta qualsiasi oggetto salvato
  (anche vecchio) a un oggetto completo e valido: **ogni campo nuovo va aggiunto in `DEFAULT` e in `normalizeStadium`**.
- `PRESETS` + `applyPreset(st, id)`: stili rapidi (il nome resta quello dell'utente).
- Liste delle scelte esportate per l'editor: `RINGS`, `SHAPES`, `CORNERS`, `ROOFS`, `FACADES`, `LIGHTS`, `ENTRANCES`,
  `TEXT_FONTS`, `SCREENS`, `FLAG_PATTERNS`... (in cima al file, ognuna `{ id, label, desc? }`).
- Al salvataggio l'editor aggiunge `image` (foto PNG su ImgBB, da `renderStadiumImage`) e `capacity`.
- `stadiumCapacity(st)` conta i seggiolini veri; `shownCapacity(st)` usa `capacityCustom` se l'utente l'ha scritta.

## 3. Costruzione
- `buildStadium(L, st)` (riga ~8000) crea il gruppo three.js e restituisce un oggetto `built` con: `group`, `ext`
  (ingombro), `height`, `shape`, `capacity`, e i metodi `recolor(st)`, `setLogo`, `setEntranceImage`, `setCubeImage`,
  `setScreenImages`, `setScreenLogos`, `setNight`, `setExterior`, `setCrowd`, `tick(t)`, `cutMaterial`, `dispose`.
- **Ricostruzione solo quando serve**: `geomKey(st)` mette insieme tutti i campi che cambiano la geometria. Se la chiave
  non cambia, `Stage.setStadium` chiama solo `recolor` (colori, scritte...): veloce anche trascinando un colore.
  **Un campo nuovo che cambia la forma va aggiunto a `geomKey`** (o a `seatKey` se cambia gli spalti), altrimenti lo
  stadio non si aggiorna.
- Pezzi principali (funzioni `...Of` / `...Geometry`): `shapeOf` (pianta degli spalti), `tierProfile`, `standsGeometry`,
  `seatsOf` / `seatGeometry` (seggiolini, capienza), `paintPitch` (erba, righe), `trackRing` (pista), `roofOf` e le
  coperture speciali (`dragonOf`, `bladesOf`, `retractOf`, `slidingOpening`...), `entrancesOf` (ingressi), facciate
  (`CLAD_*`, `CURTAIN_*`, `ESPLANADE_*`), `logoSpots` (dove va il logo), tifosi (`crowdAtlas`, `flagCanvas`).

## 4. Visualizzazione (`class Stage`, riga ~9080)
- `createStadiumViewer(container, { zoom })` → `{ ready, update(st, { logo }), setView(v), focus(v, yaw), setNight,
  setExterior, zoomBy, framePitch, setMarkers, setScreenLogos, setCrowd, onFrame, dispose }`.
  - `zoom: false` (anteprima dell'editor): si gira solo in orizzontale, il dito in verticale scorre la pagina.
  - `zoom: true` (finestra a tutto schermo `openStadiumOverlay`): rotazione libera, zoom con due dita, spostamento.
- **Viste** (`VIEWS`: `[yaw, polar, distanza]`): `aerial`, `top`, `stand`, `outside` (pulsanti: `STADIUM_VIEWS`) e
  quelle delle parti per l'editor, senza pulsante: `pitch` (campo da vicino), `roof` (copertura).
- `setView(name, yaw)`: posizione esatta. `focus(name, yaw)`: **stesso punto d'arrivo con un movimento morbido**
  (650 ms); il dito che tocca lo stadio ferma il movimento. Il punto guardato resta **sempre sull'asse dello stadio**
  (x = z = 0): ruotando col dito lo stadio gira intorno al suo centro. `yaw` serve per guardare un lato preciso
  (es. l'ingresso) e resta anche quando lo stadio si ricostruisce (`viewYaw`).
- Se `focus` arriva prima che lo stadio sia costruito, viene applicato appena è pronto (`pendingFocus`).
- `framePitch(opts)`: vista del live (campo che riempie lo schermo, anche inclinato con `tilt`).
- Risoluzione più bassa mentre si gira (fluido sui telefoni), poi di nuovo piena; ombre ricalcolate solo quando cambia
  qualcosa (`shadowMap.autoUpdate = false`).
- `visibleAt(x, y, z)`: per le etichette del live (nascoste se dietro il tetto o uno spalto).
- `dispose()` libera anche il contesto WebGL (`forceContextLoss`): i telefoni ne tengono pochi.

## 5. Foto
`renderStadiumImage(st, opts)` → data URL PNG (anteprima nella scheda del club e nel resto dell'app).

## 6. Prova veloce senza telefono
Una pagina di prova nella radice (`_test_std.html`, **da cancellare prima del commit**) che importa
`./js/components/Stadium3D.js`, crea `createStadiumViewer` su un `div` di 600×600, chiama `update(...)`, poi
`focus(...)` e salva `canvas.toDataURL()`; si apre con Playwright come in `tools/kit3d/render/launch.js` (stesso
server su `localhost:8765`, stesso Firebase finto). Con SwiftShader ogni immagine richiede qualche secondo.
