"use client";

import { useEffect, useMemo } from "react";
import type { HouseModel } from "@/lib/estate/geometry/types";
import { buildGableRoof } from "../estate/roof";
import { useMaterials } from "../materials/MaterialsProvider";
import { bbox } from "./Shell";

/**
 * Standing-seam gable roof of the detailed house, from the estate's roof generator (the same roof the
 * maquette shows, so the switch is invisible): no overhang, raised seams every ~0.5 m, fascia/box gutter,
 * verge flashings, ridge cap, plastered chimneys with metal caps. Lifts off in the dollhouse, so its
 * gable end faces are closed.
 */
export function HouseRoof({ model }: { model: HouseModel }) {
  const mats = useMaterials();
  const parts = useMemo(() => {
    const [x0, y0, x1, y1] = bbox(model.footprint);
    return buildGableRoof([x1 - x0, y1 - y0], model.roof, { endFaces: true });
  }, [model]);

  useEffect(
    () => () => {
      for (const g of Object.values(parts)) g.dispose();
    },
    [parts],
  );

  return (
    <group>
      <mesh geometry={parts.metal} material={mats.roof} castShadow receiveShadow />
      <mesh geometry={parts.slab} material={mats.facade} castShadow receiveShadow />
      {/* Fascia, verges and ridge cap in anthracite (like the joinery): a crisp edge, never a lime band in warm sun. */}
      <mesh geometry={parts.trim} material={mats.frame} castShadow receiveShadow />
      <mesh geometry={parts.chimneys} material={mats.facade} castShadow receiveShadow />
      <mesh geometry={parts.caps} material={mats.frame} castShadow />
    </group>
  );
}
