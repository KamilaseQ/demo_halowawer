"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { houses, houseTag, type HouseId } from "@/lib/estate";
import { ESTATE_PHOTO } from "@/lib/estate/photo";
import { useExplorer } from "../state/store";
import ui from "../ui/ui.module.css";
import { IconCube } from "./icons";
import { useExplorerNav } from "./nav";
import styles from "./PhotoEntry.module.css";

const DRAG_START_PX = 10;
/** Margin around the houses' bounding box when framing the photo (fractions of its size). */
const PAD = { x: 0.06, top: 0.22, bottom: 0.08 };

type Region = { l: number; t: number; r: number; b: number };
type Measured = Region & { W: number; H: number };

/** Part of the stage not covered by floating UI: right of the desktop panel, between the mobile bars and sheet. */
function freeRegion(box: DOMRect): Region {
  const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--explorer-header")) || 72;
  const reg: Region = { l: 0, t: header, r: box.width, b: box.height };
  for (const el of document.querySelectorAll<HTMLElement>("[data-explorer-panel], [data-explorer-rail], [data-entry-controls]")) {
    if (el.closest("[data-photo-entry]")) continue;
    const rr = el.getBoundingClientRect();
    if (!rr.width || !rr.height) continue;
    const x0 = rr.left - box.left;
    const x1 = rr.right - box.left;
    const y0 = rr.top - box.top;
    const y1 = rr.bottom - box.top;
    const vertical = rr.height > rr.width;
    if (vertical && x0 < box.width * 0.4) reg.l = Math.max(reg.l, x1 + 16);
    else if (vertical && x0 > box.width * 0.6) reg.r = Math.min(reg.r, x0 - 12);
    else if (y0 > box.height * 0.4) reg.b = Math.min(reg.b, y0 - 12);
    else if (y1 < box.height * 0.4) reg.t = Math.max(reg.t, y1 + 8);
  }
  return reg;
}

/**
 * Estate entry on the developer's aerial render: the LCP image and the no-WebGL fallback. Every house is
 * a soft glass outline (sold ones stay quiet); hover syncs with the list, click opens the house.
 * Dragging or "Zobacz makietę 3D" dissolves the photo into the 3D maquette, which flies in underneath.
 */
