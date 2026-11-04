import { FINISHES, houses } from "./data";
import type { FinishId, House, HouseId, LevelId } from "./types";
import { hasBor2Interior } from "./geometry/bor2";

export * from "./types";
export {
  houses,
  FINISHES,
  DEFAULT_FINISH,
  ARRANGEMENTS,
  DISCLAIMER,
  PRICES_AS_OF,
  SALES_STARTED,
  COMPLETION,
} from "./data";

/** Non-breaking space: keeps "1 600 000 zł", "119,8 m²" and "Dom B" on one line. */
export const NB = String.fromCharCode(0xa0);

/* ---------- lookups ---------- */

export function getHouse(id: string | null | undefined): House | undefined {
  if (!id) return undefined;
  const key = id.toUpperCase();
  return houses.find((h) => h.id === key);
}

export function isHouseId(value: string | null | undefined): value is HouseId {
  return !!value && houses.some((h) => h.id === value.toUpperCase());
}

export function isFinishId(value: string | null | undefined): value is FinishId {
  return !!value && FINISHES.some((f) => f.id === value);
}

/** Layouts that ship with a full 3D interior (dollhouse + walk). Grows per iteration. */
export const LAYOUTS_WITH_3D = new Set<House["layout"]>(["b"]);

/** A walkable 3D interior: the developer's BOR2 model (geometry/bor2.ts) or a traced layout. */
export function has3dInterior(house: House) {
  return hasBor2Interior(house.id) || LAYOUTS_WITH_3D.has(house.layout);
}

export const LEVELS: { id: LevelId; label: string; short: string }[] = [
  { id: 0, label: "Parter", short: "P" },
  { id: 1, label: "Piętro", short: "1" },
  { id: 2, label: "Poddasze", short: "2" },
];

export const levelLabel = (level: LevelId) => LEVELS.find((l) => l.id === level)?.label ?? "";

export function roomsOn(house: House, level: LevelId) {
  return house.roomList.filter((r) => r.level === level);
}

export const kindLabel = (h: House) => (h.kind === "semi-detached" ? "Bliźniak" : "Szeregówka");

/** "Dom B · bliźniak z garażem" */
export function houseTitle(h: House) {
  return `Dom${NB}${h.id}`;
}

/** WhatsApp/contact message carrying the house and (optionally) the chosen finish. */
export function inquiryMessage(h: House, finishName?: string) {
  const style = finishName ? ` (styl wnętrza: ${finishName})` : "";
  return `Dzień dobry, interesuje mnie dom ${h.id} na osiedlu Halo Wawer${style}. Proszę o kontakt.`;
}

/* ---------- aggregates (home teaser, panel header) ---------- */

export const availableHouses = houses.filter((h) => h.status === "available");

const listed = availableHouses.length ? availableHouses : [...houses];
const prices = listed.map((h) => h.price).filter((p): p is number => p !== null);

export const priceFrom = Math.min(...prices);
export const areaRange: [number, number] = [Math.min(...houses.map((h) => h.houseArea)), Math.max(...houses.map((h) => h.houseArea))];

/* ---------- formatting (pl-PL, hard spaces) ---------- */

const nf2 = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf1 = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });

/** "119,77 m²" */
export const formatArea = (m2: number) => `${nf2.format(m2)}${NB}m²`;
/** "119,8 m²" for tags. */
export const formatAreaShort = (m2: number) => `${nf1.format(m2)}${NB}m²`;
/** "1 600 000 zł" */
export const formatPrice = (pln: number) => `${nf0.format(pln)}${NB}zł`;
/** "1,60 mln zł" */
export const formatPriceShort = (pln: number) => `${nf2.format(pln / 1_000_000)}${NB}mln${NB}zł`;
/** "14 008,53 zł/m²" (to the grosz, as the developer publishes it). */
export const formatPricePerM2 = (pln: number) => `${nf2.format(pln)}${NB}zł/m²`;

export const STATUS_LABEL: Record<House["status"], string> = {
  available: "Dostępny",
  reserved: "Rezerwacja",
  sold: "Sprzedany",
};

/** Short tag for 3D labels: "Dom B · 119,8 m² · 1,60 mln zł" (sold: "Dom C · sprzedany"). */
export function houseTag(h: House) {
  if (h.status === "sold" || h.price === null) return `Dom${NB}${h.id} · ${STATUS_LABEL[h.status].toLowerCase()}`;
  return `Dom${NB}${h.id} · ${formatAreaShort(h.houseArea)} · ${formatPriceShort(h.price)}`;
}
