"use client";

import { useEffect } from "react";
import { whenCalm } from "@/lib/idle";

const SECTIONS = ".home > section, .contact";

/**
 * The sections under the film start skipped (content-visibility: auto, a
 * light first render). Left that way, each one would be laid out the first
 * time it scrolls near: 100-470 ms frames at 4x CPU in the middle of a
 * scroll. Instead they are rendered one by one in calm, idle moments, mostly
 * while the preloader is still fetching the film, so by the time the
 * visitor scrolls there everything is laid out already.
 */
export function PrerenderSections() {
  useEffect(() => {
    const ac = new AbortController();
    const queue = Array.from(document.querySelectorAll<HTMLElement>(SECTIONS)).filter((s) => !s.classList.contains("is-rendered"));

    const next = () => {
      const section = queue.shift();
      if (!section) return;
      section.classList.add("is-rendered");
      void section.offsetHeight; // lay it out now, inside this idle task, not in a later scroll frame
      whenCalm(next, { quiet: 150, signal: ac.signal });
    };
    whenCalm(next, { quiet: 150, signal: ac.signal });

    return () => ac.abort();
  }, []);

  return null;
}
