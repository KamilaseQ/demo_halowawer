import * as THREE from "three";
import { arc, boxUV, circle, cylinder, disc, fromArrays, lathe, lobedSphere, rod, roundRect, smoothNormals, softBox, sweep, tint, tube, type Geo, type Vec3T } from "../core/geometry";
import { Kit, type FurnKey } from "../core/kit";
import { bookStack, pendantCable, soft } from "../core/pieces";

/* ==========================================================================
   Builders shared by the rooms of layout B. Everything is built in plan
   metres (X = plan x, Z = plan y, Y up from the level floor) into a Kit, so a
   whole room merges into one draw call per material.
   ========================================================================== */

export const F = "fabric" as const;
export const A = "fabricAccent" as const;
export const W = "cabinetWood" as const;
export const L = "cabinetLacquer" as const;
/** Upholstery reads finer than the texture's real-world scale (fine bouclé / linen weave). */
export const WEAVE = 2.6;
/** Gap between adjacent fronts. */
export const GAP = 0.0016;

export function rng(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

/* ---------- textiles ---------- */

/** Sheer panel with soft vertical folds, hanging in the XY plane at depth z, x0 → x1. */
function sheerPanel(x0: number, x1: number, z: number, top: number, bottom: number, foldEvery = 0.12, depth = 0.04, seed = 1): Geo {
  const n = Math.max(8, Math.round(((x1 - x0) / foldEvery) * 8));
  const P: number[] = [];
  const UV: number[] = [];
  const I: number[] = [];
  const rows = 4;
  const ph = seed * 1.7;
  for (let j = 0; j <= rows; j++) {
    const v = j / rows;
    const y = bottom + (top - bottom) * v;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t;
      // Folds deepen a little toward the hem, irregular amplitude like real linen.
      const amp = depth * (0.75 + 0.25 * Math.sin(t * 7.1 + ph)) * (1.1 - 0.25 * v);
      const fold = Math.sin(((x - x0) * Math.PI * 2) / foldEvery + ph) * amp;
      P.push(x, y, z + fold);
      UV.push(x - x0, y);
    }
  }
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i;
      I.push(a, a + 1, a + n + 2, a, a + n + 2, a + n + 1);
    }
  return fromArrays(P, UV, I);
}

/** Sheer curtain along plan y (garden / street walls), hanging at plan x = `x`. */
export function sheerAlongZ(k: Kit, x: number, z0: number, z1: number, top: number, bottom = 0.012, seed = 1) {
  // Built along X, then turned so X → +Z (yaw −π/2 maps (X, Y, D) to (−D, Y, X)).
  k.add("sheer", sheerPanel(z0, z1, 0, top, bottom, 0.12, 0.04, seed), [x, 0, 0], [0, -Math.PI / 2, 0]);
}

/** Sheer curtain along plan x (gable / party walls), hanging at plan y = `z`. */
export function sheerAlongX(k: Kit, z: number, x0: number, x1: number, top: number, bottom = 0.012, seed = 1) {
  k.add("sheer", sheerPanel(x0, x1, z, top, bottom, 0.12, 0.04, seed));
}

/** Ceiling curtain track (white, recessed look). */
export function trackAlongZ(k: Kit, x: number, z0: number, z1: number, ceiling: number) {
  k.box("ceramicMatte", x - 0.025, x + 0.025, ceiling - 0.03, ceiling, z0, z1, { r: 0.003 });
}
export function trackAlongX(k: Kit, z: number, x0: number, x1: number, ceiling: number) {
  k.box("ceramicMatte", x0, x1, ceiling - 0.03, ceiling, z - 0.025, z + 0.025, { r: 0.003 });
}

/** Low-pile rug in the finish-aware rug slot; top at y ≈ 0.018. */
export function rug(k: Kit, x0: number, x1: number, z0: number, z1: number, key: FurnKey = "rug") {
  k.add(key, softBox(x1 - x0, 0.014, z1 - z0, { r: 0.006, edge: 2, step: 4 }), [(x0 + x1) / 2, 0.011, (z0 + z1) / 2]);
}

/* ---------- storage ---------- */

/**
 * Handleless full-height wardrobe run. Footprint x0–x1 × z0–z1; `front` names the face with the doors.
 * Doors split along the run; a black recessed plinth and a dark shadow gap behind the fronts.
 */
export function wardrobe(k: Kit, x0: number, x1: number, z0: number, z1: number, doors: number, front: "x0" | "x1" | "z0" | "z1", height = 2.4, key: FurnKey = L) {
  const t = 0.02;
  const alongZ = front === "x0" || front === "x1";
  // Carcass behind the door plane.
  const c = { x0: front === "x0" ? x0 + t : x0, x1: front === "x1" ? x1 - t : x1, z0: front === "z0" ? z0 + t : z0, z1: front === "z1" ? z1 - t : z1 };
  const inset = 0.05;
  k.box("black", c.x0 + (front === "x0" ? inset : 0), c.x1 - (front === "x1" ? inset : 0), 0.004, 0.08, c.z0 + (front === "z0" ? inset : 0), c.z1 - (front === "z1" ? inset : 0));
  k.box(key, c.x0, c.x1, 0.08, height, c.z0, c.z1, { r: 0.002 });
  // Door leaves.
  const span = alongZ ? z1 - z0 : x1 - x0;
  const w = span / doors;
  for (let i = 0; i < doors; i++) {
    const a = (alongZ ? z0 : x0) + i * w + GAP;
    const b = (alongZ ? z0 : x0) + (i + 1) * w - GAP;
    if (front === "x0") k.box(key, x0, x0 + t, 0.083, height - 0.003, a, b, { r: 0.0015 });
    if (front === "x1") k.box(key, x1 - t, x1, 0.083, height - 0.003, a, b, { r: 0.0015 });
    if (front === "z0") k.box(key, a, b, 0.083, height - 0.003, z0, z0 + t, { r: 0.0015 });
    if (front === "z1") k.box(key, a, b, 0.083, height - 0.003, z1 - t, z1, { r: 0.0015 });
  }
}

