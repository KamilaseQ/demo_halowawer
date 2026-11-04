import * as THREE from "three";
import { coverage } from "../coverage";
import { ESTATE_CENTER } from "@/lib/estate/geometry/site";
import { deviceTier } from "../../tier";
import { lazyTexture } from "../loading";
import { rng } from "./builder";
import { patchCoverage, patchNoFlip } from "./materials";
import { NEIGHBOURS, PITCH } from "./plan";

/* ==========================================================================
   The Wawer pine belt around the estate (as on the developer's renders and
   drone photos), in two layers:
   - near belt (105–150 m): real tree models, instanced (trees.tsx reads
     forestSpots());
   - deep woodland (130–330 m): thousands of impostors, two crossed quads per
     tree cut from a pre-lit atlas (las-impostory.webp, 3 pines in 2 views +
     2 birches, docs/inwestycja-3d/assets/README.md). The front rows mix in
     birches and low young birches as underwood, so the bare pine stems never
     line up like parasols; behind them the crowns overlap into one wall that
     the fog melts into the sky. ~4 triangles per tree, one draw call.
   ========================================================================== */

const [CX, , CZ] = ESTATE_CENTER;
/** Azimuth (estate XZ, radians) of the overview camera (ESTATE_SHOT) seen from the centre; keep that sector open. */
const CAMERA_DIR = Math.atan2(86 - CZ, 100 - CX);

/** Smooth stand/clearing pattern (sum of rotated sines, ~0..1). */
function stand(x: number, z: number, seed: number) {
  const s = (a: number, b: number, f: number, p: number) => Math.sin(a * f + p) * Math.cos(b * f * 0.83 - p * 0.7);
  return 0.5 + 0.25 * s(x, z, 0.021, seed) + 0.17 * s(z, x, 0.047, seed * 1.7) + 0.08 * s(x + z, x - z, 0.09, seed * 2.3);
}

function blocked(x: number, z: number, d: number, a: number) {
  const da = Math.abs(Math.atan2(Math.sin(a - CAMERA_DIR), Math.cos(a - CAMERA_DIR)));
  if (da < 0.62 && d < 200) return true;
  if (Math.abs(x - PITCH.cx) < PITCH.w / 2 + 6 && Math.abs(z - PITCH.cz) < PITCH.d / 2 + 6) return true;
  return NEIGHBOURS.some((n) => Math.hypot(n.x - x, n.z - z) < Math.max(n.w, n.d) * 0.8 + 6);
}

/* ---------------------------------------------------------------- near belt (models) */

export type ForestSpot = { x: number; z: number; h: number; kind: "pine" | "leafy"; r: number; d: number };

/** Outer edge of the near belt drawn with the real tree models (capable devices only). */
export const NEAR_BELT = 150;

/** Positions of the near belt's model trees (deterministic). */
export function forestSpots(): ForestSpot[] {
  const r = rng(907);
  const out: ForestSpot[] = [];
  let guard = 0;
  while (out.length < 110 && guard++ < 6000) {
    const a = r() * Math.PI * 2;
    const d = 105 + r() * (NEAR_BELT - 105);
    const x = CX + Math.cos(a) * d;
    const z = CZ + Math.sin(a) * d;
    if (blocked(x, z, d, a) || stand(x, z, 3.1) < 0.47 + r() * 0.12) continue;
    // Front rows: half leafy (birch, linden), so the edge of the wood is soft, not a row of stems.
    const pine = r() < 0.5;
    out.push({ x, z, kind: pine ? "pine" : "leafy", h: pine ? 14 + r() * 10 : 9 + r() * 7, r: r(), d });
  }
  return out;
}

/* ---------------------------------------------------------------- deep woodland (impostors) */

type Cell = { uv: [number, number, number, number]; heightM: number; cellWidthM: number };

/** Atlas cells (las-impostory.json): 0–2 and 4–6 pines, 3 and 7 birches; anchor = bottom centre. */
const PINES: Cell[] = [
  { uv: [0, 0.5, 0.25, 0.5], heightM: 21, cellWidthM: 10.71 },
  { uv: [0.25, 0.5, 0.25, 0.5], heightM: 17, cellWidthM: 8.67 },
  { uv: [0.5, 0.5, 0.25, 0.5], heightM: 18, cellWidthM: 9.18 },
  { uv: [0, 0, 0.25, 0.5], heightM: 21, cellWidthM: 10.71 },
  { uv: [0.25, 0, 0.25, 0.5], heightM: 17, cellWidthM: 8.67 },
  { uv: [0.5, 0, 0.25, 0.5], heightM: 18, cellWidthM: 9.18 },
];
const BIRCHES: Cell[] = [
  { uv: [0.75, 0.5, 0.25, 0.5], heightM: 15, cellWidthM: 10.13 },
  { uv: [0.75, 0, 0.25, 0.5], heightM: 13, cellWidthM: 12.27 },
];

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Deep-woodland impostor geometry (positions, up-leaning normals, atlas UVs, per-tree tint). With `woods`
 * (the real woods around the estate from OpenStreetMap, estate XZ) the trees stand there, plus a thin ring
 * far out (440–640 m) that closes the horizon behind the neighbourhood; without, the procedural pine belt.
 */
