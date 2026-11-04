import * as THREE from "three";
import { rng } from "./builder";

/* ==========================================================================
   Procedural canvas textures (no downloads). Created lazily, once per page.
   UVs of the surfaces using them are in metres; each texture states the size
   of one tile in metres (TILE) so the material can set its repeat.
   ========================================================================== */

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  return { c, ctx };
}

function finish(c: HTMLCanvasElement, srgb = true, anisotropy = 8) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = anisotropy;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

const hsl = (h: number, s: number, l: number) => `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`;

/** Light concrete pavers 20×10 cm in running bond. One tile = 2 m. */
export const PAVER_TILE = 2;
export function makePaverTexture() {
  const S = 512;
  const px = S / PAVER_TILE; // px per metre
  const { c, ctx } = canvas(S, S);
  const r = rng(7);
  ctx.fillStyle = hsl(36, 9, 70);
  ctx.fillRect(0, 0, S, S);
  const rowH = 0.1 * px;
  const len = 0.2 * px;
  const joint = Math.max(1, 0.006 * px);
  for (let row = 0; row < S / rowH; row++) {
    const off = row % 2 ? len / 2 : 0;
    for (let x = -len; x < S + len; x += len) {
      const l = 79 + (r() - 0.5) * 6;
      ctx.fillStyle = hsl(36 + (r() - 0.5) * 6, 7 + r() * 4, l);
      ctx.fillRect(x + off + joint / 2, row * rowH + joint / 2, len - joint, rowH - joint);
    }
  }
  // Fine aggregate speckle.
  const img = ctx.getImageData(0, 0, S, S);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 10;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  return finish(c);
}

/** Concrete grass pavers (eco grid) for the green strip and the parking bays. One tile = 1.2 m. */
export const GRID_TILE = 1.2;
export function makeGrassPaverTexture() {
  const S = 512;
  const px = S / GRID_TILE;
  const { c, ctx } = canvas(S, S);
  const r = rng(19);
  ctx.fillStyle = hsl(40, 8, 72);
  ctx.fillRect(0, 0, S, S);
  // 0.6 × 0.4 m blocks, each with 4 × 2 square grass cells of ~10 cm (D-005: real pavers have 8 openings).
  const bw = 0.6 * px;
  const bh = 0.4 * px;
  for (let by = 0; by < S / bh; by++) {
    for (let bx = 0; bx < S / bw; bx++) {
      const x0 = bx * bw;
      const y0 = by * bh;
      ctx.fillStyle = hsl(38, 7, 69 + (r() - 0.5) * 5);
      ctx.fillRect(x0 + 1, y0 + 1, bw - 2, bh - 2);
      const cell = 0.1 * px;
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 2; j++) {
          const cx = x0 + (bw / 4) * (i + 0.5) - cell / 2;
          const cy = y0 + (bh / 2) * (j + 0.5) - cell / 2;
          ctx.fillStyle = hsl(78 + (r() - 0.5) * 14, 22 + r() * 10, 42 + (r() - 0.5) * 10);
          ctx.fillRect(cx, cy, cell, cell);
          // Grass blades overflowing the cell edges.
          for (let k = 0; k < 14; k++) {
            ctx.fillStyle = hsl(75 + (r() - 0.5) * 20, 25, 36 + r() * 20);
            ctx.fillRect(cx - 3 + r() * (cell + 6), cy - 3 + r() * (cell + 6), 2, 2);
          }
        }
    }
  }
  return finish(c);
}

/** Welded mesh fence panel (alpha). One tile = 0.2 m wide × 1.2 m high (full panel height). */
export const FENCE_TILE: [number, number] = [0.2, 1.2];
export function makeFenceTexture() {
  const W = 32;
  const H = 192;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  // Vertical wire.
  ctx.fillRect(0, 0, 2, H);
  // Horizontal double wires every 5 cm, with the typical V-bends (denser bands).
  const step = H / 24;
  for (let i = 0; i <= 24; i++) ctx.fillRect(0, Math.round(i * step), W, 1);
  ctx.fillRect(0, 0, W, 3);
  ctx.fillRect(0, H - 3, W, 3);
  ctx.fillRect(0, Math.round(H * 0.33), W, 3);
  ctx.fillRect(0, Math.round(H * 0.66), W, 3);
  return finish(c, false, 4);
}