/** Open oak shelving unit against a wall, shelves at `levels`; front faces `front`. Returns shelf tops. */
export function shelving(k: Kit, x0: number, x1: number, z0: number, z1: number, levels: number[], key: FurnKey = W) {
  const t = 0.022;
  const top = levels[levels.length - 1];
  const alongX = x1 - x0 > z1 - z0;
  if (alongX) {
    for (const x of [x0, x1 - t]) k.box(key, x, x + t, 0.004, top + t, z0, z1, { r: 0.002, worldUV: true });
  } else {
    for (const z of [z0, z1 - t]) k.box(key, x0, x1, 0.004, top + t, z, z + t, { r: 0.002, worldUV: true });
  }
  for (const y of levels) {
    if (alongX) k.box(key, x0 + t, x1 - t, y, y + t, z0, z1, { r: 0.002, worldUV: true });
    else k.box(key, x0, x1, y, y + t, z0 + t, z1 - t, { r: 0.002, worldUV: true });
  }
  return levels.map((y) => y + t);
}

/* ---------- beds (local frame: head at −z, centre x = 0, floor y = 0) ---------- */

export type BedOpts = { width: number; length: number; seed?: number; headboard?: number; accent?: boolean; kids?: boolean };

/** Upholstered bed with a soft headboard, linen bedding, pillows and a throw. */
export function bedKit({ width: w, length: l, seed = 1, headboard = 1.1, accent = true, kids = false }: BedOpts): Kit {
  const k = new Kit();
  const firm = { power: 3, wobble: 0.0015, step: 0.1, uvScale: WEAVE };
  const h0 = -l / 2;
  // Floating upholstered platform on a recessed black plinth.
  k.box("black", -w / 2 + 0.15, w / 2 - 0.15, 0.004, 0.07, h0 + 0.2, l / 2 - 0.15);
  soft(k, F, -w / 2 - 0.05, w / 2 + 0.05, 0.065, 0.28, h0, l / 2 + 0.04, { r: 0.05, bulge: { x: 0.006, z: 0.006 }, ...firm, seed });
  // Headboard: one soft panel (kids: low and rounded).
  const hb = kids ? 0.75 : headboard;
  soft(k, F, -w / 2 - 0.06, w / 2 + 0.06, 0.2, hb, h0 - 0.1, h0 + 0.01, { r: kids ? 0.05 : 0.04, bulge: { front: 0.02, top: 0.01 }, ...firm, seed: seed + 1 });
  // Mattress.
  k.box("bedding", -w / 2 + 0.03, w / 2 - 0.03, 0.28, 0.48, h0 + 0.02, l / 2, { r: 0.05, edge: 3, step: 0.25 });
  // Duvet over the lower two thirds, wrinkled, hanging over the sides.
  const dl = l * 0.72;
  k.add("bedding", softBox(w + 0.08, 0.22, dl, { r: 0.07, bulge: { top: 0.03, x: 0.012, z: 0.012 }, power: 2.6, wobble: 0.01, wrinkle: 0.006, step: 0.065, edge: 3, seed: seed + 7 }), [0, 0.44, l / 2 - dl / 2 + 0.03]);
  // Folded top edge.
  k.add("bedding", softBox(w + 0.1, 0.08, 0.17, { r: 0.04, bulge: { top: 0.01 }, wobble: 0.004, step: 0.08, edge: 2, seed: seed + 8 }), [0, 0.54, l / 2 - dl + 0.1]);
  // Pillows leaning on the headboard (two per sleeper on a double bed).
  const pillow = (key: FurnKey, pw: number, ph: number, x: number, y: number, z: number, lean: number, s: number) =>
    k.add(key, softBox(pw, ph, 0.05, { r: 0.018, bulge: { front: 0.08, back: 0.06, top: 0.02, bottom: 0.02, x: 0.02 }, power: 1.7, wobble: 0.009, wrinkle: 0.004, step: 0.06, edge: 2, seed: s, uvScale: WEAVE }), [x, y, z], [-lean, 0, 0]);
  const sleepers = w > 1.2 ? [-w / 4, w / 4] : [0];
  sleepers.forEach((x, i) => {
    pillow("bedding", Math.min(0.7, w / sleepers.length - 0.06), 0.48, x, 0.7, h0 + 0.12, 0.36, seed + 20 + i);
    if (!kids) pillow("bedding", Math.min(0.6, w / sleepers.length - 0.12), 0.38, x, 0.64, h0 + 0.3, 0.5, seed + 30 + i);
  });
  if (accent) {
    const acc = (x: number, s: number) => pillow(A, 0.42, 0.32, x, 0.6, h0 + 0.44, 0.55, s);
    if (w > 1.2) {
      acc(-0.2, seed + 40);
      acc(0.2, seed + 41);
    } else acc(0, seed + 40);
    // Knit throw across the foot.
    k.add(A, softBox(w + 0.14, 0.05, 0.55, { r: 0.025, bulge: { top: 0.01 }, wobble: 0.006, wrinkle: 0.005, step: 0.065, edge: 2, seed: seed + 50, uvScale: WEAVE }), [0, 0.575, l / 2 - 0.42]);
    for (const s of [-1, 1]) k.add(A, softBox(0.03, 0.24, 0.55, { r: 0.012, wobble: 0.004, step: 0.08, edge: 2, seed: seed + 51 + s, uvScale: WEAVE }), [s * (w / 2 + 0.085), 0.47, l / 2 - 0.42]);
  }
  return k;
}

