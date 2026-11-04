# Raglan con lo scollo a V della classica (stesso metodo del girocollo sulla classica, setin_crew.py): la costina a V
# originale si mette rigida (V_FIT in Kit3D.js: spostata, inclinata, scalata, appena allargata ai lati) in modo da
# combaciare con lo scollo della raglan ai lati e dietro; davanti la stoffa dentro la V si toglie. Il bordo della stoffa
# va esattamente su una linea pulita appena sotto la costina; i quattro pezzi (maniche, davanti, dietro) si risolvono
# insieme, cuciti, così le cuciture raglan arrivano dritte al colletto senza fessure.
import os
import sys, struct; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if os.path.basename(os.path.dirname(os.path.abspath(__file__))) == 'legacy' else os.path.dirname(os.path.abspath(__file__)))
from neckmorph import *
from collections import Counter
OUT_SHIFT, OUT_CUT = sys.argv[1], sys.argv[2]
FIT = np.load(os.path.join(HERE, 'vfit3.npy'))
PIV = np.array([0, 1.52, 0.0])
REACH = float(sys.argv[3]) if len(sys.argv) > 3 else 0.05
EDGE = np.array([0.0006, -0.0013])   # bordo della stoffa: appena sopra il fondo della costina e appena dentro
def xf(Q):
    dy, dz, tilt, s, sx, sz = FIT; c, si = np.cos(tilt), np.sin(tilt)
    q = (Q - PIV) * s; y = q[:, 1] * c - q[:, 2] * si; z = q[:, 1] * si + q[:, 2] * c
    return np.stack([q[:, 0] * sx, y, z * sz], 1) + PIV + np.array([0, dy, dz])
RIB = v_bend(xf(mesh('setin', 8)[0]))   # V_FIT + abbassata dietro (V_BEND)
rlo, rhi = map(smooth, edge_curves(RIB))
_ra, _rr = cyl(RIB)
_rtree = cKDTree(np.stack([np.radians(_ra) * 0.08, RIB[:, 1]], 1))
def rib_r(a, y):
    d, j = _rtree.query(np.stack([np.radians(a) * 0.08, y], 1), k=6)
    w = 1 / (d + 1e-5); return (_rr[j] * w).sum(1) / w.sum(1)
# linea del bordo molto liscia (il fondo della costina, punto per punto, ha piccole irregolarità di 1-2 mm che da dentro
# facevano un confine seghettato tra costina e stoffa): media gaussiana che gira tutto intorno; davanti, vicino alla
# punta della V, poco lisciata per non arrotondarla
def psmooth(v, sig):
    n_ = len(A) - 1; base = v[:n_]; out = np.zeros_like(base)
    k = np.arange(-3 * int(sig), 3 * int(sig) + 1); w = np.exp(-0.5 * (k / sig) ** 2); w /= w.sum()
    for kk, ww in zip(k, w): out += np.roll(base, -kk) * ww
    return np.r_[out, out[:1]]
raw = edge_curves(RIB)[0]
# sempre sopra il fondo vero della costina (dove la costina ha una piccola tacca, come al centro dietro, la stoffa
# restava sotto e si vedeva il gradino): massimo sui vicini (±7,5 gradi), poi lisciato
ys = psmooth(raw[:, 0], 3.0)
back_ = np.clip((np.abs(A) - 130) / 20, 0, 1)    # solo dietro, dove il collo è quasi piano
# dove la costina ha una tacca (al centro dietro il fondo è 1,5 mm più alto) la linea sale con una gobba morbida
deficit = (raw[:, 0] - ys) * back_
for _ in range(3):
    i = np.argmax(deficit[:-1])
    if deficit[i] < 0.0002: break
    da = ((A - A[i] + 180) % 360) - 180
    bump = deficit[i] * np.exp(-0.5 * (da / 10.0) ** 2)
    ys = ys + bump; deficit = (raw[:, 0] - ys) * back_
    print('gobba a %.0f gradi: %.2f mm' % (A[i], bump.max() * 1000))
