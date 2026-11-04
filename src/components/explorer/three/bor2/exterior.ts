import * as THREE from "three";
import type { HouseId } from "@/lib/estate";
import { surfaceFor } from "./surfaces";
import { coverage } from "../coverage";
import { fencePanelMaterial, fenceRods } from "./fence";
import { BOR2_OFFSET as BOR2_FRAME_OFFSET } from "@/lib/estate/geometry/bor2";

/* ==========================================================================
   BOR2 exterior: the developer's SketchUp model of the estate (7 houses,
   gardens, drive, neighbours), exported from Blender as one GLB. It replaces
   the procedural house bodies, roofs, drive and fences of the maquette; the
   ground, meadow, planting, trees, forest and sky stay procedural.

   Frame: the GLB keeps SketchUp's axes (X east, Z south, Y up, metres), the
   same compass as estate space, so one translation maps it in. Interiors are
   exported in the same frame and take the same offset.

   Node contract (docs/explorer/bor2.md): DOM_A … DOM_G, KONTEKST, ZIEMIA,
   ZIELEN, OGRODZENIA, TARASY, cameras PKT_* / WIDOK_*.
   ========================================================================== */

/** Versioned name: /explorer/** is served immutable for a year, so a changed file needs a new name. */
export const BOR2_EXTERIOR_URL = "/explorer/3d/bor2/zewnetrze-v9.glb";

let enabled: boolean | null = null;
/** BOR2 replaces the procedural houses; `?bor2=0` shows the old maquette (side-by-side checks). */
export function bor2Enabled() {
  if (enabled === null) enabled = typeof window === "undefined" || new URLSearchParams(window.location.search).get("bor2") !== "0";
  return enabled;
}

/**
 * BOR2 → estate space. Chosen so the BOR2 houses land on the PZT placements (site.ts) within ±0.5 m:
 * the PZT measurement drifts ~1 m over the 75 m row, BOR2 is 1:1.
 */
export const BOR2_OFFSET = new THREE.Vector3(...BOR2_FRAME_OFFSET);

const HOUSE_NAME = /^DOM_([A-G])$/;

/** Neighbouring buildings: KONTEKST_1 … KONTEKST_n, one mesh each (faded one by one when in the way). */
const CONTEXT = /^KONTEKST/;

export type Bor2House = {
  id: HouseId;
  object: THREE.Object3D;
  /** Estate-space bounds (for picking, labels and camera framing). */
  box: THREE.Box3;
  /** Per-house material copies whose emissive carries the hover/selection glow. */
  glow: THREE.MeshStandardMaterial[];
};

export type Bor2Camera = { name: string; position: THREE.Vector3; target: THREE.Vector3 };

export type Bor2Ghost = { mesh: THREE.Mesh; box: THREE.Box3 };

/** Ghosts from other files (the OSM neighbourhood) that fade with BOR2's own. */
export const extraGhosts = new Set<Bor2Ghost>();

export type Bor2Exterior = {
  root: THREE.Object3D;
  houses: Partial<Record<HouseId, Bor2House>>;
  /** Neighbouring buildings (KONTEKST): faded out while they stand between the camera and its target. */
  ghosts: Bor2Ghost[];
  cameras: Bor2Camera[];
  stats: { triangles: number; meshes: number; materials: number };
};

/** Neighbouring buildings read as quiet grey volumes, one material for all. */
// Never brighter or more contrasty than the estate's own facades: a matte light grey that recedes.
export const ghost = new THREE.MeshStandardMaterial({ name: "duch", color: "#9d9a94", roughness: 1, metalness: 0, envMapIntensity: 0.45 });

