"use client";

import { useState, type FormEvent } from "react";
import { STATUS_LABEL, getHouse, houses, type HouseId } from "@/lib/estate";
import { CONTACT, CTA, LEAD_SUCCESS } from "@/lib/contact";
import { leadContext } from "@/lib/lead";
import { track } from "@/lib/analytics";
import "./lead-form.css";

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; name: string } | { kind: "error" };

export type LeadFormProps = {
  /** Preselected house; without it the form follows what the visitor looked at (lead context). */
  house?: HouseId;
  /** Finish style id (s1–s6) sent along with the lead. */
  style?: string;
  /** Where the lead came from, for the CRM and analytics, e.g. "home-contact", "domy". */
  source?: string;
  /** dark (default): ivory on dark glass; light: ink on white panels. */
  tone?: "dark" | "light";
  /** Line above the fields; null hides it. */
  title?: string | null;
  /** Extra classes on the form (e.g. "reveal" on the home page). */
  className?: string;
  /** Called after a successful send (e.g. close a sheet after a moment). */
  onDone?: () => void;
};

/**
 * "Oddzwonimy": name, phone, house, one consent. Posts to /api/lead.
 * Shared by the home page's contact section and the 3D explorer's sheet.
 */
export function LeadForm({
  house: houseProp,
  style: styleProp,
  source = "home-contact",
  tone = "dark",
  title = "Zostaw numer, a doradca zadzwoni i umówi prezentację.",
  className = "",
  onDone,
}: LeadFormProps) {
  const context = leadContext.use();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  // the visitor's own pick wins over the prop and the context
  const [picked, setPicked] = useState<HouseId | "" | null>(null);
  const suggested = houseProp ?? context.house;
  const house = picked ?? (suggested && getHouse(suggested)?.status !== "sold" ? suggested : "");
  const style = styleProp ?? context.style;
  const toneClass = tone === "light" ? " lead--light" : "";

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const payload = {
      name: String(data.get("name") ?? "").trim(),
      phone: String(data.get("phone") ?? "").trim(),
      house: String(data.get("house") ?? ""),
      consent: data.get("consent") === "on",
      style,
      source,
    };
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(String(res.status));
      track("lead_submit", { house: payload.house || "any", source });
      setStatus({ kind: "sent", name: payload.name });
      onDone?.();
    } catch {
      setStatus({ kind: "error" });
    }
  }

  if (status.kind === "sent") {
    return (
      <div className={`lead__done${toneClass}`} role="status">
        <span className="lead__check" aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3.5 8.5l3 3 6-7" />
          </svg>
        </span>
        <p style={{ margin: 0 }}>
          <strong>Dziękujemy{status.name ? `, ${status.name}` : ""}!</strong>
          <span>{LEAD_SUCCESS}</span>
        </p>
      </div>
    );
  }

  return (
    <form className={`lead${toneClass}${className ? ` ${className}` : ""}`} onSubmit={submit}>
      {title && <p className="lead__title">{title}</p>}
      <div className="lead__grid">
        <label className="lead__field">
          <span className="lead__label">Imię</span>
          <input className="lead__input" name="name" autoComplete="given-name" required maxLength={60} />
        </label>
        <label className="lead__field">
          <span className="lead__label">Telefon</span>
          <input
            className="lead__input"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            pattern="[+0-9 ()\-]{9,20}"
            placeholder="+48"
          />
        </label>
        <label className="lead__field">
          <span className="lead__label">Dom</span>
          <select className="lead__input" name="house" value={house} onChange={(e) => setPicked(e.target.value as HouseId | "")}>
            <option value="">Jeszcze nie wiem</option>
            {houses.map((h) => (
              <option key={h.id} value={h.id} disabled={h.status === "sold"}>
                Dom {h.id}
                {h.status !== "available" ? ` (${STATUS_LABEL[h.status].toLowerCase()})` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="lead__foot">
        <label className="lead__consent">
          <input type="checkbox" name="consent" required />
          <span>
            Zgadzam się na kontakt telefoniczny w sprawie oferty Halo Wawer. Administratorem danych jest {CONTACT.developer}.
          </span>
        </label>
        <button className="lead__submit" type="submit" disabled={status.kind === "sending"}>
          {status.kind === "sending" ? "Wysyłanie…" : CTA.leadSubmit}
        </button>
      </div>
      {status.kind === "error" && (
        <p className="lead__error" role="alert">
          Nie udało się wysłać. Zadzwoń do nas: <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>
        </p>
      )}
    </form>
  );
}