blend = np.clip((np.abs(A) - 35) / 25, 0, 1)  # 0 sulla V, 1 da 60 gradi in poi
ty = rlo[:, 0] * (1 - blend) + ys * blend + EDGE[0] + 0.0 * blend
tr = psmooth(rib_r(A, ty), 3.0) - 0.0013
tr = (rlo[:, 1] + EDGE[1]) * (1 - blend) + tr * blend
T = np.stack([ty, tr], 1)
RLO = smooth(edge_curves(mesh('raglan', 8)[0])[0])
ms = data()['raglan']
OUTER = [0, 2, 4, 6]
per = [np.zeros((len(m['P']) // 3, 3)) for m in ms]
cuts = [np.zeros(0, int) for m in ms]
Ps, Is, kept = [], [], []
for k in OUTER:
    P, N, U, I = mesh('raglan', k)
    C = P[I].mean(1); a, r = cyl(C)
    # dentro la V: sopra la linea del bordo (davanti, dove il collo della raglan è più alto della V)
    # sopra la linea del bordo: davanti la stoffa dentro la V, dietro quella sopra la costina abbassata (vfit3.py, DROP)
    inside = (r < 0.14) & (C[:, 1] > 1.45) & (C[:, 1] > at(T, a)[:, 0] + 0.0015)
    cuts[k] = cuts[k + 1] = np.where(inside)[0]
    Ps.append(P); Is.append(I[~inside]); kept.append(np.where(~inside)[0])
    print(ms[k]['name'], 'tagliati', inside.sum())
for it in range(4):
    off = np.cumsum([0] + [len(p) for p in Ps])
    PA = np.vstack(Ps); IA = np.vstack([I + o for I, o in zip(Is, off)]); n = len(PA)
    bvs = [boundary_vertices(I) + o for I, o in zip(Is, off)]
    allb = np.concatenate(bvs)
    # bordo del collo: vertici di bordo sul collo originale o sul taglio
    aA, rA = cyl(PA)
    o_ = at(RLO, aA[allb])
    cutv = set()
    for k, o in zip(OUTER, off):
        I0 = mesh('raglan', k)[3]
        if len(cuts[k]): cutv |= set((np.unique(I0[cuts[k]]) + o).tolist())
    onneck = cKDTree(mesh('raglan', 8)[0]).query(PA[allb])[0] < 0.0025   # attaccati al girocollo originale
    neckA = allb[onneck | np.isin(allb, list(cutv))]
    neckA = np.unique(neckA)
    tl = at(T, aA[neckA])
    dneckA = to_xyz_delta(PA[neckA], tl[:, 0] - PA[neckA, 1], tl[:, 1] - rA[neckA])

    # triangoli con tutti e tre i punti sul bordo (orecchie del taglio): si schiacciano sulla linea, meglio toglierli
    ears = 0
    for q, k in enumerate(OUTER):
        I0 = mesh('raglan', k)[3]; ki = kept[q]
        allN = np.isin(I0[ki] + off[q], neckA).all(1)
        if it < 3 and allN.any():
            cuts[k] = cuts[k + 1] = np.union1d(cuts[k], ki[allN]); kept[q] = ki[~allN]; Is[q] = I0[kept[q]]; ears += allN.sum()
    print('orecchie tolte', ears)
    if not ears: break
print('collo', len(neckA), 'spostamento bordo max %.1f mm' % (np.linalg.norm(dneckA, axis=1).max() * 1000))
# coppie cucite tra pezzi diversi
pairs = []
for i in range(4):
    for j in range(i + 1, 4):
        t = cKDTree(PA[bvs[j]]); d, jj = t.query(PA[bvs[i]])
        m = d < 0.0008
        if m.any(): pairs.append(np.stack([bvs[i][m], bvs[j][jj[m]]], 1))
pairs = np.vstack(pairs); seamv = set(pairs.ravel().tolist())
print('cuciti', len(pairs))
e = np.vstack([IA[:, [0, 1]], IA[:, [1, 2]], IA[:, [2, 0]]]); e = np.vstack([e, e[:, ::-1]])
W = sp.coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), shape=(n, n)).tocsr(); W.data[:] = 1
S = sp.coo_matrix((np.full(len(pairs) * 2, 30.0), (np.r_[pairs[:, 0], pairs[:, 1]], np.r_[pairs[:, 1], pairs[:, 0]])), shape=(n, n)).tocsr()
L = sp.diags(np.asarray((W + S).sum(1)).ravel()) - (W + S)
used = np.unique(IA)
unused = np.setdiff1d(np.arange(n), used)
far = np.where(cKDTree(PA[neckA]).query(PA)[0] > REACH)[0]
nd = cKDTree(PA[neckA]).query(PA)[0]
freeb = np.array([v for v in allb if v in seamv or (nd[v] < 0.012 and v not in set(neckA.tolist()))])
fixed = np.unique(np.concatenate([np.setdiff1d(allb, freeb), far, neckA, unused]))
DA = np.zeros((n, 3))
for v, dv in zip(neckA, dneckA): DA[v] = dv
free = np.setdiff1d(np.arange(n), fixed)
solve = spl.factorized(L[free][:, free].tocsc()); Lfc = L[free][:, fixed]
for c in range(3): DA[free, c] = solve(-Lfc @ DA[fixed, c])
# punti cuciti nello stesso posto
tgt = ((PA[pairs[:, 0]] + DA[pairs[:, 0]]) + (PA[pairs[:, 1]] + DA[pairs[:, 1]])) / 2
og = PA[pairs[:, 0]] - PA[pairs[:, 1]]
nonneck = ~np.isin(pairs[:, 0], neckA) & ~np.isin(pairs[:, 1], neckA)
DA[pairs[nonneck, 0]] = (tgt + og / 2 - PA[pairs[:, 0]])[nonneck]
DA[pairs[nonneck, 1]] = (tgt - og / 2 - PA[pairs[:, 1]])[nonneck]
# T: ogni punto della cucitura vicino al collo segue il lato dell'altro pezzo su cui sta
def bedges(I, o):
    c = Counter()
    for t in I:
        for a_, b_ in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])): c[tuple(sorted((a_ + o, b_ + o)))] += 1
    return np.array([k_ for k_, v in c.items() if v == 1])
