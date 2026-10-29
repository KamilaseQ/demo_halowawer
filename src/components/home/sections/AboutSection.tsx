import Image from "next/image";
import { ABOUT_FEATURES, ABOUT_STATS } from "@/content/home";
import { CTA } from "@/lib/contact";
import { Highlight, SplitTitle } from "@/components/ui/SplitTitle";
import livingDining from "@/assets/about/living-dining.jpg";
import estateSoft from "@/assets/sections/estate-soft.jpg";
import { SectionBg } from "./SectionFrame";

/** O OSIEDLU */
export function AboutSection() {
  return (
    <section className="about" id="o-osiedlu" data-nav="about" aria-labelledby="about-title">
      <SectionBg src={estateSoft} position="40% 30%" wash="strong" />
      <div className="sec__head">
        <SplitTitle className="sec__title" id="about-title">
          Kameralnie, jasno <Highlight>i od południa.</Highlight>
        </SplitTitle>
        <p className="sec__lead reveal">Tylko siedem domów przy ulicy Borków, projektowanych z myślą o codziennym komforcie.</p>
      </div>

      <div className="sec__card split-card">
        <div className="split-card__photo reveal-img">
          <Image src={livingDining} alt="Salon z jadalnią i wyjściem na taras" fill sizes="(max-width: 1000px) 90vw, 42vw" />
        </div>
        <div className="split-card__body" data-stagger="">
          <ul className="features">
            {ABOUT_FEATURES.map(([lead, rest]) => (
              <li className="reveal" key={lead}>
                <b>{lead}</b> {rest}
              </li>
            ))}
          </ul>
          <dl className="about__stats reveal">
            {ABOUT_STATS.map((s) => (
              <div className="stat" key={s.label}>
                <dt className="stat__value">{s.value}</dt>
                <dd className="stat__label">{s.label}</dd>
              </div>
            ))}
          </dl>
          <a className="button-gold reveal" href="#kontakt" data-cta="about-visit">
            {CTA.visitOnSite}
          </a>
        </div>
      </div>
    </section>
  );
}
