# Bordino DISEGNATO NELLA TEXTURE (usato solo per la classica con la V, 'setin:base'): contorno della fascia di 5 mm.
# Uscita: neck-bands-tex.json qui accanto, poi neck_bands.py lo mette in icons/kit3d/neck-bands.json.
# (Storico:) Linea del collo nella texture, per bordino e bordo largo, per le 4 maglie (classica/raglan × scollo originale/scambiato):
# per ogni pezzo che arriva al collo una polilinea di punti [u, v, du, dv]: (u, v) il punto del bordo della stoffa sotto la
# costina, (du, dv) di quanto si va nella texture scendendo di 1 cm sulla stoffa (già spostata/tagliata come in Kit3D).
import os
import sys, json, struct
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if os.path.basename(os.path.dirname(os.path.abspath(__file__))) == 'legacy' else os.path.dirname(os.path.abspath(__file__)))
from neckmorph import *
REPO = os.path.join(os.path.dirname(os.path.dirname(HERE)), 'icons', 'kit3d') + os.sep
def read_shift(path, nm):
    b = open(path, 'rb').read(); assert b[:4] == b'NKP1'; n = struct.unpack_from('<H', b, 4)[0]; o = 6; out = []
    for _ in range(n):
        c = struct.unpack_from('<I', b, o)[0]; o += 4
        idx = np.frombuffer(b, '<u4', c, o); o += 4 * c
        q = np.frombuffer(b, '<i2', 3 * c, o).reshape(-1, 3) / 20000; o += 6 * c
        out.append((idx, q))
    return out
def read_cut(path):
    b = open(path, 'rb').read(); assert b[:4] == b'NKC1'; n = struct.unpack_from('<H', b, 4)[0]; o = 6; out = []
    for _ in range(n):
        c = struct.unpack_from('<I', b, o)[0]; o += 4; out.append(np.frombuffer(b, '<u4', c, o)); o += 4 * c
    return out
def setin_v_rib(Q):  # V_FIT (Kit3D.js)
    dy, dz, tilt, s, sx, sz = 0.007651, -0.000199, 0.055347, 0.890214, 1.118983, 1.016285; P0 = np.array([0, 1.52, 0])
    c, si = np.cos(tilt), np.sin(tilt); q = (Q - P0) * s; y = q[:, 1] * c - q[:, 2] * si; z = q[:, 1] * si + q[:, 2] * c
    return np.stack([q[:, 0] * sx, y, z * sz], 1) + P0 + np.array([0, dy, dz])
def raglan_crew_rib(Q):  # CREW_FIT
    dy, dz, tilt, sx, sz = 0.003238, -0.010652, -0.092575, 1.015959, 1.031167; P0 = np.array([0, 1.58, 0])
    c, si = np.cos(tilt), np.sin(tilt); q = Q - P0; y = q[:, 1] * c - q[:, 2] * si; z = q[:, 1] * si + q[:, 2] * c
    return np.stack([q[:, 0] * sx, y, z * sz], 1) + P0 + np.array([0, dy, dz])
VARIANTS = {
    'setin:base': ('setin', None, None, lambda: mesh('setin', 8)[0], {2: 'front', 6: 'back'}),
    'setin:crew': ('setin', 'neck-crew-setin.bin', None, lambda: raglan_crew_rib(mesh('raglan', 8)[0]), {2: 'front', 6: 'back'}),
    'raglan:base': ('raglan', None, None, lambda: mesh('raglan', 8)[0], {0: 'sleeveR', 2: 'front', 4: 'sleeveL', 6: 'back'}),
    'raglan:v': ('raglan', 'neck-v-raglan.bin', 'neck-cutv-raglan.bin', lambda: setin_v_rib(mesh('setin', 8)[0]), {0: 'sleeveR', 2: 'front', 4: 'sleeveL', 6: 'back'}),
}
WIDTHS = {'trim': 0.005, 'wide': 0.015}
def clip(poly_uv, f):
    """parte del triangolo (uv, f lineare) dove f < 0"""
    out = []; n = len(f)
    for i in range(n):
        a, b = i, (i + 1) % n
        if f[a] < 0: out.append(poly_uv[a])
        if (f[a] < 0) != (f[b] < 0):
            t = f[a] / (f[a] - f[b]); out.append(poly_uv[a] + (poly_uv[b] - poly_uv[a]) * t)
    return out
