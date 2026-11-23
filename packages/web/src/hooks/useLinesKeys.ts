import type { HomeView } from "@octotrack/core/schemas";
import { useEffect, useMemo, useState } from "react";
import { focusItem, lineFocusRef } from "../lib/focus.ts";
import { navigate, openEntity } from "../lib/router.ts";
import type { HotkeyMap } from "./useHotkeys.ts";

const ENTER = "Enter";

/**
 * Lines' keys: j and k move between the lines being worked on and up next; o or Enter opens the one with focus on its
 * page, t tells its owner, and Alt with the arrows moves it in the order. ?, Esc and / are the shell's.
 */
export function useLinesKeys(options: {
  home: HomeView | undefined;
  /** A peek or a sheet is open: it takes the keys, and these stand down. */
  inspecting: boolean;
  move(line: string, direction: "up" | "down"): void;
}) {
  const { home, inspecting, move } = options;
  const [line, setLine] = useState<string | null>(null);
  const keys = useMemo((): HotkeyMap => {
    if (inspecting || home === undefined) return {};
    const order = [...home.working, ...home.upNext].map((other) => other.ref);
    if (order.length === 0) return {};
    const at = line === null ? -1 : order.indexOf(line);
    const step = (forward: boolean) => () => {
      const next = at === -1 ? (forward ? order[0] : order.at(-1)) : order[at + (forward ? 1 : -1)];
      if (next !== undefined) setLine(next);
    };
    const onLine: HotkeyMap =
      line === null || at === -1
        ? {}
        : {
            o: () => navigate(`/lines/${line}`),
            [ENTER]: () => navigate(`/lines/${line}`),
            t: () => openEntity(line, "tell"),
            "Alt+ArrowUp": () => move(line, "up"),
            "Alt+ArrowDown": () => move(line, "down"),
          };
    return { j: step(true), k: step(false), ...onLine };
  }, [home, inspecting, line, move]);
  // The browser's focus and scroll go with the keys' to the line, so it is in view and a screen reader follows; both are
  // the browser's, outside React.
  useEffect(() => {
    if (line === null) return;
    const element = focusItem(document, lineFocusRef(line));
    if (element === undefined) return;
    element.focus({ preventScroll: true });
    if (typeof element.scrollIntoView === "function") element.scrollIntoView({ block: "nearest" });
  }, [line]);
  return { keys, focus: line === null ? null : lineFocusRef(line) };
}
