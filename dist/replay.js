"use strict";

// This player is self-contained so a saved session can use the same renderer offline.
function replayPlayer(host, session, allowDownload = false) {
  const root = host.shadowRoot || host.attachShadow({mode:"open"});
  root.innerHTML = `<style>
    :host{display:block;color:#f2efe8;font-family:Inter,"Segoe UI",sans-serif}
    *{box-sizing:border-box}.player{background:#1a1c19;border:1px solid #47493e;border-radius:13px;overflow:hidden}
    .head,.transport,.readout,.clockline{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
    .head{justify-content:space-between;padding:15px 18px;border-bottom:1px solid #373a32}
    h3{margin:0;font-size:19px;letter-spacing:-.04em}.meta,.clockline,.readout{font:13px/1.5 Consolas,monospace;color:#bdbeb2}
    .body{padding:16px 18px}.focus{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}
    .box{background:#292c25;border-radius:7px;padding:10px 13px;min-width:0}.label{font:12px "Segoe UI",sans-serif;color:#bbbdb0}
    .context{font:14px/1.6 Consolas,monospace;color:#b6bbad;margin:0 0 12px;overflow-wrap:anywhere}.context b{color:#f1d9b9;text-decoration:underline;text-underline-offset:3px}
    .word{min-height:27px;font:20px/1.4 Consolas,monospace;overflow-wrap:anywhere}.fault{color:#ffaaa0}
    .board{max-width:720px;margin:0 auto 10px;background:#181a17;padding:5px;border:1px solid #383c31;border-radius:7px}
    .row{display:flex;gap:3px;margin:3px}.key{flex:var(--size,1) 1 0;min-width:0;text-align:center;font:12px/25px Consolas,monospace;
      height:27px;background:#30342c;color:#dddcd0;border-radius:4px;border-bottom:2px solid #252820}
    .on{background:#e4c49b;color:#251e15}.on.fault{background:#ffaba0;color:#38201a}
    .readout{justify-content:space-between}.readout b{color:#efdec8}.ruler{width:100%;accent-color:#dab88f;cursor:pointer}
    .clockline{justify-content:space-between}.transport{margin-top:11px;gap:7px}
    .activity{display:flex;gap:2px;align-items:flex-end;height:25px;margin-top:11px;border-bottom:1px solid #444a3e}
    .activity i{flex:1;background:#89a58e}.activity i.error{background:#e59c8e}.activity-label{font:12px/1.4 Consolas,monospace;color:#bcbfb2;margin-top:5px}
    button,select{font:600 14px "Segoe UI",sans-serif;background:#32362d;color:#f4f1e7;border:1px solid #515647;border-radius:6px;padding:6px 10px;cursor:pointer}
    button:disabled{opacity:.45;cursor:default}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #f0c79b;outline-offset:2px}
    .primary{background:#ddbd98;color:#292016;border-color:#ddbd98}.speed{margin-left:auto}.speed select{margin-left:5px}
    @media(max-width:570px){.body,.head{padding:12px}.key{font-size:9px;line-height:21px;height:23px}.row{gap:2px;margin:2px}.board{padding:3px}.speed{margin-left:0}.readout{gap:4px}.transport{gap:5px}}
  </style>
  <section class="player" aria-label="Session replay"><div class="head"><div><h3>Session replay</h3><div class="meta"></div></div><button class="save">Save offline replay</button></div>
  <div class="body"><p class="context" aria-label="Passage excerpt"></p><div class="focus"><div class="box"><div class="label">Expected word</div><div class="word expected"></div></div><div class="box"><div class="label">Your input</div><div class="word entered"></div></div></div>
  <div class="board" aria-label="Playback keyboard"></div><div class="readout"><span class="event"></span><span class="gap"></span></div>
  <div class="activity" aria-hidden="true"></div><div class="activity-label">Key activity · coral marks a mistake</div>
  <input class="ruler" type="range" min="0" value="0" step="1" aria-label="Replay position"><div class="clockline"><span class="position"></span><span class="total"></span></div>
  <div class="transport"><button class="play primary">Play</button><button class="prev">Previous key</button><button class="next">Next key</button><button class="mistake">Next mistake</button><label class="speed">Speed<select aria-label="Playback speed"><option>0.25×</option><option>0.5×</option><option selected>1×</option><option>2×</option></select></label></div></div></section>`;
  const el = selector => root.querySelector(selector);
  const events=session.events, duration=Math.max(1,session.duration,events.at(-1)?.t || 0);
  const words=[...session.prompt.matchAll(/\S+/g)];
  const wordIndices=new Map(words.map((match,i)=>[match.index,i]));
  const rows=[
    ["Backquote|`",..."1234567890".split("").map(n=>"Digit"+n+"|"+n),"Minus|-","Equal|=","Backspace|⌫|2"],
    ["Tab|Tab|1.5",..."QWERTYUIOP".split("").map(k=>"Key"+k+"|"+k),"BracketLeft|[","BracketRight|]","Backslash|\\"],
    ["CapsLock|Caps|1.75",..."ASDFGHJKL".split("").map(k=>"Key"+k+"|"+k),"Semicolon|;","Quote|'","Enter|Enter|2"],
    ["ShiftLeft|Shift|2.1",..."ZXCVBNM".split("").map(k=>"Key"+k+"|"+k),"Comma|,","Period|.","Slash|/","ShiftRight|Shift|2.4"],
    ["ControlLeft|Ctrl|1.4","MetaLeft|Win|1.3","AltLeft|Alt|1.3","Space|Space|7","AltRight|Alt|1.3","MetaRight|Win|1.3","ControlRight|Ctrl|1.4"]
  ];
  const keyMap=new Map(), symbols=new Map();
  for(const row of rows){
    const line=document.createElement("div");line.className="row";
    for(const description of row){
      const [code,label,size]=description.split("|");const key=document.createElement("span");
      key.className="key";key.textContent=label;key.style.setProperty("--size",size||1);
      keyMap.set(code,key);symbols.set(label.toLowerCase(),code);line.append(key);
    }
    el(".board").append(line);
  }
  const shifted={"!":"Digit1","@":"Digit2","#":"Digit3","$":"Digit4","%":"Digit5","^":"Digit6","&":"Digit7","*":"Digit8","(":"Digit9",")":"Digit0","_":"Minus","+":"Equal","{":"BracketLeft","}":"BracketRight","|":"Backslash",":":"Semicolon",'"':"Quote","<":"Comma",">":"Period","?":"Slash","~":"Backquote"," ":"Space","Backspace":"Backspace"};
  const isFault=e=>["Mistype","Extra","Skipped"].includes(e.result);
  const errors=events.flatMap((e,i)=>isFault(e)?[i]:[]);
  const buckets=Array.from({length:64},()=>({count:0,error:false}));
  for(const e of events){
    const bucket=buckets[Math.min(63,Math.floor(64*e.t/duration))];bucket.count++;bucket.error ||= isFault(e);
  }
  const peak=Math.max(1,...buckets.map(b=>b.count));
  for(const bucket of buckets){
    const bar=document.createElement("i");bar.style.height=(100*bucket.count/peak)+"%";
    if(bucket.error)bar.className="error";el(".activity").append(bar);
  }
  const fmt=t=>(t/1000).toFixed(2)+" s";
  let index=-1,time=0,playing=false,frame=0,anchor=0,start=0,speed=1;
  el(".meta").textContent=session.label+" · "+events.length+" key presses · active time";
  el(".total").textContent=fmt(duration);el(".ruler").max=duration;
  let lastIndex=-2,lastHighlight=false,lastWord=-1,lastPlaying=null;
  const positionLabel=el(".position"),ruler=el(".ruler"),playButton=el(".play");
  function draw(){
    const e=events[index];
    const highlight=Boolean(e&&(!playing||time-e.t<=160));
    positionLabel.textContent=fmt(time);ruler.value=time;
    playButton.textContent=playing?"Pause":time>=duration?"Replay":"Play";
    if(index===lastIndex && highlight===lastHighlight && playing===lastPlaying)return;
    lastIndex=index;lastHighlight=highlight;lastPlaying=playing;
    const wordIndex=wordIndices.get(e?.offset??0)??0;
    if(wordIndex!==lastWord){
      const excerpt=el(".context");excerpt.replaceChildren();
      for(let i=Math.max(0,wordIndex-2);i<Math.min(words.length,wordIndex+4);i++){
        const token=document.createElement(i===wordIndex?"b":"span");token.textContent=words[i][0];excerpt.append(token," ");
      }
      lastWord=wordIndex;
    }
    for(const key of keyMap.values())key.classList.remove("on","fault");
    if(highlight){
      const code=keyMap.has(e.code)?e.code:shifted[e.key]||symbols.get(e.key.toLowerCase());
      const key=keyMap.get(code);if(key){key.classList.add("on");key.classList.toggle("fault",isFault(e))}
    }
    el(".expected").textContent=e?.word||session.prompt.split(" ")[0]||"—";
    el(".entered").textContent=e?.entry||"—";el(".entered").classList.toggle("fault",!!e&&isFault(e));
    el(".event").textContent=e?(index+1)+" / "+events.length+"   "+(e.key===" "?"Space":e.key)+" · "+e.result:"Before first key";
    el(".gap").textContent=index>0?"Δ "+Math.max(0,e.t-events[index-1].t)+" ms":"Δ —";
    el(".prev").disabled=index<0;el(".next").disabled=index>=events.length-1;
    el(".mistake").disabled=!errors.length||index>=errors.at(-1);
  }
  function seek(t){
    time=Math.max(0,Math.min(duration,t));let lo=0,hi=events.length;
    while(lo<hi){const mid=(lo+hi)>>>1;if(events[mid].t<=time)lo=mid+1;else hi=mid}
    index=lo-1;
  }
  function stop(){playing=false;cancelAnimationFrame(frame)}
  function select(i){stop();index=i;time=i<0?0:events[i].t;draw()}
  function tick(){
    seek(start+(performance.now()-anchor)*speed);if(time>=duration)stop();
    draw();if(playing)frame=requestAnimationFrame(tick);
  }
  el(".play").onclick=()=>{if(playing){tick();stop();draw();return}if(time>=duration){index=-1;time=0}
    playing=true;anchor=performance.now();start=time;tick()};
  el(".prev").onclick=()=>select(index-1);el(".next").onclick=()=>select(index+1);
  el(".mistake").onclick=()=>select(errors.find(i=>i>index));
  el(".ruler").oninput=e=>{stop();seek(Number(e.target.value));draw()};
  el("select").onchange=e=>{if(playing)seek(start+(performance.now()-anchor)*speed);speed=parseFloat(e.target.value);start=time;anchor=performance.now()};
  el(".save").hidden=!allowDownload;
  if(!allowDownload)el(".save").remove();
  else el(".save").onclick=()=>{
    const payload=JSON.stringify(session).replaceAll("<","\\u003c");
    const html='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; connect-src \'none\'"><title>TypeLabz · Offline replay</title><style>:root{color-scheme:dark;background:#171715}main{max-width:820px;margin:5vh auto;padding:12px}h1{font:600 25px system-ui;color:#f0eadf}</style><main><h1>TypeLabz</h1><div id="player"></div></main><script>('+replayPlayer.toString()+')(document.getElementById("player"),'+payload+');</scr'+'ipt></html>';
    const url=URL.createObjectURL(new Blob([html],{type:"text/html;charset=utf-8"}));
    const a=document.createElement("a");a.href=url;a.download="TypeLabz-replay-"+session.date.replace(/[:.]/g,"-")+".html";
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  };
  draw();return stop;
}
