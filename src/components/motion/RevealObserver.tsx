"use client";

import { useEffect } from "react";
import { isCapture, prefersReducedMotion } from "@/lib/motion";

/** Sections under the film use content-visibility: auto (sections.css). */
const SECTION = ".home > section, .contact";

/**
 * Scroll-in animations of the content sections (see motion.css).
 * - titles (.split) rise word by word, copy and cards (.reveal) fade up out of
 *   a soft blur, photos (.reveal-img) are unveiled from below
 * - inside a [data-stagger] group, items that arrive together come in 80 ms apart
 * - the stats count up once they show
 * The classes are in the server-rendered markup; this only adds .is-in.
 *
 * Work is gated per section: only the boxes of the sections themselves are
 * read while scrolling. Reading an element inside a section the browser is
 * skipping (content-visibility) would force that whole section to lay out,
 * on every scroll frame (measured: 0.5-0.7 s frames at 4x CPU during the film).
 */
export function RevealObserver() {
  useEffect(() => {
    if (isCapture()) return;

    const targets = Array.from(document.querySelectorAll<HTMLElement>(".split, .reveal, .reveal-img")).filter(
      (el) => !el.classList.contains("is-in"),
    );
    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-in"));
      return;
    }

    /* pending targets, grouped by their section */
    const groups = new Map<Element, Set<HTMLElement>>();
    for (const el of targets) {
      const sec = el.closest(SECTION) ?? el;
      if (!groups.has(sec)) groups.set(sec, new Set());
      groups.get(sec)!.add(el);
    }
    const rafs = new Set<number>();

    /* count the stats up (only the digits change; "100–120" counts both) */
    function countUp(el: HTMLElement) {
      if (el.dataset.counted) return;
      el.dataset.counted = "1";
      const text = el.textContent ?? "";
      const nums = (text.match(/\d+/g) ?? []).map(Number);
      if (!nums.length) return;
      const dur = 1400;
      let t0: number | null = null;
      const step = (now: number) => {
        t0 ??= now;
        const p = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - p, 3);
        let i = 0;
        el.textContent = text.replace(/\d+/g, () => String(Math.round(nums[i++] * e)));
        if (p < 1) rafs.add(requestAnimationFrame(step));
        else el.textContent = text;
      };
      rafs.add(requestAnimationFrame(step));
    }

    function show(list: HTMLElement[]) {
      list.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      let n = 0;
      for (const el of list) {
        if (el.parentElement?.closest("[data-stagger]")) el.style.setProperty("--d", `${n++ * 80}ms`);
        el.classList.add("is-in");
        if (el.classList.contains("about__stats")) el.querySelectorAll<HTMLElement>(".stat__value").forEach(countUp);
        io.unobserve(el);
        const sec = el.closest(SECTION) ?? el;
        const group = groups.get(sec);
        group?.delete(el);
        if (group && !group.size) {
          groups.delete(sec);
          gate.unobserve(sec);
        }
      }
    }

    /* precise trigger per element, only for sections near the viewport */
    const io = new IntersectionObserver(
      (entries) => show(entries.filter((e) => e.isIntersecting).map((e) => e.target as HTMLElement)),
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    const gate = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          gate.unobserve(e.target);
          groups.get(e.target)?.forEach((el) => io.observe(el));
        }
      },
      { rootMargin: "0px 0px 50% 0px" },
    );
    groups.forEach((_, sec) => gate.observe(sec));

    /* fast scrolling or jumping to an anchor: show whatever is already above the fold line.
       Sections first (cheap); elements only in a section that straddles the line (on screen, rendered). */
    let ticking = 0;
    function sweep() {
      ticking = 0;
      // at the very end of the page the last lines can never cross 92 %: then the whole window counts
      const atEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
      const line = window.innerHeight * (atEnd ? 1 : 0.92);
      const due: HTMLElement[] = [];
      groups.forEach((group, sec) => {
        const r = sec.getBoundingClientRect();
        if (r.top >= line) return;
        if (r.bottom <= line) due.push(...group);
        else group.forEach((el) => el.getBoundingClientRect().top < line && due.push(el));
      });
      if (due.length) show(due);
    }
    const onScroll = () => {
      if (!ticking && groups.size) ticking = requestAnimationFrame(sweep);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      io.disconnect();
      gate.disconnect();
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(ticking);
      rafs.forEach(cancelAnimationFrame);
    };
  }, []);

  return null;
}
