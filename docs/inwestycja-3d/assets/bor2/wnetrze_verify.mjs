// Porównanie wnętrza (three.js, oświetlenie jak w runtime) z renderami dewelopera.
//
//   node docs/inwestycja-3d/assets/bor2/wnetrze_verify.mjs <plik.glb> <katalog> [lm=1|0] [ujecia=interior-4,interior-8] [pkt=PKT_SALON,...] [prefiks=wnetrze-porownanie] [hemi=1]
//
// Ujęcia z ujecia-porownawcze.json (sesja e3: pozycja/kierunek w układzie GLB, yfov, near). Zrzut: lewa połowa
// three.js, prawa render. Uruchamiać z katalogu głównego projektu (serwuje /node_modules, /docs, /public).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const [glbArg, outDir, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.filter((a) => a.includes("=")).map((a) => a.split(/=(.*)/s).slice(0, 2)));
const root = process.cwd();
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const rel = (p) => "/" + path.relative(root, path.resolve(p)).split(path.sep).join("/");
const ujecia = JSON.parse(fs.readFileSync(path.join(here, "ujecia-porownawcze.json"), "utf8")).ujecia;
const want = (opt.ujecia ?? "").split(",").filter(Boolean);
const shots = [];
for (const u of ujecia) {
  const name = u.render.replace(/\.jpg$/, "");
  if (!want.includes(name)) continue;
  shots.push({ pos: u.pozycja, dir: u.kierunek, yfov: u.yfov, near: u.near, shift: u.shift, render: "/" + u.plik_renderu, label: `${name} | ${u.kamera_skp} | three.js ${opt.lm === "0" ? "bez lightmap" : "z lightmapą"}`, file: name });
}
for (const c of (opt.pkt ?? "").split(",").filter(Boolean)) shots.push({ cam: c, yfov: 60, near: 0.05, label: c, file: c });
const candidates = [process.env.BROWSER, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].filter(Boolean);
const executablePath = candidates.find((p) => fs.existsSync(p));
const types = { ".js": "text/javascript", ".mjs": "text/javascript", ".html": "text/html", ".glb": "model/gltf-binary", ".wasm": "application/wasm", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg" };
// /__ext/ -> katalog z GLB i lightmapami spoza repo (kandydat w katalogu roboczym): glb=<plik> lm z <katalog>/lm/
const extDir = path.dirname(path.resolve(glbArg));
const external = !path.resolve(glbArg).startsWith(root);
const server = http.createServer((q, s) => {
  const u = decodeURIComponent(q.url.split("?")[0]);
  let p = path.join(root, u);
  if (u.startsWith("/__ext/")) {
    p = path.join(extDir, u.slice(7).replace(/^wnetrza-lm\//, "lm/"));
    if (!fs.existsSync(p)) { s.writeHead(404); return s.end(); }
    s.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
    return fs.createReadStream(p).pipe(s);
  }
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(s);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({ executablePath, headless: true, timeout: 60000, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--no-proxy-server"] });
try {
  const pg = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  pg.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  pg.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(m.type() + ": " + m.text()); });
  const glbUrl = external ? "/__ext/" + path.basename(glbArg) : rel(glbArg);
  const qs = `glb=${encodeURIComponent(glbUrl)}&lm=${opt.lm ?? "1"}&hemi=${opt.hemi ?? "1"}&lmk=${opt.lmk ?? "1"}`;
  await pg.goto(`http://127.0.0.1:${server.address().port}${rel(path.join(here, "wnetrze_verify.html"))}?${qs}`);
  await pg.waitForFunction(() => window.ready === true, null, { timeout: 300000 });
  console.log(JSON.stringify(await pg.evaluate(() => ({ ...window.info, errors: window.errors }))));
  if (opt.sweep) {
    // Sweep: po 3 ujęcia z każdego punktu spaceru (oczy 1,65 m), yaw -65°, 0°, +65°.
    const cams = await pg.evaluate(() => window.info.cameras);
    for (const c of cams.filter((c) => /^PKT_/.test(c))) for (const yaw of [-65, 0, 65]) shots.push({ cam: c, yaw, yfov: 62, near: 0.05, label: `${c} yaw ${yaw}`, file: `${c}_${yaw}` });
  }
  fs.mkdirSync(outDir, { recursive: true });
  const prefix = opt.prefiks ?? "wnetrze-porownanie";
  for (const s of shots) {
    const data = await pg.evaluate((s) => window.shot(s), s);
    if (!data) { console.log("brak ujecia", s.file); continue; }
    const f = path.join(outDir, `${prefix}-${s.file}.jpg`);
    fs.writeFileSync(f, Buffer.from(data.split(",")[1], "base64"));
    console.log("zrzut", f);
  }
  if (errors.length) console.log("BLEDY:\n  " + errors.slice(0, 20).join("\n  "));
} finally {
  await browser.close();
  server.close();
}
