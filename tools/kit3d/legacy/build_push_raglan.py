# Raglan con colletto alto: la stoffa che resterebbe davanti al colletto o alle strisce si spinge appena dietro
# (pochi millimetri, solo i punti coperti), così il bordo del colletto la copre pulito, senza tagli a dentini.
# Formato come neck-polo.bin: 'NKP1', n. mesh, poi per mesh n, indici uint32, spostamenti int16 x3 (0,05 mm).
import os
import sys, os, struct; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from glb import load
import numpy as np
from scipy.spatial import cKDTree
OUT = sys.argv[1]
jc, ac = load('/home/user/fantacapp/icons/kit3d/collar-polo-raglan.glb')
CP = ac(0); CI = ac(1).astype(int).reshape(-1, 3)
C0 = np.array([0.0, 0, 0.006])
cen = CP[CI].mean(1); ctree = cKDTree(cen)
fn = np.cross(CP[CI[:, 1]] - CP[CI[:, 0]], CP[CI[:, 2]] - CP[CI[:, 0]])
fn /= np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-12)
out_dir = cen - C0; out_dir[:, 1] = 0.25
fn *= np.sign((fn * out_dir).sum(1))[:, None]   # verso fuori (via dal collo, un po' in su)
GAP = 0.0025
def push(P):
    D = np.zeros_like(P)
    cand = np.where((P[:, 1] > 1.45) & (np.hypot(P[:, 0] - C0[0], P[:, 2] - C0[2]) < 0.16))[0]
    for i in cand:
        best = 0.0; bn = None
        for t in ctree.query(P[i], k=10)[1]:
            a_, b_, c_ = CP[CI[t, 0]], CP[CI[t, 1]], CP[CI[t, 2]]; n = fn[t]
            h = (P[i] - a_) @ n
            if not (-GAP < h < 0.015): continue       # davanti al colletto (o quasi a contatto)
            p_ = P[i] - h * n
            v0, v1, v2 = b_ - a_, c_ - a_, p_ - a_
            d00, d01, d11, d20, d21 = v0 @ v0, v0 @ v1, v1 @ v1, v2 @ v0, v2 @ v1
            den = d00 * d11 - d01 * d01
            if den <= 0: continue
            v = (d11 * d20 - d01 * d21) / den; w = (d00 * d21 - d01 * d20) / den
            if v >= -0.02 and w >= -0.02 and v + w <= 1.04:   # cade sotto questo triangolo del colletto
                need = h + GAP
                if need > best: best = need; bn = n
        if bn is not None: D[i] = -bn * best
    return D
j, acc = load('/home/user/fantacapp/icons/kit3d/shirt-raglan.glb')
out = bytearray(b'NKP1' + struct.pack('<H', sum(len(m['primitives']) for m in j['meshes'])))
for mi, m in enumerate(j['meshes']):
    n = [x for x in j['nodes'] if x['mesh'] == mi][0]; p = m['primitives'][0]
    P = acc(p['attributes']['POSITION']) * n['scale'][0] + np.array(n['translation'])
    D = push(P) if m['name'] != 'collar' else np.zeros_like(P)
    idx = np.where(np.linalg.norm(D, axis=1) > 0.00005)[0]
    q = np.round(D[idx] * 20000).astype(np.int16)
    print(m['name'], 'spinti', len(idx), 'max %.1f mm' % (np.linalg.norm(D, axis=1).max() * 1000))
    for _ in m['primitives']:
        out += struct.pack('<I', len(idx)) + idx.astype('<u4').tobytes() + q.astype('<i2').tobytes()
open(OUT, 'wb').write(out); print('bytes', len(out))
