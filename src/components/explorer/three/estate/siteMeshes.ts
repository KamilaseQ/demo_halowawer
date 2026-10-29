import * as THREE from "three";
import type { HouseId } from "@/lib/estate";
import { PLACEMENTS } from "@/lib/estate/geometry/site";
import type { Vec2 } from "@/lib/estate/geometry/types";
import { GeoBuilder, rng, type V3 } from "./builder";
import { PLINTH, footprintRect, houseSpec } from "./houses";
import { planters, terraceRect } from "./landscape";
import { BAYS, BINS, NEIGHBOURS, STRIP_EAST, fenceLines, pavingOutline, stripPolygon, zStrip } from "./plan";

/* ==========================================================================
   Static site meshes in estate space: paving, grass pavers, the vertex-
   coloured "site" mesh (kerbs, fence posts, decks, bins, planters, bay
   edging), fence panels, clay neighbours, the highlight shell and the
   invisible pick proxies of the houses.
   ========================================================================== */

export const PAVE_Y = 0.03;

const HOUSES: HouseId[] = ["A", "B", "C", "D", "E", "F", "G"];
export const HOUSE_INDEX: Record<HouseId, number> = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6 };

/** Horizontal polygon (XZ) with holes at height y, facing up, UVs in metres. */
function flat(b: GeoBuilder, outline: Vec2[], holes: Vec2[][], y: number) {
  const contour = outline.map(([x, z]) => new THREE.Vector2(x, z));
  const hs = holes.map((h) => h.map(([x, z]) => new THREE.Vector2(x, z)));
  const pts = [...contour, ...hs.flat()];
  for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(contour, hs)) {
    const A = pts[i], B = pts[j], C = pts[k];
    // Up-facing: (B−A)×(C−A) must have +y, i.e. a clockwise turn in (x, z).
    const cross = (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x);
    const a: V3 = [A.x, y, A.y], bb: V3 = [B.x, y, B.y], c: V3 = [C.x, y, C.y];
    const uv = (p: THREE.Vector2): [number, number] => [p.x, -p.y];
    if (cross < 0) b.tri(a, bb, c, [0, 1, 0], [uv(A), uv(B), uv(C)]);
    else b.tri(a, c, bb, [0, 1, 0], [uv(A), uv(C), uv(B)]);
  }
}

const rect = (x0: number, z0: number, x1: number, z1: number): Vec2[] => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];

/** Bay areas (grass pavers), a few cm inside their concrete edging. */
const bayRects = () => BAYS.map((b) => rect(b.x0 + 0.06, b.z0 + 0.06, b.x1 - 0.06, b.z1 - 0.06));

export function buildPaving() {
  const b = new GeoBuilder(false);
  flat(b, pavingOutline().map((s) => s.a), bayRects(), PAVE_Y);
  return b.build();
}

export function buildGrassPavers() {
  const b = new GeoBuilder(false);
  flat(b, stripPolygon(), [], PAVE_Y);
  for (const r of bayRects()) flat(b, r, [], PAVE_Y);
  return b.build();
}

/** Flat edging strip / kerb along a segment. */
function kerb(b: GeoBuilder, a: Vec2, c: Vec2, width: number, top: number) {
  const dx = c[0] - a[0];
  const dz = c[1] - a[1];
  const len = Math.hypot(dx, dz);
  if (len < 0.05) return;
  const u: V3 = [dx / len, 0, dz / len];
  const w: V3 = [-u[2], 0, u[0]];
  b.obox([(a[0] + c[0]) / 2, top / 2, (a[1] + c[1]) / 2], u, [0, 1, 0], w, len / 2 + width / 2, top / 2, width / 2, ["-v"]);
}

