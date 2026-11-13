# Editor della maglia e dello stadio

Due editor con la stessa struttura, pensati per il telefono:
- **Divisa squadra** → `js/menu/DivisaSquadra.js` (maglia 3D: `Kit3D.js` + `KitRenderer.js`, vedi [kit3d.md](kit3d.md));
- **Stadio** → `js/menu/StadioSquadra.js` (stadio 3D: `Stadium3D.js`, vedi [stadio3d.md](stadio3d.md)).

Lo stile comune (`.kit-stage`, `.kit-acc`, `.kd-phases`, colori, cursori...) è in `injectStyle()` di
`DivisaSquadra.js`; l'editor dello stadio lo riusa e aggiunge il suo (`injectStadiumStyle`, classi `.std-*`).

## 1. Com'è fatta la schermata
```
┌ .kit-stage (sticky: resta in alto mentre si scorre) ─────────┐
│  [Prima maglia] [Seconda maglia]       (solo divisa)         │
│  ┌ anteprima 3D ─────────────────────── [🔍] [👁] ┐          │
│  │  trascina per ruotare                          │          │
│  └────────────────────── [Davanti][Retro] ────────┘          │
│  Modifiche non salvate                                       │
│  [Annulla modifiche]  [Salva]                                │
│  [1 Busto][2 Stili][3 Disegni][4 Sponsor] …  ← barra fasi   │
└──────────────────────────────────────────────────────────────┘
 ▸ FASE 1: …   (accordion .kit-acc, una sola fase aperta)
   … voci …
   [‹ Fase precedente]            [Fase successiva ›]
 ▸ FASE 2: …
```
- **Una fase aperta alla volta** (`this._open`); `_renderSection()` disegna solo quella (le altre restano vuote: più
  veloce) e aggiunge in fondo i pulsanti *precedente/successiva* (`phaseNav`).
- **Barra delle fasi** (`phaseStrip` / `syncPhaseStrip`, esportate da `DivisaSquadra.js`): scorre in orizzontale
  sotto i pulsanti di salvataggio, sempre visibile; un tocco apre la fase (azione `data-act="phase"`, che a differenza
  di `toggle` non chiude la fase già aperta) e la porta subito sotto l'anteprima (`_scrollToOpen`).
- Con una fase aperta l'anteprima si abbassa (`.has-open .kit-preview`), per lasciare spazio alle scelte.
- Le fasi sono nella costante `SECTIONS` in cima a ogni editor: `[chiave, titolo lungo, nome corto, (inquadratura)]`.

## 2. Zoom automatico sulle parti (inquadrature)
L'anteprima 3D si gira da sola verso la parte che si sta modificando.

### Maglia (`FOCUS` in `Kit3D.js`)
- Ogni fase ha la sua inquadratura: `SEC_FOCUS` in `DivisaSquadra.js` (es. `sponsor` → `sponsor`, `patches` →
  `sleevePatch`).
- Dentro una fase, ogni gruppo di scelte ha `data-focus="..."` (helper `_group(title, focus, body)`): toccandolo la
  maglia inquadra quella parte (`_onPointerDown` → `_focusTo`). Colori: `COLOR_FOCUS`; livelli: `ZONE_FOCUS`;
  patch: `PATCH_FOCUS`.
- `FOCUS[name] = { yaw (gradi: 0 davanti, 180 dietro, negativo = lato sinistro), y (altezza, frazione della maglia),
  d (distanza: 1 = maglia intera, 0,5 = metà), pitch (gradi dall'alto) }`.
- **Il centro della rotazione è sempre l'asse della maglia**: `Stage.focus` usa solo `y` per il punto guardato (x e z
  non si usano più). Per guardare una spalla o una manica si **gira** la maglia (`yaw`) e ci si avvicina (`d`), non si
  sposta il centro: prima il centro finiva sulla spalla e, girando col dito, la maglia ruotava intorno alla spalla e
  usciva dallo schermo.

### Stadio (`focus` in `Stadium3D.js`)
- Ogni fase ha la sua inquadratura (4ª colonna di `SECTIONS` in `StadioSquadra.js`): `aerial` (nome, stili, anelli),
  `roof` (copertura), `outside` (esterno), `entrance` (ingressi: si guarda dal primo lato che ha un ingresso,
  `_entranceFocus` → `'outside@90'`), `pitch` (campo), `stand` (seggiolini, scritte, parapetti, tifo).
- **Dentro una fase**: toccando una voce si guarda il suo titolo (`.kit-sub` sopra il punto toccato) e la tabella
  `SUB_FOCUS` (espressioni regolari sul titolo → inquadratura) sceglie la parte. Es. in "Anelli, curve e pista" la
  voce *Pista d'atletica* inquadra il campo; in "Scritte e logo" *Scritta sull'esterno* inquadra l'esterno. Se nessuna
  regola corrisponde resta l'inquadratura della fase.
- I pulsanti *Aerea / Dall'alto / Tribuna / Esterno* usano anche loro `focus` (movimento morbido).
- Il punto guardato resta sull'asse dello stadio (come per la maglia).

## 3. Aggiungere una fase
1. Nuova riga in `SECTIONS` (chiave, titolo "FASE n: …", nome corto; per lo stadio anche l'inquadratura).
2. Nuovo metodo `_secXxx()` che restituisce l'HTML della fase e la voce nella mappa `fn` di `_renderSection`.
3. Maglia: inquadratura in `SEC_FOCUS`. Stadio: eventuali regole in `SUB_FOCUS`.
4. Controllare che la barra delle fasi non diventi troppo lunga (nomi corti di una parola).

## 4. Aggiungere una voce dentro una fase
- **Maglia**: usare gli helper (`_group`, `_opt`, `_chip`, `_seg`, `_range` con − e +, `_step`, `_colorPicker`,
  `_modal`, `_nav`). Cambiare i dati sempre con `this._update(kit => { ... })` (aggiorna anteprima e sezione).
- **Stadio**: `_chip`, `_opts` (griglia a 2 colonne), `_seg`, `_range`, `_colorRow`; un titolo `<div class="kit-sub">`
  sopra ogni voce (serve anche per lo zoom automatico). Dati con `this._update(st => { ... })` o `this._set(path, v)`.
- Campo nuovo nei dati: `normalizeKit` (KitRenderer.js) o `DEFAULT` + `normalizeStadium` (Stadium3D.js); per lo stadio,
  se cambia la forma, anche in `geomKey`.
- Testi degli utenti dentro l'HTML sempre con `esc(...)`.

## 5. Salvataggio
- Maglia: `team.kit` / `team.kit2` (+ `captainBand`). Foto PNG generata con `renderKitImage` e caricata su ImgBB
  (`kit.image`), usata in tutta l'app.
- Stadio: `team.stadium` con `image` (foto da `renderStadiumImage`) e `capacity`.
- "Modifiche non salvate": confronto JSON con l'ultimo salvato (`_saved`).

## 6. Prova dal computer (senza telefono)
Una pagina temporanea `_test_editor.html` nella radice (da cancellare prima del commit) che:
1. copia gli `<style>` di `index.html` (le variabili dei colori) con `fetch('index.html')`;
2. imposta `window.STATE = { user: { id: 'x', name: 'Prova' } }` e `window.showToast = () => {}`;
3. `MenuPanel.open(DivisaSquadra, 'kit')` (o `StadioSquadra`);

poi Playwright con viewport da telefono (390×844) e Firebase finto come in `tools/kit3d/render/launch.js`.
