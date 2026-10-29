"use client";

import Link from "next/link";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { isFinishId, type HouseId } from "@/lib/estate";
import { whatsappHref } from "@/lib/contact";
import { leadContext } from "@/lib/lead";
import { ArrowIcon } from "@/components/ui/icons";

/** The configurator shows house A (its plan, areas and renders). */
export const KREATOR_HOUSE: HouseId = "A";
const HOUSE = KREATOR_HOUSE;

/** localStorage key of the configurator (public/kreator/index.html). */
const KREATOR_STATE = "halo-wnetrza";

/** The 3D walk opens on its default style when the configurator's style is not one of its own. */
const WALK_DEFAULT_STYLE = "s1";

const STYLE_NAMES: Record<string, string> = {
  s1: "Jasna skandynawska",
  s2: "Ciepła naturalna",
  s3: "Grafitowa",
  s4: "Japandi",
  s5: "Klasyczna elegancka",
  s6: "Hamptons",
};

type KreatorState = { style?: string; room?: string };

/* the configurator lives in a same-origin frame: its writes reach this page as `storage` events */
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};
const snapshot = () => {
  try {
    return localStorage.getItem(KREATOR_STATE);
  } catch {
    return null;
  }
};

/** Follow-ups under the configurator: the chosen style in the 3D walk, or ask about the house. */
export function KreatorActions() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  const state = useMemo<KreatorState>(() => {
    try {
      return (JSON.parse(raw ?? "null") as KreatorState | null) ?? {};
    } catch {
      return {};
    }
  }, [raw]);

  const style = state.style && state.style in STYLE_NAMES ? state.style : undefined;
  const room = state.room ?? "salon";
  const walkStyle = style && isFinishId(style) ? style : WALK_DEFAULT_STYLE;
  const sameStyle = !style || walkStyle === style;
  const walkHref = `/domy/${HOUSE.toLowerCase()}?widok=spacer&punkt=${encodeURIComponent(room)}&styl=${walkStyle}`;

  // once the visitor has used the configurator (KreatorFrame), the contact form carries the style too
  const { house } = leadContext.use();
  useEffect(() => {
    if (house === HOUSE && style && leadContext.get().style !== style) leadContext.set({ ...leadContext.get(), style });
  }, [house, style]);

  return (
    <div className="sec__actions" data-stagger="">
      <Link className="sec__link reveal" href={walkHref} prefetch={false} data-cta="kreator-walk">
        <span>{sameStyle ? "Zobacz ten styl w spacerze 3D" : "Zobacz dom w spacerze 3D"}</span>
        <ArrowIcon />
      </Link>
      <a
        className="button-gold reveal"
        href={whatsappHref({ house: HOUSE, finishName: style ? STYLE_NAMES[style] : undefined })}
        target="_blank"
        rel="noopener"
        data-cta="kreator-ask"
      >
        Zapytaj o dom {HOUSE}
      </a>
    </div>
  );
}
