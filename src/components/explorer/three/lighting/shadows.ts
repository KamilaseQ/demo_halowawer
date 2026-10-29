"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";

/**
 * The sun's 2048² shadow map only changes when a shadow caster or the sun moves (cutaway walls,
 * ceilings, lifting storeys, time of day, new furniture), never when the camera does. So it is
 * re-rendered only then: right before three draws shadows (after it has updated world matrices),
 * the casters' transforms are compared with the previous frame's. Orbiting and walking skip the
 * whole shadow pass; the shadows themselves are unchanged.
 */
export function useShadowCache() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    const previous = scene.onBeforeRender;
    let seen = new Float64Array(8192);
    let used = 0;

    // eslint-disable-next-line react-hooks/immutability -- three.js scene hook; the scene is mutable by design
    scene.onBeforeRender = (...args) => {
      let i = 0;
      let changed = false;
      const put = (v: number) => {
        if (i === seen.length) {
          const grown = new Float64Array(seen.length * 2);
          grown.set(seen);
          seen = grown;
        }
        if (seen[i] !== v) {
          seen[i] = v;
          changed = true;
        }
        i++;
      };
      const matrix = (m: THREE.Matrix4) => {
        for (let k = 0; k < 16; k++) put(m.elements[k]);
      };

      scene.traverseVisible((o) => {
        if (!o.castShadow) return;
        put(o.id);
        matrix(o.matrixWorld);
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          put(mesh.geometry.id);
          put(Array.isArray(mesh.material) ? -mesh.material.length : (mesh.material as unknown as { id: number }).id);
        }
        const instanced = o as THREE.InstancedMesh;
        if (instanced.isInstancedMesh) {
          put(instanced.count);
          put(instanced.instanceMatrix.version);
        }
        const light = o as THREE.DirectionalLight;
        if (light.isLight && light.shadow) {
          if (light.target) matrix(light.target.matrixWorld);
          matrix(light.shadow.camera.projectionMatrix);
          put(light.shadow.mapSize.x);
        }
      });
      if (i !== used) changed = true;
      used = i;
      if (changed) gl.shadowMap.needsUpdate = true;
      previous.call(scene, ...args);
    };

    // eslint-disable-next-line react-hooks/immutability -- renderer settings are mutable by design, not React state
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    return () => {
      scene.onBeforeRender = previous;
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl, scene]);
}
