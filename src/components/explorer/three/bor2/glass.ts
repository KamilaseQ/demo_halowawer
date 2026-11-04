import * as THREE from "three";
import { INTERIOR_DAY, INTERIOR_NIGHT } from "../estate/materials";

/* ==========================================================================
   BOR2 window panes from outside: glass that reflects the sky (the physical
   material's Fresnel on the stage's IBL) over a room behind it.

   The room is interior mapping in world space, so no pane UVs are needed:
   the view ray continues through the glass into a box of the room grid
   (3.2 m along the facade × one storey 2.95 m × 4 m deep) and takes the
   colour of the first surface it meets: back wall, side wall, floor (oak)
   or ceiling, darker with depth. About half the rooms have white sheer
   curtains drawn to the sides. By day the room is dim against the sunlit
   facade (as in a photo); at night ~65% of the rooms glow warm. All of it
   is emissive (unlit), the reflection comes on top; one program, no
   textures, driven by the maquette's day/night uniforms.
   ========================================================================== */

let material: THREE.MeshPhysicalMaterial | null = null;

export function bor2Glass() {
  if (material) return material;
  const m = new THREE.MeshPhysicalMaterial({ name: "bor2-szyba", color: "#06080a", roughness: 0.04, metalness: 0, ior: 1.55, specularIntensity: 1, envMapIntensity: 1.8 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uDay = INTERIOR_DAY;
    shader.uniforms.uNight = INTERIOR_NIGHT;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vRoomW;\nvarying vec3 vRoomN;")
      .replace(
        "#include <project_vertex>",
        "#include <project_vertex>\n  vRoomW = (modelMatrix * vec4(transformed, 1.0)).xyz;\n  vRoomN = normalize(mat3(modelMatrix) * objectNormal);",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
varying vec3 vRoomW;
varying vec3 vRoomN;
uniform float uDay;
uniform float uNight;
float roomHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        /* glsl */ `#include <emissivemap_fragment>
  {
    vec3 V = normalize(vRoomW - cameraPosition);
    vec3 N = normalize(vRoomN);
    // The facade runs along Z when the pane faces ±X, else along X. "In" points into the house.
    bool alongZ = abs(N.x) > abs(N.z);
    vec3 inward = alongZ ? vec3(-sign(N.x), 0.0, 0.0) : vec3(0.0, 0.0, -sign(N.z));
    float dd = max(dot(V, inward), 0.02);
    float u = alongZ ? vRoomW.z : vRoomW.x;
    float du = alongZ ? V.z : V.x;
    const float W = 3.2;
    const float H = 2.95;
    const float D = 4.0;
    const float FLOOR0 = 0.75;
    float cu = floor(u / W);
    float cy = floor((vRoomW.y - FLOOR0) / H);
    float u0 = cu * W;
    float y0 = cy * H + FLOOR0;
    float tSide = du > 0.0 ? (u0 + W - u) / max(du, 1e-4) : (u0 - u) / min(du, -1e-4);
    float tFlat = V.y > 0.0 ? (y0 + H - vRoomW.y) / max(V.y, 1e-4) : (y0 - vRoomW.y) / min(V.y, -1e-4);
    float tBack = D / dd;
    float t = min(min(tSide, tFlat), tBack);
    float seed = roomHash(vec3(cu, cy, dot(inward, vec3(1.0, 0.0, 2.0)) + floor(dot(vRoomW, inward) * 0.25)));
    vec3 wall = mix(vec3(0.80, 0.77, 0.72), vec3(0.72, 0.74, 0.70), step(0.7, seed));
    vec3 room = t == tBack ? wall * 0.92 : t == tFlat ? (V.y > 0.0 ? vec3(0.88, 0.87, 0.84) : vec3(0.47, 0.37, 0.27)) : wall;
    room *= mix(1.0, 0.5, clamp(t * dd / D, 0.0, 1.0));
    // Sheer curtains just behind the glass, drawn to both sides of the room's window wall.
    float tc = 0.12 / dd;
    float uc = ((alongZ ? vRoomW.z + V.z * tc : vRoomW.x + V.x * tc) - u0) / W;
    float curtains = step(0.45, seed) * (smoothstep(0.24, 0.18, uc) + smoothstep(0.76, 0.82, uc));
    float folds = 0.86 + 0.14 * sin(uc * W * 46.0);
    room = mix(room, vec3(0.95, 0.94, 0.90) * folds, clamp(curtains, 0.0, 1.0) * 0.85);
    // By day the room is dim against the sunlit facade; at night most rooms glow warm.
    float lit = step(0.35, fract(seed * 7.13));
    vec3 night = room * (vec3(1.0, 0.76, 0.48) * 1.7 * lit + 0.04);
    vec3 inside = mix(room * uDay * 0.55, night, uNight);
    float fresnel = pow(1.0 - clamp(dot(-V, N) * sign(dot(-V, N) + 1e-4), 0.0, 1.0), 5.0);
    totalEmissiveRadiance += inside * (1.0 - fresnel);
  }`,
      );
  };
  m.customProgramCacheKey = () => "bor2-glass";
  material = m;
  return m;
}
