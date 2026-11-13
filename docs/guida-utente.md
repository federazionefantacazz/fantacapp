# Guida per te (proprietario di FantaCapp)

Questa guida spiega in modo semplice com'è fatta l'app, come usare gli editor dal telefono e come chiedere le modifiche
a Claude. Per i dettagli tecnici ci sono gli altri documenti in `docs/` (vedi [README.md](README.md)).

## 1. L'app in due righe
- **FantaCapp** (`index.html`): l'app delle squadre. Barra in basso: Home, Calendario, Classifica, Formazione (Live
  durante la diretta), Mercato, Squadre. Menu laterale: Impostazioni, Configurazione squadra (logo, staff, **Divisa**,
  **Stadio**), Listone, Svincolati, Notifiche.
- **Area Patron** (`admin.html`): tu, come amministratore della lega: squadre, giocatori, voti, calendario,
  competizioni, regole, temi grafici, materiale per le divise, trofei, notifiche, approvazione degli account.
- I dati stanno su **Firebase**; le immagini caricate su **ImgBB**. L'app si installa sul telefono (PWA) e funziona
  anche senza rete con gli ultimi dati scaricati.

## 2. Gli editor (Divisa e Stadio) dal telefono
In alto resta sempre ferma l'**anteprima 3D**, con sotto *Annulla modifiche*, *Salva* e la **barra delle fasi**.

- **Barra delle fasi** (es. `1 Busto` `2 Stili` `3 Disegni` …): scorri col dito in orizzontale e tocca una fase per
  aprirla subito, senza tornare su a cercarla. La fase aperta è colorata.
- In fondo a ogni fase ci sono **‹ fase precedente** e **fase successiva ›**: puoi fare tutto il percorso in ordine
  solo con il pollice.
- **Zoom automatico**: quando apri una fase o tocchi una voce, l'anteprima si gira e si avvicina da sola alla parte
  che stai modificando:
  - maglia: colletto, spalle, maniche, polsini, petto, sponsor, retro, patch, fascia da capitano;
  - stadio: copertura, esterno, ingressi (dal lato dove li hai messi), campo e pista, spalti (seggiolini, scritte,
    parapetti, tifo).
- **Ruotare**: trascina col dito in orizzontale sull'anteprima. Il centro della rotazione è sempre il **centro** della
  maglia o dello stadio (anche dopo lo zoom sulla spalla).
- **Lente 🔍**: apre la vista grande, con zoom a due dita e rotazione libera.
- **Occhio 👁** (stadio): toglie la copertura per guardare dentro (solo anteprima, non si salva).
- Le modifiche si salvano **solo** col pulsante *Salva*. "Modifiche non salvate" ti ricorda che c'è qualcosa in sospeso.

## 3. Login
- Nella schermata di accesso c'è **"Password dimenticata?"**: scrivi la tua email e toccalo, arriva un'email con il
  link per sceglierne una nuova (guardare anche nello spam). Il testo dell'email si può cambiare dalla console di
  Firebase → Authentication → Templates.

## 4. Come chiedere modifiche a Claude
- Ogni nuova chat parte da zero: incolla all'inizio, per esempio,
  > Leggi `docs/README.md` e `docs/editor.md`. Poi: …
  Per le maglie: "leggi `docs/kit3d.md`"; per lo stadio: "leggi `docs/stadio3d.md`".
- Descrivi **cosa vedi** e **cosa vorresti** (meglio con uno screenshot dal telefono). Dì in quale schermata, fase o
  voce.
- Quando va bene scrivi **"crea pr e mergia"**: Claude unisce le modifiche su `main` e alza la versione della cache,
  così il telefono scarica l'aggiornamento.
- Dopo il merge, sul telefono: chiudi e riapri l'app (o accetta l'avviso "nuova versione"). Se non cambia nulla,
  aspetta un minuto (GitHub Pages pubblica con un piccolo ritardo) e riprova.

## 5. Cosa provare dopo un aggiornamento (2 minuti)
1. Accesso, Home, cambio pagina dalla barra in basso.
2. Formazione: apri la scelta di un giocatore e chiudila.
3. Menu → Configurazione squadra → Divisa: ruota la maglia, apri 2-3 fasi dalla barra, prova lo zoom sulle spalle.
4. Menu → Configurazione squadra → Stadio: apri *Copertura*, *Ingressi*, *Campo*: lo stadio deve girarsi da solo.
5. Se c'è il live: visuale stadio e ritorno alle colonne.

## 6. Dove sono le cose (se vuoi curiosare)
| Cosa | File |
|---|---|
| Pagine dell'app | `js/home.js`, `js/calendario.js`, `js/classifica.js`, `js/formazione.js`, `js/liveMatch.js`, `js/mercato.js`, `js/teams.js` |
| Editor della divisa | `js/menu/DivisaSquadra.js` (+ `js/components/Kit3D.js`, `KitRenderer.js`) |
| Editor dello stadio | `js/menu/StadioSquadra.js` (+ `js/components/Stadium3D.js`) |
| Area Patron | `admin.html` + `js/admin/` |
| Versione della cache (aggiornamenti) | `sw.js`, riga `CACHE_NAME` |
| Bug noti e idee | [bug-e-idee.md](bug-e-idee.md) |
