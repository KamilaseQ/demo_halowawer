"use client";

import * as THREE from "three";
import { arc, boxUV, cylinder, lathe, ovalLathe, rod, softBox, tint, tube } from "../core/geometry";
import { Kit, type FurnKey } from "../core/kit";
import { downlight, framedArt } from "../core/pieces";
import { deskKit } from "../core/seating";
import { ContactShadow, type Footprint } from "../core/contact";
import { LightPools, type Pool } from "../core/pools";
import { CeilingMount, KitMesh, WallCut, useKit } from "../core/runtime";
import { PracticalLights, type PracticalLight } from "../core/lights";
import {
  A,
  F,
  L,
  W,
  WEAVE,
  bedKit,
  books,
  candle,
  deskChairKit,
  leafyPlant,
  loungeChairKit,
  nightstand,
  oliveTree,
  paperLantern,
  pleatedBowl,
  pot,
  rug,
  sheerAlongZ,
  shelving,
  sideTable,
  smallGlobe,
  standingFrame,
  tableLamp,
  trackAlongZ,
  urn,
  vase,
  wardrobe,
} from "./parts";
import { pebbleChairKit } from "./living";

/* ==========================================================================
   First floor of layout B (ceiling 2.60). Sypialnia (garden side, render-
   matched: bed head on the pokój-1 wall, window ahead, wardrobe on the core
   partition), bathroom with the tub under the gable window, and the three
   rooms per arrangement:
     rodzina — pokój 1 and pokój 2 for the kids, pokój hobby as a home office;
     para    — pokój 1 as a study, pokój hobby as a gym, pokój 2 for guests,
               a dressing corner in the bedroom.
   ========================================================================== */

const CEIL = 2.6;

/* ---------- shared ---------- */

function placeBed(k: Kit, opts: Parameters<typeof bedKit>[0], at: [number, number], headToward: "-x" | "+x" | "-z" | "+z") {
  // bedKit puts the head at local −z.
  const yaw = { "-z": 0, "+z": Math.PI, "-x": Math.PI / 2, "+x": -Math.PI / 2 }[headToward];
  k.include(bedKit(opts), [at[0], 0, at[1]], [0, yaw, 0]);
}

function placeDesk(k: Kit, at: [number, number], yaw: number, w = 1.4, d = 0.65) {
  k.include(deskKit(w, d), [at[0], 0, at[1]], [0, yaw, 0]);
}

function placeChair(k: Kit, at: [number, number], yaw: number) {
  k.include(deskChairKit(), [at[0], 0, at[1]], [0, yaw, 0]);
}

function plantInPot(k: Kit, x: number, z: number, r: number, h: number, key: FurnKey, o: Parameters<typeof leafyPlant>[2]) {
  const soil = pot(k, x, z, r, h, key);
  leafyPlant(k, [x, soil, z], o);
}

/** Round rug in the rug slot (planar UVs). */
function roundRug(k: Kit, x: number, z: number, r: number) {
  k.add("rug", boxUV(lathe([[r, 0.004], ...arc(r - 0.006, 0.01, 0.006, 0, Math.PI / 2, 3), [0, 0.016]], { segments: 64 })), [x, 0, z]);
}

/** Floating oak wall shelf along x (on an interior wall at plan y = z, depth toward −y or +y). */
function wallShelfX(k: Kit, x0: number, x1: number, y: number, z0: number, z1: number) {
  k.box(W, x0, x1, y, y + 0.025, z0, z1, { r: 0.003, worldUV: true });
}

/* ---------- sypialnia (x 0.40–4.04, y 4.08–7.86) ---------- */

const BED = { x: 1.86, z: 5.19, w: 1.8, l: 2.0 };

