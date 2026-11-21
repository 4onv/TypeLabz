"use strict";
const $ = id => document.getElementById(id);
const leftKeys = "qwertasdfgzxcvb";
const testLines = [
  "take another look at the note on the desk and write down the words you know",
  "walk along the narrow path where the morning light falls across the stone steps",
  "open the window and look beyond the garden to the water near the hill",
  "find a place to sit and listen as the rain begins to fall again",
  "keep the little notebook close and leave enough room for the next line",
  "follow the stream until you reach the bridge and turn toward home",
  "the warm light from the kitchen fills the room as the kettle sings",
  "bring a friend along and spend the afternoon looking for smooth stones"
];
const extra = ("known knowing unknown knowledge snow snowy knot knots knock knocking north northern noise noisy notice noticed novel novels normal normally "+
  "alone phone honey money tone honest zone stone done gone bone corner longer song only sunny moon soon "+
  "thought through thin thick earth gather weather rather other either mother father brother "+
  "book brook hook rook took shook pool stool spool cool cooler cook cooking looping "+
  "late gate plate taking maker baked rake wake water winter writer after letter filter "+
  "pleasant please playful plan plant plain places light flight slight bright lighten "+
  "runner running spinning dinner inner banking thinking thankful shoreline shared shine "+
  "land sand stand hands handle candle gentle settle little bittern fitter fitted "+
  "repeat speed sleep green deeper keeper sheets wheat seat beat seal reads reading "+
  "arrow borrow grow crowd crown ground round found pound sounding "+
  "frame train grain trail travel dream stream cream street strong string "+
  "beneath breathe bread break brush fresh press dress across crossing "+
  "mist list wrist twist chest rest best nest risk brisk drift gift "+
  "painting waiting rail main remain brain claim chair chain pair fair "+
  "feeling meeting moving giving saying flying laying "+
  "leaving weaving leafy leaning cleaner clearer cleared").split(/\s+/);
