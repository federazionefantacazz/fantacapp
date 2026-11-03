# tools/kit3d — script per colletti, bordini e render

Strumenti offline (Python + Node/Playwright) che generano i file in `icons/kit3d/` usati da `js/components/Kit3D.js`.
Per capire *cosa* fanno e *perché*, leggi prima [docs/kit3d.md](../../docs/kit3d.md).

Requisiti: Python 3 con `numpy`, `scipy`, `Pillow`; Node con `playwright` (nell'ambiente cloud è già installato, con
Chromium in `/opt/pw-browsers`). Tutti i comandi si lanciano dalla radice del repo.

## 0. Server locale
```bash
(nohup python3 -m http.server 8765 >/dev/null 2>&1 &)      # dalla radice del repo
# per fermarlo: pkill -f "http.server 876[5]"   (non scrivere la porta intera nella stessa riga del comando: pkill ucciderebbe la shell)
```

## 1. Geometria dei modelli per gli script Python (`geo.json`, ~17 MB, non nel repo)
```bash
cp tools/kit3d/web/dump.html _dump.html
node tools/kit3d/render/dump.js tools/kit3d/geo.json
rm _dump.html
```
`g.py` → `mesh(model, i)` restituisce `P, N, U, I` (posizioni mondo, normali, UV, triangoli) del pezzo `i` di
`'setin'`, `'raglan'` o `'polo'`; `loops(I)` restituisce i bordi. Indici utili:
- classica: 2 = davanti fuori, 3 = davanti dentro, 6 = dietro fuori, 7 = dietro dentro, 8/9 = costina a V;
- raglan: 0 = manica destra, 2 = davanti, 4 = manica sinistra, 6 = dietro, 8 = costina (i dispari sono le copie `_1`).

`neckmorph.py` contiene le funzioni comuni: `cyl`, `edge_curves`, `at`, `smooth`, `to_xyz_delta`, `harmonic` (Laplace), `boundary_vertices`, `write_nkp1`.

## 2. Rigenerare i file
| File in `icons/kit3d/` | Comando | Note |
|---|---|---|
| `neck-crew-setin.bin` | `python3 tools/kit3d/setin_crew.py icons/kit3d/neck-crew-setin.bin` | classica col girocollo della raglan; adattamento in `crewfit.npy` (= `CREW_FIT`) |
| `neck-v-raglan.bin` + `neck-cutv-raglan.bin` | `python3 tools/kit3d/raglan_v2.py icons/kit3d/neck-v-raglan.bin icons/kit3d/neck-cutv-raglan.bin 0.05` | raglan con la V della classica; adattamento in `vfit3.npy` (= `V_FIT`); 0.05 = fin dove si muove la stoffa (m) |
| adattamento della V | `python3 tools/kit3d/vfit3.py 0.3` | trova `V_FIT` (peso 0.3 sul petto); **copiare i numeri in `V_FIT` in Kit3D.js** e rigenerare i due `.bin` |
| `neck-bands.json` | `python3 tools/kit3d/neck_bands_tex.py && python3 tools/kit3d/neck_bands.py` | bordino: fascetta 3D per tre maglie, contorno nella texture per la classica a V. **Va rigenerato ogni volta che cambiano i `.bin` dei colli o `V_FIT`/`CREW_FIT`** (le costine sono ripetute dentro `neck_bands.py`: `setin_v_rib`, `raglan_crew_rib`) |

Verifica: con i file attuali tutti e tre i comandi riproducono byte per byte i file del repo.
Gli script stampano i controlli: triangoli rovesciati/schiacciati (devono essere 0), spostamento massimo, distanza delle cuciture, larghezza del bordino.

`legacy/`: script delle versioni precedenti (polo, primi tentativi di girocollo e V). Restano come riferimento e non servono per i file attuali.

## 3. Render di prova
```bash
tools/kit3d/render/render.sh /tmp/prova '<kit json>' '<inquadrature json>' [dbg]
```
- Crea `/tmp/prova_0.png`, `_1.png`, … e un mosaico `/tmp/prova.png`. Copia da solo `web/zoom.html` come `_test_zoom.html` nella radice e lo toglie alla fine.
- `kit`: lo stesso oggetto salvato dall'editor, per esempio
  `{"sleeveCut":"raglan","collarShape":"v","neckV":2,"collar":"trim","collarBig":true,"collarStripes":2,"colors":{"base":"#1e6fd0","sleeves":"#1e6fd0","collar":"#55dddd","cuffs":"#ffffff","trim":"#ffffff"}}`.
- Inquadrature: `{yaw (gradi, 0 davanti, 180 dietro), x, y, z (spostamento del punto guardato), d (distanza, 0,08 molto vicino … 1,15 maglia intera), pitch (gradi dall'alto)}`, come `FOCUS` in Kit3D.js.
- `dbg`: interno della maglia verde e rovescio della costina scambiata rosso. Serve la riga temporanea `window.__stage = stage; // DEBUG` in `createKitViewer`, da togliere prima del commit.
- Un render da 8 inquadrature impiega circa 3-4 minuti (SwiftShader): conviene lanciarlo in background.
- Per vedere la texture dipinta: una pagina che chiama `paintKitTexture(kit, { size: 2048 })` e salva il canvas; un ritaglio del riquadro UV del colletto aiuta a capire le righe.
