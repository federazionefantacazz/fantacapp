# Polsini della classica come quelli della raglan: fascia alta HC (quanto il polsino della raglan, 31 mm) misurata sulla
# manica 3D dal bordo della manica (la piega dell'orlo), non dalla texture (lì il polsino era solo l'orlo ripiegato).
# Uscita: icons/kit3d/cuff-bands.json → { hc: mm, parts: { sleeveL|sleeveR: { v: [u, v, mm, …], t: [...] } } }:
# per ogni punto la distanza dalla piega. KitRenderer.js colora le fasce per distanza (fascia, righe, profilo).
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from neckmorph import *
REPO = os.path.join(os.path.dirname(os.path.dirname(HERE)), 'icons', 'kit3d') + os.sep
HC = 0.031
SLEEVES = {4: ('sleeveL', (.2031, .7656, .2578, .1250)), 0: ('sleeveR', (.5391, .7656, .2578, .1250))}
out = {'hc': HC * 1000, 'parts': {}}
for k, (name, (x0, y0, w, h)) in SLEEVES.items():
    P, N, U, I = mesh('setin', k); v = (U[:, 1] - y0) / h
    # piano dell'apertura: il giro di bordo con v più alto (l'orlo interno)
    lps = [np.asarray(l) for l in loops(I)]
    op = max(lps, key=lambda l: v[l].min())
    c = P[op].mean(0); _, _, vt = np.linalg.svd(P[op] - c); n = vt[2]
    if (P.mean(0) - c) @ n < 0: n = -n                  # verso l'interno della manica
    e1 = vt[0]; e2 = np.cross(n, e1)
    s = (P - c) @ n
    ang = np.degrees(np.arctan2((P - c) @ e2, (P - c) @ e1))
    # piega dell'orlo: per ogni spicchio intorno al braccio il punto più in fuori (s minimo) nella zona del polsino
    zone = np.where(v > 0.6)[0]
    crease = []
    for a in np.arange(-180, 180, 5):
        m = zone[np.abs(((ang[zone] - a + 180) % 360) - 180) < 2.5]
        if len(m): crease.append(P[m[np.argmin(s[m])]])
    crease = np.array(crease)
    for _ in range(3): crease = (np.roll(crease, 1, 0) + 2 * crease + np.roll(crease, -1, 0)) / 4   # piega lisciata
    dense = []
    for p, q in zip(crease, np.roll(crease, -1, 0)):
        nn = max(1, int(np.linalg.norm(q - p) / 0.0005))
        for f in np.linspace(0, 1, nn + 1): dense.append(p * (1 - f) + q * f)
    td = cKDTree(np.array(dense)); d = td.query(P)[0]
    # triangoli divisi in 16 (con la distanza vera in ogni punto): bordi delle fasce lisci anche dove la manica è rada
    NS = 1; verts = []; tris = []
    for tri in I[(d[I] < HC + 0.004).any(1)]:
        P0, P1, P2 = P[tri]; U0, U1, U2 = U[tri]; loc = {}
        for i in range(NS + 1):
            for j in range(NS + 1 - i):
                l1, l2 = i / NS, j / NS; l0 = 1 - l1 - l2
                loc[i, j] = len(verts); verts.append((U0 * l0 + U1 * l1 + U2 * l2, P0 * l0 + P1 * l1 + P2 * l2))
        for i in range(NS):
            for j in range(NS - i):
                tris.append([loc[i, j], loc[i + 1, j], loc[i, j + 1]])
                if i + j < NS - 1: tris.append([loc[i + 1, j], loc[i + 1, j + 1], loc[i, j + 1]])
    uv = np.array([q[0] for q in verts]); pp = np.array([q[1] for q in verts]); dd = td.query(pp)[0]
    out['parts'][name] = {'v': [x for a_, b_, c_ in zip(uv[:, 0], uv[:, 1], dd) for x in (round(float(a_), 5), round(float(b_), 5), round(float(c_ * 1000), 1))],
                          't': [int(x) for t_ in tris for x in t_]}
    sel = tris
    print(name, 'piega', len(crease), 'punti; triangoli', len(sel))
json.dump(out, open(REPO + 'cuff-bands.json', 'w'), separators=(',', ':'))
print('bytes', os.path.getsize(REPO + 'cuff-bands.json'))
