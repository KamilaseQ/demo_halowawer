import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/* ==========================================================================
   Procedural furniture geometry.
   Every generator returns an indexed BufferGeometry with position / normal / uv.
   UVs are in METRES (u, v = real distances on the surface) so the finish-aware
   textures (oak, bouclé, marble…) keep their real-world scale on any object.
   ========================================================================== */

export type Geo = THREE.BufferGeometry;
export type Vec3T = [number, number, number];
export type Profile = [number, number][];

const vec = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/* ---------- utilities ---------- */

export function fromArrays(p: number[], uv: number[], index: number[], normals?: number[]): Geo {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  if (normals) g.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  else smoothNormals(g);
  return g;
}

/**
 * Area-weighted smooth normals that also average across split vertices (UV seams, face borders),
 * so rounded shapes built from separate faces shade as one surface, while edges sharper than
 * `crease` degrees stay hard (cylinder rims, duplicated profile points).
 */
export function smoothNormals(g: Geo, crease = 50, weld = 1e-4): Geo {
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const index = g.getIndex();
  const count = pos.count;
  const tris = index ? index.count / 3 : count / 3;
  const vi = (t: number, k: number) => (index ? index.getX(t * 3 + k) : t * 3 + k);

  // Weld groups by quantised position.
  const ids = new Int32Array(count);
  const keys = new Map<string, number>();
  const inv = 1 / weld;
  let groups = 0;
  for (let i = 0; i < count; i++) {
    const k = `${Math.round(pos.getX(i) * inv)}|${Math.round(pos.getY(i) * inv)}|${Math.round(pos.getZ(i) * inv)}`;
    let id = keys.get(k);
    if (id === undefined) {
      id = groups++;
      keys.set(k, id);
    }
    ids[i] = id;
  }

  // Face normals (area-weighted) and each vertex's own normal (faces that use this exact vertex).
  const fn = new Float32Array(tris * 3);
  const own = new Float32Array(count * 3);
  const a = vec(), b = vec(), c = vec(), ab = vec(), ac = vec();
  const perGroup = new Int32Array(groups + 1);
  for (let t = 0; t < tris; t++) {
    const i0 = vi(t, 0), i1 = vi(t, 1), i2 = vi(t, 2);
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    ab.cross(ac);
    fn[t * 3] = ab.x;
    fn[t * 3 + 1] = ab.y;
    fn[t * 3 + 2] = ab.z;
    for (const i of [i0, i1, i2]) {
      own[i * 3] += ab.x;
      own[i * 3 + 1] += ab.y;
      own[i * 3 + 2] += ab.z;
      perGroup[ids[i] + 1]++;
    }
  }
  // CSR list of faces per weld group.
  for (let gi = 0; gi < groups; gi++) perGroup[gi + 1] += perGroup[gi];
  const fill = perGroup.slice(0, groups);
  const faces = new Int32Array(tris * 3);
  for (let t = 0; t < tris; t++) for (let k = 0; k < 3; k++) faces[fill[ids[vi(t, k)]]++] = t;

  const cosC = Math.cos(THREE.MathUtils.degToRad(crease));
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    let ox = own[i * 3], oy = own[i * 3 + 1], oz = own[i * 3 + 2];
    const ol = Math.hypot(ox, oy, oz);
    if (ol > 1e-12) {
      ox /= ol;
      oy /= ol;
      oz /= ol;
    }
    let sx = 0, sy = 0, sz = 0;
    const gi = ids[i];
    let last = -1;
    for (let f = perGroup[gi]; f < perGroup[gi + 1]; f++) {
      const t = faces[f];
      if (t === last) continue;
      last = t;
      const nx = fn[t * 3], ny = fn[t * 3 + 1], nz = fn[t * 3 + 2];
      const l = Math.hypot(nx, ny, nz);
      if (l < 1e-14) continue;
      if (ol > 1e-12 && (nx * ox + ny * oy + nz * oz) / l < cosC) continue;
      sx += nx;
      sy += ny;
      sz += nz;
    }
    const l = Math.hypot(sx, sy, sz) || 1;
    out[i * 3] = sx / l;
    out[i * 3 + 1] = sy / l;
    out[i * 3 + 2] = sz / l;
  }
  g.setAttribute("normal", new THREE.BufferAttribute(out, 3));
  return g;
}

