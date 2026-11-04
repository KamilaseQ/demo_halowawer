// Per-frame cost of a /domy view while it moves (prod, ?debug=1): GPU time per frame from
// EXT_disjoint_timer_query_webgl2 (every rAF callback wrapped in a TIME_ELAPSED query) and the frame
// interval with vsync and the frame-rate cap off. A mouse drag keeps the scene rendering. Scratch tool.
// Usage: node _gpuframe.mjs <url> [width=1920] [height=1080] [cpuRate=1]
import { chromium } from "playwright-core";
const [, , url, w = "1920", h = "1080", cpu = "1"] = process.argv;
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--no-proxy-server", "--disable-gpu-vsync", "--disable-frame-rate-limit"],
});
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
if (+cpu > 1) await (await page.context().newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: +cpu });
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => { const s = window.__probe?.state.getState(); return s?.ready && s.settled && !s.dissolve; }, null, { timeout: 240000, polling: 100 });
await page.waitForTimeout(1500);
const ok = await page.evaluate(() => {
  const gl = window.__probe.gl.getContext();
  const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
  window.__gpu = { ext: !!ext, q: [], frames: [], last: 0, calls: [], tris: [] };
  const info = window.__probe.gl.info;
  info.autoReset = false;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) =>
    raf((t) => {
      const g = window.__gpu;
      if (g.last) g.frames.push(t - g.last);
      g.last = t;
      const q = ext ? gl.createQuery() : null;
      if (q) gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
      const c0 = performance.now();
      info.reset();
      cb(t);
      const cpuMs = performance.now() - c0;
      if (info.render.calls) (g.calls.push(info.render.calls), g.tris.push(info.render.triangles));
      if (q) {
        gl.endQuery(ext.TIME_ELAPSED_EXT);
        g.q.push({ q, cpuMs });
      }
    });
  return !!ext;
});
// Drag: a slow sweep across the middle of the canvas (orbit in the model views, look-around in walks).
const cx = +w * 0.62, cy = +h * 0.5;
await page.mouse.move(cx, cy);
await page.mouse.down();
for (let i = 0; i < 160; i++) {
  await page.mouse.move(cx + Math.sin(i / 25) * +w * 0.18, cy + Math.cos(i / 40) * 30);
  await page.waitForTimeout(12);
}
await page.mouse.up();
await page.waitForTimeout(800);
const r = await page.evaluate(async () => {
  const gl = window.__probe.gl.getContext();
  const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
  const g = window.__gpu;
  const gpu = [];
  const cpu = [];
  for (let k = 0; k < 60; k++) {
    if (g.q.every((x) => x.done)) break;
    for (const x of g.q) {
      if (x.done || !gl.getQueryParameter(x.q, gl.QUERY_RESULT_AVAILABLE)) continue;
      x.done = true;
      if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) x.ms = gl.getQueryParameter(x.q, gl.QUERY_RESULT) / 1e6;
    }
    await new Promise((res) => setTimeout(res, 50));
  }
  for (const x of g.q) if (x.ms > 0.05) (gpu.push(x.ms), cpu.push(x.cpuMs));
  const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
  return { gpu, cpu, frames: g.frames.filter((f) => f < 500), calls: med(g.calls), triangles: med(g.tris), programs: window.__probe.gl.info.programs?.length };
});
const st = (a) => { const s = [...a].sort((x, y) => x - y); const p = (q) => s[Math.min(s.length - 1, Math.floor(q * s.length))]; return s.length ? { n: s.length, med: +p(0.5).toFixed(2), p95: +p(0.95).toFixed(2), p99: +p(0.99).toFixed(2), max: +s[s.length - 1].toFixed(2) } : null; };
console.log(JSON.stringify({ url: url.replace(/^https?:\/\/[^/]+/, ""), size: `${w}x${h}`, cpuRate: +cpu, timerQuery: ok, gpuMs: st(r.gpu), cpuMs: st(r.cpu), frameMs: st(r.frames), perFrame: { drawCalls: r.calls, triangles: r.triangles }, programs: r.programs, errors }));
await browser.close();
