import * as THREE from "three";
import { lazyTexture } from "../loading";
import { FENCE_TILE, GRID_TILE, PAVER_TILE, makeFenceTexture, makeFoliageTexture, makeGrassPaverTexture } from "./textures";

/* ==========================================================================
   Estate materials: created once per page (module level, lazily), standard
   PBR so they follow the stage's sun, hemisphere and IBL. Nothing switches a
   shader at runtime: the sold look, the ground's horizon colour and the
   highlight shell are driven by uniforms only.
   ========================================================================== */

/** 0 → plain, 1 → sold houses desaturated (eased by EstateWorld with `highlight`). */
export const SOLD_MIX = { value: 0 };
/** Horizon colour the ground fades into (copied from scene.fog when the stage has one). */
export const HORIZON = { value: new THREE.Color("#e9dfd2") };

type Shader = THREE.WebGLProgramParametersWithUniforms;

/** Per-vertex roughness/metalness/pattern from attribute `aRM` (pattern 1 = plaster). */
function patchRM(shader: Shader) {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nattribute vec3 aRM;\nvarying vec3 vRM;\nvarying vec3 vObj;")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRM = aRM;\nvObj = transformed;");
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", "#include <common>\nvarying vec3 vRM;\nvarying vec3 vObj;")
    .replace("#include <roughnessmap_fragment>", "float roughnessFactor = vRM.x;")
    .replace("#include <metalnessmap_fragment>", "float metalnessFactor = vRM.y;");
}

/**
 * Plaster texture (pattern 1): fine float-finish grain plus a soft trowel mottling, in object space so
 * it sticks to the walls; the grain fades out where it would be finer than a pixel.
 */
function patchPlaster(shader: Shader) {
  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <common>",
      `#include <common>
float pHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float pNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(pHash(i), pHash(i + vec3(1, 0, 0)), f.x), mix(pHash(i + vec3(0, 1, 0)), pHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(pHash(i + vec3(0, 0, 1)), pHash(i + vec3(1, 0, 1)), f.x), mix(pHash(i + vec3(0, 1, 1)), pHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}`,
    )
    .replace(
      "#include <color_fragment>",
      `#include <color_fragment>
  {
    vec3 q = vObj * 26.0;
    float fw = length(fwidth(q));
    float keep = 1.0 - smoothstep(0.35, 1.1, fw);
    float grain = pNoise(q) * 0.6 + pNoise(q * 2.3) * 0.4;
    float mottle = pNoise(vObj * 1.6 + 7.0);
    float plaster = step(0.5, vRM.z) * step(vRM.z, 1.5);
    diffuseColor.rgb *= 1.0 + plaster * ((grain - 0.5) * 0.06 * keep + (mottle - 0.5) * 0.035);
    // Standing-seam roof (pattern 2): a seam every 0.5 m down the slope (ridge along object z), each
    // panel a hair different in tone; from afar the seams fade to their average instead of shimmering.
    float roof = step(1.5, vRM.z);
    float sz = vObj.z / 0.5;
    float fwz = fwidth(sz);
    float seamD = abs(fract(sz + 0.5) - 0.5);
    float seam = 1.0 - smoothstep(0.035, 0.035 + fwz * 1.5, seamD);
    float near = 1.0 - smoothstep(0.25, 0.6, fwz);
    float panel = pHash(vec3(floor(sz), 3.1, 7.7)) - 0.5;
    diffuseColor.rgb *= 1.0 + roof * (near * (panel * 0.06 - seam * 0.24) - (1.0 - near) * 0.05);
  }`,
    )
    .replace("float roughnessFactor = vRM.x;", "float roughnessFactor = vRM.x + step(0.5, vRM.z) * (pNoise(vObj * 9.0) - 0.5) * 0.08;");
}

/**
 * Glass with a room behind it ("interior mapping"): the view ray continues through the pane into a virtual
 * room in the house's own space (storey-high cells, ~4.9 × 4.1 m), so every window shows a floor, a
 * ceiling and walls with furniture that shift with parallax as the camera moves. Daylight falls off into
 * the room; at night most rooms glow with warm lamps. On top sits the physical material's own sky/sun
 * reflection, plus a soft sky gradient at grazing angles so no pane ever reads as a black hole.
 */
