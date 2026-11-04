// Scene inventory (L0): __explorerDebug.dumpScene() on a /domy URL; summary per source and every visible
// procedural mesh inside BOR2's ground boundary (ZIEMIA bbox + 2 m). Scratch tool.
// Usage: node _dump.mjs <url> [out.json]
import fs from "node:fs";
import { chromium } from "playwright-core";
const [, , url, out] = process.argv;
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--no-proxy-server"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => (window.__explorer ?? window.__probe?.state)?.getState().ready, null, { timeout: 180000, polling: 200 });
await page.waitForTimeout(1500);
const list = await page.evaluate(() => window.__explorerDebug.dumpScene());
if (out) fs.writeFileSync(out, JSON.stringify(list, null, 1));
const by = {};
for (const m of list) {
  const k = `${m.source}${m.visible ? "" : " (hidden)"}`;
  by[k] ??= { meshes: 0, triangles: 0 };
  by[k].meshes++;
  by[k].triangles += m.triangles;
}
console.log("per source:", JSON.stringify(by));
const ground = list.filter((m) => m.source === "bor2" && /ZIEMIA/.test(m.path) && m.bbox);
const b = ground.reduce((a, m) => [Math.min(a[0], m.bbox[0]), Math.min(a[1], m.bbox[2]), Math.max(a[2], m.bbox[3]), Math.max(a[3], m.bbox[5])], [1e9, 1e9, -1e9, -1e9]);
const B = [b[0] - 2, b[1] - 2, b[2] + 2, b[3] + 2];
console.log("BOR2 boundary (ZIEMIA + 2 m, estate XZ):", B.map((v) => v.toFixed(1)).join(", "));
const inside = list.filter((m) => m.source === "proc" && m.visible && !m.pickOnly && m.bbox && m.bbox[0] < B[2] && m.bbox[3] > B[0] && m.bbox[2] < B[3] && m.bbox[5] > B[1]);
console.log("visible proc meshes overlapping it:");
for (const m of inside) console.log(" ", m.path || m.name, "|", m.material.join(","), "| tris", m.triangles, "| bbox", m.bbox.join(","));
await browser.close();
