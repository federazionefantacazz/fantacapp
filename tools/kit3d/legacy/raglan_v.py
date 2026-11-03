# Raglan con lo scollo a V della classica: la costina a V originale si mette così com'è (Kit3D.js, trasformazione V_FIT:
# solo spostata, inclinata e rimpicciolita in modo uniforme) al posto del girocollo. La stoffa dentro la V si toglie e i
# punti del bordo del taglio vanno esattamente sotto la costina (pochi millimetri); il resto della maglia resta com'è.
# Uscite: NKP1 (spostamenti) e NKC1 (triangoli da togliere), uguali per la stoffa di fuori e di dentro.
import os
import sys, struct; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if os.path.basename(os.path.dirname(os.path.abspath(__file__))) == 'legacy' else os.path.dirname(os.path.abspath(__file__)))
from neckmorph import *
OUT_SHIFT, OUT_CUT = sys.argv[1], sys.argv[2]
FIT = np.load(os.path.join(HERE, 'vfit.npy'))  # dy, dz, tilt, scala
PIV = np.array([0, 1.52, 0.0])
WIDEN = 1.0     # la costina appena più larga intorno all'asse del collo (sta sopra la stoffa)
REACH = 0.035    # fin dove arriva l'aggiustamento della stoffa intorno al bordo
def xf(Q):
    dy, dz, tilt, s = FIT; c, si = np.cos(tilt), np.sin(tilt)
    q = (Q - PIV) * s; y = q[:, 1] * c - q[:, 2] * si; z = q[:, 1] * si + q[:, 2] * c
    out = np.stack([q[:, 0], y, z], 1) + PIV + np.array([0, dy, dz])
    out[:, 0] *= WIDEN; out[:, 2] *= WIDEN
    return out
print('FIT', FIT.tolist())
# bordo basso della costina a V una volta messa sulla raglan
SP = xf(mesh('setin', 8)[0])
lo, hi = edge_curves(SP); lo = smooth(lo)
# il bordo della stoffa entra appena sotto la costina: davanti e ai lati quasi a contatto, dietro (dove la costina è
# più larga del collo della raglan) un po' più dentro, così non spunta sopra
_back = np.clip((np.abs(A) - 100) / 40, 0, 1)[:, None]
T = lo + np.array([0.0015, -0.0015]) * (1 - _back) + np.array([0.0005, -0.0035]) * _back
RLO = smooth(edge_curves(mesh('raglan', 8)[0])[0])  # collo originale della raglan (bordo basso del girocollo)
ms = data()['raglan']
per = [np.zeros((len(m['P']) // 3, 3)) for m in ms]
cuts = [np.zeros(0, int) for m in ms]
# 1) taglio: triangoli dentro l'apertura (sopra il bordo basso della costina)
geo = {}
for k in (0, 2, 4, 6):
    P, N, U, I = mesh('raglan', k)
    C = P[I].mean(1); a, r = cyl(C)
    inside = (r < 0.14) & (C[:, 1] > 1.45) & (C[:, 1] > at(T, a)[:, 0])
    cuts[k] = cuts[k + 1] = np.where(inside)[0]
    geo[k] = (P, I[~inside])
    print(ms[k]['name'], 'tagliati', inside.sum())
# 2) bordo del collo dopo il taglio: ogni punto esattamente sulla linea; cuciture vicine al collo seguono (stessa regola
#    su tutti i pezzi, che restano cuciti); il resto si adatta in REACH
necks = {}
for k, (P, I) in geo.items():
    a, r = cyl(P)
    bv = boundary_vertices(I)
    # bordo del collo: i punti sul taglio (vertici dei triangoli tolti) e quelli del collo originale della raglan
    k0 = [kk for kk in geo if geo[kk][0] is P][0]
    cutv = np.unique(mesh('raglan', k0)[3][cuts[k0]]) if len(cuts[k0]) else np.zeros(0, int)
    o = at(RLO, a[bv])
    onneck = (np.abs(P[bv, 1] - o[:, 0]) < 0.006) & (np.abs(r[bv] - o[:, 1]) < 0.008)
    neck = bv[np.isin(bv, cutv) | onneck]
    t = at(T, a[neck])
    necks[k] = (neck, to_xyz_delta(P[neck], t[:, 0] - P[neck, 1], t[:, 1] - r[neck]))
for k, (P, I) in geo.items():
    neck, dneck = necks[k]
    bv = boundary_vertices(I)
    used = np.unique(I)
    far = np.setdiff1d(np.arange(len(P)), used)   # vertici dei triangoli tolti (fermi, non contano)
    near_d = cKDTree(P[neck]).query(P)[0]
    far = np.unique(np.concatenate([far, np.where(near_d > REACH)[0]]))
    fixed = np.unique(np.concatenate([bv, far]))
    fv = np.zeros((len(fixed), 3)); pos = {v: i for i, v in enumerate(fixed)}
    allneck = np.vstack([geo[j][0][necks[j][0]] for j in necks])
    alld = np.vstack([necks[j][1] for j in necks])
    seam = np.setdiff1d(bv, neck)
    dd, jj = cKDTree(allneck).query(P[seam])
    fall = np.clip(1 - dd / REACH, 0, 1) ** 2
    for v, j, f in zip(seam, jj, fall): fv[pos[v]] = alld[j] * f
    for j, v in enumerate(neck): fv[pos[v]] = dneck[j]
    D = harmonic(P, I, fixed, fv)
    per[k] = per[k + 1] = D
    print(ms[k]['name'], 'collo', len(neck), 'max %.1f mm' % (np.linalg.norm(D, axis=1).max() * 1000), 'mossi', (np.linalg.norm(D, axis=1) > 1e-4).sum())
print('bytes', write_nkp1(OUT_SHIFT, per))
out = bytearray(b'NKC1' + struct.pack('<H', len(ms)))
for c in cuts: out += struct.pack('<I', len(c)) + np.asarray(c).astype('<u4').tobytes()
open(OUT_CUT, 'wb').write(out); print('bytes', len(out))