/** Oak nightstand with a drawer line; local origin at its footprint centre, front +z. */
export function nightstand(k: Kit, at: Vec3T, yaw: number, w = 0.46, d = 0.4, h = 0.52) {
  const n = new Kit();
  n.box(W, -w / 2, w / 2, 0.1, h, -d / 2, d / 2, { r: 0.006, edge: 2 });
  n.box("gap", -w / 2 + 0.02, w / 2 - 0.02, h - 0.17, h - 0.166, d / 2 - 0.001, d / 2 + 0.001, { r: 0 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) n.add(W, rod([sx * (w / 2 - 0.04), 0.004, sz * (d / 2 - 0.04)], [sx * (w / 2 - 0.04), 0.1, sz * (d / 2 - 0.04)], 0.016, 0.016, 10));
  k.include(n, at, [0, yaw, 0]);
  return at[1] + h;
}

/** Table lamp: ceramic base and a linen drum shade (glows in the evening). Base at `at`. */
export function tableLamp(k: Kit, at: Vec3T, scale = 1) {
  const s = scale;
  k.add("ceramicMatte", lathe([[0, 0], [0.07 * s, 0], [0.095 * s, 0.05 * s], [0.1 * s, 0.13 * s], [0.07 * s, 0.22 * s], [0.025 * s, 0.26 * s], [0.02 * s, 0.3 * s], [0, 0.3 * s]], { segments: 32 }), at);
  const sh = lathe([[0.15 * s, 0.27 * s], [0.12 * s, 0.47 * s]], { segments: 40 });
  k.add("glowShade", sh, at);
}

/* ---------- small decor ---------- */

/** Candle in a glass, unlit. */
export function candle(k: Kit, at: Vec3T, r = 0.035, h = 0.08) {
  k.add("glassTint", lathe([[r, 0], [r + 0.004, 0.002], [r + 0.004, h], [r, h]], { segments: 24 }), at);
  k.add("paper", cylinder(r - 0.002, h * 0.7, 20), at);
}

/**
 * Dried grasses (bunny-tail / pampas plumes) in a vase opening at `at`; with `twigs`, olive twigs
 * with small silver-green leaves instead.
 */
export function driedStems(k: Kit, at: Vec3T, count = 18, height = 0.55, seed = 3, spread = 0.32, twigs = false) {
  const r = rng(seed);
  const P: number[] = [];
  const C: number[] = [];
  const UV: number[] = [];
  const I: number[] = [];
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2;
    const tilt = 0.08 + r() * spread;
    const len = height * (0.7 + r() * 0.45);
    const top: Vec3T = [at[0] + Math.cos(a) * Math.sin(tilt) * len, at[1] + Math.cos(tilt) * len, at[2] + Math.sin(a) * Math.sin(tilt) * len];
    const mid: Vec3T = [at[0] + Math.cos(a) * Math.sin(tilt) * len * 0.42, at[1] + Math.cos(tilt) * len * 0.52, at[2] + Math.sin(a) * Math.sin(tilt) * len * 0.42];
    const base: Vec3T = [at[0] + Math.cos(a) * 0.008, at[1] - 0.05, at[2] + Math.sin(a) * 0.008];
    k.add("decor", tint(tube([base, mid, top], twigs ? 0.0018 : 0.0012, 6, 4), twigs ? "#6f665b" : "#a48f72"));
    const dir = new THREE.Vector3(top[0] - mid[0], top[1] - mid[1], top[2] - mid[2]).normalize();
    if (!twigs) {
      // Small fluffy plume: an elongated, slightly lobed spindle.
      const plume = lobedSphere(0.011 + r() * 0.006, 5, 0.2, 10, 7).scale(1, 3.2 + r() * 1.2, 1);
      plume.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
      k.add("decor", tint(plume, r() < 0.5 ? "#ece2cf" : "#dccdb2"), [top[0] + dir.x * 0.03, top[1] + dir.y * 0.03, top[2] + dir.z * 0.03]);
      continue;
    }
    // Olive twig: pairs of narrow leaves along the upper half.
    const s0 = new THREE.Vector3(...mid);
    const s1 = new THREE.Vector3(...top);
    for (let j = 0; j < 9; j++) {
      const t = j / 8;
      const p = s0.clone().lerp(s1, t);
      for (const side of [-1, 1]) {
        const out = new THREE.Vector3(Math.cos(a + side * 1.4 + j), 0.35, Math.sin(a + side * 1.4 + j)).normalize().lerp(dir, 0.35).normalize();
        const w = new THREE.Vector3().crossVectors(out, dir).normalize();
        const L = 0.045 + r() * 0.015;
        const o = P.length / 3;
        for (const [u, v] of [
          [0, 0],
          [0.45, 1],
          [1, 0],
          [0.45, -1],
        ] as const) {
          const q = p.clone().addScaledVector(out, u * L).addScaledVector(w, v * 0.006);
          P.push(q.x, q.y, q.z);
          UV.push(u, v);
          const c = new THREE.Color(r() < 0.5 ? "#7e8a6a" : "#93a083");
          C.push(c.r, c.g, c.b);
        }
        I.push(o, o + 1, o + 2, o, o + 2, o + 3);
      }
    }
  }
  if (P.length) {
    const g = fromArrays(P, UV, I);
    g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
    k.add("foliage", g);
  }
}

/* ---------- plants ---------- */

/**
 * Procedural olive tree (the renders' corner tree): twisting trunk, forked branches and ~1300 narrow
 * silver-green leaves, two triangles each. `at` is the soil centre; `h` the height above it.
 */
