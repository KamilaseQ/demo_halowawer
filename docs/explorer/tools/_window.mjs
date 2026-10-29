// Longest trace events (any process/thread) inside a time window [from, to] seconds of a saved trace. Scratch tool.
import fs from "node:fs";
const [, , file, from, to, min = "20"] = process.argv;
const t = JSON.parse(fs.readFileSync(file, "utf8"));
const ev = t.traceEvents ?? t;
const th = new Map(), pr = new Map();
for (const e of ev) { if (e.ph === "M" && e.name === "thread_name") th.set(`${e.pid}:${e.tid}`, e.args.name); if (e.ph === "M" && e.name === "process_name") pr.set(e.pid, e.args.name); }
let tmin = Infinity; for (const e of ev) if (e.ph === "X" && e.ts && e.ts < tmin) tmin = e.ts;
const agg = new Map();
for (const e of ev) {
  if (e.ph !== "X" || !e.dur) continue;
  const s = (e.ts - tmin) / 1e6;
  if (s < +from || s > +to) continue;
  if (/^(RunTask|ThreadControllerImpl::RunTask|Scheduler::RunTask|ThreadPool_RunTask|RunWorkerTask)$/.test(e.name)) continue;
  const k = `${(pr.get(e.pid) ?? "?").slice(0, 10)}/${th.get(`${e.pid}:${e.tid}`) ?? "?"} ${e.name}`;
  const a = agg.get(k) ?? { n: 0, d: 0 }; a.n++; a.d += e.dur; agg.set(k, a);
}
for (const [k, a] of [...agg].filter(([, a]) => a.d / 1000 >= +min).sort((x, y) => y[1].d - x[1].d).slice(0, 30)) console.log(`${(a.d / 1000).toFixed(0).padStart(7)}ms ${String(a.n).padStart(5)}× ${k}`);
