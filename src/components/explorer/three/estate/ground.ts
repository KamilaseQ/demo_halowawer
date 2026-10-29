import * as THREE from "three";
import type { HouseId } from "@/lib/estate";
import type { Vec2 } from "@/lib/estate/geometry/types";
import { ESTATE_CENTER } from "@/lib/estate/geometry/site";
import { rng } from "./builder";
import { footprintRect } from "./houses";
import { HORIZON } from "./materials";
import { lazyTexture } from "../loading";
import { BEDS, terraceRect, type Bed } from "./landscape";
import { PITCH, PLOT_POLY, TREES, fenceLines } from "./plan";

/* ==========================================================================
   Terrain: one large disc. Near the estate a painted canvas (lawns with
   mowing stripes, perennial beds) lies over a procedural meadow computed in
   the shader, a second canvas multiplies soft contact shading (houses,
   decks, fences, trees), and everything fades radially into the horizon
   colour, so the model floats in a calm, hazy field.
   ========================================================================== */

/** Area covered by the painted canvases (estate XZ). */
const NEAR = { x0: -26, z0: -24, w: 128, d: 64 };
const PX = 16; // colour canvas, px per metre
const AO_PX = 8; // contact-shading canvas, px per metre

const HOUSES: HouseId[] = ["A", "B", "C", "D", "E", "F", "G"];

