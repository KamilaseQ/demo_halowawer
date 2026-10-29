import * as THREE from "three";
import { GeoBuilder, rng, type V2, type V3 } from "./builder";
import { FOLIAGE_CELL } from "./textures";
import type { TreeSpec } from "./plan";

/* ==========================================================================
   Procedural vegetation.
   Trees: tapered, slightly bent trunks with a few limbs (bark mesh) and
   crowns of alpha-tested leaf cards (foliage mesh) whose normals point out
   of the crown volume, so a crown shades as one soft mass while its edge
   stays leafy. Scots pines carry flat needle pads high on an orange upper
   trunk; birches have white, dark-marked stems and an airy oval crown.
   All trees are merged into two static meshes (2 draw calls + shadows).
   ========================================================================== */

const UP = new THREE.Vector3(0, 1, 0);

type Pt = THREE.Vector3;

/** Tube along a polyline with per-point radius and colour (smooth normals). */
function tube(b: GeoBuilder, pts: Pt[], radii: number[], colorAt: (i: number, k: number) => THREE.Color, sides = 7, cap = true) {
  const rings: { p: Pt; n: Pt }[][] = [];
  const t = new THREE.Vector3();
  const n0 = new THREE.Vector3();
  const b0 = new THREE.Vector3();
  for (let i = 0; i < pts.length; i++) {
    if (i < pts.length - 1) t.subVectors(pts[i + 1], pts[i]).normalize();
    else t.subVectors(pts[i], pts[i - 1]).normalize();
    n0.copy(Math.abs(t.y) < 0.9 ? UP : new THREE.Vector3(1, 0, 0)).cross(t).normalize();
    b0.crossVectors(t, n0).normalize();
    const ring: { p: Pt; n: Pt }[] = [];
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      const dir = n0.clone().multiplyScalar(Math.cos(a)).addScaledVector(b0, Math.sin(a));
      ring.push({ p: pts[i].clone().addScaledVector(dir, radii[i]), n: dir });
    }
    rings.push(ring);
  }
  const v = (p: Pt): V3 => [p.x, p.y, p.z];
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < sides; k++) {
      const k1 = (k + 1) % sides;
      const a = rings[i][k];
      const b1 = rings[i][k1];
      const c = rings[i + 1][k1];
      const d = rings[i + 1][k];
      const ca = colorAt(i, k);
      const cb = colorAt(i, k1);
      const cc = colorAt(i + 1, k1);
      const cd = colorAt(i + 1, k);
      const uv = (ii: number, kk: number): V2 => [kk / sides, ii];
      b.triN(v(a.p), v(b1.p), v(c.p), v(a.n), v(b1.n), v(c.n), [uv(i, k), uv(i, k + 1), uv(i + 1, k + 1)], [ca, cb, cc]);
      b.triN(v(a.p), v(c.p), v(d.p), v(a.n), v(c.n), v(d.n), [uv(i, k), uv(i + 1, k + 1), uv(i + 1, k)], [ca, cc, cd]);
    }
  }
  if (cap) {
    const last = rings[rings.length - 1];
    const tip = pts[pts.length - 1];
    for (let k = 0; k < sides; k++) {
      const a = last[k];
      const c = last[(k + 1) % sides];
      b.setColor(colorAt(rings.length - 1, k));
      b.tri(v(a.p), v(c.p), v(tip), [t.x, t.y, t.z]);
    }
  }
}

/** Bent polyline from `base` along `dir` with gentle random curvature. */
function limb(r: () => number, base: Pt, dir: Pt, length: number, segments: number, wander: number, droop = 0): Pt[] {
  const pts = [base.clone()];
  const d = dir.clone().normalize();
  const p = base.clone();
  for (let i = 1; i <= segments; i++) {
    d.x += (r() - 0.5) * wander;
    d.z += (r() - 0.5) * wander;
    d.y -= droop;
    d.normalize();
    p.addScaledVector(d, length / segments);
    pts.push(p.clone());
  }
  return pts;
}

