import * as THREE from "three";
import type { LevelModel, Opening, Vec2, Wall } from "@/lib/estate/geometry/types";
import type { MaterialKey } from "../materials/MaterialsProvider";

/* ==========================================================================
   Procedural shell builder: turns a house LevelModel into merged geometry,
   one BufferGeometry per material key. UVs are in metres everywhere.
   ========================================================================== */

type V3 = THREE.Vector3;
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = v(0, 1, 0);

export class Buckets {
  private data = new Map<MaterialKey, { p: number[]; n: number[]; uv: number[]; i: number[] }>();

  private get(key: MaterialKey) {
    let d = this.data.get(key);
    if (!d) {
      d = { p: [], n: [], uv: [], i: [] };
      this.data.set(key, d);
    }
    return d;
  }

  /** Rectangle centred at `c`, spanning `ax`·w by `ay`·h (unit axes). Faces along ax × ay. */
  quad(key: MaterialKey, c: V3, ax: V3, ay: V3, w: number, h: number, u0 = 0, v0 = 0) {
    if (w < 1e-5 || h < 1e-5) return;
    const d = this.get(key);
    const n = v().crossVectors(ax, ay).normalize();
    const base = d.p.length / 3;
    const corners: [number, number][] = [
      [-0.5, -0.5],
      [0.5, -0.5],
      [0.5, 0.5],
      [-0.5, 0.5],
    ];
    for (const [i, j] of corners) {
      const p = c.clone().addScaledVector(ax, i * w).addScaledVector(ay, j * h);
      d.p.push(p.x, p.y, p.z);
      d.n.push(n.x, n.y, n.z);
      d.uv.push(u0 + (i + 0.5) * w, v0 + (j + 0.5) * h);
    }
    d.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  merge(other: Buckets) {
    for (const [key, src] of other.data) {
      const d = this.get(key);
      const base = d.p.length / 3;
      d.p.push(...src.p);
      d.n.push(...src.n);
      d.uv.push(...src.uv);
      d.i.push(...src.i.map((x) => x + base));
    }
  }

  build(): [MaterialKey, THREE.BufferGeometry][] {
    const out: [MaterialKey, THREE.BufferGeometry][] = [];
    for (const [key, d] of this.data) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(d.p, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(d.n, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(d.uv, 2));
      g.setIndex(d.i);
      g.computeBoundingSphere();
      out.push([key, g]);
    }
    return out;
  }
}

/** Right-handed local frame (X × Y = Z) placed in world space. */
export type Frame = { o: V3; X: V3; Y: V3; Z: V3 };

type Faces = Partial<Record<"px" | "nx" | "py" | "ny" | "pz" | "nz", MaterialKey | null>>;

/** Axis-aligned box in a local frame; each face can go to a different material (null = skip). */
export function box(b: Buckets, f: Frame, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, faces: Faces) {
  const L = (x: number, y: number, z: number) => f.o.clone().addScaledVector(f.X, x).addScaledVector(f.Y, y).addScaledVector(f.Z, z);
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const mz = (z0 + z1) / 2;
  const w = x1 - x0;
  const h = y1 - y0;
  const t = z1 - z0;
  const nX = f.X.clone().negate();
  const nZ = f.Z.clone().negate();
  if (faces.pz) b.quad(faces.pz, L(mx, my, z1), f.X, f.Y, w, h, x0, y0);
  if (faces.nz) b.quad(faces.nz, L(mx, my, z0), nX, f.Y, w, h, -x1, y0);
  if (faces.py) b.quad(faces.py, L(mx, y1, mz), f.X, nZ, w, t, x0, -z1);
  if (faces.ny) b.quad(faces.ny, L(mx, y0, mz), f.X, f.Z, w, t, x0, z0);
  if (faces.px) b.quad(faces.px, L(x1, my, mz), nZ, f.Y, t, h, -z1, y0);
  if (faces.nx) b.quad(faces.nx, L(x0, my, mz), f.Z, f.Y, t, h, z0, y0);
}

/** Frame whose X runs from plan point a to b, Z = right-hand side of a→b, origin at a on the floor. */
export function wallFrame(a: Vec2, b: Vec2, y = 0): Frame & { length: number } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.hypot(dx, dy);
  const X = v(dx / length, 0, dy / length);
  const Z = v().crossVectors(X, UP);
  return { o: v(a[0], y, a[1]), X, Y: UP.clone(), Z, length };
}