/** Atlas cells of the foliage texture (2 × 2, 256 px each). */
export const FOLIAGE_CELL = { birch: 0, pine: 1, leaves: 2, flowers: 3 } as const;

/**
 * Foliage atlas (alpha, luminance only; colour comes from vertex colours), 512 × 512 in four cells:
 * birch leaf sprays · pine needle clouds · broad shrub leaves · hydrangea flower heads.
 */
export function makeFoliageTexture() {
  const S = 512;
  const { c, ctx } = canvas(S, S);
  ctx.clearRect(0, 0, S, S);
  const r = rng(31);
  const grey = (l: number) => {
    const v = Math.max(0, Math.min(255, Math.round(l)));
    return `rgb(${v},${v},${v})`;
  };
  const leaf = (x: number, y: number, s: number, w: number, a: number, l: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = grey(l);
    ctx.beginPath();
    ctx.moveTo(-s, 0);
    ctx.quadraticCurveTo(0, -s * w, s, 0);
    ctx.quadraticCurveTo(0, s * w, -s, 0);
    ctx.fill();
    ctx.restore();
  };
  // Cell 0 (top left): birch — small pointed leaves in loose sprays, lighter on the upper side.
  for (let spray = 0; spray < 26; spray++) {
    const a0 = r() * Math.PI * 2;
    const rad0 = Math.sqrt(r()) * 86;
    const sx = 128 + Math.cos(a0) * rad0;
    const sy = 128 + Math.sin(a0) * rad0;
    for (let i = 0; i < 24; i++) {
      const x = sx + (r() - 0.5) * 46;
      const y = sy + (r() - 0.5) * 46;
      if (Math.hypot(x - 128, y - 128) > 120) continue;
      leaf(x, y, 4.5 + r() * 5, 0.62, r() * Math.PI * 2, 196 + r() * 59 - (y - 128) * 0.12);
    }
  }
  // Cell 1 (top right): pine — a soft cloud of short needles, denser in the middle.
  for (let i = 0; i < 2600; i++) {
    const a = r() * Math.PI * 2;
    const rad = Math.pow(r(), 0.7) * 112;
    const x = 384 + Math.cos(a) * rad;
    const y = 128 + Math.sin(a) * rad * 0.8;
    const ang = r() * Math.PI * 2;
    const len = 5 + r() * 9;
    ctx.strokeStyle = grey(150 + r() * 105 - (y - 128) * 0.25);
    ctx.lineWidth = 1.2 + r() * 1.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }
  // Cell 2 (bottom left): shrub — broader overlapping leaves in a dense, ragged clump.
  for (let i = 0; i < 520; i++) {
    const a = r() * Math.PI * 2;
    const rad = Math.pow(r(), 0.55) * 108;
    const x = 128 + Math.cos(a) * rad;
    const y = 384 + Math.sin(a) * rad;
    const shade = 150 + r() * 105 - (y - 384) * 0.3 - rad * 0.25;
    leaf(x, y, 7 + r() * 7, 0.55, a + (r() - 0.5) * 1.4, shade);
  }
  // Cell 3 (bottom right): hydrangea — round heads of small four-petal florets.
  for (let h = 0; h < 7; h++) {
    const hx = 384 + (r() - 0.5) * 120;
    const hy = 384 + (r() - 0.5) * 120;
    const hr = 26 + r() * 16;
    for (let i = 0; i < 70; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * hr;
      const x = hx + Math.cos(a) * d;
      const y = hy + Math.sin(a) * d;
      const l = 205 + r() * 50 - (y - hy) * 0.6;
      const p = 2.6 + r() * 1.8;
      for (let k = 0; k < 4; k++) {
        const pa = (k / 4) * Math.PI * 2 + a;
        ctx.fillStyle = grey(l);
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(pa) * p * 0.8, y + Math.sin(pa) * p * 0.8, p, p * 0.7, pa, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  const t = finish(c, true, 4);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
