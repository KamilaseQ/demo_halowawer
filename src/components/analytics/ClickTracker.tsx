"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

/**
 * One delegated listener for the funnel's clicks, so server components can
 * stay plain markup: tel: links -> tel_click, wa.me links -> whatsapp_click,
 * anything with data-cta -> cta_click (with the data-cta value as `cta`).
 */
export function ClickTracker() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const a = (e.target as Element | null)?.closest<HTMLElement>("a, button");
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      const cta = a.dataset.cta;
      if (href.startsWith("tel:")) track("tel_click", { cta });
      else if (href.includes("wa.me/")) track("whatsapp_click", { cta });
      else if (cta) track("cta_click", { cta, href });
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
