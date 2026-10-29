import type { House, HouseId, LayoutId, LevelId } from "../types";
import { LAYOUT_B } from "./layoutB";
import type { HouseModel, LevelModel, WalkNode } from "./types";

/** Layouts with a full 3D model. Add one here (and to LAYOUTS_WITH_3D) when its model lands. */
const MODELS: Partial<Record<LayoutId, HouseModel>> = {
  b: LAYOUT_B,
};

export function houseModel(layout: LayoutId): HouseModel | null {
  return MODELS[layout] ?? null;
}

export function modelFor(house: House | undefined | null): HouseModel | null {
  return house ? houseModel(house.layout) : null;
}

export function levelModel(model: HouseModel, level: LevelId): LevelModel | undefined {
  return model.levels.find((l) => l.level === level);
}

/** A walk node's label as this house names the room (A and C label their upstairs rooms differently). */
export function nodeLabel(model: HouseModel, house: HouseId | null | undefined, node: WalkNode) {
  return (house && model.walk.labels?.[house]?.[node.id]) || node.label;
}

export function walkNode(model: HouseModel, id: string | null): WalkNode {
  return model.walk.nodes.find((n) => n.id === id) ?? model.walk.nodes.find((n) => n.id === model.walk.start)!;
}

export type * from "./types";
export { PLACEMENTS, planToEstate, houseCenter, ESTATE_CENTER, ROOF_COLOR, ESTATE_AZIMUTH_X } from "./site";
