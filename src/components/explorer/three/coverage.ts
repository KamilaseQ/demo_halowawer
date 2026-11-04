import type * as THREE from "three";

/* ==========================================================================
   Alpha-to-coverage follows the multisampling. With MSAA it smooths cut-out
   edges (fence rods, leaves, grass cards); without MSAA (lite devices, the
   "low" post stack) it degrades into dithered, broken dashes, so those
   materials fall back to a plain alpha test. Quality changes go through the
   scene gate (they are part of its key), so the recompile stays hidden.
   ========================================================================== */

const materials = new Set<THREE.Material>();
let on = true;

/** A cut-out material whose edges should use alpha-to-coverage when MSAA is on. */
export function coverage<M extends THREE.Material>(m: M): M {
  materials.add(m);
  m.alphaToCoverage = on;
  return m;
}

export function setCoverage(enabled: boolean) {
  on = enabled;
  for (const m of materials) {
    if (m.alphaToCoverage === enabled) continue;
    m.alphaToCoverage = enabled;
    m.needsUpdate = true;
  }
}
