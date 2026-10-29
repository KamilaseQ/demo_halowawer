/* ==========================================================================
   Procedural cat (British Shorthair, blue coat, copper eyes). The body is a
   sculpted signed-distance field (ellipsoids and round cones, smooth union)
   meshed once with surface nets, so legs, neck and tail grow out of the body
   without seams. Skin weights come from the same primitives. Ears and eyes
   are small separate parts on their own bones (twitches, blinks).
   Cat space: metres, +z forward (nose), +y up, x = cat's left, ground y = 0.
   Every bone is bound with identity rotation, so a bone's local +z, +y, +x
   are the cat's forward, up and left in the bind pose.
   ========================================================================== */

export type V3 = [number, number, number];

type BoneDef = { name: string; parent: string | null; at: V3 };

const side = (s: 1 | -1, name: string) => `${name}${s > 0 ? "L" : "R"}`;

/** Tail: 8 segments of 3.4 cm, straight back and slightly down in the bind pose. */
export const TAIL_SEGMENTS = 8;
const TAIL_BASE: V3 = [0, 0.215, -0.205];
const TAIL_DIR: V3 = [0, -0.36, -0.933];
const TAIL_STEP = 0.034;
const tailAt = (i: number): V3 => [0, TAIL_BASE[1] + TAIL_DIR[1] * TAIL_STEP * i, TAIL_BASE[2] + TAIL_DIR[2] * TAIL_STEP * i];

function boneDefs(): BoneDef[] {
  const out: BoneDef[] = [
    { name: "root", parent: null, at: [0, 0, 0] },
    { name: "pelvis", parent: "root", at: [0, 0.205, -0.115] },
    { name: "spine", parent: "pelvis", at: [0, 0.212, -0.02] },
    { name: "chest", parent: "spine", at: [0, 0.215, 0.075] },
    { name: "neck", parent: "chest", at: [0, 0.235, 0.145] },
    { name: "head", parent: "neck", at: [0, 0.29, 0.195] },
  ];
  for (const s of [1, -1] as const) {
    out.push(
      { name: side(s, "ear"), parent: "head", at: [s * 0.031, 0.348, 0.21] },
      { name: side(s, "eye"), parent: "head", at: [s * 0.0215, 0.3165, 0.2585] },
      { name: side(s, "shoulder"), parent: "chest", at: [s * 0.042, 0.185, 0.108] },
      { name: side(s, "elbow"), parent: side(s, "shoulder"), at: [s * 0.045, 0.125, 0.072] },
      { name: side(s, "wrist"), parent: side(s, "elbow"), at: [s * 0.043, 0.036, 0.088] },
      { name: side(s, "ftoe"), parent: side(s, "wrist"), at: [s * 0.043, 0.012, 0.125] },
      { name: side(s, "hip"), parent: "pelvis", at: [s * 0.045, 0.19, -0.125] },
      { name: side(s, "knee"), parent: side(s, "hip"), at: [s * 0.05, 0.115, -0.08] },
      { name: side(s, "hock"), parent: side(s, "knee"), at: [s * 0.045, 0.062, -0.175] },
      { name: side(s, "hpaw"), parent: side(s, "hock"), at: [s * 0.045, 0.018, -0.158] },
      { name: side(s, "htoe"), parent: side(s, "hpaw"), at: [s * 0.045, 0.012, -0.128] },
    );
  }
  for (let i = 0; i <= TAIL_SEGMENTS; i++) out.push({ name: `tail${i}`, parent: i === 0 ? "pelvis" : `tail${i - 1}`, at: tailAt(i) });
  return out;
}

export const BONE_DEFS = boneDefs();
const BONE_INDEX = new Map(BONE_DEFS.map((b, i) => [b.name, i]));
const bi = (name: string) => {
  const i = BONE_INDEX.get(name);
  if (i === undefined) throw new Error(`cat bone ${name}`);
  return i;
};
export const boneAt = (name: string) => BONE_DEFS[bi(name)].at;

/* ---------- signed distance primitives ---------- */