export function oliveTree(k: Kit, at: Vec3T, h = 1.35, seed = 5, leafCount = 1300) {
  const r = rng(seed);
  const bark = "#6f665b";
  const pts = (list: Vec3T[]) => list;
  // Trunk: two slender stems twisting around each other.
  const twigs: { from: THREE.Vector3; to: THREE.Vector3 }[] = [];
  const trunkTop = at[1] + h * 0.42;
  for (let s = 0; s < 2; s++) {
    const ph = s * Math.PI;
    const path: Vec3T[] = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      path.push([at[0] + Math.cos(ph + t * 2.4) * 0.018 * (1 - t * 0.3), at[1] - 0.03 + (trunkTop - at[1] + 0.03) * t, at[2] + Math.sin(ph + t * 2.4) * 0.018]);
    }
    k.add("decor", tint(sweep(path.map((p) => new THREE.Vector3(...p)), circle(1, 7), { segments: 12, up: [0, 0, 1], scale: (t) => 0.022 - 0.008 * t }), bark));
  }
  // Branches: 4 limbs from the trunk top, each forking twice.
  const crown = new THREE.Vector3(at[0], at[1] + h * 0.74, at[2]);
  const limbs = 4;
  for (let i = 0; i < limbs; i++) {
    const a = (i / limbs) * Math.PI * 2 + r() * 0.8;
    const p0 = new THREE.Vector3(at[0], trunkTop - 0.02, at[2]);
    const p1 = new THREE.Vector3(at[0] + Math.cos(a) * 0.14, trunkTop + h * 0.16, at[2] + Math.sin(a) * 0.14);
    k.add("decor", tint(tube(pts([p0.toArray() as Vec3T, p0.clone().lerp(p1, 0.5).add(new THREE.Vector3(0, 0.02, 0)).toArray() as Vec3T, p1.toArray() as Vec3T]), 0.011, 8, 6), bark));
    for (let j = 0; j < 3; j++) {
      const b = a + (j - 1) * 0.7 + (r() - 0.5) * 0.4;
      const reach = 0.16 + r() * 0.16;
      const p2 = new THREE.Vector3(p1.x + Math.cos(b) * reach, p1.y + 0.12 + r() * h * 0.22, p1.z + Math.sin(b) * reach);
      k.add("decor", tint(tube([p1.toArray() as Vec3T, p1.clone().lerp(p2, 0.5).add(new THREE.Vector3(0, 0.03, 0)).toArray() as Vec3T, p2.toArray() as Vec3T], 0.006, 6, 5), bark));
      twigs.push({ from: p1.clone(), to: p2 });
      // A shorter side shoot.
      const p3 = p2.clone().add(new THREE.Vector3(Math.cos(b + 1.1) * 0.12, 0.08 + r() * 0.1, Math.sin(b + 1.1) * 0.12));
      twigs.push({ from: p1.clone().lerp(p2, 0.6), to: p3 });
    }
  }
  // Leaves: clustered along the outer part of each twig and around the crown.
  const P: number[] = [];
  const N: number[] = [];
  const C: number[] = [];
  const UV: number[] = [];
  const I: number[] = [];
  const tones = ["#76815f", "#8a947a", "#69744f", "#9aa287", "#7e8a6a", "#5f6a48"].map((c) => new THREE.Color(c));
  const dir = new THREE.Vector3();
  const side = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < leafCount; i++) {
    const tw = twigs[Math.floor(r() * twigs.length)];
    const t = 0.35 + r() * 0.75;
    const base = tw.from.clone().lerp(tw.to, Math.min(1, t));
    // Fill the crown volume a little beyond the twig ends.
    base.add(new THREE.Vector3((r() - 0.5) * 0.16, (r() - 0.5) * 0.12, (r() - 0.5) * 0.16));
    const pull = base.clone().sub(crown).multiplyScalar(0.12);
    base.add(pull);
    dir.set(r() - 0.5, r() * 0.9 - 0.15, r() - 0.5).normalize();
    side.crossVectors(dir, up);
    if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
    side.normalize();
    nrm.crossVectors(side, dir).normalize();
    const len = 0.05 + r() * 0.03;
    const wid = 0.0075 + r() * 0.004;
    const fold = 0.0025;
    const v0 = base;
    const v1 = base.clone().addScaledVector(dir, len * 0.45).addScaledVector(side, wid).addScaledVector(nrm, -fold);
    const v2 = base.clone().addScaledVector(dir, len);
    const v3 = base.clone().addScaledVector(dir, len * 0.45).addScaledVector(side, -wid).addScaledVector(nrm, -fold);
    const o = P.length / 3;
    for (const v of [v0, v1, v2, v3]) {
      P.push(v.x, v.y, v.z);
      // Normals lean outward from the crown so the canopy shades as a soft volume.
      const out = v.clone().sub(crown).normalize().multiplyScalar(0.6).add(nrm).normalize();
      N.push(out.x, out.y, out.z);
      UV.push(0, 0);
    }
    const c = tones[Math.floor(r() * tones.length)].clone().multiplyScalar(0.9 + r() * 0.2);
    for (let q = 0; q < 4; q++) C.push(c.r, c.g, c.b);
    I.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
  const leaves = fromArrays(P, UV, I, N);
  leaves.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
  k.add("foliage", leaves);
}

/** Round planter (urn) with soil; `key` sets the pot finish. Base at the floor. Returns the soil height. */
export function urn(k: Kit, x: number, z: number, r = 0.22, h = 0.42, key: FurnKey = "potStone") {
  k.add(
    key,
    lathe(
      [
        [0, 0.004],
        [r * 0.62, 0.004],
        ...arc(r * 0.62, 0.02, 0.016, -Math.PI / 2, 0, 3),
        [r * 0.95, h * 0.45],
        [r, h * 0.72],
        [r * 0.9, h - 0.02],
        ...arc(r * 0.9 - 0.014, h - 0.014, 0.014, 0, Math.PI, 4),
        [r * 0.9 - 0.03, h - 0.06],
      ],
      { segments: 44 },
    ),
    [x, 0, z],
  );
  k.add("soil", disc(r * 0.9 - 0.03, 28).translate(x, h - 0.05, z));
  return h - 0.05;
}

