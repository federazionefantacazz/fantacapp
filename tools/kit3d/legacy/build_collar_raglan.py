# Colletto alto adattato alla maglia raglan: la maglia non si tocca, è il colletto che si appoggia.
# Le metà calzano già sulla costina del girocollo; le strisce della V si stendono sul petto.
import os
import sys, os, json, struct; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from neck import *
from scipy.spatial import cKDTree
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
def height(Q):  # distanza con segno dalla superficie della maglia (positiva = fuori)
    d, i = stree.query(Q, k=4)
    w = 1 / (d + 1e-4); n = (SN[i] * w[..., None]).sum(1); n /= np.linalg.norm(n, axis=1, keepdims=True)
    c = (SP[i] * w[..., None]).sum(1) / w.sum(1)[:, None]
    return ((Q - c) * n).sum(1), n

# componenti: due metà e due strisce
par = np.arange(len(CP))
def f(a):
    while par[a] != a: par[a] = par[par[a]]; a = par[a]
    return a
for t in CI: par[f(t[0])] = f(t[1]); par[f(t[1])] = f(t[2])
comp = np.array([f(i) for i in range(len(CP))])
ids, cnt = np.unique(comp, return_counts=True)
halves = np.isin(comp, ids[cnt > 1000]); strips = ~halves
r = np.hypot(CP[:, 0] - C0[0], CP[:, 2] - C0[2]); a = ang(CP)
# attaccatura (raggio minimo del bordo per angolo) per distinguere il piede (in piedi) dall'ala (ripiegata)
cr = np.hypot(CB[:, 0] - C0[0], CB[:, 2] - C0[2])
A = np.arange(-180, 180, 3.0)
rA = np.array([cr[np.abs((ca - x + 180) % 360 - 180) < 4].min() if (np.abs((ca - x + 180) % 360 - 180) < 4).any() else np.nan for x in A])
ok = ~np.isnan(rA); rA = np.interp(A, A[ok], rA[ok], period=360)
fall = halves & (r - np.interp(a, A, rA, period=360) > 0.006)
print('fall verts', fall.sum(), 'of', halves.sum())

D = np.zeros_like(CP)
H0 = 0.002
# 1. bordo dell'ala: sulla stoffa
bnd = np.array(sorted(boundary_loops(CI)))
edge = bnd[fall[bnd]]
# solo il bordo in basso dell'ala: le estremità verticali (unione delle due metà dietro, punte davanti) salgono verso la piega
_ea = a[edge]; _ymin = np.array([CP[edge[np.abs((_ea - x + 180) % 360 - 180) < 3], 1].min() if (np.abs((_ea - x + 180) % 360 - 180) < 3).any() else np.nan for x in A])
_ok = ~np.isnan(_ymin); _ymin = np.interp(A, A[_ok], _ymin[_ok], period=360)
edge = edge[CP[edge, 1] < np.interp(_ea, A, _ymin, period=360) + 0.006]
h, n = height(CP[edge])
De = -(h - H0)[:, None] * n
print('edge gap mean %.4f max %.4f' % (h.mean(), h.max()))
# l'ala scende sulla maglia con uno spostamento morbido, uguale per i due strati del colletto:
# dipende solo dall'angolo intorno al collo e da quanto si è lontani dalla piega (0 sulla piega, pieno sul bordo)
ea = a[edge]
De_a = np.zeros((len(A), 3)); ok = np.zeros(len(A), bool)
for k, x in enumerate(A):
    m = np.abs((ea - x + 180) % 360 - 180) < 4
    if m.any(): De_a[k] = De[m].mean(0); ok[k] = True