type Prim = {
  /** Bounding box of the shape, expanded by its blend and skin radii. */
  box: [number, number, number, number, number, number];
  /** Smooth-union radius. */
  k: number;
  /** Skin-weight falloff, metres beyond the nearest primitive. */
  skin: number;
  /** Bone weights; cones may blend toward the bones at their ends. */
  bones: [number, number][];
  start?: number;
  end?: number;
  subtract?: boolean;
  dist: (x: number, y: number, z: number) => number;
  /** 0–1 along a cone's axis (ellipsoids: 0.5). */
  along: (x: number, y: number, z: number) => number;
};

/** Margin beyond the blend and skin radii (a few voxels: the band the mesher evaluates). */
const EXPAND = 0.008;

function ellipsoid(c: V3, r: V3, bones: [string, number][], k: number, skin = k * 1.4): Prim {
  const [cx, cy, cz] = c;
  const [rx, ry, rz] = r;
  const e = Math.max(rx, ry, rz) + Math.max(k, skin) + EXPAND;
  return {
    box: [cx - e, cy - e, cz - e, cx + e, cy + e, cz + e],
    k,
    skin,
    bones: bones.map(([n, w]) => [bi(n), w]),
    // Inigo Quilez's ellipsoid bound: exact on the surface, close nearby.
    dist: (x, y, z) => {
      const px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz;
      const k0 = Math.sqrt(px * px + py * py + pz * pz);
      const qx = px / rx, qy = py / ry, qz = pz / rz;
      const k1 = Math.sqrt(qx * qx + qy * qy + qz * qz);
      return k1 < 1e-9 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
    },
    along: () => 0.5,
  };
}

/** Round cone between two points (exact SDF, Inigo Quilez). */
function cone(a: V3, b: V3, ra: number, rb: number, bone: string, k: number, o: { start?: string; end?: string; skin?: number } = {}): Prim {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = ra - rb;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const skin = o.skin ?? k * 1.4;
  const e = Math.max(ra, rb) + Math.max(k, skin) + EXPAND;
  const bones: [number, number][] = [[bi(bone), 1]];
  return {
    box: [Math.min(a[0], b[0]) - e, Math.min(a[1], b[1]) - e, Math.min(a[2], b[2]) - e, Math.max(a[0], b[0]) + e, Math.max(a[1], b[1]) + e, Math.max(a[2], b[2]) + e],
    k,
    skin,
    bones,
    start: o.start ? bi(o.start) : undefined,
    end: o.end ? bi(o.end) : undefined,
    dist: (x, y, z) => {
      const pax = x - a[0], pay = y - a[1], paz = z - a[2];
      const yy = pax * bax + pay * bay + paz * baz;
      const zz = yy - l2;
      const xvx = pax * l2 - bax * yy, xvy = pay * l2 - bay * yy, xvz = paz * l2 - baz * yy;
      const x2 = xvx * xvx + xvy * xvy + xvz * xvz;
      const y2 = yy * yy * l2;
      const z2 = zz * zz * l2;
      const kk = Math.sign(rr) * rr * rr * x2;
      if (Math.sign(zz) * a2 * z2 > kk) return Math.sqrt(x2 + z2) * il2 - rb;
      if (Math.sign(yy) * a2 * y2 < kk) return Math.sqrt(x2 + y2) * il2 - ra;
      return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - ra;
    },
    along: (x, y, z) => ((x - a[0]) * bax + (y - a[1]) * bay + (z - a[2]) * baz) * il2,
  };
}

function hollow(c: V3, r: number, k: number): Prim {
  const p = ellipsoid(c, [r, r, r], [["head", 1]], k);
  return { ...p, subtract: true };
}

const mirror = (s: 1 | -1, p: V3): V3 => [s * p[0], p[1], p[2]];

