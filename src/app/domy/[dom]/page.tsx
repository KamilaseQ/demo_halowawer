import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RouteState } from "@/components/explorer/explorer/RouteState";
import { HousePanel } from "@/components/explorer/panel/HousePanel";
import { formatArea, formatPrice, getHouse, houses, kindLabel, STATUS_LABEL } from "@/lib/estate";

type Props = { params: Promise<{ dom: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return houses.map((h) => ({ dom: h.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const h = getHouse((await params).dom);
  if (!h) return {};
  const price = h.price ? `${formatPrice(h.price)} · ` : `${STATUS_LABEL[h.status]} · `;
  const title = `Dom ${h.id} · ${formatArea(h.houseArea)} z ogrodem ${formatArea(h.gardenArea)} · Halo Wawer`;
  const description = `${kindLabel(h)} ${h.id} w Halo Wawer: ${price}${h.rooms} pokoi, ${h.parking}. Model 3D, spacer po wnętrzu w trzech stylach, rzuty i historia cen.`;
  // Link preview: the house in 3D from its garden (1200×630, under 300 KB so WhatsApp shows it;
  // docs/explorer/tools/og.mjs renders them). openGraph here replaces the parent's, images included.
  const image = { url: `/explorer/og/dom-${h.id.toLowerCase()}.jpg`, width: 1200, height: 630, alt: `Dom ${h.id} w Halo Wawer, widok od ogrodu` };
  return {
    title,
    description,
    openGraph: { title, description, type: "website", images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

export default async function HousePage({ params }: Props) {
  const { dom } = await params;
  const house = getHouse(dom);
  if (!house) notFound();

  return (
    <>
      <Suspense fallback={null}>
        <RouteState house={house.id} />
      </Suspense>
      <HousePanel house={house} />
    </>
  );
}
