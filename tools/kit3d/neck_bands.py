# Bordino 3D (fascetta di 5 mm sulla stoffa, Kit3D.js buildNeckTrim): per ogni maglia e scollo {rows: 4, pts: [...]},
# campioni intorno al collo × 4 file (la prima 1 mm sopra il fondo della costina, le altre proiettate sulla stoffa e
# staccate 0,6 mm). Uscita: icons/kit3d/neck-bands.json (unisce neck-bands-tex.json per 'setin:base').
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
    dy, dz, tilt, s, sx, sz = np.load(os.path.join(HERE, 'vfit3.npy')); P0 = np.array([0, 1.52, 0])   # = V_FIT
    c, si = np.cos(tilt), np.sin(tilt); q = (Q - P0) * s; y = q[:, 1] * c - q[:, 2] * si; z = q[:, 1] * si + q[:, 2] * c
    return v_bend(np.stack([q[:, 0] * sx, y, z * sz], 1) + P0 + np.array([0, dy, dz]))   # + V_BEND
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
    # bordo basso vero della costina (per angolo: il punto più basso entro ±2 gradi, lisciato): la prima fila della fascetta
    # sta 1 mm sopra, sulla costina, così tra costina e bordino non resta mai una fessura di stoffa
    RB = ribf(); ra_, rr_ = cyl(RB); rbin = ((ra_ + 180) % 360).astype(int) % nb
    ly = np.full(nb, np.inf); lr = np.zeros(nb)
    for i in range(len(RB)):
        b_ = rbin[i]
        if RB[i, 1] < ly[b_]: ly[b_] = RB[i, 1]; lr[b_] = rr_[i]
    okb = np.isfinite(ly); ly = np.interp(ang, ang[okb], ly[okb], period=360); lr = np.interp(ang, ang[okb], lr[okb], period=360)
    wy = np.array([ly[(np.arange(nb) + d_) % nb] for d_ in range(-2, 3)]); wi = np.argmin(wy, 0)
    ly2 = wy[wi, np.arange(nb)]; lr2 = np.array([lr[(i + d_) % nb] for i, d_ in zip(range(nb), wi - 2)])
    # lisciata bene (la costina ha piccole tacche, al centro dietro 1,5 mm: il bordino ci faceva una gobbetta), tranne sulla
    # punta della V
    keep = np.clip((np.abs(ang) - 3) / 10, 0, 1) if vtip else np.ones(nb)
    for _ in range(15):
        sy_ = (np.roll(ly2, 1) + 2 * ly2 + np.roll(ly2, -1)) / 4; sr_2 = (np.roll(lr2, 1) + 2 * lr2 + np.roll(lr2, -1)) / 4
        ly2 = ly2 + (sy_ - ly2) * keep; lr2 = lr2 + (sr_2 - lr2) * keep
    # la distanza del bordino si misura dal bordo basso della costina (curva fitta)
    fa2 = np.radians(np.arange(0, 360, 0.2) - 179.5)
    ry_ = np.interp(np.degrees(fa2), ang, ly2, period=360); rr2 = np.interp(np.degrees(fa2), ang, lr2, period=360)
    et = cKDTree(np.stack([np.sin(fa2) * rr2, ry_, np.cos(fa2) * rr2], 1))
    W = 0.005
    # linea a 5 mm sulla stoffa: su ogni lato attraversato, il punto esatto (bisezione sulla distanza vera)
    iso3 = []
    for k, g in geo.items():
        if len(g) < 5: continue
        Q, U, I = g[0], g[1], g[2]
        d = et.query(Q)[0] - W
        done = set()
        for tri in I:
            for i in range(3):
                a_, b_ = tri[i], tri[(i + 1) % 3]
                if (d[a_] < 0) == (d[b_] < 0): continue
                ek = (min(a_, b_), max(a_, b_))
                if ek in done: continue
                done.add(ek); lo_, hi_ = 0.0, 1.0
                for _ in range(20):
                    m = (lo_ + hi_) / 2; p = Q[a_] * (1 - m) + Q[b_] * m
                    if ((et.query(p)[0] - W) < 0) == (d[a_] < 0): lo_ = m
                    else: hi_ = m
                iso3.append(Q[a_] * (1 - lo_) + Q[b_] * lo_)
    iso3 = np.array(iso3); ia, ir = cyl(iso3)
    # in coordinate cilindriche, lisciata come la linea del collo (sotto la costina: la più vicina al collo per angolo)
    bins_i = ((ia + 180) % 360).astype(int) % nb
    by = np.full(nb, np.nan); br = np.full(nb, np.nan)
    for i in range(nb):
        s_ = bins_i == i
        if s_.any():
            j = np.argmax(iso3[s_, 1]); by[i] = iso3[s_, 1][j]; br[i] = ir[s_][j]   # il punto più alto (la linea, non altro)
    ok = ~np.isnan(by)
    by = np.interp(ang, ang[ok], by[ok], period=360); br = np.interp(ang, ang[ok], br[ok], period=360)
    sby = np.zeros(nb); sbr = np.zeros(nb)
    sig2 = sig * 1.75; kk2 = np.arange(-25, 26)   # la linea bassa più lisciata (7 gradi), sulla punta della V no
    for i in range(nb):
        w = np.exp(-0.5 * (kk2 / sig2[i]) ** 2); w /= w.sum(); j = (i + kk2) % nb
        sby[i] = (by[j] * w).sum(); sbr[i] = (br[j] * w).sum()
    # campioni: ogni 1,5 gradi, ogni 0,25 vicino alla punta della V
    samp = []; x = -180.0
    while x < 180:
        samp.append(x); x += 0.25 if (vtip and abs(x) < 12) else 1.0
    samp = np.array(samp); sr_ = np.radians(samp)
    ty = np.interp(samp, ang, sy, period=360); tr = np.interp(samp, ang, sr, period=360)
    bY = np.interp(samp, ang, sby, period=360); bR = np.interp(samp, ang, sbr, period=360)
    top = np.stack([np.sin(sr_) * np.interp(samp, ang, lr2, period=360), np.interp(samp, ang, ly2, period=360), np.cos(sr_) * np.interp(samp, ang, lr2, period=360)], 1); bot = np.stack([np.sin(sr_) * bR, bY, np.cos(sr_) * bR], 1)
    # superficie della stoffa (tutti i pezzi, già spostata/tagliata): ogni punto della fascetta va sul punto più vicino della
    # superficie e poi 0,6 mm fuori lungo la sua normale, così la fascetta segue ogni piega e la stoffa non la buca
    TP = np.vstack([g[0][g[2]] for g in geo.values()])           # (T, 3, 3)
    TP = TP[np.linalg.norm(np.cross(TP[:, 1] - TP[:, 0], TP[:, 2] - TP[:, 0]), axis=1) > 1e-9]   # senza triangoli schiacciati
    cen = TP.mean(1); ctree = cKDTree(cen)
    nrm = np.cross(TP[:, 1] - TP[:, 0], TP[:, 2] - TP[:, 0]); nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-15
    def closest(p, raw=False):
        _, cand = ctree.query(p, k=16); best = None
        for t in cand:
            A_, B_, C_ = TP[t]
            # punto più vicino sul triangolo (Ericson)
            ab, ac, ap = B_ - A_, C_ - A_, p - A_
            d1, d2 = ab @ ap, ac @ ap
            if d1 <= 0 and d2 <= 0: q = A_
            else:
                bp = p - B_; d3, d4 = ab @ bp, ac @ bp
                if d3 >= 0 and d4 <= d3: q = B_
                else:
                    vc = d1 * d4 - d3 * d2
                    if vc <= 0 and d1 >= 0 and d3 <= 0: q = A_ + ab * (d1 / (d1 - d3))
                    else:
                        cp = p - C_; d5, d6 = ab @ cp, ac @ cp
                        if d6 >= 0 and d5 <= d6: q = C_
                        else:
                            vb = d5 * d2 - d1 * d6
                            if vb <= 0 and d2 >= 0 and d6 <= 0: q = A_ + ac * (d2 / (d2 - d6))
                            else:
                                va = d3 * d6 - d5 * d4
                                if va <= 0 and (d4 - d3) >= 0 and (d5 - d6) >= 0: q = B_ + (C_ - B_) * ((d4 - d3) / ((d4 - d3) + (d5 - d6)))
                                else:
                                    den = 1 / (va + vb + vc); q = A_ + ab * (vb * den) + ac * (vc * den)
            dd = np.linalg.norm(q - p)
            if best is None or dd < best[0]: best = (dd, q, t)
        n_ = nrm[best[2]].copy()
        if n_[0] * best[1][0] + n_[2] * best[1][2] < 0: n_ = -n_
        return (best[1], n_) if raw else best[1] + n_ * 0.0006
    ry = np.interp(samp, ang, ly2, period=360) + 0.002   # 2 mm sopra il fondo della costina: copre anche le tacche
    rrad = np.interp(samp, ang, lr2, period=360) + 0.0008   # 0,8 mm fuori dalla costina: il suo bordo non spunta davanti
    # raggio vero della faccia esterna della costina a quell'altezza (la costina della V ai lati è inclinata e svasata: col
    # raggio del fondo la costina usciva davanti alla fascetta a zig-zag), lisciato lungo il collo
    _ra0, _rr0 = cyl(RB); _rt0 = cKDTree(np.stack([np.radians(_ra0) * 0.07, RB[:, 1]], 1))
    dd0, jj0 = _rt0.query(np.stack([np.radians(samp) * 0.07, ry], 1), k=12)
    rr0 = np.where(dd0 < 0.003, _rr0[jj0], 0).max(1)
    rr0 = np.where(rr0 > 0, rr0, rrad)
    for _ in range(4): rr0 = (np.roll(rr0, 1) + 2 * rr0 + np.roll(rr0, -1)) / 4
    rrad = np.maximum(rrad, rr0 + 0.0008)
    ribtop = np.stack([np.sin(sr_) * rrad, ry, np.cos(sr_) * rrad], 1)
    TUCK = key == 'setin:crew'
    if TUCK:
        # classica col girocollo: la fascetta non si sovrappone alla costina (le due superfici si incrociavano e il bordo
        # bianco veniva seghettato). Il suo bordo alto sta esattamente sul bordo basso vero della costina (la polilinea del
        # modello, punto per punto), 0,4 mm dietro: quello che si vede è il bordo pulito della costina, poi subito il verde
        Pm, _, _, Im = mesh('raglan', 8); RBm = ribf()
        lp = np.asarray(max(loops(Im), key=len)); la, lr_ = cyl(RBm[lp]); ly = RBm[lp, 1]
        lo_c, hi_c = edge_curves(RBm)
        # solo i punti del bordo basso (entro 1,2 mm dal più basso lì intorno): fuori la cucitura verticale della costina
        bot = (ly - at(lo_c, la)[:, 0]) < 0.0012
        ea, ey, er = la[bot], ly[bot], lr_[bot]; o = np.argsort(ea); ea, ey, er = ea[o], ey[o], er[o]
        ey_s = np.interp(samp, ea, ey, period=360); er_s = np.interp(samp, ea, er, period=360)
        ribtop = np.stack([np.sin(sr_) * (er_s - 0.0004), ey_s, np.cos(sr_) * (er_s - 0.0004)], 1)
        top = np.stack([np.sin(sr_) * er_s, ey_s, np.cos(sr_) * er_s], 1)
        print('   bordo della costina: punti', bot.sum())
    # fascia regolare: dal fondo della costina (lisciato) si scende SULLA STOFFA perpendicolarmente al collo, a passi di
    # 0,5 mm, per 5 mm esatti: larghezza uguale tutto intorno (prima la linea bassa era un'isolinea a parte e la larghezza
    # andava da 4 a 7 mm). File: 1 sulla costina (2 mm sopra il fondo) + 5 sulla stoffa a 0, 1,25, 2,5, 3,75 e 5 mm
    n_s = len(samp)
    F0 = np.zeros((n_s, 3)); N0 = np.zeros((n_s, 3))
    for i in range(n_s): F0[i], N0[i] = closest(top[i], raw=True)
    tg = np.roll(F0, -1, 0) - np.roll(F0, 1, 0)
    dn = np.cross(N0, tg); dn /= np.linalg.norm(dn, axis=1, keepdims=True) + 1e-15
    dn[dn[:, 1] > 0] *= -1                       # verso il basso (lontano dal collo)
    for _ in range(3): dn = (np.roll(dn, 1, 0) + 2 * dn + np.roll(dn, -1, 0)) / 4
    if vtip:
        # sulla punta della V le due metà scenderebbero una sopra l'altra (piega scura): lì si scende dritti in giù,
        # e la fascetta fa la punta come la costina
        down = np.array([0, -1.0, 0]) - (N0 * np.array([0, -1.0, 0])).sum(1, keepdims=True) * N0
        down /= np.linalg.norm(down, axis=1, keepdims=True) + 1e-15
        wv = np.clip(1 - (np.abs(samp) - 2) / 10, 0, 1)[:, None]
        dn = dn * (1 - wv) + down * wv
    dn /= np.linalg.norm(dn, axis=1, keepdims=True)
    S_ROWS = [0.001, 0.002, 0.0035, 0.005]   # la prima appena sotto il fondo della costina (dove la stoffa sta sotto la costina)
    if TUCK: S_ROWS = [0.0, 0.002, 0.004, 0.006]   # misurate dal punto della stoffa sotto il bordo della costina
    ROWS = 1 + len(S_ROWS)
    grid = np.zeros((n_s, ROWS, 3)); grid[:, 0] = ribtop
    for i in range(n_s):
        p, nrm_, d = F0[i].copy(), N0[i].copy(), dn[i].copy(); s_ = 0.0; j = 0
        while True:
            while j < len(S_ROWS) and S_ROWS[j] <= s_ + 1e-9:
                grid[i, 1 + j] = p + nrm_ * (0.0012 if TUCK else 0.0006); j += 1   # classica girocollo: la stoffa sulla spalla fa pieghe, più stacco
            if j >= len(S_ROWS): break
            p, nrm_ = closest(p + d * 0.0005, raw=True); s_ += 0.0005
            d = d - (d @ nrm_) * nrm_; d /= np.linalg.norm(d) + 1e-15
    # la fascetta resta sempre fuori dalla costina dove le due si sovrappongono (al centro davanti della classica col
    # girocollo il fondo della costina si piega in fuori e spuntava attraverso come un puntino bianco)
    _ra, _rr = cyl(RB); _rt = cKDTree(np.stack([np.radians(_ra) * 0.07, RB[:, 1]], 1))
    for j in (range(ROWS) if not TUCK else []):
        P_ = grid[:, j]; ga, gr = cyl(P_)
        dd, jj = _rt.query(np.stack([np.radians(ga) * 0.07, P_[:, 1]], 1), k=3)
        near = dd[:, 0] < 0.002
        rr = np.where(near, _rr[jj].max(1) + 0.0008, 0)
        push = near & (gr < rr) & (rr - gr < 0.0025)   # solo dove la costina buca davvero (non la sua faccia esterna più in alto)
        f = np.where(push, rr / np.maximum(gr, 1e-9), 1)
        grid[:, j, 0] *= f; grid[:, j, 2] *= f
        if push.any(): print('   fila', j, 'spinta fuori dalla costina in', push.sum(), 'punti, max %.2f mm' % ((rr - gr)[push].max() * 1000))
    # file lisciate lungo il collo (non sulla punta della V)
    kp = np.clip((np.abs(samp) - 3) / 10, 0, 1) if vtip else np.ones(n_s)
    for j in range(1, ROWS):
        for _ in range(12 if not TUCK or j > 1 else 3):
            sm_ = (np.roll(grid[:, j], 1, 0) + 2 * grid[:, j] + np.roll(grid[:, j], -1, 0)) / 4
            grid[:, j] += (sm_ - grid[:, j]) * kp[:, None]
    out[key] = {'rows': ROWS, 'pts': np.round(grid, 4).ravel().tolist()}
    wd = np.linalg.norm(grid[:, 1] - grid[:, -1], axis=1) * 1000
    print(key, len(samp), 'larghezza sulla stoffa mm min %.1f max %.1f' % (wd.min(), wd.max()))
# classica con la V: bordino nella texture (stoffa con pieghe sotto la costina, la fascetta 3D non si appoggia bene)
TEX = os.path.join(HERE, 'neck-bands-tex.json')
if os.path.exists(TEX): out['setin:base'] = {'tex': json.load(open(TEX))['setin:base']}
else: print('ATTENZIONE: manca neck-bands-tex.json (lancia prima neck_bands_tex.py): setin:base resta con la fascetta 3D')
json.dump(out, open(REPO + 'neck-bands.json', 'w'), separators=(',', ':'))
print('bytes', os.path.getsize(REPO + 'neck-bands.json'))
