/**
 * Analytics events of the sales funnel. One entry point: wire a real
 * provider (GA4 / GTM dataLayer, Vercel Analytics, Meta pixel) here only.
 */
export type TrackEvent = "cta_click" | "tel_click" | "whatsapp_click" | "lead_submit";

type Params = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export function track(event: TrackEvent, params: Params = {}) {
  if (typeof window === "undefined") return;
  window.dataLayer?.push({ event, ...params });
  if (process.env.NODE_ENV !== "production") console.debug("[track]", event, params);
}
