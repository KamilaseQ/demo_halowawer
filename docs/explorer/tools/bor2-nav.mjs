// Walk/nav data for the BOR2 interiors, read from their GLBs (JSON chunk only: node transforms, accessor
// bounds, cameras; no mesh decoding). Writes src/lib/estate/geometry/bor2-nav.json, which the explorer reads
// synchronously (levels for the floor picker, walk points for the HUD, bounds for the walk boundary) while the
// GLB itself loads only when a house is entered.
//
// Usage: node docs/explorer/tools/bor2-nav.mjs
// Contract (docs/explorer/bor2.md): WNETRZE_<dom> → KOND_n → KOND_n__PODLOGA …, cameras PKT_<POKOJ> at 1.65 m.
// Files without the contract (the first placeholder) fall back to all cameras and the configured floor levels.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SOURCES = [
  // Floor levels (finished floor, model Y) from the interiors contractor (b6, 04.11): G 0.83 / 3.79, B 0.27 / 3.23.
  // One versioned folder per delivery: GLB + its lightmaps (wnetrza-lm/, resolved relative to the GLB) change together.
  { id: "G", file: "public/explorer/3d/bor2/wnetrza-v2/wnetrze-g.glb", url: "/explorer/3d/bor2/wnetrza-v2/wnetrze-g.glb", floors: [0.83, 3.79] },
  { id: "B", file: "public/explorer/3d/bor2/wnetrza-v2/wnetrze-b.glb", url: "/explorer/3d/bor2/wnetrza-v2/wnetrze-b.glb", floors: [0.27, 3.23] },
];

/** PKT_<ROOM> → label. */
const ROOMS = {
  SALON: "Salon",
  KUCHNIA: "Kuchnia",
  JADALNIA: "Jadalnia",
  SYPIALNIA: "Sypialnia",
  SYPIALNIA_GLOWNA: "Sypialnia główna",
  POKOJ_DZIECKA: "Pokój dziecka",
  POKOJ: "Pokój",
  GABINET: "Gabinet",
  HOL: "Hol",
  HOL_PIETRO: "Hol na piętrze",
  LAZIENKA: "Łazienka",
  TARAS: "Taras",
  WEJSCIE: "Wejście",
};

const mul = (a, b) => {
  const o = new Array(16).fill(0);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};
const trs = (n) => {
  if (n.matrix) return n.matrix;
  const [x, y, z, w] = n.rotation || [0, 0, 0, 1];
  const [sx, sy, sz] = n.scale || [1, 1, 1];
  const [tx, ty, tz] = n.translation || [0, 0, 0];
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ];
};
const apply = (m, p) => [0, 1, 2].map((i) => m[i] * p[0] + m[4 + i] * p[1] + m[8 + i] * p[2] + m[12 + i]);
const round = (v, d = 3) => +v.toFixed(d);

function read(file) {
  const buf = fs.readFileSync(file);
  return JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString("utf8"));
}