/** Keeps only the attributes every furniture geometry shares, indexed, so geometries merge cleanly. */
export function clean(g: Geo, withColor = false): Geo {
  const keep = withColor ? ["position", "normal", "uv", "color"] : ["position", "normal", "uv"];
  for (const name of Object.keys(g.attributes)) if (!keep.includes(name)) g.deleteAttribute(name);
  if (!g.getAttribute("normal")) g.computeVertexNormals();
  if (!g.getAttribute("uv")) boxUV(g);
  if (!g.getIndex()) {
    const n = g.getAttribute("position").count;
    const idx = new Array<number>(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    g.setIndex(idx);
  }
  g.clearGroups();
  return g;
}

export function merge(geos: Geo[], withColor = false): Geo {
  const ready = geos.map((g) => clean(g, withColor));
  const out = mergeGeometries(ready, false);
  if (!out) throw new Error("furniture: incompatible geometries in merge");
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
/** Rotation order YXZ: roll (z) and tilt (x) happen in the part's own frame, yaw (y) last. */
export function matrix(pos: Vec3T = [0, 0, 0], rot: Vec3T = [0, 0, 0], scale: number | Vec3T = 1) {
  _q.setFromEuler(_e.set(rot[0], rot[1], rot[2], "YXZ"));
  const s = typeof scale === "number" ? vec(scale, scale, scale) : vec(...scale);
  return new THREE.Matrix4().compose(vec(...pos), _q.clone(), s);
}

/** Transforms a geometry in place (rotation in radians, XYZ order) and returns it. */
export function place(g: Geo, pos: Vec3T = [0, 0, 0], rot: Vec3T = [0, 0, 0], scale: number | Vec3T = 1): Geo {
  g.applyMatrix4(matrix(pos, rot, scale));
  return g;
}

/** Planar UVs in metres picked by the dominant normal axis — for geometry with no meaningful UVs. */
export function boxUV(g: Geo, offset: Vec3T = [0, 0, 0]): Geo {
  const pos = g.getAttribute("position");
  let nor = g.getAttribute("normal");
  if (!nor) {
    g.computeVertexNormals();
    nor = g.getAttribute("normal");
  }
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + offset[0], y = pos.getY(i) + offset[1], z = pos.getZ(i) + offset[2];
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
    if (ax >= ay && ax >= az) {
      uv[i * 2] = z;
      uv[i * 2 + 1] = y;
    } else if (ay >= az) {
      uv[i * 2] = x;
      uv[i * 2 + 1] = z;
    } else {
      uv[i * 2] = x;
      uv[i * 2 + 1] = y;
    }
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Multiplies UVs in place (finer weave than the texture's real-world size). */
export function scaleUV(g: Geo, s: number): Geo {
  const uv = g.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * s, uv.getY(i) * s);
  uv.needsUpdate = true;
  return g;
}

/** Adds a constant vertex colour (for the vertex-coloured decor bucket). */
export function tint(g: Geo, color: THREE.ColorRepresentation): Geo {
  const c = new THREE.Color(color);
  const n = g.getAttribute("position").count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return g;
}

/* ---------- soft (upholstered) box ---------- */

export type SoftBoxOpts = {
  /** Edge radius, metres. */
  r?: number;
  /** Target segment length across flat areas (smaller = smoother bulges). */
  step?: number;
  /** Segments in each half of a rounded edge band. */
  edge?: number;
  /** Outward bulge of the faces, metres: [x, top, bottom, z]. Pillows and cushions. */
  bulge?: { x?: number; top?: number; bottom?: number; z?: number; front?: number; back?: number };
  /** Bulge falloff exponent: 2 = pillow dome, 3–4 = firm cushion with a flatter crown. */
  power?: number;
  /** Low-frequency surface wobble amplitude, metres (fabric is never perfectly taut). */
  wobble?: number;
  /** High-frequency creases (bedding, throws), metres. */
  wrinkle?: number;
  seed?: number;
  /** Swap u/v on every face (rotates wood grain by 90°). */
  uvSwap?: boolean;
  /** Added to positions before projecting UVs (keeps adjacent parts' patterns continuous). */
  uvOffset?: Vec3T;
  /** Sides left unrounded (for parts that butt against another part with no visible seam). */
  sharp?: { top?: boolean; bottom?: boolean; x0?: boolean; x1?: boolean; z0?: boolean; z1?: boolean };
  /** Multiplies UVs (e.g. a finer weave than the texture's real-world scale). */
  uvScale?: number;
};

/** Samples along one axis with dense bands of width rn (negative side) and rp (positive side). */
function samples(half: number, rn: number, rp: number, step: number, edge: number): number[] {
  const lo = -half + rn;
  const hi = half - rp;
  const span = Math.max(hi - lo, 0);
  const inner = span > 1e-5 ? Math.max(1, Math.round(span / step)) : 0;
  const out: number[] = [];
  if (rn > 0) for (let i = 0; i < edge; i++) out.push(-half + (rn * i) / edge);
  for (let i = 0; i <= inner; i++) out.push(inner === 0 ? (lo + hi) / 2 : lo + (span * i) / inner);
  if (rp > 0) for (let i = 1; i <= edge; i++) out.push(hi + (rp * i) / edge);
  return out;
}

const FACES: { n: Vec3T; U: Vec3T; V: Vec3T; ax: [number, number, number] }[] = [
  // ax = [normal axis, U axis, V axis]
  { n: [1, 0, 0], U: [0, 0, -1], V: [0, 1, 0], ax: [0, 2, 1] },
  { n: [-1, 0, 0], U: [0, 0, 1], V: [0, 1, 0], ax: [0, 2, 1] },
  { n: [0, 1, 0], U: [1, 0, 0], V: [0, 0, -1], ax: [1, 0, 2] },
  { n: [0, -1, 0], U: [1, 0, 0], V: [0, 0, 1], ax: [1, 0, 2] },
  { n: [0, 0, 1], U: [1, 0, 0], V: [0, 1, 0], ax: [2, 0, 1] },
  { n: [0, 0, -1], U: [-1, 0, 0], V: [0, 1, 0], ax: [2, 0, 1] },
];

function wobbleField(seed: number, kMin = 9, kSpan = 16, count = 5) {
  // Sum of a few random plane waves: smooth, cheap, deterministic.
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const waves = Array.from({ length: count }, () => {
    const d = vec(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
    return { d, k: kMin + rnd() * kSpan, ph: rnd() * Math.PI * 2 };
  });
  return (p: THREE.Vector3) => waves.reduce((acc, w) => acc + Math.sin(p.dot(w.d) * w.k + w.ph), 0) / waves.length;
}

/** Rounded box centred at the origin, optionally bulged like a cushion. Size in metres. */
export function softBox(w: number, h: number, d: number, o: SoftBoxOpts = {}): Geo {
  const half = [w / 2, h / 2, d / 2];
  const r = Math.min(o.r ?? 0.01, Math.min(...half) * 0.985);
  const step = o.step ?? 0.09;
  const edge = r > 1e-4 ? (o.edge ?? 3) : 0;
  const sh = o.sharp ?? {};
  const rr = edge > 0 ? r : 0;
  const rn = [sh.x0 ? 0 : rr, sh.bottom ? 0 : rr, sh.z0 ? 0 : rr];
  const rp = [sh.x1 ? 0 : rr, sh.top ? 0 : rr, sh.z1 ? 0 : rr];
  const axes = half.map((hf, i) => samples(hf, rn[i], rp[i], step, edge));
  const uvs = o.uvScale ?? 1;
  const b = o.bulge ?? {};
  const bx = b.x ?? 0;
  const bTop = b.top ?? 0;
  const bBottom = b.bottom ?? 0;
  const bFront = b.front ?? b.z ?? 0;
  const bBack = b.back ?? b.z ?? 0;
  const k = o.power ?? 2;
  const wob = o.wobble ? wobbleField(o.seed ?? 1) : null;
  const wri = o.wrinkle ? wobbleField((o.seed ?? 1) + 17, 38, 46, 7) : null;
  const off = o.uvOffset ?? [0, 0, 0];

  const P: number[] = [];
  const UV: number[] = [];
  const I: number[] = [];
  const p = vec();
  const c = vec();
  const dir = vec();

  for (const f of FACES) {
    const su = axes[f.ax[1]];
    const sv = axes[f.ax[2]];
    const base = P.length / 3;
    const Uv = vec(...f.U);
    const Vv = vec(...f.V);
    for (let j = 0; j < sv.length; j++) {
      for (let i = 0; i < su.length; i++) {
        p.set(f.n[0] * half[0], f.n[1] * half[1], f.n[2] * half[2]).addScaledVector(Uv, su[i]).addScaledVector(Vv, sv[j]);
        // Round: project onto the inner box, push back out by r.
        c.set(
          THREE.MathUtils.clamp(p.x, -half[0] + rn[0], half[0] - rp[0]),
          THREE.MathUtils.clamp(p.y, -half[1] + rn[1], half[1] - rp[1]),
          THREE.MathUtils.clamp(p.z, -half[2] + rn[2], half[2] - rp[2]),
        );
        dir.subVectors(p, c);
        const len = dir.length();
        if (len > 1e-9) p.copy(c).addScaledVector(dir, r / len);
        // Bulge each face pair with a falloff that vanishes at the edges.
        const tx = p.x / half[0], ty = p.y / half[1], tz = p.z / half[2];
        const fx = Math.max(0, 1 - Math.abs(tx) ** k);
        const fy = Math.max(0, 1 - Math.abs(ty) ** k);
        const fz = Math.max(0, 1 - Math.abs(tz) ** k);
        const dx = bx * tx * fy * fz;
        const dy = (ty >= 0 ? bTop : bBottom) * ty * fx * fz;
        const dz = (tz >= 0 ? bFront : bBack) * tz * fx * fy;
        p.x += dx;
        p.y += dy;
        p.z += dz;
        if ((wob || wri) && len > 1e-9) {
          // Wobble/creases along the rounded-surface normal, faded out at hard edges.
          const fade = Math.min(1, (fx + fy + fz) / 1.5);
          let amp = wob ? (o.wobble ?? 0) * wob(p) * fade : 0;
          // Creases: ridge-like (|sin|) so they read as folds, not bumps.
          if (wri) amp += (o.wrinkle ?? 0) * (Math.abs(wri(p)) - 0.35) * (0.4 + 0.6 * fade);
          p.addScaledVector(dir, amp / len);
        }
        P.push(p.x, p.y, p.z);
        const u = (p.x + off[0]) * f.U[0] + (p.y + off[1]) * f.U[1] + (p.z + off[2]) * f.U[2];
        const v = (p.x + off[0]) * f.V[0] + (p.y + off[1]) * f.V[1] + (p.z + off[2]) * f.V[2];
        if (o.uvSwap) UV.push(v * uvs, u * uvs);
        else UV.push(u * uvs, v * uvs);
      }
    }
    const nu = su.length;
    for (let j = 0; j < sv.length - 1; j++) {
      for (let i = 0; i < nu - 1; i++) {
        const a = base + j * nu + i;
        const bb = a + 1;
        const cc = a + 1 + nu;
        const dd = a + nu;
        I.push(a, bb, cc, a, cc, dd);
      }
    }
  }
  return fromArrays(P, UV, I);
}

/** Sharp-ish box from world extents (radius default 2 mm so edges catch a highlight). */
export function boxAt(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, o: SoftBoxOpts = {}): Geo {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
  const g = softBox(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), { r: 0.002, edge: 1, step: 10, ...o });
  return g.translate(cx, cy, cz);
}

/* ---------- surfaces of revolution ---------- */

export type LatheOpts = { segments?: number; phi0?: number; phiLength?: number; uvRadius?: number };

/** Revolves a [radius, height] profile around +Y. A profile walking upward faces outward. */
export function lathe(profile: Profile, o: LatheOpts = {}): Geo {
  const segs = o.segments ?? 40;
  const phi0 = o.phi0 ?? 0;
  const phiL = o.phiLength ?? Math.PI * 2;
  const rRef = o.uvRadius ?? Math.max(...profile.map((q) => q[0]));
  const P: number[] = [];
  const UV: number[] = [];
  const I: number[] = [];
  let acc = 0;
  for (let j = 0; j < profile.length; j++) {
    if (j > 0) acc += Math.hypot(profile[j][0] - profile[j - 1][0], profile[j][1] - profile[j - 1][1]);
    for (let i = 0; i <= segs; i++) {
      const phi = phi0 + (i / segs) * phiL;
      const [r, y] = profile[j];
      P.push(r * Math.sin(phi), y, r * Math.cos(phi));
      UV.push(phi * rRef, acc);
    }
  }
  const row = segs + 1;
  for (let j = 0; j < profile.length - 1; j++) {
    for (let i = 0; i < segs; i++) {
      const a = j * row + i;
      const b = a + 1;
      const c = a + 1 + row;
      const d = a + row;
      I.push(a, b, c, a, c, d);
    }
  }
  return fromArrays(P, UV, I);
}

/**
 * Revolves an [inset, height] profile around a superellipse footprint with semi-axes a (x) and b (z):
 * each ring is the outline shrunk by `inset`. n = 2 is an ellipse, larger n squarer. For tubs and basins.
 */
export function ovalLathe(profile: Profile, a: number, b: number, n = 2, segments = 64): Geo {
  const P: number[] = [];
  const UV: number[] = [];
  const I: number[] = [];
  const e = 2 / n;
  let acc = 0;
  for (let j = 0; j < profile.length; j++) {
    if (j > 0) acc += Math.hypot(profile[j][0] - profile[j - 1][0], profile[j][1] - profile[j - 1][1]);
    const [inset, y] = profile[j];
    const ra = Math.max(a - inset, 0);
    const rb = Math.max(b - inset, 0);
    for (let i = 0; i <= segments; i++) {
      const phi = (i / segments) * Math.PI * 2;
      const s = Math.sin(phi), c = Math.cos(phi);
      P.push(ra * Math.sign(s) * Math.abs(s) ** e, y, rb * Math.sign(c) * Math.abs(c) ** e);
      UV.push(phi * Math.max(a, b), acc);
    }
  }
  const row = segments + 1;
  for (let j = 0; j < profile.length - 1; j++) {
    for (let i = 0; i < segments; i++) {
      const a0 = j * row + i;
      I.push(a0, a0 + 1, a0 + 1 + row, a0, a0 + 1 + row, a0 + row);
    }
  }
  return fromArrays(P, UV, I);
}

/** Rounded corner helper for lathe profiles: quarter arc from angle a0 to a1 (radians) around (cx, cy). */
export function arc(cx: number, cy: number, r: number, a0: number, a1: number, n = 5): Profile {
  const out: Profile = [];
  for (let i = 0; i <= n; i++) {
    const t = a0 + ((a1 - a0) * i) / n;
    out.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
  }
  return out;
}

/* ---------- swept profiles (rods, bentwood, cables, taps) ---------- */

export function circle(r: number, n = 10): Profile {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return [r * Math.cos(t), r * Math.sin(t)] as [number, number];
  });
}

/** Counter-clockwise rounded rectangle (w along X, h along Y of the sweep frame). */
export function roundRect(w: number, h: number, r: number, n = 3): Profile {
  const rr = Math.min(r, w / 2, h / 2);
  const hw = w / 2 - rr, hh = h / 2 - rr;
  const out: Profile = [];
  const corners: [number, number, number][] = [
    [hw, -hh, -Math.PI / 2],
    [hw, hh, 0],
    [-hw, hh, Math.PI / 2],
    [-hw, -hh, Math.PI],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= n; i++) {
      const t = a0 + (i / n) * (Math.PI / 2);
      out.push([cx + rr * Math.cos(t), cy + rr * Math.sin(t)]);
    }
  }
  return out;
}

