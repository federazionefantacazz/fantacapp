# Spostamenti del collo della maglia raglan per il colletto alto (stesso formato di neck-polo.bin)
import os
import sys, struct, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from neck import *
OUT = sys.argv[1]
j, acc = load('/home/user/fantacapp/icons/kit3d/shirt-raglan.glb')
# fondo del colletto (le due metà, senza le strisce della V): per ogni angolo il punto più basso
loops = []
cadj = boundary_loops(CI); seen = set()
for s in cadj:
    if s in seen: continue
    comp = []; st = [s]
    while st:
        x = st.pop()
        if x in seen: continue
        seen.add(x); comp.append(x); st += cadj[x]
    if len(comp) > 100: loops += comp
M = CB; ma = ca  # anche le strisce della V: davanti la stoffa arriva sotto di loro
A = np.arange(-180, 180, 2.0)
Hs = []; Rs = []
for a in A:
    d = np.abs((ma - a + 180) % 360 - 180); s = d < 3
    q = M[s]; i = np.argmin(q[:, 1]); Hs.append(q[i, 1]); Rs.append(np.hypot(q[i, 0] - C0[0], q[i, 2] - C0[2]))
def smooth(v, k=2):
    v = np.array(v); return np.array([np.mean(np.take(v, range(i - k, i + k + 1), mode='wrap')) for i in range(len(v))])
Hs = smooth(Hs); Rs = smooth(Rs)
def seam(a):
    return np.interp(a, A, Hs, period=360), np.interp(a, A, Rs, period=360)

# pezzi della raglan (coordinate del mondo)
pieces = []
rib = None
for mi, m in enumerate(j['meshes']):
    n = [x for x in j['nodes'] if x['mesh'] == mi][0]
    p = m['primitives'][0]
    P = acc(p['attributes']['POSITION']) * n['scale'][0] + np.array(n['translation'])
    I = acc(p['indices']).astype(int).reshape(-1, 3)
    if m['name'] == 'collar': rib = P
    pieces.append((m['name'], P, I, len(m['primitives'])))
# bordo del collo: vertici di bordo vicini alla costina
nb = []
for name, P, I, _ in pieces:
    if name == 'collar': continue
    adj = boundary_loops(I); b = np.array(sorted(adj))
    d = np.min(np.linalg.norm(P[b][:, None, :] - rib[None, ::2, :], axis=2), axis=1)
    nb.append(P[b[d < 0.006]])
NB = np.vstack(nb); na = ang(NB)
h, r = seam(na)
TUCK_Y, TUCK_R = 0.004, 0.985  # il bordo entra un poco sotto il colletto
# davanti, sotto le strisce della V, il bordo resta più in alto: meno stoffa tirata verso il basso
front = np.clip(1 - np.abs(na) / 40, 0, 1)
tuck_y = TUCK_Y + 0.010 * front
tgt = np.stack([C0[0] + np.sin(np.radians(na)) * r * TUCK_R, h + tuck_y, C0[2] + np.cos(np.radians(na)) * r * TUCK_R], 1)
D = tgt - NB
print('neck verts', len(NB), 'max move %.3f' % np.linalg.norm(D, axis=1).max())
F = 0.05  # raggio entro cui lo spostamento si smorza

from scipy.spatial import cKDTree
# normali del colletto, rivolte verso l'esterno (via dal collo, un po' verso l'alto)
cn = np.zeros_like(CP)
fnc = np.cross(CP[CI[:, 1]] - CP[CI[:, 0]], CP[CI[:, 2]] - CP[CI[:, 0]])
for kx in range(3): np.add.at(cn, CI[:, kx], fnc)
cn /= np.maximum(np.linalg.norm(cn, axis=1, keepdims=True), 1e-12)
outv = CP - C0; outv[:, 1] = 0; outv /= np.maximum(np.linalg.norm(outv, axis=1, keepdims=True), 1e-9); outv[:, 1] += .35
cn *= np.sign((cn * outv).sum(1))[:, None]
ctree = cKDTree(CP)
GAP, LAT, SPREAD = 0.003, 0.006, 0.018

def deform(P, I):
    dist = np.linalg.norm(P[:, None, :] - NB[None, :, :], axis=2)
    dmin = dist.min(1)
    kk = np.argsort(dist, 1)[:, :8]; ww = 1 / (np.take_along_axis(dist, kk, 1) + 0.003)
    Dv = (D[kk] * ww[..., None]).sum(1) / ww.sum(1)[:, None]
    t = np.clip(dmin / F, 0, 1); Dv *= ((1 - t) ** 2 * (1 + 2 * t))[:, None]
    # la stoffa che resta sopra il colletto (ali, strisce della V) passa sotto di qualche millimetro
    for it in range(4):
        Q = P + Dv
        d, ci = ctree.query(Q, k=6)
        push = np.zeros_like(Q)
        for kx in range(6):
            c = CP[ci[:, kx]]; n = cn[ci[:, kx]]; rel = Q - c
            h = (rel * n).sum(1); lat = np.linalg.norm(rel - h[:, None] * n, axis=1)
            need = (lat < LAT) & (h > -GAP) & (h < 0.03)
            amt = np.where(need, -GAP - h, 0)
            cand = amt[:, None] * n
            better = np.linalg.norm(cand, axis=1) > np.linalg.norm(push, axis=1)
            push[better] = cand[better]
        hit = np.where(np.linalg.norm(push, axis=1) > 1e-6)[0]
        if not len(hit): break
        # raccordo morbido intorno ai punti spinti
        tr = cKDTree(Q[hit]); nb_ = tr.query_ball_point(Q, SPREAD)
        add = np.zeros_like(Q)
        for i, lst in enumerate(nb_):
            if not lst: continue
            dd = np.linalg.norm(Q[hit[lst]] - Q[i], axis=1); w = (1 - dd / SPREAD) ** 2
            j = np.argmax(w * np.linalg.norm(push[hit[lst]], axis=1))
            add[i] = push[hit[lst][j]] * w[j]
        Dv += add
        print('  collision iter', it, len(hit))
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
    print(name, len(idx))
    for _ in range(cnt):
        out += struct.pack('<I', len(idx)) + idx.astype('<u4').tobytes() + q.astype('<i2').tobytes()
open(OUT, 'wb').write(out); print('bytes', len(out))