function bedroom(k: Kit, para: boolean) {
  placeBed(k, { width: BED.w, length: BED.l, seed: 3, headboard: 1.15 }, [BED.x, BED.z], "-z");
  const t1 = nightstand(k, [0.7, 0, 4.3], 0);
  const t2 = nightstand(k, [3.0, 0, 4.3], 0);
  tableLamp(k, [0.66, t1, 4.24]);
  tableLamp(k, [3.0, t2, 4.24]);
  books(k, [3.08, t2, 4.4], -0.2);
  rug(k, 0.72, 3.02, 5.05, 7.0);
  // Wardrobe on the core partition, fronts toward the window.
  wardrobe(k, 3.44, 4.043, 5.2, 7.862, 5, "x0", 2.4, L);
  if (para) {
    // Dressing corner by the window: oak dressing table, round mirror (interior side only), pouf; bench at the bed foot.
    k.box(W, 0.55, 1.75, 0.72, 0.76, 7.4, 7.862, { r: 0.004, edge: 2, worldUV: true });
    for (const x of [0.6, 1.7]) k.box(W, x - 0.02, x + 0.02, 0.004, 0.72, 7.44, 7.84, { r: 0.004 });
    k.add(F, softBox(0.42, 0.42, 0.42, { r: 0.16, bulge: { top: 0.02, x: 0.02, z: 0.02 }, power: 2.4, wobble: 0.003, step: 0.08, edge: 3, seed: 120, uvScale: WEAVE }), [1.15, 0.21, 7.05]);
    candle(k, [0.75, 0.76, 7.6]);
    books(k, [1.4, 0.76, 7.62], 1.2);
    k.add(A, softBox(1.3, 0.12, 0.42, { r: 0.05, bulge: { top: 0.015 }, power: 3, wobble: 0.002, step: 0.1, edge: 2, seed: 121, uvScale: WEAVE }), [BED.x, 0.44, 6.47]);
    for (const x of [BED.x - 0.58, BED.x + 0.58]) for (const z of [6.31, 6.63]) k.add(W, rod([x, 0.004, z], [x, 0.38, z], 0.016, 0.016, 8));
    k.box(W, BED.x - 0.65, BED.x + 0.65, 0.36, 0.38, 6.27, 6.67, { r: 0.004 });
  } else {
    // Reading corner by the window (as in the render): bouclé chair and an olive tree in a basket.
    k.include(pebbleChairKit(), [0.95, 0, 7.15], [0, 2.45, 0]);
    const soil = urn(k, 0.66, 7.6, 0.17, 0.32, "wicker");
    oliveTree(k, [0.66, soil, 7.6], 1.3, 19, 1000);
    // Low oak chest on the party wall.
    k.box(W, 1.6, 2.8, 0.1, 0.78, 7.43, 7.862, { r: 0.004, edge: 2, worldUV: true });
    k.box("black", 1.65, 2.75, 0.004, 0.1, 7.48, 7.84);
    for (const y of [0.32, 0.55]) k.box("gap", 1.61, 2.79, y, y + 0.003, 7.429, 7.432, { r: 0 });
    books(k, [2.5, 0.78, 7.64], 1.4);
  }
}

/** Bedroom parts above the cut on the garden wall: sheer curtains. */
function gardenCurtains1(k: Kit) {
  trackAlongZ(k, 0.47, 0.42, 7.84, CEIL);
  // Pokój 1 window (y 1.035–3.555).
  sheerAlongZ(k, 0.47, 0.42, 1.25, CEIL - 0.03, 0.012, 5);
  sheerAlongZ(k, 0.47, 3.3, 3.94, CEIL - 0.03, 0.012, 6);
  // Bedroom window (y 4.49–7.01).
  sheerAlongZ(k, 0.47, 4.12, 4.85, CEIL - 0.03, 0.012, 7);
  sheerAlongZ(k, 0.47, 6.72, 7.84, CEIL - 0.03, 0.012, 8);
}

function streetCurtains1(k: Kit) {
  const x = 9.41;
  trackAlongZ(k, x, 0.42, 7.6, CEIL);
  sheerAlongZ(k, x, 0.42, 1.2, CEIL - 0.03, 0.012, 9);
  sheerAlongZ(k, x, 3.38, 3.94, CEIL - 0.03, 0.012, 10);
  sheerAlongZ(k, x, 4.12, 4.62, CEIL - 0.03, 0.012, 11);
  sheerAlongZ(k, x, 6.86, 7.6, CEIL - 0.03, 0.012, 12);
}

