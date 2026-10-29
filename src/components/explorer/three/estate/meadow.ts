import * as THREE from "three";
import { deviceTier } from "../../tier";
import { rng } from "./builder";
import { estateMaterials } from "./materials";
import { PLOT_POLY } from "./plan";
import { grassTuftGeometry } from "./vegetation";

/* ==========================================================================
   The unmown hem of the south field along the gardens' fences: grass clumps
   with flowering tufts (white yarrow, knapweed lilac, yellow tansy). The open
   field beyond is the ground shader's (low grass, flower drifts). Instanced,
   no shadows of its own (it receives them), low enough never to block a view.
   ========================================================================== */

/** sRGB colours of the meadow mix: [r, g, b, weight]. */
const MIX: [number, number, number, number][] = [
  [0.45, 0.56, 0.27, 0.34], // fresh green
  [0.33, 0.45, 0.2, 0.22], // deep green
  [0.62, 0.66, 0.5, 0.14], // silvery
  [0.78, 0.71, 0.47, 0.17], // straw
  [0.93, 0.92, 0.86, 0.05], // yarrow
  [0.63, 0.53, 0.73, 0.04], // knapweed
  [0.9, 0.78, 0.32, 0.04], // tansy
];

function pick(v: number) {
  let acc = 0;
  for (const c of MIX) {
    acc += c[3];
    if (v <= acc) return c;
  }
  return MIX[0];
}

/** Inside the plot, or within `pad` metres of its boundary (no meadow tufts in the gardens or on the fences). */
function inPlot(x: number, z: number, pad: number) {
  let inside = false;
  let nearest = Infinity;
  const n = PLOT_POLY.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [ax, az] = PLOT_POLY[i];
    const [bx, bz] = PLOT_POLY[j];
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
    const ex = bx - ax;
    const ez = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez)));
    nearest = Math.min(nearest, Math.hypot(x - (ax + ex * t), z - (az + ez * t)));
  }
  return inside || nearest < pad;
}

/** The plot edge facing the field (gardens' south fences): the two corners with the largest z. */
function southEdge(): [[number, number], [number, number]] {
  const pts = [...PLOT_POLY].sort((p, q) => q[1] - p[1]).slice(0, 2) as [number, number][];
  return pts[0][0] < pts[1][0] ? [pts[0], pts[1]] : [pts[1], pts[0]];
}

export function buildMeadow() {
  const lite = deviceTier() === "lite";
  const count = lite ? 600 : 1500;
  const geo = grassTuftGeometry(14);
  const mesh = new THREE.InstancedMesh(geo, estateMaterials().plants, count);
  const r = rng(4242);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const c = new THREE.Color();
  let n = 0;
  const place = (x: number, z: number, s: number) => {
    if (n >= count || inPlot(x, z, 1.2)) return;
    q.setFromAxisAngle(up, r() * Math.PI * 2);
    m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s * 1.2, s, s * 1.2));
    mesh.setMatrixAt(n, m);
    const [cr, cg, cb] = pick(r());
    const k = 0.9 + r() * 0.2;
    mesh.setColorAt(n, c.setRGB(cr * k, cg * k, cb * k, THREE.SRGBColorSpace));
    n++;
  };

  // 1. A dense wild margin along the gardens' south fences (as an unmown field edge does).
  const [[ax, az], [bx, bz]] = southEdge();
  const ex = bx - ax;
  const ez = bz - az;
  const len = Math.hypot(ex, ez);
  const nx = -ez / len;
  const nz = ex / len;
  const out = nz > 0 ? 1 : -1; // outward = towards the field (+z)
  const margin = count;
  for (let i = 0; i < margin; i++) {
    const t = r();
    const d = 1.2 + Math.pow(r(), 1.6) * 2.2;
    // Knee to hip high: a soft hem along the fences that never hides the gardens from the overview.
    place(ax + ex * t + nx * out * d, az + ez * t + nz * out * d, 0.55 + r() * 0.6);
  }
  // The open field beyond stays low (flower drifts are painted into the ground shader): isolated tall
  // clumps out there read as repeated sprites.
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}
