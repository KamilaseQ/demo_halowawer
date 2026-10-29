import type { HouseModel, LevelModel, Opening, OpeningKind, SurfaceSlot, Vec2, Wall } from "./types";

/* ==========================================================================
   Layout B: houses B and D; mirrored as A and C (semi-detached, garage in
   the body of the house).

   Traced from senn.pl dom-b-parter.png / dom-b-pietro.png (1600×1200 px) at
   102.4 px/m, origin = outer corner garden facade × free gable wall
   (pixel 329, 222). x → street (north), y → party wall (east for B).
   Room areas match the developer's card within ±0.1 m²:
     strefa dzienna 3.64 × 7.47 = 27.2 (27.26) · garaż 5.25 × 3.51 = 18.4 (18.47)
     sypialnia 3.64 × 3.78 = 13.8 (13.81) · pokój 1 3.64 × 3.58 = 13.0 (12.92)
     pokój hobby 2.90 × 3.58 = 10.4 (10.22) · łazienka 2.18 × 2.23 = 4.85 (4.74)
   ========================================================================== */

const PX = 102.4;
const O: Vec2 = [329, 222];
/** Plan image pixel → plan metres (kept for re-tracing). */
export const px = (x: number, y: number): Vec2 => [+((x - O[0]) / PX).toFixed(3), +((y - O[1]) / PX).toFixed(3)];

/* Key lines (metres). */
const X_OUT = 9.883; // street facade, outer face
const Y_OUT = 8.252; // party wall, outer face (centre of the shared wall)
const X_IN0 = 0.4; // garden wall, inner face
const X_IN1 = 9.48; // street wall, inner face
const Y_IN0 = 0.39; // free gable wall, inner face
const Y_IN1 = 7.862; // party wall, inner face
const X_PART = 4.136; // living | core partition (centre)
const X_CORE = 6.494; // corridor | entrance zone partition (centre)

const EXT = 0.4;
const PARTY = 0.39;

export const GROUND_HEIGHT = 2.64;
export const FIRST_HEIGHT = 2.6;
export const SLAB = 0.3;
export const FIRST_ELEVATION = GROUND_HEIGHT + SLAB;

const rect = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

type Hole = { kind: OpeningKind; from: number; to: number; sill?: number; head: number; sliding?: boolean };

/** Openings are given by absolute plan coordinates along the wall's axis, whichever way the wall runs. */
function wall(
  id: string,
  a: Vec2,
  b: Vec2,
  thickness: number,
  sides: [SurfaceSlot, SurfaceSlot],
  holes: Hole[] = [],
  exterior = false,
): Wall {
  const alongX = Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]);
  const a0 = alongX ? a[0] : a[1];
  const dir = Math.sign((alongX ? b[0] : b[1]) - a0);
  const openings: Opening[] = holes.map((h) => {
    const lo = Math.min(h.from, h.to);
    const hi = Math.max(h.from, h.to);
    return {
      kind: h.kind,
      offset: +(dir > 0 ? lo - a0 : a0 - hi).toFixed(3),
      width: +(hi - lo).toFixed(3),
      sill: h.sill ?? 0,
      head: h.head,
      sliding: h.sliding,
    };
  });
  return { id, a, b, thickness, sides, openings, exterior };
}

const door = (from: number, to: number, head = 2.05): Hole => ({ kind: "door", from, to, head });

/*
 * Exterior walls run so that the facade is on their left (clockwise around the plan, y down):
 * free gable (y≈0) runs +x, street (x≈9.9) runs +y, party (y≈8.25) runs −x, garden (x≈0) runs −y.
 */

/* ---------------------------------------------------------------- parter */

