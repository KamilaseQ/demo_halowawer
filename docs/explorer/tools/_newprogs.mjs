// Lists shader programs created after the scene gate opened (should be none), per phase. Scratch tool of the perf pass.
import { chromium } from "playwright-core";
const [, , url] = process.argv;
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--no-proxy-server"] });
const W = 1440, H = 900;
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 200)));
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__probe?.state.getState().ready && window.__probe.state.getState().settled, null, { timeout: 300000, polling: 50 });
await page.evaluate(() => {
  window.__seen = new Set(window.__probe.gl.info.programs);
  window.__diff = () => {
    const out = [];
    for (const p of window.__probe.gl.info.programs) if (!window.__seen.has(p)) { window.__seen.add(p); out.push(`${p.name || "-"} | ${p.cacheKey.replace(/\n/g, " ").slice(0, 150)}`); }
    return out;
  };
});
const report = async (name) => console.log(`== ${name}:`, JSON.stringify(await page.evaluate(() => window.__diff()), null, 1));
async function drag(dx = 5) {
  await page.mouse.move(W * 0.5, H * 0.5); await page.mouse.down();
  for (let i = 0; i < 80; i++) { await page.mouse.move(W * 0.5 + dx * (i + 1), H * 0.5); await page.waitForTimeout(16); }
  await page.mouse.up(); await page.waitForTimeout(1500);
}
await page.waitForTimeout(3000);
await report("idle after ready");
const isEstate = await page.evaluate(() => window.__probe.state.getState().view === "estate");
if (isEstate) { await page.evaluate(() => window.__probe.state.getState().set({ entry: "model" })); await page.waitForTimeout(6000); await report("entry model + intro"); }
await drag(); await report("orbit");
await page.evaluate(() => window.__probe.state.getState().set({ timeOfDay: "noc" })); await page.waitForTimeout(2500); await report("noc");
await drag(-5); await report("orbit noc");
await page.evaluate(() => window.__probe.state.getState().set({ timeOfDay: "rano" })); await page.waitForTimeout(2500); await report("rano");
if (!isEstate) {
  for (const f of ["s4", "s3", "s1"]) { await page.evaluate((f) => window.__probe.state.getState().set({ finish: f }), f); await page.waitForTimeout(3000); await report("finish " + f); }
  for (const l of [1, 0, null]) { await page.evaluate((l) => window.__probe.state.getState().setLevel(l), l); await page.waitForTimeout(3000); await report("level " + l); }
  await page.evaluate(() => window.__probe.state.getState().setMode("walk")); await page.waitForTimeout(3500); await report("walk");
  await drag(-4); await report("walk look");
}
await browser.close();