/* ---------- lighting fixtures ---------- */

/** Opal glass globe pendant with a metal cap (s1 / s3). Centre of the globe at `cy`. */
export function globePendant(k: Kit, x: number, z: number, cy: number, r: number, ceiling: number) {
  const prof: [number, number][] = [];
  for (let i = 0; i <= 18; i++) {
    const a = -0.95 + (i / 18) * (Math.PI / 2 + 0.95 - 0.18);
    prof.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  prof.push([0.035, r * Math.sin(Math.PI / 2 - 0.18) + 0.004]);
  k.add("glowShade", lathe(prof, { segments: 56 }), [x, cy, z]);
  // Inner diffuser at the opening.
  k.add("glowPendant", disc(r * Math.cos(-0.95) - 0.006, 40, true).translate(x, cy + r * Math.sin(-0.95) + 0.01, z));
  k.add("metal", lathe([[0.03, 0], [0.05, 0.012], [0.052, 0.05], [0.014, 0.075], [0, 0.075]], { segments: 32 }).translate(x, cy + r * 0.96, z));
  pendantCable(k, x, z, cy + r * 0.96 + 0.075, ceiling);
}

/** Rice-paper lantern (Akari-like): ribbed sphere, open at both poles (s4). */
export function paperLantern(k: Kit, x: number, z: number, cy: number, r: number, ceiling: number, ribs = 22, squash = 0.92) {
  const prof: [number, number][] = [];
  const n = ribs * 2;
  for (let i = 0; i <= n; i++) {
    const a = -1.25 + (i / n) * 2.5;
    // Alternating ribs and shallow paper dips between them.
    const rr = r * Math.cos(a) * (i % 2 ? 0.985 : 1);
    prof.push([rr, r * squash * Math.sin(a)]);
  }
  k.add("glowShade", lathe(prof, { segments: 40 }), [x, cy, z]);
  // Wire ring at the top opening and a black cord.
  const topY = cy + r * squash * Math.sin(1.25);
  k.add("metal", new THREE.TorusGeometry(r * Math.cos(1.25), 0.003, 6, 40).rotateX(Math.PI / 2).translate(x, topY, z));
  k.add("metal", cylinder(0.018, 0.04, 16).translate(x, topY - 0.01, z));
  pendantCable(k, x, z, topY + 0.03, ceiling);
}

/** Pleated fabric bowl ceiling lamp hanging from a ceiling at `ceiling`. */
export function pleatedBowl(k: Kit, x: number, z: number, ceiling: number, r = 0.3, depth = 0.17) {
  const prof: [number, number][] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    prof.push([r * Math.sin((t * Math.PI) / 2) + 0.001, ceiling - 0.02 - depth * Math.cos((t * Math.PI) / 2)]);
  }
  const g = lathe(prof, { segments: 96 });
  const pos = g.getAttribute("position");
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const phi = Math.atan2(p.x, p.z);
    const s = 1 + 0.045 * Math.abs(Math.cos(phi * 8));
    pos.setXYZ(i, p.x * s, p.y, p.z * s);
  }
  smoothNormals(g);
  k.add("glowShade", g.translate(x, 0, z));
  k.add("metal", cylinder(0.05, 0.02, 24).translate(x, ceiling - 0.02, z));
}

/** Small opal sphere pendant (halls, bathrooms). */
export function smallGlobe(k: Kit, x: number, z: number, cy: number, r: number, ceiling: number) {
  k.add("glowShade", lobedSphere(r, 0, 0, 32, 20), [x, cy, z]);
  k.add("metal", cylinder(0.025, 0.04, 20).translate(x, cy + r - 0.01, z));
  pendantCable(k, x, z, cy + r + 0.03, ceiling);
}

/** Linear black pendant with an opal strip underneath, along x (s3 dining). */
export function linearPendant(k: Kit, x0: number, x1: number, z: number, bottom: number, ceiling: number) {
  k.box("metal", x0, x1, bottom + 0.004, bottom + 0.05, z - 0.028, z + 0.028, { r: 0.006, edge: 2 });
  k.box("glowLamp", x0 + 0.02, x1 - 0.02, bottom, bottom + 0.006, z - 0.02, z + 0.02, { r: 0.002 });
  // Ceiling canopy bar and two cables.
  k.box("metal", x0 + 0.25, x1 - 0.25, ceiling - 0.02, ceiling, z - 0.025, z + 0.025, { r: 0.004 });
  for (const x of [x0 + 0.3, x1 - 0.3]) k.add("cable", rod([x, bottom + 0.05, z], [x, ceiling - 0.02, z], 0.0013, 0.0013, 5, false));
}

/* ---------- seating helpers ---------- */

/** Bends a geometry around the y axis: z += k·x² (shell chair backs, curved sofas). */
export function bendZ(g: Geo, kz: number): Geo {
  const pos = g.getAttribute("position");
  for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) + kz * pos.getX(i) * pos.getX(i));
  g.deleteAttribute("normal");
  smoothNormals(g);
  return g;
}

