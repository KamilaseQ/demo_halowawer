/* ==========================================================================
   Diagnostic switches for performance work (?perf=nopost,noao,…): each one
   removes a single cost from the frame so its share can be measured
   (docs/explorer/tools/_gpuframe.mjs). Never used for the shipped look.
     nopost   no EffectComposer at all      noao     no N8AO
     nomsaa   no multisampling              nobloom  no bloom
     nosmaa   no SMAA                       notrees  no EZ-Tree models
     nobelt   no woodland belt of models    noshadow sun casts no shadows
     aotransp N8AO transparency-aware (the pre-11.2026 setting, for side-by-side checks)
   ========================================================================== */

export type PerfFlag = "nopost" | "noao" | "nomsaa" | "nobloom" | "nosmaa" | "notrees" | "nobelt" | "noshadow" | "aotransp";

let flags: Set<string> | null = null;

export function perfFlag(f: PerfFlag) {
  if (!flags) flags = new Set(typeof window === "undefined" ? [] : (new URLSearchParams(window.location.search).get("perf") ?? "").split(","));
  return flags.has(f);
}
