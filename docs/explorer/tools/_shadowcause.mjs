// Which shadow casters change between frames (the sun's shadow map is re-rendered only then). Scratch tool.
// Usage: node _shadowcause.mjs <url>
import { chromium } from "playwright-core";
const [, , url] = process.argv;
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--no-proxy-server"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => { const s = window.__probe?.state.getState(); return s?.ready && s.settled && !s.dissolve; }, null, { timeout: 240000, polling: 100 });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const { gl, scene } = window.__probe;
  const snap = () => { const m = new Map(); scene.traverseVisible((o) => { if (!o.castShadow) return; m.set(o.uuid, { name: o.name || o.type, path: o.parent?.name, e: [...o.matrixWorld.elements], mat: o.material?.id, geo: o.geometry?.id, v: o.instanceMatrix?.version, n: o.count }); }); return m; };
  window.__sc = { renders: 0, frames: 0, diffs: {} };
  const sm = gl.shadowMap; const orig = sm.render.bind(sm);
  let prev = snap();
  sm.render = (...a) => { window.__sc.frames++; if (sm.needsUpdate || sm.autoUpdate) { window.__sc.renders++; const cur = snap(); for (const [k, v] of cur) { const p = prev.get(k); const why = !p ? "new" : p.mat !== v.mat ? "material" : p.geo !== v.geo ? "geometry" : p.v !== v.v ? "instances" : p.e.some((x, i) => Math.abs(x - v.e[i]) > 0) ? "matrix" : null; if (why) { const key = `${v.path}/${v.name}:${why}`; window.__sc.diffs[key] = (window.__sc.diffs[key] ?? 0) + 1; } } for (const k of prev.keys()) if (!cur.has(k)) window.__sc.diffs["removed"] = (window.__sc.diffs["removed"] ?? 0) + 1; prev = cur; } return orig(...a); };
});
await page.mouse.move(900, 450); await page.mouse.down();
for (let i = 0; i < 80; i++) { await page.mouse.move(900 + Math.sin(i / 15) * 250, 450); await page.waitForTimeout(16); }
await page.mouse.up(); await page.waitForTimeout(500);
console.log(JSON.stringify(await page.evaluate(() => window.__sc), null, 1).slice(0, 3000));
await browser.close();
