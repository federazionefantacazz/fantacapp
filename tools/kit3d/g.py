import os
import json, numpy as np
from collections import Counter, defaultdict
HERE = os.path.dirname(os.path.abspath(__file__))  # cartella degli strumenti (geo.json sta qui, vedi README)
_D=None
def data():
    global _D
    if _D is None: _D=json.load(open(os.path.join(HERE, 'geo.json')))
    return _D
def mesh(model, i):
    m=data()[model][i]
    P=np.array(m['P']).reshape(-1,3); N=np.array(m['N']).reshape(-1,3) if m['N'] else None
    U=np.array(m['U']).reshape(-1,2) if m['U'] else None
    I=np.array(m['I']).reshape(-1,3) if m['I'] else np.arange(len(P)).reshape(-1,3)
    return P,N,U,I
def loops(I):
    e=Counter()
    for t in I:
        for a,b in ((t[0],t[1]),(t[1],t[2]),(t[2],t[0])): e[tuple(sorted((a,b)))]+=1
    adj=defaultdict(list)
    for (a,b),v in e.items():
        if v==1: adj[a].append(b); adj[b].append(a)
    seen=set(); out=[]
    for s in adj:
        if s in seen: continue
        lp=[s]; seen.add(s); prev=None; cur=s
        while True:
            nx=[x for x in adj[cur] if x!=prev and x not in seen]
            if not nx: break
            prev,cur=cur,nx[0]; lp.append(cur); seen.add(cur)
        out.append(np.array(lp))
    return out
