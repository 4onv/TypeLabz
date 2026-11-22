import { readFile, readdir, mkdir, writeFile, copyFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = join(root, "dist");
const types = {".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".svg":"image/svg+xml",".webp":"image/webp"};
const assets = {};
async function include(relative = "") {
  for (const entry of await readdir(join(dist, relative), {withFileTypes:true})) {
    if (entry.name.startsWith(".") || entry.name === "server") continue;
    const name = relative ? relative + "/" + entry.name : entry.name;
    if (entry.isDirectory()) { await include(name); continue; }
    const mime = types[extname(name)];
    if (!mime || !entry.isFile()) continue;
    const bytes = await readFile(join(dist, name));
    assets["/" + name] = [mime, bytes.toString("base64")];
  }
}
await include();
const artifact = join(dist, "server/index.js");
await mkdir(dirname(artifact), {recursive:true});
const handler = await readFile(join(root, "worker/handler.mjs"), "utf8");
await writeFile(artifact,"const ASSETS = "+JSON.stringify(assets)+";\n"+handler);
await mkdir(join(dist,".openai"), {recursive:true});
await copyFile(join(root,".openai/hosting.json"),join(dist,".openai/hosting.json"));
console.log("Built TypeLabz account Worker and "+Object.keys(assets).length+" assets.");
