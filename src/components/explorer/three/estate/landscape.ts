import type { HouseId } from "@/lib/estate";
import { PLACEMENTS, planToEstate } from "@/lib/estate/geometry/site";
import type { Vec2 } from "@/lib/estate/geometry/types";
import { rng } from "./builder";
import type { ShrubSpec } from "./vegetation";
import { footprintRect, houseSpec } from "./houses";
import { CORNER, FENCE_Z, LOT_X, STRIP_EAST, TREES, zNorth, zSouth } from "./plan";

/* ==========================================================================
   Planting layout: perennial beds, raised planters in the stepped forecourt
   nooks, clipped hedges and the scatter of grasses and shrubs. Pure data
   (estate XZ), consumed by the ground painter and the vegetation builder.
   ========================================================================== */

export type Bed = { poly: Vec2[]; density: number; palette: "garden" | "verge" | "meadow" };

const ROW: HouseId[] = ["G", "F", "E", "D", "C", "B", "A"];

/** Estate rectangle of a house's garden deck: [x0, z0, x1, z1]. */
export function terraceRect(id: HouseId): [number, number, number, number] {
  const p = PLACEMENTS[id];
  const [t0, t1] = houseSpec(id).terrace;
  const a = planToEstate(p, [0, t0]);
  const b = planToEstate(p, [0, t1]);
  return [Math.min(a[0], b[0]), p.position[2], Math.max(a[0], b[0]), p.position[2] + 2.0];
}

/** Bed strip along the south boundary between x0 and x1, `depth` metres deep. */
const southBed = (x0: number, x1: number, depth = 1.35): Vec2[] => [
  [x0, zSouth(x0) - 0.25],
  [x1, zSouth(x1) - 0.25],
  [x1, zSouth(x1) - 0.25 - depth],
  [x0, zSouth(x0) - 0.25 - depth],
];

function makeBeds(): Bed[] {
  const beds: Bed[] = [];
  // Along the garden end of every plot (the renders' perennial borders), leaving lawn at the corners.
  const spans: [number, number][] = [
    [-13.6, -3.5],
    [8.4, 13.9],
    [15.8, 26.0],
    [28.2, 38.9],
    [41.0, 52.2],
    [54.2, 64.6],
    [66.6, 77.4],
  ];
  for (const [x0, x1] of spans) beds.push({ poly: southBed(x0, x1), density: 2.6, palette: "garden" });
  // Beside each deck, on the side away from the party wall.
  for (const id of ROW) {
    const [x0, z0, x1, z1] = terraceRect(id);
    // Bed on the side of the deck closer to the middle of the house's own garden.
    const [w, , e] = footprintRect(id);
    const mid = (w + e) / 2;
    const left = Math.abs(x0 - 0.9 - mid) < Math.abs(x1 + 0.9 - mid);
    const bx0 = left ? x0 - 1.0 : x1 + 0.15;
    const bx1 = left ? x0 - 0.15 : x1 + 1.0;
    beds.push({
      poly: [
        [bx0, z0 + 0.1],
        [bx1, z0 + 0.1],
        [bx1, z1 - 0.1],
        [bx0, z1 - 0.1],
      ],
      density: 2.4,
      palette: "garden",
    });
  }
  // Planted verge outside the north fence, as on the aerial render.
  const vx0 = CORNER.A[0] + 1.5;
  const vx1 = STRIP_EAST - 1.0;
  beds.push({
    poly: [
      [vx0, zNorth(vx0) - 0.2],
      [vx1, zNorth(vx1) - 0.2],
      [vx1, zNorth(vx1) - 1.5],
      [vx0, zNorth(vx0) - 1.5],
    ],
    density: 1.6,
    palette: "verge",
  });
  return beds;
}

export const BEDS: Bed[] = makeBeds();

export type Planter = { x0: number; z0: number; x1: number; z1: number };

/** Raised planters in the forecourt nooks formed by the stepped facades (green patches on the PZT). */
export function planters(): Planter[] {
  const out: Planter[] = [];
  const pairs: [HouseId, HouseId][] = [
    ["G", "F"],
    ["F", "E"],
    ["D", "C"],
    ["B", "A"],
  ];
  for (const [west, east] of pairs) {
    const [, wn, we] = footprintRect(west);
    const [ew, en] = footprintRect(east);
    const x0 = Math.max(we, ew) + 0.05;
    out.push({ x0, z0: wn + 0.08, x1: x0 + 1.45, z1: en - 0.06 });
  }
  return out;
}

/** Clipped hedges as polylines (centre line), height and thickness. */
export type Hedge = { line: Vec2[]; height: number; thickness: number };

