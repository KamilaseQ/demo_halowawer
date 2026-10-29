"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { ARRANGEMENTS, DEFAULT_FINISH, getHouse, isFinishId, type HouseId, type LevelId } from "@/lib/estate";
import { useExplorer, type HouseMode, type TimeOfDay } from "../state/store";

/* URL contract (shareable by sales advisers, linked from the home page):
   /domy
   /domy/<dom>?widok=model|spacer|rzut|galeria&poziom=parter|pietro&styl=s1|s4|s3&pora=rano|dzien|noc&punkt=<node>&aranzacja=<id> */

const MODE_TO_PARAM: Record<HouseMode, string | null> = { model: null, walk: "spacer", plan: "rzut", gallery: "galeria" };
const PARAM_TO_MODE: Record<string, HouseMode> = { model: "model", spacer: "walk", rzut: "plan", galeria: "gallery" };
const LEVEL_TO_PARAM: Record<LevelId, string> = { 0: "parter", 1: "pietro", 2: "poddasze" };
const PARAM_TO_LEVEL: Record<string, LevelId> = { parter: 0, pietro: 1 };
const TIMES: TimeOfDay[] = ["rano", "dzien", "noc"];

function buildQuery(s: ReturnType<typeof useExplorer.getState>) {
  const q = new URLSearchParams();
  if (s.view === "house") {
    const mode = MODE_TO_PARAM[s.mode];
    if (mode) q.set("widok", mode);
    if ((s.mode === "model" || s.mode === "plan") && s.level !== null) q.set("poziom", LEVEL_TO_PARAM[s.level]);
    if (s.finish !== DEFAULT_FINISH) q.set("styl", s.finish);
    if (s.arrangement) q.set("aranzacja", s.arrangement);
    if (s.mode === "walk" && s.node) q.set("punkt", s.node);
  }
  if (s.timeOfDay !== "dzien") q.set("pora", s.timeOfDay);
  const str = q.toString();
  return str ? `?${str}` : "";
}

/** Route → store on navigation, store → URL (replaceState) on interaction. */
export function RouteState({ house: houseId }: { house?: HouseId }) {
  const params = useSearchParams();

  useEffect(() => {
    const house = getHouse(houseId);
    const styl = params.get("styl");
    const pora = params.get("pora") as TimeOfDay | null;
    const arrangement = params.get("aranzacja");
    const validArrangement = house && ARRANGEMENTS[house.layout]?.some((a) => a.id === arrangement) ? arrangement : null;
    const s = useExplorer.getState();
    // Explicit intent in the link (adviser links, home chips) skips the photo and goes straight to 3D.
    const intent = ["widok", "punkt", "styl", "pora", "poziom"].some((k) => params.has(k));

    useExplorer.setState({
      view: house ? "house" : "estate",
      house: house ? house.id : null,
      mode: house ? (PARAM_TO_MODE[params.get("widok") ?? "model"] ?? "model") : "model",
      level: house ? (PARAM_TO_LEVEL[params.get("poziom") ?? ""] ?? null) : null,
      finish: isFinishId(styl) ? styl : s.finish,
      arrangement: validArrangement,
      timeOfDay: pora && TIMES.includes(pora) ? pora : s.timeOfDay,
      node: params.get("punkt"),
      hovered: null,
      photo: false,
      entry: house || intent ? "model" : s.entry,
    });
  }, [houseId, params]);

  useEffect(
    () =>
      useExplorer.subscribe((s) => {
        const base = s.view === "house" && s.house ? `/domy/${s.house.toLowerCase()}` : "/domy";
        if (window.location.pathname !== base) return; // a navigation is in flight
        const next = base + buildQuery(s);
        if (next !== window.location.pathname + window.location.search) window.history.replaceState(window.history.state, "", next);
      }),
    [],
  );

  return null;
}
