"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type DependencyList, type MutableRefObject, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import { damp } from "maath/easing";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import type { HouseModel, LevelModel } from "@/lib/estate/geometry/types";
import { useMaterials } from "../../materials/MaterialsProvider";
import { usePracticalFactor } from "../../lighting/practical";
import { applyGlow, customMaterials, setTextureListener, type CustomKey } from "./materials";
import { disposeKit, type BuiltKit, type FurnKey, type Kit } from "./kit";
import type { Vec3T } from "./geometry";

/* ==========================================================================
   Runtime glue between procedural kits and the scene: material resolution,
   instancing, dollhouse behaviour (ceiling fixtures slide away with the
   ceiling, wall-mounted parts follow the exterior-wall cutaway) and
   practical lights that follow the time of day.
   ========================================================================== */

type Runtime = {
  practical: MutableRefObject<number>;
  model: HouseModel;
  /** The level this furniture stands on (wall ids, ceiling height). */
  level: LevelModel;
  /** The level is shown whole (walk, exterior view): ceilings and full-height walls are there. */
  inside: boolean;
};

const RuntimeContext = createContext<Runtime | null>(null);

export function useFurnitureRuntime() {
  const r = useContext(RuntimeContext);
  if (!r) throw new Error("furniture runtime missing");
  return r;
}

export function FurnitureRuntime({ model, level, cut, children }: { model: HouseModel; level: LevelModel; cut: boolean; children: ReactNode }) {
  const practical = usePracticalFactor();
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    setTextureListener(() => invalidate());
    return () => setTextureListener(null);
  }, [invalidate]);
  const inside = !cut;
  const value = useMemo(() => ({ practical, model, level, inside }), [practical, model, level, inside]);
  return (
    <RuntimeContext.Provider value={value}>
      <GlowDriver />
      {children}
    </RuntimeContext.Provider>
  );
}

/** Drives every emissive practical material from the shared practical factor. */
function GlowDriver() {
  const { practical } = useFurnitureRuntime();
  const last = useRef(-1);
  useFrame(() => {
    const f = practical.current;
    if (Math.abs(f - last.current) > 1e-4) {
      applyGlow(f);
      last.current = f;
    }
  });
  return null;
}

/* ---------- kits ---------- */

const NO_SHADOW = new Set<FurnKey>(["glassClear", "glassTint", "sheer", "glowPendant", "glowCeiling", "glowLED", "glowLamp", "glowShade", "mirror"]);

export function useResolver() {
  const slots = useMaterials();
  return useMemo(() => {
    const custom = customMaterials();
    return (key: FurnKey): THREE.Material => (key in slots ? slots[key as keyof typeof slots] : custom[key as CustomKey]);
  }, [slots]);
}

/** Builds a kit once (per deps) and disposes its geometry when it changes or unmounts. */
export function useKit(build: () => Kit, deps: DependencyList = []): BuiltKit {
  // A useMemo-shaped hook: the dependency list is the caller's.
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  const kit = useMemo(() => build().build(), deps);
  useEffect(() => () => disposeKit(kit), [kit]);
  return kit;
}

type GroupProps = { position?: Vec3T; rotation?: Vec3T; scale?: number | Vec3T };

export function KitMesh({
  kit,
  castShadow = true,
  receiveShadow = true,
  ...group
}: { kit: BuiltKit; castShadow?: boolean; receiveShadow?: boolean } & GroupProps) {
  const resolve = useResolver();
  return (
    <group {...group}>
      {kit.map(({ key, geometry }) => (
        <mesh
          key={key}
          geometry={geometry}
          material={resolve(key)}
          castShadow={castShadow && !NO_SHADOW.has(key)}
          receiveShadow={receiveShadow && !NO_SHADOW.has(key)}
          renderOrder={key === "glassClear" || key === "glassTint" || key === "sheer" ? 2 : 0}
        />
      ))}
    </group>
  );
}

/** One InstancedMesh per material of a kit (dining chairs, repeated decor). */
export function KitInstances({ kit, matrices, castShadow = true }: { kit: BuiltKit; matrices: THREE.Matrix4[]; castShadow?: boolean }) {
  const resolve = useResolver();
  return (
    <>
      {kit.map(({ key, geometry }) => (
        <Instanced key={key} geometry={geometry} material={resolve(key)} matrices={matrices} castShadow={castShadow && !NO_SHADOW.has(key)} />
      ))}
    </>
  );
}

function Instanced({ geometry, material, matrices, castShadow }: { geometry: THREE.BufferGeometry; material: THREE.Material; matrices: THREE.Matrix4[]; castShadow: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    matrices.forEach((mx, i) => m.setMatrixAt(i, mx));
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
    invalidate();
  }, [matrices, invalidate]);
  return <instancedMesh ref={ref} args={[geometry, material, matrices.length]} castShadow={castShadow} receiveShadow />;
}