function analyse(src) {
  const file = path.join(root, src.file);
  if (!fs.existsSync(file)) return null;
  const j = read(file);
  const parent = new Map();
  j.nodes.forEach((n, i) => (n.children || []).forEach((c) => parent.set(c, i)));
  const world = (i) => {
    let m = trs(j.nodes[i]);
    for (let p = parent.get(i); p !== undefined; p = parent.get(p)) m = mul(trs(j.nodes[p]), m);
    return m;
  };
  const ancestors = (i) => {
    const out = [];
    for (let p = parent.get(i); p !== undefined; p = parent.get(p)) out.push(j.nodes[p].name ?? "");
    return out;
  };

  // Bounds of everything (XZ) and of the floors per storey.
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  const floorY = {};
  j.nodes.forEach((n, i) => {
    if (n.mesh === undefined) return;
    const m = world(i);
    const names = [n.name ?? "", ...ancestors(i)];
    const floor = names.map((s) => /^KOND_(\d)__PODLOGA/.exec(s)).find(Boolean);
    for (const p of j.meshes[n.mesh].primitives) {
      const a = j.accessors[p.attributes.POSITION];
      if (!a.min || !a.max) continue;
      // KHR_mesh_quantization: normalized integer positions (the node scale carries the size).
      const unit = a.normalized ? { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 }[a.componentType] ?? 1 : 1;
      const min = a.min.map((v) => v / unit);
      const max = a.max.map((v) => v / unit);
      for (let c = 0; c < 8; c++) {
        const q = apply(m, [c & 1 ? max[0] : min[0], c & 2 ? max[1] : min[1], c & 4 ? max[2] : min[2]]);
        if (n.extensions?.EXT_mesh_gpu_instancing) continue; // instance spread unknown without decoding: skip
        for (let k = 0; k < 3; k++) {
          lo[k] = Math.min(lo[k], q[k]);
          hi[k] = Math.max(hi[k], q[k]);
        }
        if (floor) floorY[floor[1]] = Math.min(floorY[floor[1]] ?? Infinity, q[1]);
      }
    }
  });
  const floors = src.floors.map((f, level) => (floorY[level] !== undefined && Number.isFinite(floorY[level]) ? floorY[level] : f));
  const levelOf = (y) => floors.reduce((best, f, i) => (y >= f - 0.3 ? i : best), 0);

  // Walk points: PKT_* cameras (contract), or every camera of a placeholder file.
  const cams = [];
  j.nodes.forEach((n, i) => {
    if (n.camera === undefined) return;
    const m = world(i);
    const pos = [m[12], m[13], m[14]];
    const f = [-m[8], -m[9], -m[10]];
    const l = Math.hypot(...f);
    const cam = j.cameras[n.camera];
    cams.push({ name: n.name ?? `cam${i}`, pos, dir: f.map((v) => v / l), yfov: cam.perspective?.yfov, aspect: cam.perspective?.aspectRatio });
  });
  const contract = cams.some((c) => c.name.startsWith("PKT_"));
  const used = contract ? cams.filter((c) => c.name.startsWith("PKT_")) : cams.filter((c) => !/WIZ|alt/i.test(c.name));
  const nodes = [];
  const taken = new Map();
  for (const c of used) {
    const level = levelOf(c.pos[1] - 1.2);
    // Placeholder cameras repeat the same room from nearby spots: keep one per 1.5 m.
    if (!contract && nodes.some((n) => n.level === level && Math.hypot(n.position[0] - c.pos[0], n.position[1] - c.pos[2]) < 1.5)) continue;
    const key = contract ? c.name.slice(4) : c.name.replace(/^C\d\.\d\s*-?\s*/, "").replace(/\s*\d+$/, "").trim();
    const base = contract ? (ROOMS[key.replace(/_\d+$/, "")] ?? key.replace(/_/g, " ").toLowerCase().replace(/^./, (s) => s.toUpperCase())) : key;
    const count = (taken.get(base) ?? 0) + 1;
    taken.set(base, count);
    const slug = base
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/ł/g, "l")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    nodes.push({
      id: count > 1 ? `${slug}-${count}` : slug,
      label: count > 1 ? `${base} ${count}` : base,
      level,
      position: [round(c.pos[0]), round(c.pos[2])],
      heading: round((Math.atan2(c.dir[2], c.dir[0]) * 180) / Math.PI, 1),
      pitch: round((Math.asin(c.dir[1]) * 180) / Math.PI, 1),
      eye: round(c.pos[1] - floors[level], 2),
      camera: c.name,
    });
  }
  // Renders of the developer matched to SketchUp scene cameras (b6, 04.11): the "Wizualizacja" lens.
  const lenses = cams
    .filter((c) => c.yfov)
    .map((c) => ({ camera: c.name, position: c.pos.map((v) => round(v)), heading: round((Math.atan2(c.dir[2], c.dir[0]) * 180) / Math.PI, 1), pitch: round((Math.asin(c.dir[1]) * 180) / Math.PI, 1), hfov: round((2 * Math.atan(Math.tan(c.yfov / 2) * (c.aspect ?? 16 / 9)) * 180) / Math.PI, 1) }));

  return {
    url: src.url,
    bytes: fs.statSync(file).size,
    contract,
    floors: floors.map((f) => round(f)),
    bounds: [round(lo[0]), round(lo[2]), round(hi[0]), round(hi[2])],
    start: nodes.find((n) => n.level === 0 && /salon/.test(n.id))?.id ?? nodes[0]?.id ?? null,
    nodes,
    lenses,
  };
}

