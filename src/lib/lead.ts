import type { HouseId } from "@/lib/estate";
import { createStore } from "./store";

/**
 * What the visitor is looking at, so every contact action can carry it
 * (WhatsApp message, later the form's preselected house).
 */
export interface LeadContext {
  house?: HouseId;
  /** Kreator style id (s1–s6) the visitor last chose. */
  style?: string;
}

export const leadContext = createStore<LeadContext>({});
