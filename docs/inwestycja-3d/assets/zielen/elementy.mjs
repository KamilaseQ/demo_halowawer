// Wyszukuje pojedyncze elementy (liście, płatki, źdźbła, kwiaty) w teksturach CC0 z Poly Haven
// (spójne obszary maski alfa) i zapisuje ich obrys: prostokąt obrócony wg osi głównej (PCA).
//
//   node docs/inwestycja-3d/assets/zielen/elementy.mjs            (z katalogu głównego projektu)
//
// Wejście:  _pobrane/<model>/<model>_diff_2k.png + maska (alpha / opacity / mask)
// Wyjście:  elementy.json  { model: { size, diff, mask, items: [{id, cx, cy, len, wid, ang, area, rgb}] } }
//           (współrzędne w pikselach tekstury 2k, ang = kąt osi długiej w radianach, oś x w prawo, y w dół)
//           _robocze/elementy-<model>.jpg - podgląd z numerami (do wyboru elementów w kafle.py)
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(path.resolve("package.json"));
const sharp = require("sharp");
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const src = path.join(here, "_pobrane");
const work = path.join(here, "_robocze");
fs.mkdirSync(work, { recursive: true });

const MIN_AREA = 250; // px (w 2k) - mniejsze okruchy pomijamy
const out = {};
for (const model of fs.readdirSync(src)) {
  const files = fs.readdirSync(path.join(src, model));
  const diff = files.find((f) => /_diff_/.test(f));
  const mask = files.find((f) => /_(alpha|opacity|mask)_/.test(f));
  if (!diff || !mask) continue;
  const { data: a, info } = await sharp(path.join(src, model, mask)).greyscale().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const { data: rgb } = await sharp(path.join(src, model, diff)).resize(W, H).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const lab = new Int32Array(W * H).fill(-1);
  const items = [];
  const stack = new Int32Array(W * H);
  for (let s = 0; s < W * H; s++) {
    if (lab[s] !== -1 || a[s] < 128) continue;
    let n = 0, sp = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, r = 0, g = 0, b = 0;
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    const id = items.length;
    stack[sp++] = s; lab[s] = id;
    while (sp) {
      const p = stack[--sp];
      const x = p % W, y = (p / W) | 0;
      n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
      r += rgb[p * 3]; g += rgb[p * 3 + 1]; b += rgb[p * 3 + 2];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const q of [p - 1, p + 1, p - W, p + W, p - W - 1, p - W + 1, p + W - 1, p + W + 1]) {
        if (q < 0 || q >= W * H || lab[q] !== -1 || a[q] < 128) continue;
        if (Math.abs((q % W) - x) > 1) continue;
        lab[q] = id; stack[sp++] = q;
      }
    }
    items.push({ n, sx, sy, sxx, syy, sxy, r, g, b, x0, y0, x1, y1 });
  }
  const list = [];
  items.forEach((it, id) => {
    if (it.n < MIN_AREA) return;
    const cx = it.sx / it.n, cy = it.sy / it.n;
    const cxx = it.sxx / it.n - cx * cx, cyy = it.syy / it.n - cy * cy, cxy = it.sxy / it.n - cx * cy;
    const ang = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
    // rozpiętość wzdłuż osi: z rzutów pikseli komponentu
    const ux = Math.cos(ang), uy = Math.sin(ang);
    let lo = 1e9, hi = -1e9, lo2 = 1e9, hi2 = -1e9;
    for (let y = it.y0; y <= it.y1; y++) for (let x = it.x0; x <= it.x1; x++) {
      if (lab[y * W + x] !== id) continue;
      const u = (x - cx) * ux + (y - cy) * uy, v = -(x - cx) * uy + (y - cy) * ux;
      if (u < lo) lo = u; if (u > hi) hi = u; if (v < lo2) lo2 = v; if (v > hi2) hi2 = v;
    }
    const mu = (lo + hi) / 2, mv = (lo2 + hi2) / 2;
    list.push({
      id: list.length,
      cx: +(cx + mu * ux - mv * uy).toFixed(1), cy: +(cy + mu * uy + mv * ux).toFixed(1),
      len: +(hi - lo + 2).toFixed(1), wid: +(hi2 - lo2 + 2).toFixed(1), ang: +ang.toFixed(4), area: it.n,
      rgb: [it.r, it.g, it.b].map((c) => Math.round(c / it.n)),
    });
  });
  out[model] = { size: [W, H], diff: `_pobrane/${model}/${diff}`, mask: `_pobrane/${model}/${mask}`, items: list };
  // podgląd z numerami
  const S = 1400, k = S / W;
  const svg = `<svg width="${S}" height="${S}" xmlns="http://www.w3.org/2000/svg">` + list.map((e) => {
    const c = Math.cos(e.ang), s = Math.sin(e.ang), hl = e.len / 2 * k, hw = e.wid / 2 * k, X = e.cx * k, Y = e.cy * k;
    const pts = [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]].map(([u, v]) => `${(X + u * c - v * s).toFixed(1)},${(Y + u * s + v * c).toFixed(1)}`).join(" ");
    return `<polygon points="${pts}" fill="none" stroke="#ff0" stroke-width="1"/><text x="${X}" y="${Y}" font-size="16" fill="#f0f" font-family="Arial" font-weight="bold">${e.id}</text>`;
  }).join("") + `</svg>`;
  const base = await sharp(path.join(src, model, diff)).resize(S, S).removeAlpha().modulate({ brightness: 0.8 }).toBuffer();
  await sharp(base).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 80 }).toFile(path.join(work, `elementy-${model}.jpg`));
  console.log(model, W + "x" + H, "elementow:", list.length);
}
fs.writeFileSync(path.join(here, "elementy.json"), JSON.stringify(out));
