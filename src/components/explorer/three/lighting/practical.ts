"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { damp } from "maath/easing";
import { useExplorer } from "../../state/store";
import { DAYLIGHT } from "./daylight";

/**
 * Eased 0–1 factor for practical (artificial) lights. Read it inside useFrame:
 *   const lights = usePracticalFactor();
 *   useFrame(() => (lamp.current.intensity = 6 * lights.current));
 * Self-invalidates while easing so it works with frameloop="demand".
 */
export function usePracticalFactor() {
  const factor = useRef(DAYLIGHT[useExplorer.getState().timeOfDay].practical);
  const invalidate = useThree((s) => s.invalidate);
  useFrame((_, dt) => {
    const target = DAYLIGHT[useExplorer.getState().timeOfDay].practical;
    if (Math.abs(factor.current - target) > 0.001) {
      const box = { v: factor.current };
      damp(box, "v", target, 0.45, dt);
      factor.current = box.v;
      invalidate();
    } else if (factor.current !== target) {
      // Land exactly on the target: "off" means exactly 0, the same as a fresh daytime load.
      factor.current = target;
      invalidate();
    }
  }, -1);
  return factor;
}