/* Estate-space house boxes of the loaded model, for consumers outside the GLB's suspense (labels, cameras). */
let boxes: Partial<Record<HouseId, THREE.Box3>> = {};
let version = 0;
const listeners = new Set<() => void>();
export const bor2Boxes = () => boxes;
export const bor2Version = () => version;
/** Tells box consumers the model is in (from an effect: never while React renders). */
export function announceBor2() {
  version++;
  listeners.forEach((fn) => fn());
}
export function subscribeBor2(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

const processed = new WeakMap<THREE.Object3D, Bor2Exterior>();

/**
 * Delivery guard: a tangent-space normal map averages ~(0.5, 0.5, 1). A black or blank one (v9's plaster)
 * turns lit walls dark or bright by orientation, so it is dropped with an error instead of shown.
 */
const normalChecked = new WeakMap<THREE.Texture, boolean>();
function normalMapBroken(t: THREE.Texture) {
  const hit = normalChecked.get(t);
  if (hit !== undefined) return hit;
  let broken = false;
  try {
    const img = t.image as CanvasImageSource & { width: number; height: number };
    if (img && img.width) {
      const c = document.createElement("canvas");
      c.width = c.height = 16;
      const g = c.getContext("2d", { willReadFrequently: true });
      g?.drawImage(img, 0, 0, 16, 16);
      const d = g?.getImageData(0, 0, 16, 16).data;
      if (d) {
        let blue = 0;
        for (let i = 2; i < d.length; i += 4) blue += d[i];
        broken = blue / (d.length / 4) / 255 < 0.55;
      }
    }
  } catch {
    // unreadable (cross-origin): keep it
  }
  normalChecked.set(t, broken);
  return broken;
}

/** Prepares the loaded GLB scene once (shadows, ghosts, per-house glow materials, cameras). */
export function prepareExterior(scene: THREE.Object3D): Bor2Exterior {
  const done = processed.get(scene);
  if (done) return done;

  scene.position.copy(BOR2_OFFSET);
  scene.updateMatrixWorld(true);

  const houses: Partial<Record<HouseId, Bor2House>> = {};
  const ghosts: Bor2Ghost[] = [];
  const cameras: Bor2Camera[] = [];
  const materials = new Set<THREE.Material>();
  let triangles = 0;
  let meshes = 0;

  // Fence LOD (fence.ts): with one plane per span the far fence is drawn on it, the rods only near.
  const fencePlanes = scene.getObjectByName("OGRODZENIE_KOLIZJA");
  const farFence: THREE.Mesh[] = [];
  fencePlanes?.updateMatrixWorld(true);
  fencePlanes?.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const far = new THREE.Mesh(m.geometry, fencePanelMaterial());
    far.name = "OGRODZENIE_DALEKIE";
    far.matrixAutoUpdate = false;
    far.matrix.copy(m.matrixWorld).premultiply(new THREE.Matrix4().copy(scene.matrixWorld).invert());
    far.renderOrder = 1;
    far.receiveShadow = true;
    farFence.push(far);
  });
  farFence.forEach((m) => scene.add(m));

  for (const top of [...scene.children]) {
    const name = top.name;
    if (name === "OGRODZENIE_DALEKIE") continue;
    // Collision-only fence planes (v9+): never drawn, read by the walk (walkWorld.ts).
    if (name === "OGRODZENIE_KOLIZJA") {
      top.visible = false;
      top.userData.collisionOnly = true;
      continue;
    }
    const houseId = HOUSE_NAME.exec(name)?.[1] as HouseId | undefined;
    const context = CONTEXT.test(name);
    const glow: THREE.MeshStandardMaterial[] = [];
    const copies = new Map<THREE.Material, THREE.Material>();

    top.traverse((o) => {
      const cam = o as THREE.PerspectiveCamera;
      if (cam.isCamera) {
        const position = new THREE.Vector3();
        const dir = new THREE.Vector3();
        cam.getWorldPosition(position);
        cam.getWorldDirection(dir);
        cameras.push({ name: o.name, position, target: position.clone().addScaledVector(dir, 10) });
        return;
      }
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      meshes++;
      const index = mesh.geometry.index;
      const count = index ? index.count : mesh.geometry.attributes.position.count;
      triangles += (count / 3) * ((mesh as THREE.InstancedMesh).count ?? 1);
      if (context) {
        mesh.material = ghost;
        mesh.castShadow = mesh.receiveShadow = true;
        materials.add(ghost);
        // Only single buildings fade; a merged KONTEKST mesh spans the whole site and stays as it is.
        const box = new THREE.Box3().setFromObject(mesh);
        if (box.getSize(new THREE.Vector3()).length() < 45) ghosts.push({ mesh, box });
        return;
      }
      const transparent = (m: THREE.Material) => m.transparent || m.opacity < 1;
      const swap = (source: THREE.Material) => {
        const std = source as THREE.MeshStandardMaterial;
        if (std.normalMap && normalMapBroken(std.normalMap)) {
          console.error(`[bor2] broken normal map on "${source.name}" (blank/black): dropped. Fix the GLB.`);
          std.normalMap = null;
          std.needsUpdate = true;
        }
        // The SKP material name stays on the mesh for audits (dumpScene → sourceMaterial).
        mesh.userData.sourceMaterial = [...((mesh.userData.sourceMaterial as string[] | undefined) ?? []), source.name];
        const m = surfaceFor(source, /^ZIEMIA/.test(name));
        if (!houseId || transparent(m) || !(m as THREE.MeshStandardMaterial).isMeshStandardMaterial) return m;
        let copy = copies.get(m);
        if (!copy) {
          copy = m.clone();
          copy.name = `${m.name}·${houseId}`;
          // Material.clone() drops shader patches: keep the runtime's own (glass interior mapping, triplanar).
          copy.onBeforeCompile = m.onBeforeCompile;
          copy.customProgramCacheKey = m.customProgramCacheKey;
          copies.set(m, copy);
          glow.push(copy as THREE.MeshStandardMaterial);
        }
        return copy;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
      // Cut-out panels (the 3D mesh fence): with MSAA, alpha-to-coverage keeps thin rods readable at any distance.
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (m.alphaTest > 0) coverage(m);
        if (fencePlanes && /OGRODZENIE_PRETY/.test(m.name) && !m.userData.fenceLod) {
          m.userData.fenceLod = true;
          fenceRods(m);
        }
      }
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => materials.add(m));
      // Glass casts no shadow (it would darken the rooms behind it); everything else casts and receives.
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mesh.castShadow = !mats.every(transparent);
      mesh.receiveShadow = true;
    });

    if (houseId) {
      const box = new THREE.Box3().setFromObject(top);
      houses[houseId] = { id: houseId, object: top, box, glow };
    }
  }

  boxes = Object.fromEntries(Object.values(houses).map((h) => [h.id, h.box]));

  const result: Bor2Exterior = { root: scene, houses, ghosts, cameras, stats: { triangles: Math.round(triangles), meshes, materials: materials.size } };
  processed.set(scene, result);
  if (process.env.NODE_ENV !== "production") console.info("[bor2] exterior", result.stats, Object.keys(houses).sort().join(""));
  return result;
}
