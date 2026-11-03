# Taglio della maglia raglan per il colletto alto (come lo scollo a V della classica):
# stoffa e costina dentro l'apertura della V si tolgono; il bordo del taglio resta sotto le strisce.
# Formato: 'NKC1', n. mesh (uint16), poi per mesh: n triangoli (uint32) e i loro indici (uint32).
import os
import sys, os, struct; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from glb import load
import numpy as np
OUT = sys.argv[1]
j, acc = load('/home/user/fantacapp/icons/kit3d/collar-polo-raglan.glb')
CP = acc(0); CI = acc(1).astype(int).reshape(-1, 3)
par = np.arange(len(CP))
def f(a):
    while par[a] != a: par[a] = par[par[a]]; a = par[a]
    return a
for t in CI: par[f(t[0])] = f(t[1]); par[f(t[1])] = f(t[2])
comp = np.array([f(i) for i in range(len(CP))]); ids, cnt = np.unique(comp, return_counts=True)
st = [np.where(comp == c)[0] for c in ids[cnt < 1000]]
SL, SR = (st[0], st[1]) if CP[st[0], 0].mean() < 0 else (st[1], st[0])
SV = np.concatenate(st)
vbot, vtop = CP[SV, 1].min(), CP[SV, 1].max()
YS = np.linspace(vbot, vtop, 40)
def edges(S, y):
    y = np.clip(y, CP[S, 1].min() + 0.002, CP[S, 1].max() - 0.002)  # ogni striscia ha la sua altezza
    m = np.abs(CP[S, 1] - y) < 0.0025
    return CP[S[m], 0].min(), CP[S[m], 0].max()
L = np.array([edges(SL, y) for y in YS]); R = np.array([edges(SR, y) for y in YS])
MARGIN = 0.005
TIP = 0.003  # sulla punta le strisce si stringono: lì il taglio non arriva
# bordo del taglio: sotto la striscia, al massimo a metà della sua larghezza
lcut = L[:, 1] - np.minimum(MARGIN, (L[:, 1] - L[:, 0]) * .45)
rcut = R[:, 0] + np.minimum(MARGIN, (R[:, 1] - R[:, 0]) * .45)
# la costina (girocollo) si toglie fin quasi al bordo esterno delle strisce: non resta nessun ritaglio accanto
lrib = L[:, 0] + 0.001; rrib = R[:, 1] - 0.001
def inside(Q, rib=False):
    y = np.clip(Q[:, 1], vbot, vtop)
    lo = np.interp(y, YS, lrib if rib else lcut); hi = np.interp(y, YS, rrib if rib else rcut)
    return (Q[:, 2] > 0.02) & (Q[:, 1] > vbot + TIP) & (Q[:, 1] < vtop + 0.012) & (Q[:, 0] > lo) & (Q[:, 0] < hi)

# stoffa davanti che copre il colletto (accanto alla cima delle strisce): si toglie, come sulla classica si vede il colletto
from scipy.spatial import cKDTree
HV = np.where(~np.isin(np.arange(len(CP)), SV))[0]  # solo le due metà del colletto (le strisce le gestisce il taglio a V)
ctree2 = cKDTree(CP[HV, :2]); s3 = cKDTree(CP[SV])
_n = np.zeros_like(CP); _f = np.cross(CP[CI[:, 1]] - CP[CI[:, 0]], CP[CI[:, 2]] - CP[CI[:, 0]])
for _k in range(3): np.add.at(_n, CI[:, _k], _f)
_n /= np.maximum(np.linalg.norm(_n, axis=1, keepdims=True), 1e-12); _n *= np.sign(_n[:, 2:3] + 1e-9)  # verso davanti
SN3 = _n[SV]
STRI = CI[np.isin(CI, SV).all(1)]; ttree = cKDTree(CP[STRI].mean(1))
def covers(Q):
    res = np.zeros(len(Q), bool)
    zone = (Q[:, 2] > 0.02) & (Q[:, 1] > vbot) & (Q[:, 1] < CP[:, 1].max()) & (np.abs(Q[:, 0]) < 0.08)
    for i in np.where(zone)[0]:
        near = ctree2.query_ball_point(Q[i, :2], 0.004)
        if not near: continue
        dz = Q[i, 2] - CP[HV[near], 2]
        res[i] = ((dz > 0.0003) & (dz < 0.015)).any()   # il colletto è appena dietro: la stoffa lo copre
        pass
    # stoffa davanti alle strisce (o appena sotto la loro superficie): solo dove cade dentro un triangolo della striscia
    for i in np.where(zone & ~res)[0]:
        for t in STRI[ttree.query(Q[i], k=6)[1]]:
            a_, b_, c_ = CP[t[0]], CP[t[1]], CP[t[2]]
            n = np.cross(b_ - a_, c_ - a_); ln = np.linalg.norm(n)
            if ln < 1e-12: continue
            n /= ln
            if n[2] < 0: n = -n
            h = (Q[i] - a_) @ n
            if not (-0.0008 < h < 0.015): continue
            p_ = Q[i] - h * n
            v0, v1, v2 = b_ - a_, c_ - a_, p_ - a_
            d00, d01, d11, d20, d21 = v0 @ v0, v0 @ v1, v1 @ v1, v2 @ v0, v2 @ v1
            den = d00 * d11 - d01 * d01
            if den <= 0: continue
            v = (d11 * d20 - d01 * d21) / den; w = (d00 * d21 - d01 * d20) / den
            if v >= 0 and w >= 0 and v + w <= 1: res[i] = True; break
    return res
g, a2 = load('/home/user/fantacapp/icons/kit3d/shirt-raglan.glb')
out = bytearray(b'NKC1' + struct.pack('<H', sum(len(m['primitives']) for m in g['meshes'])))
for mi, m in enumerate(g['meshes']):  # stesso ordine dei nodi (sleeveR, front, sleeveL, back, collar)
    n = [x for x in g['nodes'] if x['mesh'] == mi][0]; p = m['primitives'][0]
    P = a2(p['attributes']['POSITION']) * n['scale'][0] + np.array(n['translation'])
    I = a2(p['indices']).astype(int).reshape(-1, 3)
    if m['name'] == 'collar':
        cut = np.arange(len(I)).astype('<u4')  # col colletto alto la costina non serve (come sulla classica)
    else:
        cut = inside(P[I].mean(1))
        cut = np.where(cut)[0].astype('<u4')
    print(m['name'], 'tagliati', len(cut))
    for _ in m['primitives']: out += struct.pack('<I', len(cut)) + cut.tobytes()
open(OUT, 'wb').write(out); print('bytes', len(out))
