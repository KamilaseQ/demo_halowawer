"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { isCapture, isLite } from "@/lib/motion";
import { filmLoad } from "@/lib/preload";
import { BrandGlyph } from "@/components/ui/icons";

const QUICK = 400;      // ms: ready this fast (from cache) = no curtain, a short fade
const CURTAIN = 800;    // ms, the curtain lifting off the hero
const FADE = 320;       // ms, the quick fade

const noop = () => () => {};

/**
 * Overlay over the server-rendered page while the hero film loads: wordmark,
 * a hairline of gold that fills with the real byte count, a percentage.
 * Scrolling is locked until the film is in memory and its first frame is
 * decoded, then the curtain lifts and the hero plays its entrance.
 * Not shown with reduced motion (no film) or without JS.
 */
export function Preloader() {
  const load = filmLoad.use();
  // no film to wait for: reduced motion, or ?capture (client-only check, the server renders the overlay)
  const skip = useSyncExternalStore(noop, () => isLite() || isCapture(), () => false);
  const [phase, setPhase] = useState<"loading" | "leaving" | "done">("loading");
  const [quick, setQuick] = useState(false);
  const started = useRef(0);

  /* the overlay itself locks the page (preloader.css, html:has(.preloader)) */
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.remove("is-loaded");
    if (isCapture()) root.classList.add("is-capture");
    started.current = performance.now();
  }, []);

  /* loaded: start the exit; the hero's entrance starts under the still-opaque overlay, so nothing jumps */
  useEffect(() => {
    if (phase !== "loading" || load.state === "loading") return;
    document.documentElement.classList.add("is-loaded");
    setQuick(load.state === "ready" && performance.now() - started.current < QUICK);
    setPhase("leaving");
  }, [load.state, phase]);

  /* exit played: unmount. Its own effect, so starting the exit can never cancel this timer
     (that left an invisible overlay over the page that swallowed every click) */
  useEffect(() => {
    if (phase !== "leaving") return;
    const t = window.setTimeout(() => setPhase("done"), (quick ? FADE : CURTAIN) + 60);
    return () => window.clearTimeout(t);
  }, [phase, quick]);

  if (skip || phase === "done") return null;

  const pct = load.state === "loading" ? (load.total ? Math.min(99, Math.floor((load.loaded / load.total) * 100)) : 0) : 100;

  return (
    <div
      className={`preloader${phase === "leaving" ? (quick ? " is-fading" : " is-lifting") : ""}`}
      role="progressbar"
      aria-label="Wczytywanie spaceru po osiedlu"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <div className="preloader__inner">
        <p className="preloader__mark">
          <BrandGlyph className="preloader__glyph" door />
          <span>Halo Wawer</span>
        </p>
        <div className="preloader__bar" aria-hidden="true">
          <span style={{ transform: `scaleX(${pct / 100})` }} />
        </div>
        <p className="preloader__meta" aria-hidden="true">
          <span>Wczytujemy spacer po domu</span>
          <span className="preloader__pct">{pct}%</span>
        </p>
      </div>
    </div>
  );
}
