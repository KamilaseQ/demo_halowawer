import { Highlight, SplitTitle } from "@/components/ui/SplitTitle";
import sky from "@/assets/sections/sky.jpg";
import { HouseMark, SectionBg } from "../sections/SectionFrame";
import { KreatorActions } from "./KreatorActions";
import { KreatorFrame } from "./KreatorFrame";

/** KREATOR WNĘTRZ */
export function KreatorSection() {
  return (
    <section className="kreator" id="kreator" data-nav="properties" aria-labelledby="kreator-title">
      <SectionBg src={sky} position="82% 40%" />
      <div className="sec__head">
        <HouseMark />
        <SplitTitle className="sec__title" id="kreator-title">
          {/* the configurator shows house A (KREATOR_HOUSE) */}
          Urządź dom A <Highlight>po swojemu.</Highlight>
        </SplitTitle>
        <p className="sec__lead reveal">
          Wybierz pomieszczenie na rzucie z lotu ptaka, wejdź do środka i sprawdź sześć aranżacji, kolor ścian i podłogę.
        </p>
      </div>
      <div className="sec__card kreator__card">
        <KreatorFrame />
      </div>
      <KreatorActions />
    </section>
  );
}
