import { useSyncExternalStore } from "react";

/** A tiny external store: one value, many readers, no provider. */
export function createStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();

  return {
    get: () => value,
    set(next: T) {
      if (Object.is(next, value)) return;
      value = next;
      listeners.forEach((l) => l());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** React hook; the server snapshot is the initial value. */
    use(): T {
      return useSyncExternalStore(this.subscribe, this.get, () => initial);
    },
  };
}