/* ---------- pokój 1 (x 0.40–4.04, y 0.39–3.96) ---------- */

function kidsRoom1(k: Kit) {
  placeBed(k, { width: 0.9, length: 2.0, seed: 41, kids: true }, [1.57, 0.9], "-x");
  wardrobe(k, 3.44, 4.043, 0.39, 2.2, 3, "x0", 2.4, L);
  // Desk on the bedroom wall with shelves above, chair.
  placeDesk(k, [1.25, 3.64], Math.PI, 1.2, 0.6);
  placeChair(k, [1.25, 3.08], 0.15);
  wallShelfX(k, 0.7, 1.8, 1.3, 3.72, 3.962);
  wallShelfX(k, 0.7, 1.8, 1.62, 3.72, 3.962);
  books(k, [0.95, 0.75, 3.7], 1.3);
  // Toy cubby shelf under the window side wall, a beanbag, round rug.
  const tops = shelving(k, 2.15, 3.3, 3.62, 3.962, [0.004, 0.4, 0.8]);
  for (const [x, c] of [
    [2.38, "#c9a77f"],
    [2.82, "#9fb0a3"],
    [3.06, "#e3d6c3"],
  ] as const)
    k.add("decor", tint(softBox(0.2, 0.2, 0.22, { r: 0.02, step: 0.2, edge: 2 }), c), [x, tops[0] + 0.1, 3.79]);
  roundRug(k, 2.2, 2.25, 0.85);
  k.add(A, softBox(0.62, 0.42, 0.62, { r: 0.2, bulge: { top: 0.05, x: 0.04, z: 0.04 }, power: 2, wobble: 0.01, wrinkle: 0.004, step: 0.07, edge: 3, seed: 130, uvScale: WEAVE }), [2.75, 0.2, 1.75], [0, 0.4, 0]);
  framedArt(k, 0.5, 0.7, [3.2, 1.1, 3.95], Math.PI, 0);
}

function study(k: Kit) {
  // Desk facing the garden window, bookcase on the core partition, reading corner.
  placeDesk(k, [1.12, 2.3], Math.PI / 2, 1.5, 0.7);
  placeChair(k, [1.72, 2.3], -Math.PI / 2);
  books(k, [1.0, 0.75, 2.85], 0.2);
  k.add("steel", softBox(0.31, 0.014, 0.22, { r: 0.006, edge: 2, step: 1 }), [1.1, 0.757, 2.2], [0, 1.4, 0]);
  tableLamp(k, [0.95, 0.75, 1.75], 0.85);
  shelving(k, 3.66, 4.043, 0.45, 2.75, [0.004, 0.42, 0.8, 1.18, 1.56, 1.94, 2.3]);
  rug(k, 1.6, 3.4, 0.8, 2.9);
}

/** Books on the study bookcase (shelves run along z, books stand along z). */
function studyBooks(k: Kit) {
  const levels = [0.026, 0.442, 0.822, 1.202, 1.582, 1.962];
  const tones = ["#d8d0c4", "#3f3a35", "#a08f7b", "#c9bcaa", "#6d5f52", "#e4ddd2", "#8b8378", "#2b2926"];
  let s = 17;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (const y of levels) {
    let z = 0.5;
    while (z < 2.68) {
      if (r() < 0.14) {
        z += 0.1 + r() * 0.12;
        continue;
      }
      const t = 0.02 + r() * 0.025;
      const h = 0.2 + r() * 0.1;
      const d = 0.16 + r() * 0.06;
      k.add("decor", tint(softBox(d, h, t, { r: 0.002, edge: 1, step: 10 }), tones[Math.floor(r() * tones.length)]), [4.04 - 0.03 - d / 2, y + h / 2, z + t / 2]);
      z += t + 0.002;
    }
  }
}

/* ---------- pokój hobby (x 6.58–9.48, y 0.39–3.96) ---------- */

