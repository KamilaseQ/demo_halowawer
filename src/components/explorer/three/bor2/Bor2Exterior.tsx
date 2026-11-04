"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { damp } from "maath/easing";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { HouseId } from "@/lib/estate";
import { HOUSE_IDS, isSold } from "../estate/build";
import { BOR2_EXTERIOR_URL, announceBor2, extraGhosts, prepareExterior } from "./exterior";
import { Okolica } from "./Okolica";
import { Bor2Planting, plantingMarkers } from "./Bor2Planting";

/* ==========================================================================
   The BOR2 houses, drive and neighbours in the estate maquette. Hover and
   selection glow through emissive on per-house material copies (a uniform
   change, no new shader program); picking uses one invisible box per house,
   so hover is stable across roof edges and cheap to raycast.
   ========================================================================== */

/** Warm, quiet glow (brand gold), at the strength the procedural shell used. */
const GLOW_COLOR = new THREE.Color("#c9a46a");
const GLOW = { selected: 0.32, hovered: 0.22, soldScale: 0.4 };

export function preloadBor2Exterior() {
  useGLTF.preload(BOR2_EXTERIOR_URL, false, true);
}

type Props = {
  detailed: HouseId | null;
  hovered: HouseId | null;
  selected: HouseId | null;
  highlight: boolean;
  onHover: (id: HouseId | null) => void;
  onSelect: (id: HouseId) => void;
};

const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });
const unitBox = new THREE.BoxGeometry(1, 1, 1);

const ray = new THREE.Ray();
const eye = new THREE.Vector3();
const aim = new THREE.Vector3();
const hit = new THREE.Vector3();
/** A ghost this close to the eye fades too (the camera is inside or right next to it). */
const NEAR_EYE = 4;

export function Bor2Exterior({ detailed, hovered, selected, highlight, onHover, onSelect }: Props) {
  const gltf = useGLTF(BOR2_EXTERIOR_URL, false, true);
  const ext = useMemo(() => prepareExterior(gltf.scene), [gltf.scene]);
  // Planting markers (v4+): real plants replace SketchUp's cone trees.
  const markers = useMemo(() => {
    const list = plantingMarkers(ext);
    const cones = ext.root.getObjectByName("ZIELEN");
    if (list && cones) cones.visible = false;
    return list;
  }, [ext]);
  const invalidate = useThree((s) => s.invalidate);
  const level = useRef<Record<HouseId, number>>({ A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0 });
  useEffect(() => announceBor2(), [ext]);

  // The house shown in full detail elsewhere (procedural interior) hides its BOR2 body.
  useEffect(() => {
    for (const id of HOUSE_IDS) {
      const h = ext.houses[id];
      // eslint-disable-next-line react-hooks/immutability -- three.js objects are mutable by design, not React state
      if (h) h.object.visible = id !== detailed;
    }
    invalidate();
  }, [ext, detailed, invalidate]);

  useEffect(() => invalidate(), [invalidate, hovered, selected, highlight]);

  useFrame(({ camera }, dt) => {
    let moving = false;
    // Neighbours standing between the eye and any of the seven houses (or right at the eye) step aside:
    // the overview from the south looks over two of them. 7 rays × a handful of boxes per frame.
    if (ext.ghosts.length || extraGhosts.size) {
      camera.getWorldPosition(eye);
      for (const g of [...ext.ghosts, ...extraGhosts]) {
        let blocking = g.box.distanceToPoint(eye) < NEAR_EYE;
        for (const id of HOUSE_IDS) {
          const h = ext.houses[id];
          if (blocking || !h) continue;
          h.box.getCenter(aim);
          aim.y = h.box.min.y + 1.5;
          const length = eye.distanceTo(aim);
          ray.set(eye, aim.sub(eye).normalize());
          blocking = !!ray.intersectBox(g.box, hit) && hit.distanceTo(eye) < length;
        }
        // Hidden outright: a translucent veil read as a glass box in eye-level frames (vis-5).
        if (g.mesh.visible === blocking) {
          g.mesh.visible = !blocking;
          moving = true;
        }
      }
    }
    for (const id of HOUSE_IDS) {
      const h = ext.houses[id];
      if (!h) continue;
      let target = 0;
      if (highlight && id !== detailed) target = id === selected ? GLOW.selected : id === hovered ? GLOW.hovered : 0;
      if (isSold(id)) target *= GLOW.soldScale;
      if (damp(level.current, id, target, 0.16, dt)) moving = true;
      const v = level.current[id];
       
      for (const m of h.glow) m.emissive.copy(GLOW_COLOR).multiplyScalar(v);
    }
    if (moving) invalidate();
  });

  useEffect(() => {
    if (!highlight) document.body.style.cursor = "";
  }, [highlight]);
  useEffect(() => () => void (document.body.style.cursor = ""), []);

  const handlers = (id: HouseId) =>
    highlight && id !== detailed
      ? {
          onPointerOver: (e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            onHover(id);
            document.body.style.cursor = "pointer";
          },
          onPointerOut: (e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            onHover(null);
            document.body.style.cursor = "";
          },
          onClick: (e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            onSelect(id);
          },
        }
      : {};

  return (
    <group name="bor2" userData={{ source: "bor2" }}>
      <primitive object={ext.root} />
      {markers && <Bor2Planting markers={markers} />}
      <Okolica />
      {HOUSE_IDS.filter((id) => ext.houses[id] && id !== detailed).map((id) => {
        const box = ext.houses[id]!.box;
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        return <mesh key={id} name={`pick-${id}`} userData={{ source: "ui" }} geometry={unitBox} material={pickMaterial} position={center} scale={size} {...handlers(id)} />;
      })}
    </group>
  );
}
