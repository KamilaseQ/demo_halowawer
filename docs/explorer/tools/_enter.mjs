// Estate → house entry on prod (?debug=1): click a house in the list, time until the house scene is settled
// (interior pack downloaded, uploaded, compiled, dissolve gone). Then a second house of the same type (its
// GLB already in memory). Scratch tool. Usage: node _enter.mjs <origin> <first> <second> [cpuRate]
import { chromium } from "playwright-core";
const [, , origin, first = "g", second = "e", cpu = "1"] = process.argv;
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--no-proxy-server"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
if (+cpu > 1) await (await page.context().newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: +cpu });
await page.addInitScript(() => { window.__long = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(e.duration))).observe({ type: "longtask", buffered: true }); });
const t0 = Date.now();
await page.goto(`${origin}/domy?debug=1`, { waitUntil: "domcontentloaded" });
const settled = (id) => page.waitForFunction((id) => { const s = window.__probe?.state.getState(); return s?.ready && s.settled && !s.dissolve && (id ? s.view === "house" && s.house === id : true); }, id, { timeout: 180000, polling: 50 });
await settled(null);
console.log("estate ready", Date.now() - t0, "ms");
await page.waitForTimeout(1500);
for (const id of [first, second]) {
  await page.evaluate(() => (window.__long = []));
  const t = Date.now();
  // The list row (a DOM click: the 3D labels may overlap it on screen).
  await page.evaluate((id) => [...document.querySelectorAll("#explorer-panel button")].find((b) => b.textContent?.trim().startsWith(`Dom ${id}`) && /m²/.test(b.textContent))?.click(), id.toUpperCase());
  await settled(id.toUpperCase());
  const long = await page.evaluate(() => ({ n: window.__long.filter((d) => d > 50).length, max: Math.round(Math.max(0, ...window.__long)) }));
  console.log(`enter ${id.toUpperCase()}`, Date.now() - t, "ms, long tasks > 50 ms:", long.n, "max", long.max, "ms");
  await page.goto(`${origin}/domy?debug=1`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await settled(null);
  await page.waitForTimeout(800);
}
await browser.close();
