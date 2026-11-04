/* ==========================================================================
   Geometry contract for the 3D explorer.

   Plan space (one house layout): metres, x → right on the developer's plan
   image, y → down the image. For layout B: x runs from the garden facade
   (x = 0) to the street facade, y from the free gable wall (y = 0) to the
   party wall. Origin = outer corner garden × free gable.

   House space (3D): X = plan x, Z = plan y, Y = up; Y = 0 is the finished
   ground floor. A plan point [x, y] at height h is the vector (x, h, y).

   Estate space (3D): X runs along the row of houses towards the east end
   (house A), Z towards the gardens (south-southwest), Y = 0 is the ground.
   Houses are placed into it by a HousePlacement (rotation + optional mirror).
   ========================================================================== */

import type { HouseId, LayoutId, LevelId, RoomKind } from "../types";

export type { LevelId };

export type Vec2 = [x: number, y: number];
export type Vec3 = [x: number, y: number, z: number];

/**
 * Finish-dependent surfaces. Each slot resolves to one shared material whose look
 * changes with the selected finish style (see components/explorer/three/materials).
 */
export type SurfaceSlot =
  | "floorWood"
  | "floorTile"
  | "terraceStone"
  | "deck"
  | "wallPaint"
  | "wallAccent"
  | "wallTile"
  | "wallCut"
  | "ceiling"
  | "facade"
  | "slabEdge"
  | "cabinetLacquer"
  | "cabinetWood"
  | "stone"
  | "fabric"
  | "fabricAccent"
  | "metal"
  | "rug"
  | "garageFloor";

export type OpeningKind = "door" | "entrance" | "window" | "glazing" | "passage" | "garage";

export type Opening = {
  kind: OpeningKind;
  /** Distance from the wall's `a` end to the opening's near edge, metres. */
  offset: number;
  width: number;
  /** Bottom of the opening above the floor (0 for doors and floor-to-ceiling glazing). */
  sill: number;
  /** Top of the opening above the floor. */
  head: number;
  /** Sliding HS door: one fixed pane + one sliding leaf, drawn with a heavier frame. */
  sliding?: boolean;
};

export type Wall = {
  id: string;
  /** Centre-line endpoints. Walls are drawn exactly a→b (no automatic corner extension). */
  a: Vec2;
  b: Vec2;
  thickness: number;
  /** Surface on the left / right of a→b when looking from a towards b (plan view, y down). */
  sides: [SurfaceSlot, SurfaceSlot];
  openings?: Opening[];
  /** Exterior walls are cut lower in the dollhouse so the interior reads from outside. */
  exterior?: boolean;
};

export type Zone = {
  id: string;
  name: string;
  kind: RoomKind;
  polygon: Vec2[];
  floor: SurfaceSlot;
  /** Interior zones get a ceiling in walk mode. */
  ceiling: boolean;
  /** Label anchor override (plan), defaults to the polygon centroid. */
  label?: Vec2;
};

export type WalkNode = {
  id: string;
  label: string;
  level: LevelId;
  /** Plan position of the viewer. */
  position: Vec2;
  /** Initial look direction, degrees in plan space: 0 = +x, 90 = +y. */
  heading: number;
  /** Initial pitch, degrees (negative looks down). */
  pitch?: number;
  /** Eye height above the level's floor override, metres (e.g. to match a marketing render). */
  eye?: number;
  /** Horizontal field of view override while standing on this node, degrees. */
  hfov?: number;
  zone: string;
};

export type CameraShot = {
  /** House-space eye position: [x, height, y]. */
  position: Vec3;
  target: Vec3;
};

/** Where a plan image sits in plan space (minimap). */
export type PlanImageMapping = {
  src: string;
  /** Plan-space coordinates of the image's top-left pixel. */
  origin: Vec2;
  pxPerMeter: number;
  width: number;
  height: number;
};

export type LevelModel = {
  level: LevelId;
  /** Finished floor of this level above the ground floor, metres. */
  elevation: number;
  /** Clear interior height, metres. */
  ceilingHeight: number;
  zones: Zone[];
  walls: Wall[];
  /** Stair flights: steps fill `rect` [x0, y0, x1, y1], rising along `dir` from `base` to `top` (above this level's floor). */
  stairs?: { rect: [number, number, number, number]; dir: "+x" | "-x" | "+y" | "-y"; base: number; top: number; steps: number }[];
  plan: PlanImageMapping;
};

/** Gable roof over the whole footprint. The ridge runs along `ridgeAxis`. */
export type Roof = {
  ridgeAxis: "x" | "y";
  /** Top of the facade walls (where the roof planes start), above the ground floor. */
  eaves: number;
  /** Outer ridge height above the ground floor. */
  ridge: number;
  thickness: number;
  /** Chimney stacks on the ridge, plan positions + size. */
  chimneys: { at: Vec2; size: Vec2; height: number }[];
};

export type HouseModel = {
  layout: LayoutId;
  /** Outer footprint of the heated envelope (plan). */
  footprint: Vec2[];
  /** Ground level relative to the finished ground floor (negative: house sits on a plinth). */
  ground: number;
  slabThickness: number;
  levels: LevelModel[];
  roof: Roof;
  /** Outdoor timber decks, plan polygons at ground floor level. */
  terraces: Vec2[][];
  walk: {
    eyeHeight: number;
    start: string;
    nodes: WalkNode[];
    /** Per-house room names where a house names the same rooms differently (A/C vs B/D upstairs). */
    labels?: Partial<Record<HouseId, Record<string, string>>>;
    /** Outdoor walk over uneven ground: the eye follows the terrain (clicked point + eyeHeight), not a storey. */
    terrain?: boolean;
  };
  shots: {
    /** Whole house from the garden side. */
    exterior: CameraShot;
    /** Dollhouse orbit per level (roof and the levels above removed). */
    levels: Partial<Record<LevelId, CameraShot>>;
  };
  /** Plan-space bounds [minX, minY, maxX, maxY] including terraces. */
  bounds: [number, number, number, number];
  /**
   * "bor2": the developer's interior GLB (geometry/bor2.ts). Its model lives in estate space (identity house
   * frame, never mirrored by the renderer: mirrors are baked into the transform); no zones or walls.
   */
  source?: "bor2";
};

/** How a house's plan space is placed in the estate. */
export type HousePlacement = {
  id: HouseId;
  /** Estate position of the plan origin (outer corner garden × free gable), ground level. */
  position: Vec3;
  /** Rotation of the plan about Y, radians (applied after the mirror). */
  rotationY: number;
  /** Mirror the plan across its x axis (plan y → −y): A and C mirror B and D. */
  mirrored: boolean;
  /** Outer footprint size in plan metres [x depth, y width]. */
  size: Vec2;
  /** Facade plaster of the maquette (warm clay, brand palette). */
  facade: string;
  /** Real standing-seam roof colour (drone photos 04.2026): the one accent a buyer recognises on site. */
  roof: string;
};
