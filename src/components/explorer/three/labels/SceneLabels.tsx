"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import styles from "./SceneLabels.module.css";

export type SceneLabel = {
  id: string;
  text: string;
  /** World-space anchor; the label sits centred above it. */
  position: THREE.Vector3;
  onClick?: () => void;
  /** Visual emphasis (hovered/selected unit). */
  active?: boolean;
  /** Quiet variant (sold houses). */
  muted?: boolean;
};

/**
 * DOM labels for 3D anchors without React roots (drei <Html> remounts roots, which React 19
 * StrictMode reports). Buttons live in the explorer's [data-label-layer] and are positioned each
 * rendered frame from the projected anchor, so they follow the camera including lens shift.
 * The frame loop only writes to the DOM: label sizes come from a ResizeObserver, so moving the
 * camera never forces a layout.
 */
export function SceneLabels({ items, visible, stack = false }: { items: SceneLabel[]; visible: boolean; /** Never hide on overlap: lift the label above the ones already placed. */ stack?: boolean }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const els = useRef(new Map<string, HTMLButtonElement>());
  const sizes = useRef(new WeakMap<Element, { w: number; h: number }>());
  const placedAt = useRef(new WeakMap<Element, string>());
  const latest = useRef(items);
  useLayoutEffect(() => {
    latest.current = items;
  });
  const v = useRef(new THREE.Vector3());

  const key = items.map((i) => i.id).join("|");
  useEffect(() => {
    const layer = document.querySelector<HTMLElement>("[data-label-layer]");
    if (!layer) return;
    const map = els.current;
    const measured = sizes.current;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const box = e.borderBoxSize?.[0];
        measured.set(e.target, box ? { w: box.inlineSize, h: box.blockSize } : { w: e.contentRect.width, h: e.contentRect.height });
      }
      // Declutter with the real sizes.
      invalidate();
    });
    for (const it of latest.current) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = styles.label;
      b.addEventListener("click", () => latest.current.find((x) => x.id === it.id)?.onClick?.());
      layer.appendChild(b);
      map.set(it.id, b);
      ro.observe(b);
    }
    return () => {
      ro.disconnect();
      for (const b of map.values()) b.remove();
      map.clear();
    };
  }, [key, invalidate]);

  useFrame(() => {
    // Greedy declutter: active labels first, then nearer ones; a label that would overlap one already
    // placed is hidden for this frame (keeps small screens readable).
    const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
    const ordered = latest.current
      .map((it) => {
        v.current.copy(it.position).project(camera);
        return { it, x: ((v.current.x + 1) / 2) * size.width, y: ((1 - v.current.y) / 2) * size.height, z: v.current.z };
      })
      .sort((a, b) => Number(!!b.it.active) - Number(!!a.it.active) || a.z - b.z);

    for (const { it, x, y: anchorY, z } of ordered) {
      const b = els.current.get(it.id);
      if (!b) continue;
      if (b.textContent !== it.text) b.textContent = it.text;
      const box = sizes.current.get(b);
      const w = box?.w || 80;
      const h = box?.h || 28;
      const hit = (yy: number) => {
        const r0 = { x0: x - w / 2 - 4, y0: yy - h - 4, x1: x + w / 2 + 4, y1: yy + 4 };
        return placed.some((r) => r0.x0 < r.x1 && r0.x1 > r.x0 && r0.y0 < r.y1 && r0.y1 > r.y0);
      };
      // Stacking mode: step the label up past whatever is already placed there (a few steps at most).
      let y = anchorY;
      if (stack) for (let i = 0; i < 4 && hit(y); i++) y -= h + 6;
      const transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`;
      if (placedAt.current.get(b) !== transform) {
        placedAt.current.set(b, transform);
        b.style.transform = transform;
      }
      const rect = { x0: x - w / 2 - 4, y0: y - h - 4, x1: x + w / 2 + 4, y1: y + 4 };
      const overlaps = hit(y);
      const hidden = !visible || z > 1 || overlaps;
      if (!hidden) placed.push(rect);
      if (b.dataset.hidden !== String(hidden)) {
        b.dataset.hidden = String(hidden);
        b.tabIndex = hidden ? -1 : 0;
      }
      if (b.dataset.active !== String(!!it.active)) b.dataset.active = String(!!it.active);
      if (b.dataset.muted !== String(!!it.muted)) b.dataset.muted = String(!!it.muted);
    }
  });

  return null;
}
