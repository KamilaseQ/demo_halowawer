"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { NAV_LINKS } from "@/content/home";
import { CONTACT, CTA } from "@/lib/contact";
import type { NavKey } from "@/lib/nav";
import { ArrowIcon, BrandGlyph, PhoneIcon } from "@/components/ui/icons";
import "./site-nav.css";

/** The home page's nav items, as links that work from any route ("Domy" is the explorer). */
const LINKS = NAV_LINKS.map((l) => ({
  ...l,
  href: l.key === "home" ? "/" : l.key === "properties" ? "/domy" : `/${l.href}`,
}));

const noop = () => () => {};

export type SiteNavProps = {
  /** light: ink on white glass (light scenes); dark: ivory on dark glass. */
  tone?: "light" | "dark";
  /** Highlighted item; "properties" on the explorer. */
  active?: NavKey;
  /** Open the lead form in place (e.g. a sheet over the 3D scene). Without it the CTA goes to /#kontakt. */
  onVisit?: () => void;
  className?: string;
  style?: CSSProperties;
};

/**
 * The site's navigation for routes other than the home page: the same items
 * as the hero nav, as a floating glass bar. Phones get the logotype, a call
 * button and "Menu" (a full-screen sheet). Positioned absolutely at the top
 * of its container; inside the explorer it follows --header-top, --header-h
 * and --inset.
 */
export function SiteNav({ tone = "light", active = "properties", onVisit, className = "", style }: SiteNavProps) {
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(noop, () => true, () => false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const visit = (extra?: () => void) =>
    onVisit ? (
      <button
        type="button"
        className="site-nav__cta"
        data-cta="site-nav"
        onClick={() => {
          extra?.();
          onVisit();
        }}
      >
        <span>{CTA.visit}</span>
        <ArrowIcon />
      </button>
    ) : (
      <Link className="site-nav__cta" href="/#kontakt" data-cta="site-nav" onClick={extra}>
        <span>{CTA.visit}</span>
        <ArrowIcon />
      </Link>
    );

  return (
    <header className={`site-nav site-nav--${tone}${className ? ` ${className}` : ""}`} style={style}>
      <Link className="site-nav__brand" href="/" aria-label="Halo Wawer, strona główna">
        <BrandGlyph className="site-nav__glyph" door />
        <span>Halo Wawer</span>
      </Link>

      <nav className="site-nav__links" aria-label="Główna nawigacja">
        <ul>
          {LINKS.map((l) => (
            <li key={l.key}>
              <Link href={l.href} className={l.key === active ? "is-active" : undefined} aria-current={l.key === active ? "page" : undefined}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="site-nav__actions">
        <a className="site-nav__phone" href={CONTACT.phoneHref} aria-label={`${CTA.call}: ${CONTACT.phone}`} data-cta="site-nav-call">
          <PhoneIcon />
          <span>{CONTACT.phone.replace(/ /g, " ")}</span>
        </a>
        {visit()}
        <button className="site-nav__menu" type="button" aria-expanded={open} aria-controls="site-nav-menu" onClick={() => setOpen(true)}>
          <span className="site-nav__burger" aria-hidden="true" />
          Menu
        </button>
      </div>

      {mounted &&
        createPortal(
          <div id="site-nav-menu" className={`site-menu${open ? " is-open" : ""}`} role="dialog" aria-modal="true" aria-label="Menu" inert={!open}>
            <button className="site-menu__close" type="button" onClick={() => setOpen(false)} aria-label="Zamknij menu">
              <span aria-hidden="true" />
            </button>
            <ul className="site-menu__links">
              {LINKS.map((l, i) => (
                <li key={l.key} style={{ "--i": i } as CSSProperties}>
                  <Link href={l.href} onClick={() => setOpen(false)} aria-current={l.key === active ? "page" : undefined}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="site-menu__actions">
              {visit(() => setOpen(false))}
              <a className="site-menu__phone" href={CONTACT.phoneHref} data-cta="site-menu-call">
                {CONTACT.phone.replace(/ /g, " ")}
              </a>
            </div>
          </div>,
          document.body,
        )}
    </header>
  );
}
