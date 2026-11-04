import * as THREE from "three";
import type { HouseId } from "@/lib/estate";
import type { Bor2Exterior } from "./exterior";

/* ==========================================================================
   The estate walk's world: what you can stand on and what stops you.

   Collisions are 2D: every near-vertical triangle of the houses, fences,
   neighbours and planting is cut by a horizontal plane at hip height, which
   leaves wall and fence segments in XZ (a few thousand, built once in a few
   ms from the decoded GLB, kept in a 2 m grid). A move is clipped where its
   path meets a segment, then pushed out to keep a body radius. The ground is
   BOR2's ZIEMIA (plus the stage's flat field around it), raycast from above.
   ========================================================================== */

/** Heights of the collision cuts (world Y; the ground runs 0–0.8 m): above kerbs and deck edges, through every fence and wall. */
const CUTS = [0.9, 1.35];
/** Body radius: how close the eye may come to a wall. */
const RADIUS = 0.35;
const CELL = 2;
const EYE = 1.65;

export type WalkWorld = {
  /** Raycast targets of the ground (invisible copies of ZIEMIA + the outer field), estate space. */
  ground: THREE.Mesh[];
  groundAt: (x: number, z: number) => number;
  clip: (from: THREE.Vector3, to: THREE.Vector3) => THREE.Vector3;
  /** House the eye stands next to (≤ `reach` m from its body, XZ; default 7 m), or null. */
  nearHouse: (x: number, z: number, reach?: number) => HouseId | null;
  segments: number;
};

const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });
const GROUND_NAMES = /^(ZIEMIA|podłoże)$/;

const cache = new WeakMap<Bor2Exterior, WalkWorld>();

