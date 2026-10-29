import type { HouseId } from "@/lib/estate";
import type { NavKey } from "@/lib/nav";

/* =========================================================================
   Copy of the home page. Prices, areas and statuses are NOT here: they come
   from @/lib/estate (one source of truth with the 3D explorer).
   ========================================================================= */

export const NAV_LINKS: { key: NavKey; href: string; label: string }[] = [
  { key: "home", href: "#top", label: "Start" },
  { key: "about", href: "#o-osiedlu", label: "O osiedlu" },
  { key: "properties", href: "#domy", label: "Domy" },
  { key: "location", href: "#lokalizacja", label: "Lokalizacja" },
  { key: "contact", href: "#kontakt", label: "Kontakt" },
];

export const HERO = {
  wordmark: "Halo Wawer",
  intro: ["Siedem nowoczesnych domów w zielonym Wawrze.", "Prywatne ogrody od południa, własny garaż", "i 26 minut do centrum Warszawy."],
  card: { title: "Osiedle Halo Wawer", address: "ul. Borków 24B, Warszawa Wawer", button: "Zobacz domy" },
};

/** Chapters fade in and out on cue as the film plays (start/end: film progress 0..1). */
export const CHAPTERS: { id: string; nav: NavKey; start: number; end: number; eyebrow: string; title: string; text: string }[] = [
  {
    id: "chapter-about",
    nav: "about",
    start: 0.06,
    end: 0.26,
    eyebrow: "O osiedlu",
    title: "Siedem domów, jedno spokojne miejsce",
    text: "Kameralne osiedle w Wawrze: prywatne ogrody od południa, własny garaż i 26 minut do centrum Warszawy.",
  },
  {
    id: "chapter-properties",
    nav: "properties",
    start: 0.36,
    end: 0.56,
    eyebrow: "Domy",
    title: "Salon otwarty na ogród",
    text: "Parter to jedna jasna przestrzeń: salon, jadalnia i kuchnia z wyjściem na taras. Dąb, kamień i ogrzewanie podłogowe w całym domu.",
  },
  {
    id: "chapter-location",
    nav: "location",
    start: 0.6,
    end: 0.78,
    eyebrow: "Lokalizacja",
    title: "Kuchnia z widokiem na zieleń Wawra",
    text: "ul. Borków 24B. Sklep 85 m, przystanek 300 m, żłobek 800 m, szkoła 1100 m. Lasy i ścieżki rowerowe za płotem.",
  },
  {
    id: "chapter-contact",
    nav: "contact",
    start: 0.82,
    end: 0.97,
    eyebrow: "Kontakt",
    title: "Trzy sypialnie na piętrze. Zobacz na żywo",
    text: "Umów prywatną wizytę z doradcą Senn Development, na osiedlu lub online. Sprzedaż otwarta od kwietnia 2026.",
  },
];

/** Houses with a photo card in "Domy" (the full list lives in the 3D explorer). */
export const FEATURED_HOUSES: HouseId[] = ["A", "B", "E"];

/** "O osiedlu": the bold lead-in, then the rest of the line. */
export const ABOUT_FEATURES: [string, string][] = [
  ["Podwójna ściana", "między segmentami: cisza jak w domu wolnostojącym."],
  ["Ogrzewanie podłogowe", "w całym domu, na obu kondygnacjach."],
  ["Przesuwne okna", "na ogród od południa: salon przechodzi w taras."],
  ["Światłowód", "w standardzie, gotowy do pracy z domu."],
];

export const ABOUT_STATS = [
  { value: "7", label: "domów na całym osiedlu" },
  { value: "100–120", label: "m² plus poddasze do 50\u00a0m²" },
  { value: "180\u00a0m²", label: "największy ogród od południa" },
];

export const INTERIORS = [
  { floor: "Parter", meta: "Strefa dzienna", title: "Salon otwarty na kuchnię i taras", alt: "Salon z sofą i jadalnią" },
  { floor: "Parter", meta: "Kuchnia", title: "Zabudowa z dębu i kamienny blat", alt: "Kuchnia z wyspą i zabudową dębową" },
  { floor: "Piętro", meta: "Pokój dziecięcy", title: "Trzy sypialnie i łazienka na piętrze", alt: "Pokój dziecięcy z dużym oknem" },
];

/** Hard spaces keep "1 000 m" and "180 m²" on one line. */
const nb = (s: string) => s.replace(/ /g, "\u00a0");

export type DistanceIcon = "shop" | "bus" | "cart" | "nursery" | "clinic" | "school";

export const DISTANCES: { place: string; distance: string; icon: DistanceIcon }[] = [
  { place: "Sklep spożywczy", distance: nb("85 m"), icon: "shop" },
  { place: "Przystanek autobusowy", distance: nb("300 m"), icon: "bus" },
  { place: "Supermarket", distance: nb("650 m"), icon: "cart" },
  { place: "Żłobek", distance: nb("800 m"), icon: "nursery" },
  { place: "Przychodnia", distance: nb("1 000 m"), icon: "clinic" },
  { place: "Szkoła podstawowa i plac zabaw", distance: nb("1 100 m"), icon: "school" },
];

export const FOOTER_LINKS = [
  { href: "#kreator", label: "Kreator wnętrz" },
  { href: "#domy", label: "Domy" },
  { href: "#o-osiedlu", label: "O osiedlu" },
  { href: "#wnetrza", label: "Wnętrza" },
  { href: "#lokalizacja", label: "Lokalizacja" },
  { href: "#kontakt", label: "Kontakt" },
];
