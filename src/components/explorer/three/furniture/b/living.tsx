"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { getHouse } from "@/lib/estate";
import { arc, boxUV, cylinder, disc, lathe, puck, rod, softBox } from "../core/geometry";
import { Kit } from "../core/kit";
import { downlight, piping, soft } from "../core/pieces";
import { KitMesh, WallCut, useKit } from "../core/runtime";
import { FinishOnly } from "../core/variants";
import { Cat } from "../cat/Cat";
import { useExplorer } from "../../../state/store";
import { A, F, W, WEAVE, bendZ, books, candle, driedStems, leafyPlant, loungeChairKit, oliveTree, pot, rug, sheerAlongX, sheerAlongZ, trackAlongX, trackAlongZ, urn, vase, woodBowl } from "./parts";

/* ==========================================================================
   Salon of layout B (plan x 0.40–4.04, y 0.39–~4.1), as in the home Kreator
   renders: an L-sofa floating 0.8 m off the HS glazing, facing the TV on the
   accent wall (x 4.04); the return closes the seating toward the free gable;
   armchair, paper floor lamp and an olive tree in the far corner; sheer linen
   on the glazing. Shapes that differ between styles are visibility variants.
   ========================================================================== */

export const CEILING = 2.64;

/** Coffee table centre and the height every style's table top shares (decor sits on it). */
export const COFFEE = { x: 2.86, z: 2.62, top: 0.38 };
/** Corner pieces. */
const LAMP = { x: 2.6, z: 0.56 };
const ARMCHAIR = { x: 3.22, z: 1.02, yaw: -0.42 };
const TREE = { x: 3.8, z: 0.64 };

/* ---------- sofa ---------- */

/**
 * L-sofa: long section along the glazing side (back at x 1.2, seats facing +x toward the TV, arm at the
 * kitchen end y 3.77), return along the gable side (back at y 0.8, seats facing +y, open chaise end).
 */
