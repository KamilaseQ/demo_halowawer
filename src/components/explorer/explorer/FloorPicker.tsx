"use client";

import { Fragment } from "react";
import { getHouse, has3dInterior, LEVELS, type LevelId } from "@/lib/estate";
import { useExplorer } from "../state/store";
import { IconAttic, IconChevron, IconHouse } from "./icons";
import styles from "./controls.module.css";

/** Model view of a house: the whole house, or a storey opened like a dollhouse (top to bottom). */
const STOPS: (LevelId | null)[] = [null, 1, 0];
const label = (l: LevelId | null) => (l === null ? "Cały dom" : (LEVELS.find((x) => x.id === l)?.label ?? ""));

export function FloorPicker() {
  const view = useExplorer((s) => s.view);
  const mode = useExplorer((s) => s.mode);
  const houseId = useExplorer((s) => s.house);
  const level = useExplorer((s) => s.level);
  const setLevel = useExplorer((s) => s.setLevel);

  const house = view === "house" ? getHouse(houseId) : undefined;
  if (!house || !has3dInterior(house) || mode !== "model") return null;

  const index = STOPS.indexOf(level);
  // The attic has no 3D storey yet: its stop opens the attic plan.
  const attic = house.plans.some((p) => p.level === 2);
  const step = (d: number) => setLevel(STOPS[Math.min(Math.max(index + d, 0), STOPS.length - 1)]);

  return (
    <div className={styles.floors} role="group" aria-label="Kondygnacje" data-entry-controls>
      <button type="button" className={styles.floorStep} onClick={() => step(-1)} aria-label="Wyżej" disabled={index <= 0}>
        <IconChevron dir="up" size={18} />
      </button>
      {STOPS.map((l) => (
        <Fragment key={String(l)}>
          <button type="button" className={styles.floorItem} aria-pressed={level === l} aria-label={label(l)} title={label(l)} onClick={() => setLevel(l)}>
            {l === null ? <IconHouse size={17} /> : l === 0 ? "P" : String(l)}
          </button>
          {l === null && attic && (
            <button
              type="button"
              className={styles.floorItem}
              aria-pressed={false}
              aria-label="Poddasze, rzut"
              title="Poddasze (rzut)"
              onClick={() => useExplorer.setState({ mode: "plan", level: 2 })}
            >
              <IconAttic size={18} />
            </button>
          )}
        </Fragment>
      ))}
      <button type="button" className={styles.floorStep} onClick={() => step(1)} aria-label="Niżej" disabled={index >= STOPS.length - 1}>
        <IconChevron dir="down" size={18} />
      </button>
    </div>
  );
}
