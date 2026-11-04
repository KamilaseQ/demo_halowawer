// Interaction probe for /domy, driven through the UI, real GPU (system Chrome, headless). Reports main-thread
// long tasks and dropped frames (vsync on: a frame over 25 ms is a drop) for: load until the loader hides,
// orbit, three style switches, three times of day, opening each storey (dollhouse), entering the walk and
// looking around, and the estate overview orbit. Optional CPU throttling (the client's acceptance test: 4×).
// Usage: node interactions.mjs <origin, e.g. http://localhost:3142> <out.json> [house=a] [cpuRate=1]
// Compare runs only from the same machine and window, ideally on a production build (next build + start).
import { chromium } from "playwright-core";
import fs from "node:fs";

const [, , origin, out, house = "a", cpu = "1"] = process.argv;
const W = 1600;
const H = 900;
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--no-proxy-server"],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
page.on("crash", () => errors.push("CRASH"));
await page.addInitScript(() => {
  window.__long = [];
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push({ t: e.startTime, d: Math.round(e.duration) }))).observe({ type: "longtask", buffered: true });
  // Frame recorder (vsync-paced rAF).
  window.__frames = [];
  let last = 0;
  const loop = (t) => {
    if (last) window.__frames.push({ t, d: t - last });
    last = t;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
});

const mark = () => page.evaluate(() => performance.now());
const phase = async (from) =>
  page.evaluate((from) => {
    const long = window.__long.filter((l) => l.t >= from).map((l) => l.d);
    const frames = window.__frames.filter((f) => f.t >= from).map((f) => f.d);
    return {
      longN: long.length,
      longSum: long.reduce((a, b) => a + b, 0),
      longMax: Math.max(0, ...long),
      frames: frames.length,
      dropped: frames.filter((d) => d > 25).length,
      worstFrame: Math.round(Math.max(0, ...frames)),
    };
  }, from);

const ready = () => page.waitForFunction(() => window.__explorer?.getState().ready ?? !!document.querySelector("[role=status][data-hidden]"), null, { timeout: 180000, polling: 50 });
const settled = () => page.waitForFunction(() => window.__explorer ? window.__explorer.getState().settled && !window.__explorer.getState().dissolve : true, null, { timeout: 30000, polling: 30 });

async function drag(x, y, dx, dy, steps = 100) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 0; i < steps; i++) {
    await page.mouse.move(x + dx * (i + 1), y + dy * (i + 1) + Math.sin(i / 6) * 12);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(1200);
}

const result = { house, cpuRate: +cpu };
const t0 = Date.now();
await page.goto(`${origin}/domy/${house}`, { waitUntil: "domcontentloaded" });
await ready();
result.revealMs = Date.now() - t0;
await page.waitForTimeout(2500);
result.load = await phase(0);

if (+cpu > 1) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: +cpu });
}

let t = await mark();
await drag(W * 0.62, H * 0.5, 7, 0);
result.orbit = await phase(t);

for (const name of ["Japandi", "Grafitowa", "Jasna skandynawska"]) {
  await page.waitForTimeout(1500);
  t = await mark();
  const c0 = Date.now();
  await page.click(`button[aria-label="${name}"]`);
  await page.waitForTimeout(100);
  await settled();
  result[`style:${name}`] = { ms: Date.now() - c0, ...(await phase(t)) };
}

for (const time of ["Noc", "Rano", "Dzień"]) {
  t = await mark();
  await page.click(`button:has-text('${time}')`);
  await page.waitForTimeout(2500);
  result[`time:${time}`] = await phase(t);
}

for (const level of ["Piętro", "Parter", "Cały dom"]) {
  t = await mark();
  await page.click(`button[aria-label="${level}"]`);
  await page.waitForTimeout(2500);
  result[`level:${level}`] = await phase(t);
}

t = await mark();
await page.click("text=Spacer");
await page.waitForTimeout(2500);
result.enterWalk = await phase(t);
t = await mark();
await drag(W * 0.5, H * 0.45, -5, 0);
result.walkLook = await phase(t);

result.errors = errors;
fs.writeFileSync(out, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 1));
await browser.close();
