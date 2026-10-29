import * as THREE from "three";
import { houses, type HouseId } from "@/lib/estate";
import { PLACEMENTS } from "@/lib/estate/geometry/site";
import { makeGroundGeometry, makeGroundMaterial } from "./ground";
import { buildHouse, houseSpec, type HouseGeometry } from "./houses";
import { shrubs, tufts } from "./landscape";
import { estateMaterials } from "./materials";
import { makeShellMaterial } from "./shell";
import { buildFences, buildGrassPavers, buildNeighbours, buildPaving, buildProxy, buildShell, buildSite } from "./siteMeshes";
import { buildFoliage, grassTuftGeometry } from "./vegetation";
import { buildForest } from "./forest";
import { buildMeadow } from "./meadow";

/* ==========================================================================
   Builds every estate geometry and material once per page (they are static).
   ~100 ms on the main thread; EstateWorld calls it inside useMemo, the stage
   shows it under its loading gate.
   ========================================================================== */

export const HOUSE_IDS: HouseId[] = ["A", "B", "C", "D", "E", "F", "G"];

export const isSold = (id: HouseId) => houses.find((h) => h.id === id)?.status === "sold";

function instancedTufts() {
  const list = tufts();
  const geo = grassTuftGeometry();
  const mesh = new THREE.InstancedMesh(geo, estateMaterials().plants, list.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const c = new THREE.Color();
  list.forEach((t, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot);
    s.set(t.scale * 1.1, t.scale, t.scale * 1.1);
    p.set(t.x, t.y, t.z);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.setRGB(t.color[0], t.color[1], t.color[2], THREE.SRGBColorSpace));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.frustumCulled = false;
  return mesh;
}

function create() {
  const times: [string, number][] = [];
  let last = performance.now();
  const lap = <T,>(label: string, f: () => T): T => {
    const v = f();
    const now = performance.now();
    times.push([label, Math.round(now - last)]);
    last = now;
    return v;
  };
  const mats = lap("materials", () => estateMaterials());
  const houseGeo = lap("houses", () => {
    const out = {} as Record<HouseId, HouseGeometry & { proxy: THREE.BufferGeometry }>;
    for (const id of HOUSE_IDS) out[id] = { ...buildHouse(houseSpec(id), PLACEMENTS[id], isSold(id)), proxy: buildProxy(id) };
    return out;
  });
  const ground = lap("ground", () => makeGroundMaterial());
  // Trees never stand in a house-view corridor (plan.ts keeps them out; this guards later edits).
  const trees = lap("trees+shrubs", () =>
    // Trees are real models now (trees.tsx, instanced from drzewa.glb); this builds the shrubs and hedges.
    buildFoliage([], shrubs()),
  );
  const result = {
    houses: houseGeo,
    shell: lap("shell", () => ({ geometry: buildShell(), material: makeShellMaterial() })),
    ground: { geometry: makeGroundGeometry(), material: ground.material },
    paving: lap("paving", () => buildPaving()),
    grassPavers: buildGrassPavers(),
    site: lap("site", () => buildSite()),
    fences: buildFences(),
    neighbours: buildNeighbours(),
    bark: trees.bark,
    foliage: trees.foliage,
    tufts: lap("grasses", () => instancedTufts()),
    forest: lap("forest", () => buildForest()),
    meadow: lap("meadow", () => buildMeadow()),
    materials: mats,
    proxyMaterial: new THREE.MeshBasicMaterial({ visible: false }),
  };
  if (process.env.NODE_ENV !== "production") console.info(`[estate] ${times.map(([k, t]) => `${k} ${t}`).join(" · ")} ms`);
  return result;
}

export type EstateBuild = ReturnType<typeof create>;

let cache: EstateBuild | null = null;

/** All estate meshes' data, built on first use and kept for the page's lifetime. */
export function estateBuild(): EstateBuild {
  if (!cache) {
    const t0 = performance.now();
    cache = create();
    if (process.env.NODE_ENV !== "production") console.info(`[estate] built in ${Math.round(performance.now() - t0)} ms`);
  }
  return cache;
}
