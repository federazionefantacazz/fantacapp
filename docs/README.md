# Documentazione di FantaCapp

Indice dei documenti. Servono sia a te (per sapere cosa c'è e cosa chiedere) sia a Claude (per lavorare bene in ogni
nuova chat senza dover rileggere tutto il codice).

| Documento | Per chi | Cosa contiene |
|---|---|---|
| [guida-utente.md](guida-utente.md) | **te** | Come è fatta l'app, come usare gli editor dal telefono, come chiedere modifiche a Claude, cosa provare dopo ogni aggiornamento. |
| [architettura.md](architettura.md) | Claude (e te, se vuoi capire) | Struttura del codice, file per file, dati su Firebase, avvio, PWA e cache, regole per lavorare. |
| [editor.md](editor.md) | Claude | Editor della maglia e dello stadio: fasi, barra delle fasi, inquadrature automatiche (zoom sulle parti), come aggiungere una fase o una voce. |
| [stadio3d.md](stadio3d.md) | Claude | Come è costruito lo stadio 3D (`Stadium3D.js`, quasi 10.000 righe): dati, costruzione, viste, live. |
| [kit3d.md](kit3d.md) | Claude | Maglie 3D: modelli, colletti, bordini, lezioni imparate. **Da leggere prima di toccare la maglia.** |
| [bug-e-idee.md](bug-e-idee.md) | entrambi | Bug trovati e corretti, problemi noti ancora aperti, funzioni che mancano (idee da fare). |

## Come usarli in una nuova chat con Claude
Scrivi all'inizio, per esempio:

> Leggi `docs/README.md` e `docs/editor.md`, poi: nell'editor dello stadio vorrei …

Così Claude parte già sapendo dove mettere le mani. Per le maglie: "leggi `docs/kit3d.md`".

## Tenerli aggiornati
Ogni volta che si cambia qualcosa di importante (una nuova fase dell'editor, un nuovo nodo su Firebase, una nuova regola),
Claude aggiorna anche il documento giusto nello stesso commit.
