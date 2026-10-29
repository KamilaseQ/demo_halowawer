"use client";

import { FINISHES, getHouse, has3dInterior, type FinishId } from "@/lib/estate";
import { DAYLIGHT } from "../three/lighting/daylight";
import { stage, useExplorer, withDissolve, type TimeOfDay } from "../state/store";
import ui from "../ui/ui.module.css";
import { IconMinus, IconPlus } from "./icons";
import styles from "./controls.module.css";

const TIMES = Object.keys(DAYLIGHT) as TimeOfDay[];

/** Bottom glass bar: finish style | time of day | zoom. The estate keeps only the time of day and zoom. */
export function StageControls() {
  const view = useExplorer((s) => s.view);
  const mode = useExplorer((s) => s.mode);
  const houseId = useExplorer((s) => s.house);
  const timeOfDay = useExplorer((s) => s.timeOfDay);
  const entry = useExplorer((s) => s.entry);
  const finish = useExplorer((s) => s.finish);
  const level = useExplorer((s) => s.level);

  const house = view === "house" ? getHouse(houseId) : undefined;
  const interior = !!house && has3dInterior(house);
  if ((mode === "gallery" || mode === "plan") && house) return null;
  // On the photo entry the photo itself carries the single action ("Obróć makietę 3D").
  if (view === "estate" && entry === "photo") return null;
  const walking = interior && mode === "walk";
  // The style only shows when the interior does: an opened storey or the walk, not the closed house.
  const insideVisible = interior && (level !== null || mode === "walk");

  return (
    <div className={`${styles.bottomBar} ${ui.glass}`} data-walk={walking || undefined} data-estate={view === "estate" || undefined} data-entry-controls>
      {/* Finish switch stays reachable in the immersive walk, where the panel is hidden. */}
      {insideVisible && (
        <div className={styles.group} role="radiogroup" aria-label="Styl wnętrza">
          {FINISHES.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={finish === f.id}
              aria-label={f.name}
              title={f.name}
              className={styles.swatch}
              style={{ background: `conic-gradient(${f.swatches[0]} 0 120deg, ${f.swatches[1]} 0 240deg, ${f.swatches[2]} 0)` }}
              onClick={() => f.id !== finish && void withDissolve(() => useExplorer.setState({ finish: f.id as FinishId, photo: false }))}
            />
          ))}
          <span className={styles.swatchName}>{FINISHES.find((f) => f.id === finish)?.name}</span>
        </div>
      )}

      <div className={styles.group}>
        <div className={ui.segmented} role="group" aria-label="Pora dnia">
          {TIMES.map((t) => (
            <button key={t} type="button" className={ui.segment} aria-pressed={timeOfDay === t} onClick={() => useExplorer.setState({ timeOfDay: t })}>
              {DAYLIGHT[t].label}
            </button>
          ))}
        </div>
      </div>

      {view === "estate" && (
        <div className={styles.group}>
          <button type="button" className={ui.segment} onClick={() => useExplorer.setState({ entry: "photo" })}>
            Wizualizacja
          </button>
        </div>
      )}

      {/* Zoom buttons are a desktop affordance; touch screens pinch. */}
      <div className={`${styles.group} ${styles.zoomGroup}`}>
        <button type="button" className={ui.iconButton} aria-label="Oddal" onClick={() => stage()?.zoom(-1)}>
          <IconMinus size={18} />
        </button>
        <button type="button" className={ui.iconButton} aria-label="Przybliż" onClick={() => stage()?.zoom(1)}>
          <IconPlus size={18} />
        </button>
      </div>
    </div>
  );
}
