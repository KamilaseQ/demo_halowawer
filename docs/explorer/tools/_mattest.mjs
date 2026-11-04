// A/B a material tweak on a QA frame: sample wall pixels before and after running JS in the page. Scratch tool.
// Usage: node _mattest.mjs <url> "<js returning a count>" x0 y0 x1 y1
import { chromium } from "playwright-core";
const [, , url, js, ...box] = process.argv;
const [x0, y0, x1, y1] = box.map(Number);
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--no-proxy-server"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 936 } });
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__explorer?.getState().shotReady, null, { timeout: 180000, polling: 200 });
await page.waitForTimeout(1500);
const sample = async () => {
  const png = await page.screenshot({ clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } });
  return page.evaluate(async (b64) => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data; let r = 0, gg = 0, bb = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; bb += d[i + 2]; }
    const n = d.length / 4; return [r / n, gg / n, bb / n].map(Math.round);
  }, png.toString("base64"));
};
console.log("before", await sample());
console.log("js →", await page.evaluate(js));
await page.waitForTimeout(1500);
console.log("after ", await sample());
await browser.close();