export const GLASS_SKY = { value: new THREE.Color("#b9c8d4") };
export const GLASS_GROUND = { value: new THREE.Color("#7c7e76") };
/** 0 = day, 1 = night: driven by EstateWorld from the time of day (eased). */
export const INTERIOR_NIGHT = { value: 0 };
/** Interior brightness by day (rooms read darker than the sunlit facade, as in a photo). */
export const INTERIOR_DAY = { value: 0.55 };
function patchGlass(shader: Shader) {
  shader.uniforms.uSky = GLASS_SKY;
  shader.uniforms.uGround = GLASS_GROUND;
  shader.uniforms.uNight = INTERIOR_NIGHT;
  shader.uniforms.uDay = INTERIOR_DAY;
  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      `#include <common>
varying vec3 vObjG;
varying vec3 vCamObjG;
varying vec3 vSeed;`,
    )
    .replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
  vObjG = transformed;
  vCamObjG = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
  vSeed = modelMatrix[3].xyz;`,
    );
  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <common>",
      `#include <common>
uniform vec3 uSky;
uniform vec3 uGround;
uniform float uNight;
uniform float uDay;
varying vec3 vObjG;
varying vec3 vCamObjG;
varying vec3 vSeed;
float iHash(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
vec3 interiorRoom(out float lit) {
  const vec3 CELL = vec3(4.9, 2.94, 4.1);
  const float CEIL = 2.64;
  vec3 rd = normalize(vObjG - vCamObjG);
  rd += vec3(1e-5);
  vec3 p = vObjG + rd * 0.03;
  vec3 cell = floor(p / CELL);
  vec3 lo = cell * CELL;
  vec3 hi = lo + vec3(CELL.x, CEIL, CELL.z);
  float tX = (mix(lo.x, hi.x, step(0.0, rd.x)) - p.x) / rd.x;
  float tY = (mix(lo.y, hi.y, step(0.0, rd.y)) - p.y) / rd.y;
  float tZ = (mix(lo.z, hi.z, step(0.0, rd.z)) - p.z) / rd.z;
  float t = min(tX, min(tY, tZ));
  vec3 h = p + rd * t;
  vec3 l = clamp((h - lo) / vec3(CELL.x, CEIL, CELL.z), 0.0, 1.0);
  vec3 id = cell + floor(vSeed * 0.37);
  float r1 = iHash(id);
  float r2 = iHash(id + 17.0);
  float r3 = iHash(id + 41.0);
  vec3 wall = mix(vec3(0.74, 0.70, 0.64), vec3(0.58, 0.62, 0.55), step(0.78, r1));
  vec3 col;
  if (t == tY) {
    if (rd.y < 0.0) {
      // Oak floor: planks along x, a rug in the middle of some rooms.
      float plank = iHash(vec3(floor(h.z * 6.0), floor(h.x * 0.8 + h.z), 3.0));
      col = vec3(0.34, 0.25, 0.17) * (0.84 + 0.26 * plank);
      vec2 rug = abs(l.xz - 0.5);
      col = mix(col, vec3(0.62, 0.58, 0.52), step(rug.x, 0.22) * step(rug.y, 0.18) * step(0.4, r2));
    } else {
      col = vec3(0.86, 0.84, 0.81);
    }
  } else {
    float u = t == tX ? l.z : l.x;
    float v = l.y;
    col = wall * mix(0.86, 1.0, step(0.035, v));
    // A sofa/sideboard block, a picture and a doorway, varied per room.
    float furn = step(v, 0.27 + 0.1 * r3) * step(abs(u - (0.28 + 0.44 * r2)), 0.16 + 0.12 * r1);
    col = mix(col, mix(vec3(0.30, 0.27, 0.24), vec3(0.62, 0.58, 0.52), r3), furn);
    float pic = step(abs(v - 0.6), 0.1) * step(abs(u - (0.62 - 0.3 * r3)), 0.1) * step(0.35, r2) * (1.0 - furn);
    col = mix(col, vec3(0.16, 0.17, 0.18), pic * 0.8);
    float door = step(v, 0.78) * step(abs(u - (0.85 - 0.7 * r1)), 0.09) * step(0.55, r3);
    col = mix(col, col * 0.45, door);
  }
  // Daylight from the window, falling off into the room; lamps at night (three rooms in four).
  float fall = exp(-t * 0.2);
  vec3 day = vec3(0.92, 0.9, 0.86) * (0.3 + 0.7 * fall) * uDay;
  lit = step(0.25, r2);
  vec3 lamp = vec3(1.9, 1.32, 0.82) * (0.45 + 0.85 * (1.0 - smoothstep(0.0, 0.75, length(l.xz - 0.5)))) * (0.35 + 0.65 * smoothstep(0.0, 1.0, l.y)) * lit;
  // A room left dark at night still shows: dim twilight through the window, never a black hole, but
  // clearly darker than the plaster around it.
  vec3 twilight = vec3(0.052, 0.06, 0.08);
  return col * mix(day, lamp + twilight * (1.0 - lit), uNight);
}`,
    )
    .replace(
      "#include <opaque_fragment>",
      `{
    vec3 vDir = normalize(vViewPosition);
    vec3 rv = inverseTransformDirection(reflect(-vDir, normal), viewMatrix);
    float up = smoothstep(-0.4, 0.35, rv.y);
    float fres = 0.12 + 0.88 * pow(1.0 - clamp(dot(normal, vDir), 0.0, 1.0), 4.0);
    float lit;
    vec3 room = interiorRoom(lit);
    // Sheer curtains drawn to the sides of some panes (bright fabric, backlit at night).
    float side = smoothstep(0.7, 0.92, abs(vUv.x - 0.5) * 2.0) * step(0.4, iHash(floor(vObjG * 1.7) + 5.0));
    float folds = 0.86 + 0.14 * sin(vUv.x * 90.0);
    vec3 sheer = mix(vec3(0.78, 0.76, 0.72) * uDay * 1.1, vec3(1.5, 1.1, 0.72) * lit, uNight) * folds;
    room = mix(room, sheer, side * 0.82);
    // By day a faint sky sheen sits on every pane (as in a photo); at night the rooms win.
    outgoingLight += room * (1.0 - fres) * 0.92 + mix(uGround, uSky, up) * (fres * 0.35 + 0.08 * (1.0 - uNight));
    // Blue-hour sky in the glass at night.
    outgoingLight += vec3(0.11, 0.13, 0.18) * (0.12 + fres * 0.6) * uNight;
  }
  #include <opaque_fragment>`,
    );
}

