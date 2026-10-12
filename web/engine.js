/* 브롤 픽보드 승률 엔진 v2
   팀 로짓 = Σ맵파워(우리) − Σ맵파워(상대) + Σ맞상성(9쌍) + 조합(우리) − 조합(상대)
   - 맵파워: 경쟁전 21일 맵 승률(brawlbetter) + 상위 래더 맵 승률(metaforge)을 계층 베이즈 모델로 합친 값(로그 오즈, 맵 평균 대비)
   - 맞상성: metaforge 맞상대 승률을 Bradley–Terry로 브롤러 파워를 빼고 남은 잔차 ×0.6, 맵 성격 보정 추가
   - 미정 픽: 상대는 우리 픽을 보고 카운터를 고른다고 보고 몬테카를로 기대값
*/
const ENGINE=(function(){
"use strict";
let BR,MP,MD,N,IDX,PAIR,MAPS,MODE_OF;
const TEMP=0.85, K=48, MAIN_BONUS=0.15;
const OPENF={open:1,mixed:.4,closed:-.4};
const sig=x=>1/(1+Math.exp(-x));
function init(br,mp,md){BR=br;MP=mp;MD=md;N=BR.length;IDX={};BR.forEach((b,i)=>{IDX[b.en]=i;b.i=i});
  if(MD.order.some((n,i)=>BR[i].en!==n))throw new Error("model order mismatch");
  PAIR=new Map();MD.M.forEach(([a,o,v])=>{PAIR.set(a*N+o,v);PAIR.set(o*N+a,-v)});
  MAPS={};MODE_OF={};MP.modes.forEach(md=>md.maps.forEach(m=>{MAPS[m.en]=m;MODE_OF[m.en]=md.en}));
  BR.forEach(b=>{b.rng=b.range==null?6:b.range;b.T=new Set(b.tags)})}
// ---------- context ----------
function ctx(modeIdx,mapIdx,custom){if(modeIdx==null)return null;const md=MP.modes[modeIdx];const mp=mapIdx!=null&&mapIdx>=0?md.maps[mapIdx]:null;
  const traits=mp?mp.traits:[custom||"mixed"];const open=traits.includes("open")?"open":traits.includes("closed")?"closed":"mixed";
  const o=open==="open"?1:open==="closed"?-1:0;
  const S=mp&&MD.S[mp.en]?MD.S[mp.en]:MD.G[md.en+"|"+o];
  const popO=mp?(MD.POP[mp.en]||{}):{};const pop=new Float64Array(N);for(let i=0;i<N;i++)pop[i]=popO[i]!=null?popO[i]:0;
  if(!mp){// 맵 미지정: 파워 상위일수록 많이 고른다고 가정
    const ord=[...Array(N).keys()].sort((a,b)=>S[b]-S[a]);ord.forEach((i,r)=>{pop[i]=Math.max(0,25-r)})}
  const syn=new Map();if(mp)(MD.COMPS[mp.en]||[]).forEach(t=>{for(let x=0;x<3;x++)for(let y=0;y<3;y++)if(x!==y){const k=t[x]*N+t[y];syn.set(k,Math.min(.08,(syn.get(k)||0)+.04))}});
  const c={md,mp,key:md.en,open,of:OPENF[open],walls:traits.includes("walls many"),bushes:traits.includes("bushes many"),S,pop,syn,obs:mp?(MD.OBS[mp.en]||{}):{}};
  const MU=new Float32Array(N*N);for(let i=0;i<N;i++)for(let j=0;j<N;j++)if(i!==j)MU[i*N+j]=muRaw(i,j,c);c.MU=MU;return c}
const NEUTRAL={of:.4,walls:false,bushes:false,open:"mixed"};
// ---------- matchup ----------
function side(a,b,c){let v=.025*Math.max(-6,Math.min(6,a.rng-b.rng))*c.of;
  const cl=c.open==="closed"?1.5:c.open==="open"?.5:1;
  if(a.T.has("assassin")&&(b.T.has("marksman")||b.T.has("thrower")))v+=.06*cl*(c.bushes?1.2:1);
  if(a.T.has("thrower")&&(b.T.has("tank")||b.T.has("short")))v+=.05*(c.walls?1.5:1);
  if(a.T.has("wallbreak")&&b.T.has("thrower"))v+=.04;
  if(a.T.has("antiheal")&&b.T.has("heal"))v+=.05;
  if(a.T.has("cc")&&b.T.has("assassin"))v+=.04;
  if(a.T.has("dps")&&b.T.has("tank"))v+=.04;
  if((a.T.has("splash")||a.T.has("pierce"))&&b.T.has("spawn"))v+=.03;
  return v}
function mech(a,b,c){return Math.max(-.2,Math.min(.2,side(a,b,c)-side(b,a,c)))}
function hasData(i,j){return PAIR.has(i*N+j)}
function mu(i,j,c){if(c&&c.MU)return c.MU[i*N+j];return muRaw(i,j,c)}
function muRaw(i,j,c){const a=BR[i],b=BR[j];const cc=c||NEUTRAL;
  if(PAIR.has(i*N+j))return PAIR.get(i*N+j)+.5*(mech(a,b,cc)-mech(a,b,NEUTRAL));
  let h=0;if(a.strong.includes(b.en))h+=.05;if(b.weak.includes(a.en))h+=.05;if(b.strong.includes(a.en))h-=.05;if(a.weak.includes(b.en))h-=.05;
  return .5*mech(a,b,cc)+h}
// ---------- composition ----------
function comp(T,O,c){const out=[];if(!T.length)return{v:0,out};const has=t=>T.some(i=>BR[i].T.has(t));
  const cnt={};T.forEach(i=>{const k=BR[i].class;cnt[k]=(cnt[k]||0)+1});
  for(const k in cnt)if(cnt[k]>1)out.push([k+" 중복",-.06*(cnt[k]-1)-(k==="투척수"?.1:0)]);
  if(T.length===3){const mid=T.some(i=>BR[i].lane!=="side");if(!mid)out.push(["미드 맡을 브롤러 없음",-.08]);
    const sideN=T.filter(i=>BR[i].lane!=="mid").length;if(sideN<2)out.push(["사이드 부족",-.05])}
  const k=c?c.key:"";
  if(T.length>=2){
    if(k==="Heist"&&!has("dps")&&!has("burst"))out.push(["금고 딜 부족",-.15]);
    if(k==="Brawl Ball"&&!has("tank")&&!has("wallbreak")&&!has("assassin"))out.push(["돌파력 부족",-.08]);
    if(k==="Hot Zone"&&!has("area")&&!has("control")&&!has("tank"))out.push(["존 장악력 부족",-.1]);
    if((k==="Bounty"||k==="Knockout")&&!T.some(i=>BR[i].rng>=8))out.push(["장거리 견제 없음",-.1]);
    if(k==="Gem Grab"&&!has("control")&&!has("support")&&!has("area"))out.push(["광산 장악 약함",-.06])}
  if(has("heal"))out.push(["회복 보유",.04]);
  if(O.length){const oh=t=>O.filter(j=>BR[j].T.has(t)).length;
    const th=oh("thrower");if(th&&!has("wallbreak")&&!has("assassin"))out.push(["투척수 대응 수단 없음",-.07*Math.min(2,th)]);
    else if(th&&has("wallbreak"))out.push(["벽 파괴로 투척수 견제",.04]);
    const tk=oh("tank");if(tk&&!has("dps")&&!T.some(i=>BR[i].T.has("thrower")))out.push(["탱커 녹일 딜 부족",-.06*Math.min(2,tk)]);
    if(oh("assassin")&&!has("cc"))out.push(["암살자 끊을 CC 없음",-.05]);
    if(oh("heal")&&has("antiheal"))out.push(["치유 감소로 회복 견제",.03])}
  let syn=0;if(c)for(const a of T)for(const b of T)if(a<b){syn+=c.syn.get(a*N+b)||0}
  if(syn)out.push(["메타 추천 조합",syn]);
  return{v:out.reduce((s,x)=>s+x[1],0),out}}
// ---------- team eval ----------
function evalTeams(A,E,c,mains){let pw=0,mt=0;const S=c?c.S:null;
  if(S){A.forEach(i=>pw+=S[i]);E.forEach(j=>pw-=S[j])}
  A.forEach(i=>E.forEach(j=>mt+=mu(i,j,c)));
  const ca=comp(A,E,c),ce=comp(E,A,c);let pr=0;if(mains)A.forEach(i=>{if(mains.has(i))pr+=MAIN_BONUS});
  return{pw,mt,cp:ca.v-ce.v,pr,total:pw+mt+ca.v-ce.v+pr,ca,ce}}
// ---------- sampling ----------
function rng(seed){let s=seed>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
const U=(()=>{const r=rng(20261012),u=[];for(let k=0;k<K;k++){u.push([]);for(let s=0;s<6;s++)u[k].push(r())}return u})();
function weights(pool,c,vs,smart,forAlly){const w=new Float64Array(N);let tot=0;
  for(const j of pool){let lw=.7*Math.log(((c?c.pop[j]:5)||0)+.5);const s=c?c.S[j]:0;
    let cv=.5*s;for(const i of vs)cv+=forAlly?mu(j,i,c):mu(j,i,c);lw+=(smart?3:1.2)*cv;w[j]=Math.exp(lw);tot+=w[j]}
  return{w,tot}}
function draw(W,taken,u){let tot=W.tot;for(const t of taken)tot-=W.w[t]||0;let x=u*tot;
  for(let j=0;j<N;j++){if(!W.w[j]||taken.has(j))continue;x-=W.w[j];if(x<=0)return j}
  for(let j=N-1;j>=0;j--)if(W.w[j]&&!taken.has(j))return j;return -1}
/* state: {A:[idx|null x3], E:[idx|null x3], bans:[idx], c, mains:Set, smart:true}
   returns {p, lo, hi, parts:{pw,mt,cp,pr,unk}, counters:Map(j->weight*harm)} */
function simulate(st,KK){KK=KK||K;const c=st.c;const Ak=st.A.filter(x=>x!=null),Ek=st.E.filter(x=>x!=null);
  const nA=3-Ak.length,nE=3-Ek.length;if(!Ak.length&&!Ek.length&&!c)return null;
  const used=new Set([...Ak,...Ek,...(st.bans||[])]);const pool=[];for(let j=0;j<N;j++)if(!used.has(j))pool.push(j);
  const base=evalTeams(Ak,Ek,c,st.mains);
  if(!nA&&!nE){const L=base.total*TEMP;return{p:sig(L),lo:sig(L),hi:sig(L),parts:{pw:base.pw,mt:base.mt,cp:base.cp,pr:base.pr,unk:0},base,counters:new Map(),exact:true}}
  const WE=nE?weights(pool,c,Ak,st.smart!==false,false):null;const WA=nA?weights(pool,c,Ek,st.smart!==false,true):null;
  const ps=[];let sum=0,sp=0,smt=0,scp=0;const counters=new Map();
  for(let k=0;k<KK;k++){const taken=new Set();const A=Ak.slice(),E=Ek.slice();let s=0;
    for(let q=0;q<nE;q++){const j=draw(WE,taken,U[k][s++]);if(j<0)break;taken.add(j);E.push(j)}
    for(let q=0;q<nA;q++){const j=draw(WA,taken,U[k][s++]);if(j<0)break;taken.add(j);A.push(j)}
    const ev=evalTeams(A,E,c,st.mains);const L=ev.total*TEMP;ps.push(sig(L));sum+=sig(L);sp+=ev.pw;smt+=ev.mt;scp+=ev.cp;
    for(let q=Ek.length;q<E.length;q++){const j=E[q];let harm=0;for(const i of Ak)harm-=mu(i,j,c);harm+=c?c.S[j]:0;counters.set(j,(counters.get(j)||0)+harm/KK)}}
  ps.sort((a,b)=>a-b);const p=sum/KK;
  return{p,lo:ps[Math.floor(KK*.15)],hi:ps[Math.floor(KK*.85)],parts:{pw:sp/KK,mt:smt/KK,cp:scp/KK,pr:base.pr,unk:0},base,counters,exact:false}}
// ---------- recommend ----------
function recommend(st,slot,cands){const out=[];const Aother=st.A.map((x,i)=>i===slot?null:x);
  const knownE=st.E.filter(x=>x!=null);
  const banned=new Set(st.bans||[]);cands=cands.filter(x=>!banned.has(x));
  // 1차: 전체 후보를 24샘플로 훑고, 상위 14명만 48샘플 + 카운터 위험 정밀 계산
  const quick=cands.map(c=>{const A=Aother.slice();A[slot]=c;const r=simulate({A,E:st.E,bans:st.bans,c:st.c,mains:st.mains,smart:true},24);return[c,r?r.p:.5]});
  quick.sort((a,b)=>b[1]-a[1]);const fine=new Set(quick.slice(0,14).map(x=>x[0]));
  for(const c of cands){const A=Aother.slice();A[slot]=c;
    if(!fine.has(c)){const q=quick.find(x=>x[0]===c);out.push({i:c,p:q[1],lo:q[1],hi:q[1],parts:null,counter:null,score:Math.log(q[1]/(1-q[1]))-1});continue}
    const sm=simulate({A,E:st.E,bans:st.bans,c:st.c,mains:st.mains,smart:true});
    const rd=knownE.length<3?simulate({A,E:st.E,bans:st.bans,c:st.c,mains:st.mains,smart:false}):sm;
    const Ao=Aother.filter(x=>x!=null),Aw=[...Ao,c];
    const sPow=st.c?st.c.S[c]:0;let sKnown=0;knownE.forEach(j=>sKnown+=mu(c,j,st.c));
    const cpWith=comp(Aw,knownE,st.c).v-comp(knownE,Aw,st.c).v,cpWo=comp(Ao,knownE,st.c).v-comp(knownE,Ao,st.c).v;
    const L=x=>Math.log(x/(1-x));const risk=L(sm.p)-L(rd.p);
    let top=null,tv=0;if(knownE.length<3){for(const [j,w] of sm.counters){const h=-mu(c,j,st.c);if(h>.08&&h*w>tv){tv=h*w;top=j}}}
    out.push({i:c,p:sm.p,lo:sm.lo,hi:sm.hi,parts:{pw:sPow,mt:sKnown,cp:cpWith-cpWo,risk,pr:st.mains&&st.mains.has(c)?MAIN_BONUS:0},counter:top,score:L(sm.p)})}
  out.sort((a,b)=>b.score-a.score);return out}
// ---------- lanes ----------
function laneScore(i,c){const b=BR[i];const mp=c&&c.mp;
  const mid=(b.lane==="mid"?1:b.lane==="any"?.5:0)+(mp&&mp.midBest.includes(b.en)?.8:0)+(["tank","control","support","heal"].some(t=>b.T.has(t))?.2:0);
  const sd=(b.lane==="side"?1:b.lane==="any"?.5:0)+(mp&&mp.sideBest.includes(b.en)?.8:0)+(["marksman","assassin"].some(t=>b.T.has(t))?.2:0);return{mid,side:sd}}
function assign(T,c){const n=T.length;if(!n)return[];const sc=T.map(i=>laneScore(i,c));let best=0,bv=-1e9;
  for(let m=0;m<n;m++){let v=0;sc.forEach((s,k)=>{v+=k===m?s.mid:s.side});if(v>bv){bv=v;best=m}}
  return T.map((_,k)=>k===best?"mid":"side")}
function perms(a){if(a.length<=1)return[a];const r=[];a.forEach((x,i)=>perms([...a.slice(0,i),...a.slice(i+1)]).forEach(p=>r.push([x,...p])));return r}
function lanePlan(A,E,c){const la=assign(A,c),le=assign(E,c);const am=A.findIndex((_,k)=>la[k]==="mid"),em=E.findIndex((_,k)=>le[k]==="mid");
  // 미드는 미드끼리 우선, 나머지는 Σ맞상성 최대 배정
  const pairs=[];if(!E.length)return A.map((i,k)=>({lane:la[k],a:i,e:null}));
  let best=null,bv=-1e9;const Ei=E.map((_,k)=>k);
  for(const p of perms(Ei)){let v=0;for(let k=0;k<Math.min(A.length,p.length);k++){v+=mu(A[k],E[p[k]],c);if(k===am&&p[k]===em)v+=.25}if(v>bv){bv=v;best=p}}
  return A.map((i,k)=>({lane:la[k],a:i,e:best&&best[k]!=null?E[best[k]]:null}))}
function topMatchups(i,n){const arr=[];for(let j=0;j<N;j++)if(j!==i&&hasData(i,j))arr.push([j,PAIR.get(i*N+j)]);arr.sort((a,b)=>b[1]-a[1]);
  return{good:arr.slice(0,n).filter(x=>x[1]>0),bad:arr.slice(-n).reverse().filter(x=>x[1]<0)}}
return{init,ctx,mu,hasData,comp,evalTeams,simulate,recommend,assign,lanePlan,topMatchups,sig,TEMP,MAIN_BONUS,get N(){return N}}})();
if(typeof module!=="undefined")module.exports=ENGINE;
