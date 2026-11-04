// Weryfikacja zestawu roślin w three.js projektu (Chrome bez okna) + zestawienia z renderami dewelopera.
//
//   node docs/inwestycja-3d/assets/zielen/podglad.mjs          (z katalogu głównego projektu)
//
// Wyjście (zielen/podglad/):
//   porownanie-vis1.jpg   - visualization-1 obok ujęcia W5 (ten sam kadr) + powiększone pasy traw
//   porownanie-vis5.jpg   - visualization-5 obok ujęcia z ujecia-porownawcze.json
//   spacer*.jpg           - widoki z oczu 1,65 m (pas traw przed płotem A/B, z bliska, ogrody C/D)
//   arkusz-wariantow.jpg  - wszystkie 21 wariantów z liczbą trójkątów
// Przeglądarka: zmienna BROWSER albo Chrome / Edge (jak bor2/verify.mjs).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";

const require = createRequire(path.resolve("package.json"));
const sharp = require("sharp");
const root = process.cwd();
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const rel = (p) => "/" + path.relative(root, p).split(path.sep).join("/");
const out = path.join(here, "podglad");
fs.mkdirSync(out, { recursive: true });
const bor2 = ["v9", "v8", "v7", "v6", "v5", "v4"].map((v) => path.join(root, `docs/inwestycja-3d/assets/bor2/bor2-zewnetrze-${v}.glb`)).find((f) => fs.existsSync(f));

