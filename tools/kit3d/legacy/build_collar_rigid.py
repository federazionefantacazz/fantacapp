# Colletto alto sulla raglan: il colletto originale (collar-polo.glb) NON si deforma, si sposta tutto insieme.
# Si cercano spostamento (su/giù, avanti/indietro), inclinazione in avanti e scala perché l'ala e le strisce
# della V appoggino sulla maglia (a ~2 mm) senza entrarci.
import os
import sys, os, json, struct; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from neck import *
from scipy.spatial import cKDTree
from scipy.optimize import minimize
OUT = sys.argv[1]
j, acc = load('/home/user/fantacapp/icons/kit3d/shirt-raglan.glb')
SP = []; SN = []
for mi, m in enumerate(j['meshes']):
    n = [x for x in j['nodes'] if x['mesh'] == mi][0]; p = m['primitives'][0]
    P = acc(p['attributes']['POSITION']) * n['scale'][0] + np.array(n['translation'])
    I = acc(p['indices']).astype(int).reshape(-1, 3)
    N = np.zeros_like(P); fn = np.cross(P[I[:, 1]] - P[I[:, 0]], P[I[:, 2]] - P[I[:, 0]])
    for k in range(3): np.add.at(N, I[:, k], fn)
    N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)
    sel = P[:, 1] > 1.40
    SP.append(P[sel]); SN.append(N[sel])
SP = np.vstack(SP); SN = np.vstack(SN); stree = cKDTree(SP)
def height(Q):
    d, i = stree.query(Q, k=4)
    w = 1 / (d + 1e-4); n = (SN[i] * w[..., None]).sum(1); n /= np.linalg.norm(n, axis=1, keepdims=True)
    c = (SP[i] * w[..., None]).sum(1) / w.sum(1)[:, None]
    return ((Q - c) * n).sum(1), d[:, 0]

par = np.arange(len(CP))
def f(a):
    while par[a] != a: par[a] = par[par[a]]; a = par[a]
    return a
for t in CI: par[f(t[0])] = f(t[1]); par[f(t[1])] = f(t[2])
comp = np.array([f(i) for i in range(len(CP))]); ids, cnt = np.unique(comp, return_counts=True)
halves = np.isin(comp, ids[cnt > 1000]); strips = ~halves
r = np.hypot(CP[:, 0] - C0[0], CP[:, 2] - C0[2]); a = ang(CP)
# bordo in basso dell'ala (punti che devono appoggiare) e punti delle strisce
cr = np.hypot(CB[:, 0] - C0[0], CB[:, 2] - C0[2])
A = np.arange(-180, 180, 3.0)
rA = np.array([cr[np.abs((ca - x + 180) % 360 - 180) < 4].min() if (np.abs((ca - x + 180) % 360 - 180) < 4).any() else np.nan for x in A])
ok = ~np.isnan(rA); rA = np.interp(A, A[ok], rA[ok], period=360)
fall = halves & (r - np.interp(a, A, rA, period=360) > 0.006)
bnd = np.array(sorted(boundary_loops(CI)))
edge = bnd[fall[bnd]]
ea = a[edge]; ymin = np.array([CP[edge[np.abs((ea - x + 180) % 360 - 180) < 3], 1].min() if (np.abs((ea - x + 180) % 360 - 180) < 3).any() else np.nan for x in A])
ok = ~np.isnan(ymin); ymin = np.interp(A, A[ok], ymin[ok], period=360)
edge = edge[CP[edge, 1] < np.interp(ea, A, ymin, period=360) + 0.006]
sv = np.where(strips)[0]
allv = np.where(fall | strips)[0]
pivot = np.array([0.0, CP[:, 1].min(), C0[2]])

def xform(prm, Q):
    dy, dz, tilt, s = prm
    c, si = np.cos(tilt), np.sin(tilt)
    q = (Q - pivot) * s
    y = q[:, 1] * c - q[:, 2] * si; z = q[:, 1] * si + q[:, 2] * c   # inclinazione in avanti (attorno all'asse x)
    return np.stack([q[:, 0], y, z], 1) + pivot + np.array([0, dy, dz])

# bordo del collo della maglia (dove c'era la costina, tolta col colletto alto): deve restare dentro il colletto
rib = None; necks = []
for mi, m in enumerate(j['meshes']):
    n = [x for x in j['nodes'] if x['mesh'] == mi][0]; p = m['primitives'][0]
    P = acc(p['attributes']['POSITION']) * n['scale'][0] + np.array(n['translation'])
    if m['name'] == 'collar': rib = P; continue
    necks.append((P, acc(p['indices']).astype(int).reshape(-1, 3)))
NE = []
for P, I in necks:
    b_ = np.array(sorted(boundary_loops(I)))
    dr = np.min(np.linalg.norm(P[b_][:, None, :] - rib[None, ::2, :], axis=2), axis=1)
    NE.append(P[b_[dr < 0.006]])