export type SweepOpts = {
  segments?: number;
  /** Reference "up" for the initial frame; the frame is then parallel-transported. */
  up?: Vec3T;
  /** Profile scale along the path (0 → 1), e.g. tapering legs. */
  scale?: (t: number) => number;
  caps?: boolean;
};

/** Sweeps a closed counter-clockwise profile along a path. Profile X = side, Y = path "up". */
export function sweep(path: THREE.Vector3[] | THREE.Curve<THREE.Vector3>, profile: Profile, o: SweepOpts = {}): Geo {
  const curve = Array.isArray(path)
    ? path.length === 2
      ? new THREE.LineCurve3(path[0], path[1])
      : new THREE.CatmullRomCurve3(path, false, "centripetal")
    : path;
  const segs = o.segments ?? (Array.isArray(path) && path.length === 2 ? 1 : 24);
  const pts = curve.getSpacedPoints(segs);
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const T = pts.map((_, i) => curve.getTangentAt(i / segs).normalize());
  const up = vec(...(o.up ?? [0, 1, 0]));
  let X = vec().crossVectors(T[0], up);
  if (X.lengthSq() < 1e-6) X = vec().crossVectors(T[0], vec(1, 0, 0));
  if (X.lengthSq() < 1e-6) X = vec().crossVectors(T[0], vec(0, 0, 1));
  X.normalize();
  const frames: { X: THREE.Vector3; Y: THREE.Vector3 }[] = [];
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) X.addScaledVector(T[i], -X.dot(T[i])).normalize();
    frames.push({ X: X.clone(), Y: vec().crossVectors(X, T[i]).normalize() });
  }
  // Closed profile: repeat the first point for a UV seam.
  const prof = [...profile, profile[0]];
  const plen = [0];
  for (let k = 1; k < prof.length; k++) plen.push(plen[k - 1] + Math.hypot(prof[k][0] - prof[k - 1][0], prof[k][1] - prof[k - 1][1]));

  const P: number[] = [];
  const UV: number[] = [];
  const I: number[] = [];
  const q = vec();
  for (let i = 0; i < pts.length; i++) {
    const s = o.scale ? o.scale(i / segs) : 1;
    for (let k = 0; k < prof.length; k++) {
      q.copy(pts[i]).addScaledVector(frames[i].X, prof[k][0] * s).addScaledVector(frames[i].Y, prof[k][1] * s);
      P.push(q.x, q.y, q.z);
      UV.push(plen[k] * s, lens[i]);
    }
  }
  const row = prof.length;
  for (let i = 0; i < pts.length - 1; i++) {
    for (let k = 0; k < row - 1; k++) {
      const a = i * row + k;
      const b = a + 1;
      const c = a + 1 + row;
      const d = a + row;
      I.push(a, d, c, a, c, b);
    }
  }
  const body = fromArrays(P, UV, I);
  if (!o.caps) return body;

  const caps: Geo[] = [body];
  for (const end of [0, pts.length - 1]) {
    const s = o.scale ? o.scale(end / segs) : 1;
    const cp: number[] = [];
    const cu: number[] = [];
    const ci: number[] = [];
    const n = end === 0 ? T[0].clone().negate() : T[end].clone();
    const cn: number[] = [];
    cp.push(pts[end].x, pts[end].y, pts[end].z);
    cu.push(0, 0);
    cn.push(n.x, n.y, n.z);
    for (const [px, py] of profile) {
      q.copy(pts[end]).addScaledVector(frames[end].X, px * s).addScaledVector(frames[end].Y, py * s);
      cp.push(q.x, q.y, q.z);
      cu.push(px * s, py * s);
      cn.push(n.x, n.y, n.z);
    }
    const m = profile.length;
    for (let k = 0; k < m; k++) {
      const a = 1 + k;
      const b = 1 + ((k + 1) % m);
      if (end === 0) ci.push(0, a, b);
      else ci.push(0, b, a);
    }
    caps.push(fromArrays(cp, cu, ci, cn));
  }
  return merge(caps);
}

