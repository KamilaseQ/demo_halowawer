import * as THREE from "three";

/* ==========================================================================
   Procedural canvas textures (no downloaded files): rug pattern, hob glass,
   magazine spread, abstract artwork. Created lazily on the client and cached.
   ========================================================================== */

const cache = new Map<string, THREE.Texture>();

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  return { c, ctx };
}

function finish(key: string, c: HTMLCanvasElement, srgb: boolean, anisotropy = 8) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = anisotropy;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  cache.set(key, t);
  return t;
}

/** Hand-drawn, wobbly stroke between two points (charcoal line on a woven rug). */
function wobbly(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, width: number, r: () => number) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 2) return;
  const nx = -(y1 - y0) / len;
  const ny = (x1 - x0) / len;
  const n = Math.ceil(len / 5);
  let off = 0;
  let drawing = true;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    off = off * 0.9 + (r() - 0.5) * 1.6;
    const px = x0 + (x1 - x0) * t + nx * off;
    const py = y0 + (y1 - y0) * t + ny * off;
    // Occasional tiny breaks, as in a tufted line.
    if (r() < 0.012) drawing = !drawing;
    if (i === 0 || !drawing) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.lineWidth = width;
  ctx.stroke();
}

/**
 * Rug pattern as an alpha mask (white = line): an irregular hand-drawn grid like the
 * reference render's rug. `w`×`h` is the rug size in metres (keeps the cells ~0.45 m).
 */
