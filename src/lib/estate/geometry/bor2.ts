import type { HouseId, LevelId } from "../types";
import NAV from "./bor2-nav.json";
import type { CameraShot, HouseModel, LevelModel, Vec3, WalkNode } from "./types";

/* ==========================================================================
   BOR2 interiors (the developer's SketchUp model, docs/explorer/bor2.md).

   Two interiors exist: dom1 = house G (terraced row) and dom2 = house B
   (semi-detached). Every other house shows one of them, moved and, where the
   PZT mirrors the plan, mirrored: E mirrors G, F copies G, D copies B, A and C
   mirror B. Everything here is in estate space (BOR2 frame + BOR2_OFFSET),
   so a BOR2 house view needs no house space of its own (identity frame).

   Walk/nav data (floors, walk points, bounds) is generated from the GLBs by
   docs/explorer/tools/bor2-nav.mjs into bor2-nav.json and read
   synchronously; the interior GLB itself loads only when a house is entered.
   ========================================================================== */

/** BOR2 → estate space: the BOR2 houses land on the PZT placements (site.ts) within ±0.5 m. */
export const BOR2_OFFSET: Vec3 = [-33.85, 0, 59.7];

const EYE = 1.65;
const CEILING = 2.64;
const NO_PLAN = { src: "", origin: [0, 0] as [number, number], pxPerMeter: 1, width: 0, height: 0 };

type Box = { x0: number; x1: number; z0: number; z1: number; y0: number };

/** House bodies in the BOR2 frame (walls + roof, no gardens), measured from the exterior model (b6, 04.11). */
const BODY: Record<HouseId, Box> = {
  G: { x0: 33.37, x1: 40.97, z0: -59.76, z1: -48.18, y0: 0.66 },
  F: { x0: 40.92, x1: 48.49, z0: -58.26, z1: -46.68, y0: 0.66 },
  E: { x0: 48.41, x1: 56.01, z0: -56.76, z1: -45.18, y0: 0.66 },
  D: { x0: 65.59, x1: 73.81, z0: -53.66, z1: -41.31, y0: 0.43 },
  C: { x0: 73.79, x1: 82.01, z0: -52.16, z1: -39.81, y0: 0.43 },
  B: { x0: 91.59, x1: 99.81, z0: -49.06, z1: -36.71, y0: 0.12 },
  A: { x0: 99.81, x1: 108.01, z0: -47.56, z1: -35.21, y0: 0.12 },
};

/** Which interior each house shows, and whether it is mirrored (west ↔ east) relative to its source. */
const SOURCE: Record<HouseId, { from: "G" | "B"; mirror: boolean }> = {
  G: { from: "G", mirror: false },
  F: { from: "G", mirror: false },
  E: { from: "G", mirror: true },
  B: { from: "B", mirror: false },
  D: { from: "B", mirror: false },
  A: { from: "B", mirror: true },
  C: { from: "B", mirror: true },
};

type EstatePoint = { id: string; label: string; position: [number, number]; eyeY: number; heading: number; pitch: number; camera: string };
const ESTATE_POINTS = (NAV as unknown as { estate?: { start: string | null; nodes: EstatePoint[] } }).estate;

let estateModel: HouseModel | null = null;

/**
 * The walk around the estate as a HouseModel (one "storey" at ground level, terrain-following eye), so the
 * camera rig, cursor and HUD treat it like a house walk. Points: the exterior's SketchUp scene cameras.
 */
export function estateWalkModel(): HouseModel | null {
  if (estateModel) return estateModel;
  if (!ESTATE_POINTS?.nodes.length) return null;
  const [ox, oy, oz] = BOR2_OFFSET;
  const nodes: WalkNode[] = ESTATE_POINTS.nodes.map((n) => ({
    id: n.id,
    label: n.label,
    level: 0,
    position: [n.position[0] + ox, n.position[1] + oz],
    heading: n.heading,
    pitch: n.pitch,
    eye: n.eyeY + oy,
    zone: n.id,
  }));
  estateModel = {
    layout: "b",
    footprint: [],
    ground: 0,
    slabThickness: 0,
    levels: [{ level: 0, elevation: 0, ceilingHeight: 30, zones: [], walls: [], plan: NO_PLAN }],
    roof: { ridgeAxis: "x", eaves: 0, ridge: 0, thickness: 0, chimneys: [] },
    terraces: [],
    walk: { eyeHeight: EYE, start: ESTATE_POINTS.start ?? nodes[0].id, nodes, terrain: true },
    shots: { exterior: { position: [0, 0, 0], target: [0, 0, 0] }, levels: {} },
    // Estate space, generous: the plot, the street and the gardens' edge (collisions do the real work).
    bounds: [-30, -40, 105, 55],
    source: "bor2",
  };
  return estateModel;
}

