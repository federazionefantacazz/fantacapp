# Maglie 3D: come sono fatte

Guida per chi deve modificare l'editor delle maglie (Divisa squadra), con le scelte fatte e le lezioni imparate.
Script e render: [tools/kit3d/README.md](../tools/kit3d/README.md).

## 1. I file del codice

| File | Cosa fa |
|---|---|
| `js/components/Kit3D.js` | Scena three.js: carica i modelli, costruisce le varianti (forma del colletto), colletto grosso, bordino 3D, fascia da capitano 3D, foto PNG per Formazione e Live. Classe `Stage`, `createKitViewer`, `kitShot`, `FOCUS`. |
| `js/components/KitRenderer.js` | Dipinge la texture UV della maglia: colori dei pezzi, livelli/disegni, colletto (righe, bicolore), polsini, strisce delle maniche, loghi, sponsor, nome e numero, patch. `normalizeKit`, `paintKitTexture`, `KIT3D_FILES`, `UV`, `UV_RAGLAN`, `MODELS`. |
| `js/components/kitShapes.js` | `COLLAR_SHAPES` (crew, v, polo) e `isDeformed(shape, raglan)`: quali combinazioni richiedono una variante del modello. |
| `js/menu/DivisaSquadra.js` | Editor: fasi, opzioni, cursori con − e +, livelli, patch, fascia da capitano. |
| `js/components/CaptainBand.js` | Disegno della fascia da capitano. |
| `icons/kit3d/` | Modelli `.glb`, maschere, cuciture e i file generati dagli script (`.bin`, `neck-bands.json`). Tutti elencati in `sw.js`. |

## 2. I due modelli

### Classica (`sleeveCut: 'setin'`, `shirt.glb`, compresso meshopt)
- Pezzi: davanti `42_1` (fuori, `shirt_outer`) e `42_2` (dentro, `shirt_inner`), dietro `9_1`/`9_2`, maniche `38_*` e `62_*`.
- Costina a V `Pattern2D_3805002` (`_1` fuori, `_2` dentro): è lo scollo **originale** della classica.
- La stoffa di dentro è uno strato separato.
- UV in `UV` (KitRenderer.js); riquadro della costina `UV.collar`. La faccia visibile della costina a V è solo la **metà bassa** del riquadro (v da 0,55 a 1), mentre la metà alta è il lato interno ripiegato.

### Raglan (`sleeveCut: 'raglan'`, `shirt-raglan.glb`)
- Pezzi `sleeveR`, `front`, `sleeveL`, `back`, più la costina `collar` (nodo `raglan_collar`). Ognuno ha una copia `_1` con materiale `shirt_inner_flip` e **la stessa geometria**: l'interno è il rovescio della stessa superficie (BackSide), non c'è uno strato interno separato.
- Le maniche arrivano fino al collo: lo scollo tocca 4 pezzi.
- Girocollo = scollo **originale** della raglan. Il riquadro UV della costina (`UV_RAGLAN.collar`) è tutto faccia esterna, con v = 0 in alto e v = 1 in basso.
- Nel modello originale ci sono fessure di circa 0,5 mm lungo le cuciture raglan e qualche triangolino girato verso l'interno vicino al collo (davanti a ±75°, dietro a ±142°). Da dentro si vedono come segnetti azzurri.

Coordinate: metri. Asse del collo a x = 0, z = 0, y in alto, z davanti. Gli script lavorano in coordinate cilindriche: angolo `a` (0 = davanti, ±180 = dietro), altezza `y`, raggio `r`.

## 3. Varianti (forma del colletto × cucitura)

`loadVariant(kit)` in Kit3D.js. La chiave è `setin:`/`raglan:` + forma + `:big` (colletto grosso). Le varianti si costruiscono una volta sola e restano in cache.

| Maglia | Girocollo (`crew`) | Scollo a V (`v`) | Colletto alto (`polo`) |
|---|---|---|---|
| Classica | **scambiata**: costina della raglan con `CREW_FIT` + `neck-crew-setin.bin` | originale | `collar-polo.glb` + `neck-polo.bin` |
| Raglan | originale | **scambiata**: costina a V della classica con `V_FIT` + `neck-v-raglan.bin` + `neck-cutv-raglan.bin` | `collar-polo-raglan.glb` + `neck-polo-raglan.bin` + `neck-cut-raglan.bin` |

