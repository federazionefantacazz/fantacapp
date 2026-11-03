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
RIB = crew_xf(mesh('raglan', 8)[0])
rlo, rhi = map(smooth, edge_curves(RIB))
_ra, _rr = cyl(RIB)
_rtree = cKDTree(np.stack([np.radians(_ra) * 0.08, RIB[:, 1]], 1))
def rib_r(a, y):
    """raggio vero della costina all'angolo a e altezza y (la costina non è dritta: vicino al fondo si piega)"""
    d, j = _rtree.query(np.stack([np.radians(a) * 0.08, y], 1), k=6)
    w = 1 / (d + 1e-5); return (_rr[j] * w).sum(1) / w.sum(1)
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
    neck = on_neck(P, bv, 0.009, 0.012)
    base = at(rlo, a[neck])   # bordo basso della costina messa sulla classica
    tl = base + np.array([0.0006, -0.0013])   # tutto intorno appena sotto la costina: bordo pulito, niente onde
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
# i punti cuciti finiscono esattamente nello stesso posto (nel modello coincidono: una fessura anche di 0,3 mm lasciava
# vedere la stoffa di dentro lungo la cucitura della spalla)
for c in (0,):
    tgt = ((PA[pairs[:, 0]] + DA[pairs[:, 0]]) + (PA[pairs[:, 1]] + DA[pairs[:, 1]])) / 2
    orig_gap = PA[pairs[:, 0]] - PA[pairs[:, 1]]
    DA[pairs[:, 0]] = tgt + orig_gap / 2 - PA[pairs[:, 0]]
    DA[pairs[:, 1]] = tgt - orig_gap / 2 - PA[pairs[:, 1]]
# cucitura: i due pezzi hanno i punti in posti diversi lungo la cucitura (dove uno ha un punto, l'altro ha un lato):
# ogni punto della cucitura vicino al collo segue esattamente il lato dell'altro pezzo su cui sta, così spostandosi non
# si apre nessuna fessurina (si vedeva la stoffa di dentro come un segno scuro lungo la cucitura della spalla)
def seam_edges(I, o):
    from collections import Counter
    e = Counter()
    for t in I:
        for a_, b_ in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])): e[tuple(sorted((a_ + o, b_ + o)))] += 1
    return np.array([k_ for k_, v in e.items() if v == 1])
E = [seam_edges(I, o) for I, o in zip(Is, off)]
nearN = cKDTree(PA[neckA]).query(PA)[0] < REACH
for _ in range(2):
    for A_, B_ in ((0, 1), (1, 0)):
        eb = E[B_]; pa_, pb_ = PA[eb[:, 0]], PA[eb[:, 1]]
        for v in bvs[A_]:
            if not nearN[v] or v in set(neckA.tolist()): continue
            q = PA[v]; ab = pb_ - pa_
            t_ = np.clip(((q - pa_) * ab).sum(1) / np.maximum((ab * ab).sum(1), 1e-14), 0, 1)
            dd = np.linalg.norm(pa_ + ab * t_[:, None] - q, axis=1); i_ = np.argmin(dd)
            if dd[i_] > 0.0006: continue
            DA[v] = DA[eb[i_, 0]] * (1 - t_[i_]) + DA[eb[i_, 1]] * t_[i_]
