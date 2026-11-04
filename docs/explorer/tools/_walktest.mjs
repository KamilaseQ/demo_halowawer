// Estate-walk collision check: N keyboard steps from a walk point, prints the eye before/after. Scratch tool.
// Usage: node _walktest.mjs <url> <out.png>
import { chromium } from "playwright-core";
const [, , url, out] = process.argv;
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--no-proxy-server"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
page.on("console", (m) => (m.type() === "error" || m.text().includes("[bor2]")) && logs.push(m.text().slice(0, 200)));
page.on("pageerror", (e) => logs.push("pageerror " + e.message.slice(0, 200)));
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__explorer?.getState().ready && window.__explorer.getState().settled, null, { timeout: 180000, polling: 200 });
await page.waitForTimeout(2500);
const pos = () => page.evaluate(() => { const p = window.__controls.camera.position; return [p.x, p.y, p.z].map((v) => +v.toFixed(2)); });
console.log("start", await pos());
console.log("segments around the south garden edge (x 50–66, z 22–34):", await page.evaluate(() => {
  const S = window.__walkWorld.S; const out = [];
  for (let i = 0; i < S.length; i += 4) { const mx = (S[i] + S[i + 2]) / 2, mz = (S[i + 1] + S[i + 3]) / 2; if (mx > 50 && mx < 66 && mz > 22 && mz < 34) out.push([mx.toFixed(1), mz.toFixed(1)].join(",")); }
  return out.length + " " + out.slice(0, 30).join(" ");
}));
for (let i = 0; i < 40; i++) { await page.keyboard.press("w"); await page.waitForTimeout(60); }
await page.waitForTimeout(1500);
console.log("after 40 steps", await pos(), "near:", await page.evaluate(() => window.__explorer.getState().nearHouse));
console.log("boxes:", await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(window.__walkWorld.boxes ?? {}).map(([k, b]) => [k, [b.min.x, b.min.z, b.max.x, b.max.z].map((v) => +v.toFixed(1))])))));
console.log("segments per node:", JSON.stringify(await page.evaluate(() => window.__walkWorld.perTop)));
console.log("nearHouse() direct:", await page.evaluate(() => { const p = window.__controls.camera.position; return window.__walkWorld.nearHouse(p.x, p.z); }));
await page.screenshot({ path: out });
console.log(logs.join("\n"));
await browser.close();
