import type { FinishId, House } from "@/lib/estate";

/**
 * Photoreal stills that can replace the live view at a walk node ("Wizualizacja"). They are the home page
 * Kreator's renders (same style ids), so the visitor sees the very same picture in both places.
 * `finishes` lists the styles that have a render at /explorer/renders/<room>/<finish>.jpg.
 */
const RENDERS: Record<string, { finishes: FinishId[]; label: string }> = {
  salon: { finishes: ["s1", "s4", "s3"], label: "Salon" },
  kuchnia: { finishes: ["s1", "s4", "s3"], label: "Kuchnia z jadalnią" },
  sypialnia: { finishes: ["s1", "s4", "s3"], label: "Sypialnia" },
};

export function renderFor(node: string | null, finish: FinishId): { src: string; label: string } | null {
  const r = node ? RENDERS[node] : undefined;
  if (!r || !r.finishes.includes(finish)) return null;
  return { src: `/explorer/renders/${node}/${finish}.jpg`, label: r.label };
}

export type GalleryItem = { src: string; alt: string; kind: "photo" | "plan" };

const g = (n: string, alt: string): GalleryItem => ({ src: `/explorer/gallery/${n}.jpg`, alt, kind: "photo" });

/** The developer's interior renders (semi-detached houses A–D). */
const INTERIORS: GalleryItem[] = [
  g("interior-1", "Strefa dzienna z wyjściem do ogrodu"),
  g("interior-2", "Jadalnia i ściana TV"),
  g("interior-5", "Salon"),
  g("interior-3", "Strefa dzienna, widok na kuchnię"),
  g("interior-7", "Sypialnia"),
  g("interior-8", "Pokój dziecka"),
];

/** Exterior renders and site photos. */
export const ESTATE_GALLERY: GalleryItem[] = [
  g("visualization-1", "Ogrody od południa"),
  g("visualization-2", "Wieczór na osiedlu"),
  g("visualization-3", "Wjazd od ulicy"),
  g("visualization-6", "Osiedle o zmierzchu"),
  g("estate-3", "Budowa, październik 2026"),
  g("estate-1", "Osiedle z lotu ptaka"),
];

/** Gallery of one house: interiors (A–D share the layout family), exteriors, then the house's own plans. */
export function galleryFor(house: House): GalleryItem[] {
  const plans = house.plans.filter((p) => p.level !== 2).map((p) => ({ src: p.src, alt: `Dom ${house.id} · ${p.label}`, kind: "plan" as const }));
  const interiors = house.layout === "b" ? INTERIORS : INTERIORS.slice(2);
  return [...interiors, ...ESTATE_GALLERY.slice(0, 4), ...plans];
}
