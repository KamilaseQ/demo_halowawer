"use client";

import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { damp } from "maath/easing";
import type { HouseModel, LevelId } from "@/lib/estate/geometry/types";
import { planVec } from "../space";
import { nodeLabel } from "@/lib/estate/geometry";
import type { HouseId } from "@/lib/estate";
import { cameraControls } from "../camera/controls";
import { SceneLabels, type SceneLabel } from "../labels/SceneLabels";
import { useExplorer } from "../../state/store";

/* ==========================================================================
   Walk interactions: floor cursor + click-to-move, and hotspot discs.
   Click-to-move glides the orbit target (camera-controls moveTo), so a new click
   mid-glide simply re-targets from the current position.
   ========================================================================== */

const CLICK_SLOP_PX = 6;

type CursorState = { visible: boolean; point: THREE.Vector3; pulse: number };

export type FloorPointer = {
  move: (e: ThreeEvent<PointerEvent>) => void;
  click: (e: ThreeEvent<MouseEvent>) => void;
  leave: () => void;
};

export function useFloorPointer(model: HouseModel, enabled: boolean) {
  const state = useRef<CursorState>({ visible: false, point: new THREE.Vector3(), pulse: 0 });
  const invalidate = useThree((s) => s.invalidate);

  const handlers: FloorPointer = useMemo(
    () => ({
      move: (e) => {
        if (!enabled) return;
        e.stopPropagation();
        state.current.visible = true;
        state.current.point.copy(e.point);
        invalidate();
      },
      leave: () => {
        state.current.visible = false;
        invalidate();
      },
      click: (e) => {
        if (!enabled || e.delta > CLICK_SLOP_PX) return;
        e.stopPropagation();
        const c = cameraControls();
        if (!c) return;
        // Eye height above the clicked level (walking onto the terrace or across a storey keeps the eye level).
        const levelId = (e.object.userData.level ?? 0) as LevelId;
        const elevation = model.levels.find((l) => l.level === levelId)?.elevation ?? 0;
        c.smoothTime = 0.42;
        void c.moveTo(e.point.x, elevation + model.walk.eyeHeight, e.point.z, true);
        useExplorer.setState({ node: null, photo: false });
        state.current.pulse = 1;
        invalidate();
      },
    }),
    [enabled, model, invalidate],
  );

  return { handlers, state };
}

export function WalkCursor({ state, enabled }: { state: MutableRefObject<CursorState>; enabled: boolean }) {
  const group = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);

  // eslint-disable-next-line react-hooks/immutability -- the cursor's shared mutable state (a ref handed down), eased every frame
  useFrame(({ camera }, dt) => {
    const g = group.current;
    if (!g) return;
    const s = state.current;
    const show = enabled && s.visible;
    g.position.set(s.point.x, s.point.y + 0.012, s.point.z);
    // Grows with distance so it keeps a similar on-screen size.
    const base = THREE.MathUtils.clamp(camera.position.distanceTo(g.position) * 0.09, 0.18, 0.5);
    let moving = damp(g.scale, "x", show ? base * (1 + s.pulse * 0.6) : 0.001, 0.08, dt);
    g.scale.set(g.scale.x, 1, g.scale.x);
    if (s.pulse > 0.001) {
      const box = { v: s.pulse };
      damp(box, "v", 0, 0.25, dt);
      // eslint-disable-next-line react-hooks/immutability -- the cursor's shared mutable state (a ref handed down), eased every frame
      s.pulse = box.v;
      moving = true;
    }
    g.visible = g.scale.x > 0.01;
    if (moving) invalidate();
  });

  return (
    <group ref={group} visible={false}>
      <mesh rotation-x={-Math.PI / 2} renderOrder={5}>
        <ringGeometry args={[0.42, 0.5, 48]} />
        <meshBasicMaterial color="#f3eee6" transparent opacity={0.9} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} renderOrder={5}>
        <circleGeometry args={[0.42, 48]} />
        <meshBasicMaterial color="#f3eee6" transparent opacity={0.16} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Floor discs for curated viewpoints. In the dollhouse they are entry points into the walk. */
const enterNode = (id: string) => {
  const s = useExplorer.getState();
  if (s.mode !== "walk") s.setMode("walk");
  s.goToNode(id);
};

type HotspotsProps = { model: HouseModel; house: HouseId; level: LevelId; mirrored: boolean; visible: boolean; showLabels: boolean };

export function Hotspots({ model, house, level, mirrored, visible, showLabels }: HotspotsProps) {
  const current = useExplorer((s) => s.node);
  const elevation = model.levels.find((l) => l.level === level)?.elevation ?? 0;
  const nodes = useMemo(() => model.walk.nodes.filter((n) => n.level === level), [model, level]);
  // Labels are DOM, positioned from world points: the mirror of A/C is applied here, discs inherit it from the group.
  const labels: SceneLabel[] = useMemo(
    () =>
      // In the walk the spot you stand on needs no label.
      nodes
        .filter((n) => n.id !== current)
        .map((n) => ({
          id: n.id,
          text: nodeLabel(model, house, n),
          position: planVec(mirrored, n.position, elevation + 0.45),
          onClick: () => enterNode(n.id),
        })),
    [nodes, mirrored, elevation, model, house, current],
  );
  return (
    <group>
      {nodes.map((n) => (
        <Hotspot
          key={n.id}
          id={n.id}
          position={[n.position[0], elevation + (n.zone === "taras" ? -0.02 : 0.008), n.position[1]]}
          visible={visible && !(current === n.id && !showLabels)}
        />
      ))}
      <SceneLabels items={labels} visible={visible && showLabels} />
    </group>
  );
}

function Hotspot({ id, position, visible }: { id: string; position: [number, number, number]; visible: boolean }) {
  const [hovered, setHovered] = useState(false);
  const group = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const s = !visible ? 0.0001 : hovered ? 1.25 : 1;
    if (damp(g.scale, "x", s, 0.12, dt)) invalidate();
    g.scale.z = g.scale.x;
    g.visible = g.scale.x > 0.01;
  });

  return (
    <group position={position}>
      <group ref={group}>
        <mesh
          rotation-x={-Math.PI / 2}
          renderOrder={4}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            setHovered(false);
            document.body.style.cursor = "";
          }}
          onClick={(e) => {
            if (e.delta > CLICK_SLOP_PX) return;
            e.stopPropagation();
            enterNode(id);
          }}
        >
          <circleGeometry args={[0.34, 48]} />
          <meshBasicMaterial color="#f3eee6" transparent opacity={hovered ? 0.5 : 0.28} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position-y={0.002} renderOrder={4}>
          <ringGeometry args={[0.3, 0.34, 48]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.95} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
