"use client";

import { useEffect } from "react";
import { watchFilmBottom } from "@/lib/film-bounds";
import { isLite } from "@/lib/motion";
import { activeNav, type NavKey } from "@/lib/nav";

/**
 * Nav highlight for the content sections below the scroll film. While the
 * film track covers the middle of the window, the film owns the highlight
 * (chapters); once it has scrolled past, the section crossing the middle
 * lights its nav item.
 */
export function SectionNavObserver() {
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-nav]:not(.chapter)"));
    if (!sections.length) return;
    const lite = isLite();
    const film = watchFilmBottom();

    let raf = 0;
    function update() {
      raf = 0;
      const mid = window.innerHeight / 2;
      // no layout reads while the film covers the middle (it owns the highlight then)
      if (!lite && film.bottom - window.scrollY > mid) return;
      let key: NavKey = "home";
      for (const s of sections) {
        const r = s.getBoundingClientRect();
        if (r.top <= mid && r.bottom > mid) {
          key = s.dataset.nav as NavKey;
          break;
        }
      }
      activeNav.set(key);
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
    return () => {
      film.dispose();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
