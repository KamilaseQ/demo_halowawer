"use client";

import { useGLTF } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { deviceTier } from "../../tier";
import { rng } from "./builder";
import { forestSpots, NEAR_BELT } from "./forest";
import { corridorClearance } from "./landscape";
import { patchCoverage, patchNoFlip } from "./materials";
import { TREES } from "./plan";

/* ==========================================================================
   Real tree models (EZ-Tree, MIT; docs/inwestycja-3d/assets/README.md):
   Scots pines with tall bare orange stems, birches, an oak and a linden,
   drawn as instances (two draw calls per species: bark and leaves, plus a
   shadowless copy for the woodland belt). Positions: the curated TREES
   (they keep every house-view corridor clear), two meadow solitaires and,
   on capable devices, the near woodland belt around the estate.
   ========================================================================== */

const URL = "/explorer/3d/models/drzewa.glb";

type Species = "sosna-1" | "sosna-2" | "sosna-3" | "brzoza-1" | "brzoza-2" | "dab-1" | "lipa-1";

/** Model heights, metres (each tree stands at its node origin). */
const HEIGHT: Record<Species, number> = {
  "sosna-1": 21,
  "sosna-2": 17,
  "sosna-3": 18,
  "brzoza-1": 15,
  "brzoza-2": 13,
  "dab-1": 16,
  "lipa-1": 14,
};
const SPECIES = Object.keys(HEIGHT) as Species[];

type Placed = { species: Species; x: number; z: number; scale: number; rot: number; shadow: boolean; tint: number };

/** Broad leafy solitaires on the south meadow (outside every view corridor): the "like a render" foreground. */
const SOLITAIRES: { species: Species; x: number; z: number; h: number }[] = [
  { species: "dab-1", x: 8, z: 34, h: 16 },
  { species: "lipa-1", x: 46, z: 40, h: 14 },
  // A loose group framing the overview on the right (east of A, outside its view triangle).
  { species: "dab-1", x: 104, z: 46, h: 17 },
  { species: "brzoza-1", x: 99, z: 58, h: 14 },
  { species: "brzoza-2", x: 108, z: 62, h: 12 },
  { species: "sosna-2", x: 112, z: 38, h: 19 },
];

/**
 * The overview camera (ESTATE_SHOT, from the SSE) looks along the row: nothing tall may stand in the
 * triangle between it and the row's two ends, or a trunk would cut through the houses.
 */
const VIEW: [number, number][] = [
  [100, 86],
  [-6, 4],
  [80, 30],
];
function inOverview(x: number, z: number, pad: number) {
  const [a, b, c] = VIEW;
  const side = (p: [number, number], q: [number, number]) => (q[0] - p[0]) * (z - p[1]) - (q[1] - p[1]) * (x - p[0]);
  const d1 = side(a, b);
  const d2 = side(b, c);
  const d3 = side(c, a);
  const inside = (d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0);
  if (inside) return true;
  // Near an edge counts too (the crown is wide).
  const dist = (p: [number, number], q: [number, number]) => {
    const vx = q[0] - p[0];
    const vz = q[1] - p[1];
    const t = Math.max(0, Math.min(1, ((x - p[0]) * vx + (z - p[1]) * vz) / (vx * vx + vz * vz)));
    return Math.hypot(x - (p[0] + vx * t), z - (p[1] + vz * t));
  };
  return Math.min(dist(a, b), dist(b, c), dist(c, a)) < pad;
}

