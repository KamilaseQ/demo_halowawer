"use client";

import { useGLTF } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { coverage } from "../coverage";
import { patchCoverage, patchNoFlip } from "../estate/materials";
import { BOR2_OFFSET } from "./exterior";
import { PLANTS_URL, placePlants } from "./plantSet";
import { rng } from "../estate/builder";
import { estateMaterials } from "../estate/materials";
import { EstateTrees, type MarkedTree, type Species } from "../estate/trees";
import { buildFoliage, grassTuftGeometry, type ShrubSpec } from "../estate/vegetation";
import type { Bor2Exterior } from "./exterior";

/* ==========================================================================
   The estate's planting where the BOR2 model puts it (ZIELEN_ZNACZNIKI:
   empty nodes at the plant's base, random Y turn, uniform scale = size).
   Ornamental grasses and perennials are one instanced tuft (one draw call,
   colour per instance), shrubs and hedges one leaf-card mesh, trees the
   estate's EZ-Tree models. Built once per model, a few ms.
   ========================================================================== */

type Marker = { name: string; kind: string; x: number; y: number; z: number; rot: number; scale: number; index: number };

/**
 * Grass and perennial tones (linear RGB, multiplied with the tuft's base→tip ramp). Muted on purpose (client
 * review: no saturated purple/yellow) until the card-based plant set (assets/zielen/rosliny.glb) lands.
 */
const GRASS_TONES: [number, number, number][] = [
  [0.62, 0.66, 0.6], // silver miscanthus
  [0.55, 0.6, 0.5], // sage fescue
  [0.64, 0.63, 0.53], // pale straw
];
const FLOWER_TONES: [number, number, number][] = [
  [0.72, 0.71, 0.66], // off-white yarrow
  [0.6, 0.58, 0.56], // dusty rose-grey
  [0.5, 0.57, 0.42], // leaves between
  [0.56, 0.6, 0.5], // sage
];

/** Tree marker → species and full height (garden trees are smaller than the woodland's). */
function treeOf(kind: string, index: number): { species: Species; h: number } | null {
  if (kind === "DRZEWO_SOSNA") return { species: (["sosna-1", "sosna-2", "sosna-3"] as Species[])[index % 3], h: 13 };
  if (kind === "DRZEWO_BRZOZA") return { species: index % 2 ? "brzoza-2" : "brzoza-1", h: 11 };
  if (kind === "DRZEWO_LISCIASTE") return { species: index % 2 ? "dab-1" : "lipa-1", h: 10 };
  if (kind === "DRZEWO_OZDOBNE") return { species: "lipa-1", h: 6.3 };
  return null;
}

/** The markers of a prepared exterior (estate space), or null when the model has none. */
export function plantingMarkers(ext: Bor2Exterior): Marker[] | null {
  const root = ext.root.getObjectByName("ZIELEN_ZNACZNIKI");
  if (!root || !root.children.length) return null;
  root.updateWorldMatrix(true, true);
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const e = new THREE.Euler();
  return root.children.map((o) => {
    o.matrixWorld.decompose(p, q, s);
    const m = /^(.*?)_(\d+)$/.exec(o.name);
    return { name: o.name, kind: m?.[1] ?? o.name, index: m ? +m[2] : 0, x: p.x, y: p.y, z: p.z, rot: e.setFromQuaternion(q, "YXZ").y, scale: s.x };
  });
}

