import type { Metadata } from "next";
import { ClickTracker } from "@/components/analytics/ClickTracker";
import { ContactFooter } from "@/components/home/contact/ContactFooter";
import { QuickContact } from "@/components/home/contact/QuickContact";
import { EstateTeaser } from "@/components/home/estate/EstateTeaser";
import { Chapters } from "@/components/home/hero/Chapters";
import { HeroStill } from "@/components/home/hero/HeroStill";
import { Nav } from "@/components/home/hero/Nav";
import { Preloader } from "@/components/home/hero/Preloader";
import { ScrollFilm } from "@/components/home/hero/ScrollFilm";
import { KreatorSection } from "@/components/home/kreator/KreatorSection";
import { AboutSection } from "@/components/home/sections/AboutSection";
import { InteriorsSection } from "@/components/home/sections/InteriorsSection";
import { LocationSection } from "@/components/home/sections/LocationSection";
import { PropertiesSection } from "@/components/home/sections/PropertiesSection";
import { WarmUp } from "@/components/home/WarmUp";
import { PrerenderSections } from "@/components/motion/PrerenderSections";
import { RevealObserver } from "@/components/motion/RevealObserver";
import { SectionNavObserver } from "@/components/motion/SectionNavObserver";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import "@/styles/home/index.css";

// only the canonical here: a page-level openGraph would replace the layout's whole object
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/** Content sections in page order. */
const SECTIONS = [EstateTeaser, KreatorSection, PropertiesSection, AboutSection, InteriorsSection, LocationSection];

export default function HomePage() {
  return (
    <>
      <Preloader />

      <main className="home">
        <ScrollFilm still={<HeroStill />} nav={<Nav />} chapters={<Chapters />} />
        {SECTIONS.map((Section, i) => (
          <Section key={i} />
        ))}
      </main>
      <ContactFooter />

      <QuickContact />

      {/* behaviour only, no markup */}
      <PrerenderSections />
      <RevealObserver />
      <SectionNavObserver />
      <SmoothScroll />
      <ClickTracker />
      <WarmUp />
    </>
  );
}
