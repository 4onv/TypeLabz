"use strict";
const $ = id => document.getElementById(id);
const leftKeys = "qwertasdfgzxcvb";
const median = values => {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b) => a-b), mid = Math.floor(sorted.length/2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid-1]+sorted[mid])/2;
};
const ms = n => n == null ? "—" : Math.round(n) + " ms";
const hand = key => leftKeys.includes(key) ? "L" : "R";
const group = (items, key) => {
  const out = new Map();
  for(const item of items){const k=key(item);if(!out.has(k))out.set(k,[]);out.get(k).push(item)}
  return out;
};
const colors = ["#385746","#5a5143","#775037"];
const rows = [
  [["`",1],..."1234567890-=".split(""),["delete",2]],
  [["tab",1.45],..."qwertyuiop[]".split(""),["\\",1.55]],
  [["caps",1.8],..."asdfghjkl;'".split(""),["enter",2.2]],
  [["shift",2.2],..."zxcvbnm,./".split(""),["shift",2.8]],
  [["ctrl",1.3],["win",1.2],["alt",1.2],["space",7.1],["alt",1.2],["win",1.2],["ctrl",1.8]]
];
const keys = new Map();
let settings={kind:"time",target:30,profile:"standard",punctuation:false,caps:false};
let generator;
let mode="test", view="zones", state, lesson=null, selected=null, timer;
let stopReplay;
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
}
function paintBoard(){
  const timings=group(state.samples.filter(Boolean),p=>p.pair[1]);
  const mids=[...timings.values()].filter(list=>list.length>=3).map(list=>median(list.map(p=>p.dt))).sort((a,b)=>a-b);
  for(const [k,el] of keys){
    const list=timings.get(k)||[], val=median(list.map(p=>p.dt));
    el.classList.toggle("selected",selected===k);el.setAttribute("aria-pressed",String(selected===k));
    el.style.background=view==="zones"?"":list.length<3?"#2c2e29":colors[val<=mids[Math.floor((mids.length-1)/3)]?0:val<=mids[Math.floor(2*(mids.length-1)/3)]?1:2];
    if(selected===k){$("key-read").textContent=k.toUpperCase()+" · "+(hand(k)==="L"?"Left":"Right")+" zone · "+(list.length?ms(val)+" median arrival across "+list.length+" correct transition"+(list.length===1?"":"s"):"No correct transitions into this key yet.")}
  }
  $("key-read").hidden=!selected;
  $("map-note").textContent=view==="zones"?"See which side of the keyboard each letter belongs to.":"Median time to reach each letter, grouped by speed within this session.";
  $("zones").setAttribute("aria-pressed",String(view==="zones"));$("timing").setAttribute("aria-pressed",String(view==="timing"));
  const items=view==="zones"?[["#4b453a","Left zone"],["#33483f","Right zone"]]:[[colors[0],"Faster"],[colors[1],"Middle"],[colors[2],"Slower"],["#2c2e29","Under 3 samples"]];
  $("legend").innerHTML=items.map(([color,label])=>'<span><i class="chip" style="background:'+color+'"></i>'+label+'</span>').join("");
}
function appendPrompt(text){
  state.text+=text;
  const fragment=document.createDocumentFragment();
  for(const part of text.match(/\S+| /g)){
    const word=document.createElement("span");word.className=part===" "?"":"token";
    for(const ch of part){const span=document.createElement("span");span.textContent=ch;state.nodes.push(span);word.append(span)}
    fragment.append(word);
  }
  $("passage").append(fragment);$("spoken-prompt").textContent="Type the following words. "+state.text;
}
function reset(next="test"){
  stopReplay?.();stopReplay=null;
  $("trace-events").replaceChildren();$("trace-gap").textContent="Δ — ms";
  clearInterval(timer);mode=next;
  generator=createGenerator(settings);
  const timed=next==="test" && settings.kind==="time";
  const words=next==="test"?(settings.kind==="chars"?generator.characters(settings.target):generator.words(timed?45:settings.target)):(next==="drill"?lesson.practice:lesson.retest).join(" ");
  state={text:"",typed:[],actions:[],shots:0,hits:0,samples:[],edits:new Set(),last:null,elapsed:0,since:null,done:false,nodes:[],limit:timed?settings.target*1000:Infinity};
  state.events=[];state.date=new Date().toISOString();
  selected=null;view="zones";const passage=$("passage");passage.replaceChildren();passage.style.top="0px";
  appendPrompt(words);
  state.nodes[0].className="current";$("capture").value="";$("capture").disabled=false;
  $("session-title").textContent=next==="test"?"Typing test":next==="drill"?(lesson.focus?"Focused practice":"Pair practice"):"Fresh-word retest";
  $("hint").textContent=next==="test"?"Start typing to begin":lesson.focus||("Target pair · "+lesson.pair.split("").join(" → "));
  $("spoken-prompt").textContent="Type the following words. "+words;
  $("report").hidden=true;$("word-detail").hidden=true;
  $("signal").textContent="Ready";$("results-nav").hidden=true;
  for(const control of $("configuration").querySelectorAll("select,input"))control.disabled=next!=="test";
  $("restart").lastElementChild.textContent=next==="test"?"Restart":"New test";
  paintBoard();meters();$("capture").focus({preventScroll:true});
}
const elapsed = (now=performance.now()) => state.elapsed+(state.since===null?0:now-state.since);
function meters(){
  const spent=elapsed(), kind=mode==="test"?settings.kind:"words";
  const wordTotal=state.text.split(" ").length;
  const completeWords=(state.text.slice(0,state.typed.length).match(/ /g)||[]).length+Number(state.typed.length===state.text.length);
  const target=kind==="time"?settings.target:kind==="chars"?state.text.length:wordTotal;
  const used=kind==="time"?spent/1000:kind==="chars"?state.typed.length:completeWords;
  $("time").textContent=Math.max(0,Math.ceil(target-used));$("unit").textContent={time:"s",words:"words",chars:"chars"}[kind];
  $("remaining-label").textContent={time:"Time remaining",words:"Words remaining",chars:"Characters remaining"}[kind];
  $("progress").value=Math.min(1,used/target);
  $("gauge").style.setProperty("--remaining",Math.max(0,1-used/target)*360+"deg");
  const correct=[...state.typed].filter((c,i)=>c===state.text[i]).length;
  $("wpm").textContent=spent>=500?Math.round(correct*12000/spent):"—";$("accuracy").textContent=state.shots?Math.round(100*state.hits/state.shots):"—";
}
function pause(){
  if(state.since===null||state.done)return;
  const spent=elapsed();if(spent>=state.limit){finish();return}
  state.elapsed=spent;state.since=null;state.last=null;clearInterval(timer);
  $("signal").textContent="Paused";$("hint").textContent="Paused · type to resume";meters();
}
function recordPress(key,code,pos,result,eventTime,omitted=""){
  const start=state.text.lastIndexOf(" ",Math.max(0,pos-1))+1;
  const boundary=state.text.indexOf(" ",pos),end=boundary<0?state.text.length:boundary;
  const extra=state.nodes[start]?.parentElement.querySelectorAll(".extra")||[];
  const entry=state.typed.slice(start,end).join("")+Array.from(extra,n=>n.textContent).join("");
  const previous=state.events.at(-1);
  const eventClock=Number.isFinite(eventTime)&&eventTime>=0&&eventTime<=performance.now()?eventTime:performance.now();
  const t=Math.max(previous?.t||0,Math.round(Math.min(state.limit,state.elapsed+Math.max(0,eventClock-(state.since??eventClock)))));
  state.events.push({t,key,code:code||"",offset:start,word:state.text.slice(start,end),entry,result,expected:state.text[pos]||"",omitted});
  const chip=document.createElement("span");
  chip.textContent=key===" "?"␣":key==="Backspace"?"⌫":key;
  chip.className=["Mistype","Extra","Skipped"].includes(result)?"trace-error":"";
  const trace=$("trace-events");trace.append(chip);if(trace.children.length>8)trace.firstChild.remove();
  $("trace-gap").textContent=previous?"Δ "+(t-previous.t)+" ms":"Δ — ms";
}
function input(ch,eventTime,code){
  if(state.done)return;const now=performance.now();if(elapsed(now)>=state.limit){finish();return}
  const pos=state.typed.length;
  if(ch===" " && (pos===0 || state.text[pos-1]===" ")){recordPress(ch,code,pos,"Ignored",eventTime);return}
  if(state.since===null){state.since=now;timer=setInterval(()=>{if(elapsed()>=state.limit)finish();else meters()},150);$("signal").textContent="Live";$("hint").textContent="Recording keystrokes"}
  const action={start:pos,extra:null};
  let result="Correct",omitted="";
  if(ch===" "){
    // A delimiter submits this word. Keep omitted positions aligned to the prompt.
    while(state.typed.length<state.text.length && state.text[state.typed.length]!==" "){
      state.nodes[state.typed.length].className="missed";
      omitted+=state.text[state.typed.length];result="Skipped";
      state.typed.push(null);
      state.shots++;
    }
    if(state.typed.length<state.text.length){
      state.nodes[state.typed.length].className="good";state.typed.push(" ");
      state.shots++;state.hits++;
    }
    state.last=null;
  }else if(state.text[pos]===" "){
    const extra=document.createElement("span");extra.textContent=ch;extra.className="bad extra";
    state.nodes[pos-1].parentElement.append(extra);action.extra=extra;
    state.edits.add(pos-1);state.shots++;state.last=null;
    result="Extra";
  }else{
    const match=ch===state.text[pos];state.shots++;if(match)state.hits++;
    if(!match)result="Mistype";
    if(match && /^[a-z]$/i.test(ch) && state.last!==null && eventTime>=state.last && pos>0 && /[a-z]/i.test(state.text[pos-1]) && state.typed[pos-1]===state.text[pos-1]){
      state.samples[pos]={pair:(state.text[pos-1]+ch).toLowerCase(),dt:eventTime-state.last,pos};
    }
    state.last=match?eventTime:null;state.typed.push(ch);state.nodes[pos].className=match?"good":"bad";
  }
  state.actions.push(action);
  recordPress(ch,code,pos,result,eventTime,omitted);
  const cap=keys.get(ch.toLowerCase());
  if(cap){cap.classList.add("hit");setTimeout(()=>cap.classList.remove("hit"),120)}
  if(Number.isFinite(state.limit) && state.text.length-state.typed.length<90)appendPrompt(" "+generator.words(35));
  if(state.typed.length===state.text.length){finish();return}
  cursor();meters();if(view==="timing"||selected)paintBoard();
}
function cursor(){
  const el=state.nodes[state.typed.length];el.className="current";
  const lineHeight=parseFloat(getComputedStyle($("test-area")).lineHeight);
  const y=el.getBoundingClientRect().top-$("passage").getBoundingClientRect().top;
  $("passage").style.top=-Math.max(0,Math.floor((y+lineHeight*.23)/lineHeight)-1)*lineHeight+"px";
}
function backspace(eventTime,code){
  if(state.done)return;
  if(elapsed()>=state.limit){finish();return}
  if(!state.actions.length){recordPress("Backspace",code,0,"Ignored",eventTime);return}
  const action=state.actions.pop();
  state.nodes[state.typed.length].classList.remove("current");
  if(action.extra)action.extra.remove();
  else {
    for(let i=action.start;i<state.typed.length;i++)state.nodes[i].className="";
    state.edits.add(action.start);state.typed.length=action.start;
    state.samples.length=Math.min(action.start,state.samples.length);
  }
  state.last=null;
  recordPress("Backspace",code,action.start,"Edit",eventTime);
  cursor();meters();paintBoard();
}
function finish(){
  if(state.done)return;state.elapsed=Math.min(state.limit,elapsed());state.since=null;state.done=true;clearInterval(timer);
  $("capture").disabled=true;$("signal").textContent="Complete";$("results-nav").hidden=false;$("hint").textContent="Session complete";$("status").textContent="Session complete. Your analysis is ready.";
  state.nodes[state.typed.length]?.classList.remove("current");meters();view="timing";paintBoard();report();
  if(state.shots>0)void accountProgress.complete({
    id:crypto.randomUUID(), phase:mode, kind:settings.kind, target:settings.target,
    profile:settings.profile, punctuation:settings.punctuation, caps:settings.caps,
    elapsedMs:Math.round(state.elapsed), hits:state.hits, attempts:state.shots,
    correctChars:state.typed.reduce((count,ch,i)=>count+Number(ch===state.text[i]),0)
  });
  $("report-title").focus({preventScroll:true});$("report").scrollIntoView({block:"start"});
}
function wordResults(){
  const entries=[];
  for(const match of state.text.matchAll(/[a-z]+/gi)){
    const end=match.index+match[0].length;
    if(end>state.typed.length)break;
    const pairs=state.samples.slice(match.index+1,end).filter(Boolean);
    if(!pairs.length || pairs.length!==match[0].length-1 || state.typed.slice(match.index,end).join("")!==match[0])continue;
    if([...state.edits].some(pos=>pos>=match.index && pos<end))continue;
    const total=pairs.reduce((sum,p)=>sum+p.dt,0);
    entries.push({word:match[0],pairs,pace:total/pairs.length,total});
  }
  return entries.sort((a,b)=>a.pace-b.pace);
}
function makeLesson(samples){
  const seen=new Set(state.text.slice(0,state.typed.length).toLowerCase().match(/[a-z]+/g)||[]);
  const bank=vocabularies[settings.profile]||[];
  const choices=[];
  for(const [pair,items] of group(samples,p=>p.pair)){
    if(items.length<3)continue;
    const contexts=new Set(items.map(({pos})=>{
      const start=state.text.lastIndexOf(" ",pos)+1;
      const stop=state.text.indexOf(" ",pos);
      return state.text.slice(start,stop<0?undefined:stop).toLowerCase().replace(/[^a-z]/g,"");
    }));
    if(contexts.size<2)continue;
    const available=settings.profile==="raw"?Array.from({length:10},()=>randomLetters(2)+pair+randomLetters(2)):bank.filter(w=>w.includes(pair));
    const fresh=shuffle([...new Set(available.filter(w=>!seen.has(w)))]);
    if(fresh.length<2||available.length<3)continue;
    const retest=fresh.slice(0,Math.min(4,Math.max(2,Math.floor(available.length/2))));
    const practice=shuffle(available.filter(w=>!retest.includes(w))).slice(0,5);
    if(practice.length)choices.push({pair,baseline:median(items.map(p=>p.dt)),accuracy:Math.round(100*state.hits/state.shots),count:items.length,practice:[...practice,...practice],retest});
  }
  return choices.sort((a,b)=>b.baseline-a.baseline)[0];
}
function coach(text,label,action){
  const box=$("coaching");box.replaceChildren();box.className="coach";const p=document.createElement("p");p.textContent=text;box.append(p);
  if(label){const b=document.createElement("button");b.className="action";b.textContent=label;b.onclick=()=>{action();$("session-title").scrollIntoView({block:"center"})};box.append(b)}
}
function report(){
  $("mistakes-only").checked=false;
  renderWordReview();
  document.querySelector("[data-comparison]")?.remove();
  const samples=state.samples.filter(Boolean);$("report").hidden=false;
  const label=mode==="test"?settings.target+" "+({time:"seconds",words:"words",chars:"characters"}[settings.kind]):$("session-title").textContent;
  $("summary-line").textContent=[label,profileNames[settings.profile],$("wpm").textContent+" wpm",$("accuracy").textContent+"% accuracy",Math.round(state.elapsed/100)/10+" s active"].join(" · ");
  stopReplay=replayPlayer($("replay-host"),{label:$("summary-line").textContent,date:state.date,prompt:state.text,duration:Math.round(state.elapsed),events:state.events},true);
  $("training-menu").replaceChildren();
  if(mode==="test"){
    lesson=makeLesson(samples);
    if(lesson)coach("Practice "+lesson.pair.split("").join(" → ")+". This was your slowest repeated pair with fresh words available for a retest. Median gap: "+ms(lesson.baseline)+" across "+lesson.count+" samples.","Start pair practice",()=>reset("drill"));
    else coach("There are too few repeated pairs with fresh practice words. Try a longer test to build a comparison.","Try again",()=>reset());
    showTrainingOptions();
  }else if(mode==="drill"){
    coach(lesson.focus?"Try "+lesson.focus.toLowerCase()+" in fresh words.":"Now try the same pair in fresh words. Your original median was "+ms(lesson.baseline)+".","Start fresh-word retest",()=>reset("retest"));
  }else if(lesson.focus){
    coach(trainingComparison(lesson),"New typing test",()=>reset());
  }else{
    const gaps=samples.filter(x=>x.pair===lesson.pair).map(x=>x.dt), value=median(gaps);
    coach(value===null?"No clean samples of your target pair this time.":"Your "+lesson.pair+" gap went from "+ms(lesson.baseline)+" to "+ms(value)+" across "+gaps.length+" fresh-word samples. Overall accuracy was "+lesson.accuracy+"% on the original test and "+$("accuracy").textContent+"% on the retest.","New typing test",()=>reset());
  }
  const directionNames={LL:"Left to left",RR:"Right to right",LR:"Left to right",RL:"Right to left"};
  const moves=group(samples,p=>hand(p.pair[0])+hand(p.pair[1]));
  const left=moves.get("LL")||[],right=moves.get("RR")||[];
  if(left.length>=8 && right.length>=8){
    const gap=median(right.map(p=>p.dt))-median(left.map(p=>p.dt));
    const note=document.createElement("p");note.className="muted";
    note.textContent=Math.round(Math.abs(gap))===0?"Left and right medians were equal to the nearest millisecond in this passage.":"In this passage, the median right-to-right gap was "+ms(Math.abs(gap))+" "+(gap>0?"longer":"shorter")+" than the left-to-left gap. Finger use is self-observed.";
    $("movement").before(note);note.dataset.comparison="true";
  }
  $("movement").className="stats";$("movement").innerHTML=Object.entries(directionNames).map(([k,name])=>{const list=moves.get(k)||[];return '<div class="stat">'+name+'<b>'+ms(median(list.map(x=>x.dt)))+'</b>'+list.length+' samples</div>'}).join("");
  const words=wordResults(),wrap=$("words");wrap.className="word-list";wrap.replaceChildren();
  for(const w of words){
    const b=document.createElement("button");b.textContent=w.word+" · "+ms(w.pace);b.onclick=()=>{const d=$("word-detail");d.hidden=false;d.textContent=w.word+" · "+ms(w.total)+" first to last letter.   "+w.pairs.map(p=>p.pair.split("").join(" → ")+"  "+ms(p.dt)).join("   |   ");selected=w.pairs.reduce((a,b)=>a.dt>b.dt?a:b).pair[1];paintBoard()};wrap.append(b);
  }
  if(!words.length)wrap.textContent="Type a whole word of at least two letters in one uninterrupted attempt to rank it.";
}
const field=$("capture");
function renderWordReview(){
  const rows=document.createDocumentFragment();
  for(const match of state.text.matchAll(/\S+/g)){
    if(match.index>=state.typed.length)break;
    const end=match.index+match[0].length;
    const extra=Array.from(state.nodes[match.index].parentElement.querySelectorAll(".extra"),el=>el.textContent).join("");
    const typed=state.typed.slice(match.index,end).join("")+extra;
    const result=end>state.typed.length?"Unfinished":typed===match[0]?"Correct":"Mistake";
    if($("mistakes-only").checked && result!=="Mistake")continue;
    const row=document.createElement("tr");
    for(const value of [match[0],typed,result]){
      const cell=document.createElement("td");cell.textContent=value;row.append(cell);
    }
    row.lastChild.className=result.toLowerCase();
    rows.append(row);
  }
  $("review-empty").hidden=Boolean(rows.childElementCount);
  $("review-empty").textContent=$("mistakes-only").checked?"No submitted words with mistakes.":"No words entered.";
  $("review-rows").replaceChildren(rows);
}
$("mistakes-only").onchange=renderWordReview;
field.addEventListener("keydown",e=>{
  if(e.ctrlKey||e.altKey||e.metaKey||e.isComposing)return;
  if(e.key==="Backspace"){e.preventDefault();backspace(e.timeStamp,e.code)}
  else if(e.key.length===1){e.preventDefault();if(!e.repeat)input(e.key,e.timeStamp,e.code)}
  else if(!state.done&&!e.repeat&&["Shift","CapsLock"].includes(e.key))recordPress(e.key,e.code,state.typed.length,"Modifier",e.timeStamp);
});
field.addEventListener("beforeinput",e=>{
  if(e.inputType==="insertText"&&e.data?.length===1){e.preventDefault();input(e.data,e.timeStamp)}
  else if(e.inputType==="deleteContentBackward"){e.preventDefault();backspace(e.timeStamp)}
  else e.preventDefault();
});
field.onpaste=e=>e.preventDefault();field.ondrop=e=>e.preventDefault();
field.onblur=pause;window.addEventListener("blur",pause);document.addEventListener("visibilitychange",()=>{if(document.hidden)pause()});
$("zones").onclick=()=>{view="zones";paintBoard()};$("timing").onclick=()=>{view="timing";paintBoard()};
function setTargets(){
  $("target-label").textContent={time:"Duration",words:"Words",chars:"Characters"}[settings.kind];
  $("target").replaceChildren(...targets[settings.kind].map(n=>new Option(n+(settings.kind==="time"?" s":""),n)));
  $("target").value=String(settings.target);
}
function configure(){
  const kind=$("test-mode").value;
  settings={kind,target:kind===settings.kind?Number($("target").value):defaults[kind],profile:$("profile").value,punctuation:$("punct").checked,caps:$("caps").checked};
  setTargets();$("profile-note").textContent=profileNotes[settings.profile]+(kind==="chars"?" Spaces and punctuation count toward the target.":"");
  reset();
}
const requestedProfile=new URLSearchParams(location.search).get("profile");
if(Object.hasOwn(profileNames,requestedProfile)){
  settings.profile=requestedProfile;$("profile").value=requestedProfile;
}
setTargets();$("profile-note").textContent=profileNotes[settings.profile];
$("configuration").addEventListener("change",configure);
$("restart").onclick=()=>reset();
makeBoard();reset();
