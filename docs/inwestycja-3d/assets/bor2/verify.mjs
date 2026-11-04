// Test GLB w prawdziwym three.js projektu (GLTFLoader + MeshoptDecoder) w przeglądarce bez okna.
//
//   node docs/inwestycja-3d/assets/bor2/verify.mjs <plik.glb> <katalog_na_zrzuty> [widok ...]
//
// Widoki: "aerial" (z ukosa), "inside" (z góry, przekrój), albo nazwa kamery ze sceny SketchUpa
// w wersji po GLTFLoaderze (spacje -> "_", kropki usunięte), np. "Scene_1".
// Przeglądarka: zmienna BROWSER albo pierwsza znaleziona z listy niżej (Chromium: Chrome/Edge/Vivaldi/Opera).
// Uruchamiać z katalogu głównego projektu (serwuje /node_modules i /docs).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const [glbArg, outDir, ...views] = process.argv.slice(2);
if (!glbArg || !outDir) {
  console.error("użycie: node verify.mjs <plik.glb> <katalog_na_zrzuty> [widok ...]");
  process.exit(2);
}
const root = process.cwd();
const glbUrl = "/" + path.relative(root, path.resolve(glbArg)).split(path.sep).join("/");
const page = "/" + path.relative(root, path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "verify.html")).split(path.sep).join("/");

const candidates = [
  process.env.BROWSER,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Opera/opera.exe",
  // Vivaldi celowo pominięty: uruchamia się, ale Playwright nie otwiera w nim karty (wisi).
].filter(Boolean);
const executablePath = candidates.find((p) => fs.existsSync(p));
if (!executablePath) throw new Error("Nie znaleziono przeglądarki Chromium. Ustaw BROWSER=<ścieżka do exe>.");

const types = { ".js": "text/javascript", ".mjs": "text/javascript", ".html": "text/html", ".glb": "model/gltf-binary", ".wasm": "application/wasm" };
const server = http.createServer((q, s) => {
  if (q.url === "/favicon.ico") { s.writeHead(204); return s.end(); }
  const p = path.join(root, decodeURIComponent(q.url.split("?")[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(s);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));

const browser = await chromium.launch({ executablePath, headless: true, timeout: 60000, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(what + ": przekroczono czas")), ms))]);
try {
  const pg = await withTimeout(browser.newPage({ viewport: { width: 1440, height: 900 } }), 30000, "otwarcie karty");
  const errors = [];
  pg.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  pg.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(m.type() + ": " + m.text()); });
  await pg.goto(`http://127.0.0.1:${server.address().port}${page}?glb=${encodeURIComponent(glbUrl)}`);
  await pg.waitForFunction(() => window.ready === true, null, { timeout: 300000 });
  const info = await pg.evaluate(() => ({ ...window.info, errors: window.errors }));
  console.log("przegladarka:", path.basename(executablePath));
  if (!info.loadMs) {
    console.log("BLAD: GLTFLoader nie wczytal pliku:\n  " + [...info.errors, ...errors].join("\n  "));
    process.exitCode = 1;
    throw new Error("GLB nie laduje sie w three.js");
  }
  console.log(JSON.stringify(info, null, 1));
  fs.mkdirSync(outDir, { recursive: true });
  const base = path.basename(glbArg, ".glb");
  for (const v of views.length ? views : ["aerial"]) {
    const data = await pg.evaluate((v) => window.shot(v), v);
    if (!data) { console.log("brak widoku/kamery:", v); continue; }
    const stats = await pg.evaluate(() => [window.lastCalls, window.lastTris]);
    const file = path.join(outDir, `${base}-threejs-${v.replace(/[^\p{L}\p{N}]+/gu, "_")}.jpg`);
    fs.writeFileSync(file, Buffer.from(data.split(",")[1], "base64"));
    console.log(`zrzut ${file} | draw calle (z cieniami): ${stats[0]} | trojkaty: ${stats[1]}`);
  }
  console.log(errors.length ? "BLEDY/OSTRZEZENIA:\n  " + errors.join("\n  ") : "brak bledow w konsoli");
} finally {
  await browser.close();
  server.close();
}
