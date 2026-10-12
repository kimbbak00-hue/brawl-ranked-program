(function(){
"use strict";
ENGINE.init(BR,MP,MD);
const E=ENGINE, NB=BR.length;
// ---------- data prep ----------
const byEn={}; BR.forEach(b=>{byEn[b.en]=b});
const CHO="ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ", NORM={"ㄲ":"ㄱ","ㄸ":"ㄷ","ㅃ":"ㅂ","ㅆ":"ㅅ","ㅉ":"ㅈ"};
function choOf(s){let r="";for(const ch of s){const c=ch.charCodeAt(0);if(c>=0xAC00&&c<=0xD7A3){const k=CHO[Math.floor((c-0xAC00)/588)];r+=NORM[k]||k}else if(/[A-Za-z0-9]/.test(ch))r+=ch.toUpperCase()}return r}
BR.forEach(b=>{b.cho=choOf(b.ko)});
const SORTED=[...BR].sort((a,b)=>a.ko.localeCompare(b.ko,"ko"));
const CLS_SHORT={"대미지 딜러":"딜러","탱커":"탱커","암살자":"암살자","저격수":"저격수","투척수":"투척수","서포터":"서포터","컨트롤러":"컨트롤러"};

// ---------- storage ----------
const store={get(k,d){try{const v=localStorage.getItem("bpb_"+k);return v==null?d:JSON.parse(v)}catch(e){return d}},
  set(k,v){try{localStorage.setItem("bpb_"+k,JSON.stringify(v))}catch(e){}}};
const S=Object.assign({mode:null,map:null,custom:"mixed",enemy:[null,null,null],ally:[null,null,null],bans:[null,null,null,null,null,null],me:0,tab:"rec",first:"us",panel:null},store.get("state",{}));
S.active=null;S.q="";S.openRec=null;S.ownQ="";if(!S.first)S.first="us";if(S.mode==null)S.panel="map";
let OWNED=store.get("owned",null); // null = 미설정(전체)
let MAINS=store.get("mains",[]);
function save(){store.set("state",{mode:S.mode,map:S.map,custom:S.custom,enemy:S.enemy,ally:S.ally,bans:S.bans,me:S.me,first:S.first,panel:S.panel})}

// ---------- helpers ----------
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
const B=en=>en?byEn[en]:null, I=en=>en?byEn[en].i:null;
const team=()=>S.ally.map(B).filter(Boolean), foes=()=>S.enemy.map(B).filter(Boolean);
const used=()=>new Set([...S.enemy,...S.ally,...S.bans].filter(Boolean));
function speedLbl(v){if(v==null)return"-";if(v<700)return"느림";if(v<=750)return"보통";if(v<=800)return"빠름";return"매우 빠름"}
const pct=p=>p==null?"--":Math.round(p*100)+"%";
const L=p=>Math.log(p/(1-p));
const pp=v=>(v>=0?"+":"−")+Math.abs(v).toFixed(1); // %p 표기
const lvOf=en=>MAINS.includes(en)?2:(!OWNED||OWNED.includes(en))?1:0;
function verdict(v){return v>.12?["유리","g"]:v<-.12?["불리","b"]:["비슷",""]}
// 로짓 기여 → 50% 기준 %p
const toPP=v=>(E.sig(v*E.TEMP)-.5)*100;

let CTX_KEY=null,CTX=null;
function ctx(){const k=S.mode+"|"+S.map+"|"+S.custom;if(k!==CTX_KEY){CTX_KEY=k;CTX=S.mode==null?null:E.ctx(S.mode,S.map,S.custom)}return CTX}
function engState(){return{A:S.ally.map(I),E:S.enemy.map(I),bans:S.bans.filter(Boolean).map(I),c:ctx(),mains:new Set(MAINS.map(I))}}
const stKey=()=>JSON.stringify([S.mode,S.map,S.custom,S.ally,S.enemy,S.bans,S.me,OWNED,MAINS]);
let SIM_K=null,SIM_V=null;function sim(){const k=stKey();if(k!==SIM_K){SIM_K=k;SIM_V=E.simulate(engState())}return SIM_V}
let REC_K=null,REC_V=[];
function recs(){const k=stKey();if(k===REC_K)return REC_V;REC_K=k;
  const u=used(),mine=S.ally[S.me];if(mine)u.delete(mine);
  const pool=BR.filter(b=>lvOf(b.en)>0&&!u.has(b.en)).map(b=>b.i);
  REC_V=pool.length?E.recommend(engState(),S.me,pool):[];return REC_V}
function mapStat(b){const c=ctx();if(!c)return null;const o=c.obs[b.i];
  if(o)return{t:"경쟁전 "+o[0]+"% · "+o[1].toLocaleString()+"판",real:true};
  return{t:"추정 "+Math.round(E.sig(c.S[b.i])*100)+"%",real:false}}
function mapRank(i){const c=ctx();if(!c)return null;let r=1;for(let j=0;j<NB;j++)if(c.S[j]>c.S[i])r++;return r}

// ---------- renderers ----------
function bar(label,v,max){const w=Math.min(50,Math.abs(v)/max*50);const cls=v>=0?"g":"b";
  return'<div class="bar"><span>'+label+'</span><span class="track"><span class="fill '+cls+'" style="'+(v>=0?"left:50%":"right:50%")+';width:'+w+'%"></span></span><span class="v '+cls+'">'+pp(v)+'</span></div>'}
const KEYROWS=["ㄱ","ㄴ","ㄷ","ㄹ","ㅁ","ㅂ","ㅅ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
function keypad(act,small){return'<div class="keys'+(small?" small":"")+'">'+KEYROWS.map(k=>'<button class="key" data-act="'+act+'" data-v="'+k+'">'+k+'</button>').join("")+
  '<button class="key fn" data-act="'+act+'" data-v="8">8</button><button class="key fn" data-act="'+act+'" data-v="R">R</button><button class="key fn" data-act="'+act+'" data-v="P">P</button>'+
  '<button class="key wide fn" data-act="'+act+'" data-v="BK">⌫ 지우기</button><button class="key wide fn" data-act="'+act+'" data-v="CL">처음부터</button></div>'}
function search(q,list){if(!q)return null;const a=[],b=[];list.forEach(x=>{if(x.cho.startsWith(q))a.push(x);else if(x.cho.includes(q))b.push(x)});return a.concat(b)}
function suggestions(){const c=ctx(),u=used(),{side,i}=S.active;let list=[];
  if(side==="ally"&&i===S.me)list=recs().map(r=>BR[r.i]);
  else if(c){const ord=[...Array(NB).keys()].sort((a,b)=>(c.pop[b]+c.S[b]*20)-(c.pop[a]+c.S[a]*20));list=ord.map(j=>BR[j])}
  return list.filter(b=>!u.has(b.en)).slice(0,9)}
function recChips(r){const P=r.parts,out=[];const c=ctx();
  const others=S.ally.map(I).filter((x,k)=>x!=null&&k!==S.me);let ln;
  if(others.length){const lane=E.assign([...others,r.i],c);ln=lane[lane.length-1]}else{const b=BR[r.i];ln=b.lane==="mid"?"mid":b.lane==="side"?"side":(c&&c.mp&&c.mp.sideBest.includes(b.en)?"side":"mid")}
  out.push([ln==="mid"?"미드":"사이드","l"]);if(!P)return out;
  const rk=c?mapRank(r.i):null;
  if(c)out.push(["맵 "+pp(toPP(P.pw))+(rk<=10?" ("+rk+"위)":""),P.pw>.03?"g":P.pw<-.03?"b":""]);
  if(foes().length)out.push(["상성 "+pp(toPP(P.mt)),P.mt>.03?"g":P.mt<-.03?"b":""]);
  if(Math.abs(P.cp)>.02)out.push(["조합 "+pp(toPP(P.cp)),P.cp>0?"g":"b"]);
  if(P.risk<-.04)out.push(["카운터 위험 "+pp(toPP(P.risk))+(r.counter!=null?" ("+BR[r.counter].ko+")":""),"b"]);
  if(P.pr)out.push(["주력 "+pp(toPP(P.pr)),"g"]);
  return out}
function tabRec(){const c=ctx();let h="";
  if(!c)h+='<div class="note">맵을 고르면 그 맵 경쟁전 승률이 반영돼요.</div>';
  if(!OWNED)h+='<div class="note">‘내 브롤러’ 탭에서 11렙(보유)과 ★주력을 정하면 그 안에서만 추천하고 주력은 가산점을 줘요.</div>';
  const R=recs().filter(r=>r.parts).slice(0,8);if(!R.length)return h+'<div class="empty-state">고를 수 있는 브롤러가 없어요. 내 브롤러 목록을 확인하세요.</div>';
  const exact=R[0].lo===R[0].hi;
  h+='<div>';R.forEach((r,k)=>{const b=BR[r.i],open=S.openRec===b.en;
    h+='<div class="rec" role="button" tabindex="0" data-act="openRec" data-v="'+esc(b.en)+'"><span class="rk">'+(k+1)+'</span><span class="nm">'+(MAINS.includes(b.en)?"★":"")+esc(b.ko)+'<small>'+CLS_SHORT[b.class]+'</small></span><span class="pct num">'+pct(r.p)+'</span>'+
      (exact?'':'<span class="rng num">'+Math.round(r.lo*100)+'–'+Math.round(r.hi*100)+'</span>')+
      '<span class="why">'+recChips(r).map(w=>'<span class="tag chipv '+w[1]+'">'+esc(w[0])+'</span>').join("")+'</span>'+
      (open?'<div class="recbody">'+card(b,"a")+'<button class="pickme" data-act="pickMe" data-v="'+esc(b.en)+'">이걸로 픽</button></div>':'')+'</div>'});
  h+='</div><div class="note">%p는 각 요소가 승률을 얼마나 올리고 내리는지예요. 카운터 위험은 남은 상대 픽이 이 브롤러를 저격할 때 깎이는 몫이에요. 승률 아이콘을 누르면 계산 근거가 나와요.</div>';return h}
function tabLane(){const c=ctx(),T=S.ally.map(I).filter(x=>x!=null),En=S.enemy.map(I).filter(x=>x!=null);
  if(!T.length)return'<div class="empty-state">우리 팀 픽을 넣으면 미드·사이드와 맞상대를 짜줘요.</div>';
  let h=c?'<div class="lanedesc">'+esc(c.md.lanes)+'</div>':'';
  E.lanePlan(T,En,c).forEach(({lane,a,e})=>{const v=e!=null?E.mu(a,e,c):0,vd=verdict(v);
    h+='<div class="match"><span class="lane">'+(lane==="mid"?"미드":"사이드")+'</span><span class="who a">'+esc(BR[a].ko)+'</span><span class="vs">vs</span><span class="who e">'+(e!=null?esc(BR[e].ko):"?")+'</span>'+
      (e!=null?'<span class="verdict"><span class="tag '+vd[1]+'">'+vd[0]+' '+pp(toPP(v))+'</span> '+laneTip(a,e,v)+(E.hasData(a,e)?'':' <span class="tag">추정</span>')+'</span>':'<span class="verdict note">상대 픽이 들어오면 맞상대를 정해요</span>')+'</div>'});
  if(En.length){h+='<div class="targets">';T.forEach(a=>{const s=En.map(e=>[e,E.mu(a,e,c)]).sort((x,y)=>y[1]-x[1]);const best=s[0],worst=s[s.length-1];
    h+='<div class="tgt"><b>'+esc(BR[a].ko)+'</b> — 노릴 적: <span class="tag g">'+esc(BR[best[0]].ko)+' '+pp(toPP(best[1]))+'</span>'+(worst[0]!==best[0]&&worst[1]<-.05?' · 피할 적: <span class="tag b">'+esc(BR[worst[0]].ko)+' '+pp(toPP(worst[1]))+'</span>':'')+'</div>'});h+='</div>'}
  return h}
function laneTip(a,e,v){if(v>.12)return esc(BR[a].ko)+"가 라인 주도권을 잡기 좋아요";if(v<-.12)return"정면 대결은 피하고 팀원과 같이 싸우세요";return"실력 싸움, 슈퍼 타이밍이 중요해요"}
function card(b,side){const c=ctx(),En=side==="e"?team():foes();const ms=mapStat(b);
  const tm=E.topMatchups(b.i,3);
  const good=tm.good.length?tm.good.map(([j,v])=>'<span class="tag g">'+esc(BR[j].ko)+'</span>').join(""):b.strong.map(n=>'<span class="tag g">'+esc(byEn[n]?byEn[n].ko:n)+'</span>').join("");
  const bad=tm.bad.length?tm.bad.map(([j,v])=>'<span class="tag b">'+esc(BR[j].ko)+'</span>').join(""):b.weak.map(n=>'<span class="tag b">'+esc(byEn[n]?byEn[n].ko:n)+'</span>').join("");
  let h='<div class="card '+side+'"><div class="chead"><span class="nm">'+esc(b.ko)+'</span><span class="en">'+esc(b.en)+'</span><span class="cls">'+esc(b.class)+' · '+esc(b.rarity)+'</span></div>'+
  '<div class="stats"><div class="stat"><small>체력 11렙</small><b class="num">'+(b.hp?b.hp.toLocaleString():"-")+'</b></div><div class="stat"><small>이동 속도</small><b>'+speedLbl(b.speed)+'</b></div><div class="stat"><small>사거리</small><b class="num">'+(b.range!=null?b.range+"칸":"-")+'</b></div>'+
  (ms?'<div class="stat wide"><small>이 맵 성적'+(ms.real?'':' (데이터 부족)')+'</small><b class="num">'+esc(ms.t)+'</b></div>':'')+'</div>'+
  '<dl class="kv"><dt>공격</dt><dd>'+esc(b.atk)+'</dd><dt>슈퍼</dt><dd>'+esc(b.sup)+'</dd>'+
  b.gad.map((g,k)=>'<dt>'+(k?"":"가젯")+'</dt><dd><b>'+esc(g[0])+'</b> '+esc(g[1])+'</dd>').join("")+
  b.sp.map((g,k)=>'<dt>'+(k?"":"스타파워")+'</dt><dd><b>'+esc(g[0])+'</b> '+esc(g[1])+'</dd>').join("")+
  '<dt>하이퍼</dt><dd>'+(b.hyper?"있음":"없음")+'</dd><dt>팁</dt><dd>'+esc(b.note)+'</dd></dl>'+
  '<div class="cnt">잘 잡음 '+good+'</div><div class="cnt">약함 '+bad+'</div>';
  if(En.length)h+='<div class="cnt">'+(side==="e"?"우리 픽 기준 ":"지금 상대 ")+En.map(e=>{const v=side==="e"?E.mu(e.i,b.i,c):E.mu(b.i,e.i,c),vd=verdict(v);return'<span class="tag '+vd[1]+'">'+esc(e.ko)+' '+pp(toPP(v))+'</span>'}).join("")+'</div>';
  return h+'</div>'}
function tabInfo(){const En=foes(),T=team();if(!En.length&&!T.length)return'<div class="empty-state">픽을 넣으면 체력·가젯·스타파워 요약이 여기 떠요.</div>';
  return En.map(b=>card(b,"e")).join("")+T.map(b=>card(b,"a")).join("")}
function tabOwn(){const list=search(S.ownQ,SORTED)||SORTED;const n=BR.filter(b=>lvOf(b.en)>0).length;
  let h='<div class="ownbar"><button class="ghost" data-act="ownAll">전체 보유</button><button class="ghost" data-act="ownNone">전체 해제</button><span class="count num">보유 '+(OWNED?n:"전체")+' · ★'+MAINS.length+'</span></div>'+
  '<div class="legend"><span><i style="background:var(--panel);border:1px solid var(--line)"></i>없음</span><span><i style="background:var(--blue-bg);border:1px solid var(--blue)"></i>11렙 보유</span><span><i style="background:var(--gold)"></i>★주력 (승률 +약 3%p 가산)</span></div>'+
  '<div class="note">누를 때마다 없음 → 보유 → ★주력 순으로 바뀌어요.'+(S.ownQ?' 검색: <b>'+esc(S.ownQ)+'</b>':'')+'</div>'+keypad("ownKey",true)+'<div class="owngrid">';
  list.forEach(b=>{const lv=lvOf(b.en);h+='<button class="own" data-act="own" data-v="'+esc(b.en)+'" data-lv="'+lv+'" aria-pressed="'+(lv>0)+'">'+(lv===2?"★":"")+esc(b.ko)+'</button>'});
  return h+'</div>'}
function htmlWhy(){const r=sim();
  if(!r)return'<div class="empty-state">픽을 하나 이상 넣으면 승률과 근거가 나와요.</div>';
  const c=ctx(),P=r.parts;
  // 순서대로 누적해 %p 분해 (합 = 최종 승률 − 50)
  let acc=0;const steps=[["맵 파워",P.pw],["맞상성",P.mt],["조합",P.cp],["주력 숙련",P.pr]].map(([k,v])=>{const a=E.sig(acc*E.TEMP),b=E.sig((acc+v)*E.TEMP);acc+=v;return[k,(b-a)*100]});
  const rest=r.p*100-E.sig(acc*E.TEMP)*100;if(!r.exact&&Math.abs(rest)>=.3)steps.push(["미정 픽 변동",rest]);
  const mx=Math.max(4,...steps.map(s=>Math.abs(s[1])));
  let h='<div class="why">';
  steps.forEach(([k,v])=>{if(k==="주력 숙련"&&!v)return;h+=bar(k,v,mx)});
  const ca=r.base.ca.out,ce=r.base.ce.out;
  if(ca.length||ce.length){h+='<div class="notes">'+ca.map(x=>'<span class="tag '+(x[1]>0?"g":"b")+'">우리: '+esc(x[0])+'</span>').join("")+ce.map(x=>'<span class="tag '+(x[1]>0?"b":"g")+'">상대: '+esc(x[0])+'</span>').join("")+'</div>'}
  // 신뢰도
  const A=S.ally.map(I).filter(x=>x!=null),En=S.enemy.map(I).filter(x=>x!=null);let pairs=0,dp=0;A.forEach(i=>En.forEach(j=>{pairs++;if(E.hasData(i,j))dp++}));
  const picks=[...A,...En];const real=c?picks.filter(i=>c.obs[i]).length:0;
  const lvl=!c?"낮음":(picks.length>=5&&real>=3)?"높음":(picks.length>=3)?"보통":"낮음";
  h+='<div class="conf">신뢰도 <b>'+lvl+'</b> · 맵 실데이터 '+real+'/'+picks.length+'명 · 맞상성 실데이터 '+dp+'/'+pairs+'쌍'+(r.exact?'':' · 빈 칸 '+(6-picks.length)+'개는 상대가 카운터를 고른다고 가정한 기대값')+'</div>';
  h+='<details class="how"><summary>계산 방식</summary><ol>'+
    '<li><b>맵 파워</b>: 이 맵 경쟁전 상위권 21일 승률(brawlbetter)과 상위 래더 맵 승률(metaforge)을 브롤러·모드·맵 3단 베이즈 모델로 합쳐요. 표본이 적은 브롤러는 같은 모드의 다른 맵 성적 쪽으로 당겨져요.</li>'+
    '<li><b>맞상성</b>: 1,272개 맞상대 승률에서 브롤러 자체 파워를 Bradley–Terry 모델로 빼고 남은 순수 상성만 써요. 데이터가 없는 쌍은 사거리 차이×맵 개방도, 역할 상성 규칙으로 보충해요.</li>'+
    '<li><b>조합</b>: 역할 중복, 미드·사이드 구성, 모드별 필수 역할, 상대 투척수·탱커·암살자 대응 수단, 메타 3인 조합을 더하고 빼요.</li>'+
    '<li><b>빈 칸</b>: 상대는 이 맵 픽률과 우리 픽 카운터를 고려해 고른다고 보고 48번 시뮬레이션한 평균이에요. 괄호는 그중 중간 70% 범위예요.</li>'+
    '<li>모든 항을 로그 오즈로 더한 뒤 과신을 줄이려 0.85배 해서 확률로 바꿔요. 실력·레벨·트로피 차이는 모르니 반영 안 돼요.</li></ol>'+
    '<div>검증: 한 맵 데이터를 빼고 나머지로 그 맵 승률을 예측하면 상관 0.26(맵마다 특성이 커서). 데이터가 있는 맵은 실측과 0.98 일치.</div></details></div>';
  return h}
function htmlMap(){
  let h='<div class="label">경쟁전 모드</div><div class="chips">';
  MP.modes.forEach((m,i)=>{h+='<button class="chip" data-act="mode" data-v="'+i+'" aria-pressed="'+(S.mode===i)+'">'+esc(m.ko)+'</button>'});h+="</div>";
  if(S.mode!=null){const md=MP.modes[S.mode];h+='<div class="label" style="margin-top:9px">맵</div><div class="chips">';
    md.maps.forEach((m,i)=>{h+='<button class="chip" data-act="map" data-v="'+i+'" aria-pressed="'+(S.map===i)+'">'+esc(m.ko||m.en)+'</button>'});
    h+='<button class="chip" data-act="map" data-v="-1" aria-pressed="'+(S.map===-1)+'">목록에 없음</button></div>';
    if(S.map===-1){h+='<div class="label" style="margin-top:9px">맵 성격</div><div class="chips">';
      [["open","개방형 (저격 유리)"],["mixed","혼합형"],["closed","폐쇄형 (벽·근접 유리)"]].forEach(([k,t])=>{h+='<button class="chip" data-act="custom" data-v="'+k+'" aria-pressed="'+(S.custom===k)+'">'+t+'</button>'});h+="</div>"}
    const c=ctx();const mp=c&&c.mp;
    if(c){const ord=[...Array(NB).keys()].sort((a,b)=>c.S[b]-c.S[a]).slice(0,6);
      h+='<div class="mapdesc">'+(mp?esc(mp.en)+' · '+esc(mp.desc)+'<br>':'')+'이 맵 파워 상위: '+ord.map(i=>esc(BR[i].ko)+' '+Math.round(E.sig(c.S[i])*100)).join(", ")+'</div>'}
    h+='<div class="mapdesc">'+esc(md.lanes)+'</div>'}
  h+='<div class="warn">'+esc(MP.season)+(new Date()>new Date(MP.end+"T23:59:59+09:00")?" — 시즌이 끝나 맵이 바뀌었을 수 있어요. 없으면 ‘목록에 없음’을 쓰세요.":"")+'</div>';
  return h}
// ---------- draft order (경쟁전 1-2-2-1) ----------
function draftOrder(){return S.first==="us"?[["ally",0],["enemy",0],["enemy",1],["ally",1],["ally",2],["enemy",2]]:[["enemy",0],["ally",0],["ally",1],["enemy",1],["enemy",2],["ally",2]]}
function pickNo(side,i){return draftOrder().findIndex(([s,k])=>s===side&&k===i)+1}
function curStep(){return draftOrder().find(([s,k])=>!S[s][k])||null}
function nextActive(side){if(side==="bans"){const j=S.bans.findIndex(x=>!x);return j>=0?{side:"bans",i:j}:null}
  const c=curStep();return c?{side:c[0],i:c[1]}:null}
// ---------- pieces ----------
function slotHtml(side,i){const en=S[side][i],b=B(en),act=S.active&&S.active.side===side&&S.active.i===i;
  const me=side==="ally"&&i===S.me?'<span class="me">나</span>':"";const no=pickNo(side,i);
  return'<button class="slot'+(b?" filled":"")+(act?" active":"")+'" data-act="slot" data-side="'+side+'" data-i="'+i+'">'+me+
    (b?'<span class="nm">'+esc(b.ko)+'</span><span class="cl">'+no+'픽 · '+CLS_SHORT[b.class]+'</span>':'<span class="empty">'+no+'픽</span>')+'</button>'}
function htmlPicker(){if(!S.active)return"";const {side,i}=S.active;
  const who=side==="enemy"?"상대 "+pickNo(side,i)+"픽":side==="bans"?"밴 "+(i+1):(i===S.me?"내 픽":"우리 "+pickNo(side,i)+"픽");
  const cur=B(S[side][i]);const u=used();if(cur)u.delete(cur.en);
  let res=search(S.q,SORTED);let h='<section class="picker"><div class="pickhead"><span class="who">'+who+'</span><span class="q">'+esc(S.q)+'</span>'+
    (cur?'<button class="ghost" data-act="clearSlot">비우기</button>':'')+'<button class="ghost" data-act="closePick">닫기</button></div><div class="results">';
  if(res){res=res.filter(b=>!u.has(b.en));if(!res.length)h+='<div class="noq">맞는 브롤러가 없어요</div>';
    res.slice(0,12).forEach((b,k)=>{h+='<button class="res'+(k===0?" top":"")+'" data-act="pick" data-v="'+esc(b.en)+'">'+esc(b.ko)+'<small>'+CLS_SHORT[b.class]+'</small></button>'})}
  else{const sg=suggestions();if(sg.length){h+='<div class="noq">'+(side==="ally"&&i===S.me?"추천 순":side==="bans"?"이 맵에서 많이 나오는 강픽":"이 맵에서 많이 나오는 픽")+'</div>';
      sg.forEach(b=>{h+='<button class="res" data-act="pick" data-v="'+esc(b.en)+'">'+esc(b.ko)+'<small>'+CLS_SHORT[b.class]+'</small></button>'})}
    else h+='<div class="noq">초성을 누르세요. 예) ㅅㄹ → 쉘리</div>'}
  return h+"</div>"+keypad("key")+"</section>"}
function htmlBan(){let h='<div class="banbig">'+S.bans.map((en,i)=>{const b=B(en),act=S.active&&S.active.side==="bans"&&S.active.i===i;
    return'<button class="ban'+(b?" filled":"")+(act?" active":"")+'" data-act="slot" data-side="bans" data-i="'+i+'">'+(b?esc(b.ko):"밴 "+(i+1))+'</button>'}).join("")+'</div>';
  return h+(S.active&&S.active.side==="bans"?htmlPicker():'<div class="note">칸을 눌러 밴된 브롤러를 넣으세요. 밴은 추천·예측에서 빠져요.</div>')}
function htmlPick(){const st=curStep();
  let h='<div class="opts"><div><div class="label">선픽</div><div class="seg"><button data-act="first" data-v="us" aria-pressed="'+(S.first==="us")+'">우리</button><button data-act="first" data-v="them" aria-pressed="'+(S.first==="them")+'">상대</button></div></div>'+
    '<div><div class="label">나는 우리 팀</div><div class="seg">'+[0,1,2].map(k=>'<button data-act="me" data-v="'+k+'" aria-pressed="'+(S.me===k)+'">'+pickNo("ally",k)+'픽</button>').join("")+'</div></div></div>';
  h+='<div class="order">'+draftOrder().map(([s,k],n)=>{const b=B(S[s][k]);const cur=st&&st[0]===s&&st[1]===k;
    return'<button class="oc '+(s==="ally"?"a":"e")+(b?" f":"")+(cur?" cur":"")+'" data-act="slot" data-side="'+s+'" data-i="'+k+'"><small>'+(n+1)+(s==="ally"?(k===S.me?" 나":" 우리"):" 상대")+'</small>'+(b?esc(b.ko):"–")+'</button>'}).join("")+'</div>';
  h+='<div class="row enemy"><div class="side">상대</div>'+[0,1,2].map(i=>slotHtml("enemy",i)).join("")+'</div><div class="row ally"><div class="side">우리</div>'+[0,1,2].map(i=>slotHtml("ally",i)).join("")+'</div>';
  return h+(S.active&&S.active.side!=="bans"?htmlPicker():(st?'':'<div class="note">픽이 다 끝났어요. 라인·정보 아이콘에서 맞상대를 확인하세요.</div>'))}
// ---------- rail ----------
const ICONS={
 map:'<path d="M12 21s-6-5.6-6-10a6 6 0 0 1 12 0c0 4.4-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/>',
 ban:'<circle cx="12" cy="12" r="8"/><path d="M6.4 6.4l11.2 11.2"/>',
 pick:'<rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="4" width="7" height="7" rx="1.6"/><rect x="4" y="13" width="7" height="7" rx="1.6"/><rect x="13" y="13" width="7" height="7" rx="1.6"/>',
 rec:'<path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z"/>',
 win:'<path d="M4 17a8 8 0 0 1 16 0"/><path d="M12 17l4.2-5"/>',
 lane:'<path d="M5 20L9 4M12 20V4M19 20L15 4"/>',
 info:'<circle cx="12" cy="12" r="8"/><path d="M12 11v5M12 8h.01"/>',
 own:'<circle cx="12" cy="8" r="3.4"/><path d="M5 20a7 7 0 0 1 14 0"/>',
 newg:'<path d="M5 12a7 7 0 0 1 12-4.9M19 4v4h-4M19 12a7 7 0 0 1-12 4.9M5 20v-4h4"/>'};
const PANES={map:"맵",ban:"밴",pick:"픽",rec:"추천",win:"승률",lane:"라인",info:"정보",own:"내 것"};
const MODE_SHORT={"Gem Grab":"젬","Brawl Ball":"볼","Heist":"하이","Bounty":"바운","Knockout":"녹아","Hot Zone":"핫존"};
const NATIVE=!!(window.Android&&window.Android.isNative);
const isNarrow=()=>!NATIVE&&window.innerWidth<190;
window.__setSide=s=>{document.documentElement.classList.toggle("rside",s==="right")};
let NEXP=null;function syncNative(){if(!NATIVE)return;const want=!!S.panel;if(want!==NEXP){NEXP=want;try{window.Android.setExpanded(want)}catch(e){}}}
function renderRail(){const c=ctx(),r=sim(),st=curStep(),myTurn=st&&st[0]==="ally"&&st[1]===S.me;const R=recs().filter(x=>x.parts)[0];
  const nb=S.bans.filter(Boolean).length;
  const bd={map:c?[MODE_SHORT[c.md.en]||"",""]:["선택","y"],ban:[nb?"밴"+nb:"",""],
    pick:st?[(st[0]==="ally"?(myTurn?"나":"우"):"상")+pickNo(st[0],st[1])+"픽",st[0]==="ally"?"u":"r"]:["끝",""],
    rec:R?[BR[R.i].ko.replace(/ /g,"").slice(0,3),"y"]:["",""],win:r?[pct(r.p),r.p>=.55?"g":r.p<=.45?"b":""]:["--",""],lane:["",""],info:["",""],own:[OWNED?"★"+MAINS.length:"설정","y"]};
  let h="";["map","ban","pick","rec","win","lane","info"].forEach(k=>{
    const turn=k==="rec"&&myTurn&&!!c;const txt=bd[k][0];
    h+='<button class="ri'+(turn?" turn":"")+'" data-act="pane" data-v="'+k+'" aria-pressed="'+(S.panel===k)+'" aria-label="'+PANES[k]+(txt?" "+esc(txt):"")+'"><svg viewBox="0 0 24 24" aria-hidden="true">'+ICONS[k]+'</svg>'+(txt?'<span class="bd '+bd[k][1]+'">'+esc(txt)+'</span>':'<span class="lb">'+PANES[k]+'</span>')+'</button>'});
  h+='<div class="gap"></div>';
  if(S.panel&&isNarrow())h+='<div class="hint">창을 오른쪽으로 넓히면 열려요 →</div>';
  h+='<button class="ri" data-act="pane" data-v="own" aria-pressed="'+(S.panel==="own")+'" aria-label="내 브롤러"><svg viewBox="0 0 24 24" aria-hidden="true">'+ICONS.own+'</svg><span class="bd y">'+esc(bd.own[0])+'</span></button>';
  h+='<button class="ri" data-act="newGame" aria-label="새 판"><svg viewBox="0 0 24 24" aria-hidden="true">'+ICONS.newg+'</svg><span class="lb">새 판</span></button>';
  $("rail").innerHTML=h}
function renderPane(){const p=S.panel;const show=!!p&&!isNarrow();$("pane").hidden=!show;if(!show)return;
  const c=ctx(),r=sim();const sub={map:c?c.md.ko+" · "+(c.mp?(c.mp.ko||c.mp.en):"맵 미지정"):"모드와 맵을 고르세요",ban:S.bans.filter(Boolean).length+"/6 밴",
    pick:(S.first==="us"?"우리 선픽":"상대 선픽")+" · 1-2-2-1",rec:"보유 브롤러 중 예상 승률 순",win:r?(r.exact?"6픽 확정":Math.round(r.lo*100)+"–"+Math.round(r.hi*100)+"% 범위"):"",lane:"미드·사이드 맞상대",info:"체력·가젯·스타파워",own:"없음 → 보유 → ★주력"};
  $("ptitle").textContent=p==="win"&&r?"승률 "+pct(r.p):PANES[p]==="내 것"?"내 브롤러":PANES[p];$("psub").textContent=sub[p]||"";
  const body=p==="map"?htmlMap():p==="ban"?htmlBan():p==="pick"?htmlPick():p==="rec"?tabRec():p==="win"?htmlWhy():p==="lane"?tabLane():p==="info"?tabInfo():tabOwn()+(NATIVE?'<button class="pickme" style="background:var(--raise);color:var(--fg);border:1px solid var(--line)" data-act="nclose">픽보드 끄기</button>':'')+'<footer id="foot">'+footHtml()+'</footer>';
  $("pbody").innerHTML=body}
function footHtml(){return"데이터: 브롤러 "+BR.length+"명 · 체력 11렙 기준(2026-09 밸런스 반영) · 맵 "+esc(MP.season)+" · 승률 모델: 경쟁전 상위권 21일(brawlbetter, 2026-10-11 갱신) + 상위 래더 맞상대 1,272건(metaforge). 출처: Brawlify, 나무위키, Fandom. 게임 화면은 읽지 않고 직접 입력한 내용만 써요. · <button data-act=\"egg\">made by eipi10</button> <span id=\"egg\"></span>"}
let LASTP=null;
function render(){syncNative();renderRail();renderPane();if(S.panel!==LASTP){LASTP=S.panel;try{window.scrollTo(0,0)}catch(e){}}save()}
// ---------- actions ----------
function assignPick(en){const {side,i}=S.active;S[side][i]=en;S.q="";S.active=nextActive(side);if(side==="ally"&&i===S.me)S.openRec=null;
  if(S.active&&S.active.side==="ally"&&S.active.i===S.me){S.panel="rec";S.active=null}} // 내 차례가 오면 추천을 바로 띄움
function openPane(k){if(S.panel===k&&!isNarrow()){S.panel=null;S.active=null;return}S.panel=k;S.q="";
  if(k==="ban")S.active=S.bans.some(x=>!x)?nextActive("bans"):null;
  else if(k==="pick")S.active=nextActive("pick");else S.active=null;
  if(k==="map"&&S.mode==null)S.map=null}
let eggN=0;
document.addEventListener("click",ev=>{const t=ev.target.closest("[data-act]");if(!t)return;const a=t.dataset.act,v=t.dataset.v;
  switch(a){
    case"pane":openPane(v);break;
    case"closePane":S.panel=null;S.active=null;break;
    case"mode":S.mode=+v;S.map=null;break;
    case"map":S.map=+v;if(S.map>=0)openPane("ban");break;
    case"custom":S.custom=v;openPane("ban");break;
    case"first":S.first=v;if(S.panel==="pick")S.active=nextActive("pick");break;
    case"me":S.me=+v;break;
    case"slot":{const side=t.dataset.side,i=+t.dataset.i;if(S.active&&S.active.side===side&&S.active.i===i){S.active=null}else{S.active={side,i};S.q="";if(side!=="bans"&&S.panel!=="pick")S.panel="pick"}break}
    case"key":if(!S.active)break;if(v==="BK")S.q=S.q.slice(0,-1);else if(v==="CL")S.q="";else{S.q+=v;const u=used();const cur=S[S.active.side][S.active.i];
        const r=(search(S.q,SORTED)||[]).filter(b=>!u.has(b.en)||b.en===cur);const pre=r.filter(b=>b.cho.startsWith(S.q));
        if(r.length===1&&pre.length===1)assignPick(r[0].en)}break;
    case"pick":assignPick(v);break;
    case"clearSlot":S[S.active.side][S.active.i]=null;S.q="";break;
    case"closePick":S.active=null;S.q="";break;
    case"newGame":S.enemy=[null,null,null];S.ally=[null,null,null];S.bans=[null,null,null,null,null,null];S.q="";S.openRec=null;S.panel="ban";S.active=nextActive("bans");break;
    case"openRec":if(ev.target.closest(".recbody"))return;S.openRec=S.openRec===v?null:v;break;
    case"pickMe":if(S.ally.includes(v)&&S.ally[S.me]!==v)return;S.ally[S.me]=v;S.openRec=null;S.active=null;break;
    case"ownKey":if(v==="BK")S.ownQ=S.ownQ.slice(0,-1);else if(v==="CL")S.ownQ="";else S.ownQ+=v;break;
    case"own":{if(!OWNED)OWNED=BR.map(b=>b.en);const lv=lvOf(v);
      if(lv===0){OWNED=[...OWNED,v]}else if(lv===1){MAINS=[...MAINS,v]}else{MAINS=MAINS.filter(x=>x!==v);OWNED=OWNED.filter(x=>x!==v)}
      store.set("owned",OWNED);store.set("mains",MAINS);break}
    case"ownAll":OWNED=BR.map(b=>b.en);store.set("owned",OWNED);break;
    case"ownNone":OWNED=[];MAINS=[];store.set("owned",OWNED);store.set("mains",MAINS);break;
    case"nclose":try{window.Android.close()}catch(e){}return;
    case"egg":eggN++;if(eggN>=5){$("egg").innerHTML='<span class="egg">kimbbak</span>';eggN=0}return;
  }
  render()});
document.addEventListener("keydown",ev=>{if(ev.key==="Enter"&&ev.target.matches(".rec"))ev.target.click()});
let rz;window.addEventListener("resize",()=>{clearTimeout(rz);rz=setTimeout(render,120)});
render();
})();
