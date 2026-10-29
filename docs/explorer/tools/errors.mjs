// Opens a URL and prints page errors and console errors (e.g. why the stage fell back to stills).
// Usage: node errors.mjs <url> [waitMs=20000]
import { chromium } from "playwright-core";
const [, , url, wait = "20000"] = process.argv;
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 600), "\n", (e.stack ?? "").split("\n").slice(0, 6).join("\n")));
page.on("console", (m) => {
  const t = m.text();
  if (m.type() === "error" && !t.includes("X3595")) console.log("[console.error]", t.slice(0, 800));
});
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.waitForTimeout(+wait);
console.log("state:", await page.evaluate(() => { const s = window.__explorer?.getState(); return s && { ready: s.ready, fallback: s.fallback, settled: s.settled, progress: s.progress, mode: s.mode }; }));
await browser.close();