function hash(x: number, y: number, seed: number) {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise (bilinear on a hashed lattice), 0..1. */
function vnoise(x: number, y: number, seed: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function context(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D canvas unavailable");
  return { c, ctx };
}

function path(ctx: CanvasRenderingContext2D, poly: Vec2[], px: number, closed = true) {
  ctx.beginPath();
  poly.forEach(([x, z], i) => {
    const X = (x - NEAR.x0) * px;
    const Y = (z - NEAR.z0) * px;
    if (i) ctx.lineTo(X, Y);
    else ctx.moveTo(X, Y);
  });
  if (closed) ctx.closePath();
}

/** Colour canvas: alpha = how much it overrides the procedural meadow. */
function paintColour(): HTMLCanvasElement {
  const W = NEAR.w * PX;
  const H = NEAR.d * PX;
  const { c, ctx } = context(W, H);

  // Lawn mask: the plot, feathered.
  ctx.filter = "blur(3px)";
  ctx.fillStyle = "#fff";
  path(ctx, PLOT_POLY, PX);
  ctx.fill();
  ctx.filter = "none";
  const mask = ctx.getImageData(0, 0, W, H).data;

  // Lawn: muted warm green, mowing stripes running N–S, soft mottling.
  const img = ctx.createImageData(W, H);
  const d = img.data;
  // Natural lawn green (sRGB ~#5a7a3a): reads as grass in a warm sun, not as artificial turf.
  // One tone juicier than the field around it, still a natural grass albedo.
  const base = [74, 101, 46];
  for (let py = 0; py < H; py++) {
    const z = NEAR.z0 + py / PX;
    for (let px = 0; px < W; px++) {
      const i = (py * W + px) * 4;
      const a = mask[i + 3];
      if (!a) continue;
      const x = NEAR.x0 + px / PX;
      // Stripes 0.9 m wide, soft-edged, with a slight wobble so they read as mown, not printed.
      const s = Math.sin(((x + 0.15 * Math.sin(z * 0.7)) / 0.9) * Math.PI);
      const stripe = Math.max(-1, Math.min(1, s * 3)) * 0.018;
      const n1 = vnoise(x / 3.2, z / 3.2, 3) - 0.5;
      const n2 = vnoise(x / 0.7, z / 0.7, 5) - 0.5;
      const n3 = vnoise(x / 11, z / 11, 9) - 0.5;
      const k = 1 + stripe + n1 * 0.07 + n2 * 0.05 + n3 * 0.06;
      d[i] = base[0] * k * (1 + n3 * 0.06);
      d[i + 1] = base[1] * k;
      d[i + 2] = base[2] * k * (1 - n3 * 0.1);
      d[i + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);

  const r = rng(77);
  for (const bed of BEDS) paintBed(ctx, bed, r);
  return c;
}

function paintBed(ctx: CanvasRenderingContext2D, bed: Bed, r: () => number) {
  ctx.save();
  // Soft, slightly darker planting ground; flowers as a few blurred drifts, not speckle.
  ctx.filter = "blur(3px)";
  ctx.fillStyle = bed.palette === "verge" ? "rgb(126,136,96)" : "rgb(92,118,64)";
  path(ctx, bed.poly, PX);
  ctx.fill();
  path(ctx, bed.poly, PX);
  ctx.clip();
  const xs = bed.poly.map((p) => p[0]);
  const zs = bed.poly.map((p) => p[1]);
  const [minX, maxX, minZ, maxZ] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  const drifts = bed.palette === "garden" ? ["rgb(150,142,170)", "rgb(214,208,192)", "rgb(196,168,112)"] : ["rgb(158,160,128)"];
  ctx.filter = "blur(5px)";
  const n = Math.max(2, Math.round(((maxX - minX) * (maxZ - minZ)) / 3));
  for (let i = 0; i < n; i++) {
    const X = (minX + r() * (maxX - minX) - NEAR.x0) * PX;
    const Y = (minZ + r() * (maxZ - minZ) - NEAR.z0) * PX;
    ctx.fillStyle = drifts[Math.floor(r() * drifts.length)];
    ctx.globalAlpha = 0.35 + r() * 0.25;
    ctx.beginPath();
    ctx.ellipse(X, Y, (0.6 + r() * 0.9) * PX, (0.35 + r() * 0.4) * PX, r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Contact shading canvas (white = unshaded), multiplied over lawn and meadow alike. */
function paintAO(): HTMLCanvasElement {
  const W = NEAR.w * AO_PX;
  const H = NEAR.d * AO_PX;
  const { c, ctx } = context(W, H);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  const rect = (x0: number, z0: number, x1: number, z1: number) =>
    ctx.fillRect((x0 - NEAR.x0) * AO_PX, (z0 - NEAR.z0) * AO_PX, (x1 - x0) * AO_PX, (z1 - z0) * AO_PX);

  // Broad, faint skirt and a tighter, darker one hugging the walls.
  ctx.filter = "blur(9px)";
  ctx.fillStyle = "rgb(214,212,206)";
  for (const id of HOUSES) {
    const [w, n, e, s] = footprintRect(id);
    rect(w - 0.9, n - 0.9, e + 0.9, s + 0.9);
  }
  ctx.filter = "blur(3px)";
  ctx.fillStyle = "rgb(186,184,178)";
  for (const id of HOUSES) {
    const [w, n, e, s] = footprintRect(id);
    rect(w - 0.25, n - 0.25, e + 0.25, s + 0.25);
  }
  ctx.filter = "blur(2px)";
  ctx.fillStyle = "rgb(205,203,197)";
  for (const id of HOUSES) {
    const [x0, z0, x1, z1] = terraceRect(id);
    rect(x0 - 0.1, z0, x1 + 0.1, z1 + 0.12);
  }
  ctx.strokeStyle = "rgb(222,220,214)";
  ctx.lineWidth = 0.4 * AO_PX;
  for (const line of fenceLines()) {
    path(ctx, line, AO_PX, false);
    ctx.stroke();
  }
  ctx.filter = "blur(6px)";
  for (const t of TREES) {
    const X = (t.x - NEAR.x0) * AO_PX;
    const Y = (t.z - NEAR.z0) * AO_PX;
    const rad = (t.kind === "pine" ? 2.4 : 2.8) * AO_PX;
    const g = ctx.createRadialGradient(X, Y, 0, X, Y, rad);
    g.addColorStop(0, "rgb(200,199,194)");
    g.addColorStop(1, "rgb(255,255,255)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(X, Y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.filter = "none";
  return c;
}

/* ---------------------------------------------------------------- material */

function canvasTexture(c: HTMLCanvasElement, srgb: boolean) {
  const t = new THREE.CanvasTexture(c);
  // Canvas row 0 is the north edge (z0), which is uv.y = 0 in the shader.
  t.flipY = false;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

/*
 * The two canvases above, baked (lossless WebP) by docs/explorer/tools/bake-ground.mjs: painting them live with
 * canvas blur filters costs ~2 s of main thread on a desktop and ~10 s on a phone. The files store rows bottom-up,
 * so the off-thread decoder's flip (lazyTexture) lands canvas row 0 at uv.y = 0, as canvasTexture() does.
 * `?paintground` paints them live instead: rebake with it after changing the plan, beds, fences, trees or houses.
 */
const BAKED = { near: "/explorer/3d/ground/estate-near.webp", ao: "/explorer/3d/ground/estate-ao.webp" };
const paintLive = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("paintground");

function bakedTexture(url: string, srgb: boolean) {
  const t = lazyTexture(url);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Photographic grass detail (ambientCG, CC0) tiled in metres; the loading gate waits for it. */
function detailTexture(url: string) {
  const t = lazyTexture(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

export function makeGroundMaterial() {
  const live = paintLive();
  const near = live ? canvasTexture(paintColour(), true) : bakedTexture(BAKED.near, true);
  const ao = live ? canvasTexture(paintAO(), false) : bakedTexture(BAKED.ao, false);
  const grassTex = detailTexture("/explorer/3d/ground/Grass004/color.jpg");
  const meadowTex = detailTexture("/explorer/3d/ground/Ground037/color.jpg");

  const mat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.97, metalness: 0, envMapIntensity: 0.5 });
  // The ground sits a hair behind everything lying on it (paving, decks) at any distance.
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = 2;
  mat.polygonOffsetUnits = 2;
  const c = (hex: string) => new THREE.Color(hex);
  const uniforms = {
    uNear: { value: near },
    uAO: { value: ao },
    uNearRect: { value: new THREE.Vector4(NEAR.x0, NEAR.z0, NEAR.w, NEAR.d) },
    uCenter: { value: new THREE.Vector2(ESTATE_CENTER[0], ESTATE_CENTER[2]) },
    // Clear air: the field stays crisp across the frame and melts into the horizon only far out.
    uFade: { value: new THREE.Vector2(170, 520) },
    uHorizon: HORIZON,
    // Fresh late-summer field (21.09), not khaki.
    // Real grass albedo is ~0.15–0.25: a slightly olive late-summer field that reads green in sun, not turf.
    uMeadowA: { value: c("#6e7c4d") },
    uMeadowB: { value: c("#5d6c41") },
    uMeadowDry: { value: c("#8f8a68") },
    uGrassTex: { value: grassTex },
    uMeadowTex: { value: meadowTex },
    uPitch: { value: new THREE.Vector4(PITCH.cx, PITCH.cz, PITCH.w, PITCH.d) },
    uPitchRot: { value: PITCH.rot },
    uPitchColor: { value: c("#6f8448") },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vGround;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvGround = (modelMatrix * vec4(transformed, 1.0)).xz;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
varying vec2 vGround;
uniform sampler2D uNear;
uniform sampler2D uAO;
uniform vec4 uNearRect;
uniform vec2 uCenter;
uniform vec2 uFade;
uniform vec3 uHorizon;
uniform vec3 uMeadowA;
uniform vec3 uMeadowB;
uniform vec3 uMeadowDry;
uniform vec4 uPitch;
uniform float uPitchRot;
uniform vec3 uPitchColor;
uniform sampler2D uGrassTex;
uniform sampler2D uMeadowTex;
float gHash(vec2 p) { p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
float gNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), f.x), mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float gLine(float d, float w) { return 1.0 - smoothstep(w, w + fwidth(d) * 1.5, abs(d)); }`,
      )
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
  {
    vec2 p = vGround;
    // Meadow: broad patches of lush and dry grass, then finer clumps.
    float n1 = gNoise(p / 48.0);
    float n2 = gNoise(p / 7.0 + 13.1);
    float n3 = gNoise(p / 1.9 + 4.7);
    float n4 = gNoise(p / 0.55 + 9.3);
    vec3 col = mix(uMeadowA, uMeadowB, smoothstep(0.2, 0.9, n1) * 0.85);
    // Dry patches 15–50 m across on ~28% of the field, brightness drifting ±18% at 8–25 m (cut and uncut
    // swathes, wheel tracks); no mown strips out here (they belong to the gardens and the pitch).
    col = mix(col, uMeadowDry, smoothstep(0.55, 0.8, gNoise(p / 32.0 + 2.3)) * 0.55);
    col *= (0.94 + 0.08 * n3 + 0.06 * n4) * (0.82 + 0.36 * gNoise(p / 14.0 + 8.1)) * (0.92 + 0.16 * gNoise(p / 90.0 + 5.1));
    // Low wildflowers in drifts (yarrow, tansy, knapweed): single specks close up; further out, where specks
    // would alias, only their average tint over the drift (a faint haze of colour, as a meadow reads from afar).
    {
      float drift = smoothstep(0.55, 0.8, gNoise(p / 9.0 + 7.3)) * (1.0 - smoothstep(0.5, 0.8, gNoise(p / 32.0 + 2.3)));
      vec2 cell = floor(p / 0.32);
      float h1 = gHash(cell + 17.0);
      float h2 = gHash(cell + 41.0);
      float speck = step(0.84, h1) * (1.0 - smoothstep(0.2, 0.32, length(fract(p / 0.32) - 0.5)));
      vec3 flower = h2 < 0.45 ? vec3(0.7, 0.68, 0.58) : h2 < 0.8 ? vec3(0.68, 0.48, 0.07) : vec3(0.32, 0.22, 0.45);
      float sharp = 1.0 - smoothstep(0.03, 0.09, length(fwidth(p)));
      col = mix(col, mix(vec3(0.62, 0.52, 0.38), flower, sharp), mix(0.06, speck, sharp) * drift * 0.9);
    }
    // Photographic detail near the camera, normalised by the texture's own average (its last mip), so it
    // adds blades and soil specks without shifting the field's tone; it fades out before it could tile.
    float camNear = 1.0 - smoothstep(30.0, 95.0, length(vViewPosition));
    vec3 md = texture2D(uMeadowTex, p / 4.0).rgb;
    vec3 mAvg = textureLod(uMeadowTex, vec2(0.5), 12.0).rgb;
    col *= mix(vec3(1.0), md / max(mAvg, vec3(0.03)), camNear * 0.7);
    // Football pitch north-north-west: mown stripes and faint white lines.
    vec2 q = p - uPitch.xy;
    float cs = cos(uPitchRot);
    float sn = sin(uPitchRot);
    q = vec2(cs * q.x + sn * q.y, -sn * q.x + cs * q.y);
    vec2 hp = uPitch.zw * 0.5;
    float inPitch = (1.0 - smoothstep(hp.x - 0.5, hp.x + 0.5, abs(q.x))) * (1.0 - smoothstep(hp.y - 0.5, hp.y + 0.5, abs(q.y)));
    vec2 hl = hp - 3.0;
    float lw = 0.12;
    float onField = step(abs(q.x), hl.x + lw) * step(abs(q.y), hl.y + lw);
    float lines = max(gLine(abs(q.x) - hl.x, lw), gLine(abs(q.y) - hl.y, lw));
    lines = max(lines, max(gLine(q.x, lw), gLine(length(q) - 9.15, lw)));
    vec3 pc = uPitchColor * (0.97 + 0.04 * step(0.5, fract(q.x / 11.0)));
    // Faint, chalky lines (the pitch is real: OSM way 273248444), never a bright white rectangle.
    pc = mix(pc, vec3(0.62, 0.63, 0.56), lines * onField * 0.12);
    col = mix(col, pc, inPitch);
    // Painted near field (lawns, beds) over the meadow, then contact shading over both.
    vec2 uv = (p - uNearRect.xy) / uNearRect.zw;
    if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {
      vec4 t = texture2D(uNear, uv);
      // Close up the lawn gets blades: fine light/dark streaks and tips, faded out where they would alias.
      float fw = length(fwidth(p * 26.0));
      float blades = (1.0 - smoothstep(0.4, 1.4, fw)) * t.a;
      float g1 = gNoise(p * vec2(26.0, 9.0) + 3.7);
      float g2 = gNoise(p * vec2(9.0, 31.0) + 11.0);
      vec3 lawn = t.rgb * (0.9 + 0.2 * mix(g1, g2, 0.5) * blades + 0.06 * (1.0 - blades));
      vec3 gd = texture2D(uGrassTex, p / 2.5).rgb;
      vec3 gAvg = textureLod(uGrassTex, vec2(0.5), 12.0).rgb;
      lawn *= mix(vec3(1.0), gd / max(gAvg, vec3(0.03)), camNear * 0.8);
      lawn = mix(lawn, lawn * vec3(1.08, 1.05, 0.86), smoothstep(0.7, 0.95, g1) * 0.5 * blades);
      col = mix(col, lawn, t.a);
      col *= texture2D(uAO, uv).r;
    }
    diffuseColor.rgb *= col;
  }`,
      )
      .replace(
        "#include <fog_fragment>",
        /* glsl */ `{
    float f = smoothstep(uFade.x, uFade.y, length(vGround - uCenter));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, uHorizon, f);
  }
  #include <fog_fragment>`,
      );
  };
  mat.customProgramCacheKey = () => "estate-ground";
  return { material: mat, textures: [near, ao, grassTex, meadowTex] };
}

/** The ground disc (XZ plane, y = 0), centred on the estate. */
export function makeGroundGeometry() {
  const g = new THREE.CircleGeometry(620, 160);
  g.rotateX(-Math.PI / 2);
  g.translate(ESTATE_CENTER[0], 0, ESTATE_CENTER[2]);
  return g;
}
