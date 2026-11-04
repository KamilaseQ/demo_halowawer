// Referencyjne rozmieszczenie roślin z rosliny.glb na znacznikach ZIELEN_ZNACZNIKI wg mapowanie.json.
// Bez zależności (czysty JS) - używa go podglad.html; runtime (Bor2Planting.tsx) może przenieść 1:1.
//
//   import { rozmiesc } from "./rozmiesc.mjs";
//   const lista = rozmiesc(znaczniki, mapowanie);
//   // znaczniki: [{ name, x, y, z, rot, scale }]  (pozycja świata glTF, rot = obrót Y w rad, scale = skala znacznika)
//   // wynik:     [{ name, wariant, x, y, z, rot, sx, sy, sz }]  (wariant = nazwa węzła w rosliny.glb)

/** FNV-1a 32-bit -> [0, 1). */
export function u01(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h / 4294967296;
}

function pickWeighted(list, u) {
  const sum = list.reduce((a, t) => a + t.waga, 0);
  let acc = 0;
  for (const t of list) {
    acc += t.waga / sum;
    if (u < acc) return t;
  }
  return list[list.length - 1];
}

/** Rzędy żywopłotu: znaczniki połączone sąsiedztwem <= maxGap, uporządkowane wzdłuż rzędu. */
function hedgeRuns(ms, maxGap = 1.2) {
  const left = new Set(ms);
  const runs = [];
  while (left.size) {
    const start = left.values().next().value;
    const run = [start];
    left.delete(start);
    for (let i = 0; i < run.length; i++) {
      for (const o of [...left]) {
        if (Math.hypot(o.x - run[i].x, o.z - run[i].z) <= maxGap) { run.push(o); left.delete(o); }
      }
    }
    // porządek wzdłuż dłuższej osi rzędu
    const dx = Math.max(...run.map((m) => m.x)) - Math.min(...run.map((m) => m.x));
    const dz = Math.max(...run.map((m) => m.z)) - Math.min(...run.map((m) => m.z));
    run.sort((a, b) => (dx >= dz ? a.x - b.x : a.z - b.z));
    runs.push(run);
  }
  return runs;
}

export function rozmiesc(znaczniki, map) {
  const out = [];
  const byPrefix = new Map();
  for (const m of znaczniki) {
    const prefix = m.name.replace(/_\d+$/, "");
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
    byPrefix.get(prefix).push(m);
  }
  for (const [prefix, ms] of byPrefix) {
    const rule = map.prefiksy[prefix];
    if (!rule || rule.pomin) continue;
    if (prefix === "ZYWOPLOT") {
      const variants = rule.typy[0].warianty;
      for (const run of hedgeRuns(ms)) {
        const grab = u01("ZYWOPLOT:" + run[0].name) < 0.75;
        run.forEach((m, i) => {
          const nb = run[i + 1] ?? run[i - 1] ?? m;
          let rot = nb === m ? m.rot : Math.atan2(-(nb.z - m.z), nb.x - m.x);
          if (i % 2) rot += Math.PI;
          const wariant = grab ? variants[u01(m.name + "#h") < 0.5 ? 0 : 1] : variants[2];
          out.push({ name: m.name, wariant, x: m.x, y: m.y, z: m.z, rot, sx: 1, sy: m.scale, sz: 1 });
        });
      }
      continue;
    }
    if (rule.podszyt) continue; // PODSZYT: osobna pętla niżej
    const cell = rule.plamy_m ?? 0;
    for (const m of ms) {
      let typ;
      if (rule.typy.length === 1) typ = rule.typy[0];
      else if (cell && u01(m.name + "#mix") >= (rule.domieszka ?? 0)) {
        typ = pickWeighted(rule.typy, u01(`${prefix}:${Math.floor(m.x / cell)}:${Math.floor(m.z / cell)}`));
      } else typ = pickWeighted(rule.typy, u01(m.name + "#t"));
      const w = typ.warianty;
      const wariant = w[Math.min(w.length - 1, Math.floor(u01(m.name + "#v") * w.length))];
      const k = typ.skala[0] + (typ.skala[1] - typ.skala[0]) * u01(m.name + "#s");
      const s = m.scale * k;
      out.push({ name: m.name, wariant, x: m.x, y: m.y, z: m.z, rot: m.rot, sx: s, sy: s, sz: s });
    }
  }
  // PODSZYT: 2-3 niskie kępy trawy łąkowej przy każdym znaczniku TRAWA / BYLINA (pas zwiera się w łąkę)
  const pod = map.prefiksy.PODSZYT;
  if (pod && !pod.pomin) {
    const typ = pod.typy[0];
    for (const [prefix, ms] of byPrefix) {
      if (!pod.pod.includes(prefix)) continue;
      for (const m of ms) {
        const n = (pod.min ?? 1) + (u01(m.name + "#p") < (pod.p_dodatkowej ?? 0.5) ? 1 : 0);
        for (let k = 0; k < n; k++) {
          const a = 2 * Math.PI * u01(m.name + "#pa" + k);
          const r = pod.odleglosc_m[0] + (pod.odleglosc_m[1] - pod.odleglosc_m[0]) * u01(m.name + "#pr" + k);
          const w = typ.warianty;
          const wariant = w[Math.min(w.length - 1, Math.floor(u01(m.name + "#pv" + k) * w.length))];
          const s = typ.skala[0] + (typ.skala[1] - typ.skala[0]) * u01(m.name + "#ps" + k);
          out.push({ name: `${m.name}#podszyt${k}`, wariant, x: m.x + Math.cos(a) * r, y: m.y, z: m.z + Math.sin(a) * r,
            rot: 2 * Math.PI * u01(m.name + "#po" + k), sx: s, sy: s, sz: s });
        }
      }
    }
  }
  return out;
}
