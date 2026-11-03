import json,struct,numpy as np
def load(path):
    b=open(path,'rb').read()
    L=struct.unpack_from('<I',b,12)[0]; j=json.loads(b[20:20+L]); bin0=20+L+8
    def acc(i):
        a=j['accessors'][i]; bv=j['bufferViews'][a['bufferView']]
        ct={5126:'<f4',5123:'<u2',5125:'<u4',5122:'<i2',5120:'<i1'}[a['componentType']]
        nc={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
        off=bin0+bv.get('byteOffset',0)+a.get('byteOffset',0)
        isz=np.dtype(ct).itemsize; st=bv.get('byteStride',isz*nc)
        raw=np.frombuffer(b,np.uint8,count=st*(a['count']-1)+isz*nc,offset=off)
        out=np.lib.stride_tricks.as_strided(raw.view(np.uint8),shape=(a['count'],isz*nc),strides=(st,1)).copy().view(ct).reshape(a['count'],nc).astype(np.float64)
        if a.get('normalized'): out/= {'<i2':32767,'<u2':65535,'<i1':127}[ct]
        return out
    return j,acc