`kit.neckV = 2` indica le raglan con la V nuova (quelle salvate prima con `'v'` avevano il girocollo, vedi `normalizeKit`).

### Costina scambiata (il metodo che funziona)
L'utente vuole il colletto con la sua forma pulita e originale, non deformato, e la maglia deformata il meno possibile. Per questo:
1. La costina dell'altra maglia si clona e si mette **rigida**, con trasformazione affine: spostamento, inclinazione, scala e allargamento x/z.
   - `CREW_FIT = { pivot:[0,1.58,0], dy, dz, tilt, sx, sz }`: matrice `T(pivot+dy,dz) · S(sx,1,sz) · Rx(tilt) · T(-pivot)`.
   - `V_FIT = { pivot:[0,1.52,0], dy, dz, tilt, scale, sx, sz }`: matrice `T(pivot+dy,dz) · S(sx,1,sz) · Rx(tilt) · S(scale) · T(-pivot)`.
   - La stoffa intorno al collo scende insieme alla costina (`warp_fab` in `raglan_v2.py`, stesso spostamento di `V_BEND`, che si spegne 4 cm sotto): tutti i pezzi si muovono allo stesso modo e le cuciture restano chiuse. Dietro la stoffa **non si taglia** (si tagliava sopra la costina abbassata, e lungo la cucitura dietro la spalla si apriva un buco). I triangolini rimasti girati verso dentro non si tolgono più (lasciavano un buco): si distendono e, se serve, si schiacciano.
   - Poi `V_BEND` (`bendRib` in Kit3D.js, `v_bend` in neckmorph.py): la raglan ha il collo dietro 14 mm sopra la spalla (la classica 7 mm) e la V sembrava rialzata. Dietro la costina scende di 5 mm, solo in verticale e appena in fuori (+0,5 mm di raggio per mm), con un passaggio graduale da 90 a 150 gradi. 
   - **Non** abbassare il dietro cambiando l'adattamento rigido (`vfit3.py` con DROP): la costina si inclina e dietro sembra una tesa piatta.
   - I parametri si trovano con un'ottimizzazione (`tools/kit3d/vfit3.py`). Ai lati e dietro il bordo basso della costina deve combaciare con lo scollo originale; davanti deve stare sul petto e non dentro.
2. `remapUV` porta le UV della costina nel riquadro del colletto di questa maglia. Il nodo è marcato `userData.swappedRib`. Il suo rovescio (`ribInnerMats`) ha il colore del colletto × 0,8 e niente texture: così non resta una riga scura sotto il bordo.
3. La stoffa si sposta (file NKP1) e, se serve, si taglia (file NKC1) in modo che il suo bordo vada **esattamente** su una linea pulita appena sotto la costina: 0,6 mm sopra il fondo e 1,3 mm dentro. Vedi `setin_crew.py` e `raglan_v2.py`.

### Formati binari (letti da `applyShift` / `applyCut`)
- **NKP1** (spostamenti): `"NKP1"`, uint16 numero di mesh, poi per ogni mesh uint32 n, n × uint32 indici dei vertici, n × 3 × int16 spostamenti in unità di 1/20000 m.
- **NKC1** (taglio): `"NKC1"`, uint16 numero di mesh, poi per ogni mesh uint32 n e n × uint32 indici dei triangoli da togliere.
- Le mesh sono nell'ordine di `geo.json` (il traverse del GLTFLoader). Per la raglan, spostamenti e tagli sono uguali per il pezzo e la sua copia `_1`.

## 4. Rifiniture del colletto (`kit.collar`)
`COLLARS` in KitRenderer.js: `plain` (Semplice), `twotone` (Bicolore), `striped` (Con righe), `trim` (Con bordino). Il vecchio `'wide'` (bordo largo) è stato tolto: `normalizeKit` lo trasforma in `'trim'`.

- **Righe** (`kit.collarStripes` = 1, 2 o 3, predefinito 3): fasce disegnate nella texture della costina, dentro la sua faccia visibile.
  - Costina della raglan: tutto il riquadro, `[v0, v1] = [0, 1]`.
  - Costina a V della classica: `[.55, 1]`.
  - Il codice sceglie la costina con `ribIsRaglan = raglan !== swapped`.
  - Posizioni (frazioni della faccia visibile): 1 riga `[.43, .14]`; 2 righe `[.31,.11]`, `[.58,.11]`; 3 righe `[.27,.09]`, `[.455,.09]`, `[.64,.09]`.
  - Guardando dall'alto, ai lati si vede anche il rovescio rigato della costina: è normale, non è una riga in più.