/** Sold houses: calm, lighter, desaturated (no red anywhere). Attribute `aSold` ∈ {0, 1}. */
function patchSold(shader: Shader) {
  shader.uniforms.uSoldMix = SOLD_MIX;
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nattribute float aSold;\nvarying float vSold;")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSold = aSold;");
  shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vSold;\nuniform float uSoldMix;").replace(
    "#include <color_fragment>",
    `#include <color_fragment>
  {
    float s = vSold * uSoldMix;
    float l = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec3 calm = vec3(l) * 1.1 + vec3(0.025, 0.026, 0.028);
    diffuseColor.rgb = mix(diffuseColor.rgb, calm, s * 0.85);
  }`,
  );
}

/** Double-sided cards lit with the baked (outward) normal on both faces. */
export function patchNoFlip(shader: Shader) {
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <normal_fragment_begin>",
    "float faceDirection = 1.0;\nvec3 normal = normalize( vNormal );\nvec3 nonPerturbedNormal = normal;",
  );
}

/**
 * Cut-outs (leaf cards, forest impostors) keep their coverage at a distance: mip averaging thins the
 * alpha below the cut-off, so crowns would fray into specks with sky showing through. Alpha is scaled
 * up with the sampled mip level (B. Golus, "Anti-aliased alpha test").
 */
export function patchCoverage(shader: Shader) {
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <map_fragment>",
    `#include <map_fragment>
  #ifdef USE_MAP
  {
    vec2 tx = vMapUv * vec2(textureSize(map, 0));
    vec2 dx = dFdx(tx);
    vec2 dy = dFdy(tx);
    diffuseColor.a *= 1.0 + max(0.0, 0.5 * log2(max(dot(dx, dx), dot(dy, dy)))) * 0.25;
  }
  #endif`,
  );
}

let cache: ReturnType<typeof create> | null = null;