out = {}
for key, (mdl, shf, cutf, ribf, pieces) in VARIANTS.items():
    sh = read_shift(REPO + shf, 0) if shf else None
    cu = read_cut(REPO + cutf) if cutf else None
    rib = cKDTree(ribf())
    geo = {}; edge_pts = []
    for k, part in pieces.items():
        P, N, U, I = mesh(mdl, k); Q = P.copy()
        if sh: idx, q = sh[k]; Q[idx] += q
        if cu is not None and len(cu[k]): m = np.ones(len(I), bool); m[cu[k]] = False; I = I[m]
        geo[k] = (Q, U, I, part)
        best = None
        for lp in loops(I):
            lp = np.asarray(lp); near = rib.query(Q[lp])[0] < 0.004
            if near.sum() < 3: continue
            if near.all(): runs = [lp]
            else:
                s0 = np.argmin(near); lp2 = np.roll(lp, -s0); nr = np.roll(near, -s0); runs = []; cur = []
                for v, f_ in zip(lp2, nr):
                    if f_: cur.append(v)
                    elif cur: runs.append(cur); cur = []
                if cur: runs.append(cur)
            for run in runs:
                if len(run) < 3: continue
                span = np.ptp(U[run, 0]) + np.ptp(U[run, 1])
                if best is None or span > best[0]: best = (span, run)
        if best: geo[k] = geo[k] + (best[1],)
    # punti di bordo cuciti a un altro pezzo (cuciture): il tratto che scende lungo una cucitura non è collo
    bpts = {k: boundary_vertices(g[2]) for k, g in geo.items()}
    seam = {k: np.zeros(len(g[0]), bool) for k, g in geo.items()}
    for k1 in geo:
        for k2 in geo:
            if k1 == k2: continue
            d_, _ = cKDTree(geo[k2][0][bpts[k2]]).query(geo[k1][0][bpts[k1]])
            seam[k1][bpts[k1][d_ < 0.0008]] = True
    for k, g in list(geo.items()):
        if len(g) < 5: continue
        Q, run = g[0], g[4]
        if True:
            run = [v for v in run if not seam[k][v]]   # senza i punti delle cuciture (agli incroci scendono)
            for a_, b_ in zip(run[:-1], run[1:]):   # punti fitti (0,5 mm) lungo il bordo della stoffa
                if np.linalg.norm(Q[b_] - Q[a_]) > 0.012: continue
                nseg = max(1, int(np.linalg.norm(Q[b_] - Q[a_]) / 0.0005))
                for t in np.linspace(0, 1, nseg + 1): edge_pts.append(Q[a_] * (1 - t) + Q[b_] * t)
    # linea del collo lisciata (il bordo della stoffa, punto per punto, ha piccole onde che si vedevano nel bordino):
    # in coordinate cilindriche, media gaussiana di 4 gradi che gira tutto intorno; sulla punta della V niente media
    E_ = np.array(edge_pts); ea, er = cyl(E_); ey = E_[:, 1]
    nb = 360; bins = ((ea + 180) % 360).astype(int) % nb
    cnt = np.bincount(bins, minlength=nb).astype(float)
    my = np.bincount(bins, ey, nb); mr = np.bincount(bins, er, nb)
    ok = cnt > 0; ang = np.arange(nb) - 179.5
    my = np.interp(ang, ang[ok], my[ok] / cnt[ok], period=360); mr = np.interp(ang, ang[ok], mr[ok] / cnt[ok], period=360)
    vtip = key in ('setin:base', 'raglan:v')
    sig = np.full(nb, 4.0)
    if vtip: sig = np.clip((np.abs(ang) - 3) / 10, 0, 1) * 4.0 + 0.01
    sy = np.zeros(nb); sr = np.zeros(nb); kk = np.arange(-15, 16)
    for i in range(nb):
        w = np.exp(-0.5 * (kk / sig[i]) ** 2); w /= w.sum(); j = (i + kk) % nb
        sy[i] = (my[j] * w).sum(); sr[i] = (mr[j] * w).sum()
    fa = np.radians(np.arange(0, 360, 0.25) - 179.5)
    fy = np.interp(np.degrees(fa), ang, sy, period=360); fr = np.interp(np.degrees(fa), ang, sr, period=360)
    curve = np.stack([np.sin(fa) * fr, fy, np.cos(fa) * fr], 1)
    et = cKDTree(curve)
    W = 0.005
    res = []
    for k, g in geo.items():
        if len(g) < 5: continue
        Q, U, I, part, run = g
        d = et.query(Q)[0] - W
        # linea a 5 mm: su ogni lato attraversato, il punto esatto (bisezione sulla distanza vera dalla linea del collo)
        iso = {}
        def cross(a_, b_):
            kk = (min(a_, b_), max(a_, b_))
            if kk in iso: return kk
            lo_, hi_ = 0.0, 1.0; da = d[a_]
            for _ in range(20):
                m = (lo_ + hi_) / 2; p = Q[a_] * (1 - m) + Q[b_] * m
                if ((et.query(p)[0] - W) < 0) == (da < 0): lo_ = m
                else: hi_ = m
            m = (lo_ + hi_) / 2; iso[kk] = U[a_] * (1 - m) + U[b_] * m
            return kk
        adj = {}
        for tri in I:
            sg = [(tri[i], tri[(i + 1) % 3]) for i in range(3) if (d[tri[i]] < 0) != (d[tri[(i + 1) % 3]] < 0)]
            if len(sg) != 2: continue
            e1, e2 = cross(*sg[0]), cross(*sg[1])
            adj.setdefault(e1, []).append(e2); adj.setdefault(e2, []).append(e1)
        # catene
        seen = set(); chains = []
        for st in adj:
            if st in seen: continue
            # parti da un estremo se c'è
            cur = st
            comp = []; stack = [st]; cs = set([st])
            while stack:
                x = stack.pop(); comp.append(x)
                for y in adj[x]:
                    if y not in cs: cs.add(y); stack.append(y)
            ends = [x for x in comp if len(adj[x]) == 1]
            cur = ends[0] if ends else st; prev = None; ch = [cur]; seen |= cs
            while True:
                nx = [y for y in adj[cur] if y != prev and y not in ch[-2:]]
                if not nx or nx[0] == ch[0]: break
                prev, cur = cur, nx[0]; ch.append(cur)
                if len(ch) > len(comp): break
            chains.append(ch)
        ch = max(chains, key=len)
        bot = np.array([iso[x] for x in ch])
        for _ in range(2): bot[1:-1] = (bot[:-2] + 2 * bot[1:-1] + bot[2:]) / 4
        top = U[np.asarray(run)]
        if np.linalg.norm(bot[0] - top[0]) + np.linalg.norm(bot[-1] - top[-1]) > np.linalg.norm(bot[-1] - top[0]) + np.linalg.norm(bot[0] - top[-1]):
            bot = bot[::-1]
        res.append({'part': part, 'top': np.round(top, 5).ravel().tolist(), 'bot': np.round(bot, 5).ravel().tolist()})
    out[key] = res
    print(key, [(r['part'], len(r['top']) // 2, len(r['bot']) // 2) for r in res])
TEX = os.path.join(HERE, 'neck-bands-tex.json')   # letto da neck_bands.py (solo 'setin:base' finisce nel file finale)
json.dump(out, open(TEX, 'w'), separators=(',', ':'))
print('bytes', os.path.getsize(TEX))
