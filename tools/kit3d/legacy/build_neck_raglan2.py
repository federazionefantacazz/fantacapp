# Spostamenti del collo della maglia raglan per il colletto alto (stesso formato di neck-polo.bin).
# Si sposta solo il necessario: bordo alzato dove resta sotto il colletto, stoffa dell'apertura della V
# nascosta sotto le strisce, stoffa che buca il colletto spinta appena sotto. Il resto non si muove.
import os
import sys, struct, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from neck import *
from scipy.spatial import cKDTree
OUT = sys.argv[1]
j, acc = load('/home/user/fantacapp/icons/kit3d/shirt-raglan.glb')

# anelli di bordo del colletto: due metà (grandi) e due strisce della V (piccole)
cadj = boundary_loops(CI); seen = set(); halves = []; strips = []
for s in cadj:
    if s in seen: continue
    comp = []; st = [s]
    while st:
        x = st.pop()
        if x in seen: continue
        seen.add(x); comp.append(x); st += cadj[x]
    (halves if len(comp) > 100 else strips).append(np.array(comp))
# vertici di ciascuna striscia (componenti connesse dei triangoli)
par = np.arange(len(CP))
def find(a):
    while par[a] != a: par[a] = par[par[a]]; a = par[a]
    return a
for t in CI:
    for a, b in ((t[0], t[1]), (t[1], t[2])): par[find(a)] = find(b)
comp = np.array([find(i) for i in range(len(CP))])
strip_ids = [comp[s[0]] for s in strips]
SV = [np.where(comp == c)[0] for c in strip_ids]
SVall = np.concatenate(SV)
print('strips verts', [len(x) for x in SV])

# fondo del colletto per angolo (metà + strisce)
A = np.arange(-180, 180, 2.0); Hs = []; Rs = []
for a in A:
    d = np.abs((ca - a + 180) % 360 - 180); s = d < 3
    q = CB[s]; i = np.argmin(q[:, 1]); Hs.append(q[i, 1]); Rs.append(np.hypot(q[i, 0] - C0[0], q[i, 2] - C0[2]))
sm = lambda v, k=2: np.array([np.mean(np.take(np.array(v), range(i - k, i + k + 1), mode='wrap')) for i in range(len(v))])
Hs = sm(Hs); Rs = sm(Rs)
seam = lambda a: (np.interp(a, A, Hs, period=360), np.interp(a, A, Rs, period=360))

# normali del colletto verso l'esterno
cn = np.zeros_like(CP)
fnc = np.cross(CP[CI[:, 1]] - CP[CI[:, 0]], CP[CI[:, 2]] - CP[CI[:, 0]])
for kx in range(3): np.add.at(cn, CI[:, kx], fnc)
cn /= np.maximum(np.linalg.norm(cn, axis=1, keepdims=True), 1e-12)
outv = CP - C0; outv[:, 1] = 0; outv /= np.maximum(np.linalg.norm(outv, axis=1, keepdims=True), 1e-9); outv[:, 1] += .35
cn *= np.sign((cn * outv).sum(1))[:, None]
ctree = cKDTree(CP); stree = cKDTree(CP[SVall])

# apertura della V vista da davanti: per ogni altezza, tra il bordo interno della striscia sinistra e quello della destra
SL, SR = (SV[0], SV[1]) if CP[SV[0], 0].mean() < 0 else (SV[1], SV[0])
vbot = CP[SVall, 1].min(); vtop = CP[SVall, 1].max()
V_MARGIN = 0.006
# punto nascosto dove le due strisce si incrociano (sopra la punta della V): lì sono sovrapposte e coprono tutto
_y = vbot + 0.004
_near = SVall[np.abs(CP[SVall, 1] - _y) < 0.003]
_x = np.mean([CP[SL[np.abs(CP[SL, 1] - _y) < 0.003], 0].max(), CP[SR[np.abs(CP[SR, 1] - _y) < 0.003], 0].min()])
VTIP = np.array([_x, _y, CP[_near, 2].min() - 0.003])
print('VTIP', VTIP)
def v_open(Q):
    res = np.zeros(len(Q), bool)
    for i, q in enumerate(Q):
        if q[2] < 0.02 or q[1] < vbot - 0.004 or q[1] > vtop + 0.03: continue
        y = min(q[1], vtop)
        l = SL[np.abs(CP[SL, 1] - y) < 0.004]; r = SR[np.abs(CP[SR, 1] - y) < 0.004]
        if not len(l) or not len(r): continue
        res[i] = CP[l, 0].max() - V_MARGIN < q[0] < CP[r, 0].min() + V_MARGIN  # anche un poco sotto le strisce
    return res