export function buildSite() {
  const b = new GeoBuilder(true);
  const r = rng(404);
  const concrete = new THREE.Color("#d2cbbf");

  // Kerbs where paving meets lawn, flush edging between paving and the green strip.
  b.setColor(concrete).setRM(0.85, 0);
  for (const s of pavingOutline()) if (s.kerb) kerb(b, s.a, s.b, 0.1, 0.075);
  const sp = stripPolygon();
  kerb(b, sp[3], sp[2], 0.12, 0.045);
  // Bay edging and separators.
  for (const bay of BAYS) {
    const n = bay.labels.length;
    const w = (bay.x1 - bay.x0) / n;
    for (let i = 0; i <= n; i++) kerb(b, [bay.x0 + w * i, bay.z0], [bay.x0 + w * i, bay.z1], 0.1, 0.045);
    kerb(b, [bay.x0, bay.z0], [bay.x1, bay.z0], 0.1, 0.045);
    kerb(b, [bay.x0, bay.z1], [bay.x1, bay.z1], 0.1, 0.045);
  }

  // Timber decks on the garden side: boards square to the facade on a dark frame.
  for (const id of HOUSES) {
    const [x0, z0, x1, z1] = terraceRect(id);
    b.setColor("#5a5047").setRM(0.85, 0);
    b.box(x0 + 0.04, 0, z0, x1 - 0.04, 0.1, z1 - 0.04, ["-y", "-z"]);
    const board = 0.145;
    const gap = 0.007;
    const n = Math.floor((x1 - x0 + gap) / (board + gap));
    const start = x0 + (x1 - x0 - (n * (board + gap) - gap)) / 2;
    for (let i = 0; i < n; i++) {
      const bx = start + i * (board + gap);
      const tone = 0.9 + r() * 0.18;
      b.setColor(new THREE.Color("#a88e72").multiplyScalar(tone)).setRM(0.78, 0);
      b.box(bx, 0.1, z0, bx + board, 0.145, z1, ["-y", "-z"]);
    }
  }

  // Bin enclosures: rows of light compartments with shadow gaps and dark lids.
  for (const bin of BINS) {
    const n = Math.max(2, Math.round((bin.x1 - bin.x0) / 0.62));
    const w = (bin.x1 - bin.x0) / n;
    for (let i = 0; i < n; i++) {
      b.setColor("#d8d2c8").setRM(0.85, 0);
      b.box(bin.x0 + i * w + 0.015, PAVE_Y, bin.z0, bin.x0 + (i + 1) * w - 0.015, 1.26, bin.z1, ["-y"]);
      b.setColor("#8d8880").setRM(0.6, 0.2);
      b.box(bin.x0 + i * w + 0.005, 1.26, bin.z0 - 0.02, bin.x0 + (i + 1) * w - 0.005, 1.3, bin.z1 + 0.02, ["-y"]);
    }
  }

  // Raised planters in the forecourt nooks: concrete rim, dark soil top.
  for (const p of planters()) {
    const t = 0.08;
    const h = 0.42;
    b.setColor(concrete).setRM(0.85, 0);
    b.box(p.x0, PAVE_Y, p.z0, p.x1, h, p.z0 + t, ["-y"]);
    b.box(p.x0, PAVE_Y, p.z1 - t, p.x1, h, p.z1, ["-y"]);
    b.box(p.x0, PAVE_Y, p.z0 + t, p.x0 + t, h, p.z1 - t, ["-y"]);
    b.box(p.x1 - t, PAVE_Y, p.z0 + t, p.x1, h, p.z1 - t, ["-y"]);
    b.setColor("#6c6a55").setRM(0.95, 0);
    b.quad([p.x0 + t, h - 0.04, p.z0 + t], [p.x0 + t, h - 0.04, p.z1 - t], [p.x1 - t, h - 0.04, p.z1 - t], [p.x1 - t, h - 0.04, p.z0 + t], [0, 1, 0]);
  }

  // Fence posts every ~2.5 m.
  b.setColor("#6f6c66").setRM(0.55, 0.3);
  for (const line of fenceLines()) {
    for (let s = 0; s < line.length - 1; s++) {
      const [a, c] = [line[s], line[s + 1]];
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const n = Math.max(1, Math.round(len / 2.5));
      for (let i = 0; i <= n; i++) {
        const x = a[0] + ((c[0] - a[0]) * i) / n;
        const z = a[1] + ((c[1] - a[1]) * i) / n;
        b.box(x - 0.025, 0, z - 0.025, x + 0.025, 1.22, z + 0.025, ["-y"]);
      }
    }
  }
  return b.build();
}

/** Mesh fence panels (alpha-mapped), UVs in metres along the fence × height. */
export function buildFences() {
  const b = new GeoBuilder(false);
  b.setColor("#ffffff");
  const H = 1.2;
  for (const line of fenceLines()) {
    let run = 0;
    for (let s = 0; s < line.length - 1; s++) {
      const [a, c] = [line[s], line[s + 1]];
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const nx = -(c[1] - a[1]) / len;
      const nz = (c[0] - a[0]) / len;
      b.quad([a[0], 0.04, a[1]], [c[0], 0.04, c[1]], [c[0], H, c[1]], [a[0], H, a[1]], [nx, 0, nz], [
        [run, 0.04],
        [run + len, 0.04],
        [run + len, H],
        [run, H],
      ]);
      run += len;
    }
  }
  return b.build();
}

