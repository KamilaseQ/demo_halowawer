// Zrzuty stanowiska testowego tekstur (verify.html) w three.js projektu, Chrome bez okna.
//
//   node docs/inwestycja-3d/assets/tekstury/skrypty/verify.mjs <katalog_na_zrzuty> [widok[:bare] ...] [--q=param=wartosc&...]
//
// Widoki: d1 d3 d8 (oczy 1,65 m, 1/3/8 m od ściany), okno, dach, wzdluz, kafle, taras. Sufiks ":bare" = bez tekstur.
// Uruchamiać z katalogu głównego projektu (serwuje /node_modules, /docs i /public).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const q = (args.find((a) => a.startsWith("--q=")) || "--q=").slice(4);
const [outDir, ...views] = args.filter((a) => !a.startsWith("--"));
if (!outDir) { console.error("użycie: node verify.mjs <katalog> [widok ...]"); process.exit(2); }
const root = process.cwd();
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const page = "/" + path.relative(root, path.join(decodeURIComponent(here), "verify.html")).split(path.sep).join("/");
const executablePath = process.env.BROWSER || "C:/Program Files/Google/Chrome/Application/chrome.exe";

const types = { ".js": "text/javascript", ".mjs": "text/javascript", ".html": "text/html", ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png", ".hdr": "application/octet-stream" };
const server = http.createServer((qq, s) => {
  if (qq.url === "/favicon.ico") { s.writeHead(204); return s.end(); }
  const p = path.join(root, decodeURIComponent(qq.url.split("?")[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(s);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));

const browser = await chromium.launch({ executablePath, headless: true, timeout: 60000, args: ["--no-proxy-server", "--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
try {
  const pg = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  pg.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  pg.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(m.type() + ": " + m.text()); });
  await pg.goto(`http://127.0.0.1:${server.address().port}${page}?${q}`);
  await pg.waitForFunction(() => window.ready === true, null, { timeout: 180000 });
  console.log(JSON.stringify(await pg.evaluate(() => window.info)));
  fs.mkdirSync(outDir, { recursive: true });
  for (const spec of views.length ? views : ["d1", "d3", "d8"]) {
    const [v, flag] = spec.split(":");
    const data = await pg.evaluate(([v, bare]) => window.shot(v, { bare }), [v, flag === "bare"]);
    if (!data) { console.log("brak widoku:", v); continue; }
    const file = path.join(outDir, `${v}${flag ? "-" + flag : ""}.jpg`);
    fs.writeFileSync(file, Buffer.from(data.split(",")[1], "base64"));
    console.log("zrzut", file);
  }
  console.log(errors.length ? "BLEDY/OSTRZEZENIA:\n  " + errors.join("\n  ") : "brak bledow w konsoli");
} finally {
  await browser.close();
  server.close();
}
