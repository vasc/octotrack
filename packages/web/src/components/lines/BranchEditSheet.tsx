import type { PlanBranch, PlanStep } from "@octotrack/core/schemas";
import { useState } from "react";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Field } from "../ui/Field.tsx";
import { Note } from "../ui/Note.tsx";
import { Sheet } from "../ui/Sheet.tsx";

/** The steps typed one per line, blank lines left out. */
function stepsOf(text: string): string[] {
  return text
    .split("\n")
    .map((step) => step.trim())
    .filter((step) => step !== "");
}

/**
 * Renaming a branch or changing its steps, one per line. A step whose words stay keeps its status and its issues; the
 * issues of a step taken out go back to the step the branch forks from.
 */
export function BranchEditSheet({
  branch,
  steps,
  onSave,
  onCancel,
}: {
  branch: PlanBranch;
  steps: readonly PlanStep[];
  onSave(title: string, steps: readonly string[]): void;
  onCancel(): void;
}) {
  const [title, setTitle] = useState(branch.title);
  const [text, setText] = useState(steps.map((step) => step.title).join("\n"));
  const ready = title.trim() !== "" && stepsOf(text).length > 0;
  const save = () => {
    if (ready) onSave(title.trim(), stepsOf(text));
  };
  return (
    <Sheet
      title={`Change branch ${branch.address}`}
      onClose={onCancel}
      actions={
        <Actions>
          <Button variant="primary" disabled={!ready} onClick={save}>
            Save
          </Button>
        </Actions>
      }
    >
      <Field label="Title" value={title} onChange={setTitle} onSubmit={save} autoFocus />
      <Field label="Its steps, one per line" value={text} onChange={setText} onSubmit={save} multiline />
      <Note>A step whose words stay keeps its status and its issues.</Note>
    </Sheet>
  );
}
