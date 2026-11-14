import { useSyncExternalStore } from "react";

/** The phone layout's breakpoint, the same as the stylesheet's. */
const NARROW = "(max-width: 720px)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(NARROW);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Whether the screen is phone-sized, read from the browser and followed as it changes. */
export function useNarrow(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(NARROW).matches,
    () => false,
  );
}
