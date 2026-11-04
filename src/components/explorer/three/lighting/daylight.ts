import type { Vec3 } from "@/lib/estate/geometry/types";
import { ESTATE_AZIMUTH_X } from "@/lib/estate/geometry/site";
import type { TimeOfDay } from "../../state/store";

export type DaylightPreset = {
  label: string;
  /** Unit vector from the scene towards the sun, ESTATE space (rotated into house space by the stage). */
  sunDirection: Vec3;
  sunColor: string;
  sunIntensity: number;
  envIntensity: number;
  /** Warm bounce standing in for global illumination: sky colour, ground colour, intensity. */
  bounce: [string, string, number];
  /** 0–1 multiplier for practical lights (pendants, LED strips, downlights). */
  practical: number;
  exposure: number;
  /** Sky dome: zenith, horizon, glow around the sun. */
  sky: { top: string; horizon: string; glow: string; glowStrength: number };
};

/**
 * Compass sun position → estate-space direction. Estate +X points to azimuth ESTATE_AZIMUTH_X (90°: east,
 * BOR2 is georeferenced square to north), +Z to +90° from it (south, the gardens).
 */
function sun(azimuth: number, altitude: number): Vec3 {
  const a = ((azimuth - ESTATE_AZIMUTH_X) * Math.PI) / 180;
  const h = (altitude * Math.PI) / 180;
  return [Math.cos(a) * Math.cos(h), Math.sin(h), Math.sin(a) * Math.cos(h)];
}

export const DAYLIGHT: Record<TimeOfDay, DaylightPreset> = {
  rano: {
    label: "Rano",
    // 21.09, 08:30: low sun from the ESE grazes the east gables and the gardens; soft, slightly cool sky.
    sunDirection: sun(114.4, 18.7),
    sunColor: "#ffe6cc",
    sunIntensity: 4.0,
    envIntensity: 0.75,
    // Same ≈ 3 : 1 key-to-fill as Dzień, a touch cooler: shade reads, nothing clips.
    bounce: ["#d3dff0", "#9a8668", 1.7],
    practical: 0.05,
    exposure: 1.04,
    sky: { top: "#86a9cf", horizon: "#efe3d3", glow: "#ffe6c8", glowStrength: 0.55 },
  },
  dzien: {
    label: "Dzień",
    // 21.09, 15:30: warm afternoon sun from the SW, straight through the HS doors into the living rooms
    // (as in the home Kreator renders and the hero).
    sunDirection: sun(232.4, 26.1),
    // Golden afternoon as on the hero renders: a warm key that no longer clips plaster to white, and a
    // cool sky fill strong enough that shade reads as soft blue-grey (≈ 3 : 1), not a black hole.
    sunColor: "#ffe2c2",
    sunIntensity: 4.4,
    envIntensity: 0.95,
    // Fill rebalanced from the sky (which floods every lawn) to warm bounce off the sunlit ground
    // (which reaches the walls in shade): shade stays readable, the meadow no longer turns lime.
    bounce: ["#c9d8ee", "#a8916e", 1.5],
    // Lived-in: a warm glow inside even by day (as on the hero renders).
    practical: 0.3,
    exposure: 1.0,
    // Clear blue sky; a pale, slightly cool horizon instead of beige haze (the fog takes this colour).
    sky: { top: "#3d7bc6", horizon: "#dfe6ec", glow: "#ffd39c", glowStrength: 0.9 },
  },
  noc: {
    label: "Noc",
    // Blue hour: the sun just under the horizon, warmth comes from the windows and garden lights.
    sunDirection: sun(279.6, 2),
    sunColor: "#ffb48a",
    sunIntensity: 0.35,
    envIntensity: 0.4,
    // Blue hour as on the developer's dusk renders (plaster ≈ 90–110 / 255, blue-grey): a strong, cool sky
    // fill; the warmth comes only from the windows and garden lights.
    bounce: ["#7d88ad", "#3b3630", 1.4],
    practical: 1,
    exposure: 1.35,
    sky: { top: "#26375a", horizon: "#b58f84", glow: "#e2997a", glowStrength: 0.4 },
  },
};