function homeOffice(k: Kit) {
  placeDesk(k, [9.08, 2.3], -Math.PI / 2, 1.6, 0.7);
  placeChair(k, [8.5, 2.3], Math.PI / 2);
  k.add("steel", softBox(0.31, 0.014, 0.22, { r: 0.006, edge: 2, step: 1 }), [9.1, 0.757, 2.45], [0, -1.6, 0]);
  tableLamp(k, [9.2, 0.75, 1.7], 0.85);
  // Low sideboard on the gable wall (below the dollhouse cut) with books and a vase.
  k.box(W, 6.75, 8.75, 0.1, 0.72, 0.39, 0.82, { r: 0.004, edge: 2, worldUV: true });
  k.box("black", 6.8, 8.7, 0.004, 0.1, 0.44, 0.78);
  for (let i = 1; i < 4; i++) k.box("gap", 6.75 + i * 0.5 - 0.0015, 6.75 + i * 0.5 + 0.0015, 0.12, 0.7, 0.819, 0.822, { r: 0 });
  books(k, [7.1, 0.72, 0.6], 0.1);
  candle(k, [7.6, 0.72, 0.6]);
  rug(k, 7.6, 9.3, 1.3, 3.3);
  framedArt(k, 0.9, 0.62, [7.75, 1.15, 3.95], Math.PI, 0);
  // Lounge chair (GLB below) + reading lamp in the corner by the partition.
}

function gym(k: Kit) {
  // Rubber floor mat.
  k.box("black", 7.1, 9.35, 0.004, 0.016, 0.6, 3.2, { r: 0.004 });
  // Treadmill facing the street window.
  const tx = 8.4, tz = 2.2;
  k.box("black", tx - 0.85, tx + 0.85, 0.016, 0.16, tz - 0.38, tz + 0.38, { r: 0.03, edge: 2 });
  k.box("gap", tx - 0.75, tx + 0.7, 0.16, 0.17, tz - 0.25, tz + 0.25, { r: 0.004 });
  for (const s of [-1, 1]) k.add("black", tube([[tx + 0.75, 0.15, tz + s * 0.33], [tx + 0.86, 0.9, tz + s * 0.33], [tx + 0.82, 1.2, tz + s * 0.3]], 0.024, 10, 8, true));
  k.box("black", tx + 0.7, tx + 0.92, 1.12, 1.3, tz - 0.32, tz + 0.32, { r: 0.03, edge: 2 });
  k.add("screen", new THREE.PlaneGeometry(0.42, 0.14).rotateY(-Math.PI / 2).rotateZ(0.4), [tx + 0.79, 1.23, tz]);
  // Weight bench and a dumbbell rack along the gable (low).
  k.box("black", 7.2, 8.4, 0.004, 0.05, 0.92, 1.18, { r: 0.01 });
  k.add(A, softBox(1.1, 0.07, 0.28, { r: 0.03, step: 0.1, edge: 2, uvScale: WEAVE }), [7.8, 0.44, 1.05]);
  for (const x of [7.4, 8.2]) k.box("black", x - 0.03, x + 0.03, 0.04, 0.41, 0.99, 1.11, { r: 0.006 });
  for (let i = 0; i < 5; i++) {
    const x = 7.0 + i * 0.22;
    for (const s of [-1, 1]) k.add("black", cylinder(0.05 + i * 0.006, 0.05, 20).rotateX(Math.PI / 2).translate(x, 0.5, 0.56 + s * 0.11));
    k.add("steel", rod([x, 0.5, 0.42], [x, 0.5, 0.7], 0.012, 0.012, 8));
  }
  k.box("black", 6.85, 8.1, 0.004, 0.42, 0.42, 0.7, { r: 0.01 });
  // Yoga mat and two kettlebells.
  k.add(A, softBox(0.62, 0.006, 1.8, { r: 0.003, edge: 1, step: 4 }), [7.2, 0.019, 2.6]);
  for (const [x, z] of [
    [7.7, 3.35],
    [7.95, 3.4],
  ] as const) {
    k.add("black", lathe([[0, 0], [0.09, 0.01], [0.1, 0.08], [0.06, 0.16], [0, 0.17]], { segments: 24 }), [x, 0.016, z]);
    k.add("black", tube([[x - 0.05, 0.16, z], [x, 0.24, z], [x + 0.05, 0.16, z]], 0.012, 10, 6));
  }
  // Wall mirror on the interior wall to pokój 2.
  k.box("black", 7.2, 8.9, 0.25, 2.05, 3.94, 3.962, { r: 0.004 });
  k.add("mirror", new THREE.PlaneGeometry(1.66, 1.76).rotateY(Math.PI), [8.05, 1.15, 3.938]);
}