function Tufts({ markers }: { markers: Marker[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => grassTuftGeometry(), []);
  // Grasses read as fuller clumps of 2 tufts, perennials as 3 smaller ones with flower tones.
  const list = useMemo(() => {
    const r = rng(77);
    const out: { x: number; y: number; z: number; s: number; rot: number; c: [number, number, number] }[] = [];
    for (const m of markers) {
      const grass = m.kind === "TRAWA";
      const n = grass ? 2 : 3;
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2;
        const d = (grass ? 0.18 : 0.22) * m.scale * Math.sqrt(r());
        const tones = grass ? GRASS_TONES : FLOWER_TONES;
        const base = tones[(m.index + i) % tones.length];
        const k = 0.9 + r() * 0.2;
        out.push({
          x: m.x + Math.cos(a) * d,
          y: m.y,
          z: m.z + Math.sin(a) * d,
          s: (grass ? 0.9 : 0.6) * m.scale * (0.8 + r() * 0.35),
          rot: m.rot + r() * 6.28,
          c: [base[0] * k, base[1] * k, base[2] * k],
        });
      }
    }
    return out;
  }, [markers]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const mat = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const c = new THREE.Color();
    list.forEach((t, i) => {
      q.setFromAxisAngle(up, t.rot);
      mat.compose(new THREE.Vector3(t.x, t.y, t.z), q, new THREE.Vector3(t.s * 1.1, t.s, t.s * 1.1));
      mesh.setMatrixAt(i, mat);
      mesh.setColorAt(i, c.setRGB(t.c[0], t.c[1], t.c[2], THREE.SRGBColorSpace));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [list]);

  return <instancedMesh ref={ref} name="bor2-tufts" args={[geometry, estateMaterials().plants, list.length]} receiveShadow />;
}

/** The card-based plant set is in (assets/zielen); the procedural tufts below stay only as a fallback. */
const PLANT_SET = true;

/** Plant-set variants that cast shadows (shrubs and hedges); grasses and perennials only receive them. */
const SHADOWED = /^(KRZEW|ZYWOPLOT)/;

/**
 * The card-based plant set (assets/zielen, v2): one InstancedMesh per variant (27, one shared material),
 * placed by plantSet.ts. Leaf cards lit like the trees' (no back-face normal flip), cut-out edges with
 * alpha-to-coverage under MSAA, ±6 % brightness per plant.
 */
function PlantSet({ markers }: { markers: Marker[] }) {
  const gltf = useGLTF(PLANTS_URL, false, true);
  const parts = useMemo(() => {
    const out = new Map<string, { geometry: THREE.BufferGeometry; material: THREE.Material }>();
    let shared: THREE.Material | null = null;
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      // A single-primitive node becomes the Mesh itself (node name = variant); otherwise its parent carries it.
      const variant = /^[A-Z_]+_\d$/.test(mesh.name) ? mesh.name : (mesh.parent?.name ?? mesh.name);
      if (!shared) {
        const m = (mesh.material as THREE.MeshStandardMaterial).clone();
        m.side = THREE.DoubleSide;
        m.envMapIntensity = 0.6;
        m.onBeforeCompile = (s) => {
          patchNoFlip(s);
          patchCoverage(s);
        };
        m.customProgramCacheKey = () => "bor2-plants";
        shared = coverage(m);
      }
      out.set(variant, { geometry: mesh.geometry.clone().applyMatrix4(mesh.matrixWorld), material: shared });
    });
    return out;
  }, [gltf.scene]);
  const groups = useMemo(() => {
    const [ox, oy, oz] = [BOR2_OFFSET.x, BOR2_OFFSET.y, BOR2_OFFSET.z];
    // The patch grid of the placement rules lives in the GLB frame: place there, then shift.
    const list = placePlants(markers.map((m) => ({ name: m.name, x: m.x - ox, y: m.y - oy, z: m.z - oz, rot: m.rot, scale: m.scale })));
    const by = new Map<string, typeof list>();
    for (const p of list) (by.get(p.variant) ?? by.set(p.variant, []).get(p.variant)!).push({ ...p, x: p.x + ox, y: p.y + oy, z: p.z + oz });
    return [...by].filter(([v]) => parts.has(v));
  }, [markers, parts]);

  return (
    <group name="bor2-plant-set">
      {groups.map(([variant, list]) => (
        <PlantInstances key={variant} part={parts.get(variant)!} list={list} shadow={SHADOWED.test(variant)} />
      ))}
    </group>
  );
}

function PlantInstances({ part, list, shadow }: { part: { geometry: THREE.BufferGeometry; material: THREE.Material }; list: ReturnType<typeof placePlants>; shadow: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const c = new THREE.Color();
    list.forEach((p, i) => {
      q.setFromAxisAngle(up, p.rot);
      m.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(p.sx, p.sy, p.sz));
      mesh.setMatrixAt(i, m);
      const k = 0.94 + ((i * 2654435761) % 1000) / 1000 * 0.12;
      mesh.setColorAt(i, c.setRGB(k, k, k));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [list]);
  return <instancedMesh ref={ref} args={[part.geometry, part.material, list.length]} castShadow={shadow} receiveShadow />;
}

export function Bor2Planting({ markers }: { markers: Marker[] }) {
  const shrubs = useMemo(() => {
    const specs: ShrubSpec[] = [];
    let seed = 1;
    for (const m of markers) {
      if (m.kind === "KRZEW") specs.push({ x: m.x, z: m.z, rx: 0.5 * m.scale, ry: 0.6 * m.scale, rz: 0.5 * m.scale, rot: m.rot, kind: m.index % 3 === 0 ? "hydrangea" : "garden", seed: seed++ });
      // Hedge segments: 1 m long, 1 m high, clipped (along the marker's turn).
      if (m.kind === "ZYWOPLOT") specs.push({ x: m.x, z: m.z, rx: 0.55 * m.scale, ry: 0.5 * m.scale, rz: 0.3 * m.scale, rot: m.rot, kind: "hedge", seed: seed++ });
    }
    if (!specs.length) return null;
    // Shrubs stand on the ground under their marker (the builder places them at y = 0).
    const lift = markers.find((m) => m.kind === "KRZEW" || m.kind === "ZYWOPLOT")?.y ?? 0;
    const { foliage } = buildFoliage([], specs);
    foliage.translate(0, lift, 0);
    return foliage;
  }, [markers]);

  const trees: MarkedTree[] = useMemo(
    () =>
      markers.flatMap((m) => {
        const t = treeOf(m.kind, m.index);
        return t ? [{ species: t.species, x: m.x, z: m.z, h: t.h * m.scale, rot: m.rot }] : [];
      }),
    [markers],
  );
  const tufts = useMemo(() => markers.filter((m) => m.kind === "TRAWA" || m.kind === "BYLINA"), [markers]);

  return (
    <group name="bor2-planting" userData={{ source: "zielen" }}>
      {/* The plant set covers grasses, perennials, shrubs and hedges; the procedural tufts were its stand-in. */}
      {PLANT_SET ? (
        <PlantSet markers={markers} />
      ) : (
        <>
          {tufts.length > 0 && <Tufts markers={tufts} />}
          {shrubs && <mesh name="bor2-shrubs" geometry={shrubs} material={estateMaterials().foliage} castShadow receiveShadow />}
        </>
      )}
      <EstateTrees marked={trees} />
    </group>
  );
}