/* ---------- walls ---------- */

export type WallBuild = {
  wall: Wall;
  /** Everything below `split` (or the whole wall for interior partitions). */
  lower: Buckets;
  /** Exterior walls only: the part above `split`, lowered by the dollhouse cutaway. */
  upper: Buckets | null;
  split: number;
  /** Wall centre and outward normal in world space, for camera-facing tests. */
  center: V3;
  outward: V3;
};

const FRAME_W = 0.07;
const FRAME_D = 0.1;

/** Splits [y0, y1] at `split` into the lower/upper buckets; returns the parts to draw. */
function spans(y0: number, y1: number, split: number | null): { y0: number; y1: number; upper: boolean }[] {
  if (split === null || y1 <= split + 1e-6) return [{ y0, y1, upper: false }];
  if (y0 >= split - 1e-6) return [{ y0, y1, upper: true }];
  return [
    { y0, y1: split, upper: false },
    { y0: split, y1, upper: true },
  ];
}

export function buildWall(wall: Wall, height: number, cutaway: number): WallBuild {
  const f = wallFrame(wall.a, wall.b);
  const t = wall.thickness;
  const [leftSlot, rightSlot] = wall.sides;
  const split = wall.exterior ? cutaway : null;
  const lower = new Buckets();
  const upper = wall.exterior ? new Buckets() : null;
  const pick = (isUpper: boolean) => (isUpper && upper ? upper : lower);

  const solid = (x0: number, x1: number, y0: number, y1: number, capTop: MaterialKey | null, capBottom: MaterialKey | null) => {
    for (const s of spans(y0, y1, split)) {
      const top = s.y1 === y1 ? capTop : "wallCut";
      const bottom = s.y0 === y0 ? capBottom : null;
      box(pick(s.upper), f, x0, x1, s.y0, s.y1, -t / 2, t / 2, {
        pz: rightSlot,
        nz: leftSlot,
        py: top,
        ny: bottom,
        px: "wallPaint",
        nx: "wallPaint",
      });
    }
  };

  const openings = [...(wall.openings ?? [])].sort((p, q) => p.offset - q.offset);
  let cursor = 0;
  for (const o of openings) {
    if (o.offset > cursor + 1e-4) solid(cursor, o.offset, 0, height, "wallCut", null);
    if (o.sill > 0) solid(o.offset, o.offset + o.width, 0, o.sill, "wallPaint", null);
    if (o.head < height) solid(o.offset, o.offset + o.width, o.head, height, "wallCut", "wallPaint");
    buildOpening(o, f, t, (y0, y1) => spans(y0, y1, split), pick);
    cursor = o.offset + o.width;
  }
  if (f.length > cursor + 1e-4) solid(cursor, f.length, 0, height, "wallCut", null);

  const center = f.o.clone().addScaledVector(f.X, f.length / 2).setY(height / 2);
  // `sides[0]` is the left (−Z) side; for exterior walls the facade side is the outside.
  const outward = leftSlot === "facade" ? f.Z.clone().negate() : f.Z.clone();
  return { wall, lower, upper, split: split ?? height, center, outward };
}

type SpanFn = (y0: number, y1: number) => { y0: number; y1: number; upper: boolean }[];