export function rugPattern(w: number, h: number, seed = 7) {
  const key = `rug:${w}:${h}:${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const ppm = 640;
  const W = Math.round(w * ppm);
  const H = Math.round(h * ppm);
  const { c, ctx } = canvas(W, H);
  const r = rng(seed);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#fff";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Border band inset from the edge.
  const m = 0.16 * ppm;
  // Rows: horizontal lines with irregular spacing.
  const rows: number[] = [m];
  while (rows[rows.length - 1] < H - m - 0.3 * ppm) rows.push(rows[rows.length - 1] + (0.36 + r() * 0.2) * ppm);
  rows[rows.length - 1] = H - m;
  for (const y of rows) {
    const tilt = (r() - 0.5) * 0.012 * ppm;
    ctx.globalAlpha = 0.75 + r() * 0.25;
    wobbly(ctx, m - r() * 8, y, W - m + r() * 8, y + tilt, 4 + r() * 3, r);
  }
  // Columns: vertical segments per row band, shifted so the grid never quite aligns.
  for (let k = 0; k < rows.length - 1; k++) {
    let x = m;
    const xs: number[] = [x];
    while (x < W - m - 0.32 * ppm) {
      x += (0.38 + r() * 0.24) * ppm;
      xs.push(x);
    }
    xs[xs.length - 1] = W - m;
    for (const cx of xs) {
      const jx = cx + (r() - 0.5) * 0.05 * ppm;
      ctx.globalAlpha = 0.7 + r() * 0.3;
      wobbly(ctx, jx, rows[k] - r() * 6, jx + (r() - 0.5) * 0.03 * ppm, rows[k + 1] + r() * 6, 4 + r() * 3, r);
    }
  }
  // A few faint double strokes and smudges for the hand-made feel.
  for (let i = 0; i < 26; i++) {
    const y = rows[Math.floor(r() * rows.length)] + (r() - 0.5) * 18;
    const x0 = m + r() * (W - 2 * m);
    ctx.globalAlpha = 0.25 + r() * 0.25;
    wobbly(ctx, x0, y, x0 + (0.1 + r() * 0.3) * ppm, y + (r() - 0.5) * 10, 2 + r() * 2, r);
  }
  ctx.globalAlpha = 1;
  // Soften: slight blur so lines read as tufted yarn, not vector strokes.
  const blurred = canvas(W, H);
  blurred.ctx.filter = "blur(1.4px)";
  blurred.ctx.drawImage(c, 0, 0);
  return finish(key, blurred.c, false);
}

/**
 * Cream wool rug with fine black hand-drawn grid lines (the render's rug), baked into one colour
 * map: white base with low-contrast fibre speckle and abrash, near-black lines. Tint it cream with
 * the material colour. `w`×`h` is the rug size in metres; UVs 0–1 across the top.
 */
export function rugTexture(w: number, h: number, seed = 7) {
  const key = `rugtex:${w}:${h}:${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const ppm = 700;
  const W = Math.round(w * ppm);
  const H = Math.round(h * ppm);
  const { c, ctx } = canvas(W, H);
  const r = rng(seed);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Abrash: large, very faint tonal drifts of hand-spun wool.
  for (let i = 0; i < 180; i++) {
    const x = r() * W, y = r() * H, rad = (0.08 + r() * 0.3) * ppm;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(150,138,120,${0.025 + r() * 0.03})`);
    g.addColorStop(1, "rgba(150,138,120,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // Fibre speckle: tiny, low-contrast flecks.
  for (let i = 0; i < 26000; i++) {
    const a = 0.04 + r() * 0.07;
    ctx.fillStyle = r() < 0.75 ? `rgba(120,108,92,${a})` : `rgba(255,255,255,${a * 2})`;
    ctx.fillRect(r() * W, r() * H, 1 + r() * 2.2, 1 + r() * 1.2);
  }

  // Lines: thin, near-black, hand-drawn, never quite aligned.
  ctx.strokeStyle = "#141210";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const m = 0.15 * ppm;
  const rows: number[] = [m];
  while (rows[rows.length - 1] < H - m - 0.3 * ppm) rows.push(rows[rows.length - 1] + (0.36 + r() * 0.18) * ppm);
  rows[rows.length - 1] = H - m;
  for (const y of rows) {
    ctx.globalAlpha = 0.82 + r() * 0.18;
    wobbly(ctx, m - r() * 10, y, W - m + r() * 10, y + (r() - 0.5) * 0.012 * ppm, 4 + r() * 1.8, r);
  }
  for (let k = 0; k < rows.length - 1; k++) {
    let x = m;
    const xs: number[] = [x];
    while (x < W - m - 0.3 * ppm) {
      x += (0.36 + r() * 0.22) * ppm;
      xs.push(x);
    }
    xs[xs.length - 1] = W - m;
    for (const cx of xs) {
      const jx = cx + (r() - 0.5) * 0.05 * ppm;
      ctx.globalAlpha = 0.78 + r() * 0.22;
      wobbly(ctx, jx, rows[k] - r() * 8, jx + (r() - 0.5) * 0.03 * ppm, rows[k + 1] + r() * 8, 3.8 + r() * 1.8, r);
    }
  }
  // Occasional doubled strokes, like the render.
  for (let i = 0; i < 22; i++) {
    const y = rows[Math.floor(r() * rows.length)] + (r() < 0.5 ? -1 : 1) * (6 + r() * 6);
    const x0 = m + r() * (W - 2 * m);
    ctx.globalAlpha = 0.45 + r() * 0.3;
    wobbly(ctx, x0, y, x0 + (0.1 + r() * 0.35) * ppm, y + (r() - 0.5) * 8, 2 + r() * 1.2, r);
  }
  ctx.globalAlpha = 1;
  const soft = canvas(W, H);
  soft.ctx.filter = "blur(0.7px)";
  soft.ctx.drawImage(c, 0, 0);
  return finish(key, soft.c, true);
}

/** Black ceramic glass induction hob: four faint zone rings and a touch slider. UVs 0–1. */
export function hobTexture() {
  const hit = cache.get("hob");
  if (hit) return hit;
  const { c, ctx } = canvas(1024, 900);
  ctx.fillStyle = "#0b0b0c";
  ctx.fillRect(0, 0, 1024, 900);
  ctx.strokeStyle = "#5d5c5a";
  ctx.lineWidth = 3;
  const zone = (x: number, y: number, rr: number) => {
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      ctx.moveTo(x + Math.cos(a) * (rr + 10), y + Math.sin(a) * (rr + 10));
      ctx.lineTo(x + Math.cos(a) * (rr + 22), y + Math.sin(a) * (rr + 22));
    }
    ctx.stroke();
  };
  zone(270, 250, 150);
  zone(760, 230, 110);
  zone(250, 620, 110);
  zone(745, 610, 155);
  ctx.fillStyle = "#4a4946";
  ctx.fillRect(380, 820, 270, 4);
  for (let i = 0; i < 9; i++) ctx.fillRect(390 + i * 30, 840, 6, 6);
  return finish("hob", c, true);
}

/** Open magazine spread (left: headline + columns, right: photo + caption). UVs 0–1. */
export function magazineTexture() {
  const hit = cache.get("magazine");
  if (hit) return hit;
  const W = 1400, H = 900;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = "#f4f2ee";
  ctx.fillRect(0, 0, W, H);
  // Gutter shading.
  const g = ctx.createLinearGradient(W / 2 - 60, 0, W / 2 + 60, 0);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.5, "rgba(0,0,0,0.16)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(W / 2 - 60, 0, 120, H);
  ctx.fillStyle = "#151413";
  ctx.font = "900 150px Helvetica, Arial, sans-serif";
  ctx.fillText("MAR", 70, 210);
  ctx.font = "900 150px Helvetica, Arial, sans-serif";
  ctx.fillText("KET", 120, 350);
  ctx.font = "700 34px Helvetica, Arial, sans-serif";
  ctx.fillText("FORM & LIGHT", 74, 430);
  const r = rng(11);
  ctx.fillStyle = "#8e8a84";
  for (let col = 0; col < 2; col++) {
    for (let i = 0; i < 14; i++) {
      const w = 250 - (i % 5 === 4 ? 120 * r() : 10 * r());
      ctx.fillRect(74 + col * 290, 480 + i * 26, w, 9);
    }
  }
  // Right page: photo block.
  const p = ctx.createLinearGradient(W / 2 + 70, 80, W - 60, 620);
  p.addColorStop(0, "#c9bba8");
  p.addColorStop(0.55, "#8b7a68");
  p.addColorStop(1, "#3e3731");
  ctx.fillStyle = p;
  ctx.fillRect(W / 2 + 70, 80, W / 2 - 130, 560);
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath();
  ctx.ellipse(W / 2 + 330, 330, 120, 170, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#151413";
  ctx.font = "900 64px Helvetica, Arial, sans-serif";
  ctx.fillText("FENG", W / 2 + 70, 720);
  ctx.fillStyle = "#8e8a84";
  for (let i = 0; i < 4; i++) ctx.fillRect(W / 2 + 70, 760 + i * 26, 520 - 60 * r(), 9);
  return finish("magazine", c, true);
}

/** Abstract artwork (warm neutral brush shapes) for framed prints. UVs 0–1. */
export function artTexture(seed = 3) {
  const key = `art:${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const W = 700, H = 1000;
  const { c, ctx } = canvas(W, H);
  const r = rng(seed);
  ctx.fillStyle = "#e9e3d9";
  ctx.fillRect(0, 0, W, H);
  const blobs = ["#c8b8a2", "#a99079", "#2f2a26", "#d9cdbc", "#8a7562"];
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = blobs[i % blobs.length];
    ctx.globalAlpha = 0.55 + r() * 0.4;
    ctx.beginPath();
    const cx = 120 + r() * 460, cy = 140 + r() * 720, rx = 80 + r() * 190, ry = 60 + r() * 160;
    ctx.ellipse(cx, cy, rx, ry, r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = "#1e1b18";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(110 + r() * 80, 820);
  ctx.bezierCurveTo(260, 520 + r() * 100, 420, 760, 600, 260 + r() * 120);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // Paper mat border.
  ctx.strokeStyle = "#f6f3ee";
  ctx.lineWidth = 70;
  ctx.strokeRect(0, 0, W, H);
  return finish(key, c, true);
}

/** Spot footprint: bright, flat-ish core with a soft but defined rim (light pools from spots/downlights). */
export function poolTexture() {
  const hit = cache.get("pool");
  if (hit) return hit;
  const S = 256;
  const { c, ctx } = canvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    // Smooth plateau to ~55 % radius, then a smoothstep rim.
    const e = t < 0.5 ? 1 - 0.25 * (t / 0.5) ** 2 : 0.75 * (1 - ((t - 0.5) / 0.5) ** 2 * (3 - 2 * ((t - 0.5) / 0.5)));
    g.addColorStop(t, `rgba(255,255,255,${Math.max(0, e).toFixed(3)})`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return finish("pool", c, false, 4);
}

/** Soft radial falloff used for fake light pools (contact glow under lamps). */
export function radialTexture() {
  const hit = cache.get("radial");
  if (hit) return hit;
  const { c, ctx } = canvas(256, 256);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.45, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return finish("radial", c, false, 1);
}
