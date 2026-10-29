"use client";

import Image from "next/image";
import { useState, type PointerEvent } from "react";
import { getHouse, type PlanImage } from "@/lib/estate";
import { useExplorer } from "../state/store";
import ui from "../ui/ui.module.css";
import styles from "./PlanView.module.css";

const LABEL: Record<string, string> = { "0": "Parter", "1": "Piętro", "2": "Poddasze", garden: "Ogródek" };

/**
 * "Rzut": the developer's floor plans, one click from the rail. Pure DOM (works without WebGL): a paper
 * card in the free stage area, storey tabs, tap/click to zoom into the spot under the pointer.
 */
export function PlanView() {
  const houseId = useExplorer((s) => s.house);
  const level = useExplorer((s) => s.level);
  const house = getHouse(houseId);
  const plans: PlanImage[] = house?.plans ?? [];
  const [index, setIndex] = useState(() => Math.max(0, plans.findIndex((p) => p.level === (level ?? 0))));
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);

  // A storey chosen elsewhere (URL, level pill) follows into the plan: adjusted during render, not in an effect.
  const place = `${houseId}|${level}`;
  const [lastPlace, setLastPlace] = useState(place);
  if (lastPlace !== place) {
    setLastPlace(place);
    const i = plans.findIndex((p) => p.level === (level ?? 0));
    if (i >= 0 && i !== index) {
      setIndex(i);
      setZoom(null);
    }
  }

  if (!house || !plans.length) return null;
  const plan = plans[Math.min(index, plans.length - 1)];

  const choose = (i: number) => {
    setIndex(i);
    setZoom(null);
    const l = plans[i].level;
    if (l === 0 || l === 1) useExplorer.setState({ level: l });
  };

  const toggleZoom = (e: PointerEvent<HTMLDivElement>) => {
    if (zoom) return setZoom(null);
    const r = e.currentTarget.getBoundingClientRect();
    setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };

  return (
    <section className={styles.plan} aria-label={`Rzut domu ${house.id}`}>
      <div className={`${ui.segmented} ${styles.tabs}`} role="tablist" aria-label="Kondygnacja">
        {plans.map((p, i) => (
          <button key={p.src} type="button" role="tab" className={ui.segment} aria-selected={i === index} onClick={() => choose(i)}>
            {LABEL[String(p.level)] ?? p.label}
          </button>
        ))}
      </div>
      <div className={styles.paper} data-zoomed={zoom ? true : undefined} data-loading={loaded !== plan.src || undefined} onPointerUp={toggleZoom}>
        <Image
          key={plan.src}
          src={plan.src}
          alt={`Dom ${house.id}, ${plan.label}: ${plan.note ? "rzut z przykładową aranżacją" : "rzut dewelopera"}`}
          fill
          priority
          unoptimized
          onLoad={() => setLoaded(plan.src)}
          className={styles.image}
          style={zoom ? { transformOrigin: `${zoom.x}% ${zoom.y}%`, transform: "scale(2.2)" } : undefined}
        />
      </div>
      <p className={styles.note}>
        {zoom ? "Kliknij, aby oddalić" : "Kliknij rzut, aby przybliżyć"} · {plan.note ?? "Rzut dewelopera, wymiary w cm"}
      </p>
    </section>
  );
}
