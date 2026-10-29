"use client";

import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { useEffect } from "react";
import { isCapture, isLite } from "@/lib/motion";
import { filmLoad } from "@/lib/preload";

/**
 * Smooth wheel scrolling (Lenis) for the home page: the film scrub, the
 * sticky stage and the reveals all ride one steady scroll instead of the
 * mouse wheel's 100 px steps. Touch keeps native scrolling. Starts once the
 * preloader has let go of the page.
 *
 * In-page anchors are handled here: the sections under the film use
 * content-visibility (estimated heights until rendered), so a jump first
 * renders them all (.cv-all), then measures, then glides to the exact spot.
 */
export function SmoothScroll() {
  const state = filmLoad.use().state;
  const unlocked = state !== "loading";

  useEffect(() => {
    if (!unlocked && !isCapture()) return;
    const root = document.documentElement;
    const lenis = isLite() ? null : new Lenis({ autoRaf: true, lerp: 0.1, smoothWheel: true });

    function jump(hash: string) {
      const id = decodeURIComponent(hash.slice(1));
      const target = id === "top" ? document.body : document.getElementById(id);
      if (!target) return false;
      root.classList.add("cv-all");
      const targetY = () => (id === "top" ? 0 : Math.round(target.getBoundingClientRect().top + window.scrollY));

      /* The page can still move while gliding (on phones the configurator's
         frame grows to its content when it loads on the way), so on arrival
         measure again and settle the rest with a short glide. */
      const glide = (attempt: number) => {
        const y = targetY();
        const arrived = () => {
          if (attempt < 3 && Math.abs(targetY() - window.scrollY) > 2) glide(attempt + 1);
          else root.classList.remove("cv-all");
        };
        if (lenis) lenis.scrollTo(y, { duration: attempt ? 0.6 : 1.4, onComplete: arrived });
        else {
          window.scrollTo({ top: y, behavior: isLite() || attempt ? "auto" : "smooth" });
          let fired = false;
          const once = () => {
            if (fired) return;
            fired = true;
            arrived();
          };
          window.addEventListener("scrollend", once, { once: true });
          window.setTimeout(once, attempt ? 200 : 2500); // browsers without scrollend
        }
      };
      requestAnimationFrame(() => glide(0));
      return true;
    }

    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
      if (!a) return;
      const hash = a.getAttribute("href") ?? "";
      if (hash.length < 2 || !jump(hash)) return;
      e.preventDefault();
      history.replaceState(null, "", hash === "#top" ? location.pathname + location.search : hash);
    }

    document.addEventListener("click", onClick);
    // arriving with a hash (/#kontakt): land exactly once the page is unlocked
    if (location.hash.length > 1) jump(location.hash);

    return () => {
      document.removeEventListener("click", onClick);
      lenis?.destroy();
      root.classList.remove("cv-all");
    };
  }, [unlocked]);

  return null;
}
