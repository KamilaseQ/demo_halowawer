"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { FINISHES, formatArea, formatPrice, getHouse, has3dInterior, houses, STATUS_LABEL, type House, type HouseId } from "@/lib/estate";
import { modelFor } from "@/lib/estate/geometry";
import { leadContext } from "@/lib/lead";
import { SiteNav } from "@/components/site/SiteNav";
import { ESTATE_PHOTO } from "@/lib/estate/photo";
import { useExplorer } from "../state/store";
import ui from "../ui/ui.module.css";
import { DissolveOverlay } from "./DissolveOverlay";
import { FloorPicker } from "./FloorPicker";
import { IconChevron } from "./icons";
import { LeadSheet } from "./LeadSheet";
import { Loader } from "./Loader";
import { useExplorerNav } from "./nav";
import { PhotoEntry } from "./PhotoEntry";
import { renderFor } from "./renders";
import { SheetHandle, type SheetState } from "./SheetHandle";
import { StageBoundary } from "./StageBoundary";
import { ToolRail } from "./ToolRail";
import { WhatsAppFab } from "./WhatsAppFab";
import styles from "./Explorer.module.css";

const Stage = dynamic(() => import("../three/Stage"), { ssr: false });
// UI that only matters once the scene runs or a mode is entered: split out of the first-load bundle.
const StageControls = dynamic(() => import("./StageControls").then((m) => m.StageControls), { ssr: false });
const WalkHud = dynamic(() => import("./WalkHud").then((m) => m.WalkHud), { ssr: false });
const Gallery = dynamic(() => import("./Gallery").then((m) => m.Gallery), { ssr: false });
const PlanView = dynamic(() => import("./PlanView").then((m) => m.PlanView), { ssr: false });

function webglAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return !!canvas.getContext("webgl2");
  } catch {
    return false;
  }
}

/* Client capability, probed once: false on the server and during hydration, then the real answer. */
let webgl: boolean | null = null;
const webglSnapshot = () => (webgl ??= webglAvailable());
const noSubscribe = () => () => {};
const serverFalse = () => false;
const clientTrue = () => true;

const PANEL_KEY = "domy.panel";
const AVAILABLE = houses.filter((h) => h.status === "available").length;

/** One line for the rolled-up panel: the house at a glance (area only on wide screens), or the estate. */
function BarLine({ house }: { house?: House }) {
  if (!house) return <>Wybierz dom · {AVAILABLE} z {houses.length} dostępnych</>;
  const tail = house.status === "sold" ? "sprzedany" : house.price !== null ? formatPrice(house.price) : STATUS_LABEL[house.status];
  return (
    <>
      <i className={styles.barDot} data-status={house.status} aria-hidden />
      Dom {house.id}
      {house.status !== "sold" && <span className={styles.barArea}> · {formatArea(house.houseArea)}</span>} · {tail}
    </>
  );
}

/** First-visit hint for the model; disappears on the first touch of the stage. */
function OrbitHint({ show, text }: { show: boolean; text: string }) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (!show) return;
    const off = () => setDismissed(true);
    const t = setTimeout(off, 6500);
    window.addEventListener("pointerdown", off, { once: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointerdown", off);
    };
  }, [show]);
  return (
    <p className={`${styles.hint} ${ui.glassLight}`} data-hidden={!show || dismissed || undefined} aria-hidden>
      {text}
    </p>
  );
}

