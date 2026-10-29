"use client";

import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import type { HouseId, HouseStatus } from "@/lib/estate";
import { CTA } from "@/lib/contact";
import { leadContext } from "@/lib/lead";
import { damp, isLite } from "@/lib/motion";
import { ArrowIcon } from "@/components/ui/icons";
import type { PinPlacement } from "./pins";

export type EstatePin = {
  id: HouseId;
  index: number;
  status: HouseStatus;
  href: string;
  /** label line under "Dom X": "119,8 m² · 1,60 mln zł" or "Sprzedany" */
  meta: string;
  kind: string;
  statusLabel: string;
  facts: string;
  price: string | null;
  placement: PinPlacement;
};

export type EstateSummary = { title: string; facts: string };

type Props = {
  pins: EstatePin[];
  summary: EstateSummary;
  photo: StaticImageData;
  explorerHref: string;
};

const LEAVE_DELAY = 140; // ms; moving between two labels never flashes the summary

export function EstateViewer({ pins, summary, photo, explorerHref }: Props) {
  const [active, setActive] = useState<HouseId | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef(0);
  const lastPointer = useRef<string>("mouse");
  const activeAtDown = useRef<HouseId | null>(null);

  const current = pins.find((p) => p.id === active) ?? null;

  /* the WhatsApp button and the contact form follow the house in focus */
  useEffect(() => {
    if (active) leadContext.set({ ...leadContext.get(), house: active });
  }, [active]);

  usePointerParallax(stage);

  function show(id: HouseId) {
    window.clearTimeout(leaveTimer.current);
    setActive(id);
  }

  function release() {
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => setActive(null), LEAVE_DELAY);
  }

  return (
    <div className="estate__viewer">
      <div className="estate__stage reveal-img" ref={stage}>
        {/* photo and labels move as one scene, so the roof points never slip */}
        <div className="estate__scene">
        <Image
          className="estate__photo"
          src={photo}
          alt="Osiedle Halo Wawer od strony ogrodów o zachodzie słońca: siedem domów, od lewej G, F, E, D, C, B i A"
          sizes="(max-width: 760px) 100vw, 90vw"
        />

        <ul className={`estate__pins${current ? " has-active" : ""}`} aria-label="Domy na osiedlu">
          {pins.map((pin) => (
            <li
              key={pin.id}
              className={`pin pin--${pin.status}${pin.id === active ? " is-active" : ""}`}
              style={
                {
                  "--x": pin.placement.x,
                  "--y": pin.placement.y,
                  "--lift": pin.placement.lift,
                  "--lift-sm": pin.placement.liftSm,
                  "--card-x": pin.placement.cardX,
                  "--i": pin.index,
                } as CSSProperties
              }
            >
              <Link
                className="pin__link"
                href={pin.href}
                prefetch={false}
                data-cta="estate-pin"
                aria-label={`Dom ${pin.id}, ${pin.statusLabel.toLowerCase()}, ${pin.meta}. Zobacz w 3D`}
                onPointerDown={(e) => {
                  lastPointer.current = e.pointerType;
                  // read before the tap focuses the link (focus shows the house too)
                  activeAtDown.current = active;
                }}
                onPointerEnter={(e) => e.pointerType === "mouse" && show(pin.id)}
                onPointerLeave={(e) => e.pointerType === "mouse" && release()}
                onFocus={() => show(pin.id)}
                onBlur={release}
                onClick={(e) => {
                  // touch: the first tap previews the house, the second opens it; mouse and keyboard open it
                  const type = (e.nativeEvent as PointerEvent).pointerType || lastPointer.current;
                  if ((type === "touch" || type === "pen") && activeAtDown.current !== pin.id) {
                    e.preventDefault();
                    show(pin.id);
                  }
                  lastPointer.current = "mouse";
                  activeAtDown.current = null;
                }}
              >
                <span className="pin__dot" aria-hidden="true" />
                <span className="pin__line" aria-hidden="true" />
                <span className="pin__card" aria-hidden="true">
                  <span className="pin__name">
                    <span>
                      <span className="pin__prefix">Dom&nbsp;</span>
                      {pin.id}
                    </span>
                  </span>
                  <span className="pin__meta">{pin.meta}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        </div>
      </div>

      <div className="estate__panel reveal">
        <div className="estate__panel-body" key={current?.id ?? "all"} aria-live="polite">
          {current ? (
            <>
              <p className="estate__panel-eyebrow">
                <span>{current.kind}</span>
                <span className={`estate__status estate__status--${current.status}`}>{current.statusLabel}</span>
              </p>
              <p className="estate__panel-title">Dom {current.id}</p>
              <p className="estate__panel-facts">{current.facts}</p>
              <p className="estate__panel-price">{current.price ?? current.statusLabel}</p>
            </>
          ) : (
            <>
              <p className="estate__panel-eyebrow">Osiedle Halo Wawer</p>
              <p className="estate__panel-title">{summary.title}</p>
              <p className="estate__panel-facts">{summary.facts}</p>
              <p className="estate__panel-hint">Wskaż dom na zdjęciu, aby zobaczyć metraż i cenę.</p>
            </>
          )}
        </div>
        <Link className="contact__button estate__cta" href={current?.href ?? explorerHref} prefetch={false} data-cta="estate-explore">
          <span>{current ? `Zobacz dom ${current.id} w 3D` : CTA.explore3d}</span>
          <ArrowIcon />
        </Link>
      </div>
    </div>
  );
}

/**
 * The scene sways a touch against the fixed frame under the pointer, so it
 * reads as a view with depth (fine pointers only, no reduced motion).
 * Writes --mx / --my (-1..1) on the stage; the CSS turns them into a translate.
 */
function usePointerParallax(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || isLite() || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let tx = 0, ty = 0, x = 0, y = 0, raf = 0, last = 0;

    function tick(now: number) {
      const k = damp(0.08, last ? now - last : 16.7);
      last = now;
      x += (tx - x) * k;
      y += (ty - y) * k;
      if (Math.abs(tx - x) < 0.001 && Math.abs(ty - y) < 0.001) {
        x = tx;
        y = ty;
      }
      el!.style.setProperty("--mx", x.toFixed(4));
      el!.style.setProperty("--my", y.toFixed(4));
      raf = x === tx && y === ty ? 0 : requestAnimationFrame(tick);
      if (!raf) last = 0;
    }
    const wake = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    function onMove(e: PointerEvent) {
      if (e.pointerType !== "mouse") return;
      const r = el!.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      ty = ((e.clientY - r.top) / r.height) * 2 - 1;
      wake();
    }
    function onLeave() {
      tx = 0;
      ty = 0;
      wake();
    }

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [ref]);
}
