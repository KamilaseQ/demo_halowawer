"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { circle, cylinder, disc, lathe, rod, roundRect, softBox, sweep, tube } from "../core/geometry";
import { Kit, instanceMatrix } from "../core/kit";
import { bookRow, downlight } from "../core/pieces";
import { CeilingMount, KitInstances, KitMesh, WallCut, useKit } from "../core/runtime";
import { FinishOnly } from "../core/variants";
import { F, GAP, L, W, WEAVE, bendZ, driedStems, globePendant, herbPot, linearPendant, paperLantern, pears, vase, woodBowl } from "./parts";
import { CEILING } from "./living";

/* ==========================================================================
   Kitchen and dining of layout B, as on the developer's plan: the run on the
   party wall (plan y 7.26–7.86, x 0.42–3.44), tall units against the core
   partition (x 3.44–4.04, y 5.76–7.86), a 2 m table for six across the room
   (long axis along x) under one big pendant. Styles: s1 white lowers + oak,
   s4 oak, s3 anthracite + black oak (cabinetLacquer / cabinetWood slots).
   ========================================================================== */

const WALL = 7.862;
const FRONT = 7.26;
const RUN: number[] = [0.42, 0.82, 1.42, 2.02, 2.62, 3.22, 3.44];
const TALL_X = 3.44;
const TALL = { z0: 5.762, z1: WALL, top: 2.4 };
/** Exterior-wall cut height in the dollhouse (party wall). */
export const CUT = 1.0;

const SINK = { x0: 2.09, x1: 2.55, z0: 7.38, z1: 7.74 };
const HOB = { x0: 0.88, x1: 1.36, z0: 7.32, z1: 7.8 };

/** Dining table centre (plan) and size. */
export const TABLE = { x: 1.65, z: 5.35, w: 2.0, d: 0.92, h: 0.75 };

/* ---------- base run ---------- */

function fronts(k: Kit, x0: number, x1: number, rows: [number, number][], key = L) {
  for (const [y0, y1] of rows) k.box(key, x0 + GAP, x1 - GAP, y0, y1, FRONT, FRONT + 0.02, { worldUV: true, r: 0.0015 });
}

