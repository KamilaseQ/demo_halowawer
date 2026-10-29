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

/** Orbit target + azimuth for DOM overlays (minimap) without pulling three into the UI bundle. */
export function readPose() {
  const c = current;
  if (!c) return null;
  scratch ??= c.camera.position.clone();
  c.getTarget(scratch);
  return { x: scratch.x, y: scratch.y, z: scratch.z, azimuth: c.azimuthAngle };
}
