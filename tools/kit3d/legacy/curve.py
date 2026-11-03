# Cucitura raglan più curva: la manica si taglia lungo una nuova linea che dal colletto all'ascella
# si incurva verso la spalla; la mezzaluna tolta alla manica passa al busto (davanti o dietro),
# con le coordinate del cartamodello riportate su quello del busto lungo la cucitura.
import numpy as np
from collections import defaultdict

def vnormals(pos, tri):
    n = np.zeros_like(pos)
    fn = np.cross(pos[tri[:, 1]] - pos[tri[:, 0]], pos[tri[:, 2]] - pos[tri[:, 0]])
    for k in range(3): np.add.at(n, tri[:, k], fn)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)

def boundary_loops(tri):
    cnt = defaultdict(int)
    for t in tri:
        for a, b in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])): cnt[(min(a, b), max(a, b))] += 1
    adj = defaultdict(list)
    for (a, b), c in cnt.items():
        if c == 1: adj[a].append(b); adj[b].append(a)
    seen = set(); loops = []
    for s in adj:
        if s in seen: continue
        loop = [s]; seen.add(s); prev, cur = None, s
        while True:
            nx = [v for v in adj[cur] if v != prev and v not in seen]
            if not nx: break
            prev, cur = cur, nx[0]; seen.add(cur); loop.append(cur)
        loops.append(loop)
    return loops

def seam_chain(pos, tri, other_pos, tol=0.003):
    """Tratto di bordo del pezzo vicino all'altro pezzo, ordinato dal colletto (y più alta) all'ascella."""
    best = []
    for loop in boundary_loops(tri):
        L = np.array(loop)
        d = np.min(np.linalg.norm(pos[L][:, None, :] - other_pos[None, ::1, :], axis=2), axis=1)
        m = d < tol
        if not m.any(): continue
        # tratto contiguo più lungo (l'anello è circolare)
        k = np.argmin(m) if not m.all() else 0
        mm = np.roll(m, -k); LL = np.roll(L, -k)
        runs = []; cur = []
        for v, f in zip(LL, mm):
            if f: cur.append(v)
            elif cur: runs.append(cur); cur = []
        if cur: runs.append(cur)
        r = max(runs, key=len)
        if len(r) > len(best): best = r
    c = np.array(best)
    if pos[c[0], 1] < pos[c[-1], 1]: c = c[::-1]
    return c

def arclen(P):
    s = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))])
    return s / s[-1]

def project(Q, C, tC):
    """Punto più vicino sulla polilinea C (param tC): distanza, parametro, punto, indice del segmento."""
    A = C[:-1]; B = C[1:]; AB = B - A
    w = np.clip((((Q[:, None, :] - A[None]) * AB[None]).sum(2)) / np.maximum((AB * AB).sum(1), 1e-18)[None], 0, 1)
    X = A[None] + w[..., None] * AB[None]
    d = np.linalg.norm(Q[:, None, :] - X, axis=2)
    i = np.argmin(d, 1); r = np.arange(len(Q))
    return d[r, i], tC[i] + (tC[i + 1] - tC[i]) * w[r, i], X[r, i], i

def connected_to(tri, mask, seeds):
    """Vertici di mask raggiungibili dai seeds passando solo per vertici di mask (sulla superficie, non in linea d'aria)."""
    adj = defaultdict(set)
    for t in tri:
        for a, b in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])):
            if mask[a] and mask[b]: adj[a].add(b); adj[b].add(a)
    seen = set(int(v) for v in seeds if mask[v]); st = list(seen)
    while st:
        v = st.pop()
        for w in adj[v]:
            if w not in seen: seen.add(w); st.append(w)
    out = np.zeros(len(mask), bool); out[list(seen)] = True
    return out

def cut_mesh(pos, tri, attrs, f):
    """Taglia la superficie lungo f = 0: restituisce (vertici e attributi estesi, triangoli f<0, triangoli f>=0)."""
    pos = list(pos); attrs = {k: list(v) for k, v in attrs.items()}; f = list(f)
    cache = {}
    def mid(a, b):
        key = (min(a, b), max(a, b))
        if key in cache: return cache[key]
        w = f[a] / (f[a] - f[b])
        pos.append(pos[a] + (pos[b] - pos[a]) * w)
        for k in attrs: attrs[k].append(attrs[k][a] + (attrs[k][b] - attrs[k][a]) * w)
        f.append(0.0); cache[key] = len(pos) - 1
        return cache[key]
    ins, outs = [], []
    for t in tri:
        s = [f[v] < 0 for v in t]
        if all(s): ins.append(list(t)); continue
        if not any(s): outs.append(list(t)); continue
        # il vertice solo (dentro o fuori) va per primo, ordine ciclico invariato
        lone = [i for i in range(3) if s[i] != (sum(s) >= 2)][0]
        a, b, c = t[lone], t[(lone + 1) % 3], t[(lone + 2) % 3]
        pab, pca = mid(a, b), mid(c, a)
        A_ = [[a, pab, pca]]; B_ = [[pab, b, c], [pab, c, pca]]
        if s[lone]: ins += A_; outs += B_
        else: outs += A_; ins += B_
    out_attrs = {k: np.array(v) for k, v in attrs.items()}
    return np.array(pos), out_attrs, np.array(ins, int), np.array(outs, int)

