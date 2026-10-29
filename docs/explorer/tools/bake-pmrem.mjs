// Bakes the IBL's prefiltered environment (PMREM) into a file, so the browser no longer filters the HDRI itself.
// Run against a production build of /domy with ?debug=1; it reads back the PMREM the live renderer made from the
// HDRI (same three.js, same loader), so the baked texture is the runtime result bit for bit (RGBA half floats,
// GL row order, stored as byte planes per channel) and gzips it. Only needed again when the HDRI or three.js's
// PMREM changes; bake from a build that does not load the baked file yet (rename or remove the old one first).
// Why: three's GGX convolution shader (256 unrolled samples) takes ~2.5 s to compile on ANGLE/D3D11 (Windows),
// on every visit, and blocks the GPU process meanwhile.
// Usage: node bake-pmrem.mjs <origin, e.g. http://localhost:3150> <out.bin>
import { chromium } from "playwright-core";
import fs from "node:fs";
import zlib from "node:zlib";

const [, , origin, out] = process.argv;
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`${origin}/domy?debug=1`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__probe?.state.getState().ready, null, { timeout: 300000, polling: 100 });

const res = await page.evaluate(() => {
  const { gl, scene } = window.__probe;
  // The PMREM the renderer made for scene.environment: any lit material holds it as its envMap.
  let pmrem = null;
  scene.traverse((o) => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      const env = gl.properties.get(m).envMap;
      if (env && env.mapping === 306 /* CubeUVReflectionMapping */) pmrem ??= env;
    }
  });
  if (!pmrem) return { error: "no PMREM in the scene" };
  const { width, height } = pmrem.image;
  const ctx = gl.getContext();
  const texture = gl.properties.get(pmrem).__webglTexture;
  const fb = ctx.createFramebuffer();
  ctx.bindFramebuffer(ctx.FRAMEBUFFER, fb);
  ctx.framebufferTexture2D(ctx.FRAMEBUFFER, ctx.COLOR_ATTACHMENT0, ctx.TEXTURE_2D, texture, 0);
  if (ctx.checkFramebufferStatus(ctx.FRAMEBUFFER) !== ctx.FRAMEBUFFER_COMPLETE) return { error: "framebuffer incomplete" };
  const readType = ctx.getParameter(ctx.IMPLEMENTATION_COLOR_READ_TYPE);
  let half;
  if (readType === ctx.HALF_FLOAT) {
    half = new Uint16Array(width * height * 4);
    ctx.readPixels(0, 0, width, height, ctx.RGBA, ctx.HALF_FLOAT, half);
  } else {
    const f = new Float32Array(width * height * 4);
    ctx.readPixels(0, 0, width, height, ctx.RGBA, ctx.FLOAT, f);
    // Values come from a half-float target, so float → half is exact.
    const view = new DataView(new ArrayBuffer(4));
    const toHalf = (v) => {
      view.setFloat32(0, v);
      const x = view.getUint32(0);
      const sign = (x >>> 16) & 0x8000;
      const exp = (x >>> 23) & 0xff;
      const mant = x & 0x7fffff;
      if (exp === 0xff) return sign | 0x7c00 | (mant ? 0x200 : 0);
      const e = exp - 127 + 15;
      if (e >= 0x1f) return sign | 0x7c00;
      if (e <= 0) {
        if (e < -10) return sign;
        const m = (mant | 0x800000) >>> (1 - e + 13);
        return sign | m;
      }
      return sign | (e << 10) | (mant >>> 13);
    };
    half = new Uint16Array(f.length);
    for (let i = 0; i < f.length; i++) half[i] = toHalf(f[i]);
  }
  ctx.bindFramebuffer(ctx.FRAMEBUFFER, null);
  ctx.deleteFramebuffer(fb);
  gl.resetState();
  let s = "";
  const bytes = new Uint8Array(half.buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { width, height, readType: readType === ctx.HALF_FLOAT ? "half" : "float", data: btoa(s) };
});
await browser.close();
if (res.error) throw new Error(res.error);
const raw = Buffer.from(res.data, "base64");
// Lossless layout that deflates well (558 KB instead of 769 KB interleaved): per channel (R, G, B, A), first the
// low bytes of every texel's half float, then the high bytes. Lighting.tsx (loadBakedPmrem) reverses it.
const half = new Uint16Array(raw.buffer, raw.byteOffset, raw.length / 2);
const texels = res.width * res.height;
const planes = Buffer.alloc(raw.length);
let o = 0;
for (let c = 0; c < 4; c++) for (let hi = 0; hi < 2; hi++) for (let p = 0; p < texels; p++) planes[o++] = hi ? half[p * 4 + c] >> 8 : half[p * 4 + c] & 255;
const packed = zlib.gzipSync(planes, { level: 9 });
fs.writeFileSync(out, packed);
console.log(JSON.stringify({ width: res.width, height: res.height, readType: res.readType, rawKB: Math.round(raw.length / 1024), gzKB: Math.round(packed.length / 1024), out }));
