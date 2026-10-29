import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SITE_NAME, siteUrl } from "@/lib/site";
import { inter, jakarta } from "./fonts";
import "@/styles/base.css";

/* og:image comes from app/opengraph-image.jpg (1200x630, < 300 KB for WhatsApp previews);
   metadataBase turns it, and every relative URL below, into an absolute one. */
export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: SITE_NAME,
  description: "Osiedle Halo Wawer: siedem nowoczesnych domów w zielonym Wawrze, 26 minut do centrum Warszawy.",
  openGraph: {
    title: SITE_NAME,
    description: "Siedem nowoczesnych domów w zielonym Wawrze. Prywatne ogrody od południa, własny garaż i 26 minut do centrum Warszawy.",
    siteName: SITE_NAME,
    locale: "pl_PL",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f3eee8",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl" className={`${jakarta.variable} ${inter.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
