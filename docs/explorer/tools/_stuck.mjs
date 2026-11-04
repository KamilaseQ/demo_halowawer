// What the scene gate is waiting for: samples window.__loading() every second until ready. Scratch tool.
// Usage: node _stuck.mjs <url>
import { chromium } from "playwright-core";
const [, , url] = process.argv;
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--no-proxy-server"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => console.log("pageerror", e.message.slice(0, 200)));
const t0 = Date.now();
await page.goto(url, { waitUntil: "domcontentloaded" });
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(1000);
  const r = await page.evaluate(() => ({ l: window.__loading?.(), ready: (window.__explorer ?? window.__probe?.state)?.getState().ready, progress: (window.__explorer ?? window.__probe?.state)?.getState().progress }));
  console.log(((Date.now() - t0) / 1000).toFixed(1) + "s", JSON.stringify(r).slice(0, 400));
  if (r.ready) break;
}
console.log("resources (start → end, ms):");
console.log((await page.evaluate(() => performance.getEntriesByType("resource").map((e) => [Math.round(e.startTime), Math.round(e.responseEnd), e.name.replace(location.origin, "").slice(0, 90), Math.round(e.transferSize / 1024) + "KB"]).sort((a, b) => b[1] - a[1]).slice(0, 25))).map((r) => r.join("  ")).join(String.fromCharCode(10)));
console.log("marks:", JSON.stringify(await page.evaluate(() => ({ dcl: Math.round(performance.getEntriesByType("navigation")[0]?.domContentLoadedEventEnd), load: Math.round(performance.getEntriesByType("navigation")[0]?.loadEventEnd) }))));
await browser.close();