E = [bedges(I, o) for I, o in zip(Is, off)]
nearN = cKDTree(PA[neckA]).query(PA)[0] < REACH
neckset = set(neckA.tolist())
def tfix(snap=False):
    for _ in range(2):
        for A_ in range(4):
            for B_ in range(4):
                if A_ == B_: continue
                eb = E[B_]; pa_, pb_ = PA[eb[:, 0]], PA[eb[:, 1]]; ab = pb_ - pa_
                for v in bvs[A_]:
                    if not nearN[v] or v in neckset: continue
                    q = PA[v]
                    t_ = np.clip(((q - pa_) * ab).sum(1) / np.maximum((ab * ab).sum(1), 1e-14), 0, 1)
                    dd = np.linalg.norm(pa_ + ab * t_[:, None] - q, axis=1); i_ = np.argmin(dd)
                    if dd[i_] > (0.0008 if snap else 0.0006): continue
                    DA[v] = DA[eb[i_, 0]] * (1 - t_[i_]) + DA[eb[i_, 1]] * t_[i_]
                    if snap:
                        # le fessurine del modello lungo le cuciture raglan (0,5 mm, si vedevano da dentro come segnetti
                        # azzurri) vicino al collo si chiudono: il punto va proprio sul lato dell'altro pezzo
                        f = np.clip((0.05 - dN[v]) / 0.02, 0, 1)
                        SNAP[v] = (pa_[i_] + ab[i_] * t_[i_] - q) * f

tfix()
gap = np.linalg.norm((PA[pairs[:, 0]] + DA[pairs[:, 0]]) - (PA[pairs[:, 1]] + DA[pairs[:, 1]]), axis=1)
print('cucitura: max prima %.2f mm, dopo %.2f mm' % (np.linalg.norm(og, axis=1).max() * 1000, gap.max() * 1000))
# a pochi millimetri dal bordo la stoffa segue rigida il punto del bordo più vicino (niente triangolini rovesciati)
dN, jN = cKDTree(PA[neckA]).query(PA)
w = np.clip(1 - dN / 0.005, 0, 1) ** 2
nn = ~np.isin(np.arange(n), neckA)
DA[nn] = (w[:, None] * DA[neckA[jN]] + (1 - w[:, None]) * DA)[nn]
# vicino al bordo (6 mm) i punti si distendono tra i vicini: dove il collo originale faceva un gradino (gli incroci delle
# cuciture raglan) nessun triangolino resta rovesciato
eK = np.vstack([IA[:, [0, 1]], IA[:, [1, 2]], IA[:, [2, 0]]]); eK = np.vstack([eK, eK[:, ::-1]])
Wk = sp.coo_matrix((np.ones(len(eK)), (eK[:, 0], eK[:, 1])), shape=(n, n)).tocsr(); Wk.data[:] = 1
deg = np.asarray(Wk.sum(1)).ravel()
zone = (dN < 0.006) & nn & np.isin(np.arange(n), used)
for _ in range(0):
    Q = PA + DA
    avg = (Wk @ Q) / np.maximum(deg, 1)[:, None]
    # punti cuciti: media dei vicini di entrambi
    for a_, b_ in pairs:
        if zone[a_] or zone[b_]:
            m = (avg[a_] * deg[a_] + avg[b_] * deg[b_]) / (deg[a_] + deg[b_]); avg[a_] = avg[b_] = m
    DA[zone] += 0.5 * (avg[zone] - Q[zone])
    for a_, b_ in pairs:
        if zone[a_] or zone[b_]:
            m = (PA[a_] + DA[a_] + PA[b_] + DA[b_]) / 2; DA[a_] = m - PA[a_]; DA[b_] = m - PA[b_]