/* ---------- pokój 2 (x 6.58–9.48, y 4.08–7.86, notch at x > 8.33, y > 7.63) ---------- */

function kidsRoom2(k: Kit) {
  placeBed(k, { width: 0.9, length: 2.0, seed: 61, kids: true }, [8.95, 6.52], "+z");
  wardrobe(k, 6.582, 7.18, 6.1, 7.862, 3, "x1", 2.4, L);
  placeDesk(k, [8.2, 4.4], 0, 1.2, 0.6);
  placeChair(k, [8.2, 4.95], Math.PI - 0.2);
  wallShelfX(k, 7.65, 8.75, 1.3, 4.082, 4.32);
  books(k, [7.85, 0.75, 4.3], 0.2);
  roundRug(k, 7.75, 5.95, 0.8);
  k.add(A, softBox(0.55, 0.38, 0.55, { r: 0.18, bulge: { top: 0.05, x: 0.04, z: 0.04 }, power: 2, wobble: 0.01, wrinkle: 0.004, step: 0.07, edge: 3, seed: 131, uvScale: WEAVE }), [7.55, 0.18, 5.2], [0, 0.7, 0]);
  framedArt(k, 0.45, 0.6, [7.0, 1.2, 4.1], 0, 0);
}

function guestRoom(k: Kit) {
  placeBed(k, { width: 1.2, length: 2.0, seed: 71, headboard: 1.05 }, [7.6, 6.76], "+z");
  const t1 = nightstand(k, [6.77, 0, 7.66], Math.PI, 0.36, 0.36);
  const t2 = nightstand(k, [8.45, 0, 7.42], Math.PI, 0.36, 0.36);
  tableLamp(k, [6.77, t1, 7.66], 0.8);
  tableLamp(k, [8.45, t2, 7.44], 0.8);
  rug(k, 6.85, 8.4, 5.0, 6.6);
  // Narrow console with a mirror on the hobby wall, luggage bench by the window.
  k.box(W, 7.3, 8.6, 0.74, 0.78, 4.082, 4.42, { r: 0.004, edge: 2, worldUV: true });
  for (const x of [7.34, 8.56]) k.box(W, x - 0.02, x + 0.02, 0.004, 0.74, 4.12, 4.4, { r: 0.004 });
  books(k, [7.6, 0.78, 4.25], 0.3);
  candle(k, [8.3, 0.78, 4.26]);
  const ring = new THREE.TorusGeometry(0.34, 0.008, 10, 80);
  k.add("metal", ring.translate(7.95, 1.45, 4.09));
  k.add("mirror", new THREE.CircleGeometry(0.335, 64).translate(7.95, 1.45, 4.086));
}

/* ---------- bathroom (x 4.23–6.41, y 0.39–2.62) ---------- */

function tubGeo() {
  return ovalLathe(
    [
      [0.37, 0.004],
      [0.14, 0.004],
      [0.08, 0.03],
      [0.035, 0.12],
      [0.01, 0.3],
      [0, 0.45],
      [0, 0.545],
      [0.004, 0.568],
      [0.016, 0.578],
      [0.028, 0.572],
      [0.034, 0.55],
      [0.045, 0.42],
      [0.075, 0.25],
      [0.13, 0.15],
      [0.2, 0.128],
      [0.37, 0.124],
    ],
    0.8,
    0.36,
    2.6,
    72,
  );
}

