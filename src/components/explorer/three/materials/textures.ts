/**
 * PBR texture sets (CC0, see /public/3d/CREDITS.md and /public/3d/manifest.json). Keys are referenced
 * from specs.ts. `tile` is the real-world size of one repeat in metres (overridable per slot).
 * A key that is missing here simply renders as flat colour.
 */
import { textureRoot } from "../../tier";

export type TextureSet = {
  color?: string;
  normal?: string;
  rough?: string;
  ao?: string;
  tile?: number;
};

/* Paths resolve per device tier (full 1–2K, lite 512 px): see ../../tier.ts. Getters, so the tier is read
   on first use in the browser, never at module evaluation on the server. */
const set = (slug: string, tile: number, ao = true): TextureSet => ({
  get color() {
    return `${textureRoot()}/${slug}/color.jpg`;
  },
  get normal() {
    return `${textureRoot()}/${slug}/normal.jpg`;
  },
  get rough() {
    return `${textureRoot()}/${slug}/rough.jpg`;
  },
  get ao() {
    return ao ? `${textureRoot()}/${slug}/ao.jpg` : undefined;
  },
  tile,
});

export const TEXTURE_SETS: Record<string, TextureSet> = {
  herringbone: set("herringbone_parquet", 3.4),
  oak: set("oak_veneer_01", 1.83),
  smokedOak: set("black_oak_veneer", 1.0),
  marbleWarm: set("marble004", 2, false),
  marbleDark: set("marble016", 1.5, false),
  graniteTile: set("granite_tile", 2.3),
  travertine: set("travertine009", 1.2),
  terrazzo: set("terrazzo013", 0.8, false),
  boucle: set("curly_teddy_natural", 0.336),
  /** Greyscale colour map: tint it with the slot colour. */
  linen: set("fabric036", 0.3),
  plaster: set("plaster001", 2, false),
};
