"use client";

import type { LevelId } from "@/lib/estate";
import { StatsProbe } from "../core/runtime";
import { Ground } from "./ground";
import { Upper } from "./upper";

/** Furnishing of layout B (houses B, D; mirrored as A, C by the parent group). */
export function FurnishingB({ level, arrangement }: { level: LevelId; arrangement: string | null }) {
  return (
    <group name="furnishing" userData={{ level }}>
      {level === 0 ? (
        <>
          <Ground />
          <StatsProbe />
        </>
      ) : level === 1 ? (
        <Upper arrangement={arrangement} />
      ) : null}
    </group>
  );
}