function impostors(woods?: { x: number; z: number }[]) {
  const lite = deviceTier() === "lite";
  const trees = lite ? 1500 : 3400;
  const underwood = lite ? 450 : 1300;
  const r = rng(5150);
  const pos: number[] = [];
  const nrm: number[] = [];
  const uv: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const n = new THREE.Vector3();

  const quad = (x: number, z: number, yaw: number, w: number, h: number, cell: Cell, tint: number) => {
    const dx = Math.cos(yaw) * (w / 2);
    const dz = Math.sin(yaw) * (w / 2);
    // Lit mostly from above, a little from the face: even, soft shading on both sides (patchNoFlip).
    n.set(-Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(0.3).add(UP).normalize();
    const base = pos.length / 3;
    const [u0, v0, du, dv] = cell.uv;
    const corners: [number, number, number, number, number][] = [
      [x - dx, 0, z - dz, u0, v0],
      [x + dx, 0, z + dz, u0 + du, v0],
      [x + dx, h, z + dz, u0 + du, v0 + dv],
      [x - dx, h, z - dz, u0, v0 + dv],
    ];
    for (const [px, py, pz, u, v] of corners) {
      pos.push(px, py, pz);
      nrm.push(n.x, n.y, n.z);
      uv.push(u, v);
      col.push(tint, tint, tint * 0.97);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  const tree = (x: number, z: number, cell: Cell, height: number) => {
    const s = height / cell.heightM;
    const w = cell.cellWidthM * s;
    const h = cell.cellWidthM * 2 * s;
    const yaw = r() * Math.PI;
    // Pre-lit atlas, so darken it towards a dense wood (deeper further out) and vary it tree by tree.
    const tint = (0.56 + r() * 0.22) * (1 - Math.min(0.18, Math.max(0, (Math.hypot(x - CX, z - CZ) - 150) / 900)));
    quad(x, z, yaw, w, h, cell, tint);
    quad(x, z, yaw + Math.PI / 2, w, h, cell, tint);
  };

  if (woods) {
    for (const p of woods) {
      const birch = r() < 0.22;
      if (birch) tree(p.x, p.z, BIRCHES[Math.floor(r() * 2)], 10 + r() * 6);
      else tree(p.x, p.z, PINES[Math.floor(r() * 6)], 14 + r() * 9);
    }
    for (let i = 0; i < (lite ? 500 : 1100); i++) {
      const a = r() * Math.PI * 2;
      const d = 440 + r() * 200;
      const x = CX + Math.cos(a) * d;
      const z = CZ + Math.sin(a) * d;
      if (stand(x, z, 3.1) < 0.4) continue;
      tree(x, z, PINES[Math.floor(r() * 6)], 15 + r() * 10);
    }
    return finishGeometry(pos, nrm, uv, col, idx);
  }

  let placed = 0;
  let guard = 0;
  while (placed < trees && guard++ < trees * 12) {
    const a = r() * Math.PI * 2;
    const d = 130 + Math.pow(r(), 0.85) * 200;
    const x = CX + Math.cos(a) * d;
    const z = CZ + Math.sin(a) * d;
    if (blocked(x, z, d, a) || stand(x, z, 3.1) < 0.44 + r() * 0.1) continue;
    // Birches in the first rows, then pine wood; heights ±30%.
    const birch = r() < (d < 175 ? 0.42 : 0.12);
    // Uneven crown line: stands of taller old pines among younger ones (±30%).
    const old = stand(x, z, 7.7) > 0.55 ? 1.08 : 0.9;
    if (birch) tree(x, z, BIRCHES[Math.floor(r() * 2)], (9 + r() * 7) * old);
    else tree(x, z, PINES[Math.floor(r() * 6)], (13 + r() * 9) * old);
    placed++;
  }
  // Underwood: young birches along the wood's edge, hiding the bare pine stems.
  guard = 0;
  let low = 0;
  while (low < underwood && guard++ < underwood * 12) {
    const a = r() * Math.PI * 2;
    const d = 126 + Math.pow(r(), 1.4) * 110;
    const x = CX + Math.cos(a) * d;
    const z = CZ + Math.sin(a) * d;
    if (blocked(x, z, d, a) || stand(x, z, 3.1) < 0.42) continue;
    tree(x, z, BIRCHES[Math.floor(r() * 2)], 4.5 + r() * 5);
    low++;
  }

  return finishGeometry(pos, nrm, uv, col, idx);
}

function finishGeometry(pos: number[], nrm: number[], uv: number[], col: number[], idx: number[]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** The deep woodland: one impostor mesh and its material (alpha-tested, fogged, no shadows). */
export function buildForest(woods?: { x: number; z: number }[]) {
  const map = lazyTexture("/explorer/3d/models/las-impostory.webp");
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const material = new THREE.MeshStandardMaterial({
    map,
    vertexColors: true,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    roughness: 1,
    metalness: 0,
    envMapIntensity: 0.5,
  });
  // With MSAA on, the cut-out edges resolve smoothly instead of shimmering.
  coverage(material);
  material.onBeforeCompile = (shader) => {
    patchNoFlip(shader);
    patchCoverage(shader);
    // The stage fog is tuned for the whole scene; at 130–330 m it would wash the wood out to grey. Keep
    // ~55% of it: depth reads, the pines stay green.
    shader.fragmentShader = shader.fragmentShader.replace("#include <fog_fragment>", "#ifdef USE_FOG\n  #ifdef FOG_EXP2\n    float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);\n  #else\n    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);\n  #endif\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor * 0.55);\n#endif");
  };
  material.customProgramCacheKey = () => "estate-impostors";
  return { geometry: impostors(woods), material };
}