/** Straight round rod between two points, optionally tapered (r1 at the end). */
export function rod(p0: Vec3T, p1: Vec3T, r0: number, r1 = r0, radial = 10, caps = true): Geo {
  return sweep([vec(...p0), vec(...p1)], circle(1, radial), {
    segments: 1,
    scale: (t) => r0 + (r1 - r0) * t,
    caps,
    up: [0, 0, 1],
  });
}

/** Smooth round tube through points (cables, bent rods). */
export function tube(points: Vec3T[], r: number, segments = 24, radial = 8, caps = false): Geo {
  return sweep(
    points.map((p) => vec(...p)),
    circle(r, radial),
    { segments, caps, up: [0, 0, 1] },
  );
}

/** Flat disc facing +Y (or -Y with `down`), UVs in metres. */
export function disc(r: number, segments = 32, down = false): Geo {
  const P: number[] = [0, 0, 0];
  const UV: number[] = [0, 0];
  const N: number[] = [0, down ? -1 : 1, 0];
  const I: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    P.push(r * Math.sin(t), 0, r * Math.cos(t));
    UV.push(r * Math.sin(t), r * Math.cos(t));
    N.push(0, down ? -1 : 1, 0);
  }
  for (let i = 1; i <= segments; i++) {
    if (down) I.push(0, i + 1, i);
    else I.push(0, i, i + 1);
  }
  return fromArrays(P, UV, I, N);
}

