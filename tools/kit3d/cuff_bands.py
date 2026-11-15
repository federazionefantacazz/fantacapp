# Polsini della classica come quelli della raglan: fascia alta HC (quanto il polsino della raglan, 31 mm) misurata sulla
# manica 3D dal bordo della manica (la piega dell'orlo), non dalla texture (lì il polsino era solo l'orlo ripiegato).
# Uscita: icons/kit3d/cuff-bands.json → { hc: mm, parts: { sleeveL|sleeveR: { v: [u, v, mm, …], t: [...] } } }:
# per ogni punto l'altezza sopra la piega (mm). KitRenderer.js colora le fasce per altezza (fascia, righe, profilo).
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
    ang = np.arctan2((P - c) @ e2, (P - c) @ e1)
    # piega dell'orlo: per ogni spicchio di 5° intorno al braccio il punto più in fuori (s minimo) nella zona del polsino.
    # La manica è rada: in alcuni spicchi non c'è un punto sulla piega e il minimo viene più in alto (fino a 12 mm).
    # Quindi una curva liscia (Fourier, 3 armoniche) adattata ai minimi, scartando quelli sopra la curva: resta entro 0,4 mm.
    zone = np.where(v > 0.6)[0]
    ca = np.radians(np.arange(-180, 180, 5)); cs = []
    for a in ca:
        m = zone[np.abs(((ang[zone] - a + np.pi) % (2 * np.pi)) - np.pi) < np.radians(2.5)]
        cs.append(s[m].min())
    cs = np.array(cs)
    F = lambda a: np.stack([np.ones_like(a)] + [f(j * a) for j in (1, 2, 3) for f in (np.cos, np.sin)], 1)
    co = np.linalg.lstsq(F(ca), np.min([np.roll(cs, i) for i in range(-2, 3)], 0), rcond=None)[0]
    for _ in range(3):
        keep = cs - F(ca) @ co < 0.0015
        co = np.linalg.lstsq(F(ca[keep]), cs[keep], rcond=None)[0]
    # distanza = altezza sopra la piega misurata lungo l'asse della manica: lineare sui triangoli, quindi i bordi delle
    # fasce sono tagli dritti e paralleli all'orlo (con la distanza 3D dalla piega venivano ondulati)
    d = s - F(ang) @ co
    tris = I[(d[I] < HC + 0.004).any(1)]
    used = np.unique(tris); idx = -np.ones(len(P), int); idx[used] = np.arange(len(used))
    uv = U[used]; dd = d[used]; tris = idx[tris]
    out['parts'][name] = {'v': [x for a_, b_, c_ in zip(uv[:, 0], uv[:, 1], dd) for x in (round(float(a_), 5), round(float(b_), 5), round(float(c_ * 1000), 1))],
                          't': [int(x) for t_ in tris for x in t_]}
    print(name, 'spicchi sulla piega', int(keep.sum()), 'di', len(ca), '; scarto max', round(float(np.abs(cs - F(ca) @ co)[keep].max() * 1000), 2), 'mm; triangoli', len(tris))
json.dump(out, open(REPO + 'cuff-bands.json', 'w'), separators=(',', ':'))
print('bytes', os.path.getsize(REPO + 'cuff-bands.json'))
