# Maglia classica con il girocollo della raglan: la costina della raglan si mette così com'è (Kit3D.js) al posto di quella
# a V, e qui si calcola come la stoffa di davanti e di dietro arriva fino al suo bordo basso con uno spostamento morbido;
# le cuciture con le maniche restano ferme. Uscita: NKP1 (come neck-polo.bin).
import os
import sys; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if os.path.basename(os.path.dirname(os.path.abspath(__file__))) == 'legacy' else os.path.dirname(os.path.abspath(__file__)))
from neckmorph import *
OUT = sys.argv[1]
REACH = 0.075  # quanto lontano dal collo arriva lo spostamento della stoffa
WIDEN = 1.012  # la costina appena più larga intorno all'asse del collo (CREW_WIDEN in Kit3D.js)
LIFT = 0.006   # la costina della raglan sta 6 mm più in alto sulla classica (CREW_LIFT in Kit3D.js)
# costina della raglan messa sulla classica: spostata, inclinata e appena allargata in modo da combaciare con lo scollo
# originale ai lati e dietro (CREW_FIT in Kit3D.js): lì la stoffa quasi non si muove, si chiude solo la V davanti
FIT = np.load(os.path.join(HERE, 'crewfit.npy'))
def crew_xf(Q):
    dy, dz, tilt, sx, sz = FIT[:5]; piv = FIT[5:8]; c, si = np.cos(tilt), np.sin(tilt)
    q = Q - piv; y = q[:, 1] * c - q[:, 2] * si; z = q[:, 1] * si + q[:, 2] * c
    return np.stack([q[:, 0] * sx, y, z * sz], 1) + piv + np.array([0, dy, dz])
rlo, rhi = map(smooth, edge_curves(crew_xf(mesh('raglan', 8)[0])))
slo = smooth(edge_curves(mesh('setin', 8)[0])[0])  # collo originale della classica (bordo basso della costina a V)
def on_neck(P, bv, ty=0.006, tr=0.008):
    """solo i punti del bordo che stanno sul collo originale (non le cuciture delle spalle che ci arrivano)"""
    a, r = cyl(P[bv]); o = at(slo, a)
    return bv[(np.abs(P[bv, 1] - o[:, 0]) < ty) & (np.abs(r - o[:, 1]) < tr)]
