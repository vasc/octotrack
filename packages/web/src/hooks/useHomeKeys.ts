import type { HomeView } from "@octotrack/core/schemas";
import { type RefObject, useMemo } from "react";
import { firstOf, isQuestion, lineOf } from "../lib/focus.ts";
import { openEntity } from "../lib/router.ts";
import type { HotkeyMap } from "./useHotkeys.ts";

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const ENTER = "Enter";

/**
 * Picks the focused item's numbered choice, as drawn: a question numbers its own options, so this is for every other
 * item (a step-in action, a proposal's choice, Done… or Can't do it…, Accept or Keep). The page draws the numbers;
 * the key presses the button it names, as a click would.
 */
function pressChoice(page: HTMLElement | null, focus: string, number: string): void {
  const item = [...(page?.querySelectorAll<HTMLElement>("[data-focus-ref]") ?? [])].find(
    (element) => element.dataset.focusRef === focus,
  );
  const button = item?.querySelector(`[data-choice="${number}"]`);
  if (button instanceof HTMLButtonElement && !button.disabled) button.click();
}

/**
 * Home's keys beyond moving focus: g u to the urgent question, o or Enter to open the focused item's line, t to tell
 * its owner, alt with the arrows to move it, the number keys on items other than questions, r to record answers. ?,
 * g p, Esc and / are the shell's.
 */
export function useHomeKeys(options: {
  /** Home itself, where the focused item and its numbered buttons are drawn. */
  page: RefObject<HTMLElement | null>;
  home: HomeView | undefined;
  focus: string | null;
  armed: boolean;
  choose(ref: string): void;
  move(line: string, direction: "up" | "down"): void;
  onRecord(): void;
}): HotkeyMap {
  const { page, home, focus, armed, choose, move, onRecord } = options;
  return useMemo((): HotkeyMap => {
    const always: HotkeyMap = { r: onRecord };
    if (home === undefined) return always;
    const line = lineOf(home, focus);
    const onLine: HotkeyMap =
      line === null
        ? {}
        : {
            o: () => openEntity(line),
            [ENTER]: () => openEntity(line),
            t: () => openEntity(line, "tell"),
            "Alt+ArrowUp": () => move(line, "up"),
            "Alt+ArrowDown": () => move(line, "down"),
          };
    // Only on an item: a line itself has no numbered choices, and a question numbers its own options.
    const item = focus !== null && !focus.startsWith("line:") && !isQuestion(home, focus) ? focus : null;
    const numbers: HotkeyMap =
      armed && item !== null
        ? Object.fromEntries(DIGITS.map((digit) => [digit, () => pressChoice(page.current, item, digit)]))
        : {};
    const urgent = firstOf(home, "urgent");
    return {
      ...always,
      ...onLine,
      ...numbers,
      ...(urgent === null ? {} : { "g u": () => choose(urgent) }),
    };
  }, [page, home, focus, armed, choose, move, onRecord]);
}