type NavNode = { id: string; label: string; level: number; position: [number, number]; heading: number; pitch: number; eye: number; camera: string };
type NavSource = { url: string; bytes: number; contract: boolean; floors: number[]; bounds: number[]; start: string | null; nodes: NavNode[] };
const SOURCES = NAV as unknown as Partial<Record<"G" | "B", NavSource>>;

/** BOR2 frame → estate space for house `id` showing its source interior (mirror about the body centres). */
export type Bor2Transform = {
  /** x' = sx · x + tx, y' = y + ty, z' = z + tz (sx = −1 mirrors). */
  sx: 1 | -1;
  t: Vec3;
};

export function bor2Transform(id: HouseId): Bor2Transform {
  const { from, mirror } = SOURCE[id];
  const s = BODY[from];
  const d = BODY[id];
  const cs = (s.x0 + s.x1) / 2;
  const cd = (d.x0 + d.x1) / 2;
  const dz = (d.z0 + d.z1) / 2 - (s.z0 + s.z1) / 2;
  return {
    sx: mirror ? -1 : 1,
    t: [(mirror ? cs + cd : cd - cs) + BOR2_OFFSET[0], d.y0 - s.y0 + BOR2_OFFSET[1], dz + BOR2_OFFSET[2]],
  };
}

/** The interior GLB a house shows, or null when that interior is not exported yet. */
export function bor2Interior(id: HouseId) {
  const src = SOURCES[SOURCE[id].from];
  return src ? { url: src.url, bytes: src.bytes, transform: bor2Transform(id), contract: src.contract } : null;
}

export const hasBor2Interior = (id: HouseId) => !!SOURCES[SOURCE[id].from];


const cache = new Map<HouseId, HouseModel>();

/**
 * A HouseModel for a BOR2 house in estate space: levels (absolute floor heights), walk points from the
 * SketchUp cameras, bounds of the body, garden-side shots. No zones/walls: the GLB is the geometry.
 */
export function bor2Model(id: HouseId): HouseModel | null {
  const hit = cache.get(id);
  if (hit) return hit;
  const src = SOURCES[SOURCE[id].from];
  if (!src) return null;
  const tr = bor2Transform(id);
  const b = BODY[id];
  const [ox, , oz] = BOR2_OFFSET;
  const x0 = b.x0 + ox;
  const x1 = b.x1 + ox;
  const z0 = b.z0 + oz;
  const z1 = b.z1 + oz;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const floors = src.floors.map((f) => f + tr.t[1]);

  const levels: LevelModel[] = floors.map((elevation, level) => ({
    level: level as LevelId,
    elevation,
    ceilingHeight: CEILING,
    zones: [],
    walls: [],
    plan: NO_PLAN,
  }));

  const nodes: WalkNode[] = src.nodes.map((n) => ({
    id: n.id,
    label: n.label,
    level: n.level as LevelId,
    position: [tr.sx * n.position[0] + tr.t[0], n.position[1] + tr.t[2]],
    // Mirroring X turns a heading h (0 = +x, 90 = +z) into 180 − h.
    heading: tr.sx === -1 ? 180 - n.heading : n.heading,
    pitch: n.pitch,
    zone: n.id,
  }));

  const ground = floors[0] ?? b.y0;
  // Garden side (south, +Z), a 3/4 view from the south-west: the side the afternoon sun lights.
  const exterior: CameraShot = { position: [cx - 9, ground + 7, z1 + 15], target: [cx, ground + 3.2, cz] };
  const shotFor = (elevation: number): CameraShot => ({ position: [cx - 6, elevation + 11, z1 + 8], target: [cx, elevation + 0.4, cz] });

  const model: HouseModel = {
    layout: id === "E" || id === "F" || id === "G" ? (id.toLowerCase() as "e" | "f" | "g") : "b",
    footprint: [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ],
    ground: 0,
    slabThickness: 0.3,
    levels,
    roof: { ridgeAxis: "x", eaves: 6, ridge: 9, thickness: 0.3, chimneys: [] },
    terraces: [],
    walk: { eyeHeight: EYE, start: src.start ?? nodes[0]?.id ?? "", nodes },
    shots: { exterior, levels: Object.fromEntries(levels.map((l) => [l.level, shotFor(l.elevation)])) },
    // The walk may reach rooms outside the body's outline (the pair's garage): body ∪ the interior's extent.
    bounds: (() => {
      const [nx0, nz0, nx1, nz1] = src.bounds;
      const ax = tr.sx * nx0 + tr.t[0];
      const bx = tr.sx * nx1 + tr.t[0];
      return [Math.min(x0, ax, bx), Math.min(z0, nz0 + tr.t[2]), Math.max(x1, ax, bx), Math.max(z1, nz1 + tr.t[2])] as [number, number, number, number];
    })(),
    source: "bor2",
  };
  cache.set(id, model);
  return model;
}