function baseRun(k: Kit) {
  const x0 = RUN[0], x1 = RUN[RUN.length - 1];
  k.box("black", x0, x1, 0.004, 0.1, FRONT + 0.06, WALL);
  // Dark carcass face behind the fronts (shows in the shadow gaps).
  k.box("gap", x0, x1, 0.1, 0.86, FRONT + 0.02, FRONT + 0.05);
  const d3: [number, number][] = [
    [0.1, 0.36],
    [0.36 + GAP * 2, 0.61],
    [0.61 + GAP * 2, 0.86],
  ];
  const door: [number, number][] = [[0.1, 0.86]];
  fronts(k, RUN[0], RUN[1], d3);
  // Oven under the hob: a drawer, then black glass with a steel bar handle.
  fronts(k, RUN[1], RUN[2], [[0.1, 0.24]]);
  k.box("black", RUN[1] + 0.004, RUN[2] - 0.004, 0.245, 0.86, FRONT + 0.004, FRONT + 0.02, { r: 0.002 });
  k.box("screen", RUN[1] + 0.03, RUN[2] - 0.03, 0.3, 0.74, FRONT - 0.001, FRONT + 0.005, { r: 0.002 });
  k.add("steel", rod([RUN[1] + 0.06, 0.8, FRONT - 0.03], [RUN[2] - 0.06, 0.8, FRONT - 0.03], 0.008, 0.008, 10));
  for (const x of [RUN[1] + 0.07, RUN[2] - 0.07]) k.add("steel", rod([x, 0.8, FRONT - 0.03], [x, 0.8, FRONT + 0.004], 0.006, 0.006, 8));
  fronts(k, RUN[2], RUN[3], d3);
  fronts(k, RUN[3], RUN[4], door);
  fronts(k, RUN[4], RUN[5], door);
  fronts(k, RUN[5], RUN[6], door);
  // Recessed J-pull channel under the worktop.
  k.box("black", x0, x1, 0.86, 0.88, FRONT + 0.02, FRONT + 0.04);

  // Stone worktop around the integrated sink (one continuous slab look).
  k.box("stone", x0, x1, 0.88, 0.92, FRONT - 0.02, SINK.z0, { worldUV: true, r: 0.003, sharp: { z1: true, x0: true, x1: true, bottom: true } });
  k.box("stone", x0, x1, 0.88, 0.92, SINK.z1, WALL, { worldUV: true, r: 0, sharp: { x0: true, x1: true } });
  k.box("stone", x0, SINK.x0, 0.88, 0.92, SINK.z0, SINK.z1, { worldUV: true, r: 0 });
  k.box("stone", SINK.x1, x1, 0.88, 0.92, SINK.z0, SINK.z1, { worldUV: true, r: 0 });
  const bottom = 0.7;
  k.box("stone", SINK.x0, SINK.x1, bottom - 0.012, bottom, SINK.z0, SINK.z1, { worldUV: true });
  k.box("stone", SINK.x0, SINK.x1, bottom, 0.88, SINK.z0 - 0.012, SINK.z0, { worldUV: true });
  k.box("stone", SINK.x0, SINK.x1, bottom, 0.88, SINK.z1, SINK.z1 + 0.012, { worldUV: true });
  k.box("stone", SINK.x0 - 0.012, SINK.x0, bottom, 0.88, SINK.z0, SINK.z1, { worldUV: true });
  k.box("stone", SINK.x1, SINK.x1 + 0.012, bottom, 0.88, SINK.z0, SINK.z1, { worldUV: true });
  const sc = (SINK.x0 + SINK.x1) / 2;
  k.add("steel", cylinder(0.045, 0.003, 32).translate(sc, bottom, (SINK.z0 + SINK.z1) / 2));
  k.add("black", disc(0.03, 24).translate(sc, bottom + 0.0035, (SINK.z0 + SINK.z1) / 2));

  // Induction hob, flush black glass.
  const hob = new THREE.PlaneGeometry(HOB.x1 - HOB.x0, HOB.z1 - HOB.z0).rotateX(-Math.PI / 2);
  k.add("hob", hob, [(HOB.x0 + HOB.x1) / 2, 0.9206, (HOB.z0 + HOB.z1) / 2]);
  k.box("black", HOB.x0 - 0.002, HOB.x1 + 0.002, 0.915, 0.9203, HOB.z0 - 0.002, HOB.z1 + 0.002, { r: 0.001 });

  // Tall mixer tap behind the sink.
  const tz = 7.8;
  k.add("metal", cylinder(0.024, 0.03, 32).translate(sc, 0.92, tz));
  k.add("metal", tube([[sc, 0.94, tz], [sc, 1.18, tz], [sc, 1.235, tz - 0.03], [sc, 1.24, tz - 0.1], [sc, 1.225, tz - 0.17]], 0.0115, 40, 14, true));
  k.add("metal", rod([sc + 0.022, 1.0, tz], [sc + 0.06, 1.012, tz], 0.006, 0.005, 10));
}

/** Seam control for parts split at the dollhouse cut height (no bevel where the halves meet). */
const seam = (y0: number, y1: number) => ({ top: Math.abs(y1 - CUT) < 1e-6, bottom: Math.abs(y0 - CUT) < 1e-6 });

function backsplash(k: Kit, y0: number, y1: number) {
  k.box("stone", RUN[0], TALL_X, y0, y1, WALL - 0.016, WALL, { worldUV: true, r: 0.001, sharp: seam(y0, y1) });
}

/** Lived-in counter: oak boards against the splash, oil bottle, pepper mill, cookbooks. */
function counterDecor(k: Kit) {
  const top = 0.92;
  k.add(W, softBox(0.34, 0.46, 0.022, { r: 0.008, edge: 2, step: 0.3 }), [0.6, top + 0.226, 7.81], [-0.12, 0.05, 0]);
  k.add(W, softBox(0.26, 0.34, 0.02, { r: 0.008, edge: 2, step: 0.3 }), [0.68, top + 0.166, 7.77], [-0.1, -0.08, 0]);
  k.add("glassTint", lathe([[0, 0], [0.032, 0], [0.034, 0.005], [0.034, 0.2], [0.03, 0.225], [0.013, 0.255], [0.012, 0.28], [0, 0.28]], { segments: 24 }), [1.6, top, 7.7]);
  k.add("black", cylinder(0.0135, 0.022, 16).translate(1.6, top + 0.278, 7.7));
  k.add(W, lathe([[0, 0], [0.027, 0], [0.03, 0.03], [0.022, 0.09], [0.026, 0.15], [0.02, 0.19], [0.008, 0.2], [0, 0.2]], { segments: 24 }), [1.68, top, 7.76]);
  bookRow(k, [2.96, top, 7.74], [
    [0.032, 0.26, 0.2, "#c8bba8"],
    [0.026, 0.24, 0.19, "#3d3935"],
    [0.03, 0.25, 0.2, "#e1d9cc"],
  ]);
}