for c in range(3): De_a[:, c] = np.interp(A, A[ok], De_a[ok, c], period=360)
for _ in range(3): De_a = (np.roll(De_a, 1, 0) + 2 * De_a + np.roll(De_a, -1, 0)) / 4  # niente scalini tra un angolo e l'altro
ytop = np.array([CP[halves & (np.abs((a - x + 180) % 360 - 180) < 4), 1].max() if (halves & (np.abs((a - x + 180) % 360 - 180) < 4)).any() else np.nan for x in A])
yedg = np.array([CP[edge[np.abs((ea - x + 180) % 360 - 180) < 4], 1].mean() if (np.abs((ea - x + 180) % 360 - 180) < 4).any() else np.nan for x in A])
for v in (ytop, yedg):
    okv = ~np.isnan(v); v[:] = np.interp(A, A[okv], v[okv], period=360)
rAv = np.interp(a, A, rA, period=360)
sm = lambda t: (lambda q: q * q * (3 - 2 * q))(np.clip(t, 0, 1))
wr = sm((r - rAv - 0.003) / 0.012)                      # solo l'ala, non il piede del colletto
yt = np.interp(a, A, ytop, period=360); ye = np.interp(a, A, yedg, period=360)
wy = sm((yt - CP[:, 1]) / np.maximum(yt - ye, 0.01))    # 0 sulla piega, 1 sul bordo
Dv = np.stack([np.interp(a, A, De_a[:, c], period=360) for c in range(3)], 1)
D[halves] = (Dv * (wr * wy)[:, None])[halves]
print('fall moved max %.4f' % np.linalg.norm(D[halves], axis=1).max())
# rifinitura: lo stacco che resta lungo il bordo (diverso punto per punto, es. le punte davanti)
# si ammorbidisce tra bordi vicini e si distribuisce sull'ala con gli stessi pesi (i due strati si muovono insieme)
wfall = (wr * wy)[halves]
hidx = np.where(halves)[0]
for it in range(4):
    Qe = CP[edge] + D[edge]
    he, ne = height(Qe)
    res = -(he - H0)[:, None] * ne
    et = cKDTree(Qe)
    _, nn = et.query(Qe, k=7)
    res = res[nn].mean(1)                                   # niente salti tra un punto del bordo e l'altro
    dq, iq = et.query(CP[hidx] + D[hidx], k=8)
    wq = 1 / (dq + 0.004) ** 2
    field = (res[iq] * wq[..., None]).sum(1) / wq.sum(1)[:, None]
    D[hidx] += field * wfall[:, None]
    print('  rifinitura', it, 'stacco medio %.4f max %.4f' % (he.mean(), he.max()))
# 2. strisce della V: stese sul petto
h, n = height(CP[strips])
D[strips] = -(h - H0)[:, None] * n
print('strips gap mean %.4f min %.4f max %.4f' % (h.mean(), h.min(), h.max()))
# 3. niente che resti sotto la stoffa
Q = CP + D
for it in range(3):
    h, n = height(Q)
    m = (h < 0.0012) & (halves | strips) & (r > 0.05)
    m &= strips | fall
    Q[m] += (0.0015 - h[m])[:, None] * n[m]
    print('collision', it, m.sum())
NP = Q.astype(np.float32)

# GLB: stesso colletto con le nuove posizioni
b = open('/home/user/fantacapp/icons/kit3d/collar-polo.glb', 'rb').read()
L = struct.unpack_from('<I', b, 12)[0]; gj = json.loads(b[20:20 + L]); bin0 = 20 + L + 8
binbuf = bytearray(b[bin0:bin0 + struct.unpack_from('<I', b, 20 + L)[0]])
pa = gj['accessors'][0]; bv = gj['bufferViews'][pa['bufferView']]
off = bv.get('byteOffset', 0) + pa.get('byteOffset', 0)
binbuf[off:off + NP.nbytes] = NP.tobytes()
pa['min'] = NP.min(0).tolist(); pa['max'] = NP.max(0).tolist()
gj['nodes'][0]['name'] = 'polo_collar'
js = json.dumps(gj, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
while len(binbuf) % 4: binbuf.append(0)
glb = struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(binbuf)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(binbuf), 0x004E4942) + bytes(binbuf)
open(OUT, 'wb').write(glb); print('glb', len(glb))