export function hedges(): Hedge[] {
  const [, , Ee] = footprintRect("E");
  const [Dw] = footprintRect("D");
  const [, , Ce] = footprintRect("C");
  const [Bw] = footprintRect("B");
  const [Gw] = footprintRect("G");
  const [, , Ae] = footprintRect("A");
  return [
    // Screening the bin enclosures from the gardens.
    { line: [[Ee + 0.4, FENCE_Z.ED + 0.5], [Dw - 0.4, FENCE_Z.ED + 0.5]], height: 1.1, thickness: 0.7 },
    { line: [[Ce + 0.4, FENCE_Z.CB + 0.5], [Bw - 0.4, FENCE_Z.CB + 0.5]], height: 1.1, thickness: 0.7 },
    { line: [[Ae + 0.4, FENCE_Z.A + 0.5], [78.6, FENCE_Z.A + 0.5]], height: 1.1, thickness: 0.7 },
    // G's large garden: hedge along its north fence and the west boundary.
    { line: [[-14.6, FENCE_Z.G + 0.5], [Gw - 0.6, FENCE_Z.G + 0.5]], height: 1.25, thickness: 0.8 },
    // Short hedge stubs along the lot lines near the garden ends.
    { line: [[LOT_X.ED + 0.45, zSouth(LOT_X.ED) - 6.5], [LOT_X.ED + 0.45, zSouth(LOT_X.ED) - 1.8]], height: 1.0, thickness: 0.65 },
    { line: [[LOT_X.CB - 0.45, zSouth(LOT_X.CB) - 6.0], [LOT_X.CB - 0.45, zSouth(LOT_X.CB) - 1.8]], height: 1.0, thickness: 0.65 },
  ];
}

/* ---------------------------------------------------------------- view corridors */

/**
 * The stage's house-view camera in house plan space [x, y]: low, from the garden, on the plan-y = 0
 * side (mirrored houses mirror it). Nothing taller than ~1 m may stand between it and the house.
 */
export const HOUSE_VIEW: Vec2 = [-22.5, -14];

/** Per house: triangle camera → far end of the garden facade → far end of the plan-y = 0 gable (estate XZ). */
export function viewCorridors(): Vec2[][] {
  return ROW.map((id) => {
    const p = PLACEMENTS[id];
    const [D, W] = p.size;
    const at = (x: number, y: number): Vec2 => {
      const e = planToEstate(p, [x, y]);
      return [e[0], e[2]];
    };
    return [at(HOUSE_VIEW[0], HOUSE_VIEW[1]), at(0, W), at(D, 0)];
  });
}

function segmentDistance([x, z]: Vec2, a: Vec2, b: Vec2) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - (a[0] + t * dx), z - (a[1] + t * dz));
}

let corridorCache: Vec2[][] | null = null;

/** Distance from a point to the nearest house-view corridor (negative inside one). */
export function corridorClearance(x: number, z: number): number {
  corridorCache ??= viewCorridors();
  let best = Infinity;
  for (const tri of corridorCache) {
    if (inPoly([x, z], tri)) return -1;
    for (let i = 0; i < 3; i++) best = Math.min(best, segmentDistance([x, z], tri[i], tri[(i + 1) % 3]));
  }
  return best;
}

/* ---------------------------------------------------------------- scatter */

export type Tuft = { x: number; z: number; y: number; scale: number; rot: number; color: [number, number, number] };
export type Puff = { x: number; z: number; y: number; sx: number; sy: number; sz: number; rot: number; tone: number };

const GRASS = {
  silver: [0.66, 0.69, 0.63],
  straw: [0.74, 0.68, 0.52],
  green: [0.5, 0.57, 0.39],
  sage: [0.58, 0.62, 0.51],
  lavender: [0.6, 0.54, 0.76],
  white: [0.8, 0.79, 0.73],
  ochre: [0.75, 0.67, 0.5],
} as const;

function inPoly([x, z]: Vec2, poly: Vec2[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function bounds(poly: Vec2[]) {
  const xs = poly.map((p) => p[0]);
  const zs = poly.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)] as const;
}