/* ---------- wall units (above the dollhouse cut) ---------- */

function uppers(k: Kit) {
  const y0 = 1.5, y1 = TALL.top, back = 7.52;
  const x0 = RUN[0], x1 = TALL_X;
  k.box(W, x0, x1, y0, y1, back, WALL, { r: 0.001, worldUV: true });
  k.box("gap", x0, x1, y0 + 0.002, y1 - 0.002, back - 0.004, back);
  // Five handleless doors, lip 15 mm below the carcass as the finger pull.
  const n = 5;
  const w = (x1 - x0) / n;
  for (let i = 0; i < n; i++) k.box(W, x0 + i * w + GAP, x0 + (i + 1) * w - GAP, 1.484, y1 - 0.002, back - 0.024, back - 0.004, { r: 0.0015, worldUV: true });
  // Recessed LED profile with an opal diffuser, just behind the door line.
  k.box("black", x0 + 0.02, x1 - 0.02, 1.489, 1.5, back + 0.016, back + 0.046, { r: 0.001 });
  k.box("glowLED", x0 + 0.026, x1 - 0.026, 1.4875, 1.4895, back + 0.02, back + 0.042, { r: 0 });
  // Flush integrated hood above the hob.
  k.box("steel", HOB.x0 + 0.02, HOB.x1 - 0.02, 1.4885, 1.5, back + 0.06, WALL - 0.03, { r: 0.001 });
}

/* ---------- tall units on the core partition (interior wall, no cutaway) ---------- */

function tallUnits(k: Kit) {
  const { z0, z1, top } = TALL;
  const x0 = TALL_X, x1 = 4.043;
  k.box("black", x0 + 0.06, x1, 0.004, 0.1, z0 + 0.04, z1);
  k.box("gap", x0 + 0.02, x1, 0.1, top - 0.02, z0 + 0.02, z1);
  // End panel facing the salon (and the kuchnia viewpoint), grain-matched, with a black edge line.
  k.box(W, x0, x1, 0.004, top, z0, z0 + 0.02, { worldUV: true, r: 0.0015 });
  k.box("black", x0 - 0.001, x0 + 0.002, 0.004, top, z0, z0 + 0.02, { r: 0 });
  // Three columns of fronts (pantry, fridge, pantry): tall door + top door; above the worktop run the
  // carcass side shows as an oak panel.
  const zf = FRONT - 0.02;
  const cols = 3;
  const w = (zf - (z0 + 0.02)) / cols;
  for (let i = 0; i < cols; i++) {
    const a = z0 + 0.02 + i * w + GAP;
    const b = z0 + 0.02 + (i + 1) * w - GAP;
    k.box(W, x0 - 0.02, x0, 0.1, 1.95, a, b, { worldUV: true, r: 0.0015 });
    k.box(W, x0 - 0.02, x0, 1.95 + GAP * 2, top, a, b, { worldUV: true, r: 0.0015 });
  }
  k.box(W, x0, x0 + 0.02, 0.92, top, zf, z1, { worldUV: true, r: 0.0015 });
  k.box(W, x0, x1, top - 0.02, top, z0, z1, { worldUV: true, r: 0.0015 });
}

/* ---------- dining ---------- */

/** Solid table: thick top on four square legs flush with the corners (oak / smoked oak). */
function diningTable(k: Kit) {
  const { x, z, w, d, h } = TABLE;
  const t = 0.05;
  k.add(W, softBox(w, t, d, { r: 0.006, edge: 2, step: 4, uvSwap: true }), [x, h - t / 2, z]);
  const leg = 0.085;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const cx = x + sx * (w / 2 - leg / 2 - 0.004);
      const cz = z + sz * (d / 2 - leg / 2 - 0.004);
      k.box(W, cx - leg / 2, cx + leg / 2, 0.004, h - t, cz - leg / 2, cz + leg / 2, { r: 0.004, worldUV: true });
    }
  // Aprons between the legs.
  k.box(W, x - w / 2 + 0.09, x + w / 2 - 0.09, h - t - 0.08, h - t, z - d / 2 + 0.03, z - d / 2 + 0.05, { r: 0.002 });
  k.box(W, x - w / 2 + 0.09, x + w / 2 - 0.09, h - t - 0.08, h - t, z + d / 2 - 0.05, z + d / 2 - 0.03, { r: 0.002 });
}

