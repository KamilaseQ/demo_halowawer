"use client";

import { CTA, whatsappHref } from "@/lib/contact";
import { FINISHES, getHouse } from "@/lib/estate";
import { useExplorer } from "../state/store";
import { IconWhatsAppFill } from "./icons";
import styles from "./chrome.module.css";

/** Gold WhatsApp button, bottom right; the message names the house (and style) on screen. */
export function WhatsAppFab() {
  const view = useExplorer((s) => s.view);
  const houseId = useExplorer((s) => s.house);
  const mode = useExplorer((s) => s.mode);
  const finish = useExplorer((s) => s.finish);

  const house = view === "house" ? getHouse(houseId) : undefined;
  const finishName = FINISHES.find((f) => f.id === finish)?.name;
  // Phones: the house sheet shows WhatsApp beside "Umów prezentację", so the button would repeat it.
  const inSheet = !!house && (mode === "model" || mode === "plan");

  return (
    <a
      className={styles.fab}
      href={whatsappHref({ house: house?.id, finishName })}
      target="_blank"
      rel="noreferrer"
      aria-label={CTA.whatsapp}
      data-in-sheet={inSheet || undefined}
    >
      <IconWhatsAppFill />
      <span className={styles.fabLabel} aria-hidden>
        {CTA.whatsapp}
      </span>
    </a>
  );
}