- **Bordino** (`trim`): fascia di 5 mm nel colore `colors.trim` sulla stoffa, subito sotto la costina.
  - Su **classica girocollo, raglan girocollo e raglan V** è una **fascetta 3D** (`buildNeckTrim` in Kit3D.js), creata in `Stage.setModel` e accesa o spenta in `applyKit`.
    - Dati in `neck-bands.json` → `{ 'setin:crew': { rows: 4, pts: [...] }, ... }`: campioni intorno al collo × 4 file di punti.
    - Una fila sulla costina + 4 sulla stoffa, un campione ogni grado (0,25° sulla punta della V).
    - **Fascia regolare**: dal fondo della costina (lisciato) si scende *sulla stoffa*, perpendicolarmente al collo, a passi di 0,5 mm (file a 1, 2, 3,5 e 5 mm). Prima la linea bassa era un'isolinea calcolata a parte e la larghezza andava da 4 a 7 mm: sembrava ondulata.
    - La fila sulla costina usa il raggio vero della sua faccia esterna a quell'altezza, + 0,8 mm. La costina della V ai lati è inclinata e svasata: col raggio del fondo usciva davanti alla fascetta a zig-zag. Le file vicine alla costina vengono spinte fuori dove la costina le bucherebbe (al centro davanti della classica girocollo il fondo si piega in fuori: puntino bianco).
    - **Girocolli e raglan V (`setin:crew`, `raglan:base`, `raglan:v`)**, stesso metodo (TUCK in `neck_bands.py`; per la V il bordo basso viene da tutti i bordi della costina a V, fatta di più pezzi): la fascetta *non* si sovrappone alla costina, perché le due superfici si incrociavano e il bordo bianco veniva seghettato. La prima fila sta esattamente sul bordo basso vero della costina (la polilinea del modello, senza i punti della sua cucitura verticale a −82°), 0,15 mm **fuori** (dentro la costina la striscia si vedeva da dentro il collo). Così si vede il bordo pulito della costina e subito il verde. Le file sulla stoffa sono a 0, 2, 4 e 6 mm dal punto sotto quel bordo e staccate 1,2 mm (sulla spalla la stoffa fa pieghe). Il verso dei triangoli in `buildNeckTrim` si decide con la prima e l'ultima fila.
    - Sulla punta della V si scende dritti in giù (le due metà si incrociavano: piega scura).
    - Normali per colonna, prese dalla stoffa: luce uniforme su tutta la larghezza, senza riflesso sulla piega costina/stoffa.
    - La prima fila sta 2 mm sopra il fondo vero della costina, su una curva ben lisciata (15 passate, non sulla punta della V), così copre anche le tacche della costina (al centro dietro, 1,5 mm) e non resta mai una fessura. Le altre sono proiettate sulla superficie della stoffa e staccate 0,6 mm verso fuori.
    - Camera: piano vicino `dist × 0,04` (non 0,01 m): sui telefoni la profondità è meno precisa e la stoffa bucava la fascetta con delle seghettature.
    - Niente `polygonOffset`: guardando dentro il collo di sbieco tirava la fascetta davanti alla stoffa. FrontSide, con i triangoli girati verso fuori.
    - La chiave della variante sta in `model.userData.neckKey`.
  - Sulla **classica con la V** (scollo originale) è disegnato nella texture (`neck-bands.json` → `{ 'setin:base': { tex: [{ part, top, bot }] } }`, contorno UV del bordo della stoffa e della linea a 5 mm). Lì la stoffa sotto la costina ha pieghe e la fascetta 3D non si appoggiava bene; il disegno invece viene pulito.
  - Perché non tutto nella texture: dove la stoffa è stirata o compressa (classica girocollo al centro davanti, raglan V nel taglio) il bordo dipinto si sfrangia, perché a 5 mm corrispondono pochi texel.