/** s1: wishbone-style chair, bent oak frame and paper-cord seat. Local: seat centre at origin, faces +z. */
function wishboneChair(): Kit {
  const k = new Kit();
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  for (const s of [-1, 1]) k.add(W, rod([s * 0.205, 0.004, 0.2], [s * 0.2, 0.44, 0.19], 0.017, 0.015, 10));
  // Rear legs rise and curve back into the bent rail.
  const R = 0.26, railY = 0.7;
  const railAt = (t: number) => v(R * Math.sin(t), railY, -R * Math.cos(t) + 0.04);
  for (const s of [-1, 1]) {
    const top = railAt(s * 1.05);
    k.add(W, sweep([v(s * 0.2, 0.004, -0.22), v(s * 0.2, 0.25, -0.2), v(s * 0.2, 0.45, -0.18), v(top.x, railY - 0.08, top.z), v(top.x, railY - 0.005, top.z)], circle(1, 9), { segments: 12, up: [0, 0, 1], scale: (t) => 0.014 + 0.004 * Math.sin(Math.PI * Math.min(1, t * 1.2)) }));
  }
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 16; i++) pts.push(railAt(-1.45 + (2.9 * i) / 16));
  k.add(W, sweep(pts, roundRect(0.022, 0.05, 0.009, 1), { segments: 24, up: [0, 1, 0], caps: true }));
  // Y-shaped splat.
  k.add(W, sweep([v(0, 0.45, -0.19), v(0, 0.55, -0.215), v(0, 0.6, -0.225)], roundRect(0.05, 0.014, 0.006, 1), { segments: 4, up: [0, 0, 1], caps: true }));
  for (const s of [-1, 1]) k.add(W, sweep([v(0, 0.59, -0.224), v(s * 0.05, 0.65, -0.22), v(s * 0.075, railY - 0.01, -0.215)], roundRect(0.032, 0.012, 0.005, 1), { segments: 5, up: [0, 0, 1], caps: true }));
  // Seat frame rails and a woven paper-cord seat.
  for (const s of [-1, 1]) {
    k.add(W, rod([s * 0.2, 0.43, 0.19], [s * 0.2, 0.43, -0.18], 0.012, 0.012, 8));
    k.add(W, rod([s * 0.205, 0.18, 0.19], [s * 0.2, 0.18, -0.2], 0.009, 0.009, 6));
  }
  k.add(W, rod([-0.2, 0.43, 0.19], [0.2, 0.43, 0.19], 0.012, 0.012, 8));
  k.add(W, rod([-0.2, 0.43, -0.18], [0.2, 0.43, -0.18], 0.012, 0.012, 8));
  k.add("wicker", softBox(0.4, 0.03, 0.38, { r: 0.012, edge: 2, step: 0.08, bulge: { top: -0.008 }, power: 2 }), [0, 0.445, 0.005]);
  return k;
}

/** s4: black spindle-back chair (Windsor-like). */
function spindleChair(): Kit {
  const k = new Kit();
  const B = "black" as const;
  k.add(B, softBox(0.44, 0.04, 0.42, { r: 0.016, edge: 2, step: 0.1, bulge: { top: -0.004 } }), [0, 0.45, 0]);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) k.add(B, rod([sx * 0.17, 0.43, sz * 0.15], [sx * 0.215, 0.004, sz * 0.2], 0.017, 0.013, 10));
  for (const sz of [-1, 1]) k.add(B, rod([-0.19, 0.17, sz * 0.17], [0.19, 0.17, sz * 0.17], 0.009, 0.009, 6));
  // Back: two posts, curved top rail, five spindles.
  const topY = 0.84;
  const railZ = (x: number) => -0.24 + 0.7 * x * x;
  for (const s of [-1, 1]) k.add(B, rod([s * 0.18, 0.46, -0.17], [s * 0.2, topY, railZ(0.2)], 0.013, 0.012, 8));
  const rail: THREE.Vector3[] = [];
  for (let i = 0; i <= 10; i++) {
    const x = -0.22 + (0.44 * i) / 10;
    rail.push(new THREE.Vector3(x, topY + 0.01, railZ(x)));
  }
  k.add(B, sweep(rail, roundRect(0.018, 0.06, 0.007, 1), { segments: 14, up: [0, 1, 0], caps: true }));
  for (let i = 0; i < 5; i++) {
    const x = -0.1 + i * 0.05;
    k.add(B, rod([x * 0.9, 0.46, -0.17], [x, topY - 0.02, railZ(x)], 0.006, 0.006, 6));
  }
  return k;
}

