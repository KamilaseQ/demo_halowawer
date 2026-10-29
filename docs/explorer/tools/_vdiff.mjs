// Pixel difference of two PNGs (same size): mean abs diff per channel, max, share of pixels differing > 2/255 and > 8/255.
// Usage: node _vdiff.mjs <a.png> <b.png> [diff.png]   Scratch tool of the perf pass.
import { chromium } from "playwright-core";
import fs from "node:fs";
const [, , a, b, outDiff] = process.argv;
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const page = await browser.newPage();
const res = await page.evaluate(async ([a, b, wantDiff]) => {
  const load = async (d) => { const img = await createImageBitmap(await (await fetch(d)).blob()); const c = new OffscreenCanvas(img.width, img.height); const x = c.getContext("2d"); x.drawImage(img, 0, 0); return x.getImageData(0, 0, img.width, img.height); };
  const A = await load(a), B = await load(b);
  if (A.width !== B.width || A.height !== B.height) return { error: "size" };
  let sum = 0, max = 0, over2 = 0, over8 = 0;
  const D = new ImageData(A.width, A.height);
  for (let i = 0; i < A.data.length; i += 4) {
    let m = 0;
    for (let k = 0; k < 3; k++) { const d = Math.abs(A.data[i + k] - B.data[i + k]); sum += d; m = Math.max(m, d); }
    max = Math.max(max, m);
    if (m > 2) over2++;
    if (m > 8) over8++;
    D.data[i] = D.data[i + 1] = D.data[i + 2] = Math.min(255, m * 16); D.data[i + 3] = 255;
  }
  const n = A.width * A.height;
  let diff = null;
  if (wantDiff) { const c = new OffscreenCanvas(A.width, A.height); c.getContext("2d").putImageData(D, 0, 0); const blob = await c.convertToBlob(); const u = new Uint8Array(await blob.arrayBuffer()); let bin = ""; for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode(...u.subarray(i, i + 0x8000)); diff = btoa(bin); }
  return { mean: +(sum / n / 3).toFixed(3), max, over2pct: +((over2 / n) * 100).toFixed(2), over8pct: +((over8 / n) * 100).toFixed(3), diff };
}, ["data:image/png;base64," + fs.readFileSync(a).toString("base64"), "data:image/png;base64," + fs.readFileSync(b).toString("base64"), !!outDiff]);
if (outDiff && res.diff) fs.writeFileSync(outDiff, Buffer.from(res.diff, "base64"));
delete res.diff;
console.log(JSON.stringify(res));
await browser.close();