# la stoffa non sporge fuori dalla costina nella sua fascia
Q = PA + DA; a, r = cyl(Q); lo, hi = at(rlo, a), at(rhi, a)
rmax = rib_r(a, np.clip(Q[:, 1], lo[:, 0], hi[:, 0])) - 0.0008
band = (Q[:, 1] > lo[:, 0] + 0.0008) & (Q[:, 1] < hi[:, 0] + 0.002) & (r > rmax) & (r < lo[:, 1] + 0.01)
band &= np.isin(np.arange(n), used) & (dN > 0.004)   # vicino al bordo segue già il bordo
ar = np.radians(a[band]); dr = rmax[band] - r[band]
DA[band, 0] += np.sin(ar) * dr; DA[band, 2] += np.cos(ar) * dr
print('portati dietro la costina', band.sum())
SNAP = {}
tfix(True)
# la correzione si allarga morbida ai punti vicini (4 mm), così i triangolini lungo la cucitura non si rovesciano
DA0 = DA.copy()
scale = {v: 1.0 for v in SNAP}
for it in range(8):
    DA = DA0.copy()
    sv = np.array(list(SNAP.keys())); sd = np.array([SNAP[v] * scale[v] for v in sv])
    dS = cKDTree(PA[sv]).query(PA)[0]
    fixedS = np.unique(np.concatenate([np.where((dS > 0.004) | ~np.isin(np.arange(n), used))[0], sv]))
    fvS = np.zeros((len(fixedS), 3)); posS = {v: i for i, v in enumerate(fixedS)}
    for v, d_ in zip(sv, sd): fvS[posS[v]] = d_
    freeS = np.setdiff1d(np.arange(n), fixedS)
    CS = np.zeros((n, 3)); CS[fixedS] = fvS
    solveS = spl.factorized(L[freeS][:, freeS].tocsc()); LfcS = L[freeS][:, fixedS]
    for c in range(3): CS[freeS, c] = solveS(-LfcS @ CS[fixedS, c])
    DA += CS

    Q = PA + DA; bad = set()
    n0 = np.cross(PA[IA[:, 1]] - PA[IA[:, 0]], PA[IA[:, 2]] - PA[IA[:, 0]]); n1 = np.cross(Q[IA[:, 1]] - Q[IA[:, 0]], Q[IA[:, 2]] - Q[IA[:, 0]])
    flip = ((n0 * n1).sum(1) <= 0) | (np.linalg.norm(n1, axis=1) < 0.15 * np.linalg.norm(n0, axis=1))
    for t in np.where(flip)[0]:
        for v in IA[t]:
            if v in scale and scale[v] > 0: bad.add(v)
    if not bad: break
    for v in bad: scale[v] = scale[v] * 0.5 if scale[v] > 0.1 else 0
    print('fessure: riduco', len(bad))
print('fessure chiuse', len(sv), 'max %.2f mm' % (np.linalg.norm(sd, axis=1).max() * 1000))
# pieghe del modello vicino al collo (triangolini della stoffa girati verso dentro, da dentro si vedevano come segnetti
# azzurri sulla cucitura raglan dietro): i loro punti si distendono tra i vicini finché non guardano tutti fuori
pairmap = {}
for a_, b_ in pairs: pairmap.setdefault(a_, []).append(b_); pairmap.setdefault(b_, []).append(a_)
def inward(Q):
    nrm = np.cross(Q[IA[:, 1]] - Q[IA[:, 0]], Q[IA[:, 2]] - Q[IA[:, 0]]); C = Q[IA].mean(1)
    a_, r_ = cyl(C); out = np.stack([np.sin(np.radians(a_)), np.zeros(len(C)), np.cos(np.radians(a_))], 1)
    nn_ = nrm / np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-15)
    return np.where((C[:, 1] > 1.54) & (r_ < 0.12) & ((nn_ * out).sum(1) < 0.05) & (dN[IA[:, 0]] < 0.03))[0]
