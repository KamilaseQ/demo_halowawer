// GPU-process view of a /domy load: the longest named events (ANGLE compile/link, uploads) with their time. Scratch tool.
import { chromium } from "playwright-core";
import fs from "node:fs";
const [, , url, out] = process.argv;
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--no-proxy-server"] });
const mobile = process.argv[4] === "mobile";
const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36" } : { viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
if (mobile) { const c = await ctx.newCDPSession(page); await c.send("Emulation.setCPUThrottlingRate", { rate: 4 }); }
await browser.startTracing(page, { path: out, categories: ["gpu", "gpu.angle", "disabled-by-default-gpu.service", "toplevel", "devtools.timeline", "disabled-by-default-devtools.timeline", "v8.execute", "blink", "cc", "viz", "loading", "netlog", "disabled-by-default-devtools.timeline.frame"] });
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__probe?.state.getState().ready, null, { timeout: 300000, polling: 100 });
const readyAt = await page.evaluate(() => performance.now());
await browser.stopTracing();
await browser.close();
const t = JSON.parse(fs.readFileSync(out, "utf8"));
const ev = t.traceEvents ?? t;
const th = new Map(), pr = new Map();
for (const e of ev) { if (e.ph === "M" && e.name === "thread_name") th.set(`${e.pid}:${e.tid}`, e.args.name); if (e.ph === "M" && e.name === "process_name") pr.set(e.pid, e.args.name); }
let tmin = Infinity; for (const e of ev) if (e.ph === "X" && e.ts && e.ts < tmin) tmin = e.ts;
const agg = new Map();
const longest = [];
for (const e of ev) {
  if (e.ph !== "X" || !e.dur || pr.get(e.pid) !== "GPU Process") continue;
  if (/RunTask|ThreadController|Scheduler::|ThreadPool_RunTask|GPUTask|ExecuteDeferredRequest|RendererMainThread|CommandBuffer::Flush|RunWorkerTask/.test(e.name)) continue;
  const k = `${th.get(`${e.pid}:${e.tid}`)} ${e.name}`;
  const a = agg.get(k) ?? { n: 0, d: 0 }; a.n++; a.d += e.dur; agg.set(k, a);
  if (e.dur > 80000) longest.push(`${((e.ts - tmin) / 1e6).toFixed(2)}s +${(e.dur / 1000).toFixed(0)}ms ${k} ${JSON.stringify(e.args ?? {}).slice(0, 120)}`);
}
console.log("ready at (page ms)", Math.round(readyAt));
console.log("--- GPU process totals");
for (const [k, a] of [...agg].sort((x, y) => y[1].d - x[1].d).slice(0, 25)) console.log(`${(a.d / 1000).toFixed(0).padStart(7)}ms ${String(a.n).padStart(5)}× ${k}`);
console.log("--- longest single events");
for (const l of longest.sort((a, b) => parseFloat(a) - parseFloat(b)).slice(0, 40)) console.log(l);
