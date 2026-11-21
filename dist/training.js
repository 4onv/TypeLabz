"use strict";

function letterAttempts(events, letter) {
  let hits=0, misses=0;
  for (const event of events) {
    if (event.expected.toLowerCase()===letter) {
      if (event.result==="Correct" && event.key!==" ") hits++;
      if (event.result==="Mistype") misses++;
    }
    if (event.omitted) misses += [...event.omitted.toLowerCase()].filter(ch=>ch===letter).length;
  }
  return {hits, misses, total:hits+misses};
}

function trainingComparison(target) {
  if (target.kind==="accuracy") {
    const current=letterAttempts(state.events,target.letter), before=target.original;
    const describe=count=>count.total?count.hits+"/"+count.total+" correct ("+Math.round(100*count.hits/count.total)+"%)":"no attempts";
    return "Target "+target.letter.toUpperCase()+" · original test "+describe(before)+" · fresh-word retest "+describe(current)+".";
  }
  const gaps=state.samples.filter(s=>s?.pair===target.pair).map(s=>s.dt);
  const before=target.count?ms(target.baseline)+" across "+target.count+" samples":"no baseline samples";
  return target.focus+" · original test "+before+" · fresh-word retest "+(gaps.length?ms(median(gaps))+" across "+gaps.length+" samples":"no clean samples")+".";
}

function showTrainingOptions() {
  const menu=$("training-menu");
  const heading=document.createElement("h3");heading.textContent="Targeted training";menu.append(heading);
  const grid=document.createElement("div");grid.className="training-grid";menu.append(grid);
  const seen=new Set(state.events.map(e=>e.word.toLowerCase().replace(/[^a-z]/g,"")));
  const bank=vocabularies[settings.profile]||[];
  function material(needle) {
    const options=settings.profile==="raw"
      ? Array.from({length:16},()=>randomLetters(2)+needle+randomLetters(2))
      : bank.filter(w=>w.includes(needle));
    const fresh=shuffle([...new Set(options.filter(w=>!seen.has(w)))]);
    if(fresh.length<2 || options.length<3)return null;
    const retest=fresh.slice(0,Math.min(4,fresh.length,Math.max(2,Math.floor(options.length/2))));
    const practice=shuffle(options.filter(w=>!retest.includes(w))).slice(0,5);
    return practice.length?{practice:practice.concat(shuffle(practice)),retest}:null;
  }
  function add(target,description,buttonText){
    const card=document.createElement("article"),heading=document.createElement("h4"),p=document.createElement("p"),button=document.createElement("button");
    heading.textContent=target.focus;p.textContent=description;button.textContent=buttonText;
    button.onclick=()=>{lesson=target;reset("drill");$("session-title").scrollIntoView({block:"center"})};
    card.append(heading,p,button);grid.append(card);
  }
  const errors=[];
  for(const letter of "abcdefghijklmnopqrstuvwxyz"){
    const original=letterAttempts(state.events,letter);
    if(original.misses)errors.push({letter,original});
  }
  errors.sort((a,b)=>b.original.misses-a.original.misses);
  for(const {letter,original} of errors){
    const drill=material(letter);if(!drill)continue;
    const substitutions=state.events.filter(e=>e.result==="Mistype" && e.expected.toLowerCase()===letter);
    const common=[...group(substitutions,e=>e.key).entries()].sort((a,b)=>b[1].length-a[1].length)[0];
    const detail=common?" Most frequent substitution: "+common[0]+" ("+common[1].length+"×).":" The target letter was skipped.";
    add({...drill,kind:"accuracy",letter,original,focus:"Accuracy on "+letter.toUpperCase()},original.misses+" misses across "+original.total+" attempts."+detail,"Train this letter");break;
  }
  for(const side of ["R","L"]){
    const sideName=side==="R"?"Right":"Left", samples=state.samples.filter(s=>s&&[...s.pair].every(k=>hand(k)===side));
    const observed=[...group(samples,s=>s.pair)].filter(([,items])=>items.length>=2)
      .sort((a,b)=>median(b[1].map(s=>s.dt))-median(a[1].map(s=>s.dt)));
    // With sparse evidence, offer a labeled practice movement present in this vocabulary.
    const candidates=new Set(observed.map(([pair])=>pair));
    for(const word of (bank.length?bank:["no","in","er","st"])){
      for(let i=1;i<word.length;i++)if(hand(word[i-1])===side && hand(word[i])===side && word[i-1]!==word[i])candidates.add(word.slice(i-1,i+1));
    }
    for(const pair of candidates){
      const drill=material(pair);if(!drill)continue;
      const items=samples.filter(s=>s.pair===pair),baseline=median(items.map(s=>s.dt));
      const description=items.length?"Your median was "+ms(baseline)+" across "+items.length+" clean samples.":"An optional US QWERTY movement. This session has no clean baseline for this pair.";
      add({...drill,kind:"zone",pair,baseline,count:items.length,focus:sideName+" zone · "+pair.split("").join(" → ")},description,"Train "+sideName.toLowerCase()+" zone");break;
    }
  }
  if(!grid.childElementCount)menu.replaceChildren();
}