/** Wall tiles as thin cladding (the shell paints these walls): the two partitions, the gable below the cut. */
function bathTiles(k: Kit, upper: boolean) {
  const T = "wallTile" as const;
  const t = 0.006;
  if (!upper) {
    k.box(T, 4.229, 4.229 + t, 0.004, CEIL, 0.39, 2.62, { worldUV: true, r: 0 });
    k.box(T, 6.406 - t, 6.406, 0.004, CEIL, 0.39, 2.62, { worldUV: true, r: 0 });
    k.box(T, 4.229, 6.406, 0.004, 1.0, 0.39, 0.39 + t, { worldUV: true, r: 0 });
    return;
  }
  // Gable above the cut, around the window (x 4.385–5.488, sill 1.18, head 2.25).
  k.box(T, 4.229, 6.406, 1.0, 1.18, 0.39, 0.39 + t, { worldUV: true, r: 0 });
  k.box(T, 4.229, 4.385, 1.18, CEIL, 0.39, 0.39 + t, { worldUV: true, r: 0 });
  k.box(T, 5.488, 6.406, 1.18, CEIL, 0.39, 0.39 + t, { worldUV: true, r: 0 });
  k.box(T, 4.385, 5.488, 2.25, CEIL, 0.39, 0.39 + t, { worldUV: true, r: 0 });
}

function bathroom(k: Kit) {
  bathTiles(k, false);
  // Freestanding tub under the gable window, floor-standing filler at its head.
  k.add("ceramic", tubGeo(), [5.12, 0, 0.8]);
  k.add("metal", cylinder(0.04, 0.008, 32).translate(6.08, 0.004, 0.8));
  k.add("metal", tube([[6.08, 0.01, 0.8], [6.08, 0.86, 0.8], [6.06, 0.95, 0.8], [5.98, 0.975, 0.8], [5.9, 0.94, 0.8], [5.88, 0.88, 0.8]], 0.0135, 40, 12, true));
  // Wall-hung WC on the left wall (x 4.23), facing +x, on a tiled installation box.
  k.box("wallTile", 4.235, 4.43, 0.004, 1.05, 1.42, 2.08, { worldUV: true, r: 0.002 });
  const body = ovalLathe([[0.18, 0], [0.06, 0], [0.02, 0.05], [0.003, 0.22], [0, 0.3], [0.006, 0.312], [0.03, 0.315], [0.18, 0.315]], 0.18, 0.27, 2.2, 48);
  const lid = ovalLathe([[0.18, 0], [0.01, 0], [0, 0.012], [0.006, 0.024], [0.18, 0.026]], 0.182, 0.268, 2.2, 48).translate(0, 0.318, 0.004);
  k.add("ceramic", body, [4.66, 0.085, 1.75], [0, Math.PI / 2, 0]);
  k.add("ceramic", lid, [4.66, 0.085, 1.75], [0, Math.PI / 2, 0]);
  k.box("metal", 4.43, 4.445, 0.82, 0.97, 1.65, 1.85, { r: 0.004 });
  // Wall-hung oak vanity on the right wall (x 6.41), stone top, countertop basin.
  k.box(W, 5.92, 6.4, 0.5, 0.8, 1.15, 2.0, { r: 0.004, edge: 2, worldUV: true });
  k.box("gap", 5.917, 5.92, 0.66, 0.663, 1.17, 1.98, { r: 0 });
  k.box("stone", 5.9, 6.406, 0.8, 0.83, 1.13, 2.02, { r: 0.003, worldUV: true });
  k.add(
    "ceramic",
    ovalLathe([[0.17, 0], [0.08, 0], [0.035, 0.025], [0.005, 0.09], [0, 0.118], [0.006, 0.13], [0.016, 0.126], [0.03, 0.09], [0.06, 0.05], [0.1, 0.038], [0.17, 0.036]], 0.23, 0.17, 2.3, 56),
    [6.13, 0.83, 1.57],
    [0, Math.PI / 2, 0],
  );
  k.add("metal", rod([6.406, 0.99, 1.57], [6.24, 0.99, 1.57], 0.011, 0.011, 12));
  // Mirror cabinet with a back-lit halo above the vanity.
  k.box("mirror", 6.37, 6.385, 1.05, 1.85, 1.2, 1.95, { r: 0.003 });
  k.box("glowLED", 6.385, 6.4, 1.03, 1.87, 1.18, 1.97, { r: 0.002 });
  // Towels: one folded on the vanity, one on a bar on the door wall.
  k.add("towel", softBox(0.3, 0.06, 0.22, { r: 0.02, step: 0.06, edge: 2 }), [6.18, 0.86, 1.95]);
  k.add("metal", rod([4.35, 1.25, 2.6], [4.78, 1.25, 2.6], 0.009, 0.009, 8));
  k.add("towel", softBox(0.38, 0.55, 0.035, { r: 0.015, wobble: 0.004, step: 0.06, edge: 2, seed: 140 }), [4.56, 1.0, 2.59]);
  // Bath mat.
  k.add("towel", softBox(0.8, 0.012, 0.5, { r: 0.006, edge: 1, step: 4 }), [5.15, 0.006, 1.48]);
}