/** Simple office / desk chair: upholstered seat and back on a five-star base. Local: faces +z. */
export function deskChairKit(): Kit {
  const k = new Kit();
  k.add(A, softBox(0.46, 0.07, 0.44, { r: 0.03, bulge: { top: 0.01 }, step: 0.12, edge: 2, uvScale: WEAVE }), [0, 0.47, 0.02]);
  k.add(A, bendZ(softBox(0.44, 0.42, 0.05, { r: 0.022, bulge: { front: 0.01 }, step: 0.06, edge: 2, uvScale: WEAVE }), 0.6), [0, 0.8, -0.22], [-0.12, 0, 0]);
  k.add("black", rod([0, 0.6, -0.2], [0, 0.44, -0.18], 0.012, 0.012, 8));
  k.add("black", rod([0, 0.1, 0], [0, 0.44, 0], 0.022, 0.022, 14));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    k.add("black", rod([0, 0.09, 0], [Math.sin(a) * 0.3, 0.05, Math.cos(a) * 0.3], 0.014, 0.01, 8));
    k.add("black", lobedSphere(0.025, 0, 0, 10, 8).translate(Math.sin(a) * 0.3, 0.025, Math.cos(a) * 0.3));
  }
  return k;
}

/** Bookshelf decor: rows of books on a shelf at height y, along x. */
export function shelfBooks(k: Kit, x0: number, x1: number, y: number, z: number, seed = 1) {
  const r = rng(seed);
  const tones = ["#d8d0c4", "#3f3a35", "#a08f7b", "#c9bcaa", "#6d5f52", "#e4ddd2", "#8b8378", "#2b2926"];
  let x = x0;
  while (x < x1 - 0.05) {
    if (r() < 0.16) {
      x += 0.08 + r() * 0.1;
      continue;
    }
    const t = 0.02 + r() * 0.025;
    const hh = 0.19 + r() * 0.08;
    const d = 0.15 + r() * 0.05;
    k.add("decor", tint(boxUV(softBox(t, hh, d, { r: 0.002, edge: 1, step: 10 })), tones[Math.floor(r() * tones.length)]), [x + t / 2, y + hh / 2, z]);
    x += t + 0.002;
  }
}

/** A short stack of books lying flat (coffee tables, consoles). */
export function books(k: Kit, at: Vec3T, yaw = 0.2) {
  return bookStack(k, at, [
    [0.27, 0.032, 0.21, "#d6cdbf", yaw],
    [0.24, 0.028, 0.18, "#2b2926", yaw - 0.1],
    [0.21, 0.022, 0.16, "#b7a58f", yaw + 0.12],
  ]);
}

/* ---------- procedural stand-ins for the GLB decor (no downloads, a few hundred triangles each) ---------- */

export type VaseShape = "round" | "bottle" | "tall" | "bud";

const VASES: Record<VaseShape, [number, number][]> = {
  // [radius, height] outer profile, then the lip and a short inner wall.
  round: [[0, 0.003], [0.06, 0.003], [0.085, 0.03], [0.105, 0.1], [0.1, 0.17], [0.07, 0.235], [0.045, 0.27], [0.047, 0.3], [0.04, 0.3], [0.038, 0.26]],
  bottle: [[0, 0.003], [0.055, 0.003], [0.07, 0.03], [0.075, 0.16], [0.06, 0.24], [0.026, 0.29], [0.022, 0.38], [0.028, 0.4], [0.02, 0.4], [0.018, 0.36]],
  tall: [[0, 0.003], [0.05, 0.003], [0.058, 0.02], [0.062, 0.2], [0.058, 0.36], [0.05, 0.4], [0.044, 0.4], [0.044, 0.36]],
  bud: [[0, 0.003], [0.035, 0.003], [0.05, 0.03], [0.052, 0.07], [0.03, 0.12], [0.014, 0.15], [0.016, 0.165], [0.011, 0.165], [0.009, 0.13]],
};

/** Matte ceramic vase. Returns the height of its opening. */
export function vase(k: Kit, at: Vec3T, shape: VaseShape = "round", scale = 1, key: FurnKey = "ceramicMatte") {
  const prof = VASES[shape].map(([r, y]) => [r * scale, y * scale] as [number, number]);
  k.add(key, lathe(prof, { segments: 32 }), at);
  return at[1] + prof[prof.length - 3][1];
}

/** Turned wooden bowl, open top. */
export function woodBowl(k: Kit, at: Vec3T, r = 0.15, key: FurnKey = W) {
  const h = r * 0.42;
  k.add(key, lathe([[0, 0.002], [r * 0.4, 0.002], [r * 0.45, 0.012], [r * 0.85, h * 0.45], [r, h], [r - 0.012, h + 0.002], [r - 0.016, h - 0.004], [r * 0.8, h * 0.55], [r * 0.4, 0.016], [0, 0.014]], { segments: 40 }), at);
}

/** A few pears (in a bowl or on a board). */
export function pears(k: Kit, at: Vec3T, n = 4, seed = 2) {
  const r = rng(seed);
  const prof: [number, number][] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    // Pear silhouette: round bottom, waist, narrow top.
    const rad = 0.034 * Math.sin(Math.PI * Math.min(1, t * 1.05)) * (1 - 0.42 * Math.max(0, t - 0.45)) + 0.004 * (t > 0 && t < 1 ? 1 : 0);
    prof.push([Math.max(0, rad), t * 0.1]);
  }
  prof[prof.length - 1] = [0, 0.1];
  const tones = ["#c8b155", "#b9a24c", "#d1bf6e", "#a99a52"];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r();
    const d = i === n - 1 ? 0 : 0.045;
    const g = tint(lathe(prof, { segments: 16 }), tones[i % tones.length]);
    const tilt = i === n - 1 ? 0 : 0.5;
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt)));
    k.add("decor", g, [at[0] + Math.cos(a) * d, at[1] + (i === n - 1 ? 0.03 : 0.005), at[2] + Math.sin(a) * d]);
  }
}

/**
 * Big-leaf house plant (alocasia / philodendron-like): arching stems from the soil, each ending in a
 * drooping heart-shaped blade (a 7×5 grid, slight V fold), dark greens with a paler midrib.
 * `at` is the soil centre.
 */
