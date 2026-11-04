import type { House, HouseId, LayoutId, LevelId } from "../types";
import { bor2Model } from "./bor2";
import { LAYOUT_B } from "./layoutB";
import type { HouseModel, LevelModel, WalkNode } from "./types";

/** Layouts with a full 3D model. Add one here (and to LAYOUTS_WITH_3D) when its model lands. */
const MODELS: Partial<Record<LayoutId, HouseModel>> = {
  b: LAYOUT_B,
};

export function houseModel(layout: LayoutId): HouseModel | null {
  return MODELS[layout] ?? null;
}

/** The house's 3D model: its BOR2 interior when exported (geometry/bor2.ts), else the traced layout. */
export function modelFor(house: House | undefined | null): HouseModel | null {
  return house ? (bor2Model(house.id) ?? houseModel(house.layout)) : null;
}

/** Whether the renderer mirrors this house's model (traced layouts only: BOR2 bakes mirrors in). */
export function modelMirrored(house: House | undefined | null, model: HouseModel | null) {
  return !!house?.mirrored && model?.source !== "bor2";
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
export { bor2Interior, bor2Model, estateWalkModel, hasBor2Interior, BOR2_OFFSET } from "./bor2";
export { PLACEMENTS, planToEstate, houseCenter, ESTATE_CENTER, ROOF_COLOR, ESTATE_AZIMUTH_X } from "./site";
