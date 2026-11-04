"use client";

import { useEffect, useMemo, useState } from "react";
import { getHouse, has3dInterior } from "@/lib/estate";
import { estateWalkModel } from "@/lib/estate/geometry";
import { useExplorer } from "../state/store";
import ui from "../ui/ui.module.css";
import { IconArrowLeft, IconArrowRight } from "./icons";
import { useExplorerNav } from "./nav";
import styles from "./controls.module.css";

/**
 * HUD of the estate walk: back to the maquette, the walk points (SketchUp scenes: entrance, street,
 * gardens), the how-to hint, and — next to a house — the way in.
 */
export function EstateWalkHud() {
  const node = useExplorer((s) => s.node);
  const near = useExplorer((s) => s.nearHouse);
  const ready = useExplorer((s) => s.ready);
  const model = estateWalkModel();
  const { toHouse } = useExplorerNav();
  const [hint, setHint] = useState(false);
  const coarse = useMemo(() => window.matchMedia("(pointer: coarse)").matches, []);

  useEffect(() => {
    if (!ready) return;
    const show = setTimeout(() => setHint(true), 600);
    const hide = setTimeout(() => setHint(false), 6000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [ready]);

  if (!model) return null;
  const house = getHouse(near);

  return (
    <>
      <div className={styles.walkTop}>
        <button type="button" className={`${styles.pill} ${ui.glass}`} onClick={() => useExplorer.getState().setMode("model")}>
          <IconArrowLeft size={16} />
          Makieta 3D
        </button>
      </div>
      <nav className={`${styles.nodeBar} ${ui.glass}`} aria-label="Miejsca na osiedlu">
        <div className={styles.nodeGroup}>
          <span className={ui.kicker}>Osiedle</span>
          {model.walk.nodes.map((n) => (
            <button key={n.id} type="button" className={ui.segment} aria-pressed={node === n.id} onClick={() => useExplorer.getState().goToNode(n.id)}>
              {n.label}
            </button>
          ))}
        </div>
      </nav>
      <p className={`${styles.hint} ${ui.glassLight}`} data-hidden={!hint || undefined} onPointerDown={() => setHint(false)}>
        Przeciągnij, aby się rozejrzeć · {coarse ? "Dotknij ziemi" : "Kliknij ziemię lub użyj strzałek"}, aby iść
      </p>
      {house && (
        <div className={styles.enterHouse} role="group" aria-label={`Dom ${house.id}`}>
          {has3dInterior(house) && (
            <button type="button" className={`${styles.pill} ${styles.pillSolid}`} onClick={() => toHouse(house.id, "?widok=spacer")}>
              Wejdź do domu {house.id}
              <IconArrowRight size={16} />
            </button>
          )}
          <button type="button" className={`${styles.pill} ${ui.glass}`} onClick={() => toHouse(house.id)}>
            Karta domu {house.id}
          </button>
        </div>
      )}
    </>
  );
}