const ground: LevelModel = {
  level: 0,
  elevation: 0,
  ceilingHeight: GROUND_HEIGHT,
  zones: [
    { id: "salon", name: "Strefa dzienna", kind: "living", polygon: rect(X_IN0, Y_IN0, 4.043, Y_IN1), floor: "floorWood", ceiling: true, label: [2.2, 3.2] },
    { id: "garaz", name: "Garaż", kind: "garage", polygon: rect(4.229, Y_IN0, X_IN1, 3.9), floor: "garageFloor", ceiling: true },
    { id: "korytarz", name: "Korytarz", kind: "hall", polygon: rect(4.229, 4.08, X_CORE - 0.088, 5.76), floor: "floorWood", ceiling: true },
    { id: "schody", name: "Schody", kind: "stairs", polygon: rect(4.229, 5.76, 5.312, Y_IN1), floor: "floorWood", ceiling: false },
    { id: "techniczne", name: "Pom. techniczne", kind: "technical", polygon: rect(5.41, 5.88, X_CORE - 0.088, Y_IN1), floor: "floorTile", ceiling: true },
    { id: "wiatrolap", name: "Wiatrołap", kind: "hall", polygon: rect(X_CORE + 0.088, 4.08, 8.29, 6.36), floor: "floorTile", ceiling: true },
    { id: "wc", name: "WC", kind: "wc", polygon: rect(X_CORE + 0.088, 6.48, 8.29, Y_IN1), floor: "floorTile", ceiling: true },
    { id: "wejscie", name: "Wejście", kind: "terrace", polygon: rect(8.69, 4.49, X_OUT, 7.1), floor: "terraceStone", ceiling: false },
    { id: "taras", name: "Taras", kind: "terrace", polygon: rect(-2.0, 1.05, -0.0, 4.52), floor: "deck", ceiling: false },
  ],
  walls: [
    /* free gable wall: living part (window by the garden corner), garage part */
    wall("gable-salon", [X_IN0, 0.195], [X_PART, 0.195], 0.39, ["facade", "wallPaint"], [{ kind: "window", from: 0.459, to: 1.445, head: 2.24 }], true),
    wall("gable-garaz", [X_PART, 0.195], [X_IN1, 0.195], 0.39, ["facade", "wallPaint"], [{ kind: "window", from: 4.385, to: 5.488, sill: 1.17, head: 2.24 }], true),
    /* street facade: garage door, then the recessed entrance */
    wall("ulica-garaz", [9.683, 0], [9.683, 4.49], EXT, ["facade", "wallPaint"], [{ kind: "garage", from: 1.035, to: 3.555, head: 2.2 }], true),
    wall("ulica-naroznik", [9.683, 7.1], [9.683, Y_OUT], EXT, ["facade", "wallPaint"], [], true),
    /* party wall */
    wall("bliźniak", [X_IN1, 8.057], [X_IN0, 8.057], PARTY, ["facade", "wallPaint"], [], true),
    /* garden facade: the HS sliding door (the hero glazing) and the dining window */
    wall(
      "ogrod",
      [0.2, Y_OUT],
      [0.2, 0],
      EXT,
      ["facade", "wallPaint"],
      [
        { kind: "glazing", from: 1.035, to: 4.541, head: 2.24, sliding: true },
        { kind: "glazing", from: 5.469, to: 7.012, head: 2.24 },
      ],
      true,
    ),
    /* entrance recess (covered by the upper floor): front wall with the door, its top and bottom returns */
    wall("wejscie", [8.49, 4.49], [8.49, 7.1], EXT, ["facade", "wallPaint"], [{ kind: "entrance", from: 4.951, to: 6.025, head: 2.08 }], true),
    wall("wejscie-n", [8.29, 4.285], [X_IN1, 4.285], 0.41, ["wallPaint", "facade"]),
    wall("wejscie-s", [X_IN1, 7.48], [8.69, 7.48], 0.76, ["wallPaint", "facade"]),

    /* interior partitions */
    // TV wall of the living room (accent finish, as in the home Kreator renders), then the passage to the corridor.
    wall("salon-tv", [X_PART, Y_IN0], [X_PART, 4.08], 0.186, ["wallPaint", "wallAccent"]),
    wall("salon-rdzen", [X_PART, 4.08], [X_PART, Y_IN1], 0.186, ["wallPaint", "wallPaint"], [{ kind: "passage", from: 4.08, to: 5.762, head: 2.4 }]),
    wall("garaz-korytarz", [4.229, 3.99], [X_IN1, 3.99], 0.19, ["wallPaint", "wallPaint"], [door(5.41, 6.35)]),
    wall("korytarz-wiatrolap", [X_CORE, 4.08], [X_CORE, Y_IN1], 0.176, ["wallPaint", "wallPaint"], [door(4.756, 5.684, 2.1)]),
    wall("wiatrolap-wc", [X_CORE + 0.088, 6.42], [8.29, 6.42], 0.12, ["wallTile", "wallPaint"], [door(6.846, 7.676)]),
    wall("schody-techniczne", [5.36, 5.76], [5.36, Y_IN1], 0.1, ["wallPaint", "wallPaint"]),
    wall("techniczne", [5.41, 5.83], [X_CORE - 0.088, 5.83], 0.1, ["wallPaint", "wallPaint"], [door(5.55, 6.3, 1.9)]),
  ],
  stairs: [
    // First flight rises from the corridor towards the party wall; winders + upper flight sit over the technical room.
    { rect: [4.25, 5.5, 5.3, 7.84], dir: "+y", base: 0, top: 1.68, steps: 9 },
    { rect: [5.42, 5.86, 6.4, 7.84], dir: "-y", base: 1.68, top: FIRST_ELEVATION, steps: 7 },
  ],
  plan: { src: "/explorer/plans/dom-b-parter.webp", origin: [-O[0] / PX, -O[1] / PX], pxPerMeter: PX, width: 1600, height: 1200 },
};

