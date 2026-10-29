"use client";

import type { LayoutId, LevelId } from "@/lib/estate";
import { FurnishingB } from "./b";

/**
 * Furniture, fixtures and practical lights per layout, level and arrangement.
 * Rendered inside the level's group: coordinates are plan metres with Y = 0 at that level's floor.
 */
export function Furnishing({ layout, level, arrangement }: { layout: LayoutId; level: LevelId; arrangement: string | null }) {
  if (layout === "b") return <FurnishingB level={level} arrangement={arrangement} />;
  return null;
}