/** Frames, glass and door leaves inside an opening. */
function buildOpening(o: Opening, f: Frame, t: number, span: SpanFn, pick: (upper: boolean) => Buckets) {
  const x0 = o.offset;
  const x1 = o.offset + o.width;
  const fd = FRAME_D / 2;
  const frameBox = (bx0: number, bx1: number, y0: number, y1: number, z0 = -fd, z1 = fd) => {
    for (const s of span(y0, y1)) {
      box(pick(s.upper), f, bx0, bx1, s.y0, s.y1, z0, z1, { px: "frame", nx: "frame", py: "frame", ny: "frame", pz: "frame", nz: "frame" });
    }
  };
  const pane = (px0: number, px1: number, y0: number, y1: number) => {
    for (const s of span(y0, y1)) {
      const c = f.o.clone().addScaledVector(f.X, (px0 + px1) / 2).setY((s.y0 + s.y1) / 2);
      pick(s.upper).quad("glass", c, f.X, f.Y, px1 - px0, s.y1 - s.y0);
      pick(s.upper).quad("glass", c, f.X.clone().negate(), f.Y, px1 - px0, s.y1 - s.y0);
    }
  };

  if (o.kind === "passage") return;

  if (o.kind === "door" || o.kind === "entrance") {
    // Jamb lining
    const lin = 0.02;
    const lining: MaterialKey = o.kind === "entrance" ? "frame" : "door";
    for (const s of span(0, o.head)) {
      box(pick(s.upper), f, x0, x0 + lin, s.y0, s.y1, -t / 2 - 0.005, t / 2 + 0.005, { px: lining, nz: lining, pz: lining });
      box(pick(s.upper), f, x1 - lin, x1, s.y0, s.y1, -t / 2 - 0.005, t / 2 + 0.005, { nx: lining, nz: lining, pz: lining });
    }
    box(pick(false), f, x0, x1, o.head - lin, o.head, -t / 2 - 0.005, t / 2 + 0.005, { ny: lining, nz: lining, pz: lining });

    const leafW = o.width - 2 * lin;
    const leafH = o.head - lin - 0.01;
    const leafT = 0.04;
    const key: MaterialKey = o.kind === "entrance" ? "entrance" : "door";
    if (o.kind === "entrance") {
      // Closed front door, flush with the inner face.
      box(pick(false), f, x0 + lin, x1 - lin, 0.01, leafH, -leafT / 2, leafT / 2, { px: key, nx: key, py: key, pz: key, nz: key });
      return;
    }
    // Interior door, open ~95° into the right-hand (+Z) side, hinged at x0.
    const angle = THREE.MathUtils.degToRad(95);
    const hinge = f.o.clone().addScaledVector(f.X, x0 + lin).addScaledVector(f.Z, t / 2);
    const X = f.X.clone().applyAxisAngle(UP, -angle);
    const leaf: Frame = { o: hinge, X, Y: UP.clone(), Z: v().crossVectors(X, UP) };
    box(pick(false), leaf, 0, leafW, 0.01, leafH, -leafT, 0, { px: key, nx: key, py: key, pz: key, nz: key });
    return;
  }

  if (o.kind === "garage") {
    // Closed sectional door set back from the facade, panels every ~0.55 m.
    const panels = Math.max(3, Math.round(o.head / 0.55));
    const ph = o.head / panels;
    const zf = -t / 2 + 0.12;
    for (let i = 0; i < panels; i++) {
      box(pick(false), f, x0, x1, i * ph + 0.006, (i + 1) * ph - 0.006, zf - 0.03, zf, { nz: "garageDoor", pz: "garageDoor", py: "garageDoor", ny: "garageDoor" });
    }
    frameBox(x0, x0 + 0.04, 0, o.head, -t / 2, t / 2);
    frameBox(x1 - 0.04, x1, 0, o.head, -t / 2, t / 2);
    return;
  }

  // Windows and glazing: perimeter frame, mullions at ≤1.3 m, glass in each bay.
  const y0 = o.sill;
  const y1 = o.head;

  if (o.sliding) {
    // HS lift-and-slide door, parked half open: the fixed pane on the a-side, the sliding leaf in front of it
    // (inner track), so the walk steps straight out onto the terrace through the free half.
    const half = o.width / 2;
    const heavy = FRAME_W * 1.6;
    frameBox(x0, x1, y1 - heavy, y1, -fd * 1.4, fd * 1.4);
    frameBox(x0, x1, y0, y0 + 0.025, -fd * 1.4, fd * 1.4);
    frameBox(x0, x0 + heavy, y0, y1, -fd * 1.4, fd * 1.4);
    frameBox(x1 - heavy, x1, y0, y1, -fd * 1.4, fd * 1.4);
    // Fixed pane (outer track).
    frameBox(x0 + half - heavy / 2, x0 + half + heavy / 2, y0, y1, -fd * 1.4, 0);
    pane(x0 + heavy, x0 + half - heavy / 2, y0 + 0.03, y1 - heavy);
    // Sliding leaf (inner track), parked over the fixed pane.
    const lx0 = x0 + heavy * 0.6;
    const lx1 = x0 + half + heavy * 0.4;
    const zi = fd * 1.4 + 0.02;
    box(pick(false), f, lx0, lx0 + heavy, y0 + 0.03, y1 - heavy, zi - 0.05, zi, { px: "frame", nx: "frame", pz: "frame", nz: "frame" });
    box(pick(false), f, lx1 - heavy, lx1, y0 + 0.03, y1 - heavy, zi - 0.05, zi, { px: "frame", nx: "frame", pz: "frame", nz: "frame" });
    box(pick(false), f, lx0, lx1, y1 - heavy - 0.05, y1 - heavy, zi - 0.05, zi, { py: "frame", ny: "frame", pz: "frame", nz: "frame" });
    box(pick(false), f, lx0, lx1, y0 + 0.03, y0 + 0.1, zi - 0.05, zi, { py: "frame", pz: "frame", nz: "frame" });
    const c = f.o.clone().addScaledVector(f.X, (lx0 + lx1) / 2).addScaledVector(f.Z, zi - 0.025).setY((y0 + y1 - heavy) / 2 + 0.03);
    pick(false).quad("glass", c, f.X, f.Y, lx1 - lx0 - 2 * heavy, y1 - heavy - y0 - 0.14);
    pick(false).quad("glass", c, f.X.clone().negate(), f.Y, lx1 - lx0 - 2 * heavy, y1 - heavy - y0 - 0.14);
    // Pull handle on the leaf.
    box(pick(false), f, lx1 - heavy - 0.03, lx1 - heavy - 0.01, 0.85, 1.35, zi, zi + 0.04, { px: "metal", nx: "metal", pz: "metal", py: "metal", ny: "metal" });
    return;
  }

  frameBox(x0, x0 + FRAME_W, y0, y1);
  frameBox(x1 - FRAME_W, x1, y0, y1);
  frameBox(x0, x1, y1 - FRAME_W, y1);
  frameBox(x0, x1, y0, y0 + (o.sill === 0 ? 0.02 : FRAME_W));

  const bays = Math.max(1, Math.round(o.width / 1.3));
  const bay = o.width / bays;
  for (let i = 1; i < bays; i++) frameBox(x0 + i * bay - FRAME_W / 2, x0 + i * bay + FRAME_W / 2, y0, y1);
  for (let i = 0; i < bays; i++) {
    // Floor-to-ceiling glazing keeps one bay open so the walk can pass through.
    if (o.kind === "glazing" && bays > 1 && i === Math.floor(bays / 2)) continue;
    pane(x0 + i * bay + FRAME_W / 2, x0 + (i + 1) * bay - FRAME_W / 2, y0 + FRAME_W, y1 - FRAME_W);
  }
}

