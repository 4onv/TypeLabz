// Local-only preview. Production identity comes from the hosting gateway.
import { createServer } from "node:http";
import { readdir, readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import worker from "../dist/server/index.js";

const demo = process.argv.includes("--demo-account");
const port = Number(process.env.PORT || 4181);
const origin = "http://127.0.0.1:" + port;
const sql = new DatabaseSync(":memory:");
const migrations = new URL("../drizzle/", import.meta.url);
for (const file of (await readdir(migrations)).filter(f => f.endsWith(".sql")).sort()) {
  sql.exec(await readFile(new URL(file, migrations), "utf8"));
}

function statement(query, args = []) {
  const prepared = sql.prepare(query);
  return {
    bind: (...values) => statement(query, values),
    run: () => ({ success: true, meta: { changes: prepared.run(...args).changes } }),
    all: () => ({ results: prepared.all(...args) }),
    first: () => prepared.get(...args) ?? null
  };
}
const DB = {
  prepare: statement,
  batch(statements) {
    sql.exec("BEGIN");
    try {
      const results = statements.map(s => s.all());
      sql.exec("COMMIT");
      return results;
    } catch (error) {
      sql.exec("ROLLBACK");
      throw error;
    }
  }
};

createServer(async (req, res) => {
  try {
    if (req.headers.host !== new URL(origin).host) {
      res.writeHead(400).end("Use the printed loopback URL."); return;
    }
    const url = new URL(req.url, origin);
    if (url.pathname === "/signin-with-chatgpt" || url.pathname === "/signout-with-chatgpt") {
      if (!demo) {
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" }).end(
          "ChatGPT sign-in is available on the live TypeLabz site. For a local test account, restart the preview with --demo-account."
        ); return;
      }
      const signIn = url.pathname === "/signin-with-chatgpt";
      res.writeHead(303, { Location: "/", "Set-Cookie": "typelabz_demo=" + (signIn ? "1" : "") +
        "; Path=/; HttpOnly; SameSite=Strict" + (signIn ? "" : "; Max-Age=0") }).end(); return;
    }
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (value !== undefined && !name.startsWith("oai-") && name !== "cookie") {
        headers.set(name, Array.isArray(value) ? value.join(", ") : value);
      }
    }
    if (demo && (req.headers.cookie || "").split(/;\s*/).includes("typelabz_demo=1")) {
      headers.set("oai-authenticated-user-id", "local-demo");
      headers.set("oai-authenticated-user-full-name", "Local demo");
      headers.set("oai-authenticated-user-email", "demo@localhost.invalid");
    }
    const request = new Request(url, {
      method: req.method, headers,
      ...(["GET", "HEAD"].includes(req.method) ? {} : { body: req, duplex: "half" })
    });
    const response = await worker.fetch(request, { DB });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error.message);
    res.writeHead(500).end("Local preview failed.");
  }
}).listen(port, "127.0.0.1", () => console.log("TypeLabz: " + origin + (demo ? " (local demo sign-in enabled)" : "")));
