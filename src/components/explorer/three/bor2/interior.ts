import * as THREE from "three";
import type { HouseModel, LevelId } from "@/lib/estate/geometry";
import { BOR2_OFFSET } from "./exterior";

/* ==========================================================================
   Preparing a BOR2 interior GLB once per file: storeys, ceilings, walkable
   floors, shadows and baked lightmaps.

   Contract (docs/explorer/bor2.md): WNETRZE_<dom> → KOND_n → KOND_n__PODLOGA,
   KOND_n__SUFIT, KOND_n__WNETRZE (lightmapped), KOND_n__DETALE,
   KOND_n__TRANSPARENT; SCHODY; cameras PKT_<POKOJ>. Lightmaps come as node
   extras {lightMap, lightMapIntensity} on mesh nodes, atlas on TEXCOORD_1.
   Placeholder files without the contract are split into storeys by height
   and get one invisible floor plane per storey.
   ========================================================================== */

export type Bor2InteriorScene = {
  /** The GLB scene (BOR2 frame); placed per house by the caller. */
  root: THREE.Object3D;
  /** Storey groups by level. */
  levels: Map<number, THREE.Object3D>;
  /** Ceilings by level (hidden in the dollhouse cut). */
  ceilings: Map<number, THREE.Object3D[]>;
  /** Raycast targets for click-to-walk, in root space (render them under the root's transform). */
  floors: { level: LevelId; mesh: THREE.Mesh }[];
  /** Materials carrying a baked lightmap and their full ("Dzień") intensity. */
  lightmapped: { material: THREE.MeshStandardMaterial; intensity: number }[];
  /** Curtains and lamps glow by day (baked light through them); at night they drop to a tenth. */
  glowing: { material: THREE.MeshStandardMaterial; intensity: number }[];
};

const KOND = /^KOND_(\d)$/;
const FLOOR = /^KOND_(\d)__PODLOGA/;
const CEILING = /^KOND_(\d)__SUFIT/;

// Front side only: a storey's floor is never hit from below (looking up the stairwell from the ground floor).
const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });

/** Lightmap textures: off-thread decode, glTF orientation (no flip), sRGB, UV channel 1. */
const lightmapLoader = typeof window !== "undefined" ? new THREE.ImageBitmapLoader().setOptions({ premultiplyAlpha: "none" }) : null;
const lightmaps = new Map<string, THREE.Texture>();
function lightmap(url: string) {
  let t = lightmaps.get(url);
  if (!t) {
    const texture = new THREE.Texture();
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    texture.channel = 1;
    lightmapLoader?.load(url, (image) => {
      texture.image = image;
      texture.needsUpdate = true;
    });
    lightmaps.set(url, texture);
    t = texture;
  }
  return t;
}

const prepared = new WeakMap<THREE.Object3D, Bor2InteriorScene>();

/**
 * `model` gives the storeys' floor heights (estate space); the GLB is still in the BOR2 frame here, so
 * floors are compared in that frame (estate − offset − the house's lift, taken from the source's own floors).
 */
