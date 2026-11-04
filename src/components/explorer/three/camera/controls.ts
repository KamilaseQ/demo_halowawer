import type { CameraControlsImpl } from "@react-three/drei";
import type { Vector3 } from "three";

/** Module-level handle so walk interactions and UI zoom buttons can drive the shared controls. */
let current: CameraControlsImpl | null = null;
let scratch: Vector3 | null = null;

export function registerCameraControls(c: CameraControlsImpl | null) {
  current = c;
  if (process.env.NODE_ENV !== "production") (window as unknown as { __controls: unknown }).__controls = c;
}

export function cameraControls() {
  return current;
}

/**
 * Walk collisions: a clipper moves a requested eye position `to` (from `from`) back in front of walls and
 * fences and onto the ground. Registered by the estate walk while it runs; house walks have none.
 */
export type WalkClip = (from: Vector3, to: Vector3) => Vector3;
let clip: WalkClip | null = null;
export const registerWalkClip = (fn: WalkClip | null) => void (clip = fn);
export const walkClip = () => clip;

/** Orbit target + azimuth for DOM overlays (minimap) without pulling three into the UI bundle. */
export function readPose() {
  const c = current;
  if (!c) return null;
  scratch ??= c.camera.position.clone();
  c.getTarget(scratch);
  return { x: scratch.x, y: scratch.y, z: scratch.z, azimuth: c.azimuthAngle };
}
