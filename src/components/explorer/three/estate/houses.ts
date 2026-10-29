import * as THREE from "three";
import type { HouseId } from "@/lib/estate";
import { FIRST_ELEVATION, LAYOUT_B } from "@/lib/estate/geometry/layoutB";
import { PLACEMENTS, planToEstate } from "@/lib/estate/geometry/site";
import type { HousePlacement, Roof, Vec3 } from "@/lib/estate/geometry/types";
import { GeoBuilder, type V2, type V3 } from "./builder";
import { buildGableRoof } from "./roof";

/* ==========================================================================
   Maquette house bodies, built in HOUSE space (x = plan x → street, y = height
   above the finished ground floor, z = plan y along the row) and placed by the
   component with the placement's rotation/mirror and a 0.18 m lift.

   Facades are outer skins with real openings (reveals, frames, glass), the
   ground-floor entrance recess under the upper floor on the street side and
   the standing-seam roof from roof.ts. Layout B (A–D) reads its openings from
   LAYOUT_B; the terraced row (E, F, G = mirrored E) from dom-e/f plans.
   ========================================================================== */

/** Terrain below the finished ground floor (LAYOUT_B.ground). */
export const PLINTH = -LAYOUT_B.ground;
const HB = LAYOUT_B.ground;

export type FaceId = "garden" | "street" | "recess" | "gable0" | "gable1";
export type OpeningKind = "window" | "glazing" | "entrance" | "garage";

export type FacadeOpening = {
  face: FaceId;
  /** Along-face extent: plan y for garden/street/recess, plan x for the gables. */
  a0: number;
  a1: number;
  /** Bottom and top above the finished ground floor. */
  h0: number;
  h1: number;
  kind: OpeningKind;
  sliding?: boolean;
};

export type HouseSpec = {
  depth: number;
  width: number;
  roof: Roof;
  /** Ground-floor entrance recess on the street side (under the upper floor). */
  recess: { y0: number; y1: number; x: number; top: number };
  openings: FacadeOpening[];
  /** Timber deck along the garden facade, plan y range (plan x −2…0). */
  terrace: [number, number];
  /** Plan y of the roof window on the street slope. */
  skylight: number;
};

/* ---------------------------------------------------------------- layout B */

function specB(): HouseSpec {
  const [D, W] = [LAYOUT_B.footprint[2][0], LAYOUT_B.footprint[2][1]];
  const openings: FacadeOpening[] = [];
  for (const level of LAYOUT_B.levels) {
    for (const wall of level.walls) {
      if (!wall.exterior || !wall.openings?.length) continue;
      const alongY = Math.abs(wall.b[1] - wall.a[1]) > Math.abs(wall.b[0] - wall.a[0]);
      const c = alongY ? wall.a[0] : wall.a[1];
      let face: FaceId;
      if (alongY) face = c < 1 ? "garden" : Math.abs(c - 8.49) < 0.1 ? "recess" : "street";
      else face = c < 1 ? "gable0" : "gable1";
      const a0 = alongY ? wall.a[1] : wall.a[0];
      const dir = Math.sign((alongY ? wall.b[1] : wall.b[0]) - a0);
      for (const o of wall.openings) {
        const near = a0 + dir * o.offset;
        const far = near + dir * o.width;
        const kind: OpeningKind = o.kind === "garage" ? "garage" : o.kind === "entrance" ? "entrance" : o.kind === "glazing" ? "glazing" : "window";
        openings.push({
          face,
          a0: Math.min(near, far),
          a1: Math.max(near, far),
          h0: level.elevation + o.sill,
          h1: level.elevation + o.head,
          kind,
          sliding: o.sliding,
        });
      }
    }
  }
  const t = LAYOUT_B.terraces[0];
  return {
    depth: D,
    width: W,
    roof: LAYOUT_B.roof,
    recess: { y0: 4.49, y1: 7.1, x: 8.69, top: 2.64 },
    openings,
    terrace: [t[0][1], t[2][1]],
    skylight: 2.35,
  };
}

