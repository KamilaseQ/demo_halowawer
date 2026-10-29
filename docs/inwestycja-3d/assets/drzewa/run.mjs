// Serves this folder, generates EZ-Tree species in headless Chrome (GPU), renders lookdev shots and exports GLBs.
// Usage: node run.mjs <recipes.json> <outDir> [export=1]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const [, , recipesFile, outDir, doExport = "1"] = process.argv;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".hdr": "application/octet-stream", ".json": "application/json" };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, "." + decodeURIComponent(req.url.split("?")[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
fs.mkdirSync(outDir, { recursive: true });
const recipes = JSON.parse(fs.readFileSync(recipesFile, "utf8"));

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on("pageerror", (e) => console.log("pageerror", e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("console", m.text().slice(0, 200)); });
await page.addInitScript((r) => { window.RECIPES = r; }, recipes.trees);
await page.goto(`http://localhost:${port}/gen.html`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 180000 });
const stats = await page.evaluate(() => window.stats);
console.table(stats.map(({ meshes, ...s }) => s));
fs.writeFileSync(path.join(outDir, "stats.json"), JSON.stringify(stats, null, 1));

const save = (name, dataUrl) => fs.writeFileSync(path.join(outDir, name), Buffer.from(dataUrl.split(",")[1], "base64"));
for (const [name, eye, target] of recipes.shots) save(`${name}.jpg`, await page.evaluate(([e, t]) => window.shot(e, t), [eye, target]));

if (doExport === "1") {
  const b64 = await page.evaluate(() => window.exportAll());
  fs.writeFileSync(path.join(outDir, "trees-raw.glb"), Buffer.from(b64, "base64"));
}
await browser.close();
server.close();
console.log("done");
