import json,glob,math
import numpy as np
D='/home/claude/data/'
BR=[];[BR.extend(json.load(open(f))) for f in sorted(glob.glob(D+'g*.json'))]
names=[b['en'] for b in BR]; idx={n:i for i,n in enumerate(names)}; N=len(names)
MU=[];[MU.extend(json.load(open(f))) for f in sorted(glob.glob(D+'wr/b*.json'))]
MAPS=[];[MAPS.extend(json.load(open(f))) for f in sorted(glob.glob(D+'wr/m*.json'))]
lg=lambda p:math.log(p/(1-p))
# ---- 1. Bradley-Terry on metaforge matchups: logit(w)=g_A-g_B (+resid)
obs=[]
for b in MU:
  if not b['ok']:continue
  for o,w in b['strong']+b['weak']:
    obs.append((idx[b['en']],idx[o],lg(min(max(w,1),99)/100)))
X=np.zeros((len(obs),N));y=np.zeros(len(obs))
for r,(a,o,v) in enumerate(obs):X[r,a]=1;X[r,o]=-1;y[r]=v
lam=0.3
# tier prior
tierv={'S':1.2,'A':.6,'B':0,'C':-.6,'D':-1.2}
prior=np.array([tierv.get(next((m['tier'] for m in MU if m['en']==n),None),0) for n in names])
A=X.T@X+lam*np.eye(N); g=np.linalg.solve(A,X.T@y+lam*prior); g-=g.mean()
res=y-X@g
print('BT fit: obs',len(obs),'resid sd',res.std().round(3),'g range',g.min().round(2),g.max().round(2))
top=np.argsort(-g);print('top g',[(names[i],round(g[i],2)) for i in top[:8]]);print('bottom',[(names[i],round(g[i],2)) for i in top[-5:]])
# pair residuals
pr={}
for (a,o,v),r in zip(obs,res):
  pr.setdefault((a,o),[]).append(r);pr.setdefault((o,a),[]).append(-r)
print('pairs with resid',len(pr)//2)
# ---- 2. scale k: ranked bb map wr vs metaforge-based predictors
rows=[]
for m in MAPS:
  bb=m.get('bb');mf=(m.get('mf') or {}).get('rows',[])
  if not bb:continue
  tot=sum(r[3] for r in bb['rows']);avg=sum(r[1]*r[3] for r in bb['rows'])/tot
  mfd={n:w for n,w in mf}
  mfm=np.mean([lg(w/100) for w in mfd.values()]) if mfd else 0
  for n,w,p,c in bb['rows']:
    w2=min(max(w,1),99)/100
    rows.append((m['map'],n,lg(w2)-lg(avg/100),c,g[idx[n]],(lg(mfd[n]/100)-mfm) if n in mfd else None))
yy=np.array([r[2] for r in rows]);ww=np.array([r[3] for r in rows]);gg=np.array([r[4] for r in rows])
k=(ww*gg*yy).sum()/(ww*gg*gg).sum()
# noise variance of y ~ 1/(n p(1-p)) ~ 4/n
print('k (bb ~ k*g):',round(k,3),'corr',np.corrcoef(gg,yy)[0,1].round(3))
sub=[r for r in rows if r[5] is not None]
a=np.array([[r[4],r[5]] for r in sub]);b=np.array([r[2] for r in sub]);wt=np.array([r[3] for r in sub])
W=np.diag(wt);coef=np.linalg.solve(a.T@W@a,a.T@W@b);print('bb ~ c1*g + c2*mfdev:',coef.round(3),'n',len(sub))
# explained variance beyond sampling noise
pred=gg*k;resid=yy-pred;noise=np.mean(4/ww)
print('var y',yy.var().round(4),'resid var',resid.var().round(4),'sampling noise',round(noise,4))
np.save(D+'g.npy',g);json.dump({'k':k,'coef':coef.tolist()},open(D+'k.json','w'))
import pickle;pickle.dump({'pr':{f'{a},{o}':v for (a,o),v in pr.items()},'res_sd':float(res.std())},open(D+'pr.pkl','wb'))
