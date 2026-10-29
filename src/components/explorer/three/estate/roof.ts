import * as THREE from "three";
import type { Roof, Vec2 } from "@/lib/estate/geometry/types";
import { GeoBuilder, type V3 } from "./builder";

/* ==========================================================================
   Gable roof generator (standing-seam metal, no overhang), independent of the
   estate so the detailed house can reuse it (its roof lifts off in the
   dollhouse view).

   Input and output are in HOUSE/PLAN space: x = plan x, y = height above the
   finished ground floor, z = plan y. The roof covers the rectangle
   [0, depthX] × [0, widthY]; the ridge runs along `roof.ridgeAxis`.

   Parts (non-indexed, position + normal + uv in metres):
     metal     outer cladding of both slopes + raised standing seams (ribs)
     slab      roof body below the cladding: undersides, eave edges and
               (optionally) the gable end faces — a closed solid when lifted
     trim      eave fascia/box gutter, gable verge flashings, ridge cap
     chimneys  plastered stacks (from below the roof surface to the top)
     caps      thin metal caps on the chimneys
   ========================================================================== */

export type GableRoofOptions = {
  /** Panel width between standing seams, metres (≈ 0.5 m on the real roofs). */
  seamSpacing?: number;
  seamWidth?: number;
  seamHeight?: number;
  /** Eave fascia / box gutter: height below the eave line and projection beyond the facade. */
  fasciaHeight?: number;
  fasciaProjection?: number;
  /** Verge flashing on the gables: vertical height and projection beyond the gable wall. */
  vergeHeight?: number;
  vergeProjection?: number;
  /** Half-width of the ridge cap measured along the slope. */
  ridgeCap?: number;
  /** Include the gable end faces of the slab (true for a lifted roof, false when walls close it). */
  endFaces?: boolean;
};

export type GableRoofParts = {
  metal: THREE.BufferGeometry;
  slab: THREE.BufferGeometry;
  trim: THREE.BufferGeometry;
  chimneys: THREE.BufferGeometry;
  caps: THREE.BufferGeometry;
};

/** Height of the outer roof surface above a plan point (house space), for placing things on the roof. */
export function roofSurfaceHeight(footprint: Vec2, roof: Roof, [x, y]: Vec2): number {
  const across = roof.ridgeAxis === "y" ? x : y;
  const span = roof.ridgeAxis === "y" ? footprint[0] : footprint[1];
  const half = span / 2;
  const tan = (roof.ridge - roof.eaves) / half;
  return roof.eaves + tan * Math.min(across, span - across);
}

