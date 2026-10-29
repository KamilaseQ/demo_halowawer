import * as THREE from "three";

/* ==========================================================================
   Tiny mesh builder for static maquette geometry: flat-shaded triangles with
   per-vertex colour, metre UVs and optional per-vertex roughness/metalness.
   Writing straight into arrays is much cheaper than creating hundreds of
   BufferGeometries and merging them.
   ========================================================================== */

export type V3 = [number, number, number];
export type V2 = [number, number];

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _n = new THREE.Vector3();
const _e1 = new THREE.Vector3();
const _e2 = new THREE.Vector3();

/** Linear-space colour from any representation (hex strings are sRGB). */
export function lin(c: THREE.ColorRepresentation): THREE.Color {
  return c instanceof THREE.Color ? c.clone() : new THREE.Color(c);
}

export class GeoBuilder {
  readonly pos: number[] = [];
  readonly nor: number[] = [];
  readonly uv: number[] = [];
  readonly col: number[] = [];
  readonly rm: number[] = [];
  readonly withRM: boolean;
  color = new THREE.Color(1, 1, 1);
  rough = 0.9;
  metal = 0;
  /** Surface pattern id for the shader (0 none, 1 plaster). */
  pattern = 0;
  /** Optional transform applied to everything written (winding flips automatically for mirrors). */
  private matrix: THREE.Matrix4 | null = null;
  private normalMatrix = new THREE.Matrix3();
  private flip = false;

  constructor(withRM = false) {
    this.withRM = withRM;
  }

  setColor(c: THREE.ColorRepresentation) {
    if (c instanceof THREE.Color) this.color.copy(c);
    else this.color.set(c);
    return this;
  }

  setRM(rough: number, metal = 0, pattern = 0) {
    this.rough = rough;
    this.metal = metal;
    this.pattern = pattern;
    return this;
  }

  setMatrix(m: THREE.Matrix4 | null) {
    this.matrix = m;
    if (m) {
      this.normalMatrix.getNormalMatrix(m);
      this.flip = m.determinant() < 0;
    } else this.flip = false;
    return this;
  }

  get vertexCount() {
    return this.pos.length / 3;
  }

  private vert(p: THREE.Vector3, n: THREE.Vector3, u: number, v: number) {
    this.pos.push(p.x, p.y, p.z);
    this.nor.push(n.x, n.y, n.z);
    this.uv.push(u, v);
    this.col.push(this.color.r, this.color.g, this.color.b);
    if (this.withRM) this.rm.push(this.rough, this.metal, this.pattern);
  }

  /**
   * One triangle. Without a normal it is computed from the winding (counter-clockwise = front).
   * UVs default to a planar projection in metres along the dominant axis.
   */
  tri(a: V3, b: V3, c: V3, normal?: V3, uvs?: [V2, V2, V2]) {
    _a.set(a[0], a[1], a[2]);
    _b.set(b[0], b[1], b[2]);
    _c.set(c[0], c[1], c[2]);
    if (normal) _n.set(normal[0], normal[1], normal[2]);
    else _n.crossVectors(_e1.subVectors(_b, _a), _e2.subVectors(_c, _a)).normalize();
    const uv = uvs ?? (planarUV(_n, a, b, c) as [V2, V2, V2]);
    if (this.matrix) {
      _a.applyMatrix4(this.matrix);
      _b.applyMatrix4(this.matrix);
      _c.applyMatrix4(this.matrix);
      _n.applyMatrix3(this.normalMatrix).normalize();
    }
    if (this.flip) {
      this.vert(_a, _n, uv[0][0], uv[0][1]);
      this.vert(_c, _n, uv[2][0], uv[2][1]);
      this.vert(_b, _n, uv[1][0], uv[1][1]);
    } else {
      this.vert(_a, _n, uv[0][0], uv[0][1]);
      this.vert(_b, _n, uv[1][0], uv[1][1]);
      this.vert(_c, _n, uv[2][0], uv[2][1]);
    }
  }