/** One leaf card: a quad with random orientation, all four normals pointing out of the crown. */
function card(f: GeoBuilder, r: () => number, center: Pt, crown: Pt, size: number, color: THREE.Color, cell: number, normalBias: Pt) {
  const n = center.clone().sub(crown).normalize().add(normalBias).normalize();
  // Card plane: random, leaning towards facing outwards so the crown silhouette stays leafy.
  const pn = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().lerp(n, 0.45).normalize();
  const ref = Math.abs(pn.y) < 0.95 ? UP : new THREE.Vector3(1, 0, 0);
  const u0 = new THREE.Vector3().crossVectors(ref, pn).normalize();
  const w0 = new THREE.Vector3().crossVectors(pn, u0).normalize();
  const spin = r() * Math.PI * 2;
  const u = u0.clone().multiplyScalar(Math.cos(spin)).addScaledVector(w0, Math.sin(spin));
  const w = new THREE.Vector3().crossVectors(pn, u).normalize();
  const h = size / 2;
  const P = (su: number, sv: number): V3 => {
    const p = center.clone().addScaledVector(u, su * h).addScaledVector(w, sv * h);
    return [p.x, p.y, p.z];
  };
  // Atlas cell (2 × 2; the canvas is flipped, so its top row is v ∈ [0.5, 1]).
  const cu = (cell % 2) * 0.5;
  const cv = cell < 2 ? 0.5 : 0;
  const N: V3 = [n.x, n.y, n.z];
  const col: [THREE.Color, THREE.Color, THREE.Color] = [color, color, color];
  f.triN(P(-1, -1), P(1, -1), P(1, 1), N, N, N, [[cu, cv], [cu + 0.5, cv], [cu + 0.5, cv + 0.5]], col);
  f.triN(P(-1, -1), P(1, 1), P(-1, 1), N, N, N, [[cu, cv], [cu + 0.5, cv + 0.5], [cu, cv + 0.5]], col);
}

const C = (hex: string) => new THREE.Color(hex);

/** Shade of a foliage card: darker inside and underneath the crown (cheap self-occlusion). */
function foliageShade(base: THREE.Color, top: THREE.Color, rel: Pt, radius: Pt, r: () => number) {
  const y = THREE.MathUtils.clamp(rel.y / radius.y, -1, 1);
  const depth = Math.min(1, Math.hypot(rel.x / radius.x, rel.y / radius.y, rel.z / radius.z));
  const k = 0.62 + 0.26 * depth + 0.12 * (y + 1) * 0.5;
  return base
    .clone()
    .lerp(top, THREE.MathUtils.clamp(0.45 + y * 0.55, 0, 1) * 0.7)
    .multiplyScalar(k * (0.92 + r() * 0.16));
}

/** Random point in a unit ball, biased towards the surface by `shell` (0 uniform → 1 surface). */
function ballPoint(r: () => number, shell: number) {
  const u = r() * Math.PI * 2;
  const v = Math.acos(2 * r() - 1);
  const k = Math.pow(r(), 1 / (3 + shell * 6));
  return new THREE.Vector3(Math.sin(v) * Math.cos(u) * k, Math.cos(v) * k, Math.sin(v) * Math.sin(u) * k);
}

