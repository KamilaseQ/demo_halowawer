import type { HouseId } from "@/lib/estate";
import type { Vec2 } from "@/lib/estate/geometry/types";
import { footprintRect } from "./houses";

/* ==========================================================================
   Site plan of the maquette (estate XZ metres: X east, Z south), traced from
   the PZT (dom-*-pzt.png) at 21.5 px/m with the origin at house G's NW corner
   (pixel 415, 515.5) — the same frame and scale as PLACEMENTS in site.ts.
   Everything that touches a house follows the house rectangles, so the plan
   stays glued to PLACEMENTS if those are refined.
   ========================================================================== */

/** Plot corners (red circles on the PZT): A NW, B NE, C SE, D SW. */
export const CORNER = {
  A: [-12.86, -8.74] as Vec2,
  B: [85.63, 9.05] as Vec2,
  C: [84.23, 30.33] as Vec2,
  D: [-16.74, 10.26] as Vec2,
};

const lerpLine = (p: Vec2, q: Vec2, t: number): Vec2 => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];

/** Z of the north boundary (A→B) at X. */
export const zNorth = (x: number) => CORNER.A[1] + ((x - CORNER.A[0]) * (CORNER.B[1] - CORNER.A[1])) / (CORNER.B[0] - CORNER.A[0]);
/** Z of the south boundary (D→C) at X. */
export const zSouth = (x: number) => CORNER.D[1] + ((x - CORNER.D[0]) * (CORNER.C[1] - CORNER.D[1])) / (CORNER.C[0] - CORNER.D[0]);
/** X of the west boundary (A→D) at Z. */
export const xWest = (z: number) => CORNER.A[0] + ((z - CORNER.A[1]) * (CORNER.D[0] - CORNER.A[0])) / (CORNER.D[1] - CORNER.A[1]);

const NORTH_SLOPE = (CORNER.B[1] - CORNER.A[1]) / (CORNER.B[0] - CORNER.A[0]);
/** Green strip along the north boundary: 3.5 m measured square to the boundary. */
export const STRIP = 3.5;
const STRIP_DZ = STRIP * Math.hypot(1, NORTH_SLOPE);
/** South edge of the green strip (start of the paved forecourt). */
export const zStrip = (x: number) => zNorth(x) + STRIP_DZ;
/** The strip and the forecourt end where the access road (wjazd/wyjazd) runs down the east edge. */
export const STRIP_EAST = 78.0;

const R = (id: HouseId) => {
  const [w, n, e, s] = footprintRect(id);
  return { w, n, e, s };
};

/** Garden fence lines south of the parking groups (bottom edge of the bin enclosures on the PZT). */
export const FENCE_Z = { G: 3.4, ED: 10.4, CB: 14.9, A: 19.4 };
/** Plot lines between neighbours' gardens where they are not a party wall. */
export const LOT_X = { ED: 27.05, CB: 53.3 };
/** West edge of the access road along the east boundary (garden fence of A's corner garden). */
export const ACCESS: [Vec2, Vec2] = [
  [79.3, FENCE_Z.A],
  [78.4, zSouth(78.4)],
];

export type Segment = { a: Vec2; b: Vec2; kerb: boolean };

/**
 * Concrete paving (forecourts, driveway, access road) as a closed outline, clockwise from the NW.
 * `kerb` marks edges that meet lawn (houses and the strip need none).
 */
export function pavingOutline(): Segment[] {
  const G = R("G"), F = R("F"), E = R("E"), D = R("D"), C = R("C"), B = R("B"), A = R("A");
  const westBays = -11.0;
  const pts: [Vec2, boolean][] = [
    [[westBays, zStrip(westBays)], false],
    [[STRIP_EAST, zStrip(STRIP_EAST)], false],
    [[STRIP_EAST, zNorth(STRIP_EAST)], true],
    [CORNER.B, true],
    [CORNER.C, true],
    [ACCESS[1], true],
    [ACCESS[0], true],
    [[A.e, FENCE_Z.A], false],
    [[A.e, A.n], false],
    [[A.w, A.n], false],
    [[A.w, B.n], false],
    [[B.w, B.n], false],
    [[B.w, FENCE_Z.CB], true],
    [[C.e, FENCE_Z.CB], false],
    [[C.e, C.n], false],
    [[C.w, C.n], false],
    [[C.w, D.n], false],
    [[D.w, D.n], false],
    [[D.w, FENCE_Z.ED], true],
    [[E.e, FENCE_Z.ED], false],
    [[E.e, E.n], false],
    [[F.e, E.n], false],
    [[F.e, F.n], false],
    [[G.e, F.n], false],
    [[G.e, G.n], false],
    [[G.w, G.n], false],
    [[G.w, FENCE_Z.G], true],
    [[westBays, FENCE_Z.G], true],
  ];
  return pts.map(([a, kerb], i) => ({ a, b: pts[(i + 1) % pts.length][0], kerb }));
}