  /** Quad a-b-c-d. If `normal` is given the winding is fixed to face it. */
  quad(a: V3, b: V3, c: V3, d: V3, normal?: V3, uvs?: [V2, V2, V2, V2]) {
    if (normal) {
      const cx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
      const cy = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
      const cz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (cx * normal[0] + cy * normal[1] + cz * normal[2] < 0) {
        // Reverse: a-d-c-b.
        const u = uvs ? ([uvs[0], uvs[3], uvs[2], uvs[1]] as [V2, V2, V2, V2]) : undefined;
        this.tri(a, d, c, normal, u ? [u[0], u[1], u[2]] : undefined);
        this.tri(a, c, b, normal, u ? [u[0], u[2], u[3]] : undefined);
        return;
      }
    }
    this.tri(a, b, c, normal, uvs ? [uvs[0], uvs[1], uvs[2]] : undefined);
    this.tri(a, c, d, normal, uvs ? [uvs[0], uvs[2], uvs[3]] : undefined);
  }

  /**
   * Convex planar polygon (fan), oriented so its true normal points along `hint` (any vector on the
   * outer side), with the real face normal for shading.
   */
  poly(points: V3[], hint: V3) {
    const [a, b, c] = points;
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    const pts = nx * hint[0] + ny * hint[1] + nz * hint[2] < 0 ? [...points].reverse() : points;
    const s = pts === points ? 1 : -1;
    const n: V3 = [nx * s, ny * s, nz * s];
    for (let i = 1; i < pts.length - 1; i++) this.tri(pts[0], pts[i], pts[i + 1], n);
  }

