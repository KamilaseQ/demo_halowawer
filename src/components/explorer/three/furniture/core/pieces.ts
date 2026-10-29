import * as THREE from "three";
import { Kit, type FurnKey } from "./kit";
import { boxAt, circle, cylinder, disc, lathe, merge, rod, softBox, sweep, tint, type Geo, type SoftBoxOpts, type Vec3T } from "./geometry";

/* ==========================================================================
   Small reusable furniture parts shared by several rooms.
   ========================================================================== */

/** Soft box between world extents, optionally rotated about its centre. */
export function soft(k: Kit, key: FurnKey, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, o: SoftBoxOpts = {}, rot?: Vec3T) {
  return k.add(key, softBox(x1 - x0, y1 - y0, z1 - z0, o), [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], rot);
}

/** A hardback lying flat: covers, spine and a page block. Base at y = 0, spine along −x. */
export function bookGeo(w: number, t: number, d: number, cover: string, pages = "#ede7dc"): Geo {
  const c = 0.0025;
  return merge(
    [
      tint(boxAt(-w / 2, w / 2, t - c, t, -d / 2, d / 2, { r: 0.001 }), cover),
      tint(boxAt(-w / 2, w / 2, 0, c, -d / 2, d / 2, { r: 0.001 }), cover),
      tint(boxAt(-w / 2, -w / 2 + 0.004, 0, t, -d / 2, d / 2, { r: 0.0015 }), cover),
      tint(boxAt(-w / 2 + 0.003, w / 2 - 0.003, c, t - c, -d / 2 + 0.003, d / 2 - 0.003, { r: 0.0005 }), pages),
    ],
    true,
  );
}

/** Stack of books (bottom first). Each entry: [w, thickness, depth, cover colour, yaw]. */
export function bookStack(k: Kit, at: Vec3T, books: [number, number, number, string, number][]) {
  let y = at[1];
  for (const [w, t, d, color, yaw] of books) {
    k.add("decor", bookGeo(w, t, d, color), [at[0], y, at[2]], [0, yaw, 0]);
    y += t;
  }
  return y;
}

/** Flat book → standing book: thickness along +x, height up, spine facing −z. */
const STAND = new THREE.Matrix4().set(0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1);

/** Row of books standing along +x with spines toward −z. Each: [thickness, height, depth, colour]. */
export function bookRow(k: Kit, at: Vec3T, books: [number, number, number, string][]) {
  let x = at[0];
  for (const [t, h, d, color] of books) {
    const g = bookGeo(d, t, h, color).applyMatrix4(STAND);
    k.add("decor", g, [x, at[1] + h / 2, at[2]]);
    x += t + 0.002;
  }
  return x;
}

/** Reed diffuser: tinted glass bottle with black reeds. Base at `at`. */
export function diffuser(k: Kit, at: Vec3T, seed = 1) {
  const bottle = lathe(
    [
      [0, 0],
      [0.034, 0],
      [0.042, 0.012],
      [0.044, 0.05],
      [0.036, 0.075],
      [0.014, 0.088],
      [0.012, 0.1],
      [0, 0.1],
    ],
    { segments: 28 },
  );
  k.add("glassTint", bottle, at);
  k.add("black", cylinder(0.0135, 0.012, 16).translate(0, 0.1, 0), at);
  let s = seed * 77;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + r();
    const tilt = 0.12 + r() * 0.14;
    const len = 0.24 + r() * 0.05;
    const top: Vec3T = [at[0] + Math.cos(a) * Math.sin(tilt) * len, at[1] + 0.1 + Math.cos(tilt) * len, at[2] + Math.sin(a) * Math.sin(tilt) * len];
    k.add("cable", rod([at[0] + Math.cos(a) * 0.004, at[1] + 0.09, at[2] + Math.sin(a) * 0.004], top, 0.0016, 0.0014, 5, false));
  }
}