for k, o, p in zip(OUTER, off, Ps): per[k] = DA[o:o + len(p)]
gap = np.linalg.norm((PA[pairs[:, 0]] + DA[pairs[:, 0]]) - (PA[pairs[:, 1]] + DA[pairs[:, 1]]), axis=1)
print('cucitura: distanza originale max %.2f mm' % (np.linalg.norm(PA[pairs[:, 0]] - PA[pairs[:, 1]], axis=1).max() * 1000))
print('cucitura: distanza max dopo %.2f mm' % (gap.max() * 1000))
# 2b) la stoffa di fuori non sporge sopra il bordo della costina (sulla spalla, dove davanti e dietro si incontrano,
#     la piega della cucitura usciva come un gradino): nella fascia della costina resta appena dietro di lei
for k in OUTER:
    P = mesh('setin', k)[0]; Q = P + per[k]
    a, r = cyl(Q); lo, hi = at(rlo, a), at(rhi, a)
    rmax = rib_r(a, np.clip(Q[:, 1], lo[:, 0], hi[:, 0])) - 0.0008
    band = (Q[:, 1] > lo[:, 0] - 0.0005) & (Q[:, 1] < hi[:, 0] + 0.002) & (r > rmax) & (r < lo[:, 1] + 0.01)
    ar = np.radians(a[band]); dr = rmax[band] - r[band]
    per[k][band, 0] += np.sin(ar) * dr; per[k][band, 2] += np.cos(ar) * dr
    print(ms[k]['name'], 'fuori portati dietro la costina:', band.sum())
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
    # tutto il bordo vicino al collo (anche i punti un po' fuori posto, che lasciavano il confine seghettato)
    o_ = at(slo, a[bv])
    neck = bv[(np.abs(P[bv, 1] - o_[:, 0]) < 0.02) & (np.abs(r[bv] - o_[:, 1]) < 0.02)]
    # bordo su una linea liscia che segue il bordo basso della costina (non i punti della stoffa di fuori, che fanno
    # gradini): 1,5 mm più su e 2,5 mm più dentro. Guardando nel collo il confine con la costina è una curva pulita
    t = at(rlo, a[neck]) + np.array([0.0021, 0.0])
    t[:, 1] = smooth_r = rib_r(a[neck], t[:, 0]) - 0.002
    dneck = to_xyz_delta(P[neck], t[:, 0] - P[neck, 1], t[:, 1] - r[neck])
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
    rmax = rib_r(a, np.clip(Q[:, 1], lo[:, 0], hi[:, 0])) - 0.002
    band = (Q[:, 1] > lo[:, 0] - 0.005) & (Q[:, 1] < hi[:, 0] + 0.002) & (r > rmax)
    ar = np.radians(a[band]); dr = rmax[band] - r[band]
    per[k][band, 0] += np.sin(ar) * dr; per[k][band, 2] += np.cos(ar) * dr
    print(ms[k]['name'], 'portati dentro la costina:', band.sum())
    # niente stoffa di dentro più in alto del suo bordo (2,1 mm sopra il fondo della costina): il confine con la costina,
    # visto dentro il collo, è una curva pulita
    Q = P + per[k]; a, r = cyl(Q); lo = at(rlo, a)
    top = lo[:, 0] + 0.0021
    over = (Q[:, 1] > top) & (r < lo[:, 1] + 0.01)
    per[k][over, 1] += top[over] - Q[over, 1]
    print(ms[k]['name'], 'abbassati al bordo:', over.sum())
# 5) la stoffa di dentro resta sempre almeno 1,5 mm dietro quella di fuori (misurato lungo la normale della stoffa di fuori
#    già spostata): vicino al collo e alle cuciture delle spalle spuntava con dei segni scuri
OQ, ON = [], []
for k in OUTER:
    Q = mesh('setin', k)[0] + per[k]; I = mesh('setin', k)[3]
    n = np.zeros_like(Q); fn = np.cross(Q[I[:, 1]] - Q[I[:, 0]], Q[I[:, 2]] - Q[I[:, 0]])
    for c in range(3): np.add.at(n, I[:, c], fn)
    n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)
    a_, r_ = cyl(Q); out = np.stack([np.sin(np.radians(a_)), np.zeros(len(Q)), np.cos(np.radians(a_))], 1)
    n *= np.sign((n * out).sum(1) + 1e-9)[:, None]   # verso l'esterno
    OQ.append(Q); ON.append(n)
OQ = np.vstack(OQ); ON = np.vstack(ON); otree3 = cKDTree(OQ)
for k in INNER:
    for _ in range(3):
        Q = mesh('setin', k)[0] + per[k]
        near = cKDTree(allneck).query(mesh('setin', k)[0])[0] < 0.08
        d, j = otree3.query(Q, k=4)
        w = 1 / (d + 1e-5); P0 = (OQ[j] * w[..., None]).sum(1) / w.sum(1)[:, None]
        n = (ON[j] * w[..., None]).sum(1); n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)
        h = ((Q - P0) * n).sum(1)
        aq, _ = cyl(Q); below = Q[:, 1] < at(rlo, aq)[:, 0] - 0.005   # il bordo vicino alla costina lo gestisce il passo 3
        bad = near & below & (d[:, 0] < 0.012) & (h > -0.003)
        per[k][bad] -= n[bad] * (h[bad] + 0.003)[:, None]
    print(ms[k]['name'], 'portati dietro la stoffa di fuori:', bad.sum())
print('bytes', write_nkp1(OUT, per))
