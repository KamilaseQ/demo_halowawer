"use client";

import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ESTATE_CENTER } from "@/lib/estate/geometry/site";
import { buildForest } from "../estate/forest";
import { BOR2_OFFSET, extraGhosts, ghost, type Bor2Ghost } from "./exterior";

/* ==========================================================================
   The real neighbourhood (OpenStreetMap, ODbL: "© OpenStreetMap contributors"
   shows on the stage; docs/inwestycja-3d/assets/okolica/README.md): 452
   houses as grey ghosts, the streets, the football pitch, the woods. A
   separate file from the developer's model (share-alike stays with it).

   Draw calls: the 20 nearest houses stay separate meshes (they may stand in
   the camera's way and fade like BOR2's KONTEKST); the rest are merged into
   8 compass sectors (frustum culling still drops what is behind you); the
   far quarters come merged. Woods: the OSM wood points as impostor trees,
   one mesh, plus a thin far ring on the horizon.
   ========================================================================== */

export const OKOLICA_URL = "/explorer/3d/okolica/okolica-v1.glb";

/** Houses within this many metres of the estate centre stay single (fadeable) meshes. */
const NEAR = 70;
const SECTORS = 8;

/** Streets, parkings and the pitch: a shade darker than the houses, drawn a hair above the field. */
const terrain = new THREE.MeshStandardMaterial({ name: "okolica-teren", color: "#b9bab5", roughness: 1, metalness: 0, envMapIntensity: 0.5, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });

/**
 * OSM paving never enters the estate: BOR2's ground (ZIEMIA bbox + 2 m, estate XZ) and the meadow strip
 * south of the gardens (8 m), where the renders show grasses, not the footpath OSM has there.
 */
const NO_OSM_GROUND = { x0: -21.7, x1: 90.7, z0: -10.9, z1: 40.9 };

function clipGround(g: THREE.BufferGeometry) {
  const flat = g.index ? g.toNonIndexed() : g;
  const pos = flat.attributes.position;
  const nrm = flat.attributes.normal;
  const keepP: number[] = [];
  const keepN: number[] = [];
  for (let i = 0; i < pos.count; i += 3) {
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    if (cx > NO_OSM_GROUND.x0 && cx < NO_OSM_GROUND.x1 && cz > NO_OSM_GROUND.z0 && cz < NO_OSM_GROUND.z1) continue;
    for (let k = 0; k < 3; k++) {
      keepP.push(pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k));
      if (nrm) keepN.push(nrm.getX(i + k), nrm.getY(i + k), nrm.getZ(i + k));
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(keepP, 3));
  if (nrm) out.setAttribute("normal", new THREE.Float32BufferAttribute(keepN, 3));
  else out.computeVertexNormals();
  return out;
}

type Prepared = { root: THREE.Object3D; ghosts: Bor2Ghost[]; woods: { x: number; z: number }[]; stats: { meshes: number; triangles: number } };
const cache = new WeakMap<THREE.Object3D, Prepared>();

function prepare(scene: THREE.Object3D): Prepared {
  const hit = cache.get(scene);
  if (hit) return hit;
  scene.position.copy(BOR2_OFFSET);
  scene.updateMatrixWorld(true);
  const centre = new THREE.Vector3(...ESTATE_CENTER);
  const root = new THREE.Group();
  root.name = "okolica";
  const ghosts: Bor2Ghost[] = [];
  const sectors: THREE.BufferGeometry[][] = Array.from({ length: SECTORS }, () => []);
  const box = new THREE.Box3();
  const c = new THREE.Vector3();

  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const name = (mesh.name || mesh.parent?.name || "").toUpperCase();
    const isTerrain = /TEREN/.test(name) || (mesh.material as THREE.Material).name === "DUCH_TEREN";
    if (isTerrain) {
      const m = new THREE.Mesh(clipGround(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld)), terrain);
      m.name = mesh.name;
      m.receiveShadow = true;
      root.add(m);
      return;
    }
    box.setFromObject(mesh);
    box.getCenter(c);
    const d = Math.hypot(c.x - centre.x, c.z - centre.z);
    const far = /DALEKIE/.test(name);
    if (!far && d < NEAR) {
      const m = new THREE.Mesh(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld), ghost);
      m.name = mesh.name;
      m.castShadow = m.receiveShadow = true;
      root.add(m);
      ghosts.push({ mesh: m, box: new THREE.Box3().setFromObject(m) });
      return;
    }
    if (far) {
      const m = new THREE.Mesh(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld), ghost);
      m.name = mesh.name;
      m.receiveShadow = true;
      root.add(m);
      return;
    }
    // Merge by compass sector; only position + normal (one material, no textures).
    const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k);
    const sector = Math.floor(((Math.atan2(c.z - centre.z, c.x - centre.x) + Math.PI) / (2 * Math.PI)) * SECTORS) % SECTORS;
    sectors[sector].push(g.index ? g.toNonIndexed() : g);
  });
  sectors.forEach((list, i) => {
    if (!list.length) return;
    const merged = mergeGeometries(list, false);
    if (!merged) return;
    const m = new THREE.Mesh(merged, ghost);
    m.name = `DUCH_SEKTOR_${i}`;
    // Beyond the sun's shadow frustum (fitted to the estate): receive only.
    m.receiveShadow = true;
    root.add(m);
  });

  // OSM woods (GLB frame, flat XZ pairs) → estate space.
  const extras = (scene.getObjectByName("DRZEWA")?.userData ?? {}) as { las_xz?: number[]; szpaler_xz?: number[]; pojedyncze_xz?: number[] };
  const woods: { x: number; z: number }[] = [];
  for (const list of [extras.las_xz, extras.szpaler_xz, extras.pojedyncze_xz]) {
    if (!list) continue;
    for (let i = 0; i + 1 < list.length; i += 2) woods.push({ x: list[i] + BOR2_OFFSET.x, z: list[i + 1] + BOR2_OFFSET.z });
  }

  let triangles = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) triangles += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
  });
  const result: Prepared = { root, ghosts, woods, stats: { meshes: root.children.length, triangles: Math.round(triangles) } };
  cache.set(scene, result);
  if (process.env.NODE_ENV !== "production") console.info("[okolica]", result.stats, `${ghosts.length} fadeable, ${woods.length} wood trees`);
  return result;
}

export function Okolica() {
  const gltf = useGLTF(OKOLICA_URL, false, true);
  const o = useMemo(() => prepare(gltf.scene), [gltf.scene]);
  const forest = useMemo(() => buildForest(o.woods), [o]);

  // Near neighbours fade like BOR2's when they stand between the camera and the houses.
  useEffect(() => {
    o.ghosts.forEach((g) => extraGhosts.add(g));
    return () => o.ghosts.forEach((g) => extraGhosts.delete(g));
  }, [o]);

  return (
    <group name="okolica" userData={{ source: "okolica" }}>
      <primitive object={o.root} />
      <mesh name="okolica-lasy" geometry={forest.geometry} material={forest.material} />
    </group>
  );
}

useGLTF.preload(OKOLICA_URL, false, true);
