// Estate orbits right after load (while the interiors prefetch runs): long tasks inside the gestures (vsync on).
// Scratch tool of the perf pass. Usage: node _estorbit.mjs <origin> [runs=2]
import { chromium } from "playwright-core";
const [, , origin, runs = "2"] = process.argv;
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--no-proxy-server"] });
const W = 1440, H = 900;
for (let r = 0; r < +runs; r++) {
  const context = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__long = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push({ t: e.startTime, d: e.duration }))).observe({ type: "longtask", buffered: true });
    window.__fr = [];
    const loop = (t) => { window.__fr.push(t); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
  await page.goto(`${origin}/domy?debug=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__probe?.state.getState().settled, null, { timeout: 300000, polling: 50 });
  await page.evaluate(() => window.__probe.state.getState().set({ entry: "model" }));
  await page.waitForTimeout(4500);
  const spans = [];
  for (let g = 0; g < 4; g++) {
    const a = await page.evaluate(() => performance.now());
    await page.mouse.move(W * 0.55, H * 0.5);
    await page.mouse.down();
    for (let i = 0; i < 110; i++) { await page.mouse.move(W * 0.55 + (g % 2 ? -1 : 1) * 4 * (i + 1), H * 0.5 + Math.sin(i / 8) * 20); await page.waitForTimeout(16); }
    await page.mouse.up();
    await page.waitForTimeout(250);
    spans.push([a, await page.evaluate(() => performance.now())]);
  }
  const res = await page.evaluate((spans) => {
    const inG = (t) => spans.some(([a, b]) => t >= a && t <= b);
    const long = window.__long.filter((l) => inG(l.t)).map((l) => Math.round(l.d));
    const fr = window.__fr.filter(inG);
    const d = [];
    for (let i = 1; i < fr.length; i++) if (inG(fr[i - 1])) d.push(fr[i] - fr[i - 1]);
    return { long100: long.filter((x) => x > 100).length, longMax: Math.max(0, ...long), longSum: long.reduce((a, b) => a + b, 0), frames: d.length, dropped: d.filter((x) => x > 25).length, worst: Math.round(Math.max(0, ...d)) };
  }, spans);
  console.log(JSON.stringify({ run: r + 1, ...res }));
  // Prefetch should still complete once the stage rests.
  await page.waitForTimeout(8000);
  await context.close();
}
await browser.close();
