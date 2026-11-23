import type { PlanStep } from "@octotrack/core/schemas";
import { useState } from "react";
import { stepsOf } from "../../lib/lines.ts";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Field } from "../ui/Field.tsx";
import { Note } from "../ui/Note.tsx";
import { Sheet } from "../ui/Sheet.tsx";

/**
 * Rewriting a line's critical path, one step per line (triage/T-Line's Edit the plan). A step whose words stay keeps its
 * status, its issues and its branches; if someone rewrote the plan while it was open, the tracker refuses and says so.
 */
export function PlanEditSheet({
  steps,
  onSave,
  onCancel,
}: {
  /** The critical path as it stands. */
  steps: readonly PlanStep[];
  /** The steps typed, and the ids of the steps it was opened on, so a plan changed meanwhile is not overwritten. */
  onSave(steps: readonly string[], seen: readonly number[]): void;
  onCancel(): void;
}) {
  const [text, setText] = useState(steps.map((step) => step.title).join("\n"));
  // What it was opened on, kept as it was: a refetch while it is open must not make a stale rewrite look current.
  const [seen] = useState(() => steps.map((step) => step.id));
  const ready = stepsOf(text).length > 0;
  const save = () => {
    if (ready) onSave(stepsOf(text), seen);
  };
  return (
    <Sheet
      title="Edit the plan"
      onClose={onCancel}
      actions={
        <Actions>
          <Button variant="primary" disabled={!ready} onClick={save}>
            Save
          </Button>
        </Actions>
      }
    >
      <Field
        label="Its steps, one per line"
        value={text}
        onChange={setText}
        onSubmit={save}
        multiline
        autoFocus
      />
      <Note>A step whose words stay keeps its status, its issues and its branches.</Note>
    </Sheet>
  );
}
