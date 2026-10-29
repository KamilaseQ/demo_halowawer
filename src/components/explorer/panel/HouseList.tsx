"use client";

import { COMPLETION, formatArea, formatPriceShort, houses, priceFrom, PRICES_AS_OF, STATUS_LABEL, type House, type HouseId } from "@/lib/estate";
import { useExplorerNav } from "../explorer/nav";
import { PanelToggle } from "./PanelControls";
import { useExplorer } from "../state/store";
import styles from "./panel.module.css";

/** Two groups replace sorting and filters: semi-detached with a garage, terraced with two spaces. A → G inside. */
const GROUPS: { kind: House["kind"]; label: string }[] = [
  { kind: "semi-detached", label: "Bliźniaki · garaż + miejsce" },
  { kind: "terraced", label: "Szeregowce · 2 miejsca" },
];
const byId = [...houses].sort((a, b) => a.id.localeCompare(b.id));
const offered = houses.filter((h) => h.status === "available");
const available = offered.length;

/** At most two highlights for the whole list, from the data only: the lowest price and the largest garden on offer. */
const TAGS: Partial<Record<HouseId, string>> = {};
if (offered.length) {
  const cheapest = offered.reduce((a, b) => ((b.price ?? Infinity) < (a.price ?? Infinity) ? b : a));
  const biggestGarden = offered.reduce((a, b) => (b.gardenArea > a.gardenArea ? b : a));
  TAGS[cheapest.id] = "najniższa cena";
  if (biggestGarden.id !== cheapest.id) TAGS[biggestGarden.id] = "największy ogród";
}

/** "listopad 2026" → "w listopadzie 2026" (Polish locative of the month). */
const LOCATIVE: Record<string, string> = {
  styczeń: "styczniu",
  luty: "lutym",
  marzec: "marcu",
  kwiecień: "kwietniu",
  maj: "maju",
  czerwiec: "czerwcu",
  lipiec: "lipcu",
  sierpień: "sierpniu",
  wrzesień: "wrześniu",
  październik: "październiku",
  listopad: "listopadzie",
  grudzień: "grudniu",
};
const completionIn = COMPLETION.replace(/^\p{L}+/u, (m) => LOCATIVE[m.toLowerCase()] ?? m);
const asOf = new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(PRICES_AS_OF));

/** All seven houses. No filters: with seven houses direct choice is clearer. */
export function HouseList() {
  const hovered = useExplorer((s) => s.hovered);
  const { toHouse } = useExplorerNav();

  return (
    <div className={styles.scroll}>
      <header className={styles.head}>
        <div className={styles.eyebrow}>
          <p className={styles.kicker}>Halo Wawer · Warszawa Wawer</p>
          <PanelToggle />
        </div>
        <h1 className={styles.title}>Wybierz swój dom</h1>
        <p className={styles.lede}>
          7 domów z ogrodem · {available} dostępnych · od {formatPriceShort(priceFrom)} · gotowe w {completionIn}
        </p>
      </header>

      <div className={styles.listHead} aria-hidden>
        <span>Dom</span>
        <span>Pow.</span>
        <span>Ogród</span>
        <span>Cena</span>
      </div>

      {GROUPS.map((g) => (
        <section key={g.kind} className={styles.floorGroup} aria-label={g.label}>
          <h2 className={styles.floorLabel}>{g.label}</h2>
          <ul className={styles.list}>
            {byId
              .filter((h) => h.kind === g.kind)
              .map((h) => {
                const sold = h.status === "sold";
                const tag = TAGS[h.id];
                return (
                  <li key={h.id}>
                    <button
                      type="button"
                      className={styles.row}
                      data-sold={sold || undefined}
                      data-hover={hovered === h.id || undefined}
                      onPointerEnter={() => useExplorer.setState({ hovered: h.id })}
                      onPointerLeave={() => useExplorer.setState({ hovered: null })}
                      onFocus={() => useExplorer.setState({ hovered: h.id })}
                      onBlur={() => useExplorer.setState({ hovered: null })}
                      onClick={() => toHouse(h.id)}
                    >
                      <span className={styles.rowName}>Dom {h.id}</span>
                      <span className={styles.num}>{formatArea(h.houseArea)}</span>
                      <span className={styles.num}>{formatArea(h.gardenArea)}</span>
                      <span className={styles.num}>{h.price ? formatPriceShort(h.price) : "—"}</span>
                      <span className={styles.rowMeta}>
                        <small data-status={h.status}>{STATUS_LABEL[h.status]}</small>
                        {tag && <em className={styles.rowTag}>{tag}</em>}
                      </span>
                    </button>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
      <p className={styles.fine}>Ceny brutto · stan na {asOf} · historia cen w karcie domu</p>
    </div>
  );
}
