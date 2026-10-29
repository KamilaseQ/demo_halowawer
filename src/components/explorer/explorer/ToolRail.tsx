"use client";

import type { ReactNode } from "react";
import { getHouse, has3dInterior } from "@/lib/estate";
import { useExplorer, type HouseMode } from "../state/store";
import { IconCube, IconGallery, IconPlan, IconWalk } from "./icons";
import styles from "./controls.module.css";

type Item = { id: string; label: string; icon: ReactNode; active: boolean; disabled: boolean; onClick: () => void };

/** House views: Model 3D, Spacer, Rzut, Galeria. The estate has no rail: the houses themselves are the choice. */
export function ToolRail() {
  const view = useExplorer((s) => s.view);
  const mode = useExplorer((s) => s.mode);
  const houseId = useExplorer((s) => s.house);
  const setMode = useExplorer((s) => s.setMode);
  const fallback = useExplorer((s) => s.fallback);
  const ready = useExplorer((s) => s.ready);

  const house = view === "house" ? getHouse(houseId) : undefined;
  if (!house) return null;
  const with3d = has3dInterior(house) && !fallback;
  // Without WebGL the plan stands in for the model.
  const current: HouseMode = fallback && (mode === "model" || mode === "walk") ? "plan" : mode;
  // The 3D views wait for the full preload; plan and gallery work at once.
  const item = (id: HouseMode, label: string, icon: ReactNode): Item => {
    const disabled = !ready && (id === "model" || id === "walk");
    return { id, label, icon, active: current === id, disabled, onClick: () => !disabled && setMode(id) };
  };
  const items: Item[] = [
    ...(fallback ? [] : [item("model", "Model 3D", <IconCube />)]),
    ...(with3d ? [item("walk", "Spacer", <IconWalk />)] : []),
    ...(house.plans.length ? [item("plan", "Rzut", <IconPlan />)] : []),
    item("gallery", "Galeria", <IconGallery />),
  ];

  return (
    <nav className={styles.rail} aria-label="Widoki domu" data-explorer-rail>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          className={styles.railItem}
          aria-pressed={it.active}
          aria-disabled={it.disabled || undefined}
          title={it.disabled ? "Wczytywanie…" : undefined}
          onClick={it.onClick}
        >
          {it.icon}
          <span>{it.label}</span>
        </button>
      ))}
    </nav>
  );
}
