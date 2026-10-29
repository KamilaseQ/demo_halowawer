"use client";

import { useRef, type RefObject } from "react";
import styles from "./Explorer.module.css";

export type SheetState = "peek" | "full";

/** Apple's projection: where a flick would come to rest (decelerationRate 0.998). */
const project = (velocity: number, rate = 0.998) => ((velocity / 1000) * rate) / (1 - rate);

/**
 * Mobile bottom-sheet grabber: tracks the finger 1:1 (height), then snaps to the state nearest the
 * momentum-projected height and lets the CSS transition continue from the current height.
 */
export function SheetHandle({
  panel,
  state,
  onChange,
  onHide,
}: {
  panel: RefObject<HTMLElement | null>;
  state: SheetState;
  onChange: (s: SheetState) => void;
  /** A pull well below the collapsed height hides the sheet down to its one-line bar. */
  onHide?: () => void;
}) {
  const drag = useRef<{ y: number; h: number; moved: boolean; samples: { t: number; h: number }[] } | null>(null);

  const snapHeights = () => {
    const el = panel.current!;
    const css = getComputedStyle(el);
    return { peek: parseFloat(css.getPropertyValue("--peek-h")) || 268, full: parseFloat(css.getPropertyValue("--full-h")) || window.innerHeight * 0.8 };
  };

  return (
    <button
      type="button"
      className={styles.grabber}
      aria-label={state === "peek" ? "Pokaż szczegóły" : "Zwiń szczegóły"}
      aria-expanded={state === "full"}
      onPointerDown={(e) => {
        const el = panel.current;
        if (!el) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const h = el.getBoundingClientRect().height;
        drag.current = { y: e.clientY, h, moved: false, samples: [{ t: e.timeStamp, h }] };
      }}
      // eslint-disable-next-line react-hooks/immutability -- inline styles on the sheet's DOM node while the finger drags it (DOM, not React state)
      onPointerMove={(e) => {
        const d = drag.current;
        const el = panel.current;
        if (!d || !el) return;
        const dy = e.clientY - d.y;
        if (!d.moved && Math.abs(dy) < 8) return; // hysteresis before committing to a drag
        d.moved = true;
        const { peek, full } = snapHeights();
        let h = d.h - dy;
        // Rubber-band past the ends instead of a hard stop.
        if (h > full) h = full + (h - full) * 0.25;
        // Below the collapsed height the sheet follows more freely: pulling on hides it.
        if (h < peek) h = peek - (peek - h) * (onHide ? 0.7 : 0.25);
        // eslint-disable-next-line react-hooks/immutability -- inline styles on the sheet's DOM node while the finger drags it (DOM, not React state)
        el.style.transition = "none";
        el.style.height = `${h}px`;
        d.samples.push({ t: e.timeStamp, h });
        if (d.samples.length > 5) d.samples.shift();
      }}
      // eslint-disable-next-line react-hooks/immutability -- inline styles on the sheet's DOM node while the finger drags it (DOM, not React state)
      onPointerUp={(e) => {
        const d = drag.current;
        const el = panel.current;
        drag.current = null;
        if (!d || !el) return;
        if (!d.moved) {
          onChange(state === "peek" ? "full" : "peek");
          return;
        }
        const first = d.samples[0];
        const last = d.samples[d.samples.length - 1];
        const velocity = ((last.h - first.h) / Math.max(1, last.t - first.t)) * 1000; // px/s, + = growing
        const { peek, full } = snapHeights();
        const landing = last.h + project(velocity);
        // Clear inline styles: the CSS transition now runs from the current height to the snap point.
        // eslint-disable-next-line react-hooks/immutability -- inline styles on the sheet's DOM node while the finger drags it (DOM, not React state)
        el.style.transition = "";
        el.style.height = "";
        if (onHide && landing < peek * 0.55) {
          onChange("peek");
          onHide();
          return;
        }
        onChange(Math.abs(landing - full) < Math.abs(landing - peek) ? "full" : "peek");
        void e;
      }}
      // eslint-disable-next-line react-hooks/immutability -- inline styles on the sheet's DOM node while the finger drags it (DOM, not React state)
      onPointerCancel={() => {
        drag.current = null;
        const el = panel.current;
        if (el) {
          // eslint-disable-next-line react-hooks/immutability -- inline styles on the sheet's DOM node while the finger drags it (DOM, not React state)
          el.style.transition = "";
          el.style.height = "";
        }
      }}
    >
      <span aria-hidden />
    </button>
  );
}
