import json,glob,math,pickle
import numpy as np
D='/home/claude/data/'
BR=[];[BR.extend(json.load(open(f))) for f in sorted(glob.glob(D+'g*.json'))]
names=[b['en'] for b in BR]; idx={n:i for i,n in enumerate(names)}; N=len(names)
MAPS=[];[MAPS.extend(json.load(open(f))) for f in sorted(glob.glob(D+'wr/m*.json'))]
MJ=json.load(open(D+'maps.json'))
mapinfo={mp['en']:(md['en'],mp['traits']) for md in MJ['modes'] for mp in md['maps']}
modes=[md['en'] for md in MJ['modes']]; mapnames=[mp['en'] for md in MJ['modes'] for mp in md['maps']]
g=np.load(D+'g.npy')
lg=lambda p:math.log(p/(1-p))
TAGS=sorted({t for b in BR for t in b['tags']}); CLS=sorted({b['class'] for b in BR})
def openness(tr): return 1 if 'open' in tr else -1 if 'closed' in tr else 0
# feature blocks: u_i (N), v_i,mode (N*6), w_i,map (N*26), tag x mode (T*6), class x openness (C*3), g, mfdev
nT=len(TAGS);nC=len(CLS);nM=len(modes);nP=len(mapnames)
off_u=0;off_v=N;off_w=off_v+N*nM;off_tm=off_w+N*nP;off_co=off_tm+nT*nM;off_g=off_co+nC*3;off_mf=off_g+1;P=off_mf+1
sd=np.zeros(P);sd[off_u:off_v]=.20;sd[off_v:off_w]=.12;sd[off_w:off_tm]=.18;sd[off_tm:off_co]=.08;sd[off_co:off_g]=.08;sd[off_g]=.5;sd[off_mf]=.5
def feats(n,mapn,mfdev):
  i=idx[n];mode,tr=mapinfo[mapn];mi=modes.index(mode);pi=mapnames.index(mapn);b=BR[i]
  f={off_u+i:1,off_v+i*nM+mi:1,off_w+i*nP+pi:1,off_g:g[i]}
  for t in b['tags']:f[off_tm+TAGS.index(t)*nM+mi]=1
  f[off_co+CLS.index(b['class'])*3+openness(tr)+1]=1
  if mfdev is not None:f[off_mf]=mfdev
  return f
def rowsfor(m):
  bb=m.get('bb');mf=(m.get('mf') or {}).get('rows',[])
  mfd={n:w for n,w in mf};mfm=np.mean([lg(w/100) for w in mfd.values()]) if mfd else 0
  out=[]
  if bb:
    tot=sum(r[3] for r in bb['rows']);avg=sum(r[1]*r[3] for r in bb['rows'])/tot
    for n,w,p,c in bb['rows']:
      out.append((n,lg(min(max(w,1),99)/100)-lg(avg/100),c,(lg(mfd[n]/100)-mfm) if n in mfd else None))
  return out,mfd,mfm
def fit(maps_used):
  F=[];y=[];wt=[]
  for m in MAPS:
    if m['map'] not in maps_used:continue
    rs,_,_=rowsfor(m)
    for n,v,c,mfd in rs:F.append(feats(n,m['map'],mfd));y.append(v);wt.append(c/4)  # precision n/4
  X=np.zeros((len(F),P))
  for r,f in enumerate(F):
    for k,v in f.items():X[r,k]=v
  y=np.array(y);W=np.array(wt)
  A=(X.T*W)@X+np.diag(1/sd**2);beta=np.linalg.solve(A,(X.T*W)@y)
  return beta
def predict(beta,n,mapn,mfdev):
  return sum(beta[k]*v for k,v in feats(n,mapn,mfdev).items())
# --- leave-one-map-out CV
allm={m['map'] for m in MAPS};tot_base=0;tot_mod=0;tot_n=0;cors=[]
for m in MAPS:
  if not m.get('bb'):continue
  beta=fit(allm-{m['map']})
  rs,_,_=rowsfor(m)
  yv=np.array([v for _,v,_,_ in rs]);pv=np.array([predict(beta,n,m['map'],d) for n,_,_,d in rs]);w=np.array([c for _,_,c,_ in rs])
  tot_base+=(w*yv**2).sum();tot_mod+=(w*(yv-pv)**2).sum();tot_n+=w.sum();cors.append(np.corrcoef(yv,pv)[0,1])
print('LOMO weighted MSE baseline',round(tot_base/tot_n,4),'model',round(tot_mod/tot_n,4),'mean corr',round(np.nanmean(cors),3))
beta=fit(allm)
print('coef g',beta[off_g].round(3),'mf',beta[off_mf].round(3))
tm=[(TAGS[t],modes[mi],round(beta[off_tm+t*nM+mi],3)) for t in range(nT) for mi in range(nM)];tm.sort(key=lambda x:-abs(x[2]));print('top tag x mode',tm[:12])
# --- export table S[brawler][map] (log-odds vs map avg), and mode-level generic per openness
S={}
for m in MAPS:
  _,mfd,mfm=rowsfor(m)
  S[m['map']]=[round(predict(beta,n,m['map'],(lg(mfd[n]/100)-mfm) if n in mfd else None),3) for n in names]
# generic per mode & openness (custom map): u + v_mode + tag x mode + class x open + g
G={}
for mi,mode in enumerate(modes):
  for o in (-1,0,1):
    vals=[]
    for i,n in enumerate(names):
      b=BR[i];v=beta[off_u+i]+beta[off_v+i*nM+mi]+beta[off_g]*g[i]+sum(beta[off_tm+TAGS.index(t)*nM+mi] for t in b['tags'])+beta[off_co+CLS.index(b['class'])*3+o+1]
      vals.append(round(v,3))
    G[f'{mode}|{o}']=vals
json.dump({'S':S,'G':G},open(D+'strength.json','w'))
for mp in ['Hard Rock Mine','Safe Zone','Shooting Star']:
  s=np.array(S[mp]);o=np.argsort(-s);print(mp,[(names[i],round(1/(1+math.exp(-s[i]))*100,1)) for i in o[:8]],'... worst',[(names[i],round(1/(1+math.exp(-s[i]))*100,1)) for i in o[-3:]])
print('S sd',np.std([v for s in S.values() for v in s]).round(3))