/** Open magazine lying on a soft surface: two pages in a shallow V. Centre at `at`, yaw `rotY`. */
export function magazine(k: Kit, at: Vec3T, rotY = 0) {
  const w = 0.21, d = 0.28, fold = 0.05;
  const page = (side: -1 | 1) => {
    const g = new THREE.PlaneGeometry(w, d, 1, 1);
    g.rotateX(-Math.PI / 2);
    // UV: each page takes its half of the spread texture.
    const uv = g.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) uv.setX(i, side < 0 ? uv.getX(i) * 0.5 : 0.5 + uv.getX(i) * 0.5);
    g.translate((side * w) / 2, 0, 0);
    g.rotateZ(side * -fold);
    return g;
  };
  const g = merge([page(-1), page(1)]);
  k.add("magazine", g, [at[0], at[1] + 0.006, at[2]], [0, rotY, 0]);
  // Paper thickness under the pages.
  k.add("paper", boxAt(-w, w, 0, 0.004, -d / 2, d / 2, { r: 0.001 }), at, [0, rotY, 0]);
}

/** Recessed downlight: trim ring + emissive disc, flush with a ceiling at `y`. */
export function downlight(k: Kit, x: number, z: number, y = 2.7, r = 0.042) {
  k.add("ceramicMatte", lathe([[r - 0.009, y - 0.0035], [r + 0.01, y - 0.0035], [r + 0.012, y - 0.0005]], { segments: 32 }).translate(x, 0, z));
  k.add("glowCeiling", disc(r - 0.009, 28, true).translate(x, y - 0.002, z));
}

/** Thin pendant cable from a ceiling canopy down to `bottom`. */
export function pendantCable(k: Kit, x: number, z: number, bottom: number, ceiling = 2.7, canopy = true) {
  k.add("cable", rod([x, bottom, z], [x, ceiling - 0.01, z], 0.0014, 0.0014, 5, false));
  if (canopy) k.add("metal", cylinder(0.035, 0.012, 24).translate(x, ceiling - 0.012, z));
}

/** Leaning rectangular frame with a printed artwork (canvas texture). Face toward +z. */
export function framedArt(k: Kit, w: number, h: number, at: Vec3T, rotY: number, lean = 0.06) {
  const t = 0.022;
  const frame = new Kit();
  frame.box("black", -w / 2, w / 2, 0, t, -0.012, 0.012, { r: 0.002 });
  frame.box("black", -w / 2, w / 2, h - t, h, -0.012, 0.012, { r: 0.002 });
  frame.box("black", -w / 2, -w / 2 + t, 0, h, -0.012, 0.012, { r: 0.002 });
  frame.box("black", w / 2 - t, w / 2, 0, h, -0.012, 0.012, { r: 0.002 });
  const art = new THREE.PlaneGeometry(w - 2 * t, h - 2 * t).translate(0, h / 2, 0.004);
  frame.add("art", art);
  k.include(frame, at, [-lean, rotY, 0]);
}

/** Closed rounded-rectangle loop (half extents a, b; corner radius cr) as 2D points. */
function roundedLoop(a: number, b: number, cr: number, perCorner = 5): [number, number][] {
  const out: [number, number][] = [];
  const corners: [number, number, number][] = [
    [a - cr, b - cr, 0],
    [-(a - cr), b - cr, Math.PI / 2],
    [-(a - cr), -(b - cr), Math.PI],
    [a - cr, -(b - cr), (3 * Math.PI) / 2],
  ];
  for (const [cx, cy, a0] of corners)
    for (let i = 0; i <= perCorner; i++) {
      const t = a0 + (i / perCorner) * (Math.PI / 2);
      out.push([cx + cr * Math.cos(t), cy + cr * Math.sin(t)]);
    }
  return out;
}

/**
 * Piping (welt cord) on the seam of a soft box made with softBox(w, h, d, { r }): the seam runs along
 * the 45° line of the rounded edge, around the top face ("top") or the front +z face ("front").
 */
export function piping(k: Kit, key: FurnKey, pos: Vec3T, size: Vec3T, r: number, face: "top" | "front", rot?: Vec3T, cord = 0.0042) {
  const [w, h, d] = size;
  const inset = r * (1 - Math.SQRT1_2);
  const cr = r * Math.SQRT1_2;
  const pts =
    face === "top"
      ? roundedLoop(w / 2 - inset, d / 2 - inset, cr).map(([x, z]) => new THREE.Vector3(x, h / 2 - inset, z))
      : roundedLoop(w / 2 - inset, h / 2 - inset, cr).map(([x, y]) => new THREE.Vector3(x, y, d / 2 - inset));
  const curve = new THREE.CatmullRomCurve3(pts, true, "centripetal");
  k.add(key, sweep(curve, circle(cord, 6), { segments: 84, up: face === "top" ? [0, 1, 0] : [0, 0, 1] }), pos, rot);
}

