"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { houses } from "@/lib/estate";
import { watchFilmBottom } from "@/lib/film-bounds";
import { whenCalm } from "@/lib/idle";
import { filmLoad } from "@/lib/preload";

/** Evaluating the 3D scene's code (~1.5 MB) is one long task: only after a full second without scroll or touch. */
const SCENE_QUIET = 1000;

/** <link rel="prefetch">: the browser fills its HTTP cache at idle priority, off the main thread. */
function prefetch(href: string) {
  if (document.head.querySelector(`link[rel="prefetch"][href="${CSS.escape(href)}"]`)) return;
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = href;
  document.head.appendChild(link);
}

/**
 * Warms the 3D explorer in the background, so entering it from the teaser is
 * instant, without ever costing the film a frame:
 * 1. once the hero is ready and the page is calm: the /domy route and every
 *    3D asset are prefetched (network only, lowest priority, no JS memory);
 * 2. once the film is behind the visitor and nothing has moved for a second:
 *    the 3D scene's code is loaded and evaluated (real main-thread work,
 *    measured as long tasks when it ran during the film); any scroll or touch
 *    before that postpones it. Its assets now come from cache.
 */
export function WarmUp() {
  const router = useRouter();
  const state = filmLoad.use().state;

  useEffect(() => {
    if (state === "loading") return;
    const ac = new AbortController();
    const { signal } = ac;

    whenCalm(
      () => {
        router.prefetch("/domy");
        import("@/components/explorer/preload")
          .then((explorer) => {
            if (signal.aborted) return;
            explorer.explorerAssetUrls().forEach(prefetch);

            const film = watchFilmBottom();
            signal.addEventListener("abort", () => film.dispose(), { once: true });
            const loadScene = () => {
              // the house pages the teaser and the configurator link to (their links do not prefetch on scroll)
              houses.forEach((h) => router.prefetch(`/domy/${h.slug}`));
              explorer.preloadExplorerAssets({ signal }).catch((err: unknown) => {
                if (!signal.aborted) console.warn("[warm-up] explorer preload failed", err);
              });
            };

            const filmDone = () => window.scrollY + window.innerHeight >= film.bottom;
            if (filmDone()) {
              whenCalm(loadScene, { quiet: SCENE_QUIET, signal });
              return;
            }
            const onScroll = () => {
              if (!filmDone()) return;
              window.removeEventListener("scroll", onScroll);
              whenCalm(loadScene, { quiet: SCENE_QUIET, signal });
            };
            window.addEventListener("scroll", onScroll, { passive: true, signal });
          })
          .catch((err: unknown) => {
            if (!signal.aborted) console.warn("[warm-up] explorer preload unavailable", err);
          });
      },
      { quiet: 800, signal },
    );
    return () => ac.abort();
  }, [state, router]);

  return null;
}
