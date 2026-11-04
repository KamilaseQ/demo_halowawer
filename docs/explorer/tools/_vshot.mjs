// Deterministic canvas screenshots for before/after checks (prod, ?debug=1): waits for the scene to rest, then
// shoots the WebGL canvas only. Scratch tool of the perf pass.
// Usage: node _vshot.mjs <origin> <outPrefix>   → <outPrefix>-{estate,estate-noc,house,house-noc,house-l0}.png
import { chromium } from "playwright-core";
const [, , origin, prefix] = process.argv;
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--no-proxy-server"] });
const shots = [
  { name: "estate", url: "/domy?debug=1", set: { entry: "model" } },
  { name: "estate-noc", url: "/domy?debug=1", set: { entry: "model", timeOfDay: "noc" } },
  { name: "house", url: "/domy/a?debug=1", set: {} },
  { name: "house-noc", url: "/domy/a?debug=1", set: { timeOfDay: "noc" } },
  { name: "house-l0", url: "/domy/a?debug=1", level: 0 },
];
for (const s of shots) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.log("[pageerror]", s.name, e.message.slice(0, 200)));
  await page.goto(origin + s.url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__probe?.state.getState().settled, null, { timeout: 300000, polling: 100 });
  await page.waitForTimeout(1500);
  if (s.set) await page.evaluate((v) => window.__probe.state.getState().set(v), s.set);
  if (s.level !== undefined) await page.evaluate((l) => window.__probe.state.getState().setLevel(l), s.level);
  await page.waitForTimeout(9000);
  await page.mouse.move(2, 2);
  await page.waitForTimeout(500);
  await page.locator("canvas").first().screenshot({ path: `${prefix}-${s.name}.png` });
  await page.close();
}
await browser.close();
console.log("ok");
