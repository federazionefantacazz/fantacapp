# Bug, problemi noti e idee

Elenco aggiornato a ogni giro di controllo. Quando si corregge qualcosa, spostarlo in "Corretti" con la data.

## Corretti (novembre 2026)
| Dove | Problema | Correzione |
|---|---|---|
| Editor divisa | Zoom sulle spalle/maniche: il centro della rotazione finiva sulla spalla; girando col dito la maglia ruotava intorno alla spalla e usciva dallo schermo. | `Stage.focus` (Kit3D.js) tiene il punto guardato sull'asse della maglia (cambia solo l'altezza); le inquadrature di lato (`shoulder`, `sleeve`, `sleeveR`, `sleevePatch`, `bandArm`, `cuff`) girano la maglia invece di spostare il centro. |
| Editor divisa e stadio | Tasto Indietro del telefono con la vista grande (lente) aperta: si chiudeva **tutto l'editor**, perdendo le modifiche non salvate. | La vista grande entra nella pila di `BackNav` (`kit-zoom`, `stadium-zoom`): Indietro chiude solo lei. |
| Editor divisa e stadio | Uscendo dall'editor (freccia o Indietro) con modifiche non salvate, si perdevano senza avviso. | `confirmClose()` negli editor, chiamato da `MenuPanel.close`: chiede "Uscire senza salvare?". La divisa controlla anche la bozza dell'altra maglia. |
| Menu | Da Configurazione squadra → Divisa/Stadio, Indietro chiudeva tutto e tornava all'app. | `MenuPanel.open(view, name, { stack: true })`: Indietro torna a Configurazione squadra (anche Notifiche → Impostazioni). `close({ all: true })` chiude comunque tutto (notifiche, anteprima dei temi). |
| Editor stadio | Riaprendo l'editor una seconda volta, i maxischermi restavano senza il logo della squadra. | Le chiavi `_scrLogoKey` / `_crowdKey` si azzerano in `unmount` (il visore nuovo non li aveva ancora). |
| Login | Mancava "Password dimenticata?". | Link sotto "Accedi" con `sendPasswordResetEmail` (stesso messaggio anche se l'email non esiste). |
| Strumenti | `tools/kit3d/render/launch.js`: il Firebase finto non aveva `sendPasswordResetEmail` (i render si bloccavano). | Aggiunto. |
| Stadium3D.js | Il commento in cima diceva "l'esterno non si disegna" (non più vero). | Aggiornato, con il rimando a `docs/stadio3d.md`. |

## Migliorie fatte agli editor (novembre 2026)
- **Barra delle fasi** sempre visibile sotto l'anteprima e pulsanti *fase precedente / successiva* in fondo a ogni fase
  (divisa e stadio). Vedi [editor.md](editor.md).
- **Zoom automatico nello stadio** come nella maglia: ogni fase e ogni voce inquadra la sua parte (copertura, esterno,
  ingressi dal lato giusto, campo, spalti), con movimento morbido.
- La **vista grande** (lente) si apre sulla parte che si stava modificando, sia per la maglia sia per lo stadio.

## Da tenere d'occhio (non corretti)
- **Chiave ImgBB nel codice** (`js/services/integrationImgBB.js`): chiunque legga il sito può usarla per caricare
  immagini sul tuo account ImgBB. Non è grave (non dà accesso ai dati), ma se un giorno serve si può spostare il
  caricamento dietro una funzione server (Firebase Functions).
- **Regole di sicurezza di Firebase**: non sono nel repo, quindi non si possono controllare da qui. Verificare dalla
  console che un utente possa scrivere solo `teams/{la sua squadra}`, `settings/{il suo uid}` ecc., e che solo il
  Patron possa scrivere voti, calendario, regole e squadre degli altri.
- Il calcolo della squadra (`calcolaDettaglioSquadra`) usa la panchina come titolari se manca `titolari`: va bene per
  le formazioni vecchie, ma è un comportamento poco ovvio.
- Codice non usato segnalato da eslint (variabili inutilizzate in `Stadium3D.js`, `calendario-ui.js`, `players.js`):
  innocuo, si può pulire con calma.

## Idee: funzioni che un'app così di solito ha
In ordine di utilità (secondo me):
1. **Scadenza della formazione con conto alla rovescia** e notifica push automatica ("mancano 2 ore e non hai
   schierato la formazione"). Oggi la formazione si blocca solo quando parte il live.
2. **Account**: cambio password ed email dalle Impostazioni, **eliminazione dell'account** (richiesta da Google Play /
   App Store e dal GDPR) e una pagina **Privacy** con cosa si salva.
3. **Condividi**: pulsante per mandare su WhatsApp l'immagine della maglia, dello stadio, del risultato del live o
   della classifica (`navigator.share` con l'immagine PNG che l'app già genera).
4. **Backup dei dati** dall'area Patron (scarica un file JSON di tutto il database) e ripristino.
5. **Storico e statistiche della squadra**: punti per giornata in un grafico, miglior giocatore, record della lega.
6. **Chat o bacheca della lega** (anche solo messaggi del Patron con commenti), oppure link al gruppo WhatsApp.
7. **Ricerca globale** (squadre, giocatori) dall'intestazione.
8. **Modalità chiara/scura automatica** in base al telefono (oggi i temi sono scelti dal Patron o dall'utente).
9. **Annulla/ripeti** negli editor (oltre ad "Annulla modifiche" che torna all'ultimo salvataggio).
10. **Accessibilità**: dimensione del testo regolabile nelle Impostazioni.
