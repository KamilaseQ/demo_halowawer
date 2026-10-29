"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { useExplorer } from "../state/store";
import { loadedCount, loadingIdle, loadingProgress, sceneTextures, subscribeLoading, uploadTextures } from "./loading";
import { compileVariants } from "./warmup";
import { FINISHES } from "@/lib/estate";
import { preloadFinish } from "./materials/MaterialsProvider";

/** Give up waiting for stragglers (a stalled request) and show what is there. */
const MAX_WAIT_MS = 20000;

/**
 * Reveal policy: the stage shows a scene only once it is complete. While the poster (first load) or a
 * dissolve (world or arrangement change) covers the canvas, the camera sees nothing; meanwhile every
 * asset finishes loading, textures upload to the GPU in short slices and every shader variant compiles
 * in parallel. Then the camera sees the scene again, a few frames render under the cover and the store
 * flags `settled` (and `ready` the first time), which lets the cover go.
 *
 * `gateKey` names the scene content; a new key runs the gate again. `needsFinish`: the scene shows the
 * interior, so the current finish's textures must be on the materials (finish switches keep `settled`
 * false until they are) and every other finish is loaded and uploaded too: once the scene shows, switching
 * styles, times of day or entering the walk never loads, uploads or compiles anything.
 */
export function SceneGate({ gateKey, needsFinish }: { gateKey: string; needsFinish: boolean }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const setEvents = useThree((s) => s.setEvents);
  const frames = useRef(0);
  const open = useRef(false);
  const visibleMask = useRef<number | null>(null);
  const needs = useRef(needsFinish);
  // Declared before the gate's own layout effect below, which reads it.
  useLayoutEffect(() => {
    needs.current = needsFinish;
  }, [needsFinish]);

  useFrame(() => void frames.current++);

  // settled = the gate is open and the interior wears the chosen finish.
  const sync = useCallback(() => {
    const s = useExplorer.getState();
    const settled = open.current && (!needs.current || s.finishReady === s.finish);
    if (s.settled !== settled) useExplorer.setState({ settled });
  }, []);
  useEffect(() => useExplorer.subscribe(() => sync()), [sync]);
  useEffect(() => sync(), [needsFinish, sync]);

  // eslint-disable-next-line react-hooks/immutability -- the three.js camera is mutable by design, not React state
  useLayoutEffect(() => {
    let alive = true;
    const isAlive = () => alive;
    visibleMask.current ??= camera.layers.mask;
    const mask = visibleMask.current;
    open.current = false;
    sync();

    const s = useExplorer.getState();
    // Hide the scene only while something covers the canvas; otherwise compile alongside rendering.
    const covered = !s.ready || !!s.dissolve;
    if (covered) {
      // eslint-disable-next-line react-hooks/immutability -- the three.js camera is mutable by design, not React state
      camera.layers.mask = 0;
      setEvents({ enabled: false });
    }

    const base = loadedCount();
    let shown = 0;
    const report = (p: number) => {
      // Monotonic, in whole percents: the poster's counter never jumps back.
      const v = Math.floor(Math.max(shown, Math.min(1, p)) * 100) / 100;
      if (v === shown) return;
      shown = v;
      if (!useExplorer.getState().ready) useExplorer.setState({ progress: v });
    };

    const run = async () => {
      // 1. Everything requested has arrived (two quiet checks in a row: a resolved model can request more).
      await new Promise<void>((resolve) => {
        const started = performance.now();
        const unsubscribe = subscribeLoading(() => report(0.86 * loadingProgress(base)));
        let quiet = 0;
        const check = () => {
          const s = useExplorer.getState();
          const finished = loadingIdle() && (!needs.current || s.finishReady === s.finish);
          report(0.86 * loadingProgress(base));
          quiet = finished ? quiet + 1 : 0;
          if (!alive || quiet >= 2 || performance.now() - started > MAX_WAIT_MS) {
            unsubscribe();
            resolve();
          } else window.setTimeout(check, 60);
        };
        check();
      });
      if (!alive) return;

      // 2. Every finish's textures (interiors), then the scene's own textures onto the GPU, a few at a time.
      if (needs.current) {
        for (const f of FINISHES) {
          // eslint-disable-next-line react-hooks/immutability -- the three.js camera is mutable by design, not React state
          if (!(await preloadFinish(gl, f.id, isAlive).catch(() => true))) return;
          report(0.86 + 0.02 * (FINISHES.indexOf(f) + 1));
        }
      }
      if (!(await uploadTextures(gl, sceneTextures(scene), isAlive))) return;
      report(0.93);

      // 3. Every shader variant, compiled in parallel while the main thread stays free. A scene left
      //    uncovered (browser back/forward has no dissolve) compiles only its current state.
      const eye = new THREE.PerspectiveCamera();
      eye.layers.mask = mask;
      try {
        if (!(await compileVariants(gl, scene, eye, isAlive, covered))) return;
      } catch (e) {
        // Non-fatal: whatever is missing compiles on first use.
        console.warn("shader warm-up failed", e);
      }
      if (!alive) return;
      report(1);

      // 4. Show the scene under the cover; let it go once a few frames have been drawn.
      camera.layers.mask = mask;
      setEvents({ enabled: true });
      gl.shadowMap.needsUpdate = true;
      const from = frames.current;
      invalidate(4);
      await new Promise<void>((resolve) => {
        const wait = () => (!alive || frames.current >= from + 3 ? resolve() : void requestAnimationFrame(wait));
        wait();
      });
      if (!alive) return;
      open.current = true;
      if (!useExplorer.getState().ready) useExplorer.setState({ ready: true, progress: 1 });
      sync();
    };
    void run();

    return () => {
      alive = false;
      camera.layers.mask = mask;
      setEvents({ enabled: true });
    };
  }, [gateKey, gl, scene, camera, invalidate, setEvents, sync]);

  return null;
}
