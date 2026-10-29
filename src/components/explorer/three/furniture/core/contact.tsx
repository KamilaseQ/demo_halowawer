"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";

/* ==========================================================================
   Soft contact shadows: footprints (rounded rectangles in plan) are blurred
   into an alpha mask on a plane just above the floor. A cheap stand-in for
   the large-scale occlusion that grounds furniture in the render (N8AO only
   covers the last few centimetres).
   ========================================================================== */

/** Plan footprint in world x/z; `r` rounds the corners (r ≥ half the size → circle/stadium). */
export type Footprint = { x0: number; x1: number; z0: number; z1: number; r?: number };

const PPM = 110;

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function build(shapes: Footprint[], spread: number, y: number, opacity: number, color: string) {
  const minX = Math.min(...shapes.map((s) => s.x0)) - spread;
  const maxX = Math.max(...shapes.map((s) => s.x1)) + spread;
  const minZ = Math.min(...shapes.map((s) => s.z0)) - spread;
  const maxZ = Math.max(...shapes.map((s) => s.z1)) + spread;
  const W = Math.max(8, Math.ceil((maxX - minX) * PPM));
  const H = Math.max(8, Math.ceil((maxZ - minZ) * PPM));
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  // Shapes are drawn off-canvas; only their blurred shadow lands on it (Gaussian, works everywhere).
  const off = W + 200;
  ctx.shadowColor = "#fff";
  ctx.shadowBlur = spread * PPM * 0.85;
  ctx.shadowOffsetX = off;
  ctx.fillStyle = "#fff";
  for (const s of shapes) {
    roundedRect(ctx, (s.x0 - minX) * PPM - off, (s.z0 - minZ) * PPM, (s.x1 - s.x0) * PPM, (s.z1 - s.z0) * PPM, (s.r ?? 0.03) * PPM);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  // Canvas row 0 = min z (texture flipY + plane rotated to face up).
  const geo = new THREE.PlaneGeometry(maxX - minX, maxZ - minZ).rotateX(-Math.PI / 2).translate((minX + maxX) / 2, y, (minZ + maxZ) / 2);
  const mat = new THREE.MeshBasicMaterial({
    color,
    alphaMap: tex,
    transparent: true,
    opacity,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    name: "furn:contactShadow",
  });
  return { geo, mat, tex };
}

/**
 * Soft blob shadow under furniture. `y` sits just above whatever the piece stands on
 * (0.006 on bare floor, ~0.02 on the living-room rug).
 */
export function ContactShadow({
  shapes,
  spread = 0.25,
  y = 0.006,
  opacity = 0.3,
  color = "#120d08",
}: {
  shapes: Footprint[];
  spread?: number;
  y?: number;
  opacity?: number;
  color?: string;
}) {
  const key = JSON.stringify(shapes);
  // Shapes arrive as literals; the serialised key keeps the bake stable across renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const res = useMemo(() => build(shapes, spread, y, opacity, color), [key, spread, y, opacity, color]);
  useEffect(
    () => () => {
      res?.geo.dispose();
      res?.mat.dispose();
      res?.tex.dispose();
    },
    [res],
  );
  if (!res) return null;
  return <mesh geometry={res.geo} material={res.mat} renderOrder={1} />;
}
