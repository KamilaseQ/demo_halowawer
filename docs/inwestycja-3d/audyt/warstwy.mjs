// Diagnoza artefaktów: jeden kadr (pozycja GLB) w wariantach jakości/pory i z ukrywaniem warstw.
//   node warstwy.mjs <wariant.json> <katalog_wyjsciowy>
// wariant.json: { "url": "...", "kadr": {w,h}, "kamera": {pos, target, fov}, "warianty": [ { "id", "stan": {...store}, "ukryj": [...], "perf": "nomsaa" } ] }
// "perf" wymaga przeładowania strony (?perf=), pozostałe warianty idą na jednej stronie.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const [cfgFile, outArg] = process.argv.slice(2);
const cfg = JSON.parse(fs.readFileSync(cfgFile, "utf8"));
const out = path.resolve(outArg);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BROWSER || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--no-proxy-server"],
});
const ready = (page) => page.waitForFunction(() => (window.__explorer || window.__probe?.state)?.getState().shotReady === true, null, { timeout: 300000, polling: 100 }).catch(() => {});
async function open(perf) {
  const page = await browser.newPage({ viewport: { width: cfg.kadr.w, height: cfg.kadr.h }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.log("pageerror:", e.message));
  await page.goto(cfg.url + (perf ? `&perf=${perf}` : ""), { waitUntil: "domcontentloaded", timeout: 300000 });
  await ready(page);
  await page.addStyleTag({ content: "body * { visibility: hidden !important; } canvas { visibility: visible !important; } nextjs-portal { display: none !important; }" });
  return page;
}
const pages = new Map();
const hiddenBy = new Map(); // setFlags kumuluje: przed każdym wariantem przywracamy to, co ukrył poprzedni
try {
  const report = [];
  for (const v of cfg.warianty) {
    const key = v.perf || "";
    if (!pages.has(key)) pages.set(key, await open(v.perf));
    const page = pages.get(key);
    const prevHidden = hiddenBy.get(key) || [];
    hiddenBy.set(key, v.ukryj || []);
    const info = await page.evaluate(async ([v, cam, prevHidden]) => {
      const st = (window.__explorer || window.__probe.state);
      st.getState().set({ postQuality: "high", timeOfDay: "dzien", ...(v.stan || {}) });
      window.__explorerDebug.setFlags({ ukryj: [], pokaz: prevHidden });
      window.__explorerDebug.setFlags({ ukryj: v.ukryj || [], pokaz: [] });
      window.__explorerDebug.setCamera({ pos: cam.pos, target: cam.target, fov: cam.fov, shift: 0, near: 0.05 });
      const s = st.getState();
      return { postQuality: s.postQuality, timeOfDay: s.timeOfDay };
    }, [v, cfg.kamera, prevHidden]);
    await page.waitForTimeout(600);
    await ready(page);
    await page.waitForTimeout(2200);
    await page.locator("canvas").first().screenshot({ path: path.join(out, `${v.id}.jpg`), type: "jpeg", quality: 90 });
    report.push({ id: v.id, ...info, ukryj: v.ukryj || [], perf: v.perf || null });
    console.log("ok", v.id, JSON.stringify(info));
  }
  // Inventory of what sits near the ground in this frame: materials with alpha cut-out.
  const page = pages.values().next().value;
  const dump = await page.evaluate(() => window.__explorerDebug.dumpScene());
  fs.writeFileSync(path.join(out, "dump.json"), JSON.stringify(dump, null, 1));
  fs.writeFileSync(path.join(out, "warianty.json"), JSON.stringify(report, null, 1));
} finally {
  await browser.close();
}
