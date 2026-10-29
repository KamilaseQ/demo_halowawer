"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import type { Vec3 } from "@/lib/estate/geometry/types";
import type { DaylightPreset } from "./daylight";

const UP = new THREE.Vector3(0, 1, 0);

const vertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w; // always at the far plane
}`;

const fragment = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform float uGlowStrength;
uniform vec3 uSun;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.2, 1.0);
  // Soft horizon band, then a long gradient to the zenith.
  vec3 col = mix(uHorizon, uTop, pow(smoothstep(-0.02, 0.55, h), 0.55));
  float s = max(dot(d, normalize(uSun)), 0.0);
  col += uGlow * uGlowStrength * (pow(s, 6.0) * 0.55 + pow(s, 64.0) * 0.8) * smoothstep(-0.15, 0.2, h);
  // Below the horizon the ground haze continues the fog colour.
  col = mix(col, uHorizon, smoothstep(0.0, -0.12, d.y));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/**
 * Gradient sky dome with a sun glow, following the camera. Its colours ease with the time of day; the
 * horizon colour equals the fog colour, so the estate fades into it without a seam.
 */
export function Sky({ preset, sunDirection, spaceRotation }: { preset: DaylightPreset["sky"]; sunDirection: Vec3; spaceRotation: number }) {
  const invalidate = useThree((s) => s.invalidate);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTop: { value: new THREE.Color(preset.top) },
          uHorizon: { value: new THREE.Color(preset.horizon) },
          uGlow: { value: new THREE.Color(preset.glow) },
          uGlowStrength: { value: preset.glowStrength },
          uSun: { value: new THREE.Vector3() },
        },
      }),
    // Created once; colours ease below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const goals = useMemo(() => ({ top: new THREE.Color(), horizon: new THREE.Color(), glow: new THREE.Color() }), []);
  const mesh = useMemo(() => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), material);
    m.frustumCulled = false;
    m.renderOrder = -10;
    return m;
  }, [material]);

  useFrame(({ camera }, dt) => {
    const u = material.uniforms;
    goals.top.set(preset.top);
    goals.horizon.set(preset.horizon);
    goals.glow.set(preset.glow);
    let moving = false;
    for (const [key, goal] of [
      ["uTop", goals.top],
      ["uHorizon", goals.horizon],
      ["uGlow", goals.glow],
    ] as const) {
      const c = u[key].value as THREE.Color;
      const k = 1 - Math.exp(-dt / 0.25);
      if (Math.abs(c.r - goal.r) + Math.abs(c.g - goal.g) + Math.abs(c.b - goal.b) > 0.002) {
        c.lerp(goal, k);
        moving = true;
      } else c.copy(goal);
    }
    const g = u.uGlowStrength;
    if (Math.abs(g.value - preset.glowStrength) > 0.002) {
      // eslint-disable-next-line react-hooks/immutability -- a shader uniform, eased every frame; not React state
      g.value +=(preset.glowStrength - g.value) * (1 - Math.exp(-dt / 0.25));
      moving = true;
    }
    (u.uSun.value as THREE.Vector3).set(...sunDirection).applyAxisAngle(UP, spaceRotation);
    mesh.position.copy(camera.position);
    if (moving) invalidate();
  });

  return <primitive object={mesh} />;
}