/** Vertical cylinder with flat caps, base at y = 0 (UVs in metres). */
export function cylinder(r: number, h: number, segments = 32, rTop = r): Geo {
  return lathe(
    [
      [0, 0],
      [r, 0],
      [r, 0],
      [rTop, h],
      [rTop, h],
      [0, h],
    ],
    { segments },
  );
}

/** Rounded cylinder (puck): base at y = 0, edge radius e on both rims. */
export function puck(r: number, h: number, e: number, segments = 40): Geo {
  const ee = Math.min(e, h / 2, r);
  return lathe(
    [
      [0, 0],
      ...arc(r - ee, ee, ee, -Math.PI / 2, 0, 4),
      ...arc(r - ee, h - ee, ee, 0, Math.PI / 2, 4),
      [0, h],
    ],
    { segments },
  );
}

/** Sphere with optional "pumpkin" lobes (knot cushions, lamp globes). Centre at origin. */
export function lobedSphere(r: number, lobes = 0, depth = 0, w = 28, h = 18): Geo {
  const g = new THREE.SphereGeometry(r, w, h);
  if (lobes > 0) {
    const pos = g.getAttribute("position");
    const p = vec();
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      const phi = Math.atan2(p.x, p.z);
      const lat = Math.abs(p.y) / r;
      const f = 1 - depth * (0.5 - 0.5 * Math.cos(phi * lobes)) * Math.sqrt(Math.max(0, 1 - lat * lat));
      p.multiplyScalar(f);
      pos.setXYZ(i, p.x, p.y, p.z);
    }
  }
  g.deleteAttribute("normal");
  smoothNormals(g);
  boxUV(g);
  return g;
}
