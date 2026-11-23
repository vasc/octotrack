import type { PlanBranch } from "@octotrack/core/schemas";
import { useState } from "react";
import type { Promotion } from "../../hooks/usePlanActions.ts";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Field } from "../ui/Field.tsx";
import { Note } from "../ui/Note.tsx";
import { Sheet } from "../ui/Sheet.tsx";

/**
 * Making a branch its own line: its title, what finishes it, and where it goes, up next or straight to working on. Its
 * steps and the issues on them move to the new line; the branch stays as a row that opens it, still holding up its
 * step.
 */
export function PromoteSheet({
  branch,
  issues,
  onPromote,
  onCancel,
}: {
  branch: PlanBranch;
  /** How many issues sit on its steps, which move with it. */
  issues: number;
  onPromote(promotion: Promotion): void;
  onCancel(): void;
}) {
  const [title, setTitle] = useState(branch.title);
  const [doneWhen, setDoneWhen] = useState("");
  const ready = title.trim() !== "" && doneWhen.trim() !== "";
  const send = (where: Promotion["where"]) => {
    if (ready) onPromote({ title: title.trim(), doneWhen: doneWhen.trim(), where });
  };
  const moving = `Its steps${issues === 0 ? "" : ` and ${issues} issue${issues === 1 ? "" : "s"}`} move to the new line.`;
  const stays =
    branch.holdsUp === null
      ? "Here it stays as a row that opens it."
      : `Here it stays as a row that opens it, still holding up step ${branch.holdsUp} until that line is done.`;
  return (
    <Sheet
      title={`Make ${branch.address} its own line`}
      onClose={onCancel}
      actions={
        <Actions>
          <Button variant="primary" disabled={!ready} onClick={() => send("up_next")}>
            Make it a line, up next
          </Button>
          <Button disabled={!ready} onClick={() => send("working")}>
            Start it now
          </Button>
        </Actions>
      }
    >
      <Note>
        {moving} {stays}
      </Note>
      {/* The title takes the focus: a one-line box, so the Return that opened the sheet from its menu types nothing. */}
      <Field label="Title" value={title} onChange={setTitle} autoFocus />
      <Field label="Done when" value={doneWhen} onChange={setDoneWhen} multiline />
    </Sheet>
  );
}