function placements(): Placed[] {
  const r = rng(2121);
  const out: Placed[] = [];
  const add = (species: Species, x: number, z: number, h: number, shadow: boolean) =>
    out.push({ species, x, z, scale: (h / HEIGHT[species]) * (0.95 + r() * 0.1), rot: r() * Math.PI * 2, shadow, tint: r() });

  for (const t of TREES) {
    // Same guard as the procedural trees had: nothing tall in a house-view corridor.
    if (corridorClearance(t.x, t.z) <= (t.kind === "birch" ? 3.2 : 4.2)) continue;
    // Behind the row (north of the street facades) trees frame the view; in front of it they would block it.
    if (t.z > 0 && inOverview(t.x, t.z, t.kind === "birch" ? 3 : 4)) continue;
    const species: Species = t.kind === "pine" ? (`sosna-${(t.seed % 3) + 1}` as Species) : (`brzoza-${(t.seed % 2) + 1}` as Species);
    add(species, t.x, t.z, t.h, true);
  }
  for (const s of SOLITAIRES) if (corridorClearance(s.x, s.z) > 7 && !inOverview(s.x, s.z, 6)) add(s.species, s.x, s.z, s.h, true);

  // Near woodland belt with real models on capable devices (the far ring stays procedural: forest.ts).
  if (deviceTier() === "full") {
    for (const s of forestSpots()) {
      if (s.d >= NEAR_BELT) continue;
      const species: Species = s.kind === "pine" ? (`sosna-${1 + Math.floor(s.r * 3)}` as Species) : s.r > 0.6 ? "brzoza-1" : s.r > 0.3 ? "lipa-1" : "brzoza-2";
      add(species, s.x, s.z, s.h, false);
    }
  }
  return out;
}

type Part = { geometry: THREE.BufferGeometry; material: THREE.Material; matrix: THREE.Matrix4; leaves: boolean };

/** Bark and leaf meshes of each species, with their transform relative to the tree's base. */
function speciesParts(scene: THREE.Object3D): Record<Species, Part[]> {
  scene.updateMatrixWorld(true);
  const out = {} as Record<Species, Part[]>;
  for (const species of SPECIES) {
    const node = scene.getObjectByName(species);
    const parts: Part[] = [];
    node?.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const source = mesh.material as THREE.MeshStandardMaterial;
      const leaves = source.alphaTest > 0 || source.transparent;
      let material: THREE.Material = source;
      if (leaves) {
        // Leaf cards lit with their outward normal on both faces (no black undersides), slightly softer.
        const m = source.clone();
        m.side = THREE.DoubleSide;
        m.roughness = 0.82;
        m.envMapIntensity = 0.7;
        // Smooth cut-out edges under MSAA, and crowns that stay full at a distance.
        if (m.alphaTest > 0) m.alphaToCoverage = true;
        m.onBeforeCompile = (s) => {
          patchNoFlip(s);
          patchCoverage(s);
        };
        m.customProgramCacheKey = () => "estate-tree-leaves";
        material = m;
      }
      parts.push({ geometry: mesh.geometry, material, matrix: mesh.matrixWorld.clone(), leaves });
    });
    out[species] = parts;
  }
  return out;
}

function Instances({ part, list, shadow }: { part: Part; list: Placed[]; shadow: boolean }) {
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
      m.compose(new THREE.Vector3(p.x, 0, p.z), q, new THREE.Vector3(p.scale, p.scale, p.scale)).multiply(part.matrix);
      mesh.setMatrixAt(i, m);
      // Crowns are never clones: ±8% brightness and a slight hue drift per tree.
      if (part.leaves) mesh.setColorAt(i, c.setHSL(0.24 + (p.tint - 0.5) * 0.02, 0.08, 0.92 + (p.tint - 0.5) * 0.16));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [part, list]);
  return (
    <instancedMesh
      ref={ref}
      args={[part.geometry, part.material, list.length]}
      castShadow={shadow}
      receiveShadow
      frustumCulled={false}
    />
  );
}

/** All model trees of the estate (near trees cast shadows, the woodland belt does not). */
export function EstateTrees() {
  // Meshopt-compressed GLB with WebP textures; the loading gate waits for it like any other asset.
  const { scene } = useGLTF(URL, false, true);
  const parts = useMemo(() => speciesParts(scene), [scene]);
  const groups = useMemo(() => {
    const all = placements();
    const out: { key: string; part: Part; list: Placed[]; shadow: boolean }[] = [];
    for (const species of SPECIES) {
      for (const shadow of [true, false]) {
        const list = all.filter((p) => p.species === species && p.shadow === shadow);
        if (!list.length) continue;
        parts[species].forEach((part, i) => out.push({ key: `${species}-${i}-${shadow}`, part, list, shadow }));
      }
    }
    return out;
  }, [parts]);
  return (
    <group name="estate-trees">
      {groups.map((g) => (
        <Instances key={g.key} part={g.part} list={g.list} shadow={g.shadow} />
      ))}
    </group>
  );
}

useGLTF.preload(URL, false, true);