/* ---------------------------------------------------------------- piętro */

const WIN = { sill: 0.21, head: 2.25 };

const first: LevelModel = {
  level: 1,
  elevation: FIRST_ELEVATION,
  ceilingHeight: FIRST_HEIGHT,
  zones: [
    { id: "pokoj-1", name: "Pokój 1", kind: "room", polygon: rect(X_IN0, Y_IN0, 4.043, 3.965), floor: "floorWood", ceiling: true },
    { id: "sypialnia", name: "Sypialnia", kind: "bedroom", polygon: rect(X_IN0, 4.08, 4.043, Y_IN1), floor: "floorWood", ceiling: true },
    { id: "lazienka", name: "Łazienka", kind: "bathroom", polygon: rect(4.229, Y_IN0, X_CORE - 0.088, 2.62), floor: "floorTile", ceiling: true },
    { id: "korytarz-1", name: "Korytarz", kind: "hall", polygon: rect(4.229, 2.74, X_CORE - 0.088, 5.76), floor: "floorWood", ceiling: true },
    { id: "schody-1", name: "Schody", kind: "stairs", polygon: rect(4.229, 5.76, X_CORE - 0.088, Y_IN1), floor: "floorWood", ceiling: true },
    { id: "hobby", name: "Pokój hobby", kind: "room", polygon: rect(X_CORE + 0.088, Y_IN0, X_IN1, 3.965), floor: "floorWood", ceiling: true },
    {
      id: "pokoj-2",
      name: "Pokój 2",
      kind: "room",
      polygon: [
        [X_CORE + 0.088, 4.08],
        [X_IN1, 4.08],
        [X_IN1, Y_IN1 - 0.23],
        [8.33, Y_IN1 - 0.23],
        [8.33, Y_IN1],
        [X_CORE + 0.088, Y_IN1],
      ],
      floor: "floorWood",
      ceiling: true,
    },
  ],
  walls: [
    wall("gable-1", [X_IN0, 0.195], [X_IN1, 0.195], 0.39, ["facade", "wallPaint"], [{ kind: "window", from: 4.385, to: 5.488, sill: 1.18, head: 2.25 }], true),
    wall(
      "ulica-1",
      [9.683, 0],
      [9.683, Y_OUT],
      EXT,
      ["facade", "wallPaint"],
      [
        { kind: "window", from: 0.996, to: 3.584, ...WIN },
        { kind: "window", from: 4.453, to: 7.05, ...WIN },
      ],
      true,
    ),
    wall("bliźniak-1", [X_IN1, 8.057], [X_IN0, 8.057], PARTY, ["facade", "wallPaint"], [], true),
    wall(
      "ogrod-1",
      [0.2, Y_OUT],
      [0.2, 0],
      EXT,
      ["facade", "wallPaint"],
      [
        { kind: "window", from: 1.035, to: 3.555, ...WIN },
        { kind: "window", from: 4.49, to: 7.01, ...WIN },
      ],
      true,
    ),
    /* rooms along the garden: corridor-side partition with two doors */
    wall("lewe-pokoje", [X_PART, Y_IN0], [X_PART, Y_IN1], 0.186, ["wallPaint", "wallPaint"], [door(2.98, 3.78), door(4.3, 5.1)]),
    wall("prawe-pokoje", [X_CORE, Y_IN0], [X_CORE, Y_IN1], 0.176, ["wallPaint", "wallPaint"], [door(2.98, 3.78), door(4.3, 5.1)]),
    wall("pokoj1-sypialnia", [X_IN0, 4.022], [4.043, 4.022], 0.12, ["wallPaint", "wallPaint"]),
    wall("hobby-pokoj2", [X_CORE + 0.088, 4.022], [X_IN1, 4.022], 0.12, ["wallPaint", "wallPaint"]),
    wall("lazienka-korytarz", [4.229, 2.68], [X_CORE - 0.088, 2.68], 0.12, ["wallTile", "wallPaint"], [door(4.86, 5.66)]),
  ],
  plan: { src: "/explorer/plans/dom-b-pietro.webp", origin: [-O[0] / PX, -O[1] / PX], pxPerMeter: PX, width: 1600, height: 1200 },
};

