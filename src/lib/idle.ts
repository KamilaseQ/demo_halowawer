/** Anything that means "the visitor is moving the page right now". */
const ACTIVITY = ["scroll", "wheel", "touchstart", "touchmove", "pointerdown"] as const;

/**
 * Runs `cb` once the page is calm: no scroll, wheel or touch for `quiet` ms,
 * then an idle period. Any new activity before it runs postpones it.
 * Heavy main-thread work (the configurator's first paint, the 3D scene's
 * code) never lands in the middle of a scroll.
 */
export function whenCalm(cb: () => void, { quiet = 400, signal }: { quiet?: number; signal?: AbortSignal } = {}) {
  let timer = 0;
  let idleId = 0;
  const hasIdle = typeof window.requestIdleCallback === "function";
  const cancelIdle = () => {
    if (!idleId) return;
    if (hasIdle) window.cancelIdleCallback(idleId);
    else window.clearTimeout(idleId);
    idleId = 0;
  };

  function arm() {
    window.clearTimeout(timer);
    cancelIdle();
    timer = window.setTimeout(() => {
      const run = () => {
        idleId = 0;
        stop();
        cb();
      };
      idleId = hasIdle ? window.requestIdleCallback(run, { timeout: 2000 }) : window.setTimeout(run, 50);
    }, quiet);
  }

  function stop() {
    for (const type of ACTIVITY) window.removeEventListener(type, arm);
    window.clearTimeout(timer);
    cancelIdle();
  }

  for (const type of ACTIVITY) window.addEventListener(type, arm, { passive: true });
  signal?.addEventListener("abort", stop, { once: true });
  arm();
  return stop;
}