export function prepareInterior(scene: THREE.Object3D, model: HouseModel, url: string): Bor2InteriorScene {
  // Lightmap paths in the GLB's extras are relative to the GLB (one versioned folder per delivery).
  const folder = url.slice(0, url.lastIndexOf("/") + 1);
  const done = prepared.get(scene);
  if (done) return done;

  scene.position.set(0, 0, 0);
  scene.scale.set(1, 1, 1);
  scene.updateMatrixWorld(true);

  const levels = new Map<number, THREE.Object3D>();
  const ceilings = new Map<number, THREE.Object3D[]>();
  const floorMeshes: { level: LevelId; mesh: THREE.Mesh }[] = [];
  const lightmapped: Bor2InteriorScene["lightmapped"] = [];
  const glowing: Bor2InteriorScene["glowing"] = [];
  const glowSeen = new Set<THREE.Material>();
  const base = scene.getObjectByName(scene.children.find((c) => /^WNETRZE_/.test(c.name))?.name ?? "") ?? scene;

  // Cameras are read offline (bor2-nav.json); drop them from the scene graph.
  const cameras: THREE.Object3D[] = [];
  scene.traverse((o) => void ((o as THREE.Camera).isCamera && cameras.push(o)));
  cameras.forEach((c) => c.removeFromParent());

  // Storeys: contract groups, or a split by height (relative to the source file's own floor levels).
  base.traverse((o) => {
    const m = KOND.exec(o.name);
    if (m) levels.set(+m[1], o);
  });
  if (!levels.size) {
    // The model's floors are in estate space; the source GLB sits at BOR2 frame + the house's transform.
    const lift = model.levels[0] ? model.levels[0].elevation : 0;
    const floorsLocal = model.levels.map((l) => l.elevation - lift);
    const ground = new THREE.Box3().setFromObject(base).min.y;
    const split = (floorsLocal[1] ?? Infinity) - 0.35;
    const groups = model.levels.map((l) => {
      const g = new THREE.Group();
      g.name = `KOND_${l.level}`;
      return g;
    });
    const box = new THREE.Box3();
    for (const child of [...base.children]) {
      box.setFromObject(child);
      if (box.isEmpty()) continue;
      const center = (box.min.y + box.max.y) / 2 - ground;
      const index = center >= split ? 1 : 0;
      groups[Math.min(index, groups.length - 1)].add(child);
    }
    groups.forEach((g, i) => {
      base.add(g);
      levels.set(model.levels[i].level, g);
    });
  }

  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const ceiling = CEILING.exec(o.name);
    if (ceiling) ceilings.set(+ceiling[1], [...(ceilings.get(+ceiling[1]) ?? []), o]);
    const floor = FLOOR.exec(o.name);
    if (floor && mesh.isMesh) floorMeshes.push({ level: +floor[1] as LevelId, mesh });
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const transparent = mats.every((m) => m.transparent);
    mesh.castShadow = !transparent;
    mesh.receiveShadow = true;
    // Baked light: extras on the mesh's node or (GLTFLoader turns a multi-primitive node into a Group of
    // meshes) on an ancestor. Several nodes share materials, so each lightmapped mesh gets copies.
    let extras: { lightMap?: string; lightMapIntensity?: number } = {};
    for (let p: THREE.Object3D | null = mesh; p && p !== scene; p = p.parent)
      if ((p.userData as { lightMap?: string }).lightMap) {
        extras = p.userData as typeof extras;
        break;
      }
    if (extras.lightMap) {
      const tex = lightmap(folder + extras.lightMap.replace(/^\/+/, ""));
      const intensity = extras.lightMapIntensity ?? 1;
      const copy = (m: THREE.Material) => {
        const c = m.clone() as THREE.MeshStandardMaterial;
        c.lightMap = tex;
        c.lightMapIntensity = intensity;
        // The bake already holds the sky's diffuse light: the IBL would count it twice.
        c.envMapIntensity = Math.min(c.envMapIntensity ?? 1, 0.25);
        lightmapped.push({ material: c, intensity });
        return c;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(copy) : copy(mesh.material);
    }
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const std = m as THREE.MeshStandardMaterial;
      if (glowSeen.has(m) || !std.emissive || !/ZASLON|FIRAN|LAMP/i.test(m.name) || std.emissive.getHex() === 0) continue;
      glowSeen.add(m);
      glowing.push({ material: std, intensity: std.emissiveIntensity });
    }
  });

  // Raycast proxies in root space (the root is still at identity here).
  const floors: Bor2InteriorScene["floors"] = [];
  if (floorMeshes.length) {
    for (const { level, mesh } of floorMeshes) {
      const proxy = new THREE.Mesh(mesh.geometry, pickMaterial);
      proxy.matrixAutoUpdate = false;
      proxy.matrix.copy(mesh.matrixWorld);
      proxy.userData = { level };
      floors.push({ level, mesh: proxy });
    }
  } else {
    // Placeholder: one plane per storey over the house body (the walk boundary keeps the eye inside).
    const [x0, z0, x1, z1] = model.bounds;
    const lift = model.levels[0]?.elevation ?? 0;
    for (const l of model.levels) {
      const plane = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2);
      const proxy = new THREE.Mesh(plane, pickMaterial);
      // Model bounds are estate space; the proxy lives in the GLB frame of the source house (x mirrored by the
      // caller's transform), so it is placed in estate space under an identity parent instead (see world()).
      proxy.position.set((x0 + x1) / 2, l.elevation + 0.01, (z0 + z1) / 2);
      proxy.userData = { level: l.level, estate: true, lift };
      floors.push({ level: l.level, mesh: proxy });
    }
  }

  const result: Bor2InteriorScene = { root: scene, levels, ceilings, floors, lightmapped, glowing };
  prepared.set(scene, result);
  if (process.env.NODE_ENV !== "production") {
    let triangles = 0;
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const n = m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count;
      triangles += (n / 3) * ((m as THREE.InstancedMesh).count ?? 1);
    });
    console.info("[bor2] interior", { levels: [...levels.keys()], floors: floors.length, lightmapped: lightmapped.length, triangles: Math.round(triangles), offset: BOR2_OFFSET.toArray() });
  }
  return result;
}

export type InteriorView = { kind: "outside" } | { kind: "cut"; level: LevelId } | { kind: "walk" };

export function interiorView(mode: string, level: LevelId | null): InteriorView {
  if (mode === "walk") return { kind: "walk" };
  if (mode === "model" && level !== null) return { kind: "cut", level };
  return { kind: "outside" };
}

/** Shows what a view needs: nothing from outside, storeys up to the cut (ceiling off), everything in the walk. */
export function applyInteriorView(s: Bor2InteriorScene, view: InteriorView) {
  s.root.visible = view.kind !== "outside";
  for (const [level, group] of s.levels) group.visible = view.kind !== "cut" || level <= view.level;
  for (const [level, list] of s.ceilings) for (const c of list) c.visible = !(view.kind === "cut" && level === view.level);
}

export const interiorKey = (v: InteriorView) => (v.kind === "cut" ? `cut${v.level}` : v.kind);
