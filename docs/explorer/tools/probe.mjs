// Evaluates JS expressions in the live explorer after the scene is ready and prints the results.
// Usage: node probe.mjs <url> <waitMs> "<expr>" ["<expr>" ...]   (each expr runs after waitMs)
import { chromium } from "playwright-core";

const [, , url, wait = "3000", ...exprs] = process.argv;
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--no-proxy-server"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 300)));
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.waitForFunction(() => window.__explorer?.getState().ready, null, { timeout: 180000, polling: 250 });
for (const js of exprs) {
  const out = await page.evaluate(js).catch((e) => `[eval] ${e.message}`);
  console.log(js.slice(0, 60), "=>", JSON.stringify(out));
  await page.waitForTimeout(+wait);
}
await browser.close();
