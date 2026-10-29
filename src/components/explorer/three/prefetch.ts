"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { FINISHES } from "@/lib/estate";
import { useExplorer } from "../state/store";
import { preloadModels } from "./furniture/core/models";
import { preloadFinish } from "./materials/MaterialsProvider";

/** The stage counts as resting after this long without a rendered frame (the demand loop draws while anything moves). */
const REST_MS = 500;

/**
 * While the visitor looks at the estate, gets the houses' interiors ready in the background: every finish's
 * textures loaded and on the GPU, the furniture models fetched. Opening a house then only builds its
 * geometry and compiles; its scene gate still waits for everything before it shows.
 *
 * A 1–2K texture upload (with mipmaps) blocks the main thread for up to ~0,1 s, so uploads never run
 * while the camera moves or a pointer is down: one texture at a time, each only once the stage rests.
 * Downloads and decoding run off the main thread and need no such care.
 */
export function Prefetch({ interior }: { interior: boolean }) {
  const gl = useThree((s) => s.gl);
  const settled = useExplorer((s) => s.settled);
  const lastFrame = useRef(0);

  useFrame(() => void (lastFrame.current = performance.now()));

  useEffect(() => {
    if (!settled || interior) return;
    let alive = true;
    let pressed = false;
    const isAlive = () => alive;
    const down = () => void (pressed = true);
    const up = () => void (pressed = false);
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    const rest = () =>
      new Promise<void>((resolve) => {
        const check = () => (!alive || (!pressed && performance.now() - lastFrame.current > REST_MS) ? resolve() : void window.setTimeout(check, 120));
        check();
      });
    void (async () => {
      await rest();
      if (!alive) return;
      preloadModels();
      for (const f of FINISHES) {
        await preloadFinish(gl, f.id, isAlive, rest).catch(() => false);
        if (!alive) return;
      }
    })();
    return () => {
      alive = false;
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [settled, interior, gl]);

  return null;
}
