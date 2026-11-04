// Składa kafle (kafle/*.png z kafle.py) w jeden atlas 2048 x 2048 z alfą dla całego zestawu roślin.
//
//   node docs/inwestycja-3d/assets/zielen/atlas.mjs [jakosc=88]      (z katalogu głównego projektu)
//
// Wyjście:
//   atlas.webp  - atlas do GLB (WebP stratny, alfa bezstratna); rosliny.py podpina go do materiału,
//                 a eksporter glTF przepisuje bajty pliku bez ponownego kodowania,
//   atlas.png   - to samo bez strat (podgląd / dalsza obróbka),
//   atlas.json  - prostokąty kafli w pikselach atlasu (x, y od lewego górnego rogu) + metry na piksel.
// Kolor przezroczystych pikseli jest "rozlany" z sąsiednich liści (pull-push), żeby mipmapy i filtrowanie
// nie dawały ciemnych obwódek wokół źdźbeł i liści.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(path.resolve("package.json"));
const sharp = require("sharp");
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const opts = Object.fromEntries(process.argv.slice(2).filter((a) => a.includes("=")).map((a) => a.split("=")));
const QUALITY = +(opts.jakosc ?? 88);
const SIZE = 2048;

// [kafel, x, y] w pikselach atlasu (lewy górny róg); pola 512 x 512, trawy wysokie 512 x 1024,
// niskie kafle (wachlarz kostrzewy, podszyt, liście bylin) 512 x 256, kępy z góry 256 x 256
const LAYOUT = [
  ["trawa_wys_a", 0, 0], ["trawa_wys_b", 512, 0],
  ["kepa_sina_a", 1024, 0], ["podszyt_a", 1024, 256], ["kepa_sina_gora", 1536, 0], ["podszyt_b", 1792, 0],
  ["liscie_bylin", 1536, 256], ["kepa_sina_c", 1024, 512], ["bylina_zolta_b", 1536, 512],
  ["bylina_biala_a", 0, 1024], ["bylina_zolta_a", 512, 1024], ["bylina_fiolet_a", 1024, 1024], ["bylina_fiolet_b", 1536, 1024],
  ["bylina_roz", 0, 1536], ["krzew_liscie", 512, 1536], ["grab_liscie", 1024, 1536], ["krzew_kwiaty", 1536, 1536],
];
const meta = JSON.parse(fs.readFileSync(path.join(here, "kafle", "kafle.json"), "utf8"));

const rgba = new Uint8Array(SIZE * SIZE * 4);
const rects = {};
for (const [name, x0, y0] of LAYOUT) {
  const file = path.join(here, "kafle", name + ".png");
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (x0 + info.width > SIZE || y0 + info.height > SIZE) throw new Error("kafel poza atlasem: " + name);
  for (let y = 0; y < info.height; y++) {
    rgba.set(data.subarray(y * info.width * 4, (y + 1) * info.width * 4), ((y0 + y) * SIZE + x0) * 4);
  }
  // obrys treści kafla (alfa > 0,1) - karty są przycinane do niego, żeby nie rysować pustych pikseli
  let bx0 = info.width, by0 = info.height, bx1 = 0, by1 = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 25) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
  }
  const m = 4;
  rects[name] = {
    x: x0, y: y0, w: info.width, h: info.height, m_per_px: meta[name].m_per_px, base_px: meta[name].base_px, widok: meta[name].widok ?? "side",
    content: [Math.max(0, bx0 - m), Math.max(0, by0 - m), Math.min(info.width, bx1 + 1 + m), Math.min(info.height, by1 + 1 + m)],
  };
}

// --- alfa pod alpha-test: cienkie źdźbła (alfa 0,2-0,5 po wygładzeniu) inaczej znikają przy progu 0,5,
// a zostają tylko gęste środki wachlarzy ("łopatki"). a' = clamp((a - 0,1) / 0,3): próg 0,5 odpowiada a = 0,25.
for (let i = 3; i < rgba.length; i += 4) {
  rgba[i] = Math.round(255 * Math.min(1, Math.max(0, (rgba[i] / 255 - 0.1) / 0.3)));
}

// --- pull-push: kolor dla pikseli o alfie 0 -------------------------------------------
function pullPush(px, W) {
  const levels = [];
  let w = W;
  let col = new Float32Array(W * W * 3), wt = new Float32Array(W * W);
  for (let i = 0; i < W * W; i++) {
    const a = px[i * 4 + 3] / 255;
    wt[i] = a;
    for (let c = 0; c < 3; c++) col[i * 3 + c] = (px[i * 4 + c] / 255) * a;
  }
  levels.push({ w, col, wt });
  while (w > 1) {
    const n = w >> 1, nc = new Float32Array(n * n * 3), nw = new Float32Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const o = y * n + x;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const i = (2 * y + dy) * w + 2 * x + dx;
        nw[o] += wt[i];
        for (let c = 0; c < 3; c++) nc[o * 3 + c] += col[i * 3 + c];
      }
    }
    w = n; col = nc; wt = nw;
    levels.push({ w, col, wt });
  }
  // od najgrubszego poziomu: piksel bez pokrycia bierze kolor rodzica
  let parent = null;
  for (let l = levels.length - 1; l >= 0; l--) {
    const { w, col, wt } = levels[l];
    const out = new Float32Array(w * w * 3);
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (wt[i] > 1e-4) for (let c = 0; c < 3; c++) out[i * 3 + c] = col[i * 3 + c] / wt[i];
      else if (parent) { const p = (y >> 1) * (w >> 1) + (x >> 1); for (let c = 0; c < 3; c++) out[i * 3 + c] = parent[p * 3 + c]; }
      else out.fill(0.3, i * 3, i * 3 + 3);
    }
    parent = out;
  }
  for (let i = 0; i < W * W; i++) {
    if (px[i * 4 + 3] === 0) for (let c = 0; c < 3; c++) px[i * 4 + c] = Math.round(parent[i * 3 + c] * 255);
  }
}
pullPush(rgba, SIZE);

const img = () => sharp(Buffer.from(rgba.buffer), { raw: { width: SIZE, height: SIZE, channels: 4 } });
await img().png({ compressionLevel: 9 }).toFile(path.join(here, "atlas.png"));
await img().webp({ quality: QUALITY, alphaQuality: 100, effort: 6, smartSubsample: true }).toFile(path.join(here, "atlas.webp"));
fs.writeFileSync(path.join(here, "atlas.json"), JSON.stringify({ size: SIZE, tiles: rects }, null, 1));
const kb = (f) => (fs.statSync(path.join(here, f)).size / 1024).toFixed(0) + " kB";
console.log("atlas", SIZE + "x" + SIZE, "| webp", kb("atlas.webp"), "| png", kb("atlas.png"), "| kafli", LAYOUT.length);
