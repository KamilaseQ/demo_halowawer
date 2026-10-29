// QualityGovernor check: long orbits in house A (vsync on, CPU slowed so frames are slow), long tasks during the
// gestures, when postQuality flips and whether a dissolve covers it. Scratch tool of the perf pass.
import { chromium } from "playwright-core";
const [, , origin, cpu = "3"] = process.argv;
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const W = 1440, H = 900;
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.addInitScript(() => {
  window.__long = [];
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push({ t: Math.round(e.startTime), d: Math.round(e.duration) }))).observe({ type: "longtask", buffered: true });
  window.__ev = [];
  const P = WebGL2RenderingContext.prototype; const lp = P.linkProgram; P.linkProgram = function (p) { const fs = this.getAttachedShaders(p).map((x) => this.getShaderSource(x)).join(" "); window.__ev.push(Math.round(performance.now()) + " link " + ((fs.match(/#define SHADER_NAME (.*)/) || [])[1] || (fs.match(/#define SHADER_TYPE (.*)/) || [])[1] || "?") + " " + fs.length); return lp.call(this, p); };
});
await page.evaluate(() => 0).catch(() => 0);
await page.goto(`${origin}/domy/a?debug=1`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__probe?.state.getState().settled, null, { timeout: 300000, polling: 100 });
await page.evaluate(() => (window.__ev.length = 0));
await page.evaluate(() => window.__probe.state.subscribe((s, p) => {
  if (s.postQuality !== p.postQuality) window.__ev.push(`${Math.round(performance.now())} postQuality ${s.postQuality} (dissolve ${!!s.dissolve})`);
  if (!!s.dissolve !== !!p.dissolve) window.__ev.push(`${Math.round(performance.now())} dissolve ${!!s.dissolve}`);
}));
await page.evaluate(() => window.__probe.state.getState().set({ timeOfDay: "noc" }));
await page.waitForTimeout(2000);
const c = await page.context().newCDPSession(page);
await c.send("Emulation.setCPUThrottlingRate", { rate: +cpu });
const gestures = [];
for (let g = 0; g < 3; g++) {
  const t0 = await page.evaluate(() => performance.now());
  await page.mouse.move(W * 0.5, H * 0.5);
  await page.mouse.down();
  for (let i = 0; i < 160; i++) { await page.mouse.move(W * 0.5 + (g % 2 ? -1 : 1) * 3 * (i + 1), H * 0.5 + Math.sin(i / 9) * 30); await page.waitForTimeout(16); }
  await page.mouse.up();
  const t1 = await page.evaluate(() => performance.now());
  gestures.push([Math.round(t0), Math.round(t1)]);
  await page.waitForTimeout(3500);
}
const r = await page.evaluate((gestures) => ({
  inGesture: window.__long.filter((l) => gestures.some(([a, b]) => l.t >= a && l.t <= b)).map((l) => `${l.t}+${l.d}`),
  atRest: window.__long.filter((l) => !gestures.some(([a, b]) => l.t >= a && l.t <= b) && l.t > gestures[0][0]).map((l) => `${l.t}+${l.d}`),
  ev: window.__ev,
  final: window.__probe.state.getState().postQuality,
}), gestures);
const mx = (a) => Math.max(0, ...a.map((x) => +x.split("+")[1]));
console.log(JSON.stringify({ gestures, inGestureN: r.inGesture.length, inGestureMax: mx(r.inGesture), inGestureOver300: r.inGesture.filter((x) => +x.split("+")[1] > 300), atRestMax: mx(r.atRest), atRestOver300: r.atRest.filter((x) => +x.split("+")[1] > 300), ev: r.ev, final: r.final }));
await browser.close();
