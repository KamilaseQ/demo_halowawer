import {
  NB,
  STATUS_LABEL,
  areaRange,
  availableHouses,
  formatAreaShort,
  formatPrice,
  formatPriceShort,
  getHouse,
  houses,
  kindLabel,
  priceFrom,
} from "@/lib/estate";
import { Highlight, SplitTitle } from "@/components/ui/SplitTitle";
import estatePhoto from "@/assets/contact/estate-dusk.jpg";
import sky from "@/assets/sections/sky.jpg";
import { SectionBg } from "../sections/SectionFrame";
import { EstateViewer, type EstatePin, type EstateSummary } from "./EstateViewer";
import { PINS, PIN_ORDER } from "./pins";

/** Explorer route; the 3D module lives in src/app/domy (owner: explorer). */
export const EXPLORER_HREF = "/domy";

/**
 * OSIEDLE W 3D: right after the film, a calm frame of the whole estate
 * with a glass label on every roof. It leads into the 3D explorer.
 */
export function EstateTeaser() {
  const pins: EstatePin[] = PIN_ORDER.map((id, i) => {
    const h = getHouse(id)!;
    const sold = h.status === "sold" || h.price === null;
    return {
      id,
      index: i,
      status: h.status,
      href: `${EXPLORER_HREF}/${h.slug}`,
      meta: sold ? STATUS_LABEL[h.status] : `${formatAreaShort(h.houseArea)} · ${formatPriceShort(h.price!)}`,
      kind: kindLabel(h),
      statusLabel: STATUS_LABEL[h.status],
      facts: `${formatAreaShort(h.houseArea)} · ${h.rooms}${NB}pokoi · ogród ${Math.round(h.gardenArea)}${NB}m²`,
      price: sold ? null : formatPrice(h.price!),
      placement: PINS[id],
    };
  });

  const summary: EstateSummary = {
    title: `${houses.length} domów, ${availableHouses.length} dostępnych`,
    facts: `Bliźniaki i szeregówki ${Math.round(areaRange[0])}–${Math.round(areaRange[1])}${NB}m² · od ${formatPriceShort(priceFrom)}`,
  };

  return (
    <section className="estate" id="osiedle-3d" data-nav="properties" aria-labelledby="estate-title">
      <SectionBg src={sky} position="50% 30%" />
      <div className="sec__head">
        <SplitTitle className="sec__title" id="estate-title">
          Wybierz swój dom <Highlight>w 3D.</Highlight>
        </SplitTitle>
        <p className="sec__lead reveal">
          Całe osiedle w jednym modelu: obejrzyj je z każdej strony, porównaj siedem domów i wejdź do środka wybranego.
        </p>
      </div>

      <EstateViewer pins={pins} summary={summary} photo={estatePhoto} explorerHref={EXPLORER_HREF} />
    </section>
  );
}
