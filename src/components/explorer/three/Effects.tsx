"use client";

import { useFrame } from "@react-three/fiber";
import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, N8AO, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { damp } from "maath/easing";
import type { HueSaturationEffect } from "postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useLayoutEffect, useRef } from "react";
import { useExplorer } from "../state/store";
import { perfFlag } from "../perf";

/**
 * Post stack: screen-space AO (the single biggest realism win for interiors), filmic AgX tone mapping,
 * restrained bloom for practical lights, SMAA. `quality` is "low" on lite devices, or after Stage's QualityGovernor
 * finds the GPU too slow (switched at rest, under a dissolve).
 */
export function Effects({ interior, quality }: { interior: boolean; quality: "high" | "low" }) {
  const low = quality === "low";
  /*
   * N8AO transparency-awareness off (explicitly, which also stops its auto-detection): with it N8AO re-renders
   * the scene twice a frame for every transparent material it finds (curtains, cursor discs), and those renders
   * (casters hidden) made the sun's cached shadow map re-render every frame too. AO comes from opaque depth
   * only. ?perf=aotransp turns it back on for side-by-side checks.
   */
  const aoRef = useRef<{ autoDetectTransparency: boolean; configuration: { transparencyAware: boolean } } | null>(null);
  useLayoutEffect(() => {
    const ao = aoRef.current;
    if (!ao) return;
    // Setting the configuration only stops the auto-detection when the value changes: stop it directly.
    ao.autoDetectTransparency = false;
    ao.configuration.transparencyAware = perfFlag("aotransp");
  });
  const timeOfDay = useExplorer((s) => s.timeOfDay);
  // Blue hour drains colour (dusk grass reads grey-green, not neon); by day a touch more colour outdoors.
  // Eased like the lights (0.5 s); the effects' props are live uniforms, so nothing recompiles.
  const saturation = timeOfDay === "noc" ? -0.12 : interior ? 0.03 : 0.07;
  const hue = useRef<HueSaturationEffect>(null);
  const sat = useRef({ value: saturation });
  useFrame((state, dt) => {
    const effect = hue.current;
    if (!effect) return;
    if (damp(sat.current, "value", saturation, 0.5, dt)) state.invalidate();
    effect.saturation = sat.current.value;
  });
  return (
    // MSAA on the scene buffer keeps thin high-contrast edges (roof verges, window frames) clean; SMAA mops up.
    <EffectComposer multisampling={low || perfFlag("nomsaa") ? 0 : 4} enableNormalPass={false}>
      {perfFlag("noao") ? <></> : <N8AO
        halfRes={low}
        quality={low ? "performance" : "medium"}
        // Outdoors a smaller radius: with real tree crowns a wide AO draws halos around them.
        aoRadius={interior ? 0.9 : 2.5}
        distanceFalloff={interior ? 0.6 : 1.2}
        intensity={interior ? 2.6 : 1.7}
        color="#1a130c"
        ref={aoRef}
      />}
      {/* High threshold: only practical lights glow, not sunlit white surfaces. */}
      {perfFlag("nobloom") ? <></> : <Bloom mipmapBlur luminanceThreshold={1.6} luminanceSmoothing={0.25} intensity={interior ? 0.5 : 0.25} />}
      <Vignette offset={0.32} darkness={interior ? 0.42 : 0.36} />
      {perfFlag("nosmaa") ? <></> : <SMAA />}
      {/* A light, warm grade like the developer's renders: a touch more colour and contrast. */}
      <HueSaturation ref={hue} />
      <BrightnessContrast contrast={interior ? 0.04 : 0.07} />
      {/* EffectComposer disables renderer tone mapping; this must stay the last effect. Khronos PBR Neutral
          keeps plaster, timber and lawn colours true (AgX greyed them out). */}
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    </EffectComposer>
  );
}