/** Green strip (grass pavers) along the north boundary: west boundary → access road. */
export function stripPolygon(): Vec2[] {
  // Where the strip's south edge meets the west boundary.
  let z = zStrip(CORNER.A[0]);
  for (let i = 0; i < 8; i++) z = zStrip(xWest(z));
  return [CORNER.A, [STRIP_EAST, zNorth(STRIP_EAST)], [STRIP_EAST, zStrip(STRIP_EAST)], [xWest(z), z]];
}

/** Parking bays (grass pavers), perpendicular to the drive; letters as on the PZT. */
export const BAYS: { x0: number; x1: number; z0: number; z1: number; labels: string[] }[] = [
  { x0: -11.0, x1: -0.2, z0: -1.6, z1: 3.23, labels: ["F", "F", "G", "G"] },
  { x0: 23.02, x1: 30.33, z0: 4.53, z1: 9.37, labels: ["E", "E", "D"] },
  { x0: 48.98, x1: 56.23, z0: 8.95, z1: 13.93, labels: ["C", "mg", "B"] },
  { x0: 74.05, x1: 79.21, z0: 13.51, z1: 18.67, labels: ["A", "mg"] },
];

/** Bin enclosures (rows of compartments) at the south end of the bays. */
export const BINS: { x0: number; x1: number; z0: number; z1: number }[] = [
  { x0: 23.7, x1: 26.6, z0: 9.7, z1: 10.32 },
  { x0: 27.8, x1: 30.65, z0: 9.7, z1: 10.32 },
  { x0: 49.3, x1: 52.2, z0: 14.2, z1: 14.82 },
  { x0: 53.6, x1: 56.0, z0: 14.2, z1: 14.82 },
  { x0: 74.4, x1: 78.9, z0: 18.72, z1: 19.32 },
];

/** Low panel fences (polylines). */
export function fenceLines(): Vec2[][] {
  const G = R("G"), F = R("F"), E = R("E"), D = R("D"), C = R("C"), B = R("B"), A = R("A");
  const midGF = (G.e + F.w) / 2;
  const midFE = (F.e + E.w) / 2;
  return [
    // Plot: north (behind the planted verge), west, south.
    [CORNER.A, [STRIP_EAST - 0.4, zNorth(STRIP_EAST - 0.4)]],
    [CORNER.A, CORNER.D],
    [CORNER.D, ACCESS[1]],
    // Access road edge and the garden fences south of the parking groups.
    [ACCESS[0], ACCESS[1]],
    [[A.e, FENCE_Z.A], ACCESS[0]],
    [[xWest(FENCE_Z.G), FENCE_Z.G], [G.w, FENCE_Z.G]],
    [[E.e, FENCE_Z.ED], [D.w, FENCE_Z.ED]],
    [[C.e, FENCE_Z.CB], [B.w, FENCE_Z.CB]],
    // Between gardens: party lines run on from the garden facades, lot lines down to the boundary.
    [[midGF, F.s], [midGF, zSouth(midGF)]],
    [[midFE, E.s], [midFE, zSouth(midFE)]],
    [[LOT_X.ED, FENCE_Z.ED], [LOT_X.ED, zSouth(LOT_X.ED)]],
    [[D.e, C.s], [D.e, zSouth(D.e)]],
    [[LOT_X.CB, FENCE_Z.CB], [LOT_X.CB, zSouth(LOT_X.CB)]],
    [[B.e, A.s], [B.e, zSouth(B.e)]],
  ];
}

/** Garden (lawn) polygon of the whole plot interior, used to paint the lawn. */
export const PLOT_POLY: Vec2[] = [CORNER.A, CORNER.B, CORNER.C, CORNER.D];

export type TreeSpec = { kind: "pine" | "birch"; x: number; z: number; h: number; seed: number };

/**
 * Trees: Scots pines and birches, as in the renders and the drone photos. They frame the houses from
 * the sides and from behind and stay out of every house-view corridor (camera → garden facade, see
 * landscape.ts) and out of the line of sight of the SSW estate view (checked offline, guarded at build).
 */
