import type { Line } from "@octotrack/core/schemas";
import { useMemo, useState } from "react";
import { type HotkeyMap, useHotkeys } from "../../hooks/useHotkeys.ts";
import { Field } from "../ui/Field.tsx";
import { Note } from "../ui/Note.tsx";
import { Options } from "../ui/Options.tsx";
import { Sheet } from "../ui/Sheet.tsx";

/**
 * Fold into, in a sheet of its own: a box to find a line, then the open lines a proposal could join, numbered for the
 * keys, one press each.
 */
export function FoldPicker({
  title,
  targets,
  onFold,
  onCancel,
}: {
  title: string;
  targets: readonly Line[];
  onFold(into: string): void;
  onCancel(): void;
}) {
  // What is typed to find a line belongs to this sheet alone, so it is the component's own state.
  const [find, setFind] = useState("");
  const shown = useMemo(() => {
    const words = find.trim().toLowerCase();
    // A line is found by its title or its ref.
    return targets.filter(
      (target) => target.title.toLowerCase().includes(words) || target.ref.toLowerCase().includes(words),
    );
  }, [targets, find]);
  const keys = useMemo(
    (): HotkeyMap =>
      Object.fromEntries(
        shown.slice(0, 9).map((target, index) => [String(index + 1), () => onFold(target.ref)]),
      ),
    [shown, onFold],
  );
  useHotkeys(keys, { overSheets: true });
  return (
    <Sheet title={`Fold ${title} into…`} onClose={onCancel}>
      <Field label="Find a line" value={find} onChange={setFind} autoFocus />
      {shown.length === 0 ? (
        <Note>Nothing matches</Note>
      ) : (
        <Options
          options={shown.map((target) => ({ key: target.ref, label: target.title }))}
          onPick={onFold}
        />
      )}
    </Sheet>
  );
}
