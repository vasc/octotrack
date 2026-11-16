import { useSyncExternalStore } from "react";
import { REFUSED } from "../lib/refused.ts";

/** The choices the tracker never took, which the Undo bar shows until dismissed: brought into React from outside it. */
export function useRefused() {
  const items = useSyncExternalStore(REFUSED.subscribe, REFUSED.list);
  return { items, dismiss: REFUSED.dismiss };
}