/* ---------------------------------------------------------------- terraced row */

/** dom-e-parter.png footprint at 102.4 px/m (garden → street × party wall → free gable). */
const E_PLAN: V2 = [9.531, 7.461];

/**
 * Terraced house (E, F; G mirrors E). Openings traced from dom-e/f plans and scaled to the
 * placement's footprint. `gableWindow`: the bathroom window in the free gable (E, G).
 */
function specRow(depth: number, width: number, gableWindow: boolean): HouseSpec {
  const ky = width / E_PLAN[1];
  const kx = depth / E_PLAN[0];
  const y = (v: number) => +(v * ky).toFixed(3);
  const F1 = FIRST_ELEVATION;
  const openings: FacadeOpening[] = [
    // Ground floor: living-room window + HS door to the garden.
    { face: "garden", a0: y(1.06), a1: y(2.16), h0: 0, h1: 2.24, kind: "glazing" },
    { face: "garden", a0: y(3.18), a1: y(6.4), h0: 0, h1: 2.24, kind: "glazing", sliding: true },
    // Entrance recess: door and kitchen window.
    { face: "recess", a0: y(2.2), a1: y(3.23), h0: 0, h1: 2.08, kind: "entrance" },
    { face: "recess", a0: y(5.22), a1: y(6.29), h0: 1.18, h1: 2.25, kind: "window" },
    // First floor: two 220/204 windows each side, sill 0.21.
    { face: "garden", a0: y(1.03), a1: y(3.23), h0: F1 + 0.21, h1: F1 + 2.25, kind: "window" },
    { face: "garden", a0: y(4.21), a1: y(6.41), h0: F1 + 0.21, h1: F1 + 2.25, kind: "window" },
    { face: "street", a0: y(1.03), a1: y(3.23), h0: F1 + 0.21, h1: F1 + 2.25, kind: "window" },
    { face: "street", a0: y(4.21), a1: y(6.41), h0: F1 + 0.21, h1: F1 + 2.25, kind: "window" },
  ];
  if (gableWindow) openings.push({ face: "gable1", a0: +(4.28 * kx).toFixed(3), a1: +(5.35 * kx).toFixed(3), h0: F1 + 1.18, h1: F1 + 2.25, kind: "window" });
  const pitch = LAYOUT_B.roof.ridge - LAYOUT_B.roof.eaves;
  const rise = (depth / 2) * (pitch / (LAYOUT_B.footprint[2][0] / 2));
  return {
    depth,
    width,
    roof: {
      ridgeAxis: "y",
      eaves: LAYOUT_B.roof.eaves,
      ridge: +(LAYOUT_B.roof.eaves + rise).toFixed(3),
      thickness: LAYOUT_B.roof.thickness,
      chimneys: [
        { at: [depth / 2, 1.1], size: [0.62, 0.46], height: 0.85 },
        { at: [depth / 2, width - 1.1], size: [0.62, 0.46], height: 0.85 },
      ],
    },
    recess: { y0: y(1.08), y1: y(6.39), x: depth - 1.2, top: 2.64 },
    openings,
    terrace: [y(3.13), y(6.45)],
    skylight: y(3.9),
  };
}

const specCache = new Map<HouseId, HouseSpec>();

export function houseSpec(id: HouseId): HouseSpec {
  let s = specCache.get(id);
  if (!s) {
    const p = PLACEMENTS[id];
    s = id === "E" || id === "F" || id === "G" ? specRow(p.size[0], p.size[1], id !== "F") : specB();
    specCache.set(id, s);
  }
  return s;
}

/* ---------------------------------------------------------------- palette */

export const JOINERY = {
  frame: "#2f3236",
  door: "#363a3e",
  garage: "#565c64",
  stone: "#cfc9bf",
  handle: "#c2c4c4",
  cap: "#45474a",
} as const;

