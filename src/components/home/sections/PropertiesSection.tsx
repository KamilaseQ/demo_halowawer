import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { FEATURED_HOUSES } from "@/content/home";
import { NB, STATUS_LABEL, formatAreaShort, formatPrice, getHouse, type House, type HouseId } from "@/lib/estate";
import { ArrowIcon } from "@/components/ui/icons";
import { Highlight, SplitTitle } from "@/components/ui/SplitTitle";
import domA from "@/assets/houses/dom-a.jpg";
import domB from "@/assets/houses/dom-b.jpg";
import domE from "@/assets/houses/dom-e.jpg";
import sky from "@/assets/sections/sky.jpg";
import { SectionBg } from "./SectionFrame";

const PHOTOS: Partial<Record<HouseId, { src: StaticImageData; alt: string }>> = {
  A: { src: domA, alt: "Dom A, bliźniak od frontu" },
  B: { src: domB, alt: "Dom B, strona ogrodowa z tarasem" },
  E: { src: domE, alt: "Dom E, szeregówka w zabudowie" },
};

const m2 = (v: number) => `${Math.round(v)}${NB}m²`;

/** "Bliźniak z garażem" / "Szeregówka" */
const kind = (h: House) => (h.kind === "semi-detached" ? "Bliźniak z garażem" : "Szeregówka");

/** 119,5 m² · 5 pokoi · ogród 99 m² · garaż + miejsce */
function chips(h: House) {
  return [
    formatAreaShort(h.houseArea),
    `${h.rooms}${NB}pokoi`,
    `ogród ${m2(h.gardenArea)}`,
    h.kind === "semi-detached" ? "garaż + miejsce" : "2 miejsca postojowe",
  ];
}

/** DOMY */
export function PropertiesSection() {
  return (
    <section className="properties" id="domy" data-nav="properties" aria-labelledby="properties-title">
      <SectionBg src={sky} position="50% 62%" />
      <div className="sec__head">
        <SplitTitle className="sec__title" id="properties-title">
          Siedem domów. <Highlight>Dwa układy.</Highlight>
        </SplitTitle>
        <p className="sec__lead reveal">
          Bliźniaki 120&nbsp;m² z garażem i szeregówki 100&nbsp;m², każdy z poddaszem do 50&nbsp;m² i ogrodem od południa. Pięć
          wciąż dostępnych.
        </p>
      </div>

      <div className="properties__grid" data-stagger="">
        {FEATURED_HOUSES.map((id) => {
          const h = getHouse(id);
          const photo = PHOTOS[id];
          if (!h || !photo) return null;
          return (
            <article className="property sec__card reveal" key={id}>
              <div className="property__media reveal-img">
                <Image className="property__photo" src={photo.src} alt={photo.alt} sizes="(max-width: 760px) 90vw, 30vw" />
                {h.status === "available" && <span className="pill pill--ok">{STATUS_LABEL[h.status]}</span>}
              </div>
              <div className="property__body">
                <div className="property__row">
                  <h3 className="property__title">Dom {h.id}</h3>
                  {h.price !== null && <p className="property__price">{formatPrice(h.price)}</p>}
                </div>
                <p className="property__kind">{kind(h)}</p>
                <ul className="chips">
                  {chips(h).map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                <Link className="property__more" href={`/domy/${h.slug}`} prefetch={false} data-cta="property-details">
                  Szczegóły domu w 3D
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M3 8h10M9 4l4 4-4 4" />
                  </svg>
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      <div className="sec__actions sec__actions--center">
        <Link className="sec__link reveal" href="/domy" prefetch={false} data-cta="properties-offer">
          <span>Pełna oferta i ceny</span>
          <ArrowIcon />
        </Link>
      </div>
    </section>
  );
}
