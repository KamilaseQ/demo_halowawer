// Screenshot the configurator with real GPU WebGL (system Chrome, headless).
// Usage: node shot.mjs <url> <out.png> [width=1600] [height=900] [waitMs=5000] [js to run after ready] [js2] ...
// Each extra JS step runs after the previous one, followed by waitMs. Example:
//   node shot.mjs "http://localhost:3142/domy/a" walk.png 1600 900 4000 "__explorer.setState({mode:'walk'})"
import { chromium } from "playwright-core";

const [, , url, out, w = "1600", h = "900", wait = "5000", ...steps] = process.argv;
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--no-proxy-server", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const logs = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`);
});
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message.slice(0, 300)}`));

const t0 = Date.now();
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180000 });
await page
  .waitForFunction(() => window.__explorer?.getState().ready, null, { timeout: 180000, polling: 250 })
  .catch(() => logs.push("!! stage never became ready"));
logs.push(`ready after ${Date.now() - t0} ms`);
await page.waitForTimeout(+wait);
for (const js of steps) {
  await page.evaluate(js).catch((e) => logs.push(`[eval] ${e.message}`));
  await page.waitForTimeout(+wait);
}
await page.screenshot({ path: out });
const renderer = await page.evaluate(() => {
  const gl = document.createElement("canvas").getContext("webgl2");
  const ext = gl && gl.getExtension("WEBGL_debug_renderer_info");
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unknown";
});
console.log(`renderer: ${renderer}\n${logs.slice(0, 40).join("\n")}`);
await browser.close();
