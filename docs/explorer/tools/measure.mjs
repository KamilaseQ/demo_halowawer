// Load budget probe for /domy (production build): cold cache, optional mobile emulation and network throttling.
// Reports transferred MB (all / 3D assets), duplicate URLs, time until the scene is ready and settled,
// estimated GPU memory (textures incl. mips + geometry buffers + render targets) and draw calls / triangles.
// Needs ?debug=1 on the URL (exposes window.__probe in production).
// Usage: node measure.mjs <url> [desktop|mobile] [fast4g|none]
import { chromium } from "playwright-core";

const [, , url, profile = "desktop", net = "none"] = process.argv;
const mobile = profile === "mobile";
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"],
});
const context = await browser.newContext(
  mobile
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36" }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
);
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send("Network.enable");
await cdp.send("Network.setCacheDisabled", { cacheDisabled: false });
await cdp.send("Network.clearBrowserCache");
if (net === "fast4g") {
  // Chrome DevTools "Fast 4G": ~9 Mbit/s down, 1.5 Mbit/s up, 60 ms RTT.
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 60, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 });
}

const requests = new Map();
const sizes = new Map();
cdp.on("Network.requestWillBeSent", (e) => requests.set(e.requestId, e.request.url));
cdp.on("Network.loadingFinished", (e) => {
  const u = requests.get(e.requestId);
  if (!u) return;
  const list = sizes.get(u) ?? [];
  list.push(e.encodedDataLength);
  sizes.set(u, list);
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));

const t0 = Date.now();
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.waitForFunction(() => window.__probe?.state.getState().ready, null, { timeout: 300000, polling: 100 }).catch(() => errors.push("never ready"));
const readyMs = Date.now() - t0;
await page.waitForFunction(() => window.__probe?.state.getState().settled, null, { timeout: 60000, polling: 100 }).catch(() => {});
const settledMs = Date.now() - t0;
await page.waitForTimeout(2500);

const gpu = await page.evaluate(() => {
  const { gl, scene } = window.__probe;
  const seen = new Set();
  let tex = 0;
  let geo = 0;
  const texBytes = (t) => {
    const img = t.source?.data ?? t.image;
    if (!img || seen.has(t.source ?? t)) return 0;
    seen.add(t.source ?? t);
    const w = img.width ?? img.data?.width ?? 0;
    const h = img.height ?? img.data?.height ?? 0;
    const faces = Array.isArray(img) ? img.length : 1;
    const bpp = t.type === 1016 || t.type === 1015 ? 8 : 4; // half/float textures
    return w * h * bpp * faces * (t.generateMipmaps !== false ? 1.33 : 1);
  };
  const seenGeo = new Set();
  scene.traverse((o) => {
    if (o.geometry && !seenGeo.has(o.geometry)) {
      seenGeo.add(o.geometry);
      for (const a of Object.values(o.geometry.attributes)) geo += a.array?.byteLength ?? 0;
      if (o.geometry.index) geo += o.geometry.index.array.byteLength;
    }
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) for (const v of Object.values(m)) if (v && v.isTexture) tex += texBytes(v);
  });
  if (scene.environment) tex += 6 * 256 * 256 * 8 * 1.33; // PMREM cube (approx.)
  const canvas = gl.domElement;
  const targets = canvas.width * canvas.height * 4 * 6; // composer buffers, AO, MSAA (approx.)
  gl.info.autoReset = false;
  gl.info.reset();
  window.__probe.state.getState().set({});
  return { texMB: +(tex / 1e6).toFixed(1), geoMB: +(geo / 1e6).toFixed(1), targetsMB: +(targets / 1e6).toFixed(1), canvas: `${canvas.width}x${canvas.height}`, programs: gl.info.programs?.length ?? null };
});
// One explicit frame for draw calls.
const draw = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const { gl } = window.__probe;
      gl.info.reset();
      requestAnimationFrame(() => requestAnimationFrame(() => resolve({ calls: gl.info.render.calls, triangles: gl.info.render.triangles })));
      window.dispatchEvent(new Event("resize"));
    }),
);

let total = 0;
let assets = 0;
const dups = [];
for (const [u, list] of sizes) {
  const sum = list.reduce((a, b) => a + b, 0);
  total += sum;
  if (u.includes("/explorer/")) assets += sum;
  if (list.length > 1 && !u.startsWith("data:")) dups.push(`${list.length}× ${u.replace(/^https?:\/\/[^/]+/, "")}`);
}
const out = {
  url,
  profile,
  net,
  readyMs,
  settledMs,
  transferredMB: +(total / 1e6).toFixed(2),
  explorerAssetsMB: +(assets / 1e6).toFixed(2),
  requests: [...sizes.values()].reduce((a, l) => a + l.length, 0),
  duplicates: dups,
  gpu: { ...gpu, totalMB: +(gpu.texMB + gpu.geoMB + gpu.targetsMB).toFixed(1) },
  draw,
  errors,
};
console.log(JSON.stringify(out, null, 1));
await browser.close();