# sono pieghe sotto la stoffa vicina (si sovrappongono): si tolgono, come la stoffa dentro la V
nb = 0
for q, k in enumerate(OUTER):
    P, N, U, I0 = mesh('raglan', k)
    fn = np.cross(P[I0[:, 1]] - P[I0[:, 0]], P[I0[:, 2]] - P[I0[:, 0]]); fn /= np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-15)
    vn = N[I0].mean(1); vn /= np.maximum(np.linalg.norm(vn, axis=1, keepdims=True), 1e-15)
    C0 = P[I0].mean(1); tocam = np.array([0, 1.45, 0.02]) - C0
    # la faccia guarda al contrario della stoffa intorno, oppure (da fuori) guarda dentro la maglia
    gi = np.where((((fn * vn).sum(1) < 0) | ((fn * tocam).sum(1) > 0.02 * np.linalg.norm(tocam, axis=1))) & (C0[:, 1] > 1.47))[0]
    cuts[k] = cuts[k + 1] = np.union1d(cuts[k], gi); nb += len(gi)
bad = range(nb)
print('pieghe tolte', len(bad))
# ultimi triangolini rovesciati (incroci delle cuciture, lati dove la stoffa rientra): i loro punti, tranne quelli del
# bordo del collo, vanno nella media dei vicini, un passo alla volta, finché non ne resta nessuno (i punti cuciti insieme)
IK = np.vstack([Is[q] + off[q] for q in range(len(OUTER))])
nb_ = [[] for _ in range(n)]
for t in IK:
    for a_, b_ in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])): nb_[a_].append(b_); nb_[b_].append(a_)
pm = {}
for a_, b_ in pairs: pm.setdefault(a_, []).append(b_); pm.setdefault(b_, []).append(a_)
n0 = np.cross(PA[IK[:, 1]] - PA[IK[:, 0]], PA[IK[:, 2]] - PA[IK[:, 0]])
def flipped():
    Q = PA + DA; n1 = np.cross(Q[IK[:, 1]] - Q[IK[:, 0]], Q[IK[:, 2]] - Q[IK[:, 0]])
    return np.where(((n0 * n1).sum(1) <= 0) & (np.linalg.norm(n0, axis=1) > 1e-10))[0]
held = set(neckset)
for rnd in range(4):
    for it in range(60):
        bad = flipped()
        if not len(bad): break
        Q = PA + DA
        for v in set(IK[bad].ravel().tolist()) - held:
            if not nb_[v]: continue
            DA[v] = Q[nb_[v]].mean(0) - PA[v]
            for b_ in pm.get(v, []): DA[b_] = PA[v] + DA[v] - PA[b_]
    bad = flipped()
    if not len(bad): break
    # ne resta qualcuno con due punti sul bordo del collo (gradini del taglio): anche il terzo va sulla linea del bordo, come
    # quelli del collo, e resta lì (il triangolino si schiaccia sotto la costina invece di rovesciarsi)
    Q = PA + DA
    for t in bad:
        tri = IK[t]; isn = np.array([v in neckset for v in tri])
        if isn.sum() == 2:
            v = tri[~isn][0]; av, rv = cyl(Q[v:v+1]); tt = at(T, av)[0]
            DA[v] = to_xyz_delta(Q[v:v+1], np.array([tt[0] - Q[v, 1]]), np.array([tt[1] - rv[0]]))[0] + Q[v] - PA[v]
            held.add(v); neckset.add(v)
            for b_ in pm.get(v, []): DA[b_] = PA[v] + DA[v] - PA[b_]; held.add(b_)
