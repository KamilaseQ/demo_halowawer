// Per-program compile cost on this GPU/ANGLE: recompiles every program the explorer uses (unique define, so no
// program cache hit) in a fresh WebGL2 context and times compile+link. Scratch tool of the perf pass.
import { chromium } from "playwright-core";
const [, , url] = process.argv;
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--no-proxy-server"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.waitForFunction(() => window.__probe?.state.getState().ready, null, { timeout: 300000, polling: 100 });
await page.waitForTimeout(1500);
const out = await page.evaluate(() => {
  const { gl } = window.__probe;
  const ctx = gl.getContext();
  const dbg = ctx.getExtension("WEBGL_debug_renderer_info");
  const gpu = dbg ? ctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "?";
  const progs = gl.info.programs.map((p) => {
    const sh = ctx.getAttachedShaders(p.program);
    return { name: p.name, key: p.cacheKey.slice(0, 60), usedTimes: p.usedTimes, vs: ctx.getShaderSource(sh[0]), fs: ctx.getShaderSource(sh[1]) };
  });
  const c = document.createElement("canvas").getContext("webgl2");
  const rows = [];
  let n = 0;
  for (const p of progs) {
    const uniq = `#define PERF_UNIQ_${Date.now()}_${n++}\n`;
    const inject = (src) => src.replace(/^(#version[^\n]*\n)/, `$1${uniq}`);
    const t = performance.now();
    const vs = c.createShader(c.VERTEX_SHADER);
    c.shaderSource(vs, inject(p.vs));
    c.compileShader(vs);
    const fs = c.createShader(c.FRAGMENT_SHADER);
    c.shaderSource(fs, inject(p.fs));
    c.compileShader(fs);
    const pr = c.createProgram();
    c.attachShader(pr, vs);
    c.attachShader(pr, fs);
    c.linkProgram(pr);
    const ok = c.getProgramParameter(pr, c.LINK_STATUS);
    // ANGLE may defer the HLSL compile to first draw: draw once to force it.
    c.useProgram(pr);
    c.drawArrays(c.POINTS, 0, 1);
    c.readPixels(0, 0, 1, 1, c.RGBA, c.UNSIGNED_BYTE, new Uint8Array(4));
    const ms = performance.now() - t;
    rows.push({ ms: Math.round(ms), ok, name: p.name, key: p.key, fsKB: Math.round(p.fs.length / 1024), loops: (p.fs.match(/for\s*\(/g) || []).length });
  }
  rows.sort((a, b) => b.ms - a.ms);
  return { gpu, total: rows.reduce((a, r) => a + r.ms, 0), rows };
});
console.log(out.gpu, "total ms", out.total);
for (const r of out.rows) console.log(`${String(r.ms).padStart(6)}ms ok=${r.ok} fs=${r.fsKB}kB loops=${r.loops}  ${r.name}  ${r.key}`);
await browser.close();