/** Neighbouring houses: plain clay volumes with gable or hipped roofs. */
/** Neighbours' roofs: the red one by the access road (as on the aerial photo), the rest graphite or brown. */
const NEIGHBOUR_ROOFS = ["#6a4d43", "#4b4e52", "#5f4c42", "#55585c"];
const NEIGHBOUR_WALL = "#e6e0d6";
const NEIGHBOUR_WINDOW = "#3b4146";

export function buildNeighbours() {
  const b = new GeoBuilder(false);
  const m = new THREE.Matrix4();
  NEIGHBOURS.forEach((n, i) => {
    m.makeRotationY(n.rot).setPosition(n.x, 0, n.z);
    b.setMatrix(m);
    const hw = n.w / 2;
    const hd = n.d / 2;
    b.setColor(NEIGHBOUR_WALL);
    b.box(-hw, -0.1, -hd, hw, n.eaves, hd, ["-y"]);
    // Plinth: a dark base line, as on any real house.
    b.setColor("#8c877f");
    b.box(-hw - 0.03, -0.1, -hd - 0.03, hw + 0.03, 0.35, hd + 0.03, ["-y", "+y"]);
    const e = n.eaves;
    const r = n.ridge;
    const ridgeX = n.w >= n.d;
    // Dark window bands on the long faces, one row per storey (reads as a lived-in house from afar).
    b.setColor(NEIGHBOUR_WINDOW);
    for (let y0 = 0.9; y0 + 1.3 < e - 0.2; y0 += 2.8) {
      const y1 = y0 + 1.3;
      const along = ridgeX ? hw : hd;
      for (let k = -1; k <= 1; k += 2) {
        const a0 = -along * 0.7;
        const a1 = -along * 0.15;
        const b0 = along * 0.15;
        const b1 = along * 0.7;
        for (const [u0, u1] of [[a0, a1], [b0, b1]]) {
          if (ridgeX) b.box(u0, y0, k * hd - 0.02, u1, y1, k * hd + 0.02, []);
          else b.box(k * hw - 0.02, y0, u0, k * hw + 0.02, y1, u1, []);
        }
      }
    }
    b.setColor(NEIGHBOUR_ROOFS[i === 0 ? 0 : 1 + (i % 3)]);
    if (n.hip) {
      const inset = Math.min(hd, hw) * 0.9;
      const ra: V3 = ridgeX ? [-hw + inset, r, 0] : [0, r, -hd + inset];
      const rb: V3 = ridgeX ? [hw - inset, r, 0] : [0, r, hd - inset];
      if (ridgeX) {
        b.poly([[-hw, e, -hd], [hw, e, -hd], rb, ra], [0, 1, -1]);
        b.poly([[hw, e, hd], [-hw, e, hd], ra, rb], [0, 1, 1]);
        b.poly([[hw, e, -hd], [hw, e, hd], rb], [1, 1, 0]);
        b.poly([[-hw, e, hd], [-hw, e, -hd], ra], [-1, 1, 0]);
      } else {
        b.poly([[-hw, e, -hd], [-hw, e, hd], rb, ra], [-1, 1, 0]);
        b.poly([[hw, e, hd], [hw, e, -hd], ra, rb], [1, 1, 0]);
        b.poly([[-hw, e, -hd], [hw, e, -hd], ra], [0, 1, -1]);
        b.poly([[hw, e, hd], [-hw, e, hd], rb], [0, 1, 1]);
      }
    } else if (ridgeX) {
      b.poly([[-hw, e, -hd], [-hw, r, 0], [hw, r, 0], [hw, e, -hd]], [0, 1, -1]);
      b.poly([[hw, e, hd], [hw, r, 0], [-hw, r, 0], [-hw, e, hd]], [0, 1, 1]);
      b.setColor(NEIGHBOUR_WALL);
      b.poly([[-hw, e, hd], [-hw, r, 0], [-hw, e, -hd]], [-1, 0, 0]);
      b.poly([[hw, e, -hd], [hw, r, 0], [hw, e, hd]], [1, 0, 0]);
    } else {
      b.poly([[-hw, e, -hd], [0, r, -hd], [0, r, hd], [-hw, e, hd]], [-1, 1, 0]);
      b.poly([[hw, e, hd], [0, r, hd], [0, r, -hd], [hw, e, -hd]], [1, 1, 0]);
      b.setColor(NEIGHBOUR_WALL);
      b.poly([[-hw, e, -hd], [hw, e, -hd], [0, r, -hd]], [0, 0, -1]);
      b.poly([[hw, e, hd], [-hw, e, hd], [0, r, hd]], [0, 0, 1]);
    }
  });
  b.setMatrix(null);
  return b.build();
}

