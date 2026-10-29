"use client";

import { Clone, useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { arc, lathe, disc, softBox, type Vec3T } from "./geometry";
import { customMaterials, type CustomKey } from "./materials";

/* ==========================================================================
   CC0 GLB models from /public/3d (see manifest.json). Decor is cloned as-is;
   plants reuse only the GLB foliage: the scanned pots are 59–67k triangles
   each, so they are replaced by light lathe pots (a few hundred triangles).
   ========================================================================== */

export type ModelName =
  | "potted_plant_01"
  | "potted_plant_02"
  | "potted_plant_04"
  | "modern_arm_chair_01"
  | "side_table_01"
  | "outdoor_table_chair_set_01"
  | "ceramic_vase_01"
  | "ceramic_vase_02"
  | "ceramic_vase_03"
  | "wooden_bowl_01"
  | "food_pears_asian_01"
  | "standing_picture_frame_01";

const url = (name: ModelName) => `/explorer/3d/models/${name}.glb`;

export function useModel(name: ModelName) {
  // No Draco in these files; meshopt is required.
  return useGLTF(url(name), false, true);
}

/**
 * Every model the furnishings place (both arrangements). Layout B is fully procedural (plants, vases,
 * bowls, chairs, the terrace set): no GLB download and no 1K texture sets on the GPU, which keeps the
 * mobile budget. The library stays available for other layouts.
 */
const FURNISHED: ModelName[] = [];

/** Starts loading every furnishing model into the useGLTF cache (prefetch). */
export function preloadModels() {
  for (const name of FURNISHED) useGLTF.preload(url(name), false, true);
}

type Placement = { position?: Vec3T; rotation?: Vec3T; scale?: number | Vec3T };

/** A GLB placed in the scene (shares geometry and materials with every other clone). */
export function Model({ name, castShadow = true, receiveShadow = true, ...place }: { name: ModelName; castShadow?: boolean; receiveShadow?: boolean } & Placement) {
  const { scene } = useModel(name);
  return <Clone object={scene} castShadow={castShadow} receiveShadow={receiveShadow} {...place} />;
}

/* ---------- plants ---------- */

type PlantName = "potted_plant_01" | "potted_plant_02";
export type PotStyle = "stone" | "clay" | "white" | "planter" | "box";

const FOLIAGE: Record<PlantName, { leaves: string; pot: string }> = {
  potted_plant_01: { leaves: "potted_plant_01_leaves", pot: "potted_plant_01_stem" },
  potted_plant_02: { leaves: "potted_plant_02_leaves", pot: "potted_plant_02_pot" },
};

const POT_MATERIAL: Record<PotStyle, CustomKey> = { stone: "potStone", clay: "potClay", white: "potWhite", planter: "potStone", box: "potStone" };

/** Tapered, rounded-rim pot; base at y = 0. */
function potGeometry(r: number, h: number, style: PotStyle) {
  if (style === "box") {
    // Square fibre-cement terrace planter.
    return softBox(2 * r, h, 2 * r, { r: 0.025, edge: 3, step: 0.2, sharp: { bottom: true } }).translate(0, h / 2, 0);
  }
  if (style === "planter") {
    // Tall cylindrical planter with a soft lip.
    return lathe([[0, 0], [r * 0.94, 0], ...arc(r * 0.94, 0.02, 0.02, -Math.PI / 2, 0, 3), [r, h - 0.02], ...arc(r - 0.015, h - 0.015, 0.015, 0, Math.PI, 4), [r - 0.04, h - 0.05]], { segments: 40 });
  }
  const bottom = r * (style === "clay" ? 0.72 : 0.8);
  return lathe(
    [
      [0, 0.005],
      [bottom - 0.01, 0.005],
      ...arc(bottom - 0.01, 0.02, 0.015, -Math.PI / 2, 0, 3),
      [r * 0.97, h * 0.82],
      ...arc(r - 0.012, h - 0.012, 0.012, 0, Math.PI, 5),
      [r - 0.03, h - 0.06],
    ],
    { segments: 40 },
  );
}

/**
 * Plant from a Poly Haven GLB: original foliage, our own pot. `height` is the pot height and
 * `radius` its rim radius in metres before `scale`; foliage is fitted to sit in the soil.
 */
export function Plant({
  name = "potted_plant_02",
  pot = "stone",
  potRadius,
  potHeight,
  foliageScale = 1,
  position,
  rotation,
  scale = 1,
}: {
  name?: PlantName;
  pot?: PotStyle;
  potRadius?: number;
  potHeight?: number;
  foliageScale?: number;
} & Placement) {
  const gltf = useModel(name);
  const leaves = gltf.nodes[FOLIAGE[name].leaves] as THREE.Mesh;
  const potNode = gltf.nodes[FOLIAGE[name].pot] as THREE.Mesh;

  const fit = useMemo(() => {
    potNode.geometry.computeBoundingBox();
    const box = potNode.geometry.boundingBox!.clone().applyMatrix4(potNode.matrix);
    const size = box.getSize(new THREE.Vector3());
    const soilY = box.max.y;
    const r = potRadius ?? Math.max(size.x, size.z) / 2;
    const h = potHeight ?? soilY;
    return { r, h, soilY };
  }, [potNode, potRadius, potHeight]);

  const geo = useMemo(() => {
    const g = potGeometry(fit.r, fit.h, pot);
    const soil = disc(pot === "box" ? fit.r * 1.3 : fit.r - 0.035, pot === "box" ? 4 : 28).rotateY(pot === "box" ? Math.PI / 4 : 0).translate(0, fit.h - 0.05, 0);
    return { pot: g, soil };
  }, [fit, pot]);
  useEffect(
    () => () => {
      geo.pot.dispose();
      geo.soil.dispose();
    },
    [geo],
  );

  const mats = customMaterials();
  // Foliage keeps its relative placement over the soil line of the original pot.
  const lift = fit.h - 0.05 - (fit.soilY - 0.05) * foliageScale;

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh geometry={geo.pot} material={mats[POT_MATERIAL[pot]]} castShadow receiveShadow />
      <mesh geometry={geo.soil} material={mats.soil} receiveShadow />
      <group position-y={lift} scale={foliageScale}>
        <mesh
          geometry={leaves.geometry}
          material={leaves.material}
          position={leaves.position}
          quaternion={leaves.quaternion}
          scale={leaves.scale}
          castShadow
          receiveShadow
        />
      </group>
    </group>
  );
}
