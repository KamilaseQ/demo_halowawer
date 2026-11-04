// Interaction cost of /domy (prod, ?debug=1), driven through the store and mouse drags. vsync and the frame-rate
// cap are off, so frame intervals measure the real per-frame cost (CPU + GPU) instead of 16.7 ms vsync slots.
// Reports per phase: frames, median and p95 frame ms, long tasks. Scratch tool of the perf pass.
// Usage: node _smooth.mjs <origin> [desktop|mobile] [cpuRate]
import { chromium } from "playwright-core";
const [, , origin, profile = "desktop", cpu = "1"] = process.argv;
const mobile = profile === "mobile";
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--no-proxy-server", "--disable-gpu-vsync", "--disable-frame-rate-limit"],
});
const W = mobile ? 390 : 1440, H = mobile ? 844 : 900;
const context = await browser.newContext(mobile ? { viewport: { width: W, height: H }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: W, height: H } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
await page.addInitScript(() => {
  window.__long = [];
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push({ t: e.startTime, d: e.duration }))).observe({ type: "longtask", buffered: true });
});
const st = (js) => page.evaluate(js);
const ready = () => page.waitForFunction(() => window.__probe?.state.getState().ready, null, { timeout: 300000, polling: 50 });
const settled = () => page.waitForFunction(() => { const s = window.__probe.state.getState(); return s.settled && !s.dissolve; }, null, { timeout: 60000, polling: 30 });
// Frames counted from R3F renders (gl.info.render.frame advances once per gl.render; the composer renders several times).
async function phase(name, action) {
  await page.evaluate(() => {
    window.__fr = [];
    const { gl } = window.__probe;
    if (!window.__wrapped) {
      window.__wrapped = true;
      const render = gl.render.bind(gl);
      let lastFrame = -1;
      gl.render = (...a) => {
        const raf = window.__rafId;
        if (raf !== lastFrame) { lastFrame = raf; window.__fr.push(performance.now()); }
        return render(...a);
      };
      const loop = () => { window.__rafId = (window.__rafId || 0) + 1; requestAnimationFrame(loop); };
      loop();
    }
    window.__t0 = performance.now();
  });
  await action();
  return page.evaluate((name) => {
    const f = window.__fr;
    const d = [];
    for (let i = 1; i < f.length; i++) d.push(f[i] - f[i - 1]);
    const moving = d.filter((x) => x < 200).sort((a, b) => a - b);
    const q = (p) => (moving.length ? +moving[Math.min(moving.length - 1, Math.floor(p * moving.length))].toFixed(1) : null);
    const long = window.__long.filter((l) => l.t >= window.__t0).map((l) => Math.round(l.d));
    return { name, frames: f.length, med: q(0.5), p95: q(0.95), worst: moving.length ? +moving[moving.length - 1].toFixed(0) : null, long: long.length, longMax: Math.max(0, ...long), longSum: long.reduce((a, b) => a + b, 0) };
  }, name);
}
async function drag(x, y, dx, dy, steps = 90) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 0; i < steps; i++) {
    await page.mouse.move(x + dx * (i + 1), y + dy * (i + 1) + Math.sin(i / 6) * 12);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(1200);
}
const rows = [];
const push = rows.push.bind(rows);
rows.push = (r) => (console.log(JSON.stringify(r)), push(r));
const t0 = Date.now();
await page.goto(`${origin}/domy?debug=1`, { waitUntil: "domcontentloaded" });
await ready();
rows.push({ name: "estate ready ms", value: Date.now() - t0 });
if (+cpu > 1) { const c = await context.newCDPSession(page); await c.send("Emulation.setCPUThrottlingRate", { rate: +cpu }); }
rows.push(await phase("estate: photo→model + intro", async () => { await st(() => window.__probe.state.getState().set({ entry: "model" })); await page.waitForTimeout(4500); }));
rows.push(await phase("estate: orbit", () => drag(W * 0.6, H * 0.5, 6, 0)));
rows.push(await phase("estate: time noc", async () => { await st(() => window.__probe.state.getState().set({ timeOfDay: "noc" })); await page.waitForTimeout(2500); }));
rows.push(await phase("estate: orbit (noc)", () => drag(W * 0.6, H * 0.5, -6, 0)));
await st(() => window.__probe.state.getState().set({ timeOfDay: "dzien" }));
await page.waitForTimeout(1500);
const t1 = Date.now();
await page.goto(`${origin}/domy/a?debug=1`, { waitUntil: "domcontentloaded" });
await ready();
await settled();
rows.push({ name: "house A ready ms (fresh page, warm cache)", value: Date.now() - t1 });
await page.waitForTimeout(2500);
if (+cpu > 1) { const c = await context.newCDPSession(page); await c.send("Emulation.setCPUThrottlingRate", { rate: +cpu }); }
rows.push(await phase("house: orbit", () => drag(W * 0.6, H * 0.5, 6, 0)));
for (const f of ["s4", "s3", "s1"]) rows.push(await phase(`house: style ${f}`, async () => { await st((f) => window.__probe.state.getState().set({ finish: f }), f); await page.waitForTimeout(100); await settled().catch(() => console.log('settle timeout ' + f)); await page.waitForTimeout(1500); }));
// page.evaluate with arg
for (const t of ["noc", "rano", "dzien"]) rows.push(await phase(`house: time ${t}`, async () => { await page.evaluate((t) => window.__probe.state.getState().set({ timeOfDay: t }), t); await page.waitForTimeout(2500); }));
for (const l of [1, 0, null]) rows.push(await phase(`house: level ${l}`, async () => { await page.evaluate((l) => window.__probe.state.getState().setLevel(l), l); await page.waitForTimeout(2500); }));
rows.push(await phase("house: enter walk", async () => { await page.evaluate(() => window.__probe.state.getState().setMode("walk")); await page.waitForTimeout(3000); }));
rows.push(await phase("walk: look", () => drag(W * 0.5, H * 0.45, -5, 0)));
if (errors.length) console.log("errors", errors);
await browser.close();
