import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { RouteState } from "@/components/explorer/explorer/RouteState";
import { HouseList } from "@/components/explorer/panel/HouseList";
import { getHouse } from "@/lib/estate";

const TITLE = "Domy w 3D · Halo Wawer";
const DESCRIPTION =
  "Osiedle Halo Wawer w interaktywnym 3D: wybierz dom, obejrzyj go z każdej strony, otwórz piętra i przejdź się po wnętrzu w trzech stylach i o każdej porze dnia.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    // 1200×630 under 300 KB: WhatsApp skips larger previews.
    images: [{ url: "/explorer/og/osiedle.jpg", width: 1200, height: 630, alt: "Osiedle Halo Wawer z lotu ptaka" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function HousesPage({ searchParams }: Props) {
  const params = await searchParams;
  // Home page links use /domy?dom=B&widok=…: the canonical address is /domy/b?widok=….
  const dom = typeof params.dom === "string" ? getHouse(params.dom) : undefined;
  if (dom) {
    const rest = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (k !== "dom" && typeof v === "string") rest.set(k, v);
    const q = rest.toString();
    permanentRedirect(`/domy/${dom.slug}${q ? `?${q}` : ""}`);
  }
  return (
    <>
      <Suspense fallback={null}>
        <RouteState />
      </Suspense>
      <HouseList />
    </>
  );
}
