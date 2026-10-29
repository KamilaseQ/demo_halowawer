// Bakes the estate ground's two painted canvases (lawns and beds, contact shading; three/estate/ground.ts) into
// lossless WebP, so the browser no longer paints them: their canvas blur filters cost ~2 s of main thread on a
// desktop and ~10 s on a phone. Run against a production build of /domy with ?debug=1&paintground (the flag makes
// the page paint the canvases live instead of loading the baked files). Pixels are read back exactly as WebGL
// receives them (unpremultiplied RGBA) and stored bottom-up, so the off-thread decoder's flip restores the canvas
// orientation. Rebake after changing the plan, beds, fences, trees or houses.
// Usage: node bake-ground.mjs <origin, e.g. http://localhost:3150> <outDir, e.g. public/explorer/3d/ground>
import { chromium } from "playwright-core";
import path from "node:path";
import sharp from "sharp";

const [, , origin, outDir] = process.argv;
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`${origin}/domy?debug=1&paintground`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__probe?.state.getState().ready, null, { timeout: 300000, polling: 100 });

const canvases = await page.evaluate(() => {
  const { gl, scene } = window.__probe;
  const ground = scene.getObjectByName("ground");
  const uniforms = ground && gl.properties.get(ground.material).uniforms;
  const read = (name) => {
    const c = uniforms?.[name]?.value?.image;
    if (!(c instanceof HTMLCanvasElement)) return null;
    const px = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let s = "";
    for (let i = 0; i < px.length; i += 0x8000) s += String.fromCharCode(...px.subarray(i, i + 0x8000));
    return { width: c.width, height: c.height, data: btoa(s) };
  };
  return { near: read("uNear"), ao: read("uAO") };
});
await browser.close();

for (const [name, c] of Object.entries(canvases)) {
  if (!c) throw new Error(`${name}: no painted canvas (is the page painting live? ?paintground)`);
  const raw = Buffer.from(c.data, "base64");
  // Bottom-up rows (see header).
  const flipped = Buffer.alloc(raw.length);
  const row = c.width * 4;
  for (let y = 0; y < c.height; y++) raw.copy(flipped, (c.height - 1 - y) * row, y * row, (y + 1) * row);
  const out = path.join(outDir, `estate-${name}.webp`);
  // exact: keep the RGB of fully transparent texels (filtering and mipmaps blend them).
  const info = await sharp(flipped, { raw: { width: c.width, height: c.height, channels: 4 } }).webp({ lossless: true, exact: true, effort: 6 }).toFile(out);
  console.log(JSON.stringify({ out, width: c.width, height: c.height, KB: Math.round(info.size / 1024) }));
}