  /**
   * Axis-aligned box. `skip` omits faces that are always hidden ("-x", "+y", ...).
   */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, skip: string[] = []) {
    const s = new Set(skip);
    if (!s.has("+y")) this.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0]);
    if (!s.has("-y")) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);
    if (!s.has("+x")) this.quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0]);
    if (!s.has("-x")) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
    if (!s.has("+z")) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
    if (!s.has("-z")) this.quad([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [0, 0, -1]);
  }

  /**
   * Oriented box: centre plus three orthonormal axes and half extents. Faces listed in `skip`
   * ("-u", "+v", ...) are omitted. UVs are metres in the face plane.
   */
  obox(center: V3, u: V3, v: V3, w: V3, hu: number, hv: number, hw: number, skip: string[] = []) {
    const s = new Set(skip);
    const p = (su: number, sv: number, sw: number): V3 => [
      center[0] + u[0] * su * hu + v[0] * sv * hv + w[0] * sw * hw,
      center[1] + u[1] * su * hu + v[1] * sv * hv + w[1] * sw * hw,
      center[2] + u[2] * su * hu + v[2] * sv * hv + w[2] * sw * hw,
    ];
    const neg = (a: V3): V3 => [-a[0], -a[1], -a[2]];
    const face = (axis: V3, a: V3, b: V3, c: V3, d: V3, la: number, lb: number) => {
      this.quad(a, b, c, d, axis, [
        [0, 0],
        [la, 0],
        [la, lb],
        [0, lb],
      ]);
    };
    if (!s.has("+u")) face(u, p(1, -1, -1), p(1, 1, -1), p(1, 1, 1), p(1, -1, 1), 2 * hv, 2 * hw);
    if (!s.has("-u")) face(neg(u), p(-1, -1, -1), p(-1, -1, 1), p(-1, 1, 1), p(-1, 1, -1), 2 * hw, 2 * hv);
    if (!s.has("+v")) face(v, p(-1, 1, -1), p(-1, 1, 1), p(1, 1, 1), p(1, 1, -1), 2 * hw, 2 * hu);
    if (!s.has("-v")) face(neg(v), p(-1, -1, -1), p(1, -1, -1), p(1, -1, 1), p(-1, -1, 1), 2 * hu, 2 * hw);
    if (!s.has("+w")) face(w, p(-1, -1, 1), p(1, -1, 1), p(1, 1, 1), p(-1, 1, 1), 2 * hu, 2 * hv);
    if (!s.has("-w")) face(neg(w), p(-1, -1, -1), p(-1, 1, -1), p(1, 1, -1), p(1, -1, -1), 2 * hv, 2 * hu);
  }

  /** Appends any geometry (indexed or not), transformed, in the current colour. */
  addGeometry(g: THREE.BufferGeometry, m?: THREE.Matrix4, smoothNormals = true) {
    const src = g.index ? g.toNonIndexed() : g;
    const p = src.getAttribute("position");
    const n = src.getAttribute("normal");
    const uvA = src.getAttribute("uv");
    const prev = this.matrix;
    if (m) {
      const combined = prev ? prev.clone().multiply(m) : m;
      this.setMatrix(combined);
    }
    for (let i = 0; i < p.count; i += 3) {
      const a: V3 = [p.getX(i), p.getY(i), p.getZ(i)];
      const b: V3 = [p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)];
      const c: V3 = [p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)];
      const uvs: [V2, V2, V2] | undefined = uvA
        ? [
            [uvA.getX(i), uvA.getY(i)],
            [uvA.getX(i + 1), uvA.getY(i + 1)],
            [uvA.getX(i + 2), uvA.getY(i + 2)],
          ]
        : undefined;
      if (n && smoothNormals) this.triN(a, b, c, [n.getX(i), n.getY(i), n.getZ(i)], [n.getX(i + 1), n.getY(i + 1), n.getZ(i + 1)], [n.getX(i + 2), n.getY(i + 2), n.getZ(i + 2)], uvs);
      else this.tri(a, b, c, undefined, uvs);
    }
    if (m) this.setMatrix(prev);
    if (src !== g) src.dispose();
  }

  /** Triangle with per-vertex normals (smooth shading). */
  triN(a: V3, b: V3, c: V3, na: V3, nb: V3, nc: V3, uvs?: [V2, V2, V2], colors?: [THREE.Color, THREE.Color, THREE.Color]) {
    const verts: [V3, V3, V2, THREE.Color | null][] = [
      [a, na, uvs ? uvs[0] : [0, 0], colors ? colors[0] : null],
      [b, nb, uvs ? uvs[1] : [0, 0], colors ? colors[1] : null],
      [c, nc, uvs ? uvs[2] : [0, 0], colors ? colors[2] : null],
    ];
    const order = this.flip ? [0, 2, 1] : [0, 1, 2];
    const keep = this.color.clone();
    for (const k of order) {
      const [p, n, uv, cc] = verts[k];
      _a.set(p[0], p[1], p[2]);
      _n.set(n[0], n[1], n[2]);
      if (this.matrix) {
        _a.applyMatrix4(this.matrix);
        _n.applyMatrix3(this.normalMatrix).normalize();
      }
      if (cc) this.color.copy(cc);
      this.vert(_a, _n, uv[0], uv[1]);
    }
    this.color.copy(keep);
  }

  build(extra?: Record<string, { size: number; value: number[] | ((i: number) => number) }>): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    if (this.withRM) g.setAttribute("aRM", new THREE.Float32BufferAttribute(this.rm, 3));
    if (extra) {
      const count = this.vertexCount;
      for (const [name, spec] of Object.entries(extra)) {
        const arr = new Float32Array(count * spec.size);
        if (typeof spec.value === "function") for (let i = 0; i < arr.length; i++) arr[i] = spec.value(i);
        else for (let i = 0; i < count; i++) for (let k = 0; k < spec.size; k++) arr[i * spec.size + k] = spec.value[k];
        g.setAttribute(name, new THREE.BufferAttribute(arr, spec.size));
      }
    }
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

/** Planar UVs in metres, projected along the dominant normal axis. */
function planarUV(n: THREE.Vector3, a: V3, b: V3, c: V3): V2[] {
  const ax = Math.abs(n.x);
  const ay = Math.abs(n.y);
  const az = Math.abs(n.z);
  const pick = (p: V3): V2 => (ay >= ax && ay >= az ? [p[0], p[2]] : ax >= az ? [p[2], p[1]] : [p[0], p[1]]);
  return [pick(a), pick(b), pick(c)];
}

/* ---------- small deterministic random ---------- */

export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    // mulberry32
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
