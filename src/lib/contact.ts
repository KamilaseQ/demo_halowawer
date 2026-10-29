import { getHouse, inquiryMessage, type HouseId } from "@/lib/estate";

/**
 * Contact channels and call-to-action wording: one place for the sales team.
 * Every CTA on the site reads its label from here, so renaming it is one line.
 */
export const CONTACT = {
  phone: "+48 733 80 90 90",
  phoneHref: "tel:+48733809090",
  /** wa.me wants digits only */
  whatsapp: "48733809090",
  salesOffice: "ul. Zwoleńska 81 lok. 4, Warszawa Wawer",
  developer: "Senn Development",
} as const;

export const CTA = {
  /** the main call to action, same word across the site and the 3D explorer */
  visit: "Umów prezentację",
  visitOnSite: "Umów prezentację na osiedlu",
  call: "Zadzwoń",
  whatsapp: "Napisz na WhatsApp",
  explore3d: "Zobacz osiedle w 3D",
  leadSubmit: "Umów prezentację",
} as const;

/** Promise shown after the form is sent. */
export const LEAD_SUCCESS = "Doradca oddzwoni w ciągu 15 minut w godzinach pracy biura sprzedaży.";

const GENERIC_MESSAGE = "Dzień dobry, interesuje mnie osiedle Halo Wawer. Proszę o kontakt.";

/** wa.me link with a message that names the house (and finish) when known. */
export function whatsappHref(opts: { house?: HouseId; finishName?: string } = {}) {
  const house = getHouse(opts.house);
  const text = house ? inquiryMessage(house, opts.finishName) : GENERIC_MESSAGE;
  return `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(text)}`;
}