/**
 * Smooth plaster in warm white (client review: the seven houses in their real materials, only the
 * neighbours in clay). A whisper of variation between neighbours.
 */
export const PLASTER: Record<HouseId, string> = {
  // Albedo ~0.78–0.8 (never 1.0): white plaster that stays white, not lemon, in a warm low sun.
  A: "#e3ded5",
  B: "#e5e1d8",
  C: "#e1dcd2",
  D: "#e6e2d9",
  E: "#e3ddd3",
  F: "#e1dbd0",
  G: "#e3ded5",
};

const PLASTER_RM = [0.9, 0, 1] as const;

/* ---------------------------------------------------------------- body */

type Frame = {
  at: (a: number, h: number, d?: number) => V3;
  out: V3;
  inward: V3;
  along: V3;
};

function faceFrame(spec: HouseSpec, face: FaceId): Frame {
  const { depth: D, width: W, recess } = spec;
  switch (face) {
    case "garden":
      return { at: (a, h, d = 0) => [d, h, a], out: [-1, 0, 0], inward: [1, 0, 0], along: [0, 0, 1] };
    case "street":
      return { at: (a, h, d = 0) => [D - d, h, a], out: [1, 0, 0], inward: [-1, 0, 0], along: [0, 0, 1] };
    case "recess":
      return { at: (a, h, d = 0) => [recess.x - d, h, a], out: [1, 0, 0], inward: [-1, 0, 0], along: [0, 0, 1] };
    case "gable0":
      return { at: (a, h, d = 0) => [a, h, d], out: [0, 0, -1], inward: [0, 0, 1], along: [1, 0, 0] };
    case "gable1":
      return { at: (a, h, d = 0) => [a, h, W - d], out: [0, 0, 1], inward: [0, 0, -1], along: [1, 0, 0] };
  }
}

/** Flat wall with rectangular holes, triangulated in its own (a, h) plane. */
function wall(b: GeoBuilder, f: Frame, outline: V2[], holes: V2[][]) {
  const contour = outline.map(([a, h]) => new THREE.Vector2(a, h));
  const hs = holes.map((hole) => hole.map(([a, h]) => new THREE.Vector2(a, h)));
  const tris = THREE.ShapeUtils.triangulateShape(contour, hs);
  const pts = [...contour, ...hs.flat()];
  for (const [i, j, k] of tris) {
    const A = pts[i];
    const B = pts[j];
    const C = pts[k];
    const pa = f.at(A.x, A.y);
    const pb = f.at(B.x, B.y);
    const pc = f.at(C.x, C.y);
    const uv: [V2, V2, V2] = [
      [A.x, A.y],
      [B.x, B.y],
      [C.x, C.y],
    ];
    // Orient to the outward normal.
    const ux = pb[0] - pa[0], uy = pb[1] - pa[1], uz = pb[2] - pa[2];
    const vx = pc[0] - pa[0], vy = pc[1] - pa[1], vz = pc[2] - pa[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * f.out[0] + ny * f.out[1] + nz * f.out[2] >= 0) b.tri(pa, pb, pc, f.out, uv);
    else b.tri(pa, pc, pb, f.out, [uv[0], uv[2], uv[1]]);
  }
}

const rectHole = (o: { a0: number; a1: number; h0: number; h1: number }): V2[] => [
  [o.a0, o.h0],
  [o.a1, o.h0],
  [o.a1, o.h1],
  [o.a0, o.h1],
];

const scale = (c: THREE.Color, k: number) => c.clone().multiplyScalar(k);

type Palette = { facade: THREE.Color; roof: THREE.Color };