/* ---------------------------------------------------------------- shell + proxies */

/** House envelope (walls to the eaves + gable prism) in estate space, inflated by `pad`. */
function envelope(b: GeoBuilder, id: HouseId, pad: number) {
  const [w, n, e, s] = footprintRect(id);
  const spec = houseSpec(id);
  const y0 = 0.02;
  const ye = spec.roof.eaves + PLINTH + pad;
  const yr = spec.roof.ridge + PLINTH + pad * 1.6;
  const x0 = w - pad, x1 = e + pad, z0 = n - pad, z1 = s + pad;
  const zm = (n + s) / 2;
  b.box(x0, y0, z0, x1, ye, z1, ["-y", "+y"]);
  b.poly([[x0, ye, z0], [x0, yr, zm], [x1, yr, zm], [x1, ye, z0]], [0, 1, -1]);
  b.poly([[x1, ye, z1], [x1, yr, zm], [x0, yr, zm], [x0, ye, z1]], [0, 1, 1]);
  b.poly([[x0, ye, z1], [x0, yr, zm], [x0, ye, z0]], [-1, 0, 0]);
  b.poly([[x1, ye, z0], [x1, yr, zm], [x1, ye, z1]], [1, 0, 0]);
}

/**
 * Barycentric coordinates per vertex with the diagonals of flat faces switched off (component held at
 * 1), so the shader can draw only the real edges of the envelope.
 */
function edgeBary(g: THREE.BufferGeometry) {
  const pos = g.getAttribute("position");
  const nor = g.getAttribute("normal");
  const tris = pos.count / 3;
  const key = (i: number) => `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
  const edges = new Map<string, { t: number; n: [number, number, number] }[]>();
  const edgeKey = (a: number, b: number) => [key(a), key(b)].sort().join("|");
  for (let t = 0; t < tris; t++) {
    const n: [number, number, number] = [nor.getX(t * 3), nor.getY(t * 3), nor.getZ(t * 3)];
    for (let k = 0; k < 3; k++) {
      const e = edgeKey(t * 3 + ((k + 1) % 3), t * 3 + ((k + 2) % 3));
      const list = edges.get(e) ?? [];
      list.push({ t, n });
      edges.set(e, list);
    }
  }
  const bary = new Float32Array(pos.count * 3);
  for (let t = 0; t < tris; t++) {
    const n = [nor.getX(t * 3), nor.getY(t * 3), nor.getZ(t * 3)];
    for (let v = 0; v < 3; v++) bary[(t * 3 + v) * 3 + v] = 1;
    for (let k = 0; k < 3; k++) {
      const shared = edges.get(edgeKey(t * 3 + ((k + 1) % 3), t * 3 + ((k + 2) % 3))) ?? [];
      const flat = shared.some((o) => o.t !== t && o.n[0] * n[0] + o.n[1] * n[1] + o.n[2] * n[2] > 0.999);
      if (flat) for (let v = 0; v < 3; v++) bary[(t * 3 + v) * 3 + k] = 1;
    }
  }
  g.setAttribute("aBary", new THREE.BufferAttribute(bary, 3));
}

/** All highlight shells in one mesh; `aHouse` selects the house's glow uniform. */
export function buildShell() {
  const b = new GeoBuilder(false);
  const index: number[] = [];
  for (const id of HOUSES) {
    const before = b.vertexCount;
    envelope(b, id, 0.14);
    for (let i = before; i < b.vertexCount; i++) index.push(HOUSE_INDEX[id]);
  }
  const g = b.build({ aHouse: { size: 1, value: (i) => index[i] } });
  edgeBary(g);
  return g;
}

export function buildProxy(id: HouseId) {
  const b = new GeoBuilder(false);
  envelope(b, id, 0.05);
  return b.build();
}

/** Estate-space transform pieces of a house group. */
export function houseGroup(id: HouseId) {
  const p = PLACEMENTS[id];
  return { position: [p.position[0], PLINTH, p.position[2]] as V3, rotationY: p.rotationY, mirror: p.mirrored ? -1 : 1 };
}

export { STRIP_EAST, zStrip };
