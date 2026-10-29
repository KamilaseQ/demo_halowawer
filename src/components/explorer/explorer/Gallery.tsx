"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getHouse } from "@/lib/estate";
import { useExplorer } from "../state/store";
import ui from "../ui/ui.module.css";
import { IconChevron, IconClose } from "./icons";
import { galleryFor } from "./renders";
import styles from "./controls.module.css";

export function Gallery() {
  const view = useExplorer((s) => s.view);
  const mode = useExplorer((s) => s.mode);
  const houseId = useExplorer((s) => s.house);
  const [index, setIndex] = useState(0);
  const house = view === "house" ? getHouse(houseId) : undefined;
  const open = !!house && mode === "gallery";

  const items = house ? galleryFor(house) : [];
  const close = () => useExplorer.getState().setMode("model");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % items.length);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + items.length) % items.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, items.length]);

  if (!open || !items.length) return null;
  const item = items[index % items.length];

  return (
    <div className={styles.gallery} role="dialog" aria-modal="true" aria-label="Galeria">
      <div className={styles.galleryFrame}>
        <Image key={item.src} src={item.src} alt={item.alt} fill priority sizes="(max-width: 900px) 100vw, 70vw" className={styles.galleryImage} data-plan={item.kind === "plan" || undefined} />
      </div>
      <p className={styles.galleryCaption}>
        {item.alt}
        <span>
          {index + 1} / {items.length} · {item.kind === "plan" ? "Rzut dewelopera" : "Wizualizacja, przykładowa aranżacja"}
        </span>
      </p>
      <button type="button" className={`${ui.iconButton} ${ui.glass} ${styles.galleryPrev}`} aria-label="Poprzednie" onClick={() => setIndex((i) => (i - 1 + items.length) % items.length)}>
        <IconChevron dir="left" />
      </button>
      <button type="button" className={`${ui.iconButton} ${ui.glass} ${styles.galleryNext}`} aria-label="Następne" onClick={() => setIndex((i) => (i + 1) % items.length)}>
        <IconChevron dir="right" />
      </button>
      <button type="button" className={`${ui.iconButton} ${ui.glass} ${styles.galleryClose}`} aria-label="Zamknij galerię" onClick={close}>
        <IconClose />
      </button>
      <div className={styles.thumbs}>
        {items.map((it, i) => (
          <button key={it.src} type="button" className={styles.thumb} aria-current={i === index || undefined} onClick={() => setIndex(i)}>
            <Image src={it.src} alt="" width={96} height={96} />
          </button>
        ))}
      </div>
    </div>
  );
}
