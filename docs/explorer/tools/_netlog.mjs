// Every request of a page load with start/end (ms from navigation) and failures: finds what blocks first paint. Scratch tool.
// Usage: node _netlog.mjs <url>
import { chromium } from "playwright-core";
const [, , url] = process.argv;
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--no-proxy-server"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const t0 = Date.now();
const seen = new Map();
page.on("request", (r) => seen.set(r, { url: r.url().slice(0, 110), start: Date.now() - t0 }));
page.on("requestfinished", (r) => (seen.get(r).end = Date.now() - t0));
page.on("requestfailed", (r) => ((seen.get(r).end = Date.now() - t0), (seen.get(r).fail = r.failure()?.errorText)));
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
console.log("DCL at", Date.now() - t0, "ms");
await page.waitForTimeout(3000);
const nav = await page.evaluate(() => { const n = performance.getEntriesByType("navigation")[0]; return { responseStart: Math.round(n.responseStart), responseEnd: Math.round(n.responseEnd), domInteractive: Math.round(n.domInteractive), dcl: Math.round(n.domContentLoadedEventEnd) }; });
console.log("navigation", JSON.stringify(nav));
for (const v of [...seen.values()].sort((a, b) => (b.end ?? 1e9) - (b.start) - ((a.end ?? 1e9) - a.start)).slice(0, 15)) console.log(String(v.start).padStart(6), "→", String(v.end ?? "…").padStart(6), v.fail ? "FAIL " + v.fail : "", v.url);
await browser.close();