export function walkWorld(ext: Bor2Exterior): WalkWorld {
  const hit = cache.get(ext);
  if (hit) return hit;
  const t0 = performance.now();
  ext.root.updateMatrixWorld(true);

  /* ---------- ground ---------- */
  const ground: THREE.Mesh[] = [];
  const groundRoots = ext.root.children.filter((c) => GROUND_NAMES.test(c.name));
  for (const g of groundRoots)
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const proxy = new THREE.Mesh(m.geometry, pickMaterial);
      proxy.matrixAutoUpdate = false;
      proxy.matrix.copy(m.matrixWorld);
      proxy.matrixWorld.copy(m.matrixWorld);
      ground.push(proxy);
    });
  // The stage's own field around BOR2 (y = 0).
  const field = new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), pickMaterial);
  field.position.set(36, 0, 12);
  field.updateMatrixWorld(true);
  ground.push(field);

  const down = new THREE.Raycaster();
  down.far = 120;
  const origin = new THREE.Vector3();
  const DOWN = new THREE.Vector3(0, -1, 0);
  const groundAt = (x: number, z: number) => {
    down.set(origin.set(x, 60, z), DOWN);
    const hits = down.intersectObjects(ground, false);
    return hits.length ? hits[0].point.y : 0;
  };

  /* ---------- collision segments ---------- */
  const segs: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const pts: number[] = [];
  let cutY = CUTS[0];
  const cutEdge = (p: THREE.Vector3, q: THREE.Vector3) => {
    if ((p.y - cutY) * (q.y - cutY) > 0 || p.y === q.y) return;
    const t = (cutY - p.y) / (q.y - p.y);
    pts.push(p.x + (q.x - p.x) * t, p.z + (q.z - p.z) * t);
  };
  const perTop: Record<string, number> = {};
  // With the model's own fence planes (OGRODZENIE_KOLIZJA, one quad per panel) the 5-mm rods are skipped.
  const fencePlanes = ext.root.children.some((c) => c.userData.collisionOnly);
  for (const top of ext.root.children) {
    const before = segs.length;
    // Hidden parts (SketchUp's cone trees once real plants stand in) stop nobody; collision planes do.
    if (GROUND_NAMES.test(top.name) || (!top.visible && !top.userData.collisionOnly)) continue;
    top.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh) return;
      if (fencePlanes && /OGRODZENIE_PRETY/.test((mesh.material as THREE.Material).name)) return;
      const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
      const index = mesh.geometry.index;
      const count = index ? index.count : pos.count;
      const m = mesh.matrixWorld;
      for (let i = 0; i < count; i += 3) {
        const i0 = index ? index.getX(i) : i;
        const i1 = index ? index.getX(i + 1) : i + 1;
        const i2 = index ? index.getX(i + 2) : i + 2;
        a.fromBufferAttribute(pos, i0).applyMatrix4(m);
        b.fromBufferAttribute(pos, i1).applyMatrix4(m);
        c.fromBufferAttribute(pos, i2).applyMatrix4(m);
        const lo = Math.min(a.y, b.y, c.y);
        const hi = Math.max(a.y, b.y, c.y);
        if (lo > CUTS[CUTS.length - 1] || hi < CUTS[0]) continue;
        n.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a));
        const len = n.length();
        if (len < 1e-8 || Math.abs(n.y / len) > 0.7) continue; // floors, roofs, sills: not walls
        for (const y of CUTS) {
          if (lo > y || hi < y) continue;
          cutY = y;
          pts.length = 0;
          cutEdge(a, b);
          cutEdge(b, c);
          cutEdge(c, a);
          // Fence rods are 5 mm: keep millimetre segments (only true degenerates go).
          if (pts.length >= 4 && Math.hypot(pts[2] - pts[0], pts[3] - pts[1]) > 0.0005) segs.push(pts[0], pts[1], pts[2], pts[3]);
        }
      }
    });
    perTop[top.name] = (segs.length - before) / 4;
  }
  const S = new Float32Array(segs);
  const grid = new Map<number, number[]>();
  const key = (ix: number, iz: number) => ix * 100003 + iz;
  for (let s = 0; s < S.length; s += 4) {
    const x0 = Math.floor(Math.min(S[s], S[s + 2]) / CELL);
    const x1 = Math.floor(Math.max(S[s], S[s + 2]) / CELL);
    const z0 = Math.floor(Math.min(S[s + 1], S[s + 3]) / CELL);
    const z1 = Math.floor(Math.max(S[s + 1], S[s + 3]) / CELL);
    for (let ix = x0; ix <= x1; ix++)
      for (let iz = z0; iz <= z1; iz++) {
        const k = key(ix, iz);
        const list = grid.get(k);
        if (list) list.push(s);
        else grid.set(k, [s]);
      }
  }
  const near = (minX: number, minZ: number, maxX: number, maxZ: number) => {
    const out = new Set<number>();
    for (let ix = Math.floor(minX / CELL); ix <= Math.floor(maxX / CELL); ix++)
      for (let iz = Math.floor(minZ / CELL); iz <= Math.floor(maxZ / CELL); iz++) for (const s of grid.get(key(ix, iz)) ?? []) out.add(s);
    return out;
  };

  /** Distance from (px, pz) to segment s, and the closest point on it. */
  const closest = (s: number, px: number, pz: number) => {
    const ax = S[s];
    const az = S[s + 1];
    const dx = S[s + 2] - ax;
    const dz = S[s + 3] - az;
    const l2 = dx * dx + dz * dz;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
    const cx = ax + dx * t;
    const cz = az + dz * t;
    return { d: Math.hypot(px - cx, pz - cz), cx, cz };
  };

  const clip = (from: THREE.Vector3, to: THREE.Vector3) => {
    const px = from.x;
    const pz = from.z;
    let qx = to.x;
    let qz = to.z;
    const len = Math.hypot(qx - px, qz - pz);
    if (len > 1e-4) {
      // 1. Stop where the path first meets a wall (segment–segment intersection), a body radius before it.
      let tMin = 1;
      for (const s of near(Math.min(px, qx) - RADIUS, Math.min(pz, qz) - RADIUS, Math.max(px, qx) + RADIUS, Math.max(pz, qz) + RADIUS)) {
        const ax = S[s];
        const az = S[s + 1];
        const ex = S[s + 2] - ax;
        const ez = S[s + 3] - az;
        const rx = qx - px;
        const rz = qz - pz;
        const den = rx * ez - rz * ex;
        if (Math.abs(den) < 1e-9) continue;
        const t = ((ax - px) * ez - (az - pz) * ex) / den;
        const u = ((ax - px) * rz - (az - pz) * rx) / den;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) tMin = Math.min(tMin, t);
      }
      if (tMin < 1) {
        const t = Math.max(0, tMin - RADIUS / len);
        qx = px + (qx - px) * t;
        qz = pz + (qz - pz) * t;
      }
      // 1b. Sweep the body (radius) along what is left of the path in 5 cm steps: open fences (rods every
      //     5 cm) never intersect the path line, but the body cannot pass between them. A start already
      //     closer than the radius may only move away.
      const minDist = (x: number, z: number) => {
        let d = Infinity;
        for (const s of near(x - RADIUS, z - RADIUS, x + RADIUS, z + RADIUS)) d = Math.min(d, closest(s, x, z).d);
        return d;
      };
      const d0 = minDist(px, pz);
      const limit = Math.min(RADIUS * 0.98, d0 - 0.005);
      const sweep = Math.hypot(qx - px, qz - pz);
      const steps = Math.ceil(sweep / 0.05);
      for (let k = 1; k <= steps; k++) {
        const t = k / steps;
        if (minDist(px + (qx - px) * t, pz + (qz - pz) * t) < limit) {
          const back = (k - 1) / steps;
          qx = px + (qx - px) * back;
          qz = pz + (qz - pz) * back;
          break;
        }
      }
    }
    // 2. Keep a body radius from every wall around the end point (slides along corners).
    for (let k = 0; k < 3; k++) {
      let moved = false;
      for (const s of near(qx - RADIUS, qz - RADIUS, qx + RADIUS, qz + RADIUS)) {
        const { d, cx, cz } = closest(s, qx, qz);
        if (d >= RADIUS || d < 1e-6) continue;
        qx = cx + ((qx - cx) / d) * RADIUS;
        qz = cz + ((qz - cz) / d) * RADIUS;
        moved = true;
      }
      if (!moved) break;
    }
    to.set(qx, groundAt(qx, qz) + EYE, qz);
    return to;
  };

  const box2 = new THREE.Box2();
  const p2 = new THREE.Vector2();
  // Gardens are fenced: the walker meets a house from its garden fence or the drive, 5–7 m from the wall.
  const nearHouse = (x: number, z: number, reach = 7) => {
    let best: HouseId | null = null;
    let bestD = reach;
    for (const h of Object.values(ext.houses)) {
      if (!h) continue;
      box2.min.set(h.box.min.x, h.box.min.z);
      box2.max.set(h.box.max.x, h.box.max.z);
      const d = box2.distanceToPoint(p2.set(x, z));
      if (d < bestD) {
        bestD = d;
        best = h.id;
      }
    }
    return best;
  };

  const world: WalkWorld = { ground, groundAt, clip, nearHouse, segments: S.length / 4 };
  cache.set(ext, world);
  if (process.env.NODE_ENV !== "production") (window as unknown as { __walkWorld: unknown }).__walkWorld = { ...world, S, perTop, boxes: Object.fromEntries(Object.values(ext.houses).map((h) => [h!.id, h!.box])) };
  if (process.env.NODE_ENV !== "production") console.info(`[bor2] walk world: ${world.segments} wall segments, ${ground.length} ground meshes, ${Math.round(performance.now() - t0)} ms`);
  return world;
}
