import * as THREE from "three";
import { lazyTexture } from "../../loading";
import { textureRoot } from "../../../tier";
import { hobTexture, magazineTexture, artTexture } from "./textures";

/* ==========================================================================
   Materials that do NOT follow the finish style (sanitary ceramic, glass,
   mirror, bulbs, bedding, pots…). Finish-dependent surfaces come from
   useMaterial(slot) instead. Created once, lazily, and shared.
   ========================================================================== */

export type CustomKey =
  | "ceramic"
  | "ceramicMatte"
  | "mirror"
  | "black"
  | "gap"
  | "hob"
  | "glassClear"
  | "glassTint"
  | "chrome"
  | "steel"
  | "paper"
  | "bedding"
  | "soil"
  | "potStone"
  | "potClay"
  | "potWhite"
  | "terrazzo"
  | "beige"
  | "cable"
  | "sheer"
  | "towel"
  | "decor"
  | "magazine"
  | "art"
  | "wicker"
  | "teak"
  | "glowPendant"
  | "glowCeiling"
  | "glowLED"
  | "glowLamp"
  | "glowShade"
  /** Glossy dark glass: TV screen, oven door, car glazing. */
  | "screen"
  /** Vertex-coloured, double-sided leaves (procedural olive tree, dried stems). */
  | "foliage"
  /** Pearl-white metallic car paint with a clear coat (reads as a quiet model car in the dollhouse). */
  | "carPaint"
  /** Black-brown leather with a soft sheen (lounge chair cushions). */
  | "leather";

/**
 * Emissive "practical" materials and their evening emissive intensity (× practical factor).
 * Warm white (~3000 K), not orange; the under-cabinet LED is the brightest emitter by design.
 */
export const GLOW: Partial<Record<CustomKey, { on: number; color: string }>> = {
  glowPendant: { on: 7, color: "#ffd9b0" },
  glowCeiling: { on: 4.6, color: "#ffdcb4" },
  glowLED: { on: 32, color: "#ffdcb6" },
  glowLamp: { on: 4.2, color: "#ffe6cc" },
  glowShade: { on: 0.85, color: "#ffe0c2" },
};

let registry: Record<CustomKey, THREE.Material> | null = null;

/** Called when a texture finishes loading (frameloop="demand" needs a redraw). Set by the runtime. */
let onTextureLoaded: (() => void) | null = null;
export function setTextureListener(fn: (() => void) | null) {
  onTextureLoaded = fn;
}

const loadTexture = (url: string) => lazyTexture(url, () => onTextureLoaded?.());

function pbrSet(slug: string, tile: number, srgbTint: string) {
  const load = (file: string, srgb: boolean) => {
    const t = loadTexture(`${textureRoot()}/${slug}/${file}.jpg`);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / tile, 1 / tile);
    t.anisotropy = 8;
    return t;
  };
  return new THREE.MeshStandardMaterial({
    color: srgbTint,
    map: load("color", true),
    normalMap: load("normal", false),
    roughnessMap: load("rough", false),
    roughness: 1,
  });
}

/** Linen weave normal map (fabric036) at a given repeat size in metres (UVs in metres). */
export function weaveNormal(tile: number) {
  return weave(tile);
}

function weave(tile: number) {
  const t = loadTexture(`${textureRoot()}/fabric036/normal.jpg`);
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / tile, 1 / tile);
  t.anisotropy = 8;
  return t;
}

