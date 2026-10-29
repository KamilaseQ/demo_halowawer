"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, type ReactNode } from "react";
import type { FinishId } from "@/lib/estate";
import { useExplorer } from "../../../state/store";

/**
 * Shape variants per finish style (rice-paper lantern vs opal globe, wishbone vs spindle chairs).
 * Every variant stays mounted and only its visibility follows the style: the materials are the
 * shared slot materials, so a style switch never builds geometry, loads or compiles anything
 * (the scene gate compiles hidden meshes too).
 */
export function FinishOnly({ finishes, children }: { finishes: FinishId[]; children: ReactNode }) {
  const finish = useExplorer((s) => s.finish);
  const invalidate = useThree((s) => s.invalidate);
  const shown = finishes.includes(finish);
  useEffect(() => invalidate(), [shown, invalidate]);
  return <group visible={shown}>{children}</group>;
}

/** The current finish style, for builders that place shared decor per style. */
export function useFinish() {
  return useExplorer((s) => s.finish);
}
