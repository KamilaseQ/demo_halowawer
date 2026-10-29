/* ==========================================================================
   Domain types for Osiedle Halo Wawer (7 houses, A–G).
   Pure data, no React/three imports: the home page imports this cheaply.
   Single source of truth for prices, areas and statuses (home + /domy).
   ========================================================================== */

export type HouseId = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export type HouseStatus = "available" | "reserved" | "sold";

/** bliźniak (A–D, with a garage) | szeregówka (E–G) */
export type HouseKind = "semi-detached" | "terraced";

/** Price-transparency record (ustawa o jawności cen, od 11.09.2025). ISO yyyy-mm-dd, PLN gross. */
export interface PricePoint {
  date: string;
  price: number;
}

/** Storeys of a house: 0 = parter, 1 = piętro, 2 = poddasze (unheated attic). */
export type LevelId = 0 | 1 | 2;

export type RoomKind =
  | "living"
  | "kitchen"
  | "bedroom"
  | "room"
  | "bathroom"
  | "wc"
  | "hall"
  | "stairs"
  | "technical"
  | "garage"
  | "attic"
  | "terrace";

export interface Room {
  name: string;
  kind: RoomKind;
  /** m² */
  area: number;
  level: LevelId;
}

export interface PlanImage {
  src: string;
  label: string;
  level: LevelId | "garden" | "site";
  width: number;
  height: number;
  /** Caption for plans that are not the developer's drawing (e.g. a furnished plan from the Kreator). */
  note?: string;
}

/** Floor-plan layout family. A/C mirror B/D; E, F and G are the terraced row. */
export type LayoutId = "b" | "e" | "f" | "g";

export interface House {
  id: HouseId;
  /** URL segment: /domy/b */
  slug: string;
  kind: HouseKind;
  status: HouseStatus;
  layout: LayoutId;
  /** The layout is drawn mirrored (A mirrors B, C mirrors D). */
  mirrored: boolean;
  /** m², "powierzchnia domu" as marketed by the developer (e.g. 119.77). */
  houseArea: number;
  /** m², usable floor area; the developer's zł/m² is computed on this (e.g. 115.19). */
  usableArea: number;
  /** m², unheated attic floor area (poddasze nieużytkowe, po podłodze); null where no card exists. */
  atticArea: number | null;
  /** m² */
  gardenArea: number;
  /** m² of the terrace "do aranżacji indywidualnej". */
  terraceArea: number;
  /** Bedrooms + living room, as the developer counts "ilość pokoi". */
  rooms: number;
  /** Parking spaces included (garage counts as one). */
  parkingSpaces: number;
  /** Human-readable parking, e.g. "garaż + miejsce postojowe". */
  parking: string;
  /** PLN gross; null when sold (the price is not published any more). */
  price: number | null;
  /** PLN/m² on usableArea, unrounded (format with formatPricePerM2: 14 008,53 zł/m²); null when sold. */
  pricePerM2: number | null;
  /** Oldest first; the last entry equals the current price. Empty for sold houses. */
  priceHistory: PricePoint[];
  /** Clear storey heights, metres (senn.pl house data: groundFloorHeight / firstFloorHeight / atticHeight). */
  heights: { ground: number; first: number; attic: number };
  roomList: Room[];
  plans: PlanImage[];
  /** Developer's PDF card (rzuty + parametry). */
  cardPdf: string | null;
  /** One-line selling points under the title. */
  highlights: string[];
}

/* ---------- interiors ---------- */

/**
 * Finish styles share ids with the home page's "Kreator wnętrz" (s1–s6), so the visitor never meets two
 * different configurators: /domy/b?widok=spacer&styl=s4 is the same "Japandi" as on the home page.
 */
export type FinishId = "s1" | "s4" | "s3";

export interface FinishStyle {
  id: FinishId;
  name: string;
  tagline: string;
  /** Floor, walls, accent: chips and swatches. */
  swatches: [string, string, string];
}

/** Furnishing scenario for a layout ("Zaplanuj życie"). */
export interface Arrangement {
  id: string;
  name: string;
  description: string;
}

export type TimeOfDay = "rano" | "dzien" | "noc";
