import os
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from glb import load
import numpy as np
from collections import Counter, defaultdict
def boundary_loops(I):
    e=Counter()
    for t in I:
        for a,b in ((t[0],t[1]),(t[1],t[2]),(t[2],t[0])): e[tuple(sorted((a,b)))]+=1
    adj=defaultdict(list)
    for (a,b),v in e.items():
        if v==1: adj[a].append(b); adj[b].append(a)
    return adj
j,acc=load('/home/user/fantacapp/icons/kit3d/collar-polo.glb')
CP=acc(0); CI=acc(1).astype(int).reshape(-1,3)
adj=boundary_loops(CI); cb=np.array(sorted(adj))
C0=np.array([0.0,0,0.006])
def ang(Q): return np.degrees(np.arctan2(Q[:,0]-C0[0],Q[:,2]-C0[2]))
CB=CP[cb]; ca=ang(CB)
def collar_bottom(a):
    out=[]
    for x in np.atleast_1d(a):
        d=np.abs((ca-x+180)%360-180); s=d<4
        q=CB[s]; i=np.argmin(q[:,1]); out.append((q[i,1], np.hypot(q[i,0]-C0[0],q[i,2]-C0[2])))
    return np.array(out)
