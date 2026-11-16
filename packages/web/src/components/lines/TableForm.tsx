import { useState } from "react";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Field } from "../ui/Field.tsx";
import { Note } from "../ui/Note.tsx";
import { Sheet } from "../ui/Sheet.tsx";

/** What tabling does, in one sentence: what it holds until it starts again, and who winds down. */
function consequences(held: { questions: number; tasks: number } | undefined, owner: string | null): string {
  const parts = [
    held === undefined || held.questions === 0
      ? null
      : `${held.questions} question${held.questions === 1 ? "" : "s"}`,
    held === undefined || held.tasks === 0 ? null : `${held.tasks} task${held.tasks === 1 ? "" : "s"}`,
  ].filter((part) => part !== null);
  const holds = parts.length === 0 ? null : `Tabling holds ${parts.join(" and ")} until it starts again`;
  const winds = owner === null ? null : `${owner} winds down`;
  if (holds === null && winds === null) return "";
  if (holds === null) return `Tabling it, ${winds}.`;
  return winds === null ? `${holds}.` : `${holds}; ${winds}.`;
}

/**
 * Tabling a line, in a sheet of its own: why it waits, since a tabled line always says why, and if wanted a day to
 * look at it again, when it comes back under Proposed.
 */
export function TableForm({
  title,
  held,
  owner = null,
  onTable,
  onCancel,
}: {
  title: string;
  /** What the line holds that waits with it. */
  held?: { questions: number; tasks: number };
  /** Who winds down: its owner, when it has one. */
  owner?: string | null;
  onTable(reason: string, lookAgainAt: string | null): void;
  onCancel(): void;
}) {
  const [reason, setReason] = useState("");
  const [lookAgain, setLookAgain] = useState("");
  const table = () => {
    if (reason.trim() !== "") onTable(reason.trim(), lookAgain === "" ? null : lookAgain);
  };
  const facts = consequences(held, owner);
  return (
    <Sheet
      title={`Table ${title}`}
      onClose={onCancel}
      actions={
        <Actions>
          <Button variant="primary" disabled={reason.trim() === ""} onClick={table}>
            Table it
          </Button>
        </Actions>
      }
    >
      <Field label="Why it waits" value={reason} onChange={setReason} onSubmit={table} autoFocus />
      <Field label="Look again on · optional" type="date" value={lookAgain} onChange={setLookAgain} />
      {facts === "" ? null : <Note>{facts}</Note>}
    </Sheet>
  );
}