function sofa(k: Kit) {
  const firm = { power: 3, wobble: 0.0018, step: 0.12, edge: 2, uvScale: WEAVE };
  // Recessed dark plinth: the sofa floats on a shadow line.
  k.box("black", 1.28, 2.08, 0.004, 0.07, 0.88, 3.69, { r: 0.004 });
  k.box("black", 2.0, 2.78, 0.004, 0.07, 0.88, 1.69, { r: 0.004 });

  // Back frames.
  soft(k, F, 1.2, 1.46, 0.06, 0.66, 0.8, 3.52, { r: 0.085, bulge: { x: 0.008, top: 0.012 }, ...firm, seed: 1 });
  soft(k, F, 1.44, 2.86, 0.06, 0.66, 0.8, 1.06, { r: 0.085, bulge: { z: 0.008, top: 0.012 }, ...firm, seed: 2 });
  // Arm at the kitchen end of the long section.
  soft(k, F, 1.2, 2.18, 0.06, 0.6, 3.5, 3.78, { r: 0.095, bulge: { z: 0.012, top: 0.014, x: 0.006 }, ...firm, seed: 3 });
  // Seat bases.
  soft(k, F, 1.44, 2.18, 0.06, 0.28, 1.04, 3.52, { r: 0.06, bulge: { x: 0.006 }, ...firm, seed: 4 });
  soft(k, F, 2.16, 2.86, 0.06, 0.28, 1.04, 1.78, { r: 0.06, bulge: { z: 0.006 }, ...firm, seed: 5 });

  // Seat cushions: thick, soft crowns, rounded front lip (top ≈ 0.465, the cat's seat line).
  const seat = { r: 0.085, bulge: { top: 0.022, x: 0.01, z: 0.01 }, power: 3.2, wobble: 0.0025, step: 0.1, edge: 3, uvScale: WEAVE };
  const cushions: [number, number, number, number, number][] = [
    [1.46, 2.17, 1.06, 1.8, 6],
    [1.46, 2.17, 1.8, 2.66, 7],
    [1.46, 2.17, 2.66, 3.51, 8],
    [2.17, 2.86, 1.06, 1.8, 9],
  ];
  for (const [x0, x1, z0, z1, s] of cushions) {
    soft(k, F, x0, x1, 0.255, 0.445, z0, z1, { ...seat, seed: s });
    piping(k, F, [(x0 + x1) / 2, 0.35, (z0 + z1) / 2], [x1 - x0, 0.19, z1 - z0], 0.085, "top");
  }

  // Back cushions leaning on the frames.
  const back = { r: 0.065, bulge: { front: 0.034, back: 0.01, x: 0.01, top: 0.008 }, power: 3, wobble: 0.0028, step: 0.1, edge: 3, uvScale: WEAVE };
  // Long section: faces +x (yaw −π/2 turns the cushion's +z front to +x), leaning back.
  for (const [z, s] of [
    [1.5, 10],
    [2.28, 11],
    [3.08, 12],
  ] as const)
    k.add(F, softBox(0.8, 0.44, 0.19, { ...back, seed: s }), [1.58, 0.665, z], [-0.2, -Math.PI / 2, 0]);
  // Return: faces +y.
  for (const [x, s] of [
    [2.0, 13],
    [2.56, 14],
  ] as const)
    k.add(F, softBox(0.58, 0.44, 0.19, { ...back, seed: s }), [x, 0.665, 1.17], [-0.2, 0, 0]);

  // Throw pillows (face +x on the long section, +y on the return).
  const pillow = (key: typeof F | typeof A, w: number, h: number, at: [number, number, number], yaw: number, tilt: number, roll: number, seed: number) =>
    k.add(
      key,
      softBox(w, h, 0.05, { r: 0.022, bulge: { front: 0.058, back: 0.045, x: 0.01, top: 0.012, bottom: 0.012 }, power: 2, wobble: 0.004, wrinkle: 0.0025, step: 0.05, edge: 2, seed, uvScale: WEAVE }),
      at,
      [-tilt, yaw, roll],
    );
  pillow(F, 0.5, 0.44, [1.7, 0.7, 2.28], -Math.PI / 2, 0.32, 0.03, 20);
  pillow(A, 0.44, 0.32, [1.8, 0.63, 2.5], -Math.PI / 2 - 0.15, 0.42, -0.04, 21);
  pillow(F, 0.5, 0.44, [1.7, 0.7, 3.1], -Math.PI / 2, 0.33, -0.02, 22);
  pillow(A, 0.46, 0.34, [1.68, 0.64, 1.3], -Math.PI / 2 + 0.6, 0.38, 0.05, 23);
  pillow(F, 0.5, 0.44, [2.55, 0.7, 1.28], 0, 0.33, 0.02, 24);

  // Knit throw draped over the arm: on the seat, over the arm top, down its outer face.
  const knit = { wobble: 0.006, wrinkle: 0.006, step: 0.05, edge: 2, uvScale: WEAVE };
  k.add(A, softBox(0.5, 0.03, 0.42, { r: 0.014, ...knit, seed: 30 }), [1.86, 0.466, 3.28], [0.04, 0.06, 0]);
  k.add(A, softBox(0.52, 0.032, 0.3, { r: 0.016, ...knit, seed: 31 }), [1.86, 0.612, 3.64], [0, 0.04, 0]);
  k.add(A, softBox(0.52, 0.5, 0.032, { r: 0.016, ...knit, seed: 32 }), [1.87, 0.36, 3.795], [0.05, 0.04, 0]);
}

/* ---------- media wall ---------- */

