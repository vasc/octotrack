import type { Drift } from "@octotrack/core/schemas";
import { useState } from "react";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Field } from "../ui/Field.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { Note } from "../ui/Note.tsx";

export type DriftMode = "updated" | "verified";

export interface DriftAnswerProps {
  drift: Drift;
  /** An answer to it waits with Undo: neither button can send another. */
  busy?: boolean;
  onAck(ref: string, mode: DriftMode, note: string): void;
}

/**
 * How something out of date is cleared, only ever with an explanation: what to check, the required note, then Updated
 * and Nothing to update, both off until the note has words. Once cleared, the note it was cleared with.
 */
export function DriftAnswer({ drift, busy = false, onAck }: DriftAnswerProps) {
  // The note is typed here alone, so it is the component's own state.
  const [note, setNote] = useState("");
  // Which answer was pressed, so that it says it is on its way while it waits.
  const [pressed, setPressed] = useState<DriftMode | null>(null);
  const trimmed = note.trim();
  const send = (mode: DriftMode) => {
    setPressed(mode);
    onAck(drift.ref, mode, trimmed);
  };
  const word = (mode: DriftMode) => (busy && pressed === mode ? "Marking…" : undefined);
  if (drift.status !== "open") {
    return drift.note === null ? null : (
      <Note>{drift.resolvedBy === null ? drift.note : `${drift.resolvedBy}: ${drift.note}`}</Note>
    );
  }
  return (
    <>
      <Markdown text={drift.suggestion} />
      <Field
        label="Note · required: what changed, or why nothing had to"
        value={note}
        onChange={setNote}
        multiline
      />
      <Actions>
        {/* Drift about state clears by itself once the state is right, so "updated" could only be a false claim. */}
        {drift.edge ? (
          <Button
            variant="primary"
            disabled={trimmed === "" || busy}
            busy={word("updated")}
            onClick={() => send("updated")}
          >
            Updated
          </Button>
        ) : null}
        <Button disabled={trimmed === "" || busy} busy={word("verified")} onClick={() => send("verified")}>
          Nothing to update
        </Button>
      </Actions>
    </>
  );
}
