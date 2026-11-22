import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import worker from "../worker/handler.mjs";

test("session saves are idempotent, account-scoped and consistent with typing scores", async () => {
  const sqlite=new DatabaseSync(":memory:");
  try {
    sqlite.exec(readFileSync(new URL("../drizzle/0000_typing_sessions.sql",import.meta.url),"utf8"));
    const env={DB:{
      prepare(sql){return {bind(...params){const stmt=sqlite.prepare(sql);return {run:()=>stmt.run(...params),all:()=>stmt.all(...params)}}}},
      batch:statements=>statements.map(stmt=>({results:stmt.all()}))
    }};
    const origin="https://typelabz.test";
    const payload={id:"01a1f7bb-8596-4dcd-a887-478b78a474f9",phase:"test",kind:"words",target:10,profile:"standard",punctuation:false,caps:false,elapsedMs:12000,correctChars:50,hits:51,attempts:55};
    async function request(path,owner,body,extraHeaders={}){
      const headers={Origin:origin,...extraHeaders};
      if(owner){
        headers["oai-authenticated-user-id"]=owner;
        headers["oai-authenticated-user-email"]=owner+"@example.test";
        headers["X-TypeLabz-Account"]??=owner;
      }
      if(body)headers["Content-Type"]="application/json";
      return worker.fetch(new Request(origin+path,{headers,method:body?"POST":"GET",body:body?JSON.stringify(body):undefined}),env);
    }
    assert.deepEqual(await (await request("/api/account",null)).json(),{signedIn:false});
    assert.equal((await request("/api/progress",null,payload)).status,401);
    assert.equal((await request("/api/progress","owner-a",payload)).status,200);
    assert.equal((await request("/api/progress","owner-a",payload)).status,200);
    const first=await (await request("/api/progress","owner-a")).json();
    assert.equal(first.summary.sessions,1);
    assert.equal(first.summary.bestWpm,50);
    assert.equal(first.summary.accuracy,93);
    assert.equal(first.recent[0].id,payload.id);
    assert.equal((await request("/api/progress","owner-b",payload,{"X-TypeLabz-Account":"owner-a"})).status,409);
    assert.equal((await request("/api/progress","owner-b",payload,{Origin:"https://other.test"})).status,403);
    assert.equal((await request("/api/progress","owner-b",{...payload,hits:56})).status,400);
    assert.equal((await (await request("/api/progress","owner-b")).json()).summary.sessions,0);
    assert.equal((await request("/api/progress","owner-b",payload)).status,200);
    assert.equal((await (await request("/api/progress","owner-b")).json()).summary.sessions,1);
  } finally {sqlite.close()}
});