export function leafyPlant(k: Kit, at: Vec3T, o: { height?: number; spread?: number; leaves?: number; leafLen?: number; seed?: number; trunk?: number } = {}) {
  const { height = 0.75, spread = 0.32, leaves = 11, leafLen = 0.3, seed = 1, trunk = 0 } = o;
  const r = rng(seed);
  const P: number[] = [];
  const C: number[] = [];
  const UV: number[] = [];
  const I: number[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const base = new THREE.Vector3(...at);
  if (trunk > 0) {
    // Woody trunk for tree-like plants (fiddle-leaf fig).
    k.add("decor", tint(tube([[at[0], at[1] - 0.04, at[2]], [at[0] + 0.02, at[1] + trunk * 0.5, at[2] - 0.01], [at[0] - 0.01, at[1] + trunk, at[2] + 0.01]], 0.014, 8, 6), "#6a5a47"));
  }
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < leaves; i++) {
    const a = i * golden + r() * 0.5;
    const s = spread * (0.45 + r() * 0.55);
    const hh = height * (0.55 + r() * 0.45);
    const stemBase = trunk > 0 ? base.clone().add(new THREE.Vector3(0, trunk * (0.45 + 0.55 * (i / leaves)), 0)) : base.clone();
    const tip = stemBase.clone().add(new THREE.Vector3(Math.cos(a) * s, trunk > 0 ? 0.05 + r() * 0.12 : hh, Math.sin(a) * s));
    const mid = stemBase.clone().lerp(tip, 0.5).add(new THREE.Vector3(-Math.cos(a) * s * 0.18, (trunk > 0 ? 0.04 : hh * 0.18), -Math.sin(a) * s * 0.18));
    k.add("decor", tint(tube([stemBase.toArray() as Vec3T, mid.toArray() as Vec3T, tip.toArray() as Vec3T], trunk > 0 ? 0.004 : 0.0055, 6, 4), "#5f6b3c"));
    // Blade: hangs from the stem tip, pointing outward and down.
    const d = new THREE.Vector3(Math.cos(a), -0.35 - r() * 0.45, Math.sin(a)).normalize();
    const w = new THREE.Vector3().crossVectors(d, up).normalize();
    const n = new THREE.Vector3().crossVectors(w, d).normalize();
    const len = leafLen * (0.75 + r() * 0.4);
    const green = new THREE.Color().setHSL(0.24 + r() * 0.05, 0.42 + r() * 0.15, 0.2 + r() * 0.08);
    const rib = green.clone().lerp(new THREE.Color("#a6b37e"), 0.45);
    const o0 = P.length / 3;
    const nu = 7, nv = 5;
    for (let iu = 0; iu < nu; iu++) {
      const u = iu / (nu - 1);
      // Heart shape: lobes behind the stem joint, widest a third along, pointed tip.
      const wid = len * 0.46 * Math.sin(Math.PI * Math.pow(u, 0.62)) * (u < 0.08 ? 0.7 : 1);
      const along = u * len - len * 0.12;
      for (let iv = 0; iv < nv; iv++) {
        const v = (iv / (nv - 1)) * 2 - 1;
        const p = tip
          .clone()
          .addScaledVector(d, along)
          .addScaledVector(w, v * wid)
          // Droop toward the tip, cup toward the edges.
          .addScaledVector(n, -len * 0.28 * u * u + len * 0.07 * Math.abs(v) * Math.sin(Math.PI * u));
        P.push(p.x, p.y, p.z);
        UV.push(u, v);
        const c = Math.abs(v) < 0.01 ? rib : green;
        C.push(c.r, c.g, c.b);
      }
    }
    for (let iu = 0; iu < nu - 1; iu++)
      for (let iv = 0; iv < nv - 1; iv++) {
        const q = o0 + iu * nv + iv;
        I.push(q, q + nv, q + nv + 1, q, q + nv + 1, q + 1);
      }
  }
  const g = fromArrays(P, UV, I);
  g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
  k.add("foliage", g);
}

/** Ornamental grass tuft (miscanthus-like): thin arching blades, a few pale plumes. `at` = soil centre. */
export function grassTuft(k: Kit, at: Vec3T, h = 0.7, blades = 110, seed = 5) {
  const r = rng(seed);
  const P: number[] = [];
  const C: number[] = [];
  const UV: number[] = [];
  const I: number[] = [];
  for (let i = 0; i < blades; i++) {
    const a = r() * Math.PI * 2;
    const lean = 0.15 + r() * 0.5;
    const len = h * (0.6 + r() * 0.5);
    const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const side = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
    const root = new THREE.Vector3(at[0] + out.x * r() * 0.06, at[1], at[2] + out.z * r() * 0.06);
    const col = new THREE.Color().setHSL(0.2 + r() * 0.06, 0.32 + r() * 0.15, 0.32 + r() * 0.16);
    const o = P.length / 3;
    const seg = 4;
    for (let s = 0; s <= seg; s++) {
      const t = s / seg;
      // Rises, then arches over (outward and down at the tip).
      const p = root.clone().addScaledVector(out, len * lean * t * t).add(new THREE.Vector3(0, len * (t - 0.35 * t * t * lean), 0));
      const w = 0.006 * (1 - t * 0.85);
      for (const sgn of [-1, 1]) {
        const q = p.clone().addScaledVector(side, sgn * w);
        P.push(q.x, q.y, q.z);
        UV.push(t, sgn);
        C.push(col.r, col.g, col.b);
      }
    }
    for (let s = 0; s < seg; s++) {
      const q = o + s * 2;
      I.push(q, q + 1, q + 3, q, q + 3, q + 2);
    }
  }
  const g = fromArrays(P, UV, I);
  g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
  k.add("foliage", g);
  // A few slim, feathery plumes above the foliage.
  for (let i = 0; i < 4; i++) {
    const a = r() * Math.PI * 2;
    const top: Vec3T = [at[0] + Math.cos(a) * 0.14, at[1] + h * (1.0 + r() * 0.15), at[2] + Math.sin(a) * 0.14];
    k.add("decor", tint(tube([[at[0], at[1], at[2]], [(at[0] + top[0]) / 2, (at[1] + top[1]) / 2, (at[2] + top[2]) / 2], top], 0.0012, 5, 4), "#a8956f"));
    const plume = lobedSphere(0.01, 5, 0.25, 8, 6).scale(1, 5, 1);
    k.add("decor", tint(plume, "#e3d6bb"), [top[0], top[1] + 0.04, top[2]]);
  }
}

