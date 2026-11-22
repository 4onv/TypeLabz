"use strict";

const accountProgress = (() => {
  const el=id=>document.getElementById(id);
  const queuedPrefix="typelabz.progress.pending.";
  const guestKey="typelabz.progress.afterSignIn";
  const memory=new Map();
  let account=null, current=null, loading, historyRequest=0, flushing=null;
  const formats={time:"s",words:" words",chars:" chars"};
  const phases={test:"Test",drill:"Practice",retest:"Retest"};
  const profiles={standard:"Everyday",code:"Code terms",hard:"Hard words",raw:"Random letters"};
  function stored(storage,key) {
    try{return JSON.parse(storage.getItem(key));}catch{return null;}
  }
  function remove(storage,key){try{storage.removeItem(key)}catch{}}
  function retain(summary){
    const key=queuedPrefix+account.accountId+"."+summary.id;
    memory.set(key,summary);
    try{localStorage.setItem(key,JSON.stringify(summary))}catch{}
  }
  function pending(){
    const prefix=queuedPrefix+account.accountId+".";
    const items=new Map([...memory].filter(([key])=>key.startsWith(prefix)));
    try{
      for(let n=0;n<localStorage.length;n++){
        const key=localStorage.key(n);
        if(key?.startsWith(prefix)){
          const value=stored(localStorage,key);
          if(value)items.set(key,value);
        }
      }
    }catch{}
    return items;
  }
  async function api(path,options={}){
    const response=await fetch("/api/"+path,{cache:"no-store",...options});
    if(!response.ok)throw new Error(String(response.status));
    return response.json();
  }
  function addCell(row,text,tag="td"){
    const cell=document.createElement(tag);cell.textContent=text;row.append(cell);
  }
  async function refresh(){
    const request=++historyRequest;
    try{
      const data=await api("progress");
      if(request!==historyRequest)return;
      const {summary,recent}=data;
      el("account-count").textContent=summary.sessions;
      el("account-best").textContent=summary.bestWpm===null?"—":summary.bestWpm+" wpm";
      el("account-accuracy").textContent=summary.accuracy===null?"—":summary.accuracy+"%";
      el("account-active").textContent=summary.activeMs<60000?Math.round(summary.activeMs/1000)+" s":Math.round(summary.activeMs/60000)+" min";
      const body=el("history-rows");body.replaceChildren();
      const date=new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
      for(const row of recent){
        const tr=document.createElement("tr");
        addCell(tr,date.format(row.savedAt));
        addCell(tr,(phases[row.phase]||"Test")+" · "+profiles[row.profile]+(row.phase==="test"?" · "+row.target+formats[row.kind]:"")+(row.punctuation&&row.phase==="test"?" · punct.":"")+(row.caps&&row.phase==="test"?" · caps":""));
        addCell(tr,row.wpm??"—");addCell(tr,row.accuracy+"%");body.append(tr);
      }
      el("history-table").hidden=!recent.length;
      el("history-note").textContent=recent.length?(recent.length<summary.sessions?"Showing your latest 50 sessions.":""):"Complete a session to start your history.";
    }catch{
      if(request===historyRequest)el("history-note").textContent="Couldn’t load your history. Refresh to try again.";
    }
  }
  async function flush(){
    if(!account?.signedIn)return;
    if(flushing){await flushing;return;}
    flushing=(async()=>{
      // Repeat because another test may finish during a network request.
      while(true){
        const items=pending();if(!items.size)break;
        for(const [key,summary] of items){
          await api("progress",{method:"POST",headers:{"Content-Type":"application/json","X-TypeLabz-Account":account.accountId},body:JSON.stringify(summary)});
          remove(localStorage,key);memory.delete(key);
          if(current?.id===summary.id)el("save-note").textContent="Saved to your progress.";
        }
        await refresh();
      }
    })().catch(()=>{
      el("save-note").textContent="Save pending. Use Refresh in Progress to retry.";
      el("history-note").textContent="A result is waiting to sync. Refresh to retry.";
    }).finally(()=>{flushing=null});
    await flushing;
  }
  async function init(){
    try{
      account=await api("account");
      if(typeof account.signedIn!=="boolean")throw Error();
      el("account-panel").hidden=false;
      el("progress-link").hidden=false;
      const link=el("identity-link");
      link.target="_top";
      link.href=account.signedIn?"/signout-with-chatgpt?return_to=%2F":"/signin-with-chatgpt?return_to=%2F%23account-panel";
      link.textContent=account.signedIn?"Sign out":"Sign in with ChatGPT";
      el("account-who").textContent=account.signedIn?account.name:"Sign in to keep test results and follow your progress across devices.";
      el("account-stats").hidden=!account.signedIn;el("history-refresh").hidden=!account.signedIn;
      el("account-top").hidden=false;
      el("account-top").href=account.signedIn?"#account-panel":link.href;
      el("account-top").textContent=account.signedIn?"My progress":"Sign in";
      if(!account.signedIn)el("account-top").target="_top";
      if(account.signedIn){
        const deferred=stored(sessionStorage,guestKey);
        if(deferred?.until>Date.now()&&deferred.summary?.id)retain(deferred.summary);
        remove(sessionStorage,guestKey);
        await flush();await refresh();
      }
    }catch{
      // The downloadable/static build can still run every guest test offline.
      account=null;
    }
  }
  async function complete(summary){
    current=summary;el("save-note").textContent="";el("guest-save").hidden=true;
    await loading;
    if(!account)return;
    if(!account.signedIn){
      if(current?.id!==summary.id)return;
      el("guest-save").hidden=false;
      el("guest-save").onclick=()=>{
        try{sessionStorage.setItem(guestKey,JSON.stringify({until:Date.now()+3600000,summary}))}
        catch{el("save-note").textContent="This browser could not keep this result through sign-in."}
      };
      return;
    }
    retain(summary);el("save-note").textContent="Saving result…";await flush();
  }
  el("history-refresh").onclick=async()=>{await flush();await refresh()};
  window.addEventListener("online",()=>{if(account?.signedIn)void flush()});
  loading=init();
  return {complete};
})();