/** Grass tufts and flowering perennials on beds, planters and the meadow around the plot. */
export function tufts(): Tuft[] {
  const r = rng(101);
  const out: Tuft[] = [];
  const pick = (palette: Bed["palette"]): [number, number, number] => {
    const v = r();
    const c =
      palette === "verge"
        ? v < 0.55
          ? GRASS.silver
          : v < 0.85
            ? GRASS.straw
            : GRASS.sage
        : palette === "meadow"
          ? v < 0.5
            ? GRASS.straw
            : v < 0.85
              ? GRASS.green
              : GRASS.sage
          : v < 0.34
            ? GRASS.silver
            : v < 0.56
              ? GRASS.straw
              : v < 0.64
                ? GRASS.lavender
                : v < 0.7
                  ? GRASS.white
                  : v < 0.75
                    ? GRASS.ochre
                    : v < 0.88
                      ? GRASS.sage
                      : GRASS.green;
    const k = 0.9 + r() * 0.2;
    return [c[0] * k, c[1] * k, c[2] * k];
  };
  for (const bed of BEDS) {
    const [x0, z0, x1, z1] = bounds(bed.poly);
    const n = Math.round((x1 - x0) * (z1 - z0) * bed.density * 0.9);
    for (let i = 0; i < n; i++) {
      const p: Vec2 = [x0 + r() * (x1 - x0), z0 + r() * (z1 - z0)];
      if (!inPoly(p, bed.poly)) continue;
      out.push({ x: p[0], z: p[1], y: 0, scale: bed.palette === "verge" ? 0.6 + r() * 0.4 : 0.45 + r() * 0.4, rot: r() * Math.PI * 2, color: pick(bed.palette) });
    }
  }
  for (const pl of planters()) {
    for (let i = 0; i < 6; i++)
      out.push({ x: pl.x0 + 0.25 + r() * (pl.x1 - pl.x0 - 0.5), z: pl.z0 + 0.2 + r() * (pl.z1 - pl.z0 - 0.4), y: 0.42, scale: 0.42 + r() * 0.3, rot: r() * 6.28, color: pick("verge") });
  }
  return out;
}

/** Shrub clumps: clipped hedges (runs of overlapping clumps), garden shrubs and hydrangeas, meadow bushes. */
export function shrubs(): ShrubSpec[] {
  const r = rng(202);
  const out: ShrubSpec[] = [];
  let seed = 1;
  // Hedges: clumps every ~0.55 m along each run, lowered to 0.9 m inside house-view corridors.
  for (const h of hedges()) {
    for (let s = 0; s < h.line.length - 1; s++) {
      const [a, b] = [h.line[s], h.line[s + 1]];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const rot = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const n = Math.max(1, Math.round(len / 0.55));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const x = a[0] + (b[0] - a[0]) * t;
        const z = a[1] + (b[1] - a[1]) * t;
        const low = corridorClearance(x, z) < h.thickness;
        const height = (low ? Math.min(h.height, 0.9) : h.height) * (0.94 + r() * 0.1);
        out.push({ x, z, rx: (len / n) * 0.75 + 0.12, ry: height / 2, rz: (h.thickness / 2) * (0.9 + r() * 0.2), rot, kind: "hedge", seed: seed++ });
      }
    }
  }
  // Garden shrubs in the beds, some of them white hydrangeas.
  for (const bed of BEDS) {
    if (bed.palette !== "garden") continue;
    const [x0, z0, x1, z1] = bounds(bed.poly);
    const n = Math.round(((x1 - x0) * (z1 - z0)) / 3.6);
    for (let i = 0; i < n; i++) {
      const p: Vec2 = [x0 + r() * (x1 - x0), z0 + r() * (z1 - z0)];
      if (!inPoly(p, bed.poly)) continue;
      const k = 0.32 + r() * 0.26;
      const low = corridorClearance(p[0], p[1]) < 0.8;
      out.push({ x: p[0], z: p[1], rx: k * 1.15, ry: low ? Math.min(k, 0.42) : k, rz: k * 1.05, rot: r() * 6.28, kind: r() < 0.38 ? "hydrangea" : "garden", seed: seed++ });
    }
  }
  // Bushes in the meadow north of the drive (hedgerow-like groups); the south field in front of the
  // gardens stays open: it is the foreground of the overview.
  // (Dark meadow bushes read as blobs from afar: none in the open field any more.)
  for (let g = 0; g < 0; g++) {
    const cx = -36 + r() * 140;
    const cz = -30 + r() * 22;
    const n = 2 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const x = cx + (r() - 0.5) * 4;
      const z = cz + (r() - 0.5) * 3;
      if (inPoly([x, z], [CORNER.A, CORNER.B, CORNER.C, CORNER.D])) continue;
      if (TREES.some((t) => Math.hypot(t.x - x, t.z - z) < 2.5)) continue;
      const k = 0.55 + r() * 0.6;
      const low = corridorClearance(x, z) < k * 1.3;
      out.push({ x, z, rx: k * 1.25, ry: low ? Math.min(k * 0.75, 0.45) : k * 0.75, rz: k * 1.1, rot: r() * 6.28, kind: "wild", seed: seed++ });
    }
  }
  return out;
}
