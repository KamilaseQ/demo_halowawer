import * as THREE from "three";

/* ==========================================================================
   Fence LOD (D-015). BOR2's fence is real geometry since v8: 5 mm rods every
   5 cm and double wires, which alias into moiré beyond a few metres (no
   mipmaps for geometry, MSAA or not). So:
   - near (< 8 m): the rods, as modelled;
   - 8–12 m: the rods dissolve (screen-space dither, no blending, no sorting);
   - beyond: each fence panel's plane (OGRODZENIE_KOLIZJA, one quad per span)
     draws the same rods and wires analytically, box-filtered per pixel, so
     from afar the fence reads as a fine, half-transparent dark mesh (vis-3)
     at any distance, with no texture and no shimmer.
   ========================================================================== */

const NEAR = 8;
const FAR = 12;

const COMMON = /* glsl */ `
varying vec3 vFenceW;
float fenceIgn(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
float fenceFade() { return smoothstep(${NEAR.toFixed(1)}, ${FAR.toFixed(1)}, distance(vFenceW, cameraPosition)); }
`;

function worldVarying(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nvarying vec3 vFenceW;")
    .replace("#include <project_vertex>", "#include <project_vertex>\nvFenceW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
  shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\n${COMMON}`);
}

/** The modelled rods fade out with distance (dithered discard: stays in the opaque pass). */
export function fenceRods(m: THREE.Material) {
  const prev = m.onBeforeCompile.bind(m);
  m.onBeforeCompile = (shader, renderer) => {
    prev(shader, renderer);
    worldVarying(shader);
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <clipping_planes_fragment>",
      "#include <clipping_planes_fragment>\n  if (fenceIgn(gl_FragCoord.xy) < fenceFade()) discard;",
    );
  };
  m.customProgramCacheKey = () => "bor2-fence-rods";
  return m;
}

let panel: THREE.MeshStandardMaterial | null = null;

/** Far fence: rods (5 mm / 5 cm) and paired wires, box-filtered on the panel plane, fading in past 8 m. */
export function fencePanelMaterial(color: THREE.ColorRepresentation = "#2b2d2e") {
  if (panel) return panel;
  const m = new THREE.MeshStandardMaterial({ name: "bor2-plot-daleki", color, roughness: 0.6, metalness: 0.2, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  m.onBeforeCompile = (shader) => {
    worldVarying(shader);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vFenceAlong;")
      .replace(
        "#include <project_vertex>",
        // Along the span: world X or Z, whichever the panel runs along (its normal points the other way).
        "#include <project_vertex>\n  vec3 fn = abs(normalize(mat3(modelMatrix) * normal));\n  vec3 fw = (modelMatrix * vec4(transformed, 1.0)).xyz;\n  vFenceAlong = fn.x > fn.z ? fw.z : fw.x;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
varying float vFenceAlong;
// Box-filtered pulse train (width w of each period, filter width f in periods): exact average coverage.
float fencePulseInt(float x, float w) { return floor(x) * w + max(fract(x) - (1.0 - w), 0.0); }
float fencePulse(float x, float w, float f) { f = max(f, 1e-4); return (fencePulseInt(x + 0.5 * f, w) - fencePulseInt(x - 0.5 * f, w)) / f; }`,
      )
      .replace(
        "#include <alphatest_fragment>",
        /* glsl */ `{
    float u = vFenceAlong / 0.05;
    float rods = fencePulse(u, 0.1, fwidth(u));
    float v = vFenceW.y / 0.3;
    float wires = fencePulse(v, 0.03, fwidth(v));
    float cover = 1.0 - (1.0 - rods) * (1.0 - wires);
    diffuseColor.a *= cover * fenceFade();
    if (diffuseColor.a < 0.004) discard;
  }
  #include <alphatest_fragment>`,
      );
  };
  m.customProgramCacheKey = () => "bor2-fence-panel";
  panel = m;
  return m;
}