/* ---------- corridor (x 4.23–6.41, y 2.74–5.76) ---------- */

function corridor1(k: Kit) {
  rug(k, 4.75, 5.85, 2.95, 4.65);
}

/* ---------- ceilings ---------- */

function ceilings(k: Kit, para: boolean) {
  pleatedBowl(k, BED.x, 5.75, CEIL);
  downlight(k, 0.95, 6.75, CEIL);
  downlight(k, 3.0, 6.75, CEIL);
  downlight(k, 5.15, 1.45, CEIL);
  downlight(k, 5.75, 2.0, CEIL);
  downlight(k, 5.3, 3.3, CEIL);
  downlight(k, 5.3, 4.9, CEIL);
  if (para) {
    smallGlobe(k, 2.3, 2.0, 2.15, 0.2, CEIL);
    downlight(k, 8.0, 1.0, CEIL);
    downlight(k, 8.0, 3.0, CEIL);
    smallGlobe(k, 7.9, 5.9, 2.15, 0.18, CEIL);
  } else {
    paperLantern(k, 2.2, 2.2, 2.05, 0.24, CEIL, 18, 0.9);
    smallGlobe(k, 8.0, 2.2, 2.15, 0.18, CEIL);
    paperLantern(k, 7.8, 5.9, 2.05, 0.22, CEIL, 18, 0.9);
  }
}

/* ---------- light, shadows ---------- */

const LIGHTS: PracticalLight[] = [
  { kind: "point", position: [BED.x, 1.35, 4.62], intensity: 2.4, distance: 4.5 },
  { kind: "point", position: [2.2, 1.95, 2.2], intensity: 1.8, distance: 4.5 },
  { kind: "point", position: [5.3, 2.15, 1.5], intensity: 1.4, distance: 3.2 },
];

function pools(para: boolean): Pool[] {
  const p: Pool[] = [
    { x: 0.95, y: 0.0045, z: 6.75, r: 0.5 },
    { x: 3.0, y: 0.0045, z: 6.75, r: 0.5 },
    { x: 5.15, y: 0.0045, z: 1.45, r: 0.45 },
    { x: 5.3, y: 0.0195, z: 3.3, r: 0.45 },
    { x: 5.3, y: 0.0045, z: 4.9, r: 0.45 },
  ];
  if (para) p.push({ x: 8.0, y: 0.0045, z: 1.0, r: 0.5 }, { x: 8.0, y: 0.0045, z: 3.0, r: 0.5 });
  return p;
}

