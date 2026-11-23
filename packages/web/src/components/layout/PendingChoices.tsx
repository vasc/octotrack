import { contracts } from "@octotrack/core/contracts";
import { useMemo } from "react";
import { createPortal } from "react-dom";
import { useChoices } from "../../hooks/useChoices.ts";
import { useClock } from "../../hooks/useClock.ts";
import { useOpQuery } from "../../hooks/useOp.ts";
import { useRefused } from "../../hooks/useRefused.ts";
import { type HotkeyMap, useHotkeys } from "../../hooks/useHotkeys.ts";
import { undoLines } from "../../lib/lines.ts";
import { UndoBar, type UndoLine } from "./UndoBar.tsx";
import { failureText } from "../../lib/failure.ts";

const NO_KEYS: HotkeyMap = {};

/**
 * The Undo bar on every page, with u undoing the newest choice. It is drawn outside the page, as a sheet is, so a sheet
 * that makes the page behind it inert leaves the bar usable above it, and u works there too.
 */
export function PendingChoices() {
  const choices = useChoices();
  const refused = useRefused();
  const home = useOpQuery(contracts.homeShow, {});
  const now = useClock(choices.pending.some((choice) => choice.state === "pending"));
  const lines = useMemo(
    (): Record<string, UndoLine> => (home.data === undefined ? {} : undoLines(home.data)),
    [home.data],
  );
  const newest = choices.pending.filter((choice) => choice.state === "pending").at(-1);
  const { undo } = choices;
  const keys = useMemo(
    (): HotkeyMap => (newest === undefined ? NO_KEYS : { u: () => undo(newest.id) }),
    [newest, undo],
  );
  useHotkeys(keys, { overSheets: true });
  // The live region stays mounted while empty, so the first choice made is announced too.
  return createPortal(
    <UndoBar
      pending={choices.pending}
      refused={refused.items}
      onDismiss={refused.dismiss}
      now={now}
      lines={lines}
      onUndo={choices.undo}
      loadFailed={
        choices.pendingError === null
          ? null
          : { reason: failureText(choices.pendingError).text, onRetry: choices.retryPending }
      }
      onPause={(id, line) => {
        choices.undo(id);
        choices.make(
          contracts.lineQueue.name,
          { ref: line },
          `Pausing ${lines[line]?.title ?? line}: up next`,
        );
      }}
    />,
    document.body,
  );
}