/*
 * Estate walk: the exterior's eye-level PKT_* cameras (SketchUp scenes), named for the walk bar. Order = bar
 * order; the first is the start (by the entrance). Cameras not listed here are ignored (duplicates, odd spots).
 */
const EXTERIOR = { file: "public/explorer/3d/bor2/zewnetrze-v9.glb" };
const ESTATE_POINTS = [
  ["PKT_Scene_2", "wjazd", "Wjazd"],
  ["PKT_W4", "ulica", "Od ulicy"],
  ["PKT_W3", "ogrody-ab", "Ogrody A i B"],
  ["PKT_Scene_26", "ogrody-cd", "Ogrody C i D"],
  ["PKT_Scene_9", "ogrody-efg", "Ogrody E, F, G"],
  ["PKT_W7", "ogrod-g", "Ogród G"],
];

function estateWalk() {
  const file = path.join(root, EXTERIOR.file);
  if (!fs.existsSync(file)) return null;
  const j = read(file);
  const parent = new Map();
  j.nodes.forEach((n, i) => (n.children || []).forEach((c) => parent.set(c, i)));
  const nodes = [];
  for (const [camera, id, label] of ESTATE_POINTS) {
    const i = j.nodes.findIndex((n) => n.name === camera && n.camera !== undefined);
    if (i < 0) continue;
    let m = trs(j.nodes[i]);
    for (let p = parent.get(i); p !== undefined; p = parent.get(p)) m = mul(trs(j.nodes[p]), m);
    const f = [-m[8], -m[9], -m[10]];
    const l = Math.hypot(...f);
    nodes.push({
      id,
      label,
      // BOR2 frame; eye = the camera's own height (SketchUp scenes stand at ~1.65 m over their spot).
      position: [round(m[12]), round(m[14])],
      eyeY: round(m[13], 2),
      heading: round((Math.atan2(f[2] / l, f[0] / l) * 180) / Math.PI, 1),
      pitch: round((Math.asin(f[1] / l) * 180) / Math.PI, 1),
      camera,
    });
  }
  return { start: nodes[0]?.id ?? null, nodes };
}

/** Walk bar order: the way a visit goes (ground floor from the door, then upstairs). */
const ORDER = ["wejscie", "hol", "salon", "jadalnia", "kuchnia", "gabinet", "taras", "korytarz", "hol-na-pietrze", "sypialnia", "sypialnia-glowna", "pokoj-dziecka", "pokoj", "lazienka"];
const rank = (id) => {
  const base = id.replace(/-\d+$/, "");
  const i = ORDER.indexOf(base);
  return (i < 0 ? ORDER.length : i) + (id === base ? 0 : 0.5);
};

const out = {};
const estate = estateWalk();
if (estate) out.estate = estate;
console.log("estate walk", estate ? `${estate.nodes.length} points` : "missing");
for (const src of SOURCES) {
  const data = analyse(src);
  if (data) data.nodes.sort((a, b) => a.level - b.level || rank(a.id) - rank(b.id));
  if (data) out[src.id] = data;
  console.log(src.id, data ? `${data.nodes.length} nodes, floors ${data.floors.join(" / ")}, contract ${data.contract}` : "missing");
}
const dst = path.join(root, "src/lib/estate/geometry/bor2-nav.json");
fs.writeFileSync(dst, JSON.stringify(out, null, 1) + "\n");
console.log("wrote", path.relative(root, dst));
