import type { Arrangement, FinishStyle, House, HouseId, LayoutId, LevelId, PlanImage, PricePoint, Room, RoomKind } from "./types";

/* ==========================================================================
   Source: senn.pl/inwestycje/osiedle-halo-wawer (read 28.10.2026).
   Areas in m², prices PLN gross. Sales started 24.04.2026, completion 11.2026.
   ========================================================================== */

export const SALES_STARTED = "2026-04-24";
export const COMPLETION = "listopad 2026";
/** Date the current prices were read from the developer's site. */
export const PRICES_AS_OF = "2026-10-28";

const plan = (id: string, level: PlanImage["level"], label: string): PlanImage => ({
  // WebP, 1600 px: served as is (no image optimizer pass, so the first view of a plan never waits on an encode).
  src: `/explorer/plans/dom-${id}-${level === 0 ? "parter" : level === 1 ? "pietro" : level === 2 ? "poddasze" : "ogrodek"}.webp`,
  label,
  level,
  width: 1600,
  height: 1200,
});

/** Furnished plans from the Kreator (house A; C has the same layout and orientation in PLACEMENTS, so no mirror). */
const arranged = (level: 0 | 1, label: string): PlanImage => ({
  src: `/explorer/plans/dom-ac-${level === 0 ? "parter" : "pietro"}-aranzacja.webp`,
  label,
  level,
  width: 1600,
  height: 1067,
  note: "Rzut z przykładową aranżacją · rzut z wymiarami w karcie domu",
});

/** A and C show the furnished Kreator plans for both storeys; the CAD drawings stay in the house card (PDF). */
const plansFor = (id: string): PlanImage[] => [
  ...(id === "a" || id === "c" ? [arranged(0, "Parter"), arranged(1, "Piętro")] : [plan(id, 0, "Parter"), plan(id, 1, "Piętro")]),
  plan(id, 2, "Poddasze"),
  plan(id, "garden", "Ogródek"),
];

const r = (level: LevelId, kind: RoomKind, name: string, area: number): Room => ({ level, kind, name, area });

/** Non-breaking space for copy with numbers and units ("98,82 m²", "27 m²" never break). */
const NB = String.fromCharCode(0xa0);

/* Layout B (houses B, D; mirrored as A, C). A/C label the upstairs rooms differently. */
const groundB = (living: number, wc: number): Room[] => [
  r(0, "living", "Strefa dzienna", living),
  r(0, "garage", "Garaż", 18.47),
  r(0, "hall", "Wiatrołap", 3.7),
  r(0, "hall", "Korytarz", 3.92),
  r(0, "stairs", "Klatka schodowa", 4.58),
  r(0, "wc", "WC", wc),
  r(0, "technical", "Pomieszczenie techniczne", 0.76),
];

const firstB: Room[] = [
  r(1, "bedroom", "Sypialnia", 13.81),
  r(1, "room", "Pokój 1", 12.92),
  r(1, "room", "Pokój 2", 10.58),
  r(1, "room", "Pokój hobby", 10.22),
  r(1, "bathroom", "Łazienka", 4.74),
  r(1, "hall", "Korytarz", 6.47),
];

const firstA: Room[] = [
  r(1, "room", "Pokój 3", 13.47),
  r(1, "bedroom", "Sypialnia", 12.92),
  r(1, "room", "Pokój 1", 10.93),
  r(1, "room", "Pokój 2", 10.22),
  r(1, "bathroom", "Łazienka", 4.74),
  r(1, "hall", "Korytarz", 6.47),
];

const groundTerraced = (living: number, kitchen: number): Room[] => [
  r(0, "living", "Strefa dzienna", living),
  r(0, "kitchen", "Aneks kuchenny", kitchen),
  r(0, "hall", "Wiatrołap", 3.89),
  r(0, "stairs", "Klatka schodowa", 4.58),
  r(0, "wc", "WC", 2.57),
  r(0, "technical", "Pomieszczenie techniczne", 0.76),
];

const firstTerraced = (corridor: number, p1: number, p2: number, p3: number): Room[] => [
  r(1, "bedroom", "Sypialnia", 10.86),
  r(1, "room", "Pokój 1", p1),
  r(1, "room", "Pokój 2", p2),
  r(1, "room", "Pokój 3", p3),
  r(1, "bathroom", "Łazienka", 4.41),
  r(1, "hall", "Korytarz", corridor),
];

/** Unheated attic (developer's cards: "poddasze nieużytkowe", max. 2,25 m), floor area "po podłodze". */
const attic = (area: number): Room => r(2, "attic", "Poddasze nieużytkowe", area);

const history = (price: number): PricePoint[] => [{ date: SALES_STARTED, price }];

const HEIGHTS = { ground: 2.64, first: 2.6, attic: 2.62 };

type Seed = {
  id: HouseId;
  layout: LayoutId;
  mirrored: boolean;
  status: House["status"];
  houseArea: number;
  usableArea: number;
  atticArea: number | null;
  gardenArea: number;
  terraceArea: number;
  /** Published price; null where the developer publishes none (sold houses). */
  price: number | null;
  roomList: Room[];
  highlights: string[];
  plans: boolean;
};

