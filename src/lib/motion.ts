export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** Hermite smoothstep of t between edges a and b. */
export function smoothstep(a: number, b: number, t: number) {
  const x = clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
}

/** Frame-rate independent exponential approach: `rate` is the share covered per 60 Hz frame. */
export const damp = (rate: number, dtMs: number) => 1 - Math.pow(1 - rate, dtMs / (1000 / 60));

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** No film: reduced motion (a system accessibility setting), or .is-lite after the film failed to load. */
export function isLite() {
  if (typeof document === "undefined") return false;
  return prefersReducedMotion() || document.documentElement.classList.contains("is-lite");
}

/** ?capture: text and interface hidden to grab the film's start frame (tooling). */
export function isCapture() {
  return typeof location !== "undefined" && /[?&]capture/.test(location.search);
}