/** Oak media console floating on a recessed plinth along the TV wall, 65" TV and a soundbar. */
function mediaWall(k: Kit) {
  const x0 = 3.6, x1 = 4.04, z0 = 1.45, z1 = 3.85;
  k.box("black", x0 + 0.06, x1 - 0.01, 0.004, 0.09, z0 + 0.05, z1 - 0.05);
  k.box("gap", x0 + 0.025, x1 - 0.002, 0.095, 0.478, z0 + 0.02, z1 - 0.02);
  // Top and sides, grain-matched.
  k.box(W, x0, x1, 0.48, 0.5, z0, z1, { worldUV: true, r: 0.002 });
  k.box(W, x0, x1, 0.09, 0.5, z0, z0 + 0.02, { worldUV: true, r: 0.002 });
  k.box(W, x0, x1, 0.09, 0.5, z1 - 0.02, z1, { worldUV: true, r: 0.002 });
  // Four handleless doors with a finger groove on top.
  const n = 4;
  const w = (z1 - z0 - 0.04) / n;
  for (let i = 0; i < n; i++) {
    const a = z0 + 0.02 + i * w + 0.0016;
    const b = z0 + 0.02 + (i + 1) * w - 0.0016;
    k.box(W, x0, x0 + 0.02, 0.095, 0.455, a, b, { worldUV: true, r: 0.0015 });
  }
  // TV: thin black bezel, glossy screen facing −x.
  const tz0 = 1.93, tz1 = 3.37, ty0 = 0.9, ty1 = 1.72;
  k.box("black", 4.005, 4.04, ty0, ty1, tz0, tz1, { r: 0.004 });
  k.add("screen", new THREE.PlaneGeometry(tz1 - tz0 - 0.012, ty1 - ty0 - 0.012).rotateY(-Math.PI / 2), [4.0035, (ty0 + ty1) / 2, (tz0 + tz1) / 2]);
  // Soundbar on the console under the TV.
  k.box("black", 3.86, 3.96, 0.5, 0.56, 2.25, 3.05, { r: 0.012, edge: 2 });
  // Decor: books with a candle, a pair of vases.
  books(k, [3.8, 0.5, 3.55], 1.4);
  candle(k, [3.8, 0.582, 3.55]);
  books(k, [3.78, 0.5, 1.75], 1.65);
  vase(k, [3.82, 0.5, 3.2], "tall", 0.75);
  vase(k, [3.8, 0.5, 2.05], "round", 0.62, "potStone");
}

/* ---------- coffee tables (per style) ---------- */

/** s1: round oak top on four chunky turned legs. */
function coffeeRound(k: Kit) {
  const { x, z, top } = COFFEE;
  k.add(W, boxUV(puck(0.42, 0.055, 0.02, 64)), [x, top - 0.055, z]);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    k.add(W, cylinder(0.062, top - 0.055, 28, 0.066), [x + Math.cos(a) * 0.235, 0.004, z + Math.sin(a) * 0.235]);
  }
}

/** s4: low rectangular oak table on a recessed plinth (long side along the sofa). */
function coffeeBlock(k: Kit) {
  const { x, z, top } = COFFEE;
  k.add(W, softBox(0.64, 0.06, 1.1, { r: 0.008, edge: 2, step: 4, uvSwap: true }), [x, top - 0.03, z]);
  k.add(W, softBox(0.42, top - 0.06, 0.78, { r: 0.006, edge: 2, step: 4 }), [x, (top - 0.06) / 2 + 0.002, z]);
}

/** s3: round drum, dark oak top on a black pedestal. */
function coffeeDrum(k: Kit) {
  const { x, z, top } = COFFEE;
  k.add(W, boxUV(puck(0.45, 0.045, 0.012, 64)), [x, top - 0.045, z]);
  k.add("black", lathe([[0, 0.004], [0.3, 0.004], ...arc(0.3, 0.02, 0.016, -Math.PI / 2, 0, 3), [0.316, top - 0.06], [0.3, top - 0.045], [0, top - 0.045]], { segments: 56 }), [x, 0, z]);
}

/** Decor shared by every coffee table (same top height). */
function coffeeDecor(k: Kit) {
  const { x, z, top } = COFFEE;
  const y = books(k, [x - 0.1, top, z + 0.16], 0.35);
  candle(k, [x - 0.08, y, z + 0.15], 0.032, 0.07);
  woodBowl(k, [x + 0.13, top, z - 0.14], 0.12);
  // A small vase with a few olive twigs.
  const neck = vase(k, [x + 0.06, top, z + 0.2], "bud", 1.1);
  driedStems(k, [x + 0.06, neck - 0.02, z + 0.2], 5, 0.3, 21, 0.4, true);
}

