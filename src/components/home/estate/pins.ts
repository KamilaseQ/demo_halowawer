import type { HouseId } from "@/lib/estate";

/**
 * Where each house sits on the estate photo (src/assets/contact/estate-dusk.jpg,
 * 2200 x 1461, garden side, sunset; from the west: G F E | D C | B A).
 * x, y: the roof point as fractions of the photo. lift: label height above
 * it as a fraction of the photo height (lift-sm on small stages, letter only).
 * Lifts alternate so neighbouring labels never collide.
 */
export type PinPlacement = { x: number; y: number; lift: number; liftSm: number; cardX?: string };

export const PINS: Record<HouseId, PinPlacement> = {
  G: { x: 0.175, y: 0.485, lift: 0.2, liftSm: 0.1 },
  F: { x: 0.35, y: 0.517, lift: 0.12, liftSm: 0.05 },
  E: { x: 0.478, y: 0.541, lift: 0.22, liftSm: 0.12 },
  D: { x: 0.669, y: 0.578, lift: 0.16, liftSm: 0.05 },
  C: { x: 0.784, y: 0.593, lift: 0.26, liftSm: 0.16 },
  B: { x: 0.869, y: 0.609, lift: 0.13, liftSm: 0.05 },
  A: { x: 0.934, y: 0.616, lift: 0.3, liftSm: 0.2, cardX: "-74%" },
};

/** West to east, the order the labels rise in. */
export const PIN_ORDER: HouseId[] = ["G", "F", "E", "D", "C", "B", "A"];