/** Shared estate materials (created on first use). */
export function estateMaterials() {
  if (!cache) cache = create();
  return cache;
}

function create() {
  /* ---------- houses ---------- */
  const house = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, envMapIntensity: 0.8 });
  house.onBeforeCompile = (s) => {
    patchRM(s);
    patchPlaster(s);
    patchSold(s);
  };
  house.customProgramCacheKey = () => "estate-house";

  // Glazing: dark warm glass with a raised reflectance (ior 2) so the sky reads in it — glass on a clay
  // model, never a hole.
  // Near-black body: what you see is the room behind (interior mapping) plus the physical sky/sun reflection.
  const glass = new THREE.MeshPhysicalMaterial({ color: "#060708", roughness: 0.04, metalness: 0, ior: 1.7, specularIntensity: 1, envMapIntensity: 1.4 });
  glass.onBeforeCompile = (s) => {
    patchSold(s);
    patchGlass(s);
  };
  // Pane UVs (0..1) feed the reflection gradient.
  glass.defines = { USE_UV: "" };
  glass.customProgramCacheKey = () => "estate-glass";

  /* ---------- site ---------- */
  const site = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, envMapIntensity: 0.7 });
  site.onBeforeCompile = patchRM;
  site.customProgramCacheKey = () => "estate-site";

  // Concrete pavers (ambientCG PavingStones128, CC0) at their real size, one tile per 2 m, joints and bevels
  // in the normal map. The photo's own tone renders at ~180 in sun (no longer the brightest thing in the
  // frame); a slight cool shift keeps it neutral grey concrete.
  const paverMap = lazyTexture("/explorer/3d/ground/PavingStones128/color.webp");
  paverMap.colorSpace = THREE.SRGBColorSpace;
  const paverNormal = lazyTexture("/explorer/3d/ground/PavingStones128/normal.webp");
  for (const t of [paverMap, paverNormal]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / PAVER_TILE, 1 / PAVER_TILE);
    t.anisotropy = 8;
  }
  const paving = new THREE.MeshStandardMaterial({
    map: paverMap,
    normalMap: paverNormal,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughness: 0.88,
    metalness: 0,
    envMapIntensity: 0.6,
  });
  paving.color.setRGB(0.98, 1, 1.06);

  const gridMap = makeGrassPaverTexture();
  gridMap.repeat.set(1 / GRID_TILE, 1 / GRID_TILE);
  // Toned down with the paving: the bays must not glare next to the houses.
  const grassPavers = new THREE.MeshStandardMaterial({ color: "#c4c4c4", map: gridMap, roughness: 0.92, metalness: 0, envMapIntensity: 0.55 });

  const fenceMap = makeFenceTexture();
  fenceMap.repeat.set(1 / FENCE_TILE[0], 1 / FENCE_TILE[1]);
  // Light, low-contrast mesh panels (client review): warm graphite, ~40% see-through.
  const fence = new THREE.MeshStandardMaterial({
    color: "#77746e",
    alphaMap: fenceMap,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    side: THREE.DoubleSide,
    roughness: 0.55,
    metalness: 0.35,
  });

  /* ---------- vegetation ---------- */
  const foliageMap = makeFoliageTexture();
  const foliage = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: foliageMap,
    alphaTest: 0.42,
    side: THREE.DoubleSide,
    roughness: 0.82,
    metalness: 0,
    envMapIntensity: 0.6,
  });
  foliage.onBeforeCompile = patchNoFlip;
  foliage.customProgramCacheKey = () => "estate-foliage";

  const bark = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, envMapIntensity: 0.6 });

  const plants = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85, metalness: 0, envMapIntensity: 0.6 });
  plants.onBeforeCompile = patchNoFlip;
  plants.customProgramCacheKey = () => "estate-plants";

  /* ---------- context ---------- */
  // Neighbours: plain massing with real-ish colours (warm walls, dark roofs, window bands) via vertex colours.
  const clay = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, envMapIntensity: 0.6 });

  return { house, glass, site, paving, grassPavers, fence, foliage, bark, plants, clay, textures: [paverMap, paverNormal, gridMap, fenceMap, foliageMap] };
}

export type EstateMaterials = ReturnType<typeof create>;