/** The sculpt: a compact, round-faced, plush shorthair. */
function primitives(): Prim[] {
  const P: Prim[] = [];
  // Torso: deep chest, no waist (cobby), round rump.
  P.push(ellipsoid([0, 0.205, 0.065], [0.066, 0.086, 0.088], [["chest", 1]], 0.03));
  P.push(ellipsoid([0, 0.198, -0.03], [0.068, 0.08, 0.1], [["spine", 1]], 0.035));
  P.push(ellipsoid([0, 0.205, -0.13], [0.066, 0.08, 0.085], [["pelvis", 1]], 0.035));
  P.push(ellipsoid([0, 0.2, -0.185], [0.056, 0.066, 0.05], [["pelvis", 1]], 0.03));
  P.push(ellipsoid([0, 0.18, 0.12], [0.05, 0.062, 0.05], [["chest", 1]], 0.025));
  // Thick neck into the back of the skull.
  P.push(cone([0, 0.235, 0.12], [0, 0.28, 0.19], 0.052, 0.044, "neck", 0.03, { start: "chest", end: "head" }));

  for (const s of [1, -1] as const) {
    const S = (n: string) => side(s, n);
    const at = (n: string) => boneAt(S(n));
    // Shoulder blade under the fur, half on the chest.
    P.push(ellipsoid(mirror(s, [0.042, 0.2, 0.095]), [0.03, 0.06, 0.045], [["chest", 0.6], [S("shoulder"), 0.4]], 0.02));
    // Front leg: upper arm, forearm, round paw.
    P.push(cone(at("shoulder"), at("elbow"), 0.03, 0.023, S("shoulder"), 0.02, { end: S("elbow") }));
    P.push(cone(at("elbow"), at("wrist"), 0.021, 0.0145, S("elbow"), 0.012, { end: S("wrist") }));
    P.push(cone(at("wrist"), mirror(s, [0.043, 0.02, 0.1]), 0.0145, 0.016, S("wrist"), 0.01));
    P.push(ellipsoid(mirror(s, [0.043, 0.016, 0.103]), [0.0185, 0.0155, 0.026], [[S("wrist"), 1]], 0.012));
    // Hind leg: heavy haunch, thigh, shin, metatarsus, paw.
    P.push(ellipsoid(mirror(s, [0.046, 0.16, -0.115]), [0.036, 0.068, 0.06], [[S("hip"), 0.7], ["pelvis", 0.3]], 0.025));
    P.push(cone(at("hip"), at("knee"), 0.04, 0.028, S("hip"), 0.02, { end: S("knee") }));
    P.push(cone(at("knee"), at("hock"), 0.024, 0.0135, S("knee"), 0.014, { end: S("hock") }));
    P.push(cone(at("hock"), at("hpaw"), 0.013, 0.0135, S("hock"), 0.01, { end: S("hpaw") }));
    P.push(ellipsoid(mirror(s, [0.045, 0.0155, -0.147]), [0.0175, 0.015, 0.025], [[S("hpaw"), 0.75], [S("hock"), 0.25]], 0.012));
  }

  // Tail: thick and evenly tapered to a round tip.
  for (let i = 0; i < TAIL_SEGMENTS; i++) {
    const r0 = 0.021 - (0.006 * i) / TAIL_SEGMENTS;
    const r1 = 0.021 - (0.006 * (i + 1)) / TAIL_SEGMENTS;
    P.push(cone(tailAt(i), tailAt(i + 1), r0, r1, `tail${i}`, i === 0 ? 0.025 : 0.008, { end: `tail${i + 1}`, start: i === 0 ? "pelvis" : undefined, skin: 0.012 }));
  }

  // Head: round skull, full cheeks, short broad muzzle.
  P.push(ellipsoid([0, 0.318, 0.222], [0.05, 0.046, 0.048], [["head", 1]], 0.02));
  for (const s of [1, -1] as const) {
    P.push(ellipsoid(mirror(s, [0.027, 0.299, 0.24]), [0.033, 0.029, 0.033], [["head", 1]], 0.015));
    P.push(ellipsoid(mirror(s, [0.0105, 0.2955, 0.2715]), [0.0135, 0.0115, 0.0105], [["head", 1]], 0.006));
  }
  P.push(ellipsoid([0, 0.296, 0.258], [0.025, 0.02, 0.022], [["head", 1]], 0.012));
  P.push(ellipsoid([0, 0.282, 0.258], [0.014, 0.01, 0.013], [["head", 1]], 0.008));
  P.push(ellipsoid([0, 0.31, 0.262], [0.012, 0.011, 0.014], [["head", 1]], 0.012));
  // Shallow sockets the eyes sit in.
  for (const s of [1, -1] as const) P.push(hollow(boneAt(side(s, "eye")), 0.0112, 0.004));
  return P;
}

/* ---------- field ---------- */

function smin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

function smax(a: number, b: number, k: number) {
  return -smin(-a, -b, k);
}

const FAR = 1;