/** Scots pine: bare, slightly bent trunk turning orange at the top, crown of flat needle clouds. */
function pine(bark: GeoBuilder, leaves: GeoBuilder, t: TreeSpec) {
  const r = rng(t.seed * 97 + 3);
  const base = new THREE.Vector3(t.x, -0.2, t.z);
  const lean = new THREE.Vector3((r() - 0.5) * 0.14, 1, (r() - 0.5) * 0.14);
  const trunkH = t.h * 0.84;
  const trunk = limb(r, base, lean, trunkH, 10, 0.08);
  const r0 = 0.16 + t.h * 0.011;
  const radii = trunk.map((_, i) => THREE.MathUtils.lerp(r0, 0.06, Math.pow(i / (trunk.length - 1), 0.8)));
  const low = C("#7c6d60");
  const high = C("#b58b66");
  tube(bark, trunk, radii, (i) => low.clone().lerp(high, THREE.MathUtils.smoothstep(i / (trunk.length - 1), 0.4, 0.85)), 8);

  // Needle clouds on short limbs over the top third, plus a crowning cloud.
  const padBase = C("#3e4d38");
  const padTop = C("#748358");
  const pads: { c: Pt; rx: number; ry: number }[] = [];
  const count = 9 + Math.floor(r() * 4);
  for (let i = 0; i < count; i++) {
    const s = 0.6 + (i / count) * 0.36 + (r() - 0.5) * 0.05;
    const idx = Math.min(trunk.length - 1, Math.round(s * (trunk.length - 1)));
    const from = trunk[idx];
    const ang = (i / count) * Math.PI * 2 * 1.618 + r() * 0.8;
    const len = (1.15 - (s - 0.6) * 1.5) * (1.6 + r() * 1.3) + 0.4;
    const dir = new THREE.Vector3(Math.cos(ang), 0.3 + r() * 0.3, Math.sin(ang));
    const pts = limb(r, from, dir, len, 3, 0.2);
    tube(bark, pts, pts.map((_, k) => THREE.MathUtils.lerp(0.055, 0.022, k / (pts.length - 1))), () => high, 5, false);
    pads.push({ c: pts[pts.length - 1].clone().add(new THREE.Vector3(0, 0.2, 0)), rx: 1.1 + r() * 0.9 - (s - 0.6) * 0.8, ry: 0.42 + r() * 0.2 });
  }
  pads.push({ c: trunk[trunk.length - 1].clone().add(new THREE.Vector3(0, 0.35, 0)), rx: 1.3, ry: 0.6 });

  const crownC = new THREE.Vector3(t.x, t.h * 0.8, t.z);
  for (const pad of pads) {
    const n = Math.round(12 + pad.rx * 15);
    const rad = new THREE.Vector3(pad.rx, pad.ry, pad.rx);
    for (let i = 0; i < n; i++) {
      const b = ballPoint(r, 0.6);
      // Flat underside, domed top.
      if (b.y < -0.35) b.y = -0.35 - (b.y + 0.35) * 0.2;
      const rel = new THREE.Vector3(b.x * pad.rx, b.y * pad.ry, b.z * pad.rx);
      const p = pad.c.clone().add(rel);
      const bias = p.clone().sub(crownC).normalize().multiplyScalar(0.3).add(new THREE.Vector3(0, 0.55, 0));
      card(leaves, r, p, pad.c.clone().add(new THREE.Vector3(0, -pad.ry * 0.8, 0)), 1.0 + r() * 0.5, foliageShade(padBase, padTop, rel, rad, r), FOLIAGE_CELL.pine, bias);
    }
  }
}

