import { useMemo } from "react";
import type { Entry } from "../lib/forYou.ts";
import { focusItem, pressNumbered } from "../lib/focus.ts";
import { openEntity } from "../lib/router.ts";
import type { HotkeyMap } from "./useHotkeys.ts";

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const ENTER = "Enter";

/**
 * For you's keys: j and k to the next and previous entry; the number keys on an entry other than a question, which
 * numbers its own answers; o or Enter to peek at its line, t to tell its owner; g u to Urgent; r to record answers.
 * ?, Esc and / are the shell's.
 */
export function useForYouKeys(options: {
  open: Entry | null;
  armed: boolean;
  /** A peek or a sheet is open: it takes the keys, and these stand down. */
  inspecting: boolean;
  step(forward: boolean): void;
  onRecord(): void;
  /** Goes to Urgent, when something is. */
  urgent: (() => void) | null;
}): HotkeyMap {
  const { open, armed, inspecting, step, onRecord, urgent } = options;
  return useMemo((): HotkeyMap => {
    if (inspecting) return {};
    const line = open?.line ?? null;
    const numbered =
      armed && open !== null && open.item.kind !== "question"
        ? Object.fromEntries(
            DIGITS.map((digit) => [
              digit,
              () => {
                const item = focusItem(document.body, open.ref);
                if (item !== undefined) pressNumbered(item, digit);
              },
            ]),
          )
        : {};
    return {
      r: onRecord,
      j: () => step(true),
      k: () => step(false),
      ...numbered,
      ...(line === null
        ? {}
        : {
            o: () => openEntity(line.ref),
            [ENTER]: () => openEntity(line.ref),
            t: () => openEntity(line.ref, "tell"),
          }),
      ...(urgent === null ? {} : { "g u": urgent }),
    };
  }, [open, armed, inspecting, step, onRecord, urgent]);
}
