import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
const root = path.dirname(fileURLToPath(import.meta.url));
const ct = (p) => p.endsWith(".js") ? "text/javascript" : p.endsWith(".html") ? "text/html" : "application/octet-stream";
const server = http.createServer((q, s) => { const p = path.resolve(root, "." + q.url.split("?")[0]); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { s.writeHead(404); return s.end(); } s.writeHead(200, { "content-type": ct(p) }); fs.createReadStream(p).pipe(s); });
await new Promise((r) => server.listen(0, r));
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
pg.on("pageerror", (e) => console.log("pageerror", e.message));
await pg.goto(`http://localhost:${server.address().port}/verify.html`);
await pg.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
console.log(JSON.stringify(await pg.evaluate(() => window.info)));
const out = process.argv[2];
for (const [n, e, t] of [["comp-aerial", [34, 62, 95], [33, 2, 4]], ["comp-garden", [20, 9, 52], [30, 6, 0]]]) {
  const d = await pg.evaluate(([e, t]) => window.shot(e, t), [e, t]);
  fs.writeFileSync(path.join(out, n + ".jpg"), Buffer.from(d.split(",")[1], "base64"));
}
await b.close(); server.close();
