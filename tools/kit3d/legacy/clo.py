import struct,sys
def parse_map(b,o,end=None):
    n=b[o]; o+=1
    kl=list(b[o:o+n]); o+=n
    ty=list(b[o:o+n]); o+=n
    sz=list(struct.unpack_from('<%dI'%n,b,o)); o+=4*n
    out={}
    for i in range(n):
        k=b[o:o+kl[i]].decode('latin1'); o+=kl[i]
        v=b[o:o+sz[i]]
        out[k]=(ty[i],v,o)
        o+=sz[i]
    return out,o
def parse_list(b,o):
    pass
def show(b,o,depth=0,maxd=3,pref=''):
    m,e=parse_map(b,o)
    for k,(t,v,off) in m.items():
        s=f'{pref}{"  "*depth}{k} t={t:#x} size={len(v)} @{off}'
        if t==0x0f and len(v)<80: s+=' '+repr(v)
        if t in (1,4,5,6) and len(v)<=8: s+=' '+v.hex()
        print(s)
        if depth<maxd and t in (0x16,) and len(v)>0:
            try: show(b,off,depth+1,maxd,pref)
            except Exception as ex: print('  err',ex)
        if depth<maxd and t==0x14 and len(v)>4:
            cnt=struct.unpack_from('<I',v)[0]; print(f'{"  "*depth}  [list {cnt}]')
    return e
if __name__=='__main__':
    b=open(sys.argv[1],'rb').read()
    show(b,int(sys.argv[2]) if len(sys.argv)>2 else 0,0,int(sys.argv[3]) if len(sys.argv)>3 else 1)
