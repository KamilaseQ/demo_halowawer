import type { HouseId } from "../types";
import type { HousePlacement, Vec2, Vec3 } from "./types";

/* ==========================================================================
   Estate layout, measured from the developer's PZT (dom-*-pzt.png, scale bar
   20 m; cross-checked with docs/inwestycja-3d/dane/houses.json).

   Estate space = compass: X → east, Z → south, Y up, metres. X = 0 is house
   G's west wall, Z = 0 its street (north) facade. The houses stand square to
   north; the plot is skewed, so each house steps ~1.47 m further south than
   its western neighbour (B's plan shows A's outline shifted by exactly that).

   Order west → east: G F E (terraced row) | D C | B A (semi-detached pairs).
   ========================================================================== */

/** Compass azimuth of estate +X, degrees (0 = north, 90 = east). */
export const ESTATE_AZIMUTH_X = 90;

/** Plan depth (street facade ↔ garden facade) and width along the row of the B layout. */
export const B_SIZE: Vec2 = [9.883, 8.252];
/** Terraced row (E, F, G): footprint per house [depth, width], metres. */
export const ROW_SIZE: Vec2 = [9.67, 7.63];

/** Southward step between neighbours within a pair/row (A's outline on B's plan: 1.475 m). */
const STEP = 1.475;

const QUARTER = Math.PI / 2;

/** Real roof colours (drone photo estate-8, 04.2026; docs/inwestycja-3d/02-materialy-3d.md §9). */
// Kept below ~0.65 albedo so the light seams read as metal, not as a white slab, in full sun.
export const ROOF = { champagne: "#c3b69b", sage: "#919f88", light: "#b9bdb8" } as const;

/** The maquette is warm clay (brand palette); a whisper of variation keeps neighbours apart. */
const CLAY = ["#e3ded5", "#e1dcd2", "#e5e1d8"] as const;

/*
 * Every house's plan (x → street/north, y along the row) is turned by +90° about Y, so plan y runs east
 * and plan x runs north (−Z). Mirrored houses flip plan y first, so their plan y runs west.
 * `position` is where the plan origin (outer corner garden facade × plan y = 0 wall) lands.
 */
function place(id: HouseId, west: number, front: number, size: Vec2, mirrored: boolean, facade: string, roof: string): HousePlacement {
  return {
    id,
    position: [mirrored ? west + size[1] : west, 0, front + size[0]],
    rotationY: QUARTER,
    mirrored,
    size,
    facade,
    roof,
  };
}

/** West edge (X) and street facade (Z) of the first house of each group, from the PZT. */
const ROW = { x: 0, z: 0 };
const PAIR_DC = { x: 31.67, z: 5.95 };
const PAIR_BA = { x: 57.26, z: 10.74 };

export const PLACEMENTS: Record<HouseId, HousePlacement> = {
  // Terraced row: E's plan y runs east from its party wall with F; G mirrors it (free gable to the west).
  G: place("G", ROW.x, ROW.z, ROW_SIZE, true, CLAY[0], ROOF.champagne),
  F: place("F", ROW.x + 7.44, 1.44, [ROW_SIZE[0], 7.53], false, CLAY[1], ROOF.sage),
  E: place("E", ROW.x + 14.79, 2.93, ROW_SIZE, false, CLAY[2], ROOF.light),
  // Pairs: B and D have the free gable to the west (plan y runs east); A and C mirror them.
  D: place("D", PAIR_DC.x, PAIR_DC.z, B_SIZE, false, CLAY[0], ROOF.light),
  C: place("C", PAIR_DC.x + B_SIZE[1], PAIR_DC.z + STEP, B_SIZE, true, CLAY[1], ROOF.champagne),
  B: place("B", PAIR_BA.x, PAIR_BA.z, B_SIZE, false, CLAY[2], ROOF.light),
  A: place("A", PAIR_BA.x + B_SIZE[1], PAIR_BA.z + STEP, B_SIZE, true, CLAY[0], ROOF.sage),
};

/** Default standing-seam colour (houses without a confirmed one). */
export const ROOF_COLOR = ROOF.light;

/** Plot boundary (red dashed line on the PZT, corners A–B–C–D), estate XZ. */
export const PLOT: Vec2[] = [
  [-14.4, -8.9],
  [87.6, 9.2],
  [86.2, 31.0],
  [-17.4, 10.6],
];

/** Estate centre (ground level). */
export const ESTATE_CENTER: Vec3 = [36, 0, 12];

/** Plan point of a house (plan metres, height h above the house's ground floor) → estate XYZ. */
export function planToEstate(p: HousePlacement, [x, y]: Vec2, h = 0): Vec3 {
  const yy = p.mirrored ? -y : y;
  // Rotation by +90° about Y maps (x, z) → (z, −x).
  return [p.position[0] + yy, p.position[1] + h, p.position[2] - x];
}

/** Estate centre of a house's footprint at a height. */
export function houseCenter(id: HouseId, h = 0): Vec3 {
  const p = PLACEMENTS[id];
  return planToEstate(p, [p.size[0] / 2, p.size[1] / 2], h);
}
