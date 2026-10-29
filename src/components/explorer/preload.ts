/* ==========================================================================
   Warm-up for /domy, callable from any page (the home page runs it when idle
   after its hero). Deliberately light: no three/R3F import at the top. It
   fetches the explorer's assets into the HTTP cache (low priority) and
   pulls the 3D stage chunk, so opening /domy only has to decode and upload.
   ========================================================================== */

import { FINISH_SPECS } from "./three/materials/specs";
import { TEXTURE_SETS } from "./three/materials/textures";

/** The IBL as the stage loads it: the HDRI's baked PMREM (lighting/Lighting.tsx, HDRI.day.pmrem). */
const HDRI = ["/explorer/3d/hdri/zawiszy_czarnego_512.pmrem.bin"];

/**
 * Furnishing GLBs: none today (layout B's furniture is procedural, furniture/core/models.tsx FURNISHED is empty).
 * Keep this in step with FURNISHED: a listed file is fetched on every home visit (4,4 MB for the old list).
 */
const MODELS: string[] = [];

/** The estate maquette: tree models, the woodland impostor atlas, ground and paving detail. */
const ESTATE = [
  "/explorer/3d/models/drzewa.glb",
  "/explorer/3d/models/las-impostory.webp",
  "/explorer/3d/ground/Grass004/color.jpg",
  "/explorer/3d/ground/Ground037/color.jpg",
  "/explorer/3d/ground/PavingStones128/color.webp",
  "/explorer/3d/ground/PavingStones128/normal.webp",
  "/explorer/3d/ground/estate-near.webp",
  "/explorer/3d/ground/estate-ao.webp",
];

/** First image the visitor sees on /domy (the estate entry). */
const ENTRY = ["/explorer/photos/estate-aerial.jpg"];

/** Every texture used by any finish style (all three are preloaded: switching styles never loads). */
function textureUrls() {
  const sets = new Set<string>();
  for (const spec of Object.values(FINISH_SPECS)) for (const slot of Object.values(spec)) if ("texture" in slot && slot.texture) sets.add(slot.texture);
  const urls: string[] = [];
  for (const key of sets) {
    const s = TEXTURE_SETS[key];
    if (!s) continue;
    for (const u of [s.color, s.normal, s.rough, s.ao]) if (u) urls.push(u);
  }
  return urls;
}

/** All asset URLs the explorer needs before its first frame (estate + the hero house in every style). */
export function explorerAssetUrls(): string[] {
  return [...ENTRY, ...HDRI, ...ESTATE, ...textureUrls(), ...MODELS];
}

let started: Promise<void> | null = null;

/**
 * Fetches the explorer's assets into the HTTP cache and loads the 3D stage's code chunk.
 * Safe to call repeatedly (runs once per page load). Everyone gets the full preload (client decision).
 */
export function preloadExplorerAssets(opts: { signal?: AbortSignal } = {}): Promise<void> {
  if (started) return started;
  started = (async () => {
    // Code first (small), then assets a few at a time so the page that called us stays responsive.
    await import("./three/Stage").catch(() => undefined);
    const queue = explorerAssetUrls();
    const worker = async () => {
      while (queue.length && !opts.signal?.aborted) {
        const url = queue.shift()!;
        // Read the body through (so it lands in the HTTP cache) without ever holding it: no big buffers
        // for the garbage collector on the page that called us.
        await fetch(url, { priority: "low", signal: opts.signal } as RequestInit)
          .then(async (r) => {
            const reader = r.body?.getReader();
            if (reader) while (!(await reader.read()).done);
          })
          .catch(() => undefined);
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    // Aborted part-way: a later call starts again (whatever was fetched is cached already).
    if (opts.signal?.aborted) started = null;
  })();
  return started;
}
