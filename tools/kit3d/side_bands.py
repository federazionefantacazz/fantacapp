# Bande laterali della classica (decorazione 'side'): banda di larghezza costante (misurata sulla maglia 3D) a cavallo
# delle cuciture laterali del busto e di quelle sotto la manica, continua sotto l'ascella.
# Uscita: icons/kit3d/side-bands.json → { half: mm (metà larghezza a dimensione 100%), parts: { front|back|sleeveL|sleeveR:
#   { v: [u, v, mm, …] (punti della texture e distanza dalla cucitura), t: [i, j, k, …] (triangoli) } } }.
# KitRenderer.js colora la parte di ogni triangolo con distanza < half × dimensione.
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from neckmorph import *
REPO = os.path.join(os.path.dirname(os.path.dirname(HERE)), 'icons', 'kit3d') + os.sep
PIECES = {2: 'front', 6: 'back', 4: 'sleeveL', 0: 'sleeveR'}
ARMPIT = 1.395          # sopra: cuciture delle spalle e giro manica (non fanno parte della banda)
MAXD = 0.032            # fino a dove servono i triangoli (dimensione massima 200%)
M = {k: mesh('setin', k) for k in PIECES}
B = {k: boundary_vertices(M[k][3]) for k in PIECES}
groups = []
# cuciture laterali del busto: punti di bordo di davanti e dietro che coincidono, sotto l'ascella (una per lato)
t = cKDTree(M[6][0][B[6]]); d, j = t.query(M[2][0][B[2]])
s = (d < 0.0008) & (M[2][0][B[2], 1] < ARMPIT)
side = M[2][0][B[2][s]]
groups += [side[side[:, 0] < 0], side[side[:, 0] > 0]]
# cucitura sotto la manica: punti di bordo della stessa manica che coincidono e stanno ai due lati della texture
for k in (0, 4):
    P, N, U, I = M[k]; b = B[k]
    t = cKDTree(P[b]); d, j = t.query(P[b], k=2)
    s = (d[:, 1] < 0.0008) & (np.abs(U[b, 0] - U[b[j[:, 1]], 0]) > 0.05)
    groups.append(P[b[s]])
# ogni cucitura: punti in ordine di altezza, uniti con segmenti fitti (0,5 mm)
dense = []
for g in groups:
    g = g[np.argsort(g[:, 1])]
    print('cucitura', len(g), 'punti, passo max %.1f mm' % (np.linalg.norm(np.diff(g, axis=0), axis=1).max() * 1000))
    for p, q in zip(g[:-1], g[1:]):
        n = max(1, int(np.linalg.norm(q - p) / 0.0005))
        for f in np.linspace(0, 1, n + 1): dense.append(p * (1 - f) + q * f)
dense = np.array(dense); td = cKDTree(dense)
# metà larghezza: come la banda di prima (4,5% della larghezza del davanti nella texture), misurata a metà altezza
P, N, U, I = M[2]
e = np.vstack([I[:, [0, 1]], I[:, [1, 2]]])
mid = (np.abs(P[e[:, 0], 1] - 1.2) < 0.05)
r3 = np.linalg.norm(P[e[mid, 0]] - P[e[mid, 1]], axis=1); ru = np.linalg.norm(U[e[mid, 0]] - U[e[mid, 1]], axis=1)
m_per_uv = np.median(r3 / np.maximum(ru, 1e-9))
HALF = 0.015   # 3 cm in tutto a dimensione 100% (prima, nella texture, da 2 a 4,5 cm: si allargava in basso)
print('metri per unità di texture %.3f, metà banda %.1f mm' % (m_per_uv, HALF * 1000))
out = {'half': round(HALF * 1000, 2), 'parts': {}}
for k, name in PIECES.items():
    P, N, U, I = M[k]
    dd = td.query(P)[0]
    sel = I[(dd[I] < MAXD).any(1)]
    vs, inv = np.unique(sel, return_inverse=True)
    out['parts'][name] = {'v': [x for v in vs for x in (round(float(U[v, 0]), 5), round(float(U[v, 1]), 5), round(float(dd[v] * 1000), 2))],
                          't': inv.reshape(-1).tolist()}
    print(name, len(vs), 'punti', len(sel), 'triangoli')
json.dump(out, open(REPO + 'side-bands.json', 'w'), separators=(',', ':'))
print('bytes', os.path.getsize(REPO + 'side-bands.json'))