/** Birch: white, dark-marked stems (often two), thin limbs and an airy, slightly weeping oval crown. */
function birch(bark: GeoBuilder, leaves: GeoBuilder, t: TreeSpec) {
  const r = rng(t.seed * 131 + 7);
  const white = C("#eeebe4");
  const dark = C("#3f3b37");
  const stems = r() < 0.55 ? 2 : 1;
  const crownC = new THREE.Vector3(t.x, t.h * 0.63, t.z);
  const crownR = new THREE.Vector3(1.5 + t.h * 0.1, t.h * 0.34, 1.5 + t.h * 0.1);
  const branchTips: Pt[] = [];
  for (let s = 0; s < stems; s++) {
    const off = stems > 1 ? (s ? 0.2 : -0.2) : 0;
    const base = new THREE.Vector3(t.x + off, -0.2, t.z + (r() - 0.5) * 0.2);
    const lean = new THREE.Vector3(off * 0.7 + (r() - 0.5) * 0.12, 1, (r() - 0.5) * 0.12);
    const h = t.h * (s ? 0.86 : 0.95);
    const trunk = limb(r, base, lean, h, 12, 0.07);
    const r0 = 0.1 + t.h * 0.007;
    const radii = trunk.map((_, i) => THREE.MathUtils.lerp(r0, 0.025, Math.pow(i / (trunk.length - 1), 0.85)));
    // Birch bark: white with dark lenticels, darker at the foot.
    const marks = trunk.map(() => Array.from({ length: 7 }, () => r()));
    tube(
      bark,
      trunk,
      radii,
      (i, k) => {
        const foot = i < 2 ? 0.6 : 0;
        const mark = marks[i][k] < 0.14 ? 0.8 : 0;
        return white.clone().lerp(dark, Math.max(foot, mark));
      },
      7,
    );
    const limbs = 8 + Math.floor(r() * 4);
    for (let i = 0; i < limbs; i++) {
      const sIdx = Math.round((0.36 + (i / limbs) * 0.52) * (trunk.length - 1));
      const from = trunk[sIdx];
      const ang = r() * Math.PI * 2;
      const dir = new THREE.Vector3(Math.cos(ang), 0.7 + r() * 0.4, Math.sin(ang));
      const pts = limb(r, from, dir, 1.5 + r() * 1.7, 3, 0.25, 0.2);
      tube(bark, pts, pts.map((_, k) => THREE.MathUtils.lerp(0.04, 0.012, k / (pts.length - 1))), () => C("#dcd7cd"), 4, false);
      branchTips.push(pts[pts.length - 1]);
    }
  }
  const base = C("#97a862");
  const top = C("#cbcb84");
  const n = Math.round(150 + t.h * 12);
  for (let i = 0; i < n; i++) {
    let p: Pt;
    if (i % 3 === 0 && branchTips.length) {
      const tip = branchTips[Math.floor(r() * branchTips.length)];
      p = tip.clone().add(new THREE.Vector3((r() - 0.5) * 1.8, (r() - 0.5) * 1.5 - 0.3, (r() - 0.5) * 1.8));
    } else {
      const b = ballPoint(r, 0.7);
      p = crownC.clone().add(new THREE.Vector3(b.x * crownR.x, b.y * crownR.y, b.z * crownR.z));
    }
    const rel = p.clone().sub(crownC);
    // Weeping habit: the lower half narrows a little and hangs.
    if (rel.y < 0) {
      p.x -= rel.x * 0.12;
      p.z -= rel.z * 0.12;
    }
    card(leaves, r, p, crownC.clone().add(new THREE.Vector3(0, -crownR.y * 0.35, 0)), 0.8 + r() * 0.5, foliageShade(base, top, rel, crownR, r), FOLIAGE_CELL.birch, new THREE.Vector3(0, 0.2, 0));
  }
}

/** Horizontal reach of a tree's crown from its trunk, metres (for clearance checks). */
export function crownRadius(t: TreeSpec) {
  return t.kind === "birch" ? 2.2 + t.h * 0.1 : 4.2;
}

export type ShrubKind = "hedge" | "garden" | "hydrangea" | "wild";
/** A shrub clump: ellipsoid half-sizes (rx along `rot`, ry up, rz across), standing on the ground. */
export type ShrubSpec = { x: number; z: number; rx: number; ry: number; rz: number; rot: number; kind: ShrubKind; seed: number };

const SHRUB_TONES: Record<ShrubKind, [string, string]> = {
  hedge: ["#3f6a2c", "#84ad55"],
  garden: ["#467534", "#90b862"],
  hydrangea: ["#43702f", "#86ae58"],
  wild: ["#53693a", "#8fa262"],
};

