"use client";

import { useEffect, useRef } from "react";
import { LeadForm } from "@/components/contact/LeadForm";
import { FINISHES } from "@/lib/estate";
import { CTA } from "@/lib/contact";
import { useExplorer } from "../state/store";
import { IconClose } from "./icons";
import styles from "./LeadSheet.module.css";

const close = () => useExplorer.setState({ leadOpen: false });

/**
 * "Umów prezentację" in place, over the scene: the site's lead form in a glass sheet (a centred card on
 * desktop, a bottom sheet on phones), carrying the house and style the visitor is looking at. A native
 * modal dialog: focus stays inside, Esc and a click outside close it, the page behind is inert.
 */
export function LeadSheet() {
  const open = useExplorer((s) => s.leadOpen);
  const view = useExplorer((s) => s.view);
  const house = useExplorer((s) => s.house);
  const finish = useExplorer((s) => s.finish);
  const dialog = useRef<HTMLDialogElement>(null);
  const timer = useRef(0);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const id = view === "house" && house ? house : undefined;
  const finishName = FINISHES.find((f) => f.id === finish)?.name;

  return (
    <dialog
      ref={dialog}
      className={styles.sheet}
      aria-labelledby="lead-sheet-title"
      onClose={close}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className={styles.body}>
        <header className={styles.head}>
          <div>
            <h2 id="lead-sheet-title" className={styles.title}>
              {CTA.visit}
            </h2>
            <p className={styles.context}>{id ? `Dom ${id} · ${finishName}` : "Halo Wawer · Warszawa Wawer"}</p>
          </div>
          <button type="button" className={styles.close} aria-label="Zamknij" onClick={close}>
            <IconClose size={18} />
          </button>
        </header>
        {/* Mounted per opening: every visit starts with a fresh form. */}
        {open && (
          <LeadForm
            house={id}
            style={finish}
            source="domy"
            tone="light"
            className="lead--bare"
            title="Zostaw numer, a doradca zadzwoni i umówi prezentację."
            onDone={() => {
              window.clearTimeout(timer.current);
              timer.current = window.setTimeout(close, 2600);
            }}
          />
        )}
      </div>
    </dialog>
  );
}