const inBox = (p: Prim, x: number, y: number, z: number) => x >= p.box[0] && y >= p.box[1] && z >= p.box[2] && x <= p.box[3] && y <= p.box[4] && z <= p.box[5];

/** Primitives bucketed in 1 cm slabs along the body (z), so a sample only tests its neighbours. */
function slabs(prims: Prim[]) {
  const z0 = Math.min(...prims.map((p) => p.box[2]));
  const z1 = Math.max(...prims.map((p) => p.box[5]));
  const step = 0.01;
  const count = Math.ceil((z1 - z0) / step) + 1;
  const lists: Prim[][] = Array.from({ length: count }, (_, i) => prims.filter((p) => p.box[5] >= z0 + i * step && p.box[2] <= z0 + (i + 1) * step));
  return (z: number) => lists[Math.max(0, Math.min(count - 1, Math.floor((z - z0) / step)))];
}

function field(prims: Prim[]) {
  const add = slabs(prims.filter((p) => !p.subtract));
  const sub = slabs(prims.filter((p) => p.subtract));
  return (x: number, y: number, z: number) => {
    let d = FAR;
    for (const p of add(z)) if (inBox(p, x, y, z)) d = smin(d, p.dist(x, y, z), p.k);
    for (const p of sub(z)) if (inBox(p, x, y, z)) d = smax(d, -p.dist(x, y, z), p.k);
    return d;
  };
}

/* ---------- surface nets ---------- */

type Mesh = { positions: number[]; normals: number[]; indices: number[] };

/**
 * Meshes the zero level of `f` on a grid of step `h`. Only a narrow band around the surface is
 * evaluated: a coarse pass (3h) finds the cells the surface can pass through.
 */
