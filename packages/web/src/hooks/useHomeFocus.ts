import type { HomeView } from "@octotrack/core/schemas";
import { useMemo, useState } from "react";
import { defaultFocus, nextFocus, orderedRefs } from "../lib/focus.ts";
import type { HotkeyMap } from "./useHotkeys.ts";

interface Held {
  focus: string | null;
  order: readonly string[];
  asked: string | null;
}

/**
 * Which item on home has focus, and so takes the number keys and Enter. It stays where the developer put it while
 * things arrive and move around it, and moves on only when its own item is gone. While that item's answer waits with
 * Undo its keys are disarmed, so a second key press cannot send a second answer. A notification that names an item
 * (`asked`) moves focus there.
 */
export function useHomeFocus(home: HomeView | undefined, asked: string | null, pending: ReadonlySet<string>) {
  const order = useMemo(() => (home === undefined ? [] : orderedRefs(home)), [home]);
  const [held, setHeld] = useState<Held>({ focus: null, order: [], asked: null });
  let focus = held.focus;
  if (home !== undefined && (held.order !== order || held.asked !== asked)) {
    // Adjusted while rendering, from what changed, rather than in an effect that would paint the old focus first.
    const fresh = asked !== held.asked && asked !== null && order.includes(asked);
    focus = fresh ? asked : nextFocus(held.focus, held.order, order, asked ?? defaultFocus(home));
    setHeld({ focus, order, asked });
  }
  const choose = (ref: string) => setHeld((current) => ({ ...current, focus: ref }));
  const keys = useMemo((): HotkeyMap => {
    const at = focus === null ? -1 : order.indexOf(focus);
    const step = (by: number) => () => {
      const next = order[Math.min(Math.max(at + by, 0), order.length - 1)];
      if (next !== undefined) setHeld((current) => ({ ...current, focus: next }));
    };
    return order.length === 0 ? {} : { j: step(1), k: step(-1) };
  }, [focus, order]);
  return { focus, armed: focus !== null && !pending.has(focus), choose, keys };
}