print('rovesciati rimasti', len(flipped()))
# dopo lo spostamento: triangolini che guardano dentro la maglia (da dentro si vedrebbero azzurri) si tolgono
Q = PA + DA; nb2 = 0
for q, k in enumerate(OUTER):
    I0 = mesh('raglan', k)[3]; G = I0 + off[q]
    fn = np.cross(Q[G[:, 1]] - Q[G[:, 0]], Q[G[:, 2]] - Q[G[:, 0]]); C0 = Q[G].mean(1); tocam = np.array([0, 1.45, 0.02]) - C0
    m = np.ones(len(I0), bool); m[cuts[k]] = False
    gi = np.where(m & ((fn * tocam).sum(1) > 0.02 * np.linalg.norm(fn, axis=1) * np.linalg.norm(tocam, axis=1)) & (C0[:, 1] > 1.47))[0]
    if len(gi): print(ms[k]['name'], 'girati dopo', len(gi), [('a%.0f y%.3f' % (cyl(C0[g:g+1])[0][0], C0[g, 1])) for g in gi])
    cuts[k] = cuts[k + 1] = np.union1d(cuts[k], gi); nb2 += len(gi)
for k, o, p in zip(OUTER, off, Ps):
    D = DA[o:o + len(p)].copy(); D[np.setdiff1d(np.arange(len(p)), np.unique(Is[OUTER.index(k)]))] = 0
    per[k] = per[k + 1] = D
    mv = np.linalg.norm(D, axis=1)
    print(ms[k]['name'], 'max %.1f mm' % (mv.max() * 1000), 'mossi >0.5mm', (mv > 5e-4).sum())
# controllo: triangoli rovesciati
for k, o, p in zip(OUTER, off, Ps):
    I = Is[OUTER.index(k)]; P0 = p; P1 = p + per[k]
    n0 = np.cross(P0[I[:, 1]] - P0[I[:, 0]], P0[I[:, 2]] - P0[I[:, 0]]); n1 = np.cross(P1[I[:, 1]] - P1[I[:, 0]], P1[I[:, 2]] - P1[I[:, 0]])
    print(ms[k]['name'], 'rovesciati', ((n0 * n1).sum(1) < 0).sum(), 'schiacciati', (np.linalg.norm(n1, axis=1) < 0.1 * np.linalg.norm(n0, axis=1)).sum())
print('bytes', write_nkp1(OUT_SHIFT, per))
out = bytearray(b'NKC1' + struct.pack('<H', len(ms)))
for c in cuts: out += struct.pack('<I', len(c)) + np.asarray(c).astype('<u4').tobytes()
open(OUT_CUT, 'wb').write(out); print('bytes', len(out))
if len(sys.argv) > 4:
    mv = np.linalg.norm(dneckA, axis=1)
    for v, m_ in sorted(zip(neckA, mv), key=lambda x: -x[1])[:25]:
        print('v', v, 'a %.0f y %.4f r %.4f -> T y %.4f r %.4f  %.1f mm' % (aA[v], PA[v, 1], rA[v], *at(T, aA[v:v+1])[0], m_ * 1000), 'cut' if v in cutv else '')
for k, o, p in zip(OUTER, off, Ps):
    I = Is[OUTER.index(k)]; P0 = p; P1 = p + per[k]
    n0 = np.cross(P0[I[:, 1]] - P0[I[:, 0]], P0[I[:, 2]] - P0[I[:, 0]]); n1 = np.cross(P1[I[:, 1]] - P1[I[:, 0]], P1[I[:, 2]] - P1[I[:, 0]])
    bad = np.where((n0 * n1).sum(1) < 0)[0]
    for t in bad:
        c = P0[I[t]].mean(0); a_, r_ = cyl(c[None]); print(ms[k]['name'], 'flip a %.0f y %.4f r %.4f' % (a_[0], c[1], r_[0]), 'line y %.4f' % at(T, a_)[0, 0], 'neckverts', np.isin(I[t] + o, neckA).sum())
print('----')
for k, o, p in zip(OUTER, off, Ps):
    I = Is[OUTER.index(k)]; P0 = p; P1 = p + per[k]
    n0 = np.cross(P0[I[:, 1]] - P0[I[:, 0]], P0[I[:, 2]] - P0[I[:, 0]]); n1 = np.cross(P1[I[:, 1]] - P1[I[:, 0]], P1[I[:, 2]] - P1[I[:, 0]])
    for t in np.where((n0 * n1).sum(1) < 0)[0]:
        print(ms[k]['name'], [(int(v+o), 'N' if v+o in neckset else ('S' if v+o in seamv else ('B' if v+o in set(allb.tolist()) else '-')), np.round(P0[v]*1000,1).tolist(), np.round(per[k][v]*1000,1).tolist()) for v in I[t]])
