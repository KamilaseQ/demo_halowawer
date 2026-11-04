import * as THREE from "three";
import type { HouseId } from "@/lib/estate";
import { PLACEMENTS } from "@/lib/estate/geometry/site";
import type { CameraShot, HouseModel, Vec2, WalkNode } from "@/lib/estate/geometry/types";

/* ==========================================================================
   Scene spaces.

   Estate view renders in ESTATE space. A house view renders in HOUSE space:
   the house's plan space (X = plan x, Z = plan y, Y = 0 = finished ground
   floor), so all interior code (walk, labels, camera shots) works in plan
   metres. Mirrored houses (A, C) are drawn with scale-z −1, so plan points
   map to (x, h, −y) and headings flip. The estate around a house is drawn
   with the inverse placement, which keeps the two spaces consistent: a camera
   pose re-expressed with `toHouse` / `toEstate` shows exactly the same image.
   ========================================================================== */

export type HouseFrame = {
  id: HouseId;
  mirrored: boolean;
  /** Estate position of house-space origin (ground floor level). */
  origin: THREE.Vector3;
  rotationY: number;
};

const UP = new THREE.Vector3(0, 1, 0);

export function houseFrame(id: HouseId, model: HouseModel | null): HouseFrame {
  // BOR2 interiors are modelled in estate space: house space is estate space.
  if (model?.source === "bor2") return { id, mirrored: false, origin: new THREE.Vector3(), rotationY: 0 };
  const p = PLACEMENTS[id];
  const lift = model ? -model.ground : 0.18;
  return { id, mirrored: p.mirrored, origin: new THREE.Vector3(p.position[0], p.position[1] + lift, p.position[2]), rotationY: p.rotationY };
}

/** Estate → house space (in place). */
export function toHouse(f: HouseFrame, v: THREE.Vector3) {
  return v.sub(f.origin).applyAxisAngle(UP, -f.rotationY);
}

/** House → estate space (in place). */
export function toEstate(f: HouseFrame, v: THREE.Vector3) {
  return v.applyAxisAngle(UP, f.rotationY).add(f.origin);
}

/** Plan point at a height → house-space vector, honouring the mirror. */
export function planVec(mirrored: boolean, [x, y]: Vec2, h = 0) {
  return new THREE.Vector3(x, h, mirrored ? -y : y);
}

export function shotVecs(mirrored: boolean, shot: CameraShot) {
  const [px, ph, py] = shot.position;
  const [tx, th, ty] = shot.target;
  return { position: planVec(mirrored, [px, py], ph), target: planVec(mirrored, [tx, ty], th) };
}

/** A walk node with its plan heading mirrored (plan headings: 0 = +x, 90 = +y). */
export function mirrorNode(mirrored: boolean, n: WalkNode): WalkNode {
  if (!mirrored) return n;
  return { ...n, position: [n.position[0], -n.position[1]], heading: -n.heading };
}