const bank = [...new Set(testLines.join(" ").split(" ").concat(extra))];
const median = values => {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b) => a-b), mid = Math.floor(sorted.length/2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid-1]+sorted[mid])/2;
};
const ms = n => n == null ? "—" : Math.round(n) + " ms";
const hand = key => leftKeys.includes(key) ? "L" : "R";
const shuffled = items => {
  const result = [...items];
  for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]]}
  return result;
};
const group = (items, key) => {
  const out = new Map();
  for(const item of items){const k=key(item);if(!out.has(k))out.set(k,[]);out.get(k).push(item)}
  return out;
};
const colors = ["#e0d9ff","#c4b6f7","#efa988"];
const rows = [
  [["`",1],..."1234567890-=".split(""),["delete",2]],
  [["tab",1.45],..."qwertyuiop[]".split(""),["\\",1.55]],
  [["caps",1.8],..."asdfghjkl;'".split(""),["enter",2.2]],
  [["shift",2.2],..."zxcvbnm,./".split(""),["shift",2.8]],
  [["ctrl",1.3],["win",1.2],["alt",1.2],["space",7.1],["alt",1.2],["win",1.2],["ctrl",1.8]]
];
const keys = new Map();
let duration=30, mode="test", view="zones", state, lesson=null, selected=null, timer;
function makeBoard(){
  const board=$("keyboard");board.className="board";
  for(const row of rows){
    const line=document.createElement("div");line.className="key-row";
    for(const spec of row){
      const [label,size]=Array.isArray(spec)?spec:[spec,1], letter=/^[a-z]$/.test(label);
      const el=document.createElement(letter?"button":"span");
      el.className="key"+(letter?" "+(hand(label)==="L"?"left":"right"):" mod");
      el.textContent=letter?label.toUpperCase():label;el.style.setProperty("--size",size);
      if(letter){keys.set(label,el);el.title="Inspect "+label.toUpperCase();el.onclick=()=>{selected=label;paintBoard()}}
      line.append(el);
    }
    board.append(line);
  }
  [8,14,22,12,27,38,23,33,46,30,18,26,14,8].forEach(h=>{const i=document.createElement("i");i.style.height=h+"px";$("ticks").append(i)});
}
function paintBoard(){
  const timings=group(state.samples.filter(Boolean),p=>p.pair[1]);
  const mids=[...timings.values()].map(list=>median(list.map(p=>p.dt))).sort((a,b)=>a-b);
  for(const [k,el] of keys){
    const list=timings.get(k)||[], val=median(list.map(p=>p.dt));
    el.classList.toggle("selected",selected===k);el.setAttribute("aria-pressed",String(selected===k));
    el.style.background=view==="zones"?"":val===null?"#f6f5f9":colors[val<=mids[Math.floor((mids.length-1)/3)]?0:val<=mids[Math.floor(2*(mids.length-1)/3)]?1:2];
    if(selected===k){$("key-read").textContent=k.toUpperCase()+" · "+(hand(k)==="L"?"Left":"Right")+" zone · "+(list.length?ms(val)+" median arrival across "+list.length+" correct transition"+(list.length===1?"":"s"):"No correct transitions into this key yet.")}
  }
  $("key-read").hidden=!selected;
  $("map-note").textContent=view==="zones"?"See which side of the keyboard each letter belongs to.":"Median time to reach each letter, grouped by speed within this session.";
  $("zones").setAttribute("aria-pressed",String(view==="zones"));$("timing").setAttribute("aria-pressed",String(view==="timing"));
  const items=view==="zones"?[["#d9d2ff","Left zone"],["#ffceb6","Right zone"]]:[[colors[0],"Faster"],[colors[1],"Middle"],[colors[2],"Slower"],["#f6f5f9","No data"]];
  $("legend").innerHTML=items.map(([color,label])=>'<span><i class="chip" style="background:'+color+'"></i>'+label+'</span>').join("");
}
function reset(next="test"){
  clearInterval(timer);mode=next;
  const words=next==="test"?shuffled(testLines).join(" "):next==="drill"?lesson.practice.join(" "):lesson.retest.join(" ");
  state={text:words,typed:"",shots:0,hits:0,samples:[],times:[],last:null,elapsed:0,since:null,done:false,nodes:[]};
  selected=null;view="zones";const passage=$("passage");passage.replaceChildren();passage.style.top="0px";
  for(const part of words.match(/\S+| /g)){
    const word=document.createElement("span");word.className=part===" "?"":"token";
    for(const ch of part){const span=document.createElement("span");span.textContent=ch;state.nodes.push(span);word.append(span)}
    passage.append(word);
  }
  state.nodes[0].className="current";$("capture").value="";$("capture").disabled=false;
  $("session-title").textContent=next==="test"?"Typing test":next==="drill"?"Pair practice":"Fresh-word retest";
  $("hint").textContent=next==="test"?"Start typing to begin":"Target pair · "+lesson.pair.split("").join(" → ");
  $("spoken-prompt").textContent="Type the following words. "+words;
  $("report").hidden=true;$("word-detail").hidden=true;
  document.querySelectorAll("[data-duration]").forEach(b=>{b.disabled=next!=="test";b.setAttribute("aria-pressed",String(+b.dataset.duration===duration))});
  $("restart").lastElementChild.textContent=next==="test"?"Restart":"New test";
  paintBoard();meters();$("capture").focus({preventScroll:true});
}
const elapsed = (now=performance.now()) => state.elapsed+(state.since===null?0:now-state.since);
function meters(){
  const spent=elapsed();$("time").textContent=Math.max(0,Math.ceil(duration-spent/1000));
  const correct=[...state.typed].filter((c,i)=>c===state.text[i]).length;
  $("wpm").textContent=spent>=500?Math.round(correct*12000/spent):"—";$("accuracy").textContent=state.shots?Math.round(100*state.hits/state.shots):"—";
  [...$("ticks").children].forEach((el,i)=>el.classList.toggle("spent",i>=Math.ceil(14*(1-spent/(duration*1000)))));
}
function pause(){
  if(state.since===null||state.done)return;
  const spent=elapsed();if(spent>=duration*1000){finish();return}
  state.elapsed=spent;state.since=null;state.last=null;clearInterval(timer);
  $("hint").textContent="Paused · type to resume";meters();
}
function input(ch){
  if(state.done)return;const now=performance.now();if(elapsed(now)>=duration*1000){finish();return}
  if(state.since===null){state.since=now;timer=setInterval(()=>{if(elapsed()>=duration*1000)finish();else meters()},150);$("hint").textContent="Recording keystrokes"}
  const pos=state.typed.length,match=ch===state.text[pos];state.shots++;if(match)state.hits++;
  state.times[pos]=elapsed(now);state.samples[pos]=null;
  if(match && /^[a-z]$/.test(ch) && state.last!==null && pos>0 && /[a-z]/.test(state.text[pos-1]) && state.typed[pos-1]===state.text[pos-1]){
    state.samples[pos]={pair:state.text[pos-1]+ch,dt:now-state.last,pos};
  }
  state.last=match?now:null;state.typed+=ch;
  state.nodes[pos].className=match?"good":"bad";const cap=keys.get(ch.toLowerCase());
  if(cap){cap.classList.add("hit");setTimeout(()=>cap.classList.remove("hit"),120)}
  if(state.typed.length===state.text.length){finish();return}
  cursor();meters();if(view==="timing"||selected)paintBoard();
}
function cursor(){
  const el=state.nodes[state.typed.length];el.className="current";
  const lineHeight=parseFloat(getComputedStyle($("test-area")).lineHeight);
  const y=el.getBoundingClientRect().top-$("passage").getBoundingClientRect().top;
  $("passage").style.top=-Math.max(0,Math.floor((y+lineHeight*.23)/lineHeight)-1)*lineHeight+"px";
}
function backspace(){
  if(state.done||!state.typed.length)return;
  state.nodes[state.typed.length].className="";state.typed=state.typed.slice(0,-1);state.samples.pop();state.times.pop();state.last=null;
  cursor();meters();paintBoard();
}
function finish(){
  if(state.done)return;state.elapsed=Math.min(duration*1000,elapsed());state.since=null;state.done=true;clearInterval(timer);
  $("capture").disabled=true;$("hint").textContent="Session complete";$("status").textContent="Session complete. Your analysis is ready.";
  state.nodes[state.typed.length]?.classList.remove("current");meters();view="timing";paintBoard();report();
  $("report-title").focus({preventScroll:true});$("report").scrollIntoView({block:"start"});
}
function wordResults(){
  const entries=[];
  for(const match of state.text.matchAll(/\S+/g)){
    const end=match.index+match[0].length;
    if(end>state.typed.length)break;
    const pairs=state.samples.slice(match.index+1,end).filter(Boolean);
    if(!pairs.length)continue;
    entries.push({word:match[0],pairs,pace:median(pairs.map(x=>x.dt)),total:state.times[end-1]-state.times[match.index],clean:state.typed.slice(match.index,end)===match[0]});
  }
  return entries.sort((a,b)=>a.pace-b.pace);
}
function makeLesson(samples){
  const seen=new Set(state.text.slice(0,state.typed.length).split(" "));
  const choices=[];
  for(const [pair,items] of group(samples,p=>p.pair)){
    if(items.length<2)continue;
    const available=bank.filter(w=>w.includes(pair)),fresh=shuffled(available.filter(w=>!seen.has(w)));
    if(fresh.length<2||available.length<3)continue;
    const retest=fresh.slice(0,Math.min(4,Math.max(2,Math.floor(available.length/2))));
    const practice=shuffled(available.filter(w=>!retest.includes(w))).slice(0,5);
    if(practice.length)choices.push({pair,baseline:median(items.map(p=>p.dt)),accuracy:Math.round(100*state.hits/state.shots),count:items.length,practice:[...practice,...practice],retest});
  }
  return choices.sort((a,b)=>b.baseline-a.baseline)[0];
}
function coach(text,label,action){
  const box=$("coaching");box.replaceChildren();box.className="coach";const p=document.createElement("p");p.textContent=text;box.append(p);
  if(label){const b=document.createElement("button");b.className="action";b.textContent=label;b.onclick=()=>{action();$("session-title").scrollIntoView({block:"center"})};box.append(b)}
}
function report(){
  document.querySelector("[data-comparison]")?.remove();
  const samples=state.samples.filter(Boolean);$("report").hidden=false;
  if(mode==="test"){
    lesson=makeLesson(samples);
    if(lesson)coach("Practice "+lesson.pair.split("").join(" → ")+". This was your slowest repeated pair with fresh words available for a retest. Median gap: "+ms(lesson.baseline)+" across "+lesson.count+" samples.","Start pair practice",()=>reset("drill"));
    else coach("There are too few repeated pairs with fresh practice words. Try a longer test to build a comparison.","Try again",()=>reset());
  }else if(mode==="drill"){
    coach("Now try the same pair in fresh words. Your original median was "+ms(lesson.baseline)+".","Start fresh-word retest",()=>reset("retest"));
  }else{
    const gaps=samples.filter(x=>x.pair===lesson.pair).map(x=>x.dt), value=median(gaps);
    coach(value===null?"No clean samples of your target pair this time.":"Your "+lesson.pair+" gap went from "+ms(lesson.baseline)+" to "+ms(value)+" across "+gaps.length+" fresh-word samples. Overall accuracy was "+lesson.accuracy+"% on the original test and "+$("accuracy").textContent+"% on the retest.","New typing test",()=>reset());
  }
  const directionNames={LL:"Left to left",RR:"Right to right",LR:"Left to right",RL:"Right to left"};
  const moves=group(samples,p=>hand(p.pair[0])+hand(p.pair[1]));
  const left=moves.get("LL")||[],right=moves.get("RR")||[];
  if(left.length>=3 && right.length>=3){
    const gap=median(right.map(p=>p.dt))-median(left.map(p=>p.dt));
    const note=document.createElement("p");note.className="muted";
    note.textContent="In this session, the median gap between two right-side letters was "+ms(Math.abs(gap))+" "+(gap>=0?"longer":"shorter")+" than between two left-side letters. Zones follow a US QWERTY layout. Finger use is self-observed.";
    $("movement").before(note);note.dataset.comparison="true";
  }
  $("movement").className="stats";$("movement").innerHTML=Object.entries(directionNames).map(([k,name])=>{const list=moves.get(k)||[];return '<div class="stat">'+name+'<b>'+ms(median(list.map(x=>x.dt)))+'</b>'+list.length+' samples</div>'}).join("");
  const words=wordResults(),wrap=$("words");wrap.className="word-list";wrap.replaceChildren();
  for(const w of words){
    const b=document.createElement("button");b.textContent=w.word+" · "+ms(w.pace);b.onclick=()=>{const d=$("word-detail");d.hidden=false;d.textContent=w.word+" · "+ms(w.total)+" first to last letter"+(w.clean?"":" · contains errors")+".   "+w.pairs.map(p=>p.pair.split("").join(" → ")+"  "+ms(p.dt)).join("   |   ");selected=w.pairs.reduce((a,b)=>a.dt>b.dt?a:b).pair[1];paintBoard()};wrap.append(b);
  }
  if(!words.length)wrap.textContent="Complete a word with a correct letter pair to see its timing.";
}
const field=$("capture");
field.addEventListener("keydown",e=>{
  if(e.ctrlKey||e.altKey||e.metaKey||e.isComposing)return;
  if(e.key==="Backspace"){e.preventDefault();backspace()}
  else if(e.key.length===1){e.preventDefault();if(!e.repeat)input(e.key)}
});
field.addEventListener("beforeinput",e=>{
  if(e.inputType==="insertText"&&e.data?.length===1){e.preventDefault();input(e.data)}
  else if(e.inputType==="deleteContentBackward"){e.preventDefault();backspace()}
  else e.preventDefault();
});
field.onpaste=e=>e.preventDefault();field.ondrop=e=>e.preventDefault();
field.onblur=pause;window.addEventListener("blur",pause);document.addEventListener("visibilitychange",()=>{if(document.hidden)pause()});
$("zones").onclick=()=>{view="zones";paintBoard()};$("timing").onclick=()=>{view="timing";paintBoard()};
document.querySelectorAll("[data-duration]").forEach(b=>b.onclick=()=>{duration=+b.dataset.duration;reset()});
$("restart").onclick=()=>reset();
makeBoard();reset();
