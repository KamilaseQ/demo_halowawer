"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useFurnitureRuntime } from "./runtime";
import { poolTexture } from "./textures";

/* ==========================================================================
   Warm light pools: additive footprints of spots and downlights on the
   surfaces they hit (island top, floor). They give the render's "warmth on
   surfaces and in cones" without extra real lights, and fade in with the
   practical factor (invisible by day).
   ========================================================================== */

/** A footprint centred at (x, y, z) on a horizontal surface; r along x, rz along z. */
export type Pool = { x: number; y: number; z: number; r: number; rz?: number };

export function LightPools({ pools, color = "#ffc58c", strength = 0.4 }: { pools: Pool[]; color?: string; strength?: number }) {
  const { practical } = useFurnitureRuntime();
  const mesh = useRef<THREE.Mesh>(null);
  const key = JSON.stringify(pools);
  const res = useMemo(() => {
    const parts = pools.map((p) =>
      new THREE.PlaneGeometry(2 * p.r, 2 * (p.rz ?? p.r)).rotateX(-Math.PI / 2).translate(p.x, p.y, p.z),
    );
    const geo = mergeGeometries(parts) ?? new THREE.BufferGeometry();
    parts.forEach((g) => g.dispose());
    const mat = new THREE.MeshBasicMaterial({
      color,
      map: poolTexture(),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      name: "furn:lightPool",
    });
    return { geo, mat };
    // Pools arrive as literals; the serialised key keeps the geometry stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, color]);
  useEffect(
    () => () => {
      res.geo.dispose();
      res.mat.dispose();
    },
    [res],
  );
  // eslint-disable-next-line react-hooks/immutability -- a three.js material eased every frame; not React state
  useFrame(() => {
    const o = strength * practical.current;
    // eslint-disable-next-line react-hooks/immutability -- a three.js material eased every frame; not React state
    res.mat.opacity = o;
    if (mesh.current) mesh.current.visible = o > 0.002;
  });
  return <mesh ref={mesh} geometry={res.geo} material={res.mat} renderOrder={3} visible={false} />;
}
