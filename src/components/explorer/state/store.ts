"use client";

import { create } from "zustand";
import { DEFAULT_FINISH, type FinishId, type HouseId, type LevelId, type TimeOfDay } from "@/lib/estate";

/** Top-level explorer view: the whole estate, or one house. */
export type ExplorerView = "estate" | "house";

/** House sub-views (tool rail). Finish styles and time of day are a bottom bar, available in 3D views. */
export type HouseMode = "model" | "walk" | "plan" | "gallery";

export type { TimeOfDay };

type State = {
  view: ExplorerView;
  /** Selected house (route-driven). */
  house: HouseId | null;
  mode: HouseMode;
  /** Model view: null = the whole house from outside, 0/1 = dollhouse cut at that level. */
  level: LevelId | null;
  finish: FinishId;
  arrangement: string | null;
  timeOfDay: TimeOfDay;
  /** Hover sync between the list, the photo polygons and the 3D estate. */
  hovered: HouseId | null;
  /** Current walk node id (walk mode). */
  node: string | null;
  /** Increments on every node request so re-selecting the same node re-centres the view. */
  nodeRequest: number;
  /** Frozen copy of the last frame, shown over the canvas while the scene changes underneath (dissolve). */
  dissolve: HTMLCanvasElement | null;
  /** sceneSignature() before the dissolved change: the dissolve waits for the change to land. */
  dissolveFrom: string;
  /** Finish whose textures are on the materials. */
  finishReady: FinishId | null;
  /** Photoreal still is shown over the live view (only at nodes that have one). */
  photo: boolean;
  /** The 3D stage has been revealed: its first scene was complete (loaded, uploaded, compiled). */
  ready: boolean;
  /** The current scene is complete, including the chosen finish; dissolves wait for it. */
  settled: boolean;
  /** Loading progress of the first scene, 0–1 (poster counter). */
  progress: number;
  /** WebGL unavailable or too slow: UI falls back to stills. */
  fallback: boolean;
  /** Estate entry: the developer's aerial render with house polygons, or the 3D maquette. */
  entry: "photo" | "model";
  /** The opening fly-over has played (it plays once per visit, then the visitor is in control). */
  introDone: boolean;
  /** The data panel is rolled up into a one-line bar (mobile: the sheet is hidden); kept per session, never in the URL. */
  panelCollapsed: boolean;
  /** The "Umów prezentację" sheet (lead form over the scene) is open. */
  leadOpen: boolean;
  /** Post stack quality on capable devices; drops to "low" (under a dissolve, camera at rest) if the GPU can't keep up. */
  postQuality: "high" | "low";
  /** Estate walk: the house the walker stands next to ("Wejdź do domu"). */
  nearHouse: HouseId | null;
  /**
   * QA framing (?kadr=<render>): the developer's render camera from ujecia-porownawcze.json, estate space.
   * The rig holds it (fov, near, vertical lens shift) and flags `shotReady` once a frame shows it.
   */
  shot: Shot | null;
  shotReady: boolean;
  /** ?czysty=1: only the canvas (measurements over the whole frame). */
  clean: boolean;
};

export type Shot = { id: string; position: [number, number, number]; target: [number, number, number]; yfov: number; shift: number; near: number; hide?: string[] };

type Actions = {
  set: (partial: Partial<State>) => void;
  setMode: (mode: HouseMode) => void;
  setLevel: (level: LevelId | null) => void;
  goToNode: (node: string) => void;
};

export const useExplorer = create<State & Actions>()((set) => ({
  view: "estate",
  house: null,
  mode: "model",
  level: null,
  finish: DEFAULT_FINISH,
  arrangement: null,
  timeOfDay: "dzien",
  hovered: null,
  node: null,
  nodeRequest: 0,
  dissolve: null,
  dissolveFrom: "",
  finishReady: null,
  photo: false,
  ready: false,
  settled: false,
  progress: 0,
  fallback: false,
  entry: "photo",
  introDone: false,
  panelCollapsed: false,
  leadOpen: false,
  postQuality: "high",
  nearHouse: null,
  shot: null,
  shotReady: false,
  clean: false,

  set: (partial) => set(partial),
  setMode: (mode) => set({ mode, photo: false }),
  setLevel: (level) => set({ level, mode: "model" }),
  goToNode: (node) => set((s) => ({ node, nodeRequest: s.nodeRequest + 1, photo: false })),
}));

// Dev-only handle for scripted screenshots and debugging: window.__explorer.setState({ mode: "walk" }).
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __explorer: typeof useExplorer }).__explorer = useExplorer;
}

/**
 * Runs a scene change under a dissolve: freezes the current frame over the canvas, applies `change`,
 * and lets <DissolveOverlay> fade the frozen frame out once the new scene is complete and rendered.
 * Before the first reveal the poster already covers the stage, and while a dissolve is still waiting
 * its frame stays: the canvas under it may be hidden, so a fresh capture would be blank.
 */
export async function withDissolve(change: () => void) {
  const s = useExplorer.getState();
  const frame = s.ready && !(s.dissolve && !s.settled) ? await stage()?.freeze() : null;
  if (frame) useExplorer.setState({ dissolve: frame, dissolveFrom: sceneSignature(useExplorer.getState()) });
  change();
}

/** What a dissolve can change; navigations land asynchronously, so the overlay compares against this. */
export function sceneSignature(s: State) {
  return `${s.view}|${s.house}|${s.finish}|${s.mode}|${s.arrangement}|${s.postQuality}`;
}

/* --------------------------------------------------------------------------
   Imperative channel between the DOM UI and the r3f scene (camera zoom, frame
   capture for dissolves). Kept outside React state: these are commands, not data.
   -------------------------------------------------------------------------- */

type StageCommands = {
  zoom: (delta: number) => void;
  /** Copies the next frame into a canvas (dissolve transitions): a GPU copy, no encoding. */
  freeze: () => Promise<HTMLCanvasElement | null>;
  /** Captures the next frame as a JPEG data URL (posters, OG stills). */
  capture: () => Promise<string | null>;
};

let commands: StageCommands | null = null;

export function registerStageCommands(next: StageCommands | null) {
  commands = next;
  if (process.env.NODE_ENV !== "production") (window as unknown as { __stage: unknown }).__stage = next;
}

export function stage() {
  return commands;
}