- **Colletto grosso** (`kit.collarBig`, pulsante "Colletto grosso" sotto le forme; non vale per `polo`):
  - La costina della variante si allunga verso l'alto dal suo bordo basso: `growRib`, `BIG_RIB = { crew: 1.45, v: 2.0 }`.
  - Per ogni angolo il punto si allontana dal bordo basso di k volte, in altezza e raggio. I primi `BIG_KEEP` = 1,5 mm (in altezza) restano fermi, perché il bordo è cucito alla stoffa.
  - Il bordo basso si stima con 360 spicchi di 1°: minimo su ±2 spicchi, poi 40 passate di lisciatura (circa ±5°). Con spicchi larghi la costina sale ai lati della V e lascia una fessura. Senza minimo sui vicini, alcuni spicchi contengono solo punti alti e il bordo alto viene seghettato. Con poca lisciatura, ogni ondina del bordo basso si vede raddoppiata sul bordo interno della V e dietro al centro.
  - L'allungamento usa l'**altezza** sopra il bordo basso stimato, non la distanza: chi sta sotto (vicino alla punta della V, dove la lisciatura alza il bordo stimato) o nel primo millimetro e mezzo resta fermo.
  - La stoffa non cambia, quindi bordino e `neck-bands.json` sono quelli della variante normale.

## 5. Altro nell'editor (in breve)
- **Colori**: sotto ogni pezzo (busto, maniche, colletto, polsini). La vecchia fase "colori" è stata tolta.
- **Disegni a livelli**: `MOTIFS` e forme `MOTIF_SHAPES` (fino a 1000, anche simboli PNG di patron o utente, "riempi tutta la maglia"), duplicazione dei livelli, − e + su ogni cursore (`_range`, `_step`).
- **Patch**:
  - la patch della **competizione** va sulla manica sinistra, automatica nel Live in base alla competizione (`opts.compPatches`);
  - le patch **campione** hanno posizione, dimensione e x/y (non sulla manica sinistra).
- **Fascia da capitano**: modello 3D vero, da sola o indossata sulla manica sinistra sotto la patch (`setArmband`, `_bandRing`, `_sleeveRing`, `_wornBand`, `BAND_RING_ASPECT`). Ha livelli, immagini, "C" personalizzabile e si sceglie chi la porta in Formazione e Live.
- **Inquadrature** `FOCUS` in Kit3D.js (`collar`, `shoulder`, `sleevePatch`, `bandArm`, ...); `focus()` accetta anche `pitch`.
  Il punto guardato resta **sempre sull'asse della maglia** (si usa solo `y`): per le parti di lato si gira la maglia
  (`yaw`) e ci si avvicina (`d`). Con `x`/`z` il centro della rotazione finiva sulla spalla (vedi [editor.md](editor.md)).

- **Spalle colorate sulla classica** (`shoulders.shape` raglan / sella): partono dall'angolo del colletto spostato verso il centro del 6% (`NECK_IN` in KitRenderer.js). L'angolo misurato sulla maschera è più esterno della stoffa che sale fino al colletto (soprattutto col girocollo), e lì restavano triangolini del colore del busto.

## 6. Lezioni imparate (cosa NON rifare)
- **Deformare la costina** per farle prendere la forma dell'altro scollo: l'utente la vuole come nel modello originale. Va messa rigida e si muove la stoffa.
- **Bordo della stoffa con spostamento relativo** o con i punti delle cuciture delle spalle presi come collo: viene ondulato. Ogni punto del bordo va **esattamente** sulla linea (`target - P`); il collo si riconosce per vicinanza alla costina originale (`on_neck`, ≤ 2,5 mm, non 4 mm, se no si prendono punti delle cuciture).
- **Pezzi risolti separatamente**: la cucitura della spalla non arriva al colletto. Bisogna risolvere tutti i pezzi insieme, con molle sulle coppie cucite (peso 30). Poi i punti cuciti vanno esattamente nello stesso posto, e ogni punto di cucitura vicino al collo segue il lato dell'altro pezzo su cui sta (giunzioni a T, se no restano fessure con segni scuri).
- **Segnetti neri o azzurri**:
  - stoffa interna che buca la costina → interno spinto dentro la costina (classica);
  - rovescio della costina scuro → `ribInnerMats` colorati come il colletto;
  - triangoli rovesciati agli incroci delle cuciture → soglia del collo più stretta, triangoli "orecchie" (3 vertici sul bordo) tolti;
  - pieghe del modello originale → triangoli la cui normale va contro quella media dei vertici, o che guardano dentro la maglia, tolti (vedi `raglan_v2.py`).