/* ---------- dollhouse behaviour ---------- */

/** Ceiling fixtures: slide up and hide together with the ceilings in the dollhouse (mirrors Shell). */
export function CeilingMount({ children }: { children: ReactNode }) {
  const { inside } = useFurnitureRuntime();
  const g = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const [initial] = useState(() => (inside ? 0 : 2.5));
  useFrame((_, dt) => {
    const grp = g.current;
    if (!grp) return;
    const moving = damp(grp.position, "y", inside ? 0 : 2.5, 0.2, dt);
    grp.visible = grp.position.y < 2.4;
    if (moving) invalidate();
  });
  return (
    <group ref={g} position-y={initial} visible={initial < 2.4}>
      {children}
    </group>
  );
}

/**
 * Parts mounted high on an exterior wall (kitchen uppers, curtains, mirrors): when the dollhouse cuts
 * that wall down to `at`, they fold down with it so nothing floats in front of a missing wall.
 */
export function WallCut({ wall, at = 1.0, children }: { wall: string; at?: number; children: ReactNode }) {
  const { level, inside } = useFurnitureRuntime();
  const g = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const geo = useMemo(() => {
    const w = level.walls.find((x) => x.id === wall);
    if (!w) return null;
    const X = new THREE.Vector3(w.b[0] - w.a[0], 0, w.b[1] - w.a[1]).normalize();
    const Z = new THREE.Vector3().crossVectors(X, new THREE.Vector3(0, 1, 0));
    const outward = w.sides[0] === "facade" ? Z.clone().negate() : Z.clone();
    const center = new THREE.Vector3((w.a[0] + w.b[0]) / 2, 0, (w.a[1] + w.b[1]) / 2);
    return { outward, center, exterior: !!w.exterior };
  }, [level, wall]);
  const toCam = useMemo(() => new THREE.Vector3(), []);
  const world = useMemo(() => new THREE.Vector3(), []);
  const out = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }, dt) => {
    const grp = g.current;
    if (!grp || !geo || !geo.exterior) return;
    let target = 1;
    if (!inside) {
      // World-space test: the house may be mirrored (A, C) and its levels raised.
      world.copy(geo.center);
      out.copy(geo.outward);
      if (grp.parent) {
        grp.parent.localToWorld(world);
        out.transformDirection(grp.parent.matrixWorld);
      }
      toCam.subVectors(camera.position, world).setY(0).normalize();
      target = toCam.dot(out.setY(0).normalize()) > 0.12 ? 0 : 1;
    }
    const moving = damp(grp.scale, "y", target, 0.18, dt);
    grp.visible = grp.scale.y > 0.01;
    if (moving) invalidate();
  });

  return (
    <group ref={g} position-y={at}>
      <group position-y={-at}>{children}</group>
    </group>
  );
}

/* ---------- practical lights ---------- */

/** ~3000 K warm white: warmth stays in the light pools instead of tinting whole walls. */
const WARM = "#ffe2c4";

/**
 * Drives a practical light from the time of day. The lights stay in the scene at intensity 0 by day,
 * so switching the time of day never changes (or recompiles) a shader.
 */
function usePractical(ref: RefObject<THREE.Light | null>, intensity: number) {
  const { practical } = useFurnitureRuntime();
  useFrame(() => {
    if (ref.current) ref.current.intensity = intensity * practical.current;
  });
}

export function PracticalSpot({
  position,
  target,
  intensity,
  angle = 1,
  penumbra = 0.9,
  distance = 6,
  color = WARM,
}: {
  position: Vec3T;
  target: Vec3T;
  intensity: number;
  angle?: number;
  penumbra?: number;
  distance?: number;
  color?: string;
}) {
  const ref = useRef<THREE.SpotLight>(null);
  const tgt = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    tgt.position.set(...target);
    tgt.updateMatrixWorld();
    if (ref.current) ref.current.target = tgt;
  }, [tgt, target]);
  usePractical(ref, intensity);
  return (
    <>
      <spotLight ref={ref} position={position} angle={angle} penumbra={penumbra} distance={distance} decay={2} color={color} intensity={0} />
      <primitive object={tgt} />
    </>
  );
}

export function PracticalPoint({ position, intensity, distance = 4, color = WARM }: { position: Vec3T; intensity: number; distance?: number; color?: string }) {
  const ref = useRef<THREE.PointLight>(null);
  usePractical(ref, intensity);
  return <pointLight ref={ref} position={position} distance={distance} decay={2} color={color} intensity={0} />;
}

/** RectAreaLight needs its LTC tables once per page (module state, outside any component). */
let rectLibReady = false;
function initRectAreaLights() {
  if (rectLibReady) return;
  RectAreaLightUniformsLib.init();
  rectLibReady = true;
}