NE = np.vstack(NE)
NE = NE[NE[:, 2] < 0.03]
np.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'neck_edge.npy'), NE)  # davanti c'è il taglio a V sotto le strisce
cn = np.zeros_like(CP); fnc = np.cross(CP[CI[:, 1]] - CP[CI[:, 0]], CP[CI[:, 2]] - CP[CI[:, 0]])
for k in range(3): np.add.at(cn, CI[:, k], fnc)
cn /= np.maximum(np.linalg.norm(cn, axis=1, keepdims=True), 1e-12)
ov = CP - C0; ov[:, 1] = 0; ov /= np.maximum(np.linalg.norm(ov, axis=1, keepdims=True), 1e-9)
cn *= np.sign((cn * ov).sum(1))[:, None]   # normali del colletto verso fuori (via dal collo)
stand = halves & ~fall
def neck_out(prm):
    Q = xform(prm, CP[stand]); Nq = xform(prm, CP[stand] + cn[stand] * 0.01) - Q
    t = cKDTree(Q); d, i = t.query(NE)
    return ((NE - Q[i]) * Nq[i] / 0.01).sum(1)   # > 0: la stoffa esce dal piede del colletto
H0 = 0.002
SCALE = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
def cost(p3):
    prm = np.append(p3, SCALE)
    he, _ = height(xform(prm, CP[edge])); hs, _ = height(xform(prm, CP[sv]))
    ha, _ = height(xform(prm, CP[allv]))
    pen = np.clip(0.001 - ha, 0, None)  # niente dentro la maglia
    return np.mean((he - H0) ** 2) + np.mean((hs - H0) ** 2) + 40 * np.mean(pen ** 2)
x0 = np.array([0.0, 0.0, 0.0])
print('prima: costo %.2e' % cost(x0))
best = minimize(cost, x0, method='Nelder-Mead', options={'xatol': 1e-5, 'fatol': 1e-10, 'maxiter': 3000, 'initial_simplex': [x0, x0 + [0.01, 0, 0], x0 + [0, 0.01, 0], x0 + [0, 0, 0.05]]})
prm = np.append(best.x, SCALE)
print('dopo: costo %.2e  dy %.1f mm  dz %.1f mm  tilt %.1f°  scala %.3f' % (best.fun, prm[0] * 1000, prm[1] * 1000, np.degrees(prm[2]), prm[3]))
Q = xform(prm, CP)
he, _ = height(Q[edge]); hs, _ = height(Q[sv]); ha, _ = height(Q[allv])
print('stoffa fuori dal piede: %d (max %.4f)' % ((neck_out(prm) > 0).sum(), neck_out(prm).max()))
print('bordo ala: media %.4f max %.4f | strisce: media %.4f min %.4f max %.4f | sotto la maglia: %d' % (he.mean(), he.max(), hs.mean(), hs.min(), hs.max(), (ha < 0).sum()))
# stoffa vicino al collo che esce dal piede del colletto: i suoi triangoli si tolgono (sono sotto l'ala)
Qs = Q[stand]; Ns = xform(prm, CP[stand] + cn[stand] * 0.01) - Qs; Ns /= np.linalg.norm(Ns, axis=1, keepdims=True)
ts = cKDTree(Qs)
poke = {}
for mi, m in enumerate(j['meshes']):
    if m['name'] == 'collar': continue
    n = [x for x in j['nodes'] if x['mesh'] == mi][0]; p = m['primitives'][0]
    P = acc(p['attributes']['POSITION']) * n['scale'][0] + np.array(n['translation'])
    near = np.where((np.min(np.linalg.norm(P[:, None, :] - NE[None, ::2, :], axis=2), axis=1) < 0.02))[0]
    if not len(near): continue
    d, i = ts.query(P[near])
    out = ((P[near] - Qs[i]) * Ns[i]).sum(1)
    poke[m['name']] = near[(out > -0.0015) & (d < 0.02)]
    print('stoffa fuori dal piede', m['name'], len(poke[m['name']]))
np.savez(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'poke.npz'), **poke)
NP = Q.astype(np.float32)
b = open('/home/user/fantacapp/icons/kit3d/collar-polo.glb', 'rb').read()
L = struct.unpack_from('<I', b, 12)[0]; gj = json.loads(b[20:20 + L]); bin0 = 20 + L + 8
binbuf = bytearray(b[bin0:bin0 + struct.unpack_from('<I', b, 20 + L)[0]])
pa = gj['accessors'][0]; bv = gj['bufferViews'][pa['bufferView']]
off = bv.get('byteOffset', 0) + pa.get('byteOffset', 0)
binbuf[off:off + NP.nbytes] = NP.tobytes()
pa['min'] = NP.min(0).tolist(); pa['max'] = NP.max(0).tolist()
js = json.dumps(gj, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
while len(binbuf) % 4: binbuf.append(0)
glb = struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(binbuf)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(binbuf), 0x004E4942) + bytes(binbuf)
open(OUT, 'wb').write(glb); print('glb', len(glb))
