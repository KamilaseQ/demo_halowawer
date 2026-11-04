// Cold-cache load of a /domy route (prod, ?debug=1): time to ready/settled, transfer, main-thread long tasks and
// rAF stalls until ready. Scratch tool of the perf pass.
// Usage: node _load.mjs <url> [desktop|mobile] [runs=2]   (mobile = 390×844 DPR 3, 4× CPU, Fast 4G)
import { chromium } from "playwright-core";
const [, , url, profile = "desktop", runs = "2"] = process.argv;
const mobile = profile === "mobile";
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--no-proxy-server"] });
const out = [];
for (let r = 0; r < +runs; r++) {
  const context = await browser.newContext(
    mobile
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36" }
      : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  );
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.clearBrowserCache");
  let bytes = 0;
  cdp.on("Network.loadingFinished", (e) => (bytes += e.encodedDataLength));
  if (mobile) {
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 60, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  }
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  await page.addInitScript(() => {
    window.__long = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(e.duration))).observe({ type: "longtask", buffered: true });
    window.__stall = 0;
    const raf = window.requestAnimationFrame;
    window.requestAnimationFrame = function (cb) { const t = performance.now(); return raf.call(this, (ts) => { window.__stall = Math.max(window.__stall, performance.now() - t); cb(ts); }); };
  });
  const t0 = Date.now();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 300000 });
  await page.waitForFunction(() => window.__probe?.state.getState().ready, null, { timeout: 300000, polling: 50 }).catch(() => errors.push("never ready"));
  const readyMs = Date.now() - t0;
  const m = await page.evaluate(() => { const l = window.__long; return { longN: l.filter((d) => d > 100).length, longMax: Math.round(Math.max(0, ...l)), longSum: Math.round(l.reduce((a, b) => a + b, 0)), rafStallMax: Math.round(window.__stall) }; });
  out.push({ run: r + 1, readyMs, MB: +(bytes / 1e6).toFixed(1), ...m, errors });
  await context.close();
}
const med = (k) => { const v = out.map((o) => o[k]).sort((a, b) => a - b); return v[v.length >> 1]; };
console.log(JSON.stringify({ url: url.replace(/^https?:\/\/[^/]+/, ""), profile, runs: out, medianReadyMs: med("readyMs") }));
await browser.close();
