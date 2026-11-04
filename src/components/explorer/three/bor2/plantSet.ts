import MAP from "../../../../../docs/inwestycja-3d/assets/zielen/mapowanie.json";

/* ==========================================================================
   Placement of the card-based plant set (assets/zielen/rosliny.glb) on the
   BOR2 planting markers, ported 1:1 from the contractor's reference
   (assets/zielen/rozmiesc.mjs; rules in mapowanie.json, read from there):
   deterministic FNV-1a hashes of the marker names, species in 2.2–2.6 m
   patches, hedges along their rows, 2–3 low meadow tufts around every
   grass/perennial marker. Coordinates in the GLB frame (the patch grid is
   defined there); the caller shifts them into estate space.
   ========================================================================== */

export const PLANTS_URL = "/explorer/3d/zielen/rosliny-v3.glb";

export type PlantMarker = { name: string; x: number; y: number; z: number; rot: number; scale: number };
export type PlantInstance = { name: string; variant: string; x: number; y: number; z: number; rot: number; sx: number; sy: number; sz: number };

type Typ = { typ: string; waga: number; warianty: string[]; skala: [number, number] };
type Rule = { pomin?: boolean; podszyt?: boolean; plamy_m?: number; domieszka?: number; typy: Typ[]; pod?: string[]; odleglosc_m?: [number, number]; min?: number; p_dodatkowej?: number };
const RULES = (MAP as unknown as { prefiksy: Record<string, Rule> }).prefiksy;

/** FNV-1a 32-bit → [0, 1). */
function u01(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h / 4294967296;
}

function pickWeighted(list: Typ[], u: number) {
  const sum = list.reduce((a, t) => a + t.waga, 0);
  let acc = 0;
  for (const t of list) {
    acc += t.waga / sum;
    if (u < acc) return t;
  }
  return list[list.length - 1];
}

/** Hedge rows: markers linked by ≤ 1.2 m neighbours, ordered along the row's longer axis. */
function hedgeRuns(ms: PlantMarker[], maxGap = 1.2) {
  const left = new Set(ms);
  const runs: PlantMarker[][] = [];
  while (left.size) {
    const start = left.values().next().value as PlantMarker;
    const run = [start];
    left.delete(start);
    for (let i = 0; i < run.length; i++)
      for (const o of [...left])
        if (Math.hypot(o.x - run[i].x, o.z - run[i].z) <= maxGap) {
          run.push(o);
          left.delete(o);
        }
    const dx = Math.max(...run.map((m) => m.x)) - Math.min(...run.map((m) => m.x));
    const dz = Math.max(...run.map((m) => m.z)) - Math.min(...run.map((m) => m.z));
    run.sort((a, b) => (dx >= dz ? a.x - b.x : a.z - b.z));
    runs.push(run);
  }
  return runs;
}

export function placePlants(markers: PlantMarker[]): PlantInstance[] {
  const out: PlantInstance[] = [];
  const byPrefix = new Map<string, PlantMarker[]>();
  for (const m of markers) {
    const prefix = m.name.replace(/_\d+$/, "");
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
    byPrefix.get(prefix)!.push(m);
  }
  for (const [prefix, ms] of byPrefix) {
    const rule = RULES[prefix];
    if (!rule || rule.pomin || rule.podszyt) continue;
    if (prefix === "ZYWOPLOT") {
      const variants = rule.typy[0].warianty;
      for (const run of hedgeRuns(ms)) {
        const grab = u01("ZYWOPLOT:" + run[0].name) < 0.75;
        run.forEach((m, i) => {
          const nb = run[i + 1] ?? run[i - 1] ?? m;
          let rot = nb === m ? m.rot : Math.atan2(-(nb.z - m.z), nb.x - m.x);
          if (i % 2) rot += Math.PI;
          const variant = grab ? variants[u01(m.name + "#h") < 0.5 ? 0 : 1] : variants[2];
          out.push({ name: m.name, variant, x: m.x, y: m.y, z: m.z, rot, sx: 1, sy: m.scale, sz: 1 });
        });
      }
      continue;
    }
    const cell = rule.plamy_m ?? 0;
    for (const m of ms) {
      let typ: Typ;
      if (rule.typy.length === 1) typ = rule.typy[0];
      else if (cell && u01(m.name + "#mix") >= (rule.domieszka ?? 0)) typ = pickWeighted(rule.typy, u01(`${prefix}:${Math.floor(m.x / cell)}:${Math.floor(m.z / cell)}`));
      else typ = pickWeighted(rule.typy, u01(m.name + "#t"));
      const w = typ.warianty;
      const variant = w[Math.min(w.length - 1, Math.floor(u01(m.name + "#v") * w.length))];
      const s = m.scale * (typ.skala[0] + (typ.skala[1] - typ.skala[0]) * u01(m.name + "#s"));
      out.push({ name: m.name, variant, x: m.x, y: m.y, z: m.z, rot: m.rot, sx: s, sy: s, sz: s });
    }
  }
  // Meadow underplanting: 2–3 low tufts around every grass / perennial marker.
  const pod = RULES.PODSZYT;
  if (pod && !pod.pomin && pod.pod && pod.odleglosc_m) {
    const typ = pod.typy[0];
    const [r0, r1] = pod.odleglosc_m;
    for (const [prefix, ms] of byPrefix) {
      if (!pod.pod.includes(prefix)) continue;
      for (const m of ms) {
        const n = (pod.min ?? 1) + (u01(m.name + "#p") < (pod.p_dodatkowej ?? 0.5) ? 1 : 0);
        for (let k = 0; k < n; k++) {
          const a = 2 * Math.PI * u01(m.name + "#pa" + k);
          const r = r0 + (r1 - r0) * u01(m.name + "#pr" + k);
          const w = typ.warianty;
          const variant = w[Math.min(w.length - 1, Math.floor(u01(m.name + "#pv" + k) * w.length))];
          const s = typ.skala[0] + (typ.skala[1] - typ.skala[0]) * u01(m.name + "#ps" + k);
          out.push({ name: `${m.name}#podszyt${k}`, variant, x: m.x + Math.cos(a) * r, y: m.y, z: m.z + Math.sin(a) * r, rot: 2 * Math.PI * u01(m.name + "#po" + k), sx: s, sy: s, sz: s });
        }
      }
    }
  }
  return out;
}
