"use client";

import { useEffect, useRef } from "react";
import { CONTACT, CTA, whatsappHref } from "@/lib/contact";
import { watchFilmBottom } from "@/lib/film-bounds";
import { leadContext } from "@/lib/lead";
import { PhoneIcon, WhatsAppIcon } from "@/components/ui/icons";

/** Shown once the first frame's copy has faded (the hero card sits in that corner). */
const AFTER_HERO = 0.3; // of the window height

/**
 * Floating gold WhatsApp button (desktop, once the first frame's copy has
 * faded) and the sticky [Zadzwoń] [WhatsApp] bar (phones, once the film has
 * played). The message names the house the visitor looked at last.
 * Visibility is toggled on the elements directly: no re-render per scroll.
 */
export function QuickContact() {
  const { house } = leadContext.use();
  const fab = useRef<HTMLAnchorElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const wa = whatsappHref({ house });

  useEffect(() => {
    const contact = document.getElementById("kontakt");
    let contactInView = false;
    let raf = 0;

    function update() {
      raf = 0;
      const past = window.scrollY > window.innerHeight * AFTER_HERO;
      // the phone bar would cover the chapters' copy: it waits until the whole film has played
      const afterFilm = film.bottom - window.scrollY <= window.innerHeight;
      fab.current?.classList.toggle("is-visible", past);
      bar.current?.classList.toggle("is-visible", afterFilm && !contactInView);
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const film = watchFilmBottom(onScroll);

    const io = new IntersectionObserver(([entry]) => {
      contactInView = entry.isIntersecting;
      update();
    });
    if (contact) io.observe(contact);

    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      io.disconnect();
      film.dispose();
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <a ref={fab} className="wa-fab" href={wa} target="_blank" rel="noopener" aria-label={CTA.whatsapp} data-cta="fab-whatsapp">
        <WhatsAppIcon />
        <span className="wa-fab__label" aria-hidden="true">
          {CTA.whatsapp}
        </span>
      </a>

      <div ref={bar} className="mbar" role="region" aria-label="Szybki kontakt">
        <a className="contact__button" href={CONTACT.phoneHref} data-cta="bar-call">
          <PhoneIcon />
          <span>{CTA.call}</span>
        </a>
        <a className="contact__button contact__button--line" href={wa} target="_blank" rel="noopener" data-cta="bar-whatsapp">
          <WhatsAppIcon />
          <span>WhatsApp</span>
        </a>
      </div>
    </>
  );
}