/** Rect area light (LED strips). Faces its local −Z; rotation-x = −π/2 points it down. */
export function PracticalRect({
  position,
  rotation,
  width,
  height,
  intensity,
  color = WARM,
}: {
  position: Vec3T;
  rotation: Vec3T;
  width: number;
  height: number;
  intensity: number;
  color?: string;
}) {
  initRectAreaLights();
  const ref = useRef<THREE.RectAreaLight>(null);
  usePractical(ref, intensity);
  return <rectAreaLight ref={ref} args={[color, 0, width, height]} position={position} rotation={rotation} />;
}

/* ---------- dev stats ---------- */

/** Dev-only: window.__furnStats() → triangles / draw calls / lights of what's currently visible. */
export function StatsProbe() {
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    // Furniture only (groups named "furnishing"): visible triangles and draw calls (one per mesh or material group).
    const furn = window as unknown as { __furnBudget?: () => unknown; __furnFrame?: () => Promise<unknown> };
    furn.__furnBudget = () => {
      const perLevel: Record<string, { triangles: number; draws: number }> = {};
      const meshes: [number, string][] = [];
      let lights = 0;
      scene.traverse((o) => {
        if ((o as THREE.Light).isLight && o.name.startsWith("practical:")) lights++;
      });
      scene.traverse((root) => {
        if (root.name !== "furnishing") return;
        const tag = String(root.userData.level ?? "?");
        const acc = (perLevel[tag] ??= { triangles: 0, draws: 0 });
        root.traverseVisible((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh || !m.geometry) return;
          const g = m.geometry;
          const count = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1;
          const tris = ((g.index ? g.index.count : g.getAttribute("position").count) / 3) * count;
          acc.triangles += tris;
          acc.draws += Array.isArray(m.material) ? Math.max(1, g.groups.length) : 1;
          const name = Array.isArray(m.material) ? m.material.map((x) => x.name).join("+") : m.material.name;
          meshes.push([Math.round(tris), `L${tag} ${name || m.name || "?"}`]);
        });
      });
      const total = Object.values(perLevel).reduce((a, b) => ({ triangles: a.triangles + b.triangles, draws: a.draws + b.draws }), { triangles: 0, draws: 0 });
      const top = meshes
        .sort((a, b) => b[0] - a[0])
        .slice(0, 30)
        .map(([n, s]) => `${s}:${(n / 1000).toFixed(1)}k`);
      return { perLevel, total, practicalLights: lights, programs: (gl.info.programs ?? []).length, top };
    };
    // Whole frame as the GPU sees it (all passes): calls and triangles accumulated over one rendered frame.
    furn.__furnFrame = () =>
      new Promise((resolve) => {
        const info = gl.info;
        const auto = info.autoReset;
        info.autoReset = false;
        info.reset();
        invalidate();
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const out = { calls: info.render.calls, triangles: info.render.triangles, programs: (info.programs ?? []).length, geometries: info.memory.geometries, textures: info.memory.textures };
            info.autoReset = auto;
            resolve(out);
          }),
        );
      });
    const w = window as unknown as { __furnStats?: () => unknown };
    w.__furnStats = () => {
      let triangles = 0;
      let meshes = 0;
      const lights: Record<string, number> = {};
      const byName: Record<string, number> = {};
      scene.traverseVisible((o) => {
        if ((o as THREE.Light).isLight) lights[o.type] = (lights[o.type] ?? 0) + 1;
        const m = o as THREE.Mesh;
        if (!m.isMesh || !m.geometry) return;
        const g = m.geometry;
        const n = ((g.index ? g.index.count : g.getAttribute("position").count) / 3) * ((m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1);
        triangles += n;
        meshes++;
        const name = (Array.isArray(m.material) ? m.material[0] : m.material)?.name || m.name || "?";
        byName[name] = (byName[name] ?? 0) + n;
      });
      const top = Object.entries(byName)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 14)
        .map(([k, v]) => `${k}:${Math.round(v / 1000)}k`);
      return { triangles, meshes, lights, top };
    };
    const f = window as unknown as { __furnFind?: (name: string) => unknown };
    f.__furnFind = (name: string) => {
      const out: unknown[] = [];
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        const matName = m.isMesh ? (Array.isArray(m.material) ? m.material[0] : m.material)?.name : "";
        if (o.name.includes(name) || matName?.includes(name)) {
          const box = new THREE.Box3().setFromObject(o);
          out.push({ name: o.name, mat: matName, visible: o.visible, min: box.min.toArray().map((v) => +v.toFixed(3)), max: box.max.toArray().map((v) => +v.toFixed(3)) });
        }
      });
      return out.slice(0, 12);
    };
    return () => {
      delete w.__furnStats;
      delete f.__furnFind;
      delete furn.__furnBudget;
      delete furn.__furnFrame;
    };
  }, [scene, gl, invalidate]);
  return null;
}
