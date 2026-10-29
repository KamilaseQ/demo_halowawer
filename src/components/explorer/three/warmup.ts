"use client";

import { useEffect } from "react";
import * as THREE from "three";

/* ==========================================================================
   Shader warm-up. Some runtime switches change a material's program, not just
   its uniforms: clearcoat turning on with a finish, maquette storeys fading to
   transparent. Each such switch registers an axis here; the scene gate
   compiles every combination up front (in parallel, KHR_parallel_shader_compile).
   three keeps every program a material has used, so later switches never
   compile. (Practical lights stay in the scene at intensity 0 by day for the
   same reason: the evening switch only changes uniforms.)
   ========================================================================== */

export type WarmupAxis = {
  /** Each entry puts the scene into one variant of this axis. */
  states: (() => void)[];
  /** Back to the live state. */
  restore: () => void;
};

const axes = new Set<WarmupAxis>();

/** Registers an axis while the calling component is mounted. */
export function useWarmupAxis(axis: WarmupAxis | null) {
  useEffect(() => {
    if (!axis) return;
    axes.add(axis);
    return () => void axes.delete(axis);
  }, [axis]);
}

let compileTarget: THREE.WebGLRenderTarget | null = null;

type ProgramStatus = { isReady(): boolean };

/**
 * Compiles `scene` for every combination of the registered axes (`variants`), or only for its current
 * state when the scene is on screen (switching axes would show). All combinations are submitted at
 * once and the driver compiles them in parallel (KHR_parallel_shader_compile); the wait polls without
 * blocking. Programs are compiled with a render target bound, like the EffectComposer's render pass
 * (linear output, no tone mapping), so they are the exact variants the frame will use. Lights are
 * gathered with `camera`'s layers.
 */
export async function compileVariants(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, alive: () => boolean, variants = true) {
  compileTarget ??= new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const list = variants ? [...axes] : [];
  const combos = list.reduce<number[][]>((acc, axis) => acc.flatMap((c) => axis.states.map((_, i) => [...c, i])), [[]]);
  const prev = gl.getRenderTarget();
  try {
    gl.setRenderTarget(compileTarget);
    for (const combo of combos) {
      combo.forEach((i, k) => list[k].states[i]());
      gl.compile(scene, camera);
    }
  } finally {
    gl.setRenderTarget(prev);
    list.forEach((axis) => axis.restore());
  }
  // Every program the renderer holds, including each variant above (a material keeps all of its programs).
  const programs = (gl.info.programs ?? []) as unknown as ProgramStatus[];
  await new Promise<void>((resolve) => {
    const check = () => (!alive() || programs.every((p) => p.isReady()) ? resolve() : void setTimeout(check, 16));
    check();
  });
  return alive();
}
