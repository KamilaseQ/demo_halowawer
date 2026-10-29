import type { HouseId } from "@/lib/estate";
import { PLACEMENTS, planToEstate } from "@/lib/estate/geometry/site";
import type { Vec3 } from "@/lib/estate/geometry/types";
import { PLINTH, houseSpec } from "./houses";

/** Gap between the ridge and a house's label anchor, metres. */
const ABOVE_RIDGE = 1.2;

/**
 * Estate-space anchor for a house's DOM label: centre of the ridge, ~1.2 m above it (above the
 * chimney caps' typical silhouette when seen from the overview camera).
 */
export function labelAnchor(id: HouseId): Vec3 {
  const p = PLACEMENTS[id];
  const spec = houseSpec(id);
  return planToEstate(p, [p.size[0] / 2, p.size[1] / 2], PLINTH + spec.roof.ridge + ABOVE_RIDGE);
}
