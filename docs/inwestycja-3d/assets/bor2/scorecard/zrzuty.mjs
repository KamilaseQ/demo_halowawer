// Zrzuty do scorecardu ΔE, kamery z ../ujecia-porownawcze.json, kadr o proporcjach renderu (szer. 960 px).
//
//   node zrzuty.mjs glb  <katalog_wyjsciowy> [zew=<plik.glb>] [dom1=<plik.glb>] [dom2=<plik.glb>] [wszystkie=1]
//   node zrzuty.mjs domy <katalog_wyjsciowy> [url="http://localhost:3142/domy{dom}?kadr={id}&pora={pora}"] [pora=auto|dzien|noc] [dom2=1]
//
// glb  — podgląd three.js (podglad.html, światło jak verify.html) z dostarczonych GLB; mierzy materiały i kadr.
// domy — docelowa scena /domy w trybie ?kadr=<id> (moduł 3D); {id} = nazwa renderu, {pora} = pora z regiony.json,
//        {dom} = "" (zewnętrze), "/g" (wnętrza dom1 = G), "/b" (dom2 = B; dom2=0 pomija). Gotowość: shotReady.
// Ścieżki GLB względem katalogu głównego projektu; domyślnie te z ujecia-porownawcze.json.
// Potem: python scorecard.py <katalog_wyjsciowy> --etykieta "..." [--noc dla trybu domy].
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../../..");
const [mode, outArg, ...rest] = process.argv.slice(2);
if (!["glb", "domy"].includes(mode) || !outArg) {
  console.error("użycie: node zrzuty.mjs glb|domy <katalog_wyjsciowy> [opcje klucz=wartość]");
  process.exit(2);
}
const opts = Object.fromEntries(rest.map((a) => [a.slice(0, a.indexOf("=")), a.slice(a.indexOf("=") + 1)]));
const out = path.resolve(outArg);
fs.mkdirSync(out, { recursive: true });
const shots = JSON.parse(fs.readFileSync(path.join(HERE, "../ujecia-porownawcze.json"), "utf8")).ujecia;
const regions = JSON.parse(fs.readFileSync(path.join(HERE, "regiony.json"), "utf8")).ujecia;
const wanted = shots.filter((s) => opts.wszystkie === "1" || regions[s.render.replace(/\.jpg$/, "")]);
const id = (s) => s.render.replace(/\.jpg$/, "");
const frame = (s) => ({ width: 960, height: Math.round((960 * s.kadr.h) / s.kadr.w) });
const browser = await chromium.launch({
  executablePath: process.env.BROWSER || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  // --no-proxy-server: bez niej każda strona czeka ~20 s na autowykrywanie proxy (ta maszyna).
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--no-proxy-server"],
});

try {
  if (mode === "glb") {
    const kind = (glb) => (glb.includes("zewnetrze") ? "zew" : glb.includes("dom1") ? "dom1" : "dom2");
    const types = { ".js": "text/javascript", ".mjs": "text/javascript", ".html": "text/html", ".glb": "model/gltf-binary", ".wasm": "application/wasm" };
    const server = http.createServer((q, s) => {
      const p = path.join(ROOT, decodeURIComponent(q.url.split("?")[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { s.writeHead(404); return s.end(); }
      s.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
      fs.createReadStream(p).pipe(s);
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const groups = {};
    for (const s of wanted) (groups[kind(s.glb)] ||= []).push(s);
    for (const [k, list] of Object.entries(groups)) {
      const glb = opts[k] || list[0].glb;
      const abs = path.resolve(ROOT, glb);
      if (!fs.existsSync(abs)) { console.log(`pomijam ${k}: brak ${glb}`); continue; }
      const url = "/" + path.relative(ROOT, abs).split(path.sep).join("/");
      const page = await browser.newPage({ viewport: { width: 1920, height: 1248 } });
      page.on("pageerror", (e) => console.log("pageerror:", e.message));
      const pageUrl = "/" + path.relative(ROOT, path.join(HERE, "podglad.html")).split(path.sep).join("/");
      await page.goto(`http://127.0.0.1:${server.address().port}${pageUrl}?glb=${encodeURIComponent(url)}`);
      await page.waitForFunction(() => window.ready === true, null, { timeout: 600000 });
      for (const s of list) {
        const { width, height } = frame(s);
        const spec = { position: s.pozycja, target: s.cel, yfov: s.yfov, shift: s.shift, near: s.near, hide: s.ukryj };
        const data = await page.evaluate(([spec, f]) => window.shot(spec, f), [spec, { w: width, h: height }]);
        fs.writeFileSync(path.join(out, `${id(s)}.jpg`), Buffer.from(data.split(",")[1], "base64"));
        console.log(`ok ${id(s)} (${k}: ${glb})`);
      }
      await page.close();
    }
    server.close();
  } else {
    const tpl = opts.url || "http://localhost:3142/domy{dom}?kadr={id}&pora={pora}";
    const domPath = (glb) => (glb.includes("zewnetrze") ? "" : glb.includes("dom1") ? "/g" : "/b");
    for (const s of wanted) {
      const dom = domPath(s.glb);
      if (dom === "/b" && opts.dom2 === "0") { console.log(`pomijam ${id(s)}: dom2 (B) wyłączony (dom2=0)`); continue; }
      const pora = opts.pora && opts.pora !== "auto" ? opts.pora : regions[id(s)]?.pora || "dzien";
      const page = await browser.newPage({ viewport: frame(s), deviceScaleFactor: 1 });
      page.on("pageerror", (e) => console.log("pageerror:", e.message));
      await page.goto(tpl.replace("{dom}", dom).replace("{id}", id(s)).replace("{pora}", pora), { waitUntil: "domcontentloaded", timeout: 300000 });
      await page.waitForFunction(() => {
        const st = (window.__explorer || window.__probe?.state)?.getState();
        return st?.shotReady === true;
      }, null, { timeout: 300000, polling: 250 });
      await page.waitForTimeout(2500);
      // UI nad sceną: chowane CSS-em (niezależnie od &czysty=1), zostaje tylko canvas.
      await page.addStyleTag({ content: "body * { visibility: hidden !important; } canvas { visibility: visible !important; }" });
      await page.waitForTimeout(300);
      await page.mouse.move(1, 1);
      await page.locator("canvas").first().screenshot({ path: path.join(out, `${id(s)}.jpg`), type: "jpeg", quality: 92 });
      console.log(`ok ${id(s)} (pora ${pora})`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
