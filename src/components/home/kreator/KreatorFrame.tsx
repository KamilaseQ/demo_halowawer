"use client";

import { useEffect, useRef } from "react";
import { whenCalm } from "@/lib/idle";
import { leadContext } from "@/lib/lead";
import { KREATOR_HOUSE } from "./KreatorActions";

/** The configurator is a standalone page (public/kreator) with its own styles and pictures. */
export const KREATOR_SRC = "/kreator/index.html";

/**
 * Hands the configurator to its frame when the section comes near (1.5
 * windows ahead, in a calm moment), so it never competes with the film. On phones the
 * frame grows with the configurator instead of scrolling inside itself. With
 * smooth scrolling on, wheel turns over the frame keep moving the page
 * smoothly unless a list inside the configurator can scroll.
 */
export function KreatorFrame() {
  const frameRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    const ifr = iframeRef.current;
    if (!frame || !ifr) return;

    const ac = new AbortController();
    let started = false;
    let ro: ResizeObserver | null = null;

    /* A new height for the frame. When the whole frame is above the window
       (the configurator loaded while the visitor was further down), the page
       under it would jump by the difference: measure what really moved and
       scroll it back before the next paint, so the visitor sees nothing move. */
    function setHeight(value: string) {
      if (frame!.getBoundingClientRect().bottom > 0) {
        frame!.style.height = value;
        return;
      }
      const ref = frame!.closest("section")?.nextElementSibling ?? document.body;
      const before = ref.getBoundingClientRect().top;
      frame!.style.height = value;
      const moved = ref.getBoundingClientRect().top - before;
      if (Math.abs(moved) > 0.5) window.scrollBy(0, moved);
    }

    /* the configurator switches to its stacked phone layout when ITS width is
       900 px or less (the frame is narrower than the window), so decide by that */
    let retry = 0;
    function fit() {
      if (!frame || !ifr) return;
      // never mid-glide (an anchor jump, a smooth wheel): the scroller would overwrite the correction
      const root = document.documentElement;
      if (root.classList.contains("cv-all") || root.classList.contains("lenis-smooth")) {
        window.clearTimeout(retry);
        retry = window.setTimeout(fit, 250);
        return;
      }
      if (ifr.clientWidth > 900) {
        if (frame.style.height) setHeight("");
        return;
      }
      try {
        const d = ifr.contentDocument;
        if (!d?.documentElement) return;
        const h = Math.ceil(d.documentElement.scrollHeight);
        if (h > 200 && Math.abs(h - frame.offsetHeight) > 2) setHeight(`${h}px`);
      } catch {
        /* frame not readable: keep the CSS height */
      }
    }

    function onLoad() {
      frame!.classList.add("is-ready");
      fit();
      try {
        const doc = ifr!.contentDocument;
        if (doc?.body) {
          ro = new ResizeObserver(fit);
          ro.observe(doc.body);
        }
        if (doc) {
          forwardWheel(doc, ac.signal);
          // using the configurator = interest in its house: contact actions carry it from now on
          doc.addEventListener("pointerdown", () => leadContext.set({ ...leadContext.get(), house: KREATOR_HOUSE }), {
            once: true,
            signal: ac.signal,
          });
        }
      } catch {
        /* not readable in some setup: the frame still works on its own */
      }
    }

    function start() {
      if (started) return;
      started = true;
      ifr!.addEventListener("load", onLoad, { signal: ac.signal });
      ifr!.src = KREATOR_SRC;
    }

    window.addEventListener("resize", () => started && fit(), { signal: ac.signal });

    /* The frame is same-origin, so its first paint (recolouring a 2048 px
       render) runs on this page's main thread: start it 1.5 windows ahead in
       a calm moment, or once it is on screen and the visitor pauses; never
       in the middle of a scroll. */
    const near = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        near.disconnect();
        whenCalm(start, { quiet: 800, signal: ac.signal });
      },
      { rootMargin: "150% 0px" },
    );
    // on screen: as soon as the visitor pauses on it (never mid-scroll: its first paint is a long task)
    const visible = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      visible.disconnect();
      whenCalm(start, { quiet: 400, signal: ac.signal });
    });
    // the section's box exists even while content-visibility skips its contents
    near.observe(frame.closest("section") ?? frame);
    visible.observe(frame);

    return () => {
      ac.abort();
      window.clearTimeout(retry);
      near.disconnect();
      visible.disconnect();
      ro?.disconnect();
    };
  }, []);

  return (
    <div className="kreator__frame reveal" id="kreator-frame" ref={frameRef}>
      <iframe title="Kreator wnętrz domu A" ref={iframeRef} />
      <p className="kreator__wait">Wczytywanie kreatora…</p>
    </div>
  );
}

/* Wheel turns inside the frame never reach the page's smooth scroller
   (Lenis listens on the parent window). Pass them on, unless something inside
   the configurator can still scroll that way. */
function forwardWheel(doc: Document, signal: AbortSignal) {
  doc.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey || !document.documentElement.classList.contains("lenis")) return;
      if (canScroll(e.target as Element | null, e.deltaY, doc)) return;
      e.preventDefault();
      window.dispatchEvent(
        new WheelEvent("wheel", { deltaX: e.deltaX, deltaY: e.deltaY, deltaMode: e.deltaMode, cancelable: true }),
      );
    },
    { passive: false, signal },
  );
}

function canScroll(el: Element | null, dy: number, doc: Document) {
  const win = doc.defaultView;
  for (let n = el; n && n !== doc.documentElement; n = n.parentElement) {
    if (n.scrollHeight <= n.clientHeight + 1) continue;
    const oy = win?.getComputedStyle(n).overflowY;
    if (oy !== "auto" && oy !== "scroll") continue;
    if (dy < 0 ? n.scrollTop > 0 : n.scrollTop + n.clientHeight < n.scrollHeight - 1) return true;
  }
  return false;
}
