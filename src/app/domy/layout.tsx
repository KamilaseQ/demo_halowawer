import type { ReactNode } from "react";
import { Explorer } from "@/components/explorer/explorer/Explorer";

/** The 3D stage lives in the segment layout so it persists between /domy and /domy/[dom]. */
export default function HousesLayout({ children }: { children: ReactNode }) {
  return <Explorer>{children}</Explorer>;
}