function surfaceNets(f: (x: number, y: number, z: number) => number, lo: V3, hi: V3, h: number): Mesh {
  const C = 3;
  const H = h * C;
  const cn = [0, 1, 2].map((a) => Math.ceil((hi[a] - lo[a]) / H) + 1);
  const n = cn.map((c) => (c - 1) * C + 1);
  const coarse = new Float32Array(cn[0] * cn[1] * cn[2]);
  for (let k = 0; k < cn[2]; k++)
    for (let j = 0; j < cn[1]; j++)
      for (let i = 0; i < cn[0]; i++) coarse[i + cn[0] * (j + cn[1] * k)] = f(lo[0] + i * H, lo[1] + j * H, lo[2] + k * H);

  const N0 = n[0], N01 = n[0] * n[1];
  const grid = new Float32Array(N0 * n[1] * n[2]);
  const done = new Uint8Array(grid.length);
  // Points outside the band keep the sign of their coarse corner.
  for (let gk = 0; gk < n[2]; gk++)
    for (let gj = 0; gj < n[1]; gj++)
      for (let gi = 0; gi < n[0]; gi++) grid[gi + N0 * gj + N01 * gk] = coarse[Math.round(gi / C) + cn[0] * (Math.round(gj / C) + cn[1] * Math.round(gk / C))];
  // A coarse cell can hold surface only if its centre is within half a diagonal of it (1.6x: the field is only a bound).
  const near = H * 0.866 * 1.6;
  for (let k = 0; k < cn[2] - 1; k++)
    for (let j = 0; j < cn[1] - 1; j++)
      for (let i = 0; i < cn[0] - 1; i++) {
        if (Math.abs(f(lo[0] + (i + 0.5) * H, lo[1] + (j + 0.5) * H, lo[2] + (k + 0.5) * H)) > near) continue;
        for (let kk = 0; kk <= C; kk++)
          for (let jj = 0; jj <= C; jj++)
            for (let ii = 0; ii <= C; ii++) {
              const gi = i * C + ii, gj = j * C + jj, gk = k * C + kk;
              const idx = gi + N0 * gj + N01 * gk;
              if (done[idx]) continue;
              done[idx] = 1;
              grid[idx] = f(lo[0] + gi * h, lo[1] + gj * h, lo[2] + gk * h);
            }
      }

  // One vertex per cell the surface crosses, at the mean of its edge crossings.
  const cellVert = new Int32Array((n[0] - 1) * (n[1] - 1) * (n[2] - 1)).fill(-1);
  const M0 = n[0] - 1, M01 = (n[0] - 1) * (n[1] - 1);
  const positions: number[] = [];
  const corner = new Float32Array(8);
  const EDGES = [
    [0, 1], [2, 3], [4, 5], [6, 7],
    [0, 2], [1, 3], [4, 6], [5, 7],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  for (let k = 0; k < n[2] - 1; k++)
    for (let j = 0; j < n[1] - 1; j++)
      for (let i = 0; i < n[0] - 1; i++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          const v = grid[i + (c & 1) + N0 * (j + ((c >> 1) & 1)) + N01 * (k + (c >> 2))];
          corner[c] = v;
          if (v < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0, sy = 0, sz = 0, cnt = 0;
        for (const [a, b] of EDGES) {
          const va = corner[a], vb = corner[b];
          if (va < 0 === vb < 0) continue;
          const t = va / (va - vb);
          sx += (a & 1) + ((b & 1) - (a & 1)) * t;
          sy += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t;
          sz += (a >> 2) + ((b >> 2) - (a >> 2)) * t;
          cnt++;
        }
        cellVert[i + M0 * j + M01 * k] = positions.length / 3;
        positions.push(lo[0] + (i + sx / cnt) * h, lo[1] + (j + sy / cnt) * h, lo[2] + (k + sz / cnt) * h);
      }

  // A quad around every grid edge with a sign change.
  const indices: number[] = [];
  const P = positions;
  const quad = (a: number, b: number, c: number, d: number, out: [number, number, number]) => {
    // Normal of the quad from its diagonals; flip to face outward.
    const ux = P[c * 3] - P[a * 3], uy = P[c * 3 + 1] - P[a * 3 + 1], uz = P[c * 3 + 2] - P[a * 3 + 2];
    const vx = P[d * 3] - P[b * 3], vy = P[d * 3 + 1] - P[b * 3 + 1], vz = P[d * 3 + 2] - P[b * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * out[0] + ny * out[1] + nz * out[2] < 0) [b, d] = [d, b];
    // Split along the shorter diagonal.
    const dac = ux * ux + uy * uy + uz * uz;
    const dbd = vx * vx + vy * vy + vz * vz;
    if (dac <= dbd) indices.push(a, b, c, a, c, d);
    else indices.push(a, b, d, b, c, d);
  };
  const cv = (i: number, j: number, k: number) => cellVert[i + M0 * j + M01 * k];
  for (let k = 1; k < n[2] - 1; k++)
    for (let j = 1; j < n[1] - 1; j++)
      for (let i = 1; i < n[0] - 1; i++) {
        const v0 = grid[i + N0 * j + N01 * k];
        const inside = v0 < 0;
        if (inside !== grid[i + 1 + N0 * j + N01 * k] < 0 && i < n[0] - 1) {
          const q = [cv(i, j - 1, k - 1), cv(i, j, k - 1), cv(i, j, k), cv(i, j - 1, k)];
          if (q.every((x) => x >= 0)) quad(q[0], q[1], q[2], q[3], [inside ? 1 : -1, 0, 0]);
        }
        if (inside !== grid[i + N0 * (j + 1) + N01 * k] < 0) {
          const q = [cv(i - 1, j, k - 1), cv(i, j, k - 1), cv(i, j, k), cv(i - 1, j, k)];
          if (q.every((x) => x >= 0)) quad(q[0], q[1], q[2], q[3], [0, inside ? 1 : -1, 0]);
        }
        if (inside !== grid[i + N0 * j + N01 * (k + 1)] < 0) {
          const q = [cv(i - 1, j - 1, k), cv(i, j - 1, k), cv(i, j, k), cv(i - 1, j, k)];
          if (q.every((x) => x >= 0)) quad(q[0], q[1], q[2], q[3], [0, 0, inside ? 1 : -1]);
        }
      }

  // Snap vertices onto the surface (one Newton step) and take normals from the field's gradient.
  const normals: number[] = new Array(positions.length);
  const e = h * 0.35;
  const grad = (x: number, y: number, z: number, out: number[]) => {
    // Tetrahedral central differences: 4 samples.
    const a = f(x + e, y - e, z - e), b = f(x - e, y - e, z + e), c = f(x - e, y + e, z - e), d = f(x + e, y + e, z + e);
    out[0] = a - b - c + d;
    out[1] = -a - b + c + d;
    out[2] = -a + b - c + d;
  };
  const g = [0, 0, 0];
  for (let v = 0; v < positions.length; v += 3) {
    let x = positions[v], y = positions[v + 1], z = positions[v + 2];
    grad(x, y, z, g);
    const gl = Math.hypot(g[0], g[1], g[2]) || 1;
    const d = f(x, y, z);
    const step = Math.max(-h, Math.min(h, d));
    x -= (g[0] / gl) * step;
    y -= (g[1] / gl) * step;
    z -= (g[2] / gl) * step;
    positions[v] = x;
    positions[v + 1] = y;
    positions[v + 2] = z;
    grad(x, y, z, g);
    const l = Math.hypot(g[0], g[1], g[2]) || 1;
    normals[v] = g[0] / l;
    normals[v + 1] = g[1] / l;
    normals[v + 2] = g[2] / l;
  }
  return { positions, normals, indices };
}

/* ---------- small parts ---------- */

type Part = { P: number[]; N: number[]; I: number[]; tag: number[] };

/** Rotates points (or normals) by Euler angles in three's "YXZ" order: R = Ry · Rx · Rz. */
function rotateYXZ(p: number[], x: number, y: number, z: number) {
  const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
  for (let i = 0; i < p.length; i += 3) {
    const a = p[i] * cz - p[i + 1] * sz;
    const b0 = p[i] * sz + p[i + 1] * cz;
    const c0 = p[i + 2];
    const b = b0 * cx - c0 * sx;
    const c = b0 * sx + c0 * cx;
    p[i] = a * cy + c * sy;
    p[i + 1] = b;
    p[i + 2] = -a * sy + c * cy;
  }
}

function vertexNormals(P: number[], I: number[]) {
  const N = new Array<number>(P.length).fill(0);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const v of [a, b, c]) {
      N[v] += nx;
      N[v + 1] += ny;
      N[v + 2] += nz;
    }
  }
  for (let v = 0; v < N.length; v += 3) {
    const l = Math.hypot(N[v], N[v + 1], N[v + 2]) || 1;
    N[v] /= l;
    N[v + 1] /= l;
    N[v + 2] /= l;
  }
  return N;
}

