import type { FinishId } from "@/lib/estate";
import type { SurfaceSlot } from "@/lib/estate/geometry/types";

/**
 * Look of one surface slot in one finish style.
 * `texture` names a PBR set in TEXTURE_SETS (its real-world size is the default `tile`);
 * `color` multiplies the texture, so textured slots use it as a tint.
 */
export type SlotSpec = {
  color: string;
  roughness: number;
  metalness?: number;
  texture?: string;
  /** Overrides the set's real-world repeat size, metres. */
  tile?: number;
  /** Rotates the texture in UV space, radians. */
  rotation?: number;
  normalScale?: number;
  sheen?: number;
  sheenColor?: string;
  sheenRoughness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  envMapIntensity?: number;
};

type FinishSpec = Record<SurfaceSlot, SlotSpec>;

/* Surfaces that don't change with the interior style. */
const shared = {
  wallCut: { color: "#ebe5db", roughness: 1 },
  ceiling: { color: "#f6f2ec", roughness: 0.96 },
  // Fine mineral plaster; tinted per house at runtime (PLACEMENTS[house].facade).
  facade: { color: "#ece4d8", roughness: 0.93, texture: "plaster", tile: 2.4, normalScale: 0.35 },
  garageFloor: { color: "#b9b4ac", roughness: 0.8, texture: "graniteTile", tile: 3 },
  // Garden terrace: weathered timber boards (oak veneer read as decking).
  deck: { color: "#a89e91", roughness: 0.86, texture: "oak", tile: 1.2 },
  slabEdge: { color: "#34322f", roughness: 0.75 },
} satisfies Partial<FinishSpec>;