/** Pot with soil for the procedural plants; returns the soil height. */
export function pot(k: Kit, x: number, z: number, r = 0.16, h = 0.3, key: FurnKey = "potWhite", y = 0) {
  k.add(key, lathe([[0, 0.003], [r * 0.82, 0.003], ...arc(r * 0.82, 0.016, 0.013, -Math.PI / 2, 0, 3), [r, h - 0.01], ...arc(r - 0.01, h - 0.01, 0.01, 0, Math.PI, 4), [r - 0.025, h - 0.05]], { segments: 36 }), [x, y, z]);
  k.add("soil", disc(r - 0.025, 24).translate(x, y + h - 0.04, z));
  return y + h - 0.04;
}

/** Herb pot for the kitchen counter: small terracotta pot with a dense cluster of small leaves. */
export function herbPot(k: Kit, at: Vec3T, seed = 9) {
  const soil = pot(k, at[0], at[2], 0.065, 0.11, "potClay", at[1]);
  leafyPlant(k, [at[0], soil, at[2]], { height: 0.14, spread: 0.07, leaves: 22, leafLen: 0.05, seed });
}

/** Square planter box (fibre cement) with soil; returns the soil height. */
export function planterBox(k: Kit, x: number, z: number, half = 0.26, h = 0.5, y = 0) {
  k.add("potStone", softBox(half * 2, h, half * 2, { r: 0.02, edge: 2, step: 0.4, sharp: { bottom: true } }), [x, y + h / 2, z]);
  k.add("soil", new THREE.PlaneGeometry(half * 2 - 0.05, half * 2 - 0.05).rotateX(-Math.PI / 2), [x, y + h - 0.03, z]);
  return y + h - 0.03;
}

/**
 * Lounge armchair. "oak": oak frame with linen cushions (Scandinavian); "steel": brushed steel frame with
 * black leather cushions. Local frame: faces +z, floor y = 0.
 */
export function loungeChairKit(kind: "oak" | "steel"): Kit {
  const k = new Kit();
  const frame: FurnKey = kind === "oak" ? W : "steel";
  const pad: FurnKey = kind === "oak" ? A : "leather";
  const r = kind === "oak" ? 0.018 : 0.011;
  for (const s of [-1, 1]) {
    k.add(frame, rod([s * 0.34, 0.004, 0.32], [s * 0.34, 0.56, 0.3], r, r, 10));
    k.add(frame, rod([s * 0.34, 0.004, -0.33], [s * 0.34, 0.7, -0.4], r, r, 10));
    k.add(frame, rod([s * 0.34, 0.56, 0.34], [s * 0.34, 0.58, -0.36], r * 1.1, r * 1.1, 10));
    k.add(frame, rod([s * 0.34, 0.22, 0.3], [s * 0.34, 0.22, -0.33], r * 0.8, r * 0.8, 8));
  }
  k.add(frame, rod([-0.34, 0.22, 0.3], [0.34, 0.22, 0.3], r * 0.8, r * 0.8, 8));
  k.add(frame, rod([-0.34, 0.24, -0.33], [0.34, 0.24, -0.33], r * 0.8, r * 0.8, 8));
  const quilt = { power: 3, wobble: 0.002, step: 0.07, edge: 2, uvScale: WEAVE };
  k.add(pad, softBox(0.64, 0.13, 0.6, { r: 0.05, bulge: { top: 0.02, z: 0.01 }, ...quilt, seed: 150 }), [0, 0.3, 0.0]);
  k.add(pad, softBox(0.62, 0.5, 0.12, { r: 0.05, bulge: { front: 0.025 }, ...quilt, seed: 151 }), [0, 0.6, -0.3], [-0.28, 0, 0]);
  return k;
}

/** Small round oak side table with a lower shelf. */
export function sideTable(k: Kit, x: number, z: number, r = 0.24, h = 0.5) {
  k.add(W, boxUV(lathe([[0, h - 0.025], [r - 0.006, h - 0.025], [r, h - 0.019], [r, h - 0.006], [r - 0.006, h], [0, h]], { segments: 40 })), [x, 0, z]);
  k.add(W, boxUV(lathe([[0, 0.17], [r - 0.03, 0.17], [r - 0.03, 0.19], [0, 0.19]], { segments: 36 })), [x, 0, z]);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    k.add(W, rod([x + Math.cos(a) * (r - 0.04), 0.004, z + Math.sin(a) * (r - 0.04)], [x + Math.cos(a) * (r - 0.04), h - 0.025, z + Math.sin(a) * (r - 0.04)], 0.014, 0.014, 8));
  }
}

/** Small standing photo frame on a desk or shelf, leaning back; faces local +z turned by `yaw`. */
export function standingFrame(k: Kit, at: Vec3T, yaw: number, w = 0.15, h = 0.2) {
  const f = new Kit();
  f.box("black", -w / 2, w / 2, 0, h, -0.008, 0.008, { r: 0.002 });
  f.add("art", new THREE.PlaneGeometry(w - 0.03, h - 0.03).translate(0, h / 2, 0.0085));
  k.include(f, at, [-0.12, yaw, 0]);
}

export { roundRect, circle };