/**
 * Ear: a rounded triangular cup, wide at the base. Local frame: base centre at the origin, up = +y,
 * the open (inner) side faces +z. `tag` marks the inner (pink) side.
 */
function earPart(): Part {
  const rings = 9;
  const seg = 18;
  const P: number[] = [];
  const tag: number[] = [];
  for (let r = 0; r <= rings; r++) {
    const u = r / rings;
    const y = 0.034 * u;
    // Width tapers to a rounded tip; the cup is deep at the base and flattens toward the tip.
    const w = 0.0185 * Math.pow(1 - u, 0.75) + 0.0025 * Math.sin(Math.PI * u);
    const d = 0.0075 * (1 - u) + 0.0012;
    const cup = 0.006 * (1 - u * 0.85);
    for (let s = 0; s < seg; s++) {
      const a = (s / seg) * Math.PI * 2;
      const cx = Math.cos(a), sz = Math.sin(a);
      // Front half (sz > 0) is pushed back: a concave inner ear.
      const z = sz > 0 ? d * sz - cup * sz * (1 - Math.abs(cx)) * 2 : d * sz;
      P.push(w * cx, y, z);
      tag.push(sz > 0.25 && u < 0.92 ? 1 : 0);
    }
  }
  P.push(0, 0.0348, 0);
  tag.push(0);
  const I: number[] = [];
  for (let r = 0; r < rings; r++)
    for (let s = 0; s < seg; s++) {
      const a = r * seg + s, b = r * seg + ((s + 1) % seg), c = (r + 1) * seg + ((s + 1) % seg), d = (r + 1) * seg + s;
      I.push(a, c, b, a, d, c);
    }
  const tip = (rings + 1) * seg;
  for (let s = 0; s < seg; s++) I.push(rings * seg + s, tip, rings * seg + ((s + 1) % seg));
  return { P, N: vertexNormals(P, I), I, tag };
}