print('==== crepe')
Q = PA + DA
for A_ in range(4):
    for v in bvs[A_]:
        if dN[v] > 0.02 or v in neckset: continue
        best = 1; bo = None
        for B_ in range(4):
            if A_ == B_: continue
            eb = E[B_]
            pa0, pb0 = PA[eb[:, 0]], PA[eb[:, 1]]; ab0 = pb0 - pa0
            t0 = np.clip(((PA[v] - pa0) * ab0).sum(1) / np.maximum((ab0 * ab0).sum(1), 1e-14), 0, 1)
            d0 = np.linalg.norm(pa0 + ab0 * t0[:, None] - PA[v], axis=1)
            if d0.min() > 0.0006: continue
            pa_, pb_ = Q[eb[:, 0]], Q[eb[:, 1]]; ab = pb_ - pa_
            t_ = np.clip(((Q[v] - pa_) * ab).sum(1) / np.maximum((ab * ab).sum(1), 1e-14), 0, 1)
            dd = np.linalg.norm(pa_ + ab * t_[:, None] - Q[v], axis=1)
            if dd.min() < best: best = dd.min(); bo = B_
        if bo is not None and best > 0.0002:
            a_, r_ = cyl(PA[v:v+1]); print('piece', A_, 'v', v, 'a %.0f y %.4f' % (a_[0], PA[v, 1]), 'gap %.2f mm' % (best * 1000), 'dN %.1f' % (dN[v]*1000))
print('==== dbg')
for v in (7248, 33311):
    for B_ in range(4):
        eb = E[B_]; pa0, pb0 = PA[eb[:, 0]], PA[eb[:, 1]]; ab0 = pb0 - pa0
        t0 = np.clip(((PA[v] - pa0) * ab0).sum(1) / np.maximum((ab0 * ab0).sum(1), 1e-14), 0, 1)
        d0 = np.linalg.norm(pa0 + ab0 * t0[:, None] - PA[v], axis=1); i = np.argmin(d0)
        print(v, 'B', B_, 'd0 %.3f mm' % (d0[i] * 1000), 'edge', eb[i], 't %.2f' % t0[i], 'inneck', [x in neckset for x in eb[i]], 'pair', [p.tolist() for p in pairs if v in p])
print('==== aree')
for k, o, p in zip(OUTER, off, Ps):
    I = Is[OUTER.index(k)]; P0 = p; P1 = p + per[k]
    n0 = np.cross(P0[I[:, 1]] - P0[I[:, 0]], P0[I[:, 2]] - P0[I[:, 0]]); n1 = np.cross(P1[I[:, 1]] - P1[I[:, 0]], P1[I[:, 2]] - P1[I[:, 0]])
    b = (n0 * n1).sum(1) < 0
    if b.any(): print(ms[k]['name'], 'area orig mm2', np.round(np.linalg.norm(n0[b], axis=1) / 2 * 1e6, 3).tolist(), 'dopo', np.round(np.linalg.norm(n1[b], axis=1) / 2 * 1e6, 3).tolist())
print('==== girati verso dentro')
for k, o, p in zip(OUTER, off, Ps):
    I = Is[OUTER.index(k)]
    for lab, P1 in (('orig', p), ('dopo', p + per[k])):
        nrm = np.cross(P1[I[:, 1]] - P1[I[:, 0]], P1[I[:, 2]] - P1[I[:, 0]]); C = P1[I].mean(1)
        a_, r_ = cyl(C); out = np.stack([np.sin(np.radians(a_)), np.zeros(len(C)), np.cos(np.radians(a_))], 1)
        nn_ = nrm / np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-15)
        sel = (C[:, 1] > 1.54) & (r_ < 0.12) & ((nn_ * out).sum(1) + nn_[:, 1] * 0.0 < -0.2)
        print(ms[k]['name'], lab, sel.sum(), [('a%.0f y%.4f' % (aa, yy)) for aa, yy in zip(a_[sel][:8], C[sel, 1][:8])])
print('==== margine', 'min (bordo - fondo costina) dietro: %.2f mm' % ((T[np.abs(A) > 130, 0] - raw[np.abs(A) > 130, 0]).min() * 1000), 'ovunque: %.2f mm' % ((T[:, 0] - raw[:, 0]).min() * 1000), 'a', A[np.argmin(T[:, 0] - raw[:, 0])])