/** Leafy clump of leaf cards (flat underside, clipped top for hedges), hydrangeas carry flower heads. */
function shrub(leaves: GeoBuilder, s: ShrubSpec) {
  const r = rng(s.seed * 7919 + 17);
  const [lo, hi] = SHRUB_TONES[s.kind];
  const base = C(lo);
  const top = C(hi);
  const c = new THREE.Vector3(s.x, s.ry * 0.92, s.z);
  const rad = new THREE.Vector3(s.rx, s.ry, s.rz);
  const cos = Math.cos(s.rot);
  const sin = Math.sin(s.rot);
  const place = (b: THREE.Vector3) => {
    const lx = b.x * s.rx;
    const lz = b.z * s.rz;
    return new THREE.Vector3(c.x + lx * cos - lz * sin, c.y + b.y * s.ry, c.z + lx * sin + lz * cos);
  };
  const area = s.rx * s.ry + s.ry * s.rz + s.rx * s.rz;
  const n = Math.round(12 + area * 15);
  const size = 0.38 + Math.min(s.rx, s.ry, s.rz) * 0.35;
  const centre = c.clone().add(new THREE.Vector3(0, -s.ry * 0.45, 0));
  for (let i = 0; i < n; i++) {
    const b = ballPoint(r, 0.75);
    if (b.y < -0.7) b.y = -0.7 - (b.y + 0.7) * 0.2;
    if (s.kind === "hedge" && b.y > 0.72) b.y = 0.72 + (b.y - 0.72) * 0.25;
    const rel = new THREE.Vector3(b.x * s.rx, b.y * s.ry, b.z * s.rz);
    card(leaves, r, place(b), centre, size * (0.85 + r() * 0.4), foliageShade(base, top, rel, rad, r), FOLIAGE_CELL.leaves, new THREE.Vector3(0, 0.25, 0));
  }
  if (s.kind === "hydrangea") {
    const cream = C("#f3f0e8");
    const blush = C("#e8e6ee");
    const heads = Math.round(n * 0.4);
    for (let i = 0; i < heads; i++) {
      const b = ballPoint(r, 1);
      if (b.y < -0.15) b.y = -b.y * 0.5;
      const col = (r() < 0.75 ? cream : blush).clone().multiplyScalar(0.9 + r() * 0.12);
      card(leaves, r, place(b.multiplyScalar(1.02)), centre, 0.3 + r() * 0.14, col, FOLIAGE_CELL.flowers, new THREE.Vector3(0, 0.4, 0));
    }
  }
}

/** All tree crowns, bark and shrub clumps: two static meshes (foliage cards + bark). */
export function buildFoliage(trees: TreeSpec[], shrubs: ShrubSpec[]) {
  const bark = new GeoBuilder(false);
  const leaves = new GeoBuilder(false);
  for (const t of trees) (t.kind === "pine" ? pine : birch)(bark, leaves, t);
  for (const sh of shrubs) shrub(leaves, sh);
  return { bark: bark.build(), foliage: leaves.build() };
}

/* ---------------------------------------------------------------- grasses */

/**
 * One tuft (unit height): an upright core and an arching skirt of tapered blades, colour from a darker
 * base to a pale tip (multiplied by the instance colour). Normals lean up/out for soft shading.
 */
export function grassTuftGeometry(blades = 26) {
  const b = new GeoBuilder(false);
  const r = rng(5);
  const baseC = new THREE.Color(0.4, 0.4, 0.34);
  const tipC = new THREE.Color(1.06, 1.06, 1.0);
  for (let i = 0; i < blades; i++) {
    const ang = (i / blades) * Math.PI * 2 * 2.618 + r() * 0.4;
    const skirt = i % 2 === 1;
    const out = skirt ? 0.42 + r() * 0.32 : 0.12 + r() * 0.2;
    const h = skirt ? 0.6 + r() * 0.25 : 0.85 + r() * 0.22;
    const w = 0.026 + r() * 0.018;
    const root = 0.03 + r() * 0.07;
    const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const P = (t: number, s: number): V3 => {
      const x = dir.x * (root + out * t * t) + side.x * s * w * (1 - t);
      const z = dir.z * (root + out * t * t) + side.z * s * w * (1 - t);
      return [x, h * Math.sin((t * Math.PI) / 2) * (1 - (skirt ? 0.25 : 0.1) * t), z];
    };
    const N = (t: number): V3 => {
      const n = new THREE.Vector3(dir.x * (0.35 + t * 0.5), 1, dir.z * (0.35 + t * 0.5)).normalize();
      return [n.x, n.y, n.z];
    };
    const col = (t: number) => baseC.clone().lerp(tipC, t);
    b.triN(P(0, -1), P(0, 1), P(0.5, 1), N(0), N(0), N(0.5), undefined, [col(0), col(0), col(0.5)]);
    b.triN(P(0, -1), P(0.5, 1), P(0.5, -1), N(0), N(0.5), N(0.5), undefined, [col(0), col(0.5), col(0.5)]);
    b.triN(P(0.5, -1), P(0.5, 1), P(1, 0), N(0.5), N(0.5), N(1), undefined, [col(0.5), col(0.5), col(1)]);
  }
  return b.build();
}