function house(s: Seed): House {
  const sold = s.status === "sold";
  const semi = s.layout === "b";
  const id = s.id.toLowerCase();
  return {
    id: s.id,
    slug: id,
    kind: semi ? "semi-detached" : "terraced",
    status: s.status,
    layout: s.layout,
    mirrored: s.mirrored,
    houseArea: s.houseArea,
    usableArea: s.usableArea,
    atticArea: s.atticArea,
    gardenArea: s.gardenArea,
    terraceArea: s.terraceArea,
    rooms: 5,
    parkingSpaces: 2,
    parking: semi ? "garaż + 1 miejsce" : "2 miejsca",
    price: sold ? null : s.price,
    // The developer's figure, unrounded: price / usable area (14 008,53 zł/m² for A).
    pricePerM2: sold || s.price === null ? null : s.price / s.usableArea,
    // Sold houses: no price and no history (the developer publishes neither).
    priceHistory: sold || s.price === null ? [] : history(s.price),
    heights: HEIGHTS,
    roomList: s.roomList,
    plans: s.plans ? plansFor(id) : [],
    cardPdf: s.plans ? `/explorer/docs/dom-${id}.pdf` : null,
    highlights: s.highlights,
  };
}

/** West → east along the street, as the houses stand: G F E | D C | B A. Listed A → G. */
export const houses: readonly House[] = [
  house({
    id: "A",
    layout: "b",
    mirrored: true,
    status: "available",
    houseArea: 119.51,
    usableArea: 114.93,
    atticArea: 49.27,
    gardenArea: 98.82,
    terraceArea: 6.98,
    price: 1_610_000,
    roomList: [...groundB(26.92, 2.41), ...firstA, attic(49.27)],
    highlights: [`Największy ogród wśród dostępnych domów: 98,82${NB}m² od${NB}południa`, "Garaż w bryle domu"],
    plans: true,
  }),
  house({
    id: "B",
    layout: "b",
    mirrored: false,
    status: "available",
    houseArea: 119.77,
    usableArea: 115.19,
    atticArea: 49.27,
    gardenArea: 93.67,
    terraceArea: 6.98,
    price: 1_600_000,
    roomList: [...groundB(27.26, 2.34), ...firstB, attic(49.27)],
    highlights: [`Salon 27${NB}m² z wyjściem HS do ogrodu`, "Garaż w bryle domu"],
    plans: true,
  }),
  house({
    id: "C",
    layout: "b",
    mirrored: true,
    status: "sold",
    houseArea: 119.51,
    usableArea: 114.93,
    atticArea: 49.27,
    gardenArea: 85.33,
    terraceArea: 6.98,
    price: null,
    roomList: [...groundB(26.92, 2.41), ...firstA, attic(49.27)],
    highlights: ["Garaż w bryle domu"],
    plans: true,
  }),
  house({
    id: "D",
    layout: "b",
    mirrored: false,
    status: "available",
    houseArea: 119.77,
    usableArea: 115.19,
    atticArea: 49.27,
    gardenArea: 86.27,
    terraceArea: 6.98,
    price: 1_590_000,
    roomList: [...groundB(27.26, 2.34), ...firstB, attic(49.27)],
    highlights: [`Salon 27${NB}m² z wyjściem HS do ogrodu`, "Garaż w bryle domu"],
    plans: true,
  }),
  house({
    id: "E",
    layout: "e",
    mirrored: false,
    status: "available",
    houseArea: 99.8,
    usableArea: 95.22,
    atticArea: 42.88,
    gardenArea: 78.41,
    terraceArea: 7.12,
    price: 1_490_000,
    roomList: [...groundTerraced(29.61, 7.86), ...firstTerraced(5.28, 10.15, 9.75, 10.08), attic(42.88)],
    highlights: [`Strefa dzienna 37${NB}m² z aneksem`, `4${NB}pokoje na piętrze`],
    plans: true,
  }),
  house({
    id: "F",
    layout: "f",
    mirrored: false,
    status: "available",
    houseArea: 102.97,
    usableArea: 98.39,
    atticArea: 44.3,
    gardenArea: 38.26,
    terraceArea: 7.12,
    price: 1_450_000,
    roomList: [...groundTerraced(30.63, 8.43), ...firstTerraced(5.77, 10.84, 9.5, 10.73), attic(44.3)],
    highlights: ["Najniższa cena na osiedlu", `Strefa dzienna 39${NB}m² z aneksem`],
    plans: true,
  }),
  house({
    id: "G",
    layout: "g",
    mirrored: false,
    status: "sold",
    houseArea: 100.86,
    usableArea: 96.28,
    // No developer card for G: attic area unknown.
    atticArea: null,
    gardenArea: 184.87,
    terraceArea: 7.12,
    price: null,
    roomList: [],
    highlights: ["Największy ogród na osiedlu"],
    plans: false,
  }),
];

/* ---------- interiors ---------- */

export const FINISHES: FinishStyle[] = [
  { id: "s1", name: "Jasna skandynawska", tagline: "Len, jasny dąb, boucle", swatches: ["#d9b98f", "#f1ece3", "#e9e1d3"] },
  { id: "s4", name: "Japandi", tagline: "Jesion, papier ryżowy, czerń", swatches: ["#cdae86", "#ece4d6", "#1f1d1b"] },
  { id: "s3", name: "Grafitowa", tagline: "Antracyt, czarny dąb, marmur", swatches: ["#5d4a3c", "#d8d3cc", "#2b2a29"] },
];

export const DEFAULT_FINISH: FinishStyle["id"] = "s1";

export const ARRANGEMENTS: Partial<Record<LayoutId, Arrangement[]>> = {
  b: [
    { id: "rodzina", name: "Rodzina 2+2", description: "Sypialnia, dwa pokoje dzieci i gabinet do pracy z domu." },
    { id: "para", name: "Para z gabinetem", description: "Sypialnia z garderobą, gabinet, pokój gościnny i siłownia." },
  ],
};

export const DISCLAIMER =
  "Wizualizacje i model 3D mają charakter poglądowy. Wiążące są rzuty i standard wykończenia z prospektu informacyjnego.";