/* ---------------------------------------------------------------- house */

export const LAYOUT_B: HouseModel = {
  layout: "b",
  footprint: rect(0, 0, X_OUT, Y_OUT),
  ground: -0.18,
  slabThickness: SLAB,
  levels: [ground, first],
  roof: {
    ridgeAxis: "y",
    eaves: 6.05,
    ridge: 9.05,
    thickness: 0.32,
    chimneys: [
      { at: [4.94, 1.15], size: [0.62, 0.46], height: 0.85 },
      { at: [4.94, 7.1], size: [0.62, 0.46], height: 0.85 },
    ],
  },
  terraces: [rect(-2.0, 1.05, 0, 4.52)],
  walk: {
    eyeHeight: 1.6,
    start: "salon",
    nodes: [
      // Hero viewpoints match the home Kreator renders (public/explorer/renders/<room>/<style>.jpg), so the
      // "Wizualizacja" switch cross-fades between this view and the photoreal render of the same style.
      // salon: from the kitchen end towards the free gable, HS glazing on the left, TV wall on the right.
      { id: "salon", label: "Salon", level: 0, position: [3.1, 6.95], heading: 256, pitch: -5, eye: 1.35, hfov: 76, zone: "salon" },
      // kuchnia: from the TV end towards the kitchen run on the party wall, HS glazing on the right.
      { id: "kuchnia", label: "Kuchnia z jadalnią", level: 0, position: [3.3, 1.45], heading: 108, pitch: -5, eye: 1.35, hfov: 78, zone: "salon" },
      { id: "ogrod", label: "Widok na ogród", level: 0, position: [3.1, 2.75], heading: 182, pitch: -3, eye: 1.5, hfov: 74, zone: "salon" },
      { id: "korytarz", label: "Korytarz", level: 0, position: [5.3, 4.95], heading: 0, pitch: -4, zone: "korytarz" },
      { id: "taras", label: "Taras", level: 0, position: [-1.95, 1.2], heading: 32, pitch: -5, hfov: 80, zone: "taras" },
      { id: "sypialnia", label: "Sypialnia", level: 1, position: [3.2, 7.35], heading: 206, pitch: -7, eye: 1.3, hfov: 76, zone: "sypialnia" },
      { id: "pokoj-1", label: "Pokój 1", level: 1, position: [3.3, 3.3], heading: 215, pitch: -9, zone: "pokoj-1" },
      { id: "hobby", label: "Pokój hobby", level: 1, position: [7.0, 3.3], heading: 315, pitch: -9, zone: "hobby" },
      { id: "pokoj-2", label: "Pokój 2", level: 1, position: [7.0, 4.75], heading: 45, pitch: -9, zone: "pokoj-2" },
      { id: "lazienka", label: "Łazienka", level: 1, position: [5.3, 2.35], heading: 250, pitch: -12, zone: "lazienka" },
      // Arrival: in the vestibule, looking down the corridor towards the living room.
      { id: "wejscie", label: "Wejście", level: 0, position: [7.55, 5.45], heading: 185, pitch: -4, zone: "wiatrolap" },
      // Out on the lawn, looking back at the garden facade and the HS door (the dream shot).
      { id: "ogrod-zew", label: "Ogród", level: 0, position: [-6.8, 6.6], heading: -22, pitch: 2, eye: 1.6, hfov: 70, zone: "taras" },
    ],
    // A and C (mirrored B) name the upstairs rooms by their own areas: 13,47 · 12,92 · 10,93 · 10,22 m².
    labels: {
      A: { sypialnia: "Pokój 3", "pokoj-1": "Sypialnia", "pokoj-2": "Pokój 1", hobby: "Pokój 2" },
      C: { sypialnia: "Pokój 3", "pokoj-1": "Sypialnia", "pokoj-2": "Pokój 1", hobby: "Pokój 2" },
    },
  },
  shots: {
    // From inside the garden (within the fences), low 3/4 towards the HS door, terrace and free gable,
    // like the developer's hero render. Wide lens (house rig ≈ 36° vertical).
    exterior: { position: [-10.8, 2.5, -7.2], target: [3.9, 3.55, 4.1] },
    levels: {
      0: { position: [-8.5, 12.5, -6.5], target: [4.9, 0.4, 4.3] },
      1: { position: [-8.5, 15.4, -6.5], target: [4.9, 3.3, 4.3] },
    },
  },
  // Includes the lawn south of the terrace (the "Ogród" viewpoint).
  bounds: [-9, -0.5, X_OUT, Y_OUT + 0.5],
};
