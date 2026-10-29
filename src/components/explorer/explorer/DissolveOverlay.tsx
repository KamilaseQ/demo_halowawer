"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { sceneSignature, useExplorer } from "../state/store";
import styles from "./controls.module.css";

/** Safety net only: normally the new scene settles well before this. */
const HOLD_MAX_MS = 8000;

/**
 * Shows the frame frozen by withDissolve() over the canvas and fades it out once the scene underneath
 * has changed, is complete (models, textures, shaders: `settled`) and has rendered.
 */
export function DissolveOverlay() {
  const frame = useExplorer((s) => s.dissolve);
  // The frame being faded out; a newer frozen frame starts opaque by construction.
  const [faded, setFaded] = useState<HTMLCanvasElement | null>(null);
  const fading = !!frame && faded === frame;
  const host = useRef<HTMLDivElement>(null);

  // Before paint: the scene may already have changed underneath.
  // eslint-disable-next-line react-hooks/immutability -- the frozen frame is a detached canvas element (DOM), not React state
  useLayoutEffect(() => {
    const el = host.current;
    if (!frame || !el) return;
    // eslint-disable-next-line react-hooks/immutability -- the frozen frame is a detached canvas element (DOM), not React state
    frame.className = styles.dissolveFrame;
    el.replaceChildren(frame);
    return () => frame.remove();
  }, [frame]);

  useEffect(() => {
    if (!frame) return;
    const started = performance.now();
    // Taken before the change was applied (a route change lands a few frames later).
    const before = useExplorer.getState().dissolveFrom;
    let raf = 0;

    const tick = () => {
      const s = useExplorer.getState();
      const changed = sceneSignature(s) !== before;
      const timedOut = performance.now() - started > HOLD_MAX_MS;
      if ((changed && s.settled) || timedOut) {
        // Two frames so the new scene has actually been drawn under the overlay.
        raf = requestAnimationFrame(() => (raf = requestAnimationFrame(() => setFaded(frame))));
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [frame]);

  if (!frame) return null;
  return (
    <div
      ref={host}
      aria-hidden
      className={styles.dissolve}
      data-fading={fading || undefined}
      onTransitionEnd={(e) => {
        if (fading && e.target === e.currentTarget) useExplorer.setState({ dissolve: null });
      }}
    />
  );
}