/* ---------- corner: armchair, floor lamp, olive tree ---------- */

/** s1: bouclé "pebble" lounge chair (also the bedroom's reading chair). Local frame: faces +z. */
export function pebbleChairKit(): Kit {
  const k = new Kit();
  const soft2 = { power: 2.6, wobble: 0.003, step: 0.08, edge: 3, uvScale: WEAVE };
  k.add(F, softBox(0.74, 0.36, 0.72, { r: 0.16, bulge: { top: 0.02, x: 0.02, z: 0.02 }, ...soft2, seed: 60 }), [0, 0.2, 0.02]);
  // Wrap-around back, bent forward at the sides.
  k.add(F, bendZ(softBox(0.78, 0.46, 0.2, { r: 0.09, bulge: { front: 0.02, top: 0.015 }, ...soft2, seed: 61 }), 0.75), [0, 0.52, -0.28], [-0.1, 0, 0]);
  k.add(F, softBox(0.6, 0.1, 0.5, { r: 0.05, bulge: { top: 0.02 }, ...soft2, seed: 62 }), [0, 0.42, 0.07]);
  k.add(A, softBox(0.4, 0.28, 0.05, { r: 0.02, bulge: { front: 0.05, back: 0.04 }, power: 2, wobble: 0.004, step: 0.05, edge: 2, seed: 63, uvScale: WEAVE }), [0, 0.6, -0.12], [-0.3, 0, 0]);
  return k;
}

/** s4: low lounge chair, black wood frame, cane back, oat cushion. Local frame: faces +z. */
function caneChair(): Kit {
  const k = new Kit();
  const r = 0.016;
  for (const s of [-1, 1]) {
    // Side frames: front leg, arm, rear leg sweeping back.
    k.add("black", rod([s * 0.33, 0.004, 0.3], [s * 0.33, 0.58, 0.28], r, r, 10));
    k.add("black", rod([s * 0.33, 0.004, -0.3], [s * 0.33, 0.62, -0.38], r, r, 10));
    k.add("black", rod([s * 0.33, 0.58, 0.32], [s * 0.33, 0.6, -0.34], 0.014, 0.014, 10));
    k.add("black", rod([s * 0.33, 0.2, 0.3], [s * 0.33, 0.2, -0.3], 0.012, 0.012, 8));
  }
  k.add("black", rod([-0.33, 0.25, 0.3], [0.33, 0.25, 0.3], 0.013, 0.013, 8));
  k.add("black", rod([-0.33, 0.25, -0.3], [0.33, 0.25, -0.3], 0.013, 0.013, 8));
  // Cane back panel, reclined.
  k.add("wicker", softBox(0.6, 0.48, 0.02, { r: 0.006, edge: 1, step: 0.2 }), [0, 0.56, -0.33], [-0.3, 0, 0]);
  k.box("black", -0.32, 0.32, 0.78, 0.81, -0.43, -0.39, { r: 0.006 });
  // Seat frame + cushion, back cushion.
  k.add("wicker", softBox(0.62, 0.02, 0.6, { r: 0.004, edge: 1, step: 0.3 }), [0, 0.26, 0]);
  k.add(F, softBox(0.6, 0.11, 0.58, { r: 0.045, bulge: { top: 0.018 }, power: 3, wobble: 0.003, step: 0.08, edge: 2, seed: 70, uvScale: WEAVE }), [0, 0.33, 0.01]);
  k.add(F, softBox(0.48, 0.32, 0.09, { r: 0.04, bulge: { front: 0.03 }, power: 2.6, wobble: 0.003, step: 0.07, edge: 2, seed: 71, uvScale: WEAVE }), [0, 0.6, -0.27], [-0.3, 0, 0]);
  return k;
}

