import { contracts } from "@octotrack/core/contracts";
import { useMemo } from "react";
import { useChoices } from "../../hooks/useChoices.ts";
import { useClock } from "../../hooks/useClock.ts";
import { useOpQuery } from "../../hooks/useOp.ts";
import { type HotkeyMap, useHotkeys } from "../../hooks/useHotkeys.ts";
import { undoLines } from "../../lib/lines.ts";
import { ErrorState } from "../ui/states.tsx";
import { UndoBar, type UndoLine } from "./UndoBar.tsx";

const NO_KEYS: HotkeyMap = {};

/** The Undo bar on every page, with u undoing the newest choice. */
export function PendingChoices() {
  const choices = useChoices();
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
  useHotkeys(keys);
  // The live region stays mounted while empty, so the first choice made is announced too.
  return (
    <>
      <UndoBar
        pending={choices.pending}
        now={now}
        lines={lines}
        onUndo={choices.undo}
        onPause={(id, line) => {
          choices.undo(id);
          choices.make(
            contracts.lineQueue.name,
            { ref: line },
            `Pausing ${lines[line]?.title ?? line}: up next`,
          );
        }}
      />
      {choices.failure === null ? null : <ErrorState error={choices.failure} />}
    </>
  );
}
