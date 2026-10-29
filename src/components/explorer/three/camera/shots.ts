import * as THREE from "three";
import type { CameraShot, WalkNode } from "@/lib/estate/geometry/types";

/** First-person rigs keep the orbit target this far in front of the eye. */
export const LOOK_DISTANCE = 0.01;

/* ---------- estate overview (estate space = compass: X east, Z south) ---------- */

/**
 * Resting overview: from the south-south-east (azimuth ~145°), looking along the row: house A (the hero, the
 * largest garden) nearest and largest. High enough (~16° down onto the gardens) that every garden, terrace
 * and fence reads (what is being bought: a house with its garden to the south), low enough that the pine
 * belt and a band of sky stay in the top of the frame.
 */
export const ESTATE_SHOT: CameraShot = { position: [100, 26, 86], target: [36, 6, 0] };

/**
 * Where the opening fly-over starts: the developer's aerial photo viewpoint (street side, from the NE),
 * so the photo dissolves into a 3D model seen the same way, which then arcs round to the gardens.
 */
export const ESTATE_INTRO: CameraShot = { position: [113.5, 67, -84], target: [37, 0, 12] };

export const ESTATE_LIMITS = {
  minDistance: 22,
  maxDistance: 230,
  minPolar: THREE.MathUtils.degToRad(12),
  maxPolar: THREE.MathUtils.degToRad(80),
};

/** Plan heading/pitch (degrees) → unit view direction in world space. */
export function headingToDirection(heading: number, pitch = 0) {
  const h = THREE.MathUtils.degToRad(heading);
  const p = THREE.MathUtils.degToRad(pitch);
  return new THREE.Vector3(Math.cos(h) * Math.cos(p), Math.sin(p), Math.sin(h) * Math.cos(p));
}

export type Look = { position: THREE.Vector3; target: THREE.Vector3 };

/** A walk node's eye: its own eye height above the level floor when set, the default otherwise. */
export function nodeLook(node: WalkNode, eye: number, elevation = 0): Look {
  const position = new THREE.Vector3(node.position[0], node.eye !== undefined ? elevation + node.eye : eye, node.position[1]);
  const target = position.clone().addScaledVector(headingToDirection(node.heading, node.pitch ?? 0), LOOK_DISTANCE);
  return { position, target };
}

/** Shot ([x, height, z]) → world vectors. */
export function shotLook(shot: CameraShot): Look {
  const [px, ph, py] = shot.position;
  const [tx, th, ty] = shot.target;
  return { position: new THREE.Vector3(px, ph, py), target: new THREE.Vector3(tx, th, ty) };
}

/** Vertical FOV that yields the given horizontal FOV at an aspect ratio. */
export function verticalFov(horizontalDeg: number, aspect: number) {
  const h = THREE.MathUtils.degToRad(horizontalDeg);
  return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(h / 2) / aspect));
}
