import type { HouseId } from "@/lib/estate";
import { PLACEMENTS, planToEstate } from "@/lib/estate/geometry/site";
import type { Vec3 } from "@/lib/estate/geometry/types";
import { PLINTH, houseSpec } from "./houses";
import { bor2Boxes, bor2Enabled } from "../bor2/exterior";

/** Gap between the ridge and a house's label anchor, metres. */
const ABOVE_RIDGE = 1.2;

/**
 * Estate-space anchor for a house's DOM label: centre of the ridge, ~1.2 m above it (above the
 * chimney caps' typical silhouette when seen from the overview camera).
 */
export function labelAnchor(id: HouseId): Vec3 {
  // BOR2: centre of the house's real volume, above its ridge.
  const box = bor2Enabled() ? bor2Boxes()[id] : undefined;
  if (box) return [(box.min.x + box.max.x) / 2, box.max.y + ABOVE_RIDGE, (box.min.z + box.max.z) / 2];
  const p = PLACEMENTS[id];
  const spec = houseSpec(id);
  return planToEstate(p, [p.size[0] / 2, p.size[1] / 2], PLINTH + spec.roof.ridge + ABOVE_RIDGE);
}
