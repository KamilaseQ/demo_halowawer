"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { houses, type HouseId } from "@/lib/estate";
import { PLACEMENTS } from "@/lib/estate/geometry/site";

/** Same contract as three/estate/EstateWorld (built separately); a plain massing model until it lands. */
export type EstateWorldProps = {
  detailed: HouseId | null;
  hovered: HouseId | null;
  selected: HouseId | null;
  highlight: boolean;
  onHover: (id: HouseId | null) => void;
  onSelect: (id: HouseId) => void;
};

const EAVES = 6.05;
const RIDGE = 9.05;

function useHouseGeometry(depth: number, width: number) {
  return useMemo(() => {
    const body = new THREE.BoxGeometry(depth, EAVES, width);
    body.translate(depth / 2, EAVES / 2, width / 2);
    const shape = new THREE.Shape([new THREE.Vector2(0, EAVES), new THREE.Vector2(depth, EAVES), new THREE.Vector2(depth / 2, RIDGE)]);
    const roof = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
    return { body, roof };
  }, [depth, width]);
}

function StubHouse({ id, props }: { id: HouseId; props: EstateWorldProps }) {
  const p = PLACEMENTS[id];
  const { body, roof } = useHouseGeometry(p.size[0], p.size[1]);
  const sold = houses.find((h) => h.id === id)?.status === "sold";
  const lit = props.highlight && (props.hovered === id || props.selected === id) && !sold;
  if (props.detailed === id) return null;
  return (
    <group position={[p.position[0], 0.18, p.position[2]]} rotation-y={p.rotationY}>
      <group scale-z={p.mirrored ? -1 : 1}>
        <mesh
          geometry={body}
          castShadow
          receiveShadow
          onPointerOver={(e) => {
            if (!props.highlight) return;
            e.stopPropagation();
            props.onHover(id);
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            if (!props.highlight) return;
            props.onHover(null);
            document.body.style.cursor = "";
          }}
          onClick={(e) => {
            if (!props.highlight || e.delta > 6) return;
            e.stopPropagation();
            props.onSelect(id);
          }}
        >
          <meshStandardMaterial color={lit ? "#e7c08a" : sold ? "#d6d2cc" : p.facade} roughness={0.9} />
        </mesh>
        <mesh geometry={roof} castShadow receiveShadow>
          <meshStandardMaterial color={p.roof} roughness={0.5} metalness={0.35} />
        </mesh>
      </group>
    </group>
  );
}

export function EstateWorld(props: EstateWorldProps) {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[36, 0, 12]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#9fa883" roughness={1} />
      </mesh>
      {houses.map((h) => (
        <StubHouse key={h.id} id={h.id} props={props} />
      ))}
    </group>
  );
}

export function labelAnchor(id: HouseId): THREE.Vector3 {
  const p = PLACEMENTS[id];
  const [depth, width] = p.size;
  const y = p.mirrored ? -width / 2 : width / 2;
  return new THREE.Vector3(p.position[0] + y, RIDGE + 1.6, p.position[2] - depth / 2);
}
