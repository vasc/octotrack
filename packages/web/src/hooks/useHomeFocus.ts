import type { HomeView } from "@octotrack/core/schemas";
import { useCallback, useMemo, useState } from "react";
import {
  defaultFocus,
  lineFocusRef,
  lineRefs,
  nextFocus,
  orderedRefs,
  stepFocus,
  stepLineFocus,
} from "../lib/focus.ts";
import type { HotkeyMap } from "./useHotkeys.ts";

interface Held {
  focus: string | null;
  /** The items as they were, to find the next one when the focused item goes. */
  order: readonly string[];
  /** The lines as they were, which may hold focus themselves. */
  lines: readonly string[];
  asked: string | null;
  /** Where the developer said they are: saying it moves focus to that place's first task. */
  place: string | null;
  /** Counts the moves the developer made, so the browser's focus follows those and never a live update. */
  moved: number;
}

/**
 * Which item on home has focus, and so takes the number keys. It stays where the developer put it while things arrive
 * and move around it, and moves on only when its own item is gone: to the next item, else the one before. While that
 * item's choice waits with Undo its keys are disarmed, so a second key press cannot send a second choice. A
 * notification or a count that names an item (`asked`) moves focus there. j and k walk the items; Shift J and K walk
 * the lines themselves, working on then up next, so a line with nothing for the developer can be reached.
 */
export function useHomeFocus(home: HomeView | undefined, asked: string | null, pending: ReadonlySet<string>) {
  const order = useMemo(() => (home === undefined ? [] : orderedRefs(home)), [home]);
  const lines = useMemo(() => (home === undefined ? [] : lineRefs(home).map(lineFocusRef)), [home]);
  const [held, setHeld] = useState<Held>({
    focus: null,
    order: [],
    lines: [],
    asked: null,
    place: null,
    moved: 0,
  });
  const place = home?.at?.place ?? null;
  let focus = held.focus;
  if (
    home !== undefined &&
    (held.order !== order || held.lines !== lines || held.asked !== asked || held.place !== place)
  ) {
    // Adjusted while rendering, from what changed, rather than in an effect that would paint the old focus first.
    const arrived = place !== held.place && place !== null ? (home.at?.tasks[0]?.ref ?? null) : null;
    const fresh = (asked !== held.asked && asked !== null && order.includes(asked)) || arrived !== null;
    const onLine = held.focus !== null && lines.includes(held.focus);
    focus = fresh
      ? (arrived ?? asked)
      : onLine
        ? held.focus
        : nextFocus(held.focus, held.order, order, asked ?? defaultFocus(home));
    setHeld({ focus, order, lines, asked, place, moved: fresh ? held.moved + 1 : held.moved });
  }
  /** The developer moved focus here: the browser's focus follows. */
  const choose = useCallback(
    (ref: string) => setHeld((current) => ({ ...current, focus: ref, moved: current.moved + 1 })),
    [],
  );
  /** The browser's focus is already here, by a click or Tab: home's focus follows it. */
  const follow = useCallback(
    (ref: string) => setHeld((current) => (current.focus === ref ? current : { ...current, focus: ref })),
    [],
  );
  /** Later sent this item to the bottom of its line: focus goes to what came after it, not with it. */
  const skip = useCallback(
    (ref: string) =>
      setHeld((current) => {
        const at = current.order.indexOf(ref);
        const next = current.order[at + 1] ?? current.order[at - 1] ?? null;
        return at === -1 || current.focus !== ref
          ? current
          : { ...current, focus: next, moved: current.moved + 1 };
      }),
    [],
  );
  const keys = useMemo((): HotkeyMap => {
    if (home === undefined) return {};
    const step = (forward: boolean) => () => {
      const next = stepFocus(home, focus, order, forward);
      if (next !== null) choose(next);
    };
    const stepLine = (forward: boolean) => () => {
      const next = stepLineFocus(home, focus, forward);
      if (next !== null) choose(next);
    };
    return {
      ...(order.length === 0 ? {} : { j: step(true), k: step(false) }),
      ...(lines.length === 0 ? {} : { J: stepLine(true), K: stepLine(false) }),
    };
  }, [focus, order, lines, home, choose]);
  return {
    focus,
    moved: held.moved,
    armed: focus !== null && !pending.has(focus),
    choose,
    follow,
    skip,
    keys,
  };
}
