// Link previews (og:image) for /domy and /domy/[dom]: 1200×630 JPEG under 300 KB (WhatsApp skips larger ones).
// Houses: the 3D model from the garden side, UI hidden. Estate: the developer's aerial render, cropped.
// Usage (dev server running): node og.mjs [base=http://localhost:3142] [houses=abcdefg]
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";
import sharp from "sharp";

const [, , base = "http://localhost:3142", ids = "abcdefg"] = process.argv;
const OUT = new URL("../../../public/explorer/og/", import.meta.url);
await mkdir(OUT, { recursive: true });

const jpeg = (img) => img.jpeg({ quality: 80, mozjpeg: true, chromaSubsampling: "4:2:0" });

// Estate: the aerial render, cropped to the houses (its focus box is in the middle third).
const aerial = new URL("../../../public/explorer/photos/estate-aerial.jpg", import.meta.url);
const info = await jpeg(sharp(aerial.pathname.slice(1)).resize(1200, 630, { fit: "cover", position: "centre" })).toFile(new URL("osiedle.jpg", OUT).pathname.slice(1));
console.log(`osiedle.jpg ${(info.size / 1024).toFixed(0)} KB`);

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--no-proxy-server"],
});
for (const id of ids) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(`${base}/domy/${id}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForFunction(() => window.__explorer?.getState().ready, null, { timeout: 180000, polling: 250 });
  // Only the scene: every floating UI layer goes, so the camera re-frames to the full width.
  await page.addStyleTag({
    content: `section[aria-label] > :not(:first-child), [data-label-layer], nextjs-portal { display: none !important; }`,
  });
  await page.evaluate(() => window.__explorer.setState({ hovered: null }));
  await page.waitForTimeout(4000);
  const shot = await page.screenshot({ type: "png" });
  const res = await jpeg(sharp(shot)).toFile(new URL(`dom-${id}.jpg`, OUT).pathname.slice(1));
  console.log(`dom-${id}.jpg ${(res.size / 1024).toFixed(0)} KB`);
  await page.close();
}
await browser.close();
