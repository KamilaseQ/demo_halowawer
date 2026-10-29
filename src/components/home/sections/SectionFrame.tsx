import Image, { type StaticImageData } from "next/image";
import type { CSSProperties } from "react";

type BgProps = {
  src: StaticImageData;
  /** object-position of the crop, e.g. "50% 62%" */
  position?: string;
  /** "strong": a denser pool of light under the title (pictures with houses behind it) */
  wash?: "strong" | "dusk";
};

/**
 * The opening photograph of a section: full width behind the title, a warm
 * glow at one side, dissolving into the cream ground before the cards
 * (sections.css). The colour grade is baked into the files (src/assets/sections).
 */
export function SectionBg({ src, position, wash }: BgProps) {
  return (
    <div className={`sec__bg${wash ? ` sec__bg--${wash}` : ""}`} aria-hidden="true">
      <Image src={src} alt="" fill sizes="100vw" style={position ? ({ objectPosition: position } as CSSProperties) : undefined} />
    </div>
  );
}

/** The estate's two roofs, drawn line by line above a title once it shows. */
export function HouseMark({ className = "" }: { className?: string }) {
  return (
    <svg className={`sec__mark${className ? ` ${className}` : ""}`} viewBox="0 0 28 27" aria-hidden="true">
      <path pathLength={1} d="M2 26V12.5L9 5l7 7.5V26" />
      <path pathLength={1} d="M12 26V12.5L19 5l7 7.5V26" />
      <path pathLength={1} d="M9 26v-7" />
    </svg>
  );
}
