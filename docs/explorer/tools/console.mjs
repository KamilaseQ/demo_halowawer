// Console check across routes and viewports, with the main interactions (panel roll-up, plan, walk, lead sheet).
// Usage: node console.mjs [base=http://localhost:3142] (works on dev and on a production build: ?debug=1)   → prints every console error/warning and page error.
import { chromium } from "playwright-core";

const [, , base = "http://localhost:3142"] = process.argv;
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
const ROUTES = ["/domy", "/domy/a"];
// Shader compiler notes from ANGLE (D3D) are driver chatter, not app errors.
const NOISE = /X3595|X4122|THREE\.Clock|Program Info Log/;

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"],
});
let total = 0;
for (const [vp, size] of Object.entries(VIEWPORTS)) {
  for (const route of ROUTES) {
    const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
    const out = [];
    page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && !NOISE.test(m.text()) && out.push(`[${m.type()}] ${m.text().slice(0, 240)}`));
    page.on("pageerror", (e) => out.push(`[pageerror] ${e.message.slice(0, 240)}`));
    await page.goto(base + route + "?debug=1", { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.waitForFunction(() => (window.__explorer ?? window.__probe?.state)?.getState().ready, null, { timeout: 180000, polling: 250 }).catch(() => out.push("!! never ready"));
    await page.waitForTimeout(2500);
    const step = async (js, wait = 1800) => {
      await page.evaluate(js).catch((e) => out.push(`[eval] ${e.message.slice(0, 160)}`));
      await page.waitForTimeout(wait);
    };
    await step(`document.querySelector('[data-panel-toggle]')?.click()`);
    await step(`document.querySelector('#explorer-panel ~ button')?.click()`);
    if (route !== "/domy") {
      await step(`(window.__explorer ?? window.__probe.state).getState().setMode('plan')`);
      await step(`(window.__explorer ?? window.__probe.state).getState().setMode('walk')`, 4000);
      await step(`(window.__explorer ?? window.__probe.state).getState().setMode('model')`, 2500);
    }
    await step(`document.querySelector('[data-cta=site-nav]')?.click()`);
    await step(`document.querySelector('dialog[open] button[aria-label=Zamknij]')?.click()`, 800);
    console.log(`${vp} ${route}: ${out.length ? "\n  " + out.join("\n  ") : "clean"}`);
    total += out.length;
    await page.close();
  }
}
await browser.close();
process.exit(total ? 1 : 0);
