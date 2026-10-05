const $=id=>document.getElementById(id);
const DEFAULT=[["リクイン受付",5],["説明・部屋へ案内",5],["第1ローテ",20],["写真撮影",3],["入れ替え",2,"撮影が終わったらキャストのみ退室。第2で当たるゲストの情報を軽くチェックOK"],["第2ローテ",20],["写真撮影",3],["退室",2,"撮影が終わったらキャスト＋ゲスト退室"],["集合写真・閉め",10]];
let uid=1;
const mk=(name,min,kind="step",note="")=>({id:uid++,name,min,kind,note});

/* ---------- state ---------- */
const KEY="stepTimer_v6";
const freshRun=()=>({idx:0,remain:0,running:false,endAt:0,begun:false,actStart:{},actEnd:{},ext:{}});
// 初回は空のタイムテーブルが1つだけ
const blankPreset=(name="タイムテーブル")=>({id:"p"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),name,start:"",steps:[mk("ステップ1",10)]});
let store={presets:[blankPreset()],activeId:null,opts:null};
store.activeId=store.presets[0].id;
let cur=store.presets[0],steps=cur.steps,run=freshRun();
let preFired=false,tick=null,wake=null;

function save(){
  cur.start=$("startAt").value;
  store.opts={sound:$("sound").value,vol:$("vol").value,pre:$("pre").checked,auto:$("auto").checked};
  try{localStorage.setItem(KEY,JSON.stringify({...store,run}))}catch(e){}
}
function load(){
  try{
    const d=JSON.parse(localStorage.getItem(KEY));
    if(d&&Array.isArray(d.presets)&&d.presets.length){
      // 前のバージョンで自動で入ってた、手つかずのサンプルは外す
      const isUntouchedSample=p=>p.name==="サンプル：撮影会"&&JSON.stringify(p.steps.map(x=>[x.name,x.min,x.note||""]))===JSON.stringify(DEFAULT.map(([n,m,note])=>[n,m,note||""]));
      store={presets:d.presets.filter(p=>Array.isArray(p.steps)&&p.steps.length&&!isUntouchedSample(p)),activeId:d.activeId,opts:d.opts};
      if(!store.presets.length){store.presets=[blankPreset()];d.run=null}
      if(d.run)run=Object.assign(freshRun(),d.run);
    } else {
      const old=JSON.parse(localStorage.getItem("stepTimer_v5"));   // 前のバージョンから引き継ぎ
      if(old&&Array.isArray(old.steps)&&old.steps.length){store.presets[0].steps=old.steps;store.presets[0].start=old.start||"";store.opts=old.opts||null}
    }
  }catch(e){}
  uid=Math.max(0,...store.presets.flatMap(p=>p.steps.map(s=>s.id||0)))+1;
  store.presets.forEach(p=>p.steps.forEach(s=>{if(!s.id)s.id=uid++;s.kind=s.kind||"step";s.note=s.note||""}));
  cur=store.presets.find(p=>p.id===store.activeId)||store.presets[0];store.activeId=cur.id;steps=cur.steps;
  $("startAt").value=cur.start||"";
  const o=store.opts;if(o){$("sound").value=o.sound;$("vol").value=o.vol;$("pre").checked=o.pre;$("auto").checked=o.auto}
  if(run.idx>=steps.length)run=freshRun();
  if(run.running)run.remain=(run.endAt-Date.now())/1000;
}