/** Reveals, frame, glass/door leaf and sill of one opening. */
function opening(b: GeoBuilder, glass: GeoBuilder, f: Frame, o: FacadeOpening, pal: Palette) {
  const frameC = new THREE.Color(JOINERY.frame);
  const dr = o.kind === "glazing" ? 0.17 : o.kind === "window" ? 0.14 : o.kind === "garage" ? 0.15 : 0.2;
  const { a0, a1, h0, h1 } = o;
  const P = (a: number, h: number, d: number) => f.at(a, h, d);
  const up: V3 = [0, 1, 0];
  const neg = (v: V3): V3 => [-v[0], -v[1], -v[2]];

  // Reveals (slightly shaded plaster).
  b.setColor(scale(pal.facade, 0.95)).setRM(...PLASTER_RM);
  b.quad(P(a0, h0, 0), P(a0, h1, 0), P(a0, h1, dr), P(a0, h0, dr), f.along);
  b.quad(P(a1, h0, 0), P(a1, h0, dr), P(a1, h1, dr), P(a1, h1, 0), neg(f.along));
  b.quad(P(a0, h1, 0), P(a1, h1, 0), P(a1, h1, dr), P(a0, h1, dr), [0, -1, 0]);
  if (h0 > 0.05) b.quad(P(a0, h0, 0), P(a0, h0, dr), P(a1, h0, dr), P(a1, h0, 0), up);
  else {
    // Threshold in stone.
    b.setColor(JOINERY.stone).setRM(0.8, 0);
    b.quad(P(a0, h0, 0), P(a0, h0, dr), P(a1, h0, dr), P(a1, h0, 0), up);
  }

  /** Bar in face coordinates: a, h ranges and depth range (measured inwards from the facade). */
  const bar = (x0: number, x1: number, y0: number, y1: number, d0: number, d1: number, skipBack = true) => {
    const c = P((x0 + x1) / 2, (y0 + y1) / 2, (d0 + d1) / 2);
    b.obox(c, f.along, up, f.inward, (x1 - x0) / 2, (y1 - y0) / 2, (d1 - d0) / 2, skipBack ? ["+w"] : []);
  };

  if (o.kind === "garage") {
    const fw = 0.05;
    b.setColor(frameC).setRM(0.55, 0.2);
    bar(a0, a0 + fw, h0, h1, dr - 0.04, dr + 0.02);
    bar(a1 - fw, a1, h0, h1, dr - 0.04, dr + 0.02);
    bar(a0 + fw, a1 - fw, h1 - fw, h1, dr - 0.04, dr + 0.02);
    // Sectional door: four panels with shadow gaps.
    b.setColor(scale(new THREE.Color(JOINERY.garage), 0.45)).setRM(0.7, 0);
    b.quad(P(a0, h0, dr + 0.02), P(a0, h1, dr + 0.02), P(a1, h1, dr + 0.02), P(a1, h0, dr + 0.02), f.out);
    // Matt anthracite (no metal: in the north shade a metallic door turns into a black hole), five panels.
    b.setColor(JOINERY.garage).setRM(0.6, 0);
    const n = 5;
    const gap = 0.035;
    const top = h1 - fw;
    for (let i = 0; i < n; i++) {
      const y0 = h0 + ((top - h0) * i) / n + (i ? gap / 2 : 0);
      const y1 = h0 + ((top - h0) * (i + 1)) / n - (i < n - 1 ? gap / 2 : 0);
      bar(a0 + fw, a1 - fw, y0, y1, dr - 0.01, dr + 0.015);
    }
    return;
  }

  if (o.kind === "entrance") {
    const fw = 0.055;
    b.setColor(frameC).setRM(0.55, 0.2);
    bar(a0, a0 + fw, h0, h1, dr - 0.04, dr + 0.03);
    bar(a1 - fw, a1, h0, h1, dr - 0.04, dr + 0.03);
    bar(a0 + fw, a1 - fw, h1 - fw, h1, dr - 0.04, dr + 0.03);
    b.setColor(JOINERY.door).setRM(0.6, 0.1);
    bar(a0 + fw, a1 - fw, h0, h1 - fw, dr - 0.02, dr + 0.03);
    // Long vertical pull handle on the lock side.
    b.setColor(JOINERY.handle).setRM(0.35, 0.8);
    const ha = a1 - fw - 0.13;
    bar(ha - 0.012, ha + 0.012, h0 + 0.7, h0 + 1.55, dr - 0.075, dr - 0.02, false);
    return;
  }

  // Windows and glazing: frame ring, mullions, glass, external sill.
  const heavy = o.kind === "glazing";
  const fw = heavy ? (o.sliding ? 0.085 : 0.07) : 0.06;
  const d0 = dr - 0.045;
  const d1 = dr + 0.03;
  b.setColor(frameC).setRM(0.5, 0.25);
  bar(a0, a0 + fw, h0, h1, d0, d1);
  bar(a1 - fw, a1, h0, h1, d0, d1);
  bar(a0 + fw, a1 - fw, h1 - fw, h1, d0, d1);
  bar(a0 + fw, a1 - fw, h0, h0 + fw, d0, d1);
  const w = a1 - a0;
  if (o.sliding) {
    const m = a0 + w / 2;
    bar(m - fw * 0.75, m + fw * 0.75, h0 + fw, h1 - fw, d0 - 0.01, d1);
  } else if (!heavy && w > 1.6) {
    // Two sashes; the narrower one carries a transom (as on the renders).
    const m = a0 + w * 0.4;
    bar(m - fw * 0.45, m + fw * 0.45, h0 + fw, h1 - fw, d0, d1);
    const t = h0 + (h1 - h0) * 0.56;
    bar(a0 + fw, m - fw * 0.45, t - fw * 0.4, t + fw * 0.4, d0, d1);
  }
  glass.setColor("#ffffff").setRM(0.05, 0);
  glass.quad(P(a0 + fw * 0.5, h0 + fw * 0.5, dr), P(a1 - fw * 0.5, h0 + fw * 0.5, dr), P(a1 - fw * 0.5, h1 - fw * 0.5, dr), P(a0 + fw * 0.5, h1 - fw * 0.5, dr), f.out, [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ]);
  if (h0 > 0.05) {
    b.setColor(scale(frameC, 1.25)).setRM(0.45, 0.4);
    bar(a0 - 0.03, a1 + 0.03, h0 - 0.035, h0 + 0.004, -0.045, d0, false);
  }
}