export function buildGableRoof(footprint: Vec2, roof: Roof, options: GableRoofOptions = {}): GableRoofParts {
  const {
    seamSpacing = 0.5,
    seamWidth = 0.024,
    seamHeight = 0.032,
    fasciaHeight = 0.26,
    fasciaProjection = 0.05,
    vergeHeight = 0.13,
    vergeProjection = 0.035,
    ridgeCap = 0.16,
    endFaces = true,
  } = options;

  // Local frame: u across the slopes (0..D), w along the ridge (0..W), h up.
  const alongY = roof.ridgeAxis === "y";
  const D = alongY ? footprint[0] : footprint[1];
  const W = alongY ? footprint[1] : footprint[0];
  const e = roof.eaves;
  const r = roof.ridge;
  const H = D / 2;
  const R = r - e;
  const L = Math.hypot(H, R);
  const cosA = H / L;
  const sinA = R / L;
  const tanA = R / H;
  const tV = roof.thickness / cosA; // slab thickness measured vertically

  // Local (u, h, w) → house space. Ridge along plan x swaps u/w, a mirror: the builder flips winding.
  const toHouse = alongY
    ? null
    : new THREE.Matrix4().set(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1);

  const make = () => new GeoBuilder(false).setMatrix(toHouse);
  const metal = make();
  const slab = make();
  const trim = make();
  const chimneys = make();
  const caps = make();

  // Slope helpers. side = −1: slope rising from u = 0; side = +1: slope rising from u = D.
  const slopeDir = (side: number): [number, number] => [-side * cosA, sinA]; // (du, dh) from eave to ridge
  const slopeNormal = (side: number): [number, number] => [side * sinA, cosA];
  const eaveU = (side: number) => (side < 0 ? 0 : D);
  /** Point on the slope at distance d from the eave, offset n along the slope normal, at w. */
  const sp = (side: number, d: number, n: number, w: number): V3 => {
    const [du, dh] = slopeDir(side);
    const [nu, nh] = slopeNormal(side);
    return [eaveU(side) + du * d + nu * n, e + dh * d + nh * n, w];
  };
  const nrm = (side: number): V3 => {
    const [nu, nh] = slopeNormal(side);
    return [nu, nh, 0];
  };
  const along = (side: number): V3 => {
    const [du, dh] = slopeDir(side);
    return [du, dh, 0];
  };

  /* ---------- metal cladding + standing seams ---------- */
  const panels = Math.max(1, Math.round(W / seamSpacing));
  const step = W / panels;
  for (const side of [-1, 1]) {
    const n = nrm(side);
    metal.quad(sp(side, 0, 0, 0), sp(side, L, 0, 0), sp(side, L, 0, W), sp(side, 0, 0, W), n, [
      [0, 0],
      [0, L],
      [W, L],
      [W, 0],
    ]);
    // Ribs from just above the gutter lip to under the ridge cap.
    const d0 = 0.02;
    const d1 = L - ridgeCap * 0.6;
    const len = d1 - d0;
    for (let k = 1; k < panels; k++) {
      const w = k * step;
      const c = sp(side, (d0 + d1) / 2, seamHeight / 2, w);
      metal.obox(c, along(side), n, [0, 0, 1], len / 2, seamHeight / 2, seamWidth / 2, ["-v", "+u"]);
    }
  }

  /* ---------- slab body (undersides, eave edges, gable ends) ---------- */
  for (const side of [-1, 1]) {
    const [nu, nh] = slopeNormal(side);
    const under: V3 = [-nu, -nh, 0];
    const u0 = eaveU(side);
    slab.quad([u0, e - tV, 0], [H, r - tV, 0], [H, r - tV, W], [u0, e - tV, W], under);
    // Vertical eave edge.
    slab.quad([u0, e - tV, 0], [u0, e, 0], [u0, e, W], [u0, e - tV, W], [side, 0, 0]);
  }
  if (endFaces) {
    const hexagon: [number, number][] = [
      [0, e - tV],
      [H, r - tV],
      [D, e - tV],
      [D, e],
      [H, r],
      [0, e],
    ];
    for (const [w, nz] of [
      [0, -1],
      [W, 1],
    ] as const) {
      // Fan around the centre of the hexagon.
      const cu = H;
      const ch = (e + r - tV) / 2 + 0.0;
      for (let i = 0; i < hexagon.length; i++) {
        const a = hexagon[i];
        const b = hexagon[(i + 1) % hexagon.length];
        const tri: [V3, V3, V3] = [
          [cu, ch, w],
          [a[0], a[1], w],
          [b[0], b[1], w],
        ];
        // Orient to the outward normal.
        const cross = (tri[1][0] - tri[0][0]) * (tri[2][1] - tri[0][1]) - (tri[1][1] - tri[0][1]) * (tri[2][0] - tri[0][0]);
        if (cross * nz > 0) slab.tri(tri[0], tri[1], tri[2], [0, 0, nz], [[cu, ch], [a[0], a[1]], [b[0], b[1]]]);
        else slab.tri(tri[0], tri[2], tri[1], [0, 0, nz], [[cu, ch], [b[0], b[1]], [a[0], a[1]]]);
      }
    }
  }

  /* ---------- trims ---------- */
  const lip = 0.03;
  const vp = vergeProjection;
  // Eave fascia / box gutter, running past the gables to meet the verge flashings.
  for (const side of [-1, 1]) {
    const u0 = eaveU(side);
    const out = u0 + side * fasciaProjection;
    // The gutter top meets the cladding where the slope reaches the lip height.
    const inn = u0 - side * (lip / tanA);
    const lo = e - fasciaHeight;
    const hi = e + lip;
    const w0 = -vp;
    const w1 = W + vp;
    trim.quad([out, lo, w0], [out, lo, w1], [out, hi, w1], [out, hi, w0], [side, 0, 0]);
    trim.quad([out, hi, w0], [out, hi, w1], [inn, hi, w1], [inn, hi, w0], [0, 1, 0]);
    trim.quad([out, lo, w0], [u0, lo, w0], [u0, lo, w1], [out, lo, w1], [0, -1, 0]);
    trim.quad([out, lo, w0], [out, hi, w0], [inn, hi, w0], [u0, lo, w0], [0, 0, -1]);
    trim.quad([out, lo, w1], [u0, lo, w1], [inn, hi, w1], [out, hi, w1], [0, 0, 1]);
  }
  // Verge flashings: a flat band down the gable face plus a narrow top over the roof edge.
  for (const [wg, sw] of [
    [0, -1],
    [W, 1],
  ] as const) {
    const wo = wg + sw * vp;
    const wi = wg - sw * 0.05;
    for (const side of [-1, 1]) {
      const n = nrm(side);
      const top = (d: number, w: number) => sp(side, d, lip, w);
      const bot = (d: number, w: number): V3 => {
        const p = sp(side, d, lip, w);
        return [p[0], p[1] - vergeHeight, p[2]];
      };
      const dEnd = L + lip * tanA * 0.0;
      // Outer face (in the gable plane, projecting vp).
      trim.quad(bot(0, wo), bot(dEnd, wo), top(dEnd, wo), top(0, wo), [0, 0, sw]);
      // Top over the roof edge.
      trim.quad(top(0, wo), top(dEnd, wo), top(dEnd, wi), top(0, wi), n);
      // Underside of the projecting band.
      trim.quad(bot(0, wo), bot(dEnd, wo), bot(dEnd, wg), bot(0, wg), [0, -1, 0]);
      // Inner edge standing on the roof.
      trim.quad(top(0, wi), top(dEnd, wi), sp(side, dEnd, 0, wi), sp(side, 0, 0, wi), [0, 0, -sw]);
    }
  }
  // Ridge cap: shallow inverted V over the ridge.
  {
    const c = 0.04;
    const apex = r + (lip + c) / cosA;
    for (const side of [-1, 1]) {
      const n = nrm(side);
      const lo0 = sp(side, L - ridgeCap, lip + c, -vp);
      const lo1 = sp(side, L - ridgeCap, lip + c, W + vp);
      trim.quad(lo0, [H, apex, -vp], [H, apex, W + vp], lo1, n);
      // Drip edge.
      trim.quad(sp(side, L - ridgeCap, 0, -vp), lo0, lo1, sp(side, L - ridgeCap, 0, W + vp), along(side).map((v) => -v) as V3);
      // End triangles.
      for (const [w, nz] of [
        [-vp, -1],
        [W + vp, 1],
      ] as const) {
        const a = sp(side, L - ridgeCap, 0, w);
        const b = sp(side, L - ridgeCap, lip + c, w);
        const t: V3 = [H, apex, w];
        const m: V3 = [H, r, w];
        trim.quad(a, b, t, m, [0, 0, nz]);
      }
    }
  }

  /* ---------- chimneys ---------- */
  for (const ch of roof.chimneys) {
    const cu = alongY ? ch.at[0] : ch.at[1];
    const cw = alongY ? ch.at[1] : ch.at[0];
    const su = alongY ? ch.size[0] : ch.size[1];
    const sw = alongY ? ch.size[1] : ch.size[0];
    const surf = (u: number) => e + tanA * Math.min(u, D - u);
    const base = Math.min(surf(cu - su / 2), surf(cu + su / 2)) - 0.06;
    const top = r + ch.height;
    chimneys.box(cu - su / 2, base, cw - sw / 2, cu + su / 2, top, cw + sw / 2, ["-y"]);
    // Cap plate with a small overhang, and a darker flue slot on top.
    const o = 0.03;
    caps.box(cu - su / 2 - o, top, cw - sw / 2 - o, cu + su / 2 + o, top + 0.05, cw + sw / 2 + o);
    caps.box(cu - su / 4, top + 0.05, cw - sw / 4, cu + su / 4, top + 0.12, cw + sw / 4, ["-y"]);
  }

  return { metal: metal.build(), slab: slab.build(), trim: trim.build(), chimneys: chimneys.build(), caps: caps.build() };
}
