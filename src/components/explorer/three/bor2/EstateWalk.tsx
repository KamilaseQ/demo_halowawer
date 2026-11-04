"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { estateWalkModel } from "@/lib/estate/geometry";
import { useExplorer } from "../../state/store";
import { registerWalkClip } from "../camera/controls";
import { useFloorPointer, WalkCursor } from "../walk/Walk";
import { BOR2_EXTERIOR_URL, prepareExterior } from "./exterior";
import { walkWorld } from "./walkWorld";

/**
 * Walking the estate at eye height: click the ground (or WASD / arrows) to move, drag to look. Walls,
 * fences, neighbours and trees stop you (walkWorld). Next to a house the HUD offers to go in.
 */
export function EstateWalk() {
  const gltf = useGLTF(BOR2_EXTERIOR_URL, false, true);
  const world = useMemo(() => walkWorld(prepareExterior(gltf.scene)), [gltf.scene]);
  const model = estateWalkModel()!;
  const { handlers, state } = useFloorPointer(model, true);

  useEffect(() => {
    registerWalkClip(world.clip);
    return () => {
      registerWalkClip(null);
      useExplorer.setState({ nearHouse: null });
    };
  }, [world]);

  // "Wejdź do domu": the house you stand next to (7 box distances per drawn frame; a store write only on change).
  useFrame(({ camera }) => {
    const id = world.nearHouse(camera.position.x, camera.position.z);
    if (useExplorer.getState().nearHouse !== id) useExplorer.setState({ nearHouse: id });
  });

  return (
    <group name="estate-walk" userData={{ source: "ui" }}>
      {world.ground.map((g, i) => (
        <primitive key={i} object={g} onPointerMove={handlers.move} onPointerOut={handlers.leave} onClick={handlers.click} />
      ))}
      <WalkCursor state={state} enabled />
    </group>
  );
}