export type HouseGeometry = { opaque: THREE.BufferGeometry; glass: THREE.BufferGeometry };

/** Builds one house in house space. `sold` is baked as a per-vertex flag for the shader. */
export function buildHouse(spec: HouseSpec, placement: HousePlacement, sold: boolean): HouseGeometry {
  const pal: Palette = { facade: new THREE.Color(PLASTER[placement.id]), roof: new THREE.Color(placement.roof) };
  const b = new GeoBuilder(true);
  const glass = new GeoBuilder(true);
  const { depth: D, width: W, roof, recess } = spec;
  const e = roof.eaves;

  const holesOf = (face: FaceId) => spec.openings.filter((o) => o.face === face);

  // Facade skins.
  b.setColor(pal.facade).setRM(...PLASTER_RM);
  wall(b, faceFrame(spec, "garden"), [[0, HB], [W, HB], [W, e], [0, e]], holesOf("garden").map(rectHole));
  wall(
    b,
    faceFrame(spec, "street"),
    [
      [0, HB],
      [recess.y0, HB],
      [recess.y0, recess.top],
      [recess.y1, recess.top],
      [recess.y1, HB],
      [W, HB],
      [W, e],
      [0, e],
    ],
    holesOf("street").map(rectHole),
  );
  wall(b, faceFrame(spec, "recess"), [[recess.y0, HB], [recess.y1, HB], [recess.y1, recess.top], [recess.y0, recess.top]], holesOf("recess").map(rectHole));
  const gable: V2[] = [
    [0, HB],
    [D, HB],
    [D, e],
    [D / 2, roof.ridge],
    [0, e],
  ];
  wall(b, faceFrame(spec, "gable0"), gable, holesOf("gable0").map(rectHole));
  wall(b, faceFrame(spec, "gable1"), gable, holesOf("gable1").map(rectHole));

  // Entrance recess: side walls, soffit, stone floor.
  b.setColor(scale(pal.facade, 0.97)).setRM(...PLASTER_RM);
  b.quad([recess.x, HB, recess.y0], [D, HB, recess.y0], [D, recess.top, recess.y0], [recess.x, recess.top, recess.y0], [0, 0, 1]);
  b.quad([recess.x, HB, recess.y1], [recess.x, recess.top, recess.y1], [D, recess.top, recess.y1], [D, HB, recess.y1], [0, 0, -1]);
  b.quad([recess.x, recess.top, recess.y0], [D, recess.top, recess.y0], [D, recess.top, recess.y1], [recess.x, recess.top, recess.y1], [0, -1, 0]);
  b.setColor(JOINERY.stone).setRM(0.8, 0);
  b.box(recess.x, HB, recess.y0, D, -0.01, recess.y1, ["-y", "-x", "+z", "-z"]);

  for (const o of spec.openings) opening(b, glass, faceFrame(spec, o.face), o, pal);

  // Roof (no slab ends: the gable walls close it).
  const parts = buildGableRoof([D, W], roof, { endFaces: false });
  b.setColor(pal.roof).setRM(0.48, 0.35, 2);
  b.addGeometry(parts.metal, undefined, false);
  // Fascia, verges and ridge cap in anthracite like the joinery (a light roof colour turned lime in warm sun).
  b.setColor(JOINERY.frame).setRM(0.5, 0.3);
  b.addGeometry(parts.trim, undefined, false);
  b.setColor(scale(pal.facade, 0.985)).setRM(...PLASTER_RM);
  b.addGeometry(parts.chimneys, undefined, false);
  b.setColor(JOINERY.cap).setRM(0.5, 0.4);
  b.addGeometry(parts.caps, undefined, false);
  parts.metal.dispose();
  parts.trim.dispose();
  parts.chimneys.dispose();
  parts.caps.dispose();
  parts.slab.dispose();

  // Roof window on the street slope, near the ridge.
  {
    const H = D / 2;
    const R = roof.ridge - e;
    const L = Math.hypot(H, R);
    const cos = H / L;
    const sin = R / L;
    const along: V3 = [-cos, sin, 0];
    const n: V3 = [sin, cos, 0];
    const d = L - 1.45;
    const at = (off: number): V3 => [D - cos * d + n[0] * off, e + sin * d + n[1] * off, spec.skylight];
    b.setColor(JOINERY.frame).setRM(0.5, 0.3);
    b.obox(at(0.03), along, n, [0, 0, 1], 0.52, 0.04, 0.36, ["-v"]);
    const c = at(0.072);
    const p = (s: number, t: number): V3 => [c[0] + along[0] * s, c[1] + along[1] * s, c[2] + t];
    glass.setColor("#ffffff").setRM(0.05, 0);
    glass.quad(p(-0.45, -0.29), p(0.45, -0.29), p(0.45, 0.29), p(-0.45, 0.29), n, [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]);
  }

  const flag = { aSold: { size: 1, value: [sold ? 1 : 0] } };
  return { opaque: b.build(flag), glass: glass.build(flag) };
}

/* ---------------------------------------------------------------- estate helpers */

/** House-space point (x, height above the ground floor, plan y) → estate space. */
export function houseToEstate(p: HousePlacement, [x, h, y]: V3): Vec3 {
  return planToEstate(p, [x, y], h + PLINTH);
}

/** Axis-aligned estate rectangle of a footprint: [west, north, east, south]. */
export function footprintRect(id: HouseId): [number, number, number, number] {
  const p = PLACEMENTS[id];
  const west = p.mirrored ? p.position[0] - p.size[1] : p.position[0];
  return [west, p.position[2] - p.size[0], west + p.size[1], p.position[2]];
}
