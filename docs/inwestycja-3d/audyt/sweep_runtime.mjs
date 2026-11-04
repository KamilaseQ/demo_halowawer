// Zrzuty sweepu ze sceny /domy (runtime), pozy z pozy.json (układ GLB BOR2).
//   node sweep_runtime.mjs <pozy.json> <katalog_wyjsciowy> [url=http://localhost:3142/domy?kadr=estate-3&czysty=1] [offset=-33.85,0,59.70] [flagi=JSON]
// Kamera: window.__explorerDebug.setCamera (pos/target w układzie GLB; tryb jak ?kadr=, czeka na shotReady);
// bez debug API: __controls.setLookAt z offsetem runtime = BOR2 + offset (BOR2_OFFSET w src/lib/estate/geometry/bor2.ts).
// flagi: przekazywane do window.__explorerDebug.setFlags(...) jeśli istnieje (np. {"ukryj":["ZIELEN"]}).
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const [posesFile, outArg, ...rest] = process.argv.slice(2);
const opts = Object.fromEntries(rest.map((a) => [a.slice(0, a.indexOf("=")), a.slice(a.indexOf("=") + 1)]));
const { pozy, kadr } = JSON.parse(fs.readFileSync(posesFile, "utf8"));
const url = opts.url || "http://localhost:3142/domy?kadr=estate-3&czysty=1";
const OFF = (opts.offset || "-33.85,0,59.70").split(",").map(Number);
const out = path.resolve(outArg);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BROWSER || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--no-proxy-server"],
});
try {
  const page = await browser.newPage({ viewport: { width: kadr.w, height: kadr.h }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.log("pageerror:", e.message));
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 300000 });
  await page.waitForFunction(() => (window.__explorer || window.__probe?.state)?.getState().shotReady === true, null, { timeout: 300000, polling: 250 });
  await page.addStyleTag({ content: "body * { visibility: hidden !important; } canvas { visibility: visible !important; } nextjs-portal { display: none !important; }" });
  if (opts.flagi) await page.evaluate((f) => window.__explorerDebug?.setFlags?.(f), JSON.parse(opts.flagi));
  await page.waitForTimeout(1500);
  for (const p of pozy) {
    await page.evaluate(([c, t, f, OFF]) => {
      const dbg = window.__explorerDebug;
      if (dbg?.setCamera) return dbg.setCamera({ pos: c, target: t, fov: f, shift: 0, near: 0.05 });
      const k = window.__controls;
      k.camera.fov = f;
      k.camera.updateProjectionMatrix();
      k.setLookAt(c[0] + OFF[0], c[1] + OFF[1], c[2] + OFF[2], t[0] + OFF[0], t[1] + OFF[1], t[2] + OFF[2], false);
    }, [p.pozycja, p.cel, p.yfov, OFF]);
    await page.waitForFunction(() => (window.__explorer || window.__probe?.state)?.getState().shotReady === true, null, { timeout: 60000, polling: 100 }).catch(() => {});
    await page.waitForTimeout(1300);
    await page.locator("canvas").first().screenshot({ path: path.join(out, `${p.id}.jpg`), type: "jpeg", quality: 88 });
    process.stdout.write(".");
  }
  console.log(`\n${pozy.length} zrzutów → ${out}`);
} finally {
  await browser.close();
}
