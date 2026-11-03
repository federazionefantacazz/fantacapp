# Trasforma lo scollo di una maglia in quello dell'altra (classica ↔ raglan) lavorando in coordinate cilindriche
# attorno all'asse del collo (x = 0, z = 0): angolo a (0 = davanti), altezza y, raggio r.
import os
import sys, struct; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if os.path.basename(os.path.dirname(os.path.abspath(__file__))) == 'legacy' else os.path.dirname(os.path.abspath(__file__)))
from g import *
from scipy.spatial import cKDTree
import scipy.sparse as sp, scipy.sparse.linalg as spl
STEP = 2.5
A = np.arange(-180, 180 + STEP, STEP)
def cyl(P):
    return np.degrees(np.arctan2(P[:, 0], P[:, 2])), np.hypot(P[:, 0], P[:, 2])
def edge_curves(P):
    """bordo basso e alto della costina: per ogni angolo (y, r) del punto più basso e più alto"""
    a, r = cyl(P); lo = []; hi = []
    for x in A:
        s = np.abs(((a - x + 180) % 360) - 180) < STEP * .8
        lo.append((P[s, 1].min(), r[s][np.argmin(P[s, 1])])); hi.append((P[s, 1].max(), r[s][np.argmax(P[s, 1])]))
    return np.array(lo), np.array(hi)
def at(curve, a):  # curva (len(A), 2) all'angolo a
    return np.stack([np.interp(a, A, curve[:, 0]), np.interp(a, A, curve[:, 1])], -1)
def smooth(curve, k=2):
    c = curve.copy()
    for _ in range(k): c[1:-1] = (c[:-2] + 2 * c[1:-1] + c[2:]) / 4
    return c
def to_xyz_delta(P, dy, dr):
    a, r = cyl(P); ar = np.radians(a)
    return np.stack([np.sin(ar) * dr, dy, np.cos(ar) * dr], 1)
def harmonic(P, I, fixed_idx, fixed_val):
    """spostamenti morbidi: valori fissati su alcuni vertici, il resto segue (Laplace con pesi uniformi)"""
    n = len(P)
    e = np.vstack([I[:, [0, 1]], I[:, [1, 2]], I[:, [2, 0]]]); e = np.vstack([e, e[:, ::-1]])
    W = sp.coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), shape=(n, n)).tocsr(); W.data[:] = 1
    L = sp.diags(np.asarray(W.sum(1)).ravel()) - W
    free = np.setdiff1d(np.arange(n), fixed_idx)
    D = np.zeros((n, 3)); D[fixed_idx] = fixed_val
    Lff = L[free][:, free].tocsc(); Lfc = L[free][:, fixed_idx]
    solve = spl.factorized(Lff)
    for k in range(3): D[free, k] = solve(-Lfc @ D[fixed_idx, k])
    return D
def boundary_vertices(I):
    return np.unique(np.concatenate(loops(I)))
def write_nkp1(path, per_mesh):
    out = bytearray(b'NKP1' + struct.pack('<H', len(per_mesh)))
    for D in per_mesh:
        idx = np.where(np.linalg.norm(D, axis=1) > 0.00005)[0]
        q = np.round(D[idx] * 20000).astype('<i2')
        out += struct.pack('<I', len(idx)) + idx.astype('<u4').tobytes() + q.tobytes()
    open(path, 'wb').write(out); return len(out)