/** s1: paper lantern on a slim black tripod. */
function tripodLantern(k: Kit) {
  const { x, z } = LAMP;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    k.add("metal", rod([x + Math.cos(a) * 0.2, 0.004, z + Math.sin(a) * 0.2], [x + Math.cos(a) * 0.02, 1.12, z + Math.sin(a) * 0.02], 0.007, 0.006, 6));
  }
  const prof: [number, number][] = [];
  for (let i = 0; i <= 40; i++) {
    const a = -1.3 + (i / 40) * 2.6;
    const rib = Math.abs(Math.sin((i / 2) * Math.PI));
    prof.push([0.16 * Math.cos(a) * (1 - 0.02 * (1 - rib)), 0.22 * Math.sin(a)]);
  }
  k.add("glowShade", lathe(prof, { segments: 40 }), [x, 1.34, z]);
}

/** s4: Akari-like paper column lamp on a thin stem. */
function paperColumn(k: Kit) {
  const { x, z } = LAMP;
  k.add("metal", lathe([[0, 0.004], [0.13, 0.004], [0.13, 0.016], [0, 0.02]], { segments: 32 }), [x, 0, z]);
  k.add("metal", rod([x, 0.02, z], [x, 0.98, z], 0.006, 0.006, 6));
  const prof: [number, number][] = [];
  for (let i = 0; i <= 44; i++) {
    const t = i / 44;
    const rib = Math.abs(Math.sin(t * 22 * Math.PI));
    prof.push([0.14 * (1 - 0.018 * (1 - rib)) * (1 - 0.06 * (2 * t - 1) ** 2), 0.95 + t * 0.62]);
  }
  k.add("glowShade", lathe(prof, { segments: 40 }), [x, 0, z]);
}

/** s3: black floor lamp with a dome shade arching over the sofa end. */
function domeFloorLamp(k: Kit) {
  const { x, z } = LAMP;
  k.add("black", lathe([[0, 0.004], [0.15, 0.004], ...arc(0.15, 0.018, 0.014, -Math.PI / 2, 0, 3), [0.15, 0.026], [0, 0.03]], { segments: 40 }), [x, 0, z]);
  k.add("black", rod([x, 0.03, z], [x, 1.5, z], 0.009, 0.009, 8));
  k.add("black", rod([x, 1.5, z], [x - 0.04, 1.55, z + 0.28], 0.008, 0.008, 8));
  const sx = x - 0.05, sz = z + 0.32, sy = 1.42;
  k.add("black", lathe([[0.15, 0], [0.145, 0.04], [0.12, 0.1], [0.06, 0.135], [0.02, 0.14], [0, 0.14]], { segments: 40 }), [sx, sy, sz]);
  k.add("glowLamp", disc(0.13, 32, true).translate(sx, sy + 0.03, sz));
}

/* ---------- curtains (garden wall, gable window) ---------- */

/** Sheer linen on the garden wall: gathered beside the HS door and around the dining window. */
function gardenCurtains(k: Kit) {
  const x = 0.47;
  trackAlongZ(k, x, 0.42, 7.84, CEILING);
  sheerAlongZ(k, x, 0.42, 1.28, CEILING - 0.03, 0.012, 1);
  sheerAlongZ(k, x + 0.03, 3.96, 5.62, CEILING - 0.03, 0.012, 2);
  sheerAlongZ(k, x, 6.86, 7.84, CEILING - 0.03, 0.012, 3);
}

function gableCurtains(k: Kit) {
  const z = 0.47;
  trackAlongX(k, z, 0.5, 1.82, CEILING);
  sheerAlongX(k, z, 1.3, 1.8, CEILING - 0.03, 0.012, 4);
}

/* ---------- ceiling ---------- */

export const SALON_DOWNLIGHTS: [number, number][] = [
  [1.0, 1.45],
  [1.0, 3.25],
  [3.05, 1.45],
  [3.05, 3.25],
];

/* ---------- component ---------- */

