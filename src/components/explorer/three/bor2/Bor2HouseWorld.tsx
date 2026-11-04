"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { damp } from "maath/easing";
import { useLayoutEffect, useMemo } from "react";
import type { House } from "@/lib/estate";
import { bor2Interior, type HouseModel, type LevelId } from "@/lib/estate/geometry";
import { useExplorer } from "../../state/store";
import { Hotspots, useFloorPointer, WalkCursor } from "../walk/Walk";
import { useWarmupAxis } from "../warmup";
import { applyInteriorView, interiorKey, interiorView, prepareInterior, type Bor2InteriorScene } from "./interior";

/* ==========================================================================
   A house interior from the developer's BOR2 model, in estate space. The
   GLB is one pack per interior (dom1 → G, E, F; dom2 → A–D), loaded when the
   house is entered (the stage's gate shows the loader until it is complete,
   uploaded and compiled) and kept for the page's lifetime.

   Model view: from outside nothing of the interior renders (the BOR2 body
   stands there); the dollhouse shows the storeys up to the chosen one,
   ceiling off. Walk: every storey, the house's own BOR2 body hidden.
   ========================================================================== */

/** Lightmap strength per time of day: the bake is "Dzień" (sky + all indirect light); others scale it. */
const LIGHTMAP_SCALE = { rano: 0.85, dzien: 1, noc: 0.14 } as const;
/** Daylit curtains / lamp shades (emissive in the GLB): a tenth of it at night. */
const GLOW_SCALE = { rano: 1, dzien: 1, noc: 0.1 } as const;

export function preloadBor2Interior(house: House) {
  const info = bor2Interior(house.id);
  if (info) useGLTF.preload(info.url, false, true);
}

export function Bor2HouseWorld({ house, model }: { house: House; model: HouseModel }) {
  const info = bor2Interior(house.id)!;
  const gltf = useGLTF(info.url, false, true);
  const scene = useMemo(() => prepareInterior(gltf.scene, model, info.url), [gltf.scene, model, info.url]);
  const mode = useExplorer((s) => s.mode);
  const level = useExplorer((s) => s.level);
  const node = useExplorer((s) => s.node);
  const invalidate = useThree((s) => s.invalidate);
  const walking = mode === "walk";
  const { handlers, state } = useFloorPointer(model, walking);

  // One GLB serves several houses: place it for this one (mirrors flip X; three flips the winding).
  useLayoutEffect(() => {
    const { sx, t } = info.transform;
    scene.root.scale.set(sx, 1, 1);
    scene.root.position.set(t[0], t[1], t[2]);
    scene.root.updateMatrixWorld(true);
    invalidate();
  }, [scene, info.transform, invalidate]);

  const view = interiorView(mode, level);
  const viewKey = interiorKey(view);
  useLayoutEffect(() => {
    applyInteriorView(scene, interiorView(mode, level));
    invalidate();
    // viewKey stands for (mode, level) as far as the interior is concerned.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, viewKey, invalidate]);

  // Every storey and ceiling compiles under the loader, even while the model view hides them.
  const axis = useMemo(
    () => ({
      states: [() => applyInteriorView(scene, { kind: "walk" })],
      restore: () => applyInteriorView(scene, interiorView(useExplorer.getState().mode, useExplorer.getState().level)),
    }),
    [scene],
  );
  useWarmupAxis(axis);

  // Lightmaps follow the time of day (uniforms only).
  const timeOfDay = useExplorer((s) => s.timeOfDay);
  const lm = useMemo(() => ({ k: LIGHTMAP_SCALE[useExplorer.getState().timeOfDay], g: GLOW_SCALE[useExplorer.getState().timeOfDay] }), []);
  useFrame((_, dt) => {
    if (!scene.lightmapped.length && !scene.glowing.length) return;
    let moving = damp(lm, "k", LIGHTMAP_SCALE[timeOfDay], 0.5, dt);
    moving = damp(lm, "g", GLOW_SCALE[timeOfDay], 0.5, dt) || moving;
    // eslint-disable-next-line react-hooks/immutability -- material uniforms, eased every frame; not React state
    for (const { material, intensity } of scene.lightmapped) material.lightMapIntensity = intensity * lm.k;
    for (const { material, intensity } of scene.glowing) material.emissiveIntensity = intensity * lm.g;
    if (moving) invalidate();
  });

  const shows = (l: LevelId) => view.kind === "walk" || (view.kind === "cut" && l <= view.level);
  const currentNode = model.walk.nodes.find((n) => n.id === node);
  const hotspotLevel: LevelId | null = walking ? (currentNode?.level ?? 0) : level;

  return (
    <group name={`bor2-interior-${house.id}`} userData={{ source: "wnetrze" }}>
      <primitive object={scene.root} />
      {/* Walkable floors (raycast only): the GLB's KOND_n__PODLOGA under the house's placement, or one plane
          per storey in estate space (placeholder files). Only storeys on screen take clicks. */}
      <group position={info.transform.t} scale={[info.transform.sx, 1, 1]} userData={{ source: "ui" }}>
        {scene.floors
          .filter((f) => !f.mesh.userData.estate && shows(f.level))
          .map((f, i) => (
            <primitive key={i} object={f.mesh} onPointerMove={handlers.move} onPointerOut={handlers.leave} onClick={handlers.click} />
          ))}
      </group>
      {scene.floors
        .filter((f) => f.mesh.userData.estate && shows(f.level))
        .map((f, i) => (
          <primitive key={`p${i}`} object={f.mesh} onPointerMove={handlers.move} onPointerOut={handlers.leave} onClick={handlers.click} />
        ))}
      {hotspotLevel !== null && (
        <Hotspots model={model} house={house.id} level={hotspotLevel} mirrored={false} visible={walking || mode === "model"} showLabels />
      )}
      <WalkCursor state={state} enabled={walking} />
    </group>
  );
}

export type { Bor2InteriorScene };
