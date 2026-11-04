# Adattamento rigido della costina a V della classica sulla raglan (V_FIT in Kit3D.js).
# uso: python3 vfit3.py <peso petto, 0.3> <abbassamento dietro in m, 0.005> [file .npy di uscita, vfit3.npy]
from neckmorph import *
from scipy.optimize import minimize
PIV=np.array([0,1.52,0.])
SRC=mesh('setin',8)[0]
RLO=edge_curves(mesh('raglan',8)[0])[0]
F=np.vstack([mesh('raglan',k)[0] for k in (0,2,4,6)])
F=F[(F[:,1]>1.47)&(F[:,1]<1.63)]
fa,fr=cyl(F); ft=cKDTree(np.stack([np.radians(fa)*0.07,F[:,1]],1))
def fab_r(a,y):
    d,j=ft.query(np.stack([np.radians(a)*0.07,y],1),k=8); w=1/(d+1e-5); return (fr[j]*w).sum(1)/w.sum(1)
def xf(Q,p):
    dy,dz,tilt,s,sx,sz=p; c,si=np.cos(tilt),np.sin(tilt)
    q=(Q-PIV)*s; y=q[:,1]*c-q[:,2]*si; z=q[:,1]*si+q[:,2]*c
    return np.stack([q[:,0]*sx,y,z*sz],1)+PIV+np.array([0,dy,dz])
side=np.abs(A)>=60; fr_=~side
W=float(sys.argv[1]) if len(sys.argv)>1 else 1
# dietro la costina scende di DROP rispetto al collo della raglan (che sta 14 mm sopra la spalla, la classica 7 mm: la V
# sembrava rialzata): pieno da 150 gradi, niente sotto i 90; lì il raggio è quello della stoffa a quell'altezza
DROP=float(sys.argv[2]) if len(sys.argv)>2 else 0.0
drop=DROP*np.clip((np.abs(A)-90)/60,0,1)
def cost(p,verbose=False):
    lo=edge_curves(xf(SRC,p))[0]
    ty=RLO[side,0]-drop[side]
    tr=np.where(drop[side]>0, fab_r(A[side],ty), RLO[side,1])
    c1=np.mean((lo[side,0]-ty)**2)+np.mean((lo[side,1]-tr-0.0005)**2)
    fr2=lo[fr_,1]-fab_r(A[fr_],lo[fr_,0])-0.0005
    c2=np.mean(fr2**2)
    if verbose: print('side rms mm %.2f, front rms mm %.2f'%(np.sqrt(c1/2)*1000,np.sqrt(c2)*1000))
    return c1+W*c2
p0=np.array([0.006135,-0.000235,0.0577,0.9128,1.1,0.9445])
r=minimize(cost,p0,method='Nelder-Mead',options={'maxiter':6000,'xatol':1e-7,'fatol':1e-13})
p=r.x; print(p.tolist()); cost(p,True)
lo=edge_curves(xf(SRC,p))[0]
for i in range(0,len(A),6):
    print('%6.0f dy %+.1f (bersaglio %+.1f) | dr stoffa %+.1f'%(A[i],(lo[i,0]-RLO[i,0])*1000,-drop[i]*1000,(lo[i,1]-fab_r(A[i:i+1],lo[i:i+1,0])[0])*1000))
np.save(os.path.join(HERE, sys.argv[3] if len(sys.argv)>3 else 'vfit3.npy'), p)