export function Explorer({ children }: { children: ReactNode }) {
  const ready = useExplorer((s) => s.ready);
  const view = useExplorer((s) => s.view);
  const mode = useExplorer((s) => s.mode);
  const houseId = useExplorer((s) => s.house);
  const fallback = useExplorer((s) => s.fallback);
  const entry = useExplorer((s) => s.entry);
  const node = useExplorer((s) => s.node);
  const finish = useExplorer((s) => s.finish);
  const progress = useExplorer((s) => s.progress);
  const settled = useExplorer((s) => s.settled);
  const dissolving = useExplorer((s) => !!s.dissolve);
  const mounted = useSyncExternalStore(noSubscribe, webglSnapshot, serverFalse);
  const hydrated = useSyncExternalStore(noSubscribe, clientTrue, serverFalse);
  const [sheet, setSheet] = useState<SheetState>("peek");
  // Panel content fades in on client navigations only; the first (server) paint shows it at once (LCP).
  const [navigated, setNavigated] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const bar = useRef<HTMLButtonElement>(null);
  const collapsed = useExplorer((s) => s.panelCollapsed);
  const { toHouse } = useExplorerNav();

  /*
   * 3D start policy: the whole scene (all styles, all times of day) loads and compiles before it shows,
   * then everything runs without a hitch. It starts at once; the aerial photo (estate) or the room render
   * (deep link into the walk) is on screen meanwhile, with a real progress line.
   */
  useEffect(() => {
    if (hydrated && !mounted) useExplorer.setState({ fallback: true });
  }, [hydrated, mounted]);

  const house = view === "house" ? getHouse(houseId) : undefined;
  const with3d = !!house && has3dInterior(house);
  const immersive = with3d && mode === "walk";

  // Each new place starts with the sheet collapsed (name · price · CTA) so the model stays visible.
  // Adjusted during render (React's pattern for state derived from a changed prop), not in an effect.
  const place = `${view}|${houseId}`;
  const [lastPlace, setLastPlace] = useState(place);
  if (lastPlace !== place) {
    setLastPlace(place);
    setSheet("peek");
    setNavigated(true);
  }

  // Page-level flags for global chrome (contact dock) and the explorer's own layout.
  useEffect(() => {
    const root = document.documentElement;
    if (immersive) root.dataset.immersive = "true";
    else delete root.dataset.immersive;
    root.dataset.explorer = "true";
    return () => {
      delete root.dataset.immersive;
      delete root.dataset.explorer;
    };
  }, [immersive]);

  const openHouse = useCallback((id: HouseId) => toHouse(id), [toHouse]);

  // A rolled-up panel stays rolled up for the session (estate and houses alike); a shared link opens it.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(PANEL_KEY) === "collapsed") useExplorer.setState({ panelCollapsed: true });
    } catch {
      // storage blocked: the panel simply starts open
    }
    return useExplorer.subscribe((s, prev) => {
      if (s.panelCollapsed === prev.panelCollapsed) return;
      try {
        sessionStorage.setItem(PANEL_KEY, s.panelCollapsed ? "collapsed" : "open");
      } catch {
        // not remembered, still works
      }
    });
  }, []);

  // Focus follows the control that replaced the one just pressed (the toggle and the bar swap places).
  useEffect(() => {
    const active = document.activeElement;
    if (collapsed && active && panel.current?.contains(active)) bar.current?.focus({ preventScroll: true });
    else if (!collapsed && active && bar.current?.contains(active)) panel.current?.querySelector<HTMLElement>("[data-panel-toggle]")?.focus({ preventScroll: true });
  }, [collapsed]);

  /* At 100% the estate photo dissolves into the 3D maquette by itself and the fly-over starts (once per
     visit). A visitor who already chose (clicked a house, dragged) is never overridden. */
  const introDone = useExplorer((s) => s.introDone);
  useEffect(() => {
    if (!ready || view !== "estate" || entry !== "photo" || introDone) return;
    const t = window.setTimeout(() => {
      const s = useExplorer.getState();
      if (s.view === "estate" && s.entry === "photo" && !s.introDone) useExplorer.setState({ entry: "model", hovered: null });
    }, 450);
    return () => window.clearTimeout(t);
  }, [ready, view, entry, introDone]);

  /* The poster shows this place until the first 3D frame: the room's render when the link opens the walk,
     the house's plan or the estate's aerial render. */
  const model = house ? modelFor(house) : null;
  const walkStill = with3d && mode === "walk" && model ? renderFor(node ?? model.walk.start, finish) : null;
  const poster = walkStill ? walkStill.src : ESTATE_PHOTO.src;
  const finishName = FINISHES.find((f) => f.id === finish)?.name;
  const loading = mounted && !ready && (view === "house" || entry === "model");
  const loadingWhat = walkStill ? `Przygotowujemy spacer · ${finishName}` : house ? `Przygotowujemy dom ${house.id} w 3D` : "Przygotowujemy osiedle w 3D";

  return (
    <section
      className={styles.root}
      data-immersive={immersive || undefined}
      data-view={view}
      data-panel={collapsed ? "collapsed" : undefined}
      aria-label="Osiedle Halo Wawer w 3D"
    >
      <div className={styles.stage} data-lenis-prevent>
        <div className={styles.poster} data-hidden={(ready && !fallback) || undefined} data-loading={loading || undefined} aria-hidden={ready || undefined}>
          <Image src={poster} alt="" fill priority sizes="100vw" className={styles.posterImage} style={walkStill && house?.mirrored ? { transform: "scaleX(-1)" } : undefined} />
        </div>
        {mounted && !fallback && (
          <StageBoundary>
            <Stage onSelect={openHouse} />
          </StageBoundary>
        )}
        <div className={styles.labels} data-label-layer data-hidden={!ready || undefined} />
        {/* Estate entry: the developer's aerial render with house outlines (also the no-WebGL fallback). */}
        {view === "estate" && <PhotoEntry active={entry === "photo" || fallback} canExplore={!fallback} />}
        <DissolveOverlay />
      </div>

      {/* The site's navigation; its CTA opens the lead sheet in place, with this house and style. */}
      <SiteNav
        tone="light"
        active="properties"
        className={styles.nav}
        onVisit={() => {
          const s = useExplorer.getState();
          leadContext.set({ house: s.view === "house" && s.house ? s.house : undefined, style: s.finish });
          useExplorer.setState({ leadOpen: true });
        }}
      />

      {/* Rolled up, the panel no longer counts as covering the stage (data-explorer-panel): the camera re-frames. */}
      <aside
        ref={panel}
        id="explorer-panel"
        className={styles.panel}
        data-lenis-prevent
        data-explorer-panel={!collapsed || undefined}
        data-collapsed={collapsed || undefined}
        data-sheet={sheet}
        data-navigated={navigated || undefined}
        inert={collapsed}
      >
        <SheetHandle panel={panel} state={sheet} onChange={setSheet} onHide={() => useExplorer.setState({ panelCollapsed: true })} />
        {children}
      </aside>
      <button
        ref={bar}
        type="button"
        className={styles.bar}
        data-hidden={!collapsed || undefined}
        inert={!collapsed}
        aria-controls="explorer-panel"
        aria-expanded={false}
        title="Rozwiń panel"
        onClick={() => useExplorer.setState({ panelCollapsed: false })}
      >
        <span className={styles.barGrip} aria-hidden />
        <span className={styles.barText}>
          <BarLine house={house} />
        </span>
        <span className={styles.barIcon} aria-hidden>
          <IconChevron size={18} dir="down" />
        </span>
        <span className={styles.srOnly}>Rozwiń panel</span>
      </button>

      <ToolRail />
      {!fallback && (
        <>
          <FloorPicker />
          {ready && <StageControls />}
          <OrbitHint show={ready && view === "house" && mode === "model"} text="Przeciągnij, aby obrócić dom" />
          <Loader show={loading} progress={progress} label={loadingWhat} />
          {/* A scene change that takes longer than a blink says so. */}
          {ready && dissolving && !settled && (
            <p className={`${styles.start} ${ui.glass}`} data-delayed role="status">
              Wczytuję…
            </p>
          )}
          {/* House positions in the maquette are drawn from the site plan, not surveyed. */}
          {view === "estate" && entry === "model" && <p className={styles.caption}>Położenie domów poglądowe</p>}
          {immersive && <WalkHud />}
        </>
      )}
      <WhatsAppFab />
      <LeadSheet />
      {house && (mode === "plan" || (fallback && mode !== "gallery")) && <PlanView />}
      {house && mode === "gallery" && <Gallery />}
    </section>
  );
}
