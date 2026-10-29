import { Inter, Plus_Jakarta_Sans } from "next/font/google";

/* Self-hosted at build time (no request to Google at runtime), with
   metric-matched fallbacks so the swap does not shift the layout.
   latin-ext carries the Polish letters. */

/** Interface type: everything except the hero wordmark. */
export const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  variable: "--font-jakarta",
  display: "swap",
});

/** The hero wordmark: its size and baseline behind the roofs are tuned to Inter's metrics. */
export const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});