export function PhotoEntry({ active, canExplore }: { active: boolean; canExplore: boolean }) {
  const hovered = useExplorer((s) => s.hovered);
  const ready = useExplorer((s) => s.ready);
  const [pending, setPending] = useState(false);
  const { toHouse } = useExplorerNav();
  const box = useRef<HTMLDivElement>(null);
  const [region, setRegion] = useState<Measured | null>(null);
  const panelCollapsed = useExplorer((s) => s.panelCollapsed);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const photo = ESTATE_PHOTO;

  // Re-measure the free stage area whenever the stage or the floating UI around it changes size.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setRegion({ ...freeRegion(el.getBoundingClientRect()), W: el.clientWidth, H: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const ui of document.querySelectorAll("[data-explorer-panel], [data-explorer-rail]")) ro.observe(ui);
    measure();
    // Rolling the panel up or down resizes nothing observed: measure again once the UI has settled.
    const t = window.setTimeout(measure, 340);
    return () => {
      ro.disconnect();
      window.clearTimeout(t);
    };
  }, [panelCollapsed]);

  /* Fit the houses (padded bounding box) into the free region, but always cover the whole stage. */
  const frame = useMemo(() => {
    if (!region) return null;
    const { x0, y0, x1, y1 } = photo.focus;
    const fw = (x1 - x0) * (1 + 2 * PAD.x);
    const fh = (y1 - y0) * (1 + PAD.top + PAD.bottom);
    const fcx = (x0 + x1) / 2;
    const fcy = y0 - (y1 - y0) * PAD.top + fh / 2;
    const { W, H } = region;
    const rw = Math.max(1, region.r - region.l);
    const rh = Math.max(1, region.b - region.t);
    const s = Math.max(Math.min(rw / fw, rh / fh), W / photo.width, H / photo.height);
    const fullW = photo.width * s;
    const fullH = photo.height * s;
    const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, Math.min(lo, hi)), Math.max(lo, hi));
    const ox = clamp(region.l + rw / 2 - fcx * s, W - fullW, 0);
    const oy = clamp(region.t + rh / 2 - fcy * s, H - fullH, 0);
    return { s, fullW, fullH, ox, oy };
  }, [region, photo]);

  // Before the scene is ready the photo stays until the model can take over.
  const explore = () => (ready ? useExplorer.setState({ entry: "model", hovered: null }) : setPending(true));
  useEffect(() => {
    if (ready && pending) useExplorer.setState({ entry: "model", hovered: null });
  }, [ready, pending]);

  const tags = useMemo(() => {
    if (!frame) return [];
    return houses.map((h) => {
      const [mx, my] = photo.markers[h.id];
      return { h, x: mx * frame.s + frame.ox, y: my * frame.s + frame.oy };
    });
  }, [frame, photo]);

  const open = (id: HouseId) => toHouse(id);

  return (
    <div
      ref={box}
      className={styles.entry}
      data-photo-entry
      // Fades in once laid out (the cover-cropped poster underneath is the LCP until then).
      data-active={(active && !!frame) || undefined}
      aria-hidden={!active}
      onPointerDown={(e) => {
        if (!canExplore || (e.target as Element).closest("path, button")) return;
        drag.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) < DRAG_START_PX) return;
        drag.current = null;
        explore();
      }}
      onPointerUp={() => (drag.current = null)}
    >
      <div
        className={styles.frame}
        style={frame ? { width: frame.fullW, height: frame.fullH, transform: `translate(${frame.ox}px, ${frame.oy}px)` } : { width: "100%", height: "100%" }}
      >
        <Image src={photo.src} alt="Osiedle Halo Wawer z lotu ptaka: siedem domów, od lewej A, B, C, D, E, F i G" fill priority sizes="100vw" className={styles.image} />
        <svg className={styles.svg} viewBox={`0 0 ${photo.width} ${photo.height}`}>
          {houses.map((h) => (
            <path
              key={h.id}
              d={photo.houses[h.id]}
              className={styles.unit}
              data-sold={h.status === "sold" || undefined}
              data-hover={hovered === h.id || undefined}
              tabIndex={active ? 0 : -1}
              role="link"
              aria-label={houseTag(h)}
              onPointerEnter={() => useExplorer.setState({ hovered: h.id })}
              onPointerLeave={() => useExplorer.setState({ hovered: null })}
              onFocus={() => useExplorer.setState({ hovered: h.id })}
              onBlur={() => useExplorer.setState({ hovered: null })}
              onClick={() => open(h.id)}
              onKeyDown={(e) => e.key === "Enter" && open(h.id)}
            />
          ))}
        </svg>
      </div>
      {tags.map(({ h, x, y }) => (
        <button
          key={h.id}
          type="button"
          className={styles.tag}
          data-active={hovered === h.id || undefined}
          data-sold={h.status === "sold" || undefined}
          tabIndex={-1}
          style={{ transform: `translate(${x}px, ${y}px) translate(-50%, -100%)` }}
          onPointerEnter={() => useExplorer.setState({ hovered: h.id })}
          onPointerLeave={() => useExplorer.setState({ hovered: null })}
          onClick={() => open(h.id)}
        >
          {hovered === h.id || h.status === "sold" ? houseTag(h) : `Dom ${h.id}`}
        </button>
      ))}
      {canExplore && (
        <button type="button" className={`${styles.explore} ${ui.glass}`} onClick={explore} tabIndex={active ? 0 : -1} data-entry-controls>
          <IconCube size={18} />
          {pending && !ready ? "Wczytuję makietę 3D…" : "Zobacz makietę 3D"}
        </button>
      )}
    </div>
  );
}

