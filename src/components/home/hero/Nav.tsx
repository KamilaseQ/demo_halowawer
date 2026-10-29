"use client";

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { NAV_LINKS } from "@/content/home";
import { CONTACT, CTA } from "@/lib/contact";
import { activeNav } from "@/lib/nav";
import { ArrowIcon, BrandGlyph, PhoneIcon } from "@/components/ui/icons";

const noop = () => () => {};

/**
 * The hero nav. Desktop: links and the CTA float on the sky (unchanged).
 * Phones (CSS, max 760 px): the logotype, a call button and "Menu", which
 * opens a full-screen sheet with the links and the CTA.
 */
export function Nav() {
  const active = activeNav.use();
  const [open, setOpen] = useState(false);
  // the sheet portals into <body>, which exists only in the browser
  const mounted = useSyncExternalStore(noop, () => true, () => false);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.classList.add("menu-open");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      root.classList.remove("menu-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <nav className="nav" aria-label="Główna nawigacja">
      <a className="nav__brand" href="#top" aria-label="Halo Wawer, strona główna">
        <BrandGlyph className="nav__glyph" door />
        <span className="nav__logotype">Halo Wawer</span>
      </a>
      <ul className="nav__links">
        {NAV_LINKS.map((link) => (
          <li key={link.key}>
            <a
              href={link.href}
              className={link.key === active ? "is-active" : undefined}
              aria-current={link.key === active ? "page" : undefined}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
      <a className="nav__cta" href="#kontakt" data-cta="nav">
        <span>{CTA.visit}</span>
        <ArrowIcon />
      </a>

      {/* phones */}
      <div className="nav__tools">
        <a className="nav__icon" href={CONTACT.phoneHref} aria-label={`${CTA.call}: ${CONTACT.phone}`} data-cta="nav-call">
          <PhoneIcon />
        </a>
        <button className="nav__menu" type="button" aria-expanded={open} aria-controls="site-menu" onClick={() => setOpen(true)}>
          <span className="nav__burger" aria-hidden="true" />
          Menu
        </button>
      </div>

      {mounted &&
        createPortal(
          <div id="site-menu" className={`menu${open ? " is-open" : ""}`} role="dialog" aria-modal="true" aria-label="Menu" inert={!open}>
            <button className="menu__close" type="button" onClick={() => setOpen(false)} aria-label="Zamknij menu">
              <span aria-hidden="true" />
            </button>
            <ul className="menu__links">
              {NAV_LINKS.map((link, i) => (
                <li key={link.key} style={{ "--i": i } as CSSProperties}>
                  <a href={link.href} onClick={() => setOpen(false)} aria-current={link.key === active ? "page" : undefined}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="menu__actions">
              <a className="menu__cta" href="#kontakt" data-cta="menu" onClick={() => setOpen(false)}>
                <span>{CTA.visit}</span>
                <ArrowIcon />
              </a>
              <a className="menu__phone" href={CONTACT.phoneHref} data-cta="menu-call">
                {CONTACT.phone.replace(/ /g, " ")}
              </a>
            </div>
          </div>,
          document.body,
        )}
    </nav>
  );
}
