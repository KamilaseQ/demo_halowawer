"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { HouseId } from "@/lib/estate";
import { useExplorer, withDissolve } from "../state/store";

/** Navigation between explorer routes, always under a dissolve so the 3D stage never "pops". */
export function useExplorerNav() {
  const router = useRouter();

  const toEstate = useCallback(() => {
    const s = useExplorer.getState();
    if (s.view === "house") void withDissolve(() => router.push("/domy", { scroll: false }));
  }, [router]);

  const toHouse = useCallback(
    (id: HouseId, query = "") => {
      const s = useExplorer.getState();
      if (s.view === "house" && s.house === id && !query) return;
      void withDissolve(() => router.push(`/domy/${id.toLowerCase()}${query}`, { scroll: false }));
    },
    [router],
  );

  return { toEstate, toHouse };
}