ms = data()['setin']
per = [np.zeros((len(m['P']) // 3, 3)) for m in ms]
OUTER = [k for k, m in enumerate(ms) if m['parent'] in ('42', '9') and m['mat'] == 'shirt_outer']   # davanti e dietro
INNER = [k for k, m in enumerate(ms) if m['parent'] in ('42', '9') and m['mat'] == 'shirt_inner']
# 1) bordo del collo di ogni pezzo: ogni punto esattamente sulla linea sotto la costina (appena dentro, a contatto)
necks = {}
for k in OUTER:
    P, N, U, I = mesh('setin', k)
    a, r = cyl(P)
    bv = boundary_vertices(I)
    neck = on_neck(P, bv)
    base = at(rlo, a[neck])   # bordo basso della costina messa sulla classica
    tl = base + np.array([0.0005, -0.0035])   # tutto intorno appena sotto la costina: bordo pulito, niente onde
    necks[k] = (neck, to_xyz_delta(P[neck], tl[:, 0] - P[neck, 1], tl[:, 1] - r[neck]), P[neck])
allneck = np.vstack([n[2] for n in necks.values()]); alld = np.vstack([n[1] for n in necks.values()])
# 2) stoffa di fuori: davanti e dietro risolti INSIEME, cuciti lungo le spalle (i punti che coincidono si muovono come uno
#    solo): la cucitura della spalla sale dritta fino al colletto senza pieghe. Fermi: bordo del collo (sulla linea), stoffa
#    oltre REACH dal collo e gli altri bordi non cuciti
Ps = [mesh('setin', k)[0] for k in OUTER]; Is = [mesh('setin', k)[3] for k in OUTER]
off = np.cumsum([0] + [len(p) for p in Ps])
PA = np.vstack(Ps); IA = np.vstack([I + o for I, o in zip(Is, off)])
n = len(PA)
bvs = [boundary_vertices(I) + o for I, o in zip(Is, off)]
# coppie di vertici di bordo che coincidono tra i due pezzi (cucitura)
t1 = cKDTree(PA[bvs[1]]); d, j = t1.query(PA[bvs[0]])
pairs = np.stack([bvs[0][d < 0.0008], bvs[1][j[d < 0.0008]]], 1)
seamv = set(pairs.ravel().tolist())
print('cuciti', len(pairs))
e = np.vstack([IA[:, [0, 1]], IA[:, [1, 2]], IA[:, [2, 0]]]); e = np.vstack([e, e[:, ::-1]])
W = sp.coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), shape=(n, n)).tocsr(); W.data[:] = 1
S = sp.coo_matrix((np.full(len(pairs) * 2, 30.0), (np.r_[pairs[:, 0], pairs[:, 1]], np.r_[pairs[:, 1], pairs[:, 0]])), shape=(n, n)).tocsr()
W = W + S
L = sp.diags(np.asarray(W.sum(1)).ravel()) - W
neckA = np.concatenate([necks[k][0] + o for k, o in zip(OUTER, off)])
dneckA = np.vstack([necks[k][1] for k in OUTER])
far = np.where(cKDTree(PA[neckA]).query(PA)[0] > REACH)[0]
allb = np.concatenate(bvs)
freeb = np.array([v for v in allb if v in seamv])
fixed = np.unique(np.concatenate([np.setdiff1d(allb, freeb), far, neckA]))
fv = np.zeros((len(fixed), 3)); pos = {v: i for i, v in enumerate(fixed)}
for v, dv in zip(neckA, dneckA): fv[pos[v]] = dv
free = np.setdiff1d(np.arange(n), fixed)
DA = np.zeros((n, 3)); DA[fixed] = fv
solve = spl.factorized(L[free][:, free].tocsc()); Lfc = L[free][:, fixed]
for c in range(3): DA[free, c] = solve(-Lfc @ DA[fixed, c])
for k, o, p in zip(OUTER, off, Ps):
    per[k] = DA[o:o + len(p)]
    print(ms[k]['name'], 'max %.1f mm' % (np.linalg.norm(per[k], axis=1).max() * 1000))
gap = np.linalg.norm((PA[pairs[:, 0]] + DA[pairs[:, 0]]) - (PA[pairs[:, 1]] + DA[pairs[:, 1]]), axis=1)
print('cucitura: distanza max dopo %.2f mm' % (gap.max() * 1000))
# 3) stoffa di dentro: segue lo spostamento della stoffa di fuori lì vicino (così non la buca mai); il suo bordo del collo
#    arriva però esattamente dove arriva quello di fuori (appena dentro): guardando nel collo non si vede la stoffa di fuori
OP = np.vstack([mesh('setin', k)[0] for k in OUTER]); OD = np.vstack([per[k] for k in OUTER])
otree = cKDTree(OP)
for k, ko in zip(INNER, OUTER):
    P, N, U, I = mesh('setin', k)
    d, j = otree.query(P, k=6)
    w = 1 / (d + 1e-4); base = (OD[j] * w[..., None]).sum(1) / w.sum(1)[:, None]
    a, r = cyl(P)
    bv = boundary_vertices(I)
    neck = on_neck(P, bv, 0.01, 0.014)  # la stoffa di dentro è spostata dallo spessore
    # dove arriva il bordo di fuori più vicino (già spostato), 1 mm più dentro
    on, odn, opn = necks[ko]
    tgt = opn + odn
    jj = cKDTree(opn).query(P[neck])[1]
    ta, tr = cyl(tgt[jj])
    # dietro e sulle spalle appena più su: guardando nel collo copre lo spessore (davanti no, buccherebbe la stoffa di fuori)
    up = 0.002 + 0.002 * np.clip((np.abs(ta) - 35) / 30, 0, 1)
    dneck = to_xyz_delta(P[neck], tgt[jj, 1] + up - P[neck, 1], (tr - 0.004) - r[neck])
    # solo vicino al collo (2 cm) la stoffa di dentro si adatta al suo bordo; altrove resta come quella di fuori
    near = cKDTree(P[neck]).query(P)[0]
    fixed = np.unique(np.concatenate([bv, np.where(near > 0.02)[0]]))
    fv = base[fixed].copy(); pos = {v: i for i, v in enumerate(fixed)}
    for t, v in enumerate(neck): fv[pos[v]] = dneck[t]
    per[k] = harmonic(P, I, fixed, fv)
    print(ms[k]['name'], 'dentro: collo', len(neck), 'max %.1f mm' % (np.linalg.norm(per[k], axis=1).max() * 1000))
# 4) la stoffa di dentro non deve mai uscire dalla costina (vicino alle cuciture delle spalle la piega della cucitura
#    la bucava con dei segnetti scuri): nell'altezza della costina resta almeno 2 mm dentro il suo lato interno
for k in INNER:
    P = mesh('setin', k)[0]; Q = P + per[k]
    a, r = cyl(Q); lo, hi = at(rlo, a), at(rhi, a)
    t = np.clip((Q[:, 1] - lo[:, 0]) / np.maximum(hi[:, 0] - lo[:, 0], 1e-4), 0, 1)
    rmax = lo[:, 1] * (1 - t) + hi[:, 1] * t - 0.0045
    band = (Q[:, 1] > lo[:, 0] - 0.005) & (Q[:, 1] < hi[:, 0] + 0.002) & (r > rmax)
    ar = np.radians(a[band]); dr = rmax[band] - r[band]
    per[k][band, 0] += np.sin(ar) * dr; per[k][band, 2] += np.cos(ar) * dr
    print(ms[k]['name'], 'portati dentro la costina:', band.sum())
print('bytes', write_nkp1(OUT, per))