function shadows(para: boolean): Footprint[] {
  const s: Footprint[] = [
    { x0: 0.82, x1: 2.9, z0: 4.08, z1: 6.2, r: 0.06 },
    { x0: 3.44, x1: 4.04, z0: 5.2, z1: 7.86, r: 0.01 },
    { x0: 4.3, x1: 5.95, z0: 0.44, z1: 1.16, r: 0.35 },
    { x0: 5.9, x1: 6.4, z0: 1.15, z1: 2.0, r: 0.02 },
  ];
  if (para) {
    s.push({ x0: 0.75, x1: 1.47, z0: 1.55, z1: 3.05, r: 0.02 }, { x0: 3.66, x1: 4.04, z0: 0.45, z1: 2.75, r: 0.01 }, { x0: 6.95, x1: 8.4, z0: 5.66, z1: 7.86, r: 0.05 });
  } else {
    s.push({ x0: 0.45, x1: 2.6, z0: 0.42, z1: 1.38, r: 0.05 }, { x0: 3.44, x1: 4.04, z0: 0.39, z1: 2.2, r: 0.01 }, { x0: 8.48, x1: 9.46, z0: 5.42, z1: 7.63, r: 0.05 }, { x0: 6.58, x1: 7.18, z0: 6.1, z1: 7.86, r: 0.01 });
  }
  return s;
}

/* ---------- component ---------- */

export function Upper({ arrangement }: { arrangement: string | null }) {
  const para = arrangement === "para";
  const room = useKit(() => {
    const k = new Kit();
    bedroom(k, para);
    bathroom(k);
    corridor1(k);
    vase(k, [0.86, 0.52, 4.24], "bud", 1.0);
    plantInPot(k, 6.12, 2.36, 0.13, 0.24, "potWhite", { height: 0.42, spread: 0.18, leaves: 8, leafLen: 0.2, seed: 31 });
    if (para) {
      study(k);
      studyBooks(k);
      gym(k);
      guestRoom(k);
      k.include(loungeChairKit("oak"), [2.75, 0, 0.98], [0, 0.5, 0]);
      sideTable(k, 3.32, 0.62, 0.22, 0.52);
      plantInPot(k, 9.1, 3.55, 0.2, 0.36, "potStone", { height: 0.8, spread: 0.3, leaves: 12, leafLen: 0.3, seed: 33 });
      plantInPot(k, 9.08, 4.6, 0.16, 0.3, "potWhite", { height: 0.6, spread: 0.24, leaves: 10, leafLen: 0.26, seed: 34 });
    } else {
      kidsRoom1(k);
      homeOffice(k);
      kidsRoom2(k);
      k.include(loungeChairKit("oak"), [7.45, 0, 3.38], [0, Math.PI - 0.5, 0]);
      standingFrame(k, [9.25, 0.75, 2.95], -Math.PI / 2);
      plantInPot(k, 3.12, 2.55, 0.17, 0.32, "potClay", { height: 0.7, spread: 0.28, leaves: 11, leafLen: 0.28, seed: 35 });
    }
    return k;
  }, [para]);
  const ceiling = useKit(() => {
    const k = new Kit();
    ceilings(k, para);
    return k;
  }, [para]);
  const garden = useKit(() => {
    const k = new Kit();
    gardenCurtains1(k);
    return k;
  });
  const street = useKit(() => {
    const k = new Kit();
    streetCurtains1(k);
    return k;
  });
  const gable = useKit(() => {
    const k = new Kit();
    bathTiles(k, true);
    return k;
  });

  return (
    <group>
      <KitMesh kit={room} />
      <ContactShadow shapes={shadows(para)} spread={0.3} opacity={0.36} />
      <LightPools pools={pools(para)} strength={0.15} />
      <WallCut wall="ogrod-1" at={0.02}>
        <KitMesh kit={garden} castShadow={false} />
      </WallCut>
      <WallCut wall="ulica-1" at={0.02}>
        <KitMesh kit={street} castShadow={false} />
      </WallCut>
      <WallCut wall="gable-1" at={1.0}>
        <KitMesh kit={gable} castShadow={false} />
      </WallCut>
      <CeilingMount>
        <KitMesh kit={ceiling} castShadow={false} />
      </CeilingMount>
      <PracticalLights lights={LIGHTS} />
    </group>
  );
}
