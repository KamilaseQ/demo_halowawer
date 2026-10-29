import * as THREE from "three";

/* ==========================================================================
   Availability highlight: one champagne-gold glass shell per house, all in a
   single mesh. `uGlow[i]` (0..1, eased by EstateWorld) fades a house's shell
   in; houses at 0 collapse in the vertex shader, so idle shells cost no
   fragments. Unlit: a soft fill plus a fresnel rim that brightens the edges,
   blended "over" with a little extra light (additive-ish).
   ========================================================================== */

const VERTEX = /* glsl */ `
attribute float aHouse;
attribute vec3 aBary;
varying vec3 vBary;
uniform float uGlow[7];
uniform float uSold[7];
varying float vGlow;
varying float vSold;
varying vec3 vNormalW;
varying vec3 vPosW;
varying float vHeight;
void main() {
  int i = int(aHouse + 0.5);
  vGlow = uGlow[i];
  vSold = uSold[i];
  vec4 w = modelMatrix * vec4(position, 1.0);
  vPosW = w.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vHeight = position.y;
  vBary = aBary;
  gl_Position = vGlow < 0.002 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * viewMatrix * w;
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uGold;
uniform vec3 uSilver;
uniform float uStrength;
uniform float uLine;
varying vec3 vBary;
varying float vGlow;
varying float vSold;
varying vec3 vNormalW;
varying vec3 vPosW;
varying float vHeight;
void main() {
  vec3 n = normalize(vNormalW);
  vec3 v = normalize(cameraPosition - vPosW);
  float fres = pow(1.0 - abs(dot(n, v)), 2.4);
  // A touch brighter towards the roof, like light caught in glass.
  float lift = smoothstep(0.0, 9.0, vHeight);
  vec3 tint = mix(uGold, uSilver, vSold);
  // Distance to the nearest real edge in pixels: a fine bright line with a short soft halo.
  vec3 px = vBary / max(fwidth(vBary), vec3(1e-4));
  float d = min(min(px.x, px.y), px.z);
  float line = 1.0 - smoothstep(uLine - 0.7, uLine + 0.7, d);
  float halo = exp(-d * 0.3) * 0.45;
  float edge = clamp(line + halo, 0.0, 1.0);
  // Thin glass fill, brighter at grazing angles and towards the roof.
  float fill = 0.09 + 0.05 * lift + 0.3 * fres;
  float a = vGlow * mix(fill, 0.9, edge);
  vec3 col = tint * uStrength * mix(0.8 + 0.25 * lift + 0.7 * fres, 1.7, edge);
  gl_FragColor = vec4(col * a, a * 0.75);
}
`;

export function makeShellMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uGlow: { value: new Array(7).fill(0) },
      uSold: { value: new Array(7).fill(0) },
      uGold: { value: new THREE.Color("#d9a35b") },
      uSilver: { value: new THREE.Color("#d6d2ca") },
      // Linear HDR scene (tone mapped in post): the shell has to be about as bright as sunlit plaster.
      uStrength: { value: 2.6 },
      // Edge line half-width, pixels.
      uLine: { value: 0.9 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    fog: false,
  });
}
