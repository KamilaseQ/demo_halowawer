"use client";

import type { House } from "@/lib/estate";
import { ARRANGEMENTS } from "@/lib/estate";
import type { HouseModel, LevelId } from "@/lib/estate/geometry/types";
import { Furnishing } from "../furniture";
import { FurnitureRuntime } from "../furniture/core/runtime";
import { Hotspots, useFloorPointer, WalkCursor } from "../walk/Walk";
import { useExplorer } from "../../state/store";
import { HouseRoof } from "./HouseRoof";
import { HouseShell, type LevelState } from "./Shell";

/**
 * One house in full detail, in house space (plan metres; mirrored houses flip Z).
 * Model view: whole house (roof on) or a dollhouse cut at a level; walk view: everything whole.
 */
export function HouseWorld({ house, model }: { house: House; model: HouseModel }) {
  const mode = useExplorer((s) => s.mode);
  const level = useExplorer((s) => s.level);
  const node = useExplorer((s) => s.node);
  const arrangement = useExplorer((s) => s.arrangement) ?? ARRANGEMENTS[model.layout]?.[0]?.id ?? null;
  const walking = mode === "walk";
  const { handlers, state } = useFloorPointer(model, walking);

  const cutAt: LevelId | null = walking ? null : level;
  const states: Partial<Record<number, LevelState>> = {};
  for (const l of model.levels) states[l.level] = cutAt === null ? "whole" : l.level < cutAt ? "whole" : l.level === cutAt ? "cut" : "lifted";
  // In the walk, hotspots of the level you stand on; in the dollhouse, those of the level shown.
  const currentNode = model.walk.nodes.find((n) => n.id === node);
  const hotspotLevel: LevelId | null = walking ? (currentNode?.level ?? 0) : cutAt;

  const furnishing: Partial<Record<number, React.ReactNode>> = {};
  for (const l of model.levels)
    furnishing[l.level] = (
      <FurnitureRuntime model={model} level={l} cut={states[l.level] === "cut"}>
        <Furnishing layout={model.layout} level={l.level} arrangement={arrangement} />
      </FurnitureRuntime>
    );

  return (
    <group scale-z={house.mirrored ? -1 : 1}>
      <HouseShell
        model={model}
        states={states}
        roofLifted={cutAt !== null}
        onFloorPointer={handlers}
        roof={<HouseRoof model={model} />}
        furnishing={furnishing}
      />
      {hotspotLevel !== null && (
        <Hotspots model={model} house={house.id} level={hotspotLevel} mirrored={house.mirrored} visible={walking || mode === "model"} showLabels />
      )}
      <WalkCursor state={state} enabled={walking} />
    </group>
  );
}
