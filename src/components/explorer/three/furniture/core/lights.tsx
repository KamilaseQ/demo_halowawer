"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { useFurnitureRuntime } from "./runtime";
import type { Vec3T } from "./geometry";

/* ==========================================================================
   Practical lights that never change the scene's light count.

   three bakes the number of lights into every lit shader, and it only counts
   lights it reaches through visible parents. Furniture lives in the level
   groups, which the dollhouse hides (a lifted storey): a light inside them
   would drop out of the count and every material would recompile. So these
   lights hang at the scene root, follow an anchor placed in the level (house
   mirror, level elevation and lift included) and go dark (intensity 0) when
   the anchor is hidden. By day they also sit at intensity 0: switching the
   time of day or the level only changes uniforms.
   ========================================================================== */

export type PracticalLight =
  | { kind: "spot"; position: Vec3T; target: Vec3T; intensity: number; angle?: number; penumbra?: number; distance?: number; color?: string }
  | { kind: "point"; position: Vec3T; intensity: number; distance?: number; color?: string }
  | { kind: "rect"; position: Vec3T; rotation: Vec3T; width: number; height: number; intensity: number; color?: string };

/** ~3000 K warm white. */
const WARM = "#ffe2c4";

let rectLibReady = false;

type Built = {
  spec: PracticalLight;
  light: THREE.Light;
  local: THREE.Vector3;
  target?: THREE.Object3D;
  localTarget?: THREE.Vector3;
  /** Rect lights: facing direction and width axis in the anchor's frame. */
  facing?: THREE.Vector3;
  across?: THREE.Vector3;
};

function create(spec: PracticalLight): Built {
  const color = spec.color ?? WARM;
  if (spec.kind === "spot") {
    const light = new THREE.SpotLight(color, 0, spec.distance ?? 6, spec.angle ?? 1, spec.penumbra ?? 0.9, 2);
    const target = new THREE.Object3D();
    light.target = target;
    return { spec, light, local: new THREE.Vector3(...spec.position), target, localTarget: new THREE.Vector3(...spec.target) };
  }
  if (spec.kind === "point") {
    return { spec, light: new THREE.PointLight(color, 0, spec.distance ?? 4, 2), local: new THREE.Vector3(...spec.position) };
  }
  if (!rectLibReady) {
    RectAreaLightUniformsLib.init();
    rectLibReady = true;
  }
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...spec.rotation));
  return {
    spec,
    light: new THREE.RectAreaLight(color, 0, spec.width, spec.height),
    local: new THREE.Vector3(...spec.position),
    facing: new THREE.Vector3(0, 0, -1).applyQuaternion(q),
    across: new THREE.Vector3(1, 0, 0).applyQuaternion(q),
  };
}

function shownInScene(o: THREE.Object3D) {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

const _z = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _m = new THREE.Matrix4();

/**
 * Practical lights of one level, positioned in the level's plan coordinates (Y = 0 at its floor).
 * Keep the whole house at ≤ 8 of these; none casts shadows.
 */
export function PracticalLights({ lights }: { lights: PracticalLight[] }) {
  const scene = useThree((s) => s.scene);
  const { practical } = useFurnitureRuntime();
  const anchor = useRef<THREE.Group>(null);
  const key = JSON.stringify(lights);
  // Specs arrive as literals; the serialised key keeps the lights stable across renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const built = useMemo(() => lights.map(create), [key]);

  useEffect(() => {
    for (const b of built) {
      // eslint-disable-next-line react-hooks/immutability -- three.js lights and scene are mutable by design, not React state
      b.light.name = `practical:${b.spec.kind}`;
      scene.add(b.light);
      if (b.target) scene.add(b.target);
    }
    return () => {
      for (const b of built) {
        scene.remove(b.light);
        if (b.target) scene.remove(b.target);
        b.light.dispose();
      }
    };
  }, [scene, built]);

  // eslint-disable-next-line react-hooks/immutability -- three.js lights and scene are mutable by design, not React state
  useFrame(() => {
    const a = anchor.current;
    if (!a) return;
    a.updateWorldMatrix(true, false);
    const f = shownInScene(a) ? practical.current : 0;
    const mw = a.matrixWorld;
    for (const b of built) {
      // eslint-disable-next-line react-hooks/immutability -- three.js lights and scene are mutable by design, not React state
      b.light.intensity = b.spec.intensity * f;
      b.light.position.copy(b.local).applyMatrix4(mw);
      if (b.target && b.localTarget) b.target.position.copy(b.localTarget).applyMatrix4(mw);
      if (b.facing && b.across) {
        // Right-handed basis from the world facing direction (mirrored houses flip the anchor's frame).
        _z.copy(b.facing).transformDirection(mw).negate();
        _x.copy(b.across).transformDirection(mw);
        _x.addScaledVector(_z, -_x.dot(_z)).normalize();
        _y.crossVectors(_z, _x);
        b.light.quaternion.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
      }
    }
  });

  return <group ref={anchor} />;
}