/** s3: upholstered shell chair on slim black legs. */
function shellChair(): Kit {
  const k = new Kit();
  k.add(F, softBox(0.47, 0.08, 0.45, { r: 0.035, bulge: { top: 0.012, z: 0.008 }, power: 3, wobble: 0.002, step: 0.07, edge: 2, seed: 81, uvScale: WEAVE }), [0, 0.47, 0.01]);
  k.add(F, bendZ(softBox(0.5, 0.42, 0.06, { r: 0.03, bulge: { front: 0.01, back: 0.008 }, power: 3, wobble: 0.002, step: 0.05, edge: 2, seed: 82, uvScale: WEAVE }), 1.1), [0, 0.72, -0.22], [-0.16, 0, 0]);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) k.add("black", rod([sx * 0.18, 0.44, sz * 0.16], [sx * 0.22, 0.004, sz * 0.21], 0.013, 0.008, 8));
  return k;
}

/** Chair placements: three a side of the long table. */
function seatMatrices() {
  const m: THREE.Matrix4[] = [];
  for (const dx of [-0.6, 0, 0.6]) {
    m.push(instanceMatrix([TABLE.x + dx, 0, TABLE.z - 0.83], 0));
    m.push(instanceMatrix([TABLE.x + dx, 0, TABLE.z + 0.83], Math.PI));
  }
  return m;
}

/* ---------- ceiling ---------- */

export const KITCHEN_DOWNLIGHTS: [number, number][] = [
  [0.95, 6.92],
  [1.95, 6.92],
  [2.95, 6.92],
];

/** Kitchen + dining: static parts merge into the level kit through `kitchenKit`; variants are components. */
export function kitchenKit(k: Kit) {
  baseRun(k);
  backsplash(k, 0.92, CUT);
  tallUnits(k);
  counterDecor(k);
  diningTable(k);
  // Table: a matte vase of dried grasses, a wooden bowl with pears.
  const neck = vase(k, [TABLE.x + 0.05, TABLE.h, TABLE.z + 0.02], "round", 0.85);
  driedStems(k, [TABLE.x + 0.05, neck - 0.03, TABLE.z + 0.02], 16, 0.42, 11, 0.38);
  woodBowl(k, [TABLE.x - 0.5, TABLE.h, TABLE.z - 0.1], 0.14);
  pears(k, [TABLE.x - 0.5, TABLE.h + 0.012, TABLE.z - 0.1]);
  herbPot(k, [1.95, 0.92, 7.68]);
}

export function kitchenCeiling(k: Kit) {
  for (const [x, z] of KITCHEN_DOWNLIGHTS) downlight(k, x, z, CEILING);
}

export function Kitchen() {
  const high = useKit(() => {
    const k = new Kit();
    backsplash(k, CUT, 1.5);
    uppers(k);
    return k;
  });
  const wishbone = useKit(wishboneChair);
  const spindle = useKit(spindleChair);
  const shell = useKit(shellChair);
  const seats = useMemo(() => seatMatrices(), []);
  const globe = useKit(() => {
    const k = new Kit();
    globePendant(k, TABLE.x, TABLE.z, 1.86, 0.21, CEILING);
    return k;
  });
  const lantern = useKit(() => {
    const k = new Kit();
    paperLantern(k, TABLE.x, TABLE.z, 1.86, 0.3, CEILING);
    return k;
  });
  const linear = useKit(() => {
    const k = new Kit();
    linearPendant(k, TABLE.x - 0.75, TABLE.x + 0.75, TABLE.z, 1.72, CEILING);
    return k;
  });

  return (
    <group>
      <WallCut wall="bliźniak" at={CUT}>
        <KitMesh kit={high} />
      </WallCut>
      <FinishOnly finishes={["s1"]}>
        <KitInstances kit={wishbone} matrices={seats} />
      </FinishOnly>
      <FinishOnly finishes={["s4"]}>
        <KitInstances kit={spindle} matrices={seats} />
      </FinishOnly>
      <FinishOnly finishes={["s3"]}>
        <KitInstances kit={shell} matrices={seats} />
      </FinishOnly>
      <CeilingMount>
        <FinishOnly finishes={["s1"]}>
          <KitMesh kit={globe} castShadow={false} />
        </FinishOnly>
        <FinishOnly finishes={["s4"]}>
          <KitMesh kit={lantern} castShadow={false} />
        </FinishOnly>
        <FinishOnly finishes={["s3"]}>
          <KitMesh kit={linear} castShadow={false} />
        </FinishOnly>
      </CeilingMount>
    </group>
  );
}