export const TREES: TreeSpec[] = [
  // G's large west garden and the west boundary.
  { kind: "pine", x: -9.5, z: 6.6, h: 15.5, seed: 11 },
  { kind: "pine", x: -14.2, z: 1.2, h: 17.5, seed: 12 },
  { kind: "birch", x: -5.2, z: 9.0, h: 10.5, seed: 13 },
  { kind: "birch", x: -11.5, z: 13.5, h: 9.5, seed: 15 },
  { kind: "pine", x: -20.5, z: -12.5, h: 16.5, seed: 14 },
  // Behind the row, in the meadow north of the drive.
  { kind: "birch", x: 2.0, z: -14.5, h: 10.5, seed: 41 },
  { kind: "birch", x: 13.0, z: -12.8, h: 10.0, seed: 31 },
  { kind: "pine", x: 24.0, z: -16.5, h: 16.0, seed: 42 },
  { kind: "pine", x: 41.0, z: -9.6, h: 15.0, seed: 32 },
  { kind: "birch", x: 47.5, z: -7.2, h: 9.0, seed: 33 },
  { kind: "birch", x: 61.0, z: -6.5, h: 10.5, seed: 43 },
  { kind: "pine", x: 71.0, z: -4.0, h: 16.5, seed: 44 },
  // East end, beyond the access road.
  { kind: "pine", x: 92.5, z: 3.5, h: 17.0, seed: 34 },
  { kind: "birch", x: 89.0, z: 13.5, h: 11.0, seed: 24 },
  { kind: "pine", x: 95.5, z: 21.0, h: 15.5, seed: 35 },
  { kind: "birch", x: 90.0, z: 36.0, h: 11.5, seed: 36 },
  // South meadow, beyond the house-view cameras.
  { kind: "pine", x: 59.0, z: 47.0, h: 18.0, seed: 38 },
  { kind: "birch", x: 44.0, z: 53.0, h: 10.5, seed: 39 },
  { kind: "birch", x: 70.0, z: 48.0, h: 10.0, seed: 21 },
  { kind: "pine", x: -18.0, z: 31.0, h: 16.0, seed: 37 },
  { kind: "pine", x: -27.0, z: 18.0, h: 15.0, seed: 40 },
];

export type Neighbour = { x: number; z: number; w: number; d: number; eaves: number; ridge: number; rot: number; hip?: boolean };

/** Neighbouring houses as clay massing (no detail), roughly where the aerial render and OSM show them. */
export const NEIGHBOURS: Neighbour[] = [
  // East: the red-roof house by the access road.
  { x: 101, z: 15, w: 12, d: 10, eaves: 4.0, ridge: 8.2, rot: 0.04, hip: true },
  { x: 118, z: 52, w: 10, d: 11, eaves: 3.2, ridge: 7.3, rot: -0.05 },
  // West.
  { x: -35, z: 3, w: 12, d: 10, eaves: 4.2, ridge: 8.6, rot: 0.02, hip: true },
  { x: -42, z: 30, w: 10, d: 9, eaves: 3.0, ridge: 7.0, rot: 0.1 },
  // North, across the meadow (the pitch lies further west).
  { x: 34, z: -64, w: 11, d: 9, eaves: 3.2, ridge: 7.4, rot: 0.03 },
  { x: 58, z: -68, w: 13, d: 9, eaves: 5.8, ridge: 6.0, rot: -0.02 },
  { x: 82, z: -60, w: 10, d: 10, eaves: 3.0, ridge: 7.0, rot: 0.06 },
  { x: 106, z: -50, w: 11, d: 10, eaves: 3.8, ridge: 7.9, rot: 0.0, hip: true },
  // South: open meadow in front of the gardens (as on the aerial photo); houses only off to the sides
  // and behind the overview camera, so its foreground stays a calm field.
  { x: -48, z: 72, w: 11, d: 10, eaves: 3.4, ridge: 7.6, rot: 0.05 },
  { x: 122, z: 74, w: 12, d: 10, eaves: 4.0, ridge: 8.1, rot: 0.02, hip: true },
  { x: 104, z: 108, w: 10, d: 9, eaves: 3.0, ridge: 6.8, rot: 0.08 },
  { x: 18, z: 150, w: 10, d: 9, eaves: 3.0, ridge: 7.0, rot: -0.03 },
];

/** Football pitch north-north-west of the estate (OSM way 273248444, ~90 m away). */
export const PITCH = { cx: -20, cz: -84, w: 96, d: 62, rot: 0.08 };

export const lineAt = lerpLine;
