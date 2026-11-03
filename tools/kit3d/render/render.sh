#!/bin/bash
# Render della maglia 3D da più inquadrature, in un'unica immagine.
#   render.sh <uscita senza .png> '<kit json>' '<inquadrature json: [{yaw,x,y,z,d,pitch},...]>' [dbg]
# Esempio (raglan con scollo a V e bordino, davanti / dietro / dentro il collo):
#   render.sh /tmp/v '{"sleeveCut":"raglan","collarShape":"v","neckV":2,"collar":"trim","colors":{"base":"#1e6fd0","sleeves":"#1e6fd0","collar":"#55dddd","cuffs":"#ffffff","trim":"#ffffff"}}' \
#     '[{"yaw":0,"y":0.38,"z":0.1,"d":0.5,"pitch":10},{"yaw":180,"y":0.38,"d":0.5,"pitch":10},{"yaw":0,"y":0.42,"d":0.25,"pitch":15}]'
# Inquadrature utili: davanti {"yaw":0,"y":0.4,"z":0.1,"d":0.42}; lato {"yaw":-90,"y":0.4,"d":0.42}; dietro {"yaw":180,...};
# dentro il collo {"yaw":0,"y":0.42,"d":0.3,"pitch":50}; zoom bordino {"yaw":0,"y":0.36,"z":0.1,"d":0.16,"pitch":5};
# zoom minimo {"yaw":0}. Per i colori di debug (dbg) aggiungi in Kit3D.js, subito dopo "stage = new Stage(...)" in
# createKitViewer, la riga temporanea  window.__stage = stage; // DEBUG  e toglila prima del commit.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
cp "$HERE/../web/zoom.html" "$ROOT/_test_zoom.html"
trap 'rm -f "$ROOT/_test_zoom.html"' EXIT
curl -s -o /dev/null localhost:8765/_test_zoom.html || { (cd "$ROOT" && nohup python3 -m http.server 8765 >/dev/null 2>&1 &); sleep 1; }
cd "$HERE" && timeout 1500 node zoomshot.js "[[${2},${3}]]" "$1" ${4:-}
python3 - "$1" <<'PY'
import sys, glob
from PIL import Image
pre = sys.argv[1]; fs = sorted(glob.glob(pre + '_[0-9]*.png'), key=lambda f: int(f.rsplit('_', 1)[1][:-4]))
ims = [Image.open(f).convert('RGB') for f in fs]; n = len(ims); cols = min(n, 4); rows = (n + cols - 1) // cols
o = Image.new('RGB', (cols * 400, rows * 400))
for i, im in enumerate(ims): o.paste(im.resize((400, 400)), ((i % cols) * 400, (i // cols) * 400))
o.save(pre + '.png'); print(pre + '.png')
PY