/* ---------- railings ---------- */

/** Bar railing along a polyline (stair landing, gallery). */
export type Railing = { points: Vec2[]; height: number };

export function buildRailing(r: Railing, into: Buckets, baseY = 0) {
  const all = { px: "frame", nx: "frame", py: "frame", ny: "frame", pz: "frame", nz: "frame" } as const;
  for (let i = 0; i < r.points.length - 1; i++) {
    const f = wallFrame(r.points[i], r.points[i + 1], baseY);
    box(into, f, 0, f.length, r.height - 0.04, r.height, -0.025, 0.025, all);
    box(into, f, 0, f.length, 0.06, 0.09, -0.012, 0.012, all);
    const n = Math.max(1, Math.round(f.length / 0.11));
    for (let k = 0; k <= n; k++) {
      const x = (k / n) * f.length;
      box(into, f, x - 0.009, x + 0.009, 0.06, r.height - 0.04, -0.009, 0.009, { px: "frame", nx: "frame", pz: "frame", nz: "frame" });
    }
  }
}

/* ---------- slabs, floors and ceilings ---------- */

const toShape = (poly: Vec2[], flipY: boolean) => new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, flipY ? -y : y)));

/** Horizontal polygon facing up at height y (UVs = plan metres). */
export function floorGeometry(poly: Vec2[], y: number) {
  const g = new THREE.ShapeGeometry(toShape(poly, true));
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

/** Horizontal polygon facing down at height y. */
export function ceilingGeometry(poly: Vec2[], y: number) {
  const g = new THREE.ShapeGeometry(toShape(poly, false));
  g.rotateX(Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

/** Extruded slab with its top face at `top`. Group 0 = caps, group 1 = edge band. */
export function slabGeometry(poly: Vec2[], top: number, depth: number) {
  const g = new THREE.ExtrudeGeometry(toShape(poly, true), { depth, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, top - depth, 0);
  return g;
}


/* ---------- stairs ---------- */

type Flight = NonNullable<LevelModel["stairs"]>[number];

/** Solid stair flight (treads, risers, closed sides), merged into `into`. */
export function buildStairs(s: Flight, into: Buckets) {
  const [x0, y0, x1, y1] = s.rect;
  // Right-handed frames (X across the flight, Z = climbing direction, X × Y = Z), origin at the first step.
  const frames: Record<Flight["dir"], { o: V3; X: V3; Z: V3; width: number; run: number }> = {
    "+y": { o: v(x0, 0, y0), X: v(1, 0, 0), Z: v(0, 0, 1), width: x1 - x0, run: y1 - y0 },
    "-y": { o: v(x1, 0, y1), X: v(-1, 0, 0), Z: v(0, 0, -1), width: x1 - x0, run: y1 - y0 },
    "+x": { o: v(x0, 0, y1), X: v(0, 0, -1), Z: v(1, 0, 0), width: y1 - y0, run: x1 - x0 },
    "-x": { o: v(x1, 0, y0), X: v(0, 0, 1), Z: v(-1, 0, 0), width: y1 - y0, run: x1 - x0 },
  };
  const fr = frames[s.dir];
  const f: Frame = { o: fr.o, X: fr.X, Y: UP.clone(), Z: fr.Z };
  const step = fr.run / s.steps;
  const rise = (s.top - s.base) / s.steps;
  for (let i = 0; i < s.steps; i++) {
    const z0 = i * step;
    box(into, f, 0, fr.width, s.base, s.base + (i + 1) * rise, z0, z0 + step + 0.02, {
      py: "floorWood",
      nz: "wallPaint",
      px: "wallPaint",
      nx: "wallPaint",
    });
  }
}

/* ---------- one level of a house ---------- */

export type LevelBuild = {
  walls: WallBuild[];
  /** Stairs and other static parts that don't take part in the cutaway. */
  fixtures: Buckets;
};

export function buildLevel(level: LevelModel, cutaway = 1.0): LevelBuild {
  const walls = level.walls.map((w) => buildWall(w, level.ceilingHeight, cutaway));
  const fixtures = new Buckets();
  for (const s of level.stairs ?? []) buildStairs(s, fixtures);
  return { walls, fixtures };
}

/** Plan point → world vector at height y. */
export const planToWorld = ([x, y]: Vec2, h = 0) => new THREE.Vector3(x, h, y);

/* ---------- garden terrace ---------- */

/**
 * Timber deck: 145 mm boards with 7 mm gaps running away from the facade (plan x), on joists, over a
 * rectangle [x0, y0, x1, y1] with the board tops at `top`.
 */
export function buildDeck([x0, y0, x1, y1]: [number, number, number, number], top: number) {
  const into = new Buckets();
  const f: Frame = { o: v(0, 0, 0), X: v(1, 0, 0), Y: UP.clone(), Z: v(0, 0, 1) };
  const board = 0.145;
  const gap = 0.007;
  const thick = 0.028;
  const n = Math.max(1, Math.floor((y1 - y0 + gap) / (board + gap)));
  const used = n * board + (n - 1) * gap;
  const start = y0 + (y1 - y0 - used) / 2;
  for (let i = 0; i < n; i++) {
    const z0 = start + i * (board + gap);
    box(into, f, x0, x1, top - thick, top, z0, z0 + board, { py: "deck", px: "deck", nx: "deck", pz: "deck", nz: "deck" });
  }
  // Joists and a dark fascia band hide the gaps' depth.
  for (const x of [x0 + 0.08, (x0 + x1) / 2, x1 - 0.14]) {
    box(into, f, x, x + 0.06, top - 0.16, top - thick, y0, y1, { px: "slabEdge", nx: "slabEdge", pz: "slabEdge", nz: "slabEdge" });
  }
  box(into, f, x0, x1, top - 0.17, top - thick, y0 - 0.001, y0 + 0.02, { nz: "deck", pz: "deck", py: "deck" });
  box(into, f, x0, x1, top - 0.17, top - thick, y1 - 0.02, y1 + 0.001, { nz: "deck", pz: "deck", py: "deck" });
  box(into, f, x0 - 0.001, x0 + 0.02, top - 0.17, top - thick, y0, y1, { nx: "deck", px: "deck", py: "deck" });
  return into;
}