/* ---------- presets ---------- */
let msgTimer=null;
function say(t){$("msg").textContent=t;clearTimeout(msgTimer);msgTimer=setTimeout(()=>$("msg").textContent="",4000)}
function renderPresets(){
  const sel=$("preset");sel.innerHTML="";
  store.presets.forEach(p=>{const o=document.createElement("option");o.value=p.id;o.textContent=p.name;sel.appendChild(o)});
  sel.value=cur.id;
}
function switchTo(id){
  if(run.running)pause();
  cur=store.presets.find(p=>p.id===id)||store.presets[0];store.activeId=cur.id;steps=cur.steps;
  $("startAt").value=cur.start||"";
  run=freshRun();run.remain=dur(steps[0]);preFired=false;
  renderPresets();renderAll();save();
}
function uniqueName(base){let n=base,i=2;while(store.presets.some(p=>p.name===n))n=`${base} (${i++})`;return n}
function addPreset(p){store.presets.push(p);switchTo(p.id)}
const newId=()=>"p"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
$("preset").onchange=e=>switchTo(e.target.value);
$("pNew").onclick=()=>{addPreset({id:newId(),name:uniqueName("新しいタイムテーブル"),start:"",steps:[mk("ステップ1",10)]});say("新しいタイムテーブルを作ったよ");startRename()};
$("pDup").onclick=()=>{addPreset({id:newId(),name:uniqueName(cur.name+" のコピー"),start:cur.start,steps:cur.steps.map(s=>mk(s.name,s.min,s.kind,s.note))});say("複製したよ")};
function startRename(){
  const inp=$("presetName");inp.value=cur.name;inp.hidden=false;$("preset").hidden=true;inp.focus();inp.select();
}
function endRename(ok){
  const inp=$("presetName");if(inp.hidden)return;
  const v=inp.value.trim();if(ok&&v){cur.name=v;save()}
  inp.hidden=true;$("preset").hidden=false;renderPresets();
}
$("pRename").onclick=startRename;
$("presetName").onkeydown=e=>{if(e.key==="Enter")endRename(true);if(e.key==="Escape")endRename(false)};
$("presetName").onblur=()=>endRename(true);
let delArmed=null;
$("pDel").onclick=()=>{
  const b=$("pDel");
  if(!delArmed){b.textContent="もう一度押すと削除";delArmed=setTimeout(()=>{delArmed=null;b.textContent="削除"},3000);return}
  clearTimeout(delArmed);delArmed=null;b.textContent="削除";closeMenu();
  const name=cur.name;store.presets=store.presets.filter(p=>p.id!==cur.id);
  if(!store.presets.length)store.presets.push(blankPreset());   // 全部消したら空のを1つ用意
  switchTo(store.presets[0].id);say(`「${name}」を削除したよ`);
};
/* 共有コード: タイムテーブルを文字列にして、ほかの人や端末に渡す */
const PREFIX="STEPTIMER:";
function encodePreset(p){return PREFIX+btoa(unescape(encodeURIComponent(JSON.stringify({n:p.name,t:p.start,s:p.steps.map(x=>[x.name,x.min,x.kind==="delay"?1:0,x.note||""])}))))}
function decodePreset(code){
  const raw=code.trim().replace(/^STEPTIMER:/,"");
  const d=JSON.parse(decodeURIComponent(escape(atob(raw))));
  if(!d||!Array.isArray(d.s)||!d.s.length)throw 0;
  const st=d.s.map(([n,m,k,note])=>mk(String(n||"ステップ").slice(0,60),Math.max(1,Math.round(+m)||1),k?"delay":"step",String(note||"").slice(0,200)));
  return {id:newId(),name:uniqueName(String(d.n||"読み込んだタイムテーブル").slice(0,40)),start:/^\d{2}:\d{2}$/.test(d.t)?d.t:"",steps:st};
}
$("pExport").onclick=()=>{
  const code=encodePreset(cur);
  const fallback=()=>{$("importBox").hidden=false;$("importLabel").textContent="このコードをコピーして渡してね";$("importOk").hidden=true;$("importText").value=code;$("importText").select()};
  try{navigator.clipboard.writeText(code).then(()=>say("共有コードをコピーしたよ。「コードから追加」で読み込めるよ"),fallback)}catch(e){fallback()}
};
$("pImport").onclick=()=>{$("importBox").hidden=false;$("importLabel").textContent="共有コードを貼り付けてね";$("importOk").hidden=false;$("importText").value="";$("importText").focus()};
$("importCancel").onclick=()=>{$("importBox").hidden=true};
$("importOk").onclick=()=>{
  try{const p=decodePreset($("importText").value);addPreset(p);$("importBox").hidden=true;say(`「${p.name}」を追加したよ`)}
  catch(e){say("コードを読み込めなかった…最初から最後まで全部コピーできてるか確認してね")}
};

