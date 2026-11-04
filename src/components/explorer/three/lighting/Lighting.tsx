"use client";

import { Environment } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { memo, use, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { damp, dampC } from "maath/easing";
import { useExplorer } from "../../state/store";
import { Deferred } from "../loading";
import { DAYLIGHT } from "./daylight";
import { useShadowCache } from "./shadows";
import { perfFlag } from "../../perf";
import { deviceTier } from "../../tier";
import { Sky } from "./Sky";

/* CC0 HDRI from Poly Haven (see /public/explorer/3d/manifest.json): image-based light only, never shown. */
export const HDRI = {
  // 512 × 256 is plenty for prefiltered IBL (0,5 MB instead of 1,7 MB).
  day: {
    env: "/explorer/3d/hdri/zawiszy_czarnego_512.hdr",
    // The same HDRI already prefiltered (PMREM, RGBA half floats, gzip), read back from the live renderer by
    // docs/explorer/tools/bake-pmrem.mjs. Filtering it in the browser compiles three's GGX shader, ~2,5 s on
    // ANGLE/D3D11 with the GPU blocked meanwhile; the baked texture is the identical result. Rebake when the
    // HDRI or three.js changes.
    pmrem: { url: "/explorer/3d/hdri/zawiszy_czarnego_512.pmrem.bin", width: 384, height: 512 },
  },
} as const;

const UP = new THREE.Vector3(0, 1, 0);

type BakedPmrem = { url: string; width: number; height: number };
const baked = new Map<string, Promise<THREE.DataTexture | null>>();

/** The baked PMREM as a ready CubeUV texture, or null (no file, no DecompressionStream): filter the HDRI instead. */
export function loadBakedPmrem({ url, width, height }: BakedPmrem) {
  let p = baked.get(url);
  if (!p) {
    p = (async () => {
      if (typeof DecompressionStream === "undefined") return null;
      const res = await fetch(url);
      if (!res.ok || !res.body) return null;
      const planes = new Uint8Array(await new Response(res.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
      const texels = width * height;
      if (planes.byteLength !== texels * 8) return null;
      // Stored per channel as low-byte then high-byte planes (deflates better); interleave back to RGBA halves.
      const data = new Uint16Array(texels * 4);
      for (let c = 0; c < 4; c++) {
        const lo = c * 2 * texels;
        const hi = lo + texels;
        for (let p = 0; p < texels; p++) data[p * 4 + c] = planes[lo + p] | (planes[hi + p] << 8);
      }
      const t = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.HalfFloatType);
      // Exactly what PMREMGenerator's render target holds (rows in GL order, so no flip).
      t.mapping = THREE.CubeUVReflectionMapping;
      t.colorSpace = THREE.LinearSRGBColorSpace;
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      t.flipY = false;
      t.needsUpdate = true;
      return t;
    })().catch(() => null);
    baked.set(url, p);
  }
  return p;
}

/**
 * Image-based lighting. Memoised: drei's <Environment> re-applies its scene props on every render
 * (resetting environment intensity), so it may only render when the HDRI itself changes.
 */
const Ibl = memo(function Ibl({ hdri, rotation }: { hdri: (typeof HDRI)["day"]; rotation: number }) {
  // Suspends (inside <Deferred>, so the scene gate waits) until the baked texture is in.
  const map = use(loadBakedPmrem(hdri.pmrem));
  return map ? <Environment map={map} environmentRotation={[0, rotation, 0]} /> : <Environment files={hdri.env} environmentRotation={[0, rotation, 0]} />;
});

type Props = {
  /** Interior shown (house with a model): practical lights matter, shadows fit the house. */
  interior: boolean;
  /** Centre of the lit area; the sun's shadow frustum is fitted around it. */
  center: THREE.Vector3;
  /** Half-size of the shadow frustum, metres. */
  extent: number;
  /** Rotation of the scene's space relative to estate space, radians (house space = −placement rotation). */
  spaceRotation: number;
};

/**
 * Sun + sky + bounce + IBL for the current time of day. Everything eases (time-of-day changes are a
 * slow, continuous light change) and nothing changes a shader: fog stays on, lights stay in the scene.
 */
export function Lighting({ interior, center, extent, spaceRotation }: Props) {
  const timeOfDay = useExplorer((s) => s.timeOfDay);
  const preset = DAYLIGHT[timeOfDay];
  const sun = useRef<THREE.DirectionalLight>(null);
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  useShadowCache();

  const sunTarget = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => {
    sunTarget.position.copy(center);
    scene.add(sunTarget);
    return () => {
      scene.remove(sunTarget);
    };
  }, [scene, sunTarget, center]);

  // Fog in the horizon colour melts the far ground into the sky dome.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability -- the three.js scene is mutable by design, not React state
    scene.fog = new THREE.Fog(preset.sky.horizon, 220, 760);
    return () => {
      scene.fog = null;
    };
    // Created once; colour and range ease in the frame loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  const bounce = useRef<THREE.HemisphereLight>(null);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const goal = useMemo(() => new THREE.Vector3(), []);
  // Clear air over the estate (houses sit well inside `near`); the forest belt 150–250 m out takes
  // 20–40 % haze, which closes the horizon instead of ending in an empty plain.
  const fogGoal = interior ? { near: 120, far: 620 } : { near: 140, far: 650 };

  useFrame((_, dt) => {
    const l = sun.current;
    const h = bounce.current;
    if (!l || !h) return;
    const [sky, ground, strength] = preset.bounce;
    let moving = damp(h, "intensity", strength, 0.5, dt);
    moving = dampC(h.color, sky, 0.5, dt) || moving;
    moving = dampC(h.groundColor, ground, 0.5, dt) || moving;
    dir.set(...preset.sunDirection).applyAxisAngle(UP, spaceRotation).normalize();
    goal.copy(center).addScaledVector(dir, 80);
    moving = damp(l.position, "x", goal.x, 0.5, dt) || moving;
    moving = damp(l.position, "y", goal.y, 0.5, dt) || moving;
    moving = damp(l.position, "z", goal.z, 0.5, dt) || moving;
    moving = damp(l, "intensity", preset.sunIntensity, 0.5, dt) || moving;
    moving = dampC(l.color, preset.sunColor, 0.5, dt) || moving;
    moving = damp(scene, "environmentIntensity", preset.envIntensity, 0.5, dt) || moving;
    moving = damp(gl, "toneMappingExposure", preset.exposure, 0.5, dt) || moving;
    const fog = scene.fog as THREE.Fog | null;
    if (fog) {
      moving = dampC(fog.color, preset.sky.horizon, 0.5, dt) || moving;
      moving = damp(fog, "near", fogGoal.near, 0.5, dt) || moving;
      moving = damp(fog, "far", fogGoal.far, 0.5, dt) || moving;
    }
    if (moving) invalidate();
  });

  return (
    <>
      <Sky preset={preset.sky} sunDirection={preset.sunDirection} spaceRotation={spaceRotation} />
      <hemisphereLight ref={bounce} />
      <directionalLight
        ref={sun}
        target={sunTarget}
        castShadow={!perfFlag("noshadow")}
        shadow-mapSize={deviceTier() === "lite" ? [1024, 1024] : [2048, 2048]}
        shadow-radius={interior ? 5 : 4}
        shadow-blurSamples={12}
        shadow-bias={-0.0003}
        shadow-normalBias={interior ? 0.025 : 0.06}
        shadow-camera-left={-extent}
        shadow-camera-right={extent}
        shadow-camera-top={extent}
        shadow-camera-bottom={-extent}
        shadow-camera-near={1}
        shadow-camera-far={200}
      />
      <Deferred>
        <Ibl hdri={HDRI.day} rotation={spaceRotation} />
      </Deferred>
    </>
  );
}
