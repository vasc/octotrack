import type { HomeView } from "@octotrack/core/schemas";
import { useMemo, useState } from "react";
import { defaultFocus, lineFocusRef, lineOf, lineRefs, nextFocus, orderedRefs } from "../lib/focus.ts";
import type { HotkeyMap } from "./useHotkeys.ts";

interface Held {
  focus: string | null;
  /** The items as they were, to find the next one when the focused item goes. */
  order: readonly string[];
  /** The lines as they were, which may hold focus themselves. */
  lines: readonly string[];
  asked: string | null;
}

/**
 * Which item on home has focus, and so takes the number keys and Enter. It stays where the developer put it while
 * things arrive and move around it, and moves on only when its own item is gone: to the next item, else the one
 * before. While that item's answer waits with Undo its keys are disarmed, so a second key press cannot send a second
 * answer. A notification that names an item (`asked`) moves focus there. j and k walk the items; Shift J and K walk
 * the lines themselves, working on then up next, so a line with nothing for the developer can be reached.
 */
export function useHomeFocus(home: HomeView | undefined, asked: string | null, pending: ReadonlySet<string>) {
  const order = useMemo(() => (home === undefined ? [] : orderedRefs(home)), [home]);
  const lines = useMemo(() => (home === undefined ? [] : lineRefs(home).map(lineFocusRef)), [home]);
  const [held, setHeld] = useState<Held>({ focus: null, order: [], lines: [], asked: null });
  let focus = held.focus;
  if (home !== undefined && (held.order !== order || held.lines !== lines || held.asked !== asked)) {
    // Adjusted while rendering, from what changed, rather than in an effect that would paint the old focus first.
    const fresh = asked !== held.asked && asked !== null && order.includes(asked);
    const onLine = held.focus !== null && lines.includes(held.focus);
    focus = fresh
      ? asked
      : onLine
        ? held.focus
        : nextFocus(held.focus, held.order, order, asked ?? defaultFocus(home));
    setHeld({ focus, order, lines, asked });
  }
  const choose = (ref: string) => setHeld((current) => ({ ...current, focus: ref }));
  const keys = useMemo((): HotkeyMap => {
    if (home === undefined) return {};
    const at = focus === null ? -1 : order.indexOf(focus);
    const step = (by: number) => () => {
      const next = order[Math.min(Math.max(at + by, 0), order.length - 1)];
      if (next !== undefined) setHeld((current) => ({ ...current, focus: next }));
    };
    const current = lineOf(home, focus);
    const lineAt = current === null ? -1 : lines.indexOf(lineFocusRef(current));
    const stepLine = (by: number) => () => {
      const next = lines[Math.min(Math.max(lineAt + by, 0), lines.length - 1)];
      if (next !== undefined) setHeld((state) => ({ ...state, focus: next }));
    };
    return {
      ...(order.length === 0 ? {} : { j: step(1), k: step(-1) }),
      ...(lines.length === 0 ? {} : { J: stepLine(1), K: stepLine(-1) }),
    };
  }, [focus, order, lines, home]);
  return { focus, armed: focus !== null && !pending.has(focus), choose, keys };
}
