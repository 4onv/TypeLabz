// Deploy behind Sites dispatch. It owns sign-in and supplies the verified identity headers.
const kinds = {time:[15,30,60,90,120], words:[10,25,50,100], chars:[100,250,500,1000]};
const json = (data, status=200) => Response.json(data,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
function identity(request) {
  const id=request.headers.get("oai-authenticated-user-id"), email=request.headers.get("oai-authenticated-user-email");
  if (!id || !email) return null;
  let name=request.headers.get("oai-authenticated-user-full-name") || email;
  if(request.headers.get("oai-authenticated-user-full-name-encoding")==="percent-encoded-utf-8"){
    try {name=decodeURIComponent(name)} catch {name=email}
  }
  return {id,name};
}
function valid(session) {
  if(!session || typeof session!=="object" || Array.isArray(session))return false;
  const int=(n,max)=>Number.isSafeInteger(n) && n>=0 && n<=max;
  return typeof session.id==="string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(session.id)
    && ["test","drill","retest"].includes(session.phase) && Object.hasOwn(kinds,session.kind) && kinds[session.kind].includes(session.target)
    && ["standard","hard","code","raw"].includes(session.profile)
    && typeof session.caps==="boolean" && typeof session.punctuation==="boolean"
    && int(session.elapsedMs,2147483647) && int(session.attempts,10000000) && session.attempts>0
    && int(session.hits,session.attempts) && int(session.correctChars,session.hits);
}
async function history(db,owner){
  const score = "CASE WHEN elapsed_ms >= 500 THEN ROUND(correct_chars * 12000.0 / elapsed_ms) END";
  const [summary, history]=await db.batch([
    db.prepare(`SELECT COUNT(*) AS sessions, MAX(CASE WHEN phase='test' THEN ${score} END) AS bestWpm,
      ROUND(100.0 * SUM(hits)/SUM(attempts)) AS accuracy, COALESCE(SUM(elapsed_ms),0) AS activeMs 
      FROM typing_sessions WHERE user_id = ?`).bind(owner),
    db.prepare(`SELECT id,saved_at AS savedAt,phase,kind,target,profile,punctuation,caps,
      elapsed_ms AS elapsedMs,${score} AS wpm,ROUND(100.0*hits/attempts) AS accuracy 
      FROM typing_sessions WHERE user_id = ? ORDER BY saved_at DESC, id DESC LIMIT 50`).bind(owner)
  ]);
  return json({summary:summary.results[0],recent:history.results});
}
async function progress(request,db,user) {
  if(!user)return json({error:"Sign in to access your progress."},401);
  if(request.method==="GET")return history(db,user.id);
  if(request.method!=="POST")return json({error:"Unsupported method."},405);
  if(request.headers.get("Origin")!==new URL(request.url).origin)return json({error:"Invalid origin."},403);
  if(request.headers.get("X-TypeLabz-Account")!==user.id)return json({error:"Your account has changed. Refresh before saving."},409);
  if(!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json"))return json({error:"JSON required."},415);
  const body=await request.text();
  if(body.length>4096)return json({error:"Summary too large."},413);
  let s;try{s=JSON.parse(body)}catch{return json({error:"Invalid summary."},400)}
  if(!valid(s))return json({error:"Invalid session summary."},400);
  await db.prepare(`INSERT INTO typing_sessions(user_id,id,saved_at,phase,kind,target,profile,punctuation,caps,elapsed_ms,correct_chars,hits,attempts)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,id) DO NOTHING`)
    .bind(user.id,s.id,Date.now(),s.phase,s.kind,s.target,s.profile,Number(s.punctuation),Number(s.caps),s.elapsedMs,s.correctChars,s.hits,s.attempts).run();
  return json({saved:true});
}
export default {
  async fetch(request,env) {
    const path=new URL(request.url).pathname;
    if(path==="/api/account"){
      if(request.method!=="GET")return json({error:"Unsupported method."},405);
      const user=identity(request);
      return json(user?{signedIn:true,accountId:user.id,name:user.name}:{signedIn:false});
    }
    if(path==="/api/progress"){
      try{return await progress(request,env.DB,identity(request))}
      catch{return json({error:"Progress is temporarily unavailable. Please retry."},503)}
    }
    if(path.startsWith("/api/"))return json({error:"Unknown endpoint."},404);
    if(request.method!=="GET" && request.method!=="HEAD")return new Response(null,{status:405});
    const name = path === "/" ? "/index.html" : path === "/designs" ? "/designs.html" : path;
    const asset=ASSETS[name];
    if(!asset)return new Response("Page not found",{status:404});
    const bytes=request.method==="HEAD"?null:Uint8Array.from(atob(asset[1]),c=>c.charCodeAt(0));
    return new Response(bytes,{headers:{"Content-Type":asset[0],"Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"}});
  }
};
