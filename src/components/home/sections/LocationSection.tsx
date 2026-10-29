import Image from "next/image";
import { DISTANCES, type DistanceIcon } from "@/content/home";
import { CTA } from "@/lib/contact";
import { Highlight, SplitTitle } from "@/components/ui/SplitTitle";
import gardens from "@/assets/location/gardens.jpg";
import forest from "@/assets/sections/forest.jpg";
import { SectionBg } from "./SectionFrame";

const ICONS: Record<DistanceIcon, string> = {
  shop: "M5 8h14l-1.2 11.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8L5 8zM9 8V6.5a3 3 0 0 1 6 0V8",
  bus: "M6 4h12a2 2 0 0 1 2 2v10H4V6a2 2 0 0 1 2-2zM4 11h16M7.5 19.5v-3.5M16.5 19.5v-3.5M7.5 14h.01M16.5 14h.01",
  cart: "M3 4h2.5l2.2 10.5h10.6L20.5 7H7M9.5 19.5h.01M17 19.5h.01",
  nursery: "M4 11h13a6.5 6.5 0 0 1-13 0zM17 11V6.5A2.5 2.5 0 0 1 19.5 4H21M8 20.5h.01M14 20.5h.01",
  clinic: "M12 4v16M4 12h16",
  school: "M3 9l9-5 9 5-9 5-9-5zM7 11.5V16c0 1.5 2.2 3 5 3s5-1.5 5-3v-4.5",
};

/** LOKALIZACJA */
export function LocationSection() {
  return (
    <section className="location" id="lokalizacja" data-nav="location" aria-labelledby="location-title">
      <SectionBg src={forest} position="50% 46%" />
      <div className="sec__head">
        <SplitTitle className="sec__title" id="location-title">
          Zielony Wawer, <Highlight>26 minut do centrum.</Highlight>
        </SplitTitle>
        <p className="sec__lead reveal">
          ul. Borków 24B, Warszawa Wawer. Lasy i ścieżki rowerowe za płotem, a codzienne sprawy na piechotę.
        </p>
      </div>

      <div className="sec__card split-card split-card--rev">
        <div className="split-card__body" data-stagger="">
          <ul className="distances">
            {DISTANCES.map(({ place, distance, icon }) => (
              <li className="reveal" key={place}>
                <span className="distances__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d={ICONS[icon]} />
                  </svg>
                </span>
                <span>{place}</span>
                <b>{distance}</b>
              </li>
            ))}
          </ul>
          <p className="location__note reveal">
            <span className="pill pill--gold">26&nbsp;min</span> samochodem do centrum Warszawy
          </p>
          <a className="button-gold reveal" href="#kontakt" data-cta="location-visit">
            {CTA.visitOnSite}
          </a>
        </div>
        <div className="split-card__photo reveal-img">
          <Image src={gardens} alt="Domy od strony ogrodów w popołudniowym słońcu" fill sizes="(max-width: 1000px) 90vw, 45vw" />
        </div>
      </div>
    </section>
  );
}
