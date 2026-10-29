import { createStore } from "./store";

/**
 * Loading state of the hero film, shared by the film controller (producer)
 * and the preloader (consumer).
 * - loading: bytes are coming in (loaded / total, total 0 = unknown yet)
 * - ready: everything is in memory and decoded, the first frame is on screen
 * - fallback: loading failed, the page shows the still photo hero instead
 */
export type FilmLoad = {
  state: "loading" | "ready" | "fallback";
  loaded: number;
  total: number;
};

export const filmLoad = createStore<FilmLoad>({ state: "loading", loaded: 0, total: 0 });

/** fetch() that reports bytes as they arrive and resolves to a Blob. */
export async function fetchWithProgress(
  url: string,
  onProgress: (loaded: number, total: number) => void,
  signal: AbortSignal,
  priority: "high" | "low" | "auto" = "auto",
): Promise<Blob> {
  const res = await fetch(url, { signal, priority } as RequestInit);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const total = Number(res.headers.get("content-length")) || 0;
  const type = res.headers.get("content-type") ?? "";
  if (!res.body) {
    const blob = await res.blob();
    onProgress(blob.size, blob.size);
    return blob;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let loaded = 0;
  onProgress(0, total);
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value as Uint8Array<ArrayBuffer>);
    loaded += value.byteLength;
    onProgress(loaded, Math.max(total, loaded));
  }
  return new Blob(chunks, { type });
}
