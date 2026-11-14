import type { HomeView } from "@octotrack/core/schemas";
import { useMemo } from "react";
import { firstOf, isQuestion, lineOf } from "../lib/focus.ts";
import { openEntity } from "../lib/router.ts";
import type { HotkeyMap } from "./useHotkeys.ts";

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * Picks the focused item's numbered choice, as drawn: a question numbers its own options, so this is for every other
 * item (a step-in action, a proposal's choice, Done… or Can't do it…, Accept or Keep). The page draws the numbers;
 * the key presses the button it names, as a click would.
 */
function pressChoice(number: string): void {
  const focused = document.querySelector('[data-selected="true"]');
  const button = focused?.querySelector(`[data-choice="${number}"]`);
  if (button instanceof HTMLButtonElement && !button.disabled) button.click();
}

/**
 * Home's keys beyond moving focus: g u to the urgent question, o to open the focused item's line, t to table it, alt
 * with the arrows to move it, the number keys on items other than questions, ? for the list, r to record answers.
 */
export function useHomeKeys(options: {
  home: HomeView | undefined;
  focus: string | null;
  armed: boolean;
  choose(ref: string): void;
  move(line: string, direction: "up" | "down"): void;
  onHelp(): void;
  onRecord(): void;
}): HotkeyMap {
  const { home, focus, armed, choose, move, onHelp, onRecord } = options;
  return useMemo((): HotkeyMap => {
    const always: HotkeyMap = { "?": onHelp, r: onRecord };
    if (home === undefined) return always;
    const line = lineOf(home, focus);
    const onLine: HotkeyMap =
      line === null
        ? {}
        : {
            o: () => openEntity(line),
            t: () => openEntity(line, "table"),
            "Alt+ArrowUp": () => move(line, "up"),
            "Alt+ArrowDown": () => move(line, "down"),
          };
    const numbers: HotkeyMap =
      armed && !isQuestion(home, focus)
        ? Object.fromEntries(DIGITS.map((digit) => [digit, () => pressChoice(digit)]))
        : {};
    const urgent = firstOf(home, "urgent");
    return {
      ...always,
      ...onLine,
      ...numbers,
      ...(urgent === null ? {} : { "g u": () => choose(urgent) }),
    };
  }, [home, focus, armed, choose, move, onHelp, onRecord]);
}