def compact(pos, attrs, tri):
    used = np.unique(tri.ravel()); remap = -np.ones(len(pos), int); remap[used] = np.arange(len(used))
    return pos[used], {k: v[used] for k, v in attrs.items()}, remap[tri], used

def curve_raglan(pieces, A=22.0, peak=0.55):
    """A: quanto la cucitura si sposta verso la spalla, in mm di tessuto sul cartamodello della manica (al massimo)."""
    nrm = {k: vnormals(d['pos'], d['tri']) for k, d in pieces.items()}
    for k, d in pieces.items(): d['nrm'] = nrm[k]; d['bbox'] = (d['R'].min(0), d['R'].max(0))
    bump = lambda t: A * np.sin(np.pi * np.clip(t, 0, 1) ** (np.log(.5) / np.log(peak)))
    for sl in ('sleeveL', 'sleeveR'):
        S_ = pieces[sl]
        seams = {}
        for body in ('front', 'back'):
            B = pieces[body]
            cb = seam_chain(B['pos'], B['tri'], S_['pos'])
            cs = seam_chain(S_['pos'], S_['tri'], B['pos'])
            # stessa lunghezza cucita: i due lati si corrispondono per lunghezza (dal colletto all'ascella)
            seams[body] = dict(cb=cb, tb=arclen(B['pos'][cb]), Rs=S_['R'][cs].copy(), ts=arclen(S_['R'][cs]), Rb=B['R'][cb].copy())
        pos, tri, R, N = S_['pos'], S_['tri'], S_['R'], S_['nrm']
        for body in ('front', 'back'):
            c = seams[body]; o = seams['back' if body == 'front' else 'front']
            dd, tt, _, _ = project(R, c['Rs'], c['ts'])
            do, _, _, _ = project(R, o['Rs'], o['ts'])
            f = np.where(dd <= do, dd - bump(tt), 1.0)
            if (f < 0).sum() == 0: continue
            P2, at, ins, outs = cut_mesh(pos, tri, {'R': R, 'N': N}, f)
            cp, cat, ctri, _ = compact(P2, at, ins)
            Bp = pieces[body]
            # coordinate sul cartamodello del busto: stessa distanza dalla cucitura, allo stesso punto della cucitura
            d2, t2, _, _ = project(cat['R'], c['Rs'], c['ts'])
            Rb = c['Rb']; tb2 = arclen(Rb)
            Rb_at = np.stack([np.interp(t2, tb2, Rb[:, 0]), np.interp(t2, tb2, Rb[:, 1])], 1)
            tg = np.stack([np.gradient(Rb[:, 0]), np.gradient(Rb[:, 1])], 1)
            tgi = np.stack([np.interp(t2, tb2, tg[:, 0]), np.interp(t2, tb2, tg[:, 1])], 1)
            tgi /= np.linalg.norm(tgi, axis=1, keepdims=True)
            nb = np.stack([tgi[:, 1], -tgi[:, 0]], 1)
            ctr = Bp['R'].mean(0)
            nb[((Rb_at - ctr) * nb).sum(1) < 0] *= -1  # verso l'esterno del busto
            Rnew = Rb_at + nb * d2[:, None]
            # vertici sulla vecchia cucitura: esattamente sulla cucitura del busto, normali raccordate
            snap = d2 < 0.3
            _, _, X3, _ = project(cp, Bp['pos'][c['cb']], c['tb'])
            cp = np.where(snap[:, None], X3, cp)
            cbp = Bp['pos'][c['cb']]
            n_b = Bp['nrm'][c['cb']][np.argmin(np.linalg.norm(cp[:, None, :] - cbp[None], axis=2), 1)]
            cN = np.where(snap[:, None], cat['N'] + n_b, cat['N'])
            cN /= np.linalg.norm(cN, axis=1, keepdims=True)
            jn = np.argmin(np.linalg.norm(cbp[:, None, :] - cp[None], axis=2), 1)
            nn = Bp['nrm'][c['cb']] + cN[jn]
            Bp['nrm'][c['cb']] = nn / np.linalg.norm(nn, axis=1, keepdims=True)
            off = len(Bp['pos'])
            Bp['pos'] = np.vstack([Bp['pos'], cp]); Bp['R'] = np.vstack([Bp['R'], Rnew]); Bp['nrm'] = np.vstack([Bp['nrm'], cN])
            Bp['tri'] = np.vstack([Bp['tri'], ctri + off])
            pos, at2, tri, _ = compact(P2, at, outs)
            R, N = at2['R'], at2['N']
            print(sl, body, 'mezzaluna: triangoli', len(ctri), 'vertici', len(cp), 'max %.1f mm' % d2.max())
        S_['pos'], S_['tri'], S_['R'], S_['nrm'] = pos, tri, R, N
