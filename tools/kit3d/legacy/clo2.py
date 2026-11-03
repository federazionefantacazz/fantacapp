import struct
class Raw:
    def __init__(s,t,b): s.t=t; s.b=b
    def __repr__(s): return f'<t{s.t:#x} {len(s.b)}B>'
def pmap(b,o):
    n=b[o]; o+=1
    kl=b[o:o+n]; o+=n
    ty=b[o:o+n]; o+=n
    sz=struct.unpack_from('<%dI'%n,b,o); o+=4*n
    out={}
    for i in range(n):
        k=b[o:o+kl[i]].decode('latin1'); o+=kl[i]
        out[k]=val(b,o,ty[i],sz[i]); o+=sz[i]
    return out
def plist(b,o,size):
    cnt=struct.unpack_from('<I',b,o)[0]; o+=4
    if cnt==0: return []
    et=b[o]; o+=1
    sz=struct.unpack_from('<%dI'%cnt,b,o); o+=4*cnt
    res=[]
    for s in sz: res.append(val(b,o,et,s)); o+=s
    return res
def val(b,o,t,s):
    if t==0x16: return pmap(b,o) if s else {}
    if t==0x14: return plist(b,o,s)
    v=b[o:o+s]
    if t==1: return v[0]
    if t==4 and s==4: return struct.unpack('<i',v)[0]
    if t==5 and s==4: return struct.unpack('<I',v)[0]
    if t==6 and s==4: return struct.unpack('<f',v)[0]
    if t==0x0f and not v[:0]: return v.decode('utf8') if all(32<=c<127 or c in (9,10,13) for c in v[:200]) else Raw(t,v)
    return Raw(t,v)
def tree(d,depth=0,maxd=9,maxl=3):
    pad='  '*depth
    if isinstance(d,dict):
        for k,v in d.items():
            if isinstance(v,(dict,list)):
                print(f'{pad}{k}: {"{...}" if isinstance(v,dict) else f"[{len(v)}]"}')
                if depth<maxd: tree(v,depth+1,maxd,maxl)
            else:
                s=repr(v); print(f'{pad}{k}= {s[:100]}')
    else:
        for i,v in enumerate(d[:maxl]):
            print(f'{pad}#{i}'); tree(v,depth+1,maxd,maxl) if isinstance(v,(dict,list)) else print(pad,repr(v)[:100])
