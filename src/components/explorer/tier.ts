/* ==========================================================================
   Device tier, decided once per page load (before anything loads) and used
   by every asset path and quality switch, so the preload and the scene ask
   for exactly the same URLs.

   "lite" (phones, tablets, ≤4 GB devices): 512 px textures for every finish
   (~70 MB of GPU memory instead of ~290 MB), DPR ≤ 1.5, no MSAA, half-res AO.
   Everything is still preloaded: nothing loads during interaction.
   ========================================================================== */

export type Tier = "full" | "lite";

let tier: Tier | null = null;

export function deviceTier(): Tier {
  if (tier) return tier;
  if (typeof window === "undefined") return "full";
  const nav = navigator as Navigator & { deviceMemory?: number };
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const small = Math.min(window.screen.width, window.screen.height) < 700;
  const lowMemory = (nav.deviceMemory ?? 8) <= 4;
  // Dev/QA override: ?tier=lite|full.
  const forced = new URLSearchParams(window.location.search).get("tier");
  tier = forced === "lite" || forced === "full" ? forced : coarse || small || lowMemory ? "lite" : "full";
  return tier;
}

/** Root of the PBR texture sets for this device. */
export const textureRoot = () => (deviceTier() === "lite" ? "/explorer/3d/textures-512" : "/explorer/3d/textures");
