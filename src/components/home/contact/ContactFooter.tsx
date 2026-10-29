import { FOOTER_LINKS } from "@/content/home";
import { CONTACT, CTA, whatsappHref } from "@/lib/contact";
import { BrandGlyph, PhoneIcon, WhatsAppIcon } from "@/components/ui/icons";
import { Highlight, SplitTitle } from "@/components/ui/SplitTitle";
import dusk from "@/assets/sections/dusk.jpg";
import { LeadForm } from "@/components/contact/LeadForm";
import { HouseMark, SectionBg } from "../sections/SectionFrame";

/** KONTAKT + stopka: a light call card over the estate at dusk, the footer on cream. */
export function ContactFooter() {
  return (
    <footer className="contact" id="kontakt" data-nav="contact">
      <SectionBg src={dusk} position="50% 70%" wash="dusk" />

      <div className="contact__card sec__card">
        <div className="contact__lede">
          <HouseMark />
          <SplitTitle className="contact__title">
            Zobacz dom na żywo. <Highlight>Umów prywatną wizytę.</Highlight>
          </SplitTitle>
          <p className="contact__text reveal">
            Doradca {CONTACT.developer} oprowadzi Cię po osiedlu albo pokaże dom online.
          </p>
          <p className="contact__addr reveal">Biuro sprzedaży: {CONTACT.salesOffice}</p>
        </div>
        <div className="contact__actions" data-stagger="">
          <a className="contact__button reveal" href={CONTACT.phoneHref} aria-label={`${CTA.call}: ${CONTACT.phone}`}>
            <PhoneIcon className="contact__icon" />
            <span>{CONTACT.phone.replace(/ /g, " ")}</span>
          </a>
          <a
            className="contact__button contact__button--line reveal"
            href={whatsappHref()}
            target="_blank"
            rel="noopener"
            data-cta="contact-whatsapp"
          >
            <WhatsAppIcon className="contact__icon" />
            <span>{CTA.whatsapp}</span>
          </a>
        </div>
        <LeadForm source="home-contact" tone="light" className="contact__form reveal" />
      </div>

      <div className="contact__bar">
        <div className="contact__row reveal">
          <a className="contact__brand" href="#top">
            <BrandGlyph className="contact__glyph" />
            <span className="contact__logotype">Halo Wawer</span>
          </a>
          <nav className="contact__nav" aria-label="Stopka">
            <ul>
              {FOOTER_LINKS.map((l) => (
                <li key={l.href}>
                  <a href={l.href}>{l.label}</a>
                </li>
              ))}
            </ul>
          </nav>
          <p className="contact__places">
            Senn Development II Sp. z o.o.
            <br />
            ul. Kacza 9 lok. 35, 01-013 Warszawa
          </p>
        </div>
        <div className="contact__legal reveal">
          <p>© 2026 {CONTACT.developer}</p>
          <p>Informacje na stronie nie stanowią oferty handlowej w rozumieniu art. 66 § 1 Kodeksu cywilnego.</p>
        </div>
      </div>
    </footer>
  );
}
