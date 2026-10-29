"use client";

import { ContactShadow, type Footprint } from "../core/contact";
import { Kit } from "../core/kit";
import { PracticalLights, type PracticalLight } from "../core/lights";
import { LightPools, type Pool } from "../core/pools";
import { CeilingMount, KitMesh, useKit } from "../core/runtime";
import { Entry, entryCeiling, entryKit } from "./entry";
import { KITCHEN_DOWNLIGHTS, Kitchen, TABLE, kitchenCeiling, kitchenKit } from "./kitchen";
import { COFFEE, SALON_DOWNLIGHTS, Salon, salonCeiling, salonKit } from "./living";

/* ==========================================================================
   Ground floor of layout B: every static piece merges into one kit (one draw
   call per material for the whole floor); style variants, wall-mounted parts
   and ceiling fixtures are their own small groups.
   ========================================================================== */

/**
 * Five of the house's eight practical lights: the dining pendant, the under-cabinet LED, the floor lamp,
 * a soft ceiling wash over the seating and the corridor. None casts shadows.
 */
const LIGHTS: PracticalLight[] = [
  { kind: "spot", position: [TABLE.x, 1.66, TABLE.z], target: [TABLE.x, 0, TABLE.z], intensity: 9, angle: 0.85, penumbra: 0.95, distance: 4.2 },
  { kind: "rect", position: [1.93, 1.486, 7.55], rotation: [-Math.PI / 2 - 0.55, 0, 0], width: 2.96, height: 0.03, intensity: 95, color: "#ffdcb6" },
  // Floor lamp: the source sits in front of the lantern so the gable wall gets a soft gradient, not a hotspot.
  { kind: "point", position: [2.62, 1.28, 0.95], intensity: 1.7, distance: 3.6, color: "#ffd9b0" },
  { kind: "spot", position: [2.5, 2.6, 2.55], target: [2.5, 0, 2.6], intensity: 7, angle: 1.05, penumbra: 1, distance: 5.2 },
  { kind: "point", position: [5.3, 2.3, 4.9], intensity: 1.4, distance: 3.4 },
];

const onRug = (x: number, z: number) => x > 1.75 && x < 3.52 && z > 1.3 && z < 3.95;

const POOLS: Pool[] = [
  ...SALON_DOWNLIGHTS.map(([x, z]) => ({ x, y: onRug(x, z) ? 0.0195 : 0.0045, z, r: 0.5 })),
  ...KITCHEN_DOWNLIGHTS.map(([x, z]) => ({ x, y: 0.0045, z, r: 0.5 })),
  { x: 5.3, y: 0.0195, z: 4.92, r: 0.45 },
  { x: 7.45, y: 0.0045, z: 7.15, r: 0.4 },
  // Warm footprint of the dining pendant on the table top.
  { x: TABLE.x, y: TABLE.h + 0.002, z: TABLE.z, r: 0.62, rz: 0.42 },
];

/** Footprints on the rug (sofa, coffee table) and on the bare floor. */
const ON_RUG: Footprint[] = [
  { x0: 1.2, x1: 2.18, z0: 0.8, z1: 3.78, r: 0.09 },
  { x0: 1.44, x1: 2.86, z0: 0.8, z1: 1.78, r: 0.09 },
  { x0: COFFEE.x - 0.42, x1: COFFEE.x + 0.42, z0: COFFEE.z - 0.42, z1: COFFEE.z + 0.42, r: 0.42 },
];

const ON_FLOOR: Footprint[] = [
  // Dining table and chairs.
  { x0: TABLE.x - TABLE.w / 2, x1: TABLE.x + TABLE.w / 2, z0: TABLE.z - TABLE.d / 2, z1: TABLE.z + TABLE.d / 2, r: 0.04 },
  ...[-0.6, 0, 0.6].flatMap((dx) => [
    { x0: TABLE.x + dx - 0.22, x1: TABLE.x + dx + 0.22, z0: TABLE.z - 1.04, z1: TABLE.z - 0.62, r: 0.06 },
    { x0: TABLE.x + dx - 0.22, x1: TABLE.x + dx + 0.22, z0: TABLE.z + 0.62, z1: TABLE.z + 1.04, r: 0.06 },
  ]),
  // Kitchen run, tall units, media console, armchair, olive tree.
  { x0: 0.42, x1: 3.44, z0: 7.24, z1: 7.862, r: 0.01 },
  { x0: 3.42, x1: 4.043, z0: 5.762, z1: 7.862, r: 0.01 },
  { x0: 3.6, x1: 4.04, z0: 1.45, z1: 3.85, r: 0.01 },
  { x0: 2.88, x1: 3.56, z0: 0.68, z1: 1.36, r: 0.3 },
  { x0: 3.59, x1: 4.01, z0: 0.43, z1: 0.85, r: 0.21 },
  // Corridor console, entrance wardrobe and bench, WC, technical, car.
  { x0: 4.4, x1: 5.25, z0: 4.085, z1: 4.36, r: 0.01 },
  { x0: 6.6, x1: 7.66, z0: 4.085, z1: 4.66, r: 0.01 },
  { x0: 7.7, x1: 8.28, z0: 4.09, z1: 4.48, r: 0.01 },
  { x0: 6.6, x1: 8.28, z0: 7.66, z1: 7.86, r: 0.01 },
  { x0: 5.48, x1: 6.08, z0: 7.15, z1: 7.75, r: 0.3 },
  { x0: 4.85, x1: 9.1, z0: 1.3, z1: 2.95, r: 0.35 },
  { x0: 5.7, x1: 8.7, z0: 0.39, z1: 0.85, r: 0.01 },
];

export function Ground() {
  const room = useKit(() => {
    const k = new Kit();
    salonKit(k);
    kitchenKit(k);
    entryKit(k);
    return k;
  });
  const ceiling = useKit(() => {
    const k = new Kit();
    salonCeiling(k);
    kitchenCeiling(k);
    entryCeiling(k);
    return k;
  });
  return (
    <group>
      <KitMesh kit={room} />
      <Salon />
      <Kitchen />
      <Entry />
      <CeilingMount>
        <KitMesh kit={ceiling} castShadow={false} />
      </CeilingMount>
      <ContactShadow shapes={ON_RUG} spread={0.32} y={0.0195} opacity={0.42} />
      <ContactShadow shapes={ON_FLOOR} spread={0.3} opacity={0.34} />
      <LightPools pools={POOLS} strength={0.16} />
      <PracticalLights lights={LIGHTS} />
    </group>
  );
}
