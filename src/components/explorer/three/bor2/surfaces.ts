import * as THREE from "three";
import { estateBuild } from "../estate/build";
import { lazyTexture } from "../loading";
import { bor2Glass } from "./glass";

/* ==========================================================================
   Surfaces the runtime owns on the BOR2 model (05-odbior-bor2.md): lawns,
   paving, grass pavers and window panes. Matched by BOR2 material name;
   59 styles everything else (plaster, roofs, joinery, fences, decks).

   All textured ones are laid out in world metres by triplanar projection:
   tops take XZ, walls take XY or ZY by their dominant axis. So kerb sides
   and deck edges never get the smeared streaks of a top-down mapping, and
   SketchUp's arbitrary UVs never set the scale.
   ========================================================================== */

/** Vertex-stage triplanar UV (per vertex: SketchUp's flat faces keep one projection per face). */
const TRIPLANAR = /* glsl */ `#include <uv_vertex>
  vec3 triW = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 triN = abs(normalize(mat3(modelMatrix) * normal));
  vec2 triUv = triN.y > 0.7 ? triW.xz : (triN.x > triN.z ? triW.zy : triW.xy);
  #ifdef USE_MAP
    vMapUv = (mapTransform * vec3(triUv, 1.0)).xy;
  #endif
  #ifdef USE_NORMALMAP
    vNormalMapUv = (normalMapTransform * vec3(triUv, 1.0)).xy;
  #endif`;

function triplanar(m: THREE.MeshStandardMaterial, key: string, fragment?: (s: THREE.WebGLProgramParametersWithUniforms) => void) {
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace("#include <uv_vertex>", TRIPLANAR);
    fragment?.(shader);
  };
  m.customProgramCacheKey = () => `bor2-${key}`;
  return m;
}

const cache = new Map<string, THREE.Material>();
const once = (key: string, make: () => THREE.Material) => {
  let m = cache.get(key);
  if (!m) cache.set(key, (m = make()));
  return m;
};

/** Window panes: sky reflection over an interior-mapped room with curtains, lit at night (glass.ts). */
const glass = () => once("glass", () => bor2Glass());

/** Concrete pavers (PavingStones128, one tile per 2 m). */
const paving = () =>
  once("paving", () => {
    const base = estateBuild().materials.paving;
    const m = base.clone();
    m.name = "bor2-kostka";
    // Shares the maquette's textures (repeat wrapping, 1 tile per 2 m): no second upload.
    return triplanar(m, "paving");
  });

/** Grass pavers: 60 × 40 cm blocks (the texture's 1.2 m tile holds 2 × 3), toned down, darker grass. */
const grassPavers = () =>
  once("grassPavers", () => {
    const base = estateBuild().materials.grassPavers;
    const m = base.clone();
    m.name = "bor2-geokrata";
    m.color.set("#a3a59b");
    return triplanar(m, "grass-pavers");
  });

/**
 * Garden lawns: the photographic Grass004 at 2.5 m, a deeper olive-green tint, mowing stripes 0.9 m wide
 * along the gardens (N–S) and a slow ±6% drift so a lawn is never one flat colour.
 */
const lawn = () =>
  once("lawn", () => {
    const map = lazyTexture("/explorer/3d/ground/Grass004/color.jpg");
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(1 / 2.5, 1 / 2.5);
    map.anisotropy = 8;
    const m = new THREE.MeshStandardMaterial({ name: "bor2-trawnik", map, color: "#c3cfa4", roughness: 0.96, metalness: 0, envMapIntensity: 0.5 });
    return triplanar(m, "lawn", (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vLawnW;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvLawnW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vLawnW;").replace(
        "#include <map_fragment>",
        /* glsl */ `#include <map_fragment>
  {
    float stripe = smoothstep(0.42, 0.58, abs(fract(vLawnW.x / 1.8) * 2.0 - 1.0));
    float fw = fwidth(vLawnW.x / 1.8);
    diffuseColor.rgb *= mix(1.0, 0.955 + 0.09 * stripe, 1.0 - smoothstep(0.15, 0.5, fw));
    vec2 q = vLawnW.xz / 7.0;
    float drift = sin(q.x * 1.7 + sin(q.y * 1.3)) * sin(q.y * 1.9 + 0.7);
    diffuseColor.rgb *= 1.0 + 0.06 * drift;
  }`,
      );
    });
  });

const SURFACES: [RegExp, () => THREE.Material][] = [
  [/^SZYB/i, glass],
  [/^OTOCZENIE/i, lawn],
  // "SKP Default" in ZIEMIA is the driveways' paving (D-004): pavers, never a lawn fallback.
  [/^(DROGA|\[Asphalt|ASFALT|KOSTKA|SKP Default)/i, paving],
  [/^GEOKRATA/i, grassPavers],
];

/** Ground materials the runtime knows; anything else under ZIEMIA is reported (regression check, D-004). */
const GROUND_KNOWN = /^(OTOCZENIE|DROGA|\[Asphalt|ASFALT|KOSTKA|SKP Default|GEOKRATA)/i;

/** The runtime's surface for a BOR2 material, or the material itself. */
export const surfaceFor = (m: THREE.Material, ground = false) => {
  const hit = SURFACES.find(([re]) => re.test(m.name))?.[1]();
  if (!hit && ground && !GROUND_KNOWN.test(m.name)) console.error(`[bor2] unmapped ground material "${m.name}": add it to SURFACES (bor2/surfaces.ts)`);
  return hit ?? m;
};