- **Spazi vuoti guardando dentro il collo**: il bordo della stoffa deve stare sotto la costina, non 1-2 mm più in basso.
- **Seghettatura con lo zoom al minimo**: era colpa di `polygonOffset` grandi sulla costina scambiata e sull'interno. Tolti; l'interno usa factor 1 e units 2.
- **Confine costina/stoffa dentro il collo seghettato**: il fondo della costina, punto per punto, ha irregolarità di 1-2 mm. La linea del bordo va lisciata in coordinate cilindriche (gaussiana periodica, ~7,5°) tranne sulla punta della V. Dove la costina ha una tacca (al centro dietro, 1,5 mm), la linea sale con una gobba morbida.
- **Bordino nella texture con la maschera**: la maschera dei pezzi taglia la fascia vicino alle cuciture e fa un gradino. Anche il contorno sottile per chiudere i triangoli sfrangia. Il bordino 3D ha risolto.
- **Linea del collo per il bordino che comprende punti delle cuciture**: la fascia scende lungo la cucitura (grumi agli incroci). Vanno esclusi i punti cuciti a un altro pezzo.
- Una **variante base condivisa** (`setModel` con la stessa sorgente usciva subito): il bordino non veniva creato per la maglia di partenza. Ora `setModel` confronta anche `trimKey`.
- Sui telefoni la profondità è meno precisa che nei render headless: tenere sempre qualche decimo di millimetro di distanza tra superfici vicine (0,6-0,8 mm per la fascetta, 1,3 mm stoffa/costina).

- **Triangoli ribaltati dopo il taglio** (raglan V): alla fine di `raglan_v2.py` i punti dei triangoli ribaltati vanno nella media dei vicini, un passo alla volta. Se restano triangoli con due punti sul bordo del collo, anche il terzo va sulla linea del bordo.

- **Linee chiare dentro il collo della raglan**: il rovescio della costina riceveva la spinta indietro dell'interno (`polygonOffset`). Visto di sbieco vicino al bordo alto finiva dietro alla stoffa e al bordino di fuori. Ora il rovescio della costina non ha la spinta (`userData.noOffset`).
- **Pieghe del modello raglan** (4 triangolini davanti e 4 dietro vicino al collo, girati al contrario): annullate in `loadRaglan` (`RAGLAN_FOLDS`, i tre vertici uguali, senza cambiare la numerazione usata dai file dei tagli).
- Raglan col suo girocollo: la costina si dipinge su tutto il riquadro con il margine, come le costine scambiate.

- **Buchi nella raglan V** (sotto il braccio, dietro la spalla, davanti sulla cucitura): il modello ha fessure di mezzo millimetro lungo le cuciture e cuciture *dentro* lo stesso pezzo (punti doppi), che `raglan_v2.py` prima non teneva insieme. Ora:
  - le fessure si chiudono su tutta la maglia;
  - le cuciture interne sono coppie anche loro;
  - vicino al collo i punti di bordo "quasi cuciti" (a meno di 1,5 mm nel modello) tengono la distanza che avevano;
  - si alternano chiusura sui lati e media dei gemelli.
  Verifica: `chk.py`-style, fessure tra pezzi sotto 0,6 mm.
- Le pieghe (`RAGLAN_FOLDS`) non si annullano più: si girano nel verso giusto (annullate lasciavano buchi). Dopo lo spostamento della V `fixFolds` le rigira verso fuori, perché alcune si distendono.

## 7. Checklist prima di consegnare una modifica alle maglie
1. `tools/kit3d/render/render.sh` con colori contrastati (es. maglia `#1e6fd0`, colletto `#55dddd` o `#22aa33`, bordino `#ffffff`, oppure `#ff0000` per vedere dove sta).
2. Tutte e 4 le combinazioni (classica/raglan × girocollo/V), più il colletto grosso se c'entra.
3. Inquadrature: davanti, 3/4, lato, dietro, dentro il collo dall'alto (davanti e dietro), zoom sulla spalla (incroci delle cuciture), zoom ravvicinato sul bordino (`d` 0,08-0,16), zoom minimo.
4. Ritagli ingranditi (PIL) dei punti critici: incroci delle cuciture, punta della V, centro dietro.
5. Mandare all'utente un'immagine riassuntiva prima/dopo.