/** Eye: a UV sphere whose pole faces +z. `tag` is the angle from the pole (radians). */
function eyePart(r: number): Part {
  const W = 18, H = 14;
  const P: number[] = [];
  const N: number[] = [];
  const tag: number[] = [];
  for (let j = 0; j <= H; j++) {
    const th = (j / H) * Math.PI;
    for (let i = 0; i <= W; i++) {
      const ph = (i / W) * Math.PI * 2;
      const nx = Math.sin(th) * Math.cos(ph), ny = Math.sin(th) * Math.sin(ph), nz = Math.cos(th);
      P.push(nx * r, ny * r, nz * r);
      N.push(nx, ny, nz);
      tag.push(th);
    }
  }
  const I: number[] = [];
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const a = j * (W + 1) + i, b = a + 1, c = a + W + 2, d = a + W + 1;
      if (j > 0) I.push(a, d, b);
      if (j < H - 1) I.push(b, d, c);
    }
  return { P, N, I, tag };
}

/* ---------- assembly ---------- */

/** sRGB hex → linear RGB (three's working colour space for vertex colours). */
function linear(hex: string): V3 {
  const v = parseInt(hex.slice(1), 16);
  const ch = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return [ch((v >> 16) & 255), ch((v >> 8) & 255), ch(v & 255)];
}

const mix = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Blue British Shorthair: one even cool grey, slate nose leather, copper eyes. */
export const COAT = {
  fur: "#838a94",
  furDark: "#6f7680",
  nose: "#5b616b",
  innerEar: "#9a8c8e",
  pupil: "#0a0806",
  iris: "#d4842a",
  irisRim: "#8a4d16",
  sclera: "#1d1b19",
};

/** Typed arrays of the skinned cat: index range [0, furCount) is the coat (group 0), the rest are the eyes. */
export type CatArrays = {
  position: Float32Array;
  normal: Float32Array;
  color: Float32Array;
  skinIndex: Uint16Array;
  skinWeight: Float32Array;
  index: Uint32Array;
  furCount: number;
  stats: { vertices: number; triangles: number; ms: number };
};

const smooth = (a: number, b: number, v: number) => {
  const s = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return s * s * (3 - 2 * s);
};

/** Bone weights of a point on the body: the primitives it lies on, nearest first. */
function skinWeights(near: Prim[], x: number, y: number, z: number, out: Map<number, number>) {
  out.clear();
  const prims = near.filter((p) => inBox(p, x, y, z));
  const ds = prims.map((p) => p.dist(x, y, z));
  const dmin = Math.min(...ds);
  prims.forEach((p, i) => {
    const w0 = Math.max(0, 1 - (ds[i] - dmin) / p.skin);
    if (w0 <= 0) return;
    const w = w0 * w0;
    const t = p.start !== undefined || p.end !== undefined ? p.along(x, y, z) : 0.5;
    const toEnd = p.end !== undefined ? 0.5 * smooth(0.7, 1.0, t) : 0;
    const toStart = p.start !== undefined ? 0.5 * (1 - smooth(0, 0.3, t)) : 0;
    const own = 1 - toStart - toEnd;
    for (const [b, bw] of p.bones) out.set(b, (out.get(b) ?? 0) + w * bw * own);
    if (toEnd) out.set(p.end!, (out.get(p.end!) ?? 0) + w * toEnd);
    if (toStart) out.set(p.start!, (out.get(p.start!) ?? 0) + w * toStart);
  });
}

/** Cheap deterministic value noise for a slightly uneven coat. */
function coatNoise(x: number, y: number, z: number) {
  return (Math.sin(x * 91 + y * 37) * Math.sin(y * 73 - z * 59) + Math.sin(z * 83 + x * 47) * 0.6) / 1.6;
}

