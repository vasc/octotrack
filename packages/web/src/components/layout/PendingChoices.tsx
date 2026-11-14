import { useMemo } from "react";
import { useChoices } from "../../hooks/useChoices.ts";
import { type HotkeyMap, useHotkeys } from "../../hooks/useHotkeys.ts";
import { ErrorState } from "../ui/states.tsx";
import { UndoBar } from "./UndoBar.tsx";

const NO_KEYS: HotkeyMap = {};

/** The Undo bar on every page, with u undoing the newest choice. */
export function PendingChoices() {
  const choices = useChoices();
  const newest = choices.pending.at(-1);
  const { undo } = choices;
  const keys = useMemo(
    (): HotkeyMap => (newest === undefined ? NO_KEYS : { u: () => undo(newest.id) }),
    [newest, undo],
  );
  useHotkeys(keys);
  if (choices.pending.length === 0 && choices.failure === null) return null;
  return (
    <>
      <UndoBar pending={choices.pending} onUndo={choices.undo} onNow={choices.now} />
      {choices.failure === null ? null : <ErrorState error={choices.failure} />}
    </>
  );
}