const candidates = [process.env.BROWSER, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].filter(Boolean);
const executablePath = candidates.find((p) => fs.existsSync(p));
const types = { ".js": "text/javascript", ".mjs": "text/javascript", ".html": "text/html", ".json": "application/json", ".glb": "model/gltf-binary", ".hdr": "application/octet-stream" };
const server = http.createServer((q, s) => {
  if (q.url === "/favicon.ico") { s.writeHead(204); return s.end(); }
  const p = path.join(root, decodeURIComponent(q.url.split("?")[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(s);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const page = rel(path.join(here, "podglad.html"));
const glb = rel(path.join(here, "rosliny.glb"));
const browser = await chromium.launch({ executablePath, headless: true, timeout: 60000, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });

async function open(w, h, query) {
  const pg = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  pg.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  pg.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(m.type() + ": " + m.text()); });
  await pg.goto(`${base}${page}?${query}`);
  await pg.waitForFunction(() => window.ready === true, null, { timeout: 300000 });
  return { pg, errors };
}
const save = async (dataUrl, file) => { fs.writeFileSync(file, Buffer.from(dataUrl.split(",")[1], "base64")); return file; };

async function label(file, text, w, h, size = 26) {
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${w}" height="${size + 16}" fill="#000" opacity="0.45"/><text x="12" y="${size + 4}" font-family="Arial" font-size="${size}" fill="#fff">${text}</text></svg>`;
  return sharp(file).resize(w, h).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).toBuffer();
}

try {
  // --- scena BOR2 -------------------------------------------------------------------
  const W1 = 1440, H1 = 936;
  const { pg, errors } = await open(W1, H1, `tryb=scena&rosliny=${encodeURIComponent(glb)}&bor2=${encodeURIComponent(rel(bor2))}&mapowanie=${encodeURIComponent(rel(path.join(here, "mapowanie.json")))}`);
  const info = await pg.evaluate(() => ({ ...window.info, errors: window.errors }));
  console.log("bor2:", path.basename(bor2));
  console.log(JSON.stringify(info, null, 1));
  const shots = {};
  for (const v of ["wiz1", "wiz5"]) {
    shots[v] = await save(await pg.evaluate((v) => window.shot(v), v), path.join(out, `_${v}.jpg`));
    console.log(v, "draw calle", await pg.evaluate(() => window.lastCalls), "trojkaty", await pg.evaluate(() => window.lastTris));
  }
  for (const v of ["spacer", "spacer_bliski", "spacer_ogrod"]) {
    shots[v] = await save(await pg.evaluate((v) => window.shot(v), v), path.join(out, `${v}.jpg`));
    console.log(v, "draw calle", await pg.evaluate(() => window.lastCalls), "trojkaty", await pg.evaluate(() => window.lastTris));
  }
  console.log(errors.length ? "BLEDY/OSTRZEZENIA:\n  " + errors.join("\n  ") : "brak bledow w konsoli");
  await pg.close();

  // --- porównania z renderami ---------------------------------------------------------
  const gallery = path.join(root, "public/explorer/gallery");
  async function compare(render, shot, file, W, H, crop) {
    const a = await label(path.join(gallery, render), `${render} (render dewelopera)`, W, H);
    const b = await label(shot, "three.js: makieta BOR2 + rosliny.glb (preset Dzień)", W, H);
    const comps = [{ input: a, left: 0, top: 0 }, { input: b, left: W + 8, top: 0 }];
    let total = H;
    if (crop) { // powiększony pas roślin: ten sam wycinek obu obrazów (x 15-85 %, y wg crop), x1,43
      const [cy0, cy1] = crop;
      const cw = Math.round(0.7 * W), ch = Math.round((cy1 - cy0) * H), cx = Math.round(0.15 * W);
      const big = (img) => sharp(img).extract({ left: cx, top: Math.round(cy0 * H), width: cw, height: ch }).resize(W).toBuffer();
      const ca = await big(a), cb = await big(b);
      const bh = Math.round((ch * W) / cw);
      comps.push({ input: ca, left: 0, top: H + 8 }, { input: cb, left: W + 8, top: H + 8 });
      total += bh + 8;
    }
    await sharp({ create: { width: 2 * W + 8, height: total, channels: 3, background: "#222" } }).composite(comps).jpeg({ quality: 88 }).toFile(file);
    console.log("zapisano", file);
  }
  await compare("visualization-1.jpg", shots.wiz1, path.join(out, "porownanie-vis1.jpg"), 1200, 780, [0.62, 1.0]);
  await compare("visualization-5.jpg", shots.wiz5, path.join(out, "porownanie-vis5.jpg"), 1200, 745, [0.55, 1.0]);
  for (const v of ["wiz1", "wiz5"]) fs.unlinkSync(shots[v]);

  // --- arkusz wariantów ---------------------------------------------------------------
  const SW = 9 * 300, SH = 3 * 340;
  const s = await open(SW, SH, `tryb=arkusz&rosliny=${encodeURIComponent(glb)}`);
  const sinfo = await s.pg.evaluate(() => window.info);
  const sheet = await save(await s.pg.evaluate(() => window.sheet()), path.join(out, "_arkusz.jpg"));
  const TYPES = ["TRAWA_NISKA", "TRAWA_WYSOKA", "PODSZYT", "BYLINA_BIALA", "BYLINA_ZOLTA", "BYLINA_FIOLET", "BYLINA_ROZ", "KRZEW", "ZYWOPLOT"];
  let svg = `<svg width="${SW}" height="${SH}" xmlns="http://www.w3.org/2000/svg">`;
  TYPES.forEach((t, c) => [1, 2, 3].forEach((r) => {
    const n = `${t}_${r}`, v = sinfo.variants[n];
    svg += `<text x="${c * 300 + 8}" y="${(r - 1) * 340 + 22}" font-family="Arial" font-size="17" font-weight="bold" fill="#1d2a1a">${n}</text>`;
    svg += `<text x="${c * 300 + 8}" y="${(r - 1) * 340 + 42}" font-family="Arial" font-size="13" fill="#1d2a1a">${v.tris} tr. | wys. ${v.h} m | ${v.w}x${v.d} m</text>`;
  }));
  svg += `</svg>`;
  await sharp(sheet).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 88 }).toFile(path.join(out, "arkusz-wariantow.jpg"));
  fs.unlinkSync(sheet);
  console.log("zapisano", path.join(out, "arkusz-wariantow.jpg"));
  console.log(s.errors.length ? "BLEDY/OSTRZEZENIA (arkusz):\n  " + s.errors.join("\n  ") : "arkusz: brak bledow w konsoli");
} finally {
  await browser.close();
  server.close();
}