/* ---------- time helpers ---------- */
const fmt=s=>{s=Math.max(0,Math.ceil(s));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return (h?h+":"+String(m).padStart(2,"0"):String(m).padStart(2,"0"))+":"+String(x).padStart(2,"0")};
const hm=t=>{const d=new Date(t);return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0")};
const dur=(s,i)=>s.min*60+(run.ext[s.id]||0);
function planBase(){
  const v=$("startAt").value;if(!v)return null;
  const [h,m]=v.split(":").map(Number);const d=new Date();d.setHours(h,m,0,0);
  // 日付の決め方：始まる前は「これから来る開始時刻」、始まった後は実際の開始に一番近い日
  const first=run.actStart[steps[0]?.id];
  const ref=run.begun&&first?first:Date.now();
  let t=d.getTime();
  if(run.begun&&first){while(t-ref>12*3600e3)t-=864e5;while(ref-t>12*3600e3)t+=864e5}
  else{if(t<ref-3*3600e3)t+=864e5;else if(t>ref+21*3600e3)t-=864e5}
  return t;
}
/* 予定: start time + planned minutes (delay rows excluded). 見込み: actual / live projection. */
function compute(){
  const now=Date.now(),base=planBase(),out=[];
  let p=base,t;
  steps.forEach((s,i)=>{
    const r={};
    if(s.kind==="step"&&p!==null){r.ps=p;r.pe=p+s.min*60e3;p=r.pe}
    if(i<run.idx){r.as=run.actStart[s.id];r.ae=run.actEnd[s.id];t=r.ae}
    else if(i===run.idx){
      r.as=run.begun?(run.actStart[s.id]??now):Math.max(now,base??now);
      r.ae=(run.begun?now:r.as)+run.remain*1000;t=r.ae;
    } else {r.as=t;r.ae=t+dur(s)*1000;t=r.ae}
    out.push(r);
  });
  return {rows:out,planEnd:p,projEnd:t};
}
const diffMin=(a,b)=>Math.round((a-b)/60000);
function lagText(m){return m===0?"定刻":m>0?`+${m}分`:`${m}分`}
function lagClass(m){return m>0?"late":m<0?"early":""}

/* ---------- render ---------- */
function renderList(){
  const list=$("list"),keep=list.scrollTop;list.innerHTML="";
  steps.forEach((s,i)=>{
    const li=document.createElement("li");li.dataset.i=i;
    li.innerHTML=`<span class="n">${s.kind==="delay"?"⏸":i+1}</span>
      <input class="name" aria-label="ステップ名"><span class="mins"><input class="min" type="number" min="1" step="1" inputmode="numeric" aria-label="分">分</span>
      <button class="del" aria-label="削除">×</button><div class="times"></div>`;
    const nm=li.querySelector(".name"),mn=li.querySelector(".min");
    nm.id="name"+s.id;mn.id="min"+s.id;nm.value=s.name;mn.value=s.min;
    nm.oninput=()=>{s.name=nm.value;save();renderDial()};
    mn.onchange=()=>{const v=Math.round(parseFloat(mn.value));if(!(v>=1)){mn.value=s.min;return}mn.value=v;
      const diff=(v-s.min)*60;s.min=v;
      if(i===run.idx){run.remain=Math.max(1,run.remain+diff);if(run.running)run.endAt=Date.now()+run.remain*1000}
      save();renderAll()};
    li.querySelector(".del").onclick=()=>{
      if(steps.length<=1||i<run.idx)return;
      steps.splice(i,1);
      if(i===run.idx){if(run.idx>=steps.length)run.idx=steps.length-1;run.remain=dur(steps[run.idx]);if(run.running)run.endAt=Date.now()+run.remain*1000}
      save();renderAll()};
    list.appendChild(li);
  });
  update();
  // 今のステップがリスト内で見えるようにスクロール（ページ全体は動かさない）
  list.scrollTop=keep;
  const act=list.children[run.idx];
  if(act){const top=act.offsetTop-list.offsetTop,bottom=top+act.offsetHeight;
    if(top<list.scrollTop||bottom>list.scrollTop+list.clientHeight)list.scrollTop=Math.max(0,top-list.clientHeight/3)}
}
function update(){
  const c=compute();
  document.querySelectorAll("#list li").forEach(li=>{
    const i=+li.dataset.i,s=steps[i],r=c.rows[i];
    li.className=(i<run.idx?"done ":i===run.idx?"active ":"")+(s.kind==="delay"?"delay":"");
    let h="";
    if(r.ps!=null)h+=`<span>予定 ${hm(r.ps)}–${hm(r.pe)}</span>`;
    else if(s.kind==="delay")h+=`<span>遅延枠</span>`;
    if(r.as!=null){
      const lbl=i<run.idx?"実績":"見込み";
      const m=r.ps!=null?diffMin(r.as,r.ps):null;
      // 予定どおりなら見込みは省略して、ずれたときだけ出す
      if(m===null||m!==0||i<run.idx)h+=`<span class="proj">${lbl} ${hm(r.as)}–${hm(r.ae)}</span>`;
      if(m)h+=`<span class="d ${lagClass(m)}">${lagText(m)}</span>`;
    }
    if(s.note)h+=`<span class="memo"></span>`;
    const tm=li.querySelector(".times");tm.innerHTML=h;if(s.note)tm.querySelector(".memo").textContent="📝 "+s.note;
  });
  $("endPlan").textContent="予定終了 "+(c.planEnd!=null?hm(c.planEnd):"--:--");
  $("endProj").textContent="見込み "+hm(c.projEnd);
  const lag=$("lag");
  if(c.planEnd!=null){const m=diffMin(c.projEnd,c.planEnd);lag.hidden=false;lag.textContent=m>0?`${m}分押し`:m<0?`${-m}分巻き`:"定刻";lag.className="pill "+lagClass(m)}
  else lag.hidden=true;
}
function renderDial(){
  const s=steps[run.idx],nx=steps[run.idx+1];
  $("time").textContent=fmt(run.remain);
  $("time").classList.toggle("ending",run.running&&run.remain<=60);
  $("stepname").textContent=s.name;
  $("next").textContent=nx?"次 → "+nx.name:"ラストのステップ";
  $("note").hidden=!s.note;$("note").textContent=s.note||"";
  $("bar").style.width=Math.min(100,100*(1-run.remain/dur(s)))+"%";
  $("pos").textContent=`STEP ${run.idx+1} / ${steps.length}`+(s.kind==="delay"?"・遅延枠":"");
  $("backBtn").disabled=run.idx===0;$("skipBtn").disabled=run.idx+1>=steps.length;
  $("startBtn").textContent=run.running?"一時停止":run.begun?"再開":"スタート";
  document.title=run.running?`${fmt(run.remain)} ${s.name}`:"ステップタイマー";
}
function renderAll(){renderDial();renderList()}

/* ---------- sound ---------- */
let ctx=null;
function ac(){if(!ctx)ctx=new (window.AudioContext||window.webkitAudioContext)();if(ctx.state==="suspended")ctx.resume();return ctx}
function tone(freq,start,d,type="sine",gain=1){
  const c=ac(),o=c.createOscillator(),g=c.createGain(),v=parseFloat($("vol").value)*gain;
  o.type=type;o.frequency.value=freq;o.connect(g);g.connect(c.destination);
  const t=c.currentTime+start;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(Math.max(v,0.0002),t+0.01);g.gain.exponentialRampToValueAtTime(0.0001,t+d);
  o.start(t);o.stop(t+d+0.05);
}
function chime(kind){
  const k=$("sound").value;
  if(kind==="pre"){tone(880,0,.25,"sine",.5);return}
  const reps=kind==="final"?3:2;
  for(let r=0;r<reps;r++){const o=r*1.1;
    if(k==="bell"){tone(1046,o,1.2);tone(1568,o,.9,"sine",.4);tone(784,o+.35,1.4,"sine",.8)}
    else if(k==="beep"){[0,.18,.36].forEach(d=>tone(1320,o+d,.12,"square",.35))}
    else{tone(660,o,1.6,"triangle",.7);tone(990,o+.25,1.6,"triangle",.4)}
  }
}

/* ---------- timer ---------- */
function loop(){
  run.remain=(run.endAt-Date.now())/1000;
  const s=steps[run.idx];
  if(!preFired&&$("pre").checked&&run.remain<=60&&run.remain>0&&dur(s)>90){preFired=true;chime("pre")}
  if(run.remain<=0){
    const fresh=run.remain>-5;
    run.actEnd[s.id]=run.endAt;
    if(run.idx+1<steps.length){
      if(fresh)chime("step");
      run.idx++;preFired=false;const n=steps[run.idx];
      run.actStart[n.id]=run.endAt;run.remain=dur(n);
      if($("auto").checked){run.endAt+=run.remain*1000;run.remain=(run.endAt-Date.now())/1000}
      else{run.running=false;clearInterval(tick);releaseWake();run.begun=true}
      save();renderAll();return;
    } else {
      if(fresh)chime("final");run.remain=0;run.running=false;clearInterval(tick);releaseWake();save();renderAll();
      $("stepname").textContent="ぜんぶ終わり！";$("next").textContent="おつかれさま〜";$("note").hidden=true;return;
    }
  }
  renderDial();
}
function start(){
  ac();const s=steps[run.idx];
  if(!run.begun||run.actStart[s.id]==null)run.actStart[s.id]=Date.now();
  run.begun=true;run.running=true;run.endAt=Date.now()+run.remain*1000;
  clearInterval(tick);tick=setInterval(loop,200);requestWake();save();renderAll();
}
function pause(){run.running=false;clearInterval(tick);releaseWake();save();renderAll()}
function skip(){
  if(run.idx+1>=steps.length)return;
  const now=Date.now(),s=steps[run.idx];
  if(run.begun){run.actStart[s.id]??=now;run.actEnd[s.id]=now}
  run.idx++;preFired=false;const n=steps[run.idx];run.remain=dur(n);
  if(run.begun)run.actStart[n.id]=now;
  if(run.running)run.endAt=now+run.remain*1000;
  save();renderAll();
}
/* 前のステップに戻って、そのステップを頭からやり直す */
function back(){
  if(run.idx===0)return;
  const now=Date.now(),cur=steps[run.idx];
  delete run.actStart[cur.id];delete run.actEnd[cur.id];
  run.idx--;preFired=false;const p=steps[run.idx];
  delete run.actEnd[p.id];
  if(run.begun)run.actStart[p.id]=now;
  run.remain=dur(p);
  if(run.running)run.endAt=now+run.remain*1000;
  save();renderAll();
}
function extend(sec){
  const s=steps[run.idx];
  const nr=Math.max(1,run.remain+sec);sec=nr-run.remain;
  run.ext[s.id]=(run.ext[s.id]||0)+sec;run.remain=nr;
  if(run.running)run.endAt=Date.now()+run.remain*1000;
  save();renderDial();update();
}
$("startBtn").onclick=()=>run.running?pause():start();
$("skipBtn").onclick=skip;
$("backBtn").onclick=back;
$("resetBtn").onclick=()=>{pause();
  // 遅延ステップは消して、通常のステップだけに戻す
  cur.steps=steps=steps.filter(s=>s.kind!=="delay");
  run=freshRun();run.remain=dur(steps[0]);preFired=false;save();renderAll()};
$("testBtn").onclick=()=>chime("step");
$("plus1").onclick=()=>extend(60);
$("plus5").onclick=()=>extend(300);
$("minus1").onclick=()=>extend(-60);
$("insDelay").onclick=()=>{steps.splice(run.idx+1,0,mk("遅延",5,"delay"));save();renderAll()};
$("addBtn").onclick=()=>{steps.push(mk("新しいステップ",5));save();renderAll()};
$("startAt").onchange=()=>{save();update()};
["sound","vol","pre","auto"].forEach(id=>$(id).onchange=save);

/* ---------- menu / settings ---------- */
function closeMenu(){$("menu").hidden=true;$("menuBtn").setAttribute("aria-expanded","false")}
$("menuBtn").onclick=e=>{e.stopPropagation();const m=$("menu");m.hidden=!m.hidden;$("menuBtn").setAttribute("aria-expanded",String(!m.hidden))};
$("menu").addEventListener("click",e=>{e.stopPropagation();if(e.target.closest("[data-close]"))closeMenu()});
document.addEventListener("click",closeMenu);
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeMenu()});
$("setBtn").onclick=()=>{const st=$("settings");st.hidden=!st.hidden;$("setBtn").setAttribute("aria-expanded",String(!st.hidden))};

async function requestWake(){try{wake=await navigator.wakeLock?.request("screen")}catch(e){}}
function releaseWake(){try{wake&&wake.release();wake=null}catch(e){}}

load();
if(!run.begun)run.remain=dur(steps[run.idx]);
renderPresets();renderAll();
if(run.running){tick=setInterval(loop,200)}
setInterval(()=>{$("now").textContent=new Date().toTimeString().slice(0,8);update()},1000);