pieces = []; rib = None
for mi, m in enumerate(j['meshes']):
    n = [x for x in j['nodes'] if x['mesh'] == mi][0]
    p = m['primitives'][0]
    P = acc(p['attributes']['POSITION']) * n['scale'][0] + np.array(n['translation'])
    I = acc(p['indices']).astype(int).reshape(-1, 3)
    if m['name'] == 'collar': rib = P
    pieces.append((m['name'], P, I, len(m['primitives'])))

GAP, LAT = 0.003, 0.006
TUCK_Y, TUCK_R, LIFT_F = 0.004, 0.985, 0.03
def deform(P, I):
    Dv = np.zeros_like(P)
    # 1. bordo del collo più basso del colletto (dietro e ai lati): si alza fin sotto il colletto
    adj = boundary_loops(I); b = np.array(sorted(adj))
    dr = np.min(np.linalg.norm(P[b][:, None, :] - rib[None, ::2, :], axis=2), axis=1)
    nb = b[dr < 0.006]
    if len(nb):
        a = ang(P[nb]); h, r = seam(a)
        lift = np.clip(h + TUCK_Y - P[nb, 1], 0, None)
        sel = lift > 0.0005
        nb, a, h, r, lift = nb[sel], a[sel], h[sel], r[sel], lift[sel]
        rr = np.hypot(P[nb, 0] - C0[0], P[nb, 2] - C0[2])
        dn = np.zeros((len(nb), 3)); dn[:, 1] = lift
        k = r * TUCK_R / rr  # stesso raggio dell'attaccatura del colletto
        dn[:, 0] = (P[nb, 0] - C0[0]) * (k - 1); dn[:, 2] = (P[nb, 2] - C0[2]) * (k - 1)
        if len(nb):
            tr = cKDTree(P[nb]); d, ix = tr.query(P, k=6)
            w = np.clip(1 - d / LIFT_F, 0, 1) ** 2 * (3 - 2 * np.clip(1 - d / LIFT_F, 0, 1))  # smoothstep
            wn = w / np.maximum(w.sum(1, keepdims=True), 1e-9)
            Dv += (dn[ix] * wn[..., None]).sum(1) * w.max(1)[:, None]
            print('  lifted edge', len(nb), 'max %.3f' % lift.max())
    # 2. stoffa nell'apertura della V: sotto la striscia più vicina
    Q = P + Dv
    vo = np.where(v_open(Q))[0]
    if len(vo):
        # tutti nella punta della V, dietro le strisce: i triangoli dell'apertura spariscono
        Dv[vo] = VTIP - P[vo]
        print('  v-opening', len(vo))
    # 3. stoffa che buca colletto o strisce: appena sotto (solo i vertici coperti, nessun raccordo largo)
    for it in range(3):
        Q = P + Dv
        d, ci = ctree.query(Q, k=6)
        push = np.zeros_like(Q)
        for kx in range(6):
            c = CP[ci[:, kx]]; n = cn[ci[:, kx]]; rel = Q - c
            hh = (rel * n).sum(1); lat = np.linalg.norm(rel - hh[:, None] * n, axis=1)
            need = (lat < LAT) & (hh > -GAP) & (hh < 0.03)
            cand = np.where(need, -GAP - hh, 0)[:, None] * n
            better = np.linalg.norm(cand, axis=1) > np.linalg.norm(push, axis=1)
            push[better] = cand[better]
        hit = np.linalg.norm(push, axis=1) > 1e-6
        if not hit.any(): break
        Dv += push
        print('  collision', it, hit.sum())
    return Dv

out = bytearray(b'NKP1' + struct.pack('<H', sum(c for *_, c in pieces)))
for name, P, I, cnt in pieces:
    if name == 'collar':
        for _ in range(cnt): out += struct.pack('<I', 0)
        continue
    print(name)
    Dv = deform(P, I)
    idx = np.where(np.linalg.norm(Dv, axis=1) > 0.00005)[0]
    q = np.round(Dv[idx] * 20000).astype(np.int16)
    print(' moved', len(idx))
    for _ in range(cnt):
        out += struct.pack('<I', len(idx)) + idx.astype('<u4').tobytes() + q.astype('<i2').tobytes()
open(OUT, 'wb').write(out); print('bytes', len(out))