export function salonKit(k: Kit) {
  sofa(k);
  mediaWall(k);
  coffeeDecor(k);
  rug(k, 1.75, 3.52, 1.3, 3.95);
  // Olive tree in a stone urn in the far corner.
  const soilY = urn(k, TREE.x, TREE.z, 0.21, 0.4);
  oliveTree(k, [TREE.x, soilY, TREE.z], 1.45, 7, 1400);
  // Big-leaf plant in the corner by the gable window (seen from the garden and the terrace).
  const soil2 = pot(k, 0.82, 0.8, 0.2, 0.34, "potClay");
  leafyPlant(k, [0.82, soil2, 0.8], { height: 0.72, spread: 0.3, leaves: 12, leafLen: 0.3, seed: 4 });
}

export function Salon() {
  const pebble = useKit(pebbleChairKit);
  const cane = useKit(caneChair);
  const leather = useKit(() => loungeChairKit("steel"));
  const round = useKit(() => {
    const k = new Kit();
    coffeeRound(k);
    return k;
  });
  const block = useKit(() => {
    const k = new Kit();
    coffeeBlock(k);
    return k;
  });
  const drum = useKit(() => {
    const k = new Kit();
    coffeeDrum(k);
    return k;
  });
  const lantern = useKit(() => {
    const k = new Kit();
    tripodLantern(k);
    return k;
  });
  const column = useKit(() => {
    const k = new Kit();
    paperColumn(k);
    return k;
  });
  const dome = useKit(() => {
    const k = new Kit();
    domeFloorLamp(k);
    return k;
  });
  const garden = useKit(() => {
    const k = new Kit();
    gardenCurtains(k);
    return k;
  });
  const gable = useKit(() => {
    const k = new Kit();
    gableCurtains(k);
    return k;
  });

  const chair = { position: [ARMCHAIR.x, 0, ARMCHAIR.z] as [number, number, number], rotation: [0, ARMCHAIR.yaw, 0] as [number, number, number] };

  return (
    <group>
      <FinishOnly finishes={["s1"]}>
        <KitMesh kit={round} />
        <KitMesh kit={lantern} castShadow={false} />
        <KitMesh kit={pebble} {...chair} />
      </FinishOnly>
      <FinishOnly finishes={["s4"]}>
        <KitMesh kit={block} />
        <KitMesh kit={column} castShadow={false} />
        <KitMesh kit={cane} {...chair} />
      </FinishOnly>
      <FinishOnly finishes={["s3"]}>
        <KitMesh kit={drum} />
        <KitMesh kit={dome} />
        <KitMesh kit={leather} {...chair} />
      </FinishOnly>
      <WallCut wall="ogrod" at={0.02}>
        <KitMesh kit={garden} castShadow={false} />
      </WallCut>
      <WallCut wall="gable-salon" at={0.02}>
        <KitMesh kit={gable} castShadow={false} />
      </WallCut>
      <SofaCat />
    </group>
  );
}

/* ---------- the resident cat ---------- */

/** Seat line on the sofa's return (plan y 1.56, facing +y toward the kitchen end), spots along plan x. */
const CAT = { z: 1.56, seat: 0.452, spots: [2.02, 2.36, 2.68] };

/**
 * The cat sits on the return of the sofa, facing the salon viewpoint. In mirrored houses its group
 * un-mirrors the frame (the IK works with world rotations, which a negative scale would break).
 */
function SofaCat() {
  const house = useExplorer((s) => s.house);
  const mirrored = house ? (getHouse(house)?.mirrored ?? false) : false;
  const spots = useMemo(() => (mirrored ? CAT.spots : CAT.spots.map((s) => -s)), [mirrored]);
  return (
    <group scale-z={mirrored ? -1 : 1}>
      <group position={[0, 0, mirrored ? -CAT.z : CAT.z]} rotation-y={mirrored ? 0 : Math.PI}>
        <Cat seatY={CAT.seat} seatZ={0} spots={spots} />
      </group>
    </group>
  );
}

/** Salon ceiling fixtures (inside the level's CeilingMount). */
export function salonCeiling(k: Kit) {
  for (const [x, z] of SALON_DOWNLIGHTS) downlight(k, x, z, CEILING);
}