function create(): Record<CustomKey, THREE.Material> {
  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);
  const phys = (p: THREE.MeshPhysicalMaterialParameters) => new THREE.MeshPhysicalMaterial(p);
  const glow = (key: CustomKey, base: string) =>
    std({ color: base, emissive: GLOW[key]!.color, emissiveIntensity: 0, roughness: 0.55, toneMapped: true });

  const terrazzo = pbrSet("terrazzo013", 0.55, "#e6d9c7");
  const hob = phys({ color: "#ffffff", map: hobTexture(), roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04, metalness: 0 });
  const magazine = std({ color: "#ffffff", map: magazineTexture(), roughness: 0.62, side: THREE.DoubleSide });
  const art = std({ color: "#ffffff", map: artTexture(5), roughness: 0.85 });

  const m: Record<CustomKey, THREE.Material> = {
    ceramic: phys({ color: "#f4f2ee", roughness: 0.14, clearcoat: 0.6, clearcoatRoughness: 0.08 }),
    ceramicMatte: std({ color: "#ebe6de", roughness: 0.78 }),
    mirror: std({ color: "#a9adab", metalness: 1, roughness: 0.16, envMapIntensity: 0.45 }),
    black: std({ color: "#161514", roughness: 0.62, metalness: 0.15 }),
    gap: std({ color: "#0d0c0b", roughness: 1 }),
    hob,
    glassClear: phys({ color: "#f2f5f4", roughness: 0.04, transparent: true, opacity: 0.2, depthWrite: false, envMapIntensity: 1.3 }),
    glassTint: phys({ color: "#b9a68c", roughness: 0.06, transparent: true, opacity: 0.45, depthWrite: false, envMapIntensity: 1.2 }),
    chrome: std({ color: "#dcdcdc", metalness: 1, roughness: 0.1 }),
    steel: std({ color: "#bdbcb8", metalness: 1, roughness: 0.34 }),
    paper: std({ color: "#f1ede5", roughness: 0.92 }),
    bedding: phys({ color: "#f1ece4", roughness: 1, sheen: 0.4, sheenColor: new THREE.Color("#ffffff"), sheenRoughness: 0.7, normalMap: weave(0.12), normalScale: new THREE.Vector2(0.55, 0.55) }),
    soil: std({ color: "#3b2e25", roughness: 1 }),
    potStone: std({ color: "#b8b0a5", roughness: 0.94 }),
    potClay: std({ color: "#a98d76", roughness: 0.88 }),
    potWhite: std({ color: "#e9e4dc", roughness: 0.7 }),
    terrazzo,
    beige: std({ color: "#c9bca9", roughness: 0.55, metalness: 0.1 }),
    cable: std({ color: "#121212", roughness: 0.5 }),
    sheer: std({
      color: "#f5f1ea",
      roughness: 1,
      transparent: true,
      opacity: 0.58,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    towel: phys({ color: "#d9d3c9", roughness: 1, sheen: 0.5, sheenColor: new THREE.Color("#ffffff"), sheenRoughness: 0.9, normalMap: weave(0.05), normalScale: new THREE.Vector2(1.4, 1.4) }),
    decor: std({ vertexColors: true, roughness: 0.82 }),
    magazine,
    art,
    wicker: std({ color: "#b39a7a", roughness: 0.9 }),
    teak: std({ color: "#8d6a4b", roughness: 0.7 }),
    glowPendant: glow("glowPendant", "#f1ede6"),
    glowCeiling: glow("glowCeiling", "#f6f3ee"),
    glowLED: glow("glowLED", "#f3eee6"),
    glowLamp: glow("glowLamp", "#f4eee4"),
    glowShade: Object.assign(glow("glowShade", "#efe7da"), { side: THREE.DoubleSide }),
    screen: phys({ color: "#0c0d0e", roughness: 0.16, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.9 }),
    foliage: std({ vertexColors: true, roughness: 0.72, side: THREE.DoubleSide }),
    carPaint: phys({ color: "#d6d3cd", roughness: 0.34, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.06 }),
    leather: phys({ color: "#221d1a", roughness: 0.48, clearcoat: 0.25, clearcoatRoughness: 0.5 }),
  };
  for (const [k, v] of Object.entries(m)) v.name = `furn:${k}`;
  return m;
}

export function customMaterials() {
  if (!registry) registry = create();
  return registry;
}

/** Updates every emissive practical material for the current practical factor (0 day → 1 evening). */
export function applyGlow(factor: number) {
  const m = customMaterials();
  for (const [key, g] of Object.entries(GLOW)) {
    const mat = m[key as CustomKey] as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = g!.on * factor;
  }
}