/** Builds the whole skinned cat as plain arrays (no three, so it can run in a worker). */
export function buildCat(voxel = 0.006): CatArrays {
  const t0 = Date.now();
  const prims = primitives();
  const f = field(prims);
  const skinSlab = slabs(prims.filter((p) => !p.subtract));
  const body = surfaceNets(f, [-0.1, -0.012, -0.5], [0.1, 0.4, 0.31], voxel);

  const P: number[] = [];
  const N: number[] = [];
  const Cc: number[] = [];
  const SI: number[] = [];
  const SW: number[] = [];
  const I: number[] = [];

  const fur = linear(COAT.fur);
  const dark = linear(COAT.furDark);
  const nose = linear(COAT.nose);
  const innerEar = linear(COAT.innerEar);
  const weights = new Map<number, number>();

  // Body.
  const nosePt = [0, 0.3045, 0.2745];
  for (let v = 0; v < body.positions.length; v += 3) {
    const x = body.positions[v], y = body.positions[v + 1], z = body.positions[v + 2];
    P.push(x, y, z);
    N.push(body.normals[v], body.normals[v + 1], body.normals[v + 2]);
    skinWeights(skinSlab(z), x, y, z, weights);
    const top = [...weights.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top.reduce((s, [, w]) => s + w, 0) || 1;
    for (let i = 0; i < 4; i++) {
      SI.push(top[i]?.[0] ?? 0);
      SW.push(top[i] ? top[i][1] / sum : 0);
    }
    // Coat: a touch darker along the spine and toward the tail; nose leather.
    const back = smooth(0.24, 0.29, y) * (z < 0.16 ? 1 : 0);
    let c = mix(fur, dark, back * 0.35 + (z < -0.2 ? 0.2 : 0));
    const k = 1 + coatNoise(x, y, z) * 0.035;
    c = [c[0] * k, c[1] * k, c[2] * k];
    const dn = Math.hypot(x - nosePt[0], (y - nosePt[1]) * 1.25, z - nosePt[2]);
    if (dn < 0.0085) c = mix(c, nose, Math.min(1, (0.0085 - dn) / 0.003));
    Cc.push(c[0], c[1], c[2]);
  }
  for (const i of body.indices) I.push(i);

  const place = (part: Part, rot: V3, at: V3, color: (i: number) => V3, skin: (i: number) => [number[], number[]]) => {
    const base = P.length / 3;
    const p = part.P.slice();
    const n = part.N.slice();
    rotateYXZ(p, rot[0], rot[1], rot[2]);
    rotateYXZ(n, rot[0], rot[1], rot[2]);
    for (let i = 0; i < p.length / 3; i++) {
      P.push(p[i * 3] + at[0], p[i * 3 + 1] + at[1], p[i * 3 + 2] + at[2]);
      N.push(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]);
      const c = color(i);
      Cc.push(c[0], c[1], c[2]);
      const [si, sw] = skin(i);
      SI.push(...si);
      SW.push(...sw);
    }
    for (const i of part.I) I.push(base + i);
  };

  // Ears: set wide, tilted outward, opening forward and a little to the side. The base stays with
  // the head, the rest follows the ear bone.
  const ear = earPart();
  for (const s of [1, -1] as const) {
    const at = boneAt(side(s, "ear"));
    place(
      ear,
      [-0.18, s * 0.32, -s * 0.5],
      [at[0], at[1] - 0.009, at[2]],
      (i) => mix(fur, innerEar, ear.tag[i] * 0.85),
      (i) => {
        const up = Math.min(1, ear.P[i * 3 + 1] / 0.012);
        return [[bi(side(s, "ear")), bi("head"), 0, 0], [up, 1 - up, 0, 0]];
      },
    );
  }
  const furCount = I.length;

  // Eyes: forward and a touch outward; copper iris, round pupil.
  const eye = eyePart(0.0105);
  const pupil = linear(COAT.pupil), iris = linear(COAT.iris), rim = linear(COAT.irisRim), sclera = linear(COAT.sclera);
  for (const s of [1, -1] as const) {
    place(
      eye,
      [0, s * 0.14, 0],
      boneAt(side(s, "eye")),
      (i) => {
        const a = eye.tag[i];
        return a < 0.42 ? pupil : a < 1.05 ? mix(iris, rim, smooth(0.7, 1.05, a)) : sclera;
      },
      () => [[bi(side(s, "eye")), 0, 0, 0], [1, 0, 0, 0]],
    );
  }

  return {
    position: new Float32Array(P),
    normal: new Float32Array(N),
    color: new Float32Array(Cc),
    skinIndex: new Uint16Array(SI),
    skinWeight: new Float32Array(SW),
    index: new Uint32Array(I),
    furCount,
    stats: { vertices: P.length / 3, triangles: I.length / 3, ms: Date.now() - t0 },
  };
}