export const FINISH_SPECS: Record<FinishId, FinishSpec> = {
  /* s1 Jasna skandynawska (home Kreator s1 + the developer renders): light oak herringbone, warm white, sage TV wall, bouclé. */
  s1: {
    ...shared,
    floorWood: { color: "#f7e7d0", roughness: 1, texture: "herringbone", normalScale: 0.7, envMapIntensity: 0.5 },
    floorTile: { color: "#ffffff", roughness: 0.32, texture: "marbleWarm", tile: 1.4 },
    terraceStone: { color: "#c9c4bd", roughness: 0.5, texture: "graniteTile" },
    wallPaint: { color: "#f1ece3", roughness: 0.95, texture: "plaster", tile: 2.6, normalScale: 0.18 },
    // "Szałwia" from the home Kreator paints.
    wallAccent: { color: "#a9ad94", roughness: 0.94, texture: "plaster", tile: 2.6, normalScale: 0.2 },
    wallTile: { color: "#ffffff", roughness: 0.26, texture: "marbleWarm" },
    cabinetLacquer: { color: "#ece6dc", roughness: 0.5, clearcoat: 0.2, clearcoatRoughness: 0.4 },
    cabinetWood: { color: "#f3dfc6", roughness: 0.55, texture: "oak" },
    stone: { color: "#ffffff", roughness: 0.2, texture: "marbleWarm", clearcoat: 0.4, clearcoatRoughness: 0.15 },
    fabric: { color: "#f6f0e6", roughness: 1, texture: "boucle", normalScale: 1, sheen: 0.6, sheenColor: "#ffffff", sheenRoughness: 0.8 },
    fabricAccent: { color: "#cdbfa8", roughness: 1, texture: "linen", sheen: 0.4, sheenColor: "#efe6d8", sheenRoughness: 0.7 },
    metal: { color: "#1c1b1a", roughness: 0.42, metalness: 0.65 },
    rug: { color: "#ece6db", roughness: 1, texture: "linen", tile: 0.22, sheen: 0.5, sheenColor: "#ffffff", sheenRoughness: 0.9 },
  },
  /* s4 Japandi (home Kreator s4): pale ash, rice-paper walls, warm clay accent, matte black details, oat linen. */
  s4: {
    ...shared,
    floorWood: { color: "#f3e6d4", roughness: 0.95, texture: "herringbone", normalScale: 0.6, envMapIntensity: 0.45 },
    floorTile: { color: "#ffffff", roughness: 0.5, texture: "travertine" },
    terraceStone: { color: "#efe4d3", roughness: 0.62, texture: "travertine", tile: 1.6 },
    wallPaint: { color: "#ece4d6", roughness: 0.97, texture: "plaster", tile: 1.8, normalScale: 0.4 },
    wallAccent: { color: "#c3b39b", roughness: 0.97, texture: "plaster", tile: 1.8, normalScale: 0.45 },
    wallTile: { color: "#ffffff", roughness: 0.45, texture: "travertine" },
    cabinetLacquer: { color: "#e4dccf", roughness: 0.62 },
    cabinetWood: { color: "#f6e8d4", roughness: 0.6, texture: "oak" },
    stone: { color: "#ffffff", roughness: 0.42, texture: "travertine" },
    // Oat / natural linen: creamy, not grey.
    fabric: { color: "#efe0c6", roughness: 1, texture: "linen", sheen: 0.55, sheenColor: "#fff1da", sheenRoughness: 0.8 },
    fabricAccent: { color: "#3b3734", roughness: 1, texture: "linen", sheen: 0.35, sheenColor: "#7a726a", sheenRoughness: 0.7 },
    metal: { color: "#161514", roughness: 0.6, metalness: 0.4 },
    rug: { color: "#d9cbb2", roughness: 1, texture: "linen", tile: 0.25, sheen: 0.3, sheenColor: "#efe2c6", sheenRoughness: 0.9 },
  },
  /* s3 Grafitowa (home Kreator s3): honey-walnut herringbone, anthracite accent wall and kitchen, black oak, light marble, brass. */
  s3: {
    ...shared,
    floorWood: { color: "#b08f72", roughness: 0.82, texture: "herringbone", normalScale: 0.8, envMapIntensity: 0.7 },
    floorTile: { color: "#ffffff", roughness: 0.25, texture: "marbleDark", tile: 1.2 },
    terraceStone: { color: "#a39d96", roughness: 0.45, texture: "graniteTile" },
    wallPaint: { color: "#e2ddd5", roughness: 0.93, texture: "plaster", tile: 2.6, normalScale: 0.22 },
    // "Grafit" from the home Kreator paints.
    wallAccent: { color: "#5a5a5c", roughness: 0.9, texture: "plaster", tile: 2.6, normalScale: 0.25 },
    wallTile: { color: "#ffffff", roughness: 0.2, texture: "marbleDark", clearcoat: 0.5, clearcoatRoughness: 0.1 },
    cabinetLacquer: { color: "#34322f", roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.3 },
    cabinetWood: { color: "#ffffff", roughness: 0.48, texture: "smokedOak" },
    stone: { color: "#ffffff", roughness: 0.18, texture: "marbleWarm", clearcoat: 0.6, clearcoatRoughness: 0.08 },
    fabric: { color: "#6b645e", roughness: 1, texture: "boucle", normalScale: 1, sheen: 0.7, sheenColor: "#a59a8f", sheenRoughness: 0.6 },
    fabricAccent: { color: "#2f2c29", roughness: 1, texture: "linen", sheen: 0.5, sheenColor: "#8a8178", sheenRoughness: 0.6 },
    metal: { color: "#b8955e", roughness: 0.28, metalness: 1 },
    rug: { color: "#4d4742", roughness: 1, texture: "linen", tile: 0.22, sheen: 0.4, sheenColor: "#8f857a", sheenRoughness: 0.9 },
  },
};

/** Materials that never change with the finish. */
export const FIXED = {
  // Anthracite aluminium joinery (RAL 7016-like).
  frame: { color: "#2e3033", roughness: 0.42, metalness: 0.45 },
  door: { color: "#ece7df", roughness: 0.55 },
  entrance: { color: "#2f2c29", roughness: 0.55 },
  garageDoor: { color: "#3a3936", roughness: 0.55, metalness: 0.3 },
  /** Graphite standing-seam roof (ROOF_COLOR). */
  roof: { color: "#5e5d59", roughness: 0.45, metalness: 0.55 },
  // Low-iron double glazing: faint blue-grey body, strong sky reflection (envMapIntensity set in the provider).
  glass: { color: "#c3d1d8", roughness: 0.02, opacity: 0.22 },
  /** Sky reflection on the glazing, added on top of the see-through glass (fresnel-weighted, additive). */
  glassReflect: { color: "#000000", roughness: 0.03 },
} as const;

export type FixedKey = keyof typeof FIXED;
