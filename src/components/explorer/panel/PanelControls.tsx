"use client";

import { useEffect, useState } from "react";
import { FINISHES, type Arrangement, type FinishId, type HouseId } from "@/lib/estate";
import { CONTACT, CTA, whatsappHref } from "@/lib/contact";
import { leadContext } from "@/lib/lead";
import { IconArrowLeft, IconArrowRight, IconChevron, IconShare, IconWhatsApp } from "../explorer/icons";
import { useExplorerNav } from "../explorer/nav";
import { useExplorer, withDissolve } from "../state/store";
import ui from "../ui/ui.module.css";
import styles from "./panel.module.css";

/** Wayfinding: where am I (osiedle › dom) and the way back up, in one line; sharing sits at its end. */
export function Breadcrumb({ current }: { current: string }) {
  const { toEstate } = useExplorerNav();
  return (
    <nav className={styles.crumbs} aria-label="Ścieżka" data-peek-hide>
      <button type="button" className={styles.back} onClick={toEstate}>
        <IconArrowLeft size={16} />
        Osiedle
      </button>
      <span aria-hidden>/</span>
      <span aria-current="page">{current}</span>
      <ShareLink title={current} />
      <PanelToggle />
    </nav>
  );
}

/** Rolls the panel up into a one-line bar, so the scene gets the whole stage; the bar rolls it back down. */
export function PanelToggle() {
  return (
    <button
      type="button"
      className={styles.collapse}
      aria-expanded
      aria-controls="explorer-panel"
      aria-label="Zwiń panel"
      title="Zwiń panel"
      data-panel-toggle
      onClick={() => useExplorer.setState({ panelCollapsed: true })}
    >
      <IconChevron size={18} />
    </button>
  );
}

/** Shares exactly this view (style, mode, time of day are in the URL): system share sheet, else copy. */
function ShareLink({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(t);
  }, [copied]);

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${title} · Halo Wawer`, url });
      } catch {
        // dismissed by the user
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt("Skopiuj link", url);
    }
  };

  return (
    <span className={styles.shareWrap}>
      <button type="button" className={styles.shareIcon} aria-label="Udostępnij" title="Udostępnij" onClick={share}>
        <IconShare size={17} />
      </button>
      <span className={styles.toast} role="status" aria-live="polite" data-visible={copied || undefined}>
        {copied ? "Skopiowano link" : ""}
      </span>
    </span>
  );
}

/** Sold house: the way to the available one with the same layout (or type). */
export function SeeHouse({ id }: { id: HouseId }) {
  const { toHouse } = useExplorerNav();
  return (
    <button type="button" className={styles.seeHouse} onClick={() => toHouse(id)}>
      Zobacz Dom {id}
      <IconArrowRight size={16} />
    </button>
  );
}

/** Finish switch: the scene changes under a dissolve of the current frame (everything is preloaded). */
export function FinishPicker() {
  const finish = useExplorer((s) => s.finish);
  const choose = (id: FinishId) => {
    if (id === finish) return;
    void withDissolve(() => useExplorer.setState({ finish: id, photo: false }));
  };
  return (
    <div className={styles.finishes} role="radiogroup" aria-label="Styl wnętrza">
      {FINISHES.map((f) => (
        <button key={f.id} type="button" role="radio" aria-checked={finish === f.id} className={styles.finish} onClick={() => choose(f.id)}>
          <span className={styles.swatches} aria-hidden>
            {f.swatches.map((c) => (
              <i key={c} style={{ background: c }} />
            ))}
          </span>
          <span className={styles.finishName}>{f.name}</span>
          <span className={styles.finishTag}>{f.tagline}</span>
        </button>
      ))}
    </div>
  );
}

export function ArrangementPicker({ options }: { options: Arrangement[] }) {
  const arrangement = useExplorer((s) => s.arrangement) ?? options[0].id;
  const current = options.find((o) => o.id === arrangement) ?? options[0];
  return (
    <>
      <div className={ui.segmented} role="group" aria-label="Aranżacja">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            className={ui.segment}
            aria-pressed={o.id === current.id}
            onClick={() => o.id !== current.id && void withDissolve(() => useExplorer.setState({ arrangement: o.id === options[0].id ? null : o.id }))}
          >
            {o.name}
          </button>
        ))}
      </div>
      <p className={styles.fine}>{current.description} Przykładowa aranżacja.</p>
    </>
  );
}

/**
 * The two actions, always in reach: "Umów prezentację" (gold) opens the home page's contact form with
 * this house (and style) preselected; WhatsApp carries the same context in its message.
 */
export function HouseCta({ house }: { house: HouseId }) {
  const finish = useExplorer((s) => s.finish);
  const finishName = FINISHES.find((f) => f.id === finish)?.name;
  return (
    <footer className={styles.cta}>
      {/* Opens the lead sheet over the scene; the link is only the no-JS fallback. */}
      <a
        href={`/?dom=${house}#kontakt`}
        className={`${styles.ctaBtn} ${styles.ctaSolid}`}
        aria-haspopup="dialog"
        onClick={(e) => {
          e.preventDefault();
          leadContext.set({ house, style: finish });
          useExplorer.setState({ leadOpen: true });
        }}
      >
        {CTA.visit}
      </a>
      <a href={whatsappHref({ house, finishName })} target="_blank" rel="noreferrer" className={`${styles.ctaBtn} ${styles.ctaOutline}`} aria-label={`${CTA.whatsapp}, ${CONTACT.phone}`}>
        <IconWhatsApp size={18} />
        WhatsApp
      </a>
    </footer>
  );
}

/** Lets an adviser or buyer send exactly this version (style, view, time of day) on WhatsApp. */
export function ShareVersion({ title }: { title: string }) {
  const share = () => {
    const url = window.location.href;
    const text = `${title}, Halo Wawer, wybrana wersja: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };
  return (
    <button type="button" className={styles.share} onClick={share}>
      Wyślij tę wersję na WhatsApp
    </button>
  );
}
